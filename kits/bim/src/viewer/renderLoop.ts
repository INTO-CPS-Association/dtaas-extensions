/**
 * The frame loop of a 3D view.
 *
 * A large model drawn every frame while nothing moves keeps a core busy for
 * nothing, so a frame is drawn only when the camera moves, when a person did
 * something lately, when the view changed, when the first still frame after a
 * move is due and once a second otherwise. The occlusion pass is left out
 * while the camera moves and comes back when it rests.
 */

import { Matrix4, type Plane } from 'three';

import { movedBeyond } from './flight.js';
import { MARKER_LAYER } from './markers.js';
import type { Stage } from './stage.js';

/** How long the camera has to rest before the occlusion pass is drawn again, in milliseconds. */
const STILL_MS = 150;

/** A step of the camera smaller than this, relative to the view, is too small to see. */
const SETTLE_TOLERANCE = 2e-4;

/**
 * How long the view keeps drawing every frame after a person did something,
 * in milliseconds: long enough for a hover, a pulse or a flight to finish.
 */
const AWAKE_MS = 1000;

/** How often a view nobody touches is drawn, in milliseconds. */
const IDLE_REDRAW_MS = 1000;

/** What a shown model adds to every frame. */
export interface Scenery {
  /** Size every marker and move every label for the frame about to be drawn. */
  placeMarkers(): void;
  /** Where the cuts are, read on every frame so a change takes effect on the next one. */
  cutPlanes(): Plane[];
  wantsShadows(): boolean;
  /**
   * The occlusion pass draws every mesh as solid, a see-through wall too, so
   * with the shell made transparent it would darken the space around the
   * walls. It is left out while the shell is see-through.
   */
  wantsOcclusion(): boolean;
  /** Let the grid, the measurement, the lens and the walk follow the view's state. */
  followState(): void;
  /** Counts the changes of what is visible, which is all the shadow map depends on. */
  visibility(): number;
  /** Changes whenever the view shows something else, so a still view is drawn again. */
  revision(): string;
  /** Show the edges of every object, which are left out while the camera moves. */
  showOutlines(shown: boolean): void;
}

/** Before a model is shown: nothing to place, to cut or to shade. */
export const NO_SCENERY: Scenery = {
  placeMarkers: () => undefined,
  cutPlanes: () => [],
  wantsShadows: () => false,
  wantsOcclusion: () => true,
  followState: () => undefined,
  visibility: () => 0,
  revision: () => '',
  showOutlines: () => undefined,
};

export class RenderLoop {
  scenery: Scenery = NO_SCENERY;

  private running = false;
  private awakeUntil = 0;
  private lastDraw = 0;
  private lastFull = false;
  private lastRevision = '';
  private outlinesShown = true;
  private shadowKey = '';
  /** Where the camera was on the last frame and when it last moved. */
  private readonly lastView = new Matrix4();
  private lastFov: number;
  private stillSince = 0;

  constructor(private readonly stage: Stage) {
    this.lastFov = stage.camera.fov;
  }

  start(): void {
    this.running = true;
    this.tick();
  }

  stop(): void {
    this.running = false;
  }

  /** Draw every frame for a moment, because a person just did something. */
  readonly wake = (): void => {
    this.awakeUntil = performance.now() + AWAKE_MS;
  };

  private readonly tick = (): void => {
    if (!this.running) return;
    const now = performance.now();
    this.prepare(now);
    const still = this.settle(now);
    const changed = this.scenery.revision();
    const due =
      !still ||
      now < this.awakeUntil ||
      changed !== this.lastRevision ||
      !this.lastFull ||
      now - this.lastDraw > IDLE_REDRAW_MS;
    if (due) this.draw(now, still, changed);
    globalThis.requestAnimationFrame(this.tick);
  };

  /** Move the camera, the markers and the cuts to where this frame has them. */
  private prepare(now: number): void {
    const { flight, controls, section, sun, renderer } = this.stage;
    flight.step(now);
    controls.update();
    this.scenery.placeMarkers();
    const cuts = this.scenery.cutPlanes();
    section.setPlanes(cuts);
    // The shadow map is drawn without the cut, so with a cut on, the roof
    // that is not drawn would still throw its shadow into the rooms.
    sun.castShadow = cuts.length === 0 && this.scenery.wantsShadows();
    this.scenery.followState();
    const key = `${sun.castShadow}|${this.scenery.visibility()}`;
    if (key === this.shadowKey) return;
    this.shadowKey = key;
    renderer.shadowMap.needsUpdate = true;
  }

  /** Note whether the camera moved and say whether it has rested long enough. */
  private settle(now: number): boolean {
    const { camera, controls, flight } = this.stage;
    camera.updateMatrixWorld();
    if (movedBeyond(this.lastView, camera.matrixWorld) || camera.fov !== this.lastFov) {
      // The damping slows the camera by a share of its speed each frame, so on
      // a slow frame rate it creeps on for many seconds. Once a step is too
      // small to see, the remaining speed is dropped and the view rests.
      if (!flight.flying && !movedBeyond(this.lastView, camera.matrixWorld, SETTLE_TOLERANCE)) {
        controls.enableDamping = false;
        controls.update();
        controls.enableDamping = true;
        camera.updateMatrixWorld();
      }
      this.lastView.copy(camera.matrixWorld);
      this.lastFov = camera.fov;
      this.stillSince = now;
    }
    return now - this.stillSince > STILL_MS;
  }

  private draw(now: number, still: boolean, changed: string): void {
    const { renderer, camera, finish, gizmo, cube } = this.stage;
    if (still !== this.outlinesShown) {
      this.outlinesShown = still;
      this.scenery.showOutlines(still);
    }
    finish.render(still && this.scenery.wantsOcclusion());
    this.lastDraw = now;
    this.lastFull = still;
    this.lastRevision = changed;
    // The cut is in world coordinates and the axes indicator is not in the
    // world, so the indicator is drawn without it, and so are the sensor dots,
    // which have their own layer for this.
    const planes = renderer.clippingPlanes;
    renderer.clippingPlanes = [];
    this.drawMarkers();
    gizmo.draw(renderer, camera);
    cube.draw(renderer, camera);
    renderer.clippingPlanes = planes;
  }

  /** Draw the sensor dots over the frame just drawn. */
  private drawMarkers(): void {
    const { renderer, scene, camera } = this.stage;
    const { autoClear, background } = {
      autoClear: renderer.autoClear,
      background: scene.background,
    };
    renderer.autoClear = false;
    scene.background = null;
    camera.layers.set(MARKER_LAYER);
    renderer.render(scene, camera);
    camera.layers.set(0);
    scene.background = background;
    renderer.autoClear = autoClear;
  }
}
