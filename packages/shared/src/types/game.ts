export type Id = string;
export type ISODateTime = string;

export type SessionStatus = 'active' | 'paused' | 'finished';
export type ControllerType = 'human' | 'ai';
export type ResourceCode = 'food' | 'metal' | 'fuel';
export type UnitTypeCode = 'infantry' | 'artillery' | 'armor';
export type TerrainType = 'plains' | 'hills' | 'mountains' | 'forest';
export type UnitStatus = 'idle' | 'moving' | 'destroyed';
export type QueueStatus = 'queued' | 'building' | 'completed' | 'cancelled';
export type MovementOrderStatus = 'active' | 'arrived' | 'cancelled';

export type ResourceAmountMap = Partial<Record<ResourceCode, number>>;

export interface GameSession {
  id: Id;
  name: string;
  seedWorldId: string;
  status: SessionStatus;
  humanNationId: Id;
  startedAt: ISODateTime;
  lastResolvedAt: ISODateTime;
  timeScale: number;
  winnerNationId?: Id | null;
}

export interface Nation {
  id: Id;
  sessionId: Id;
  name: string;
  colorHex: string;
  controllerType: ControllerType;
  capitalProvinceId: Id;
  isDefeated: boolean;
}

export interface Province {
  id: Id;
  mapId: string;
  name: string;
  labelShort?: string;
  shapeKey: string;
  centroidX: number;
  centroidY: number;
  labelX?: number;
  labelY?: number;
  terrainType: TerrainType;
  isProductionCenter: boolean;
  buildableUnitTypes: UnitTypeCode[];
  baseYield: ResourceAmountMap;
}

export interface ProvinceState {
  sessionId: Id;
  provinceId: Id;
  ownerNationId: Id;
  capturedAt: ISODateTime;
}

export interface ProvinceEdge {
  fromProvinceId: Id;
  toProvinceId: Id;
  distance: number;
}

export interface Resource {
  code: ResourceCode;
  name: string;
  colorHex: string;
}

export interface NationResourceBalance {
  sessionId: Id;
  nationId: Id;
  resourceCode: ResourceCode;
  amount: number;
  lastSyncedAt: ISODateTime;
}

export interface UnitType {
  code: UnitTypeCode;
  name: string;
  attack: number;
  defense: number;
  maxStrength: number;
  hoursPerDistance: number;
  buildTimeSeconds: number;
  cost: ResourceAmountMap;
}

export interface Unit {
  id: Id;
  sessionId: Id;
  nationId: Id;
  unitTypeCode: UnitTypeCode;
  provinceId: Id;
  currentStrength: number;
  status: UnitStatus;
  createdAt: ISODateTime;
}

export interface ProductionQueue {
  id: Id;
  sessionId: Id;
  nationId: Id;
  provinceId: Id;
  unitTypeCode: UnitTypeCode;
  status: QueueStatus;
  queuedAt: ISODateTime;
  startedAt: ISODateTime;
  completesAt: ISODateTime;
  costSnapshot: ResourceAmountMap;
}

export interface MovementOrder {
  id: Id;
  sessionId: Id;
  unitId: Id;
  nationId: Id;
  fromProvinceId: Id;
  toProvinceId: Id;
  issuedAt: ISODateTime;
  departsAt: ISODateTime;
  arrivesAt: ISODateTime;
  travelHours: number;
  status: MovementOrderStatus;
}

export interface WorldState {
  serverTime: ISODateTime;
  session: GameSession;
  nations: Nation[];
  provinces: Province[];
  provinceStates: ProvinceState[];
  edges: ProvinceEdge[];
  resources: Resource[];
  balances: NationResourceBalance[];
  unitTypes: UnitType[];
  units: Unit[];
  productionQueues: ProductionQueue[];
  movementOrders: MovementOrder[];
}
