import type { Vec3 } from "./vec3.ts";
import type { SphericalTriangle } from "./triangle.ts";
import { clampLat, normalizeLon } from "./geo.ts";

/**
 * Octant index. The low 3 bits of the 4-bit header (`0` + octant)
 *
 * Numbering follows the Wikipedia octant table, column "− as 1", "<" (little-endian)
 * bit 0 is the sign of x, bit 1 of y, bit 2 of z, and a minus sign is 1.
 * A zero component stays 0. Axes: +x at lon 0°, +y at lon 90°, +z north.
 *
 * Index | Bits | (x, y, z) | Hemisphere | Lon band (normalizeLon → (-180, 180])
 * 0     | 000  | (+, +, +) | North      | [0, 90]
 * 1     | 001  | (−, +, +) | North      | (90, 180]
 * 2     | 010  | (+, −, +) | North      | [−90, 0)
 * 3     | 011  | (−, −, +) | North      | (−180, −90)
 * 4     | 100  | (+, +, −) | South      | [0, 90]
 * 5     | 101  | (−, +, −) | South      | (90, 180]
 * 6     | 110  | (+, −, −) | South      | [−90, 0)
 * 7     | 111  | (−, −, −) | South      | (−180, −90)
 */
export const OCTANTS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export type OctantCode = (typeof OCTANTS)[number];

/** Signs of x, y, z as ±1. Bit value 1 means that axis is negative. */
function axisSigns(octant: OctantCode): [number, number, number] {
  return [
    (octant & 0b001) === 0 ? 1 : -1,
    (octant & 0b010) === 0 ? 1 : -1,
    (octant & 0b100) === 0 ? 1 : -1,
  ];
}

/**
 * Spherical triangle for an octant, built from its sign bits.
 * Equatorial corners are ordered so (A×B)·C > 0 (outward).
 */
function triangleForOctant(octant: OctantCode): SphericalTriangle {
  const [sx, sy, sz] = axisSigns(octant);
  const onX: Vec3 = [sx, 0, 0];
  const onY: Vec3 = [0, sy, 0];
  const outward = sx * sy === sz;
  return {
    a: [0, 0, sz],
    b: outward ? onX : onY,
    c: outward ? onY : onX,
  };
}

export const OCTANT_TRIANGLES: readonly SphericalTriangle[] =
  OCTANTS.map(triangleForOctant);

/**
 * Select octant from the signs of (x, y, z), with − as bit 1.
 * A zero component stays 0, so the equator is north and a pole keeps
 * the x/y bits of the provided longitude.
 */
export function octantForLatLon(latDeg: number, lonDeg: number): OctantCode {
  const lat = clampLat(latDeg);
  const lon = normalizeLon(lonDeg);
  const xMinus = Math.abs(lon) > 90 ? 1 : 0;
  const yMinus = lon < 0 ? 1 : 0;
  const zMinus = lat < 0 ? 1 : 0;
  return (xMinus | (yMinus << 1) | (zMinus << 2)) as OctantCode;
}
