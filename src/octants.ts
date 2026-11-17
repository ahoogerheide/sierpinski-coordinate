import type { Vec3 } from "./vec3.ts";
import type { SphericalTriangle } from "./triangle.ts";
import { clampLat, normalizeLon } from "./geo.ts";

const N: Vec3 = [0, 0, 1];
const S: Vec3 = [0, 0, -1];
const E0: Vec3 = [1, 0, 0]; // lon 0°
const E90: Vec3 = [0, 1, 0]; // lon 90°
const E180: Vec3 = [-1, 0, 0]; // lon ±180°
const E270: Vec3 = [0, -1, 0]; // lon -90°

/**
 * Octant index. This is the low 3 bits of the 4-bit header
 * (`0` + octant), not a field stored in addition to that header.
 *
 * Numbering follows the Wikipedia octant table, column "− as 1", "<"
 * (little-endian): bit 0 is the sign of x, bit 1 of y, bit 2 of z, and a
 * minus sign is 1. Axes: +x at lon 0°, +y at lon 90°, +z north.
 *
 * Index | Bits | (x, y, z) | Hemisphere | Lon band (normalizeLon → (-180, 180])
 * 0     | 000  | (+, +, +) | North      | [0, 90)
 * 1     | 001  | (−, +, +) | North      | [90, 180]
 * 2     | 010  | (+, −, +) | North      | [−90, 0)
 * 3     | 011  | (−, −, +) | North      | (−180, −90)
 * 4     | 100  | (+, +, −) | South      | [0, 90)
 * 5     | 101  | (−, +, −) | South      | [90, 180]
 * 6     | 110  | (+, −, −) | South      | [−90, 0)
 * 7     | 111  | (−, −, −) | South      | (−180, −90)
 */
export const OCTANTS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export type OctantCode = (typeof OCTANTS)[number];

export const OCTANT_TRIANGLES: readonly SphericalTriangle[] = [
  // North: A = N, then equatorial B → C eastward. Order is sign bits, not longitude.
  { a: N, b: E0, c: E90 }, // 0 (+, +, +)
  { a: N, b: E90, c: E180 }, // 1 (−, +, +)
  { a: N, b: E270, c: E0 }, // 2 (+, −, +)
  { a: N, b: E180, c: E270 }, // 3 (−, −, +)
  // South: A = S; B → C westward so orientation stays outward
  { a: S, b: E90, c: E0 }, // 4 (+, +, −)
  { a: S, b: E180, c: E90 }, // 5 (−, +, −)
  { a: S, b: E0, c: E270 }, // 6 (+, −, −)
  { a: S, b: E270, c: E180 }, // 7 (−, −, −)
];

export function lonBandIndex(lonDeg: number): 0 | 1 | 2 | 3 {
  const lon = normalizeLon(lonDeg);
  if (lon >= 0 && lon < 90) return 0; // (+, +)
  if (lon >= 90 && lon <= 180) return 1; // (−, +)
  if (lon >= -90 && lon < 0) return 2; // (+, −)
  return 3; // (−180, −90) → (−, −)
}

/**
 * Select octant. Equator (lat === 0) is assigned to the North octants.
 * Poles use the longitude band of the provided lon (even though lon is
 * arbitrary at ±90°).
 */
export function octantForLatLon(latDeg: number, lonDeg: number): OctantCode {
  const lat = clampLat(latDeg);
  const band = lonBandIndex(lonDeg);
  const south = lat < 0;
  return ((south ? 4 : 0) + band) as OctantCode;
}
