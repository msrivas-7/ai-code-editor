import { describe, expect, it } from "vitest";
import { renderOgPng, renderOgStoryPng } from "./ogRenderer.js";

// Phase 21C: smoke-test the OG renderer end-to-end. We don't compare
// against a pixel-perfect reference image (Satori output isn't byte-
// stable across versions), but we DO verify:
//   - the call resolves without throwing (fonts load, JSX layout
//     parses, Satori produces an SVG, resvg rasterizes to PNG)
//   - the output is a valid PNG (correct magic header)
//   - the byte size is in a reasonable range (not 0, not absurdly
//     large — catches catastrophic regressions)

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("renderOgPng", () => {
  const sample = {
    lessonTitle: "Functions",
    lessonOrder: 4,
    courseTitle: "Python Fundamentals",
    courseTotalLessons: 12,
    mastery: "strong" as const,
    timeSpentMs: 360_000,
    attemptCount: 1,
    codeSnippet: `def greet(name):
    # Returns a friendly hello.
    return f"Hello, {name}!"

print(greet("Mehul"))`,
    displayName: "Mehul",
    shareToken: "k7n3qx8z",
  };

  it("produces a valid PNG buffer", async () => {
    const png = await renderOgPng(sample);
    expect(png).toBeInstanceOf(Buffer);
    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    // 1200x630 PNG should fall in a healthy range. Below 5KB suggests
    // a blank image; above 1MB suggests something blew up.
    expect(png.byteLength).toBeGreaterThan(5_000);
    expect(png.byteLength).toBeLessThan(1_000_000);
  }, 30_000);

  it("handles a single-line snippet", async () => {
    const png = await renderOgPng({
      ...sample,
      codeSnippet: 'print("Hello, world!")',
    });
    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  }, 30_000);

  it("handles an anonymous share (displayName=null)", async () => {
    const png = await renderOgPng({ ...sample, displayName: null });
    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  }, 30_000);

  it("renders all three mastery tiers without error", async () => {
    for (const mastery of ["strong", "okay", "shaky"] as const) {
      const png = await renderOgPng({ ...sample, mastery });
      expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    }
  }, 60_000);

  it("truncates a >10-line snippet without crashing", async () => {
    const longCode = Array.from({ length: 30 }, (_, i) => `line_${i} = ${i}`).join("\n");
    const png = await renderOgPng({ ...sample, codeSnippet: longCode });
    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  }, 30_000);
});

// Phase 21C-ext: same smoke surface for the 9:16 Story-format render.
describe("renderOgStoryPng", () => {
  const sample = {
    lessonTitle: "Functions",
    lessonOrder: 4,
    courseTitle: "Python Fundamentals",
    courseTotalLessons: 12,
    mastery: "strong" as const,
    timeSpentMs: 360_000,
    attemptCount: 1,
    codeSnippet: `def greet(name):
    # Returns a friendly hello.
    return f"Hello, {name}!"

print(greet("Mehul"))`,
    displayName: "Mehul",
    shareToken: "k7n3qx8z",
  };

  it("produces a valid PNG buffer at 1080x1920", async () => {
    const png = await renderOgStoryPng(sample);
    expect(png).toBeInstanceOf(Buffer);
    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    // 9:16 PNG is meaningfully larger than 1200×630 — bump the lower
    // bound and the upper bound accordingly.
    expect(png.byteLength).toBeGreaterThan(8_000);
    expect(png.byteLength).toBeLessThan(2_000_000);
  }, 30_000);

  it("renders an anonymous share without error", async () => {
    const png = await renderOgStoryPng({ ...sample, displayName: null });
    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  }, 30_000);

  it("truncates a >12-line snippet without crashing", async () => {
    const longCode = Array.from({ length: 30 }, (_, i) => `line_${i} = ${i}`).join("\n");
    const png = await renderOgStoryPng({ ...sample, codeSnippet: longCode });
    expect(png.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  }, 30_000);
});
