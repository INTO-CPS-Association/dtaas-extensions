/**
 * The sensor markers: a dot on each bound object, with its name and value.
 *
 * A marker used to be a sphere sized as a share of the model. On a building
 * of sixty metres seen whole it was a few pixels of grey and the selected
 * one could not be told from the rest. A marker now has a smallest size in
 * pixels, so it stays visible however far away the camera is and the
 * selected one is larger, in the selection colour and labelled in bold.
 */

import {
  SphereGeometry,
  Vector3,
  type Object3D,
  type PerspectiveCamera,
  type Raycaster,
} from 'three';
import type { Binding } from '../binding.js';
import { isLive, DEFAULT_STALE_AFTER_S, type FeedState, type Reading } from '../readings.js';
import { SELECTED_COLOUR } from './appearance.js';
import { buildMarker, disposeMarker, MARKER_LAYER, type Marker } from './markerBuild.js';
import {
  placeLabel,
  spreadLabels,
  styleLabel,
  toScreen,
  type ScreenPoint,
} from './markerLabels.js';
import { prefersReducedMotion } from './flight.js';
import {
  labelText,
  markerColour,
  markerScale,
  pulseFactor,
  MARKER_MIN_PX,
  NO_READING_COLOUR,
  SELECTED_MARKER_MIN_PX,
} from './markerStyle.js';

export { MARKER_LAYER } from './markerBuild.js';

const RING_SCALE = 1.3;
/** A marker is at least this share of the model, so it grows with a large building seen close. */
const MARKER_SHARE_OF_MODEL = 0.006;
const MIN_RADIUS_M = 0.05;

/**
 * One marker as a caller that colours it itself sees it: the `aec` substrate
 * paints its markers from the encodings of a visualisation instead of from
 * the readings and the ramp of a manifest.
 */
export interface MarkerHandle {
  readonly globalId: string | undefined;
  /** Paint the dot, or give it the colour of no reading with null. */
  setColour(colour: number | null): void;
  setText(text: string): void;
  /** Show or hide the marker, on top of what the floor and the cuts decide. */
  setShown(shown: boolean): void;
}

/** What the canvas does with the markers once they are built. */
export interface MarkerSet {
  readonly count: number;
  /** Put one more marker on `node`, for a sensor that arrives after the model. */
  add: (binding: Binding, node: Object3D) => MarkerHandle;
  /** Recolour the dots and rewrite the labels from the latest readings. */
  showReadings: (readings: Map<string, Reading>, feed: FeedState, staleAfter?: number) => void;
  /**
   * Size the dots and move the labels for this frame. `shown` says whether a
   * sensor's object is visible. `now` drives the pulse of a newly picked
   * marker and is `performance.now()` unless a test passes its own clock.
   */
  place: (
    camera: PerspectiveCamera,
    width: number,
    height: number,
    selected: string | null,
    shown: (globalId: string) => boolean,
    now?: number,
  ) => void;
  /** The object of the sensor whose dot the ray hits first, or null. */
  pick: (ray: Raycaster) => string | null;
  dispose: () => void;
}

/** Take one marker's latest reading into its colour and its label. */
function readMarker(
  marker: Marker,
  readings: Map<string, Reading>,
  feed: FeedState,
  staleAfter: number,
): void {
  const reading = marker.globalId ? readings.get(marker.globalId) : undefined;
  marker.live = isLive(reading, feed, staleAfter);
  marker.colour = markerColour(marker.binding, reading, feed, staleAfter);
  marker.label.textContent = labelText(marker.binding, reading);
}

/** What every marker of one frame is placed for. */
interface FrameOf {
  radius: number;
  camera: PerspectiveCamera;
  size: { width: number; height: number };
}

/** Size, colour and label one marker for this frame. Returns where its label points. */
function placeOne(
  marker: Marker,
  { radius, camera, size }: FrameOf,
  selected: boolean,
  shown: boolean,
  pulse = 1,
): ScreenPoint {
  const where = marker.dot.getWorldPosition(new Vector3());
  const minPx = selected ? SELECTED_MARKER_MIN_PX : MARKER_MIN_PX;
  const scale =
    pulse * markerScale(radius, camera.position.distanceTo(where), camera.fov, size.height, minPx);
  marker.dot.scale.setScalar(scale);
  marker.ring.scale.setScalar(scale * RING_SCALE);
  marker.dot.visible = shown;
  marker.ring.visible = shown;
  marker.dot.material.color.setHex(selected ? SELECTED_COLOUR : marker.colour);
  styleLabel(marker.label, selected, marker.live);
  const at = toScreen(where.project(camera), size.width, size.height);
  placeLabel(marker.label, at, shown);
  return at;
}

/**
 * Raise the labels that would cover one another. Runs after every label has
 * its text and style for the frame, since its size depends on both.
 */
function separate(
  markers: readonly Marker[],
  spots: readonly ScreenPoint[],
  shown: readonly boolean[],
) {
  const open = markers
    .map((_, index) => index)
    .filter((index) => shown[index] && spots[index].visible);
  const lifts = spreadLabels(
    open.map((index) => ({
      x: spots[index].x,
      y: spots[index].y,
      width: markers[index].label.offsetWidth,
      height: markers[index].label.offsetHeight,
    })),
  );
  open.forEach((index, at) => {
    if (lifts[at] > 0) placeLabel(markers[index].label, spots[index], true, lifts[at]);
  });
}

/** The handle a caller paints one marker through. */
function handleOf(marker: Marker): MarkerHandle {
  return {
    globalId: marker.globalId,
    setColour(colour) {
      marker.colour = colour ?? NO_READING_COLOUR;
      // A marker given a colour is showing a value, so its label is not faded.
      marker.live = colour !== null;
    },
    setText(text) {
      marker.label.textContent = text;
    },
    setShown(shown) {
      marker.hidden = !shown;
    },
  };
}

/** The object of the sensor whose dot the ray hits first, or null. */
function pickFrom(markers: readonly Marker[], ray: Raycaster): string | null {
  const shown = markers.filter((marker) => marker.dot.visible && marker.globalId !== undefined);
  // The dots are on their own layer, which a ray does not see unless asked.
  const layers = ray.layers.mask;
  ray.layers.enable(MARKER_LAYER);
  const dots = shown.map((marker) => marker.dot);
  const hit = ray.intersectObjects(dots, false)[0];
  ray.layers.mask = layers;
  return shown.find((marker) => marker.dot === hit?.object)?.globalId ?? null;
}

/**
 * The size of the selected marker over time: it grows once and settles back
 * when the selection changes to a sensor, whatever picked it: a click on the
 * model, a card or a key.
 */
function pulser() {
  let lastSelected: string | null = null;
  let pulseFrom = Number.NEGATIVE_INFINITY;
  const reduced = prefersReducedMotion();
  return (selected: string | null, now: number) => {
    if (selected !== lastSelected) {
      lastSelected = selected;
      pulseFrom = reduced ? Number.NEGATIVE_INFINITY : now;
    }
    return pulseFactor(now - pulseFrom);
  };
}

/**
 * Put a marker on every resolved binding, inside `model`, with its label in
 * `overlay`. `modelRadius` sets the size a marker has when seen close.
 */
export function createMarkers(
  model: Object3D,
  resolved: ReadonlyArray<{ binding: Binding; object: { node: Object3D } }>,
  overlay: HTMLElement,
  modelRadius: number,
  onPick?: (globalId: string) => void,
): MarkerSet {
  const radius = Math.max(modelRadius * MARKER_SHARE_OF_MODEL, MIN_RADIUS_M);
  const shape = new SphereGeometry(radius, 16, 12);
  const build = (binding: Binding, node: Object3D) =>
    buildMarker(model, binding, node, shape, overlay, onPick);
  const markers = resolved.map(({ binding, object }) => build(binding, object.node));
  const pulse = pulser();
  return {
    get count() {
      return markers.length;
    },
    add(binding, node) {
      const marker = build(binding, node);
      markers.push(marker);
      return handleOf(marker);
    },
    showReadings(readings, feed, staleAfter = DEFAULT_STALE_AFTER_S) {
      for (const marker of markers) readMarker(marker, readings, feed, staleAfter);
    },
    place(camera, width, height, selected, shown, now = performance.now()) {
      const growth = pulse(selected, now);
      // The labels are projected with the camera of this frame and not the
      // one the last render left behind, or they trail the model as it turns.
      camera.updateMatrixWorld();
      const frame = { radius, camera, size: { width, height } };
      const visible = markers.map(
        (marker) => !marker.hidden && (marker.globalId === undefined || shown(marker.globalId)),
      );
      const spots = markers.map((marker, index) => {
        const picked = marker.globalId !== undefined && marker.globalId === selected;
        return placeOne(marker, frame, picked, visible[index], picked ? growth : 1);
      });
      separate(markers, spots, visible);
    },
    pick: (ray) => pickFrom(markers, ray),
    dispose() {
      for (const marker of markers) disposeMarker(marker);
      shape.dispose();
    },
  };
}
