/**
 * Walking through a model with the arrow keys held down.
 *
 * The camera is put at eye height once, on the frame walking starts, and
 * steps on every frame after it for as long as an arrow is held.
 */

import type { SceneView } from './sceneView.js';
import type { Stage } from './stage.js';
import { startWalking, stepWalk, walkKeyOf, type WalkKeys } from './walkMode.js';

/** The longest step one frame takes, in seconds, so a stalled frame does not leap through a wall. */
const MAX_STEP_S = 0.1;

const TYPING = ['INPUT', 'TEXTAREA', 'SELECT'];

export interface Walker {
  /** Start, stop or step the walk for the frame about to be drawn. */
  frame(): void;
  dispose(): void;
}

/** Let go of every arrow. */
function release(held: WalkKeys): void {
  Object.assign(held, { forward: false, back: false, left: false, right: false });
}

/** Whether a key press belongs to a field a person types in. */
function typingIn(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(element && (element.isContentEditable || TYPING.includes(element.tagName)));
}

/** Hold and let go of the arrows and forget them all when the window loses the keys. */
function listenForArrows(view: SceneView, held: WalkKeys): () => void {
  const onArrow = (down: boolean) => (event: KeyboardEvent) => {
    const which = walkKeyOf(event.key);
    if (!which || !view.state.walking) return;
    // An arrow in a search box moves the caret and not the person.
    if (down && typingIn(event.target)) return;
    held[which] = down;
    // The page would scroll on an arrow key otherwise.
    event.preventDefault();
  };
  const letGo = () => release(held);
  const [arrowDown, arrowUp] = [onArrow(true), onArrow(false)];
  globalThis.addEventListener('keydown', arrowDown);
  globalThis.addEventListener('keyup', arrowUp);
  // A key let go while the window is not in front never sends its keyup, and
  // the person would keep walking.
  globalThis.addEventListener('blur', letGo);
  globalThis.document?.addEventListener('visibilitychange', letGo);
  return () => {
    globalThis.removeEventListener('keydown', arrowDown);
    globalThis.removeEventListener('keyup', arrowUp);
    globalThis.removeEventListener('blur', letGo);
    globalThis.document?.removeEventListener('visibilitychange', letGo);
  };
}

export function createWalker(stage: Stage, view: SceneView): Walker {
  const { camera, controls, flight } = stage;
  const held: WalkKeys = { forward: false, back: false, left: false, right: false };
  const stopListening = listenForArrows(view, held);
  let wasWalking = false;
  let lastStep = performance.now();
  const frame = () => {
    const now = performance.now();
    const seconds = Math.min((now - lastStep) / 1000, MAX_STEP_S);
    lastStep = now;
    const { walking } = view.state;
    if (walking && !wasWalking) {
      flight.cancel();
      startWalking(camera, controls, view.floorLevel());
    }
    if (!walking && wasWalking) release(held);
    wasWalking = walking;
    // Zoom and pan would carry the eye through walls and off the floor.
    controls.enableZoom = !walking;
    controls.enablePan = !walking;
    if (walking) stepWalk(camera, controls, held, seconds);
  };
  return { frame, dispose: stopListening };
}
