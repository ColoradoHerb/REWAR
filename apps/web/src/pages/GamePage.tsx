import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  STARTER_WORLD_ID,
  US48_WORLD_ID,
  type MovementOrder,
  type UnitTypeCode,
  type WorldState,
} from '@rewar/shared';
import { STACK_COMBAT_BATCH_WINDOW_MS, createIncomeRateByNation } from '@rewar/rules';
import { AppShell } from '../components/ui';
import { StrategyMap } from '../components/map';
import { OverviewPanel } from '../components/panels';
import { createSession, fetchWorldState, sendMoveUnitsCommand, sendQueueUnitCommand } from '../lib/api/client';
import { initialUiState, type UiState } from '../lib/state/uiState';

const DEFAULT_SESSION_ID = 'starter-session';
const DEFAULT_SCENARIO_ID = STARTER_WORLD_ID;
const SCENARIO_OPTIONS = [
  { id: STARTER_WORLD_ID, label: 'Starter 12' },
  { id: US48_WORLD_ID, label: 'US 48' },
] as const;
const WORLD_POLL_INTERVAL_MS = 1_000;
const MAX_RECENT_MESSAGES = 6;

function getProvinceName(worldState: WorldState, provinceId: string) {
  return worldState.provinces.find((province) => province.id === provinceId)?.name ?? provinceId;
}

function getNationName(worldState: WorldState, nationId: string) {
  return worldState.nations.find((nation) => nation.id === nationId)?.name ?? nationId;
}

function compareUnitsByResolutionOrder(
  left: Pick<MovementOrder, 'arrivesAt' | 'id'>,
  right: Pick<MovementOrder, 'arrivesAt' | 'id'>,
) {
  if (left.arrivesAt !== right.arrivesAt) {
    return left.arrivesAt.localeCompare(right.arrivesAt);
  }

  return left.id.localeCompare(right.id);
}

type ArrivedOrderTransition = {
  previousOrder: MovementOrder;
  nextOrder: MovementOrder;
};

function groupArrivedOrderTransitions(transitions: ArrivedOrderTransition[]) {
  const groupedTransitions: ArrivedOrderTransition[][] = [];
  const sortedTransitions = [...transitions].sort((left, right) =>
    compareUnitsByResolutionOrder(left.nextOrder, right.nextOrder),
  );

  for (const transition of sortedTransitions) {
    const previousGroup = groupedTransitions[groupedTransitions.length - 1];
    const previousTransition = previousGroup?.[previousGroup.length - 1];

    if (
      previousTransition &&
      previousTransition.nextOrder.nationId === transition.nextOrder.nationId &&
      previousTransition.nextOrder.toProvinceId === transition.nextOrder.toProvinceId &&
      new Date(transition.nextOrder.arrivesAt).getTime() -
        new Date(previousGroup[0].nextOrder.arrivesAt).getTime() <=
        STACK_COMBAT_BATCH_WINDOW_MS
    ) {
      previousGroup.push(transition);
      continue;
    }

    groupedTransitions.push([transition]);
  }

  return groupedTransitions;
}

function buildCombatMessages(previousWorldState: WorldState | null, nextWorldState: WorldState) {
  if (!previousWorldState) {
    return [];
  }

  const previousOrdersById = new Map(
    previousWorldState.movementOrders.map((movementOrder) => [movementOrder.id, movementOrder]),
  );
  const previousUnitsById = new Map(previousWorldState.units.map((unit) => [unit.id, unit]));
  const nextUnitsById = new Map(nextWorldState.units.map((unit) => [unit.id, unit]));
  const messages: string[] = [];
  const arrivedTransitions = nextWorldState.movementOrders.flatMap((nextOrder) => {
    const previousOrder = previousOrdersById.get(nextOrder.id);

    return previousOrder && previousOrder.status === 'active' && nextOrder.status === 'arrived'
      ? [{ previousOrder, nextOrder }]
      : [];
  });

  for (const transitionGroup of groupArrivedOrderTransitions(arrivedTransitions)) {
    const [firstTransition] = transitionGroup;

    if (!firstTransition) {
      continue;
    }

    const attackerNationId = firstTransition.nextOrder.nationId;
    const provinceId = firstTransition.nextOrder.toProvinceId;
    const previousProvinceOwnerId =
      previousWorldState.provinceStates.find((provinceState) => provinceState.provinceId === provinceId)
        ?.ownerNationId ?? null;

    if (!previousProvinceOwnerId || previousProvinceOwnerId === attackerNationId) {
      continue;
    }

    const attackersBefore = transitionGroup.flatMap((transition) => {
      const attacker = previousUnitsById.get(transition.nextOrder.unitId);
      return attacker && attacker.status !== 'destroyed' ? [attacker] : [];
    });
    const defendersBefore = previousWorldState.units.filter(
      (unit) =>
        unit.provinceId === provinceId &&
        unit.nationId === previousProvinceOwnerId &&
        unit.status !== 'destroyed',
    );

    if (attackersBefore.length === 0 || defendersBefore.length === 0) {
      continue;
    }

    const attackerSurvivors = attackersBefore
      .map((attacker) => nextUnitsById.get(attacker.id) ?? null)
      .filter(
        (unit): unit is WorldState['units'][number] =>
          Boolean(unit && unit.status !== 'destroyed'),
      );
    const defenderSurvivors = defendersBefore
      .map((defender) => nextUnitsById.get(defender.id) ?? null)
      .filter(
        (unit): unit is WorldState['units'][number] =>
          Boolean(unit && unit.status !== 'destroyed'),
      );

    const attackerLosses = attackersBefore.length - attackerSurvivors.length;
    const defenderLosses = defendersBefore.length - defenderSurvivors.length;
    const provinceName = getProvinceName(nextWorldState, provinceId);
    const attackerNationName = getNationName(nextWorldState, attackerNationId);
    const defenderNationName = getNationName(nextWorldState, previousProvinceOwnerId);
    const provinceOwnerAfter =
      nextWorldState.provinceStates.find((provinceState) => provinceState.provinceId === provinceId)
        ?.ownerNationId ?? null;

    if (attackerSurvivors.length > 0 && defenderSurvivors.length === 0) {
      messages.unshift(
        `Battle at ${provinceName}: ${attackerNationName} victory. Lost ${attackerLosses}; defenders lost ${defenderLosses}${
          provinceOwnerAfter === attackerNationId ? '; province captured.' : '.'
        }`,
      );
      continue;
    }

    messages.unshift(
      `Battle at ${provinceName}: ${defenderNationName} held. Attackers lost ${attackerLosses}; defenders lost ${defenderLosses}.`,
    );
  }

  return messages;
}

export function GamePage() {
  const [sessionId, setSessionId] = useState<string>(DEFAULT_SESSION_ID);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(DEFAULT_SCENARIO_ID);
  const [worldState, setWorldState] = useState<WorldState | null>(null);
  const [uiState, setUiState] = useState<UiState>(initialUiState);
  const [recentMessages, setRecentMessages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isIssuingMove, setIsIssuingMove] = useState(false);
  const [isQueueingProduction, setIsQueueingProduction] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const worldStateRef = useRef<WorldState | null>(null);

  const loadWorld = useCallback(async (options?: { background?: boolean; sessionId?: string }) => {
    const isBackgroundRefresh = options?.background ?? false;
    const targetSessionId = options?.sessionId ?? sessionId;

    if (!isBackgroundRefresh) {
      setIsLoading(true);
    }

    try {
      const nextWorldState = await fetchWorldState(targetSessionId);
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
        const hasSelectedProvince =
          currentUiState.selectedProvinceId &&
          nextWorldState.provinces.some((province) => province.id === currentUiState.selectedProvinceId);
        const nextSelectedUnits = currentUiState.selectedUnitIds
          .map((selectedUnitId) =>
            nextWorldState.units.find((unit) => unit.id === selectedUnitId) ?? null,
          )
          .filter(
            (unit): unit is WorldState['units'][number] =>
              Boolean(
                unit &&
                  unit.status === 'idle' &&
                  unit.status !== 'destroyed' &&
                  unit.nationId === nextWorldState.session.humanNationId,
              ),
          );
        const selectedUnitsShareOrigin =
          nextSelectedUnits.length > 0 &&
          nextSelectedUnits.every((unit) => unit.provinceId === nextSelectedUnits[0]?.provinceId);

        if (selectedUnitsShareOrigin) {
          return {
            selectedUnitIds: nextSelectedUnits.map((unit) => unit.id),
            selectedProvinceId:
              hasSelectedProvince && currentUiState.selectedProvinceId === nextSelectedUnits[0]?.provinceId
                ? currentUiState.selectedProvinceId
                : nextSelectedUnits[0]?.provinceId ?? null,
          };
        }

        return {
          selectedUnitIds: [],
          selectedProvinceId: hasSelectedProvince ? currentUiState.selectedProvinceId : null,
        };
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load world.');
    } finally {
      if (!isBackgroundRefresh) {
        setIsLoading(false);
      }
    }
  }, [sessionId]);

  useEffect(() => {
    worldStateRef.current = null;
    setWorldState(null);
    setUiState(initialUiState);
    setRecentMessages([]);
    setErrorMessage(null);
    void loadWorld();
  }, [loadWorld, sessionId]);

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
  const selectedUnits = useMemo(
    () => activeUnits.filter((unit) => uiState.selectedUnitIds.includes(unit.id)),
    [activeUnits, uiState.selectedUnitIds],
  );
  const selectedGroupOriginProvinceId = useMemo(() => {
    if (selectedUnits.length === 0) {
      return null;
    }

    const [firstSelectedUnit] = selectedUnits;

    if (!firstSelectedUnit) {
      return null;
    }

    return selectedUnits.every(
      (unit) => unit.status === 'idle' && unit.provinceId === firstSelectedUnit.provinceId,
    )
      ? firstSelectedUnit.provinceId
      : null;
  }, [selectedUnits]);
  const humanNation = useMemo(
    () => worldState?.nations.find((nation) => nation.id === worldState.session.humanNationId) ?? null,
    [worldState],
  );
  const incomeRateByNation = useMemo(
    () => (worldState ? createIncomeRateByNation(worldState.provinces, worldState.provinceStates) : new Map()),
    [worldState],
  );
  const activeMoveCount = useMemo(
    () => worldState?.movementOrders.filter((order) => order.status === 'active').length ?? 0,
    [worldState],
  );
  const activeProductionCount = useMemo(
    () => worldState?.productionQueues.filter((queue) => queue.status === 'building').length ?? 0,
    [worldState],
  );
  const humanBalanceByResourceCode = useMemo(
    () =>
      new Map(
        (worldState?.balances ?? [])
          .filter((balance) => balance.nationId === worldState?.session.humanNationId)
          .map((balance) => [balance.resourceCode, balance.amount]),
      ),
    [worldState],
  );
  const currentSeedWorldId = worldState?.session.seedWorldId ?? DEFAULT_SCENARIO_ID;
  const newGameButtonLabel =
    !worldState || selectedScenarioId !== currentSeedWorldId ? 'New Game' : 'Restart Scenario';

  const handleProvinceSelect = useCallback(
    async (provinceId: string) => {
      if (!worldState) {
        return;
      }

      const clickedProvinceUnits = activeUnits.filter((unit) => unit.provinceId === provinceId);
      const clickedHumanIdleUnits = clickedProvinceUnits.filter(
        (unit) =>
          unit.nationId === worldState.session.humanNationId &&
          unit.status === 'idle',
      );

      const canIssueMove =
        selectedGroupOriginProvinceId &&
        selectedUnits.length > 0 &&
        selectedGroupOriginProvinceId !== provinceId &&
        worldState.edges.some(
          (edge) =>
            edge.fromProvinceId === selectedGroupOriginProvinceId && edge.toProvinceId === provinceId,
        );

      if (canIssueMove) {
        try {
          setIsIssuingMove(true);
          setErrorMessage(null);
          await sendMoveUnitsCommand(
            worldState.session.id,
            selectedUnits.map((unit) => unit.id),
            provinceId,
          );
          setUiState({
            selectedProvinceId: provinceId,
            selectedUnitIds: [],
          });
          await loadWorld({ background: true });
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : 'Failed to issue MOVE_UNITS.');
        } finally {
          setIsIssuingMove(false);
        }
        return;
      }

      setUiState((currentUiState) => {
        const selectedUnitIdsForProvince =
          currentUiState.selectedProvinceId === provinceId
            ? currentUiState.selectedUnitIds.filter((unitId) =>
                clickedHumanIdleUnits.some((unit) => unit.id === unitId),
              )
            : [];

        return {
          selectedProvinceId: provinceId,
          selectedUnitIds:
            selectedUnitIdsForProvince.length > 0
              ? selectedUnitIdsForProvince
              : clickedHumanIdleUnits[0]
                ? [clickedHumanIdleUnits[0].id]
                : [],
        };
      });
    },
    [activeUnits, loadWorld, selectedGroupOriginProvinceId, selectedUnits, worldState],
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

  const handleToggleUnitSelection = useCallback((unitId: string) => {
    if (!worldState) {
      return;
    }

    const unit = activeUnits.find((entry) => entry.id === unitId);

    if (
      !unit ||
      unit.nationId !== worldState.session.humanNationId ||
      unit.status !== 'idle' ||
      unit.status === 'destroyed'
    ) {
      return;
    }

    setUiState((currentUiState) => {
      if (currentUiState.selectedProvinceId !== unit.provinceId) {
        return {
          selectedProvinceId: unit.provinceId,
          selectedUnitIds: [unit.id],
        };
      }

      const isSelected = currentUiState.selectedUnitIds.includes(unit.id);

      return {
        selectedProvinceId: currentUiState.selectedProvinceId,
        selectedUnitIds: isSelected
          ? currentUiState.selectedUnitIds.filter((selectedUnitId) => selectedUnitId !== unit.id)
          : [...currentUiState.selectedUnitIds, unit.id],
      };
    });
  }, [activeUnits, worldState]);

  const handleSelectAllIdleUnits = useCallback(() => {
    if (!worldState || !uiState.selectedProvinceId) {
      return;
    }

    const idleFriendlyUnitIds = activeUnits
      .filter(
        (unit) =>
          unit.provinceId === uiState.selectedProvinceId &&
          unit.nationId === worldState.session.humanNationId &&
          unit.status === 'idle',
      )
      .map((unit) => unit.id);

    setUiState((currentUiState) => ({
      selectedProvinceId: currentUiState.selectedProvinceId,
      selectedUnitIds: idleFriendlyUnitIds,
    }));
  }, [activeUnits, uiState.selectedProvinceId, worldState]);

  const handleClearUnitSelection = useCallback(() => {
    setUiState((currentUiState) => ({
      selectedProvinceId: currentUiState.selectedProvinceId,
      selectedUnitIds: [],
    }));
  }, []);

  const handleCreateOrRestartSession = useCallback(async () => {
    try {
      setIsCreatingSession(true);
      setErrorMessage(null);

      const nextSession = await createSession({
        seedWorldId: selectedScenarioId,
        replaceSessionId: sessionId,
      });

      worldStateRef.current = null;
      setRecentMessages([]);
      setUiState(initialUiState);

      if (nextSession.sessionId !== sessionId) {
        setSessionId(nextSession.sessionId);
        return;
      }

      await loadWorld({ sessionId: nextSession.sessionId });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create a fresh session.');
    } finally {
      setIsCreatingSession(false);
    }
  }, [loadWorld, selectedScenarioId, sessionId]);

  const handleProvinceDoubleClick = useCallback((provinceId: string) => {
    if (!worldState) {
      return;
    }

    const idleFriendlyUnitIds = activeUnits
      .filter(
        (unit) =>
          unit.provinceId === provinceId &&
          unit.nationId === worldState.session.humanNationId &&
          unit.status === 'idle',
      )
      .map((unit) => unit.id);

    setUiState({
      selectedProvinceId: provinceId,
      selectedUnitIds: idleFriendlyUnitIds,
    });
  }, [activeUnits, worldState]);

  return (
    <AppShell>
      <section
        style={{
          border: '1px solid #314152',
          borderRadius: 16,
          padding: 16,
          background: 'linear-gradient(180deg, rgba(24,33,44,0.98) 0%, rgba(13,19,27,0.98) 100%)',
          boxShadow: '0 18px 34px rgba(2, 6, 23, 0.28)',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: 1.6,
                color: '#9fb0be',
                marginBottom: 6,
              }}
            >
              Strategic Command
            </div>
            <h2 style={{ margin: 0, fontSize: 24 }}>
              {worldState?.session.name ?? sessionId}
            </h2>
            <p style={{ margin: '8px 0 0', color: '#94a3b8' }}>
              {humanNation ? `${humanNation.name} operational overview` : 'Loading command data...'}
            </p>
          </div>

          {worldState ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {worldState.resources.map((resource) => (
                <div
                  key={resource.code}
                  style={{
                    minWidth: 128,
                    border: '1px solid #3b4d5e',
                    borderRadius: 12,
                    padding: '10px 12px',
                    background: 'rgba(11, 17, 24, 0.92)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: 1.1,
                      color: '#91a3b5',
                    }}
                  >
                    {resource.name}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
                    {humanBalanceByResourceCode.get(resource.code) ?? 0}
                  </div>
                  <div style={{ fontSize: 12, color: '#c9d4de', marginTop: 2 }}>
                    +{incomeRateByNation.get(worldState.session.humanNationId)?.get(resource.code) ?? 0}/min
                  </div>
                </div>
              ))}
              <div
                style={{
                  border: '1px solid #3b4d5e',
                  borderRadius: 12,
                  padding: '10px 12px',
                  background: 'rgba(11, 17, 24, 0.92)',
                  minWidth: 128,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: 1.1,
                    color: '#91a3b5',
                  }}
                >
                  Operational Tempo
                </div>
                <div style={{ fontSize: 13, marginTop: 5, lineHeight: 1.5 }}>
                  <div>Active moves: {activeMoveCount}</div>
                  <div>Active builds: {activeProductionCount}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        {SCENARIO_OPTIONS.map((option) => {
          const isActive = option.id === selectedScenarioId;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                if (option.id !== selectedScenarioId) {
                  setSelectedScenarioId(option.id);
                }
              }}
              style={{
                border: '1px solid #475569',
                borderRadius: 10,
                background: isActive ? '#314558' : '#101720',
                color: '#e2e8f0',
                padding: '8px 14px',
                cursor: 'pointer',
                opacity: isActive ? 1 : 0.9,
              }}
            >
              {option.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => {
            void handleCreateOrRestartSession();
          }}
          disabled={isCreatingSession}
          style={{
            border: '1px solid #6b7280',
            borderRadius: 10,
            background: isCreatingSession ? '#1f2937' : '#27384a',
            color: '#f8fafc',
            padding: '8px 14px',
            cursor: isCreatingSession ? 'not-allowed' : 'pointer',
            fontWeight: 700,
          }}
        >
          {isCreatingSession ? 'Resetting...' : newGameButtonLabel}
        </button>
        <span style={{ color: '#94a3b8', fontSize: 13 }}>
          Scenario for next fresh start: {SCENARIO_OPTIONS.find((option) => option.id === selectedScenarioId)?.label}
        </span>
      </div>

      {isCreatingSession ? (
        <p style={{ marginTop: 0, color: '#d5dde6' }}>Creating a fresh session from the selected scenario...</p>
      ) : null}

      {isIssuingMove ? (
        <p style={{ marginTop: 0, color: '#9fc2d7' }}>Issuing movement order...</p>
      ) : null}

      {isQueueingProduction ? (
        <p style={{ marginTop: 0, color: '#d6b46a' }}>Queueing production...</p>
      ) : null}

      {isLoading ? (
        <section
          style={{
            border: '1px solid #314152',
            borderRadius: 16,
            padding: 24,
            background: 'linear-gradient(180deg, rgba(20,29,38,0.98) 0%, rgba(12,18,25,0.98) 100%)',
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
            borderRadius: 16,
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
            gap: 20,
            gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)',
            alignItems: 'start',
          }}
        >
          <StrategyMap
            worldState={worldState}
            selectedProvinceId={uiState.selectedProvinceId}
            selectedUnitIds={uiState.selectedUnitIds}
            onProvinceSelect={handleProvinceSelect}
            onProvinceDoubleClick={handleProvinceDoubleClick}
          />
          <OverviewPanel
            worldState={worldState}
            selectedProvinceId={uiState.selectedProvinceId}
            selectedUnitIds={uiState.selectedUnitIds}
            recentMessages={recentMessages}
            isQueueingProduction={isQueueingProduction}
            onQueueUnit={handleQueueUnit}
            onToggleUnitSelection={handleToggleUnitSelection}
            onSelectAllIdleUnits={handleSelectAllIdleUnits}
            onClearUnitSelection={handleClearUnitSelection}
          />
        </div>
      ) : null}
    </AppShell>
  );
}
