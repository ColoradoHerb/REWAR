import type { Unit, UnitType } from '@rewar/shared';

export const STACK_COMBAT_BATCH_WINDOW_MS = 100;

type CombatUnit = Pick<Unit, 'currentStrength'>;
type CombatUnitType = Pick<UnitType, 'attack' | 'defense' | 'maxStrength'>;

type StackCombatUnit = Pick<Unit, 'id' | 'currentStrength' | 'unitTypeCode' | 'createdAt'> & {
  createdAt: string | Date;
};

type StackCombatUnitType = Pick<UnitType, 'attack' | 'defense' | 'maxStrength'>;

export type CombatResolution = {
  attackerTotal: number;
  defenderTotal: number;
  winner: 'attacker' | 'defender';
  loser: 'attacker' | 'defender';
  attackerDestroyed: boolean;
  defenderDestroyed: boolean;
  survivingStrength: number;
  provinceCaptured: boolean;
};

export type StackCombatUnitOutcome = {
  unitId: string;
  survivingStrength: number;
  destroyed: boolean;
};

export type StackCombatResolution = {
  attackerTotalPower: number;
  defenderTotalPower: number;
  winner: 'attacker' | 'defender';
  loser: 'attacker' | 'defender';
  provinceCaptured: boolean;
  winningSideStrengthLoss: number;
  attackerOutcomes: StackCombatUnitOutcome[];
  defenderOutcomes: StackCombatUnitOutcome[];
};

function getTimestamp(value: string | Date) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function compareUnitsByCreatedAtAndId(left: StackCombatUnit, right: StackCombatUnit) {
  const timestampDifference = getTimestamp(left.createdAt) - getTimestamp(right.createdAt);

  if (timestampDifference !== 0) {
    return timestampDifference;
  }

  return left.id.localeCompare(right.id);
}

function getHealthRatio(unit: Pick<StackCombatUnit, 'currentStrength'>, unitType: StackCombatUnitType) {
  if (unitType.maxStrength <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, unit.currentStrength / unitType.maxStrength));
}

function calculateAttackerUnitPower(unit: StackCombatUnit, unitType: StackCombatUnitType) {
  return unit.currentStrength + unitType.attack * getHealthRatio(unit, unitType);
}

function calculateDefenderUnitPower(unit: StackCombatUnit, unitType: StackCombatUnitType) {
  return unit.currentStrength + unitType.defense * getHealthRatio(unit, unitType);
}

function calculateWinningSideStrengthLoss(
  winnerTotalPower: number,
  loserTotalPower: number,
  winnerStrengthPool: number,
) {
  if (winnerStrengthPool <= 1 || loserTotalPower <= 0) {
    return 0;
  }

  const rawStrengthLoss =
    (loserTotalPower / Math.max(1, winnerTotalPower + loserTotalPower)) * winnerStrengthPool;

  return Math.max(0, Math.min(winnerStrengthPool - 1, Math.ceil(rawStrengthLoss)));
}

function distributeStrengthLoss(units: StackCombatUnit[], totalStrengthLoss: number) {
  const orderedUnits = [...units].sort(compareUnitsByCreatedAtAndId);
  const totalStrengthPool = orderedUnits.reduce((sum, unit) => sum + unit.currentStrength, 0);

  if (orderedUnits.length === 0) {
    return new Map<string, number>();
  }

  const cappedStrengthLoss = Math.max(
    0,
    Math.min(totalStrengthLoss, Math.max(0, totalStrengthPool - 1)),
  );

  if (cappedStrengthLoss === 0) {
    return new Map(orderedUnits.map((unit) => [unit.id, unit.currentStrength]));
  }

  const lossAllocations = orderedUnits.map((unit) => {
    const proportionalLoss = (cappedStrengthLoss * unit.currentStrength) / totalStrengthPool;
    const baseLoss = Math.min(unit.currentStrength, Math.floor(proportionalLoss));

    return {
      unit,
      baseLoss,
      fractionalRemainder: proportionalLoss - baseLoss,
    };
  });

  let assignedLoss = lossAllocations.reduce((sum, allocation) => sum + allocation.baseLoss, 0);
  const remainingLoss = cappedStrengthLoss - assignedLoss;

  if (remainingLoss > 0) {
    const remainderOrder = [...lossAllocations].sort((left, right) => {
      if (right.fractionalRemainder !== left.fractionalRemainder) {
        return right.fractionalRemainder - left.fractionalRemainder;
      }

      return compareUnitsByCreatedAtAndId(left.unit, right.unit);
    });

    for (const allocation of remainderOrder) {
      if (assignedLoss >= cappedStrengthLoss) {
        break;
      }

      if (allocation.baseLoss >= allocation.unit.currentStrength) {
        continue;
      }

      allocation.baseLoss += 1;
      assignedLoss += 1;
    }
  }

  return new Map(
    lossAllocations.map((allocation) => [
      allocation.unit.id,
      Math.max(0, allocation.unit.currentStrength - allocation.baseLoss),
    ]),
  );
}

function toUnitOutcomes(units: StackCombatUnit[], survivingStrengthByUnitId: Map<string, number>) {
  return [...units]
    .sort(compareUnitsByCreatedAtAndId)
    .map((unit) => {
      const survivingStrength = survivingStrengthByUnitId.get(unit.id) ?? 0;

      return {
        unitId: unit.id,
        survivingStrength,
        destroyed: survivingStrength <= 0,
      };
    });
}

export function resolveCombat(
  attacker: CombatUnit,
  defender: CombatUnit,
  attackerUnitType: CombatUnitType,
  defenderUnitType: CombatUnitType,
): CombatResolution {
  const attackerTotal = attacker.currentStrength + attackerUnitType.attack;
  const defenderTotal = defender.currentStrength + defenderUnitType.defense;

  if (attackerTotal > defenderTotal) {
    return {
      attackerTotal,
      defenderTotal,
      winner: 'attacker',
      loser: 'defender',
      attackerDestroyed: false,
      defenderDestroyed: true,
      survivingStrength: Math.min(
        attacker.currentStrength,
        attackerUnitType.maxStrength,
        Math.max(1, attacker.currentStrength - defenderUnitType.defense),
      ),
      provinceCaptured: true,
    };
  }

  return {
    attackerTotal,
    defenderTotal,
    winner: 'defender',
    loser: 'attacker',
    attackerDestroyed: true,
    defenderDestroyed: false,
    survivingStrength: Math.min(
      defender.currentStrength,
      defenderUnitType.maxStrength,
      Math.max(1, defender.currentStrength - attackerUnitType.attack),
    ),
    provinceCaptured: false,
  };
}

export function resolveStackCombat(
  attackers: StackCombatUnit[],
  defenders: StackCombatUnit[],
  unitTypesByCode: Map<string, StackCombatUnitType>,
): StackCombatResolution {
  if (attackers.length === 0) {
    throw new Error('Stack combat requires at least one attacking unit.');
  }

  if (defenders.length === 0) {
    throw new Error('Stack combat requires at least one defending unit.');
  }

  const attackerTotalPower = attackers.reduce((totalPower, attacker) => {
    const attackerUnitType = unitTypesByCode.get(attacker.unitTypeCode);

    if (!attackerUnitType) {
      throw new Error(`Unit type ${attacker.unitTypeCode} is not configured.`);
    }

    return totalPower + calculateAttackerUnitPower(attacker, attackerUnitType);
  }, 0);

  const defenderTotalPower = defenders.reduce((totalPower, defender) => {
    const defenderUnitType = unitTypesByCode.get(defender.unitTypeCode);

    if (!defenderUnitType) {
      throw new Error(`Unit type ${defender.unitTypeCode} is not configured.`);
    }

    return totalPower + calculateDefenderUnitPower(defender, defenderUnitType);
  }, 0);

  const attackerStrengthPool = attackers.reduce((sum, attacker) => sum + attacker.currentStrength, 0);
  const defenderStrengthPool = defenders.reduce((sum, defender) => sum + defender.currentStrength, 0);
  const attackerWins = attackerTotalPower > defenderTotalPower;
  const winner = attackerWins ? 'attacker' : 'defender';
  const loser = attackerWins ? 'defender' : 'attacker';
  const winningSideStrengthLoss = attackerWins
    ? calculateWinningSideStrengthLoss(attackerTotalPower, defenderTotalPower, attackerStrengthPool)
    : calculateWinningSideStrengthLoss(defenderTotalPower, attackerTotalPower, defenderStrengthPool);

  const attackerSurvivingStrengthByUnitId = attackerWins
    ? distributeStrengthLoss(attackers, winningSideStrengthLoss)
    : new Map(attackers.map((attacker) => [attacker.id, 0]));
  const defenderSurvivingStrengthByUnitId = attackerWins
    ? new Map(defenders.map((defender) => [defender.id, 0]))
    : distributeStrengthLoss(defenders, winningSideStrengthLoss);

  return {
    attackerTotalPower,
    defenderTotalPower,
    winner,
    loser,
    provinceCaptured: attackerWins,
    winningSideStrengthLoss,
    attackerOutcomes: toUnitOutcomes(attackers, attackerSurvivingStrengthByUnitId),
    defenderOutcomes: toUnitOutcomes(defenders, defenderSurvivingStrengthByUnitId),
  };
}
