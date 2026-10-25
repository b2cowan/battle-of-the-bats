/**
 * The console's one JSON call from a record screen (the club and the person record): send, read the answer, and turn a
 * refusal into the sentence the server gave — or the screen's own fallback.
 */
export async function sendJson(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  // No answer at all (offline, a dropped connection) is a refusal with no sentence: the screen's fallback says it.
  if (!res) return { ok: false, data: {} };
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

/** The server's refusal sentence, or the fallback. */
export function errorOf(data: Record<string, unknown>, fallback: string): string {
  return typeof data.error === 'string' ? data.error : fallback;
}
