/**
 * One mounted pane of the `aec` substrate: the building drawn by the shared
 * viewer of the Buildings page, a marker on every anchored object and the
 * controls around it. Loaded only when a pane draws a building, so three.js
 * stays out of the main bundle.
 */

import type { ComponentType, ReactNode } from 'react';
import { Color } from 'three';

import type { Binding } from '../binding.js';
import { loadGlb, Viewer, type MarkerHandle } from '../viewer/index.js';
import { MarkerColours } from './aecColours.js';
import { createControls, type Controls, type PaneRows } from './aecControls.js';
import { loadTree, treeAddress } from './aecModel.js';
import { followTheme } from './aecTheme.js';

/** One anchored sensor: its name, its binding and its marker. */
interface AnchorMarker {
  readonly name: string;
  readonly binding: Binding;
  readonly marker: MarkerHandle;
}

/** What one encoding asks of a marker. */
export interface Paint {
  /** The CSS colour of the value, with the rule that computed it. */
  colour?: { encoding: Parameters<MarkerColours['record']>[1]; value: string };
  text?: string;
  visible?: boolean;
}

/**
 * A binding for the marker of an anchor. The core colours an `aec` marker
 * from its encodings, so the binding carries no unit and no ramp of its own.
 */
function bindingOf(key: string, globalId: string, name: string): Binding {
  const source = { live: { transport: 'mqtt' as const, topic: key } };
  return {
    selector: { globalId },
    label: name,
    id: name,
    source,
    display: {} as Binding['display'],
  };
}

/** A CSS colour as a number, or null when the marker shows no colour. */
function hexOf(css: string | undefined): number | null {
  if (css === undefined) return null;
  const colour = new Color();
  colour.setStyle(css);
  return colour.getHex();
}

export class AecPane {
  private readonly viewer = new Viewer();
  private readonly anchors = new Map<string, AnchorMarker>();
  private readonly colours = new MarkerColours();
  private controls: Controls | null = null;
  private stopTheme: () => void = () => undefined;

  constructor(
    private readonly rows: PaneRows,
    private readonly Theme?: ComponentType<{ readonly children: ReactNode }>,
  ) {}

  /** Draw the converted model at `url` and the property tree beside it. */
  async load(url: string): Promise<void> {
    this.viewer.mount(this.rows.canvas, { onSelect: () => this.controls?.redraw() });
    const [model, tree] = await Promise.all([loadGlb(url), loadTree(treeAddress(url))]);
    const handle = this.viewer.show(model, { tree, from: 'top' });
    this.controls = createControls({
      rows: this.rows,
      handle,
      colours: this.colours,
      Theme: this.Theme,
      bindingOn: (globalId) => this.bindingOn(globalId),
      recolour: () => this.recolour(),
    });
    this.stopTheme = followTheme(this.rows.frame);
  }

  /** Put a marker on `globalId` for `key`. False when the model has no such object. */
  addAnchor(key: string, globalId: string, name: string): boolean {
    const mesh = this.viewer.handle?.view.meshes.get(globalId);
    const markers = this.viewer.markers;
    if (!mesh || !markers) {
      if (this.viewer.handle) this.controls?.reportMissing(name);
      return false;
    }
    if (this.anchors.has(key)) return true;
    const binding = bindingOf(key, globalId, name);
    const marker = markers.add(binding, mesh);
    marker.setText(name);
    this.anchors.set(key, { name, binding, marker });
    this.controls?.redraw();
    return true;
  }

  /** Apply what one encoding asks of the marker of `key`. */
  paint(key: string, { colour, text, visible }: Paint): void {
    const anchor = this.anchors.get(key);
    if (!anchor) return;
    // A new colour rule changes the legend and the heatmap's choices.
    if (colour && this.colours.record(key, colour.encoding, colour.value)) this.controls?.redraw();
    if (colour) anchor.marker.setColour(hexOf(this.colours.colourOf(key)));
    if (visible !== undefined) anchor.marker.setShown(visible);
    if (text !== undefined) anchor.marker.setText(`${anchor.name} ${text}`);
  }

  /** Fly to the object the marker of `key` sits on. */
  frame(key: string): void {
    const globalId = this.anchors.get(key)?.marker.globalId;
    if (globalId) this.viewer.frameObject(globalId);
  }

  /** The key of the marker on the object under a point of the page, or null. */
  pick(x: number, y: number): string | null {
    const globalId = this.viewer.objectAt(x, y);
    if (!globalId) return null;
    return [...this.anchors].find(([, a]) => a.marker.globalId === globalId)?.[0] ?? null;
  }

  /** The binding of the sensor anchored on an object, for the object panel. */
  private bindingOn(globalId: string): Binding | undefined {
    return [...this.anchors.values()].find((a) => a.marker.globalId === globalId)?.binding;
  }

  /** Paint every marker in the colour the heatmap option says it shows now. */
  private recolour(): void {
    for (const [key, { marker }] of this.anchors) {
      marker.setColour(hexOf(this.colours.colourOf(key)));
    }
  }

  dispose(): void {
    this.stopTheme();
    this.controls?.dispose();
    this.viewer.unmount();
  }
}
