import { API_MAJOR } from '@into-cps-association/dtaas-extensions';
import { fakeHostServices } from '@into-cps-association/dtaas-extensions/testing';
import { BIM_EXTENSION_ID } from 'src/core';

describe('package wiring', () => {
  it('resolves the packed SDK, including connection status', () => {
    expect(API_MAJOR).toBe(0);
    expect(fakeHostServices().signals.connection.get()).toBe('live');
    expect(BIM_EXTENSION_ID).toBe('bim');
  });
});
