import { applyTheme, followTheme, themeColours } from 'src/aec/aecTheme';

afterEach(() => {
  document.body.innerHTML = '';
  document.body.className = '';
  document.body.removeAttribute('style');
  document.documentElement.removeAttribute('style');
});

/** A pane inside a page that styles its body the way a host's baseline does. */
function paneIn(colour: string, background: string): HTMLElement {
  document.body.setAttribute('style', `color: ${colour}; background-color: ${background}`);
  const holder = document.createElement('section');
  const pane = document.createElement('div');
  holder.append(pane);
  document.body.append(holder);
  return pane;
}

describe('the theme of the aec substrate', () => {
  it('takes the text colour and the background of the page the host styled', () => {
    const pane = paneIn('rgb(255, 255, 255)', 'rgb(18, 18, 18)');
    expect(themeColours(pane)).toEqual({
      '--bim-label-fg': 'rgb(255, 255, 255)',
      '--bim-label-bg': 'rgb(18, 18, 18)',
      '--bim-label-border': 'rgb(255, 255, 255)',
    });
  });

  it('keeps the light surface on a page that sets no background', () => {
    const pane = document.createElement('div');
    document.body.append(pane);
    expect(themeColours(pane)['--bim-label-bg']).toBeUndefined();
  });

  it('takes the primary and secondary colours MUI exposes as variables', () => {
    document.documentElement.style.setProperty('--mui-palette-primary-main', '#90caf9');
    document.documentElement.style.setProperty('--mui-palette-text-secondary', '#aaaaaa');
    const pane = paneIn('rgb(0, 0, 0)', 'rgb(255, 255, 255)');
    applyTheme(pane);
    expect(pane.style.getPropertyValue('--bim-label-accent')).toBe('#90caf9');
    expect(pane.style.getPropertyValue('--bim-label-border')).toBe('#aaaaaa');
  });

  it('writes the labels again when the host switches its theme', async () => {
    const pane = paneIn('rgb(0, 0, 0)', 'rgb(255, 255, 255)');
    const stop = followTheme(pane);
    expect(pane.style.getPropertyValue('--bim-label-bg')).toBe('rgb(255, 255, 255)');
    document.body.setAttribute(
      'style',
      'color: rgb(255, 255, 255); background-color: rgb(18, 18, 18)',
    );
    await Promise.resolve();
    expect(pane.style.getPropertyValue('--bim-label-bg')).toBe('rgb(18, 18, 18)');
    stop();
    document.body.setAttribute('style', 'background-color: rgb(1, 2, 3)');
    await Promise.resolve();
    expect(pane.style.getPropertyValue('--bim-label-bg')).toBe('rgb(18, 18, 18)');
  });
});
