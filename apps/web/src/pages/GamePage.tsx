import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MovementOrder, UnitTypeCode, WorldState } from '@rewar/shared';
import { AppShell } from '../components/ui';
import { StrategyMap } from '../components/map';
import { OverviewPanel } from '../components/panels';
import { fetchWorldState, sendMoveUnitsCommand, sendQueueUnitCommand } from '../lib/api/client';
import { initialUiState, type UiState } from '../lib/state/uiState';

const DEFAULT_SESSION_ID = 'starter-session';
const SESSION_OPTIONS = [
  { id: 'starter-session', label: 'Starter 12' },
  { id: 'us48-session', label: 'US 48' },
] as const;
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
  const [sessionId, setSessionId] = useState<string>(DEFAULT_SESSION_ID);
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
      const nextWorldState = await fetchWorldState(sessionId);
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

  return (
    <AppShell>
      <p style={{ marginTop: 0, color: '#cbd5e1' }}>
        Session: <strong>{worldState?.session.name ?? sessionId}</strong>
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {SESSION_OPTIONS.map((option) => {
          const isActive = option.id === sessionId;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                if (option.id !== sessionId) {
                  setSessionId(option.id);
                }
              }}
              disabled={isActive}
              style={{
                border: '1px solid #475569',
                borderRadius: 8,
                background: isActive ? '#1d4ed8' : '#0f172a',
                color: '#e2e8f0',
                padding: '8px 12px',
                cursor: isActive ? 'default' : 'pointer',
                opacity: isActive ? 1 : 0.9,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

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
            selectedUnitIds={uiState.selectedUnitIds}
            onProvinceSelect={handleProvinceSelect}
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
