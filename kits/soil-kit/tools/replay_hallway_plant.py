# /// script
# requires-python = ">=3.12"
# dependencies = ["paho-mqtt==2.2.0"]
# ///
"""Replay the export of the hallway plant setup over MQTT, on soil-kit's topics.

The export holds one CSV file per series, such as `monstera_soil_moisture.csv`
with the columns `parameter,physical_unit,time,units,value`. The `time` column
is in UTC and carries no offset. Each row becomes one message on the topic of
`examples/visualisation.json`, in the DTaaS payload format with a SenML unit:

    {"value": 0.3, "ts": "2026-10-15T13:50:00.000+00:00", "unit": "/"}

The tool reads only the CSV files it knows and only rows whose unit is the one
it expects. Run it with uv, which installs the one dependency:

    uv run tools/replay_hallway_plant.py --data <export>/csv --dry-run

The broker account comes from the environment, or from an env file, under the
names `--user-var` and `--password-var` give. The password is never printed
and never passed on the command line.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import math
import os
import ssl
import sys
import time
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Iterable, Iterator

log = logging.getLogger("replay_hallway_plant")

PREFIX = "AUSoil/Greenhouse/hallway/01"


def _device(area: str, code: str) -> str:
    return f"S-AUSoil-Greenhouse-hallway-01-{area}-{code}-0001"


@dataclass(frozen=True)
class Series:
    """One CSV file of the export and the topic its rows are published on."""

    topic: str
    # The unit the export writes in its `units` column.
    source_unit: str
    # The SenML unit on the wire and the factor from the source unit to it.
    unit: str
    scale: float = 1.0


def _series(area: str, code: str, quantity: str, source: str, unit: str, scale: float = 1.0) -> Series:
    device = _device(area, code)
    return Series(f"{PREFIX}/{area}/S/{device}/{quantity}", source, unit, scale)


LIGHT_BANDS = ("415nm", "445nm", "480nm", "515nm", "555nm", "590nm", "630nm", "680nm", "infrared_910nm")

# The file stem of each series of the export. Soil moisture is written in per
# cent with the unit `%RH` and travels as a ratio. The conductivity is in
# microsiemens per centimetre, 1e-4 S/m. A watering is in millilitres and
# travels in litres. A photon count per second travels as `1/s`.
SERIES: dict[str, Series] = {
    "monstera_soil_moisture": _series("Monstera", "VWC", "soil_moisture", "%RH", "/", 0.01),
    "monstera_soil_temperature": _series("Monstera", "VWC", "soil_temperature", "°C", "Cel"),
    "monstera_soil_electrical_conductivity": _series(
        "Monstera", "VWC", "electrical_conductivity", "μS/cm", "S/m", 1e-4
    ),
    "monstera_watering": _series("Monstera", "WAT", "watering", "ml", "l", 1e-3),
    "greenhouse_air_temperature": _series("Site", "TRH", "air_temperature", "°C", "Cel"),
    "greenhouse_air_humidity": _series("Site", "TRH", "relative_humidity", "%", "%RH"),
    **{
        f"greenhouse_light_level_{band}": _series("Site", "SPC", f"light_level_{band}", "photons/s", "1/s")
        for band in LIGHT_BANDS
    },
}


@dataclass(frozen=True)
class Reading:
    ts: datetime
    topic: str
    value: float
    unit: str


def parse_time(text: str) -> datetime:
    """A `time` cell of the export, in UTC, as an aware datetime."""
    moment = datetime.fromisoformat(text)
    if moment.tzinfo is not None:
        return moment.astimezone(UTC)
    return moment.replace(tzinfo=UTC)


def read_series(path: Path, series: Series, skipped: Counter) -> Iterator[Reading]:
    """The rows of one CSV file with the expected unit and a finite value."""
    with path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            try:
                value = float(row["value"])
                ts = parse_time(row["time"])
            except (KeyError, TypeError, ValueError):
                skipped[path.name] += 1
                continue
            if row.get("units") != series.source_unit or not math.isfinite(value):
                skipped[path.name] += 1
                continue
            # Rounded so the conversion adds no digits the sensor never gave.
            yield Reading(ts, series.topic, round(value * series.scale, 9), series.unit)


def load(data: Path, start: datetime | None, end: datetime | None) -> tuple[list[Reading], Counter]:
    """Every known series in `data`, between `start` and `end`, oldest first."""
    skipped: Counter = Counter()
    readings: list[Reading] = []
    for stem, series in SERIES.items():
        path = data / f"{stem}.csv"
        if not path.is_file():
            log.warning("%s is missing, its series is left out", path.name)
            continue
        readings.extend(
            reading
            for reading in read_series(path, series, skipped)
            if (start is None or reading.ts >= start) and (end is None or reading.ts <= end)
        )
    readings.sort(key=lambda reading: reading.ts)
    return readings, skipped


def latest_time(data: Path) -> datetime:
    """The time of the newest row of any known series in `data`."""
    newest = max(
        (
            reading.ts
            for stem, series in SERIES.items()
            if (data / f"{stem}.csv").is_file()
            for reading in read_series(data / f"{stem}.csv", series, Counter())
        ),
        default=None,
    )
    if newest is None:
        sys.exit(f"No readings in {data}.")
    return newest


def payload(reading: Reading, offset: timedelta = timedelta(0)) -> str:
    """The DTaaS payload of a reading, its time moved by `offset`."""
    ts = (reading.ts + offset).isoformat(timespec="milliseconds")
    return json.dumps({"value": reading.value, "ts": ts, "unit": reading.unit})


def read_env_file(path: Path) -> dict[str, str]:
    """`NAME=value` lines of an env file, without comments or quotes."""
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        name, sep, value = line.strip().partition("=")
        if sep and name and not name.startswith("#"):
            values[name.strip()] = value.strip().strip("'\"")
    return values


def account(args: argparse.Namespace) -> tuple[str, str]:
    """The broker user and password, from the environment or the env file."""
    values = dict(os.environ)
    if args.env_file:
        values.update(read_env_file(Path(args.env_file).expanduser()))
    user = values.get(args.user_var)
    password = values.get(args.password_var)
    if not user or not password:
        sys.exit(f"Set {args.user_var} and {args.password_var}, or name an env file that holds them.")
    return user, password


def summary(readings: Iterable[Reading]) -> dict[str, tuple[int, str, str]]:
    """Per topic: how many readings, the first time and the last time."""
    topics: dict[str, list] = {}
    for reading in readings:
        entry = topics.setdefault(reading.topic, [0, reading.ts, reading.ts])
        entry[0] += 1
        entry[2] = reading.ts
    return {topic: (n, first.isoformat(), last.isoformat()) for topic, (n, first, last) in topics.items()}


def publish(readings: list[Reading], offset: timedelta, args: argparse.Namespace) -> None:
    """Send every reading to the broker, at most `args.rate` a second."""
    import paho.mqtt.client as mqtt  # Imported here, so the dry run needs no dependency.

    user, password = account(args)
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=args.client_id)
    client.username_pw_set(user, password)
    client.tls_set(ca_certs=str(Path(args.ca).expanduser()), cert_reqs=ssl.CERT_REQUIRED)
    client.connect(args.host, args.port, keepalive=30)
    client.loop_start()
    started = time.monotonic()
    try:
        for index, reading in enumerate(readings, start=1):
            info = client.publish(reading.topic, payload(reading, offset), qos=1)
            if args.rate > 0 and index % args.rate == 0:
                # Wait for the broker, then for the rest of the second.
                info.wait_for_publish(timeout=30)
                time.sleep(max(0.0, index / args.rate - (time.monotonic() - started)))
            if index % 10_000 == 0:
                log.info("published %d of %d", index, len(readings))
        if readings:
            info.wait_for_publish(timeout=30)
    finally:
        client.loop_stop()
        client.disconnect()
    log.info("published %d readings in %.0f s", len(readings), time.monotonic() - started)


def window(args: argparse.Namespace) -> tuple[datetime | None, datetime | None]:
    """The times to replay: `--from` and `--to`, or the last `--hours` of the export."""
    if args.start or args.end:
        return (
            parse_time(args.start) if args.start else None,
            parse_time(args.end) if args.end else None,
        )
    if args.hours <= 0:
        return None, None
    end = latest_time(Path(args.data))
    return end - timedelta(hours=args.hours), end


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--data", required=True, help="the csv folder of the export")
    parser.add_argument("--hours", type=float, default=24, help="the last hours of the export, 0 for all")
    parser.add_argument("--from", dest="start", help="the first time to replay, ISO 8601, UTC when no offset")
    parser.add_argument("--to", dest="end", help="the last time to replay, ISO 8601, UTC when no offset")
    parser.add_argument(
        "--clock",
        choices=("original", "now"),
        default="original",
        help="keep the times of the export, or move them so the last one is the start of the replay",
    )
    parser.add_argument("--rate", type=int, default=1000, help="messages a second, 0 for no limit")
    parser.add_argument("--dry-run", action="store_true", help="count the readings and publish nothing")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8883)
    parser.add_argument("--ca", default="ca.pem", help="the certificate authority of the broker")
    parser.add_argument("--client-id", default="soil_replay_hallway_plant")
    parser.add_argument("--env-file", help="a file with the broker account, read by variable name")
    parser.add_argument("--user-var", default="MQTT_USER")
    parser.add_argument("--password-var", default="MQTT_PASSWORD")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
    args = parse_args(argv)
    start, end = window(args)
    readings, skipped = load(Path(args.data), start, end)
    for name, count in sorted(skipped.items()):
        log.warning("%s: %d rows skipped for their unit, time or value", name, count)
    if not readings:
        sys.exit("No readings in the chosen window.")
    offset = timedelta(0)
    if args.clock == "now":
        offset = datetime.now(UTC) - readings[-1].ts
    for topic, (count, first, last) in sorted(summary(readings).items()):
        log.info("%s: %d readings from %s to %s", topic, count, first, last)
    if args.dry_run:
        return
    publish(readings, offset, args)


if __name__ == "__main__":
    main()
