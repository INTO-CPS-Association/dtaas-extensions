/**
 * The 3D canvas, kept in its own chunk.
 *
 * three.js is around 600 KB before the loaders, and the client already gates
 * bundle size through `yarn analyze`. Every other route is imported eagerly,
 * so this is the one that must not be: it is loaded through `React.lazy` from
 * `Bim.tsx` and reaches the browser only when someone opens a model.
 *
 * The drawing itself is the framework-free `Viewer` of `../viewer`, which the
 * `aec` substrate draws with too. This component mounts it, loads the model,
 * reports what it placed and unmounts it, which gives the WebGL context back.
 *
 * What is drawn on the model comes from the manifest, through
 * `@into-cps-association/bim-kit`. This file holds no opinion about
 * what a binding looks like, which is the point of that package existing.
 */

import { useEffect, useRef, useState, type RefObject } from 'react';
import { Alert, Box, CircularProgress, Typography, type Theme } from '@mui/material';
import type { Binding } from '../binding.js';
import type { PropertyTree, ViewerHandle } from '../viewer/index.js';
import { startViewer, type Status } from './canvasViewer.js';

export type { ViewerHandle } from '../viewer/index.js';
export { placementReport } from './canvasViewer.js';

export interface BimCanvasProps {
  /**
   * Where the geometry is served from.
   *
   * A `.glb` is loaded. Anything else is treated as an IFC file and converted
   * in the browser first, which takes a moment and reports progress. The two
   * produce the same shape of scene, so nothing below this line knows which it
   * got.
   */
  url: string;
  /** True when `url` names an IFC file instead of converted geometry. */
  convert?: boolean;
  /** The bindings to draw on it. Empty when the model declares no sensors. */
  bindings?: Binding[];
  /**
   * Whether the manifest says its placements were proposed instead of
   * surveyed. A proposed position is a guess a tool made, and reporting it as
   * a fact is how a guess ends up in a report as a measurement.
   */
  proposed?: boolean;
  /** What the model says each object is, so a floor filter and a heatmap have something to group by. */
  tree?: PropertyTree;
  /** Reported so the page can say what it could not do. */
  onReport?: (message: string) => void;
  /**
   * Handed the loaded model and the camera commands, once it is ready.
   *
   * This is how a page drives the viewer: it holds the `SceneView`, changes its state, and calls `refresh`. Nothing here owns an interface.
   */
  onReady?: (handle: ViewerHandle) => void;
  /** Told which object the cursor is over, and which is selected. */
  onHover?: (globalId: string | null) => void;
  onSelect?: (globalId: string | null) => void;
  /**
   * Handed the converted geometry as a GLB, once, when `convert` was true and
   * the conversion succeeded. It is the model on its own, before any marker or
   * outline is added, so it is the same shape a GLB produced outside the
   * browser has. A host that wants to store the result so the model is not
   * reconverted on the next visit reads it here. Nothing is stored when this is
   * absent, and a host that stores it decides where, because this knows nothing
   * about where the model's files live.
   */
  onConverted?: (glb: Uint8Array) => void;
  /**
   * Handed the bytes of the IFC file when `convert` is true, as soon as they
   * arrive and before they are converted, so the page can hash the file it
   * actually loaded without downloading it a second time.
   */
  onSourceBytes?: (bytes: Uint8Array) => void;
}

/**
 * The holder of the canvas, which also carries the colours of the marker
 * labels, taken from the host's theme so a label reads in a light and in a
 * dark theme alike.
 */
const labelColours = (theme: Theme) =>
  ({
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    '--bim-label-bg': theme.palette.background.paper,
    '--bim-label-fg': theme.palette.text.primary,
    '--bim-label-border': theme.palette.text.secondary,
    '--bim-label-accent': theme.palette.primary.main,
  }) as const;

/** The spinner while the model loads and what went wrong when it did not. */
function CanvasStatus({ loading, problem, progress }: Readonly<Status>) {
  if (problem) {
    return (
      <Alert severity="error" sx={{ position: 'absolute', top: 16, left: 16, right: 16 }}>
        {problem}
      </Alert>
    );
  }
  if (!loading) return null;
  return (
    <Box sx={SPINNER}>
      <CircularProgress />
      {progress && <Typography variant="body2">{progress}</Typography>}
    </Box>
  );
}

const SPINNER = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 1,
} as const;

/** The canvas must never decide the size of the page. */
const FRAME = {
  position: 'relative',
  width: '100%',
  height: '70vh',
  minHeight: 360,
  overflow: 'hidden',
} as const;

/** Run a viewer in `holder` for as long as the props stay the same and say how it went. */
function useViewer(holder: RefObject<HTMLDivElement | null>, props: Readonly<BimCanvasProps>) {
  const [status, setFullStatus] = useState<Status>({
    loading: true,
    problem: null,
    progress: null,
  });
  const { url, convert, bindings, proposed, tree, onReport, onReady, onHover, onSelect } = props;
  const { onConverted, onSourceBytes } = props;
  useEffect(() => {
    const parent = holder.current;
    if (!parent) return undefined;
    const setStatus = (next: Partial<Status>) => setFullStatus((now) => ({ ...now, ...next }));
    const input = { url, convert, bindings, proposed, tree, onReport, onReady, onHover, onSelect };
    return startViewer(parent, { ...input, onConverted, onSourceBytes }, setStatus);
    // Every prop is listed: a change of any of them draws the model again.
  }, [
    holder,
    url,
    convert,
    bindings,
    proposed,
    tree,
    onReport,
    onReady,
    onHover,
    onSelect,
    onConverted,
    onSourceBytes,
  ]);
  return status;
}

function BimCanvas(props: Readonly<BimCanvasProps>) {
  const holder = useRef<HTMLDivElement>(null);
  const status = useViewer(holder, props);
  return (
    <Box sx={FRAME}>
      <Box ref={holder} sx={labelColours} data-testid="bim-canvas" />
      <CanvasStatus {...status} />
    </Box>
  );
}

export default BimCanvas;
