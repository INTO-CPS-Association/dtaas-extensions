/**
 * The list of keys of the `aec` substrate, written from the same table that
 * binds them and builds the toolbar, so the three cannot disagree. It opens
 * over the pane, closes on its button or on Escape and gives the focus back
 * to the pane.
 */

import type { Shortcut } from '../viewer/index.js';
import { PANEL, button, el } from './dom.js';

export interface Help {
  readonly element: HTMLElement;
  /** Open the list, or close it when it is open. */
  toggle(): void;
  isOpen(): boolean;
}

function keyTable(options: readonly Shortcut[]): HTMLTableElement {
  const rows = options.map((option) =>
    el(
      'tr',
      {},
      el('td', { style: 'padding-right:12px' }, el('code', {}, option.key)),
      el('td', {}, option.label),
    ),
  );
  return el('table', { style: 'border-collapse:collapse' }, el('tbody', {}, ...rows));
}

const STYLE = `${PANEL};position:absolute;top:8px;right:8px;z-index:10;max-height:80%;overflow:auto`;
const HEADER = 'display:flex;justify-content:space-between;align-items:center';

/** The list of `options`, hidden until it is opened. `closed` runs when it closes. */
export function createHelp(options: readonly Shortcut[], closed: () => void): Help {
  const element = el('div', { role: 'dialog', 'aria-label': 'Shortcuts', style: STYLE });
  let open = false;
  const show = (shown: boolean) => {
    open = shown;
    element.hidden = !shown;
    if (shown) close.focus();
    else closed();
  };
  const close = button('Close', 'Close', () => show(false));
  const header = el('div', { style: HEADER }, el('strong', {}, 'Shortcuts'), close);
  element.append(header, keyTable(options));
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    // The pane would read the key as an option otherwise.
    event.stopPropagation();
    show(false);
  });
  element.hidden = true;
  const toggle = () => show(!open);
  return { element, toggle, isOpen: () => open };
}
