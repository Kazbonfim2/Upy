import { and, desc, eq, isNull, sql as dsql } from "drizzle-orm";
import { db } from "../db";
import { alerts, checks, incidents, monitors, services } from "../db/schema";
import { maybeOpenAiCard } from "./groq";
import { isDue, isUp, nextIncidentAction } from "./health";
import { discordPayload, sendEmail, sendHttpJson, webhookPayload } from "./notify";
import { probe } from "./probe";
import { buildUrl } from "./validate";

export async function runOne(monitorId: number) {
  const [row] = await db
    .select({
      monitor: monitors,
      service: services,
    })
    .from(monitors)
    .leftJoin(services, eq(monitors.serviceId, services.id))
    .where(eq(monitors.id, monitorId));

  if (!row || !row.monitor) throw new Error("monitor não encontrado");
  const { monitor, service } = row;
  const fullUrl = service ? buildUrl(service.baseUrl, monitor.path) : (monitor.url || "");
  if (!fullUrl) throw new Error("URL do monitor inválida");

  const result = await probe(fullUrl, monitor.method, monitor.timeoutMs, monitor.body);
  const ok = isUp(result, monitor.expectedStatus);
  const errDetail = result.error ?? (ok ? null : `HTTP ${result.statusCode} (esperado ${monitor.expectedStatus})`);

  const [checkRow] = await db
    .insert(checks)
    .values({
      monitorId: monitor.id,
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
    .where(eq(monitors.id, monitor.id));

  const [open] = await db
    .select()
    .from(incidents)
    .where(and(eq(incidents.monitorId, monitor.id), isNull(incidents.endedAt)))
    .limit(1);

  const action = nextIncidentAction(ok, Boolean(open));
  if (action === "open") {
    await db.insert(incidents).values({
      monitorId: monitor.id,
      lastError: errDetail ?? "Erro desconhecido",
      responseBody: result.responseBody,
    });
    await fireAlerts(monitor.id, monitor.name, fullUrl, false, errDetail ?? "Erro desconhecido");
    await maybeOpenAiCard(monitor.id, {
      url: fullUrl,
      method: monitor.method,
      statusCode: result.statusCode,
      latencyMs: result.latencyMs,
      error: errDetail,
    });
  } else if (action === "close" && open) {
    await db
      .update(incidents)
      .set({ endedAt: new Date() })
      .where(eq(incidents.id, open.id));
    await fireAlerts(monitor.id, monitor.name, fullUrl, true, `latência ${result.latencyMs}ms`);
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

const inFlight = new Set<number>();
let isPolling = false;

export async function runDue(concurrency = Number(process.env.CHECK_CONCURRENCY || 25)) {
  if (isPolling) return;
  isPolling = true;
  try {
    const now = new Date();
    const list = await db.select().from(monitors).where(eq(monitors.enabled, true));
    const due = list.filter((m) => isDue(m.lastCheckedAt, m.intervalSeconds, now) && !inFlight.has(m.id));

    if (due.length === 0) return;

    for (const m of due) inFlight.add(m.id);

    // Dispara lote sem bloquear o próximo tick do agendador
    runWithLimit(due, concurrency, async (m) => {
      try {
        await runOne(m.id);
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
