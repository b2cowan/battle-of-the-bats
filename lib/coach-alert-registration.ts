/**
 * lib/coach-alert-registration.ts — one definition of a coach team's alertable tournament
 * registration ("The Flip" P2, N3b). Both coach overviews (premium client effect + free server
 * component) call this so the rule can't drift between them: the first ACCEPTED registration in a
 * LIVE (active) public tournament with both slugs present — i.e. there's actually a game to alert on.
 * Pure + client-safe (no server imports), so the premium client shell can use it too.
 *
 * Deliberately stricter than the overview's "Fan view" / "live now" scans (which allow completed
 * events / use a date window): alerts only make sense while games are still to be played.
 */

export interface AlertHistoryEntry {
  registration: { id: string; status: string };
  org?: { slug?: string | null } | null;
  tournament?: { slug?: string | null; status?: string | null } | null;
}

export interface AlertRegistration {
  registrationId: string;
  orgSlug: string;
  tournamentSlug: string;
}

export function pickAlertRegistration(history: AlertHistoryEntry[]): AlertRegistration | null {
  const entry = history.find(
    e => e.registration.status === 'accepted' &&
      e.tournament?.status === 'active' &&
      !!e.org?.slug && !!e.tournament?.slug,
  );
  return entry
    ? { registrationId: entry.registration.id, orgSlug: entry.org!.slug!, tournamentSlug: entry.tournament!.slug! }
    : null;
}
