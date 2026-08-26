import { isDue, isUp, nextIncidentAction } from "../src/lib/health";
import { discordPayload, resolveSmtpConfig, webhookPayload } from "../src/lib/notify";
import { buildUrl, parseAlert, parseBaseUrl, parseCard, parseGroqCard, parseMonitor, parsePath, parseService } from "../src/lib/validate";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// Service & Endpoint URL tests
assert(parseBaseUrl("https://minha-api.com.br") === "https://minha-api.com.br", "base url");
assert(parseBaseUrl("https://minha-api.com.br/") === "https://minha-api.com.br", "base url trailing slash");
assert(parseBaseUrl("http://localhost:3000/api/") === "http://localhost:3000/api", "base url with path");
assert(parsePath("/v1/login") === "/v1/login", "parse path with slash");
assert(parsePath("v1/users") === "/v1/users", "parse path without slash");
assert(parsePath("") === "/", "empty path defaults to slash");

assert(buildUrl("https://minha-api.com.br", "/v1/login") === "https://minha-api.com.br/v1/login", "build url normal");
assert(buildUrl("https://minha-api.com.br/", "/v1/login") === "https://minha-api.com.br/v1/login", "build url double slash prevented");
assert(buildUrl("https://minha-api.com.br", "v1/users") === "https://minha-api.com.br/v1/users", "build url missing slash added");

const svc = parseService({ name: "Minha API", baseUrl: "https://minha-api.com.br/" });
assert(svc.name === "Minha API" && svc.baseUrl === "https://minha-api.com.br", "service parse");

const m = parseMonitor({
  serviceId: 1,
  name: "Login Endpoint",
  path: "/v1/login",
  method: "post",
  intervalSeconds: 30,
  timeoutMs: 2000,
  expectedStatus: 204,
  body: '{"foo":"bar"}',
});
assert(m.serviceId === 1, "serviceId parsed");
assert(m.path === "/v1/login", "path parsed");
assert(m.method === "POST", "method upper");
assert(m.expectedStatus === 204, "status");
assert(m.body === '{"foo":"bar"}', "body json");

try {
  parseMonitor({
    serviceId: 1,
    name: "api",
    path: "/test",
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
