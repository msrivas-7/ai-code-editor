import { describe, expect, it } from "vitest";
import { formatReset } from "./FreeTierPill";

// QA-M8: wall-clock phrasing is a learner-facing contract. "resets in Xh Ym"
// used to be UTC-math and lied to anyone far enough from UTC that the user's
// wall-clock day had already flipped. Keep these cases pinned so we don't
// regress to timer-math.

function at(iso: string): Date {
  return new Date(iso);
}

describe("formatReset", () => {
  it("says 'resets now' once the deadline has passed", () => {
    const reset = "2026-04-22T10:00:00Z";
    const now = at("2026-04-22T11:00:00Z");
    expect(formatReset(reset, now)).toBe("resets now");
  });

  it("uses 'resets at <time>' when reset falls on the same local calendar day", () => {
    // Reset in 2h — same local day in any timezone where the clock hasn't
    // flipped within that window. Assert the prefix, not a locale-specific
    // time string (e.g. en-US vs en-GB render "1:30 PM" vs "13:30").
    const now = at("2026-04-22T12:00:00Z");
    const reset = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const out = formatReset(reset, now);
    expect(out.startsWith("resets at ")).toBe(true);
    expect(out).not.toContain("tomorrow");
  });

  it("uses 'resets tomorrow at <time>' when reset is on the local day after", () => {
    // now = today 11:00 local, reset = tomorrow 06:00 local.
    const now = new Date(2026, 3, 22, 11, 0, 0);
    const reset = new Date(2026, 3, 23, 6, 0, 0);
    const out = formatReset(reset.toISOString(), now);
    expect(out.startsWith("resets tomorrow at ")).toBe(true);
  });

  it("falls back to a dated 'resets <Mon D> at <time>' form for >24h-out resets", () => {
    const now = new Date(2026, 3, 22, 11, 0, 0);
    const reset = new Date(2026, 3, 25, 9, 0, 0); // 3 days later
    const out = formatReset(reset.toISOString(), now);
    expect(out.startsWith("resets ")).toBe(true);
    expect(out).not.toContain("tomorrow");
    expect(out).toMatch(/resets .* at /);
  });

  it("never emits the old UTC-timer 'Xh Ym' wording", () => {
    // Sanity guard against a regression to the old format.
    const now = new Date(2026, 3, 22, 11, 0, 0);
    const reset = new Date(now.getTime() + 3 * 60 * 60 * 1000 + 15 * 60 * 1000);
    const out = formatReset(reset.toISOString(), now);
    expect(out).not.toMatch(/\d+h \d+m/);
  });
});
