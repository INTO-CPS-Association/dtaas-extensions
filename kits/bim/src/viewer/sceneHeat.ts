/**
 * The heatmap of one loaded model: the zone averages of the readings and the
 * field that says which sensor's walk reaches each point of the floor.
 *
 * Owned by `SceneView`, which asks it for the colour of an object. It owns no
 * material and writes nothing to the scene.
 */

import { Box3, type Mesh, Vector3 } from 'three';

import { displayOf, objectOf, type Binding } from '../binding.js';
import {
  DEFAULT_STALE_AFTER_S,
  availableScopes,
  isLive,
  zoneOf,
  zonesOf,
  type FeedState,
  type HeatScope,
  type Reading,
  type Zones,
} from '../readings.js';
import { bandOf, type Band } from '../storeys.js';
import { buildField, sourceAt, type Field } from './field.js';
import type { ObjectFacts, ViewState } from './viewState.js';

/** What the heatmap reads of the model it colours. */
export interface HeatModel {
  readonly meshes: ReadonlyMap<string, Mesh>;
  readonly bands: Band[];
  factsOf(globalId: string): ObjectFacts | undefined;
  /** The state in force. A function, since a reset replaces the state object. */
  state(): ViewState;
}

export class SceneHeat {
  /** The zone averages in force, or null while the heatmap colours nothing. */
  zones: Zones | null = null;

  /** The grid saying which sensor's walk reaches each point of the floor. */
  field: Field | null = null;

  /** The GlobalId behind each index in the field, in the order it was fed. */
  fieldSources: string[] = [];

  /** The bindings the field was built from, so it is rebuilt only when they change. */
  private fieldKey = '';

  constructor(private readonly model: HeatModel) {}

  /**
   * The heat scopes worth offering for a set of bindings.
   *
   * Asked of the readings instead of of the model, because a model that
   * declares ten storeys and carries sensors on one of them can be grouped
   * by storey and gains nothing from it.
   */
  scopesFor(bindings: Binding[]): HeatScope[] {
    this.buildField(bindings);
    return availableScopes(bindings, (globalId, scope) => this.zoneFor(globalId, scope));
  }

  /** Take in the readings and work out the zone averages. */
  applyReadings(
    bindings: Binding[],
    readings: Map<string, Reading>,
    feed: FeedState,
    staleAfter = DEFAULT_STALE_AFTER_S,
    now = Date.now(),
  ): void {
    this.buildField(bindings);
    const scope = this.model.state().heat;
    const zoneFor = (globalId: string) => this.zoneFor(globalId);
    this.zones = zonesOf(bindings, readings, scope, zoneFor, feed, staleAfter, now);
  }

  /**
   * Which zone an object is in, at a scope.
   *
   * The three groupings a model can answer ask it which room or storey the
   * object is in. Per Sensor asks where the object is on the plan and which
   * sensor's walk reaches that point, which is the only one of the four that
   * says anything on a model with no rooms and one storey.
   */
  zoneFor(globalId: string, scope: HeatScope = this.model.state().heat): string | undefined {
    if (scope !== 'sensor') return zoneOf(scope, this.model.factsOf(globalId));
    if (this.field === null) return undefined;
    const mesh = this.model.meshes.get(globalId);
    if (!mesh) return undefined;
    const at = new Box3().setFromObject(mesh).getCenter(new Vector3());
    const index = sourceAt(this.field, at.x, at.z);
    return index < 0 ? undefined : this.fieldSources[index];
  }

  /** The zone one cell of the field belongs to, or undefined where none reaches. */
  zoneAtCell(index: number): string | undefined {
    if (this.field === null) return undefined;
    const source = this.field.owner[index];
    return source < 0 ? undefined : this.fieldSources[source];
  }

  /**
   * Rasterise the floor and flood it from the sensors.
   *
   * Rebuilt when the bindings change, which is when the sources move, and left
   * alone otherwise: the objects do not move and neither do the sensors.
   */
  buildField(bindings: Binding[]): void {
    // The storey is part of the key, not only the bindings. The cut runs
    // 1.2 m above the floor of the storey in force, and the cut is what
    // decides which objects are walls, so a field built for the ground floor
    // describes the ground floor and nothing else. Leaving it out is why the
    // heatmap only ever worked on the first level.
    const { storey } = this.model.state();
    const key = [storey, ...bindings.map((b) => objectOf(b) ?? '')].join(',');
    if (key === this.fieldKey) return;
    this.fieldKey = key;
    this.fieldSources = [];
    this.field = null;
    if (bindings.length === 0) return;
    // The lowest band is the floor a single storey model has, and the chosen
    // one otherwise. The cut has to be inside the storey being drawn.
    const band = storey ? bandOf(this.model.bands, storey) : undefined;
    const floor = band ?? this.model.bands[0];
    const sources = this.sourcesOn(bindings, band);
    this.field = buildField(this.model.meshes.values(), sources, floor ? floor.from : 0);
  }

  /** The centre of every bound object on the floor in view, remembered as a source. */
  private sourcesOn(bindings: Binding[], band: Band | undefined): Vector3[] {
    const box = new Box3();
    const sources: Vector3[] = [];
    for (const binding of bindings) {
      const globalId = objectOf(binding);
      const mesh = globalId === undefined ? undefined : this.model.meshes.get(globalId);
      if (!mesh || globalId === undefined) continue;
      const at = box.setFromObject(mesh).getCenter(new Vector3());
      // A sensor on the ground floor says nothing about the floor above it.
      // Without this, every sensor in the building was flooded onto whichever
      // plan was on screen, so the second storey showed the first one's heat.
      // With no floor chosen the whole building is on screen at once, and
      // every sensor belongs to what is drawn.
      if (band && (at.y <= band.from || at.y >= band.to)) continue;
      sources.push(at);
      this.fieldSources.push(globalId);
    }
    return sources;
  }

  /** The mean of the zone an object is in, or undefined when none is known. */
  meanOf(globalId: string): number | undefined {
    if (!this.zones) return undefined;
    const zone = this.zoneFor(globalId);
    return zone === undefined ? undefined : this.zones.meanByZone.get(zone);
  }
}

/** Which sensors are currently worth colouring by, for a legend to state. */
export function liveCount(
  bindings: Binding[],
  readings: Map<string, Reading>,
  feed: FeedState,
  staleAfter = DEFAULT_STALE_AFTER_S,
  now = Date.now(),
): number {
  return bindings.filter((binding) => {
    const globalId = objectOf(binding);
    return (
      globalId !== undefined &&
      isLive(readings.get(globalId), feed, staleAfter, now) &&
      displayOf(binding).ramp !== undefined
    );
  }).length;
}
