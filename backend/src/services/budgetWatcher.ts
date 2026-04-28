import { config } from "../config.js";
import { sumPlatformCostTodayGlobal } from "../db/usageLedger.js";
import { sendEmail, EmailNotConfiguredError } from "./email/acsClient.js";

// Phase 22A: budget watcher.
//
// Polls the global daily $ spend (sum of `ai_usage_ledger.cost_usd` since
// today's UTC start) every 60s. When spend crosses 50% / 80% / 100% of
// the configured `FREE_TIER_DAILY_USD_CAP`, fires a single email per
// threshold per UTC day to `OPERATOR_ALERT_EMAIL`. The 100% trip is the
// loud one — by that point the credential service is already short-
// circuiting platform calls (L4 in services/ai/credential.ts), but the
// email gives the operator real-time signal so they can decide to raise
// the cap, investigate abuse, or roll out a fix.
//
// Idempotency model: the in-memory `lastFiredKey` tracks which {day, %}
// combination has already fired in this process. A backend restart loses
// this state (acceptable — a duplicate alert email is preferable to a
// missed one), but within a single boot the watcher never spams.
//
// Why not store the dedup state in Postgres: keeping a "have we already
// emailed today at 50% threshold?" row in DB adds a write on the hot
// path. The watcher polls every 60s so a restart-induced duplicate alert
// arrives at worst once per restart per threshold. Tradeoff is deliberate.

const POLL_INTERVAL_MS = 60_000;
const THRESHOLDS = [0.5, 0.8, 1.0] as const;

/** Last threshold key already fired in this process. Format: "YYYY-MM-DD:0.5".
 *  We track the HIGHEST threshold that has fired today so a restart that
 *  comes back at 90% spend doesn't re-fire 50% + 80% redundantly. */
let lastFiredKey: string | null = null;

let watcher: NodeJS.Timeout | null = null;

function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function utcStartOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function pickHighestCrossed(
  spend: number,
  cap: number,
): (typeof THRESHOLDS)[number] | null {
  if (cap <= 0) return null;
  const ratio = spend / cap;
  let highest: (typeof THRESHOLDS)[number] | null = null;
  for (const t of THRESHOLDS) {
    if (ratio >= t) highest = t;
  }
  return highest;
}

/**
 * Run one watch cycle. Returns the threshold fired this cycle (if any),
 * or null. Exposed for tests; production code only calls `startBudgetWatcher`.
 */
export async function watchBudgetOnce(): Promise<{
  spendUsd: number;
  capUsd: number;
  fired: (typeof THRESHOLDS)[number] | null;
  reason: string | null;
}> {
  const cap = config.freeTier.dailyUsdCap;
  if (!Number.isFinite(cap) || cap <= 0) {
    return { spendUsd: 0, capUsd: cap, fired: null, reason: "cap-invalid" };
  }
  let spend = 0;
  try {
    spend = await sumPlatformCostTodayGlobal(utcStartOfToday());
  } catch (err) {
    // DB read failed — log but never throw out of the interval, would
    // kill the watcher silently. Next tick retries.
    console.error(
      JSON.stringify({
        level: "error",
        evt: "budget_watcher_db_failed",
        msg: err instanceof Error ? err.message : String(err),
      }),
    );
    return { spendUsd: 0, capUsd: cap, fired: null, reason: "db-error" };
  }
  const highest = pickHighestCrossed(spend, cap);
  if (highest === null) return { spendUsd: spend, capUsd: cap, fired: null, reason: "below-50" };

  const todayKey = `${utcDateKey()}:${highest}`;
  if (lastFiredKey === todayKey) {
    return {
      spendUsd: spend,
      capUsd: cap,
      fired: null,
      reason: "already-fired-today",
    };
  }
  // Don't re-fire LOWER thresholds in the same UTC day if we've already
  // fired a HIGHER one. lastFiredKey encodes both day + threshold.
  const [lastDay, lastPctStr] = (lastFiredKey ?? ":0").split(":");
  const lastPct = Number(lastPctStr);
  if (lastDay === utcDateKey() && lastPct >= highest) {
    return {
      spendUsd: spend,
      capUsd: cap,
      fired: null,
      reason: "lower-threshold-skipped",
    };
  }

  // Fire it. Email failure is logged but doesn't block the watcher —
  // we retry the SAME threshold next cycle if email send throws (the
  // dedup key is only set on success).
  try {
    await sendThresholdEmail(spend, cap, highest);
    lastFiredKey = todayKey;
    return { spendUsd: spend, capUsd: cap, fired: highest, reason: "fired" };
  } catch (err) {
    if (err instanceof EmailNotConfiguredError) {
      // No ACS configured (dev / first boot). Log once per day per
      // threshold instead of spamming the console every minute.
      lastFiredKey = todayKey;
      console.error(
        JSON.stringify({
          level: "error",
          evt: "budget_watcher_email_unconfigured",
          spendUsd: spend,
          capUsd: cap,
          threshold: highest,
        }),
      );
      return { spendUsd: spend, capUsd: cap, fired: null, reason: "email-unconfigured" };
    }
    console.error(
      JSON.stringify({
        level: "error",
        evt: "budget_watcher_email_failed",
        msg: err instanceof Error ? err.message : String(err),
        spendUsd: spend,
        capUsd: cap,
        threshold: highest,
      }),
    );
    return { spendUsd: spend, capUsd: cap, fired: null, reason: "email-error" };
  }
}

async function sendThresholdEmail(
  spend: number,
  cap: number,
  threshold: (typeof THRESHOLDS)[number],
): Promise<void> {
  const operator = config.email.operatorAlertEmail;
  if (!operator) {
    throw new EmailNotConfiguredError("OPERATOR_ALERT_EMAIL not set");
  }
  const pct = Math.round(threshold * 100);
  const dollarsSpent = spend.toFixed(2);
  const capStr = cap.toFixed(2);
  const subject =
    threshold >= 1.0
      ? `CodeTutor: daily $ cap REACHED ($${dollarsSpent} of $${capStr})`
      : `CodeTutor: daily $ at ${pct}% ($${dollarsSpent} of $${capStr})`;
  const text = [
    `Free-tier global daily $ spend has crossed ${pct}% of the cap.`,
    "",
    `Today (UTC):  $${dollarsSpent}`,
    `Cap:          $${capStr}`,
    "",
    threshold >= 1.0
      ? "All free-tier AI calls are now short-circuiting until UTC midnight (or until the cap is raised)."
      : "Free-tier calls are still flowing. Watch for the next threshold or investigate.",
    "",
    "Admin panel → Project Caps → Daily $ cap (global) to adjust.",
    "",
    "—",
    "Sent automatically by codetutor-backend budgetWatcher.",
  ].join("\n");
  await sendEmail({ to: operator, subject, text });
}

export function startBudgetWatcher(): void {
  if (watcher) return;
  // Fire once immediately so a backend that boots into 80%+ spend gets
  // the alert without a 60s delay.
  void watchBudgetOnce();
  watcher = setInterval(() => void watchBudgetOnce(), POLL_INTERVAL_MS);
}

export function stopBudgetWatcher(): void {
  if (!watcher) return;
  clearInterval(watcher);
  watcher = null;
}

// Test-only: reset the in-memory dedup state. Production code never calls.
export function _resetBudgetWatcherForTests(): void {
  lastFiredKey = null;
  if (watcher) clearInterval(watcher);
  watcher = null;
}
