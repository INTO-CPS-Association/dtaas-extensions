/**
 * Running the framework-free viewer for the canvas component: mount it, load
 * the model, show it with the sensors the geometry accounts for, report what
 * was placed and take it all down again. Kept out of the component so React
 * holds only the lifecycle and the status it draws.
 */

import { resolveBindings } from '../resolver.js';
import type { Binding } from '../binding.js';
import {
  Viewer,
  type PropertyTree,
  type ViewerEvents,
  type ViewerHandle,
} from '../viewer/index.js';
import { loadModel, type Loaded, type LoadEvents } from './loadModel.js';
import { objectsOf } from './scene.js';

/** What the canvas hands the viewer, as the component's props give it. */
export interface CanvasInput extends ViewerEvents {
  url: string;
  convert?: boolean;
  bindings?: Binding[];
  proposed?: boolean;
  tree?: PropertyTree;
  onReport?: (message: string) => void;
  onReady?: (handle: ViewerHandle) => void;
  onConverted?: LoadEvents['onConverted'];
  onSourceBytes?: LoadEvents['onSourceBytes'];
}

/** "1 sensor", "2 sensors". Written out because "1 sensors" reads as a bug. */
function plural(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

/**
 * What the page says about the sensors it placed. Bindings that resolve to
 * nothing are counted and reported instead of dropped, because a manifest
 * pointing at an object the model does not have is the ordinary consequence
 * of a re-export, and a view that silently draws four markers where the
 * manifest asked for six is worse than one that says which two are missing.
 */
export function placementReport(
  bindings: readonly Binding[],
  placed: number,
  missing: number,
  proposed: boolean,
): string | undefined {
  if (bindings.length === 0) return undefined;
  const kind = proposed ? 'proposed sensor' : 'sensor';
  if (missing === 0) return `${placed} ${plural(kind, placed)} placed on the model.`;
  return (
    `${placed} of ${bindings.length} ${plural(kind, bindings.length)} placed. ` +
    `${missing} name an object this geometry does not have.`
  );
}

/** What the canvas shows while the model is not drawn yet. */
export interface Status {
  loading: boolean;
  problem: string | null;
  progress: string | null;
}

/**
 * Mount a viewer in `parent`, load the model and show it. Returns the
 * function that takes it all down again.
 */
export function startViewer(
  parent: HTMLElement,
  props: Readonly<CanvasInput>,
  setStatus: (status: Partial<Status>) => void,
): () => void {
  const alive = { current: true };
  const viewer = new Viewer();
  viewer.mount(parent, { onHover: props.onHover, onSelect: props.onSelect });
  const events: LoadEvents = {
    current: () => alive.current,
    progress: (progress: string) => setStatus({ progress }),
    onSourceBytes: props.onSourceBytes,
    onConverted: props.onConverted,
  };
  loadModel(props.url, props.convert ?? false, events).then(
    (loaded) => loaded && alive.current && showLoaded(viewer, loaded, props, setStatus),
    // A library's own message names internal URLs and internal state, so what
    // reaches the page is a fact about the file instead.
    (error: Error) =>
      alive.current && setStatus({ problem: error.message, loading: false, progress: null }),
  );
  return () => {
    alive.current = false;
    viewer.unmount();
  };
}

/** Draw a loaded model with the sensors the geometry can account for, and say so. */
function showLoaded(
  viewer: Viewer,
  { model, note }: Loaded,
  props: Readonly<CanvasInput>,
  setStatus: (status: Partial<Status>) => void,
) {
  const bindings = props.bindings ?? [];
  const { resolved, unresolved } = resolveBindings(bindings, objectsOf(model));
  props.onReady?.(viewer.show(model, { placed: resolved, tree: props.tree }));
  setStatus({ loading: false, progress: null });
  const proposed = props.proposed ?? false;
  const sensors = placementReport(bindings, resolved.length, unresolved.length, proposed);
  const both = [note, sensors].filter(Boolean).join(' ');
  if (both) props.onReport?.(both);
}
