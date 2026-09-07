/** Original contours for the local design study. No reference-site assets. */
export type Shape = "code" | "read" | "ask" | "check";
/** A shape above the viewport midpoint must still assemble at page start. */
export function shapeScrollAnchor(pageCenter: number, viewportHeight: number) {
  return Math.max(0, pageCenter - viewportHeight / 2);
}
type Point = readonly [number, number];
const contours: Record<Shape, readonly (readonly Point[])[]> = {
  code: [
    [
      [-0.25, 0.68],
      [-0.88, 0],
      [-0.25, -0.68],
    ],
    [
      [0.25, 0.68],
      [0.88, 0],
      [0.25, -0.68],
    ],
  ],
  read: [
    [
      [-0.86, 0.58],
      [-0.28, 0.7],
      [0, 0.5],
      [0.28, 0.7],
      [0.86, 0.58],
      [0.86, -0.58],
      [0.28, -0.46],
      [0, -0.66],
      [-0.28, -0.46],
      [-0.86, -0.58],
      [-0.86, 0.58],
    ],
    [
      [0, 0.5],
      [0, -0.66],
    ],
  ],
  ask: [
    [
      [-0.75, 0.58],
      [0.75, 0.58],
      [0.9, 0.4],
      [0.9, -0.3],
      [0.72, -0.46],
      [0.12, -0.46],
      [-0.4, -0.8],
      [-0.4, -0.46],
      [-0.75, -0.46],
      [-0.9, -0.28],
      [-0.9, 0.4],
      [-0.75, 0.58],
    ],
  ],
  check: [
    [
      [-0.8, 0],
      [-0.22, -0.58],
      [0.82, 0.62],
    ],
  ],
};

export function smoothProgress(value: number) {
  const p = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return p * p * (3 - 2 * p);
}

/** Stable independent variation; avoid correlating glyph/color with vertical position. */
export function particleSeed(index: number) {
  const value = Math.sin((index + 1) * 127.1) * 43758.5453;
  return value - Math.floor(value);
}

/** Independent identity channels prevent bright/large particles sharing one glyph. */
export function particleIdentity(index: number) {
  return [particleSeed(index + 7919), particleSeed(index + 15401)] as const;
}

export function createShape(shape: Shape, count: number) {
  const paths = contours[shape];
  const segments = paths.flatMap((path) =>
    path.slice(1).map((b, i) => {
      const a = path[i]!;
      return { a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
    }),
  );
  const length = segments.reduce((sum, s) => sum + s.length, 0);
  const values = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    let distance = ((i + 0.5) / count) * length;
    let segment = segments[segments.length - 1]!;
    for (const candidate of segments) {
      segment = candidate;
      if (distance <= candidate.length) break;
      distance -= candidate.length;
    }
    const p = distance / segment.length;
    // Braided depth keeps the silhouette legible while making pointer tilt dimensional.
    const angle = i * 2.3999632297;
    const thickness = 0.015 + 0.11 * particleSeed(i);
    values[i * 3] =
      segment.a[0] +
      (segment.b[0] - segment.a[0]) * p +
      Math.cos(angle) * thickness;
    values[i * 3 + 1] =
      segment.a[1] +
      (segment.b[1] - segment.a[1]) * p +
      Math.sin(angle) * thickness;
    values[i * 3 + 2] =
      Math.sin(i * 0.032) * 0.22 + Math.cos(angle) * thickness;
  }
  return values;
}

export function createScatter(count: number) {
  const values = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Two spacious edge fields leave the central reading corridor clear.
    values[i * 3] =
      (i % 2 === 0 ? 1 : -1) * (0.78 + ((i * 0.754877666) % 1) * 0.28);
    values[i * 3 + 1] = ((i * 0.61803398875) % 1) * 2 - 1;
    values[i * 3 + 2] = Math.sin(i * 0.37) * 0.5;
  }
  return values;
}
