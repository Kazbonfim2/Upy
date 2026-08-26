import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { monitors, services } from "../db/schema";
import { buildUrl, parseService } from "../lib/validate";

export const serviceRoutes = new Hono();

serviceRoutes.get("/", async (c) => {
  const allServices = await db.select().from(services).orderBy(desc(services.createdAt));
  const allMonitors = await db
    .select()
    .from(monitors)
    .orderBy(desc(monitors.createdAt));

  const rows = allServices.map((s) => {
    const serviceMonitors = allMonitors
      .filter((m) => m.serviceId === s.id)
      .map((m) => ({
        ...m,
        serviceName: s.name,
        baseUrl: s.baseUrl,
        url: buildUrl(s.baseUrl, m.path),
      }));

    return {
      ...s,
      monitors: serviceMonitors,
    };
  });

  return c.json(rows);
});

serviceRoutes.post("/", async (c) => {
  const body = (await c.req.json()) as Record<string, unknown>;
  const data = parseService(body) as { name: string; baseUrl: string };
  const [row] = await db.insert(services).values(data).returning();
  return c.json(row, 201);
});

serviceRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const [s] = await db.select().from(services).where(eq(services.id, id));
  if (!s) return c.json({ error: "serviço não encontrado" }, 404);

  const monitorRows = await db
    .select()
    .from(monitors)
    .where(eq(monitors.serviceId, id))
    .orderBy(desc(monitors.createdAt));

  const serviceMonitors = monitorRows.map((m) => ({
    ...m,
    serviceName: s.name,
    baseUrl: s.baseUrl,
    url: buildUrl(s.baseUrl, m.path),
  }));

  return c.json({ ...s, monitors: serviceMonitors });
});

serviceRoutes.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = (await c.req.json()) as Record<string, unknown>;
  const data = parseService(body, true);
  const [row] = await db.update(services).set(data).where(eq(services.id, id)).returning();
  if (!row) return c.json({ error: "serviço não encontrado" }, 404);
  return c.json(row);
});

serviceRoutes.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const [row] = await db.delete(services).where(eq(services.id, id)).returning();
  if (!row) return c.json({ error: "serviço não encontrado" }, 404);
  return c.json({ ok: true });
});
