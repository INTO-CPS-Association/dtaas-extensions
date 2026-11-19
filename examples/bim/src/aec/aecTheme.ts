/**
 * The colours of the host's theme, for the labels in the scene and for the
 * controls around it.
 *
 * Without a React root the pane cannot ask MUI for its theme, so it reads the
 * theme from the page: the text colour the host's baseline styles give the
 * pane, the first background behind it and the primary colour when the host
 * exposes MUI's CSS variables. The colours are set as the custom properties
 * the viewer's labels already read and read again whenever the page changes
 * its classes or styles or the system switches between light and dark.
 */

/** The labels' own light colours, kept when the page says nothing. */
const FALLBACK = { fg: '#1f2933', bg: '#ffffff' };

const TRANSPARENT = new Set(['', 'transparent', 'rgba(0, 0, 0, 0)']);

/** The first background colour behind `element`, or undefined when none is set. */
function backgroundBehind(element: Element | null): string | undefined {
  for (let at = element; at; at = at.parentElement) {
    const colour = getComputedStyle(at).backgroundColor;
    if (!TRANSPARENT.has(colour)) return colour;
  }
  return undefined;
}

/** The theme's colours as the labels' custom properties. */
export function themeColours(pane: HTMLElement): Record<string, string> {
  const fg = getComputedStyle(pane).color || FALLBACK.fg;
  const bg = backgroundBehind(pane.parentElement) ?? FALLBACK.bg;
  const root = getComputedStyle(document.documentElement);
  const accent = root.getPropertyValue('--mui-palette-primary-main').trim();
  const secondary = root.getPropertyValue('--mui-palette-text-secondary').trim();
  const colours: Record<string, string> = {
    '--bim-label-fg': fg,
    '--bim-label-bg': bg,
    '--bim-label-border': secondary || fg,
  };
  if (accent) colours['--bim-label-accent'] = accent;
  return colours;
}

/** Write the theme's colours on the pane. */
export function applyTheme(pane: HTMLElement): void {
  for (const [name, value] of Object.entries(themeColours(pane))) {
    pane.style.setProperty(name, value);
  }
}

/**
 * Keep the pane in the theme's colours and return the function that stops.
 * The labels and the controls read the colours as custom properties, so the
 * browser restyles them and nothing has to be drawn again.
 */
export function followTheme(pane: HTMLElement): () => void {
  const update = () => applyTheme(pane);
  update();
  const observer = new MutationObserver(update);
  const watched = {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-mui-color-scheme'],
  };
  observer.observe(document.documentElement, watched);
  if (document.body) observer.observe(document.body, watched);
  const scheme = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
  scheme?.addEventListener?.('change', update);
  return () => {
    observer.disconnect();
    scheme?.removeEventListener?.('change', update);
  };
}
