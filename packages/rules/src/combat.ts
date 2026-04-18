import type { Unit, UnitType } from '@rewar/shared';

type CombatUnit = Pick<Unit, 'currentStrength'>;
type CombatUnitType = Pick<UnitType, 'attack' | 'defense' | 'maxStrength'>;

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
