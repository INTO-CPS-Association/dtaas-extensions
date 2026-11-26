/**
 * What the tests of a mounted `aec` pane share: the stand-ins of the viewer
 * tests for the renderer and the frame clock, a pane with a size, a building
 * of two floors with its property tree and a substrate mounted on it.
 */

import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { fakeHostServices } from '@into-cps-association/dtaas-extensions/testing';
import createAecSubstrate from 'src/aec/aecSubstrate';
import { installBrowser, nextFrame } from '../viewer/viewerSetup';

export { nextFrame };

function box(globalId: string, ifcClass: string, x: number, y: number): Mesh {
  const mesh = new Mesh(new BoxGeometry(1, 3, 1), new MeshStandardMaterial({ color: 0x808080 }));
  mesh.position.set(x, y + 1.5, 0);
  mesh.userData = { globalId, ifcClass };
  return mesh;
}

/**
 * Two walls on the ground floor, wall-a on the left and wall-b on the right
 * as seen from above and a column on the floor above, out to the side.
 */
export function building(): Group {
  const model = new Group();
  model.add(box('wall-a', 'IfcWall', -1, 0), box('wall-b', 'IfcWall', 1, 0));
  model.add(box('column-c', 'IfcColumn', 6, 3.5));
  model.updateMatrixWorld(true);
  return model;
}

export const TREE = {
  storeys: [{ name: 'L1' }, { name: 'L2' }],
  objects: {
    'wall-a': { name: 'West wall', ifcClass: 'IfcWall', storey: 'L1' },
    'wall-b': {
      name: 'East wall',
      ifcClass: 'IfcWall',
      storey: 'L1',
      predefinedType: 'NOTDEFINED',
      properties: { Pset_WallCommon: { FireRating: 'EI60' } },
    },
    'column-c': { name: 'Column', ifcClass: 'IfcColumn', storey: 'L2' },
  },
};

/** The browser stand-ins, with every element 200 by 100 pixels at the top left. */
export function installPane(): void {
  installBrowser();
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 200,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 100,
  });
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 }) as DOMRect;
  globalThis.fetch = jest.fn(async () => ({ ok: true, json: async () => TREE })) as never;
}

/** A substrate mounted on the building, in a container in the page. */
export async function mounted() {
  const adapter = createAecSubstrate(fakeHostServices());
  const container = document.createElement('div');
  document.body.append(container);
  await adapter.mount(container, { adapter: 'aec', source: 'room.ifc' });
  nextFrame();
  const frame = container.querySelector('[aria-label="Building model"]') as HTMLElement;
  return { adapter, container, frame };
}

/** Press a key on the pane and say whether the pane took it. */
export function press(frame: HTMLElement, key: string, target: HTMLElement = frame): boolean {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

export const ANCHOR = { signalPath: 'site/room/seat/temperature', kind: 'ifc-guid', ref: 'wall-b' };
