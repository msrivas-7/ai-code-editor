import crypto from "node:crypto";
import {
  TEST_SENTINEL,
  type TestCaseResult,
  type TestReport,
} from "./types.js";

// Envelope format (Phase 16):
//   SENTINEL + base64(JSON.stringify({ body, sig })) + SENTINEL + "\n"
// where `body` is itself a JSON string of { results, harnessError, cleanStdout }
// and `sig = hmac_sha256(nonce, body)` as hex. Signing the body AS A STRING
// avoids any canonical-JSON dance: the parent emits a byte sequence, the
// verifier checks HMAC over the same byte sequence, then parses it.
//
// The base64 wrapper is a collision guard, not a confidentiality measure.
// `cleanStdout` inside the body carries whatever the learner's code printed,
// which could happen to contain the sentinel literal. Base64 alphabet
// ([A-Za-z0-9+/=]) cannot produce the sentinel's underscores, so the
// sentinel is uniquely findable at the outer edges regardless of payload.
//
// Missing / malformed / signature-mismatch cases all fail closed: the caller
// sees a generic "Test run failed" error. Telling the learner which failure
// mode it was (forged? crashed? truncated?) would just hand an attacker a
// probe oracle; the generic message is also the right user-facing text for
// a real infra hiccup.

interface ParsedEnvelope {
  body: string;
  sig: string;
}

const GENERIC_HARNESS_FAILURE =
  "Test run failed — please try again.";

export function parseSignedEnvelope(
  stdout: string,
  stderr: string,
  nonce: string,
): TestReport {
  const start = stdout.indexOf(TEST_SENTINEL);
  const end = stdout.lastIndexOf(TEST_SENTINEL);
  if (start === -1 || start === end) {
    // No sentinel at all (or only one) — harness never emitted its envelope.
    // Surface stderr if there is any since it likely explains the crash
    // (e.g. `python3: can't open file`); otherwise generic.
    const msg = stderr.trim() || GENERIC_HARNESS_FAILURE;
    return { results: [], harnessError: msg, cleanStdout: stdout };
  }

  const encoded = stdout.slice(start + TEST_SENTINEL.length, end).trim();
  let afterEnd = end + TEST_SENTINEL.length;
  if (stdout[afterEnd] === "\n") afterEnd++;
  const cleanStdoutOuter = (stdout.slice(0, start) + stdout.slice(afterEnd)).replace(
    /\n+$/,
    "",
  );

  // Strict base64 alphabet — if anything else snuck in, refuse to decode.
  if (!/^[A-Za-z0-9+/=\s]*$/.test(encoded) || encoded.length === 0) {
    return {
      results: [],
      harnessError: GENERIC_HARNESS_FAILURE,
      cleanStdout: cleanStdoutOuter,
    };
  }

  let envelope: ParsedEnvelope;
  try {
    const innerJson = Buffer.from(encoded, "base64").toString("utf8");
    const raw = JSON.parse(innerJson) as { body?: unknown; sig?: unknown };
    if (typeof raw.body !== "string" || typeof raw.sig !== "string") {
      return {
        results: [],
        harnessError: GENERIC_HARNESS_FAILURE,
        cleanStdout: cleanStdoutOuter,
      };
    }
    envelope = { body: raw.body, sig: raw.sig };
  } catch {
    return {
      results: [],
      harnessError: GENERIC_HARNESS_FAILURE,
      cleanStdout: cleanStdoutOuter,
    };
  }

  if (!verifySignature(envelope.body, envelope.sig, nonce)) {
    return {
      results: [],
      harnessError: GENERIC_HARNESS_FAILURE,
      cleanStdout: cleanStdoutOuter,
    };
  }

  let body: {
    results?: unknown;
    harnessError?: unknown;
    cleanStdout?: unknown;
  };
  try {
    body = JSON.parse(envelope.body);
  } catch {
    return {
      results: [],
      harnessError: GENERIC_HARNESS_FAILURE,
      cleanStdout: cleanStdoutOuter,
    };
  }

  return {
    results: Array.isArray(body.results) ? (body.results as TestCaseResult[]) : [],
    harnessError: typeof body.harnessError === "string" ? body.harnessError : null,
    cleanStdout:
      typeof body.cleanStdout === "string" ? body.cleanStdout : cleanStdoutOuter,
  };
}

function verifySignature(body: string, sigHex: string, nonce: string): boolean {
  const expected = crypto.createHmac("sha256", nonce).update(body).digest("hex");
  const a = safeHexBuffer(sigHex);
  const b = safeHexBuffer(expected);
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function safeHexBuffer(hex: string): Buffer | null {
  if (!/^[0-9a-f]*$/i.test(hex) || hex.length % 2 !== 0) return null;
  try {
    return Buffer.from(hex, "hex");
  } catch {
    return null;
  }
}
