import type { Province, ResourceAmountMap, TerrainType, UnitTypeCode } from '../types/game';
import { STARTER_WORLD_ID, US48_WORLD_ID } from '../constants';
import { US48_STATE_LAYOUT } from './us48StateLayout';

const US48_URBAN_STATES = new Set(['ca', 'wa', 'tx', 'il', 'pa', 'ga', 'ny', 'fl', 'nj', 'ma', 'oh']);
const US48_HILLS_STATES = new Set(['az', 'co', 'id', 'mt', 'nv', 'nm', 'ut', 'wy', 'wv', 'vt', 'nh', 'me', 'ky', 'tn', 'va']);
const US48_FOOD_RICH_STATES = new Set(['ca', 'tx', 'fl', 'wa', 'or', 'nc', 'ga', 'ia', 'ne', 'ks', 'mn', 'wi', 'il', 'mo', 'ar', 'la']);
const US48_METAL_HEAVY_STATES = new Set(['pa', 'oh', 'mi', 'il']);
const US48_METAL_STATES = new Set(['in', 'wi', 'mn', 'mo', 'co', 'az', 'ut', 'nv', 'wv', 'ma', 'ny', 'nj', 'ct', 'ri', 'de', 'md']);
const US48_FUEL_HEAVY_STATES = new Set(['tx', 'ok', 'la']);
const US48_FUEL_STATES = new Set(['nm', 'nd', 'wy', 'ca', 'pa', 'co']);
const US48_BUILDABLE_UNIT_TYPES_BY_STATE: Partial<Record<string, UnitTypeCode[]>> = {
  ca: ['infantry', 'artillery', 'armor'],
  wa: ['infantry', 'artillery'],
  co: ['infantry', 'artillery'],
  tx: ['infantry', 'artillery', 'armor'],
  il: ['infantry', 'artillery', 'armor'],
  pa: ['infantry', 'artillery', 'armor'],
  ga: ['infantry', 'artillery'],
  ny: ['infantry', 'artillery'],
};

function getUS48TerrainType(code: string): TerrainType {
  if (US48_URBAN_STATES.has(code)) {
    return 'urban';
  }

  if (US48_HILLS_STATES.has(code)) {
    return 'hills';
  }

  return 'plains';
}

function getUS48BuildableUnitTypes(code: string): UnitTypeCode[] {
  return US48_BUILDABLE_UNIT_TYPES_BY_STATE[code] ?? [];
}

function getUS48BaseYield(code: string): ResourceAmountMap {
  const baseYield: ResourceAmountMap = {
    food: US48_FOOD_RICH_STATES.has(code) ? 2 : 1,
  };

  if (US48_METAL_HEAVY_STATES.has(code)) {
    baseYield.metal = 2;
  } else if (US48_METAL_STATES.has(code)) {
    baseYield.metal = 1;
  }

  if (US48_FUEL_HEAVY_STATES.has(code)) {
    baseYield.fuel = 2;
  } else if (US48_FUEL_STATES.has(code)) {
    baseYield.fuel = 1;
  }

  return baseYield;
}

export const STARTER_PROVINCES: Province[] = [
  {
    id: 'north-fen',
    mapId: STARTER_WORLD_ID,
    name: 'North Fen',
    shapeKey: 'north-fen',
    centroidX: 90,
    centroidY: 75,
    terrainType: 'plains',
    isProductionCenter: false,
    buildableUnitTypes: [],
    baseYield: { food: 4 },
  },
  {
    id: 'riverbend',
    mapId: STARTER_WORLD_ID,
    name: 'Riverbend',
    shapeKey: 'riverbend',
    centroidX: 240,
    centroidY: 75,
    terrainType: 'urban',
    isProductionCenter: true,
    buildableUnitTypes: ['infantry', 'artillery'],
    baseYield: { food: 5 },
  },
  {
    id: 'duskfield',
    mapId: STARTER_WORLD_ID,
    name: 'Duskfield',
    shapeKey: 'duskfield',
    centroidX: 400,
    centroidY: 75,
    terrainType: 'plains',
    isProductionCenter: false,
    buildableUnitTypes: [],
    baseYield: { food: 4 },
  },
  {
    id: 'blackharbor',
    mapId: STARTER_WORLD_ID,
    name: 'Blackharbor',
    shapeKey: 'blackharbor',
    centroidX: 550,
    centroidY: 75,
    terrainType: 'urban',
    isProductionCenter: false,
    buildableUnitTypes: [],
    baseYield: { metal: 4 },
  },
  {
    id: 'ironcrest',
    mapId: STARTER_WORLD_ID,
    name: 'Ironcrest',
    shapeKey: 'ironcrest',
    centroidX: 90,
    centroidY: 205,
    terrainType: 'hills',
    isProductionCenter: false,
    buildableUnitTypes: [],
    baseYield: { metal: 4 },
  },
  {
    id: 'stonegate',
    mapId: STARTER_WORLD_ID,
    name: 'Stonegate',
    shapeKey: 'stonegate',
    centroidX: 240,
    centroidY: 205,
    terrainType: 'urban',
    isProductionCenter: true,
    buildableUnitTypes: ['infantry', 'artillery', 'armor'],
    baseYield: { fuel: 3 },
  },
  {
    id: 'emberplain',
    mapId: STARTER_WORLD_ID,
    name: 'Emberplain',
    shapeKey: 'emberplain',
    centroidX: 400,
    centroidY: 205,
    terrainType: 'urban',
    isProductionCenter: true,
    buildableUnitTypes: ['infantry', 'artillery', 'armor'],
    baseYield: { fuel: 3 },
  },
  {
    id: 'northhold',
    mapId: STARTER_WORLD_ID,
    name: 'Northhold',
    shapeKey: 'northhold',
    centroidX: 550,
    centroidY: 205,
    terrainType: 'urban',
    isProductionCenter: true,
    buildableUnitTypes: ['infantry', 'artillery'],
    baseYield: { food: 5 },
  },
  {
    id: 'mossplain',
    mapId: STARTER_WORLD_ID,
    name: 'Mossplain',
    shapeKey: 'mossplain',
    centroidX: 90,
    centroidY: 345,
    terrainType: 'plains',
    isProductionCenter: false,
    buildableUnitTypes: [],
    baseYield: { food: 4 },
  },
  {
    id: 'cold-quarry',
    mapId: STARTER_WORLD_ID,
    name: 'Cold Quarry',
    shapeKey: 'cold-quarry',
    centroidX: 240,
    centroidY: 345,
    terrainType: 'hills',
    isProductionCenter: false,
    buildableUnitTypes: [],
    baseYield: { metal: 4 },
  },
  {
    id: 'red-mesa',
    mapId: STARTER_WORLD_ID,
    name: 'Red Mesa',
    shapeKey: 'red-mesa',
    centroidX: 400,
    centroidY: 345,
    terrainType: 'hills',
    isProductionCenter: false,
    buildableUnitTypes: [],
    baseYield: { metal: 4 },
  },
  {
    id: 'sunport',
    mapId: STARTER_WORLD_ID,
    name: 'Sunport',
    shapeKey: 'sunport',
    centroidX: 550,
    centroidY: 345,
    terrainType: 'plains',
    isProductionCenter: false,
    buildableUnitTypes: [],
    baseYield: { food: 4 },
  },
];

export const US48_V1_PROVINCES: Province[] = US48_STATE_LAYOUT.map((state) => {
  const buildableUnitTypes = getUS48BuildableUnitTypes(state.code);

  return {
    id: `us-${state.code}`,
    mapId: US48_WORLD_ID,
    name: state.name,
    labelShort: state.labelShort,
    shapeKey: `us-${state.code}`,
    centroidX: state.centroidX,
    centroidY: state.centroidY,
    labelX: state.labelX,
    labelY: state.labelY,
    terrainType: getUS48TerrainType(state.code),
    isProductionCenter: buildableUnitTypes.length > 0,
    buildableUnitTypes,
    baseYield: getUS48BaseYield(state.code),
  };
});

export const PROVINCES: Province[] = [...STARTER_PROVINCES, ...US48_V1_PROVINCES];
