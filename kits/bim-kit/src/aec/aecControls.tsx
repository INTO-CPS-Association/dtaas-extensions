/**
 * The controls around the `aec` canvas: the toolbar and the floor picker
 * above it, the panels below it, the list of keys and the keys themselves.
 *
 * They are the components of the Buildings page, drawn in a React root of
 * their own with the host's theme, so a building looks and works the same on
 * that page and in a visualisation. Only the table of options differs: two of
 * its entries act on the colours the encodings give the markers.
 */

import { Fragment, type ComponentType, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { Alert, Box, Stack } from '@mui/material';
import { colourAt } from '@into-cps-association/dtaas-extensions';

import type { Binding } from '../binding.js';
import {
  ClassLegend,
  FloorPicker,
  HeatLegend,
  HelpPanel,
  ObjectPanel,
  ScaleLegend,
  Toolbar,
} from '../react/index.js';
import {
  handleKey,
  type Shortcut,
  type ShortcutContext,
  type ViewerHandle,
} from '../viewer/index.js';
import type { MarkerColours, Quantity } from './aecColours.js';
import { optionsOf } from './aecOptions.js';

/** The rows of the pane: the controls, the canvas and the panels. */
export interface PaneRows {
  readonly frame: HTMLElement;
  readonly above: HTMLElement;
  readonly canvas: HTMLElement;
  readonly below: HTMLElement;
}

/** What the controls read of the pane they sit around. */
export interface ControlsInput {
  readonly rows: PaneRows;
  readonly handle: ViewerHandle;
  readonly colours: MarkerColours;
  /** The host's theme, so the controls match the rest of the client. */
  readonly Theme?: ComponentType<{ readonly children: ReactNode }>;
  /** The binding of the sensor anchored on an object, if any. */
  bindingOn(globalId: string): Binding | undefined;
  /** Paint every marker in the colour the heatmap option says it shows now. */
  recolour(): void;
}

export interface Controls {
  /** Draw the controls and the panels as the view has them now. */
  redraw(): void;
  /** Name a sensor the model has no object for, once. */
  reportMissing(name: string): void;
  dispose(): void;
}

function toggleFullscreen() {
  const done = () => undefined; // a refused request changes nothing
  if (document.fullscreenElement) document.exitFullscreen().catch(done);
  else document.documentElement.requestFullscreen?.().catch(done);
}

/** The colours of a scheme from its low end to its high end. */
function stopsOf(scheme: string): string[] {
  return [0, 0.25, 0.5, 0.75, 1].map((at) => colourAt(scheme, at));
}

/** The heatmap legends: one per colour scale in force, or a note when none has a value. */
function HeatLegends({ colours }: Readonly<{ colours: MarkerColours }>) {
  if (colours.mode === 'off') return null;
  const scales = colours.shown().filter((q): q is Required<Quantity> => !!q.scheme && !!q.domain);
  // The Buildings page's own note for a heatmap with nothing to colour by.
  if (scales.length === 0) return <HeatLegend zones={null} unit={undefined} coloured={0} />;
  return (
    <>
      {scales.map((q) => (
        <ScaleLegend
          key={q.key}
          scheme={q.key}
          stops={stopsOf(q.scheme)}
          domain={q.domain}
          sensors={colours.countOf(q)}
        />
      ))}
    </>
  );
}

interface ViewProps {
  readonly input: ControlsInput;
  readonly options: readonly Shortcut[];
  readonly context: ShortcutContext;
  readonly missing: readonly string[];
  readonly revision: number;
  readonly helpOpen: boolean;
  readonly closeHelp: () => void;
  readonly refresh: () => void;
}

/** The panels below the canvas, laid out as on the Buildings page. */
function Panels({ input, missing, refresh }: Readonly<ViewProps>) {
  const { view } = input.handle;
  const selected = view.state.selected;
  const facts = selected ? view.factsOf(selected) : undefined;
  return (
    <Box sx={{ mt: 1 }}>
      {missing.length > 0 && (
        <Alert severity="warning" role="status" sx={{ mb: 1 }}>
          Not on this model: {missing.join(', ')}
        </Alert>
      )}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Box sx={{ flex: '1 1 320px', minWidth: 0 }}>
          <ObjectPanel
            globalId={selected}
            facts={facts}
            binding={selected ? input.bindingOn(selected) : undefined}
            properties={facts?.properties}
            size={selected ? view.sizeOf(selected) : undefined}
          />
        </Box>
        <Stack sx={{ flex: '1 1 260px', minWidth: 0, gap: 1 }}>
          <HeatLegends colours={input.colours} />
          <ClassLegend view={view} onChange={refresh} />
        </Stack>
      </Box>
    </Box>
  );
}

/** The toolbar and floor picker above the canvas, the panels below it and the list of keys. */
function ControlsView(props: Readonly<ViewProps>) {
  const { input, options, context, revision, helpOpen, closeHelp, refresh } = props;
  const { view } = input.handle;
  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1 }}>
        <Toolbar view={view} context={context} revision={revision} shortcuts={options} />
        <FloorPicker
          storeys={view.storeys}
          current={view.state.storey}
          onChange={(storey) => {
            view.state.storey = storey;
            refresh();
          }}
        />
      </Box>
      {createPortal(<Panels {...props} />, input.rows.below)}
      <HelpPanel open={helpOpen} onClose={closeHelp} shortcuts={options} />
    </>
  );
}

/** Everything an option needs from the pane to do its work. */
function contextOf(input: ControlsInput, refresh: () => void, toggleHelp: () => void) {
  const { handle } = input;
  const context: ShortcutContext = {
    view: handle.view,
    // The core colours the markers, so no binding of a manifest is in force.
    bindings: [],
    refresh,
    frame: handle.frame,
    frameSelection: () => handle.frameSelection?.(),
    look: handle.look,
    hovered: () => handle.view.state.hovered,
    toggleHelp,
    toggleFullscreen,
  };
  return context;
}

/** The options' keys work while the pane has the focus. Returns the function that stops them. */
function bindKeys(frame: HTMLElement, context: ShortcutContext, options: readonly Shortcut[]) {
  const onKey = (event: KeyboardEvent) => {
    if (handleKey(event, context, options)) event.preventDefault();
  };
  frame.addEventListener('keydown', onKey);
  return () => frame.removeEventListener('keydown', onKey);
}

/** Put the controls around the canvas and connect them to the view. */
export function createControls(input: ControlsInput): Controls {
  const { rows } = input;
  const { view } = input.handle;
  const options = optionsOf(input.colours);
  const Theme = input.Theme ?? Fragment;
  const missing: string[] = [];
  const root: Root = createRoot(rows.above);
  let revision = 0;
  let helpOpen = false;

  const redraw = () => {
    revision += 1;
    // Drawn at once, as the canvas is, so a button and the model never
    // disagree for a frame and a caller reads the controls it just changed.
    flushSync(() =>
      root.render(
        <Theme>
          <ControlsView
            input={input}
            options={options}
            context={context}
            missing={[...missing]}
            revision={revision}
            helpOpen={helpOpen}
            closeHelp={() => {
              helpOpen = false;
              redraw();
              rows.frame.focus();
            }}
            refresh={refresh}
          />
        </Theme>,
      ),
    );
  };
  function refresh() {
    view.refresh();
    input.recolour();
    redraw();
  }
  const context: ShortcutContext = contextOf(input, refresh, () => {
    helpOpen = !helpOpen;
    redraw();
  });
  const unbind = bindKeys(rows.frame, context, options);
  refresh();
  return {
    redraw,
    reportMissing(name) {
      // The core may resolve the same anchor again, so each name is told once.
      if (missing.includes(name)) return;
      missing.push(name);
      redraw();
    },
    dispose() {
      unbind();
      // Unmounting while React renders is refused, so it waits for the current frame.
      queueMicrotask(() => root.unmount());
    },
  };
}
