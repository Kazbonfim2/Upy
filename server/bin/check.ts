import { isDue, isUp, nextIncidentAction } from "../src/lib/health";
import { discordPayload, webhookPayload } from "../src/lib/notify";
import { parseAlert, parseGroqCard, parseMonitor, parseUrl } from "../src/lib/validate";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isUp({ statusCode: 200, latencyMs: 12, error: null }, 200), "200 esperado = up");
assert(!isUp({ statusCode: 500, latencyMs: 12, error: null }, 200), "500 != 200");
assert(!isUp({ statusCode: null, latencyMs: 80, error: "timeout" }, 200), "erro = down");

assert(nextIncidentAction(false, false) === "open", "caiu abre");
assert(nextIncidentAction(false, true) === "none", "já aberto");
assert(nextIncidentAction(true, true) === "close", "voltou fecha");
assert(nextIncidentAction(true, false) === "none", "saudável sem incidente");

const t0 = new Date("2026-01-01T00:00:00Z");
assert(isDue(null, 60, t0), "nunca checado");
assert(!isDue(t0, 60, new Date(t0.getTime() + 59_000)), "ainda no intervalo");
assert(isDue(t0, 60, new Date(t0.getTime() + 60_000)), "venceu");

parseUrl("https://example.com/health");
try {
  parseUrl("ftp://x");
  throw new Error("ftp passou");
} catch (e) {
  assert(e instanceof Error && e.message.includes("http"), "ftp bloqueado");
}

const m = parseMonitor({
  name: "api",
  url: "https://example.com",
  method: "post",
  intervalSeconds: 30,
  timeoutMs: 2000,
  expectedStatus: 204,
  body: '{"foo":"bar"}',
});
assert(m.method === "POST", "method upper");
assert(m.expectedStatus === 204, "status");
assert(m.body === '{"foo":"bar"}', "body json");

try {
  parseMonitor({
    name: "api",
    url: "https://example.com",
    method: "POST",
    body: "{invalid-json}",
  });
  throw new Error("json inválido passou");
} catch (e) {
  assert(e instanceof Error && e.message.includes("JSON"), "bloqueou json invalido");
}

parseAlert({ channel: "discord", target: "https://discord.com/api/webhooks/1/x" });
parseAlert({ channel: "email", target: "ops@example.com" });
try {
  parseAlert({ channel: "pager", target: "x" });
  throw new Error("channel livre");
} catch (e) {
  assert(e instanceof Error && e.message.includes("channel"), "channel fechado");
}

const d = discordPayload("api", "https://a", false, "HTTP 500");
assert(typeof d.content === "string" && d.content.includes("caiu"), "discord down");
const w = webhookPayload("api", "https://a", true, "ok");
assert(w.event === "incident.resolved" && w.up === true, "webhook up");

const g = parseGroqCard(
  JSON.stringify({
    name: "x".repeat(120),
    status: "Timeout",
    description: "y".repeat(400),
  }),
);
assert(g && g.name.length === 100 && g.status === "Timeout" && g.description.length === 300, "clip groq");
assert(parseGroqCard("nao-json") === null, "json inválido");
assert(parseGroqCard('{"status":"x"}') === null, "name obrigatório");

console.log("check ok");
