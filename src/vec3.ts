/** Unit-sphere 3D helpers. */

export type Vec3 = readonly [number, number, number];

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len === 0) {
    throw new Error("Cannot normalize zero vector");
  }
  return [v[0] / len, v[1] / len, v[2] / len];
}

/** Great-circle midpoint of two unit vectors. */
export function midpoint(a: Vec3, b: Vec3): Vec3 {
  return normalize(add(a, b));
}
