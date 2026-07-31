/**
 * lib/coach-alert-registration.ts — one definition of the coach overview's "your tournament"
 * context ("The Flip" P3): which of the team's registrations the overview names, and whether that
 * event has a ⇄ Fan view door. Both coach overviews (premium client effect + free server component)
 * call into here so the rules can't drift between them. Pure + client-safe (no server imports), so
 * the premium client shell can use it too.
 *
 * (The P2-era one-tap game-alerts row and its stricter accepted-only rule were REMOVED by owner
 * call 2026-07-23 — the public side owns follow/alert affordances; the portal doesn't push them.)
 */

import { sortByCoachLifecycle } from './coach-tournament-lifecycle';

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

/** The minimum an entry must carry to be ordered by which event is actually HAPPENING. */
type DatedEntry = { tournament?: { startDate?: string | null; endDate?: string | null } | null };

/** …plus the registration's own standing, for the one decision that must not ignore it. */
type StandingEntry = DatedEntry & { registration?: { status?: string | null } | null };

/**
 * DF-2 — order candidates by LIFECYCLE, never by the order the caller happened to fetch them in.
 *
 * The defect this closes: every caller passes history sorted `registeredAt` DESC, so "the first
 * match" meant "the most recently registered" — a team entered in an August event yesterday
 * out-ranked the one it is playing this morning. Registration date is not a claim about which
 * tournament a coach is in the middle of.
 */
function liveFirst<T extends DatedEntry>(history: T[], today?: string): T[] {
  return sortByCoachLifecycle(
    history,
    entry => entry.tournament?.startDate ?? null,
    entry => entry.tournament?.endDate ?? null,
    today,
  );
}

/**
 * The ONE rule for whether a coach-facing tournament ROW carries a ⇄ Fan view door: the public
 * page has to exist. `PUBLIC_STATUSES` is `active | completed`, so a finished event keeps its door
 * on a row (owner call 2026-07-23 — a finished event's flip lives on its record page and its list
 * rows) while a draft/archived one has nothing to open.
 *
 * Previously inlined, identically, at three call sites. Note this is DELIBERATELY wider than
 * `pickFanViewRegistration` below, which is about a *current* event rather than a row.
 */
export function resolveRowFanView(entry: {
  org?: { slug?: string | null } | null;
  tournament?: { slug?: string | null; status?: string | null } | null;
}): { orgSlug: string; tournamentSlug: string } | null {
  const orgSlug = entry.org?.slug;
  const tournamentSlug = entry.tournament?.slug;
  const status = entry.tournament?.status;
  if (!orgSlug || !tournamentSlug) return null;
  if (status !== 'active' && status !== 'completed') return null;
  return { orgSlug, tournamentSlug };
}

/**
 * DF-1 — the ONE registration the free team Overview names.
 *
 * The Overview used to render the team's ENTIRE tournament list (a verbatim copy of the Tournaments
 * tab, which is a permanent tab one tap away) and then repeat its top entry immediately below as a
 * second card drawn from the same array. This picks the single entry worth naming: whatever is
 * happening, then whatever is next, and only then the most recent finished event.
 *
 * Deliberately NOT gated on the event being published — a coach whose registration is still in a
 * draft event should see their registration; it simply has no fan-view door (`resolveRowFanView`).
 *
 * ⚠ Lifecycle alone is NOT enough: `history` carries REJECTED entries unfiltered (they are part of
 * the team's record — the Tournaments tab says so explicitly). A team turned away from an event
 * running this weekend, but accepted into one three weeks out, would otherwise have its Overview
 * headline the tournament it is NOT playing in while the registration it actually has to act on is
 * demoted behind "See all". So: anything the team is still in outranks anything it was turned away
 * from; a rejection is featured only when there is nothing else to feature (in which case it IS the
 * honest answer — better than an empty page that implies no history at all).
 */
export function pickFeaturedRegistration<T extends StandingEntry>(history: T[], today?: string): T | null {
  const ordered = liveFirst(history, today);
  return ordered.find(entry => entry.registration?.status !== 'rejected') ?? ordered[0] ?? null;
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
 * The premium Overview tail's "your tournament" row ("The Flip" P3): the team's current published
 * event — ANY registration status, since a pending/waitlisted coach can still watch the public
 * event. A finished event's flip lives on its record page + list rows only (owner call 2026-07-23,
 * rev-3 mockups), which is why this stays narrower than `resolveRowFanView`.
 *
 * ⚠ `status === 'active'` is the tournament's PUBLICATION state (`draft|active|completed|archived`),
 * NOT its lifecycle — an event that finished last week is still `active` until its organizer marks
 * it completed. So this can legitimately return a past event, which is exactly why
 * `CoachLiveEventCard` grew its `Finished` chip (Chunk I). What it must never do is return a FUTURE
 * event while a live one is running: hence the lifecycle ordering below (DF-2). The callers pass
 * history in `registeredAt` order, which is not an ordering this function can trust.
 */
export function pickFanViewRegistration(
  history: AlertHistoryEntry[],
  today?: string,
): FanViewRegistration | null {
  const entry = liveFirst(history, today).find(
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
