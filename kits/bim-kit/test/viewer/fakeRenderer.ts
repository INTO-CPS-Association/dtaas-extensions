/**
 * A renderer that records instead of drawing, since jsdom has no WebGL. Kept
 * apart from three.js, so a mock of three can build it.
 */

/** Every call made on the stand-in renderer, by method name. */
export const rendererCalls = new Map<string, jest.Mock>();

/** A renderer whose every method is a mock, with the few fields the code reads. */
export function fakeRenderer() {
  const fields: Record<string, unknown> = {
    domElement: document.createElement('canvas'),
    shadowMap: { enabled: false, needsUpdate: false },
    clippingPlanes: [],
    autoClear: true,
    localClippingEnabled: false,
  };
  return new Proxy(fields, {
    get(target, name: string) {
      if (name in target) return target[name];
      if (!rendererCalls.has(name)) rendererCalls.set(name, jest.fn());
      return rendererCalls.get(name);
    },
  });
}
