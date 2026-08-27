import { z } from "zod";

const METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"] as const;
const CHANNELS = ["email", "discord", "webhook"] as const;

export function parseBaseUrl(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) throw new Error("url base obrigatória");
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error("url base precisa ser http ou https");
    }
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}`;
  } catch (err) {
    if (err instanceof Error && err.message.includes("http")) throw err;
    throw new Error("url base inválida");
  }
}

export function parsePath(raw: unknown): string {
  if (raw === undefined || raw === null || raw === "") return "/";
  if (typeof raw !== "string") throw new Error("caminho inválido");
  const trimmed = raw.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function buildUrl(baseUrl = "", path = "/"): string {
  return `${baseUrl.trim().replace(/\/+$/, "")}${parsePath(path)}`;
}

export type ServiceInput = {
  name: string;
  baseUrl: string;
};

const serviceBaseSchema = z.object({
  name: z.string().trim().min(1, "name obrigatório"),
  baseUrl: z.string().trim().transform(parseBaseUrl),
});

export const serviceSchema = serviceBaseSchema;
export const servicePatchSchema = serviceBaseSchema.partial();

export function parseService(body: Record<string, unknown>, partial = false): Partial<ServiceInput> {
  const schema = partial ? servicePatchSchema : serviceSchema;
  const res = schema.safeParse(body);
  if (!res.success) {
    throw new Error(res.error.issues[0]?.message || "dados do serviço inválidos");
  }
  return res.data;
}

export type MonitorInput = {
  serviceId: number;
  name: string;
  path: string;
  url?: string | null;
  method: string;
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatus: number;
  enabled: boolean;
  body?: string | null;
};

const jsonBodySchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === "string" ? v.trim() : null))
  .refine(
    (v) => {
      if (!v) return true;
      try {
        JSON.parse(v);
        return true;
      } catch {
        return false;
      }
    },
    { message: "body precisa ser um JSON válido" },
  );

const monitorBaseSchema = z.object({
  serviceId: z.coerce.number().int().min(1, "serviceId obrigatório"),
  name: z.string().trim().min(1, "name obrigatório"),
  path: z.string().trim().transform(parsePath).default("/"),
  url: z.string().trim().optional(),
  method: z
    .string()
    .transform((m) => m.toUpperCase())
    .refine((m) => METHODS.includes(m as (typeof METHODS)[number]), { message: "method inválido" }),
  intervalSeconds: z.coerce
    .number()
    .int()
    .refine((n) => n >= 10 && n <= 86400, { message: "intervalSeconds entre 10 e 86400" }),
  timeoutMs: z.coerce
    .number()
    .int()
    .min(500, { message: "timeoutMs entre 500 e 30000" })
    .max(30000, { message: "timeoutMs entre 500 e 30000" }),
  expectedStatus: z.coerce
    .number()
    .int()
    .min(100, { message: "expectedStatus inválido" })
    .max(599, { message: "expectedStatus inválido" }),
  enabled: z.boolean(),
  body: jsonBodySchema,
});

export const monitorSchema = monitorBaseSchema.extend({
  method: monitorBaseSchema.shape.method.default("GET"),
  intervalSeconds: monitorBaseSchema.shape.intervalSeconds.default(60),
  timeoutMs: monitorBaseSchema.shape.timeoutMs.default(5000),
  expectedStatus: monitorBaseSchema.shape.expectedStatus.default(200),
  enabled: monitorBaseSchema.shape.enabled.default(true),
  body: jsonBodySchema.optional(),
});

export const monitorPatchSchema = monitorBaseSchema.partial();

export function parseMonitor(body: Record<string, unknown>, partial = false): Partial<MonitorInput> {
  const schema = partial ? monitorPatchSchema : monitorSchema;
  const res = schema.safeParse(body);
  if (!res.success) {
    throw new Error(res.error.issues[0]?.message || "dados inválidos");
  }
  return res.data;
}

export const alertSchema = z
  .object({
    channel: z.string().refine((c) => CHANNELS.includes(c as (typeof CHANNELS)[number]), {
      message: "channel: email, discord ou webhook",
    }),
    target: z.string().trim().min(1, "target obrigatório"),
  })
  .superRefine((data, ctx) => {
    if (data.channel === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.target)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "e-mail inválido",
        });
      }
    } else {
      try {
        const u = new URL(data.target);
        if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "url inválida",
        });
      }
    }
  });

export function parseAlert(body: Record<string, unknown>): { channel: string; target: string } {
  const res = alertSchema.safeParse(body);
  if (!res.success) {
    throw new Error(res.error.issues[0]?.message || "alerta inválido");
  }
  return res.data;
}

export type CardInput = {
  name: string;
  status: string;
  description: string;
  resolved: boolean;
};

const cardBaseSchema = z.object({
  name: z.string().trim().min(1, "name obrigatório").max(100, "name máx. 100 caracteres"),
  status: z.string().trim().min(1, "status obrigatório").max(100, "status máx. 100 caracteres"),
  description: z.string().trim().max(300, "description máx. 300 caracteres"),
  resolved: z.boolean(),
});

export const cardSchema = cardBaseSchema.extend({
  description: cardBaseSchema.shape.description.default(""),
  resolved: cardBaseSchema.shape.resolved.default(false),
});

export const cardPatchSchema = cardBaseSchema.partial();

export function parseCard(body: Record<string, unknown>, partial = false): Partial<CardInput> {
  const schema = partial ? cardPatchSchema : cardSchema;
  const res = schema.safeParse(body);
  if (!res.success) {
    throw new Error(res.error.issues[0]?.message || "card inválido");
  }
  return res.data;
}

function clip(s: string, n: number) {
  return s.trim().slice(0, n);
}

/** JSON do Groq: corta no limite do banco, nunca lança. */
export function parseGroqCard(raw: string): { name: string; status: string; description: string } | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const name = typeof o.name === "string" ? clip(o.name, 100) : "";
  const status = typeof o.status === "string" ? clip(o.status, 100) : "";
  const description = typeof o.description === "string" ? clip(o.description, 300) : "";
  if (!name || !status) return null;
  return { name, status, description };
}
