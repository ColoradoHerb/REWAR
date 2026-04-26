import type {
  CreateSessionRequest,
  CreateSessionResponse,
  WorldState,
  WorldStateResponse,
} from '@rewar/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

async function getErrorMessage(response: Response, fallbackMessage: string) {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export async function fetchHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return response.json() as Promise<{ ok: true; service: string }>;
}

export async function fetchWorldState(sessionId: string): Promise<WorldState> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/world`);

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, `World fetch failed with status ${response.status}`));
  }

  const payload = (await response.json()) as WorldStateResponse;
  return payload.worldState;
}

export async function createSession(request: CreateSessionRequest) {
  const response = await fetch(`${API_BASE_URL}/api/sessions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, `Session creation failed with status ${response.status}`),
    );
  }

  return (await response.json()) as CreateSessionResponse;
}

export async function sendMoveUnitCommand(sessionId: string, unitId: string, toProvinceId: string) {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/commands`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      type: 'MOVE_UNIT',
      unitId,
      toProvinceId,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, `MOVE_UNIT failed with status ${response.status}`),
    );
  }
}

export async function sendMoveUnitsCommand(sessionId: string, unitIds: string[], toProvinceId: string) {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/commands`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      type: 'MOVE_UNITS',
      unitIds,
      toProvinceId,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, `MOVE_UNITS failed with status ${response.status}`),
    );
  }
}

export async function sendQueueUnitCommand(
  sessionId: string,
  provinceId: string,
  unitTypeCode: 'infantry' | 'artillery' | 'armor',
) {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/commands`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      type: 'QUEUE_UNIT',
      provinceId,
      unitTypeCode,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, `QUEUE_UNIT failed with status ${response.status}`),
    );
  }
}
