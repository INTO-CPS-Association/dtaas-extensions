/**
 * Holding the state of one loaded model, and applying it to the scene.
 *
 * Two invariants make everything else possible, and both were bought with bugs. `materialFor` is the only thing that decides what an object is painted with, and `refreshVisibility` is the only thing that writes `visible`. When several places wrote either one, the last to run won, and which ran last depended on the order readings arrived.
 *
 * This owns no canvas, no camera and no renderer. It takes a group of meshes and answers what each should look like, so it can be driven by React, by plain JavaScript, or by a test. The decisions live beside it: the paint in `scenePaint.ts`, the heatmap in `sceneHeat.ts`, the cuts and the visibility in `sceneCuts.ts`.
 */

import type { Group, Mesh, Plane, Vector3 } from 'three';

import type { Binding } from '../binding.js';
import type { HeatScope, Zones } from '../readings.js';
import type { Band } from '../storeys.js';
import { Palette } from './appearance.js';
import type { Field } from './field.js';
import type { Glow } from './glow.js';
import type { TreeEntry } from './modelTree.js';
import { applyVisibility, SceneCuts, type CutModel } from './sceneCuts.js';
import { bandsOf, entriesOf, measureModel, sizeOfMesh } from './sceneFacts.js';
import { liveCount, SceneHeat } from './sceneHeat.js';
import { ScenePainter } from './scenePaint.js';
import {
  CUT_STEP_M,
  initialViewState,
  resetViewState,
  type ObjectFacts,
  type PropertyTree,
  type ViewState,
} from './viewState.js';

export {
  BACKDROPS,
  CUT_STEP_M,
  type Backdrop,
  type ObjectFacts,
  type PropertyTree,
  type ViewState,
} from './viewState.js';

export class SceneView {
  readonly meshes = new Map<string, Mesh>();
  readonly bands: Band[];
  state: ViewState = initialViewState();

  /** Counts the repaints, so the canvas knows a still frame has to be drawn again. */
  materialsRevision = 0;

  /**
   * Counts the changes of visibility, so the canvas redraws the shadows,
   * which depend on what is shown and on nothing else, only when it moves.
   */
  visibilityRevision = 0;

  private readonly palette = new Palette();
  private readonly base = new Map<string, number>();
  private readonly hiddenByHand: string[] = [];
  private readonly heat: SceneHeat;
  private readonly cuts: SceneCuts;
  private readonly cutModel: CutModel;
  private readonly painter: ScenePainter;
  private glow: Glow | null = null;
  private storeyNames: string[] | null = null;

  constructor(
    model: Group,
    private readonly tree: PropertyTree = {},
  ) {
    const middle = measureModel(model, this.meshes, this.base, this.palette);
    this.bands = bandsOf(tree, this.base);
    const state = () => this.state;
    const { meshes, bands, base, palette } = this;
    const heat = new SceneHeat({ meshes, bands, state, factsOf: (id) => this.factsOf(id) });
    this.heat = heat;
    this.cutModel = { meshes, bands, base, middle, state };
    this.cuts = new SceneCuts(this.cutModel);
    this.painter = new ScenePainter({ meshes, palette, heat, state });
  }

  /** The floors a person can choose, one entry per distinct band. */
  get storeys(): string[] {
    // The same array every time, so a component that keys a memo on it does
    // not redo its work on every render.
    this.storeyNames ??= this.bands.map((band) => band.names[0]);
    return this.storeyNames;
  }

  /** The zone averages in force, for anything drawing the field beside the model. */
  get heatZones(): Zones | null {
    return this.heat.zones;
  }

  /** The grid saying which sensor's walk reaches each point of the floor. */
  get field(): Field | null {
    return this.heat.field;
  }

  /** The GlobalId behind each index in the field, in the order it was fed. */
  get fieldSources(): string[] {
    return this.heat.fieldSources;
  }

  /** How many objects of each class the model holds. */
  classCounts(): Map<string, number> {
    return this.painter.classCounts();
  }

  /** The colour the model gives each class of object, for a legend to state. */
  classColours(): Map<string, string> {
    return this.painter.classColours();
  }

  /** Every object as the model tree lists it. */
  entries(): TreeEntry[] {
    const { meshes, bands, base } = this;
    return entriesOf({ meshes, bands, base, factsOf: (id) => this.factsOf(id) });
  }

  factsOf(globalId: string): ObjectFacts | undefined {
    return this.tree.objects?.[globalId];
  }

  /** How large an object is, in metres, along each world axis. See `sizeOfMesh`. */
  sizeOf(globalId: string): { x: number; y: number; z: number } | undefined {
    return sizeOfMesh(this.meshes.get(globalId));
  }

  /** The heat scopes worth offering for a set of bindings. */
  scopesFor(bindings: Binding[]): HeatScope[] {
    return this.heat.scopesFor(bindings);
  }

  /** Take in the readings and work out the zone averages, without repainting. */
  applyReadings(...args: Parameters<SceneHeat['applyReadings']>): void {
    this.heat.applyReadings(...args);
  }

  /** Which zone an object is in, at a scope. */
  zoneFor(globalId: string, scope?: HeatScope): string | undefined {
    return this.heat.zoneFor(globalId, scope);
  }

  /** The zone one cell of the field belongs to, or undefined where none reaches. */
  zoneAtCell(index: number): string | undefined {
    return this.heat.zoneAtCell(index);
  }

  /** Rasterise the floor and flood it from the sensors. */
  buildField(bindings: Binding[]): void {
    this.heat.buildField(bindings);
  }

  /**
   * Lend this view a halo to put around the selected object. The halo lives
   * in the scene, which belongs to whatever draws, and this decides when it is on.
   */
  attachGlow(glow: Glow | null): void {
    this.glow = glow;
    this.refreshMaterials();
  }

  /** Paint everything. Called by anything that changes appearance. */
  refreshMaterials(): void {
    this.materialsRevision += 1;
    this.painter.paint(this.glow);
  }

  /** The one place `visible` is written. See `applyVisibility`. */
  refreshVisibility(): void {
    this.visibilityRevision += 1;
    applyVisibility(this.cutModel, this.hiddenByHand);
  }

  /** Where the section cuts, in metres, or null when it is off. */
  cutHeight(): number | null {
    return this.cuts.cutHeight();
  }

  /** The height of the floor in view, where a person stands and the heat sheet lies. */
  floorLevel(): number {
    return this.cuts.floorLevel();
  }

  /** Every cut in force, as planes that keep what is on their positive side. */
  cutPlanes(): Plane[] {
    return this.cuts.cutPlanes();
  }

  /** Whether an object is drawn: visible and not cut away entirely. */
  isShown(globalId: string): boolean {
    return this.cuts.isShown(globalId);
  }

  /** Whether a point is on the kept side of every cut, so a click there lands on something drawn. */
  keeps(point: Vector3): boolean {
    return this.cuts.keeps(point);
  }

  /** Move the vertical cut when there is one, the horizontal one otherwise, by `steps` steps. */
  shiftCut(steps: number): void {
    if (this.state.vertical !== null) this.state.depthShift += steps * CUT_STEP_M;
    else if (this.state.sectioned) this.state.heightShift += steps * CUT_STEP_M;
  }

  /** Show the selected object alone, or everything again. Does nothing with neither. */
  toggleIsolation(): void {
    this.state.isolated = this.state.isolated === null ? this.state.selected : null;
    this.refreshVisibility();
  }

  /** Both, for the common case of a state change that affects both. */
  refresh(): void {
    this.refreshVisibility();
    this.refreshMaterials();
  }

  /** Hide one object, so a person can look past it. */
  hide(globalId: string): void {
    if (!this.meshes.has(globalId) || this.hiddenByHand.includes(globalId)) return;
    this.hiddenByHand.push(globalId);
    this.refreshVisibility();
  }

  /** Bring back the last object hidden, so they come back in the order they went. */
  restoreLastHidden(): void {
    if (this.hiddenByHand.pop()) this.refreshVisibility();
  }

  /** Undo every toggle, so a model reads as it did when it opened. */
  reset(): void {
    this.hiddenByHand.length = 0;
    this.state = resetViewState(this.state);
    this.heat.zones = null;
    this.refresh();
  }

  /** Which sensors are currently worth colouring by, for a legend to state. */
  liveCount(...args: Parameters<typeof liveCount>): number {
    return liveCount(...args);
  }

  dispose(): void {
    this.palette.dispose();
    this.meshes.clear();
  }
}
