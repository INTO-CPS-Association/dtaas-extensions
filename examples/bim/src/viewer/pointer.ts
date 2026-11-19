/**
 * What the pointer does on a shown model: the object under it is lit, and a
 * click picks a face of the view cube, a sensor, a point to measure or an
 * object, in that order.
 */

import { Raycaster, Vector2, type Intersection, type Vector3 } from 'three';

import type { Measure } from './measure.js';
import type { MarkerSet } from './markers.js';
import type { SceneView } from './sceneView.js';
import type { Stage } from './stage.js';

/** How far the pointer may move between press and release and still count as a click, in pixels. */
const DRAG_PX = 4;

/** What a click can lead to, beyond the view's own state. */
export interface PointerActions {
  /** A person pointed at another object, or at nothing. */
  hovered(globalId: string | null): void;
  /** A person clicked an object, or empty space. */
  selected(globalId: string | null): void;
  /** A person clicked a sensor's dot. */
  pickSensor(globalId: string): void;
  /** A person clicked a face, an edge or a corner of the view cube. */
  lookAlong(direction: Vector3): void;
}

export interface Pointer {
  /** The object under a point of the page: a sensor's first, then the first visible surface. */
  objectAt(clientX: number, clientY: number): string | null;
  dispose(): void;
}

interface Aim {
  clientX: number;
  clientY: number;
}

/** Cast rays through the pointer at what the view shows. */
function rayCaster(stage: Stage, view: SceneView) {
  const ray = new Raycaster();
  const pointer = new Vector2();
  const aim = ({ clientX, clientY }: Aim) => {
    const box = stage.parent.getBoundingClientRect();
    pointer.x = ((clientX - box.left) / box.width) * 2 - 1;
    pointer.y = -((clientY - box.top) / box.height) * 2 + 1;
    ray.setFromCamera(pointer, stage.camera);
    return ray;
  };
  /** The first visible surface under the pointer, or undefined. */
  const hitAt = (at: Aim): Intersection | undefined => {
    // Only what is visible: a floor filter that hides a wall must also stop
    // that wall being clicked through the floor above it.
    const shown = [...view.meshes.values()].filter((mesh) => mesh.visible);
    const hits = aim(at).intersectObjects(shown, false);
    // A cut hides what is beyond it without changing `visible`, so a hit
    // there is a click on nothing drawn.
    return hits.find((hit) => view.keeps(hit.point));
  };
  const objectOf = (at: Aim): string | null =>
    (hitAt(at)?.object.userData.globalId as string | undefined) ?? null;
  return { aim, hitAt, objectOf };
}

type Rays = ReturnType<typeof rayCaster>;

interface Context {
  stage: Stage;
  view: SceneView;
  markers: MarkerSet;
  measure: Measure;
  rays: Rays;
  actions: PointerActions;
}

/** A click: the view cube, a sensor, a point to measure, then an object. */
function clickOn({ stage, view, markers, measure, rays, actions }: Context, event: MouseEvent) {
  const box = stage.parent.getBoundingClientRect();
  const { clientX, clientY } = event;
  const face = stage.cube.pick(clientX - box.left, clientY - box.top, box.width, box.height);
  if (face) return actions.lookAlong(face);
  // A sensor's dot is drawn over the walls, so it is picked before whatever
  // object lies behind it.
  const sensor = view.state.measuring ? null : markers.pick(rays.aim(event));
  if (sensor) return actions.pickSensor(sensor);
  if (view.state.measuring) {
    const hit = rays.hitAt(event);
    if (hit) measure.addPoint(hit.point);
    return undefined;
  }
  return actions.selected(rays.objectOf(event));
}

/** Light the object under the pointer, unless the pointer is drawing. */
function hoverer({ view, actions }: Pick<Context, 'view' | 'actions'>, rays: Rays) {
  let picked: string | null = null;
  return (event: PointerEvent) => {
    // A pen stroke ends on the model, and the drawing is what the mouse is
    // doing, so nothing under it is highlighted or picked.
    if (view.state.sketching) return;
    const globalId = rays.objectOf(event);
    if (globalId === picked) return;
    picked = globalId;
    actions.hovered(globalId);
  };
}

/** A press and a release in the same place, which a drag that turned the view is not. */
function clicker(context: Context) {
  const pressedAt = { x: 0, y: 0 };
  const press = (event: PointerEvent) =>
    Object.assign(pressedAt, { x: event.clientX, y: event.clientY });
  const click = (event: MouseEvent) => {
    if (context.view.state.sketching) return;
    if (Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) > DRAG_PX) return;
    clickOn(context, event);
  };
  return { press, click };
}

/** Listen for the pointer on the stage, and give back the listeners on dispose. */
export function listenForPointer(context: Omit<Context, 'rays'>): Pointer {
  const rays = rayCaster(context.stage, context.view);
  const move = hoverer(context, rays);
  const { press, click } = clicker({ ...context, rays });
  const { parent } = context.stage;
  parent.addEventListener('pointermove', move);
  parent.addEventListener('pointerdown', press);
  parent.addEventListener('click', click);
  const objectAt = (clientX: number, clientY: number) =>
    context.markers.pick(rays.aim({ clientX, clientY })) ?? rays.objectOf({ clientX, clientY });
  const dispose = () => {
    parent.removeEventListener('pointermove', move);
    parent.removeEventListener('pointerdown', press);
    parent.removeEventListener('click', click);
  };
  return { objectAt, dispose };
}
