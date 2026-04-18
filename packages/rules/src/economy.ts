import type { Province, ProvinceState, ResourceAmountMap, ResourceCode } from '@rewar/shared';

export function createIncomeRateByNation(
  provinces: Pick<Province, 'id' | 'baseYield'>[],
  provinceStates: Pick<ProvinceState, 'provinceId' | 'ownerNationId'>[],
) {
  const provinceById = new Map(provinces.map((province) => [province.id, province]));
  const incomeRateByNation = new Map<string, Map<ResourceCode, number>>();

  for (const provinceState of provinceStates) {
    const province = provinceById.get(provinceState.provinceId);

    if (!province) {
      continue;
    }

    const nationIncome =
      incomeRateByNation.get(provinceState.ownerNationId) ?? new Map<ResourceCode, number>();

    for (const [resourceCode, amount] of Object.entries(province.baseYield)) {
      if (typeof amount !== 'number' || amount <= 0) {
        continue;
      }

      nationIncome.set(
        resourceCode as ResourceCode,
        (nationIncome.get(resourceCode as ResourceCode) ?? 0) + amount,
      );
    }

    incomeRateByNation.set(provinceState.ownerNationId, nationIncome);
  }

  return incomeRateByNation;
}

export function calculateAccruedResources(ratePerMinute: number, elapsedMs: number) {
  if (ratePerMinute <= 0 || elapsedMs <= 0) {
    return {
      earned: 0,
      consumedMs: 0,
    };
  }

  const earned = Math.floor((ratePerMinute * elapsedMs) / 60_000);

  if (earned <= 0) {
    return {
      earned: 0,
      consumedMs: 0,
    };
  }

  return {
    earned,
    consumedMs: Math.floor((earned * 60_000) / ratePerMinute),
  };
}

export function getYieldResourceCodes(baseYield: ResourceAmountMap) {
  return Object.entries(baseYield)
    .filter((entry): entry is [ResourceCode, number] => typeof entry[1] === 'number' && entry[1] > 0)
    .map(([resourceCode]) => resourceCode);
}
