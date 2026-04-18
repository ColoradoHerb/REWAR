type UnitPresence = {
  provinceId: string;
  nationId: string;
  status: 'idle' | 'moving' | 'destroyed';
};

export function destinationHasEnemyUnits(
  units: UnitPresence[],
  destinationProvinceId: string,
  movingNationId: string,
) {
  return units.some(
    (unit) =>
      unit.provinceId === destinationProvinceId &&
      unit.nationId !== movingNationId &&
      unit.status !== 'destroyed',
  );
}
