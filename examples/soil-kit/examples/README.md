# Examples

The files of one simulated soil twin, used by the tests and as the starting
point of a real one.

- `visualisation.json` is the twin's visualisation: one MQTT transport on the
  `simulated` channel, two soil-profile panes on the same channel, a
  `soil-depth` anchor for each signal and the colour presets of the kit.
- `twin.json` registers the three simulated probes of profile `P03` with
  `dtaas-services twin register`, with the depth range of each.

The devices are simulated, so every reading the page shows from them carries
`(simulated)`.
