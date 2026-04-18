import { randomUUID } from 'node:crypto';
import { resolveCombat } from '@rewar/rules';
import { UNIT_TYPES } from '@rewar/shared';
import { prisma } from '../../db/prisma.js';

const unitTypeByCode = new Map(UNIT_TYPES.map((unitType) => [unitType.code, unitType]));

export async function resolveSessionToNow(sessionId: string) {
  const now = new Date();
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

      const attacker = await tx.unit.findUnique({
        where: { id: order.unitId },
      });

      if (!attacker || attacker.status === 'destroyed') {
        await tx.movementOrder.update({
          where: { id: order.id },
          data: { status: 'cancelled' },
        });
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

        await tx.provinceState.upsert({
          where: {
            sessionId_provinceId: {
              sessionId: order.sessionId,
              provinceId: order.toProvinceId,
            },
          },
          update: {
            ownerNationId: order.nationId,
            capturedAt: now,
          },
          create: {
            sessionId: order.sessionId,
            provinceId: order.toProvinceId,
            ownerNationId: order.nationId,
            capturedAt: now,
          },
        });

        await tx.movementOrder.update({
          where: { id: order.id },
          data: { status: 'arrived' },
        });

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

        await tx.provinceState.upsert({
          where: {
            sessionId_provinceId: {
              sessionId: order.sessionId,
              provinceId: order.toProvinceId,
            },
          },
          update: {
            ownerNationId: order.nationId,
            capturedAt: now,
          },
          create: {
            sessionId: order.sessionId,
            provinceId: order.toProvinceId,
            ownerNationId: order.nationId,
            capturedAt: now,
          },
        });
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
    });
  }

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
    });
  }

  if (dueOrders.length > 0 || dueProductionQueues.length > 0) {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        lastResolvedAt: now,
      },
    });
  }
}
