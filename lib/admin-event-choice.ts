/**
 * THE CHOSEN TOURNAMENT — one rule, read by the server's first paint and by the browser (Navigation Phase 0, plan
 * `docs/projects/active/ADMIN_NAV_EVALUATION_PLAN.md` §5).
 *
 * A tournament has no address: `/{org}/admin/tournaments/<page>` carries no event, so the choice is remembered. It used to
 * live only in the browser's `localStorage`, which the server cannot read, so every tournament page painted the club's
 * name first and swapped to the event once the browser had fetched the list. The choice is now ALSO kept in a cookie per
 * organization (written wherever the choice is written), the admin layout reads it, and the provider starts from the
 * server's list — the strip, the phone bar and the sidebar name the event on the first paint.
 *
 * The rule, in order (unchanged from before the cookie): the caller's pick (the event it just created) → the address's
 * `?tournamentId` → its `?tournamentSlug` → the saved choice → the event closest to come up (`closestToComeUp`; it was "the
 * live event, then the first" before 2026-11-10). Every candidate is looked up in
 * the list the person may open (org-filtered and assignment-scoped on the server), so a deleted event, another
 * organization's event or one this person is not assigned to is never chosen — it falls through to the next rung.
 *
 * Client-safe: no server imports. The cookie is not HttpOnly on purpose — the browser writes it, and it is a preference,
 * never a permission (the server only ever looks it up in the scoped list).
 */

import { tournamentToday } from './timezone';

/** One cookie per organization, scoped to that organization's admin, so org A's choice is never sent to org B's pages. */
export function adminEventCookieName(orgSlug: string): string {
  return `flhq_admin_event_${orgSlug}`;
}

export function adminEventCookiePath(orgSlug: string): string {
  return `/${orgSlug}/admin`;
}

type Choosable = { id: string; slug: string; status: string; startDate?: string | null; endDate?: string | null };

/**
 * ⚖ THE EVENT TO LAND ON when nothing was chosen (owner 2026-11-10: the foot's Tournaments door opens the Dashboard of the
 * tournament "closest to come up"). Live events (Active) come first, then completed ones, then drafts, so a club's running
 * event is never passed over for an old record. Inside that group: the one happening today, else the next to start, else
 * one with no dates yet, else the one that ended most recently. Dates are the tournament's own `YYYY-MM-DD` strings, so they
 * compare as text, and `today` is the organization's day (`tournamentToday`) — the server and the browser agree.
 */
export function closestToComeUp<T extends Choosable>(list: readonly T[], today: string): T | null {
  const pool = [list.filter(t => t.status === 'active'), list.filter(t => t.status === 'completed'), list.filter(t => t.status === 'draft')]
    .find(group => group.length > 0) ?? list;
  const start = (t: T) => t.startDate || null;
  const end = (t: T) => t.endDate || t.startDate || null;
  const happening = pool.filter(t => start(t) && start(t)! <= today && end(t)! >= today);
  if (happening.length > 0) return happening.reduce((a, b) => (start(b)! < start(a)! ? b : a));
  const ahead = pool.filter(t => start(t) && start(t)! > today);
  if (ahead.length > 0) return ahead.reduce((a, b) => (start(b)! < start(a)! ? b : a));
  const undated = pool.find(t => !start(t));
  if (undated) return undated;
  const past = pool.filter(t => end(t));
  return past.length > 0 ? past.reduce((a, b) => (end(b)! > end(a)! ? b : a)) : (pool[0] ?? null);
}

export type EventChoiceInputs = {
  /** A caller's pick: the id of the event it just created. */
  pick?: string | null;
  /** The address's `?tournamentId`. */
  urlId?: string | null;
  /** The address's `?tournamentSlug` (slugs are stable across environments where ids are not — the sandbox's door). */
  urlSlug?: string | null;
  /** The remembered choice, in the order to try (the browser passes its cookie, then its `localStorage` copy). */
  savedIds?: ReadonlyArray<string | null | undefined>;
};

export type EventChoice<T> = {
  /** The event on screen. */
  current: T | null;
  /** The choice to remember, when it was a choice (the pick, the address or the saved one) — never the live/first
   *  fallback, so a fallback never becomes sticky. */
  remember: T | null;
};

export function chooseTournament<T extends Choosable>(list: readonly T[], inputs: EventChoiceInputs): EventChoice<T> {
  const byId = (id: string | null | undefined) => (id ? list.find(t => t.id === id) ?? null : null);
  const picked = byId(inputs.pick);
  const fromUrl = byId(inputs.urlId) ?? (inputs.urlSlug ? list.find(t => t.slug === inputs.urlSlug) ?? null : null);
  const explicit = picked ?? fromUrl;
  let saved: T | null = null;
  for (const id of inputs.savedIds ?? []) {
    saved = byId(id);
    if (saved) break;
  }
  return {
    current: explicit ?? saved ?? closestToComeUp(list, tournamentToday()) ?? null,
    remember: explicit ?? saved,
  };
}
