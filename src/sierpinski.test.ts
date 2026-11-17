import { describe, expect, it } from "vitest";
import {
  HEADER_WIDTH,
  bitLengthForLevels,
  formatCoordinate,
  isValidBitString,
  levelsFromBitLength,
  parseCoordinate,
  toBitString,
} from "./bits.ts";
import { normalizeLon } from "./geo.ts";
import { OCTANT_TRIANGLES, octantForLatLon } from "./octants.ts";
import {
  RESERVED_BIT,
  decode,
  encode,
} from "./sierpinski.ts";
import { childAt } from "./triangle.ts";

describe("normalizeLon", () => {
  it("maps into (-180, 180]", () => {
    expect(normalizeLon(0)).toBe(0);
    expect(normalizeLon(180)).toBe(180);
    expect(normalizeLon(-180)).toBe(180);
    expect(normalizeLon(270)).toBe(-90);
    expect(normalizeLon(-270)).toBe(90);
  });
});

describe("octantForLatLon", () => {
  it("assigns a clear NE point to octant 0", () => {
    expect(octantForLatLon(45, 45)).toBe(0b000);
  });

  it("covers all eight octants at mid-band points", () => {
    expect(octantForLatLon(30, 45)).toBe(0b000); // (+, +, +)
    expect(octantForLatLon(30, 135)).toBe(0b001); // (−, +, +)
    expect(octantForLatLon(30, -45)).toBe(0b010); // (+, −, +)
    expect(octantForLatLon(30, -135)).toBe(0b011); // (−, −, +)
    expect(octantForLatLon(-30, 45)).toBe(0b100); // (+, +, −)
    expect(octantForLatLon(-30, 135)).toBe(0b101); // (−, +, −)
    expect(octantForLatLon(-30, -45)).toBe(0b110); // (+, −, −)
    expect(octantForLatLon(-30, -135)).toBe(0b111); // (−, −, −)
  });

  it("puts the equator on northern octants", () => {
    expect(octantForLatLon(0, 45)).toBe(0b000);
  });
});

describe("bit length helpers", () => {
  it("computes a 4-bit header plus 2 bits per level", () => {
    expect(bitLengthForLevels(0)).toBe(4);
    expect(bitLengthForLevels(3)).toBe(10);
  });

  it("rejects invalid lengths", () => {
    expect(() => levelsFromBitLength(3)).toThrow();
    expect(() => levelsFromBitLength(5)).toThrow();
    expect(isValidBitString("0000")).toBe(true);
    expect(isValidBitString("00000")).toBe(false);
  });
});

describe("bit string conversion", () => {
  it("pads the 4-bit header, including the leading reserved 0", () => {
    expect(formatCoordinate(0b0100, 0)).toBe("0100");
    expect(toBitString(0b100, HEADER_WIDTH)).toBe("0100");
    expect(toBitString(0b100, 3)).toBe("100");
  });

  it("parses a bit string back into the integer and its level count", () => {
    expect(parseCoordinate("0100")).toEqual({ coordinate: 0b0100, levels: 0 });
    expect(parseCoordinate("000100")).toEqual({ coordinate: 0b000100, levels: 1 });
    expect(formatCoordinate(0b000100, 1)).toBe("000100");
  });

  it("rejects non-binary text", () => {
    expect(() => parseCoordinate("000x")).toThrow();
  });
});

describe("encode", () => {
  it("stores a 4-bit header: reserved 0 and the octant, not a 7-bit prefix", () => {
    // South, 0–90° E → octant 0b100. At 0 levels the coordinate is that header.
    expect(encode(-30, 45, 0)).toBe(0b0100);
    expect(encode(-30, 45, 0)).toBeLessThan(2 ** HEADER_WIDTH);

    const decoded = decode(0b0100, 0);
    expect(decoded.header).toBe(0b0100);
    expect(decoded.octant).toBe(0b100);
    expect(decoded.header).toBeLessThan(2 ** HEADER_WIDTH);
  });

  it("uses header 0b0000 for a NE point", () => {
    const coordinate = encode(45, 45, 0);
    expect(coordinate).toBe(RESERVED_BIT * 8 + 0b000);
    expect(formatCoordinate(coordinate, 0)).toBe("0000");
  });

  it("uses child 0 for the center, then corners A, B, and C", () => {
    const parent = OCTANT_TRIANGLES[0]!;
    expect(childAt(parent, 1).a).toEqual(parent.a);
    expect(childAt(parent, 2).a).toEqual(parent.b);
    expect(childAt(parent, 3).a).toEqual(parent.c);
    expect(childAt(parent, 0).a).not.toEqual(parent.a);
  });

  it("keeps trailing zero children on the octant centroid", () => {
    const { lat, lon } = decode(0b0000, 0);
    expect(encode(lat, lon, 8)).toBe(0b0000);
    const nested = decode(0b0000, 8);
    expect(nested.lat).toBeCloseTo(lat);
    expect(nested.lon).toBeCloseTo(lon);
  });

  it("keeps the header in the high 4 bits as levels are added", () => {
    const levels = 5;
    const coordinate = encode(-30, 45, levels);
    expect(Math.trunc(coordinate / 4 ** levels)).toBe(0b0100);
    expect(coordinate).toBeLessThan(2 ** bitLengthForLevels(levels));
    expect(decode(coordinate, levels).octant).toBe(0b100);
  });

  it("still reads the 4-bit header at the safe-integer limit", () => {
    const levels = 24;
    const coordinate = encode(-30, 45, levels);
    expect(Number.isSafeInteger(coordinate)).toBe(true);
    expect(Math.trunc(coordinate / 4 ** levels)).toBe(0b0100);
    expect(decode(coordinate, levels).header).toBe(0b0100);
    expect(decode(coordinate, levels).octant).toBe(0b100);
  });
});

describe("round-trip", () => {
  const samples: Array<[number, number, number]> = [
    [45, 45, 6],
    [10, 10, 8],
    [60, 120, 5],
    [20, -30, 7],
    [-40, 50, 6],
    [-15, -120, 4],
    [1, 179, 5],
    [-1, -179, 5],
  ];

  for (const [lat, lon, levels] of samples) {
    it(`round-trips (${lat}, ${lon}) @ ${levels} levels near the cell`, () => {
      const coordinate = encode(lat, lon, levels);
      const decoded = decode(coordinate, levels);
      expect(decoded.levels).toBe(levels);
      expect(decoded.octant).toBe(octantForLatLon(lat, lon));
      expect(decoded.header).toBe(0b0000 | octantForLatLon(lat, lon));
      expect(decoded.header).toBeLessThan(2 ** HEADER_WIDTH);
      const dLat = Math.abs(decoded.lat - lat);
      const dLon = Math.abs(normalizeLon(decoded.lon - lon));
      const span = 180 / 2 ** Math.max(levels - 1, 1);
      expect(dLat).toBeLessThan(span);
      expect(dLon).toBeLessThan(span * 2);
    });
  }

  it("re-encoding the decoded centroid recovers the same coordinate", () => {
    const coordinate = encode(45, 45, 8);
    const { lat, lon, levels } = decode(coordinate, 8);
    expect(encode(lat, lon, levels)).toBe(coordinate);
  });

  it("uses levels to tell apart equal numbers with different widths", () => {
    const narrow = decode(0b0100, 0);
    const wide = decode(0b000100, 1);
    expect(narrow.octant).toBe(0b100);
    expect(wide.octant).toBe(0b001);
    expect(wide.header).toBe(0b0001);
  });
});

describe("decode validation", () => {
  it("rejects reserved bit 1", () => {
    expect(() => decode(0b1000, 0)).toThrow(/reserved/);
  });

  it("rejects a coordinate wider than the level count", () => {
    expect(() => decode(0b10000, 0)).toThrow(/fit/);
  });
});
