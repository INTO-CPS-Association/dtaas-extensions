import type { EncodingPreset } from '@into-cps-association/dtaas-extensions';

const presets: EncodingPreset[] = [
  {
    id: 'hello.warmth',
    label: 'Room warmth',
    description: 'Colours each room by its measured temperature.',
    substrate: 'image',
    encodings: [
      {
        target: 'hello/*/temperature',
        encoding: { type: 'colorScale', domain: [16, 26], scheme: 'thermal' },
      },
    ],
  },
];

export default presets;
