import { bitLengthForLevels } from "../src/bits.ts";
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

console.log("level\tbits\tmax-error");

for (let level = 0; level <= 30; level++) {
  const verts = [tri.a, tri.b, tri.c].map((v) => vertexErrorMeters(tri, v));
  const maxMeters = Math.max(...verts);
  const bits = bitLengthForLevels(level);
  console.log(`${level}\t${bits}\t${formatMeters(maxMeters)}`);
  tri = childAt(tri, 0);
}
