import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { ensureSchema } from "./db";
import { monitorRoutes } from "./routes/monitors";
import { serviceRoutes } from "./routes/services";
import { systemRoutes } from "./routes/system";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  }),
);

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  const msg = err instanceof Error ? err.message : String(err);
  const status = /obrigat|inválid|entre /.test(msg) ? 400 : 500;
  return c.json({ error: msg }, status);
});

app.get("/health", (c) => c.json({ ok: true }));
app.route("/api/system", systemRoutes);
app.route("/api/services", serviceRoutes);
app.route("/api/monitors", monitorRoutes);

const port = Number(process.env.API_PORT || 3000);

while (true) {
  try {
    await ensureSchema();
    break;
  } catch (err) {
    console.error("api aguardando banco:", err);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

export default {
  port,
  fetch: app.fetch,
};

console.log(`api :${port}`);
