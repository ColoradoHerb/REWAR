import { randomUUID } from 'node:crypto';
import {
  canProvinceBuildUnitType,
  createAdjacentMovementTiming,
  createGroupedAdjacentMovementTimings,
  createProductionTiming,
  getBuildCostSnapshot,
  hasSufficientResources,
  isAdjacentProvinceMove,
} from '@rewar/rules';
import {
  PROVINCES,
  PROVINCE_EDGES,
  UNIT_TYPES,
  type CommandResponse,
  type GameCommand,
} from '@rewar/shared';
import { prisma } from '../../db/prisma.js';
import { resolveSessionToNow } from '../simulation/index.js';

const unitTypeByCode = new Map(UNIT_TYPES.map((unitType) => [unitType.code, unitType]));

export class CommandExecutionError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'CommandExecutionError';
  }
}

export async function executeGameCommand(
  sessionId: string,
  command: GameCommand,
): Promise<CommandResponse> {
  await resolveSessionToNow(sessionId);

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new CommandExecutionError(404, `Session ${sessionId} was not found.`);
  }

  const availableProvinces = PROVINCES.filter((province) => province.mapId === session.seedWorldId);
  const availableProvinceIds = new Set(availableProvinces.map((province) => province.id));
  const provinceById = new Map(availableProvinces.map((province) => [province.id, province]));

  switch (command.type) {
    case 'MOVE_UNIT':
      return executeMoveUnitCommand(sessionId, session.humanNationId, command, availableProvinceIds);
    case 'MOVE_UNITS':
      return executeMoveUnitsCommand(sessionId, session.humanNationId, command, availableProvinceIds);
    case 'QUEUE_UNIT':
      return executeQueueUnitCommand(sessionId, session.humanNationId, command, provinceById);
    default:
      throw new CommandExecutionError(501, `Command type ${command.type} is not implemented yet.`);
  }
}

async function executeMoveUnitCommand(
  sessionId: string,
  humanNationId: string,
  command: Extract<GameCommand, { type: 'MOVE_UNIT' }>,
  availableProvinceIds: Set<string>,
) {
  if (!availableProvinceIds.has(command.toProvinceId)) {
    throw new CommandExecutionError(400, `Province ${command.toProvinceId} is not part of this session.`);
  }

  const unit = await prisma.unit.findUnique({
    where: { id: command.unitId },
  });

  if (!unit || unit.sessionId !== sessionId) {
    throw new CommandExecutionError(404, `Unit ${command.unitId} was not found in this session.`);
  }

  if (unit.nationId !== humanNationId) {
    throw new CommandExecutionError(403, 'The selected unit does not belong to the active human nation.');
  }

  const activeMovementOrder = await prisma.movementOrder.findFirst({
    where: {
      sessionId,
      unitId: unit.id,
      status: 'active',
    },
  });

  if (unit.status === 'moving' || activeMovementOrder) {
    throw new CommandExecutionError(400, 'The selected unit is already moving.');
  }

  if (
    !isAdjacentProvinceMove(
      unit.provinceId,
      command.toProvinceId,
      PROVINCE_EDGES.filter(
        (edge) => availableProvinceIds.has(edge.fromProvinceId) && availableProvinceIds.has(edge.toProvinceId),
      ),
    )
  ) {
    throw new CommandExecutionError(400, 'Destination province must be adjacent to the selected unit.');
  }

  const issuedAt = new Date();
  const { departsAt, arrivesAt, travelHours } = createAdjacentMovementTiming(issuedAt);

  await prisma.$transaction(async (tx) => {
    await tx.movementOrder.create({
      data: {
        id: randomUUID(),
        sessionId,
        unitId: unit.id,
        nationId: unit.nationId,
        fromProvinceId: unit.provinceId,
        toProvinceId: command.toProvinceId,
        issuedAt,
        departsAt,
        arrivesAt,
        travelHours,
        status: 'active',
      },
    });

    await tx.unit.update({
      where: { id: unit.id },
      data: {
        status: 'moving',
      },
    });
  });

  return { ok: true };
}

function compareUnitsByMovementOrder(
  left: Pick<Awaited<ReturnType<typeof prisma.unit.findMany>>[number], 'createdAt' | 'id'>,
  right: Pick<Awaited<ReturnType<typeof prisma.unit.findMany>>[number], 'createdAt' | 'id'>,
) {
  if (left.createdAt.getTime() !== right.createdAt.getTime()) {
    return left.createdAt.getTime() - right.createdAt.getTime();
  }

  return left.id.localeCompare(right.id);
}

async function executeMoveUnitsCommand(
  sessionId: string,
  humanNationId: string,
  command: Extract<GameCommand, { type: 'MOVE_UNITS' }>,
  availableProvinceIds: Set<string>,
) {
  if (!availableProvinceIds.has(command.toProvinceId)) {
    throw new CommandExecutionError(400, `Province ${command.toProvinceId} is not part of this session.`);
  }

  const distinctUnitIds = Array.from(new Set(command.unitIds));

  if (distinctUnitIds.length === 0) {
    throw new CommandExecutionError(400, 'At least one unit must be selected.');
  }

  if (distinctUnitIds.length !== command.unitIds.length) {
    throw new CommandExecutionError(400, 'Duplicate units cannot be included in the same group move.');
  }

  const units = await prisma.unit.findMany({
    where: {
      id: {
        in: distinctUnitIds,
      },
    },
  });

  if (units.length !== distinctUnitIds.length) {
    throw new CommandExecutionError(404, 'One or more selected units were not found.');
  }

  const movementEdges = PROVINCE_EDGES.filter(
    (edge) => availableProvinceIds.has(edge.fromProvinceId) && availableProvinceIds.has(edge.toProvinceId),
  );

  const sortedUnits = [...units].sort(compareUnitsByMovementOrder);
  const originProvinceId = sortedUnits[0]?.provinceId ?? null;

  if (!originProvinceId) {
    throw new CommandExecutionError(400, 'Selected units must share a valid origin province.');
  }

  if (
    !isAdjacentProvinceMove(
      originProvinceId,
      command.toProvinceId,
      movementEdges,
    )
  ) {
    throw new CommandExecutionError(400, 'Destination province must be adjacent to the selected group.');
  }

  const activeMovementOrders = await prisma.movementOrder.findMany({
    where: {
      sessionId,
      unitId: {
        in: distinctUnitIds,
      },
      status: 'active',
    },
  });
  const activeMovementOrderUnitIds = new Set(activeMovementOrders.map((order) => order.unitId));

  for (const unit of sortedUnits) {
    if (unit.sessionId !== sessionId) {
      throw new CommandExecutionError(404, `Unit ${unit.id} was not found in this session.`);
    }

    if (unit.nationId !== humanNationId) {
      throw new CommandExecutionError(403, 'All selected units must belong to the active human nation.');
    }

    if (unit.status === 'destroyed') {
      throw new CommandExecutionError(400, 'Destroyed units cannot be moved.');
    }

    if (unit.status !== 'idle' || activeMovementOrderUnitIds.has(unit.id)) {
      throw new CommandExecutionError(400, 'All selected units must be idle and not already moving.');
    }

    if (unit.provinceId !== originProvinceId) {
      throw new CommandExecutionError(400, 'All selected units must start in the same province.');
    }
  }

  const issuedAt = new Date();
  const movementTimings = createGroupedAdjacentMovementTimings(issuedAt, sortedUnits.length);

  await prisma.$transaction(async (tx) => {
    for (const [index, unit] of sortedUnits.entries()) {
      const movementTiming = movementTimings[index];

      await tx.movementOrder.create({
        data: {
          id: randomUUID(),
          sessionId,
          unitId: unit.id,
          nationId: unit.nationId,
          fromProvinceId: originProvinceId,
          toProvinceId: command.toProvinceId,
          issuedAt,
          departsAt: movementTiming.departsAt,
          arrivesAt: movementTiming.arrivesAt,
          travelHours: movementTiming.travelHours,
          status: 'active',
        },
      });

      await tx.unit.update({
        where: { id: unit.id },
        data: {
          status: 'moving',
        },
      });
    }
  });

  return { ok: true };
}

async function executeQueueUnitCommand(
  sessionId: string,
  humanNationId: string,
  command: Extract<GameCommand, { type: 'QUEUE_UNIT' }>,
  provinceById: Map<string, (typeof PROVINCES)[number]>,
) {
  const province = provinceById.get(command.provinceId);

  if (!province) {
    throw new CommandExecutionError(400, `Province ${command.provinceId} is not part of this session.`);
  }

  if (!canProvinceBuildUnitType(province, command.unitTypeCode)) {
    throw new CommandExecutionError(400, `${province.name} cannot build ${command.unitTypeCode}.`);
  }

  const unitType = unitTypeByCode.get(command.unitTypeCode);

  if (!unitType) {
    throw new CommandExecutionError(400, `Unit type ${command.unitTypeCode} is not configured.`);
  }

  const now = new Date();
  const costSnapshot = getBuildCostSnapshot(unitType);
  const { queuedAt, startedAt, completesAt } = createProductionTiming(now, unitType.buildTimeSeconds);

  await prisma.$transaction(async (tx) => {
    const provinceState = await tx.provinceState.findUnique({
      where: {
        sessionId_provinceId: {
          sessionId,
          provinceId: province.id,
        },
      },
    });

    if (!provinceState || provinceState.ownerNationId !== humanNationId) {
      throw new CommandExecutionError(403, 'Only owned production centers can queue units.');
    }

    const activeQueue = await tx.productionQueue.findFirst({
      where: {
        sessionId,
        provinceId: province.id,
        status: 'building',
      },
    });

    if (activeQueue) {
      throw new CommandExecutionError(400, `${province.name} already has an active production item.`);
    }

    const balances = await tx.nationResourceBalance.findMany({
      where: {
        sessionId,
        nationId: humanNationId,
      },
    });
    const balancesByResourceCode = new Map(
      balances.map((balance) => [balance.resourceCode, balance.amount]),
    );

    if (!hasSufficientResources(balancesByResourceCode, costSnapshot)) {
      throw new CommandExecutionError(400, 'Not enough resources to queue this unit.');
    }

    for (const [resourceCode, amount] of Object.entries(costSnapshot)) {
      if (typeof amount !== 'number' || amount <= 0) {
        continue;
      }

      await tx.nationResourceBalance.update({
        where: {
          sessionId_nationId_resourceCode: {
            sessionId,
            nationId: humanNationId,
            resourceCode,
          },
        },
        data: {
          amount: {
            decrement: amount,
          },
        },
      });
    }

    await tx.productionQueue.create({
      data: {
        id: randomUUID(),
        sessionId,
        nationId: humanNationId,
        provinceId: province.id,
        unitTypeCode: command.unitTypeCode,
        status: 'building',
        queuedAt,
        startedAt,
        completesAt,
        costSnapshotJson: JSON.stringify(costSnapshot),
      },
    });
  });

  return { ok: true };
}
