import type { NationResourceBalance, ResourceCode, UnitTypeCode, WorldState } from '@rewar/shared';
import { createIncomeRateByNation } from '@rewar/rules';

type OverviewPanelProps = {
  worldState: WorldState;
  selectedProvinceId: string | null;
  selectedUnitId: string | null;
  recentMessages: string[];
  isQueueingProduction: boolean;
  onQueueUnit: (provinceId: string, unitTypeCode: UnitTypeCode) => void | Promise<void>;
  onSelectUnit: (unitId: string) => void;
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

export function OverviewPanel({
  worldState,
  selectedProvinceId,
  selectedUnitId,
  recentMessages,
  isQueueingProduction,
  onQueueUnit,
  onSelectUnit,
}: OverviewPanelProps) {
  const activeUnits = worldState.units.filter((unit) => unit.status !== 'destroyed');
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
  const selectedUnits = selectedProvince
    ? activeUnits.filter((unit) => unit.provinceId === selectedProvince.id)
    : [];
  const selectedFriendlyUnits = selectedUnits.filter(
    (unit) => unit.nationId === worldState.session.humanNationId,
  );
  const selectedEnemyUnits = selectedUnits.filter(
    (unit) => unit.nationId !== worldState.session.humanNationId,
  );
  const selectedUnit = selectedUnitId
    ? activeUnits.find((unit) => unit.id === selectedUnitId) ?? null
    : null;
  const selectedUnitType = selectedUnit ? unitTypeByCode.get(selectedUnit.unitTypeCode) : null;
  const selectedUnitNation = selectedUnit ? nationById.get(selectedUnit.nationId) : null;
  const selectedUnitOrder = selectedUnit ? movementOrderByUnitId.get(selectedUnit.id) : null;
  const selectedUnitDestination = selectedUnitOrder
    ? provinceById.get(selectedUnitOrder.toProvinceId)
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
    <section
      style={{
        border: '1px solid #334155',
        borderRadius: 12,
        padding: 20,
        background: '#0f172a',
      }}
    >
      <h2 style={{ marginTop: 0 }}>World Overview</h2>

      <ul style={{ marginTop: 0, paddingLeft: 20 }}>
        <li>Session: {worldState.session.name}</li>
        <li>Nations: {worldState.nations.length}</li>
        <li>Provinces: {worldState.provinces.length}</li>
        <li>Units: {activeUnits.length}</li>
        <li>Active moves: {worldState.movementOrders.filter((order) => order.status === 'active').length}</li>
        <li>Resources: {worldState.resources.length}</li>
      </ul>

      <h3>Recent Combat</h3>
      {recentMessages.length > 0 ? (
        <ul style={{ marginTop: 0, paddingLeft: 20 }}>
          {recentMessages.map((message, index) => (
            <li key={`${message}-${index}`}>{message}</li>
          ))}
        </ul>
      ) : (
        <p style={{ color: '#94a3b8' }}>No combat resolved yet.</p>
      )}

      <h3>Selected Unit</h3>
      {!selectedUnit ? (
        <p style={{ color: '#94a3b8' }}>Select one of your units to issue movement.</p>
      ) : (
        <div
          style={{
            border: '1px solid #1e293b',
            borderRadius: 10,
            padding: 12,
            background: '#020617',
            marginBottom: 20,
          }}
        >
          <p style={{ marginTop: 0 }}>
            <strong>{selectedUnitType?.name ?? selectedUnit.unitTypeCode}</strong>
          </p>
          <p>Nation: {selectedUnitNation?.name ?? selectedUnit.nationId}</p>
          <p>Status: {selectedUnit.status === 'moving' ? 'Moving' : 'Idle'}</p>
          <p>Strength: {selectedUnit.currentStrength}</p>
          {selectedUnitOrder ? (
            <p style={{ marginBottom: 0 }}>
              Moving to: {selectedUnitDestination?.name ?? selectedUnitOrder.toProvinceId}
            </p>
          ) : (
            <p style={{ marginBottom: 0 }}>
              Current province: {provinceById.get(selectedUnit.provinceId)?.name ?? selectedUnit.provinceId}
            </p>
          )}
        </div>
      )}

      <h3>Nation Balances</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        {worldState.nations.map((nation) => (
          <div
            key={nation.id}
            style={{
              border: '1px solid #1e293b',
              borderRadius: 10,
              padding: 12,
              background: '#020617',
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
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {worldState.resources.map((resource) => (
                <li key={resource.code}>
                  {resource.name}: {getBalanceAmount(worldState.balances, nation.id, resource.code)}
                  {nation.id === worldState.session.humanNationId
                    ? ` (+${incomeRateByNation.get(nation.id)?.get(resource.code) ?? 0}/min)`
                    : ''}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <h3 style={{ marginTop: 20 }}>Selected Province</h3>
      {!selectedProvince ? (
        <p style={{ color: '#94a3b8', marginBottom: 0 }}>
          Click a province on the map to inspect it.
        </p>
      ) : (
        <div
          style={{
            border: '1px solid #1e293b',
            borderRadius: 10,
            padding: 12,
            background: '#020617',
          }}
        >
          <p style={{ marginTop: 0 }}>
            <strong>{selectedProvince.name}</strong>
          </p>
          <p>Owner: {selectedOwner?.name ?? 'Unclaimed'}</p>
          <p>Terrain: {selectedProvince.terrainType}</p>
          <p>Yield: {formatYieldPerMinute(selectedProvince.baseYield) || 'None'}</p>
          <p>Production center: {selectedProvince.isProductionCenter ? 'Yes' : 'No'}</p>
          <p>Units present: {selectedUnits.length}</p>
          <p>Friendly units: {selectedFriendlyUnits.length}</p>
          <p>Enemy units: {selectedEnemyUnits.length}</p>

          <div
            style={{
              borderTop: '1px solid #1e293b',
              marginTop: 12,
              paddingTop: 12,
            }}
          >
            <h4 style={{ marginTop: 0 }}>Production</h4>

            {!selectedProvince.isProductionCenter ? (
              <p style={{ marginBottom: 0, color: '#94a3b8' }}>
                This province cannot build units.
              </p>
            ) : !selectedProvinceCanProduce ? (
              <p style={{ marginBottom: 0, color: '#94a3b8' }}>
                Only owned production centers can build units.
              </p>
            ) : selectedProductionQueue ? (
              (() => {
                const queuedUnitType = unitTypeByCode.get(selectedProductionQueue.unitTypeCode);
                const startedAtMs = new Date(selectedProductionQueue.startedAt).getTime();
                const completesAtMs = new Date(selectedProductionQueue.completesAt).getTime();
                const totalMs = Math.max(1, completesAtMs - startedAtMs);
                const elapsedMs = Math.max(0, Math.min(totalMs, serverTimeMs - startedAtMs));
                const progressPercent = Math.round((elapsedMs / totalMs) * 100);
                const remainingSeconds = Math.max(
                  0,
                  Math.ceil((completesAtMs - serverTimeMs) / 1_000),
                );

                return (
                  <div
                    style={{
                      border: '1px solid #334155',
                      borderRadius: 8,
                      padding: 12,
                      background: '#0f172a',
                      marginBottom: 12,
                    }}
                  >
                    <p style={{ marginTop: 0 }}>
                      Building: <strong>{queuedUnitType?.name ?? selectedProductionQueue.unitTypeCode}</strong>
                    </p>
                    <p>Progress: {progressPercent}%</p>
                    <p style={{ marginBottom: 0 }}>Remaining: {remainingSeconds}s</p>
                  </div>
                );
              })()
            ) : (
              <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
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
                        borderRadius: 8,
                        background: !hasEnoughResources || isQueueingProduction ? '#111827' : '#1e293b',
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

          {selectedUnits.length > 0 ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <h4 style={{ marginTop: 0, marginBottom: 8 }}>Friendly Units</h4>
                {selectedFriendlyUnits.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {selectedFriendlyUnits.map((unit) => {
                      const unitNation = nationById.get(unit.nationId);
                      const unitType = unitTypeByCode.get(unit.unitTypeCode);
                      const activeOrder = movementOrderByUnitId.get(unit.id);
                      const isSelectedUnit = unit.id === selectedUnitId;

                      return (
                        <li key={unit.id} style={{ marginBottom: 8 }}>
                          <div>
                            <strong>{unitType?.name ?? unit.unitTypeCode}</strong> - {unitNation?.name ?? unit.nationId}
                          </div>
                          <div>Status: {unit.status} - Strength: {unit.currentStrength}</div>
                          {activeOrder ? (
                            <div>
                              Moving to {provinceById.get(activeOrder.toProvinceId)?.name ?? activeOrder.toProvinceId}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              onSelectUnit(unit.id);
                            }}
                            style={{
                              marginTop: 6,
                              border: '1px solid #475569',
                              borderRadius: 8,
                              background: isSelectedUnit ? '#1d4ed8' : '#0f172a',
                              color: '#e2e8f0',
                              padding: '6px 10px',
                              cursor: 'pointer',
                            }}
                          >
                            {isSelectedUnit ? 'Selected' : 'Select unit'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p style={{ marginBottom: 0, color: '#94a3b8' }}>No friendly units in this province.</p>
                )}
              </div>

              <div>
                <h4 style={{ marginTop: 0, marginBottom: 8 }}>Enemy Units</h4>
                {selectedEnemyUnits.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {selectedEnemyUnits.map((unit) => {
                      const unitNation = nationById.get(unit.nationId);
                      const unitType = unitTypeByCode.get(unit.unitTypeCode);
                      const activeOrder = movementOrderByUnitId.get(unit.id);

                      return (
                        <li key={unit.id}>
                          {unitType?.name ?? unit.unitTypeCode} - {unitNation?.name ?? unit.nationId} -
                          {' '}Status {unit.status} - Strength {unit.currentStrength}
                          {activeOrder ? ` - moving to ${provinceById.get(activeOrder.toProvinceId)?.name ?? activeOrder.toProvinceId}` : ''}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p style={{ marginBottom: 0, color: '#94a3b8' }}>No enemy units in this province.</p>
                )}
              </div>
            </div>
          ) : (
            <p style={{ marginBottom: 0, color: '#94a3b8' }}>No units in this province.</p>
          )}
        </div>
      )}
    </section>
  );
}
