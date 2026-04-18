import type { Province, ResourceAmountMap, ResourceCode, UnitType, UnitTypeCode } from '@rewar/shared';

export function canProvinceBuildUnitType(
  province: Pick<Province, 'isProductionCenter' | 'buildableUnitTypes'>,
  unitTypeCode: UnitTypeCode,
) {
  return province.isProductionCenter && province.buildableUnitTypes.includes(unitTypeCode);
}

export function createProductionTiming(startedAt: Date, buildTimeSeconds: number) {
  return {
    queuedAt: new Date(startedAt),
    startedAt: new Date(startedAt),
    completesAt: new Date(startedAt.getTime() + buildTimeSeconds * 1_000),
  };
}

export function hasSufficientResources(
  balancesByResourceCode: Map<ResourceCode, number>,
  cost: ResourceAmountMap,
) {
  return Object.entries(cost).every(([resourceCode, amount]) => {
    if (typeof amount !== 'number') {
      return true;
    }

    return (balancesByResourceCode.get(resourceCode as ResourceCode) ?? 0) >= amount;
  });
}

export function getBuildCostSnapshot(unitType: Pick<UnitType, 'cost'>) {
  return { ...unitType.cost };
}
