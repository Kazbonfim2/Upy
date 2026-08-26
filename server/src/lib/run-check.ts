import { and, desc, eq, isNull, sql as dsql } from "drizzle-orm";
import { db, sql } from "../db";
import { alerts, checks, incidents, monitors, services } from "../db/schema";
import { maybeOpenAiCard } from "./groq";
import { isUp, nextIncidentAction } from "./health";
import { discordPayload, sendEmail, sendHttpJson, webhookPayload } from "./notify";
import { probe } from "./probe";
import { buildUrl } from "./validate";

export type MonitorExecutionTarget = {
  id: number;
  name: string;
  path: string;
  url?: string | null;
  method: string;
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatus: number;
  body?: string | null;
  baseUrl?: string | null;
};

export async function executeCheck(target: MonitorExecutionTarget) {
  const fullUrl = target.baseUrl ? buildUrl(target.baseUrl, target.path) : (target.url || "");
  if (!fullUrl) throw new Error("URL do monitor inválida");

  const result = await probe(fullUrl, target.method, target.timeoutMs, target.body);
  const ok = isUp(result, target.expectedStatus);
  const errDetail = result.error ?? (ok ? null : `HTTP ${result.statusCode} (esperado ${target.expectedStatus})`);

  const [checkRow] = await db
    .insert(checks)
    .values({
      monitorId: target.id,
      ok,
      statusCode: result.statusCode,
      latencyMs: result.latencyMs,
      error: errDetail,
      responseBody: result.responseBody,
    })
    .returning();

  await db
    .update(monitors)
    .set({
      lastOk: ok,
      lastStatusCode: result.statusCode,
      lastLatencyMs: result.latencyMs,
      lastError: errDetail,
      lastCheckedAt: new Date(),
    })
    .where(eq(monitors.id, target.id));

  const [open] = await db
    .select()
    .from(incidents)
    .where(and(eq(incidents.monitorId, target.id), isNull(incidents.endedAt)))
    .limit(1);

  const action = nextIncidentAction(ok, Boolean(open));
  if (action === "open") {
    await db.insert(incidents).values({
      monitorId: target.id,
      lastError: errDetail ?? "Erro desconhecido",
      responseBody: result.responseBody,
    });
    fireAlerts(target.id, target.name, fullUrl, false, errDetail ?? "Erro desconhecido").catch((err) =>
      console.error(`alerta monitor=${target.id} erro:`, err),
    );
    maybeOpenAiCard(target.id, {
      url: fullUrl,
      method: target.method,
      statusCode: result.statusCode,
      latencyMs: result.latencyMs,
      error: errDetail,
    }).catch((err) => console.error(`groq monitor=${target.id} erro:`, err));
  } else if (action === "close" && open) {
    await db
      .update(incidents)
      .set({ endedAt: new Date() })
      .where(eq(incidents.id, open.id));
    fireAlerts(target.id, target.name, fullUrl, true, `latência ${result.latencyMs}ms`).catch((err) =>
      console.error(`alerta monitor=${target.id} erro:`, err),
    );
  } else if (!ok && open) {
    await db
      .update(incidents)
      .set({
        lastError: errDetail ?? "Erro desconhecido",
        responseBody: result.responseBody,
      })
      .where(eq(incidents.id, open.id));
  }

  return checkRow;
}

export async function runOne(monitorId: number) {
  const [row] = await db
    .select({
      id: monitors.id,
      name: monitors.name,
      path: monitors.path,
      url: monitors.url,
      method: monitors.method,
      intervalSeconds: monitors.intervalSeconds,
      timeoutMs: monitors.timeoutMs,
      expectedStatus: monitors.expectedStatus,
      body: monitors.body,
      baseUrl: services.baseUrl,
    })
    .from(monitors)
    .leftJoin(services, eq(monitors.serviceId, services.id))
    .where(eq(monitors.id, monitorId));

  if (!row) throw new Error("monitor não encontrado");
  return executeCheck(row);
}

// ponytail: pool de concorrência nativo sem dependências externas.
export async function runWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      try {
        const val = await fn(items[i]);
        results[i] = { status: "fulfilled", value: val };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function fetchDueMonitors(limit = 500): Promise<MonitorExecutionTarget[]> {
  const rows = await sql<MonitorExecutionTarget[]>`
    SELECT
      m.id,
      m.name,
      m.path,
      m.url,
      m.method,
      m.interval_seconds as "intervalSeconds",
      m.timeout_ms as "timeoutMs",
      m.expected_status as "expectedStatus",
      m.body,
      s.base_url as "baseUrl"
    FROM monitors m
    LEFT JOIN services s ON m.service_id = s.id
    WHERE m.enabled = true
      AND (
        m.last_checked_at IS NULL
        OR m.last_checked_at <= now() - (m.interval_seconds || ' seconds')::interval
      )
    LIMIT ${limit}
  `;
  return rows;
}

const inFlight = new Set<number>();
let isPolling = false;

export async function runDue(concurrency = Number(process.env.CHECK_CONCURRENCY || 25)) {
  if (isPolling) return;
  isPolling = true;
  try {
    const due = await fetchDueMonitors();
    const ready = due.filter((m) => !inFlight.has(m.id));

    if (ready.length === 0) return;

    for (const m of ready) inFlight.add(m.id);

    // Dispara lote sem bloquear o próximo tick do agendador
    runWithLimit(ready, concurrency, async (m) => {
      try {
        await executeCheck(m);
      } catch (err) {
        console.error(`check monitor=${m.id} falhou:`, err);
      } finally {
        inFlight.delete(m.id);
      }
    }).catch((err) => console.error("batch runner falhou:", err));
  } finally {
    isPolling = false;
  }
}

export async function uptime(monitorId: number) {
  const [agg] = await db
    .select({
      total: dsql<number>`count(*)::int`,
      ok: dsql<number>`count(*) filter (where ${checks.ok})::int`,
      avgMs: dsql<number>`coalesce(avg(${checks.latencyMs}), 0)::int`,
    })
    .from(checks)
    .where(eq(checks.monitorId, monitorId));
  const total = agg?.total ?? 0;
  const okCount = agg?.ok ?? 0;
  return {
    total,
    ok: okCount,
    pct: total === 0 ? null : Math.round((okCount / total) * 1000) / 10,
    avgMs: agg?.avgMs ?? 0,
  };
}

export async function history(monitorId: number, limit = 50) {
  return db
    .select()
    .from(checks)
    .where(eq(checks.monitorId, monitorId))
    .orderBy(desc(checks.checkedAt))
    .limit(limit);
}

export async function incidentList(monitorId: number) {
  return db
    .select()
    .from(incidents)
    .where(eq(incidents.monitorId, monitorId))
    .orderBy(desc(incidents.startedAt));
}

async function fireAlerts(
  monitorId: number,
  name: string,
  url: string,
  up: boolean,
  detail: string,
) {
  const list = await db.select().from(alerts).where(eq(alerts.monitorId, monitorId));
  for (const a of list) {
    try {
      if (a.channel === "email") {
        await sendEmail(
          a.target,
          up ? `[upy] ${name} voltou` : `[upy] ${name} caiu`,
          `${name}\n${url}\n${detail}`,
        );
      } else if (a.channel === "discord") {
        await sendHttpJson(a.target, discordPayload(name, url, up, detail));
      } else {
        await sendHttpJson(a.target, webhookPayload(name, url, up, detail));
      }
    } catch (err) {
      console.error(`alerta ${a.id} falhou:`, err);
    }
  }
}
