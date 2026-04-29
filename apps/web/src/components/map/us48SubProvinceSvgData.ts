export type SubProvinceShapeDefinition = {
  parentStateId: string;
  pathData: string;
};

export const US48_SUB_V1_PILOT_PARENT_STATE_IDS = new Set(['us-co', 'us-pa', 'us-tx']);

export const US48_SUB_PROVINCE_PATHS: Record<string, SubProvinceShapeDefinition> = {
  'us-co-west-slope': {
    parentStateId: 'us-co',
    pathData: 'M 250 220 L 306 220 L 306 326 L 250 326 Z',
  },
  'us-co-front-range': {
    parentStateId: 'us-co',
    pathData: 'M 306 220 L 338 220 L 338 326 L 306 326 Z',
  },
  'us-co-eastern-plains': {
    parentStateId: 'us-co',
    pathData: 'M 338 220 L 382 220 L 382 326 L 338 326 Z',
  },

  'us-pa-west': {
    parentStateId: 'us-pa',
    pathData: 'M 738 186 L 776 186 L 776 238 L 738 238 Z',
  },
  'us-pa-central-ridge': {
    parentStateId: 'us-pa',
    pathData: 'M 776 186 L 808 186 L 808 238 L 776 238 Z',
  },
  'us-pa-east': {
    parentStateId: 'us-pa',
    pathData: 'M 808 186 L 848 186 L 848 238 L 808 238 Z',
  },

  'us-tx-panhandle-north': {
    parentStateId: 'us-tx',
    pathData: 'M 280 426 L 610 426 L 610 476 L 280 476 Z',
  },
  'us-tx-west': {
    parentStateId: 'us-tx',
    pathData: 'M 280 476 L 398 476 L 398 653 L 280 653 Z',
  },
  'us-tx-central-hills': {
    parentStateId: 'us-tx',
    pathData: 'M 398 476 L 482 476 L 482 653 L 398 653 Z',
  },
  'us-tx-east': {
    parentStateId: 'us-tx',
    pathData: 'M 482 476 L 610 476 L 610 653 L 482 653 Z',
  },
};
