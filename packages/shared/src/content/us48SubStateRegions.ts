import type { StateRegion } from '../types/game';
import { US48_SUB_WORLD_ID } from '../constants';
import { US48_STATE_LAYOUT } from './us48StateLayout';

const PILOT_STATE_CODES = ['co', 'pa', 'tx'] as const;

export const US48_SUB_V1_STATE_REGIONS: StateRegion[] = PILOT_STATE_CODES.flatMap((stateCode) => {
  const state = US48_STATE_LAYOUT.find((entry) => entry.code === stateCode);

  if (!state) {
    return [];
  }

  const stateId = `us-${state.code}`;

  const provinceIdsByState: Record<(typeof PILOT_STATE_CODES)[number], string[]> = {
    co: ['us-co-west-slope', 'us-co-front-range', 'us-co-eastern-plains'],
    pa: ['us-pa-west', 'us-pa-central-ridge', 'us-pa-east'],
    tx: ['us-tx-panhandle-north', 'us-tx-west', 'us-tx-central-hills', 'us-tx-east'],
  };

  return [
    {
      id: stateId,
      mapId: US48_SUB_WORLD_ID,
      name: state.name,
      labelShort: state.labelShort,
      shapeKey: stateId,
      centroidX: state.centroidX,
      centroidY: state.centroidY,
      labelX: state.labelX,
      labelY: state.labelY,
      provinceIds: provinceIdsByState[stateCode],
    },
  ];
});
