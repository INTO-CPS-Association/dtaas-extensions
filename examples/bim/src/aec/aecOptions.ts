/**
 * The options of the `aec` substrate: the Buildings page's own shortcut
 * table, with two entries changed. The heatmap there colours objects by the
 * readings of a manifest and here it cycles the colours the visualisation's
 * encodings give the markers. Resetting also puts those colours back on.
 */

import { SHORTCUTS, type Shortcut } from '../viewer/index.js';
import type { MarkerColours } from './aecColours.js';

/** The heatmap: all the colour rules together, one at a time, or none. */
function heatmapOf(colours: MarkerColours, original: Shortcut): Shortcut {
  return {
    ...original,
    run: ({ refresh }) => {
      colours.cycle();
      refresh();
    },
    on: () => colours.mode !== 'off' && colours.quantities.length > 0,
    badge: () => colours.badge(),
  };
}

/** Reset everything, the colours of the markers as well. */
function resetOf(colours: MarkerColours, original: Shortcut): Shortcut {
  return {
    ...original,
    run: (context) => {
      colours.reset();
      original.run(context);
    },
  };
}

/** The table of options a pane draws its toolbar and help from and binds its keys to. */
export function optionsOf(colours: MarkerColours): Shortcut[] {
  return SHORTCUTS.map((shortcut) => {
    if (shortcut.key === 'm') return heatmapOf(colours, shortcut);
    if (shortcut.key === 'r') return resetOf(colours, shortcut);
    return shortcut;
  });
}
