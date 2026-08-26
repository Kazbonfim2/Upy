import type { ProbeResult } from "./health";

// ponytail: consome no máximo maxBytes do stream para evitar estouro de memória em arquivos grandes
async function readBodyLimited(res: Response, maxBytes = 10000): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (totalBytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      totalBytes += value.length;
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  const combined = new Uint8Array(Math.min(totalBytes, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = maxBytes - offset;
    if (remaining <= 0) break;
    const toCopy = Math.min(chunk.length, remaining);
    combined.set(chunk.subarray(0, toCopy), offset);
    offset += toCopy;
  }

  return new TextDecoder().decode(combined);
}

export async function probe(
  url: string,
  method: string,
  timeoutMs: number,
  body?: string | null,
): Promise<ProbeResult> {
  const started = performance.now();
  try {
    const hasBody = Boolean(body && !["GET", "HEAD"].includes(method.toUpperCase()));
    const res = await fetch(url, {
      method,
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? body! : undefined,
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const rawText = await readBodyLimited(res, 10000);
    const latencyMs = Math.round(performance.now() - started);
    const responseBody = rawText && rawText.trim()
      ? rawText
      : JSON.stringify({ status: res.status, latencyMs }, null, 2);
    return {
      statusCode: res.status,
      latencyMs,
      error: null,
      responseBody,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const latencyMs = Math.round(performance.now() - started);
    return {
      statusCode: null,
      latencyMs,
      error: msg.slice(0, 500),
      responseBody: JSON.stringify({ error: msg, latencyMs }, null, 2),
    };
  }
}
