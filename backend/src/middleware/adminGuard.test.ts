// Phase 20-P5: admin gate. Tests the two-layer check (JWT claim →
// user_roles table) including the stale-JWT defense and fail-closed
// behavior on DB errors.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

vi.mock("../db/userRoles.js", () => ({
  isAdmin: vi.fn(async () => true),
}));

const { isAdmin } = await import("../db/userRoles.js");
const { adminGuard } = await import("./adminGuard.js");

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json } as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

beforeEach(() => {
  vi.mocked(isAdmin).mockReset().mockResolvedValue(true);
});

describe("adminGuard", () => {
  it("401s when no userId on request (auth middleware never ran)", async () => {
    const req = {} as Request;
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await adminGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("403s when userRole is missing (non-admin user)", async () => {
    const req = { userId: "u-1", userRole: null } as unknown as Request;
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await adminGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    // Also: should not have hit the DB check — claim alone says non-admin.
    expect(isAdmin).not.toHaveBeenCalled();
  });

  it("403s when userRole is wrong value", async () => {
    const req = { userId: "u-1", userRole: "support" } as unknown as Request;
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await adminGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(isAdmin).not.toHaveBeenCalled();
  });

  it("calls next() when JWT claim says admin AND user_roles agrees", async () => {
    vi.mocked(isAdmin).mockResolvedValueOnce(true);
    const req = { userId: "u-1", userRole: "admin" } as unknown as Request;
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await adminGuard(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("403s when JWT claim says admin BUT user_roles disagrees (stale JWT defense)", async () => {
    // The user was demoted via DELETE FROM user_roles, but their existing
    // JWT still carries app_metadata.role='admin'. The DB check catches it.
    vi.mocked(isAdmin).mockResolvedValueOnce(false);
    const req = { userId: "u-1", userRole: "admin" } as unknown as Request;
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await adminGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("503s and fails closed when the user_roles DB check throws", async () => {
    // Transient DB error — fail closed rather than allow potentially
    // demoted admins through during an outage.
    vi.mocked(isAdmin).mockRejectedValueOnce(new Error("connection reset"));
    const req = { userId: "u-1", userRole: "admin" } as unknown as Request;
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;
    await adminGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });
});
