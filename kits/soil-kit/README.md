# soil-kit

A DTaaS domain extension for soil twins, built from the `hello-kit` template of this repository. It is a second kit next to `bim-kit` and it is deployed, not compiled in: the client core, the signals gateway and Telegraf stay as they are.

## Development

The kit is a package of its own, as every kit of `kits/` is, with its own lockfile, lint and format settings, tests and CI job. `yarn contract` builds the contract at the root of this repository, packs it and unpacks the tarball into `node_modules`, so the kit is tested against the contract it sits next to:

```bash
yarn install --frozen-lockfile --ignore-scripts   # once, at the repository root
cd kits/soil-kit
yarn install --frozen-lockfile --ignore-scripts
yarn contract
yarn format:check && yarn lint && yarn typecheck
yarn test:coverage
python3 -I -m unittest discover -s tools   # the replay tool, no dependency needed
yarn build:kit   # writes dist/deploy/soil/index.js
```

`tests/integration/kitBundle.test.ts` builds the deployed bundle, runs it with the client's shared modules and passes it through the conformance check. The lint settings include the SDK's rules for kits.

Its sources and tests use relative imports only, so the folder can be copied out of this repository. A copy deletes the `contract` script and installs `@into-cps-association/dtaas-extensions` 0.2.0 from npm, whose `./deploy` entry builds the deployed bundle.

The peer range is `^0.2.0`. A caret range on a 0.x version admits patch releases only, so a kit that moves to 0.3.0 raises the range as well.

## The Hallway Plant

The twin of `examples/` is the hallway plant setup at Aarhus University: a monstera in a pot inside a small greenhouse. One soil probe in the pot reports moisture, temperature and electrical conductivity about every 11 seconds. Each watering of the plant is logged with its volume, from 20 to 100 ml. A sensor in the greenhouse reports the air temperature and humidity and another one the light in nine bands, from 415 nm to 910 nm, about every 16 seconds.

The data come from an export of the setup, one CSV file per series with its time in UTC. The export used here runs from 9 September to 15 October 2026. It is not part of this repository and the tests use a small synthetic export of the same shape.

The greenhouse is the site and the monstera is the profile. The export gives no depth for the probe, so the example places it at 0.00 to 0.10 m below the surface. Change the anchors and `twin.json` together when the depth is measured.

## Model

The twin follows SOSA. A profile is the platform, a probe at one depth range is the sensor and each quantity it reports is an observed property. A watering is an event of a profile. The air and the light are readings of the site, which no profile owns.

| SOSA                | Soil Twin                                  | Where It Lives                        |
| :------------------ | :----------------------------------------- | :------------------------------------ |
| Feature of interest | Site, then profile                         | Topic levels, `device`, `soil_sensor` |
| Platform            | Profile station, or the site's own sensors | `area` topic level                    |
| Sensor              | Probe at one depth range, or a site sensor | `device_id`                           |
| Observable property | Each quantity, such as `soil_moisture`     | `quantity` topic level                |
| Observation         | One reading or one watering                | `reading` row                         |

The depth range belongs to the sensor, so it is stored once in the kit's table `soil_sensor`, as `depth_from` and `depth_to` in metres below the surface. It never becomes part of a name. A device of the site or a watering has no depth, so it has no `soil_sensor` row.

## Topic and Units

A reading uses the eight levels of the naming convention. The site is the `building` level, the plot the `unit_id` level and the profile the `area` level. The devices of the site use the `area` level `Site`:

```text
project/site/level/plot/profile/device_type/device_id/quantity
AUSoil/Greenhouse/hallway/01/Monstera/S/S-AUSoil-Greenhouse-hallway-01-Monstera-VWC-0001/soil_moisture
AUSoil/Greenhouse/hallway/01/Monstera/S/S-AUSoil-Greenhouse-hallway-01-Monstera-WAT-0001/watering
AUSoil/Greenhouse/hallway/01/Site/S/S-AUSoil-Greenhouse-hallway-01-Site-TRH-0001/air_temperature
AUSoil/Greenhouse/hallway/01/Site/S/S-AUSoil-Greenhouse-hallway-01-Site-SPC-0001/light_level_445nm
```

| Quantity                                                      | SenML Unit | Shown As |
| :------------------------------------------------------------ | :--------- | :------- |
| `soil_moisture`                                               | `/`        | %        |
| `soil_temperature`                                            | `Cel`      | °C       |
| `electrical_conductivity`                                     | `S/m`      | S/m      |
| `matric_potential`                                            | `Pa`       | kPa      |
| `watering`                                                    | `l`        | ml       |
| `air_temperature`                                             | `Cel`      | °C       |
| `relative_humidity`                                           | `%RH`      | %RH      |
| `light_level_415nm` to `_680nm`, `light_level_infrared_910nm` | `1/s`      | /s       |

The volumetric water content travels as a ratio, the matric potential in pascal and a watering in litres, because SenML has no `m3/m3`, no `kPa` and no `ml`. A count of photons per second travels as `1/s`, because SenML has no unit for photons. The kit converts to per cent, kilopascal and millilitre on screen only.

## From the Export to the Topics

| Export File                                     | Quantity                  | Export Unit | Conversion      |
| :---------------------------------------------- | :------------------------ | :---------- | :-------------- |
| `monstera_soil_moisture.csv`                    | `soil_moisture`           | `%RH`       | Divided by 100  |
| `monstera_soil_temperature.csv`                 | `soil_temperature`        | `°C`        | None            |
| `monstera_soil_electrical_conductivity.csv`     | `electrical_conductivity` | `μS/cm`     | Times 1e-4, S/m |
| `monstera_watering.csv`                         | `watering`                | `ml`        | Divided by 1000 |
| `greenhouse_air_temperature.csv`                | `air_temperature`         | `°C`        | None            |
| `greenhouse_air_humidity.csv`                   | `relative_humidity`       | `%`         | None            |
| `greenhouse_light_level_<band>.csv`, nine files | `light_level_<band>`      | `photons/s` | None            |

The export writes the soil moisture in per cent with the unit `%RH` and does not say how the probe measures it. The kit reads it as a volumetric water content in per cent.

## Replay

`tools/replay_hallway_plant.py` reads the CSV files of an export and publishes each row as one MQTT message on the topics above, in the DTaaS payload format, so the readings reach the broker as they would from the devices. Run it with uv, which installs its one dependency, `paho-mqtt`:

```bash
uv run tools/replay_hallway_plant.py --data <export>/csv --dry-run
uv run tools/replay_hallway_plant.py --data <export>/csv \
  --host 127.0.0.1 --port 8883 --ca <broker CA certificate> \
  --env-file <file with the broker account> --hours 24 --clock now
```

| Option                         | Meaning                                                                                                                    |
| :----------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| `--hours`                      | The last hours of the export, 24 by default and 0 for all of it                                                            |
| `--from`, `--to`               | A window in ISO 8601 times instead, in UTC when they carry no offset                                                       |
| `--clock`                      | `original` keeps the times of the export. `now` moves every time by one offset, so the last one is the start of the replay |
| `--rate`                       | Messages a second, 1000 by default and 0 for no limit                                                                      |
| `--user-var`, `--password-var` | The names of the variables that hold the broker account, `MQTT_USER` and `MQTT_PASSWORD` by default                        |
| `--dry-run`                    | Count the readings of each topic and publish nothing                                                                       |

The account is read from the environment or from the `--env-file`, by variable name. The password never appears on the command line or in the log. Only the files the tool knows and only rows with the expected unit are read. A row with another unit, a bad time or a value that is not a number is skipped and counted in the log.

With `--clock now` the values stay as measured and only their times move, so the profile and the heatmap show a day of real data that ends now. The gateway streams only what is published while a page is open. A page shows the replayed readings when it is open during the replay, or when the history of the platform services stores them.

## What It Adds

- The `soil-depth` anchor kind. Its reference is a profile and a depth range in metres, such as `Monstera/0.00-0.10`, with the lower depth below the upper one. The profile must be the `area` level of the anchor's topic.
- The `soil-event` anchor kind. Its reference is a profile, the `area` level of the topic, such as `Monstera` for a watering.
- The `soil-site` anchor kind. Its reference is a site, the `building` level of the topic, such as `Greenhouse` for the air temperature.
- The `soil-profile` substrate. Each pane draws one quantity, the one its descriptor names in `options.quantity` or else the quantity of its first anchor. It shows the latest value at each depth at the playhead and a time by depth heatmap of the window before the playhead (`options.windowHours`, 24 by default), in stretches of a 48th of the window. It reads the channel `options.channel` names (`measured` by default) and names any other channel in its caption, so simulated data never reads as measured. It draws `soil-depth` anchors only. Values come from `HostServices.signals` only. Text takes the page's own colour, so it reads in light and dark. Only the data take the colours of the SDK's schemes.
- The presets `soil.moisture` and `soil.temperature`, colour scales over the kit's range of each quantity.
- The page `/soil`, which lists the profiles and the sites of the twin named by `REACT_APP_EXT_SOIL_TWIN`. A profile shows the latest reading of each sensor downwards and the latest of each event with its time, such as `50 ml at 2026-10-15 12:00 UTC`. A site shows the latest of each of its readings. It reads them from the anchors of the twin's `visualisation.json` and each signal on the `channel` of the MQTT transport that lists it, `measured` when the transport names none. A reading on any other channel carries its channel, as in `23.4 % (simulated)`.

## Files

| Path                            | Role                                                                            |
| :------------------------------ | :------------------------------------------------------------------------------ |
| `src/core/`                     | Topic levels, depths, events and site readings, units, channels and the heatmap |
| `src/react/ReadingTable.tsx`    | The signals of one profile or one site, a widget that knows nothing of DTaaS    |
| `src/dtaas/index.ts`            | The `DtaasExtension` the host loads                                             |
| `src/dtaas/pages/`              | The lazy page, which reads everything through `useHost()`                       |
| `src/dtaas/substrate/`          | The `soil-profile` substrate, in plain SVG                                      |
| `src/dtaas/anchors.ts`          | The `soil-depth`, `soil-event` and `soil-site` anchor kinds                     |
| `src/dtaas/presets/`            | The colour-scale presets                                                        |
| `src/dtaas/config.ts`           | Schema for `REACT_APP_EXT_SOIL_TWIN`                                            |
| `services/`                     | The kit folder for `dtaas-services`: `kit.json` and the migration               |
| `examples/visualisation.json`   | The visualisation of the hallway plant                                          |
| `examples/twin.json`            | A registration of its devices, with the depth of the probe                      |
| `tools/replay_hallway_plant.py` | The replay of an export over MQTT                                               |

The tests are in `tests/unit/`, `tests/integration/` and, for the replay tool, `tools/`.

## Deploy

1. Build the bundle with `yarn build:kit`.
1. Copy `dist/deploy/soil/index.js` to `extensions/soil/index.js` next to the client's `env.js`.
1. In `env.js`, list the bundle and name the twin folder under the digital twins directory of the library:

   ```js
   REACT_APP_EXTENSIONS_DEPLOYED: 'extensions/soil/index.js',
   REACT_APP_EXT_SOIL_TWIN: 'hallway_plant',
   ```

1. Copy `services/` to `config/kits/soil/` of `dtaas-services`. The folder carries the `name` of `kit.json`.
1. Give the gateway the project `AUSoil` next to the ones it already serves. Add the project to the group of the twin's owner. This also creates the `soil_sensor` table in the group's database next to `device` and `reading`. An owner belongs to one group, so the example's group `ausoil` works only for an owner of its own. Otherwise use the owner's group, here `swim` with its owner. Set the same `group` in `twin.json`:

   ```bash
   dtaas-services user add-signals -p SWiM -p AUSoil
   dtaas-services user add-history -g swim -p SWiM -p AUSoil -o <owner>
   ```

1. Register the twin with the depth of its probe, which fills `soil_sensor` from the `kits` part of the file:

   ```bash
   dtaas-services twin register -f examples/twin.json
   ```

1. Place `examples/visualisation.json` as `visualisation.json` in the twin's folder and commit it. The gateway serves only the topics of the file's `mqtt` transports, read from the committed copy in GitLab. The page `/soil` and the list of twins read the copy in the user's workspace, so the file has to be in both. The Visualise tab then draws the profile and the page `/soil` lists its sensors, its waterings and the readings of its site.
1. Publish the readings with the replay tool, or connect the devices to the broker on the same topics.
