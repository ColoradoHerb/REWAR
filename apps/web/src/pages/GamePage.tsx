import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MovementOrder, UnitTypeCode, WorldState } from '@rewar/shared';
import { AppShell } from '../components/ui';
import { StrategyMap } from '../components/map';
import { OverviewPanel } from '../components/panels';
import { fetchWorldState, sendMoveUnitCommand, sendQueueUnitCommand } from '../lib/api/client';
import { initialUiState, type UiState } from '../lib/state/uiState';

const STARTER_SESSION_ID = 'starter-session';
const WORLD_POLL_INTERVAL_MS = 1_000;
const MAX_RECENT_MESSAGES = 6;

function getProvinceName(worldState: WorldState, provinceId: string) {
  return worldState.provinces.find((province) => province.id === provinceId)?.name ?? provinceId;
}

function getNationName(worldState: WorldState, nationId: string) {
  return worldState.nations.find((nation) => nation.id === nationId)?.name ?? nationId;
}

function getUnitTypeName(worldState: WorldState, unitTypeCode: string) {
  return worldState.unitTypes.find((unitType) => unitType.code === unitTypeCode)?.name ?? unitTypeCode;
}

function compareUnitsByResolutionOrder(
  left: Pick<WorldState['units'][number], 'createdAt' | 'id'>,
  right: Pick<WorldState['units'][number], 'createdAt' | 'id'>,
) {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt.localeCompare(right.createdAt);
  }

  return left.id.localeCompare(right.id);
}

function getFirstEnemyDefender(previousWorldState: WorldState, order: MovementOrder) {
  const attacker = previousWorldState.units.find((unit) => unit.id === order.unitId);

  if (!attacker) {
    return null;
  }

  return (
    previousWorldState.units
      .filter(
        (unit) =>
          unit.provinceId === order.toProvinceId &&
          unit.nationId !== attacker.nationId &&
          unit.status !== 'destroyed',
      )
      .sort(compareUnitsByResolutionOrder)[0] ?? null
  );
}

function buildCombatMessages(previousWorldState: WorldState | null, nextWorldState: WorldState) {
  if (!previousWorldState) {
    return [];
  }

  const previousOrdersById = new Map(
    previousWorldState.movementOrders.map((movementOrder) => [movementOrder.id, movementOrder]),
  );
  const messages: string[] = [];

  for (const nextOrder of nextWorldState.movementOrders) {
    const previousOrder = previousOrdersById.get(nextOrder.id);

    if (!previousOrder || previousOrder.status !== 'active' || nextOrder.status !== 'arrived') {
      continue;
    }

    const attackerBefore = previousWorldState.units.find((unit) => unit.id === nextOrder.unitId);
    const defenderBefore = getFirstEnemyDefender(previousWorldState, nextOrder);

    if (!attackerBefore || !defenderBefore) {
      continue;
    }

    const attackerAfter = nextWorldState.units.find((unit) => unit.id === attackerBefore.id) ?? null;
    const provinceName = getProvinceName(nextWorldState, nextOrder.toProvinceId);
    const attackerNationName = getNationName(nextWorldState, attackerBefore.nationId);
    const defenderNationName = getNationName(nextWorldState, defenderBefore.nationId);
    const attackerUnitTypeName = getUnitTypeName(nextWorldState, attackerBefore.unitTypeCode);
    const defenderUnitTypeName = getUnitTypeName(nextWorldState, defenderBefore.unitTypeCode);
    const provinceOwnerAfter =
      nextWorldState.provinceStates.find((provinceState) => provinceState.provinceId === nextOrder.toProvinceId)
        ?.ownerNationId ?? null;

    if (attackerAfter && attackerAfter.status !== 'destroyed') {
      messages.unshift(
        `${attackerNationName} ${attackerUnitTypeName} won at ${provinceName}; ${defenderNationName} ${defenderUnitTypeName} destroyed, survivor strength ${attackerAfter.currentStrength}, province captured.`,
      );
      continue;
    }

    const survivingDefender =
      nextWorldState.units.find((unit) => unit.id === defenderBefore.id && unit.status !== 'destroyed') ?? null;

    messages.unshift(
      `${defenderNationName} ${defenderUnitTypeName} held ${provinceName}; attacking ${attackerNationName} ${attackerUnitTypeName} destroyed${
        survivingDefender ? `, defender strength ${survivingDefender.currentStrength}` : ''
      }${
        provinceOwnerAfter && provinceOwnerAfter !== attackerBefore.nationId ? ', province not captured.' : '.'
      }`,
    );
  }

  return messages;
}

export function GamePage() {
  const [worldState, setWorldState] = useState<WorldState | null>(null);
  const [uiState, setUiState] = useState<UiState>(initialUiState);
  const [recentMessages, setRecentMessages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isIssuingMove, setIsIssuingMove] = useState(false);
  const [isQueueingProduction, setIsQueueingProduction] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const worldStateRef = useRef<WorldState | null>(null);

  const loadWorld = useCallback(async (options?: { background?: boolean }) => {
    const isBackgroundRefresh = options?.background ?? false;

    if (!isBackgroundRefresh) {
      setIsLoading(true);
    }

    try {
      const nextWorldState = await fetchWorldState(STARTER_SESSION_ID);
      const previousWorldState = worldStateRef.current;
      const nextCombatMessages = buildCombatMessages(previousWorldState, nextWorldState);

      worldStateRef.current = nextWorldState;
      setWorldState(nextWorldState);
      setErrorMessage(null);

      if (nextCombatMessages.length > 0) {
        setRecentMessages((currentMessages) =>
          [...nextCombatMessages, ...currentMessages].slice(0, MAX_RECENT_MESSAGES),
        );
      }

      setUiState((currentUiState) => {
        const selectedUnit = currentUiState.selectedUnitId
          ? nextWorldState.units.find((unit) => unit.id === currentUiState.selectedUnitId) ?? null
          : null;
        const hasSelectedProvince =
          currentUiState.selectedProvinceId &&
          nextWorldState.provinces.some((province) => province.id === currentUiState.selectedProvinceId);

        if (selectedUnit && selectedUnit.status !== 'destroyed') {
          const activeOrder =
            nextWorldState.movementOrders.find(
              (movementOrder) =>
                movementOrder.unitId === selectedUnit.id && movementOrder.status === 'active',
            ) ?? null;

          return {
            selectedUnitId: selectedUnit.id,
            selectedProvinceId: activeOrder?.toProvinceId ?? (hasSelectedProvince ? currentUiState.selectedProvinceId : selectedUnit.provinceId),
          };
        }

        return {
          selectedUnitId: null,
          selectedProvinceId: hasSelectedProvince ? currentUiState.selectedProvinceId : null,
        };
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load starter world.');
    } finally {
      if (!isBackgroundRefresh) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadWorld();
  }, [loadWorld]);

  useEffect(() => {
    if (!worldState) {
      return undefined;
    }

    const pollTimer = window.setInterval(() => {
      void loadWorld({ background: true });
    }, WORLD_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(pollTimer);
    };
  }, [loadWorld, worldState]);

  const activeUnits = useMemo(
    () => worldState?.units.filter((unit) => unit.status !== 'destroyed') ?? [],
    [worldState],
  );
  const selectedUnit = useMemo(
    () => activeUnits.find((unit) => unit.id === uiState.selectedUnitId) ?? null,
    [activeUnits, uiState.selectedUnitId],
  );

  const handleProvinceSelect = useCallback(
    async (provinceId: string) => {
      if (!worldState) {
        return;
      }

      const clickedProvinceUnits = activeUnits.filter((unit) => unit.provinceId === provinceId);
      const clickedHumanUnit =
        clickedProvinceUnits.find((unit) => unit.nationId === worldState.session.humanNationId) ?? null;

      const canIssueMove =
        selectedUnit &&
        selectedUnit.status === 'idle' &&
        selectedUnit.provinceId !== provinceId &&
        worldState.edges.some(
          (edge) =>
            edge.fromProvinceId === selectedUnit.provinceId && edge.toProvinceId === provinceId,
        );

      if (canIssueMove) {
        try {
          setIsIssuingMove(true);
          setErrorMessage(null);
          await sendMoveUnitCommand(worldState.session.id, selectedUnit.id, provinceId);
          setUiState((currentUiState) => ({
            ...currentUiState,
            selectedProvinceId: provinceId,
            selectedUnitId: selectedUnit.id,
          }));
          await loadWorld({ background: true });
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : 'Failed to issue MOVE_UNIT.');
        } finally {
          setIsIssuingMove(false);
        }
        return;
      }

      setUiState({
        selectedProvinceId: provinceId,
        selectedUnitId: clickedHumanUnit?.id ?? null,
      });
    },
    [activeUnits, loadWorld, selectedUnit, worldState],
  );

  const handleQueueUnit = useCallback(
    async (provinceId: string, unitTypeCode: UnitTypeCode) => {
      if (!worldState) {
        return;
      }

      try {
        setIsQueueingProduction(true);
        setErrorMessage(null);
        await sendQueueUnitCommand(worldState.session.id, provinceId, unitTypeCode);
        await loadWorld({ background: true });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to queue unit production.');
      } finally {
        setIsQueueingProduction(false);
      }
    },
    [loadWorld, worldState],
  );

  const handleSelectUnit = useCallback((unitId: string) => {
    if (!worldState) {
      return;
    }

    const unit = activeUnits.find((entry) => entry.id === unitId);

    if (!unit) {
      return;
    }

    setUiState({
      selectedProvinceId: unit.provinceId,
      selectedUnitId: unit.id,
    });
  }, [activeUnits, worldState]);

  return (
    <AppShell>
      <p style={{ marginTop: 0, color: '#cbd5e1' }}>
        Session: <strong>{worldState?.session.name ?? STARTER_SESSION_ID}</strong>
      </p>

      {isIssuingMove ? (
        <p style={{ marginTop: 0, color: '#7dd3fc' }}>Issuing movement order...</p>
      ) : null}

      {isQueueingProduction ? (
        <p style={{ marginTop: 0, color: '#facc15' }}>Queueing production...</p>
      ) : null}

      {isLoading ? (
        <section
          style={{
            border: '1px solid #334155',
            borderRadius: 12,
            padding: 24,
            background: '#0f172a',
          }}
        >
          <h2 style={{ marginTop: 0 }}>Loading world...</h2>
          <p style={{ marginBottom: 0, color: '#94a3b8' }}>
            Fetching seeded session data from the server.
          </p>
        </section>
      ) : null}

      {!isLoading && errorMessage ? (
        <section
          style={{
            border: '1px solid #7f1d1d',
            borderRadius: 12,
            padding: 24,
            background: '#190b0b',
            marginBottom: 24,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Unable to refresh the world</h2>
          <p style={{ color: '#fecaca' }}>{errorMessage}</p>
          <button
            type="button"
            onClick={() => {
              void loadWorld();
            }}
            style={{
              border: '1px solid #475569',
              borderRadius: 8,
              background: '#0f172a',
              color: '#e2e8f0',
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </section>
      ) : null}

      {!isLoading && worldState ? (
        <div
          style={{
            display: 'grid',
            gap: 24,
            gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)',
            alignItems: 'start',
          }}
        >
          <StrategyMap
            worldState={worldState}
            selectedProvinceId={uiState.selectedProvinceId}
            selectedUnitId={uiState.selectedUnitId}
            onProvinceSelect={handleProvinceSelect}
          />
          <OverviewPanel
            worldState={worldState}
            selectedProvinceId={uiState.selectedProvinceId}
            selectedUnitId={uiState.selectedUnitId}
            recentMessages={recentMessages}
            isQueueingProduction={isQueueingProduction}
            onQueueUnit={handleQueueUnit}
            onSelectUnit={handleSelectUnit}
          />
        </div>
      ) : null}
    </AppShell>
  );
}
