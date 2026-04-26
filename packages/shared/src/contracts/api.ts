import type { Id, UnitTypeCode, WorldState } from '../types/game';

export interface CreateSessionResponse {
  sessionId: Id;
}

export interface CreateSessionRequest {
  seedWorldId: string;
  replaceSessionId?: Id;
}

export interface WorldStateResponse {
  worldState: WorldState;
}

export type MoveUnitCommand = {
  type: 'MOVE_UNIT';
  unitId: Id;
  toProvinceId: Id;
};

export type MoveUnitsCommand = {
  type: 'MOVE_UNITS';
  unitIds: Id[];
  toProvinceId: Id;
};

export type QueueUnitCommand = {
  type: 'QUEUE_UNIT';
  provinceId: Id;
  unitTypeCode: UnitTypeCode;
};

export type CancelProductionCommand = {
  type: 'CANCEL_PRODUCTION';
  queueId: Id;
};

export type GameCommand =
  | MoveUnitCommand
  | MoveUnitsCommand
  | QueueUnitCommand
  | CancelProductionCommand;

export interface CommandResponse {
  ok: boolean;
}
