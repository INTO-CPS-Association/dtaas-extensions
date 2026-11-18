# soil-kit

A DTaaS domain extension for soil profiles, built from the `hello-kit` template
of this repository. It is a second kit next to `bim-kit` and it is deployed, not
compiled in: the client core, the signals gateway and Telegraf stay as they are.

## Development

Inside this repository the kit uses the SDK it sits next to, as `hello-kit`
does. The tooling at the repository root type-checks, lints and formats its
files, runs its tests and builds its bundle:

```bash
yarn install --frozen-lockfile --ignore-scripts   # at the repository root
yarn typecheck
yarn lint
yarn test:coverage
yarn build:kit soil-kit   # writes examples/soil-kit/dist/deploy/soil/index.js
```

The root tests also build the deployed bundle, run it with the client's shared
modules and pass it through the conformance check. They check every source file
against the SDK's lint rules for kits as well.

The folder is also a project of its own, with `package.json`, `tsconfig.json`,
`vite.config.ts`, `jest.config.json` and `tests/`, so it can be copied out of
this repository as it is. Its sources and tests use relative imports only.
Outside the repository it installs `@into-cps-association/dtaas-sdk` 0.1.1 from
npm, whose `./deploy` entry builds the deployed bundle:

```bash
yarn install
yarn test    # type check and every test
yarn build   # writes dist/deploy/soil/index.js
```

If the SDK release that the kit moves to is 0.2.0, the peer range `^0.1.1` has
to be raised as well, because a caret range on a 0.x version admits patch
releases only.

The soil twin of Aarhus University that the kit serves is not chosen yet. The
devices of `examples/` are simulated: three probes of profile `P03` at 0.00 to
0.20 m, 0.20 to 0.40 m and 0.40 to 0.80 m.

## Model

The twin follows SOSA. A profile is the platform, a probe at one depth range is
the sensor and each quantity it reports is an observed property.

| SOSA                | Soil Twin                      | Where It Lives                        |
| :------------------ | :----------------------------- | :------------------------------------ |
| Feature of interest | Site, then profile             | Topic levels, `device`, `soil_sensor` |
| Platform            | Profile station                | `area` topic level                    |
| Sensor              | Probe at one depth range       | `device_id`                           |
| Observable property | `soil_moisture` and the others | `quantity` topic level                |
| Observation         | One reading                    | `reading` row                         |

The depth range belongs to the sensor, so it is stored once in the kit's table
`soil_sensor`, as `depth_from` and `depth_to` in metres below the surface. It
never becomes part of a name.

## Topic and Units

A reading uses the eight levels of the naming convention:

```text
AUSoil/Site1/field/07/P03/S/S-AUSoil-Site1-field-07-P03-VWC-0002/soil_moisture
project/site/level/plot/profile/device_type/device_id/quantity
```

| Quantity                  | SenML Unit | Shown As |
| :------------------------ | :--------- | :------- |
| `soil_moisture`           | `/`        | %        |
| `soil_temperature`        | `Cel`      | °C       |
| `electrical_conductivity` | `S/m`      | S/m      |
| `matric_potential`        | `Pa`       | kPa      |

The volumetric water content travels as a ratio and the matric potential in
pascal, because SenML has no `m3/m3` and no `kPa`. The kit converts them to per
cent and kilopascal on screen only.

## What It Adds

- The `soil-depth` anchor kind. Its reference is a profile and a depth range in
  metres, such as `P03/0.20-0.40`, with the lower depth below the upper one. The
  profile must be the `area` level of the anchor's topic.
- The `soil-profile` substrate. Each pane draws one quantity, the one its
  descriptor names in `options.quantity` or else the quantity of its first
  anchor. It shows the latest value at each depth at the playhead and a time by
  depth heatmap of the window before the playhead (`options.windowHours`, 24 by
  default), in stretches of a 48th of the window. It reads the channel
  `options.channel` names (`measured` by default) and names any other channel in
  its caption, so simulated data never reads as measured. Values come from
  `HostServices.signals` only. Text takes the page's own colour, so it reads in
  light and dark. Only the data take the colours of the SDK's schemes.
- The presets `soil.moisture` and `soil.temperature`, colour scales over the
  kit's range of each quantity.
- The page `/soil`, which lists the profiles of the twin named by
  `REACT_APP_EXT_SOIL_TWIN` and the latest reading of each sensor. It reads the
  profiles from the `soil-depth` anchors of the twin's `visualisation.json` and
  each signal on the `channel` of the MQTT transport that lists it, `measured`
  when the transport names none. A reading on any other channel carries its
  channel, as in `23.4 % (simulated)`.

## Files

| Path                          | Role                                                                 |
| :---------------------------- | :------------------------------------------------------------------- |
| `src/core/`                   | Topic levels, depth references, units, channels and the heatmap grid |
| `src/react/ProfileTable.tsx`  | The sensors of one profile, a widget that knows nothing of DTaaS     |
| `src/dtaas/index.ts`          | The `DtaasExtension` the host loads                                  |
| `src/dtaas/pages/`            | The lazy page, which reads everything through `useHost()`            |
| `src/dtaas/substrate/`        | The `soil-profile` substrate, in plain SVG                           |
| `src/dtaas/anchors.ts`        | The `soil-depth` anchor kind                                         |
| `src/dtaas/presets/`          | The colour-scale presets                                             |
| `src/dtaas/config.ts`         | Schema for `REACT_APP_EXT_SOIL_TWIN`                                 |
| `services/`                   | The kit folder for `dtaas-services`: `kit.json` and the migration    |
| `examples/visualisation.json` | A visualisation of the simulated profile                             |
| `examples/twin.json`          | A registration of the simulated devices with their depths            |

The tests are in `tests/unit/` and `tests/integration/`.

## Deploy

1. Build the bundle, with `yarn build:kit soil-kit` at the root of this
   repository or `yarn build` in a copy of the folder.
1. Copy `dist/deploy/soil/index.js` to `extensions/soil/index.js` next to the
   client's `env.js`.
1. In `env.js`, list the bundle and name the twin folder under the digital twins
   directory of the library:

   ```js
   REACT_APP_EXTENSIONS_DEPLOYED: 'extensions/soil/index.js',
   REACT_APP_EXT_SOIL_TWIN: 'soil_p03_simulated',
   ```

1. Copy `services/` to `config/kits/soil/` of `dtaas-services`. The folder
   carries the `name` of `kit.json`.
1. Give the gateway the project `AUSoil` next to the ones it already serves. Add
   the project to the group of the twin's owner. This also creates the
   `soil_sensor` table in the group's database next to `device` and `reading`.
   An owner belongs to one group, so the example's group `ausoil` works only for
   an owner of its own. Otherwise use the owner's group, here `swim` with its
   owner. Set the same `group` in `twin.json`:

   ```bash
   dtaas-services user add-signals -p SWiM -p AUSoil
   dtaas-services user add-history -g swim -p SWiM -p AUSoil -o <owner>
   ```

1. Register the twin with its depths, which fills `soil_sensor` from the `kits`
   part of the file:

   ```bash
   dtaas-services twin register -f examples/twin.json
   ```

1. Place `examples/visualisation.json` as `visualisation.json` in the twin's
   folder and commit it. The gateway serves only the topics of the file's `mqtt`
   transports, read from the committed copy in GitLab. The page `/soil` and the
   list of twins read the copy in the user's workspace, so the file has to be in
   both. The Visualise tab then draws the profile and the page `/soil` lists its
   sensors.
