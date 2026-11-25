import { lazy } from 'react';
import ForestIcon from '@mui/icons-material/Forest';
import {
  defineExtension,
  type LazySubstrateAdapterSpec,
} from '@into-cps-association/dtaas-extensions';
import { isSoilTwin, SOIL_DEPTH, SOIL_PROFILE } from '../core';
import anchorKinds from './anchors';
import configSchema from './config';
import presets from './presets';

/** Loaded only when a visualisation draws a soil profile. */
export const SOIL_PROFILE_SUBSTRATE: LazySubstrateAdapterSpec = {
  id: SOIL_PROFILE,
  supports: [SOIL_DEPTH],
  load: () => import('./substrate/soilProfileSubstrate'),
};

/** The only object the host imports: `import { extension } from '<kit>/dtaas'`. */
export const extension = defineExtension({
  id: 'soil',
  name: 'Soil',
  version: '0.1.0',
  sdk: 0,
  apiRange: '^0.2',
  routes: [
    {
      path: '',
      element: lazy(() => import('./pages/SoilPage')),
    },
  ],
  navigation: [{ label: 'Soil', path: '/soil', icon: ForestIcon, order: 110 }],
  config: { schema: configSchema },
  setup: (host) => {
    host.config(configSchema);
    host.logger.info('soil-kit ready');
  },
  visualisation: {
    detect: isSoilTwin,
    anchorKinds,
    presets,
    substrates: [SOIL_PROFILE_SUBSTRATE],
  },
});

export default extension;
