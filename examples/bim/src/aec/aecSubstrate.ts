/**
 * The `aec` substrate (architecture, engineering and construction): a
 * building model in 3D, the peer of the `image` substrate. Each anchor names
 * an IFC object by its GlobalId, and the sensor gets a marker on that object
 * with a label, which the resolved encodings colour and fill with the value.
 * Around the canvas sit the controls of the Buildings page, the same
 * components laid out as on that page: the toolbar and floor picker above it,
 * the facts of a picked object and the legends below it.
 *
 * It draws the converted model (GLB), which the Buildings page of bim-kit
 * converts from IFC and stores beside the IFC, with the viewer that page
 * draws with. The controls render in a React root of their own, started with
 * the host's `react-dom/client` and wrapped in the host's theme.
 */

import type {
  Anchor,
  ElementRef,
  HostServices,
  ResolvedEncoding,
  SubstrateAdapter,
  SubstrateDescriptor,
} from '@into-cps-association/dtaas-sdk';
import type { PaneRows } from './aecControls.js';
import { modelAddress, sensorName } from './aecModel.js';
import type { AecPane, Paint } from './aecPane.js';

const ID = 'aec';
const ANCHOR_KIND = 'ifc-guid';

/** The pane: a row of controls, the canvas, and a row of panels. The
 * canvas gets a height, since a canvas has none of its own. */
function paneRows(): PaneRows {
  const [frame, above, canvas, below] = [0, 1, 2, 3].map(() => document.createElement('div'));
  frame.tabIndex = 0; // so the keys reach the options
  frame.setAttribute('aria-label', 'Building model');
  Object.assign(canvas.style, {
    position: 'relative',
    width: '100%',
    height: '70vh',
    minHeight: '360px',
    overflow: 'hidden',
  });
  frame.append(above, canvas, below);
  return { frame, above, canvas, below };
}

/** Load the scene code and draw the model in the pane. */
async function drawModel(rows: PaneRows, url: string, host: HostServices): Promise<AecPane> {
  const { AecPane: Pane } = await import('./aecPane.js');
  const pane = new Pane(rows, host.ui.Theme);
  try {
    await pane.load(url);
  } catch {
    // The loader's own message names internal addresses, so the pane says
    // what the person can act on, and the WebGL context is given back.
    pane.dispose();
    throw new Error(
      'The converted model (.glb) could not be loaded. Open the model once on the Buildings page to convert it.',
    );
  }
  return pane;
}

/** What one resolved encoding asks of a marker. A colour goes through the
 * heatmap option, which may show another. */
function paintOf({ encoding, properties }: ResolvedEncoding): Paint {
  const colour = (properties.fill ?? properties.color) as string | undefined;
  return {
    colour: colour ? { encoding, value: colour } : undefined,
    visible: 'visible' in properties ? properties.visible !== false : undefined,
    text: typeof properties.text === 'string' ? properties.text : undefined,
  };
}

const ref = (id: string): ElementRef => ({ substrate: ID, id });

/** Put a marker on the object an anchor names, or report it missing. */
function resolveAnchor(pane: AecPane | null, anchor: Anchor): ElementRef | null {
  if (anchor.kind !== ANCHOR_KIND || !pane) return null;
  const name = sensorName(anchor.signalPath, anchor.label);
  return pane.addAnchor(anchor.signalPath, anchor.ref, name) ? ref(anchor.signalPath) : null;
}

/** Where the converted model of a descriptor is served from. */
function modelUrl(host: HostServices, descriptor: SubstrateDescriptor) {
  if (!descriptor.source) throw new Error('An aec substrate needs a model');
  const address = modelAddress(descriptor.source, host.library.conventions.modelsDirectory);
  return host.library.resolve(address);
}

export default function createAecSubstrate(host: HostServices): SubstrateAdapter {
  const rows = paneRows();
  let pane: AecPane | null = null;
  return {
    id: ID,
    supports: [ANCHOR_KIND],
    async mount(container, descriptor: SubstrateDescriptor) {
      const url = modelUrl(host, descriptor);
      container.append(rows.frame);
      pane = await drawModel(rows, await url, host);
    },
    resolve: (anchor: Anchor) => resolveAnchor(pane, anchor),
    apply: (target, resolved) => pane?.paint(target.id, paintOf(resolved)),
    frame: (target) => pane?.frame(target.id),
    pick: (x, y) => {
      const key = pane?.pick(x, y);
      return key ? ref(key) : null;
    },
    setTime: () => undefined, // A model has no time. The core moves the values.
    dispose: () => {
      pane?.dispose();
      rows.frame.remove();
    },
  };
}
