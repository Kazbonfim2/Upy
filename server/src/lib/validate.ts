import { z } from "zod";

const METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"] as const;
const CHANNELS = ["email", "discord", "webhook"] as const;

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

export const monitorSchema = z.object({
  name: z.string().trim().min(1, "name obrigatório"),
  url: z.string().trim().transform(parseUrl),
  method: z
    .string()
    .default("GET")
    .transform((m) => m.toUpperCase())
    .refine((m) => METHODS.includes(m as (typeof METHODS)[number]), { message: "method inválido" }),
  intervalSeconds: z.coerce
    .number()
    .int()
    .refine((n) => n >= 10 && n <= 86400, { message: "intervalSeconds entre 10 e 86400" })
    .default(60),
  timeoutMs: z.coerce
    .number()
    .int()
    .min(500, { message: "timeoutMs entre 500 e 30000" })
    .max(30000, { message: "timeoutMs entre 500 e 30000" })
    .default(5000),
  expectedStatus: z.coerce
    .number()
    .int()
    .min(100, { message: "expectedStatus inválido" })
    .max(599, { message: "expectedStatus inválido" })
    .default(200),
  enabled: z.boolean().default(true),
  body: jsonBodySchema.optional(),
});

export function parseMonitor(body: Record<string, unknown>, partial = false): Partial<MonitorInput> {
  if (partial) {
    const partialSchema = monitorSchema.partial();
    const res = partialSchema.safeParse(body);
    if (!res.success) {
      throw new Error(res.error.issues[0]?.message || "dados inválidos");
    }
    return res.data;
  }
  const res = monitorSchema.safeParse(body);
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
        parseUrl(data.target);
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

export const cardSchema = z.object({
  name: z.string().trim().min(1, "name obrigatório").max(100, "name máx. 100 caracteres"),
  status: z.string().trim().min(1, "status obrigatório").max(100, "status máx. 100 caracteres"),
  description: z.string().trim().max(300, "description máx. 300 caracteres").default(""),
  resolved: z.boolean().default(false),
});

export function parseCard(body: Record<string, unknown>, partial = false): Partial<CardInput> {
  const schema = partial ? cardSchema.partial() : cardSchema;
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
