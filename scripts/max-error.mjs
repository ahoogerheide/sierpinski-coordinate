import { bitLengthForLevels } from "../src/bits.ts";
import { latLonToVec } from "../src/geo.ts";
import { OCTANT_TRIANGLES } from "../src/octants.ts";
import { centroid, childAt } from "../src/triangle.ts";
import { cross, dot } from "../src/vec3.ts";

/** WGS84 mean radius (2a + b) / 3, meters. */
const EARTH_RADIUS_M = 6_371_008.7714;

function angularDistance(a, b) {
  const c = cross(a, b);
  const sine = Math.hypot(c[0], c[1], c[2]);
  return Math.atan2(sine, dot(a, b));
}

function vertexErrorMeters(tri, vertex) {
  return angularDistance(centroid(tri), vertex) * EARTH_RADIUS_M;
}

function groundDistanceMeters(latA, lonA, latB, lonB) {
  return angularDistance(latLonToVec(latA, lonA), latLonToVec(latB, lonB)) * EARTH_RADIUS_M;
}

/**
 * Signed lat/lon grid with the same bit budget as a Sierpinski coordinate.
 * Each axis gets n = bits/2 bits, N = 2^n codes.
 * Latitude step is 180/N (span 180°). Longitude step is 360/N (span 360°).
 * Max is the equatorial cell corner. Average is a quarter-step offset at the
 * parallel where cos(lat) equals the area-weighted mean of cos(lat), π/4.
 */
function latLonErrorsMeters(bits) {
  const n = bits / 2;
  const count = 2 ** n;
  const stepLat = 180 / count;
  const stepLon = 360 / count;
  const maxMeters = groundDistanceMeters(0, 0, stepLat / 2, stepLon / 2);
  const avgLat = Math.acos(Math.PI / 4) * (180 / Math.PI);
  const avgMeters = groundDistanceMeters(avgLat, 0, avgLat + stepLat / 4, stepLon / 4);
  return { maxMeters, avgMeters };
}

/** Below 100 m, three significant digits. At 100 m and above, whole meters. */
function formatMeters(meters) {
  if (meters < 100) {
    return `${Number(meters.toPrecision(3))} m`;
  }
  return `${Math.round(meters).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} m`;
}

// Level 0 worst locations are the three octant corners; they tie.
// Follow the north-pole corner. Child 0 keeps that vertex.
let tri = OCTANT_TRIANGLES[0];

console.log("level\tbits\tmax-error\tlatlon-max\tlatlon-avg");

for (let level = 0; level <= 30; level++) {
  const verts = [tri.a, tri.b, tri.c].map((v) => vertexErrorMeters(tri, v));
  const maxMeters = Math.max(...verts);
  const bits = bitLengthForLevels(level);
  const latLon = latLonErrorsMeters(bits);
  console.log(
    `${level}\t${bits}\t${formatMeters(maxMeters)}\t${formatMeters(latLon.maxMeters)}\t${formatMeters(latLon.avgMeters)}`,
  );
  tri = childAt(tri, 0);
}
