/**
 * Client-side "last server requestId" stash (Phase 3).
 *
 * The server stamps `x-request-id` on every response (proxy.ts for all routes, withObservability
 * for wrapped routes — the same id that is stored on error_events.request_id when a 5xx is captured).
 * FeedbackRequestIdProvider installs a one-time window.fetch wrapper that feeds each response here,
 * so the feedback widget can attach the id and a bug report deep-links to the captured error.
 *
 * Best-effort: getLastRequestId() returns null until some API call has carried the header. SSR-safe
 * (sessionStorage is only touched at call time, inside try/catch).
 */
const KEY = 'flhq:lastRequestId';
let lastRequestId: string | null = null;

export function recordRequestId(id: string | null | undefined): void {
  if (!id) return;
  lastRequestId = id;
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    /* storage blocked (private mode / SSR) — in-memory value still works */
  }
}

export function recordFromResponse(res: { headers?: Headers } | null | undefined): void {
  try {
    const id = res?.headers?.get?.('x-request-id');
    if (id) recordRequestId(id);
  } catch {
    /* opaque/cross-origin response — no readable headers */
  }
}

export function getLastRequestId(): string | null {
  if (lastRequestId) return lastRequestId;
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored) lastRequestId = stored;
  } catch {
    /* ignore */
  }
  return lastRequestId;
}
