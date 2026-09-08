import { smoothProgress } from "./geometry";

export interface PointerStroke {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  curve?: number;
}

/** Geometric turning rate, normalized by distance rather than event frequency. */
export function curveCarry(
  previous: PointerStroke | null,
  current: PointerStroke,
) {
  if (!previous) return 0;
  const ax = previous.x1 - previous.x0,
    ay = previous.y1 - previous.y0;
  const bx = current.x1 - current.x0,
    by = current.y1 - current.y0;
  const a = Math.hypot(ax, ay),
    b = Math.hypot(bx, by);
  if (a < 0.5 || b < 0.5) return 0;
  const turning = Math.abs(ax * by - ay * bx) / (a * b);
  return Math.min(1, (turning / ((a + b) * 0.5)) * 60);
}

/** Transfer the actual cursor path into local momentum, then return softly home. */
export function advanceGlyphMotion(
  offsets: Float32Array,
  velocities: Float32Array,
  index: number,
  homeX: number,
  homeY: number,
  strokes: readonly PointerStroke[],
  dt: number,
  background: boolean,
) {
  const k = index * 2,
    radius = background ? 150 : 125;
  for (const stroke of strokes) {
    const dx = stroke.x1 - stroke.x0,
      dy = stroke.y1 - stroke.y0;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared < 0.01) continue;
    const px = homeX + offsets[k]!,
      py = homeY + offsets[k + 1]!;
    const along = Math.max(
      0,
      Math.min(
        1,
        ((px - stroke.x0) * dx + (py - stroke.y0) * dy) / lengthSquared,
      ),
    );
    const distance = Math.hypot(
      px - stroke.x0 - dx * along,
      py - stroke.y0 - dy * along,
    );
    const influence = 1 - smoothProgress(distance / radius);
    const transfer =
      influence *
      influence *
      (background ? 0.38 : 0.65) *
      (1 + 0.4 * (stroke.curve ?? 0));
    velocities[k]! += dx * transfer;
    velocities[k + 1]! += dy * transfer;
  }
  const speed = Math.hypot(velocities[k]!, velocities[k + 1]!);
  if (speed > 160) {
    velocities[k]! *= 160 / speed;
    velocities[k + 1]! *= 160 / speed;
  }
  const duration = Math.min(Math.max(dt, 0), 0.05);
  const steps = Math.max(1, Math.ceil(duration / 0.012)),
    step = duration / steps;
  for (let n = 0; n < steps; n++) {
    velocities[k]! += (-5 * offsets[k]! - 4.8 * velocities[k]!) * step;
    velocities[k + 1]! +=
      (-5 * offsets[k + 1]! - 4.8 * velocities[k + 1]!) * step;
    offsets[k]! += velocities[k]! * step;
    offsets[k + 1]! += velocities[k + 1]! * step;
  }
}
