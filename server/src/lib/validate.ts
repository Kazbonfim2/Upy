const METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]);
const CHANNELS = new Set(["email", "discord", "webhook"]);

export function parseUrl(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("url obrigatória");
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("url inválida");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("url precisa ser http ou https");
  }
  return u.toString();
}

export type MonitorInput = {
  name: string;
  url: string;
  method: string;
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatus: number;
  enabled: boolean;
};

export function parseMonitor(body: Record<string, unknown>, partial = false): Partial<MonitorInput> {
  const out: Partial<MonitorInput> = {};
  if (!partial || "name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) throw new Error("name obrigatório");
    out.name = body.name.trim();
  }
  if (!partial || "url" in body) out.url = parseUrl(body.url);
  if (!partial || "method" in body) {
    const method = String(body.method ?? "GET").toUpperCase();
    if (!METHODS.has(method)) throw new Error("method inválido");
    out.method = method;
  }
  if (!partial || "intervalSeconds" in body) {
    const n = Number(body.intervalSeconds ?? 60);
    if (!Number.isInteger(n) || n < 10 || n > 86400) throw new Error("intervalSeconds entre 10 e 86400");
    out.intervalSeconds = n;
  }
  if (!partial || "timeoutMs" in body) {
    const n = Number(body.timeoutMs ?? 5000);
    if (!Number.isInteger(n) || n < 500 || n > 30000) throw new Error("timeoutMs entre 500 e 30000");
    out.timeoutMs = n;
  }
  if (!partial || "expectedStatus" in body) {
    const n = Number(body.expectedStatus ?? 200);
    if (!Number.isInteger(n) || n < 100 || n > 599) throw new Error("expectedStatus inválido");
    out.expectedStatus = n;
  }
  if (!partial || "enabled" in body) {
    out.enabled = body.enabled === undefined ? true : Boolean(body.enabled);
  }
  return out;
}

export function parseAlert(body: Record<string, unknown>): { channel: string; target: string } {
  const channel = String(body.channel ?? "");
  if (!CHANNELS.has(channel)) throw new Error("channel: email, discord ou webhook");
  const target = String(body.target ?? "").trim();
  if (!target) throw new Error("target obrigatório");
  if (channel === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) throw new Error("e-mail inválido");
  } else {
    parseUrl(target);
  }
  return { channel, target };
}

export type CardInput = {
  name: string;
  status: string;
  description: string;
  resolved: boolean;
};

export function parseCard(body: Record<string, unknown>, partial = false): Partial<CardInput> {
  const out: Partial<CardInput> = {};
  if (!partial || "name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) throw new Error("name obrigatório");
    const name = body.name.trim();
    if (name.length > 100) throw new Error("name máx. 100 caracteres");
    out.name = name;
  }
  if (!partial || "status" in body) {
    if (typeof body.status !== "string" || !body.status.trim()) throw new Error("status obrigatório");
    const status = body.status.trim();
    if (status.length > 100) throw new Error("status máx. 100 caracteres");
    out.status = status;
  }
  if (!partial || "description" in body) {
    const description = body.description == null ? "" : String(body.description).trim();
    if (description.length > 300) throw new Error("description máx. 300 caracteres");
    out.description = description;
  }
  if (!partial || "resolved" in body) {
    out.resolved = body.resolved === undefined ? false : Boolean(body.resolved);
  }
  return out;
}
