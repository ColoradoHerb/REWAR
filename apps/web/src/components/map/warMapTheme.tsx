import type { Nation, TerrainType, Unit, UnitTypeCode } from '@rewar/shared';

export const WAR_MAP_THEME = {
  background: '#111821',
  backgroundOverlay: '#0b1016',
  panelBorder: '#2d3946',
  neutralFill: '#2a3440',
  neutralAccent: '#44505f',
  stateBorder: '#334033',
  stateInnerBorder: '#52604d',
  selectedOutline: '#efe1af',
  selectedGlow: '#f5edd0',
  moveOutline: '#7b9aac',
  hoverOutline: '#d6c38d',
  labelFill: '#efe7d3',
  labelStroke: '#111821',
  productionFill: '#c8a15a',
  productionAccent: '#70511d',
  counterText: '#e7edf3',
  counterTextDark: '#111821',
  badgeFill: '#111821',
  badgeStroke: '#efe7d3',
  badgeText: '#f8fafc',
} as const;

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseHexColor(hex: string) {
  const normalized = hex.replace('#', '');
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((channel) => `${channel}${channel}`)
          .join('')
      : normalized;

  const int = Number.parseInt(expanded, 16);

  if (Number.isNaN(int) || expanded.length !== 6) {
    return { red: 100, green: 116, blue: 139 };
  }

  return {
    red: (int >> 16) & 255,
    green: (int >> 8) & 255,
    blue: int & 255,
  };
}

function toHexColor(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixHexColors(fromHex: string, toHex: string, weight: number) {
  const from = parseHexColor(fromHex);
  const to = parseHexColor(toHex);
  const mix = (left: number, right: number) => left + (right - left) * weight;

  return toHexColor(mix(from.red, to.red), mix(from.green, to.green), mix(from.blue, to.blue));
}

export function getTerrainBaseFill(terrainType: TerrainType) {
  switch (terrainType) {
    case 'plains':
      return '#5f7449';
    case 'hills':
      return '#776a42';
    case 'mountains':
      return '#766f63';
    case 'forest':
      return '#385f3c';
    default:
      return WAR_MAP_THEME.neutralFill;
  }
}

export function getOwnershipTintFill(nation?: Nation | null) {
  return nation?.colorHex ?? 'transparent';
}

export function getOwnershipTintOpacity(nation?: Nation | null, isHovered = false) {
  if (!nation) {
    return 0;
  }

  return isHovered ? 0.34 : 0.27;
}

export function getMutedNationFill(nation?: Nation | null) {
  if (!nation) {
    return WAR_MAP_THEME.neutralFill;
  }

  const controllerAnchor = nation.controllerType === 'human' ? '#384a5f' : '#664144';
  return mixHexColors(nation.colorHex, controllerAnchor, 0.52);
}

export function getNationAccentFill(nation?: Nation | null) {
  if (!nation) {
    return WAR_MAP_THEME.neutralAccent;
  }

  return mixHexColors(nation.colorHex, '#e2e8f0', 0.18);
}

export function getUnitTypeSymbol(unitTypeCode: UnitTypeCode) {
  switch (unitTypeCode) {
    case 'infantry':
      return 'I';
    case 'artillery':
      return 'A';
    case 'armor':
      return 'T';
    default:
      return '?';
  }
}

export function getUnitCounterSymbol(units: Array<Pick<Unit, 'status' | 'unitTypeCode'>>) {
  if (units.length === 0) {
    return '';
  }

  if (units.length === 1) {
    const [unit] = units;
    return unit?.status === 'moving' ? 'M' : getUnitTypeSymbol(unit?.unitTypeCode ?? 'infantry');
  }

  const activeUnitTypes = new Set(
    units.filter((unit) => unit.status !== 'moving').map((unit) => unit.unitTypeCode),
  );

  if (activeUnitTypes.size === 1) {
    return getUnitTypeSymbol(units[0]?.unitTypeCode ?? 'infantry');
  }

  return 'III';
}

type UnitCounterProps = {
  x: number;
  y: number;
  units: Array<Pick<Unit, 'status' | 'unitTypeCode'>>;
  nation?: Nation | null;
  isSelected?: boolean;
  scale?: number;
};

export function UnitCounter({
  x,
  y,
  units,
  nation,
  isSelected = false,
  scale = 1,
}: UnitCounterProps) {
  if (units.length === 0) {
    return null;
  }

  const width = 28 * scale;
  const height = 20 * scale;
  const topBandHeight = 5 * scale;
  const badgeSize = 12 * scale;
  const symbol = getUnitCounterSymbol(units);

  return (
    <g pointerEvents="none">
      {isSelected ? (
        <rect
          x={x - width / 2 - 2}
          y={y - height / 2 - 2}
          width={width + 4}
          height={height + 4}
          rx={4 * scale}
          ry={4 * scale}
          fill="none"
          stroke={WAR_MAP_THEME.selectedGlow}
          strokeWidth={2}
          opacity={0.95}
        />
      ) : null}

      <rect
        x={x - width / 2}
        y={y - height / 2}
        width={width}
        height={height}
        rx={3 * scale}
        ry={3 * scale}
        fill={getMutedNationFill(nation)}
        stroke={isSelected ? WAR_MAP_THEME.selectedOutline : WAR_MAP_THEME.stateBorder}
        strokeWidth={isSelected ? 2.4 : 1.8}
      />
      <rect
        x={x - width / 2}
        y={y - height / 2}
        width={width}
        height={topBandHeight}
        rx={3 * scale}
        ry={3 * scale}
        fill={getNationAccentFill(nation)}
        opacity={0.92}
      />
      <text
        x={x}
        y={y + 3 * scale}
        textAnchor="middle"
        fill={WAR_MAP_THEME.counterText}
        fontSize={10 * scale}
        fontWeight="800"
        letterSpacing={symbol.length > 1 ? 0.7 : 0.9}
      >
        {symbol}
      </text>

      {units.length > 1 ? (
        <g>
          <rect
            x={x + width / 2 - badgeSize * 0.8}
            y={y - height / 2 - badgeSize * 0.35}
            width={badgeSize}
            height={badgeSize}
            rx={badgeSize / 2.8}
            ry={badgeSize / 2.8}
            fill={WAR_MAP_THEME.badgeFill}
            stroke={WAR_MAP_THEME.badgeStroke}
            strokeWidth={1.2}
          />
          <text
            x={x + width / 2 - badgeSize * 0.3}
            y={y - height / 2 + badgeSize * 0.45}
            textAnchor="middle"
            fill={WAR_MAP_THEME.badgeText}
            fontSize={7.4 * scale}
            fontWeight="800"
          >
            {units.length}
          </text>
        </g>
      ) : null}
    </g>
  );
}

type ProductionIconProps = {
  x: number;
  y: number;
  scale?: number;
};

export function ProductionIcon({ x, y, scale = 1 }: ProductionIconProps) {
  const baseWidth = 12 * scale;
  const baseHeight = 8 * scale;

  return (
    <g pointerEvents="none">
      <rect
        x={x - baseWidth / 2}
        y={y - baseHeight / 2}
        width={baseWidth}
        height={baseHeight}
        rx={2 * scale}
        ry={2 * scale}
        fill={WAR_MAP_THEME.productionFill}
        stroke={WAR_MAP_THEME.productionAccent}
        strokeWidth={1.4}
      />
      <rect
        x={x + 1 * scale}
        y={y - baseHeight / 2 - 5 * scale}
        width={3.5 * scale}
        height={6 * scale}
        rx={1 * scale}
        ry={1 * scale}
        fill={WAR_MAP_THEME.productionFill}
        stroke={WAR_MAP_THEME.productionAccent}
        strokeWidth={1.2}
      />
      <path
        d={`M ${x - baseWidth / 2 + 2 * scale} ${y + 0.8 * scale} L ${x - 1.5 * scale} ${y - 1.8 * scale} L ${x + 1.5 * scale} ${y + 0.8 * scale} L ${x + baseWidth / 2 - 1.5 * scale} ${y - 2.4 * scale}`}
        fill="none"
        stroke={WAR_MAP_THEME.productionAccent}
        strokeWidth={1.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}
