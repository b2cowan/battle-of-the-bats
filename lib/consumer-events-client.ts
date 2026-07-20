/**
 * Client-side fire-and-forget helper for consumer front-door instrumentation (Unified Home
 * Phase 5 §6 success metrics). Lands in the existing in-house `platform_events` store — no new
 * analytics pipeline, no migration (`event_type` is free text).
 *
 * The ingest route (app/api/events/consumer) only honours this allowlist, so the client can't
 * forge the SERVER-fired consumer signals (directory_search, chat_inbox_loaded,
 * auth_workspace_landing) which are written from their own routes.
 */

// Single source of truth for the client-fired event names: the ingest route imports this same
// array for its allowlist, and the union type is derived from it — add an event in one place and
// both the client helper and the server allowlist stay in lock-step.
export const CONSUMER_CLIENT_EVENTS = ['home_ready', 'home_card_tapped', 'chat_tab_opened', 'follow_tapped'] as const;
export type ConsumerClientEvent = (typeof CONSUMER_CLIENT_EVENTS)[number];

/**
 * Best-effort: never throws, never blocks the UI. `keepalive` lets the POST survive a navigation
 * (e.g. a card tap that immediately routes away). Actor attribution is server-side — the ingest
 * route resolves the session; anonymous (signed-out) events are accepted and attributed actor-null,
 * because signed-out Home views/bounce are metrics we care about.
 */
export function fireConsumerEvent(
  event: ConsumerClientEvent,
  metadata: Record<string, unknown> = {},
): void {
  try {
    void fetch('/api/events/consumer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ event, metadata }),
    }).catch(() => {});
  } catch {
    /* noop — instrumentation must never affect the user path */
  }
}
