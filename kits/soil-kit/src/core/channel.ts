/**
 * The channel a signal arrives on: measured, simulated, predicted or a set
 * point. A transport of the twin's `visualisation.json` declares it, and
 * `measured` holds when it declares none. The kit reads each signal on its
 * declared channel and names any other than `measured` beside the value, so
 * simulated data is never shown as a measurement.
 */

import type {
  Channel,
  VisualisationAsset,
} from '@into-cps-association/dtaas-extensions';

type Transport = VisualisationAsset['transports'][number];

export const MEASURED: Channel = 'measured';

/** MQTT topic filter matching: `+` is one level and `#` is the rest. */
function matches(filter: string, signalPath: string): boolean {
  const levels = filter.split('/');
  const parts = signalPath.split('/');
  if (levels[levels.length - 1] === '#') {
    levels.pop();
    parts.length = Math.min(parts.length, levels.length);
  }
  return (
    levels.length === parts.length &&
    levels.every((level, i) => level === '+' || level === parts[i])
  );
}

/** Whether `transport` is an MQTT transport that carries `signalPath`. */
const carries = (transport: Transport, signalPath: string): boolean =>
  transport.adapter === 'mqtt' &&
  transport.topics.some((topic) => matches(topic, signalPath));

/** The channel of the first MQTT transport that carries `signalPath`. */
export function channelOf(
  transports: readonly Transport[],
  signalPath: string,
): Channel {
  const transport = transports.find((t) => carries(t, signalPath));
  if (transport?.adapter !== 'mqtt') return MEASURED;
  return transport.channel ?? MEASURED;
}

/** `text` as it is for a measurement, or with its channel named after it. */
export const withChannel = (text: string, channel: Channel): string =>
  channel === MEASURED ? text : `${text} (${channel})`;
