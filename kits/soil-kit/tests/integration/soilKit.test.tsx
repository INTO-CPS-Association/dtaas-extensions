import { act, screen } from '@testing-library/react';
import {
  checkConformance,
  fakeHostServices,
  renderWithHost,
} from '@into-cps-association/dtaas-sdk/testing';
import {
  validateExtension,
  type VisualisationAsset,
} from '@into-cps-association/dtaas-sdk';
import { parseVisualisationAsset } from '@into-cps-association/dtaas-sdk/schema';
import extension from '../../src/dtaas';
import SoilPage from '../../src/dtaas/pages/SoilPage';
import { twinSummary } from '../../src/dtaas/pages/useSoilTwin';
import example from '../../examples/visualisation.json';

const env = { REACT_APP_EXT_SOIL_TWIN: 'hallway_plant' };
const asset = parseVisualisationAsset(example);

function exampleAsset(): VisualisationAsset {
  if (!asset.success) throw new Error('The example is not a valid asset');
  return asset.data;
}
const PREFIX = 'AUSoil/Greenhouse/hallway/01';
const DEVICE = 'S-AUSoil-Greenhouse-hallway-01-Monstera-VWC-0001';
const MOISTURE = `${PREFIX}/Monstera/S/${DEVICE}/soil_moisture`;
const WATERING = `${PREFIX}/Monstera/S/S-AUSoil-Greenhouse-hallway-01-Monstera-WAT-0001/watering`;
const AIR = `${PREFIX}/Site/S/S-AUSoil-Greenhouse-hallway-01-Site-TRH-0001/air_temperature`;

/** A sample of the example twin on the measured channel. */
const measured = (signalPath: string, ts: number, value: number) => ({
  twinId: 'soil',
  signalPath,
  channel: 'measured' as const,
  ts,
  value,
});

/** A host whose library holds the example visualisation of the soil twin. */
async function hostWithTwin() {
  const host = fakeHostServices({ extensionId: 'soil', env });
  await host.viz.save(twinSummary(host, 'hallway_plant'), exampleAsset());
  return host;
}

describe('soil-kit', () => {
  it('has a valid example visualisation', () => {
    expect(asset.success).toBe(true);
  });

  it('passes static validation', () => {
    expect(validateExtension(extension)).toEqual({ valid: true, errors: [] });
  });

  it('passes the conformance harness', async () => {
    const host = fakeHostServices({ extensionId: 'soil', env });
    await expect(checkConformance(extension, { host })).resolves.toEqual({
      passed: true,
      errors: [],
    });
    expect(host.recorded.logs).toContainEqual({
      level: 'info',
      args: ['soil-kit ready'],
    });
  });

  it('fails conformance without the twin it shows', async () => {
    const report = await checkConformance(extension);
    expect(report.errors[0]).toMatch(
      /^setup\(\) failed: Invalid configuration for extension "soil"/,
    );
  });

  it('claims twins of the soil domain only', async () => {
    const detect = extension.visualisation?.detect;
    const twin = (domain?: string) => ({
      name: 't',
      path: 'p',
      files: [],
      domain,
    });
    expect(await detect?.(twin('soil'))).toBe(true);
    expect(await detect?.(twin('bim'))).toBe(false);
    expect(await detect?.(twin())).toBe(false);
  });

  it('checks the reference of each of its anchor kinds', () => {
    const kinds = extension.visualisation?.anchorKinds ?? [];
    expect(kinds.map((kind) => kind.kind)).toEqual([
      'soil-depth',
      'soil-event',
      'soil-site',
    ]);
    const [, event, site] = kinds;
    expect(event.validateRef?.('Monstera')).toBe(true);
    expect(site.validateRef?.('Greenhouse')).toBe(true);
    expect(site.validateRef?.('Green house')).toBe(false);
    expect(event.validateRef?.('')).toBe(false);
  });

  it('resolves soil-depth anchors on its own substrate only', () => {
    const [kind] = extension.visualisation?.anchorKinds ?? [];
    const anchor = {
      signalPath: MOISTURE,
      kind: 'soil-depth',
      ref: 'Monstera/0.00-0.10',
    };
    type Adapter = Parameters<typeof kind.resolve>[1];
    const resolve = jest.fn(() => null);
    const profile = { id: 'soil-profile', resolve } as unknown as Adapter;
    expect(kind.validateRef?.('P03/0.20-0.40')).toBe(true);
    expect(kind.validateRef?.('P03/0.40-0.20')).toBe(false);
    kind.resolve(anchor, profile);
    expect(resolve).toHaveBeenCalledWith(anchor);
    const image = { id: 'image' } as Adapter;
    expect(kind.resolve(anchor, image)).toBeNull();
  });

  it('offers colour presets for its substrate', () => {
    const presets = extension.visualisation?.presets ?? [];
    expect(presets.map((p) => [p.id, p.substrate])).toEqual([
      ['soil.moisture', 'soil-profile'],
      ['soil.temperature', 'soil-profile'],
    ]);
  });
});

describe('the soil page', () => {
  it('lists the profile, its event and the site with the readings at the playhead', async () => {
    const host = await hostWithTwin();
    host.signals.emit(
      measured(MOISTURE, 1000, 0.312),
      measured(MOISTURE, 2000, 0.25),
      measured(WATERING, Date.UTC(2026, 9, 15, 12, 55), 0.05),
      measured(AIR, 1000, 24.59),
    );
    host.signals.playhead.set(Date.UTC(2026, 9, 15, 13));
    renderWithHost(<SoilPage />, { host });
    expect(
      await screen.findByRole('heading', { name: 'Profile Monstera' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Site Greenhouse' }),
    ).toBeInTheDocument();
    // A header and four rows for the profile, a header and eleven for the site.
    expect(screen.getAllByRole('row')).toHaveLength(17);
    expect(screen.getByText('25.0 %')).toBeInTheDocument();
    expect(
      screen.getByText('50 ml at 2026-10-15 12:55 UTC'),
    ).toBeInTheDocument();
    expect(screen.getByText('24.6 °C')).toBeInTheDocument();
    expect(screen.getAllByText('no reading')).toHaveLength(12);
    act(() => host.signals.playhead.set(1500));
    expect(screen.getByText('31.2 %')).toBeInTheDocument();
  });

  it('shows a reading that arrives while it is open', async () => {
    const host = await hostWithTwin();
    host.signals.playhead.follow(true);
    renderWithHost(<SoilPage />, { host });
    await screen.findByRole('heading', { name: 'Profile Monstera' });
    act(() => host.signals.emit(measured(MOISTURE, Date.now() - 1000, 0.2)));
    expect(screen.getByText('20.0 %')).toBeInTheDocument();
  });

  it('names a channel other than measured beside the reading', async () => {
    const host = fakeHostServices({ extensionId: 'soil', env });
    const transports = exampleAsset().transports.map((transport) => ({
      ...transport,
      channel: 'simulated' as const,
    }));
    const simulated: VisualisationAsset = { ...exampleAsset(), transports };
    await host.viz.save(twinSummary(host, 'hallway_plant'), simulated);
    host.signals.emit(measured(MOISTURE, 1000, 0.9), {
      ...measured(MOISTURE, 1000, 0.312),
      channel: 'simulated',
    });
    host.signals.playhead.set(1500);
    renderWithHost(<SoilPage />, { host });
    await screen.findByRole('heading', { name: 'Profile Monstera' });
    expect(screen.getByText('31.2 % (simulated)')).toBeInTheDocument();
    expect(screen.queryByText('90.0 %')).not.toBeInTheDocument();
  });

  it('says so when the twin has no visualisation', async () => {
    const host = fakeHostServices({ extensionId: 'soil', env });
    renderWithHost(<SoilPage />, { host });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'No visualisation.json in digital_twins/hallway_plant.',
    );
  });

  it('says so when the twin has no soil anchors', async () => {
    const host = fakeHostServices({ extensionId: 'soil', env });
    const empty: VisualisationAsset = { ...exampleAsset(), anchors: [] };
    await host.viz.save(twinSummary(host, 'hallway_plant'), empty);
    renderWithHost(<SoilPage />, { host });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'has no soil anchors.',
    );
  });

  it('reports a twin it cannot read', async () => {
    const host = fakeHostServices({ extensionId: 'soil', env });
    jest.spyOn(host.viz, 'load').mockRejectedValue(new Error('Forbidden'));
    renderWithHost(<SoilPage />, { host });
    expect(await screen.findByRole('status')).toHaveTextContent('Forbidden');
  });
});
