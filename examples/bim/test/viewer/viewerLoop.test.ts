import { Vector3 } from 'three';
import { Viewer } from 'src/viewer/viewer';
import { rendererCalls } from './fakeRenderer';
import { bindingOn, building, holder, installBrowser, nextFrame } from './viewerSetup';

jest.mock('three', () => {
  const { fakeRenderer } = jest.requireActual('./fakeRenderer');
  return { ...jest.requireActual('three'), WebGLRenderer: jest.fn(() => fakeRenderer()) };
});

const mockFinish = { render: jest.fn(), setSize: jest.fn(), dispose: jest.fn() };
jest.mock('src/viewer/look', () => ({
  ...jest.requireActual('src/viewer/look'),
  prepareRenderer: jest.fn(),
  lightFromRoom: jest.fn(() => jest.fn()),
  createFinish: jest.fn(() => mockFinish),
}));

beforeEach(() => {
  installBrowser();
  rendererCalls.clear();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
  document.body.innerHTML = '';
});

function shown() {
  const parent = holder();
  const viewer = new Viewer();
  viewer.mount(parent);
  const model = building();
  const handle = viewer.show(model, { from: 'front' });
  nextFrame();
  return { parent, viewer, model, handle };
}

/** Where the camera is, as a plain copy. */
const cameraOf = (viewer: Viewer) =>
  (viewer as unknown as { stage: { camera: { position: Vector3 } } }).stage.camera.position.clone();

describe('the frame loop of the viewer', () => {
  it('stops drawing a view nobody touches, and draws again once a second', () => {
    const { viewer } = shown();
    for (let i = 0; i < 20; i += 1) nextFrame();
    const settled = mockFinish.render.mock.calls.length;
    nextFrame();
    expect(mockFinish.render).toHaveBeenCalledTimes(settled);
    nextFrame(1100);
    expect(mockFinish.render).toHaveBeenCalledTimes(settled + 1);
    viewer.unmount();
  });

  it('draws every frame for a moment after a person does something', () => {
    const { viewer } = shown();
    for (let i = 0; i < 20; i += 1) nextFrame();
    const settled = mockFinish.render.mock.calls.length;
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    nextFrame();
    nextFrame();
    expect(mockFinish.render).toHaveBeenCalledTimes(settled + 2);
    viewer.unmount();
  });

  it('draws a still view again when what it shows changes', () => {
    const { viewer, handle } = shown();
    for (let i = 0; i < 20; i += 1) nextFrame();
    const settled = mockFinish.render.mock.calls.length;
    handle.view.state.transparent = true;
    handle.view.refresh();
    nextFrame();
    expect(mockFinish.render).toHaveBeenLastCalledWith(false);
    expect(mockFinish.render).toHaveBeenCalledTimes(settled + 1);
    viewer.unmount();
  });
});

describe('the commands of a shown model', () => {
  it('looks from a named side and fits the whole model again', () => {
    const { viewer, handle } = shown();
    handle.look('top');
    expect(cameraOf(viewer).y).toBeGreaterThan(5);
    handle.frame();
    const corner = cameraOf(viewer);
    expect(corner.x).toBeGreaterThan(0);
    expect(corner.z).toBeGreaterThan(0);
    viewer.unmount();
  });

  it('frames the selection, and nothing when none is selected', () => {
    const { viewer, handle } = shown();
    const before = cameraOf(viewer);
    handle.frameSelection?.();
    expect(cameraOf(viewer)).toEqual(before);
    handle.view.state.selected = 'wall-b';
    handle.frameSelection?.();
    expect(cameraOf(viewer)).not.toEqual(before);
    viewer.unmount();
  });

  it('draws the field sheet and the readings on request', () => {
    const { viewer, handle } = shown();
    handle.drawField();
    handle.showReadings?.(new Map(), 'live');
    expect(viewer.markers?.count).toBe(0);
    viewer.unmount();
  });

  it('walks forward with the arrow held while walking is on', () => {
    const { viewer, handle } = shown();
    handle.view.state.walking = true;
    nextFrame();
    const start = cameraOf(viewer);
    globalThis.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    nextFrame(100);
    expect(cameraOf(viewer).distanceTo(start)).toBeGreaterThan(0.05);
    globalThis.dispatchEvent(new Event('blur'));
    const stopped = cameraOf(viewer);
    nextFrame(100);
    expect(cameraOf(viewer).distanceTo(stopped)).toBeLessThan(1e-6);
    viewer.unmount();
  });
});

describe('a marker added after the model', () => {
  it('is painted, written and hidden by its owner', () => {
    const { parent, viewer, model } = shown();
    const marker = viewer.markers!.add(bindingOn('wall-a'), model.children[0]);
    const label = () => parent.querySelector('[data-bim-label]') as HTMLElement;
    expect(marker.globalId).toBe('wall-a');
    marker.setColour(0xff0000);
    marker.setText('Seat 1 21 °C');
    nextFrame();
    expect(label().textContent).toBe('Seat 1 21 °C');
    expect(label().style.opacity).toBe('1');
    marker.setShown(false);
    nextFrame();
    expect(label().style.display).toBe('none');
    marker.setColour(null);
    marker.setShown(true);
    nextFrame();
    expect(label().style.opacity).toBe('0.7');
    viewer.unmount();
  });

  it('is framed by its object', () => {
    const { viewer } = shown();
    const before = cameraOf(viewer);
    viewer.frameObject('nowhere');
    expect(cameraOf(viewer)).toEqual(before);
    viewer.frameObject('wall-a');
    expect(cameraOf(viewer)).not.toEqual(before);
    viewer.unmount();
  });
});
