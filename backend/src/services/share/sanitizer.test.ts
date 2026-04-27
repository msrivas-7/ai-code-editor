import { describe, expect, it } from "vitest";
import { sanitizeShareSnippet, sanitizeDisplayName } from "./sanitizer.js";

// Phase 21C: pure-logic tests for the share-snippet secret detector.
// No DB. Each test exercises one detector path; the overall contract
// is "ok=true on safe code, ok=false with a non-empty reason on
// match." The reason string is intentionally stable across detector
// types so the UI can match on it.

describe("sanitizeShareSnippet — safe code passes", () => {
  it("ordinary Python lesson code passes", () => {
    const code = `def greet(name):
    return f"Hello, {name}!"

print(greet("Mehul"))`;
    expect(sanitizeShareSnippet(code).ok).toBe(true);
  });

  it("code with comments passes", () => {
    const code = `# Compute the square of x.
def square(x):
    return x * x`;
    expect(sanitizeShareSnippet(code).ok).toBe(true);
  });

  it("code with example email placeholder passes", () => {
    const code = `email = "user@example.com"
print(email)`;
    expect(sanitizeShareSnippet(code).ok).toBe(true);
  });

  it("short identifiers like 'sk-test' pass (not a full key)", () => {
    const code = `key = "sk-test"
print(key)`;
    expect(sanitizeShareSnippet(code).ok).toBe(true);
  });
});

describe("sanitizeShareSnippet — secret detection blocks", () => {
  it("detects an OpenAI-shaped sk- key", () => {
    const code = `OPENAI_API_KEY = "sk-abc123def456ghi789jkl012mno345pq"
import openai
openai.api_key = OPENAI_API_KEY`;
    const r = sanitizeShareSnippet(code);
    expect(r.ok).toBe(false);
    expect(r.detector).toBe("openai-style-key");
    expect(r.reason).toMatch(/secret/i);
  });

  it("detects a Slack bot token", () => {
    const code = `slack_token = "xoxb-1234567890-abcdefghij"
print(slack_token)`;
    const r = sanitizeShareSnippet(code);
    expect(r.ok).toBe(false);
    expect(r.detector).toBe("slack-token");
  });

  it("detects a GitHub personal access token", () => {
    const code = `gh_token = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345678"
print("authenticated")`;
    const r = sanitizeShareSnippet(code);
    expect(r.ok).toBe(false);
    expect(r.detector).toBe("github-pat");
  });

  it("detects an AWS access key ID", () => {
    const code = `AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE"`;
    const r = sanitizeShareSnippet(code);
    expect(r.ok).toBe(false);
    expect(r.detector).toBe("aws-access-key-id");
  });

  it("detects an AWS secret access key with context word", () => {
    const code = `AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"`;
    const r = sanitizeShareSnippet(code);
    expect(r.ok).toBe(false);
    expect(r.detector).toBe("aws-secret-with-context");
  });

  it("does NOT flag a 40-char base64 string without secret context", () => {
    const code = `data = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
print(len(data))`;
    expect(sanitizeShareSnippet(code).ok).toBe(true);
  });

  it("detects a Google API key", () => {
    // Real Google API keys are exactly 35 chars after the AIza prefix.
    const code = `GOOGLE_KEY = "AIzaSyAbcdefghijklmnopqrstuvwxyz0123456"`;
    const r = sanitizeShareSnippet(code);
    expect(r.ok).toBe(false);
    expect(r.detector).toBe("google-api-key");
  });

  it("detects a Stripe secret key", () => {
    const code = `stripe.api_key = "sk_live_abcdefghijklmnopqrst"`;
    const r = sanitizeShareSnippet(code);
    expect(r.ok).toBe(false);
    // Either openai-style-key or stripe-secret could match first;
    // both are correct for this case. Just assert it failed.
    expect(["stripe-secret", "openai-style-key"]).toContain(r.detector);
  });

  it("detects api_key = '<long-blob>' assignment", () => {
    const code = `api_key = "abcdefghijklmnopqrstuvwxyz0123456789"`;
    const r = sanitizeShareSnippet(code);
    expect(r.ok).toBe(false);
    expect(r.detector).toBe("long-base64-with-secret-context");
  });

  it("does NOT block legitimate Python lesson code with real-looking emails", () => {
    // Round-2 audit fix: dropped the email detector entirely because
    // Python tutorials routinely bind realistic addresses to a `email`
    // variable for string-formatting / dict-example lessons, and the
    // PII surface is bounded anyway (owner publishes own data).
    const cases = [
      `email = "anjali@gmail.com"`,
      `contact = "info@stripe.com"`,
      `recipients = ["alice@hotmail.com", "bob@yahoo.com"]`,
      `print("Reach me at me@icloud.com if you need help")`,
    ];
    for (const code of cases) {
      expect(sanitizeShareSnippet(code).ok).toBe(true);
    }
  });
});

describe("sanitizeShareSnippet — adversarial bypasses", () => {
  // Audit-driven: each of these used to slip past the detector. The
  // post-audit pre-processor (zero-width strip + ASCII fold) closes
  // them.

  it("blocks a key with a zero-width space inside the prefix", () => {
    // U+200B between `sk` and `-` defeats /\bsk-/ unless we strip it.
    const code = `key = "sk​-abcdefghijklmnopqrstuvwxyz"`;
    expect(sanitizeShareSnippet(code).ok).toBe(false);
  });

  it("blocks an AWS key written with a Cyrillic А homoglyph", () => {
    // Cyrillic А (U+0410) reads as Latin A but isn't.
    const code = `aws = "АKIAIOSFODNN7EXAMPLE"`;
    expect(sanitizeShareSnippet(code).ok).toBe(false);
  });

  it("blocks an AWS secret with `/` and `+` chars (\\b boundary fix)", () => {
    // AWS secret keys are 40 chars and routinely contain `/` and `+`,
    // which are non-word chars — \b right before/after those used to
    // misfire. Lookarounds in place of \b close that.
    const code = `aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"`;
    expect(sanitizeShareSnippet(code).ok).toBe(false);
  });

  it("blocks a JWT", () => {
    const code = `token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"`;
    expect(sanitizeShareSnippet(code).ok).toBe(false);
  });

  it("blocks an Authorization: Bearer ... header pattern", () => {
    const code = `headers = {"Authorization": "Bearer abcdefghijklmnopqrstuvwxyz1234567890"}`;
    expect(sanitizeShareSnippet(code).ok).toBe(false);
  });
});

describe("sanitizeDisplayName", () => {
  it("returns null for null input", () => {
    expect(sanitizeDisplayName(null)).toBe(null);
  });

  it("returns null when input is whitespace-only after strip", () => {
    expect(sanitizeDisplayName("   ")).toBe(null);
    expect(sanitizeDisplayName("​‌")).toBe(null);
  });

  it("preserves normal names with accents and CJK", () => {
    expect(sanitizeDisplayName("Mehul")).toBe("Mehul");
    expect(sanitizeDisplayName("Anjali")).toBe("Anjali");
    expect(sanitizeDisplayName("José")).toBe("José");
    expect(sanitizeDisplayName("李华")).toBe("李华");
    expect(sanitizeDisplayName("O'Brien")).toBe("O'Brien");
  });

  it("strips zero-width characters", () => {
    expect(sanitizeDisplayName("Me​hul")).toBe("Mehul");
  });

  it("strips RTL override characters", () => {
    // U+202E + reversed text used to spell something else
    expect(sanitizeDisplayName("Mehul‮Official")).toBe("MehulOfficial");
  });

  it("trims whitespace", () => {
    expect(sanitizeDisplayName("  Mehul  ")).toBe("Mehul");
  });

  it("caps length at 80 chars after sanitize", () => {
    const longName = "x".repeat(100);
    const out = sanitizeDisplayName(longName);
    expect(out?.length).toBe(80);
  });
});
