import type { DigitalTwinSummary } from '@into-cps-association/dtaas-extensions';

const isBimTwin = (dt: DigitalTwinSummary): boolean =>
  dt.domain === 'bim' ||
  dt.files.some((file) => file.toLowerCase().endsWith('.ifc'));

export default isBimTwin;
