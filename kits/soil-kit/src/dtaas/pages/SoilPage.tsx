import {
  useHost,
  type Channel,
  type HostServices,
} from '@into-cps-association/dtaas-sdk';
import {
  formatDepth,
  formatReading,
  MEASURED,
  QUANTITIES,
  unitOf,
  withChannel,
  type SoilSensor,
} from '../../core';
import ProfileTable, { type SensorRow } from '../../react/ProfileTable';
import configSchema from '../config';
import useReadings, { type ReadingSource } from './useReadings';
import useSoilTwin, { type SoilTwin } from './useSoilTwin';

const NO_PROFILES = new Map<string, SoilSensor[]>();

const profilesIn = (twin: SoilTwin) =>
  twin.status === 'ready' ? twin.profiles : NO_PROFILES;

/** The channel of each signal of the twin, `measured` until it is read. */
const channelsIn = (twin: SoilTwin) =>
  twin.status === 'ready' ? twin.channelOf : () => MEASURED;

/** What the page says instead of the tables, when there are none. */
function statusOf(twin: SoilTwin): string | undefined {
  if (twin.status === 'loading') return 'Reading the soil twin.';
  if (twin.status === 'missing') {
    return `No visualisation.json in ${twin.path}.`;
  }
  if (twin.status === 'failed') return twin.message;
  return twin.profiles.size === 0
    ? `${twin.name} has no soil-depth anchors.`
    : undefined;
}

/** The reading of a sensor at `t`, with its channel named unless measured. */
function readingOf(
  host: HostServices,
  sensor: SoilSensor,
  channel: Channel,
  t: number,
): string {
  const sampled = host.signals.valueAt(sensor.signalPath, channel, t);
  if (sampled === undefined) return formatReading(undefined);
  const reading = formatReading(sampled.value, unitOf(sensor.quantity));
  return withChannel(reading, channel);
}

/** Every sensor of the profiles, on the channel its transport declares. */
const sourcesOf = (
  profiles: ReadonlyMap<string, SoilSensor[]>,
  channelOf: (path: string) => Channel,
): ReadingSource[] =>
  [...profiles.values()].flat().map(({ signalPath }) => ({
    signalPath,
    channel: channelOf(signalPath),
  }));

/** One row of a profile table: a sensor and its reading at `t`. */
const rowOf =
  (host: HostServices, channelOf: (path: string) => Channel, t: number) =>
  (sensor: SoilSensor): SensorRow => ({
    key: sensor.signalPath,
    depth: formatDepth(sensor),
    quantity: QUANTITIES[sensor.quantity]?.label ?? sensor.quantity,
    device: sensor.deviceId,
    reading: readingOf(host, sensor, channelOf(sensor.signalPath), t),
  });

/** Lists the profiles of the soil twin, with the reading of each sensor at the playhead. */
function SoilPage() {
  const host = useHost();
  const { Page } = host.ui;
  const { twin } = host.config(configSchema);
  const state = useSoilTwin(host, twin);
  const profiles = profilesIn(state);
  const channelOf = channelsIn(state);
  useReadings(host, sourcesOf(profiles, channelOf));
  const t = host.signals.playhead.use();
  const status = statusOf(state);
  return (
    <Page title="Soil" description="The profiles of the soil twin">
      {status && <p role="status">{status}</p>}
      {[...profiles].map(([profile, list]) => (
        <ProfileTable
          key={profile}
          profile={profile}
          rows={list.map(rowOf(host, channelOf, t))}
        />
      ))}
    </Page>
  );
}

export default SoilPage;
