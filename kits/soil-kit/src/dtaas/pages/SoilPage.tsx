import {
  useHost,
  type Channel,
  type HostServices,
} from '@into-cps-association/dtaas-sdk';
import {
  formatDepth,
  formatReading,
  formatTime,
  MEASURED,
  QUANTITIES,
  unitOf,
  withChannel,
  type SoilSensor,
  type SoilSignal,
} from '../../core';
import ReadingTable, { type ReadingRow } from '../../react/ReadingTable';
import configSchema from '../config';
import useReadings, { type ReadingSource } from './useReadings';
import useSoilTwin, { type SoilTwin } from './useSoilTwin';

type Groups<T> = ReadonlyMap<string, T[]>;

/** The parts of a ready twin the page lists. */
interface Contents {
  readonly profiles: Groups<SoilSensor>;
  readonly events: Groups<SoilSignal>;
  readonly sites: Groups<SoilSignal>;
  readonly channelOf: (signalPath: string) => Channel;
}

/** The host, the twin and the playhead a table row is read at. */
interface Moment {
  readonly host: HostServices;
  readonly contents: Contents;
  readonly t: number;
}

type Signal = Pick<SoilSignal, 'signalPath' | 'quantity' | 'deviceId'>;

const EVENT = 'Event';

const EMPTY: Contents = {
  profiles: new Map(),
  events: new Map(),
  sites: new Map(),
  // The channel of each signal is `measured` until the twin is read.
  channelOf: () => MEASURED,
};

const contentsOf = (twin: SoilTwin): Contents =>
  twin.status === 'ready' ? twin : EMPTY;

/** Every profile with a sensor or an event, by name in order. */
const profileNames = ({ profiles, events }: Contents) =>
  [...new Set([...profiles.keys(), ...events.keys()])].sort((a, b) =>
    a.localeCompare(b),
  );

/** What the page says instead of the tables, when there are none. */
function statusOf(twin: SoilTwin): string | undefined {
  if (twin.status === 'loading') return 'Reading the soil twin.';
  if (twin.status === 'missing') {
    return `No visualisation.json in ${twin.path}.`;
  }
  if (twin.status === 'failed') return twin.message;
  const anchored = twin.profiles.size + twin.events.size + twin.sites.size;
  return anchored === 0 ? `${twin.name} has no soil anchors.` : undefined;
}

/** Every signal of the twin, on the channel its transport declares. */
const sourcesOf = (contents: Contents): ReadingSource[] =>
  [contents.profiles, contents.events, contents.sites]
    .flatMap((groups) => [...groups.values()].flat())
    .map(({ signalPath }) => ({
      signalPath,
      channel: contents.channelOf(signalPath),
    }));

/** A reading at the playhead, with the time of an event and its channel. */
function readingOf(
  { host, contents, t }: Moment,
  signal: Signal,
  event: boolean,
) {
  const channel = contents.channelOf(signal.signalPath);
  const sampled = host.signals.valueAt(signal.signalPath, channel, t);
  if (sampled === undefined) return formatReading(undefined);
  const value = formatReading(sampled.value, unitOf(signal.quantity));
  const reading = event ? `${value} at ${formatTime(sampled.ts)}` : value;
  return withChannel(reading, channel);
}

/** One row of a table: a signal, what it is and its reading. */
const rowOf = (at: Moment, signal: Signal, depth?: string): ReadingRow => ({
  key: signal.signalPath,
  depth,
  quantity: QUANTITIES[signal.quantity]?.label ?? signal.quantity,
  device: signal.deviceId,
  reading: readingOf(at, signal, depth === EVENT),
});

/** The rows of a profile: its sensors downwards, then its events. */
const profileRows = (at: Moment, profile: string): ReadingRow[] => [
  ...(at.contents.profiles.get(profile) ?? []).map((sensor) =>
    rowOf(at, sensor, formatDepth(sensor)),
  ),
  ...(at.contents.events.get(profile) ?? []).map((event) =>
    rowOf(at, event, EVENT),
  ),
];

/** A table for each profile, then one for each site. */
const tablesOf = (at: Moment) => [
  ...profileNames(at.contents).map((profile) => (
    <ReadingTable
      key={`profile ${profile}`}
      title={`Profile ${profile}`}
      rows={profileRows(at, profile)}
    />
  )),
  ...[...at.contents.sites].map(([site, signals]) => (
    <ReadingTable
      key={`site ${site}`}
      title={`Site ${site}`}
      rows={signals.map((signal) => rowOf(at, signal))}
    />
  )),
];

/**
 * Lists the profiles and the sites of the soil twin, with the reading of
 * each signal at the playhead.
 */
function SoilPage() {
  const host = useHost();
  const { Page } = host.ui;
  const { twin } = host.config(configSchema);
  const state = useSoilTwin(host, twin);
  const contents = contentsOf(state);
  useReadings(host, sourcesOf(contents));
  const t = host.signals.playhead.use();
  const status = statusOf(state);
  return (
    <Page title="Soil" description="The profiles and sites of the soil twin">
      {status && <p role="status">{status}</p>}
      {tablesOf({ host, contents, t })}
    </Page>
  );
}

export default SoilPage;
