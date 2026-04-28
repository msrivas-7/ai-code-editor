// Phase 22A audit fix: TTL'd email_confirmed_at cache.
// Tests verify cache hit/miss + DB-error metric increment without
// requiring a live DB — the `./client.js` module is mocked.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sqlMock = vi.fn();
vi.mock("./client.js", () => ({ db: () => sqlMock }));
vi.mock("../services/metrics.js", () => ({
  emailConfirmCheckFailures: { inc: vi.fn() },
}));

const { isEmailConfirmed, _resetEmailConfirmCacheForTests } = await import(
  "./userEmailConfirm.js"
);
const { emailConfirmCheckFailures } = await import("../services/metrics.js");

beforeEach(() => {
  _resetEmailConfirmCacheForTests();
  sqlMock.mockReset();
  vi.mocked(emailConfirmCheckFailures.inc).mockReset();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("isEmailConfirmed", () => {
  it("returns true when auth.users row has non-null email_confirmed_at", async () => {
    sqlMock.mockResolvedValueOnce([{ confirmed_at: new Date() }]);
    expect(await isEmailConfirmed("user-1")).toBe(true);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("returns false when email_confirmed_at is null", async () => {
    sqlMock.mockResolvedValueOnce([{ confirmed_at: null }]);
    expect(await isEmailConfirmed("user-1")).toBe(false);
  });

  it("returns false when user row not found", async () => {
    sqlMock.mockResolvedValueOnce([]);
    expect(await isEmailConfirmed("user-1")).toBe(false);
  });

  it("caches a true result within the 6h TTL", async () => {
    sqlMock.mockResolvedValueOnce([{ confirmed_at: new Date() }]);
    await isEmailConfirmed("user-1");
    // second call should hit cache, not DB
    expect(await isEmailConfirmed("user-1")).toBe(true);
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("re-reads from DB after cache TTL expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T00:00:00Z"));

    sqlMock.mockResolvedValueOnce([{ confirmed_at: new Date() }]);
    await isEmailConfirmed("user-1");

    // 6h + 1ms later: cache should be expired
    vi.setSystemTime(new Date("2026-04-28T06:00:00.001Z"));
    sqlMock.mockResolvedValueOnce([{ confirmed_at: null }]);
    expect(await isEmailConfirmed("user-1")).toBe(false);
    expect(sqlMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT cache a false result", async () => {
    sqlMock.mockResolvedValueOnce([{ confirmed_at: null }]);
    await isEmailConfirmed("user-1");
    sqlMock.mockResolvedValueOnce([{ confirmed_at: null }]);
    await isEmailConfirmed("user-1");
    expect(sqlMock).toHaveBeenCalledTimes(2);
  });

  it("returns false on DB error and bumps the failure counter", async () => {
    sqlMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect(await isEmailConfirmed("user-1")).toBe(false);
    expect(emailConfirmCheckFailures.inc).toHaveBeenCalledTimes(1);
  });
});
