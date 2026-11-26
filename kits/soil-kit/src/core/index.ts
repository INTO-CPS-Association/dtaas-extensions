import type { DigitalTwinSummary } from '@into-cps-association/dtaas-extensions';

/** Framework-free domain logic: usable outside React and outside DTaaS. */
export const isSoilTwin = (dt: DigitalTwinSummary): boolean =>
  dt.domain === 'soil';

/** The substrate that draws a soil profile. */
export const SOIL_PROFILE = 'soil-profile';

export { channelOf, MEASURED, withChannel } from './channel';
export { formatDepth, parseDepthRef, type DepthRange } from './depth';
export {
  binMeans,
  heatmapGrid,
  type TimedValue,
  type TimeWindow,
} from './heatmap';
export {
  byDepth,
  profilesOf,
  sensorOf,
  SOIL_DEPTH,
  type SoilSensor,
} from './profile';
export {
  eventOf,
  eventsOf,
  siteReadingOf,
  sitesOf,
  SOIL_EVENT,
  SOIL_SITE,
  validFeature,
  type SoilSignal,
} from './site';
export { parseSoilTopic, TOPIC_LEVEL, type SoilTopic } from './topic';
export {
  formatReading,
  formatTime,
  QUANTITIES,
  unitOf,
  type QuantitySpec,
} from './units';
