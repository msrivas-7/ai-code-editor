import { EmailClient } from "@azure/communication-email";
import { config } from "../../config.js";

// Phase 22A: minimal wrapper around Azure Communication Services Email.
//
// One backend-originated email path used by:
//   - 22A budgetWatcher — 50/80/100% daily-cap alerts to the operator
//   - 22D streakNudge   — daily retention email to learners
//   - any future transactional path
//
// Credential flow:
//   ACS connection string lives in Azure Key Vault as ACS-CONNECTION-STRING
//   → cloud-init's refresh-env script writes it into the VM's compose env
//   → config.email.acsConnectionString reads it at boot
//   → this module instantiates a single EmailClient on first use
//
// The client is module-scoped + lazily constructed so the backend can boot
// in dev or in environments without ACS configured (sendEmail throws
// EmailNotConfigured; callers decide whether to swallow or escalate).

let cachedClient: EmailClient | null = null;

function getClient(): EmailClient {
  if (cachedClient) return cachedClient;
  const conn = config.email.acsConnectionString;
  if (!conn) {
    throw new EmailNotConfiguredError(
      "ACS_CONNECTION_STRING not set; backend cannot send email",
    );
  }
  cachedClient = new EmailClient(conn);
  return cachedClient;
}

export class EmailNotConfiguredError extends Error {
  readonly name = "EmailNotConfiguredError";
}

export interface SendEmailOptions {
  /** Recipient address. Required. */
  to: string;
  /** Subject line. Plain text. */
  subject: string;
  /** Plain-text body. Always provided. */
  text: string;
  /** Optional HTML body. Mail clients that accept it prefer this; plain text
   *  is the canonical fallback. */
  html?: string;
  /** Override the From address. Defaults to config.email.acsSenderEmail. */
  from?: string;
}

/**
 * Send an email via ACS. Returns the operationId for log correlation.
 *
 * The ACS poll-pattern wraps a long-running operation; we await its
 * completion (typically 1–3s) and surface a structured error on failure.
 * Caller decides whether to retry — this wrapper does not retry.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<{ id: string }> {
  const client = getClient();
  const sender = opts.from ?? config.email.acsSenderEmail;
  if (!sender) {
    throw new EmailNotConfiguredError(
      "ACS_SENDER_EMAIL not set; cannot determine From address",
    );
  }
  const message = {
    senderAddress: sender,
    content: {
      subject: opts.subject,
      plainText: opts.text,
      ...(opts.html ? { html: opts.html } : {}),
    },
    recipients: {
      to: [{ address: opts.to }],
    },
  };
  const poller = await client.beginSend(message);
  const result = await poller.pollUntilDone();
  if (result.status !== "Succeeded") {
    throw new Error(
      `ACS Email send did not succeed: status=${result.status}, error=${
        result.error?.message ?? "unknown"
      }`,
    );
  }
  return { id: result.id };
}

/** Test-only helper to reset the cached client between vitest cases that
 *  swap config. Production code should never call this. */
export function _resetEmailClientForTests(): void {
  cachedClient = null;
}
