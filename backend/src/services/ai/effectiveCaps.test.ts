// Phase 20-P5: cap resolver precedence — per-user override > project
// override > env default. credential.test.ts tests the consumption side
// (i.e. credential.ts honors the resolver's answer); this file tests the
// resolver itself.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config.js", () => ({
  config: {
    freeTier: {
      enabled: true,
      dailyQuestions: 30,
      dailyUsdPerUser: 0.10,
      lifetimeUsdPerUser: 1.0,
      dailyUsdCap: 2.0,
      platformOpenaiApiKey: "sk-platform-test",
    },
  },
}));

vi.mock("../../db/aiFreeTierOverrides.js", () => ({
  getOverride: vi.fn(async () => null),
}));

vi.mock("../../db/systemConfig.js", () => ({
  getSystemConfig: vi.fn(async () => null),
  // Re-export the type-only KNOWN_KEYS shape via a stub array so the
  // production import path doesn't break (effectiveCaps imports the
  // type, not the runtime value, so this is purely defensive).
  KNOWN_KEYS: [
    "free_tier_enabled",
    "free_tier_daily_questions",
    "free_tier_daily_usd_per_user",
    "free_tier_lifetime_usd_per_user",
    "free_tier_daily_usd_cap",
  ],
}));

const { getOverride } = await import("../../db/aiFreeTierOverrides.js");
const { getSystemConfig } = await import("../../db/systemConfig.js");
const {
  getEffectiveDailyQuestionsCap,
  getEffectiveDailyUsdCapPerUser,
  getEffectiveLifetimeUsdCapPerUser,
  getEffectiveDailyUsdCap,
  getEffectiveFreeTierEnabled,
} = await import("./effectiveCaps.js");

beforeEach(() => {
  vi.mocked(getOverride).mockReset().mockResolvedValue(null);
  vi.mocked(getSystemConfig).mockReset().mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

// Helper: build a per-user override row. Caller passes only the field
// they care about; everything else is null.
function override(fields: {
  dailyQuestionsCap?: number | null;
  dailyUsdCap?: number | null;
  lifetimeUsdCap?: number | null;
}) {
  return {
    userId: "u-1",
    dailyQuestionsCap: fields.dailyQuestionsCap ?? null,
    dailyUsdCap: fields.dailyUsdCap ?? null,
    lifetimeUsdCap: fields.lifetimeUsdCap ?? null,
    setBy: "admin-1",
    setAt: "2026-04-26T00:00:00.000Z",
    reason: "test",
  };
}

// Helper: a system_config row with a given key + value.
function configRow(key: string, value: boolean | number | null) {
  return {
    key: key as Parameters<typeof getSystemConfig>[0],
    value,
    setBy: "admin-1",
    setAt: "2026-04-26T00:00:00.000Z",
    reason: "test",
  };
}

describe("getEffectiveDailyQuestionsCap", () => {
  it("falls through to env default when nothing is overridden", async () => {
    expect(await getEffectiveDailyQuestionsCap("u-1")).toBe(30);
  });

  it("returns project override when set, no per-user override", async () => {
    vi.mocked(getSystemConfig).mockImplementationOnce(async (key) =>
      key === "free_tier_daily_questions" ? configRow(key, 100) : null,
    );
    expect(await getEffectiveDailyQuestionsCap("u-1")).toBe(100);
  });

  it("returns per-user override when set, beating project override", async () => {
    vi.mocked(getOverride).mockResolvedValueOnce(
      override({ dailyQuestionsCap: 200 }),
    );
    vi.mocked(getSystemConfig).mockImplementationOnce(async (key) =>
      key === "free_tier_daily_questions" ? configRow(key, 100) : null,
    );
    expect(await getEffectiveDailyQuestionsCap("u-1")).toBe(200);
  });

  it("falls through to project override when per-user row has null in this column", async () => {
    // Override row exists but the dailyQuestionsCap field is null —
    // should NOT block project override from taking effect.
    vi.mocked(getOverride).mockResolvedValueOnce(
      override({ dailyQuestionsCap: null, dailyUsdCap: 5 }),
    );
    vi.mocked(getSystemConfig).mockImplementationOnce(async (key) =>
      key === "free_tier_daily_questions" ? configRow(key, 100) : null,
    );
    expect(await getEffectiveDailyQuestionsCap("u-1")).toBe(100);
  });

  it("0 is a valid override (effectively denylist via override)", async () => {
    vi.mocked(getOverride).mockResolvedValueOnce(
      override({ dailyQuestionsCap: 0 }),
    );
    expect(await getEffectiveDailyQuestionsCap("u-1")).toBe(0);
  });
});

describe("getEffectiveDailyUsdCapPerUser", () => {
  it("env default when nothing overridden", async () => {
    expect(await getEffectiveDailyUsdCapPerUser("u-1")).toBe(0.10);
  });

  it("per-user override beats both", async () => {
    vi.mocked(getOverride).mockResolvedValueOnce(
      override({ dailyUsdCap: 5 }),
    );
    vi.mocked(getSystemConfig).mockImplementationOnce(async (key) =>
      key === "free_tier_daily_usd_per_user" ? configRow(key, 1) : null,
    );
    expect(await getEffectiveDailyUsdCapPerUser("u-1")).toBe(5);
  });
});

describe("getEffectiveLifetimeUsdCapPerUser", () => {
  it("env default when nothing overridden", async () => {
    expect(await getEffectiveLifetimeUsdCapPerUser("u-1")).toBe(1.0);
  });

  it("per-user override beats project override", async () => {
    vi.mocked(getOverride).mockResolvedValueOnce(
      override({ lifetimeUsdCap: 50 }),
    );
    vi.mocked(getSystemConfig).mockImplementationOnce(async (key) =>
      key === "free_tier_lifetime_usd_per_user" ? configRow(key, 10) : null,
    );
    expect(await getEffectiveLifetimeUsdCapPerUser("u-1")).toBe(50);
  });
});

describe("getEffectiveDailyUsdCap (global, no per-user layer)", () => {
  it("env default when no project override", async () => {
    expect(await getEffectiveDailyUsdCap()).toBe(2.0);
  });

  it("project override when set", async () => {
    vi.mocked(getSystemConfig).mockImplementationOnce(async (key) =>
      key === "free_tier_daily_usd_cap" ? configRow(key, 0.5) : null,
    );
    expect(await getEffectiveDailyUsdCap()).toBe(0.5);
  });

  it("ignores a non-numeric value in the row (defensive)", async () => {
    // Should not happen in practice (admin route validates), but if a
    // bad row sneaks in, we fall through to env rather than throw.
    vi.mocked(getSystemConfig).mockImplementationOnce(async (key) =>
      key === "free_tier_daily_usd_cap"
        ? // @ts-expect-error testing wrong-type value
          configRow(key, "$5")
        : null,
    );
    expect(await getEffectiveDailyUsdCap()).toBe(2.0);
  });
});

describe("getEffectiveFreeTierEnabled (global, no per-user layer)", () => {
  it("env default when no project override", async () => {
    expect(await getEffectiveFreeTierEnabled()).toBe(true);
  });

  it("project override flips kill switch off", async () => {
    vi.mocked(getSystemConfig).mockImplementationOnce(async (key) =>
      key === "free_tier_enabled" ? configRow(key, false) : null,
    );
    expect(await getEffectiveFreeTierEnabled()).toBe(false);
  });

  it("ignores a non-boolean value in the row (defensive)", async () => {
    // A number where boolean is expected — should fall through to env
    // rather than coerce. Using `as unknown as boolean` since the
    // helper signature accepts numbers (we test the resolver's
    // type-narrowing here, not the helper's typing).
    vi.mocked(getSystemConfig).mockImplementationOnce(async (key) =>
      key === "free_tier_enabled"
        ? configRow(key, 1 as unknown as boolean)
        : null,
    );
    expect(await getEffectiveFreeTierEnabled()).toBe(true);
  });
});
