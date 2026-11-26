/**
 * A 3D view of one building model, with no framework.
 *
 * It owns the renderer, the scene, the camera, the controls and the frame
 * loop. `mount` puts the view in an element, `show` draws a model in it with
 * its sensors and `unmount` gives everything back, the WebGL context too.
 * The Buildings page drives it from a thin React component and the `aec`
 * substrate from plain DOM, so the two draw a building with the same code.
 */

import type { Object3D } from 'three';

import { frame, frameFrom, frameObject } from './framing.js';
import { createMarkers, type MarkerSet } from './markers.js';
import type { Measure } from './measure.js';
import { listenForPointer, type Pointer } from './pointer.js';
import { RenderLoop } from './renderLoop.js';
import { decorate, type Decorations } from './scenery.js';
import { SceneView } from './sceneView.js';
import { createStage, type Stage } from './stage.js';
import type { PointerActions } from './pointer.js';
import type { ShowOptions, ViewerEvents, ViewerHandle } from './viewer.types.js';

export type { Placed, ShowOptions, ViewerEvents, ViewerHandle } from './viewer.types.js';

/** Everything one shown model holds. */
interface Shown {
  model: Object3D;
  view: SceneView;
  markers: MarkerSet;
  decorations: Decorations;
  pointer: Pointer;
  handle: ViewerHandle;
}

/** The events of the page that may change the picture, so the view draws for a moment. */
const INPUTS = ['pointerdown', 'pointermove', 'wheel', 'keydown', 'keyup'] as const;

export class Viewer {
  private stage: Stage | null = null;
  private loop: RenderLoop | null = null;
  private observer: ResizeObserver | null = null;
  private shown: Shown | null = null;
  private events: ViewerEvents = {};

  /** Put the view inside `parent`, which must be positioned for the labels. */
  mount(parent: HTMLElement, events: ViewerEvents = {}): void {
    if (this.stage) throw new Error('This viewer is already mounted');
    this.events = events;
    const stage = createStage(parent);
    const loop = new RenderLoop(stage);
    this.observer = new ResizeObserver(() => {
      stage.resize();
      loop.wake();
    });
    this.observer.observe(parent);
    // Listened for on the page and not only on the canvas, since a toolbar
    // and the cards around the view change it too.
    for (const name of INPUTS) globalThis.addEventListener(name, loop.wake, { passive: true });
    [this.stage, this.loop] = [stage, loop];
    loop.start();
  }

  /** The handle of the shown model, or null before one is shown. */
  get handle(): ViewerHandle | null {
    return this.shown?.handle ?? null;
  }

  /** The markers of the shown model, or null before one is shown. */
  get markers(): MarkerSet | null {
    return this.shown?.markers ?? null;
  }

  /** The sensor or the object under a point of the page, or null. */
  objectAt(clientX: number, clientY: number): string | null {
    return this.shown?.pointer.objectAt(clientX, clientY) ?? null;
  }

  /** Fly to one object of the shown model. */
  frameObject(globalId: string): void {
    const mesh = this.shown?.view.meshes.get(globalId);
    if (mesh && this.shown && this.stage) {
      const { camera, controls } = this.stage;
      const { model } = this.shown;
      this.flyTo(() => frameObject(camera, controls, mesh, model));
    }
  }

  /** Draw `model` with its sensors. A viewer shows one model in its life. */
  show(model: Object3D, options: ShowOptions = {}): ViewerHandle {
    const { stage, loop } = this.mounted();
    if (this.shown) throw new Error('This viewer already shows a model');
    stage.scene.add(model);
    const { camera, controls, overlay, parent } = stage;
    const radius = frame(camera, controls, model, options.from);
    const pick = (globalId: string) => this.pickSensor(globalId);
    const markers = createMarkers(model, options.placed ?? [], overlay, radius, pick);
    const view = new SceneView(model as never, options.tree);
    const decorations = decorate(stage, model, view);
    const place = () =>
      markers.place(camera, parent.clientWidth, parent.clientHeight, view.state.selected, (id) =>
        view.isShown(id),
      );
    loop.scenery = decorations.scenery(place);
    view.refresh();
    const pointer = this.listen(model, view, markers, decorations.measure);
    const handle = this.handleFor(model, view, markers, decorations);
    this.shown = { model, view, markers, decorations, pointer, handle };
    return handle;
  }

  /** Take the view down and give the WebGL context back. Safe to call twice. */
  unmount(): void {
    this.loop?.stop();
    if (this.shown) this.hideModel(this.shown);
    this.observer?.disconnect();
    const wake = this.loop?.wake;
    if (wake) for (const name of INPUTS) globalThis.removeEventListener(name, wake);
    this.stage?.dispose();
    [this.stage, this.loop, this.observer, this.shown] = [null, null, null, null];
  }

  private hideModel({ markers, decorations, pointer, view }: Shown): void {
    markers.dispose();
    decorations.dispose();
    pointer.dispose();
    view.dispose();
  }

  private mounted(): { stage: Stage; loop: RenderLoop } {
    if (!this.stage || !this.loop) throw new Error('Mount the viewer before showing a model');
    return { stage: this.stage, loop: this.loop };
  }

  /**
   * Fly to a new shot. Walking stops, since the shot is not at eye height,
   * and the lens is set first, so the shot is worked out for the lens it is
   * seen through and a change of lens cannot pull the camera away.
   */
  private flyTo(change: () => void): void {
    if (!this.shown || !this.stage) return;
    this.shown.view.state.walking = false;
    this.shown.decorations.lens();
    this.stage.flight.fly(change);
  }

  /** A click on a sensor's dot or label picks its object and flies there. */
  private pickSensor(globalId: string): void {
    const view = this.shown?.view;
    if (!view) return;
    this.loop?.wake();
    view.state.selected = globalId;
    view.refreshMaterials();
    this.events.onSelect?.(globalId);
    this.frameObject(globalId);
  }

  private listen(model: Object3D, view: SceneView, markers: MarkerSet, measure: Measure) {
    const stage = this.mounted().stage;
    const actions = this.actionsFor(model, view);
    return listenForPointer({ stage, view, markers, measure, actions });
  }

  /** What the pointer leads to: the hover and the selection go to the owner too. */
  private actionsFor(model: Object3D, view: SceneView): PointerActions {
    const { camera, controls } = this.mounted().stage;
    const mark = (field: 'hovered' | 'selected', globalId: string | null) => {
      view.state[field] = globalId;
      view.refreshMaterials();
    };
    return {
      hovered: (globalId) => {
        mark('hovered', globalId);
        this.events.onHover?.(globalId);
      },
      selected: (globalId) => {
        mark('selected', globalId);
        this.events.onSelect?.(globalId);
      },
      pickSensor: (globalId) => this.pickSensor(globalId),
      lookAlong: (direction) => this.flyTo(() => frameFrom(camera, controls, model, direction)),
    };
  }

  private handleFor(
    model: Object3D,
    view: SceneView,
    markers: MarkerSet,
    decorations: Decorations,
  ): ViewerHandle {
    const { camera, controls } = this.mounted().stage;
    const wake = () => this.loop?.wake();
    return {
      view,
      frame: () => this.flyTo(() => frame(camera, controls, model)),
      look: (from) => this.flyTo(() => frame(camera, controls, model, from)),
      drawField: () => {
        decorations.sheet.draw(view);
        wake();
      },
      frameSelection: () => {
        if (view.state.selected) this.frameObject(view.state.selected);
      },
      showReadings: (readings, feed, staleAfter) => {
        markers.showReadings(readings, feed, staleAfter);
        wake();
      },
    };
  }
}
