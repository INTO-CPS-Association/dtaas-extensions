import type { AnchorKindSpec } from '@into-cps-association/dtaas-sdk';
import {
  parseDepthRef,
  SOIL_DEPTH,
  SOIL_EVENT,
  SOIL_PROFILE,
  SOIL_SITE,
  validFeature,
} from '../core';

/** Only the `soil-profile` substrate draws soil anchors, and only depths. */
const resolve: AnchorKindSpec['resolve'] = (anchor, adapter) =>
  adapter.id === SOIL_PROFILE ? adapter.resolve(anchor) : null;

/**
 * `soil-depth` anchors name a profile and a depth range in metres, such as
 * `P03/0.20-0.40`. The `soil-profile` substrate draws each as a row.
 * `soil-event` anchors name a profile and `soil-site` anchors a site. The
 * page lists them and the substrate leaves them out.
 */
const anchorKinds: AnchorKindSpec[] = [
  {
    kind: SOIL_DEPTH,
    label: 'Soil depth',
    substrates: [SOIL_PROFILE],
    validateRef: (ref) => parseDepthRef(ref) !== undefined,
    resolve,
  },
  {
    kind: SOIL_EVENT,
    label: 'Profile event',
    substrates: [SOIL_PROFILE],
    validateRef: validFeature,
    resolve,
  },
  {
    kind: SOIL_SITE,
    label: 'Site reading',
    substrates: [SOIL_PROFILE],
    validateRef: validFeature,
    resolve,
  },
];

export default anchorKinds;
