import { clampLat, latLonToVec, normalizeLon, vecToLatLon } from "./geo.ts";
import {
  OCTANT_TRIANGLES,
  octantForLatLon,
  octantFromBits,
} from "./octants.ts";
import {
  CHILD_BITS,
  childAt,
  childIndexContaining,
  centroid,
  triangleCornersLatLon,
  type SphericalTriangle,
} from "./triangle.ts";

/** Leading reserved bit of the 4-bit header; always 0. */
export const RESERVED_BIT = "0";

export type DecodeResult = {
  lat: number;
  lon: number;
  levels: number;
  /** 3-bit octant code (e.g. "000"). */
  octant: string;
  /** Full 4-bit header: reserved bit + octant (`0` + octant). */
  header: string;
  bounds: [
    { lat: number; lon: number },
    { lat: number; lon: number },
    { lat: number; lon: number },
  ];
};

/** Expected bit-string length for a given recursion depth: 4 + 2*levels. */
export function bitLengthForLevels(levels: number): number {
  if (!Number.isInteger(levels) || levels < 0) {
    throw new Error(`levels must be a non-negative integer, got ${levels}`);
  }
  return 4 + 2 * levels;
}

/** Parse levels from a bit string; throws if length is invalid. */
export function levelsFromBitLength(bitLen: number): number {
  if (bitLen < 4 || (bitLen - 4) % 2 !== 0) {
    throw new Error(
      `Invalid bit length ${bitLen}; expected 4 + 2*levels (levels ≥ 0)`,
    );
  }
  return (bitLen - 4) / 2;
}

function assertBinaryString(bits: string): void {
  if (!/^[01]+$/.test(bits)) {
    throw new Error("Bit string must contain only characters '0' and '1'");
  }
}

/**
 * Encode latitude/longitude into a Sierpinski coordinate bit string.
 *
 * Layout: 4-bit header = reserved `0` + 3-bit octant, then 2 bits per level.
 * Bit length = 4 + 2*levels.
 */
export function encode(
  latDeg: number,
  lonDeg: number,
  levels: number,
): string {
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg)) {
    throw new Error("lat and lon must be finite numbers");
  }
  if (!Number.isInteger(levels) || levels < 0) {
    throw new Error(`levels must be a non-negative integer, got ${levels}`);
  }

  const lat = clampLat(latDeg);
  const lon = normalizeLon(lonDeg);
  const octant = octantForLatLon(lat, lon);
  const p = latLonToVec(lat, lon);

  let tri: SphericalTriangle = OCTANT_TRIANGLES[octant];
  let out = RESERVED_BIT + octant;

  for (let i = 0; i < levels; i++) {
    const idx = childIndexContaining(tri, p);
    out += CHILD_BITS[idx];
    tri = childAt(tri, idx);
  }

  return out;
}

/**
 * Decode a Sierpinski coordinate bit string.
 * Returns the spherical centroid of the addressed triangle, plus corners.
 */
export function decode(bits: string): DecodeResult {
  assertBinaryString(bits);
  const levels = levelsFromBitLength(bits.length);

  const reserved = bits[0]!;
  if (reserved !== RESERVED_BIT) {
    throw new Error(
      `Unsupported reserved bit '${reserved}'; expected '${RESERVED_BIT}'`,
    );
  }

  const octantBits = bits.slice(1, 4);
  const octant = octantFromBits(octantBits);
  let tri: SphericalTriangle = OCTANT_TRIANGLES[octant];

  for (let i = 0; i < levels; i++) {
    const pair = bits.slice(4 + 2 * i, 6 + 2 * i);
    const idx = CHILD_BITS.indexOf(pair as (typeof CHILD_BITS)[number]);
    if (idx < 0) {
      throw new Error(`Invalid child bits '${pair}' at level ${i}`);
    }
    tri = childAt(tri, idx as 0 | 1 | 2 | 3);
  }

  const { lat, lon } = vecToLatLon(centroid(tri));
  return {
    lat,
    lon,
    levels,
    octant: octantBits,
    header: RESERVED_BIT + octantBits,
    bounds: triangleCornersLatLon(tri),
  };
}

/** Validate bit length only (does not check reserved/octant content). */
export function isValidBitLength(bits: string): boolean {
  try {
    levelsFromBitLength(bits.length);
    return /^[01]+$/.test(bits);
  } catch {
    return false;
  }
}

export {
  normalizeLon,
  clampLat,
  octantForLatLon,
  CHILD_BITS,
  OCTANT_TRIANGLES,
};
