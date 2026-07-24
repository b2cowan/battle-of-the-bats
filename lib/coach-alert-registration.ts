/**
 * lib/coach-alert-registration.ts — one definition of the coach overview's "your tournament"
 * context ("The Flip" P3): the team's live/upcoming publicly-visible registration, feeding the
 * CoachLiveEventCard (event name + dates + the ⇄ Fan view door). Both coach overviews (premium
 * client effect + free server component) call this so the rule can't drift between them.
 * Pure + client-safe (no server imports), so the premium client shell can use it too.
 *
 * (The P2-era one-tap game-alerts row and its stricter accepted-only rule were REMOVED by owner
 * call 2026-07-23 — the public side owns follow/alert affordances; the portal doesn't push them.)
 */

export interface AlertHistoryEntry {
  registration: { id: string; status: string };
  org?: { slug?: string | null } | null;
  tournament?: {
    slug?: string | null;
    status?: string | null;
    /** Optional context for the overview's live-event card (P3 rev-4) — name + dates. */
    name?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  } | null;
}

export interface FanViewRegistration {
  orgSlug: string;
  tournamentSlug: string;
  /** Event context for the overview's compact live-event card (owner call 2026-07-23 rev 4:
   *  the ⇄ Fan view door must name the event it opens — it can't float context-free). */
  name: string | null;
  startDate: string | null;
  endDate: string | null;
}

/**
 * The overview's "your tournament" block ("The Flip" P3): the first registration in a
 * LIVE/upcoming (active) public tournament — ANY registration status, since a pending/waitlisted
 * coach can still watch the public event. Shared by BOTH tiers' overviews so eligibility can't
 * drift between them; a finished event's flip lives on its record page + list row only
 * (owner call 2026-07-23, rev-3 mockups).
 */
export function pickFanViewRegistration(history: AlertHistoryEntry[]): FanViewRegistration | null {
  const entry = history.find(
    e => e.tournament?.status === 'active' && !!e.org?.slug && !!e.tournament?.slug,
  );
  if (!entry) return null;
  const tournament = entry.tournament!;
  return {
    orgSlug: entry.org!.slug!,
    tournamentSlug: tournament.slug!,
    name: tournament.name ?? null,
    startDate: tournament.startDate ?? null,
    endDate: tournament.endDate ?? null,
  };
}
