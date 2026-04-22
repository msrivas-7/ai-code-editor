// /api/metrics — Prometheus exposition for lightweight external scraping.
// Three signals matter for steady-state ops:
//   - session_count: active runner containers. Should oscillate around low
//     single digits; a monotonic climb means the sweeper isn't catching
//     stale sessions (leaked-container detector).
//   - ai_tokens_consumed_total: OpenAI tokens across all users. Useful for
//     spotting a runaway history or a looped client burning spend.
//   - exec_duration_seconds: histogram of run-code latency by language +
//     ok. First-boot Rust compiles will pile the top bucket; steady-state
//     Python should sit under 1s.
//
// No scraper is wired yet — the endpoint ships ahead of the Prom stack so
// the instrumentation is live when we turn one on. Endpoint is public (no
// bearer): the data is aggregate-only and consistency with the Prometheus
// convention outweighs hiding magnitudes at this size. A Caddy path guard
// or env-bearer can be added later without touching these definitions.

import { Counter, Gauge, Histogram, Registry } from "prom-client";
import { listSessions } from "./session/sessionManager.js";

export const registry = new Registry();

// Gauge with a collect hook so the value is fresh on every scrape. Avoids
// threading an inc/dec through every session create + end + sweep path —
// the session map is the source of truth, we just read its size.
export const sessionCount = new Gauge({
  name: "session_count",
  help: "Number of active runner sessions.",
  registers: [registry],
  collect() {
    this.set(listSessions().length);
  },
});

export const aiTokensConsumed = new Counter({
  name: "ai_tokens_consumed_total",
  help: "OpenAI tokens consumed across all completions.",
  // `model` enables per-model cost breakdown; `kind` splits input vs
  // output so totals are directly priceable against OpenAI's rate card.
  // Phase 20-P4: `funding_source` splits byok vs platform so the operator
  // can isolate spend on their own key from aggregate user spend.
  labelNames: ["model", "kind", "funding_source"] as const,
  registers: [registry],
});

// Phase 20-P4: free-tier telemetry. `outcome` is the resolver decision,
// `route` pins which AI endpoint fired. Together they bound cardinality to
// ~30 series permanently — no per-user labels. The operator graph is a
// stacked bar of outcomes over time: a climbing 'exhausted' bar is exactly
// the demand signal the free tier is meant to surface.
export const aiPlatformRequests = new Counter({
  name: "ai_platform_requests_total",
  help: "Platform AI requests, by resolver outcome and route.",
  labelNames: ["outcome", "route"] as const,
  registers: [registry],
});

// Willingness-to-pay signal. Single counter covering all three exhaustion-
// card CTAs — ratio of clicked_paid_interest / exhausted is the primary
// gate on building any paid SKU.
//
// Round 7: `denylisted` label splits clean leads from banned-but-willing
// ones so the conversion KPI can be computed without joining the DB. Value
// is "yes" (denylisted at click) | "no" (clean) | "na" (outcomes that
// aren't the paid-interest click). Cardinality stays bounded: 3 outcomes ×
// 3 denylisted-values = 9 series max, forever.
export const aiExhaustionCtaClicks = new Counter({
  name: "ai_exhaustion_cta_clicks_total",
  help: "Exhaustion-card CTA engagement (dismissed | clicked_byok | clicked_paid_interest).",
  labelNames: ["outcome", "denylisted"] as const,
  registers: [registry],
});

// Any non-zero here warrants a manual look. Each signal corresponds to a
// specific abuse pattern that should be impossible under the nine defense
// layers but is tracked so a latent bug surfaces fast.
export const aiPlatformAbuseSignals = new Counter({
  name: "ai_platform_abuse_signals_total",
  help: "Suspicious platform behavior; non-zero => investigate.",
  labelNames: ["signal"] as const,
  registers: [registry],
});

export const execDuration = new Histogram({
  name: "exec_duration_seconds",
  help: "Wall-clock duration of a runProject call.",
  labelNames: ["language", "ok"] as const,
  // Buckets tuned for our exec profile: compiled languages on cold Rust
  // first-boot hit 5-10s; steady-state Python sits under 500ms. Pinned
  // here (rather than taking prom-client defaults) so a library update
  // doesn't silently re-baseline historical histograms.
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});
