import type { ProvinceEdge } from '@rewar/shared';

export const ADJACENT_TRAVEL_TIME_MS = 5_000;
export const GROUP_MOVEMENT_ARRIVAL_STAGGER_MS = 1;

export function isAdjacentProvinceMove(
  fromProvinceId: string,
  toProvinceId: string,
  edges: ProvinceEdge[],
) {
  return edges.some(
    (edge) => edge.fromProvinceId === fromProvinceId && edge.toProvinceId === toProvinceId,
  );
}

export function createAdjacentMovementTiming(
  issuedAt: Date,
  travelTimeMs: number = ADJACENT_TRAVEL_TIME_MS,
) {
  return {
    departsAt: new Date(issuedAt),
    arrivesAt: new Date(issuedAt.getTime() + travelTimeMs),
    travelHours: travelTimeMs / 3_600_000,
  };
}

export function createGroupedAdjacentMovementTimings(
  issuedAt: Date,
  unitCount: number,
  travelTimeMs: number = ADJACENT_TRAVEL_TIME_MS,
  staggerMs: number = GROUP_MOVEMENT_ARRIVAL_STAGGER_MS,
) {
  return Array.from({ length: unitCount }, (_, index) =>
    createAdjacentMovementTiming(issuedAt, travelTimeMs + index * staggerMs),
  );
}
