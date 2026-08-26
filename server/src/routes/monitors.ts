import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { alerts, cards, checks, incidents, monitors, services } from "../db/schema";
import { history, incidentList, runOne, uptime } from "../lib/run-check";
import { buildUrl, parseAlert, parseCard, parseMonitor } from "../lib/validate";

export const monitorRoutes = new Hono();

monitorRoutes.get("/", async (c) => {
  const rows = await db
    .select({
      id: monitors.id,
      serviceId: monitors.serviceId,
      name: monitors.name,
      path: monitors.path,
      method: monitors.method,
      intervalSeconds: monitors.intervalSeconds,
      timeoutMs: monitors.timeoutMs,
      expectedStatus: monitors.expectedStatus,
      body: monitors.body,
      enabled: monitors.enabled,
      lastOk: monitors.lastOk,
      lastStatusCode: monitors.lastStatusCode,
      lastLatencyMs: monitors.lastLatencyMs,
      lastError: monitors.lastError,
      lastCheckedAt: monitors.lastCheckedAt,
      createdAt: monitors.createdAt,
      serviceName: services.name,
      baseUrl: services.baseUrl,
    })
    .from(monitors)
    .leftJoin(services, eq(monitors.serviceId, services.id))
    .orderBy(desc(monitors.createdAt));

  const result = rows.map((r) => ({
    ...r,
    url: r.baseUrl ? buildUrl(r.baseUrl, r.path) : r.path,
  }));

  return c.json(result);
});

monitorRoutes.post("/", async (c) => {
  const body = (await c.req.json()) as Record<string, unknown>;
  const data = parseMonitor(body) as {
    serviceId: number;
    name: string;
    path: string;
    method: string;
    intervalSeconds: number;
    timeoutMs: number;
    expectedStatus: number;
    enabled: boolean;
    body?: string | null;
  };
  const [row] = await db.insert(monitors).values(data).returning();
  return c.json(row, 201);
});

monitorRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const [row] = await db
    .select({
      id: monitors.id,
      serviceId: monitors.serviceId,
      name: monitors.name,
      path: monitors.path,
      method: monitors.method,
      intervalSeconds: monitors.intervalSeconds,
      timeoutMs: monitors.timeoutMs,
      expectedStatus: monitors.expectedStatus,
      body: monitors.body,
      enabled: monitors.enabled,
      lastOk: monitors.lastOk,
      lastStatusCode: monitors.lastStatusCode,
      lastLatencyMs: monitors.lastLatencyMs,
      lastError: monitors.lastError,
      lastCheckedAt: monitors.lastCheckedAt,
      createdAt: monitors.createdAt,
      serviceName: services.name,
      baseUrl: services.baseUrl,
    })
    .from(monitors)
    .leftJoin(services, eq(monitors.serviceId, services.id))
    .where(eq(monitors.id, id));

  if (!row) return c.json({ error: "não encontrado" }, 404);
  const [stats, checks, incidents, alertRows, cardRows] = await Promise.all([
    uptime(id),
    history(id),
    incidentList(id),
    db.select().from(alerts).where(eq(alerts.monitorId, id)),
    db.select().from(cards).where(eq(cards.monitorId, id)).orderBy(desc(cards.createdAt)),
  ]);
  const fullUrl = row.baseUrl ? buildUrl(row.baseUrl, row.path) : row.path;
  return c.json({ ...row, url: fullUrl, stats, checks, incidents, alerts: alertRows, cards: cardRows });
});

monitorRoutes.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = (await c.req.json()) as Record<string, unknown>;
  const data = parseMonitor(body, true);
  const [row] = await db.update(monitors).set(data).where(eq(monitors.id, id)).returning();
  if (!row) return c.json({ error: "não encontrado" }, 404);
  return c.json(row);
});

monitorRoutes.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const [row] = await db.delete(monitors).where(eq(monitors.id, id)).returning();
  if (!row) return c.json({ error: "não encontrado" }, 404);
  return c.json({ ok: true });
});

monitorRoutes.post("/:id/reset", async (c) => {
  const id = Number(c.req.param("id"));
  const [m] = await db.select().from(monitors).where(eq(monitors.id, id));
  if (!m) return c.json({ error: "não encontrado" }, 404);

  await Promise.all([
    db.delete(checks).where(eq(checks.monitorId, id)),
    db.delete(incidents).where(eq(incidents.monitorId, id)),
    db.delete(cards).where(eq(cards.monitorId, id)),
    db
      .update(monitors)
      .set({
        lastOk: null,
        lastStatusCode: null,
        lastLatencyMs: null,
        lastError: null,
        lastCheckedAt: null,
      })
      .where(eq(monitors.id, id)),
  ]);

  return c.json({ ok: true });
});

monitorRoutes.post("/:id/check", async (c) => {
  const id = Number(c.req.param("id"));
  try {
    const row = await runOne(id);
    return c.json(row);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 404);
  }
});

monitorRoutes.post("/:id/alerts", async (c) => {
  const id = Number(c.req.param("id"));
  const [m] = await db.select().from(monitors).where(eq(monitors.id, id));
  if (!m) return c.json({ error: "não encontrado" }, 404);
  const body = (await c.req.json()) as Record<string, unknown>;
  const data = parseAlert(body);
  const [row] = await db.insert(alerts).values({ monitorId: id, ...data }).returning();
  return c.json(row, 201);
});

monitorRoutes.delete("/:id/alerts/:alertId", async (c) => {
  const alertId = Number(c.req.param("alertId"));
  const [row] = await db.delete(alerts).where(eq(alerts.id, alertId)).returning();
  if (!row) return c.json({ error: "não encontrado" }, 404);
  return c.json({ ok: true });
});

monitorRoutes.get("/:id/cards", async (c) => {
  const id = Number(c.req.param("id"));
  const [m] = await db.select().from(monitors).where(eq(monitors.id, id));
  if (!m) return c.json({ error: "não encontrado" }, 404);
  const rows = await db.select().from(cards).where(eq(cards.monitorId, id)).orderBy(desc(cards.createdAt));
  return c.json(rows);
});

monitorRoutes.post("/:id/cards", async (c) => {
  const id = Number(c.req.param("id"));
  const [m] = await db.select().from(monitors).where(eq(monitors.id, id));
  if (!m) return c.json({ error: "não encontrado" }, 404);
  const body = (await c.req.json()) as Record<string, unknown>;
  const data = parseCard(body) as {
    name: string;
    status: string;
    description: string;
    resolved: boolean;
  };
  const [row] = await db
    .insert(cards)
    .values({
      monitorId: id,
      name: data.name,
      status: data.status,
      description: data.description ?? "",
      resolved: data.resolved ?? false,
    })
    .returning();
  return c.json(row, 201);
});

monitorRoutes.patch("/:id/cards/:cardId", async (c) => {
  const id = Number(c.req.param("id"));
  const cardId = Number(c.req.param("cardId"));
  const body = (await c.req.json()) as Record<string, unknown>;
  const data = parseCard(body, true);
  const [row] = await db
    .update(cards)
    .set(data)
    .where(and(eq(cards.id, cardId), eq(cards.monitorId, id)))
    .returning();
  if (!row) return c.json({ error: "não encontrado" }, 404);
  return c.json(row);
});

monitorRoutes.delete("/:id/cards/:cardId", async (c) => {
  const id = Number(c.req.param("id"));
  const cardId = Number(c.req.param("cardId"));
  const [row] = await db
    .delete(cards)
    .where(and(eq(cards.id, cardId), eq(cards.monitorId, id)))
    .returning();
  if (!row) return c.json({ error: "não encontrado" }, 404);
  return c.json({ ok: true });
});
