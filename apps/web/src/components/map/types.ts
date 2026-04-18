import type { WorldState } from '@rewar/shared';

export type StrategyMapProps = {
  worldState: WorldState;
  selectedProvinceId: string | null;
  selectedUnitId: string | null;
  onProvinceSelect: (provinceId: string) => void;
};
