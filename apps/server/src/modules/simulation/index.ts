import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import {
  calculateAccruedResources,
  createIncomeRateByNation,
  getYieldResourceCodes,
  resolveCombat,
} from '@rewar/rules';
import { PROVINCES, UNIT_TYPES } from '@rewar/shared';
import { prisma } from '../../db/prisma.js';

const unitTypeByCode = new Map(UNIT_TYPES.map((unitType) => [unitType.code, unitType]));

async function accrueEconomyTo(
  tx: Prisma.TransactionClient,
  sessionId: string,
  targetTime: Date,
  provinces: typeof PROVINCES,
) {
  const [provinceStates, balances] = await Promise.all([
    tx.provinceState.findMany({
      where: { sessionId },
    }),
    tx.nationResourceBalance.findMany({
      where: { sessionId },
    }),
  ]);

  if (balances.length === 0) {
    return false;
  }

  const incomeRateByNation = createIncomeRateByNation(provinces, provinceStates);
  let economyChanged = false;

  for (const balance of balances) {
    const elapsedMs = targetTime.getTime() - balance.lastSyncedAt.getTime();

    if (elapsedMs <= 0) {
      continue;
    }

    const ratePerMinute = incomeRateByNation.get(balance.nationId)?.get(balance.resourceCode) ?? 0;
    const { earned, consumedMs } = calculateAccruedResources(ratePerMinute, elapsedMs);

    if (earned <= 0 || consumedMs <= 0) {
      continue;
    }

    economyChanged = true;

    await tx.nationResourceBalance.update({
      where: {
        sessionId_nationId_resourceCode: {
          sessionId: balance.sessionId,
          nationId: balance.nationId,
          resourceCode: balance.resourceCode,
        },
      },
      data: {
        amount: {
          increment: earned,
        },
        lastSyncedAt: new Date(balance.lastSyncedAt.getTime() + consumedMs),
      },
    });
  }

  return economyChanged;
}

async function resetEconomyBaselinesForCapture(
  tx: Prisma.TransactionClient,
  sessionId: string,
  captureTime: Date,
  province: (typeof PROVINCES)[number],
  previousOwnerNationId: string | null,
  nextOwnerNationId: string,
) {
  const resourceCodes = getYieldResourceCodes(province.baseYield);
  const affectedNationIds = new Set(
    [previousOwnerNationId, nextOwnerNationId].filter((nationId): nationId is string => Boolean(nationId)),
  );

  for (const nationId of affectedNationIds) {
    for (const resourceCode of resourceCodes) {
      await tx.nationResourceBalance.updateMany({
        where: {
          sessionId,
          nationId,
          resourceCode,
        },
        data: {
          lastSyncedAt: captureTime,
        },
      });
    }
  }
}

async function captureProvinceIfNeeded(
  tx: Prisma.TransactionClient,
  sessionId: string,
  provinceId: string,
  nextOwnerNationId: string,
  captureTime: Date,
  provinceById: Map<string, (typeof PROVINCES)[number]>,
) {
  const province = provinceById.get(provinceId);

  if (!province) {
    return false;
  }

  const currentProvinceState = await tx.provinceState.findUnique({
    where: {
      sessionId_provinceId: {
        sessionId,
        provinceId,
      },
    },
  });

  if (currentProvinceState?.ownerNationId === nextOwnerNationId) {
    return false;
  }

  await tx.provinceState.upsert({
    where: {
      sessionId_provinceId: {
        sessionId,
        provinceId,
      },
    },
    update: {
      ownerNationId: nextOwnerNationId,
      capturedAt: captureTime,
    },
    create: {
      sessionId,
      provinceId,
      ownerNationId: nextOwnerNationId,
      capturedAt: captureTime,
    },
  });

  await resetEconomyBaselinesForCapture(
    tx,
    sessionId,
    captureTime,
    province,
    currentProvinceState?.ownerNationId ?? null,
    nextOwnerNationId,
  );

  return true;
}

export async function resolveSessionToNow(sessionId: string) {
  const now = new Date();
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      seedWorldId: true,
    },
  });

  if (!session) {
    return;
  }

  const provinces = PROVINCES.filter((province) => province.mapId === session.seedWorldId);
  const provinceById = new Map(provinces.map((province) => [province.id, province]));
  let stateChanged = false;

  const dueOrders = await prisma.movementOrder.findMany({
    where: {
      sessionId,
      status: 'active',
      arrivesAt: {
        lte: now,
      },
    },
    orderBy: [{ arrivesAt: 'asc' }, { issuedAt: 'asc' }],
  });

  for (const dueOrder of dueOrders) {
    await prisma.$transaction(async (tx) => {
      const order = await tx.movementOrder.findUnique({
        where: { id: dueOrder.id },
      });

      if (!order || order.status !== 'active' || order.arrivesAt > now) {
        return;
      }

      const resolutionTime = order.arrivesAt;
      const economyChanged = await accrueEconomyTo(tx, sessionId, resolutionTime, provinces);
      stateChanged = stateChanged || economyChanged;

      const attacker = await tx.unit.findUnique({
        where: { id: order.unitId },
      });

      if (!attacker || attacker.status === 'destroyed') {
        await tx.movementOrder.update({
          where: { id: order.id },
          data: { status: 'cancelled' },
        });
        stateChanged = true;
        return;
      }

      const attackerUnitType = unitTypeByCode.get(attacker.unitTypeCode);

      if (!attackerUnitType) {
        throw new Error(`Unit type ${attacker.unitTypeCode} is not configured.`);
      }

      const defender = await tx.unit.findFirst({
        where: {
          sessionId: order.sessionId,
          provinceId: order.toProvinceId,
          nationId: {
            not: order.nationId,
          },
          status: {
            not: 'destroyed',
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });

      if (!defender) {
        await tx.unit.update({
          where: { id: attacker.id },
          data: {
            provinceId: order.toProvinceId,
            status: 'idle',
          },
        });

        await captureProvinceIfNeeded(
          tx,
          sessionId,
          order.toProvinceId,
          order.nationId,
          resolutionTime,
          provinceById,
        );

        await tx.movementOrder.update({
          where: { id: order.id },
          data: { status: 'arrived' },
        });

        stateChanged = true;
        return;
      }

      const defenderUnitType = unitTypeByCode.get(defender.unitTypeCode);

      if (!defenderUnitType) {
        throw new Error(`Unit type ${defender.unitTypeCode} is not configured.`);
      }

      const combatResult = resolveCombat(attacker, defender, attackerUnitType, defenderUnitType);

      if (combatResult.winner === 'attacker') {
        await tx.unit.update({
          where: { id: defender.id },
          data: {
            status: 'destroyed',
            currentStrength: 0,
          },
        });

        await tx.unit.update({
          where: { id: attacker.id },
          data: {
            provinceId: order.toProvinceId,
            status: 'idle',
            currentStrength: combatResult.survivingStrength,
          },
        });

        await captureProvinceIfNeeded(
          tx,
          sessionId,
          order.toProvinceId,
          order.nationId,
          resolutionTime,
          provinceById,
        );
      } else {
        await tx.unit.update({
          where: { id: attacker.id },
          data: {
            status: 'destroyed',
            currentStrength: 0,
          },
        });

        await tx.unit.update({
          where: { id: defender.id },
          data: {
            currentStrength: combatResult.survivingStrength,
          },
        });
      }

      await tx.movementOrder.update({
        where: { id: order.id },
        data: { status: 'arrived' },
      });

      stateChanged = true;
    });
  }

  const economyChangedAtNow = await prisma.$transaction(async (tx) => {
    return accrueEconomyTo(tx, sessionId, now, provinces);
  });
  stateChanged = stateChanged || economyChangedAtNow;

  const dueProductionQueues = await prisma.productionQueue.findMany({
    where: {
      sessionId,
      status: 'building',
      completesAt: {
        lte: now,
      },
    },
    orderBy: [{ completesAt: 'asc' }, { startedAt: 'asc' }],
  });

  for (const dueQueue of dueProductionQueues) {
    await prisma.$transaction(async (tx) => {
      const queue = await tx.productionQueue.findUnique({
        where: { id: dueQueue.id },
      });

      if (!queue || queue.status !== 'building' || queue.completesAt > now) {
        return;
      }

      const provinceState = await tx.provinceState.findUnique({
        where: {
          sessionId_provinceId: {
            sessionId: queue.sessionId,
            provinceId: queue.provinceId,
          },
        },
      });

      if (!provinceState || provinceState.ownerNationId !== queue.nationId) {
        await tx.productionQueue.update({
          where: { id: queue.id },
          data: {
            status: 'cancelled',
          },
        });
        stateChanged = true;
        return;
      }

      const unitType = unitTypeByCode.get(queue.unitTypeCode);

      if (!unitType) {
        throw new Error(`Unit type ${queue.unitTypeCode} is not configured.`);
      }

      await tx.unit.create({
        data: {
          id: randomUUID(),
          sessionId: queue.sessionId,
          nationId: queue.nationId,
          unitTypeCode: queue.unitTypeCode,
          provinceId: queue.provinceId,
          currentStrength: unitType.maxStrength,
          status: 'idle',
          createdAt: now,
        },
      });

      await tx.productionQueue.update({
        where: { id: queue.id },
        data: {
          status: 'completed',
        },
      });

      stateChanged = true;
    });
  }

  if (stateChanged) {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        lastResolvedAt: now,
      },
    });
  }
}
