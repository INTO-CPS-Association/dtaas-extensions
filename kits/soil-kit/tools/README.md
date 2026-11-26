# Tools

- `replay_hallway_plant.py` publishes an export of the hallway plant setup over MQTT, on the topics and in the units of `examples/visualisation.json`. The kit's README gives its options and how the export maps to the topics.
- `test_replay_hallway_plant.py` tests it on a small synthetic export of the same shape, with no broker and no dependency.

Run the tests from the kit folder:

```bash
python3 -I -m unittest discover -s tools
```

Keep an export outside this repository and read it only with this tool or another reader run in isolated mode. It holds the measurements of the setup, which are not published here.
