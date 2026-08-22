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

export async function sendEmail(to: string, subject: string, text: string) {
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.log(`[email skip] ${to} | ${subject}`);
    return;
  }
  const port = Number(process.env.SMTP_PORT || 1025);
  const from = process.env.SMTP_FROM || "upy@localhost";
  const socket = await Bun.connect({ hostname: host, port });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  let leftover = "";

  const recv = async () => {
    while (true) {
      const nl = leftover.indexOf("\n");
      if (nl !== -1) {
        const line = leftover.slice(0, nl).replace(/\r$/, "");
        leftover = leftover.slice(nl + 1);
        return line;
      }
      const { value, done } = await reader.read();
      if (done) return leftover;
      leftover += decoder.decode(value);
    }
  };

  const cmd = async (line: string) => {
    await writer.write(encoder.encode(line + "\r\n"));
    return recv();
  };

  try {
    await recv();
    await cmd("HELO upy");
    await cmd(`MAIL FROM:<${from}>`);
    await cmd(`RCPT TO:<${to}>`);
    await cmd("DATA");
    await cmd(`From: ${from}\r\nTo: ${to}\r\nSubject: ${subject}\r\n\r\n${text}\r\n.`);
    await cmd("QUIT");
  } finally {
    socket.end();
  }
}
