import { useEffect, useRef, useState } from 'react';
import { isAdjacentProvinceMove } from '@rewar/rules';
import type { WorldState } from '@rewar/shared';
import type { StrategyMapProps } from './types';
import {
  ProductionIcon,
  UnitCounter,
  WAR_MAP_THEME,
  getMutedNationFill,
} from './warMapTheme';

const MAP_DOUBLE_CLICK_DELAY_MS = 210;

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
  selectedUnitIds,
  onProvinceSelect,
  onProvinceDoubleClick,
}: StrategyMapProps) {
  const [hoveredProvinceId, setHoveredProvinceId] = useState<string | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const activeUnits = worldState.units.filter((unit) => unit.status !== 'destroyed');
  const nationById = new Map(worldState.nations.map((nation) => [nation.id, nation]));
  const provinceStateById = new Map(
    worldState.provinceStates.map((provinceState) => [provinceState.provinceId, provinceState]),
  );
  const unitsByProvinceId = new Map<string, WorldState['units']>();
  const selectedUnitIdSet = new Set(selectedUnitIds);
  const selectedUnits = activeUnits.filter((unit) => selectedUnitIdSet.has(unit.id));
  const selectedGroupOriginProvinceId =
    selectedUnits.length > 0 &&
    selectedUnits.every((unit) => unit.status === 'idle' && unit.provinceId === selectedUnits[0]?.provinceId)
      ? selectedUnits[0]?.provinceId ?? null
      : null;

  for (const unit of activeUnits) {
    const units = unitsByProvinceId.get(unit.provinceId) ?? [];
    units.push(unit);
    unitsByProvinceId.set(unit.provinceId, units);
  }

  useEffect(() => {
    return () => {
      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  const scheduleProvinceClick = (provinceId: string) => {
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
    }

    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      onProvinceSelect(provinceId);
    }, MAP_DOUBLE_CLICK_DELAY_MS);
  };

  const triggerProvinceDoubleClick = (provinceId: string) => {
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }

    onProvinceDoubleClick(provinceId);
  };

  return (
    <section
      style={{
        border: `1px solid ${WAR_MAP_THEME.panelBorder}`,
        borderRadius: 16,
        padding: 18,
        background:
          'linear-gradient(180deg, rgba(20,29,38,0.98) 0%, rgba(12,18,25,0.98) 100%)',
        boxShadow: '0 18px 34px rgba(2, 6, 23, 0.32)',
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: 1.6,
            color: '#9fb0be',
            marginBottom: 6,
          }}
        >
          Strategic Theater
        </div>
        <h2 style={{ margin: 0, fontSize: 24 }}>Starter World</h2>
        <p style={{ color: '#94a3b8', marginBottom: 0, marginTop: 8 }}>
          Select one or more idle friendly units in the province panel, then click an adjacent
          highlighted province to move them. Double-click a province to select all idle friendly
          units there.
        </p>
      </div>

      <svg
        viewBox="0 0 640 420"
        role="img"
        aria-label="REWAR starter world"
        style={{
          width: '100%',
          maxWidth: 720,
          border: `1px solid ${WAR_MAP_THEME.panelBorder}`,
          borderRadius: 14,
          background: WAR_MAP_THEME.background,
        }}
      >
        <defs>
          <pattern id="starter-war-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#23303d" strokeWidth="0.9" opacity="0.3" />
            <path d="M 0 20 L 20 0" fill="none" stroke="#17212b" strokeWidth="0.8" opacity="0.22" />
          </pattern>
        </defs>

        <rect width="640" height="420" fill={WAR_MAP_THEME.background} />
        <rect width="640" height="420" fill="url(#starter-war-grid)" opacity={0.5} />

        {worldState.provinces.map((province) => {
          const provinceState = provinceStateById.get(province.id);
          const ownerNation = provinceState ? nationById.get(provinceState.ownerNationId) : null;
          const provinceUnits = unitsByProvinceId.get(province.id) ?? [];
          const { x, y, width, height } = getProvinceFrame(province.centroidX, province.centroidY);
          const isSelectedProvince = province.id === selectedProvinceId;
          const isAdjacentTarget =
            selectedGroupOriginProvinceId &&
            selectedGroupOriginProvinceId !== province.id &&
            isAdjacentProvinceMove(selectedGroupOriginProvinceId, province.id, worldState.edges);
          const isHoveredProvince = hoveredProvinceId === province.id;
          const provinceFill = getMutedNationFill(ownerNation);
          const provinceStroke = isSelectedProvince
            ? WAR_MAP_THEME.selectedOutline
            : isAdjacentTarget
              ? WAR_MAP_THEME.moveOutline
              : isHoveredProvince
                ? WAR_MAP_THEME.hoverOutline
                : WAR_MAP_THEME.stateInnerBorder;
          const hasSelectedUnitsInProvince = provinceUnits.some((unit) => selectedUnitIdSet.has(unit.id));
          const unitNationIds = new Set(provinceUnits.map((unit) => unit.nationId));
          const unitNation =
            unitNationIds.size === 1 ? nationById.get(provinceUnits[0]?.nationId ?? '') ?? ownerNation : ownerNation;

          return (
            <g key={province.id}>
              {isSelectedProvince ? (
                <rect
                  x={x - 3}
                  y={y - 3}
                  width={width + 6}
                  height={height + 6}
                  rx={10}
                  ry={10}
                  fill="none"
                  stroke={WAR_MAP_THEME.selectedGlow}
                  strokeWidth={5}
                  opacity={0.26}
                  pointerEvents="none"
                />
              ) : null}
              <rect
                id={province.shapeKey}
                x={x}
                y={y}
                width={width}
                height={height}
                rx={8}
                ry={8}
                fill={provinceFill}
                fillOpacity={isHoveredProvince ? 0.96 : ownerNation ? 0.9 : 1}
                stroke={provinceStroke}
                strokeWidth={isSelectedProvince ? 4 : isAdjacentTarget ? 3 : isHoveredProvince ? 2.6 : 2}
                strokeDasharray={isAdjacentTarget ? '8 5' : undefined}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredProvinceId(province.id)}
                onMouseLeave={() => setHoveredProvinceId((currentHoveredProvinceId) =>
                  currentHoveredProvinceId === province.id ? null : currentHoveredProvinceId,
                )}
                onClick={() => scheduleProvinceClick(province.id)}
                onDoubleClick={() => triggerProvinceDoubleClick(province.id)}
              />
              <title>{province.name}</title>
              <text
                x={province.centroidX}
                y={province.centroidY - 8}
                textAnchor="middle"
                fill={WAR_MAP_THEME.labelFill}
                fontSize="14"
                fontWeight="800"
                letterSpacing={0.2}
                stroke={WAR_MAP_THEME.labelStroke}
                strokeWidth="3"
                paintOrder="stroke"
                pointerEvents="none"
              >
                {province.name}
              </text>
              <text
                x={province.centroidX}
                y={province.centroidY + 12}
                textAnchor="middle"
                fill="#d0dae4"
                fontSize="11"
                fontWeight="600"
                stroke={WAR_MAP_THEME.labelStroke}
                strokeWidth="2.2"
                paintOrder="stroke"
                pointerEvents="none"
              >
                {ownerNation?.name ?? 'Unclaimed'}
              </text>

              {province.isProductionCenter ? (
                <ProductionIcon x={x + width - 18} y={y + 18} scale={0.95} />
              ) : null}

              {provinceUnits.length > 0 ? (
                <UnitCounter
                  x={province.centroidX}
                  y={province.centroidY + 38}
                  units={provinceUnits}
                  nation={unitNation}
                  isSelected={hasSelectedUnitsInProvince}
                  scale={1.12}
                />
              ) : null}
            </g>
          );
        })}

        <line
          x1="320"
          y1="10"
          x2="320"
          y2="410"
          stroke={WAR_MAP_THEME.moveOutline}
          strokeDasharray="10 8"
          strokeWidth="2.6"
          opacity={0.75}
          pointerEvents="none"
        />
      </svg>
    </section>
  );
}
