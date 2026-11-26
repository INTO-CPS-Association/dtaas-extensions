import { useEffect, useReducer } from 'react';
import {
  CHANNELS,
  type Channel,
  type HostServices,
} from '@into-cps-association/dtaas-extensions';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A signal and the channel its transport declares. */
export interface ReadingSource {
  readonly signalPath: string;
  readonly channel: Channel;
}

const lineOf = ({ channel, signalPath }: ReadingSource) =>
  `${channel} ${signalPath}`;

/** The paths of `key` that arrive on `channel`. */
const pathsOn = (key: string, channel: Channel) =>
  key
    .split('\n')
    .filter((line) => line.startsWith(`${channel} `))
    .map((line) => line.slice(channel.length + 1));

/** Subscribe to `paths` on `channel` and read the day before the playhead. */
function follow(
  host: HostServices,
  paths: string[],
  channel: Channel,
  bump: () => void,
) {
  const { signals } = host;
  const now = signals.playhead.get();
  signals
    .range(paths, channel, now - DAY_MS, now)
    .then(bump)
    .catch((error: Error) =>
      host.logger.warn('The stored soil readings were not read.', error),
    );
  return signals.subscribe(paths, channel, bump);
}

/**
 * Keep the readings of `sources` coming: subscribe to them, each on its own
 * channel, so the host streams them. Read the day before the playhead, so a
 * sensor shows its last stored reading before a new one arrives. Returns a
 * number that changes with every reading, for the page to read the values
 * again.
 */
export default function useReadings(
  host: HostServices,
  sources: readonly ReadingSource[],
): number {
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  // The list is rebuilt on every render, so the effect keys on its content.
  const key = sources.map(lineOf).join('\n');
  useEffect(() => {
    const stops = CHANNELS.map((channel) => ({
      channel,
      paths: pathsOn(key, channel),
    }))
      .filter(({ paths }) => paths.length > 0)
      .map(({ channel, paths }) => follow(host, paths, channel, bump));
    return () => stops.forEach((stop) => stop());
  }, [host, key]);
  return version;
}
