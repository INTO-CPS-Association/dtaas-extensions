/**
 * Getting the geometry of a model for the canvas: a GLB as it is, or an IFC
 * file converted in the browser. The two produce the same shape of scene, so
 * nothing after this knows which it got.
 */

import type { Object3D } from 'three';

import { loadGlb } from '../viewer/index.js';
import { exportGlb } from './exportGlb.js';

/** What the canvas hears while a model loads. */
export interface LoadEvents {
  /** False once the canvas has gone, so nothing is reported to a page that left. */
  current(): boolean;
  /** What the load is doing now, for the spinner to say. */
  progress(text: string): void;
  /** The bytes of the IFC file, before they are converted. */
  onSourceBytes?: (bytes: Uint8Array) => void;
  /** The converted geometry as a GLB, the model alone, before anything is added to it. */
  onConverted?: (glb: Uint8Array) => void;
}

/** A loaded model and what the page should say about how it was loaded. */
export interface Loaded {
  model: Object3D;
  note?: string;
}

/**
 * Store the geometry before the scene decorates the model. The canvas adds
 * markers and outlines to it, and the stored GLB has to be the model alone so
 * it reloads as the same shape a GLB from outside the browser has. This is
 * best-effort: a failed export leaves the drawing untouched, and the model
 * simply reconverts next time instead of loading a file that was never written.
 */
async function store(model: Object3D, events: LoadEvents): Promise<void> {
  if (!events.onConverted) return;
  try {
    const glb = await exportGlb(model);
    if (events.current()) events.onConverted(glb);
  } catch {
    // Persistence is an optimisation, not a requirement for drawing.
  }
}

/** Fetch an IFC file and convert it, reporting the progress. */
async function convertFrom(url: string, events: LoadEvents): Promise<Loaded | null> {
  // Loaded only here, so the WebAssembly parser, which is over a megabyte,
  // reaches a browser only when a model actually has to be converted.
  const [{ convertIfc }, { meshesFrom }] = await Promise.all([
    import('../converter.js'),
    import('./ifcMeshes.js'),
  ]);
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error(`the file returned HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!events.current()) return null;
  events.onSourceBytes?.(bytes);
  events.progress('Converting');
  const onProgress = (done: number) => {
    if (events.current() && done % 250 === 0) events.progress(`Converting, ${done} objects`);
  };
  const converted = await convertIfc(bytes, { onProgress });
  const dropped =
    converted.failed === 0 ? '' : ` ${converted.failed} could not be turned into geometry.`;
  const model = meshesFrom(converted);
  await store(model, events);
  return {
    model,
    note: `Converted in the browser: ${converted.objects.length} objects.${dropped}`,
  };
}

/**
 * The model at `url`, or null when the canvas went away meanwhile. Rejects
 * with a message about the file, since a library's own message names
 * internal URLs and internal state.
 */
export async function loadModel(
  url: string,
  convert: boolean,
  events: LoadEvents,
): Promise<Loaded | null> {
  if (!convert) {
    return loadGlb(url).then(
      (model) => ({ model }),
      () => Promise.reject(new Error('The geometry could not be read. It may be incomplete.')),
    );
  }
  events.progress('Reading the IFC file');
  return convertFrom(url, events).catch((error: Error) =>
    Promise.reject(new Error(`This model could not be converted. ${error.message}`)),
  );
}
