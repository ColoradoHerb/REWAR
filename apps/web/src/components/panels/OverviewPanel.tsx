import type { CSSProperties, PropsWithChildren } from 'react';
import type {
  NationResourceBalance,
  ResourceCode,
  TerrainType,
  UnitTypeCode,
  WorldState,
} from '@rewar/shared';
import { createIncomeRateByNation } from '@rewar/rules';

type OverviewPanelProps = {
  worldState: WorldState;
  selectedProvinceId: string | null;
  selectedUnitIds: string[];
  recentMessages: string[];
  isQueueingProduction: boolean;
  onQueueUnit: (provinceId: string, unitTypeCode: UnitTypeCode) => void | Promise<void>;
  onToggleUnitSelection: (unitId: string) => void;
  onSelectAllIdleUnits: () => void;
  onClearUnitSelection: () => void;
};

function getBalanceAmount(balances: NationResourceBalance[], nationId: string, resourceCode: string) {
  return (
    balances.find((balance) => balance.nationId === nationId && balance.resourceCode === resourceCode)
      ?.amount ?? 0
  );
}

function formatCost(cost: Partial<Record<ResourceCode, number>>) {
  return Object.entries(cost)
    .filter((entry): entry is [ResourceCode, number] => typeof entry[1] === 'number' && entry[1] > 0)
    .map(([resourceCode, amount]) => `${resourceCode} ${amount}`)
    .join(', ');
}

function formatYieldPerMinute(baseYield: Partial<Record<ResourceCode, number>>) {
  return Object.entries(baseYield)
    .filter((entry): entry is [ResourceCode, number] => typeof entry[1] === 'number' && entry[1] > 0)
    .map(([resourceCode, amount]) => `${resourceCode} +${amount}/min`)
    .join(', ');
}

function formatTerrainLabel(terrainType: TerrainType) {
  switch (terrainType) {
    case 'plains':
      return 'Plains';
    case 'hills':
      return 'Hills';
    case 'mountains':
      return 'Mountains';
    case 'forest':
      return 'Forest';
    default:
      return terrainType;
  }
}

const terrainLegendItems: Array<{
  terrainType: TerrainType;
  label: string;
  swatchBackground: string;
}> = [
  {
    terrainType: 'plains',
    label: 'Plains overlay',
    swatchBackground:
      'radial-gradient(circle at 4px 4px, rgba(239, 227, 184, 0.95) 0 1px, transparent 1.4px), #1a222d',
  },
  {
    terrainType: 'hills',
    label: 'Hills overlay',
    swatchBackground:
      'repeating-linear-gradient(-25deg, rgba(223, 207, 171, 0.55) 0 2px, transparent 2px 8px), #1a222d',
  },
  {
    terrainType: 'mountains',
    label: 'Mountains overlay',
    swatchBackground:
      'repeating-linear-gradient(135deg, rgba(239, 227, 184, 0.6) 0 2px, transparent 2px 9px), #1a222d',
  },
  {
    terrainType: 'forest',
    label: 'Forest overlay',
    swatchBackground:
      'radial-gradient(circle at 5px 5px, rgba(183, 214, 176, 0.9) 0 1.2px, transparent 1.4px), radial-gradient(circle at 11px 10px, rgba(215, 230, 204, 0.72) 0 1.2px, transparent 1.5px), #1a222d',
  },
];

const panelStyle: CSSProperties = {
  border: '1px solid #2d3946',
  borderRadius: 16,
  padding: 16,
  background: 'linear-gradient(180deg, rgba(20,29,38,0.98) 0%, rgba(12,18,25,0.98) 100%)',
  boxShadow: '0 18px 34px rgba(2, 6, 23, 0.28)',
  position: 'sticky',
  top: 20,
};

const sectionStyle: CSSProperties = {
  border: '1px solid #23303c',
  borderRadius: 14,
  padding: 14,
  background: 'rgba(5, 10, 15, 0.66)',
};

const subtleTextStyle: CSSProperties = {
  color: '#94a3b8',
  marginTop: 0,
};

function PanelSection({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <div style={sectionStyle}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
        {description ? (
          <p style={{ ...subtleTextStyle, marginBottom: 0, marginTop: 6, fontSize: 13 }}>{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function getActionButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: '1px solid #475569',
    borderRadius: 8,
    background: disabled ? '#101720' : '#152131',
    color: disabled ? '#64748b' : '#e2e8f0',
    padding: '7px 10px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 13,
  };
}

export function OverviewPanel({
  worldState,
  selectedProvinceId,
  selectedUnitIds,
  recentMessages,
  isQueueingProduction,
  onQueueUnit,
  onToggleUnitSelection,
  onSelectAllIdleUnits,
  onClearUnitSelection,
}: OverviewPanelProps) {
  const activeUnits = worldState.units.filter((unit) => unit.status !== 'destroyed');
  const selectedUnitIdSet = new Set(selectedUnitIds);
  const serverTimeMs = new Date(worldState.serverTime).getTime();
  const nationById = new Map(worldState.nations.map((nation) => [nation.id, nation]));
  const unitTypeByCode = new Map(worldState.unitTypes.map((unitType) => [unitType.code, unitType]));
  const provinceById = new Map(worldState.provinces.map((province) => [province.id, province]));
  const incomeRateByNation = createIncomeRateByNation(worldState.provinces, worldState.provinceStates);
  const provinceStateById = new Map(
    worldState.provinceStates.map((provinceState) => [provinceState.provinceId, provinceState]),
  );
  const movementOrderByUnitId = new Map(
    worldState.movementOrders
      .filter((movementOrder) => movementOrder.status === 'active')
      .map((movementOrder) => [movementOrder.unitId, movementOrder]),
  );
  const activeProductionQueueByProvinceId = new Map(
    worldState.productionQueues
      .filter((queue) => queue.status === 'building')
      .map((queue) => [queue.provinceId, queue]),
  );
  const humanBalancesByResourceCode = new Map<ResourceCode, number>(
    worldState.balances
      .filter((balance) => balance.nationId === worldState.session.humanNationId)
      .map((balance) => [balance.resourceCode, balance.amount]),
  );

  const selectedProvince = selectedProvinceId ? provinceById.get(selectedProvinceId) ?? null : null;
  const selectedProvinceState = selectedProvince ? provinceStateById.get(selectedProvince.id) : null;
  const selectedOwner = selectedProvinceState ? nationById.get(selectedProvinceState.ownerNationId) : null;
  const selectedProductionQueue = selectedProvince
    ? activeProductionQueueByProvinceId.get(selectedProvince.id) ?? null
    : null;
  const selectedProvinceUnits = selectedProvince
    ? activeUnits.filter((unit) => unit.provinceId === selectedProvince.id)
    : [];
  const selectedFriendlyUnits = selectedProvinceUnits.filter(
    (unit) => unit.nationId === worldState.session.humanNationId,
  );
  const selectedEnemyUnits = selectedProvinceUnits.filter(
    (unit) => unit.nationId !== worldState.session.humanNationId,
  );
  const selectedIdleFriendlyUnits = selectedFriendlyUnits.filter((unit) => unit.status === 'idle');
  const selectedGroupUnits = activeUnits.filter((unit) => selectedUnitIdSet.has(unit.id));
  const selectedGroupOriginProvinceId =
    selectedGroupUnits.length > 0 &&
    selectedGroupUnits.every((unit) => unit.status === 'idle' && unit.provinceId === selectedGroupUnits[0]?.provinceId)
      ? selectedGroupUnits[0]?.provinceId ?? null
      : null;
  const selectedGroupOriginProvince = selectedGroupOriginProvinceId
    ? provinceById.get(selectedGroupOriginProvinceId) ?? null
    : null;
  const selectedSingleUnit = selectedGroupUnits.length === 1 ? selectedGroupUnits[0] : null;
  const selectedSingleUnitType = selectedSingleUnit
    ? unitTypeByCode.get(selectedSingleUnit.unitTypeCode)
    : null;
  const selectedSingleUnitNation = selectedSingleUnit
    ? nationById.get(selectedSingleUnit.nationId)
    : null;
  const selectedSingleUnitOrder = selectedSingleUnit
    ? movementOrderByUnitId.get(selectedSingleUnit.id)
    : null;
  const selectedSingleUnitDestination = selectedSingleUnitOrder
    ? provinceById.get(selectedSingleUnitOrder.toProvinceId)
    : null;
  const selectedProvinceCanProduce = Boolean(
    selectedProvince &&
      selectedProvince.isProductionCenter &&
      selectedProvinceState?.ownerNationId === worldState.session.humanNationId,
  );
  const selectedProvinceBuildOptions = selectedProvince
    ? selectedProvince.buildableUnitTypes.flatMap((unitTypeCode) => {
        const unitType = unitTypeByCode.get(unitTypeCode);
        return unitType ? [unitType] : [];
      })
    : [];

  return (
    <section style={panelStyle}>
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: 1.6,
            color: '#9fb0be',
            marginBottom: 6,
          }}
        >
          Operations Briefing
        </div>
        <h2 style={{ margin: 0, fontSize: 24 }}>World Overview</h2>
        <p style={{ ...subtleTextStyle, marginBottom: 0, marginTop: 8 }}>
          Province control, force selection, production, and combat reports.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ order: 4 }}>
        <PanelSection title="Operational Snapshot">
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {[
              { label: 'Session', value: worldState.session.name },
              { label: 'Nations', value: worldState.nations.length },
              { label: 'Provinces', value: worldState.provinces.length },
              { label: 'Units', value: activeUnits.length },
              {
                label: 'Active Moves',
                value: worldState.movementOrders.filter((order) => order.status === 'active').length,
              },
              {
                label: 'Production Centers',
                value: worldState.provinces.filter((province) => province.isProductionCenter).length,
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  border: '1px solid #2a3744',
                  borderRadius: 12,
                  padding: '10px 12px',
                  background: 'rgba(10, 16, 22, 0.82)',
                }}
              >
                <div style={{ color: '#91a3b5', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {item.label}
                </div>
                <div style={{ marginTop: 5, fontSize: 17, fontWeight: 700 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </PanelSection>
        </div>

        <div style={{ order: 3 }}>
        <PanelSection title="Recent Combat">
          {recentMessages.length > 0 ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {recentMessages.map((message, index) => (
                <div
                  key={`${message}-${index}`}
                  style={{
                    border: '1px solid #324152',
                    borderRadius: 10,
                    padding: '9px 10px',
                    background: 'rgba(14, 21, 29, 0.82)',
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                >
                  {message}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ ...subtleTextStyle, marginBottom: 0 }}>No combat resolved yet.</p>
          )}
        </PanelSection>
        </div>

        <div style={{ order: 2 }}>
        <PanelSection
          title="Selected Force"
          description="Double-click a province to grab all idle friendly units there."
        >
          {selectedGroupUnits.length === 0 ? (
            <p style={{ ...subtleTextStyle, marginBottom: 0 }}>
              Select one or more idle friendly units in the selected province to issue a group move.
            </p>
          ) : (
            <div
              style={{
                border: '1px solid #2a3744',
                borderRadius: 12,
                padding: 12,
                background: 'rgba(10, 16, 22, 0.82)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 10,
                }}
              >
                <strong>
                  {selectedGroupUnits.length} unit{selectedGroupUnits.length === 1 ? '' : 's'} selected
                </strong>
                <span
                  style={{
                    border: '1px solid #435466',
                    borderRadius: 999,
                    padding: '4px 10px',
                    fontSize: 12,
                    color: '#d5dde6',
                    background: '#121a24',
                  }}
                >
                  Origin: {selectedGroupOriginProvince?.name ?? 'Mixed selection'}
                </span>
              </div>

              {selectedSingleUnit ? (
                <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                  <div>Type: <strong>{selectedSingleUnitType?.name ?? selectedSingleUnit.unitTypeCode}</strong></div>
                  <div>Nation: {selectedSingleUnitNation?.name ?? selectedSingleUnit.nationId}</div>
                  <div>Status: {selectedSingleUnit.status === 'moving' ? 'Moving' : 'Idle'}</div>
                  <div>Strength: {selectedSingleUnit.currentStrength}</div>
                  <div style={{ color: '#d7e0e9' }}>
                    {selectedSingleUnitOrder
                      ? `Moving to ${selectedSingleUnitDestination?.name ?? selectedSingleUnitOrder.toProvinceId}.`
                      : 'Ready to move to an adjacent province.'}
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {selectedGroupUnits.map((unit) => {
                      const unitType = unitTypeByCode.get(unit.unitTypeCode);
                      return (
                        <div
                          key={unit.id}
                          style={{
                            border: '1px solid #314152',
                            borderRadius: 10,
                            padding: '8px 10px',
                            background: '#101720',
                            fontSize: 13,
                          }}
                        >
                          <strong>{unitType?.name ?? unit.unitTypeCode}</strong> - strength {unit.currentStrength}
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ color: '#cbd5e1', marginBottom: 0, marginTop: 10 }}>
                    Click an adjacent highlighted province or state to move the selected group.
                  </p>
                </>
              )}
            </div>
          )}
        </PanelSection>
        </div>

        <div style={{ order: 5 }}>
        <PanelSection title="Strategic Ledger">
          <div style={{ display: 'grid', gap: 10 }}>
            {worldState.nations.map((nation) => (
              <div
                key={nation.id}
                style={{
                  border: '1px solid #2a3744',
                  borderRadius: 12,
                  padding: 12,
                  background: 'rgba(10, 16, 22, 0.82)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      background: nation.colorHex,
                      display: 'inline-block',
                    }}
                  />
                  <strong>{nation.name}</strong>
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {worldState.resources.map((resource) => (
                    <div key={resource.code} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ color: '#cbd5e1' }}>{resource.name}</span>
                      <span>
                        {getBalanceAmount(worldState.balances, nation.id, resource.code)}
                        {nation.id === worldState.session.humanNationId
                          ? ` (+${incomeRateByNation.get(nation.id)?.get(resource.code) ?? 0}/min)`
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PanelSection>
        </div>

        <div style={{ order: 1 }}>
        <PanelSection title="Selected Province">
          {!selectedProvince ? (
            <p style={{ ...subtleTextStyle, marginBottom: 0 }}>Click a province on the map to inspect it.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <div
                style={{
                  border: '1px solid #2a3744',
                  borderRadius: 12,
                  padding: 12,
                  background: 'rgba(10, 16, 22, 0.82)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedProvince.name}</div>
                    <div style={{ ...subtleTextStyle, marginBottom: 0, marginTop: 4 }}>
                      Owner: {selectedOwner?.name ?? 'Unclaimed'}
                    </div>
                  </div>
                  <div
                    style={{
                      border: '1px solid #435466',
                      borderRadius: 999,
                      padding: '5px 10px',
                      background: '#121a24',
                      fontSize: 12,
                      height: 'fit-content',
                    }}
                  >
                    {selectedProvince.isProductionCenter ? 'Production Center: Yes' : 'Production Center: No'}
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 10,
                    marginTop: 12,
                  }}
                >
                    {[
                      { label: 'Terrain', value: formatTerrainLabel(selectedProvince.terrainType) },
                      { label: 'Yield', value: formatYieldPerMinute(selectedProvince.baseYield) || 'None' },
                      { label: 'Production Center', value: selectedProvince.isProductionCenter ? 'Yes' : 'No' },
                      { label: 'Units Present', value: selectedProvinceUnits.length },
                      { label: 'Friendly', value: selectedFriendlyUnits.length },
                      { label: 'Enemy', value: selectedEnemyUnits.length },
                      {
                        label: 'Build Status',
                        value: selectedProvince.isProductionCenter
                          ? selectedProductionQueue
                            ? 'Active'
                            : 'Idle'
                          : 'Unavailable',
                      },
                    ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        border: '1px solid #314152',
                        borderRadius: 10,
                        padding: '8px 10px',
                        background: '#101720',
                      }}
                    >
                      <div style={{ color: '#91a3b5', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {item.label}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 14 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  border: '1px solid #2a3744',
                  borderRadius: 12,
                  padding: 12,
                  background: 'rgba(10, 16, 22, 0.82)',
                }}
              >
                <h4 style={{ marginTop: 0, marginBottom: 10 }}>Production</h4>

                {!selectedProvince.isProductionCenter ? (
                  <p style={{ ...subtleTextStyle, marginBottom: 0 }}>
                    Production Center: No. This state cannot build units.
                  </p>
                ) : !selectedProvinceCanProduce ? (
                  <p style={{ ...subtleTextStyle, marginBottom: 0 }}>Only owned production centers can build units.</p>
                ) : selectedProductionQueue ? (
                  (() => {
                    const queuedUnitType = unitTypeByCode.get(selectedProductionQueue.unitTypeCode);
                    const startedAtMs = new Date(selectedProductionQueue.startedAt).getTime();
                    const completesAtMs = new Date(selectedProductionQueue.completesAt).getTime();
                    const totalMs = Math.max(1, completesAtMs - startedAtMs);
                    const elapsedMs = Math.max(0, Math.min(totalMs, serverTimeMs - startedAtMs));
                    const progressPercent = Math.round((elapsedMs / totalMs) * 100);
                    const remainingSeconds = Math.max(0, Math.ceil((completesAtMs - serverTimeMs) / 1_000));

                    return (
                      <div
                        style={{
                          border: '1px solid #324152',
                          borderRadius: 10,
                          padding: 12,
                          background: '#101720',
                        }}
                      >
                        <p style={{ marginTop: 0 }}>
                          Building: <strong>{queuedUnitType?.name ?? selectedProductionQueue.unitTypeCode}</strong>
                        </p>
                        <div
                          style={{
                            width: '100%',
                            height: 10,
                            borderRadius: 999,
                            background: '#1c2733',
                            overflow: 'hidden',
                            marginBottom: 10,
                          }}
                        >
                          <div
                            style={{
                              width: `${progressPercent}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #8f6a28 0%, #d7b76b 100%)',
                            }}
                          />
                        </div>
                        <p style={{ margin: 0 }}>Progress: {progressPercent}% - Remaining: {remainingSeconds}s</p>
                      </div>
                    );
                  })()
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {selectedProvinceBuildOptions.map((unitType) => {
                      const hasEnoughResources = Object.entries(unitType.cost).every(([resourceCode, amount]) => {
                        if (typeof amount !== 'number') {
                          return true;
                        }

                        return (humanBalancesByResourceCode.get(resourceCode as ResourceCode) ?? 0) >= amount;
                      });

                      return (
                        <button
                          key={unitType.code}
                          type="button"
                          disabled={!hasEnoughResources || isQueueingProduction}
                          onClick={() => {
                            void onQueueUnit(selectedProvince.id, unitType.code);
                          }}
                          style={{
                            border: '1px solid #475569',
                            borderRadius: 10,
                            background: !hasEnoughResources || isQueueingProduction ? '#101720' : '#152131',
                            color: !hasEnoughResources || isQueueingProduction ? '#64748b' : '#e2e8f0',
                            padding: '10px 12px',
                            textAlign: 'left',
                            cursor: !hasEnoughResources || isQueueingProduction ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <strong>{unitType.name}</strong>
                          <div style={{ fontSize: 12, marginTop: 4 }}>
                            Cost: {formatCost(unitType.cost)} - Build: {unitType.buildTimeSeconds}s
                          </div>
                          {!hasEnoughResources ? (
                            <div style={{ fontSize: 12, marginTop: 4 }}>Insufficient resources</div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedProvinceUnits.length > 0 ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div
                    style={{
                      border: '1px solid #2a3744',
                      borderRadius: 12,
                      padding: 12,
                      background: 'rgba(10, 16, 22, 0.82)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <h4 style={{ margin: 0 }}>Friendly Units</h4>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={onSelectAllIdleUnits}
                          disabled={selectedIdleFriendlyUnits.length === 0}
                          style={getActionButtonStyle(selectedIdleFriendlyUnits.length === 0)}
                        >
                          Select all idle
                        </button>
                        <button
                          type="button"
                          onClick={onClearUnitSelection}
                          disabled={selectedUnitIds.length === 0}
                          style={getActionButtonStyle(selectedUnitIds.length === 0)}
                        >
                          Clear selection
                        </button>
                      </div>
                    </div>

                    <p style={{ ...subtleTextStyle, marginBottom: 10 }}>
                      Selected here: {selectedGroupUnits.filter((unit) => unit.provinceId === selectedProvince.id).length}
                    </p>

                    {selectedFriendlyUnits.length > 0 ? (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {selectedFriendlyUnits.map((unit) => {
                          const unitNation = nationById.get(unit.nationId);
                          const unitType = unitTypeByCode.get(unit.unitTypeCode);
                          const activeOrder = movementOrderByUnitId.get(unit.id);
                          const isSelectedUnit = selectedUnitIdSet.has(unit.id);
                          const canSelectUnit = unit.status === 'idle';

                          return (
                            <label
                              key={unit.id}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 10,
                                border: isSelectedUnit ? '1px solid #d7c88f' : '1px solid #314152',
                                borderRadius: 10,
                                padding: '9px 10px',
                                background: isSelectedUnit ? '#151a1c' : '#101720',
                                cursor: canSelectUnit ? 'pointer' : 'default',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelectedUnit}
                                disabled={!canSelectUnit}
                                onChange={() => {
                                  onToggleUnitSelection(unit.id);
                                }}
                                style={{ marginTop: 3 }}
                              />
                              <span style={{ fontSize: 13, lineHeight: 1.45 }}>
                                <div>
                                  <strong>{unitType?.name ?? unit.unitTypeCode}</strong> - {unitNation?.name ?? unit.nationId}
                                </div>
                                <div>Status: {unit.status} - Strength: {unit.currentStrength}</div>
                                {activeOrder ? (
                                  <div>
                                    Moving to {provinceById.get(activeOrder.toProvinceId)?.name ?? activeOrder.toProvinceId}
                                  </div>
                                ) : null}
                                {!canSelectUnit ? (
                                  <div style={{ color: '#94a3b8' }}>Only idle units can join a group move.</div>
                                ) : null}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p style={{ ...subtleTextStyle, marginBottom: 0 }}>No friendly units in this province.</p>
                    )}
                  </div>

                  <div
                    style={{
                      border: '1px solid #2a3744',
                      borderRadius: 12,
                      padding: 12,
                      background: 'rgba(10, 16, 22, 0.82)',
                    }}
                  >
                    <h4 style={{ marginTop: 0, marginBottom: 10 }}>Enemy Units</h4>
                    {selectedEnemyUnits.length > 0 ? (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {selectedEnemyUnits.map((unit) => {
                          const unitNation = nationById.get(unit.nationId);
                          const unitType = unitTypeByCode.get(unit.unitTypeCode);
                          const activeOrder = movementOrderByUnitId.get(unit.id);

                          return (
                            <div
                              key={unit.id}
                              style={{
                                border: '1px solid #314152',
                                borderRadius: 10,
                                padding: '9px 10px',
                                background: '#101720',
                                fontSize: 13,
                                lineHeight: 1.45,
                              }}
                            >
                              <strong>{unitType?.name ?? unit.unitTypeCode}</strong> - {unitNation?.name ?? unit.nationId}
                              <div>Status: {unit.status} - Strength: {unit.currentStrength}</div>
                              {activeOrder ? (
                                <div>
                                  Moving to {provinceById.get(activeOrder.toProvinceId)?.name ?? activeOrder.toProvinceId}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p style={{ ...subtleTextStyle, marginBottom: 0 }}>No enemy units in this province.</p>
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ ...subtleTextStyle, marginBottom: 0 }}>No units in this province.</p>
              )}
            </div>
          )}
        </PanelSection>
        </div>

        <div style={{ order: 6 }}>
        <PanelSection title="Map Legend">
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              { swatch: '#efe1af', label: 'Selected province outline' },
              { swatch: '#7b9aac', label: 'Valid adjacent move target' },
              { swatch: '#c8a15a', label: 'Production center marker' },
              { swatch: '#51657b', label: 'Friendly ownership tint' },
              { swatch: '#664144', label: 'Enemy ownership tint' },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background: item.swatch,
                    border: '1px solid #e2e8f0',
                    display: 'inline-block',
                  }}
                />
                <span style={{ fontSize: 13 }}>{item.label}</span>
              </div>
            ))}
            {terrainLegendItems.map((item) => (
              <div key={item.terrainType} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background: item.swatchBackground,
                    border: '1px solid #e2e8f0',
                    display: 'inline-block',
                  }}
                />
                <span style={{ fontSize: 13 }}>{item.label}</span>
              </div>
            ))}
            <div style={{ fontSize: 13, color: '#cbd5e1' }}>
              Unit counters use military-style rectangular markers with <strong>I</strong>, <strong>A</strong>, and <strong>T</strong> symbols. A badge shows stack size when more than one unit occupies a province.
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              Terrain overlays intensify at higher zoom and do not affect gameplay yet.
            </div>
          </div>
        </PanelSection>
        </div>
      </div>
    </section>
  );
}
