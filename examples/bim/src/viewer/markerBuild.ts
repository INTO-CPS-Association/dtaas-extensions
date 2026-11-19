/**
 * Building one sensor marker: a dot over a dark ring at the centre of its
 * object, and a label over the canvas that a person can click or reach with
 * the keyboard to go to the sensor.
 */

import { Box3, Mesh, MeshBasicMaterial, type Object3D, type SphereGeometry, Vector3 } from 'three';

import { idOf, objectOf, type Binding } from '../binding.js';
import { createLabel } from './markerLabels.js';
import { labelText, NO_READING_COLOUR } from './markerStyle.js';

/**
 * The layer the dots and rings are drawn on. The canvas draws this layer in
 * a pass of its own without the cuts, so a dot on a wall the plan cuts
 * through is not cut away with the top of the wall, and the occlusion pass,
 * which draws layer 0, does not darken the space around a dot.
 */
export const MARKER_LAYER = 1;

/** A dark ring around every dot, so a pale value still shows against a pale wall. */
const RING_COLOUR = 0x1f2933;

export interface Marker {
  binding: Binding;
  globalId: string | undefined;
  dot: Mesh<SphereGeometry, MeshBasicMaterial>;
  ring: Mesh<SphereGeometry, MeshBasicMaterial>;
  label: HTMLElement;
  live: boolean;
  /** The colour of the latest reading, kept so a marker no longer selected gets it back. */
  colour: number;
  /** Hidden by whoever placed it, whatever the floor and the cuts say. */
  hidden: boolean;
}

/**
 * Make a label a place a person clicks to go to the sensor, as on its card.
 * The overlay lets clicks through everywhere else. It is a button to the
 * keyboard and to a screen reader as well, so a person who does not use a
 * mouse can reach a sensor the same way.
 */
function makePickable(label: HTMLElement, binding: Binding, pick: () => void): void {
  label.style.pointerEvents = 'auto';
  label.style.cursor = 'pointer';
  label.setAttribute('role', 'button');
  label.tabIndex = 0;
  label.setAttribute('aria-label', `Go To ${binding.label}`);
  label.addEventListener('click', (event) => {
    event.stopPropagation();
    pick();
  });
  label.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    // Kept from the viewer's own shortcuts, which a space would otherwise reach.
    event.preventDefault();
    event.stopPropagation();
    pick();
  });
}

/** A dot or its ring, on the marker layer, drawn over the geometry it sits on. */
function sphere(shape: SphereGeometry, colour: number, order: number, at: Vector3) {
  // Drawn over the geometry, or a sensor inside a wall is invisible from
  // outside, which defeats the purpose of a marker.
  const mesh = new Mesh(shape, new MeshBasicMaterial({ color: colour, depthTest: false }));
  mesh.renderOrder = order;
  mesh.layers.set(MARKER_LAYER);
  mesh.position.copy(at);
  return mesh;
}

/** One dot, its ring and its label, at the centre of `node`, inside `model`. */
export function buildMarker(
  model: Object3D,
  binding: Binding,
  node: Object3D,
  shape: SphereGeometry,
  overlay: HTMLElement,
  onPick?: (globalId: string) => void,
): Marker {
  const at = new Box3().setFromObject(node).getCenter(new Vector3());
  // The ring is drawn first and the dot over it.
  const ring = sphere(shape, RING_COLOUR, 2, at);
  const dot = sphere(shape, NO_READING_COLOUR, 3, at);
  dot.name = `marker:${idOf(binding)}`;
  model.add(ring, dot);
  const label = createLabel(overlay.ownerDocument, binding.label);
  label.textContent = labelText(binding, undefined);
  const globalId = objectOf(binding);
  if (onPick && globalId !== undefined) makePickable(label, binding, () => onPick(globalId));
  overlay.appendChild(label);
  const colour = NO_READING_COLOUR;
  return { binding, globalId, dot, ring, label, live: false, colour, hidden: false };
}

export function disposeMarker(marker: Marker): void {
  marker.label.remove();
  marker.dot.removeFromParent();
  marker.ring.removeFromParent();
  marker.dot.material.dispose();
  marker.ring.material.dispose();
}
