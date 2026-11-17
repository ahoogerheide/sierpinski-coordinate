import {
  BITS_PER_LEVEL,
  HEADER_WIDTH,
  OCTANT_WIDTH,
  safeBitLength,
} from "./bits.ts";
import { clampLat, latLonToVec, normalizeLon, vecToLatLon } from "./geo.ts";
import {
  OCTANT_TRIANGLES,
  octantForLatLon,
  type OctantCode,
} from "./octants.ts";
import {
  centroid,
  childAt,
  childIndexContaining,
  triangleCornersLatLon,
  type ChildIndex,
  type SphericalTriangle,
} from "./triangle.ts";

/** High bit of the 4-bit header. Always 0. The octant occupies the other 3. */
export const RESERVED_BIT = 0;

const CHILD_BASE = 2 ** BITS_PER_LEVEL;

export type DecodeResult = {
  lat: number;
  lon: number;
  levels: number;
  /** Low 3 bits of the header (0–7). */
  octant: OctantCode;
  /** The 4-bit header: reserved bit in bit 3, octant in bits 2–0. */
  header: number;
  bounds: [
    { lat: number; lon: number },
    { lat: number; lon: number },
    { lat: number; lon: number },
  ];
};

/** 4-bit header. Octant is inside it; this does not append another 3 bits. */
function packHeader(octant: OctantCode): number {
  return RESERVED_BIT * 2 ** OCTANT_WIDTH + octant;
}

function splitHeader(header: number): { reserved: number; octant: OctantCode } {
  return {
    reserved: Math.trunc(header / 2 ** OCTANT_WIDTH),
    octant: (header % 2 ** OCTANT_WIDTH) as OctantCode,
  };
}

/**
 * Encode latitude/longitude as a Sierpinski coordinate.
 *
 * The integer's fixed-width pattern (width = 4 + 2*levels), MSB first:
 * reserved bit `0`, then the 3-bit octant, then 2 bits per level.
 * `levels` is required to recover that width, because leading zeros
 * (including the reserved bit) do not change the numeric value.
 */
export function encode(latDeg: number, lonDeg: number, levels: number): number {
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg)) {
    throw new Error("lat and lon must be finite numbers");
  }
  safeBitLength(levels);

  const lat = clampLat(latDeg);
  const lon = normalizeLon(lonDeg);
  const octant = octantForLatLon(lat, lon);
  const p = latLonToVec(lat, lon);

  let tri: SphericalTriangle = OCTANT_TRIANGLES[octant]!;
  let coordinate = packHeader(octant);

  for (let i = 0; i < levels; i++) {
    const idx = childIndexContaining(tri, p);
    coordinate = coordinate * CHILD_BASE + idx;
    tri = childAt(tri, idx);
  }

  return coordinate;
}

/**
 * Decode a Sierpinski coordinate.
 * `levels` selects the pattern width (4 + 2*levels). The high 4 bits of that
 * pattern are the header.
 * Returns the spherical centroid of the addressed triangle, plus corners.
 */
export function decode(coordinate: number, levels: number): DecodeResult {
  const width = safeBitLength(levels);
  const limit = 2 ** width;
  if (!Number.isSafeInteger(coordinate) || coordinate < 0 || coordinate >= limit) {
    throw new Error(`coordinate ${coordinate} does not fit in ${width} bits`);
  }

  const header = Math.trunc(coordinate / CHILD_BASE ** levels);
  if (header >= 2 ** HEADER_WIDTH) {
    throw new Error(
      `header ${header} does not fit in ${HEADER_WIDTH} bits`,
    );
  }

  const { reserved, octant } = splitHeader(header);
  if (reserved !== RESERVED_BIT) {
    throw new Error(
      `Unsupported reserved bit '${reserved}'; expected '${RESERVED_BIT}'`,
    );
  }

  let tri: SphericalTriangle = OCTANT_TRIANGLES[octant]!;
  const children = coordinate % CHILD_BASE ** levels;
  for (let i = 0; i < levels; i++) {
    const place = CHILD_BASE ** (levels - 1 - i);
    const idx = (Math.trunc(children / place) % CHILD_BASE) as ChildIndex;
    tri = childAt(tri, idx);
  }

  const { lat, lon } = vecToLatLon(centroid(tri));
  return {
    lat,
    lon,
    levels,
    octant,
    header,
    bounds: triangleCornersLatLon(tri),
  };
}
