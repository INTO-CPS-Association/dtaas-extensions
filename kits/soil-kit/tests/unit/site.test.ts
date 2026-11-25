import type { Anchor } from '@into-cps-association/dtaas-sdk';
import {
  eventOf,
  eventsOf,
  siteReadingOf,
  sitesOf,
  validFeature,
} from '../../src/core';

const path = (area: string, device: string, quantity: string) =>
  `AUSoil/Greenhouse/hallway/01/${area}/S/${device}/${quantity}`;

const anchor = (signalPath: string, kind: string, ref: string): Anchor => ({
  signalPath,
  kind,
  ref,
});

const WATERING = path('Monstera', 'W1', 'watering');
const AIR = path('Site', 'T1', 'air_temperature');

describe('the events of a profile', () => {
  it('join a soil-event anchor to the profile of its topic', () => {
    expect(eventOf(anchor(WATERING, 'soil-event', 'Monstera'))).toEqual({
      feature: 'Monstera',
      signalPath: WATERING,
      deviceId: 'W1',
      quantity: 'watering',
    });
  });

  it.each([
    ['another kind', anchor(WATERING, 'soil-site', 'Monstera')],
    ['another profile', anchor(WATERING, 'soil-event', 'Fern')],
    ['an invalid reference', anchor(WATERING, 'soil-event', 'Mon stera')],
    ['a path that is no soil topic', anchor('room/1/t', 'soil-event', 'x')],
  ])('leave out an anchor with %s', (_, wrong) => {
    expect(eventOf(wrong)).toBeUndefined();
  });

  it('are grouped by profile', () => {
    const events = eventsOf([
      anchor(path('Fern', 'W2', 'watering'), 'soil-event', 'Fern'),
      anchor(WATERING, 'soil-event', 'Monstera'),
      anchor(AIR, 'soil-site', 'Greenhouse'),
    ]);
    expect([...events.keys()]).toEqual(['Fern', 'Monstera']);
  });
});

describe('the readings of a site', () => {
  it('join a soil-site anchor to the site of its topic', () => {
    expect(siteReadingOf(anchor(AIR, 'soil-site', 'Greenhouse'))).toEqual({
      feature: 'Greenhouse',
      signalPath: AIR,
      deviceId: 'T1',
      quantity: 'air_temperature',
    });
    expect(siteReadingOf(anchor(AIR, 'soil-site', 'Site'))).toBeUndefined();
  });

  it('are grouped by site, each by quantity', () => {
    const sites = sitesOf([
      anchor(AIR, 'soil-site', 'Greenhouse'),
      anchor(
        path('Site', 'T1', 'relative_humidity'),
        'soil-site',
        'Greenhouse',
      ),
      anchor(
        path('Site', 'L1', 'light_level_415nm'),
        'soil-site',
        'Greenhouse',
      ),
    ]);
    expect(sites.get('Greenhouse')?.map((s) => s.quantity)).toEqual([
      'air_temperature',
      'light_level_415nm',
      'relative_humidity',
    ]);
  });

  it('name a feature with one topic level', () => {
    expect(validFeature('Greenhouse')).toBe(true);
    expect(validFeature('Green/house')).toBe(false);
  });
});
