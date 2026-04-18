import { fileURLToPath } from 'node:url';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import {
  RESOURCES,
  STARTER_PROVINCES,
  STARTER_WORLD_ID,
  US48_V1_PROVINCES,
  US48_WORLD_ID,
} from '../packages/shared/src';

const adapter = new PrismaBetterSqlite3({
  url: `file:${fileURLToPath(new URL('../dev.db', import.meta.url))}`,
});

const prisma = new PrismaClient({ adapter });

const startedAt = new Date();

const STARTER_SESSION_ID = 'starter-session';
const STARTER_HUMAN_NATION_ID = 'nation-solmere';
const STARTER_AI_NATION_ID = 'nation-varkesh';

const US48_SESSION_ID = 'us48-session';
const US48_HUMAN_NATION_ID = 'us-nation-pacific';
const US48_AI_NATION_ID = 'us-nation-atlantic';

function createInitialBalances(sessionId: string, nationId: string, food: number, metal: number, fuel: number) {
  return RESOURCES.map((resource) => ({
    sessionId,
    nationId,
    resourceCode: resource.code,
    amount: resource.code === 'food' ? food : resource.code === 'metal' ? metal : fuel,
    lastSyncedAt: startedAt,
  }));
}

async function seedStarterSession() {
  await prisma.gameSession.create({
    data: {
      id: STARTER_SESSION_ID,
      name: 'Starter Session',
      seedWorldId: STARTER_WORLD_ID,
      status: 'active',
      humanNationId: STARTER_HUMAN_NATION_ID,
      startedAt,
      lastResolvedAt: startedAt,
      timeScale: 1,
    },
  });

  await prisma.nation.createMany({
    data: [
      {
        id: STARTER_HUMAN_NATION_ID,
        sessionId: STARTER_SESSION_ID,
        name: 'Solmere League',
        colorHex: '#2563eb',
        controllerType: 'human',
        capitalProvinceId: 'riverbend',
        isDefeated: false,
      },
      {
        id: STARTER_AI_NATION_ID,
        sessionId: STARTER_SESSION_ID,
        name: 'Varkesh Front',
        colorHex: '#dc2626',
        controllerType: 'ai',
        capitalProvinceId: 'northhold',
        isDefeated: false,
      },
    ],
  });

  const starterHumanProvinces = new Set([
    'north-fen',
    'riverbend',
    'ironcrest',
    'stonegate',
    'mossplain',
    'cold-quarry',
  ]);

  await prisma.provinceState.createMany({
    data: STARTER_PROVINCES.map((province) => ({
      sessionId: STARTER_SESSION_ID,
      provinceId: province.id,
      ownerNationId: starterHumanProvinces.has(province.id)
        ? STARTER_HUMAN_NATION_ID
        : STARTER_AI_NATION_ID,
      capturedAt: startedAt,
    })),
  });

  await prisma.nationResourceBalance.createMany({
    data: [
      ...createInitialBalances(STARTER_SESSION_ID, STARTER_HUMAN_NATION_ID, 20, 16, 8),
      ...createInitialBalances(STARTER_SESSION_ID, STARTER_AI_NATION_ID, 20, 16, 8),
    ],
  });

  await prisma.unit.createMany({
    data: [
      {
        id: 'unit-solmere-riverbend-infantry',
        sessionId: STARTER_SESSION_ID,
        nationId: STARTER_HUMAN_NATION_ID,
        unitTypeCode: 'infantry',
        provinceId: 'riverbend',
        currentStrength: 10,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'unit-solmere-ironcrest-infantry',
        sessionId: STARTER_SESSION_ID,
        nationId: STARTER_HUMAN_NATION_ID,
        unitTypeCode: 'infantry',
        provinceId: 'ironcrest',
        currentStrength: 10,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'unit-solmere-stonegate-artillery',
        sessionId: STARTER_SESSION_ID,
        nationId: STARTER_HUMAN_NATION_ID,
        unitTypeCode: 'artillery',
        provinceId: 'stonegate',
        currentStrength: 8,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'unit-solmere-coldquarry-armor',
        sessionId: STARTER_SESSION_ID,
        nationId: STARTER_HUMAN_NATION_ID,
        unitTypeCode: 'armor',
        provinceId: 'cold-quarry',
        currentStrength: 12,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'unit-varkesh-northhold-infantry',
        sessionId: STARTER_SESSION_ID,
        nationId: STARTER_AI_NATION_ID,
        unitTypeCode: 'infantry',
        provinceId: 'northhold',
        currentStrength: 10,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'unit-varkesh-duskfield-infantry',
        sessionId: STARTER_SESSION_ID,
        nationId: STARTER_AI_NATION_ID,
        unitTypeCode: 'infantry',
        provinceId: 'duskfield',
        currentStrength: 10,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'unit-varkesh-emberplain-artillery',
        sessionId: STARTER_SESSION_ID,
        nationId: STARTER_AI_NATION_ID,
        unitTypeCode: 'artillery',
        provinceId: 'emberplain',
        currentStrength: 8,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'unit-varkesh-redmesa-armor',
        sessionId: STARTER_SESSION_ID,
        nationId: STARTER_AI_NATION_ID,
        unitTypeCode: 'armor',
        provinceId: 'red-mesa',
        currentStrength: 12,
        status: 'idle',
        createdAt: startedAt,
      },
    ],
  });
}

async function seedUS48Session() {
  await prisma.gameSession.create({
    data: {
      id: US48_SESSION_ID,
      name: 'US 48 Test Session',
      seedWorldId: US48_WORLD_ID,
      status: 'active',
      humanNationId: US48_HUMAN_NATION_ID,
      startedAt,
      lastResolvedAt: startedAt,
      timeScale: 1,
    },
  });

  await prisma.nation.createMany({
    data: [
      {
        id: US48_HUMAN_NATION_ID,
        sessionId: US48_SESSION_ID,
        name: 'Pacific Command',
        colorHex: '#0f62fe',
        controllerType: 'human',
        capitalProvinceId: 'us-ca',
        isDefeated: false,
      },
      {
        id: US48_AI_NATION_ID,
        sessionId: US48_SESSION_ID,
        name: 'Atlantic Pact',
        colorHex: '#ef4444',
        controllerType: 'ai',
        capitalProvinceId: 'us-pa',
        isDefeated: false,
      },
    ],
  });

  const humanStateCodes = new Set([
    'wa',
    'or',
    'ca',
    'id',
    'mt',
    'wy',
    'nv',
    'ut',
    'az',
    'co',
    'nm',
    'nd',
    'sd',
    'ne',
    'ks',
    'ok',
    'tx',
    'mn',
    'ia',
    'mo',
    'ar',
    'la',
    'wi',
    'il',
  ]);

  await prisma.provinceState.createMany({
    data: US48_V1_PROVINCES.map((province) => ({
      sessionId: US48_SESSION_ID,
      provinceId: province.id,
      ownerNationId: humanStateCodes.has(province.id.slice(3))
        ? US48_HUMAN_NATION_ID
        : US48_AI_NATION_ID,
      capturedAt: startedAt,
    })),
  });

  await prisma.nationResourceBalance.createMany({
    data: [
      ...createInitialBalances(US48_SESSION_ID, US48_HUMAN_NATION_ID, 80, 50, 32),
      ...createInitialBalances(US48_SESSION_ID, US48_AI_NATION_ID, 80, 50, 32),
    ],
  });

  await prisma.unit.createMany({
    data: [
      {
        id: 'us-unit-human-ca-armor',
        sessionId: US48_SESSION_ID,
        nationId: US48_HUMAN_NATION_ID,
        unitTypeCode: 'armor',
        provinceId: 'us-ca',
        currentStrength: 12,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'us-unit-human-ca-infantry',
        sessionId: US48_SESSION_ID,
        nationId: US48_HUMAN_NATION_ID,
        unitTypeCode: 'infantry',
        provinceId: 'us-ca',
        currentStrength: 10,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'us-unit-human-wa-infantry',
        sessionId: US48_SESSION_ID,
        nationId: US48_HUMAN_NATION_ID,
        unitTypeCode: 'infantry',
        provinceId: 'us-wa',
        currentStrength: 10,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'us-unit-human-co-artillery',
        sessionId: US48_SESSION_ID,
        nationId: US48_HUMAN_NATION_ID,
        unitTypeCode: 'artillery',
        provinceId: 'us-co',
        currentStrength: 8,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'us-unit-human-il-infantry',
        sessionId: US48_SESSION_ID,
        nationId: US48_HUMAN_NATION_ID,
        unitTypeCode: 'infantry',
        provinceId: 'us-il',
        currentStrength: 10,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'us-unit-human-mo-infantry',
        sessionId: US48_SESSION_ID,
        nationId: US48_HUMAN_NATION_ID,
        unitTypeCode: 'infantry',
        provinceId: 'us-mo',
        currentStrength: 10,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'us-unit-human-ar-armor',
        sessionId: US48_SESSION_ID,
        nationId: US48_HUMAN_NATION_ID,
        unitTypeCode: 'armor',
        provinceId: 'us-ar',
        currentStrength: 12,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'us-unit-human-tx-infantry',
        sessionId: US48_SESSION_ID,
        nationId: US48_HUMAN_NATION_ID,
        unitTypeCode: 'infantry',
        provinceId: 'us-tx',
        currentStrength: 10,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'us-unit-ai-pa-artillery',
        sessionId: US48_SESSION_ID,
        nationId: US48_AI_NATION_ID,
        unitTypeCode: 'artillery',
        provinceId: 'us-pa',
        currentStrength: 8,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'us-unit-ai-ga-infantry',
        sessionId: US48_SESSION_ID,
        nationId: US48_AI_NATION_ID,
        unitTypeCode: 'infantry',
        provinceId: 'us-ga',
        currentStrength: 10,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'us-unit-ai-in-infantry',
        sessionId: US48_SESSION_ID,
        nationId: US48_AI_NATION_ID,
        unitTypeCode: 'infantry',
        provinceId: 'us-in',
        currentStrength: 10,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'us-unit-ai-ky-artillery',
        sessionId: US48_SESSION_ID,
        nationId: US48_AI_NATION_ID,
        unitTypeCode: 'artillery',
        provinceId: 'us-ky',
        currentStrength: 8,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'us-unit-ai-ms-infantry',
        sessionId: US48_SESSION_ID,
        nationId: US48_AI_NATION_ID,
        unitTypeCode: 'infantry',
        provinceId: 'us-ms',
        currentStrength: 10,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'us-unit-ai-oh-armor',
        sessionId: US48_SESSION_ID,
        nationId: US48_AI_NATION_ID,
        unitTypeCode: 'armor',
        provinceId: 'us-oh',
        currentStrength: 12,
        status: 'idle',
        createdAt: startedAt,
      },
      {
        id: 'us-unit-ai-fl-infantry',
        sessionId: US48_SESSION_ID,
        nationId: US48_AI_NATION_ID,
        unitTypeCode: 'infantry',
        provinceId: 'us-fl',
        currentStrength: 10,
        status: 'idle',
        createdAt: startedAt,
      },
    ],
  });
}

async function main() {
  await prisma.movementOrder.deleteMany();
  await prisma.productionQueue.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.nationResourceBalance.deleteMany();
  await prisma.provinceState.deleteMany();
  await prisma.nation.deleteMany();
  await prisma.gameSession.deleteMany();

  await seedStarterSession();
  await seedUS48Session();

  console.log('REWAR starter-session and us48-session seeded.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
