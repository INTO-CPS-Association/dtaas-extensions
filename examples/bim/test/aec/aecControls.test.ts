import { SHORTCUTS } from 'src/viewer/shortcuts';
import { ANCHOR, installPane, mounted, nextFrame, press } from './aecSetup';

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

jest.mock('src/viewer/loadGlb', () => ({
  loadGlb: async () => jest.requireActual('./aecSetup').building(),
}));

const scale = (domain: number[]) => ({ type: 'colorScale', scheme: 'heat', domain });
const painted = (encoding: object, fill: string) => ({ encoding, properties: { fill } }) as never;

beforeEach(() => {
  installPane();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
  document.body.innerHTML = '';
});

const buttonNamed = (frame: HTMLElement, name: string) =>
  frame.querySelector(`button[aria-label="${name}"]`) as HTMLButtonElement;

describe('the toolbar of the aec substrate', () => {
  it('has one button per option of the Buildings page, each printing its key', async () => {
    const { frame, adapter } = await mounted();
    const buttons = [...frame.querySelectorAll('[role="toolbar"] button')];
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(SHORTCUTS.map((s) => s.label));
    expect(buttons[1].textContent).toBe('t');
    adapter.dispose();
  });

  it('runs an option from its button and from its key, and draws a toggle that is on', async () => {
    const { frame, adapter } = await mounted();
    const transparency = buttonNamed(frame, 'Transparency');
    expect(transparency.getAttribute('aria-pressed')).toBe('false');
    transparency.click();
    expect(transparency.getAttribute('aria-pressed')).toBe('true');
    expect(press(frame, 't')).toBe(true);
    expect(transparency.getAttribute('aria-pressed')).toBe('false');
    expect(press(frame, 'v')).toBe(true);
    expect(buttonNamed(frame, 'Vertical Section').textContent).toBe('v Along X');
    expect(press(frame, 'p')).toBe(false);
    adapter.dispose();
  });

  it('leaves a key typed in the floor select alone', async () => {
    const { frame, adapter } = await mounted();
    const select = frame.querySelector('select') as HTMLSelectElement;
    expect(press(frame, 't', select)).toBe(false);
    adapter.dispose();
  });

  it('cycles the colours of the encodings with the heatmap, and resets them', async () => {
    const { frame, adapter } = await mounted();
    const target = adapter.resolve(ANCHOR)!;
    adapter.apply(target, painted(scale([18, 30]), '#ff0000'));
    adapter.apply(target, painted(scale([400, 1200]), '#0000ff'));
    const heatmap = buttonNamed(frame, 'Heatmap');
    expect(heatmap.textContent).toBe('m All');
    for (const badge of ['m heat 18 to 30', 'm heat 400 to 1200', 'm']) {
      press(frame, 'm');
      expect(heatmap.textContent).toBe(badge);
    }
    expect(frame.textContent).not.toContain('sensors, heat');
    press(frame, 'r');
    expect(heatmap.textContent).toBe('m All');
    adapter.dispose();
  });
});

describe('the floor picker of the aec substrate', () => {
  it('shows one floor, steps between floors and shows them all again', async () => {
    const { frame, adapter } = await mounted();
    const select = frame.querySelector('select') as HTMLSelectElement;
    const below = buttonNamed(frame, 'The floor below');
    const above = buttonNamed(frame, 'The floor above');
    above.click();
    expect(select.value).toBe('L1');
    expect(below.disabled).toBe(true);
    above.click();
    expect(select.value).toBe('L2');
    expect(above.disabled).toBe(true);
    select.value = '';
    select.dispatchEvent(new Event('change'));
    expect(below.disabled).toBe(false);
    below.click();
    expect(select.value).toBe('L2');
    adapter.dispose();
  });
});

describe('the panels of the aec substrate', () => {
  it('asks for a click, then lists the facts, the sensor and the property sets', async () => {
    const { frame, adapter, container } = await mounted();
    expect(frame.textContent).toContain('Click an object to see what it is.');
    adapter.resolve({ ...ANCHOR, label: 'Seat 48A' });
    nextFrame();
    (container.querySelector('[data-bim-label]') as HTMLElement).click();
    expect(frame.textContent).toContain('East wall');
    expect(frame.textContent).toContain('Seat 48A');
    expect(frame.textContent).toContain('1.00 × 3.00 × 1.00 m');
    expect(frame.textContent).not.toContain('Predefined Type');
    expect(frame.querySelector('details')?.textContent).toContain('EI60');
    adapter.dispose();
  });

  it('lights every object of a class from its row of the legend, and puts it out again', async () => {
    const { frame, adapter } = await mounted();
    const row = () =>
      [...frame.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Wall'))!;
    expect(row().textContent).toBe('Wall2');
    row().click();
    expect(row().getAttribute('aria-pressed')).toBe('true');
    row().click();
    expect(row().getAttribute('aria-pressed')).toBe('false');
    adapter.dispose();
  });

  it('says when no colour scale has a reading to colour by', async () => {
    const { frame, adapter } = await mounted();
    const target = adapter.resolve(ANCHOR)!;
    adapter.apply(target, painted({ type: 'attention' }, '#ff0000'));
    expect(frame.textContent).toContain('No current reading to colour by.');
    adapter.dispose();
  });
});

describe('the list of keys of the aec substrate', () => {
  it('opens on its key, lists every option and closes on Escape', async () => {
    const { frame, adapter } = await mounted();
    const help = frame.querySelector('[role="dialog"]') as HTMLElement;
    expect(help.hidden).toBe(true);
    press(frame, '?');
    expect(help.hidden).toBe(false);
    SHORTCUTS.forEach((s) => expect(help.textContent).toContain(s.label));
    help.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(help.hidden).toBe(true);
    press(frame, '?');
    help.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    (help.querySelector('button') as HTMLButtonElement).click();
    expect(help.hidden).toBe(true);
    expect(document.activeElement).toBe(frame);
    adapter.dispose();
  });

  it('asks for fullscreen and leaves it again', async () => {
    const { frame, adapter } = await mounted();
    const request = jest.fn(async () => undefined);
    const exit = jest.fn(async () => undefined);
    document.documentElement.requestFullscreen = request;
    document.exitFullscreen = exit;
    press(frame, 'a');
    expect(request).toHaveBeenCalled();
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.documentElement,
    });
    press(frame, 'a');
    expect(exit).toHaveBeenCalled();
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
    adapter.dispose();
  });
});
