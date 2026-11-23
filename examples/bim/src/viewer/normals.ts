/**
 * Normals for a converted model that carries none. A GLB written by
 * `ifc_explorer.to_glb` stores positions only, and a lit material draws a
 * surface without normals in black, so the model reads as a solid shadow.
 */

import type { BufferGeometry, Object3D } from 'three';

/** Give every mesh of `root` that has none smooth normals. Returns how many meshes got them. */
export function addMissingNormals(root: Object3D): number {
  let added = 0;
  root.traverse((node) => {
    const geometry = (node as { geometry?: BufferGeometry }).geometry;
    if (!geometry?.getAttribute?.('position') || geometry.getAttribute('normal')) return;
    geometry.computeVertexNormals();
    added += 1;
  });
  return added;
}
