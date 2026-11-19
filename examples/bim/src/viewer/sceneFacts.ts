/**
 * What a loaded model says about its objects: the list the model tree shows
 * and the size of one object. Measured from the geometry and read from the
 * property tree, without changing either.
 */

import { Box3, type Mesh, type Object3D, Vector3 } from 'three';

import { bandsFrom, type Band } from '../storeys.js';
import type { Palette } from './appearance.js';
import type { TreeEntry } from './modelTree.js';
import type { ObjectFacts, PropertyTree } from './viewState.js';

/**
 * Find every object of a model by its GlobalId, remember its colour and its
 * base and return the middle of the model, where a vertical cut starts.
 */
export function measureModel(
  model: Object3D,
  meshes: Map<string, Mesh>,
  base: Map<string, number>,
  palette: Palette,
): Vector3 {
  const box = new Box3();
  model.traverse((node: Object3D) => {
    const mesh = node as Mesh & { isMesh?: boolean };
    const globalId = mesh.isMesh ? (mesh.userData.globalId as string | undefined) : undefined;
    if (!globalId) return;
    meshes.set(globalId, mesh);
    palette.remember(globalId, mesh);
    box.setFromObject(mesh);
    if (Number.isFinite(box.min.y)) base.set(globalId, box.min.y);
  });
  const middle = new Vector3();
  const whole = new Box3().setFromObject(model);
  if (!whole.isEmpty()) whole.getCenter(middle);
  return middle;
}

/** The floors of a model, from the storeys its tree names and the bases of their objects. */
export function bandsOf(tree: PropertyTree, base: ReadonlyMap<string, number>): Band[] {
  return bandsFrom(
    (tree.storeys ?? []).map((storey) => storey.name),
    [...base].flatMap(([globalId, at]) => {
      const storey = tree.objects?.[globalId]?.storey;
      return storey ? [{ storey, base: at }] : [];
    }),
  );
}

/** What the list reads of a model. */
export interface FactsModel {
  readonly meshes: ReadonlyMap<string, Mesh>;
  readonly bands: readonly Band[];
  readonly base: ReadonlyMap<string, number>;
  factsOf(globalId: string): ObjectFacts | undefined;
}

/** Every property value of an object, as text, for the search. */
function valuesOf(facts: ObjectFacts | undefined): string[] {
  return Object.values(facts?.properties ?? {})
    .flatMap((set) => Object.values(set ?? {}))
    .map((value) => String(value));
}

/**
 * Every object as the model tree lists it: its name and class from the
 * property tree when it has one, from the geometry otherwise, and the floor
 * its band puts it on.
 */
export function entriesOf(model: FactsModel): TreeEntry[] {
  return [...model.meshes].map(([globalId, mesh]) => {
    const facts = model.factsOf(globalId);
    const ifcClass =
      facts?.ifcClass ?? (mesh.userData.ifcClass as string | undefined) ?? 'IfcProduct';
    const base = model.base.get(globalId);
    const band =
      base === undefined ? undefined : model.bands.find((b) => base >= b.from && base < b.to);
    return {
      globalId,
      name: facts?.name ?? (mesh.name || globalId),
      ifcClass,
      storey: facts?.storey ?? band?.names[0] ?? null,
      values: valuesOf(facts),
    };
  });
}

/**
 * How large an object is, in metres, along each world axis.
 *
 * Measured from the geometry instead of read from the tree, because the
 * tree does not carry it and because the number a person wants when they
 * click a wall is the wall in front of them. Y is the height, since the
 * scene is Y up.
 *
 * The box is axis aligned, so a wall running at forty five degrees reports
 * the box around it instead of its length. That is a real limitation and
 * the reason this is labelled as a size instead of as dimensions.
 */
export function sizeOfMesh(
  mesh: Mesh | undefined,
): { x: number; y: number; z: number } | undefined {
  if (!mesh) return undefined;
  const box = new Box3().setFromObject(mesh);
  if (box.isEmpty()) return undefined;
  const size = box.getSize(new Vector3());
  return { x: size.x, y: size.y, z: size.z };
}

/**
 * A size in metres, or in millimetres when metres would read as zero.
 *
 * A door handle 40 mm across is "0.0 m" at one decimal, which says nothing.
 * Switching unit under a threshold keeps every object legible without giving
 * a wall a precision the model does not have.
 */
export function sizeText(size: { x: number; y: number; z: number }): string {
  const parts = [size.x, size.y, size.z];
  if (Math.max(...parts) < 0.5) {
    return `${parts.map((n) => Math.round(n * 1000)).join(' × ')} mm`;
  }
  return `${parts.map((n) => n.toFixed(2)).join(' × ')} m`;
}
