import type { VisualisationAsset } from '@into-cps-association/dtaas-sdk';
import { channelOf, withChannel } from '../../src/core';

type Transports = VisualisationAsset['transports'];

const PATH = 'AUSoil/Site1/field/07/P03/S/dev-1/soil_moisture';

const mqtt = (topics: string[], channel?: 'simulated' | 'predicted') =>
  [{ adapter: 'mqtt', topics, channel }] as Transports;

describe('the channel of a soil signal', () => {
  it('is the channel of the transport that lists its topic', () => {
    expect(channelOf(mqtt([PATH], 'simulated'), PATH)).toBe('simulated');
  });

  it('is measured when the transport names no channel', () => {
    expect(channelOf(mqtt([PATH]), PATH)).toBe('measured');
  });

  it('is measured when no transport carries the signal', () => {
    expect(channelOf(mqtt(['AUSoil/other'], 'simulated'), PATH)).toBe(
      'measured',
    );
    expect(channelOf([], PATH)).toBe('measured');
  });

  it.each([
    'AUSoil/Site1/field/07/P03/S/+/soil_moisture',
    'AUSoil/Site1/#',
    `${PATH}/#`,
  ])('follows the MQTT wildcards of %p', (filter) => {
    expect(channelOf(mqtt([filter], 'predicted'), PATH)).toBe('predicted');
  });

  it.each(['AUSoil/+', 'AUSoil/Site1/field/07/P03/S/+', `${PATH}/+`])(
    'does not match the shorter or longer filter %p',
    (filter) => {
      expect(channelOf(mqtt([filter], 'predicted'), PATH)).toBe('measured');
    },
  );

  it('ignores a transport that is not MQTT', () => {
    const file = [
      { adapter: 'file', url: 'soil.csv', channel: 'simulated' },
    ] as Transports;
    expect(channelOf(file, PATH)).toBe('measured');
  });

  it('names a channel after a text unless it is measured', () => {
    expect(withChannel('23.4 %', 'measured')).toBe('23.4 %');
    expect(withChannel('23.4 %', 'simulated')).toBe('23.4 % (simulated)');
  });
});
