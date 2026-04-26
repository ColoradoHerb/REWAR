import type { WorldState } from '@rewar/shared';

export type StrategyMapProps = {
  worldState: WorldState;
  selectedProvinceId: string | null;
  selectedUnitIds: string[];
  onProvinceSelect: (provinceId: string) => void;
  onProvinceDoubleClick: (provinceId: string) => void;
};
