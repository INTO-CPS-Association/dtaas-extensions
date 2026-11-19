/**
 * What a shown model adds to the stage: the halo, the edges, the shadows, the
 * grid, the measurement, the drawing on the view, the heat sheet and the walk.
 * Each is beside the model and not part of it, and each is taken down with
 * the model.
 */

import type { Color, Object3D } from 'three';

import { createFieldSheet } from './fieldSheet.js';
import { createGlow } from './glow.js';
import { createGrid } from './grid.js';
import { castShadows } from './look.js';
import { createMeasure } from './measure.js';
import { addOutlines } from './outline.js';
import { PARALLEL_FOV, PERSPECTIVE_FOV, setParallel } from './projection.js';
import type { Scenery } from './renderLoop.js';
import type { SceneView } from './sceneView.js';
import { createSketch } from './sketch.js';
import type { Stage } from './stage.js';
import { BACKDROPS } from './viewState.js';
import { createWalker } from './walkKeys.js';

/** The decorations of one shown model, built once and followed on every frame. */
export interface Decorations {
  readonly sheet: ReturnType<typeof createFieldSheet>;
  readonly measure: ReturnType<typeof createMeasure>;
  /** Everything the loop needs of the model on every frame. */
  scenery(placeMarkers: () => void): Scenery;
  /** Set the lens the state asks for. Walking always looks through the ordinary one. */
  lens(): void;
  dispose(): void;
}

/** The edges of every object, which the loop shows and hides as the camera moves. */
function outlinesOf(view: SceneView) {
  // After the view has found the objects, so the outlines go on exactly what
  // is drawn and nothing else. They are children of their meshes, so the
  // teardown that walks the scene disposes them with everything else.
  addOutlines(view.meshes.values());
  const edges = [...view.meshes.values()].flatMap((mesh) =>
    mesh.children.filter((child) => child.name === 'outline'),
  );
  return (shown: boolean) => edges.forEach((edge) => Object.assign(edge, { visible: shown }));
}

/** Build every decoration of `model` on `stage`, driven by `view`. */
export function decorate(stage: Stage, model: Object3D, view: SceneView): Decorations {
  const { scene, sun, overlay } = stage;
  // The heat sheet and the halo live beside the model and not in it: each is
  // a mark on the building and not part of it, and inside the model it would
  // get the model's transform twice.
  const [sheet, glow] = [createFieldSheet(scene), createGlow(scene)];
  view.attachGlow(glow);
  const showOutlines = outlinesOf(view);
  const dropShadows = castShadows(model, sun, scene);
  const [grid, measure] = [createGrid(scene, model), createMeasure(scene, overlay)];
  const parts = {
    sheet,
    grid,
    measure,
    sketch: createSketch(overlay),
    walker: createWalker(stage, view),
  };
  const lens = () =>
    setParallel(stage.camera, stage.controls, view.state.parallel && !view.state.walking);
  const follow = follower(stage, view, parts, lens);
  return {
    sheet,
    measure,
    lens,
    scenery: (placeMarkers) =>
      sceneryOf(stage, view, { ...parts, follow, showOutlines }, placeMarkers),
    dispose: () => {
      [sheet, glow, grid, measure, parts.sketch, parts.walker].forEach((part) => part.dispose());
      dropShadows();
    },
  };
}

interface Parts {
  readonly grid: ReturnType<typeof createGrid>;
  readonly measure: ReturnType<typeof createMeasure>;
  readonly sketch: ReturnType<typeof createSketch>;
  readonly walker: ReturnType<typeof createWalker>;
}

/** Hand the pen the tool the state asks for, once per change. */
function penFollower(view: SceneView, sketch: Parts['sketch']) {
  let sketching: string | null = null;
  return () => {
    if (view.state.sketching === sketching) return;
    sketching = view.state.sketching;
    sketch.setTool(view.state.sketching);
  };
}

/** Let the walk, the pen, the lens, the background, the grid and the measurement follow the state. */
function follower(stage: Stage, view: SceneView, parts: Parts, lens: () => void) {
  const { camera, flight, scene, parent } = stage;
  const followPen = penFollower(view, parts.sketch);
  return () => {
    parts.walker.frame();
    followPen();
    const { state } = view;
    const wanted = state.parallel && !state.walking ? PARALLEL_FOV : PERSPECTIVE_FOV;
    if (camera.fov !== wanted) {
      // A flight was worked out for the old lens and would pull the camera
      // back to where that lens needed it.
      flight.cancel();
      lens();
    }
    (scene.background as Color).setHex(BACKDROPS[state.backdrop]);
    parts.grid.setVisible(state.grid);
    // Leaving the measuring mode takes the last measurement away with it, and
    // changing the mode starts a new one.
    if (state.measuring !== null) parts.measure.setMode(state.measuring);
    else if (parts.measure.points.length > 0) parts.measure.clear();
    parts.measure.place(camera, parent.clientWidth, parent.clientHeight);
  };
}

/** What the loop reads of the model on every frame. */
function sceneryOf(
  stage: Stage,
  view: SceneView,
  parts: Parts & { follow: () => void; showOutlines: (shown: boolean) => void },
  placeMarkers: () => void,
): Scenery {
  const { renderer } = stage;
  const cutPlanes = () => view.cutPlanes();
  return {
    placeMarkers,
    cutPlanes,
    wantsShadows: () => view.state.shadows,
    wantsOcclusion: () => !view.state.transparent,
    followState: parts.follow,
    visibility: () => view.visibilityRevision,
    showOutlines: parts.showOutlines,
    revision: () =>
      `${view.visibilityRevision}|${view.materialsRevision}|${cutPlanes().length}` +
      `|${renderer.clippingPlanes.map((plane) => plane.constant).join(',')}` +
      `|${view.state.backdrop}|${view.state.grid}|${parts.measure.points.length}` +
      `|${view.state.measuring}`,
  };
}
