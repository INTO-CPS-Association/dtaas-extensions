/**
 * What the viewer tests share: a renderer that records instead of drawing,
 * a frame clock the test advances by hand and a small building to show.
 *
 * jsdom has no WebGL, so the renderer and the occlusion pass are stand-ins.
 * Everything else, the scene, the camera, the controls, the rays and the
 * markers, is the real three.js.
 */

import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';

let pending: FrameRequestCallback | undefined;

/** Run the frame the loop asked for, `ms` after the last one. */
export function nextFrame(ms = 16): void {
  const run = pending;
  pending = undefined;
  jest.advanceTimersByTime(ms);
  run?.(performance.now());
}

/** A stand-in clock and frame scheduler, and stand-ins for what jsdom lacks. */
export function installBrowser(): void {
  jest.useFakeTimers({ now: 1_000_000 });
  globalThis.requestAnimationFrame = (callback) => {
    pending = callback;
    return 1;
  };
  globalThis.ResizeObserver = class {
    observe = jest.fn();
    disconnect = jest.fn();
  } as unknown as typeof ResizeObserver;
  // jsdom draws on no canvas and says so on every call. The sketch copes with no pen.
  HTMLCanvasElement.prototype.getContext = jest.fn(() => null);
  // A system that asks for less motion gets the jump, so a test sees the shot at once.
  globalThis.matchMedia = jest.fn(() => ({ matches: true })) as unknown as typeof matchMedia;
}

/** A positioned box of 200 by 100 pixels for the viewer to fill. */
export function holder(): HTMLElement {
  const parent = document.createElement('div');
  Object.defineProperty(parent, 'clientWidth', { value: 200 });
  Object.defineProperty(parent, 'clientHeight', { value: 100 });
  parent.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 }) as DOMRect;
  document.body.append(parent);
  return parent;
}

function box(globalId: string, ifcClass: string, x: number): Mesh {
  const mesh = new Mesh(new BoxGeometry(1, 3, 1), new MeshStandardMaterial());
  mesh.position.set(x, 1.5, 0);
  mesh.userData = { globalId, ifcClass };
  return mesh;
}

/** Two walls a metre apart, wall-a on the left and wall-b on the right. */
export function building(): Group {
  const model = new Group();
  model.add(box('wall-a', 'IfcWall', -1), box('wall-b', 'IfcWall', 1));
  model.updateMatrixWorld(true);
  return model;
}

/** A binding of the sensor on one wall. */
export function bindingOn(globalId: string) {
  return {
    selector: { globalId },
    label: `Sensor on ${globalId}`,
    source: { live: { transport: 'mqtt' as const, topic: `t/${globalId}` } },
    display: { unit: '°C', ramp: [18, 26] as [number, number] },
  };
}
