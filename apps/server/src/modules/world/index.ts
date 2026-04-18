import {
  PROVINCES,
  PROVINCE_EDGES,
  RESOURCES,
  UNIT_TYPES,
  type MovementOrder,
  type ProductionQueue,
  type WorldState,
} from '@rewar/shared';
import { prisma } from '../../db/prisma.js';
import { resolveSessionToNow } from '../simulation/index.js';

function toIsoString(value: Date) {
  return value.toISOString();
}

function parseCostSnapshot(costSnapshotJson: string): ProductionQueue['costSnapshot'] {
  try {
    return JSON.parse(costSnapshotJson) as ProductionQueue['costSnapshot'];
  } catch {
    return {};
  }
}

export async function getWorldState(sessionId: string): Promise<WorldState | null> {
  await resolveSessionToNow(sessionId);

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      nations: {
        orderBy: { name: 'asc' },
      },
      provinceStates: {
        orderBy: { provinceId: 'asc' },
      },
      resourceBalances: {
        orderBy: [{ nationId: 'asc' }, { resourceCode: 'asc' }],
      },
      units: {
        orderBy: [{ provinceId: 'asc' }, { nationId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      },
      productionQueues: {
        orderBy: { queuedAt: 'asc' },
      },
      movementOrders: {
        orderBy: { issuedAt: 'asc' },
      },
    },
  });

  if (!session) {
    return null;
  }

  const provinces = PROVINCES.filter((province) => province.mapId === session.seedWorldId);
  const provinceIds = new Set(provinces.map((province) => province.id));

  const productionQueues: ProductionQueue[] = session.productionQueues.map((queue) => ({
    id: queue.id,
    sessionId: queue.sessionId,
    nationId: queue.nationId,
    provinceId: queue.provinceId,
    unitTypeCode: queue.unitTypeCode,
    status: queue.status,
    queuedAt: toIsoString(queue.queuedAt),
    startedAt: toIsoString(queue.startedAt),
    completesAt: toIsoString(queue.completesAt),
    costSnapshot: parseCostSnapshot(queue.costSnapshotJson),
  }));

  const movementOrders: MovementOrder[] = session.movementOrders.map((order) => ({
    id: order.id,
    sessionId: order.sessionId,
    unitId: order.unitId,
    nationId: order.nationId,
    fromProvinceId: order.fromProvinceId,
    toProvinceId: order.toProvinceId,
    issuedAt: toIsoString(order.issuedAt),
    departsAt: toIsoString(order.departsAt),
    arrivesAt: toIsoString(order.arrivesAt),
    travelHours: order.travelHours,
    status: order.status,
  }));

  return {
    serverTime: new Date().toISOString(),
    session: {
      id: session.id,
      name: session.name,
      seedWorldId: session.seedWorldId,
      status: session.status,
      humanNationId: session.humanNationId,
      startedAt: toIsoString(session.startedAt),
      lastResolvedAt: toIsoString(session.lastResolvedAt),
      timeScale: session.timeScale,
      winnerNationId: session.winnerNationId,
    },
    nations: session.nations.map((nation) => ({
      id: nation.id,
      sessionId: nation.sessionId,
      name: nation.name,
      colorHex: nation.colorHex,
      controllerType: nation.controllerType,
      capitalProvinceId: nation.capitalProvinceId,
      isDefeated: nation.isDefeated,
    })),
    provinces,
    provinceStates: session.provinceStates.map((provinceState) => ({
      sessionId: provinceState.sessionId,
      provinceId: provinceState.provinceId,
      ownerNationId: provinceState.ownerNationId,
      capturedAt: toIsoString(provinceState.capturedAt),
    })),
    edges: PROVINCE_EDGES.filter(
      (edge) => provinceIds.has(edge.fromProvinceId) && provinceIds.has(edge.toProvinceId),
    ),
    resources: RESOURCES,
    balances: session.resourceBalances.map((balance) => ({
      sessionId: balance.sessionId,
      nationId: balance.nationId,
      resourceCode: balance.resourceCode,
      amount: balance.amount,
      lastSyncedAt: toIsoString(balance.lastSyncedAt),
    })),
    unitTypes: UNIT_TYPES,
    units: session.units.map((unit) => ({
      id: unit.id,
      sessionId: unit.sessionId,
      nationId: unit.nationId,
      unitTypeCode: unit.unitTypeCode,
      provinceId: unit.provinceId,
      currentStrength: unit.currentStrength,
      status: unit.status,
      createdAt: toIsoString(unit.createdAt),
    })),
    productionQueues,
    movementOrders,
  };
}
