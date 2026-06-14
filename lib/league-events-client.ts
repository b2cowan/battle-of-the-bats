/**
 * Client-side fire-and-forget helper for the two CLIENT-originated League Starter instrumentation
 * events (Free Tier Phase 6.6 / §13). The server-originated events (free_floor_created,
 * league_season_created, league_schedule_generated, scope_wall_hit, existing_user_floor_added) are
 * written directly from their routes via writePlatformEvent and are intentionally NOT acceptable here
 * — the ingest route (app/api/events/league) only honours this allowlist so the client can't forge
 * activation/cap signals.
 *
 * Both land in the existing in-house `platform_events` store (reused, no new analytics pipeline);
 * the platform-admin Command Center reads the counts.
 */

export type LeagueClientEvent = 'upgrade_intent_clicked' | 'league_public_page_shared';

/**
 * Best-effort: never throws, never blocks the UI. `keepalive` lets the POST survive a navigation
 * (e.g. the "View public page" link opening a new tab). Attribution is server-verified — `orgId` is
 * only honoured when the signed-in user is a member of that org.
 */
export function fireLeagueEvent(
  event: LeagueClientEvent,
  payload: { orgId?: string | null; metadata?: Record<string, unknown> } = {},
): void {
  try {
    void fetch('/api/events/league', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ event, orgId: payload.orgId ?? null, metadata: payload.metadata ?? {} }),
    }).catch(() => {});
  } catch {
    /* noop — instrumentation must never affect the user path */
  }
}
