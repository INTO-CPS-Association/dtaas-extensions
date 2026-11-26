/**
 * The three.js layer: what a model looks like and what is visible.
 *
 * Kept apart from `./react` so a consumer that draws its own interface, or none at all, never pulls React and MUI in behind it. three.js is a peer dependency of this entry point and of `./react`, and of nothing else.
 */

export {
  SceneView,
  CUT_STEP_M,
  BACKDROPS,
  type Backdrop,
  type ObjectFacts,
  type PropertyTree,
  type ViewState,
} from './sceneView.js';
export {
  Palette,
  SHELL,
  SELECTED_COLOUR,
  HOVERED_COLOUR,
  MONO_COLOUR,
  CLASS_COLOURS,
  type ModelStyle,
} from './appearance.js';
export { SHORTCUTS, handleKey, type Shortcut, type ShortcutContext } from './shortcuts.js';
export { sizeText } from './sceneFacts.js';
export {
  createGizmo,
  cornerViewport,
  GIZMO_SIZE_PX,
  GIZMO_MARGIN_PX,
  type Gizmo,
} from './gizmo.js';
export { addOutlines } from './outline.js';
export {
  createGrid,
  gridSpan,
  GRID_CELL_M,
  GRID_MAJOR_EVERY,
  GRID_MIN_SPAN_M,
  GRID_MARGIN,
  GRID_DROP_M,
  type Grid,
} from './grid.js';
export {
  createFlight,
  ease,
  movedBeyond,
  prefersReducedMotion,
  FLIGHT_MS,
  type Flight,
  type Steered,
} from './flight.js';
export {
  createViewCube,
  cubeViewport,
  directionAt,
  CUBE_SIZE_PX,
  CUBE_MARGIN_PX,
  CUBE_EDGE,
  CUBE_FACES,
  type ViewCube,
} from './viewCube.js';
export {
  createSketch,
  drawStroke,
  arrowHead,
  SKETCH_COLOUR,
  SKETCH_FONT,
  SKETCH_WIDTH_PX,
  ARROW_HEAD_PX,
  type Sketch,
  type SketchTool,
  type Stroke,
  type Point,
  type Pen,
} from './sketch.js';
export {
  startWalking,
  stepWalk,
  walkKeyOf,
  EYE_HEIGHT_M,
  WALK_SPEED_M_S,
  TURN_SPEED_DEG_S,
  LOOK_AHEAD_M,
  type WalkKeys,
  type WalkControls,
} from './walkMode.js';
export { setParallel, backOff, PERSPECTIVE_FOV, PARALLEL_FOV, type Orbit } from './projection.js';
export {
  groupEntries,
  matches,
  readableClass,
  NO_FLOOR,
  type TreeEntry,
  type TreeGroup,
  type GroupBy,
} from './modelTree.js';
export { createMeasure, END_DOT_PX, MAX_POINTS, CLOSE_M, type Measure } from './measure.js';
export {
  distanceText,
  polygonArea,
  angleAt,
  measureText,
  type MeasureMode,
} from './measureMaths.js';
export {
  prepareRenderer,
  lightFromRoom,
  castShadows,
  createSection,
  createFinish,
  SHADOW_MAP_PX,
  ROOM_LIGHT,
  GROUND_SHADOW_OPACITY,
  GROUND_MARGIN,
  GROUND_DROP_M,
  type Clipped,
} from './look.js';
export { createGlow, GLOW_MARGIN_M, type Glow } from './glow.js';
export {
  buildField,
  MIN_ROOM_CELLS,
  OUTSIDE,
  sourceAt,
  planAngle,
  CELL_M,
  CUT_M,
  BLOCKS,
  OPENS,
  SEARCH_CELLS,
  type Field,
} from './field.js';
export { toGrid, fromGrid } from './planFrame.js';
export { outsideOf } from './walk.js';
export { createFieldSheet, type FieldSheet } from './fieldSheet.js';
export {
  frame,
  frameFrom,
  frameObject,
  LOOK_FROM,
  NEAR_PLANE,
  FAR_PLANE,
  MIN_FRAME_RADIUS_M,
  type Target,
  type LookFrom,
} from './framing.js';
export { createMarkers, MARKER_LAYER, type MarkerHandle, type MarkerSet } from './markers.js';
export {
  Viewer,
  type Placed,
  type ShowOptions,
  type ViewerEvents,
  type ViewerHandle,
} from './viewer.js';
export { loadGlb } from './loadGlb.js';
export { addMissingNormals } from './normals.js';
export {
  markerScale,
  markerColour,
  labelText,
  worldPerPixel,
  pulseFactor,
  PULSE_MS,
  PULSE_GROWTH,
  MARKER_MIN_PX,
  SELECTED_MARKER_MIN_PX,
  NO_READING_COLOUR,
} from './markerStyle.js';
export {
  toScreen,
  spreadLabels,
  LABEL_OFFSET_PX,
  LABEL_GAP_PX,
  type LabelBox,
  type ScreenPoint,
} from './markerLabels.js';
