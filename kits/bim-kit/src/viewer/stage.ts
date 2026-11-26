/**
 * The parts of a 3D view that exist before any model does: the renderer, the
 * scene with its lamps, the camera, the orbit controls, the axes indicator,
 * the view cube and the layer the labels sit on.
 *
 * Framework free, so the Buildings page and the `aec` substrate draw with the
 * same code. `dispose` gives the WebGL context back. Browsers keep a small
 * number of them, so a view that leaks one on every visit stops drawing after
 * a handful.
 */

import {
  AmbientLight,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { createFlight, type Flight } from './flight.js';
import { FAR_PLANE, NEAR_PLANE } from './framing.js';
import { createGizmo, type Gizmo } from './gizmo.js';
import { createFinish, createSection, lightFromRoom, prepareRenderer } from './look.js';
import { createViewCube, type ViewCube } from './viewCube.js';
import { BACKDROPS } from './viewState.js';

/** How strong the two lamps are. See where they are added for why. */
const AMBIENT_LIGHT = 0.25;
const SUN_LIGHT = 1.8;

// 45 degrees, matching the viewer this was taken from. A wider lens bends the
// walls of a room outwards and a building stops looking square.
const FIELD_OF_VIEW = 45;

export interface Stage {
  readonly parent: HTMLElement;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;
  readonly controls: OrbitControls;
  readonly flight: Flight;
  readonly sun: DirectionalLight;
  readonly finish: Finish;
  readonly section: ReturnType<typeof createSection>;
  readonly gizmo: Gizmo;
  readonly cube: ViewCube;
  /** A layer over the canvas for the labels, which never takes a click. */
  readonly overlay: HTMLElement;
  /** Fit the drawing to the size of `parent`. */
  resize(): void;
  dispose(): void;
}

/**
 * Two lamps and the room light of `lightFromRoom`, and their strengths
 * matter more than they look. Too much in total clips every pale surface to
 * the same flat white, so the model reads as untextured. The room light lifts
 * the faces the sun misses, so the ambient lamp is low and the sun carries
 * the contrast between faces.
 */
function lightScene(scene: Scene): DirectionalLight {
  scene.background = new Color(BACKDROPS.light);
  scene.add(new AmbientLight(0xffffff, AMBIENT_LIGHT));
  const sun = new DirectionalLight(0xffffff, SUN_LIGHT);
  // Above and behind, to the left of the default corner view. The faces a
  // person sees are lit differently from each other, and the shadow of the
  // building falls towards the viewer's side, where it can be seen.
  sun.position.set(-6, 10, 3);
  scene.add(sun);
  // The target is what the sun points at. It has to be in the scene for a
  // move of it to change the direction the shadows fall in.
  scene.add(sun.target);
  return sun;
}

/** A renderer whose canvas fills `parent` and never decides its size. */
function createRenderer(parent: HTMLElement): WebGLRenderer {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(globalThis.devicePixelRatio);
  // The canvas is sized by CSS and drawn at the size `setSize` is given.
  // Without this it takes its CSS size from its pixel size, which on a retina
  // screen is twice the box it sits in, and the page grows sideways around it.
  Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%' });
  parent.appendChild(renderer.domElement);
  // Soft light from every side, shadows, occlusion in the creases and the
  // section plane: what makes a model read as a building. See `look.ts`.
  prepareRenderer(renderer);
  return renderer;
}

function createOverlay(parent: HTMLElement): HTMLElement {
  const overlay = parent.ownerDocument.createElement('div');
  overlay.setAttribute('style', 'position:absolute;inset:0;overflow:hidden;pointer-events:none');
  overlay.dataset.testid = 'bim-labels';
  parent.appendChild(overlay);
  return overlay;
}

/** Orbit controls whose camera a person can take over from a flight at once. */
function steer(camera: PerspectiveCamera, renderer: WebGLRenderer) {
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  // A change of shot asked for by a button, a key or a sensor card flies
  // there. A person who grabs the view mid-flight takes it over at once.
  const flight = createFlight(camera, controls);
  controls.addEventListener('start', () => flight.cancel());
  return { controls, flight };
}

/** Give back every geometry and material the scene still holds. */
function emptyScene(scene: Scene): void {
  scene.traverse((object) => {
    const mesh = object as { geometry?: { dispose: () => void }; material?: unknown };
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      (material as { dispose?: () => void } | undefined)?.dispose?.();
    }
  });
}

type Finish = ReturnType<typeof createFinish>;

/** Fit the drawing to the size of `parent`. */
function sizer(
  parent: HTMLElement,
  renderer: WebGLRenderer,
  finish: Finish,
  camera: PerspectiveCamera,
) {
  return () => {
    const { clientWidth, clientHeight } = parent;
    if (clientWidth === 0 || clientHeight === 0) return;
    // `false` leaves the CSS size alone, which is what keeps the canvas
    // inside its box instead of the box growing to fit the canvas.
    renderer.setSize(clientWidth, clientHeight, false);
    finish.setSize(clientWidth, clientHeight);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  };
}

/** Take the stage down in the reverse order of building it. */
function disposer(stage: Omit<Stage, 'dispose' | 'resize'>, dropRoomLight: () => void) {
  return () => {
    stage.finish.dispose();
    stage.cube.dispose();
    dropRoomLight();
    stage.overlay.remove();
    stage.controls.dispose();
    emptyScene(stage.scene);
    stage.gizmo.dispose();
    stage.renderer.dispose();
    stage.renderer.forceContextLoss();
    stage.renderer.domElement.remove();
  };
}

/** Build the stage inside `parent`, which must be positioned for the overlay. */
export function createStage(parent: HTMLElement): Stage {
  const scene = new Scene();
  const sun = lightScene(scene);
  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, NEAR_PLANE, FAR_PLANE);
  const renderer = createRenderer(parent);
  const dropRoomLight = lightFromRoom(renderer, scene);
  const finish = createFinish(renderer, scene, camera);
  const { controls, flight } = steer(camera, renderer);
  const parts = {
    ...{ parent, scene, camera, renderer, controls, flight, sun, finish },
    section: createSection(renderer),
    // The axes indicator and the view cube are drawn after the model on every
    // frame, so they sit over the view instead of in it.
    gizmo: createGizmo(),
    cube: createViewCube(),
    overlay: createOverlay(parent),
  };
  const resize = sizer(parent, renderer, finish, camera);
  resize();
  return { ...parts, resize, dispose: disposer(parts, dropRoomLight) };
}
