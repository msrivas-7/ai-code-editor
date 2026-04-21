import { describe, it, expect } from "vitest";
import { ApiError, friendlyMessage, isApiError } from "./ApiError";

describe("ApiError", () => {
  it("keeps status, body, and path on the instance", () => {
    const err = new ApiError(500, "session not owned by caller", "/api/user/preferences");
    expect(err.status).toBe(500);
    expect(err.body).toBe("session not owned by caller");
    expect(err.path).toBe("/api/user/preferences");
    expect(err.name).toBe("ApiError");
  });

  it("sets Error.message to the friendly text (not the raw body)", () => {
    const err = new ApiError(500, "session not owned by caller", "/api/user/preferences");
    expect(err.message).not.toContain("session not owned by caller");
    expect(err.message).toContain("our end");
  });

  it("isApiError discriminates from plain Error", () => {
    expect(isApiError(new ApiError(401, "", "/x"))).toBe(true);
    expect(isApiError(new Error("boom"))).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError("oops")).toBe(false);
  });
});

describe("friendlyMessage", () => {
  it("maps 0 to a network-error message", () => {
    expect(friendlyMessage(0)).toMatch(/network/i);
  });

  it("maps 401 to a session-expired message", () => {
    expect(friendlyMessage(401)).toMatch(/session|sign in/i);
  });

  it("maps 403 to a permission message", () => {
    expect(friendlyMessage(403)).toMatch(/permission/i);
  });

  it("maps 404 to a not-found message", () => {
    expect(friendlyMessage(404)).toMatch(/couldn't find|not found/i);
  });

  it("maps 429 to a rate-limit message", () => {
    expect(friendlyMessage(429)).toMatch(/too many|slow down|wait/i);
  });

  it("maps any 5xx to a generic server-error message", () => {
    expect(friendlyMessage(500)).toMatch(/our end|try again/i);
    expect(friendlyMessage(502)).toMatch(/our end|try again/i);
    expect(friendlyMessage(503)).toMatch(/our end|try again/i);
  });

  it("maps other 4xx to an invalid-request message", () => {
    expect(friendlyMessage(422)).toMatch(/invalid|try again/i);
    expect(friendlyMessage(400)).toMatch(/invalid|try again/i);
  });

  it("never leaks internals (no URL, path, or status code in the message)", () => {
    for (const status of [0, 400, 401, 403, 404, 413, 429, 500, 502, 503]) {
      const msg = friendlyMessage(status);
      expect(msg).not.toMatch(/\/api\//);
      expect(msg).not.toContain(String(status));
    }
  });
});
