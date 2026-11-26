/**
 * The arithmetic of a measurement: a distance, the area of a polygon in space
 * and an angle, and the text a person reads for each. No drawing happens here.
 */

import { Vector3 } from 'three';

export type MeasureMode = 'length' | 'area' | 'angle';

/** The length of a measurement as a person reads it: metres, to the centimetre. */
export function distanceText(from: Vector3, to: Vector3): string {
  return `${from.distanceTo(to).toFixed(2)} m`;
}

/** The area of a flat polygon in space, whatever way it faces (Newell's method). */
export function polygonArea(points: readonly Vector3[]): number {
  if (points.length < 3) return 0;
  const normal = new Vector3();
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    normal.x += (point.y - next.y) * (point.z + next.z);
    normal.y += (point.z - next.z) * (point.x + next.x);
    normal.z += (point.x - next.x) * (point.y + next.y);
  });
  return normal.length() / 2;
}

/** The angle at `corner` between the lines to `a` and to `b`, in degrees. */
export function angleAt(a: Vector3, corner: Vector3, b: Vector3): number {
  const one = a.clone().sub(corner);
  const two = b.clone().sub(corner);
  if (one.lengthSq() === 0 || two.lengthSq() === 0) return 0;
  return (one.angleTo(two) * 180) / Math.PI;
}

/** How many points complete a measurement in each mode. An area is completed by closing it. */
export const NEEDED: Record<MeasureMode, number> = {
  length: 2,
  angle: 3,
  area: Number.POSITIVE_INFINITY,
};

/** What a measurement says, or null while it has too few points to say anything. */
export function measureText(mode: MeasureMode, points: readonly Vector3[]): string | null {
  if (mode === 'length') return points.length === 2 ? distanceText(points[0], points[1]) : null;
  if (mode === 'angle') {
    return points.length === 3 ? `${angleAt(points[0], points[1], points[2]).toFixed(1)}°` : null;
  }
  return points.length >= 3 ? `${polygonArea(points).toFixed(2)} m²` : null;
}
