import nodemailer from "nodemailer";

export function discordPayload(name: string, url: string, up: boolean, detail: string) {
  return {
    content: up
      ? `✅ **${name}** voltou (${url})\n${detail}`
      : `🔴 **${name}** caiu (${url})\n${detail}`,
  };
}

export function webhookPayload(name: string, url: string, up: boolean, detail: string) {
  return {
    event: up ? "incident.resolved" : "incident.opened",
    monitor: name,
    url,
    up,
    detail,
    at: new Date().toISOString(),
  };
}

export async function sendHttpJson(target: string, body: unknown) {
  const res = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`alert HTTP ${res.status}`);
}

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
  from: string;
};

export function resolveSmtpConfig(env: Record<string, string | undefined> = process.env): SmtpConfig {
  const port = Number(env.SMTP_PORT || 587);
  return {
    host: env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    from: env.SMTP_FROM || env.SMTP_USER || "upy@gmail.com",
  };
}

let cachedTransporter: nodemailer.Transporter | null = null;

export function getTransporter(): nodemailer.Transporter | null {
  if (cachedTransporter) return cachedTransporter;
  const config = resolveSmtpConfig(process.env);
  if (!config.auth) return null;
  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
  return cachedTransporter;
}

export async function sendEmail(to: string, subject: string, text: string) {
  const isDevLog = process.env.SMTP_DEV_LOG === "true";
  if (isDevLog) {
    console.log(`[SMTP DEV LOG] Para: ${to} | Assunto: ${subject}\n${text}`);
    return;
  }

  const isProd = process.env.NODE_ENV === "production";
  const config = resolveSmtpConfig(process.env);

  if (!config.auth) {
    if (isProd) {
      throw new Error("[email error] SMTP_USER e SMTP_PASS são obrigatórios em produção com Google SMTP");
    }
    console.log(`[SMTP DEV LOG] (sem credenciais SMTP) Para: ${to} | Assunto: ${subject}\n${text}`);
    return;
  }

  const transporter = getTransporter();
  if (!transporter) return;

  await transporter.sendMail({
    from: config.from,
    to,
    subject,
    text,
  });
}
