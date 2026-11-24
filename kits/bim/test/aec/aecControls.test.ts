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

const buttonNamed = (root: ParentNode, name: string) =>
  root.querySelector(`button[aria-label="${name}"]`) as HTMLButtonElement;

const realTimers = jest.requireActual<typeof import('node:timers')>('node:timers');

/**
 * Let React finish the work it scheduled, such as a menu or a dialog opening
 * or closing. The viewer's tests run on a fake clock, so the clock is moved.
 */
async function settle(ms = 0, rounds = 5): Promise<void> {
  if (rounds === 0) return;
  jest.advanceTimersByTime(ms + 1);
  // React's scheduler kept the real timer it found when it loaded, before the fake clock.
  await new Promise((resolve) => realTimers.setTimeout(resolve, 0));
  await settle(ms, rounds - 1);
}

/** The text of a select drawn by MUI, which is a combobox and not a select element. */
const floorOf = (frame: HTMLElement) =>
  (frame.querySelector('[role="combobox"]') as HTMLElement).textContent;

describe('the toolbar of the aec substrate', () => {
  it('is the toolbar of the Buildings page, one button per option, each printing its key', async () => {
    const { frame, adapter } = await mounted();
    const buttons = [...frame.querySelectorAll('[role="toolbar"] button')];
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(SHORTCUTS.map((s) => s.label));
    expect(buttons[1].textContent).toBe('t');
    // Each button carries the icon the Buildings page draws.
    expect(buttons.every((b) => b.querySelector('svg'))).toBe(true);
    adapter.dispose();
  });

  it('runs an option from its button and from its key, and draws a toggle that is on', async () => {
    const { frame, adapter } = await mounted();
    const transparency = () => buttonNamed(frame, 'Transparency');
    expect(transparency().getAttribute('aria-pressed')).toBe('false');
    transparency().click();
    expect(transparency().getAttribute('aria-pressed')).toBe('true');
    expect(press(frame, 't')).toBe(true);
    expect(transparency().getAttribute('aria-pressed')).toBe('false');
    expect(press(frame, 'v')).toBe(true);
    expect(buttonNamed(frame, 'Vertical Section').textContent).toBe('vAlong X');
    expect(press(frame, 'p')).toBe(false);
    adapter.dispose();
  });

  it('leaves a key typed in the open floor list alone and takes one on the closed select', async () => {
    const { frame, adapter } = await mounted();
    const select = frame.querySelector('[role="combobox"]') as HTMLElement;
    select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    await settle();
    const list = document.querySelector('[role="listbox"]') as HTMLElement;
    frame.append(list);
    expect(press(frame, 't', list)).toBe(false);
    list.remove();
    expect(press(frame, 't', select)).toBe(true);
    adapter.dispose();
  });

  it('cycles the colours of the encodings with the heatmap, and resets them', async () => {
    const { frame, adapter } = await mounted();
    const target = adapter.resolve(ANCHOR)!;
    adapter.apply(target, painted(scale([18, 30]), '#ff0000'));
    adapter.apply(target, painted(scale([400, 1200]), '#0000ff'));
    const heatmap = () => buttonNamed(frame, 'Heatmap');
    expect(heatmap().textContent).toBe('mAll');
    for (const badge of ['mheat 18 to 30', 'mheat 400 to 1200', 'm']) {
      press(frame, 'm');
      expect(heatmap().textContent).toBe(badge);
    }
    expect(frame.textContent).not.toContain('sensors, heat');
    press(frame, 'r');
    expect(heatmap().textContent).toBe('mAll');
    adapter.dispose();
  });
});

describe('the floor picker of the aec substrate', () => {
  it('shows one floor, steps between floors and shows them all again', async () => {
    const { frame, adapter } = await mounted();
    const below = () => buttonNamed(frame, 'The floor below');
    const above = () => buttonNamed(frame, 'The floor above');
    expect(floorOf(frame)).toBe('All Floors');
    above().click();
    expect(floorOf(frame)).toBe('L1');
    expect(below().disabled).toBe(true);
    above().click();
    expect(floorOf(frame)).toBe('L2');
    expect(above().disabled).toBe(true);
    const select = frame.querySelector('[role="combobox"]') as HTMLElement;
    select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    await settle();
    const all = [...document.querySelectorAll('[role="option"]')].find(
      (option) => option.textContent === 'All Floors',
    ) as HTMLElement;
    all.click();
    expect(floorOf(frame)).toBe('All Floors');
    expect(below().disabled).toBe(false);
    below().click();
    expect(floorOf(frame)).toBe('L2');
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
    expect(frame.textContent).toContain(ANCHOR.signalPath);
    expect(frame.textContent).toContain('1.00 × 3.00 × 1.00 m');
    expect(frame.textContent).not.toContain('Predefined Type');
    [...frame.querySelectorAll('button')].find((b) => b.textContent === 'Properties')!.click();
    await settle();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('EI60');
    adapter.dispose();
  });

  it('lights every object of a class from its row of the legend, and puts it out again', async () => {
    const { frame, adapter } = await mounted();
    const row = () =>
      [...frame.querySelectorAll('[role="button"]')].find((b) =>
        b.textContent?.startsWith('Wall'),
      )!;
    expect(row().textContent).toBe('Wall2');
    (row() as HTMLElement).click();
    expect(row().classList.contains('Mui-selected')).toBe(true);
    (row() as HTMLElement).click();
    expect(row().classList.contains('Mui-selected')).toBe(false);
    adapter.dispose();
  });

  it('counts every sensor a scale colours, as readings arrive', async () => {
    const { frame, adapter } = await mounted();
    const first = adapter.resolve(ANCHOR)!;
    const second = adapter.resolve({
      ...ANCHOR,
      signalPath: 'site/room/desk/temperature',
      ref: 'wall-a',
    })!;
    adapter.apply(first, painted(scale([18, 30]), '#ff0000'));
    expect(frame.textContent).toContain('1 sensors, heat 18 to 30');
    adapter.apply(second, painted(scale([18, 30]), '#00ff00'));
    expect(frame.textContent).toContain('2 sensors, heat 18 to 30');
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
  it('opens on its key, lists every option and gives the focus back when closed', async () => {
    const { frame, adapter } = await mounted();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    press(frame, '?');
    await settle();
    const help = document.querySelector('[role="dialog"]') as HTMLElement;
    SHORTCUTS.forEach((s) => expect(help.textContent).toContain(s.label));
    help.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle(400);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
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
