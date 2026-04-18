import { fileURLToPath } from 'node:url';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { STARTER_PROVINCES } from '../packages/shared/src/content/provinces';
import { RESOURCES } from '../packages/shared/src/content/resources';

const adapter = new PrismaBetterSqlite3({
  url: `file:${fileURLToPath(new URL('../dev.db', import.meta.url))}`,
});

const prisma = new PrismaClient({ adapter });

const sessionId = 'starter-session';
const solmereNationId = 'nation-solmere';
const varkeshNationId = 'nation-varkesh';
const startedAt = new Date();

async function main() {
  await prisma.movementOrder.deleteMany();
  await prisma.productionQueue.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.nationResourceBalance.deleteMany();
  await prisma.provinceState.deleteMany();
  await prisma.nation.deleteMany();
  await prisma.gameSession.deleteMany();

  await prisma.gameSession.create({
    data: {
      id: sessionId,
      name: 'Starter Session',
      seedWorldId: 'starter-12',
      status: 'active',
      humanNationId: solmereNationId,
      startedAt,
      lastResolvedAt: startedAt,
      timeScale: 1,
    },
  });

  await prisma.nation.createMany({
    data: [
      {
        id: solmereNationId,
        sessionId,
        name: 'Solmere League',
        colorHex: '#2563eb',
        controllerType: 'human',
        capitalProvinceId: 'riverbend',
        isDefeated: false,
      },
      {
        id: varkeshNationId,
        sessionId,
        name: 'Varkesh Front',
        colorHex: '#dc2626',
        controllerType: 'ai',
        capitalProvinceId: 'northhold',
        isDefeated: false,
      },
    ],
  });

  const solmereProvinces = new Set([
    'north-fen',
    'riverbend',
    'ironcrest',
    'stonegate',
    'mossplain',
    'cold-quarry',
  ]);

  await prisma.provinceState.createMany({
    data: STARTER_PROVINCES.map((province) => ({
      sessionId,
      provinceId: province.id,
      ownerNationId: solmereProvinces.has(province.id) ? solmereNationId : varkeshNationId,
      capturedAt: startedAt,
    })),
  });

  await prisma.nationResourceBalance.createMany({
    data: [
      ...RESOURCES.map((resource) => ({
        sessionId,
        nationId: solmereNationId,
        resourceCode: resource.code,
        amount: resource.code === 'food' ? 20 : resource.code === 'metal' ? 16 : 8,
        lastSyncedAt: startedAt,
      })),
      ...RESOURCES.map((resource) => ({
        sessionId,
        nationId: varkeshNationId,
        resourceCode: resource.code,
        amount: resource.code === 'food' ? 20 : resource.code === 'metal' ? 16 : 8,
        lastSyncedAt: startedAt,
      })),
    ],
  });

  await prisma.unit.createMany({
    data: [
      {
        id: 'unit-solmere-riverbend-infantry',
        sessionId,
        nationId: solmereNationId,
        unitTypeCode: 'infantry',
        provinceId: 'riverbend',
        currentStrength: 10,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'unit-solmere-ironcrest-infantry',
        sessionId,
        nationId: solmereNationId,
        unitTypeCode: 'infantry',
        provinceId: 'ironcrest',
        currentStrength: 10,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'unit-solmere-stonegate-artillery',
        sessionId,
        nationId: solmereNationId,
        unitTypeCode: 'artillery',
        provinceId: 'stonegate',
        currentStrength: 8,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'unit-solmere-coldquarry-armor',
        sessionId,
        nationId: solmereNationId,
        unitTypeCode: 'armor',
        provinceId: 'cold-quarry',
        currentStrength: 12,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'unit-varkesh-northhold-infantry',
        sessionId,
        nationId: varkeshNationId,
        unitTypeCode: 'infantry',
        provinceId: 'northhold',
        currentStrength: 10,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'unit-varkesh-duskfield-infantry',
        sessionId,
        nationId: varkeshNationId,
        unitTypeCode: 'infantry',
        provinceId: 'duskfield',
        currentStrength: 10,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'unit-varkesh-emberplain-artillery',
        sessionId,
        nationId: varkeshNationId,
        unitTypeCode: 'artillery',
        provinceId: 'emberplain',
        currentStrength: 8,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'unit-varkesh-redmesa-armor',
        sessionId,
        nationId: varkeshNationId,
        unitTypeCode: 'armor',
        provinceId: 'red-mesa',
        currentStrength: 12,
        status: 'idle',
        createdAt: startedAt,
      },
    ],
  });

  console.log('REWAR starter session seeded.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
