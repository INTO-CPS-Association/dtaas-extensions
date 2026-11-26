/**
 * The quantities a soil twin reports and how each is shown: those of a
 * profile, the watering of a profile and those of its site. Readings travel
 * in SenML units, as the naming convention requires: `/` for the volumetric
 * water content as a ratio, `Cel`, `S/m`, `Pa`, `%RH`, `l` and `1/s`. SenML
 * has no `kPa`, no `m3/m3`, no `ml` and no unit for photons, so the
 * conversions to per cent, kilopascal and millilitre happen on screen only
 * and a photon count per second travels as `1/s`.
 */

export interface QuantitySpec {
  readonly label: string;
  /** The SenML unit the reading travels in. */
  readonly unit: string;
  /** A colour scheme of the SDK, from low to high. */
  readonly scheme: string;
  /** The range the colour scale spans, in the SenML unit. */
  readonly domain: readonly [number, number];
}

/** The light bands of the site's spectral sensor, in nanometres. */
const LIGHT_BANDS = [415, 445, 480, 515, 555, 590, 630, 680] as const;

/** A photon count per second in one band, from dark to bright. */
const lightOf = (label: string): QuantitySpec => ({
  label,
  unit: '1/s',
  scheme: 'viridis',
  domain: [0, 25_000],
});

const LIGHT: Readonly<Record<string, QuantitySpec>> = Object.fromEntries([
  ...LIGHT_BANDS.map((nm) => [
    `light_level_${nm}nm`,
    lightOf(`Photons at ${nm} nm`),
  ]),
  ['light_level_infrared_910nm', lightOf('Photons at 910 nm, infrared')],
]);

export const QUANTITIES: Readonly<Record<string, QuantitySpec>> = {
  soil_moisture: {
    label: 'Volumetric water content',
    unit: '/',
    scheme: 'viridis',
    domain: [0, 0.5],
  },
  soil_temperature: {
    label: 'Soil temperature',
    unit: 'Cel',
    scheme: 'heat',
    domain: [-5, 30],
  },
  electrical_conductivity: {
    label: 'Electrical conductivity',
    unit: 'S/m',
    scheme: 'viridis',
    domain: [0, 0.3],
  },
  matric_potential: {
    label: 'Matric potential',
    unit: 'Pa',
    scheme: 'viridis',
    // From the permanent wilting point, -1500 kPa, to saturation.
    domain: [-1_500_000, 0],
  },
  watering: {
    label: 'Watering',
    unit: 'l',
    scheme: 'viridis',
    domain: [0, 0.2],
  },
  air_temperature: {
    label: 'Air temperature',
    unit: 'Cel',
    scheme: 'heat',
    domain: [0, 40],
  },
  relative_humidity: {
    label: 'Relative humidity',
    unit: '%RH',
    scheme: 'viridis',
    domain: [0, 100],
  },
  ...LIGHT,
};

const DISPLAY: Readonly<Record<string, (value: number) => string>> = {
  '/': (value) => `${(value * 100).toFixed(1)} %`,
  Cel: (value) => `${value.toFixed(1)} °C`,
  'S/m': (value) => `${value.toFixed(3)} S/m`,
  Pa: (value) => `${(value / 1000).toFixed(1)} kPa`,
  '%RH': (value) => `${value.toFixed(1)} %RH`,
  l: (value) => `${(value * 1000).toFixed(0)} ml`,
  '1/s': (value) => `${value.toFixed(0)} /s`,
};

/** The SenML unit of a quantity, or `undefined` for one the kit does not know. */
export const unitOf = (quantity: string): string | undefined =>
  QUANTITIES[quantity]?.unit;

/** A reading in its display unit, such as `23.4 %` for a ratio of 0.234. */
export function formatReading(value: unknown, unit?: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'no reading';
  const display = unit === undefined ? undefined : DISPLAY[unit];
  return display ? display(value) : `${value} ${unit ?? ''}`.trim();
}

/** `2026-10-15 13:45 UTC`, the minute of a time in milliseconds. */
export const formatTime = (ts: number): string =>
  `${new Date(ts).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
