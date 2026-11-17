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
 * Octant triangles. Vertex A is the pole; B and C are equatorial corners
 * in outward-oriented order ((A×B)·C > 0).
 *
 * Bits | Hemisphere | Lon band (after normalizeLon → (-180, 180])
 * 000  | North      | [0, 90)
 * 001  | North      | [90, 180]
 * 010  | North      | (-180, -90)
 * 011  | North      | [-90, 0)
 * 100–111 | South   | same lon bands
 */
export const OCTANT_BITS = [
  "000",
  "001",
  "010",
  "011",
  "100",
  "101",
  "110",
  "111",
] as const;

export type OctantCode = (typeof OCTANT_BITS)[number];

export const OCTANT_TRIANGLES: Record<OctantCode, SphericalTriangle> = {
  // North: A = N, then equatorial B → C eastward
  "000": { a: N, b: E0, c: E90 },
  "001": { a: N, b: E90, c: E180 },
  "010": { a: N, b: E180, c: E270 },
  "011": { a: N, b: E270, c: E0 },
  // South: A = S; B → C westward so orientation stays outward
  "100": { a: S, b: E90, c: E0 },
  "101": { a: S, b: E180, c: E90 },
  "110": { a: S, b: E270, c: E180 },
  "111": { a: S, b: E0, c: E270 },
};

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
  const index = (south ? 4 : 0) + band;
  return OCTANT_BITS[index]!;
}

export function octantFromBits(bits: string): OctantCode {
  if (!/^[01]{3}$/.test(bits) || !(bits in OCTANT_TRIANGLES)) {
    throw new Error(`Invalid octant bits: ${bits}`);
  }
  return bits as OctantCode;
}
