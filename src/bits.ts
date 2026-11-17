/**
 * Bit-string representation of a Sierpinski coordinate.
 *
 * The coordinate itself is an integer. Its fixed-width pattern, MSB first, is:
 *   [reserved:1 = 0][octant:3][child:2 × levels]
 * Those first 4 bits are the whole header. The octant is the low 3 of that
 * header, not an extra field beside it.
 * Width = 4 + 2*levels.
 *
 * JavaScript bitwise operators are 32-bit, so packing stays in arithmetic.
 * Patterns wider than 53 bits are not safe integers.
 */

export const RESERVED_WIDTH = 1;
export const OCTANT_WIDTH = 3;
/** Reserved bit plus octant. 1 + 3 = 4, not a second copy of the octant. */
export const HEADER_WIDTH = RESERVED_WIDTH + OCTANT_WIDTH;
export const BITS_PER_LEVEL = 2;

const MAX_SAFE_BITS = 53;

export function bitLengthForLevels(levels: number): number {
  if (!Number.isInteger(levels) || levels < 0) {
    throw new Error(`levels must be a non-negative integer, got ${levels}`);
  }
  return HEADER_WIDTH + BITS_PER_LEVEL * levels;
}

/** Parse levels from a bit-string width; throws if the width is not 4 + 2*levels. */
export function levelsFromBitLength(bitLen: number): number {
  if (bitLen < HEADER_WIDTH || (bitLen - HEADER_WIDTH) % BITS_PER_LEVEL !== 0) {
    throw new Error(
      `Invalid bit length ${bitLen}; expected ${HEADER_WIDTH} + ${BITS_PER_LEVEL}*levels (levels ≥ 0)`,
    );
  }
  return (bitLen - HEADER_WIDTH) / BITS_PER_LEVEL;
}

/** Width of a coordinate, rejecting patterns that do not fit in a safe integer. */
export function safeBitLength(levels: number): number {
  const width = bitLengthForLevels(levels);
  if (width > MAX_SAFE_BITS) {
    throw new Error(
      `levels ${levels} needs ${width} bits, which exceeds the ${MAX_SAFE_BITS}-bit safe integer range`,
    );
  }
  return width;
}

/** Format an integer as a fixed-width bit string, including leading zeros. */
export function toBitString(value: number, width: number): string {
  if (!Number.isInteger(width) || width < 1 || width > MAX_SAFE_BITS) {
    throw new Error(
      `bit width must be an integer from 1 to ${MAX_SAFE_BITS}, got ${width}`,
    );
  }
  const limit = 2 ** width;
  if (!Number.isSafeInteger(value) || value < 0 || value >= limit) {
    throw new Error(`value ${value} does not fit in ${width} bits`);
  }
  return value.toString(2).padStart(width, "0");
}

/** Coordinate → fixed-width bit string (header included, so width is 4 + 2*levels). */
export function formatCoordinate(coordinate: number, levels: number): string {
  return toBitString(coordinate, safeBitLength(levels));
}

export function parseCoordinate(bits: string): {
  coordinate: number;
  levels: number;
} {
  if (!/^[01]+$/.test(bits)) {
    throw new Error("Bit string must contain only characters '0' and '1'");
  }
  const levels = levelsFromBitLength(bits.length);
  safeBitLength(levels);
  return { coordinate: Number.parseInt(bits, 2), levels };
}

/** Charset and width only. Does not check the reserved bit. */
export function isValidBitString(bits: string): boolean {
  if (!/^[01]+$/.test(bits)) return false;
  try {
    safeBitLength(levelsFromBitLength(bits.length));
    return true;
  } catch {
    return false;
  }
}
