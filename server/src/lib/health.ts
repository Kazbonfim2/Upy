export type ProbeResult = {
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
  responseBody: string | null;
};

export function isUp(result: ProbeResult, expectedStatus: number): boolean {
  return result.error === null && result.statusCode === expectedStatus;
}

export function nextIncidentAction(
  up: boolean,
  hasOpenIncident: boolean,
): "open" | "close" | "none" {
  if (!up && !hasOpenIncident) return "open";
  if (up && hasOpenIncident) return "close";
  return "none";
}

export function isDue(
  lastCheckedAt: Date | null,
  intervalSeconds: number,
  now: Date,
): boolean {
  if (!lastCheckedAt) return true;
  return now.getTime() - lastCheckedAt.getTime() >= intervalSeconds * 1000;
}
