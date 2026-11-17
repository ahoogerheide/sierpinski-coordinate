import type { Vec3 } from "./vec3.ts";
import { normalize } from "./vec3.ts";

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** Normalize longitude to (-180, 180]. */
export function normalizeLon(lonDeg: number): number {
  let x = lonDeg;
  while (x <= -180) x += 360;
  while (x > 180) x -= 360;
  return x;
}

/** Clamp latitude to [-90, 90]. */
export function clampLat(latDeg: number): number {
  if (latDeg > 90) return 90;
  if (latDeg < -90) return -90;
  return latDeg;
}

export function latLonToVec(latDeg: number, lonDeg: number): Vec3 {
  const lat = clampLat(latDeg) * DEG;
  const lon = normalizeLon(lonDeg) * DEG;
  const cosLat = Math.cos(lat);
  return [cosLat * Math.cos(lon), cosLat * Math.sin(lon), Math.sin(lat)];
}

export function vecToLatLon(v: Vec3): { lat: number; lon: number } {
  const n = normalize(v);
  const lat = Math.asin(Math.min(1, Math.max(-1, n[2]))) * RAD;
  const lon = Math.atan2(n[1], n[0]) * RAD;
  return { lat, lon: normalizeLon(lon) };
}
