import { describe, expect, it } from "vitest";
import {
  advanceGlyphMotion,
  curveCarry,
  type PointerStroke,
} from "./interaction";

describe("glyph pointer momentum", () => {
  it("adds modest carry for curves but not straight sweeps or reversals", () => {
    const first = { x0: 0, y0: 0, x1: 10, y1: 0 };
    expect(curveCarry(first, { x0: 10, y0: 0, x1: 20, y1: 0 })).toBe(0);
    expect(curveCarry(first, { x0: 10, y0: 0, x1: 0, y1: 0 })).toBe(0);
    expect(curveCarry(first, { x0: 10, y0: 0, x1: 19, y1: 3 })).toBeGreaterThan(
      0,
    );
    const straightOffset = new Float32Array(2),
      straightVelocity = new Float32Array(2);
    const curveOffset = new Float32Array(2),
      curveVelocity = new Float32Array(2);
    advanceGlyphMotion(
      straightOffset,
      straightVelocity,
      0,
      10,
      0,
      [first],
      1 / 60,
      false,
    );
    advanceGlyphMotion(
      curveOffset,
      curveVelocity,
      0,
      10,
      0,
      [{ ...first, curve: 1 }],
      1 / 60,
      false,
    );
    expect(curveVelocity[0]! / straightVelocity[0]!).toBeCloseTo(1.4);
  });
  it("carries a nearby glyph along the stroke instead of radially repelling it", () => {
    const offset = new Float32Array(2),
      velocity = new Float32Array(2);
    advanceGlyphMotion(
      offset,
      velocity,
      0,
      0,
      0,
      [{ x0: -20, y0: 0, x1: 20, y1: 0 }],
      1 / 60,
      false,
    );
    expect(offset[0]).toBeGreaterThan(0);
    expect(offset[1]).toBe(0);
  });
  it("retains momentum after release, then settles without a reset", () => {
    const offset = new Float32Array(2),
      velocity = new Float32Array(2);
    advanceGlyphMotion(
      offset,
      velocity,
      0,
      0,
      0,
      [{ x0: -20, y0: 0, x1: 20, y1: 0 }],
      1 / 60,
      false,
    );
    const moved = offset[0]!;
    advanceGlyphMotion(offset, velocity, 0, 0, 0, [], 1 / 60, false);
    expect(offset[0]).toBeGreaterThan(moved);
    for (let i = 0; i < 600; i++)
      advanceGlyphMotion(offset, velocity, 0, 0, 0, [], 1 / 60, false);
    expect(Math.abs(offset[0]!)).toBeLessThan(0.01);
  });
  it("reverses the local circulation when the cursor circle reverses", () => {
    const circle = (direction: number) => {
      const path: PointerStroke[] = [];
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2 * direction,
          b = ((i + 1) / 32) * Math.PI * 2 * direction;
        path.push({
          x0: Math.cos(a) * 70,
          y0: Math.sin(a) * 70,
          x1: Math.cos(b) * 70,
          y1: Math.sin(b) * 70,
        });
      }
      const offset = new Float32Array(2),
        velocity = new Float32Array(2);
      advanceGlyphMotion(offset, velocity, 0, 70, 0, path, 1 / 60, false);
      return velocity[1]!;
    };
    expect(circle(1)).toBeGreaterThan(0);
    expect(circle(-1)).toBeLessThan(0);
  });
  it("also moves background glyphs, leaves distant glyphs alone and tolerates dropped frames", () => {
    const stroke = [{ x0: -20, y0: 0, x1: 20, y1: 0 }];
    const offset = new Float32Array(4),
      velocity = new Float32Array(4);
    advanceGlyphMotion(offset, velocity, 0, 0, 0, stroke, 1, true);
    advanceGlyphMotion(offset, velocity, 1, 1000, 1000, stroke, 1, false);
    expect(offset[0]).toBeGreaterThan(0);
    expect(offset[2]).toBe(0);
    expect([...offset, ...velocity].every(Number.isFinite)).toBe(true);
  });
});
