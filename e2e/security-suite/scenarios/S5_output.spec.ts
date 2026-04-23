// S5 — Output cap correctness (negative controls).
//
// S4d already proves that the per-line cap triggers on a 2 MB single
// write. This file proves the complementary direction: legitimate
// large-but-well-formed output does NOT get clipped.
//
// If this ever starts failing, we've over-capped something — and that's
// just as bad as under-capping, because it makes the sandbox hostile to
// well-behaved learners with chatty programs.

import { test, expect } from "../harness/fixtures.js";

test.describe("S5 — output cap does not punish normal output", () => {
  test("S5a: 500 KB of short-lined legitimate output is not truncated", async ({
    attack,
    sessionId,
    scenario,
  }) => {
    scenario({
      id: "S5a",
      claim: ["C11 output cap (negative control)"],
      summary: "normal multi-line output within the 1 MB/stream cap must pass through intact",
    });
    // 5000 lines of ~100 chars = ~500 KB. Well under the 1 MB stream
    // cap, and every line is well under the 8 KB per-line cap.
    const result = await attack.runAttack({
      sessionId,
      language: "python",
      files: [
        {
          path: "main.py",
          content: `
for i in range(5000):
    print(f"line {i:06d} " + ("x" * 80))
`.trim(),
        },
      ],
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("[output truncated");
    expect(result.stdout).not.toContain("[line truncated");
    // Last line must be present — proves nothing got clipped.
    expect(result.stdout).toContain("line 004999");
  });
});
