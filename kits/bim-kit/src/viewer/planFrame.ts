/**
 * The frame of a plan: points turned between the world and a grid that
 * follows the building, and the shapes of walls read from their vertices.
 * The field rasterises a floor in this frame, so a wall at an angle to the
 * world axes still lies along the rows of the grid.
 */

import { Box3, Vector3, type Mesh } from 'three';

/** A world point in the grid's frame: turned by `-angle` about the vertical. */
export function toGrid(angle: number, x: number, z: number): [number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos + z * sin, -x * sin + z * cos];
}

/** A point of the grid's frame back in the world: the inverse of `toGrid`. */
export function fromGrid(angle: number, u: number, v: number): [number, number] {
  return toGrid(-angle, u, v);
}

/** The world positions of a mesh's vertices, flattened onto the plan as [x, z] pairs. */
export function planPoints(mesh: Mesh): number[] {
  const position = mesh.geometry.getAttribute('position');
  const point = new Vector3();
  const out: number[] = [];
  for (let i = 0; i < position.count; i += 1) {
    point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    out.push(point.x, point.z);
  }
  return out;
}

/**
 * The main axis of one wall on the plan and how elongated the wall is.
 *
 * The axis comes from the spread of the wall's vertices. The spread is the
 * difference between the long and the short side, so a square column, which
 * points nowhere, gets none.
 */
export function wallAxis(points: number[]): { theta: number; spread: number } | null {
  const n = points.length / 2;
  if (n < 2) return null;
  let meanX = 0;
  let meanZ = 0;
  for (let i = 0; i < points.length; i += 2) {
    meanX += points[i] / n;
    meanZ += points[i + 1] / n;
  }
  let xx = 0;
  let zz = 0;
  let xz = 0;
  for (let i = 0; i < points.length; i += 2) {
    const dx = points[i] - meanX;
    const dz = points[i + 1] - meanZ;
    xx += dx * dx;
    zz += dz * dz;
    xz += dx * dz;
  }
  return { theta: 0.5 * Math.atan2(2 * xz, xx - zz), spread: Math.hypot(xx - zz, 2 * xz) / n };
}

/** A mesh's box in the grid's frame, from its vertices, with the world heights. */
export function gridBox(mesh: Mesh, angle: number, out: Box3): Box3 {
  const world = new Box3().setFromObject(mesh);
  const p = planPoints(mesh);
  out.makeEmpty();
  for (let i = 0; i < p.length; i += 2) {
    const [u, v] = toGrid(angle, p[i], p[i + 1]);
    out.expandByPoint(new Vector3(u, 0, v));
  }
  out.min.y = world.min.y;
  out.max.y = world.max.y;
  return out;
}
