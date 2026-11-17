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

// Level 0 worst locations are the three octant corners; they tie.
// Follow the north-pole corner. Child 0 keeps that vertex.
let tri = OCTANT_TRIANGLES[0];
const location = tri.a;

const rows = [];
for (let level = 0; level <= 32; level++) {
  const meters = vertexErrorMeters(tri, location);
  const verts = [tri.a, tri.b, tri.c].map((v) => vertexErrorMeters(tri, v));
  rows.push({
    level,
    meters,
    cellMaxMeters: Math.max(...verts),
  });
  if (level < 32) tri = childAt(tri, 0);
}

for (const row of rows) {
  console.log(
    `${row.level}\t${row.meters.toExponential(10)}\t${row.cellMaxMeters.toExponential(10)}`,
  );
}
