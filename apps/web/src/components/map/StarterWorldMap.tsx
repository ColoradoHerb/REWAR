import { isAdjacentProvinceMove } from '@rewar/rules';
import type { WorldState } from '@rewar/shared';
import type { StrategyMapProps } from './types';

function getProvinceFrame(centroidX: number, centroidY: number) {
  return {
    x: centroidX - 70,
    y: centroidY - 55,
    width: 140,
    height: 110,
  };
}

export function StarterWorldMap({
  worldState,
  selectedProvinceId,
  selectedUnitId,
  onProvinceSelect,
}: StrategyMapProps) {
  const activeUnits = worldState.units.filter((unit) => unit.status !== 'destroyed');
  const nationById = new Map(worldState.nations.map((nation) => [nation.id, nation]));
  const provinceStateById = new Map(
    worldState.provinceStates.map((provinceState) => [provinceState.provinceId, provinceState]),
  );
  const unitsByProvinceId = new Map<string, WorldState['units']>();
  const selectedUnit = activeUnits.find((unit) => unit.id === selectedUnitId) ?? null;
  const activeMovementOrderByUnitId = new Map(
    worldState.movementOrders
      .filter((movementOrder) => movementOrder.status === 'active')
      .map((movementOrder) => [movementOrder.unitId, movementOrder]),
  );

  for (const unit of activeUnits) {
    const units = unitsByProvinceId.get(unit.provinceId) ?? [];
    units.push(unit);
    unitsByProvinceId.set(unit.provinceId, units);
  }

  return (
    <section>
      <h2 style={{ marginTop: 0 }}>Starter World Map</h2>
      <p style={{ color: '#94a3b8' }}>
        Click a province with one of your units to select it, then click an adjacent province to
        move.
      </p>

      <svg
        viewBox="0 0 640 420"
        role="img"
        aria-label="REWAR starter world"
        style={{
          width: '100%',
          maxWidth: 720,
          border: '1px solid #334155',
          borderRadius: 12,
          background: '#0f172a',
        }}
      >
        <rect width="640" height="420" fill="#0f172a" />

        {worldState.provinces.map((province) => {
          const provinceState = provinceStateById.get(province.id);
          const ownerNation = provinceState ? nationById.get(provinceState.ownerNationId) : null;
          const provinceUnits = unitsByProvinceId.get(province.id) ?? [];
          const { x, y, width, height } = getProvinceFrame(province.centroidX, province.centroidY);
          const isSelectedProvince = province.id === selectedProvinceId;
          const isAdjacentTarget =
            selectedUnit &&
            selectedUnit.status !== 'moving' &&
            isAdjacentProvinceMove(selectedUnit.provinceId, province.id, worldState.edges);

          return (
            <g key={province.id}>
              <rect
                id={province.shapeKey}
                x={x}
                y={y}
                width={width}
                height={height}
                rx={8}
                ry={8}
                fill={ownerNation?.colorHex ?? '#1e293b'}
                fillOpacity={ownerNation ? 0.86 : 1}
                stroke={isSelectedProvince ? '#f8fafc' : isAdjacentTarget ? '#38bdf8' : '#94a3b8'}
                strokeWidth={isSelectedProvince ? 4 : isAdjacentTarget ? 3 : 2}
                style={{ cursor: 'pointer' }}
                onClick={() => onProvinceSelect(province.id)}
              />
              <title>{province.name}</title>
              <text
                x={province.centroidX}
                y={province.centroidY - 8}
                textAnchor="middle"
                fill="#f8fafc"
                fontSize="14"
                fontWeight="700"
                pointerEvents="none"
              >
                {province.name}
              </text>
              <text
                x={province.centroidX}
                y={province.centroidY + 12}
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize="11"
                pointerEvents="none"
              >
                {ownerNation?.name ?? 'Unclaimed'}
              </text>

              {provinceUnits.length > 1 ? (
                <g pointerEvents="none">
                  <circle
                    cx={x + width - 16}
                    cy={y + 16}
                    r={12}
                    fill="#020617"
                    stroke="#e2e8f0"
                    strokeWidth={2}
                  />
                  <text
                    x={x + width - 16}
                    y={y + 20}
                    textAnchor="middle"
                    fill="#e2e8f0"
                    fontSize="11"
                    fontWeight="700"
                  >
                    {provinceUnits.length}
                  </text>
                </g>
              ) : null}

              {provinceUnits.map((unit, index) => {
                const unitNation = nationById.get(unit.nationId);
                const markerOffset = (index - (provinceUnits.length - 1) / 2) * 18;
                const isSelectedUnit = unit.id === selectedUnitId;
                const activeOrder = activeMovementOrderByUnitId.get(unit.id);

                return (
                  <g key={unit.id} pointerEvents="none">
                    <circle
                      cx={province.centroidX + markerOffset}
                      cy={province.centroidY + 34}
                      r={isSelectedUnit ? 12 : 10}
                      fill={unitNation?.colorHex ?? '#e2e8f0'}
                      stroke={isSelectedUnit ? '#f8fafc' : '#020617'}
                      strokeWidth={isSelectedUnit ? 3 : 2}
                    />
                    <text
                      x={province.centroidX + markerOffset}
                      y={province.centroidY + 38}
                      textAnchor="middle"
                      fill="#020617"
                      fontSize="10"
                      fontWeight="700"
                    >
                      {unit.status === 'moving' ? 'M' : unit.unitTypeCode.slice(0, 1).toUpperCase()}
                    </text>
                    {activeOrder ? (
                      <text
                        x={province.centroidX + markerOffset}
                        y={province.centroidY + 56}
                        textAnchor="middle"
                        fill="#7dd3fc"
                        fontSize="10"
                        fontWeight="700"
                      >
                        To {activeOrder.toProvinceId}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        })}

        <line
          x1="320"
          y1="10"
          x2="320"
          y2="410"
          stroke="#38bdf8"
          strokeDasharray="10 8"
          strokeWidth="3"
          pointerEvents="none"
        />
      </svg>
    </section>
  );
}
