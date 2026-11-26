/**
 * How a sensor marker looks: its size on screen, its pulse when picked, its
 * colour and the text of its label. Pure functions and constants, with no
 * three.js objects.
 */

import { valueText } from '../alerts.js';
import { displayOf, idOf, type Binding } from '../binding.js';
import { rampColour } from '../ramp.js';
import { isLive, DEFAULT_STALE_AFTER_S, type FeedState, type Reading } from '../readings.js';

/** Pixels across a marker at its smallest. */
export const MARKER_MIN_PX = 14;
/** Pixels across the selected marker at its smallest, so the one a person picked stands out. */
export const SELECTED_MARKER_MIN_PX = 24;
/**
 * The colour of a sensor with no current reading. Off the ramp, so it cannot
 * be mistaken for a value and the same grey the card uses for a stale one.
 */
export const NO_READING_COLOUR = 0x9aa3ad;

/** How long the selected marker pulses after it is picked, in milliseconds. */
export const PULSE_MS = 900;

/** How much larger the marker grows at the height of its pulse. */
export const PULSE_GROWTH = 0.6;

/**
 * The size of a pulsing marker against its resting size, `elapsedMs` after it
 * was picked: it grows once and settles back, so the eye goes to it.
 */
export function pulseFactor(elapsedMs: number): number {
  if (!(elapsedMs >= 0) || elapsedMs >= PULSE_MS) return 1;
  return 1 + PULSE_GROWTH * Math.sin(Math.PI * (elapsedMs / PULSE_MS));
}
/** The size of one screen pixel, in metres, at `distance` from the camera. */
export function worldPerPixel(distance: number, fovDegrees: number, heightPx: number): number {
  if (heightPx <= 0) return 0;
  return (2 * distance * Math.tan((fovDegrees * Math.PI) / 360)) / heightPx;
}

/**
 * The scale a marker of `radius` metres needs to be at least `minPx` pixels
 * across. Never below 1, so a marker seen close keeps its own size.
 */
export function markerScale(
  radius: number,
  distance: number,
  fovDegrees: number,
  heightPx: number,
  minPx: number,
): number {
  const wanted = (minPx / 2) * worldPerPixel(distance, fovDegrees, heightPx);
  return Math.max(1, wanted / radius);
}

/** A marker's colour: its value on the ramp while current, grey otherwise. */
export function markerColour(
  binding: Binding,
  reading: Reading | undefined,
  feed: FeedState,
  staleAfter = DEFAULT_STALE_AFTER_S,
  now = Date.now(),
): number {
  const ramp = displayOf(binding).ramp;
  if (!ramp || !reading || !isLive(reading, feed, staleAfter, now)) return NO_READING_COLOUR;
  return rampColour(reading.value, ramp[0], ramp[1]);
}

/** The text of a marker's label: its short tag and its value. */
export function labelText(binding: Binding, reading: Reading | undefined): string {
  return `${idOf(binding)}  ${valueText(binding, reading)}`;
}
