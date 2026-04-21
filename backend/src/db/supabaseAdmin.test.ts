import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock `../config.js` the same way byok.test.ts does — the module reads
// env at import time, so setting process.env here wouldn't take effect.
// Each `it` tweaks the mocked config via vi.mocked, then re-imports the
// module under test through a fresh module graph (vi.resetModules).
vi.mock("../config.js", () => ({
  config: {
    supabase: {
      url: "https://stub.supabase.co",
      serviceRoleKey: "svc-role-key-stub",
    },
  },
}));

// Retain a handle to the mutable config so specs can null-out fields.
// The real `config` is exported `as const` → TS treats it as deeply readonly,
// but the mocked object is a plain mutable record. Cast once to avoid
// sprinkling `as any` across every assignment.
const { config: mockedConfig } = (await import("../config.js")) as {
  config: { supabase: { url: string | undefined; serviceRoleKey: string | undefined } };
};

describe("isAdminAvailable", () => {
  afterEach(() => {
    mockedConfig.supabase.url = "https://stub.supabase.co";
    mockedConfig.supabase.serviceRoleKey = "svc-role-key-stub";
  });

  it("returns true when both url and service-role key are set", async () => {
    vi.resetModules();
    const { isAdminAvailable } = await import("./supabaseAdmin.js");
    expect(isAdminAvailable()).toBe(true);
  });

  it("returns false when the service-role key is absent", async () => {
    mockedConfig.supabase.serviceRoleKey = undefined;
    vi.resetModules();
    const { isAdminAvailable } = await import("./supabaseAdmin.js");
    expect(isAdminAvailable()).toBe(false);
  });

  it("returns false when the service-role key is blank", async () => {
    mockedConfig.supabase.serviceRoleKey = "   ";
    vi.resetModules();
    const { isAdminAvailable } = await import("./supabaseAdmin.js");
    expect(isAdminAvailable()).toBe(false);
  });

  it("returns false when the supabase url is absent", async () => {
    mockedConfig.supabase.url = undefined;
    vi.resetModules();
    const { isAdminAvailable } = await import("./supabaseAdmin.js");
    expect(isAdminAvailable()).toBe(false);
  });
});

describe("adminDeleteUser", () => {
  // vi.spyOn inference for globalThis.fetch is unreliable across TS/vitest
  // versions — keep the runtime narrow, let the compiler off the hook.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchSpy: any;

  beforeEach(() => {
    mockedConfig.supabase.url = "https://stub.supabase.co";
    mockedConfig.supabase.serviceRoleKey = "svc-role-key-stub";
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("DELETEs the admin users endpoint with service-role headers", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.resetModules();
    const { adminDeleteUser } = await import("./supabaseAdmin.js");
    await adminDeleteUser("user-123");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [urlArg, initArg] = fetchSpy.mock.calls[0] as [unknown, RequestInit | undefined];
    expect(String(urlArg)).toBe(
      "https://stub.supabase.co/auth/v1/admin/users/user-123",
    );
    expect(initArg?.method).toBe("DELETE");
    const headers = initArg?.headers as Record<string, string>;
    expect(headers.apikey).toBe("svc-role-key-stub");
    expect(headers.Authorization).toBe("Bearer svc-role-key-stub");
  });

  it("URL-encodes user ids with unusual characters", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.resetModules();
    const { adminDeleteUser } = await import("./supabaseAdmin.js");
    await adminDeleteUser("weird id/with?chars");
    const [urlArg] = fetchSpy.mock.calls[0] as [unknown];
    expect(String(urlArg)).toMatch(/weird%20id%2Fwith%3Fchars$/);
  });

  it("throws on a non-2xx admin response with the status in the error message", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("user not found", { status: 404 }),
    );
    vi.resetModules();
    const { adminDeleteUser } = await import("./supabaseAdmin.js");
    await expect(adminDeleteUser("missing")).rejects.toThrow(/404/);
  });

  it("throws when the service-role key is missing at call time", async () => {
    mockedConfig.supabase.serviceRoleKey = undefined;
    vi.resetModules();
    const { adminDeleteUser } = await import("./supabaseAdmin.js");
    await expect(adminDeleteUser("user-123")).rejects.toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
