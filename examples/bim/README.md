# bim-kit

Bind live sensor readings to the objects of a BIM model, by IFC GlobalId, and
show the building as a DTaaS domain extension.

A building model says where things are. A sensor stream says what they measure.
Nothing in either says which reading belongs to which wall. A manifest does, and
this package is the code that reads it, the code that converts the model, and
the code that draws the result.

The manifest is the load-bearing piece: if its schema is right, the conversion,
the viewer and the transport can each be replaced without touching the others.

This folder holds the source of `@into-cps-association/bim-kit` 0.2.0, the
package published to npm from the ifc-utils repository, with the changes of its
next release. Inside this repository it is an example kit of the SDK. It adds
two things to the published package: the `aec` substrate, which draws a building
in the visualisation core, and the build of a deployed bundle.

## What Is In It

Seven entry points, so a consumer takes what it needs and nothing else. The
package is private here, so the entry points describe how the published package
is cut.

| Entry point      | What it holds                                                                      | What it pulls in                                                                            |
| ---------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `.`              | The manifest, the binding, the resolver, the readings, the alerts, the colour ramp | nothing                                                                                     |
| `./schema`       | Validating a manifest a person wrote                                               | `zod`                                                                                       |
| `./converter`    | IFC to geometry, in the browser                                                    | the inlined `web-ifc` WebAssembly                                                           |
| `./viewer`       | The `Viewer` class and its scene, floor filter, heatmap and selection              | `three`                                                                                     |
| `./react`        | The whole page as components                                                       | `react`, `@mui/material` and `zod`, which validates a manifest before the page uses it      |
| `./react/canvas` | The 3D canvas alone, which `./react` loads lazily                                  | `react` and `three`                                                                         |
| `./dtaas`        | The extension the DTaaS client loads, with the `aec` substrate                     | `@into-cps-association/dtaas-sdk`, `react-router-dom` and `zod`, besides those of `./react` |

The core entry point imports nothing at all, which is what lets manifest logic
be tested in jsdom where WebGL, workers and WebAssembly do not exist. Everything
heavier sits behind its own entry point and behind a dynamic import, so a host
that never opens the page never downloads a renderer or a parser.

## What It Does Not Do

**It subscribes to nothing.** Readings are handed in. The package knows neither
the broker nor the topic scheme, which is what lets the same component serve a
local demonstration and a platform deployment. The DTaaS extension follows the
same rule: it asks the host's signals service for the topics the manifest names
and opens no connection of its own.

**It writes no manifest.** Producing one is the job of the Python tools of the
ifc-utils repository, which read the IFC and record the provenance.

## Install

Outside this repository, install the published package:

```bash
npm install @into-cps-association/bim-kit
```

The core has no dependencies. The schema validator is a separate entry point
because it needs `zod`. `./react` validates every manifest it loads, so it needs
`zod` too, and `zod` is a required peer from 0.2.0. A consumer of the core or of
`./viewer` alone never loads it.

## Use

```js
import { resolveBindings, topicOf, displayOf, rampColour } from '@into-cps-association/bim-kit';

// Whatever loaded the geometry produces these. A GLB written by
// ifc_explorer.to_glb carries globalId in glTF `extras` on every node.
const objects = [{ globalId: '0_sgz7bzz4Jh2ckU1ehFe$', nodeName: 'HX-1' }];

const { resolved, unresolved } = resolveBindings(manifest.bindings, objects);

// Bindings that fail are returned instead of dropped. A manifest pointing at
// an object the geometry does not have is the ordinary consequence of a model
// being re-exported, and a viewer that silently draws four markers where the
// manifest asked for six is worse than one that says which two are missing.
for (const { binding, reason } of unresolved) {
  console.warn(`${binding.label}: ${reason}`);
}

for (const { binding, object } of resolved) {
  subscribe(topicOf(binding), (value) => {
    const [low, high] = displayOf(binding).ramp;
    paint(object, rampColour(value, low, high));
  });
}
```

Validating a manifest a person wrote:

```js
import { readManifest } from '@into-cps-association/bim-kit/schema';

const result = readManifest(parsedYaml);
if (!result.ok) {
  // Every problem names its place as `bindings[3].display.ramp`, because that
  // is how a person reads a YAML file.
  for (const { where, message } of result.problems) {
    console.error(`${where}: ${message}`);
  }
}
```

## Naming The Buildings

A file name says what a file is called, not what the building is.
`BuildingModels` shows each model by the name its IFC file gives the building,
read from the file itself. Nothing is named in this package, and there is no
separate file of names: the name lives in the model.

An IFC file names its project and its building near the top. In every model this
was written against, both sit within the first 6 KB, including one of 64 MB, so
the page requests only the first 64 KB of each file with an HTTP range. Twelve
models are named in about 150 ms, and a server that ignores the range is read
only as far as that too, so no model is ever downloaded to name it.

The name is taken from the project's `LongName`, then its `Name`, then the
building's. In the real models the name was on the project, and the building's
own name was empty, template text, or once misspelt. Template text nobody
replaced, "Project Name" and "Building Name", and a job number such as 34372 are
not names and are skipped. A model whose file gives no name is shown by its file
name, with its separators read as spaces. A name two files share identifies
neither, so both keep their file names.

To name a building whose file does not, write the name into the file with
`ifc-set-name`, from the `ifc-converter` package of the ifc-utils repository:

```sh
ifc-set-name Building_1912_AK_v4.ifc "Name of the building" --dry-run
ifc-set-name Building_1912_AK_v4.ifc "Name of the building"
```

It sets the project's `LongName` and changes nothing else: every byte outside
that one argument is left as it was, and no `GlobalId` moves, so a manifest
keeps its sensors.

## The Manifest

The shape is the one proposed for DTaaS.

```yaml
model:
  source: model.ifc
  source_sha256: 60b1b94e...
  converter: ifc_explorer.to_manifest 0.1.0
bindings:
  - selector: { globalId: 1yETHMphv6LwABqR4Pbs5g }
    label: Room 204 temperature
    source:
      live: { transport: mqtt, topic: building/204/temp }
      history: { bucket: swim, measurement: temperature }
    display: { unit: '°C', ramp: [18, 26] }
```

`selector` is a small union of `globalId`, `nodeName` and `expressId`, so a
non-IFC asset reuses this manifest instead of needing a second schema. Exactly
one form must be given: two would leave the resolver choosing, and a manifest
should not depend on which it chose.

`live` and `history` are separate on purpose. MQTT supplies the current value on
the marker, and the time series database supplies the panel behind a click.
Charting is not reimplemented inside the 3D view.

Three optional fields are additions of this project instead of parts of the
proposal, so a manifest written elsewhere still loads: `id`, the short tag a
person says out loud; `mountedOn`, the equipment a sensor sits on; and `role`,
which measurement point on that equipment, written as `TODO` when IFC cannot
say.

The Python converter writes one more, `foundBy`, on a binding whose element is
not an `IfcSensor` and was picked out by the caller's pattern. This package does
not read it, and the schema drops it on load as it drops any field it does not
know.

## The DTaaS Extension

`./dtaas` exports `extension`, a declaration built with `defineExtension` from
`@into-cps-association/dtaas-sdk`, the SDK of this repository. The DTaaS client
lists it in its extension manifest and mounts it under `/bim`:

```js
import { extension } from '@into-cps-association/bim-kit/dtaas';
```

It declares:

- The Buildings page, at `/bim` and `/bim/models/:model`, loaded lazily. The
  folder is read from `?dir=`, then from the
  `REACT_APP_EXT_BIM_MODELS_DIRECTORY` setting, then from the host's models
  folder. A folder that could leave the library is refused before it is listed.
  Files are listed and stored through `host.contents` and readings arrive
  through `host.signals`. `REACT_APP_EXT_BIM_STALE_AFTER_S` sets how old a
  reading may be, in seconds, before the page stops counting it as current. Left
  out, it is 30 seconds.
- The `aec` substrate, for `ifc-guid` anchors, loaded lazily when a visualisation draws a building. The SDK lists no building substrate of its own, so the kit that knows buildings contributes it. It draws the converted model with the same `Viewer` as the Buildings page, puts a marker on every anchored object and colours it from the visualisation's encodings. Its toolbar, floor picker, object panel, legends and list of keys are the components of the Buildings page, drawn in a React root of their own and wrapped in the host's theme, so a building looks and works the same on the page and in a visualisation.
- An `ifc-guid` anchor kind, the `bim.ifc-to-glb` converter, the
  `bim.thermal-comfort` and `bim.co2` presets, and the `bim.room` and
  `bim.storey` scopes, which a host's visualisation core can merge with those of
  other kits.
- `manifestToVisualisation`, which turns a binding manifest into a
  `visualisation.json` asset.

### The Deployed Bundle

A deployment can load the extension without rebuilding the client. `yarn build:kit` writes one script, `dist/deploy/bim/index.js`, with the Vite settings of the SDK's `./deploy` entry. `DTAAS_KIT_OUT` names another output folder. The bundle takes React, the router, MUI, zod and the SDK from the client and carries everything else, three.js and the inlined `web-ifc` WebAssembly among it, so it is about 6.1 MB. An operator copies it to `extensions/bim/index.js` next to the client's `env.js` and lists it in `REACT_APP_EXTENSIONS_DEPLOYED`.

The client shares `react-dom/client` with a bundle, and the `aec` substrate starts its React root with that copy. A bundle that carried its own would hold a CommonJS module, which a browser cannot run, so `test/kit/kitBundle.test.ts` checks that the bundle holds no CommonJS `require` and reads `react-dom/client` from the host.

### Peers

The SDK and `react-router-dom` are optional peers, needed only by a host that
imports `./dtaas`, which also needs `zod` and React 19 or newer, since the SDK
requires both. The other entry points work without the SDK and the router, so a
host outside DTaaS keeps using `./react` as before.

## Alerts

`alertsOf` lists what is wrong with one sensor, most urgent first. The sensor
cards show each alert as a chip. Every alert comes from data that already
arrived. The range comes from the manifest and the unit and the kind come from
the payload.

- A reading counts as current while it is younger than the stale threshold and
  the feed is live. The threshold is `DEFAULT_STALE_AFTER_S`, 30 seconds.
  `alertsOf`, `isLive` and `ageText` take another value as their `staleAfter`
  argument. A host sets it for the whole page through the `staleAfter` prop of
  `BuildingModels`, in seconds. The cards, the markers and the heatmap all use
  it. On DTaaS the setting is `REACT_APP_EXT_BIM_STALE_AFTER_S`. An installation
  whose controller stamps its readings about 55 seconds late, as the first one
  does, sets it above that, for example to 90, or every reading arrives already
  stale.
- A current value outside the manifest's `ramp` raises `Above Range` or
  `Below Range`.
- A payload `unit` that differs from the manifest's `display.unit` raises
  `Unit Differs`. Both sides are compared after mapping SenML unit codes to the
  way a manifest writes them, so `Cel` matches `°C`. `displayUnit` exposes that
  map.
- A value that was not measured raises a note named after what it is, such as
  `Simulated` or `Predicted`. The reading's `kind`, from the payload, is read
  first and its `channel` second. `kind: sample` and the DTaaS channel
  `measured` both count as measured. Any other word is shown as it arrived. On
  the DTaaS page every reading carries the channel it came on, so a simulated
  value is marked as simulated on its card.

## Checking the Model File

`source_sha256` in the manifest must be 64 hexadecimal characters or `unknown`.
The Buildings page also computes the SHA-256 of the IFC file in the browser with
Web Crypto and compares it with the manifest. When the page converts the IFC
file, it hashes the bytes it already fetched. When it draws stored geometry, the
hash of the geometry would never equal the hash of the IFC file it was made
from, so the page fetches the IFC file once for the check. A file that differs
raises a warning above the drawing that names the first characters of both
hashes, since a re-export changes the GlobalIds and the sensors may then sit on
the wrong objects. `unknown` in the manifest compares nothing and the page says
so in one quiet line. A match says nothing. The page cannot compare when the
browser offers no Web Crypto (it does only on HTTPS or on localhost) or when the
IFC file is above the 200 MB the browser converts. It then says so in the same
quiet line. `sha256Hex` and `compareSource` are exported from the package root.

## Sensors on the Model

Each sensor is a dot at the centre of its object, drawn over the walls in front
of it, with a label that gives its short tag and its current value. A dot is at
least 14 pixels across however far away the camera is. It takes the colour of
its value on the manifest's ramp while the reading is current and is grey
otherwise. The selected sensor is at least 24 pixels across and in the selection
colour. Its label is outlined and bold. The labels take their colours from the
host's theme, so they read in a light and in a dark theme.

Clicking a sensor card, or a sensor's dot or label in the view, selects its
object and flies the camera to it in 600 ms, keeping the direction the camera
looks from. The sensor's dot grows once and settles back so the eye goes to it.
The `s` key, Frame The Selection in the shortcut list, does the same for
whatever is selected. `f` still fits the whole model. A system set to reduce
motion gets the jump and no pulse.

## Looking at the Model

The model is lit from a small built-in room as well as by the sun, throws
shadows on itself and on a ground under it. It has ambient occlusion in its
creases. The occlusion is drawn when the camera rests and the shadows only when
what is shown changes, so a large model still turns smoothly. The occlusion is
left out while the shell is transparent. The shadows are left out while a cut is
on, which the shadows button says. All of it comes from three.js, which is a
peer dependency already, so the package adds nothing. Every tool has a key, a
button on the toolbar and a line in the help, all from one table in
`viewer/shortcuts.ts`:

| Key      | Tool                                                                   |
| -------- | ---------------------------------------------------------------------- |
| `x`      | Cut the floor in view at chest height, where the heatmap's plan is cut |
| `v`      | Cut through the middle along X, then along Z, then not at all          |
| `j`, `k` | Move the vertical cut, or the horizontal one, by 0.25 m                |
| `g`      | The grid of metres under the model                                     |
| `i`      | Show the selected object alone                                         |
| `d`      | Measure a length, an area or an angle                                  |
| `o`      | The parallel view, for plans and elevations                            |
| `l`      | The sun's shadows                                                      |
| `u`      | Walk at eye height with the arrow keys                                 |
| `n`      | Draw on the view with a pen, an arrow, a box or a line of text         |
| `y`      | Paint the model in one colour, by class or as a wireframe              |
| `z`      | The background: light, dim, slate or ink                               |

The view cube in the bottom right corner looks at the model from the face, edge
or corner clicked. The keys `1` to `5` reach five of its six faces from the
keyboard (above, front, side, behind and below). A sensor's label can also be
reached with Tab and opened with Enter. Under the object panel, the model tree
lists the objects by floor or by class and finds them by any word of their name,
class, GlobalId or property values.

## One Renderer

The Buildings page and the `aec` substrate draw a building with the same code: the `Viewer` class of `./viewer`, which needs no framework. It owns the WebGL renderer, the scene, the camera, the orbit controls and the frame loop and gives the WebGL context back when it is unmounted.

```js
import { Viewer, loadGlb } from '@into-cps-association/bim-kit/viewer';

const viewer = new Viewer();
viewer.mount(element, { onSelect: (globalId) => console.log(globalId) });
const handle = viewer.show(await loadGlb(url), { placed, tree });
handle.look('top');
viewer.unmount();
```

`element` must be positioned, since the labels are laid over the canvas. `placed` lists the bindings the resolver found an object for, `tree` is the property tree beside the model and `handle.view` is the `SceneView` the shortcuts drive. A marker can also be added after the model with `viewer.markers.add(binding, object)`, which returns a handle that colours, labels and hides that one marker. `BimCanvas` is a thin React component around this class.

## Checking a Re-Export

`scripts/check-reexport.mjs` takes a manifest and another export of the same
building, as IFC or as GLB, resolves every binding against it with the package's
own resolver and prints which bindings survive and which do not, with the
resolver's reason. It also says whether the model is the file the manifest's
hash names. It reads the built package, so run `yarn build` first. It exits with
1 when a binding is lost.

```bash
node scripts/check-reexport.mjs room.manifest.json room-reexported.ifc
node scripts/check-reexport.mjs room.manifest.json room-reexported.glb --json
```

## Develop

The SDK is not taken from npm. `yarn sdk` builds the SDK at the root of this
repository, packs it and unpacks the tarball into `node_modules`, so the kit is
tested against the SDK it sits next to, installed the way any consumer installs
it. Run it again after a change to the SDK.

```bash
yarn install --frozen-lockfile --ignore-scripts   # once, at the repository root
cd examples/bim
yarn install --frozen-lockfile --ignore-scripts
yarn sdk
yarn typecheck
yarn test
```

| Command              | What it does                                                                          |
| -------------------- | ------------------------------------------------------------------------------------- |
| `yarn sdk`           | Build, pack and install the SDK of this repository                                    |
| `yarn wasm`          | Inline `web-ifc.wasm` into `src/generated/wasm.ts`                                    |
| `yarn build`         | ES modules and type declarations into `dist/esm/`                                     |
| `yarn build:kit`     | The deployed bundle, into `dist/deploy/bim/index.js`                                  |
| `yarn typecheck`     | Type check the sources, the Jest tests and `vite.config.ts`                           |
| `yarn format:check`  | Check the formatting with Prettier (`yarn format` rewrites it)                        |
| `yarn lint`          | Lint with ESLint                                                                      |
| `yarn test:node`     | Build, then run `test/*.test.mjs` with the Node test runner against `dist/`           |
| `yarn test:jest`     | Run the Jest tests of `test/aec/`, `test/viewer/` and `test/kit/`                     |
| `yarn test`          | Both suites                                                                           |
| `yarn test:coverage` | Both suites with their coverage gates                                                 |
| `yarn test:e2e`      | Build, pack and install the package in a clean project, then import every entry point |

The Node suite imports from `dist/`, not from `src/`. A test that passes on the source and fails on the artifact is a test that did not do its job. The tests of the `Viewer` class, of the `aec` substrate and of the deployed bundle run under Jest, against the TypeScript source and the built bundle. jsdom has no WebGL, so those tests replace the renderer and the occlusion pass with stand-ins and keep the rest of three.js real.

The coverage gates sit at or just below what the code reaches today, so a
change that drops coverage fails and one that raises it can raise the gate.

| Suite                              | Lines | Statements | Branches | Functions |
| ---------------------------------- | ----- | ---------- | -------- | --------- |
| Node test runner, over `dist/esm/` | 93 %  | not given  | 94 %     | 92 %      |
| Jest, over `src/aec/` and `Viewer` | 96 %  | 95 %       | 85 %     | 94 %      |

The Node test runner measures the built modules its tests import and leaves out the inlined WebAssembly and the files of the `Viewer` class, which the Jest suite measures. It reports no statement figure. The thresholds are in the `test:node:coverage` script and in `jest.config.json`.

ESLint runs the recommended JavaScript and TypeScript rules, the classic React
hooks rules and the import boundaries the SDK asks of every kit. The limits of
25 lines for a function and 250 lines for a file are reported as warnings, since
part of the code is still above them.

`test/fixtures/` holds three IFC files from the buildingSMART Certification
datasets, copyright buildingSMART International Ltd. and licensed CC BY 4.0,
renamed after what each one is for and otherwise unmodified. Each breaks an
assumption a converter is likely to make: `wall_kernel_keeps_units.ifc` declares
millimetres, `column_in_inches.ifc` declares inches and
`basin_at_the_origin.ifc` is a single object at the origin.
