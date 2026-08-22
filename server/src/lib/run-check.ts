import { and, desc, eq, isNull, sql as dsql } from "drizzle-orm";
import { db } from "../db";
import { alerts, checks, incidents, monitors } from "../db/schema";
import { isDue, isUp, nextIncidentAction } from "./health";
import { discordPayload, sendEmail, sendHttpJson, webhookPayload } from "./notify";
import { probe } from "./probe";

export async function runOne(monitorId: number) {
  const [monitor] = await db.select().from(monitors).where(eq(monitors.id, monitorId));
  if (!monitor) throw new Error("monitor não encontrado");

  const result = await probe(monitor.url, monitor.method, monitor.timeoutMs);
  const ok = isUp(result, monitor.expectedStatus);

  const [row] = await db
    .insert(checks)
    .values({
      monitorId: monitor.id,
      ok,
      statusCode: result.statusCode,
      latencyMs: result.latencyMs,
      error: result.error,
    })
    .returning();

  await db
    .update(monitors)
    .set({
      lastOk: ok,
      lastStatusCode: result.statusCode,
      lastLatencyMs: result.latencyMs,
      lastError: result.error,
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
      lastError: result.error ?? `HTTP ${result.statusCode}`,
    });
    await fireAlerts(monitor.id, monitor.name, monitor.url, false, result.error ?? `HTTP ${result.statusCode}`);
  } else if (action === "close" && open) {
    await db
      .update(incidents)
      .set({ endedAt: new Date(), lastError: null })
      .where(eq(incidents.id, open.id));
    await fireAlerts(monitor.id, monitor.name, monitor.url, true, `latência ${result.latencyMs}ms`);
  }

  return row;
}

export async function runDue() {
  const now = new Date();
  const list = await db.select().from(monitors).where(eq(monitors.enabled, true));
  // ponytail: lock global no worker; um check por vez. Fila/paralelismo se a lista crescer.
  for (const m of list) {
    if (!isDue(m.lastCheckedAt, m.intervalSeconds, now)) continue;
    await runOne(m.id);
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
