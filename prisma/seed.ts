import { fileURLToPath } from 'node:url';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import {
  RESOURCES,
  STARTER_PROVINCES,
  STARTER_WORLD_ID,
  US48_SUB_V1_PROVINCES,
  US48_SUB_WORLD_ID,
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

const US48_SUB_SESSION_ID = 'us48-sub-session';
const US48_SUB_HUMAN_NATION_ID = 'us-sub-nation-pacific';
const US48_SUB_AI_NATION_ID = 'us-sub-nation-atlantic';

const US48_HUMAN_STATE_CODES = new Set([
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

function createInitialBalances(sessionId: string, nationId: string, food: number, metal: number, fuel: number) {
  return RESOURCES.map((resource) => ({
    sessionId,
    nationId,
    resourceCode: resource.code,
    amount: resource.code === 'food' ? food : resource.code === 'metal' ? metal : fuel,
    lastSyncedAt: startedAt,
  }));
}

function createUnitSeed(
  id: string,
  sessionId: string,
  nationId: string,
  unitTypeCode: 'infantry' | 'artillery' | 'armor',
  provinceId: string,
  currentStrength: number,
) {
  return {
    id,
    sessionId,
    nationId,
    unitTypeCode,
    provinceId,
    currentStrength,
    status: 'idle' as const,
    createdAt: startedAt,
  };
}

function getUS48OwningNationId(
  provinceId: string,
  humanNationId: string,
  aiNationId: string,
  parentStateId?: string | null,
) {
  const stateCode = (parentStateId ?? provinceId).slice(3);
  return US48_HUMAN_STATE_CODES.has(stateCode) ? humanNationId : aiNationId;
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

  await prisma.provinceState.createMany({
    data: US48_V1_PROVINCES.map((province) => ({
      sessionId: US48_SESSION_ID,
      provinceId: province.id,
      ownerNationId: getUS48OwningNationId(
        province.id,
        US48_HUMAN_NATION_ID,
        US48_AI_NATION_ID,
      ),
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
      createUnitSeed('us-unit-human-ca-armor', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'armor', 'us-ca', 12),
      createUnitSeed('us-unit-human-ca-infantry', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'infantry', 'us-ca', 10),
      createUnitSeed('us-unit-human-wa-infantry', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'infantry', 'us-wa', 10),
      createUnitSeed('us-unit-human-co-artillery', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'artillery', 'us-co', 8),
      createUnitSeed('us-unit-human-il-infantry', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'infantry', 'us-il', 10),
      createUnitSeed('us-unit-human-il-artillery', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'artillery', 'us-il', 8),
      createUnitSeed('us-unit-human-il-armor', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'armor', 'us-il', 12),
      createUnitSeed('us-unit-human-mo-infantry-a', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'infantry', 'us-mo', 10),
      createUnitSeed('us-unit-human-mo-infantry-b', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'infantry', 'us-mo', 10),
      createUnitSeed('us-unit-human-mo-artillery', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'artillery', 'us-mo', 8),
      createUnitSeed('us-unit-human-ar-armor', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'armor', 'us-ar', 12),
      createUnitSeed('us-unit-human-ar-infantry', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'infantry', 'us-ar', 10),
      createUnitSeed('us-unit-human-la-infantry', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'infantry', 'us-la', 10),
      createUnitSeed('us-unit-human-la-artillery', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'artillery', 'us-la', 8),
      createUnitSeed('us-unit-human-tx-infantry', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'infantry', 'us-tx', 10),
      createUnitSeed('us-unit-human-tx-armor', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'armor', 'us-tx', 12),

      createUnitSeed('us-unit-ai-in-infantry-a', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-in', 10),
      createUnitSeed('us-unit-ai-in-infantry-b', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-in', 10),
      createUnitSeed('us-unit-ai-in-artillery', US48_SESSION_ID, US48_AI_NATION_ID, 'artillery', 'us-in', 8),
      createUnitSeed('us-unit-ai-in-armor', US48_SESSION_ID, US48_AI_NATION_ID, 'armor', 'us-in', 12),

      createUnitSeed('us-unit-ai-ky-infantry-a', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-ky', 10),
      createUnitSeed('us-unit-ai-ky-infantry-b', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-ky', 10),
      createUnitSeed('us-unit-ai-ky-artillery', US48_SESSION_ID, US48_AI_NATION_ID, 'artillery', 'us-ky', 8),
      createUnitSeed('us-unit-ai-ky-armor', US48_SESSION_ID, US48_AI_NATION_ID, 'armor', 'us-ky', 12),

      createUnitSeed('us-unit-ai-ms-infantry-a', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-ms', 10),
      createUnitSeed('us-unit-ai-ms-infantry-b', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-ms', 10),
      createUnitSeed('us-unit-ai-ms-artillery', US48_SESSION_ID, US48_AI_NATION_ID, 'artillery', 'us-ms', 8),
      createUnitSeed('us-unit-ai-ms-armor', US48_SESSION_ID, US48_AI_NATION_ID, 'armor', 'us-ms', 12),

      createUnitSeed('us-unit-ai-tn-infantry-a', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-tn', 10),
      createUnitSeed('us-unit-ai-tn-infantry-b', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-tn', 10),
      createUnitSeed('us-unit-ai-tn-artillery', US48_SESSION_ID, US48_AI_NATION_ID, 'artillery', 'us-tn', 8),
      createUnitSeed('us-unit-ai-tn-armor', US48_SESSION_ID, US48_AI_NATION_ID, 'armor', 'us-tn', 12),

      createUnitSeed('us-unit-ai-pa-infantry-a', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-pa', 10),
      createUnitSeed('us-unit-ai-pa-infantry-b', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-pa', 10),
      createUnitSeed('us-unit-ai-pa-infantry-c', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-pa', 10),
      createUnitSeed('us-unit-ai-pa-artillery-a', US48_SESSION_ID, US48_AI_NATION_ID, 'artillery', 'us-pa', 8),
      createUnitSeed('us-unit-ai-pa-artillery-b', US48_SESSION_ID, US48_AI_NATION_ID, 'artillery', 'us-pa', 8),
      createUnitSeed('us-unit-ai-pa-armor-a', US48_SESSION_ID, US48_AI_NATION_ID, 'armor', 'us-pa', 12),
      createUnitSeed('us-unit-ai-pa-armor-b', US48_SESSION_ID, US48_AI_NATION_ID, 'armor', 'us-pa', 12),

      createUnitSeed('us-unit-ai-oh-armor', US48_SESSION_ID, US48_AI_NATION_ID, 'armor', 'us-oh', 12),
      createUnitSeed('us-unit-ai-oh-infantry', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-oh', 10),
      createUnitSeed('us-unit-ai-ga-infantry', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-ga', 10),
      createUnitSeed('us-unit-ai-ga-artillery', US48_SESSION_ID, US48_AI_NATION_ID, 'artillery', 'us-ga', 8),
      createUnitSeed('us-unit-ai-fl-infantry', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-fl', 10),
    ],
  });
}

async function seedUS48SubSession() {
  await prisma.gameSession.create({
    data: {
      id: US48_SUB_SESSION_ID,
      name: 'US 48 Sub-Province Pilot',
      seedWorldId: US48_SUB_WORLD_ID,
      status: 'active',
      humanNationId: US48_SUB_HUMAN_NATION_ID,
      startedAt,
      lastResolvedAt: startedAt,
      timeScale: 1,
    },
  });

  await prisma.nation.createMany({
    data: [
      {
        id: US48_SUB_HUMAN_NATION_ID,
        sessionId: US48_SUB_SESSION_ID,
        name: 'Pacific Command',
        colorHex: '#0f62fe',
        controllerType: 'human',
        capitalProvinceId: 'us-ca',
        isDefeated: false,
      },
      {
        id: US48_SUB_AI_NATION_ID,
        sessionId: US48_SUB_SESSION_ID,
        name: 'Atlantic Pact',
        colorHex: '#ef4444',
        controllerType: 'ai',
        capitalProvinceId: 'us-pa-east',
        isDefeated: false,
      },
    ],
  });

  await prisma.provinceState.createMany({
    data: US48_SUB_V1_PROVINCES.map((province) => ({
      sessionId: US48_SUB_SESSION_ID,
      provinceId: province.id,
      ownerNationId: getUS48OwningNationId(
        province.id,
        US48_SUB_HUMAN_NATION_ID,
        US48_SUB_AI_NATION_ID,
        province.parentStateId,
      ),
      capturedAt: startedAt,
    })),
  });

  await prisma.nationResourceBalance.createMany({
    data: [
      ...createInitialBalances(US48_SUB_SESSION_ID, US48_SUB_HUMAN_NATION_ID, 80, 50, 32),
      ...createInitialBalances(US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 80, 50, 32),
    ],
  });

  await prisma.unit.createMany({
    data: [
      createUnitSeed('us-sub-unit-human-ca-armor', US48_SUB_SESSION_ID, US48_SUB_HUMAN_NATION_ID, 'armor', 'us-ca', 12),
      createUnitSeed('us-sub-unit-human-ca-infantry', US48_SUB_SESSION_ID, US48_SUB_HUMAN_NATION_ID, 'infantry', 'us-ca', 10),
      createUnitSeed('us-sub-unit-human-wa-infantry', US48_SUB_SESSION_ID, US48_SUB_HUMAN_NATION_ID, 'infantry', 'us-wa', 10),
      createUnitSeed('us-sub-unit-human-co-artillery', US48_SUB_SESSION_ID, US48_SUB_HUMAN_NATION_ID, 'artillery', 'us-co-front-range', 8),
      createUnitSeed('us-sub-unit-human-il-infantry', US48_SUB_SESSION_ID, US48_SUB_HUMAN_NATION_ID, 'infantry', 'us-il', 10),
      createUnitSeed('us-sub-unit-human-il-artillery', US48_SUB_SESSION_ID, US48_SUB_HUMAN_NATION_ID, 'artillery', 'us-il', 8),
      createUnitSeed('us-sub-unit-human-il-armor', US48_SUB_SESSION_ID, US48_SUB_HUMAN_NATION_ID, 'armor', 'us-il', 12),
      createUnitSeed('us-sub-unit-human-mo-infantry-a', US48_SUB_SESSION_ID, US48_SUB_HUMAN_NATION_ID, 'infantry', 'us-mo', 10),
      createUnitSeed('us-sub-unit-human-mo-infantry-b', US48_SUB_SESSION_ID, US48_SUB_HUMAN_NATION_ID, 'infantry', 'us-mo', 10),
      createUnitSeed('us-sub-unit-human-mo-artillery', US48_SUB_SESSION_ID, US48_SUB_HUMAN_NATION_ID, 'artillery', 'us-mo', 8),
      createUnitSeed('us-sub-unit-human-ar-armor', US48_SUB_SESSION_ID, US48_SUB_HUMAN_NATION_ID, 'armor', 'us-ar', 12),
      createUnitSeed('us-sub-unit-human-ar-infantry', US48_SUB_SESSION_ID, US48_SUB_HUMAN_NATION_ID, 'infantry', 'us-ar', 10),
      createUnitSeed('us-sub-unit-human-la-infantry', US48_SUB_SESSION_ID, US48_SUB_HUMAN_NATION_ID, 'infantry', 'us-la', 10),
      createUnitSeed('us-sub-unit-human-la-artillery', US48_SUB_SESSION_ID, US48_SUB_HUMAN_NATION_ID, 'artillery', 'us-la', 8),
      createUnitSeed('us-sub-unit-human-tx-infantry', US48_SUB_SESSION_ID, US48_SUB_HUMAN_NATION_ID, 'infantry', 'us-tx-panhandle-north', 10),
      createUnitSeed('us-sub-unit-human-tx-armor', US48_SUB_SESSION_ID, US48_SUB_HUMAN_NATION_ID, 'armor', 'us-tx-central-hills', 12),

      createUnitSeed('us-sub-unit-ai-in-infantry-a', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'infantry', 'us-in', 10),
      createUnitSeed('us-sub-unit-ai-in-infantry-b', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'infantry', 'us-in', 10),
      createUnitSeed('us-sub-unit-ai-in-artillery', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'artillery', 'us-in', 8),
      createUnitSeed('us-sub-unit-ai-in-armor', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'armor', 'us-in', 12),

      createUnitSeed('us-sub-unit-ai-ky-infantry-a', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'infantry', 'us-ky', 10),
      createUnitSeed('us-sub-unit-ai-ky-infantry-b', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'infantry', 'us-ky', 10),
      createUnitSeed('us-sub-unit-ai-ky-artillery', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'artillery', 'us-ky', 8),
      createUnitSeed('us-sub-unit-ai-ky-armor', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'armor', 'us-ky', 12),

      createUnitSeed('us-sub-unit-ai-ms-infantry-a', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'infantry', 'us-ms', 10),
      createUnitSeed('us-sub-unit-ai-ms-infantry-b', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'infantry', 'us-ms', 10),
      createUnitSeed('us-sub-unit-ai-ms-artillery', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'artillery', 'us-ms', 8),
      createUnitSeed('us-sub-unit-ai-ms-armor', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'armor', 'us-ms', 12),

      createUnitSeed('us-sub-unit-ai-tn-infantry-a', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'infantry', 'us-tn', 10),
      createUnitSeed('us-sub-unit-ai-tn-infantry-b', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'infantry', 'us-tn', 10),
      createUnitSeed('us-sub-unit-ai-tn-artillery', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'artillery', 'us-tn', 8),
      createUnitSeed('us-sub-unit-ai-tn-armor', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'armor', 'us-tn', 12),

      createUnitSeed('us-sub-unit-ai-pa-infantry-a', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'infantry', 'us-pa-east', 10),
      createUnitSeed('us-sub-unit-ai-pa-infantry-b', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'infantry', 'us-pa-east', 10),
      createUnitSeed('us-sub-unit-ai-pa-infantry-c', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'infantry', 'us-pa-west', 10),
      createUnitSeed('us-sub-unit-ai-pa-artillery-a', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'artillery', 'us-pa-east', 8),
      createUnitSeed('us-sub-unit-ai-pa-artillery-b', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'artillery', 'us-pa-central-ridge', 8),
      createUnitSeed('us-sub-unit-ai-pa-armor-a', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'armor', 'us-pa-east', 12),
      createUnitSeed('us-sub-unit-ai-pa-armor-b', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'armor', 'us-pa-central-ridge', 12),

      createUnitSeed('us-sub-unit-ai-oh-armor', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'armor', 'us-oh', 12),
      createUnitSeed('us-sub-unit-ai-oh-infantry', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'infantry', 'us-oh', 10),
      createUnitSeed('us-sub-unit-ai-ga-infantry', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'infantry', 'us-ga', 10),
      createUnitSeed('us-sub-unit-ai-ga-artillery', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'artillery', 'us-ga', 8),
      createUnitSeed('us-sub-unit-ai-fl-infantry', US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, 'infantry', 'us-fl', 10),
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
  await seedUS48SubSession();

  console.log('REWAR starter-session, us48-session, and us48-sub-session seeded.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
