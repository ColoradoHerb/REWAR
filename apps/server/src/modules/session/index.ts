import type { Prisma } from '@prisma/client';
import {
  RESOURCES,
  STARTER_PROVINCES,
  STARTER_WORLD_ID,
  US48_SUB_V1_PROVINCES,
  US48_SUB_WORLD_ID,
  US48_V1_PROVINCES,
  US48_WORLD_ID,
  type ResourceCode,
  type UnitTypeCode,
} from '@rewar/shared';
import { prisma } from '../../db/prisma.js';

export const SUPPORTED_SEED_WORLD_IDS = [STARTER_WORLD_ID, US48_WORLD_ID, US48_SUB_WORLD_ID] as const;
export type SupportedSeedWorldId = (typeof SUPPORTED_SEED_WORLD_IDS)[number];

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

function createInitialBalances(
  sessionId: string,
  nationId: string,
  startedAt: Date,
  food: number,
  metal: number,
  fuel: number,
) {
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
  unitTypeCode: UnitTypeCode,
  provinceId: string,
  currentStrength: number,
  startedAt: Date,
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

function getCanonicalSessionId(seedWorldId: SupportedSeedWorldId) {
  if (seedWorldId === STARTER_WORLD_ID) {
    return STARTER_SESSION_ID;
  }

  if (seedWorldId === US48_SUB_WORLD_ID) {
    return US48_SUB_SESSION_ID;
  }

  return US48_SESSION_ID;
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

async function seedStarterSession(tx: Prisma.TransactionClient, startedAt: Date) {
  await tx.gameSession.create({
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

  await tx.nation.createMany({
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

  await tx.provinceState.createMany({
    data: STARTER_PROVINCES.map((province) => ({
      sessionId: STARTER_SESSION_ID,
      provinceId: province.id,
      ownerNationId: starterHumanProvinces.has(province.id)
        ? STARTER_HUMAN_NATION_ID
        : STARTER_AI_NATION_ID,
      capturedAt: startedAt,
    })),
  });

  await tx.nationResourceBalance.createMany({
    data: [
      ...createInitialBalances(STARTER_SESSION_ID, STARTER_HUMAN_NATION_ID, startedAt, 20, 16, 8),
      ...createInitialBalances(STARTER_SESSION_ID, STARTER_AI_NATION_ID, startedAt, 20, 16, 8),
    ],
  });

  await tx.unit.createMany({
    data: [
      createUnitSeed(
        'unit-solmere-riverbend-infantry',
        STARTER_SESSION_ID,
        STARTER_HUMAN_NATION_ID,
        'infantry',
        'riverbend',
        10,
        startedAt,
      ),
      createUnitSeed(
        'unit-solmere-ironcrest-infantry',
        STARTER_SESSION_ID,
        STARTER_HUMAN_NATION_ID,
        'infantry',
        'ironcrest',
        10,
        startedAt,
      ),
      createUnitSeed(
        'unit-solmere-stonegate-artillery',
        STARTER_SESSION_ID,
        STARTER_HUMAN_NATION_ID,
        'artillery',
        'stonegate',
        8,
        startedAt,
      ),
      createUnitSeed(
        'unit-solmere-coldquarry-armor',
        STARTER_SESSION_ID,
        STARTER_HUMAN_NATION_ID,
        'armor',
        'cold-quarry',
        12,
        startedAt,
      ),
      createUnitSeed(
        'unit-varkesh-northhold-infantry',
        STARTER_SESSION_ID,
        STARTER_AI_NATION_ID,
        'infantry',
        'northhold',
        10,
        startedAt,
      ),
      createUnitSeed(
        'unit-varkesh-duskfield-infantry',
        STARTER_SESSION_ID,
        STARTER_AI_NATION_ID,
        'infantry',
        'duskfield',
        10,
        startedAt,
      ),
      createUnitSeed(
        'unit-varkesh-emberplain-artillery',
        STARTER_SESSION_ID,
        STARTER_AI_NATION_ID,
        'artillery',
        'emberplain',
        8,
        startedAt,
      ),
      createUnitSeed(
        'unit-varkesh-redmesa-armor',
        STARTER_SESSION_ID,
        STARTER_AI_NATION_ID,
        'armor',
        'red-mesa',
        12,
        startedAt,
      ),
    ],
  });
}

async function seedUS48Session(tx: Prisma.TransactionClient, startedAt: Date) {
  await tx.gameSession.create({
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

  await tx.nation.createMany({
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

  await tx.provinceState.createMany({
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

  await tx.nationResourceBalance.createMany({
    data: [
      ...createInitialBalances(US48_SESSION_ID, US48_HUMAN_NATION_ID, startedAt, 80, 50, 32),
      ...createInitialBalances(US48_SESSION_ID, US48_AI_NATION_ID, startedAt, 80, 50, 32),
    ],
  });

  await tx.unit.createMany({
    data: [
      createUnitSeed('us-unit-human-ca-armor', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'armor', 'us-ca', 12, startedAt),
      createUnitSeed('us-unit-human-ca-infantry', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'infantry', 'us-ca', 10, startedAt),
      createUnitSeed('us-unit-human-wa-infantry', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'infantry', 'us-wa', 10, startedAt),
      createUnitSeed('us-unit-human-co-artillery', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'artillery', 'us-co', 8, startedAt),
      createUnitSeed('us-unit-human-il-infantry', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'infantry', 'us-il', 10, startedAt),
      createUnitSeed('us-unit-human-il-artillery', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'artillery', 'us-il', 8, startedAt),
      createUnitSeed('us-unit-human-il-armor', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'armor', 'us-il', 12, startedAt),
      createUnitSeed('us-unit-human-mo-infantry-a', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'infantry', 'us-mo', 10, startedAt),
      createUnitSeed('us-unit-human-mo-infantry-b', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'infantry', 'us-mo', 10, startedAt),
      createUnitSeed('us-unit-human-mo-artillery', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'artillery', 'us-mo', 8, startedAt),
      createUnitSeed('us-unit-human-ar-armor', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'armor', 'us-ar', 12, startedAt),
      createUnitSeed('us-unit-human-ar-infantry', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'infantry', 'us-ar', 10, startedAt),
      createUnitSeed('us-unit-human-la-infantry', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'infantry', 'us-la', 10, startedAt),
      createUnitSeed('us-unit-human-la-artillery', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'artillery', 'us-la', 8, startedAt),
      createUnitSeed('us-unit-human-tx-infantry', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'infantry', 'us-tx', 10, startedAt),
      createUnitSeed('us-unit-human-tx-armor', US48_SESSION_ID, US48_HUMAN_NATION_ID, 'armor', 'us-tx', 12, startedAt),

      createUnitSeed('us-unit-ai-in-infantry-a', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-in', 10, startedAt),
      createUnitSeed('us-unit-ai-in-infantry-b', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-in', 10, startedAt),
      createUnitSeed('us-unit-ai-in-artillery', US48_SESSION_ID, US48_AI_NATION_ID, 'artillery', 'us-in', 8, startedAt),
      createUnitSeed('us-unit-ai-in-armor', US48_SESSION_ID, US48_AI_NATION_ID, 'armor', 'us-in', 12, startedAt),

      createUnitSeed('us-unit-ai-ky-infantry-a', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-ky', 10, startedAt),
      createUnitSeed('us-unit-ai-ky-infantry-b', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-ky', 10, startedAt),
      createUnitSeed('us-unit-ai-ky-artillery', US48_SESSION_ID, US48_AI_NATION_ID, 'artillery', 'us-ky', 8, startedAt),
      createUnitSeed('us-unit-ai-ky-armor', US48_SESSION_ID, US48_AI_NATION_ID, 'armor', 'us-ky', 12, startedAt),

      createUnitSeed('us-unit-ai-ms-infantry-a', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-ms', 10, startedAt),
      createUnitSeed('us-unit-ai-ms-infantry-b', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-ms', 10, startedAt),
      createUnitSeed('us-unit-ai-ms-artillery', US48_SESSION_ID, US48_AI_NATION_ID, 'artillery', 'us-ms', 8, startedAt),
      createUnitSeed('us-unit-ai-ms-armor', US48_SESSION_ID, US48_AI_NATION_ID, 'armor', 'us-ms', 12, startedAt),

      createUnitSeed('us-unit-ai-tn-infantry-a', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-tn', 10, startedAt),
      createUnitSeed('us-unit-ai-tn-infantry-b', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-tn', 10, startedAt),
      createUnitSeed('us-unit-ai-tn-artillery', US48_SESSION_ID, US48_AI_NATION_ID, 'artillery', 'us-tn', 8, startedAt),
      createUnitSeed('us-unit-ai-tn-armor', US48_SESSION_ID, US48_AI_NATION_ID, 'armor', 'us-tn', 12, startedAt),

      createUnitSeed('us-unit-ai-pa-infantry-a', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-pa', 10, startedAt),
      createUnitSeed('us-unit-ai-pa-infantry-b', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-pa', 10, startedAt),
      createUnitSeed('us-unit-ai-pa-infantry-c', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-pa', 10, startedAt),
      createUnitSeed('us-unit-ai-pa-artillery-a', US48_SESSION_ID, US48_AI_NATION_ID, 'artillery', 'us-pa', 8, startedAt),
      createUnitSeed('us-unit-ai-pa-artillery-b', US48_SESSION_ID, US48_AI_NATION_ID, 'artillery', 'us-pa', 8, startedAt),
      createUnitSeed('us-unit-ai-pa-armor-a', US48_SESSION_ID, US48_AI_NATION_ID, 'armor', 'us-pa', 12, startedAt),
      createUnitSeed('us-unit-ai-pa-armor-b', US48_SESSION_ID, US48_AI_NATION_ID, 'armor', 'us-pa', 12, startedAt),

      createUnitSeed('us-unit-ai-oh-armor', US48_SESSION_ID, US48_AI_NATION_ID, 'armor', 'us-oh', 12, startedAt),
      createUnitSeed('us-unit-ai-oh-infantry', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-oh', 10, startedAt),
      createUnitSeed('us-unit-ai-ga-infantry', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-ga', 10, startedAt),
      createUnitSeed('us-unit-ai-ga-artillery', US48_SESSION_ID, US48_AI_NATION_ID, 'artillery', 'us-ga', 8, startedAt),
      createUnitSeed('us-unit-ai-fl-infantry', US48_SESSION_ID, US48_AI_NATION_ID, 'infantry', 'us-fl', 10, startedAt),
    ],
  });
}

async function seedUS48SubSession(tx: Prisma.TransactionClient, startedAt: Date) {
  await tx.gameSession.create({
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

  await tx.nation.createMany({
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

  await tx.provinceState.createMany({
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

  await tx.nationResourceBalance.createMany({
    data: [
      ...createInitialBalances(US48_SUB_SESSION_ID, US48_SUB_HUMAN_NATION_ID, startedAt, 80, 50, 32),
      ...createInitialBalances(US48_SUB_SESSION_ID, US48_SUB_AI_NATION_ID, startedAt, 80, 50, 32),
    ],
  });

  await tx.unit.createMany({
    data: [
      createUnitSeed(
        'us-sub-unit-human-ca-armor',
        US48_SUB_SESSION_ID,
        US48_SUB_HUMAN_NATION_ID,
        'armor',
        'us-ca',
        12,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-human-ca-infantry',
        US48_SUB_SESSION_ID,
        US48_SUB_HUMAN_NATION_ID,
        'infantry',
        'us-ca',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-human-wa-infantry',
        US48_SUB_SESSION_ID,
        US48_SUB_HUMAN_NATION_ID,
        'infantry',
        'us-wa',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-human-co-artillery',
        US48_SUB_SESSION_ID,
        US48_SUB_HUMAN_NATION_ID,
        'artillery',
        'us-co-front-range',
        8,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-human-il-infantry',
        US48_SUB_SESSION_ID,
        US48_SUB_HUMAN_NATION_ID,
        'infantry',
        'us-il',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-human-il-artillery',
        US48_SUB_SESSION_ID,
        US48_SUB_HUMAN_NATION_ID,
        'artillery',
        'us-il',
        8,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-human-il-armor',
        US48_SUB_SESSION_ID,
        US48_SUB_HUMAN_NATION_ID,
        'armor',
        'us-il',
        12,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-human-mo-infantry-a',
        US48_SUB_SESSION_ID,
        US48_SUB_HUMAN_NATION_ID,
        'infantry',
        'us-mo',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-human-mo-infantry-b',
        US48_SUB_SESSION_ID,
        US48_SUB_HUMAN_NATION_ID,
        'infantry',
        'us-mo',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-human-mo-artillery',
        US48_SUB_SESSION_ID,
        US48_SUB_HUMAN_NATION_ID,
        'artillery',
        'us-mo',
        8,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-human-ar-armor',
        US48_SUB_SESSION_ID,
        US48_SUB_HUMAN_NATION_ID,
        'armor',
        'us-ar',
        12,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-human-ar-infantry',
        US48_SUB_SESSION_ID,
        US48_SUB_HUMAN_NATION_ID,
        'infantry',
        'us-ar',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-human-la-infantry',
        US48_SUB_SESSION_ID,
        US48_SUB_HUMAN_NATION_ID,
        'infantry',
        'us-la',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-human-la-artillery',
        US48_SUB_SESSION_ID,
        US48_SUB_HUMAN_NATION_ID,
        'artillery',
        'us-la',
        8,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-human-tx-infantry',
        US48_SUB_SESSION_ID,
        US48_SUB_HUMAN_NATION_ID,
        'infantry',
        'us-tx-panhandle-north',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-human-tx-armor',
        US48_SUB_SESSION_ID,
        US48_SUB_HUMAN_NATION_ID,
        'armor',
        'us-tx-central-hills',
        12,
        startedAt,
      ),

      createUnitSeed(
        'us-sub-unit-ai-in-infantry-a',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'infantry',
        'us-in',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-in-infantry-b',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'infantry',
        'us-in',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-in-artillery',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'artillery',
        'us-in',
        8,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-in-armor',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'armor',
        'us-in',
        12,
        startedAt,
      ),

      createUnitSeed(
        'us-sub-unit-ai-ky-infantry-a',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'infantry',
        'us-ky',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-ky-infantry-b',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'infantry',
        'us-ky',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-ky-artillery',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'artillery',
        'us-ky',
        8,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-ky-armor',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'armor',
        'us-ky',
        12,
        startedAt,
      ),

      createUnitSeed(
        'us-sub-unit-ai-ms-infantry-a',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'infantry',
        'us-ms',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-ms-infantry-b',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'infantry',
        'us-ms',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-ms-artillery',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'artillery',
        'us-ms',
        8,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-ms-armor',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'armor',
        'us-ms',
        12,
        startedAt,
      ),

      createUnitSeed(
        'us-sub-unit-ai-tn-infantry-a',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'infantry',
        'us-tn',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-tn-infantry-b',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'infantry',
        'us-tn',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-tn-artillery',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'artillery',
        'us-tn',
        8,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-tn-armor',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'armor',
        'us-tn',
        12,
        startedAt,
      ),

      createUnitSeed(
        'us-sub-unit-ai-pa-infantry-a',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'infantry',
        'us-pa-east',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-pa-infantry-b',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'infantry',
        'us-pa-east',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-pa-infantry-c',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'infantry',
        'us-pa-west',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-pa-artillery-a',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'artillery',
        'us-pa-east',
        8,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-pa-artillery-b',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'artillery',
        'us-pa-central-ridge',
        8,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-pa-armor-a',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'armor',
        'us-pa-east',
        12,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-pa-armor-b',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'armor',
        'us-pa-central-ridge',
        12,
        startedAt,
      ),

      createUnitSeed(
        'us-sub-unit-ai-oh-armor',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'armor',
        'us-oh',
        12,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-oh-infantry',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'infantry',
        'us-oh',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-ga-infantry',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'infantry',
        'us-ga',
        10,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-ga-artillery',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'artillery',
        'us-ga',
        8,
        startedAt,
      ),
      createUnitSeed(
        'us-sub-unit-ai-fl-infantry',
        US48_SUB_SESSION_ID,
        US48_SUB_AI_NATION_ID,
        'infantry',
        'us-fl',
        10,
        startedAt,
      ),
    ],
  });
}

export function isSupportedSeedWorldId(value: string): value is SupportedSeedWorldId {
  return SUPPORTED_SEED_WORLD_IDS.some((seedWorldId) => seedWorldId === value);
}

export async function createSeededSession({
  seedWorldId,
  replaceSessionId,
}: {
  seedWorldId: SupportedSeedWorldId;
  replaceSessionId?: string | null;
}) {
  const startedAt = new Date();
  const targetSessionId = getCanonicalSessionId(seedWorldId);
  const sessionIdsToDelete = [...new Set([targetSessionId, replaceSessionId].filter(Boolean))];

  await prisma.$transaction(async (tx) => {
    if (sessionIdsToDelete.length > 0) {
      await tx.gameSession.deleteMany({
        where: {
          id: {
            in: sessionIdsToDelete,
          },
        },
      });
    }

    if (seedWorldId === STARTER_WORLD_ID) {
      await seedStarterSession(tx, startedAt);
      return;
    }

    if (seedWorldId === US48_SUB_WORLD_ID) {
      await seedUS48SubSession(tx, startedAt);
      return;
    }

    await seedUS48Session(tx, startedAt);
  });

  return {
    sessionId: targetSessionId,
  };
}
