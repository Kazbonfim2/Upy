const base = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}

export type Monitor = {
  id: number;
  name: string;
  url: string;
  method: string;
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatus: number;
  enabled: boolean;
  lastOk: boolean | null;
  lastStatusCode: number | null;
  lastLatencyMs: number | null;
  lastError: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
};

export type CheckRow = {
  id: number;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
  checkedAt: string;
};

export type Incident = {
  id: number;
  startedAt: string;
  endedAt: string | null;
  lastError: string | null;
};

export type AlertRow = {
  id: number;
  channel: string;
  target: string;
};

export type CardRow = {
  id: number;
  monitorId: number;
  name: string;
  status: string;
  description: string;
  resolved: boolean;
  createdAt: string;
};

export type MonitorDetail = Monitor & {
  stats: { total: number; ok: number; pct: number | null; avgMs: number };
  checks: CheckRow[];
  incidents: Incident[];
  alerts: AlertRow[];
  cards: CardRow[];
};

export const api = {
  list: () => req<Monitor[]>("/api/monitors"),
  get: (id: number) => req<MonitorDetail>(`/api/monitors/${id}`),
  create: (body: unknown) =>
    req<Monitor>("/api/monitors", { method: "POST", body: JSON.stringify(body) }),
  patch: (id: number, body: unknown) =>
    req<Monitor>(`/api/monitors/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) =>
    req<{ ok: boolean }>(`/api/monitors/${id}`, { method: "DELETE" }),
  checkNow: (id: number) =>
    req<CheckRow>(`/api/monitors/${id}/check`, { method: "POST" }),
  addAlert: (id: number, body: unknown) =>
    req<AlertRow>(`/api/monitors/${id}/alerts`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  removeAlert: (id: number, alertId: number) =>
    req<{ ok: boolean }>(`/api/monitors/${id}/alerts/${alertId}`, { method: "DELETE" }),
  listCards: (id: number) => req<CardRow[]>(`/api/monitors/${id}/cards`),
  addCard: (id: number, body: unknown) =>
    req<CardRow>(`/api/monitors/${id}/cards`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  patchCard: (id: number, cardId: number, body: unknown) =>
    req<CardRow>(`/api/monitors/${id}/cards/${cardId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  removeCard: (id: number, cardId: number) =>
    req<{ ok: boolean }>(`/api/monitors/${id}/cards/${cardId}`, { method: "DELETE" }),
};
