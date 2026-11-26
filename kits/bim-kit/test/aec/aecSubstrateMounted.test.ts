import { rendererCalls } from '../viewer/fakeRenderer';
import { ANCHOR, installPane, mounted, nextFrame } from './aecSetup';

jest.mock('three', () => {
  const { fakeRenderer } = jest.requireActual('../viewer/fakeRenderer');
  return { ...jest.requireActual('three'), WebGLRenderer: jest.fn(() => fakeRenderer()) };
});

jest.mock('src/viewer/look', () => ({
  ...jest.requireActual('src/viewer/look'),
  prepareRenderer: jest.fn(),
  lightFromRoom: jest.fn(() => jest.fn()),
  createFinish: jest.fn(() => ({ render: jest.fn(), setSize: jest.fn(), dispose: jest.fn() })),
}));

// The viewer's loader needs a GLB file. The building is handed over instead.
const mockLoad = jest.fn(async (_url: string) => jest.requireActual('./aecSetup').building());
jest.mock('src/viewer/loadGlb', () => ({ loadGlb: (url: string) => mockLoad(url) }));

const encoding = (properties: Record<string, unknown>) =>
  ({ encoding: { type: 'colorScale', scheme: 'heat', domain: [18, 30] }, properties }) as never;

const labels = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-bim-label]')] as HTMLElement[];

beforeEach(() => {
  installPane();
  rendererCalls.clear();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
  document.body.innerHTML = '';
});

describe('a mounted aec substrate', () => {
  it('draws the converted model of the source with the shared viewer', async () => {
    const { container, frame, adapter } = await mounted();
    expect(mockLoad).toHaveBeenCalledWith(expect.stringContaining('room.glb'));
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('room.json'),
      expect.anything(),
    );
    expect(frame.querySelector('canvas')).not.toBeNull();
    expect(container.querySelector('[role="toolbar"]')).not.toBeNull();
    adapter.dispose();
  });

  it('puts a labelled marker on the object an anchor names, once', async () => {
    const { adapter, container } = await mounted();
    const anchor = { ...ANCHOR, label: 'Seat 48A' };
    expect(adapter.resolve(anchor)).toEqual({ substrate: 'aec', id: ANCHOR.signalPath });
    expect(adapter.resolve(anchor)).toEqual({ substrate: 'aec', id: ANCHOR.signalPath });
    nextFrame();
    expect(labels(container).map((label) => label.textContent)).toEqual(['Seat 48A']);
    adapter.dispose();
  });

  it('names each anchor whose object is not in the model once, and ignores other kinds', async () => {
    const { adapter, container } = await mounted();
    const missing = { ...ANCHOR, ref: 'nowhere', label: 'Seat 1' };
    expect(adapter.resolve(missing)).toBeNull();
    expect(adapter.resolve(missing)).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      'Not on this model: Seat 1',
    );
    expect(adapter.resolve({ ...ANCHOR, kind: 'image-xy' })).toBeNull();
    adapter.dispose();
  });

  it('paints colour, text and visibility on a marker', async () => {
    const { adapter, container } = await mounted();
    const target = adapter.resolve(ANCHOR)!;
    adapter.apply(target, encoding({ fill: '#ff0000', text: '21 °C' }));
    nextFrame();
    const [label] = labels(container);
    expect(label.textContent).toBe(`${ANCHOR.signalPath} 21 °C`);
    expect(label.style.opacity).toBe('1');
    expect(container.textContent).toContain('1 sensors, heat 18 to 30');
    adapter.apply(target, encoding({ visible: false }));
    nextFrame();
    expect(label.style.display).toBe('none');
    adapter.apply({ substrate: 'aec', id: 'x/y' }, encoding({ fill: 'red' }));
    adapter.dispose();
  });

  it('frames a marker and picks the marker on the object under a point', async () => {
    const { adapter } = await mounted();
    const target = adapter.resolve(ANCHOR)!;
    // From above, wall-b is just left of the middle of the model and wall-a
    // left of it, since the column on the floor above stands far to the right.
    expect(adapter.pick(88, 50)).toEqual(target);
    expect(adapter.pick(71, 50)).toBeNull();
    expect(adapter.pick(100, 2)).toBeNull();
    adapter.frame(target);
    adapter.frame({ substrate: 'aec', id: 'x/y' });
    expect(adapter.pick(100, 50)).toEqual(target);
    adapter.setTime(0);
    adapter.dispose();
  });

  it('gives back the WebGL context and the pane when disposed', async () => {
    const { adapter, container } = await mounted();
    adapter.dispose();
    expect(rendererCalls.get('forceContextLoss')).toHaveBeenCalledTimes(1);
    expect(container.children).toHaveLength(0);
  });

  it('says what to do when the converted model cannot be loaded', async () => {
    mockLoad.mockRejectedValueOnce(new Error('internal address'));
    await expect(mounted()).rejects.toThrow('Open the model once on the Buildings page');
    expect(rendererCalls.get('forceContextLoss')).toHaveBeenCalledTimes(1);
  });

  it('draws a model whose property tree is missing', async () => {
    globalThis.fetch = jest.fn(async () => ({ ok: false })) as never;
    const { adapter, container } = await mounted();
    expect(container.querySelector('[role="combobox"]')).toBeNull();
    globalThis.fetch = jest.fn(async () => Promise.reject(new Error('offline'))) as never;
    adapter.dispose();
    const again = await mounted();
    expect(again.container.querySelector('canvas')).not.toBeNull();
    again.adapter.dispose();
  });
});
