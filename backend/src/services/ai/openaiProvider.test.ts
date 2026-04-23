import { describe, expect, it } from "vitest";
import { estimateInputTokensForAsk, estimateTokens } from "./openaiProvider.js";
import type { AIAskParams } from "./provider.js";

// SEC-C1 follow-up (audit-v2): aborts previously wrote cost=0 ledger rows,
// letting abort-spam bypass the L2/L3/L4 dollar caps. The fix estimates
// input + output tokens at abort time so real cost is recorded. These
// tests pin the estimator's behaviour — not trying to validate tiktoken-
// level accuracy, just that the helpers return plausible non-zero values
// proportional to prompt size.

describe("estimateTokens", () => {
  it("returns 0 for the empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("is roughly chars / 4 (OpenAI's recommended rough estimate)", () => {
    // Small inputs: verified by hand.
    expect(estimateTokens("x")).toBe(1); // ceil(1/4) = 1
    expect(estimateTokens("xxxx")).toBe(1); // ceil(4/4) = 1
    expect(estimateTokens("xxxxx")).toBe(2); // ceil(5/4) = 2
    expect(estimateTokens("x".repeat(100))).toBe(25); // ceil(100/4) = 25
  });

  it("grows monotonically with length (no caps / rounding bugs)", () => {
    const a = estimateTokens("x".repeat(1000));
    const b = estimateTokens("x".repeat(10_000));
    expect(b).toBeGreaterThan(a);
    expect(b).toBe(2500);
  });
});

function minimalParams(overrides: Partial<AIAskParams> = {}): AIAskParams {
  return {
    key: "sk-test",
    model: "gpt-4.1-nano",
    fundingSource: "platform",
    question: "What is a variable?",
    files: [{ path: "main.py", content: 'print("hello")\n' }],
    history: [],
    ...overrides,
  };
}

describe("estimateInputTokensForAsk", () => {
  it("returns a positive integer for a realistic small prompt", () => {
    const n = estimateInputTokensForAsk(minimalParams());
    expect(n).toBeGreaterThan(0);
    expect(Number.isInteger(n)).toBe(true);
  });

  it("scales with file size — a big project costs more input tokens than a small one", () => {
    const small = estimateInputTokensForAsk(minimalParams());
    const big = estimateInputTokensForAsk(
      minimalParams({
        files: [
          { path: "main.py", content: "x = 1\n".repeat(5000) }, // ~30 KB
        ],
      }),
    );
    expect(big).toBeGreaterThan(small);
    // The ~30 KB file should contribute at least a few thousand tokens
    // even after the prompt builder's truncation ceilings kick in.
    expect(big - small).toBeGreaterThan(500);
  });

  it("handles a conversation with prior history (prompt grows with context)", () => {
    const solo = estimateInputTokensForAsk(minimalParams());
    const withHistory = estimateInputTokensForAsk(
      minimalParams({
        history: [
          { role: "user", content: "Explain Python." },
          { role: "assistant", content: "Python is a high-level language..." },
          { role: "user", content: "Tell me about variables." },
        ],
      }),
    );
    expect(withHistory).toBeGreaterThanOrEqual(solo);
  });

  it("returns the same shape regardless of funding source (labels only)", () => {
    const byok = estimateInputTokensForAsk(minimalParams({ fundingSource: "byok" }));
    const platform = estimateInputTokensForAsk(minimalParams({ fundingSource: "platform" }));
    expect(byok).toBe(platform);
  });
});
