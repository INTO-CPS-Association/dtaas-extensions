/**
 * The row above the `aec` canvas, as on the Buildings page: one button per
 * option, each printing its key, then the floor picker. A toggle that is on
 * is drawn pressed and says what it is set to. An action never lights up.
 */

import type { SceneView, Shortcut, ShortcutContext } from '../viewer/index.js';
import { ACCENT, BG, FG, button, el } from './dom.js';

export interface Toolbar {
  readonly element: HTMLElement;
  /** Draw every toggle as the view has it now. */
  sync(): void;
}

/** Light a button whose toggle is on and print what it is set to. */
function syncButton(element: HTMLButtonElement, option: Shortcut, view: SceneView): void {
  const on = option.on?.(view) ?? false;
  const badge = on ? option.badge?.(view) : undefined;
  element.setAttribute('aria-pressed', String(on));
  element.style.background = on ? ACCENT : BG;
  element.style.color = on ? BG : FG;
  element.textContent = badge ? `${option.key} ${badge}` : option.key;
}

export function createToolbar(
  options: readonly Shortcut[],
  context: () => ShortcutContext,
): Toolbar {
  const row = el('div', { role: 'toolbar', 'aria-label': 'Options', style: ROW });
  const buttons = options.map((option) => {
    const element = button(`${option.label} (${option.key})`, option.key, () =>
      option.run(context()),
    );
    element.setAttribute('aria-label', option.label);
    if (option.on) element.setAttribute('aria-pressed', 'false');
    row.append(element);
    return { element, option };
  });
  const sync = () => {
    const { view } = context();
    for (const { element, option } of buttons) {
      if (option.on) syncButton(element, option, view);
    }
  };
  return { element: row, sync };
}

const ROW = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px';
