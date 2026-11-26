/**
 * What a soil twin reports beside the depths of its profiles: the events of
 * a profile, such as a watering, and the readings of its site, such as the
 * air temperature or the light. Each comes from an anchor of the twin's
 * `visualisation.json`. A `soil-event` anchor names a profile, the `area`
 * level of its topic, and a `soil-site` anchor names a site, the `building`
 * level. In SOSA terms the profile or the site is the feature of interest.
 */

import type { Anchor } from '@into-cps-association/dtaas-extensions';
import { parseSoilTopic, TOPIC_LEVEL, type SoilTopic } from './topic';

export const SOIL_EVENT = 'soil-event';
export const SOIL_SITE = 'soil-site';

export interface SoilSignal {
  /** The profile of an event or the site of a reading. */
  readonly feature: string;
  readonly signalPath: string;
  readonly deviceId: string;
  readonly quantity: string;
}

/** A profile or site name is one topic level. */
export const validFeature = (ref: string): boolean => TOPIC_LEVEL.test(ref);

/**
 * The signal of an anchor of `kind` whose reference is the level that
 * `levelOf` reads from its topic, or `undefined` when it is not one.
 */
function signalOf(
  anchor: Anchor,
  kind: string,
  levelOf: (topic: SoilTopic) => string,
): SoilSignal | undefined {
  if (anchor.kind !== kind || !validFeature(anchor.ref)) return undefined;
  const topic = parseSoilTopic(anchor.signalPath);
  if (!topic || levelOf(topic) !== anchor.ref) return undefined;
  return {
    feature: anchor.ref,
    signalPath: anchor.signalPath,
    deviceId: topic.deviceId,
    quantity: topic.quantity,
  };
}

/** The event of a `soil-event` anchor whose profile matches its topic. */
export const eventOf = (anchor: Anchor): SoilSignal | undefined =>
  signalOf(anchor, SOIL_EVENT, (topic) => topic.profile);

/** The reading of a `soil-site` anchor whose site matches its topic. */
export const siteReadingOf = (anchor: Anchor): SoilSignal | undefined =>
  signalOf(anchor, SOIL_SITE, (topic) => topic.site);

/** The signals of each feature, by name in order, each by quantity. */
function byFeature(
  signals: readonly (SoilSignal | undefined)[],
): Map<string, SoilSignal[]> {
  const kept = signals.filter(
    (signal): signal is SoilSignal => signal !== undefined,
  );
  const features = new Map<string, SoilSignal[]>();
  [...new Set(kept.map((signal) => signal.feature))]
    .sort((a, b) => a.localeCompare(b))
    .forEach((feature) =>
      features.set(
        feature,
        kept
          .filter((signal) => signal.feature === feature)
          .sort((a, b) => a.quantity.localeCompare(b.quantity)),
      ),
    );
  return features;
}

/** The events of every profile that has any. */
export const eventsOf = (anchors: readonly Anchor[]) =>
  byFeature(anchors.map(eventOf));

/** The readings of every site that has any. */
export const sitesOf = (anchors: readonly Anchor[]) =>
  byFeature(anchors.map(siteReadingOf));
