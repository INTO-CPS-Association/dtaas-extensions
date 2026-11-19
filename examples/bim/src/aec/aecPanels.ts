/**
 * The panels under the `aec` canvas, as on the Buildings page: the sensors
 * the model has no object for, the facts of the picked object on the left
 * and the legends on the right, where a row of the class legend lights every
 * object of its class.
 */

import { colourAt } from '@into-cps-association/dtaas-sdk';

import { sizeText, type ObjectFacts } from '../viewer/index.js';
import type { MarkerColours, Quantity } from './aecColours.js';
import { BUTTON, PANEL, el } from './dom.js';

/** The object picked on the canvas, with what is known about it. */
export interface PickedObject {
  readonly globalId: string;
  readonly facts?: ObjectFacts;
  readonly size?: { x: number; y: number; z: number };
  /** The sensor anchored on it, by name and signal path. */
  readonly sensor?: { readonly name: string; readonly signal: string };
}

/** One row of the class legend: a class, its colour and how many objects. */
export interface ClassEntry {
  readonly ifcClass: string;
  readonly colour: string;
  readonly count: number;
}

const CAPTION = 'font-size:0.75rem;opacity:0.75';

/** A table of names and values, leaving out a value there is nothing to say about. */
function table(rows: ReadonlyArray<[string, unknown]>): HTMLTableElement {
  const body = el('tbody');
  for (const [name, value] of rows) {
    if (value === undefined || value === null || value === '') continue;
    const cells = [
      el(
        'th',
        { scope: 'row', style: 'text-align:left;padding-right:12px;font-weight:400;opacity:0.75' },
        name,
      ),
      el('td', { style: 'word-break:break-word' }, String(value)),
    ];
    body.append(el('tr', {}, ...cells));
  }
  return el('table', { style: 'border-collapse:collapse' }, body);
}

/** The property sets of an object, behind a summary a person opens. */
function propertySets(facts: ObjectFacts | undefined): HTMLElement | null {
  const sets = Object.entries(facts?.properties ?? {});
  if (sets.length === 0) return null;
  const summary = el('summary', { style: BUTTON }, 'Properties');
  const parts = sets.map(([name, values]) =>
    el(
      'div',
      { style: `${PANEL};margin-top:8px` },
      el('div', { style: CAPTION }, name),
      table(Object.entries(values)),
    ),
  );
  return el('details', { style: 'margin-top:8px' }, summary, ...parts);
}

/** The facts of the picked object, or how to pick one. */
export function objectPanel(picked: PickedObject | null): HTMLElement {
  if (!picked) return el('p', { style: CAPTION }, 'Click an object to see what it is.');
  const { facts, size, sensor } = picked;
  // IFC writes NOTDEFINED when the exporter said nothing, which is no type.
  const type = facts?.predefinedType === 'NOTDEFINED' ? '' : facts?.predefinedType;
  const rows: Array<[string, unknown]> = [
    ['Name', facts?.name],
    ['IFC Class', facts?.ifcClass],
    ['Predefined Type', type],
    ['Storey', facts?.storey],
    ['Room', facts?.room],
    ['Hosted In', facts?.host],
    ['Size', size && sizeText(size)],
    ['Global ID', picked.globalId],
    ['Sensor', sensor?.name],
    ['Signal', sensor?.signal],
  ];
  return el('div', {}, el('div', { style: PANEL }, table(rows)), propertySets(facts));
}

/** One colour scale: its bar, its two ends and how many sensors use it. */
function scaleLegend(quantity: Quantity, sensors: number): HTMLElement {
  const { scheme = '', domain = [] } = quantity;
  const stops = [0, 0.25, 0.5, 0.75, 1].map((t) => colourAt(scheme, t));
  const bar = el('div', {
    style: `margin-top:4px;height:10px;border-radius:2px;background:linear-gradient(to right, ${stops.join(', ')})`,
  });
  const ends = el(
    'div',
    { style: 'display:flex;justify-content:space-between' },
    el('span', {}, String(domain[0])),
    el('span', {}, String(domain[1])),
  );
  return el(
    'div',
    { style: PANEL },
    el('div', { style: CAPTION }, 'Heatmap'),
    bar,
    ends,
    el('div', { style: CAPTION }, `${sensors} sensors, ${quantity.key}`),
  );
}

/** The scales colouring the markers now, or a note when none has a value. */
export function heatLegend(colours: MarkerColours): HTMLElement[] {
  if (colours.mode === 'off') return [];
  const scales = colours.shown().filter((q) => q.scheme && q.domain);
  if (scales.length > 0) return scales.map((q) => scaleLegend(q, colours.countOf(q)));
  return [
    el(
      'div',
      { style: PANEL },
      el('div', { style: CAPTION }, 'Heatmap'),
      'No current reading to colour by.',
    ),
  ];
}

const SWATCH = 'width:12px;height:12px;border-radius:2px;flex-shrink:0';
const CLASS_ROW = `${BUTTON};display:flex;align-items:center;gap:6px;width:100%;text-align:left`;

/** One row of the class legend: its colour, its class and how many objects. */
function classRow(entry: ClassEntry, lit: boolean, pick: (ifcClass: string) => void) {
  const swatch = el('span', { style: `${SWATCH};background:${entry.colour}` });
  const count = el('span', { style: 'margin-left:auto' }, String(entry.count));
  const attributes = { type: 'button', 'aria-pressed': String(lit), style: CLASS_ROW };
  const row = el('button', attributes, swatch, entry.ifcClass.replace(/^Ifc/, ''), count);
  row.addEventListener('click', () => pick(entry.ifcClass));
  return row;
}

/** What the colours of the model mean. A row lights its class and again puts it out. */
export function classLegend(
  classes: readonly ClassEntry[],
  highlighted: string | null,
  pick: (ifcClass: string) => void,
): HTMLElement | null {
  if (classes.length === 0) return null;
  const rows = classes.map((entry) => classRow(entry, entry.ifcClass === highlighted, pick));
  const list = el('div', { style: 'display:grid;gap:2px;margin-top:4px' }, ...rows);
  return el('div', { style: PANEL }, el('div', { style: CAPTION }, 'In This Model'), list);
}

/** The sensors the model has no object for, named once each. */
export function missingNotice(missing: readonly string[]): HTMLElement | null {
  if (missing.length === 0) return null;
  return el(
    'div',
    { role: 'status', style: `${PANEL};margin-top:8px` },
    `Not on this model: ${missing.join(', ')}`,
  );
}
