import type { AnchorKindSpec } from '@into-cps-association/dtaas-extensions';
import { parseDepthRef, SOIL_DEPTH, SOIL_PROFILE } from '../core';

/**
 * `soil-depth` anchors name a profile and a depth range in metres, such as
 * `P03/0.20-0.40`. The `soil-profile` substrate draws each as a row.
 */
const anchorKinds: AnchorKindSpec[] = [
  {
    kind: SOIL_DEPTH,
    label: 'Soil depth',
    substrates: [SOIL_PROFILE],
    validateRef: (ref) => parseDepthRef(ref) !== undefined,
    resolve: (anchor, adapter) =>
      adapter.id === SOIL_PROFILE ? adapter.resolve(anchor) : null,
  },
];

export default anchorKinds;
