import type { Vec3 } from "./vec3.ts";
import { add, cross, dot, midpoint, normalize } from "./vec3.ts";
import { vecToLatLon } from "./geo.ts";

/**
 * Oriented spherical triangle on the unit sphere.
 * Vertices are unit vectors; orientation satisfies (A×B)·C > 0
 * (right-hand / outward).
 */
export type SphericalTriangle = {
  a: Vec3;
  b: Vec3;
  c: Vec3;
};

/**
 * Child indexing (stable, relative to parent vertices A,B,C):
 * - 0 (bits 00): corner at A → (A, midAB, midCA)
 * - 1 (bits 01): corner at B → (B, midBC, midAB)
 * - 2 (bits 10): corner at C → (C, midCA, midBC)
 * - 3 (bits 11): central     → (midAB, midBC, midCA)
 */
export const CHILD_BITS: readonly ["00", "01", "10", "11"] = [
  "00",
  "01",
  "10",
  "11",
];

export function containsPoint(t: SphericalTriangle, p: Vec3): boolean {
  const { a, b, c } = t;
  return (
    dot(cross(a, b), p) >= -1e-15 &&
    dot(cross(b, c), p) >= -1e-15 &&
    dot(cross(c, a), p) >= -1e-15
  );
}

export function subdivide(
  t: SphericalTriangle,
): [SphericalTriangle, SphericalTriangle, SphericalTriangle, SphericalTriangle] {
  const midAB = midpoint(t.a, t.b);
  const midBC = midpoint(t.b, t.c);
  const midCA = midpoint(t.c, t.a);
  return [
    { a: t.a, b: midAB, c: midCA },
    { a: t.b, b: midBC, c: midAB },
    { a: t.c, b: midCA, c: midBC },
    { a: midAB, b: midBC, c: midCA },
  ];
}

/** Pick the lowest-index child that contains p (deterministic on boundaries). */
export function childIndexContaining(
  t: SphericalTriangle,
  p: Vec3,
): 0 | 1 | 2 | 3 {
  const kids = subdivide(t);
  for (let i = 0; i < 4; i++) {
    if (containsPoint(kids[i]!, p)) {
      return i as 0 | 1 | 2 | 3;
    }
  }
  // Numerical fallback: nearest centroid
  let best: 0 | 1 | 2 | 3 = 0;
  let bestDot = -Infinity;
  for (let i = 0; i < 4; i++) {
    const k = kids[i]!;
    const cen = normalize(add(add(k.a, k.b), k.c));
    const d = dot(cen, p);
    if (d > bestDot) {
      bestDot = d;
      best = i as 0 | 1 | 2 | 3;
    }
  }
  return best;
}

export function childAt(
  t: SphericalTriangle,
  index: 0 | 1 | 2 | 3,
): SphericalTriangle {
  return subdivide(t)[index];
}

export function centroid(t: SphericalTriangle): Vec3 {
  return normalize(add(add(t.a, t.b), t.c));
}

export function triangleCornersLatLon(t: SphericalTriangle): [
  { lat: number; lon: number },
  { lat: number; lon: number },
  { lat: number; lon: number },
] {
  return [vecToLatLon(t.a), vecToLatLon(t.b), vecToLatLon(t.c)];
}
