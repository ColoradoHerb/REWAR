import { isAdjacentProvinceMove } from '@rewar/rules';
import type { WorldState } from '@rewar/shared';
import { US48_BORDER_PATHS, US48_STATE_PATHS, US48_SVG_VIEWBOX } from './us48SvgData';
import type { StrategyMapProps } from './types';

const SMALL_LABEL_PROVINCE_IDS = new Set([
  'us-ct',
  'us-de',
  'us-md',
  'us-ma',
  'us-nh',
  'us-nj',
  'us-ri',
  'us-vt',
]);

function getProvinceLabel(province: WorldState['provinces'][number]) {
  return province.labelShort ?? province.name.slice(0, 2).toUpperCase();
}

function getUnitMarkerLabel(units: WorldState['units']) {
  if (units.length === 1) {
    const [unit] = units;
    return unit.status === 'moving' ? 'M' : unit.unitTypeCode.slice(0, 1).toUpperCase();
  }

  return 'U';
}

export function USMap({
  worldState,
  selectedProvinceId,
  selectedUnitIds,
  onProvinceSelect,
}: StrategyMapProps) {
  const activeUnits = worldState.units.filter((unit) => unit.status !== 'destroyed');
  const nationById = new Map(worldState.nations.map((nation) => [nation.id, nation]));
  const provinceStateById = new Map(
    worldState.provinceStates.map((provinceState) => [provinceState.provinceId, provinceState]),
  );
  const selectedUnitIdSet = new Set(selectedUnitIds);
  const selectedUnits = activeUnits.filter((unit) => selectedUnitIdSet.has(unit.id));
  const selectedGroupOriginProvinceId =
    selectedUnits.length > 0 &&
    selectedUnits.every((unit) => unit.status === 'idle' && unit.provinceId === selectedUnits[0]?.provinceId)
      ? selectedUnits[0]?.provinceId ?? null
      : null;
  const unitsByProvinceId = new Map<string, WorldState['units']>();

  for (const unit of activeUnits) {
    const units = unitsByProvinceId.get(unit.provinceId) ?? [];
    units.push(unit);
    unitsByProvinceId.set(unit.provinceId, units);
  }

  return (
    <section>
      <h2 style={{ marginTop: 0 }}>United States Map</h2>
      <p style={{ color: '#94a3b8' }}>
        Click a state to inspect it. Select one or more idle friendly units, then click an adjacent
        state to move them.
      </p>

      <svg
        viewBox={US48_SVG_VIEWBOX}
        role="img"
        aria-label="REWAR United States map"
        style={{
          width: '100%',
          maxWidth: 1080,
          border: '1px solid #334155',
          borderRadius: 12,
          background: '#0f172a',
        }}
      >
        <rect width="959" height="593" fill="#0f172a" />

        {worldState.provinces.map((province) => {
          const pathData = US48_STATE_PATHS[province.shapeKey];

          if (!pathData) {
            return null;
          }

          const provinceState = provinceStateById.get(province.id);
          const ownerNation = provinceState ? nationById.get(provinceState.ownerNationId) : null;
          const provinceUnits = unitsByProvinceId.get(province.id) ?? [];
          const provinceNationIds = new Set(provinceUnits.map((unit) => unit.nationId));
          const unitNation =
            provinceNationIds.size === 1
              ? nationById.get(provinceUnits[0]?.nationId ?? '')
              : ownerNation;
          const isSelectedProvince = province.id === selectedProvinceId;
          const isAdjacentTarget =
            selectedGroupOriginProvinceId &&
            selectedGroupOriginProvinceId !== province.id &&
            isAdjacentProvinceMove(selectedGroupOriginProvinceId, province.id, worldState.edges);
          const hasSelectedUnitsInProvince = provinceUnits.some((unit) => selectedUnitIdSet.has(unit.id));
          const markerStroke = hasSelectedUnitsInProvince ? '#f8fafc' : '#020617';
          const markerStrokeWidth = hasSelectedUnitsInProvince ? 3 : 2;

          return (
            <g key={province.id}>
              <path
                id={province.shapeKey}
                d={pathData}
                fill={ownerNation?.colorHex ?? '#1e293b'}
                fillOpacity={ownerNation ? 0.84 : 1}
                stroke={isSelectedProvince ? '#f8fafc' : isAdjacentTarget ? '#38bdf8' : '#0f172a'}
                strokeWidth={isSelectedProvince ? 3 : isAdjacentTarget ? 2.5 : 1.4}
                style={{ cursor: 'pointer' }}
                onClick={() => onProvinceSelect(province.id)}
              />
              <title>{province.name}</title>

              <text
                x={province.labelX ?? province.centroidX}
                y={province.labelY ?? province.centroidY}
                textAnchor="middle"
                fill="#f8fafc"
                fontSize={SMALL_LABEL_PROVINCE_IDS.has(province.id) ? 10 : 12}
                fontWeight="700"
                stroke="#020617"
                strokeWidth="2.5"
                paintOrder="stroke"
                pointerEvents="none"
              >
                {getProvinceLabel(province)}
              </text>

              {province.isProductionCenter ? (
                <g pointerEvents="none">
                  <rect
                    x={province.centroidX + 12}
                    y={province.centroidY - 18}
                    width={8}
                    height={8}
                    transform={`rotate(45 ${province.centroidX + 16} ${province.centroidY - 14})`}
                    fill="#facc15"
                    stroke="#0f172a"
                    strokeWidth={1.5}
                  />
                </g>
              ) : null}

              {provinceUnits.length > 0 ? (
                <g pointerEvents="none">
                  <circle
                    cx={province.centroidX}
                    cy={province.centroidY}
                    r={provinceUnits.length > 1 ? 11 : 9}
                    fill={unitNation?.colorHex ?? ownerNation?.colorHex ?? '#e2e8f0'}
                    stroke={markerStroke}
                    strokeWidth={markerStrokeWidth}
                  />
                  <text
                    x={province.centroidX}
                    y={province.centroidY + 4}
                    textAnchor="middle"
                    fill="#020617"
                    fontSize="10"
                    fontWeight="700"
                  >
                    {getUnitMarkerLabel(provinceUnits)}
                  </text>

                  {provinceUnits.length > 1 ? (
                    <g>
                      <circle
                        cx={province.centroidX + 11}
                        cy={province.centroidY - 10}
                        r={7}
                        fill="#020617"
                        stroke="#e2e8f0"
                        strokeWidth={1.5}
                      />
                      <text
                        x={province.centroidX + 11}
                        y={province.centroidY - 7}
                        textAnchor="middle"
                        fill="#e2e8f0"
                        fontSize="8"
                        fontWeight="700"
                      >
                        {provinceUnits.length}
                      </text>
                    </g>
                  ) : null}
                </g>
              ) : null}
            </g>
          );
        })}

        <g pointerEvents="none">
          {US48_BORDER_PATHS.map((pathData, index) => (
            <path
              key={`${pathData.slice(0, 24)}-${index}`}
              d={pathData}
              fill="none"
              stroke="#020617"
              strokeWidth={0.8}
            />
          ))}
        </g>
      </svg>
    </section>
  );
}
