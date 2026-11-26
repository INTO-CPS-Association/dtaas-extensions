import { formatReading, formatTime, QUANTITIES, unitOf } from '../../src/core';

describe('soil units', () => {
  it('names the SenML unit of each quantity', () => {
    expect(unitOf('soil_moisture')).toBe('/');
    expect(unitOf('soil_temperature')).toBe('Cel');
    expect(unitOf('electrical_conductivity')).toBe('S/m');
    expect(unitOf('matric_potential')).toBe('Pa');
    expect(unitOf('watering')).toBe('l');
    expect(unitOf('air_temperature')).toBe('Cel');
    expect(unitOf('relative_humidity')).toBe('%RH');
    expect(unitOf('light_level_445nm')).toBe('1/s');
    expect(unitOf('light_level_infrared_910nm')).toBe('1/s');
    expect(unitOf('wind_speed')).toBeUndefined();
  });

  it.each([
    [0.234, '/', '23.4 %'],
    [12.345, 'Cel', '12.3 °C'],
    [0.0425, 'S/m', '0.043 S/m'],
    [-33_000, 'Pa', '-33.0 kPa'],
    [44.36, '%RH', '44.4 %RH'],
    [0.05, 'l', '50 ml'],
    [7229.86, '1/s', '7230 /s'],
    [3, 'm/s', '3 m/s'],
    [3, undefined, '3'],
  ])('shows %p in %p as %p', (value, unit, shown) => {
    expect(formatReading(value, unit)).toBe(shown);
  });

  it.each([undefined, 'wet', Number.NaN, Number.POSITIVE_INFINITY])(
    'says there is no reading for %p',
    (value) => {
      expect(formatReading(value, '/')).toBe('no reading');
    },
  );

  it('writes the minute of a time in UTC', () => {
    expect(formatTime(Date.UTC(2026, 9, 15, 13, 45, 56, 899))).toBe(
      '2026-10-15 13:45 UTC',
    );
  });

  it('labels each light band of the site', () => {
    expect(QUANTITIES.light_level_415nm.label).toBe('Photons at 415 nm');
    expect(QUANTITIES.light_level_infrared_910nm.label).toBe(
      'Photons at 910 nm, infrared',
    );
  });

  it('spans each colour scale from low to high', () => {
    Object.values(QUANTITIES).forEach(({ domain: [min, max] }) =>
      expect(max).toBeGreaterThan(min),
    );
  });
});
