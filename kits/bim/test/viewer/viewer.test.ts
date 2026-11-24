import { Viewer } from 'src/viewer/viewer';
import { rendererCalls } from './fakeRenderer';
import { bindingOn, building, holder, installBrowser, nextFrame } from './viewerSetup';

jest.mock('three', () => {
  const { fakeRenderer } = jest.requireActual('./fakeRenderer');
  return { ...jest.requireActual('three'), WebGLRenderer: jest.fn(() => fakeRenderer()) };
});

// The occlusion pass and the room light need WebGL. The frames they would draw
// are counted on the stand-in instead.
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

function shown(events = {}) {
  const parent = holder();
  const viewer = new Viewer();
  viewer.mount(parent, events);
  const model = building();
  const resolved = [{ binding: bindingOn('wall-b'), object: { node: model.children[1] } }];
  // From the front, wall-a is left of the middle and wall-b right of it.
  const handle = viewer.show(model, { placed: resolved, from: 'front' });
  nextFrame();
  return { parent, viewer, model, handle };
}

const click = (target: HTMLElement, x: number, y: number) => {
  target.dispatchEvent(new MouseEvent('pointerdown', { clientX: x, clientY: y }));
  target.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y }));
};

describe('the viewer', () => {
  it('puts a canvas and a layer of labels in the element it is mounted in', () => {
    const parent = holder();
    const viewer = new Viewer();
    viewer.mount(parent);
    expect(parent.querySelector('canvas')).not.toBeNull();
    expect(parent.querySelector('[data-testid="bim-labels"]')).not.toBeNull();
    expect(viewer.handle).toBeNull();
    expect(viewer.objectAt(1, 1)).toBeNull();
    viewer.unmount();
  });

  it('refuses a second mount, a show before a mount and a second model', () => {
    const viewer = new Viewer();
    expect(() => viewer.show(building())).toThrow('Mount the viewer');
    viewer.mount(holder());
    expect(() => viewer.mount(holder())).toThrow('already mounted');
    viewer.show(building());
    expect(() => viewer.show(building())).toThrow('already shows');
    viewer.unmount();
  });

  it('shows the model with a labelled marker on every placed sensor', () => {
    const { parent, viewer, handle } = shown();
    expect([...handle.view.meshes.keys()]).toEqual(['wall-a', 'wall-b']);
    expect(viewer.handle).toBe(handle);
    expect(viewer.markers?.count).toBe(1);
    expect(parent.querySelector('[data-bim-label]')?.textContent).toContain('Sensor on wall-b');
    viewer.unmount();
  });

  it('gives back the context, the canvas and the labels when unmounted, twice over', () => {
    const { parent, viewer } = shown();
    viewer.unmount();
    viewer.unmount();
    expect(rendererCalls.get('forceContextLoss')).toHaveBeenCalledTimes(1);
    expect(parent.querySelector('canvas')).toBeNull();
    expect(parent.querySelector('[data-bim-label]')).toBeNull();
    const drawn = mockFinish.render.mock.calls.length;
    nextFrame(2000);
    expect(mockFinish.render).toHaveBeenCalledTimes(drawn);
  });

  it('lights the object under the pointer and tells the page', () => {
    const onHover = jest.fn();
    const { parent, viewer, handle } = shown({ onHover });
    parent.dispatchEvent(new MouseEvent('pointermove', { clientX: 118, clientY: 50 }));
    expect(handle.view.state.hovered).toBe('wall-b');
    parent.dispatchEvent(new MouseEvent('pointermove', { clientX: 118, clientY: 50 }));
    expect(onHover).toHaveBeenCalledTimes(1);
    expect(viewer.objectAt(82, 50)).toBe('wall-a');
    viewer.unmount();
  });

  it('selects what a click lands on, and nothing for a drag', () => {
    const onSelect = jest.fn();
    const { parent, viewer, handle } = shown({ onSelect });
    click(parent, 82, 50);
    expect(handle.view.state.selected).toBe('wall-a');
    parent.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, clientY: 0 }));
    parent.dispatchEvent(new MouseEvent('click', { clientX: 50, clientY: 90 }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    click(parent, 100, 2);
    expect(handle.view.state.selected).toBeNull();
    viewer.unmount();
  });

  it('picks a sensor from its label and flies to its object', () => {
    const onSelect = jest.fn();
    const { parent, viewer, handle } = shown({ onSelect });
    const before = handle.view.state.selected;
    (parent.querySelector('[data-bim-label]') as HTMLElement).click();
    expect(before).toBeNull();
    expect(handle.view.state.selected).toBe('wall-b');
    expect(onSelect).toHaveBeenCalledWith('wall-b');
    viewer.unmount();
  });

  it('measures instead of selecting while a measuring mode is on', () => {
    const { parent, viewer, handle } = shown();
    handle.view.state.measuring = 'length';
    nextFrame();
    click(parent, 82, 50);
    expect(handle.view.state.selected).toBeNull();
    viewer.unmount();
  });
});
