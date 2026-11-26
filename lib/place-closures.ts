/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLOSE A PLACE, PURE (Club Website Stage 2; rulings K1–K17, plan CLUB_WEBSITE_ENHANCEMENTS_PLAN.md §7; mig 539). No read
 * here: the rules the window, the press's server half and the public reads share, each pinned by a test.
 *
 * ⚖ ONE MATCHING RULE (K7), the same as the database's `place_closure_match`: a game on the place's id first (a one-diamond
 *   closure takes that diamond's games, and lists a game on the place with no diamond as "maybe"); then a game with no
 *   place id whose typed text holds the place's name, in any case ("maybe": listed unticked). A game on ANOTHER place's id
 *   is not there, whatever its text says.
 * ⚖ THE TEAM'S OWN PLACES (`rep_team_events.place_id` → `rep_team_places`) are read as typed text: the team place's name
 *   is searched beside the game's own typed place (`repTypedText`), exactly as the press reads it. A team place is the
 *   coach's own words for a field, not the club's record of it, so it is "maybe" at most and never ticked for the admin.
 * ⚖ A REP MARK IS SPENT BY READING, never by writing (`markSpent`): the game no longer has the time or place it had when
 *   marked, or it was cancelled. It is DOWN when its closure is reopened. A second closure is its own mark.
 * ⚖ THE STRIP CARRIES PLACE WORDS ONLY (K16): a closure's place, its diamond and its days. No count, no division, no
 *   person's or team's name, no admin line — `stripClosureOf` is the one door from a closure row to a public page.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export type ClosureScope = 'place' | 'diamond' | 'all';
export type ClosureVerb = 'postponed' | 'cancelled';
export type PlaceMatch = 'linked' | 'maybe';

/** The longest closure: Until at most 13 days after the Day (mig 539's `org_place_closures_days`). */
export const CLOSURE_MAX_EXTRA_DAYS = 13;

/** Spaces off both ends, and only spaces: SQL's `btrim(x)`, so the two languages trim alike. */
const btrim = (x: string) => x.replace(/^ +| +$/g, '');

/** The place's name inside typed text, any case (mig 539's `place_name_in_typed`). A blank name or text matches nothing. */
export function placeNameInTyped(name: string | null | undefined, typed: string | null | undefined): boolean {
  const n = btrim(name ?? '');
  if (!n || !btrim(typed ?? '')) return false;
  return typed!.toLowerCase().includes(n.toLowerCase());
}

/** A place being closed: a whole place, one diamond of it, or every place (`all`, no place named). */
export interface ClosedPlace {
  scope: ClosureScope;
  venueId: string | null;
  facilityId: string | null;
  /** The place's name (null for `all`). */
  name: string | null;
  /** The diamond's name, for a one-diamond closure (the window's words; the matching never reads it). */
  facilityName?: string | null;
}

/** Where a game is, as the matching reads it. `typed` is its typed place (a rep game's: `repTypedText`). */
export interface GamePlace {
  venueId: string | null;
  facilityId: string | null;
  typed: string | null;
}

/** How a game stands to one closed place (mig 539's `place_closure_match`). */
export function placeClosureMatch(p: ClosedPlace, g: GamePlace): PlaceMatch | null {
  if (p.scope === 'all') return 'linked';
  if (g.venueId) {
    if (g.venueId !== p.venueId) return null;
    if (!p.facilityId || g.facilityId === p.facilityId) return 'linked';
    return g.facilityId ? null : 'maybe';
  }
  return placeNameInTyped(p.name, g.typed) ? 'maybe' : null;
}

/** The first closed place (in the window's order) a game is at, and how — the press assigns each game the same way. */
export function firstClosureMatch(places: readonly ClosedPlace[], g: GamePlace): { index: number; match: PlaceMatch } | null {
  for (let i = 0; i < places.length; i++) {
    const match = placeClosureMatch(places[i], g);
    if (match) return { index: i, match };
  }
  return null;
}

/** A rep game's typed text: its own typed place and its team place's name, together (the press's `concat_ws(' · ', …)`). */
export function repTypedText(location: string | null | undefined, teamPlaceName: string | null | undefined): string | null {
  const parts = [location, teamPlaceName].filter((x): x is string => x != null);
  return parts.length ? parts.join(' · ') : null;
}

// ── The rep mark ───────────────────────────────────────────────────────────────────────────────────────────────────

/** A mark as recorded at the press (`rep_event_closure_marks`). */
export interface RepMark {
  id: string;
  closureId: string;
  eventId: string;
  teamId: string;
  markedStartsAt: string;
  markedVenueId: string | null;
  markedFacilityId: string | null;
  markedPlaceId: string | null;
  markedLocation: string | null;
  coachEmailedAt: string | null;
}

/** The rep game as it is now (the fields a mark compares). */
export interface MarkedEventNow {
  id: string;
  startsAt: string;
  status: string;
  venueId: string | null;
  facilityId: string | null;
  placeId: string | null;
  location: string | null;
}

const sameInstant = (a: string, b: string) => Date.parse(a) === Date.parse(b);

/**
 * Spent: the coach moved the game (its time or any of its place fields differ from when it was marked), cancelled it, or
 * it is gone. Read, never written (K9: "It clears when the coach moves or cancels the game").
 */
export function markSpent(mark: RepMark, event: MarkedEventNow | null | undefined): boolean {
  if (!event || event.status === 'cancelled') return true;
  return !sameInstant(mark.markedStartsAt, event.startsAt)
    || (mark.markedVenueId ?? null) !== (event.venueId ?? null)
    || (mark.markedFacilityId ?? null) !== (event.facilityId ?? null)
    || (mark.markedPlaceId ?? null) !== (event.placeId ?? null)
    || (mark.markedLocation ?? null) !== (event.location ?? null);
}

/** A mark shows while its closure is not reopened (K11) and the game is not moved or cancelled. */
export function markStanding(mark: RepMark, event: MarkedEventNow | null | undefined, closure: { reopenedAt: string | null }): boolean {
  return !closure.reopenedAt && !markSpent(mark, event);
}

// ── The strip ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** What a public page may know of a closure (K16): place words and days, nothing else. */
export interface StripClosure {
  scope: ClosureScope;
  placeName: string | null;
  facilityName: string | null;
  /** Club days, YYYY-MM-DD. */
  firstDay: string;
  lastDay: string;
}

/** The fields of a closure row the strip reads; a guard pins the server's select to exactly these. */
export const STRIP_CLOSURE_COLUMNS = 'scope, place_name, facility_name, first_day, last_day' as const;

/** The one door from a closure row to a public page: it copies place words and days and NOTHING else. */
export function stripClosureOf(row: {
  scope: ClosureScope; place_name: string | null; facility_name: string | null; first_day: string; last_day: string;
}): StripClosure {
  return {
    scope: row.scope,
    placeName: row.scope === 'all' ? null : row.place_name,
    facilityName: row.scope === 'diamond' ? row.facility_name : null,
    firstDay: row.first_day,
    lastDay: row.last_day,
  };
}

/** Showing now: from the press (K3) to the end of Until, and not reopened. No job ends one: this is the whole rule. */
export function isClosureShowing(c: { showsFrom: string; endsAt: string; reopenedAt: string | null }, nowMs: number): boolean {
  return !c.reopenedAt && Date.parse(c.showsFrom) <= nowMs && nowMs < Date.parse(c.endsAt);
}

// ── The place's words, and the strip's sentence (Session 2B; the strip itself is 2C) ───────────────────────────────

/** "Lions Park" · "Diamond 2 at Lions Park" · null for every place. The one name of a closed place in every sentence. */
export function closedPlaceName(c: { scope: ClosureScope; placeName: string | null; facilityName: string | null }): string | null {
  if (c.scope === 'all') return null;
  return c.scope === 'diamond' && c.facilityName ? `${c.facilityName} at ${c.placeName ?? ''}` : c.placeName;
}

/** A club day, YYYY-MM-DD, one day later (pure: the calendar, no zone). */
function nextDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * THE STRIP'S SENTENCE (K3, K16; the drawing's tab 4 and words list), in the club's day: "Lions Park is closed today.",
 * "Lions Park is closed tomorrow (Sat, Nov 28).", "Lions Park is closed through Sun, Nov 29.", "Diamond 2 at Lions Park is
 * closed today.", "All our fields are closed today." Fixed words over place words and days only. `say` formats a club
 * day ("Sat, Nov 28"): passed in, so this file stays free of the zone module.
 */
export function stripSentence(c: StripClosure, today: string, say: (day: string) => string): string {
  const name = closedPlaceName(c);
  const subject = name ? `${name} is` : 'All our fields are';
  const oneDay = c.firstDay === c.lastDay;
  let when: string;
  if (c.firstDay <= today) when = oneDay || c.lastDay <= today ? 'closed today' : `closed through ${say(c.lastDay)}`;
  else if (c.firstDay === nextDay(today)) when = oneDay ? `closed tomorrow (${say(c.firstDay)})` : `closed from tomorrow (${say(c.firstDay)}) through ${say(c.lastDay)}`;
  else when = oneDay ? `closed on ${say(c.firstDay)}` : `closed from ${say(c.firstDay)} through ${say(c.lastDay)}`;
  return `${subject} ${when}.`;
}
