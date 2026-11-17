import { describe, expect, it } from "vitest";
import {
  bitLengthForLevels,
  decode,
  encode,
  isValidBitLength,
  levelsFromBitLength,
  normalizeLon,
  octantForLatLon,
  RESERVED_BIT,
} from "./sierpinski.ts";

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
  it("assigns a clear NE point to octant 000", () => {
    expect(octantForLatLon(45, 45)).toBe("000");
  });

  it("covers all eight octants at mid-band points", () => {
    expect(octantForLatLon(30, 45)).toBe("000");
    expect(octantForLatLon(30, 135)).toBe("001");
    expect(octantForLatLon(30, -135)).toBe("010");
    expect(octantForLatLon(30, -45)).toBe("011");
    expect(octantForLatLon(-30, 45)).toBe("100");
    expect(octantForLatLon(-30, 135)).toBe("101");
    expect(octantForLatLon(-30, -135)).toBe("110");
    expect(octantForLatLon(-30, -45)).toBe("111");
  });

  it("puts the equator on northern octants", () => {
    expect(octantForLatLon(0, 45)).toBe("000");
  });
});

describe("bit length helpers", () => {
  it("computes 4 + 2*levels", () => {
    expect(bitLengthForLevels(0)).toBe(4);
    expect(bitLengthForLevels(3)).toBe(10);
  });

  it("rejects invalid lengths", () => {
    expect(() => levelsFromBitLength(3)).toThrow();
    expect(() => levelsFromBitLength(5)).toThrow();
    expect(isValidBitLength("0000")).toBe(true);
    expect(isValidBitLength("00000")).toBe(false);
  });
});

describe("encode", () => {
  it("uses header 0+000 for a NE point", () => {
    const bits = encode(45, 45, 0);
    expect(bits).toBe(RESERVED_BIT + "000");
    expect(bits.length).toBe(4);
  });

  it("uses header 0100 for South 0–90° E", () => {
    expect(encode(-30, 45, 0)).toBe("0100");
  });

  it("appends 2 bits per level", () => {
    const bits = encode(45, 45, 4);
    expect(bits.length).toBe(4 + 8);
    expect(bits.startsWith("0000")).toBe(true);
  });
});

describe("round-trip", () => {
  const samples: Array<[number, number, number]> = [
    [45, 45, 6], // clear octant 000
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
      const bits = encode(lat, lon, levels);
      const decoded = decode(bits);
      expect(decoded.levels).toBe(levels);
      expect(bits.slice(1, 4)).toBe(octantForLatLon(lat, lon));
      const dLat = Math.abs(decoded.lat - lat);
      const dLon = Math.abs(normalizeLon(decoded.lon - lon));
      const span = 180 / 2 ** Math.max(levels - 1, 1);
      expect(dLat).toBeLessThan(span);
      expect(dLon).toBeLessThan(span * 2);
    });
  }

  it("re-encoding the decoded centroid recovers the same bits", () => {
    const bits = encode(45, 45, 8);
    const { lat, lon, levels } = decode(bits);
    expect(encode(lat, lon, levels)).toBe(bits);
  });
});

describe("decode validation", () => {
  it("rejects reserved bit 1", () => {
    expect(() => decode("1000")).toThrow(/reserved/);
  });

  it("rejects non-binary", () => {
    expect(() => decode("000x")).toThrow();
  });
});
