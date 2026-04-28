import { describe, expect, it, beforeEach, vi } from "vitest";

// Phase 22A: lock the contract of the ACS Email wrapper.
// We don't make real ACS calls in CI — the SDK's `EmailClient` is mocked
// to return a poller stub. The contract we care about:
//   - throws EmailNotConfiguredError when conn string is missing
//   - throws EmailNotConfiguredError when sender is missing
//   - passes the right shape to ACS (sender, recipients, content)
//   - returns the operationId on success
//   - surfaces a structured error when the poller resolves with non-Succeeded

const mockBeginSend = vi.fn();
vi.mock("@azure/communication-email", () => ({
  EmailClient: vi.fn().mockImplementation(() => ({
    beginSend: mockBeginSend,
  })),
}));

vi.mock("../../config.js", () => ({
  config: {
    email: {
      acsConnectionString: "",
      acsSenderEmail: "",
      operatorAlertEmail: "",
    },
  },
}));

import { config } from "../../config.js";
import {
  EmailNotConfiguredError,
  sendEmail,
  _resetEmailClientForTests,
} from "./acsClient.js";

beforeEach(() => {
  _resetEmailClientForTests();
  mockBeginSend.mockReset();
  // Reset config back to unconfigured between tests; individual tests
  // mutate as needed.
  // @ts-expect-error mutate the mocked config
  config.email.acsConnectionString = "";
  // @ts-expect-error mutate the mocked config
  config.email.acsSenderEmail = "";
});

describe("sendEmail", () => {
  it("throws EmailNotConfiguredError when ACS_CONNECTION_STRING is empty", async () => {
    await expect(
      sendEmail({ to: "a@b.com", subject: "x", text: "y" }),
    ).rejects.toBeInstanceOf(EmailNotConfiguredError);
  });

  it("throws EmailNotConfiguredError when sender is empty", async () => {
    // @ts-expect-error mutate the mocked config
    config.email.acsConnectionString = "endpoint=https://fake;accesskey=k";
    await expect(
      sendEmail({ to: "a@b.com", subject: "x", text: "y" }),
    ).rejects.toBeInstanceOf(EmailNotConfiguredError);
  });

  it("passes the right shape to ACS and returns the operationId on success", async () => {
    // @ts-expect-error mutate the mocked config
    config.email.acsConnectionString = "endpoint=https://fake;accesskey=k";
    // @ts-expect-error mutate the mocked config
    config.email.acsSenderEmail = "noreply@mail.example.com";
    mockBeginSend.mockResolvedValue({
      pollUntilDone: async () => ({ status: "Succeeded", id: "op-123" }),
    });

    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      text: "Plain body",
      html: "<p>HTML body</p>",
    });

    expect(result).toEqual({ id: "op-123" });
    expect(mockBeginSend).toHaveBeenCalledTimes(1);
    const arg = mockBeginSend.mock.calls[0][0];
    expect(arg.senderAddress).toBe("noreply@mail.example.com");
    expect(arg.recipients.to).toEqual([{ address: "user@example.com" }]);
    expect(arg.content.subject).toBe("Test");
    expect(arg.content.plainText).toBe("Plain body");
    expect(arg.content.html).toBe("<p>HTML body</p>");
  });

  it("omits HTML when only plain text supplied", async () => {
    // @ts-expect-error mutate the mocked config
    config.email.acsConnectionString = "endpoint=https://fake;accesskey=k";
    // @ts-expect-error mutate the mocked config
    config.email.acsSenderEmail = "noreply@mail.example.com";
    mockBeginSend.mockResolvedValue({
      pollUntilDone: async () => ({ status: "Succeeded", id: "op-456" }),
    });

    await sendEmail({ to: "u@e.com", subject: "S", text: "T" });
    const arg = mockBeginSend.mock.calls[0][0];
    expect(arg.content).toEqual({ subject: "S", plainText: "T" });
  });

  it("respects the optional `from` override", async () => {
    // @ts-expect-error mutate the mocked config
    config.email.acsConnectionString = "endpoint=https://fake;accesskey=k";
    // @ts-expect-error mutate the mocked config
    config.email.acsSenderEmail = "default@mail.example.com";
    mockBeginSend.mockResolvedValue({
      pollUntilDone: async () => ({ status: "Succeeded", id: "op-789" }),
    });

    await sendEmail({
      to: "u@e.com",
      subject: "S",
      text: "T",
      from: "alerts@mail.example.com",
    });
    expect(mockBeginSend.mock.calls[0][0].senderAddress).toBe(
      "alerts@mail.example.com",
    );
  });

  it("throws a descriptive error when ACS returns non-Succeeded", async () => {
    // @ts-expect-error mutate the mocked config
    config.email.acsConnectionString = "endpoint=https://fake;accesskey=k";
    // @ts-expect-error mutate the mocked config
    config.email.acsSenderEmail = "noreply@mail.example.com";
    mockBeginSend.mockResolvedValue({
      pollUntilDone: async () => ({
        status: "Failed",
        error: { message: "domain not verified" },
      }),
    });

    await expect(
      sendEmail({ to: "u@e.com", subject: "S", text: "T" }),
    ).rejects.toThrow(/Failed.*domain not verified/);
  });

  it("caches the EmailClient across calls (single connection string)", async () => {
    const { EmailClient } = await import("@azure/communication-email");
    // @ts-expect-error mutate the mocked config
    config.email.acsConnectionString = "endpoint=https://fake;accesskey=k";
    // @ts-expect-error mutate the mocked config
    config.email.acsSenderEmail = "noreply@mail.example.com";
    mockBeginSend.mockResolvedValue({
      pollUntilDone: async () => ({ status: "Succeeded", id: "op-x" }),
    });

    // Snapshot ctor count before this test's two sends — the mock is
    // shared across the file, so we measure delta, not absolute.
    const ctorCallsBefore = vi.mocked(EmailClient).mock.calls.length;
    await sendEmail({ to: "a@e.com", subject: "S", text: "T" });
    await sendEmail({ to: "b@e.com", subject: "S", text: "T" });
    const ctorCallsAfter = vi.mocked(EmailClient).mock.calls.length;

    // Two sends should construct the client exactly once.
    expect(ctorCallsAfter - ctorCallsBefore).toBe(1);
  });
});
