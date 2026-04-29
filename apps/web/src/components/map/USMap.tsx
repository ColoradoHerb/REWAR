import { useEffect, useRef, useState } from 'react';
import { isAdjacentProvinceMove } from '@rewar/rules';
import { US48_SUB_V1_STATE_REGIONS, US48_SUB_WORLD_ID, type WorldState } from '@rewar/shared';
import { US48_BORDER_PATHS, US48_STATE_PATHS } from './us48SvgData';
import { US48_SUB_PROVINCE_PATHS } from './us48SubProvinceSvgData';
import { MAP_HIGH_ZOOM_THRESHOLD, MAP_LOW_ZOOM_THRESHOLD, MapViewport } from './MapViewport';
import type { StrategyMapProps } from './types';
import {
  ProductionIcon,
  UnitCounter,
  WAR_MAP_THEME,
  getOwnershipTintFill,
  getOwnershipTintOpacity,
  getTerrainBaseFill,
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
  'us-pa-west': { offsetX: -8, offsetY: 2, scale: 0.94 },
  'us-pa-central-ridge': { offsetX: 0, offsetY: 1, scale: 0.92 },
  'us-pa-east': { offsetX: 8, offsetY: 2, scale: 0.9 },
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
  'us-co-front-range': { offsetX: 10, offsetY: -14, scale: 0.88 },
  'us-tx': { offsetX: -18, offsetY: -18, scale: 0.92 },
  'us-tx-central-hills': { offsetX: 14, offsetY: -16, scale: 0.9 },
  'us-il': { offsetX: -16, offsetY: -12, scale: 0.88 },
  'us-pa': { offsetX: -18, offsetY: -16, scale: 0.86 },
  'us-pa-east': { offsetX: 10, offsetY: -12, scale: 0.82 },
  'us-ga': { offsetX: -16, offsetY: -12, scale: 0.9 },
  'us-ny': { offsetX: -18, offsetY: -10, scale: 0.86 },
};

const MAP_DOUBLE_CLICK_DELAY_MS = 210;

function getProvinceLabel(province: WorldState['provinces'][number]) {
  return province.labelShort ?? province.name.slice(0, 2).toUpperCase();
}

function getProvincePathDefinition(province: WorldState['provinces'][number]) {
  const subProvinceShape = US48_SUB_PROVINCE_PATHS[province.shapeKey];

  if (subProvinceShape) {
    return {
      pathData: subProvinceShape.pathData,
      clipPathId: `clip-${subProvinceShape.parentStateId}`,
      parentStateId: subProvinceShape.parentStateId,
      isSubProvince: true,
    };
  }

  const pathData = US48_STATE_PATHS[province.shapeKey];

  if (!pathData) {
    return null;
  }

  return {
    pathData,
    clipPathId: null,
    parentStateId: province.parentStateId ?? province.id,
    isSubProvince: false,
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function getCounterZoomScale(zoomLevel: number) {
  if (zoomLevel <= MAP_LOW_ZOOM_THRESHOLD) {
    return 1.06;
  }

  if (zoomLevel <= MAP_HIGH_ZOOM_THRESHOLD) {
    const transitionProgress = clamp01(
      (zoomLevel - MAP_LOW_ZOOM_THRESHOLD) /
        (MAP_HIGH_ZOOM_THRESHOLD - MAP_LOW_ZOOM_THRESHOLD),
    );

    return 1.06 - transitionProgress * 0.18;
  }

  const highZoomProgress = clamp01((zoomLevel - MAP_HIGH_ZOOM_THRESHOLD) / (3 - MAP_HIGH_ZOOM_THRESHOLD));
  return 0.88 - highZoomProgress * 0.16;
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
  const isSubProvinceScenario = worldState.session.seedWorldId === US48_SUB_WORLD_ID;
  const activeUnits = worldState.units.filter((unit) => unit.status !== 'destroyed');
  const nationById = new Map(worldState.nations.map((nation) => [nation.id, nation]));
  const provinceStateById = new Map(
    worldState.provinceStates.map((provinceState) => [provinceState.provinceId, provinceState]),
  );
  const pilotStateRegions = isSubProvinceScenario ? US48_SUB_V1_STATE_REGIONS : [];
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
    const pathDefinition = getProvincePathDefinition(province);

    if (!pathDefinition) {
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
    const provinceFill = getTerrainBaseFill(province.terrainType);
    const ownershipTintFill = getOwnershipTintFill(ownerNation);
    const ownershipTintOpacity = getOwnershipTintOpacity(ownerNation, isHoveredProvince);
    const provinceStroke = isSelectedProvince
      ? WAR_MAP_THEME.selectedOutline
      : isAdjacentTarget
        ? WAR_MAP_THEME.moveOutline
        : isHoveredProvince
          ? WAR_MAP_THEME.hoverOutline
          : WAR_MAP_THEME.stateBorder;
    const provinceStrokeWidth = isSelectedProvince
      ? 3
      : isAdjacentTarget
        ? 2.2
        : isHoveredProvince
          ? 1.55
          : pathDefinition.isSubProvince
            ? 0.65
            : 1.05;
    const counterLayout = COUNTER_LAYOUT_OVERRIDES[province.id];
    const productionLayout = PRODUCTION_LAYOUT_OVERRIDES[province.id];
    const hitTarget = SMALL_STATE_HIT_TARGETS[province.id];

    return [
      {
        province,
        pathData: pathDefinition.pathData,
        clipPathId: pathDefinition.clipPathId,
        parentStateId: pathDefinition.parentStateId,
        isSubProvince: pathDefinition.isSubProvince,
        ownerNation,
        provinceUnits,
        unitNation,
        isSelectedProvince,
        isAdjacentTarget,
        hasSelectedUnitsInProvince,
        isHoveredProvince,
        provinceFill,
        ownershipTintFill,
        ownershipTintOpacity,
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
          Click a state or sub-province to inspect it. Use the mouse wheel to zoom and drag to pan.
          Select one or more idle friendly units, then click an adjacent highlighted region to move
          them. Double-click a region to select all idle friendly units there.
        </p>
      </div>

      <MapViewport
        ariaLabel="REWAR United States map"
        baseViewBox={{ x: 0, y: 0, width: 959, height: 593 }}
        maxWidth={1080}
        resetKey={worldState.session.id}
      >
        {({ shouldIgnoreMapClick, zoomLevel }) => {
          const handleProvinceClick = (provinceId: string) => {
            if (shouldIgnoreMapClick()) {
              return;
            }

            scheduleProvinceClick(provinceId);
          };

          const handleProvinceDoubleClick = (provinceId: string) => {
            if (shouldIgnoreMapClick()) {
              return;
            }

            triggerProvinceDoubleClick(provinceId);
          };

          const fullLabelProgress = clamp01(
            (zoomLevel - MAP_LOW_ZOOM_THRESHOLD) /
              (MAP_HIGH_ZOOM_THRESHOLD - MAP_LOW_ZOOM_THRESHOLD),
          );
          const centerDotOpacity = clamp01((zoomLevel - 1.35) / 0.35);
          const abbreviationFadeStart = MAP_LOW_ZOOM_THRESHOLD + 0.08;
          const abbreviationFadeEnd = MAP_HIGH_ZOOM_THRESHOLD - 0.31;
          const fullNameFadeStart = MAP_HIGH_ZOOM_THRESHOLD - 0.37;
          const fullNameFadeEnd = MAP_HIGH_ZOOM_THRESHOLD - 0.11;
          const counterZoomScale = getCounterZoomScale(zoomLevel);
          const isHighZoom = zoomLevel >= MAP_HIGH_ZOOM_THRESHOLD;
          const subProvinceBorderOpacity = isSubProvinceScenario
            ? 0.36 + clamp01((zoomLevel - 1.26) / 0.42) * 0.22
            : 0;
          const pilotRegionLabelOpacity = isSubProvinceScenario
            ? clamp01((1.78 - zoomLevel) / 0.43)
            : 0;
          const subProvinceLabelOpacity = isSubProvinceScenario
            ? clamp01((zoomLevel - 1.52) / 0.26)
            : 0;

          return (
            <>
              <defs>
                <pattern id="us48-war-grid" width="18" height="18" patternUnits="userSpaceOnUse">
                  <path d="M 18 0 L 0 0 0 18" fill="none" stroke="#273229" strokeWidth="0.7" opacity="0.16" />
                  <path d="M 0 18 L 18 0" fill="none" stroke="#182018" strokeWidth="0.65" opacity="0.1" />
                </pattern>
                {pilotStateRegions.map((stateRegion) => {
                  const parentPathData = US48_STATE_PATHS[stateRegion.shapeKey];

                  return parentPathData ? (
                    <clipPath key={`clip-${stateRegion.id}`} id={`clip-${stateRegion.id}`}>
                      <path d={parentPathData} />
                    </clipPath>
                  ) : null;
                })}
              </defs>

              <rect width="959" height="593" fill={WAR_MAP_THEME.background} />
              <rect width="959" height="593" fill="url(#us48-war-grid)" opacity={0.22} />

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
                        clipPath={renderData.clipPathId ? `url(#${renderData.clipPathId})` : undefined}
                      />
                    ) : null}
                    <path
                      id={renderData.province.shapeKey}
                      d={renderData.pathData}
                      fill={renderData.provinceFill}
                      fillOpacity={1}
                      stroke={renderData.provinceStroke}
                      strokeWidth={renderData.provinceStrokeWidth}
                      strokeDasharray={renderData.isAdjacentTarget ? '7 4' : undefined}
                      clipPath={renderData.clipPathId ? `url(#${renderData.clipPathId})` : undefined}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredProvinceId(renderData.province.id)}
                      onMouseLeave={() => setHoveredProvinceId((currentHoveredProvinceId) =>
                        currentHoveredProvinceId === renderData.province.id ? null : currentHoveredProvinceId,
                      )}
                      onClick={() => handleProvinceClick(renderData.province.id)}
                      onDoubleClick={() => handleProvinceDoubleClick(renderData.province.id)}
                    />
                    {renderData.ownershipTintOpacity > 0 ? (
                      <path
                        d={renderData.pathData}
                        fill={renderData.ownershipTintFill}
                        fillOpacity={renderData.ownershipTintOpacity}
                        stroke="none"
                        pointerEvents="none"
                        clipPath={renderData.clipPathId ? `url(#${renderData.clipPathId})` : undefined}
                      />
                    ) : null}
                    <title>{renderData.province.name}</title>
                  </g>
                ))}
              </g>

              {isSubProvinceScenario ? (
                <g
                  pointerEvents="none"
                  aria-label="sub-province borders"
                  opacity={subProvinceBorderOpacity}
                  style={{ transition: 'opacity 160ms ease' }}
                >
                  {provinceRenderData
                    .filter((renderData) => renderData.isSubProvince)
                    .map((renderData) => (
                      <path
                        key={`sub-border-${renderData.province.id}`}
                        d={renderData.pathData}
                        fill="none"
                        clipPath={renderData.clipPathId ? `url(#${renderData.clipPathId})` : undefined}
                        stroke={WAR_MAP_THEME.stateInnerBorder}
                        strokeWidth={0.65}
                      />
                    ))}
                </g>
              ) : null}

              <g pointerEvents="none">
                {US48_BORDER_PATHS.map((pathData, index) => (
                  <path
                    key={`${pathData.slice(0, 24)}-${index}`}
                    d={pathData}
                    fill="none"
                    stroke={WAR_MAP_THEME.stateInnerBorder}
                    strokeWidth={0.85}
                  />
                ))}
              </g>

              <g pointerEvents="none" aria-label="state labels">
                {provinceRenderData.map((renderData) => {
                  if (renderData.isSubProvince) {
                    return null;
                  }

                  const isSmallLabelState = SMALL_LABEL_PROVINCE_IDS.has(renderData.province.id);
                  const labelX = renderData.province.labelX ?? renderData.province.centroidX;
                  const labelY = renderData.province.labelY ?? renderData.province.centroidY;
                  const abbreviationOpacity = isSmallLabelState
                    ? 1
                    : clamp01(
                        (abbreviationFadeEnd - zoomLevel) /
                          Math.max(0.001, abbreviationFadeEnd - abbreviationFadeStart),
                      );
                  const fullNameOpacity = isSmallLabelState
                    ? 0
                    : clamp01(
                        (zoomLevel - fullNameFadeStart) /
                          Math.max(0.001, fullNameFadeEnd - fullNameFadeStart),
                      );
                  const abbreviationFontSize = isSmallLabelState ? (isHighZoom ? 10.4 : 10) : 12;
                  const fullNameFontSize = 10.5 + fullLabelProgress * 1.1;

                  return (
                    <g key={`label-${renderData.province.id}`}>
                      <text
                        x={labelX}
                        y={labelY}
                        textAnchor="middle"
                        fill={WAR_MAP_THEME.labelFill}
                        fontSize={abbreviationFontSize}
                        fontWeight="800"
                        letterSpacing={0.8}
                        stroke={WAR_MAP_THEME.labelStroke}
                        strokeWidth="3.4"
                        paintOrder="stroke"
                        opacity={abbreviationOpacity}
                        style={{ transition: 'opacity 140ms ease, font-size 140ms ease' }}
                      >
                        {getProvinceLabel(renderData.province)}
                      </text>
                      {!isSmallLabelState && !renderData.isSubProvince ? (
                        <text
                          x={labelX}
                          y={labelY + (isHighZoom ? 2 : 0)}
                          textAnchor="middle"
                          fill="#d9e2ea"
                          fontSize={fullNameFontSize}
                          fontWeight="700"
                          letterSpacing={0.35}
                          stroke={WAR_MAP_THEME.labelStroke}
                          strokeWidth="3"
                          paintOrder="stroke"
                          opacity={fullNameOpacity}
                          style={{ transition: 'opacity 140ms ease, font-size 140ms ease' }}
                        >
                          {renderData.province.name}
                        </text>
                      ) : null}
                    </g>
                  );
                })}

                {isSubProvinceScenario
                  ? pilotStateRegions.map((stateRegion) => {
                      const labelX = stateRegion.labelX ?? stateRegion.centroidX;
                      const labelY = stateRegion.labelY ?? stateRegion.centroidY;

                      return (
                        <g key={`pilot-region-${stateRegion.id}`}>
                          <text
                            x={labelX}
                            y={labelY}
                            textAnchor="middle"
                            fill={WAR_MAP_THEME.labelFill}
                            fontSize={12}
                            fontWeight="800"
                            letterSpacing={0.8}
                            stroke={WAR_MAP_THEME.labelStroke}
                            strokeWidth="3.4"
                            paintOrder="stroke"
                            opacity={pilotRegionLabelOpacity}
                            style={{ transition: 'opacity 140ms ease' }}
                          >
                            {stateRegion.labelShort}
                          </text>
                          <text
                            x={labelX}
                            y={labelY + 1}
                            textAnchor="middle"
                            fill="#d9e2ea"
                            fontSize={10.7}
                            fontWeight="700"
                            letterSpacing={0.32}
                            stroke={WAR_MAP_THEME.labelStroke}
                            strokeWidth="3"
                            paintOrder="stroke"
                            opacity={pilotRegionLabelOpacity * 0.68}
                            style={{ transition: 'opacity 140ms ease' }}
                          >
                            {stateRegion.name}
                          </text>
                        </g>
                      );
                    })
                  : null}

                {isSubProvinceScenario
                  ? provinceRenderData
                      .filter((renderData) => renderData.isSubProvince)
                      .map((renderData) => {
                        const labelX = renderData.province.labelX ?? renderData.province.centroidX;
                        const labelY = renderData.province.labelY ?? renderData.province.centroidY;

                        return (
                          <text
                            key={`sub-label-${renderData.province.id}`}
                            x={labelX}
                            y={labelY}
                            textAnchor="middle"
                            fill={WAR_MAP_THEME.labelFill}
                            fontSize={10.4}
                            fontWeight="800"
                            letterSpacing={0.55}
                            stroke={WAR_MAP_THEME.labelStroke}
                            strokeWidth="3.1"
                            paintOrder="stroke"
                            opacity={subProvinceLabelOpacity}
                            style={{ transition: 'opacity 140ms ease' }}
                          >
                            {getProvinceLabel(renderData.province)}
                          </text>
                        );
                      })
                  : null}
              </g>

              <g pointerEvents="none" aria-label="state centers" opacity={centerDotOpacity} style={{ transition: 'opacity 140ms ease' }}>
                {provinceRenderData.map((renderData) => (
                  <g key={`center-${renderData.province.id}`}>
                    <circle
                      cx={renderData.province.centroidX}
                      cy={renderData.province.centroidY}
                      r={3.4}
                      fill="#d8c9a2"
                      opacity={0.78}
                    />
                    <circle
                      cx={renderData.province.centroidX}
                      cy={renderData.province.centroidY}
                      r={5.8}
                      fill="none"
                      stroke="#171e26"
                      strokeWidth={1.3}
                      opacity={0.65}
                    />
                  </g>
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
                      onClick={() => handleProvinceClick(renderData.province.id)}
                      onDoubleClick={() => handleProvinceDoubleClick(renderData.province.id)}
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
                      scale={renderData.counterScale * counterZoomScale}
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
                      onClick={() => handleProvinceClick(renderData.province.id)}
                      onDoubleClick={() => handleProvinceDoubleClick(renderData.province.id)}
                    />
                  );
                })}
              </g>
            </>
          );
        }}
      </MapViewport>
    </section>
  );
}
