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
  const isProd = env.NODE_ENV === "production";
  const useGoogle = isProd || env.SMTP_PROVIDER === "google";

  if (useGoogle) {
    return {
      host: "smtp.gmail.com",
      port: Number(env.SMTP_PORT || 587),
      secure: Number(env.SMTP_PORT) === 465,
      auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      from: env.SMTP_FROM || env.SMTP_USER || "upy@gmail.com",
    };
  }

  return {
    host: env.SMTP_HOST || "localhost",
    port: Number(env.SMTP_PORT || 1025),
    secure: false,
    auth: undefined,
    from: env.SMTP_FROM || "upy@localhost",
  };
}

export async function sendEmail(to: string, subject: string, text: string) {
  const isProd = process.env.NODE_ENV === "production";
  const config = resolveSmtpConfig(process.env);

  if (isProd && !config.auth) {
    throw new Error("[email error] SMTP_USER e SMTP_PASS são obrigatórios em produção com Google SMTP");
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });

    await transporter.sendMail({
      from: config.from,
      to,
      subject,
      text,
    });
  } catch (err) {
    if (isProd) throw err;
    console.warn(`[email warn] Falha ao enviar via ${config.host} em dev, usando fallback MailHog:`, err);

    const fallback = nodemailer.createTransport({
      host: process.env.SMTP_FALLBACK_HOST || "localhost",
      port: Number(process.env.SMTP_FALLBACK_PORT || 1025),
      secure: false,
    });

    await fallback.sendMail({
      from: config.from,
      to,
      subject,
      text,
    });
  }
}
