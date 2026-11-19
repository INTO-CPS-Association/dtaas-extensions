/**
 * Where the cuts of one loaded model run, which objects they leave and which
 * objects the floor, the lid and the hand hide.
 *
 * Owned by `SceneView`. `applyVisibility` is still the one place `visible` is
 * written and it is called only from there.
 */

import { Box3, type Mesh, Plane, Vector3 } from 'three';

import { bandOf, FLOOR_MARGIN_M, type Band } from '../storeys.js';
import { CUT_M } from './field.js';
import type { ViewState } from './viewState.js';

/** Roofs, slabs and ceilings: the lid that stops a floor being seen into. */
export const LIDS = new Set(['IfcSlab', 'IfcRoof', 'IfcCovering']);

/** How far above a storey's floor a lid has to be before it counts as the lid of that floor instead of its floor. A slab's thickness puts its base slightly above the level it defines. */
const LID_MARGIN_M = 0.5;

/** What the cuts read of the model they cut. */
export interface CutModel {
  readonly meshes: ReadonlyMap<string, Mesh>;
  readonly bands: Band[];
  /** The lowest point of each object, measured once. */
  readonly base: ReadonlyMap<string, number>;
  /** The middle of the model, where a vertical cut starts. */
  readonly middle: Vector3;
  state(): ViewState;
}

/** Whether a lid is shown on `band` while lids are hidden: only the lid above comes off. */
function lidShown(mesh: Mesh, band: Band | undefined, box: Box3): boolean {
  // Hiding every slab takes the floor as well, which leaves the furniture
  // standing on nothing.
  if (!band) return false;
  box.setFromObject(mesh);
  return !(box.min.y > band.from + LID_MARGIN_M);
}

/**
 * Write `visible` on every object.
 *
 * Three things hide an object and they have to agree: the chosen floor, the lid toggle, and anything hidden by hand. Each writing separately meant the floor filter could bring back a slab the lid toggle had just removed.
 */
export function applyVisibility(model: CutModel, hiddenByHand: readonly string[]): void {
  const state = model.state();
  const band = state.storey ? bandOf(model.bands, state.storey) : undefined;
  const box = new Box3();
  for (const [globalId, mesh] of model.meshes) {
    let visible = true;
    if (band) {
      box.setFromObject(mesh);
      visible = box.max.y > band.from && box.min.y < band.to;
    }
    const ifcClass = mesh.userData.ifcClass as string | undefined;
    if (visible && state.slabsHidden && ifcClass && LIDS.has(ifcClass)) {
      visible = lidShown(mesh, band, box);
    }
    if (visible && hiddenByHand.includes(globalId)) visible = false;
    // Isolating shows the one object whatever the floor and the lid say,
    // since a person who asked to see it alone asked to see it.
    if (state.isolated !== null) visible = globalId === state.isolated;
    mesh.visible = visible;
  }
}

export class SceneCuts {
  /** The lowest base of the walls in `band`, or in the whole model, measured once per band. */
  private readonly wallBases = new Map<Band | undefined, number | undefined>();

  /** The box around each object, measured once, since the objects do not move. */
  private readonly boxes = new Map<string, Box3>();

  /** Reused for every corner `isShown` tests, so a frame allocates nothing. */
  private readonly corner = new Vector3();

  private cutKey = '';

  private cuts: Plane[] = [];

  constructor(private readonly model: CutModel) {}

  /** The band of the chosen floor, or the lowest one when none is chosen. */
  private floorBand(): Band | undefined {
    const { storey } = this.model.state();
    const band = storey ? bandOf(this.model.bands, storey) : undefined;
    return band ?? this.model.bands[0];
  }

  /**
   * Where the section cuts, in metres, or null when it is off.
   *
   * At chest height above the floor in view, the same height the heatmap's
   * plan is cut at (`field.ts`), so a doorway reads as a gap and a desk does
   * not, and the section and the plan show the same rooms. With no floor
   * chosen it cuts the lowest one, since a cut through the whole building at
   * one height says nothing about the floors above it.
   */
  cutHeight(): number | null {
    const { sectioned, heightShift } = this.model.state();
    if (!sectioned) return null;
    const floor = this.floorBand();
    if (floor) return floor.from + CUT_M + heightShift;
    // A model without storeys is cut above the lowest wall, since walls stand
    // on the floor. The lowest object is often the terrain or a foundation a
    // metre down, and a cut above that shows only the stubs of the walls.
    const lowest = this.lowestWall() ?? this.lowestBase();
    return lowest === undefined ? null : lowest + CUT_M + heightShift;
  }

  private lowestWall(band?: Band): number | undefined {
    if (this.wallBases.has(band)) return this.wallBases.get(band);
    // A loop and not Math.min over a spread array, which overflows the call
    // stack on a model of a few hundred thousand objects.
    let lowest: number | undefined;
    for (const [globalId, base] of this.model.base) {
      if (band && !(base >= band.from && base < band.to)) continue;
      const ifcClass = String(this.model.meshes.get(globalId)?.userData.ifcClass ?? '');
      if (!ifcClass.startsWith('IfcWall')) continue;
      if (lowest === undefined || base < lowest) lowest = base;
    }
    this.wallBases.set(band, lowest);
    return lowest;
  }

  /** The lowest base of any object, or undefined for an empty model. */
  private lowestBase(): number | undefined {
    let lowest: number | undefined;
    for (const base of this.model.base.values()) {
      if (lowest === undefined || base < lowest) lowest = base;
    }
    return lowest;
  }

  /**
   * The height of the floor in view, where a person stands and the heat
   * sheet lies: the base of the lowest wall on the chosen floor, or on the
   * lowest floor when none is chosen.
   *
   * The walls and not the floor band, because a band starts below its own
   * floor slab: on an upper floor the band's edge is the underside of the
   * slab, and a sheet laid there was hidden inside it.
   */
  floorLevel(): number {
    const floor = this.floorBand();
    const wall = this.lowestWall(floor);
    if (wall !== undefined) return wall;
    if (floor) return floor.from + FLOOR_MARGIN_M;
    return this.lowestBase() ?? 0;
  }

  /**
   * Every cut in force, as planes that keep what is on their positive side.
   *
   * The horizontal one keeps what is below it and the vertical one what is
   * on the near side of the middle of the model, so a cut along X shows the
   * building as a long section and one along Z as a cross section.
   */
  cutPlanes(): Plane[] {
    const height = this.cutHeight();
    const { vertical, depthShift } = this.model.state();
    const { middle } = this.model;
    // Asked for on every frame and again for every marker, so the planes are
    // built again only when a cut actually changes.
    const key = `${height}|${vertical}|${depthShift}`;
    if (key === this.cutKey) return this.cuts;
    const planes: Plane[] = [];
    if (height !== null) planes.push(new Plane(new Vector3(0, -1, 0), height));
    if (vertical === 'x') planes.push(new Plane(new Vector3(-1, 0, 0), middle.x + depthShift));
    if (vertical === 'z') planes.push(new Plane(new Vector3(0, 0, -1), middle.z + depthShift));
    this.cutKey = key;
    this.cuts = planes;
    return planes;
  }

  /**
   * Whether an object is drawn: visible and, when a cut is in force, with some
   * part of it on the kept side. A wall the plan cut runs through is still
   * drawn up to the cut, so its sensor stays. A sensor on an object a cut took
   * away entirely is not labelled over the empty space where it was.
   */
  isShown(globalId: string): boolean {
    const mesh = this.model.meshes.get(globalId);
    if (!mesh) return true;
    if (!mesh.visible) return false;
    const planes = this.cutPlanes();
    if (planes.length === 0) return true;
    const { min, max } = this.boxOf(globalId, mesh);
    // The corner of the box farthest along each plane's normal is the one
    // most on the kept side. If even that one is beyond the plane, all of it is.
    return planes.every((plane) => {
      const { x, y, z } = plane.normal;
      this.corner.set(x >= 0 ? max.x : min.x, y >= 0 ? max.y : min.y, z >= 0 ? max.z : min.z);
      return plane.distanceToPoint(this.corner) >= 0;
    });
  }

  private boxOf(globalId: string, mesh: Mesh): Box3 {
    let box = this.boxes.get(globalId);
    if (!box) {
      box = new Box3().setFromObject(mesh);
      this.boxes.set(globalId, box);
    }
    return box;
  }

  /** Whether a point is on the kept side of every cut, so a click there lands on something drawn. */
  keeps(point: Vector3): boolean {
    return this.cutPlanes().every((plane) => plane.distanceToPoint(point) >= 0);
  }
}
