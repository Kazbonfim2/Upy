import { isDue, isUp, nextIncidentAction } from "../src/lib/health";
import { discordPayload, resolveSmtpConfig, webhookPayload } from "../src/lib/notify";
import { parseAlert, parseCard, parseGroqCard, parseMonitor, parseUrl } from "../src/lib/validate";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isUp({ statusCode: 200, latencyMs: 12, error: null, responseBody: '{"ok":true}' }, 200), "200 esperado = up");
assert(!isUp({ statusCode: 500, latencyMs: 12, error: null, responseBody: "internal error" }, 200), "500 != 200");
assert(!isUp({ statusCode: null, latencyMs: 80, error: "timeout", responseBody: null }, 200), "erro = down");

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

// Card checks
const fullCard = parseCard({ name: "Falha HTTP", status: "open" });
assert(fullCard.name === "Falha HTTP" && fullCard.description === "" && fullCard.resolved === false, "card create defaults");

const patchResolvedOnly = parseCard({ resolved: true }, true);
assert(patchResolvedOnly.resolved === true && patchResolvedOnly.description === undefined, "card patch resolved preserva description");

const patchDescOnly = parseCard({ description: "detalhes do erro" }, true);
assert(patchDescOnly.description === "detalhes do erro" && patchDescOnly.resolved === undefined, "card patch description preserva resolved");

// Monitor patch check
const patchMonitorOnly = parseMonitor({ enabled: false }, true);
assert(patchMonitorOnly.enabled === false && patchMonitorOnly.intervalSeconds === undefined, "monitor patch preserva intervalSeconds");

// SMTP checks
const defaultGoogleSmtp = resolveSmtpConfig({
  SMTP_USER: "user@gmail.com",
  SMTP_PASS: "pass",
});
assert(defaultGoogleSmtp.host === "smtp.gmail.com" && defaultGoogleSmtp.port === 587 && defaultGoogleSmtp.auth?.user === "user@gmail.com", "google smtp padrao");

const customSmtp = resolveSmtpConfig({
  SMTP_HOST: "custom.smtp.com",
  SMTP_PORT: "465",
});
assert(customSmtp.host === "custom.smtp.com" && customSmtp.port === 465 && customSmtp.secure === true, "custom smtp config");

// Reset state checks
assert(isDue(null, 30, new Date()), "reset lastCheckedAt para null dispara check no proximo tick");

console.log("check ok");
