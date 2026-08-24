import type { ProbeResult } from "./health";

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
    const rawText = await res.text();
    const responseBody = rawText && rawText.trim()
      ? rawText.slice(0, 10000)
      : JSON.stringify({ status: res.status, latencyMs: Math.round(performance.now() - started) }, null, 2);
    return {
      statusCode: res.status,
      latencyMs: Math.round(performance.now() - started),
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
