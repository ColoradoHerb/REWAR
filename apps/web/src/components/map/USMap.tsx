import { useEffect, useRef, useState } from 'react';
import { isAdjacentProvinceMove } from '@rewar/rules';
import type { WorldState } from '@rewar/shared';
import { US48_BORDER_PATHS, US48_STATE_PATHS, US48_SVG_VIEWBOX } from './us48SvgData';
import type { StrategyMapProps } from './types';
import {
  ProductionIcon,
  UnitCounter,
  WAR_MAP_THEME,
  getMutedNationFill,
} from './warMapTheme';

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

const SMALL_STATE_HIT_TARGETS: Partial<
  Record<
    string,
    {
      x: number;
      y: number;
      width: number;
      height: number;
      radius?: number;
    }
  >
> = {
  'us-ct': { x: 857, y: 181, width: 32, height: 26, radius: 12 },
  'us-de': { x: 828, y: 242, width: 30, height: 32, radius: 12 },
  'us-md': { x: 797, y: 250, width: 40, height: 24, radius: 12 },
  'us-ma': { x: 874, y: 159, width: 46, height: 24, radius: 12 },
  'us-nj': { x: 834, y: 218, width: 28, height: 42, radius: 12 },
  'us-ri': { x: 878, y: 173, width: 24, height: 24, radius: 12 },
};

const COUNTER_LAYOUT_OVERRIDES: Partial<
  Record<
    string,
    {
      offsetX?: number;
      offsetY?: number;
      scale?: number;
    }
  >
> = {
  'us-la': { offsetX: -12, offsetY: 12 },
  'us-ms': { offsetX: 12, offsetY: 10 },
  'us-ct': { offsetX: 18, offsetY: 10, scale: 0.92 },
  'us-md': { offsetX: 24, offsetY: 16, scale: 0.92 },
  'us-de': { offsetX: 26, offsetY: 10, scale: 0.9 },
  'us-nj': { offsetX: 18, offsetY: 0, scale: 0.92 },
  'us-ri': { offsetX: 16, offsetY: 8, scale: 0.88 },
  'us-ma': { offsetX: 8, offsetY: -10, scale: 0.94 },
};

const PRODUCTION_LAYOUT_OVERRIDES: Partial<
  Record<
    string,
    {
      offsetX?: number;
      offsetY?: number;
      scale?: number;
    }
  >
> = {
  'us-ca': { offsetX: -18, offsetY: -2, scale: 0.92 },
  'us-wa': { offsetX: -10, offsetY: -8, scale: 0.9 },
  'us-co': { offsetX: -18, offsetY: -16, scale: 0.9 },
  'us-tx': { offsetX: -18, offsetY: -18, scale: 0.92 },
  'us-il': { offsetX: -16, offsetY: -12, scale: 0.88 },
  'us-pa': { offsetX: -18, offsetY: -16, scale: 0.86 },
  'us-ga': { offsetX: -16, offsetY: -12, scale: 0.9 },
  'us-ny': { offsetX: -18, offsetY: -10, scale: 0.86 },
};

const MAP_DOUBLE_CLICK_DELAY_MS = 210;

function getProvinceLabel(province: WorldState['provinces'][number]) {
  return province.labelShort ?? province.name.slice(0, 2).toUpperCase();
}

export function USMap({
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

  const provinceRenderData = worldState.provinces.flatMap((province) => {
    const pathData = US48_STATE_PATHS[province.shapeKey];

    if (!pathData) {
      return [];
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
    const isHoveredProvince = hoveredProvinceId === province.id;
    const provinceFill = getMutedNationFill(ownerNation);
    const provinceOpacity = ownerNation ? (isHoveredProvince ? 0.96 : 0.9) : 1;
    const provinceStroke = isSelectedProvince
      ? WAR_MAP_THEME.selectedOutline
      : isAdjacentTarget
        ? WAR_MAP_THEME.moveOutline
        : isHoveredProvince
          ? WAR_MAP_THEME.hoverOutline
          : WAR_MAP_THEME.stateBorder;
    const provinceStrokeWidth = isSelectedProvince ? 3.6 : isAdjacentTarget ? 2.8 : isHoveredProvince ? 2.2 : 1.6;
    const counterLayout = COUNTER_LAYOUT_OVERRIDES[province.id];
    const productionLayout = PRODUCTION_LAYOUT_OVERRIDES[province.id];
    const hitTarget = SMALL_STATE_HIT_TARGETS[province.id];

    return [
      {
        province,
        pathData,
        ownerNation,
        provinceUnits,
        unitNation,
        isSelectedProvince,
        isAdjacentTarget,
        hasSelectedUnitsInProvince,
        isHoveredProvince,
        provinceFill,
        provinceOpacity,
        provinceStroke,
        provinceStrokeWidth,
        counterX: province.centroidX + (counterLayout?.offsetX ?? 0),
        counterY: province.centroidY + (counterLayout?.offsetY ?? 0),
        counterScale: counterLayout?.scale ?? 1,
        productionX: province.centroidX + (productionLayout?.offsetX ?? 16),
        productionY: province.centroidY + (productionLayout?.offsetY ?? -18),
        productionScale: productionLayout?.scale ?? 0.9,
        hitTarget,
      },
    ];
  });

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
        <h2 style={{ margin: 0, fontSize: 24 }}>Contiguous United States</h2>
        <p style={{ color: '#94a3b8', marginBottom: 0, marginTop: 8 }}>
          Click a state to inspect it. Select one or more idle friendly units, then click an
          adjacent highlighted state to move them. Double-click a state to select all idle friendly
          units there.
        </p>
      </div>

      <svg
        viewBox={US48_SVG_VIEWBOX}
        role="img"
        aria-label="REWAR United States map"
        style={{
          width: '100%',
          maxWidth: 1080,
          border: `1px solid ${WAR_MAP_THEME.panelBorder}`,
          borderRadius: 14,
          background: WAR_MAP_THEME.background,
        }}
      >
        <defs>
          <pattern id="us48-war-grid" width="18" height="18" patternUnits="userSpaceOnUse">
            <path d="M 18 0 L 0 0 0 18" fill="none" stroke="#23303d" strokeWidth="0.8" opacity="0.3" />
            <path d="M 0 18 L 18 0" fill="none" stroke="#17212b" strokeWidth="0.8" opacity="0.22" />
          </pattern>
        </defs>

        <rect width="959" height="593" fill={WAR_MAP_THEME.background} />
        <rect width="959" height="593" fill="url(#us48-war-grid)" opacity={0.5} />

        <g aria-label="state fills">
          {provinceRenderData.map((renderData) => (
            <g key={renderData.province.id}>
              {renderData.isSelectedProvince ? (
                <path
                  d={renderData.pathData}
                  fill="none"
                  stroke={WAR_MAP_THEME.selectedGlow}
                  strokeWidth={6}
                  opacity={0.3}
                  pointerEvents="none"
                />
              ) : null}
              <path
                id={renderData.province.shapeKey}
                d={renderData.pathData}
                fill={renderData.provinceFill}
                fillOpacity={renderData.provinceOpacity}
                stroke={renderData.provinceStroke}
                strokeWidth={renderData.provinceStrokeWidth}
                strokeDasharray={renderData.isAdjacentTarget ? '7 4' : undefined}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredProvinceId(renderData.province.id)}
                onMouseLeave={() => setHoveredProvinceId((currentHoveredProvinceId) =>
                  currentHoveredProvinceId === renderData.province.id ? null : currentHoveredProvinceId,
                )}
                onClick={() => scheduleProvinceClick(renderData.province.id)}
                onDoubleClick={() => triggerProvinceDoubleClick(renderData.province.id)}
              />
              <title>{renderData.province.name}</title>
            </g>
          ))}
        </g>

        <g pointerEvents="none">
          {US48_BORDER_PATHS.map((pathData, index) => (
            <path
              key={`${pathData.slice(0, 24)}-${index}`}
              d={pathData}
              fill="none"
              stroke={WAR_MAP_THEME.stateInnerBorder}
              strokeWidth={0.9}
            />
          ))}
        </g>

        <g pointerEvents="none" aria-label="state labels">
          {provinceRenderData.map((renderData) => (
            <text
              key={`label-${renderData.province.id}`}
              x={renderData.province.labelX ?? renderData.province.centroidX}
              y={renderData.province.labelY ?? renderData.province.centroidY}
              textAnchor="middle"
              fill={WAR_MAP_THEME.labelFill}
              fontSize={SMALL_LABEL_PROVINCE_IDS.has(renderData.province.id) ? 10 : 12}
              fontWeight="800"
              letterSpacing={0.8}
              stroke={WAR_MAP_THEME.labelStroke}
              strokeWidth="3.4"
              paintOrder="stroke"
            >
              {getProvinceLabel(renderData.province)}
            </text>
          ))}
        </g>

        <g aria-label="production markers">
          {provinceRenderData.map((renderData) =>
            renderData.province.isProductionCenter ? (
              <g
                key={`production-${renderData.province.id}`}
                role="img"
                aria-label={`Production Center: ${renderData.province.name}`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredProvinceId(renderData.province.id)}
                onMouseLeave={() => setHoveredProvinceId((currentHoveredProvinceId) =>
                  currentHoveredProvinceId === renderData.province.id ? null : currentHoveredProvinceId,
                )}
                onClick={() => scheduleProvinceClick(renderData.province.id)}
                onDoubleClick={() => triggerProvinceDoubleClick(renderData.province.id)}
              >
                <title>{`Production Center: ${renderData.province.name}`}</title>
                <circle
                  cx={renderData.productionX}
                  cy={renderData.productionY}
                  r={10 * renderData.productionScale}
                  fill="rgba(0, 0, 0, 0)"
                />
                <ProductionIcon
                  x={renderData.productionX}
                  y={renderData.productionY}
                  scale={renderData.productionScale}
                />
              </g>
            ) : null,
          )}
        </g>

        <g pointerEvents="none" aria-label="unit counters">
          {provinceRenderData.map((renderData) =>
            renderData.provinceUnits.length > 0 ? (
              <UnitCounter
                key={`counter-${renderData.province.id}`}
                x={renderData.counterX}
                y={renderData.counterY}
                units={renderData.provinceUnits}
                nation={renderData.unitNation ?? renderData.ownerNation}
                isSelected={renderData.hasSelectedUnitsInProvince}
                scale={renderData.counterScale}
              />
            ) : null,
          )}
        </g>

        <g aria-label="small state hit targets">
          {provinceRenderData.map((renderData) => {
            if (!renderData.hitTarget) {
              return null;
            }

            const { x, y, width, height, radius = 12 } = renderData.hitTarget;

            return (
              <rect
                key={`hit-target-${renderData.province.id}`}
                x={x - width / 2}
                y={y - height / 2}
                width={width}
                height={height}
                rx={radius}
                ry={radius}
                fill="rgba(0, 0, 0, 0)"
                pointerEvents="all"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredProvinceId(renderData.province.id)}
                onMouseLeave={() => setHoveredProvinceId((currentHoveredProvinceId) =>
                  currentHoveredProvinceId === renderData.province.id ? null : currentHoveredProvinceId,
                )}
                onClick={() => scheduleProvinceClick(renderData.province.id)}
                onDoubleClick={() => triggerProvinceDoubleClick(renderData.province.id)}
              />
            );
          })}
        </g>
      </svg>
    </section>
  );
}
