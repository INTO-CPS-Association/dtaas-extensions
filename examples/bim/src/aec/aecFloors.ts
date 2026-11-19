/**
 * The floor picker of the `aec` substrate, as on the Buildings page: a select
 * of every floor or one and an arrow to the floor above and one below. It is
 * left out for a model with fewer than two floors.
 */

import { BUTTON, FG, BG, BORDER, button, el } from './dom.js';

/** The select's value for every floor, since a select cannot hold null. */
const ALL = '';

export interface FloorPicker {
  readonly element: HTMLElement;
  /** Show the floor the view has now. */
  sync(current: string | null): void;
}

/**
 * The floor after `at` going `by`. From all floors, up starts at the lowest
 * and down at the highest. Null when there is none.
 */
export function stepFloor(at: number, by: number, count: number): number | null {
  let next = at + by;
  if (at === -1) next = by > 0 ? 0 : count - 1;
  return next >= 0 && next < count ? next : null;
}

function floorSelect(storeys: readonly string[], choose: (storey: string | null) => void) {
  const style = `${BUTTON};min-width:180px;color:${FG};background:${BG};border-color:${BORDER}`;
  const select = el(
    'select',
    { 'aria-label': 'Floor', style },
    el('option', { value: ALL }, 'All Floors'),
  );
  for (const storey of storeys) select.append(el('option', { value: storey }, storey));
  select.addEventListener('change', () => choose(select.value === ALL ? null : select.value));
  return select;
}

/** The picker for `storeys`, lowest first, which calls `choose` with the floor picked. */
export function createFloorPicker(
  storeys: readonly string[],
  choose: (storey: string | null) => void,
): FloorPicker {
  const element = el('div', { style: 'display:flex;align-items:center;gap:4px;margin-bottom:8px' });
  if (storeys.length < 2) return { element, sync: () => undefined };
  const select = floorSelect(storeys, choose);
  let at = -1;
  const step = (by: number) => {
    const next = stepFloor(at, by, storeys.length);
    if (next !== null) choose(storeys[next]);
  };
  const up = button('The floor above', '▲', () => step(1));
  const down = button('The floor below', '▼', () => step(-1));
  element.append(select, up, down);
  const sync = (current: string | null) => {
    at = current === null ? -1 : storeys.indexOf(current);
    select.value = current ?? ALL;
    up.disabled = at === storeys.length - 1;
    down.disabled = at === 0;
  };
  sync(null);
  return { element, sync };
}
