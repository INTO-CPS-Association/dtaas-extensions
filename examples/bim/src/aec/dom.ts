/**
 * Building the controls of the `aec` substrate as plain elements. The DTaaS
 * client shares React with a deployed bundle but no way to start a React
 * root, so the controls are drawn without React. Text always goes in through
 * `textContent`, never as markup, so a name from a model cannot inject any.
 */

/** The colours of the host's theme, which `aecTheme.ts` sets on the pane. */
export const FG = 'var(--bim-label-fg,#1f2933)';
export const BG = 'var(--bim-label-bg,#ffffff)';
export const BORDER = 'var(--bim-label-border,#5f6b76)';
export const ACCENT = 'var(--bim-label-accent,#1565c0)';

/** The look of every panel: a box in the host's surface colour. */
export const PANEL = `border:1px solid ${BORDER};border-radius:4px;padding:8px;background:${BG};color:${FG}`;

/** The look of every button, at least 32 pixels high, above the 24 of WCAG 2.2 AA. */
export const BUTTON =
  `min-height:32px;min-width:32px;padding:2px 8px;border:1px solid ${BORDER};` +
  `border-radius:4px;background:${BG};color:${FG};font:inherit;cursor:pointer`;

type Child = Node | string | null | undefined | false;

/** An element with attributes and children. A string child is text. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  for (const child of children) {
    if (child) element.append(child);
  }
  return element;
}

/** A button that runs `onClick`, labelled for a screen reader. */
export function button(label: string, text: string, onClick: () => void): HTMLButtonElement {
  const element = el('button', {
    type: 'button',
    'aria-label': label,
    title: label,
    style: BUTTON,
  });
  element.textContent = text;
  element.addEventListener('click', onClick);
  return element;
}
