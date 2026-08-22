import type { ProbeResult } from "./health";

export async function probe(
  url: string,
  method: string,
  timeoutMs: number,
): Promise<ProbeResult> {
  const started = performance.now();
  try {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      statusCode: res.status,
      latencyMs: Math.round(performance.now() - started),
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      statusCode: null,
      latencyMs: Math.round(performance.now() - started),
      error: msg.slice(0, 500),
    };
  }
}
