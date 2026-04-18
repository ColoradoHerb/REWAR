import type { ProvinceEdge } from '@rewar/shared';

export const ADJACENT_TRAVEL_TIME_MS = 5_000;

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
