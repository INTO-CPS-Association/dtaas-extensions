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
  Box3,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  type Object3D,
  type PerspectiveCamera,
  type Raycaster,
} from 'three';
import { idOf, objectOf, type Binding } from '../binding.js';
import { isLive, DEFAULT_STALE_AFTER_S, type FeedState, type Reading } from '../readings.js';
import { SELECTED_COLOUR } from './appearance.js';
import { createLabel, placeLabel, styleLabel, toScreen } from './markerLabels.js';
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

/**
 * The layer the dots and rings are drawn on. The canvas draws this layer in
 * a pass of its own without the cuts, so a dot on a wall the plan cuts
 * through is not cut away with the top of the wall, and the occlusion pass,
 * which draws layer 0, does not darken the space around a dot.
 */
export const MARKER_LAYER = 1;

/** A dark ring around every dot, so a pale value still shows against a pale wall. */
const RING_COLOUR = 0x1f2933;
const RING_SCALE = 1.3;
/** A marker is at least this share of the model, so it grows with a large building seen close. */
const MARKER_SHARE_OF_MODEL = 0.006;
const MIN_RADIUS_M = 0.05;

interface Marker {
  binding: Binding;
  globalId: string | undefined;
  dot: Mesh<SphereGeometry, MeshBasicMaterial>;
  ring: Mesh<SphereGeometry, MeshBasicMaterial>;
  label: HTMLElement;
  live: boolean;
  /** The colour of the latest reading, kept so a marker no longer selected gets it back. */
  colour: number;
}

/** What the canvas does with the markers once they are built. */
export interface MarkerSet {
  readonly count: number;
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

/** One dot, its ring and its label, at the centre of its object. */
function buildMarker(
  model: Object3D,
  binding: Binding,
  node: Object3D,
  shape: SphereGeometry,
  overlay: HTMLElement,
  onPick?: (globalId: string) => void,
): Marker {
  // Drawn over the geometry they sit on, or a sensor inside a wall is
  // invisible from outside, which defeats the purpose of a marker. The ring is
  // drawn first and the dot over it.
  const ring = new Mesh(shape, new MeshBasicMaterial({ color: RING_COLOUR, depthTest: false }));
  const dot = new Mesh(
    shape,
    new MeshBasicMaterial({ color: NO_READING_COLOUR, depthTest: false }),
  );
  ring.renderOrder = 2;
  dot.renderOrder = 3;
  ring.layers.set(MARKER_LAYER);
  dot.layers.set(MARKER_LAYER);
  dot.name = `marker:${idOf(binding)}`;
  const at = new Box3().setFromObject(node).getCenter(new Vector3());
  dot.position.copy(at);
  ring.position.copy(at);
  model.add(ring, dot);
  const label = createLabel(overlay.ownerDocument, binding.label);
  label.textContent = labelText(binding, undefined);
  const globalId = objectOf(binding);
  // A label is a place a person clicks to go to the sensor, as on its card.
  // The overlay lets clicks through everywhere else.
  if (onPick && globalId !== undefined) {
    label.style.pointerEvents = 'auto';
    label.style.cursor = 'pointer';
    // A button to the keyboard and to a screen reader as well, so a person
    // who does not use a mouse can reach a sensor the same way.
    label.setAttribute('role', 'button');
    label.tabIndex = 0;
    label.setAttribute('aria-label', `Go To ${binding.label}`);
    label.addEventListener('click', (event) => {
      event.stopPropagation();
      onPick(globalId);
    });
    label.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      // Kept from the viewer's own shortcuts, which a space would otherwise reach.
      event.preventDefault();
      event.stopPropagation();
      onPick(globalId);
    });
  }
  overlay.appendChild(label);
  return {
    binding,
    globalId: objectOf(binding),
    dot,
    ring,
    label,
    live: false,
    colour: NO_READING_COLOUR,
  };
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

function disposeMarker(marker: Marker): void {
  marker.label.remove();
  marker.dot.material.dispose();
  marker.ring.material.dispose();
}

/** Size, colour and label one marker for this frame. */
function placeOne(
  marker: Marker,
  radius: number,
  camera: PerspectiveCamera,
  size: { width: number; height: number },
  selected: boolean,
  shown: boolean,
  pulse = 1,
): void {
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
  placeLabel(marker.label, toScreen(where.project(camera), size.width, size.height), shown);
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
  const markers = resolved.map(({ binding, object }) =>
    buildMarker(model, binding, object.node, shape, overlay, onPick),
  );
  // The pulse starts when the selection changes to a sensor, whatever picked
  // it: a click on the model, a card or a key.
  let lastSelected: string | null = null;
  let pulseFrom = Number.NEGATIVE_INFINITY;
  const reduced = prefersReducedMotion();
  return {
    count: markers.length,
    showReadings(readings, feed, staleAfter = DEFAULT_STALE_AFTER_S) {
      for (const marker of markers) readMarker(marker, readings, feed, staleAfter);
    },
    place(camera, width, height, selected, shown, now = performance.now()) {
      if (selected !== lastSelected) {
        lastSelected = selected;
        pulseFrom = reduced ? Number.NEGATIVE_INFINITY : now;
      }
      const pulse = pulseFactor(now - pulseFrom);
      // The labels are projected with the camera of this frame and not the
      // one the last render left behind, or they trail the model as it turns.
      camera.updateMatrixWorld();
      for (const marker of markers) {
        const id = marker.globalId;
        const picked = id !== undefined && id === selected;
        placeOne(
          marker,
          radius,
          camera,
          { width, height },
          picked,
          id === undefined || shown(id),
          picked ? pulse : 1,
        );
      }
    },
    pick(ray) {
      const shown = markers.filter((marker) => marker.dot.visible && marker.globalId !== undefined);
      // The dots are on their own layer, which a ray does not see unless asked.
      const layers = ray.layers.mask;
      ray.layers.enable(MARKER_LAYER);
      const hit = ray.intersectObjects(
        shown.map((marker) => marker.dot),
        false,
      )[0];
      ray.layers.mask = layers;
      return shown.find((marker) => marker.dot === hit?.object)?.globalId ?? null;
    },
    dispose() {
      for (const marker of markers) disposeMarker(marker);
      shape.dispose();
    },
  };
}
