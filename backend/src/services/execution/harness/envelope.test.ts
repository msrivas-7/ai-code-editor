import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { parseSignedEnvelope } from "./envelope.js";
import { TEST_SENTINEL } from "./types.js";

function buildEnvelope(
  body: object,
  nonce: string,
  opts: { signWith?: string; corruptBase64?: boolean } = {},
): string {
  const bodyStr = JSON.stringify(body);
  const signingKey = opts.signWith ?? nonce;
  const sig = crypto
    .createHmac("sha256", signingKey)
    .update(bodyStr)
    .digest("hex");
  const inner = JSON.stringify({ body: bodyStr, sig });
  let encoded = Buffer.from(inner, "utf8").toString("base64");
  if (opts.corruptBase64) encoded = encoded + "!";
  return `${TEST_SENTINEL}${encoded}${TEST_SENTINEL}\n`;
}

describe("parseSignedEnvelope", () => {
  const nonce = crypto.randomBytes(32).toString("hex");

  it("round-trips a well-signed envelope", () => {
    const body = {
      results: [
        {
          name: "t1",
          hidden: false,
          category: null,
          passed: true,
          actualRepr: "4",
          expectedRepr: "4",
          stdoutDuring: "",
          error: null,
        },
      ],
      harnessError: null,
      cleanStdout: "",
    };
    const stdout = buildEnvelope(body, nonce);
    const report = parseSignedEnvelope(stdout, "", nonce);
    expect(report.harnessError).toBeNull();
    expect(report.results).toHaveLength(1);
    expect(report.results[0].passed).toBe(true);
  });

  it("preserves learner's pre/post sentinel prints as cleanStdout fallback when inner body has no cleanStdout", () => {
    // Body itself declares cleanStdout, so that wins. But outer prints still
    // need stripping so that the base64 chunk isn't left in the visible area.
    const body = {
      results: [],
      harnessError: null,
      cleanStdout: "captured by harness",
    };
    const envelope = buildEnvelope(body, nonce);
    const stdout = `prefix line\n${envelope}suffix line`;
    const report = parseSignedEnvelope(stdout, "", nonce);
    expect(report.cleanStdout).toBe("captured by harness");
  });

  it("fails closed with generic message when no sentinel present", () => {
    const report = parseSignedEnvelope("no envelope at all", "", nonce);
    expect(report.results).toEqual([]);
    expect(report.harnessError).toMatch(/Test run failed/i);
  });

  it("surfaces stderr when harness never wrote an envelope (likely crash)", () => {
    const report = parseSignedEnvelope(
      "",
      "python3: can't open file 'missing.py'",
      nonce,
    );
    expect(report.harnessError).toContain("missing.py");
  });

  it("fails closed with generic message when only one sentinel is present", () => {
    const report = parseSignedEnvelope(
      `${TEST_SENTINEL}garbage`,
      "",
      nonce,
    );
    expect(report.harnessError).toMatch(/Test run failed/i);
    expect(report.results).toEqual([]);
  });

  it("rejects envelopes signed with a different nonce (forgery)", () => {
    const body = {
      results: [{ name: "forged", hidden: false, category: null, passed: true, actualRepr: "1", expectedRepr: "1", stdoutDuring: "", error: null }],
      harnessError: null,
      cleanStdout: "",
    };
    const wrongNonce = crypto.randomBytes(32).toString("hex");
    const stdout = buildEnvelope(body, nonce, { signWith: wrongNonce });
    const report = parseSignedEnvelope(stdout, "", nonce);
    expect(report.results).toEqual([]);
    expect(report.harnessError).toMatch(/Test run failed/i);
  });

  it("rejects envelopes with garbage in the base64 region", () => {
    const body = { results: [], harnessError: null, cleanStdout: "" };
    const stdout = buildEnvelope(body, nonce, { corruptBase64: true });
    const report = parseSignedEnvelope(stdout, "", nonce);
    expect(report.harnessError).toMatch(/Test run failed/i);
  });

  it("rejects an empty base64 region", () => {
    const stdout = `${TEST_SENTINEL}${TEST_SENTINEL}\n`;
    const report = parseSignedEnvelope(stdout, "", nonce);
    expect(report.harnessError).toMatch(/Test run failed/i);
  });

  it("rejects well-formed base64 whose decoded JSON is missing body/sig fields", () => {
    const bad = Buffer.from(JSON.stringify({ hello: "world" }), "utf8").toString(
      "base64",
    );
    const stdout = `${TEST_SENTINEL}${bad}${TEST_SENTINEL}\n`;
    const report = parseSignedEnvelope(stdout, "", nonce);
    expect(report.harnessError).toMatch(/Test run failed/i);
  });

  it("rejects when the inner body is not valid JSON even if signature matches", () => {
    const bodyStr = "not json";
    const sig = crypto.createHmac("sha256", nonce).update(bodyStr).digest("hex");
    const inner = JSON.stringify({ body: bodyStr, sig });
    const encoded = Buffer.from(inner, "utf8").toString("base64");
    const stdout = `${TEST_SENTINEL}${encoded}${TEST_SENTINEL}\n`;
    const report = parseSignedEnvelope(stdout, "", nonce);
    expect(report.harnessError).toMatch(/Test run failed/i);
  });

  it("defends against a user-forged v1 sentinel by simply not matching it (v2 sentinel is unique)", () => {
    const v1Sentinel = "__CODETUTOR_TESTS_v1__";
    const fake = `${v1Sentinel}{"results":[{"passed":true}],"harnessError":null}${v1Sentinel}\n`;
    const report = parseSignedEnvelope(fake, "", nonce);
    expect(report.results).toEqual([]);
    expect(report.harnessError).toMatch(/Test run failed/i);
  });

  it("treats base64 padding and whitespace tolerantly between sentinels", () => {
    const body = { results: [], harnessError: null, cleanStdout: "" };
    const baseEnvelope = buildEnvelope(body, nonce);
    // Insert a newline inside the base64 region — strict regex allows \s, and
    // Buffer.from('base64') ignores whitespace.
    const start = baseEnvelope.indexOf(TEST_SENTINEL) + TEST_SENTINEL.length;
    const end = baseEnvelope.lastIndexOf(TEST_SENTINEL);
    const b64 = baseEnvelope.slice(start, end);
    const spaced = b64.slice(0, 4) + "\n" + b64.slice(4);
    const stdout = `${TEST_SENTINEL}${spaced}${TEST_SENTINEL}\n`;
    const report = parseSignedEnvelope(stdout, "", nonce);
    expect(report.harnessError).toBeNull();
    expect(report.results).toEqual([]);
  });
});
