/**
 * The controls around the `aec` canvas: the toolbar and the floor picker
 * above it, the panels below it, the list of keys and the keys themselves.
 * All of it is plain DOM over the shared viewer, in the host's colours.
 */

import {
  handleKey,
  type Shortcut,
  type ShortcutContext,
  type ViewerHandle,
} from '../viewer/index.js';
import type { MarkerColours } from './aecColours.js';
import { createFloorPicker, type FloorPicker } from './aecFloors.js';
import { createHelp, type Help } from './aecHelp.js';
import { optionsOf } from './aecOptions.js';
import {
  classLegend,
  heatLegend,
  missingNotice,
  objectPanel,
  type ClassEntry,
  type PickedObject,
} from './aecPanels.js';
import { createToolbar, type Toolbar } from './aecToolbar.js';
import { el } from './dom.js';

/** The rows of the pane: the controls, the canvas and the panels. */
export interface PaneRows {
  readonly frame: HTMLElement;
  readonly above: HTMLElement;
  readonly canvas: HTMLElement;
  readonly below: HTMLElement;
}

/** What the controls read of the pane they sit around. */
export interface ControlsInput {
  readonly rows: PaneRows;
  readonly handle: ViewerHandle;
  readonly colours: MarkerColours;
  /** The sensor anchored on an object, if any. */
  sensorOn(globalId: string): { name: string; signal: string } | undefined;
  /** Paint every marker in the colour the heatmap option says it shows now. */
  recolour(): void;
}

export interface Controls {
  /** Draw the controls and the panels as the view has them now. */
  redraw(): void;
  /** Name a sensor the model has no object for, once. */
  reportMissing(name: string): void;
  dispose(): void;
}

function toggleFullscreen() {
  const done = () => undefined; // a refused request changes nothing
  if (document.fullscreenElement) document.exitFullscreen().catch(done);
  else document.documentElement.requestFullscreen?.().catch(done);
}

/** The classes of the model with their colours and counts, sorted by class. */
function classesOf({ view }: ViewerHandle): ClassEntry[] {
  const counts = view.classCounts();
  return [...view.classColours()].map(([ifcClass, colour]) => ({
    ifcClass,
    colour,
    count: counts.get(ifcClass) ?? 0,
  }));
}

/** The picked object with its facts, its size and the sensor on it. */
function pickedOf(input: ControlsInput): PickedObject | null {
  const { view } = input.handle;
  const globalId = view.state.selected;
  if (!globalId) return null;
  const facts = view.factsOf(globalId);
  return { globalId, facts, size: view.sizeOf(globalId), sensor: input.sensorOn(globalId) };
}

/** The panels below the canvas, drawn again on every change. */
function drawBelow(input: ControlsInput, missing: readonly string[], refresh: () => void) {
  const { view } = input.handle;
  const pickClass = (ifcClass: string) => {
    view.state.highlightedClass = view.state.highlightedClass === ifcClass ? null : ifcClass;
    refresh();
  };
  const classes = classLegend(classesOf(input.handle), view.state.highlightedClass, pickClass);
  const legends = el('div', LEGENDS, ...heatLegend(input.colours), classes);
  const facts = el('div', { style: 'flex:1 1 320px;min-width:0' }, objectPanel(pickedOf(input)));
  const panels = el('div', PANELS, facts, legends);
  input.rows.below.replaceChildren(...[missingNotice(missing), panels].filter((n) => n !== null));
}

const LEGENDS = { style: 'flex:1 1 260px;min-width:0;display:grid;gap:8px' };
const PANELS = {
  style: 'display:flex;gap:16px;margin-top:8px;flex-wrap:wrap;align-items:flex-start',
};

/** Everything an option needs from the pane to do its work. */
function contextOf(input: ControlsInput, refresh: () => void, toggleHelp: () => void) {
  const { handle } = input;
  const context: ShortcutContext = {
    view: handle.view,
    // The core colours the markers, so no binding of a manifest is in force.
    bindings: [],
    refresh,
    frame: handle.frame,
    frameSelection: () => handle.frameSelection?.(),
    look: handle.look,
    hovered: () => handle.view.state.hovered,
    toggleHelp,
    toggleFullscreen,
  };
  return context;
}

/** The toolbar and the floor picker above the canvas and the list of keys over it. */
function placeAbove(rows: PaneRows, toolbar: Toolbar, floors: FloorPicker, help: Help): void {
  const top = el('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;column-gap:8px' });
  top.append(toolbar.element, floors.element);
  rows.above.append(top);
  rows.canvas.append(help.element);
}

/** The options' keys work while the pane has the focus. Returns the function that stops them. */
function bindKeys(frame: HTMLElement, context: ShortcutContext, options: readonly Shortcut[]) {
  const onKey = (event: KeyboardEvent) => {
    if (handleKey(event, context, options)) event.preventDefault();
  };
  frame.addEventListener('keydown', onKey);
  return () => frame.removeEventListener('keydown', onKey);
}

/** Put the controls around the canvas and connect them to the view. */
export function createControls(input: ControlsInput): Controls {
  const { rows } = input;
  const { view } = input.handle;
  const options = optionsOf(input.colours);
  const missing: string[] = [];
  const refresh = () => {
    view.refresh();
    input.recolour();
    redraw();
  };
  const help = createHelp(options, () => rows.frame.focus());
  const context = contextOf(input, refresh, help.toggle);
  const toolbar = createToolbar(options, () => context);
  const floors = createFloorPicker(view.storeys, (storey) => {
    view.state.storey = storey;
    refresh();
  });
  const redraw = () => {
    toolbar.sync();
    floors.sync(view.state.storey);
    drawBelow(input, missing, refresh);
  };
  placeAbove(rows, toolbar, floors, help);
  const unbind = bindKeys(rows.frame, context, options);
  refresh();
  return { redraw, reportMissing: reporter(missing, redraw), dispose: unbind };
}

/** Name a sensor the model has no object for, once: the core may resolve the same anchor again. */
function reporter(missing: string[], redraw: () => void) {
  return (name: string) => {
    if (missing.includes(name)) return;
    missing.push(name);
    redraw();
  };
}
