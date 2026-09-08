import { describe, expect, it } from "vitest";
import {
  createShape,
  createScatter,
  particleIdentity,
  particleSeed,
  smoothProgress,
  shapeScrollAnchor,
  ambientParticleCount,
  type Shape,
} from "./geometry";

describe("local marketing particle geometry", () => {
  it("preserves normal-screen density and adds bounded atmosphere on large viewports", () => {
    expect(ambientParticleCount(390, 844, 420)).toBe(630);
    expect(ambientParticleCount(1280, 900, 420)).toBe(630);
    expect(ambientParticleCount(1920, 1080, 420)).toBe(1134);
    expect(ambientParticleCount(2560, 1440, 420)).toBe(2016);
    expect(ambientParticleCount(3840, 2160, 420)).toBe(2520);
    expect(ambientParticleCount(7680, 4320, 420)).toBe(2520);
    expect(ambientParticleCount(900, 1280, 420)).toBe(630);
  });
  it("assembles the initial hero before scrolling even in a tall viewport", () => {
    expect(shapeScrollAnchor(430, 1000)).toBe(0);
    expect(shapeScrollAnchor(430, 1320)).toBe(0);
    expect(shapeScrollAnchor(430, 720)).toBe(70);
    expect(shapeScrollAnchor(1800, 1000)).toBe(1300);
  });
  it.each<Shape>(["code", "read", "ask", "check"])(
    "keeps %s deterministic, bounded and finite",
    (shape) => {
      for (const count of [1, 240, 420, 720]) {
        const points = createShape(shape, count);
        expect(points.length).toBe(count * 3);
        expect(points).toEqual(createShape(shape, count));
        expect(
          Array.from(points).every(
            (p) => Number.isFinite(p) && Math.abs(p) < 1.2,
          ),
        ).toBe(true);
      }
    },
  );
  it("has compatible buffers and distinct silhouettes", () => {
    const code = createShape("code", 32);
    expect(createScatter(32).length).toBe(code.length);
    expect(createShape("ask", 32)).not.toEqual(code);
    expect(Array.from(createScatter(32)).every(Number.isFinite)).toBe(true);
  });
  it("clamps progress and is symmetric for reversal", () => {
    expect(smoothProgress(-1)).toBe(0);
    expect(smoothProgress(2)).toBe(1);
    expect(smoothProgress(NaN)).toBe(0);
    expect(smoothProgress(0.5)).toBe(0.5);
    expect(smoothProgress(0.3)).toBeCloseTo(1 - smoothProgress(0.7));
  });
  it("keeps glyph variation deterministic and independent of vertical scatter ordering", () => {
    const seeds = Array.from({ length: 1152 }, (_, i) => particleSeed(i));
    expect(seeds).toEqual(
      Array.from({ length: 1152 }, (_, i) => particleSeed(i)),
    );
    expect(seeds.every((s) => s >= 0 && s < 1)).toBe(true);
    expect(new Set(seeds).size).toBe(seeds.length);
  });
  it.each([240, 420, 720])(
    "varies symbols among the largest particles at density %i",
    (count) => {
      const largest = Array.from({ length: count }, (_, i) => i).filter(
        (i) => particleSeed(i) > 0.92,
      );
      const glyphs = new Set(
        largest.map((i) => Math.floor(particleIdentity(i)[0] * 8)),
      );
      expect(glyphs.size).toBeGreaterThanOrEqual(5);
      expect(
        largest.every((i) => particleIdentity(i)[0] !== particleSeed(i)),
      ).toBe(true);
      expect(particleIdentity(42)).toEqual(particleIdentity(42));
    },
  );
});
