import { visualisationAssetSchema } from '@into-cps-association/dtaas-extensions/schema';
import { parseSoilTopic, QUANTITIES } from '../../src/core';
import anchorKinds from '../../src/dtaas/anchors';
import example from '../../examples/visualisation.json';
import twin from '../../examples/twin.json';

const kindOf = (kind: string) => anchorKinds.find((spec) => spec.kind === kind);

// The gateway serves only the topics of a twin's mqtt transports, so an
// anchor whose topic no transport lists would be refused with 403.
describe('the soil-kit example visualisation', () => {
  it('satisfies the visualisation.json schema', () => {
    expect(visualisationAssetSchema.safeParse(example).success).toBe(true);
  });

  it('declares every anchored topic in an mqtt transport', () => {
    const served = new Set(
      example.transports
        .filter((transport) => transport.adapter === 'mqtt')
        .flatMap((transport) => transport.topics),
    );
    const anchored = example.anchors.map((anchor) => anchor.signalPath);

    expect(anchored.filter((path) => !served.has(path))).toEqual([]);
  });

  // The data are measured, so neither a transport nor a pane names a
  // channel and the page shows no channel beside a reading.
  it('reads every signal on the measured channel', () => {
    const parts: object[] = [
      ...example.transports,
      ...Object.values(example.substrates).map(
        (substrate) => substrate.options,
      ),
    ];

    expect(parts.filter((part) => 'channel' in part)).toEqual([]);
  });

  it('anchors each signal with a kind, a reference and a quantity of the kit', () => {
    example.anchors.forEach((anchor) => {
      const kind = kindOf(anchor.kind);
      expect(kind?.validateRef?.(anchor.ref)).toBe(true);
      expect(
        QUANTITIES[parseSoilTopic(anchor.signalPath)!.quantity],
      ).toBeDefined();
    });
  });

  it('registers each device of the example with the twin', () => {
    const devices = new Set(
      twin.devices.map((device) => device.topic.split('/')[6]),
    );
    const anchored = new Set(
      example.anchors.map(
        (anchor) => parseSoilTopic(anchor.signalPath)!.deviceId,
      ),
    );
    expect(anchored).toEqual(devices);
    twin.devices.forEach((device) =>
      expect(device.topic.startsWith(`${twin.topic_prefix}/`)).toBe(true),
    );
  });

  it('gives the probe the depth range its anchors name', () => {
    const [sensor] = twin.kits.soil.soil_sensor;
    const depths = example.anchors
      .filter((anchor) => anchor.kind === 'soil-depth')
      .map((anchor) => [
        parseSoilTopic(anchor.signalPath)!.deviceId,
        anchor.ref,
      ]);
    expect(new Set(depths.map(String))).toEqual(
      new Set([`${sensor.device_id},Monstera/0.00-0.10`]),
    );
    expect([sensor.depth_from, sensor.depth_to]).toEqual([0, 0.1]);
  });
});
