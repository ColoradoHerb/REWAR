import type { UnitType } from '../types/game';

export const UNIT_TYPES: UnitType[] = [
  {
    code: 'infantry',
    name: 'Infantry',
    attack: 4,
    defense: 4,
    maxStrength: 10,
    hoursPerDistance: 6,
    buildTimeSeconds: 8,
    cost: { food: 5, metal: 2 },
  },
  {
    code: 'artillery',
    name: 'Artillery',
    attack: 6,
    defense: 2,
    maxStrength: 8,
    hoursPerDistance: 8,
    buildTimeSeconds: 12,
    cost: { food: 4, metal: 5, fuel: 1 },
  },
  {
    code: 'armor',
    name: 'Armor',
    attack: 7,
    defense: 5,
    maxStrength: 12,
    hoursPerDistance: 4,
    buildTimeSeconds: 14,
    cost: { food: 3, metal: 6, fuel: 4 },
  },
];
