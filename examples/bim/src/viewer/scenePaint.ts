/**
 * The one decision about what an object of a loaded model is painted with,
 * and the colours a legend states for its classes.
 *
 * Owned by `SceneView`, which calls `paint` from `refreshMaterials` and
 * nowhere else, so two options can never undo each other.
 */

import type { Mesh } from 'three';

import { CLASS_COLOURS, SHELL, type Palette } from './appearance.js';
import { OUTSIDE } from './field.js';
import type { Glow } from './glow.js';
import { LIDS } from './sceneCuts.js';
import type { SceneHeat } from './sceneHeat.js';
import type { ViewState } from './viewState.js';

/** A class colour of the colour by class style, as CSS. */
const classHex = (index: number) =>
  `#${CLASS_COLOURS[index % CLASS_COLOURS.length].toString(16).padStart(6, '0')}`;

/** What the painter reads of the model it paints. */
export interface PaintModel {
  readonly meshes: ReadonlyMap<string, Mesh>;
  readonly palette: Palette;
  readonly heat: SceneHeat;
  state(): ViewState;
}

export class ScenePainter {
  /** The sorted classes of the model, so each keeps its colour in the colour by class style. */
  private classOrder: string[] | null = null;

  constructor(private readonly model: PaintModel) {}

  /** How many objects of each class the model holds. */
  classCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const mesh of this.model.meshes.values()) {
      const ifcClass = mesh.userData.ifcClass as string | undefined;
      if (ifcClass) counts.set(ifcClass, (counts.get(ifcClass) ?? 0) + 1);
    }
    return counts;
  }

  /**
   * The colour the model gives each class of object, for a legend to state.
   *
   * Read from the materials the model arrived with instead of from a table
   * here, because an architect assigned those colours and a legend that
   * invented its own would describe a different building.
   */
  classColours(): Map<string, string> {
    if (this.model.state().style === 'classes') {
      return new Map(this.classesSorted().map((ifcClass, index) => [ifcClass, classHex(index)]));
    }
    const seen = new Map<string, string>();
    for (const [globalId, mesh] of this.model.meshes) {
      const ifcClass = mesh.userData.ifcClass as string | undefined;
      if (!ifcClass || seen.has(ifcClass)) continue;
      const material = this.model.palette.baseOf(globalId);
      const colour = (Array.isArray(material) ? material[0] : material) as
        { color?: { getHexString: () => string } } | undefined;
      if (colour?.color) seen.set(ifcClass, `#${colour.color.getHexString()}`);
    }
    return new Map([...seen].sort(([a], [b]) => a.localeCompare(b)));
  }

  private classesSorted(): string[] {
    this.classOrder ??= [...this.classCounts().keys()].sort();
    return this.classOrder;
  }

  /** The colour a heatmap gives one object, or null when it gives none. Null covers three cases that must all leave the object in its own colour: the heatmap is off, no sensor covers the object's zone, and the readings have gone stale. A heatmap of stale values is a confident wrong answer. */
  private heatOf(globalId: string, ifcClass: string | undefined) {
    const { zones } = this.model.heat;
    if (!zones) return undefined;
    // The Building Mean painted the whole site, and Per Sensor painted it in
    // the colour of whichever sensor reached its centre.
    if (ifcClass && OUTSIDE.has(ifcClass)) return undefined;
    // Per Sensor colours an object by the sensor that reaches its centre. A
    // slab or a roof spans every room, so that would paint the whole floor as
    // one sensor's room. The field sheet shows the split over the floor.
    if (this.model.state().heat === 'sensor' && ifcClass && LIDS.has(ifcClass)) return undefined;
    const mean = this.model.heat.meanOf(globalId);
    return mean === undefined ? undefined : this.model.palette.heatOf(mean, zones.low, zones.high);
  }

  /** What an object is painted with in the style in force, before heat, highlight or ghost. */
  private styled(globalId: string, ifcClass: string | undefined) {
    const { palette } = this.model;
    const own = palette.baseOf(globalId);
    switch (this.model.state().style) {
      case 'mono':
        return palette.mono;
      case 'wireframe':
        return palette.wireOf(own);
      case 'classes':
        return palette.classAt(this.classesSorted().indexOf(String(ifcClass ?? '')));
      default:
        return own;
    }
  }

  /** The one decision about what an object is painted with. */
  materialFor(globalId: string, mesh: Mesh) {
    const state = this.model.state();
    const { palette } = this.model;
    if (globalId === state.selected) return palette.selected;
    // Only while hover highlighting is on. Reading a heatmap with a colour
    // following the cursor is unreadable.
    if (state.hoverHighlight && globalId === state.hovered) return palette.hovered;
    const ifcClass = mesh.userData.ifcClass as string | undefined;
    // Below the cursor and below the selection, so pointing at one object
    // still says which one, and above the heatmap, since a person who asked
    // where the walls are is asking that and not what temperature they are.
    if (state.highlightedClass && ifcClass === state.highlightedClass) return palette.highlighted;
    const base = this.heatOf(globalId, ifcClass) ?? this.styled(globalId, ifcClass);
    if (state.transparent && ifcClass && SHELL.has(ifcClass)) return palette.ghostOf(base);
    return base;
  }

  /** Paint every object and put the halo around the selection. */
  paint(glow: Glow | null): void {
    for (const [globalId, mesh] of this.model.meshes) {
      const material = this.materialFor(globalId, mesh);
      if (material) mesh.material = material;
    }
    if (glow === null) return;
    const { selected } = this.model.state();
    const mesh = selected === null ? undefined : this.model.meshes.get(selected);
    // A halo around an object the floor filter has hidden is a glow around
    // nothing, on a floor the object is not even on.
    if (mesh?.visible) glow.show(mesh);
    else glow.hide();
  }
}
