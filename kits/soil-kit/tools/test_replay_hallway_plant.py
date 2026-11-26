"""Tests of the hallway plant replay, on a small synthetic export of the same shape.

Run with `python3 -I -m unittest discover -s tools` from the kit folder. They
need no broker and no dependency.
"""

import json
import tempfile
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path

import replay_hallway_plant as replay

KIT = Path(__file__).resolve().parent.parent
EXAMPLE = json.loads((KIT / "examples" / "visualisation.json").read_text(encoding="utf-8"))

SOIL_HEADER = "parameter,physical_unit,time,units,value\n"
AIR_HEADER = "confidence,parameter,physical_unit,time,units,value\n"


def write_export(folder: Path) -> None:
    """Three files in the shapes of the export, unsorted as it is, with bad rows."""
    (folder / "monstera_soil_moisture.csv").write_text(
        SOIL_HEADER
        + "soil_moisture,monstera,2026-10-15 13:50:00.000000,%RH,30.0\n"
        + "soil_moisture,monstera,2026-10-15 12:00:00.000000,%RH,28.5\n"
        + "soil_moisture,monstera,2026-10-14 10:00:00.000000,%RH,25.0\n"
        + "soil_moisture,monstera,2026-10-15 13:00:00.000000,%,99\n"
        + "soil_moisture,monstera,not a time,%RH,20\n"
        + "soil_moisture,monstera,2026-10-15 13:10:00,%RH,nan\n",
        encoding="utf-8",
    )
    (folder / "monstera_watering.csv").write_text(
        "physical_unit,time,units,value\nmonstera,2026-10-15 12:55:00.500000,ml,50\n",
        encoding="utf-8",
    )
    (folder / "greenhouse_air_humidity.csv").write_text(
        AIR_HEADER + '"±1.0000e+00 at 95.00%",air_humidity,greenhouse,2026-10-15 13:54:00.250000,%,44.5\n',
        encoding="utf-8",
    )


class SeriesTest(unittest.TestCase):
    def test_every_series_is_declared_and_anchored_in_the_example(self):
        declared = {topic for transport in EXAMPLE["transports"] for topic in transport["topics"]}
        anchored = {anchor["signalPath"] for anchor in EXAMPLE["anchors"]}
        topics = {series.topic for series in replay.SERIES.values()}
        self.assertEqual(len(replay.SERIES), 15)
        self.assertEqual(topics, declared)
        self.assertEqual(topics, anchored)

    def test_every_topic_has_eight_levels_without_dots(self):
        for series in replay.SERIES.values():
            levels = series.topic.split("/")
            self.assertEqual(len(levels), 8, series.topic)
            self.assertNotIn(".", series.topic)


class LoadTest(unittest.TestCase):
    def setUp(self):
        self.folder = Path(tempfile.mkdtemp())
        write_export(self.folder)

    def test_reads_converts_and_sorts_the_rows_it_knows(self):
        readings, skipped = replay.load(self.folder, None, None)
        self.assertEqual(
            [(r.topic.rsplit("/", 1)[1], r.value, r.unit) for r in readings],
            [
                ("soil_moisture", 0.25, "/"),
                ("soil_moisture", 0.285, "/"),
                ("watering", 0.05, "l"),
                ("soil_moisture", 0.3, "/"),
                ("relative_humidity", 44.5, "%RH"),
            ],
        )
        self.assertEqual(skipped["monstera_soil_moisture.csv"], 3)

    def test_reads_the_time_as_utc(self):
        readings, _ = replay.load(self.folder, None, None)
        self.assertEqual(readings[-1].ts, datetime(2026, 10, 15, 13, 54, 0, 250000, tzinfo=UTC))

    def test_keeps_the_window_only(self):
        start = replay.parse_time("2026-10-15T12:30:00")
        end = replay.parse_time("2026-10-15T13:51:00+00:00")
        readings, _ = replay.load(self.folder, start, end)
        self.assertEqual([r.value for r in readings], [0.05, 0.3])

    def test_the_last_hours_end_at_the_newest_reading(self):
        args = replay.parse_args(["--data", str(self.folder), "--hours", "2"])
        start, end = replay.window(args)
        self.assertEqual(end, datetime(2026, 10, 15, 13, 54, 0, 250000, tzinfo=UTC))
        self.assertEqual(end - start, timedelta(hours=2))


class PayloadTest(unittest.TestCase):
    def test_is_the_dtaas_payload_with_an_offset_time(self):
        reading = replay.Reading(datetime(2026, 10, 15, 13, 0, tzinfo=UTC), "t", 0.301, "/")
        self.assertEqual(
            json.loads(replay.payload(reading, timedelta(hours=1))),
            {"value": 0.301, "ts": "2026-10-15T14:00:00.000+00:00", "unit": "/"},
        )


class AccountTest(unittest.TestCase):
    def test_reads_the_named_variables_from_an_env_file(self):
        env = Path(tempfile.mkdtemp()) / "broker.env"
        env.write_text("# broker\nLOCAL_USER=jady:publisher\nLOCAL_PASSWORD='secret'\n", encoding="utf-8")
        args = replay.parse_args(
            ["--data", ".", "--env-file", str(env), "--user-var", "LOCAL_USER", "--password-var", "LOCAL_PASSWORD"]
        )
        self.assertEqual(replay.account(args), ("jady:publisher", "secret"))

    def test_stops_without_an_account(self):
        args = replay.parse_args(["--data", ".", "--user-var", "NO_SUCH_USER_VAR"])
        with self.assertRaises(SystemExit):
            replay.account(args)


if __name__ == "__main__":
    unittest.main()
