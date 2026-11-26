# Examples

The files of the hallway plant twin, a monstera in a small greenhouse at Aarhus University, used by the tests and as the starting point of another soil twin.

- `visualisation.json` is the twin's visualisation: one MQTT transport with every topic of the twin, two soil-profile panes for the moisture and the temperature of the probe, a `soil-depth` anchor for each quantity of the probe, a `soil-event` anchor for the watering and a `soil-site` anchor for each reading of the greenhouse, with the colour presets of the kit.
- `twin.json` registers the four devices with `dtaas-services twin register`: the soil probe with its depth range, the watering log, the air sensor and the light sensor of the greenhouse.

The data are measured, so the transport and the panes name no channel and the page shows each reading without one. The depth of the probe, 0.00 to 0.10 m, is assumed, because the export of the setup gives none.
