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
 * Index | Bits | Hemisphere | Lon band (after normalizeLon → (-180, 180])
 * 0     | 000  | North      | [0, 90)
 * 1     | 001  | North      | [90, 180]
 * 2     | 010  | North      | (-180, -90)
 * 3     | 011  | North      | [-90, 0)
 * 4–7   | 100–111 | South   | same lon bands
 */
export const OCTANTS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export type OctantCode = (typeof OCTANTS)[number];

export const OCTANT_TRIANGLES: readonly SphericalTriangle[] = [
  // North: A = N, then equatorial B → C eastward
  { a: N, b: E0, c: E90 },
  { a: N, b: E90, c: E180 },
  { a: N, b: E180, c: E270 },
  { a: N, b: E270, c: E0 },
  // South: A = S; B → C westward so orientation stays outward
  { a: S, b: E90, c: E0 },
  { a: S, b: E180, c: E90 },
  { a: S, b: E270, c: E180 },
  { a: S, b: E0, c: E270 },
];

export function lonBandIndex(lonDeg: number): 0 | 1 | 2 | 3 {
  const lon = normalizeLon(lonDeg);
  if (lon >= 0 && lon < 90) return 0;
  if (lon >= 90 && lon <= 180) return 1;
  if (lon > -180 && lon < -90) return 2;
  return 3; // [-90, 0)
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
