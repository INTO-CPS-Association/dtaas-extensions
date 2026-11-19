/**
 * Loading a converted model. A GLB written by `ifc_explorer.to_glb`, or by
 * the converter of this package, carries `globalId` in glTF `extras` on every
 * node, which three.js reads into `userData`.
 */

import type { Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** The scene of the GLB at `url`. Rejects when the file cannot be read as one. */
export async function loadGlb(url: string): Promise<Object3D> {
  const gltf = await new GLTFLoader().loadAsync(url);
  return gltf.scene;
}
