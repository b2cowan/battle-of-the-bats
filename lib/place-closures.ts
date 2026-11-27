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
 *   marked, or it was cancelled. It is DOWN when its closure is reopened. A second closure is its own mark — and one press
 *   marks a game once per closure it is at (mig 549, D1), so the game stays marked until the LAST of them reopens.
 * ⚖ THE STRIP CARRIES PLACE WORDS ONLY (K16): a closure's place, its diamond and its days. No count, no division, no
 *   person's or team's name, no admin line — `stripClosureOf` is the one door from a closure row to a public page. It
 *   carries the place's id for the cover rule (S1, `closureCovers`), which the strip's box (`closureStrip`) never passes on.
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

/**
 * The press's places rule (mig 549's, mirrored): every entry a place, each (place, diamond) once, and never a whole place
 * beside one of its diamonds — or "every place" alone (no place named). M8: several diamonds of one place pass.
 */
export function placeEntriesValid(entries: readonly { venueId: string | null; facilityId: string | null }[]): boolean {
  if (!entries.length) return false;
  if (entries.some(e => !e.venueId)) return entries.length === 1 && !entries[0].facilityId;
  if (new Set(entries.map(e => `${e.venueId}:${e.facilityId ?? ''}`)).size !== entries.length) return false;
  const whole = new Set(entries.filter(e => !e.facilityId).map(e => e.venueId));
  return !entries.some(e => e.facilityId && whole.has(e.venueId));
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

/**
 * What a surface may know of a standing mark (K9; Session 2C): the closed place's words and the game's own club day,
 * nothing else — no closure id, no team, no person, no admin line (K16 holds for the mark as for the strip).
 */
export interface MarkWords {
  /** "Lions Park" · "Diamond 2 at Lions Park" · "All our fields". */
  place: string;
  /** The game's club day as said: "Sat, Nov 28". */
  day: string;
}

/** The mark's fixed words on every surface (K9, the drawing's tabs 4–6). */
export const MARK_WORDS = {
  /** The pill, on the public team page, the family schedule and the club home's band. */
  pill: 'Place closed',
  /** The coach's schedule chip, in the Moved chip's place (/marketing 2026-11-25: the coach reads what to DO). */
  coachPill: 'Needs a new date',
  /** The row's line, under the game (public team page, family schedule, the home's band). */
  line: (m: Pick<MarkWords, 'place'>) => `${m.place} closed · waits for a new date`,
  /** The coach's game sheet: a title and the club's one fixed sentence (no free text from the admin, /legal call 2). */
  sheetTitle: 'Needs a new date',
  sheetNote: (club: string, m: MarkWords) =>
    `${club ? `From ${club} · ` : ''}${m.place} closed on ${m.day}. Give this game a new date with Edit, or cancel it.`,
  /** The chip's hover words in the coach's calendar, beside the Moved chip's "The organizer moved this game". */
  chipTitle: 'The club closed this place. Give the game a new date.',
} as const;

/** The place words of a mark: the closed place, or "All our fields" when every place closed. */
export function markPlaceWords(c: { scope: ClosureScope; placeName: string | null; facilityName: string | null }): string {
  return closedPlaceName(c) ?? 'All our fields';
}

/** "2 diamonds at Lions Park": several diamonds of one place, said once. */
export const diamondsAt = (n: number, placeName: string | null) => `${n} diamonds at ${placeName ?? ''}`;

/** Names in their natural order ("Diamond 2" before "Diamond 10"): every list of a park's diamonds sorts by this. */
export const byNatural = (a: string, b: string) => a.localeCompare(b, 'en-CA', { numeric: true });

/** "Diamond 1 and Diamond 2 at Lions Park": a park's diamonds BY NAME, each once, in natural order (the Venue library's
 *  rows, Reopen's windows and the coach's reopen email say it the same way). */
export function diamondsNamed(names: Iterable<string>, placeName: string | null): string {
  const list = [...new Set(names)].sort(byNatural);
  const joined = list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
  return `${joined} at ${placeName ?? ''}`;
}
/** The verb after a closed place's words: "2 diamonds at Lions Park" and "All our fields" are; one place is. */
export const isAre = (placeWords: string) => (/^(\d+ diamonds at |all our fields$)/i.test(placeWords) ? 'are' : 'is');

type MarkClosure = { scope: ClosureScope; venueId?: string | null; placeName: string | null; facilityName: string | null };

/**
 * D1 (owner 2026-11-26; mig 549): ONE game's standing marks, said as one place. A game at the park with no diamond recorded
 * is marked by every diamond of that park closed over it; while two or more stand it reads "2 diamonds at Lions Park"
 * (the park, never a single diamond). The widest closure wins: every place, then the whole park over its diamonds.
 * Otherwise (two different parks) the first mark's place, as before.
 */
export function markPlaceOfAll(closures: readonly MarkClosure[]): string {
  const first = closures[0];
  if (!first || closures.some(c => c.scope === 'all')) return 'All our fields';
  const samePark = (c: MarkClosure) => (first.venueId != null && c.venueId != null
    ? c.venueId === first.venueId : c.placeName === first.placeName);
  if (closures.every(samePark)) {
    if (closures.some(c => c.scope === 'place')) return first.placeName ?? '';
    // Two presses on the same diamond are one diamond: "2 diamonds" needs two DIFFERENT diamonds.
    const diamonds = new Set(closures.map(c => c.facilityName)).size;
    if (diamonds > 1) return diamondsAt(diamonds, first.placeName);
  }
  return markPlaceWords(first);
}

// ── The strip ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** A closed place and its days: all the strip's sentence says (K16). */
export interface StripPlaceDays {
  scope: ClosureScope;
  placeName: string | null;
  facilityName: string | null;
  /** Club days, YYYY-MM-DD. */
  firstDay: string;
  lastDay: string;
}

/**
 * What a public page may know of a closure (K16): place words and days, and the two instants its small line says
 * ("Posted 7:10 a.m. by the club · ends tonight", the notice's own words; Session 2C). Nothing else: no count, division,
 * person, team or admin line.
 */
export interface StripClosure extends StripPlaceDays {
  /** The club place it closes (null for every place). The cover rule and the park's row read it; it never leaves the
   *  server — the strip's box (`closureStrip`) carries words only. */
  venueId: string | null;
  /** A whole park whose facilities are all diamonds (and it has some): its row reads "all diamonds". */
  allDiamonds: boolean;
  /** The press (K3: the strip shows from it). */
  showsFrom: string;
  /** Midnight after Until: the line takes itself down then, with no job. */
  endsAt: string;
}

/** The fields of a closure row the strip reads; a guard pins the server's select to exactly these. */
export const STRIP_CLOSURE_COLUMNS = 'scope, org_venue_id, place_name, facility_name, first_day, last_day, shows_from, ends_at' as const;

/** The one door from a closure row to a public page: it copies place words, days, two instants and the place's id (for
 *  the cover rule, server side), and NOTHING else. `diamondParks`: the places whose facilities are all diamonds. */
export function stripClosureOf(row: {
  scope: ClosureScope; org_venue_id: string | null; place_name: string | null; facility_name: string | null; first_day: string;
  last_day: string; shows_from: string; ends_at: string;
}, diamondParks: ReadonlySet<string> = new Set()): StripClosure {
  return toStripClosure({
    scope: row.scope, venueId: row.org_venue_id, placeName: row.place_name, facilityName: row.facility_name,
    firstDay: row.first_day, lastDay: row.last_day, showsFrom: row.shows_from, endsAt: row.ends_at,
  }, diamondParks);
}

/** The strip's shape of any closure (a row read, a Venue library row, a place the window is about to close): the one
 *  place its scope decides which words it keeps (every place: no place; a diamond only for a diamond closure). */
export function toStripClosure(c: Omit<StripClosure, 'allDiamonds'>, diamondParks: ReadonlySet<string>): StripClosure {
  const venueId = c.scope === 'all' ? null : c.venueId;
  return {
    scope: c.scope,
    venueId,
    placeName: c.scope === 'all' ? null : c.placeName,
    facilityName: c.scope === 'diamond' ? c.facilityName : null,
    allDiamonds: c.scope === 'place' && !!venueId && diamondParks.has(venueId),
    firstDay: c.firstDay,
    lastDay: c.lastDay,
    showsFrom: c.showsFrom,
    endsAt: c.endsAt,
  };
}

/** A whole park's row reads "all diamonds" only when it has facilities and every one is a diamond (the site and the
 *  window's preview ask the same). */
export const isAllDiamonds = (kinds: readonly (string | null | undefined)[]) => kinds.length > 0 && kinds.every(k => k === 'diamond');

// ── The cover rule (S1, owner 2026-11-26; Session B's Venue library and Reopen read the same) ──────────────────────

/** What the cover rule reads of a closure. */
export interface CoverClosure { scope: ClosureScope; venueId: string | null; firstDay: string; lastDay: string }

/**
 * S1: closure `w` COVERS closure `n` — the wider one speaks for it on the site, for as long as it covers the same days.
 * Wider: every place over any park or diamond; a whole park over a diamond of the SAME place id (never matched by name).
 * Its days hold all of `n`'s remaining days: first day no later (a past first day counts as today), last day no earlier.
 * Both are showing (the caller passes showing closures only). A covered closure is left off the site only: its record,
 * marks and Reopen are untouched, and it comes back by itself when the wider one reopens.
 */
export function closureCovers(w: CoverClosure, n: CoverClosure, today: string): boolean {
  if (w === n) return false;
  const wider = (w.scope === 'all' && n.scope !== 'all')
    || (w.scope === 'place' && n.scope === 'diamond' && !!w.venueId && w.venueId === n.venueId);
  return wider && holdsDays(w, n, today);
}

/** `w`'s days hold all of `n`'s remaining ones: first day no later (a past first day counts as today), last no earlier. */
function holdsDays(w: CoverClosure, n: CoverClosure, today: string): boolean {
  const from = (d: string) => (d < today ? today : d);
  return from(w.firstDay) <= from(n.firstDay) && w.lastDay >= n.lastDay;
}

/**
 * `w` already says all `n` would on the site: it covers it (S1), or it is the SAME place (the same diamond, by its name at
 * the same place id) for those days or more — a place pressed again. The window's "Your site won't change." asks this.
 */
export function closureSaysAlready(w: CoverClosure & { facilityName: string | null }, n: CoverClosure & { facilityName: string | null }, today: string): boolean {
  if (closureCovers(w, n, today)) return true;
  const same = w.scope === n.scope && (w.scope === 'all'
    || (!!w.venueId && w.venueId === n.venueId && (w.scope === 'place' || w.facilityName === n.facilityName)));
  return w !== n && same && holdsDays(w, n, today);
}

/** The closures no other one in the list covers: what the site says. */
export function uncoveredClosures<T extends CoverClosure>(list: readonly T[], today: string): T[] {
  return list.filter(n => !list.some(w => closureCovers(w, n, today)));
}

/** The closures in `list` that cover `n`, widest first (every place before a park). */
export function coveringClosures<T extends CoverClosure>(n: CoverClosure, list: readonly T[], today: string): T[] {
  return list.filter(w => closureCovers(w, n, today)).sort((a, b) => (a.scope === 'all' ? 0 : 1) - (b.scope === 'all' ? 0 : 1));
}

/** Showing now: from the press (K3) to the end of Until, and not reopened. No job ends one: this is the whole rule. */
export function isClosureShowing(c: { showsFrom: string; endsAt: string; reopenedAt: string | null }, nowMs: number): boolean {
  return !c.reopenedAt && Date.parse(c.showsFrom) <= nowMs && nowMs < Date.parse(c.endsAt);
}

// ── The place's words, and the strip's sentence (Session 2B; the strip's box is `closureStrip`, lib/club-notice.ts)────────────────────────────

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
export function stripSentence(c: StripPlaceDays, today: string, say: (day: string) => string): string {
  const name = closedPlaceName(c);
  const subject = name ? `${name} is` : 'All our fields are';
  return `${subject} ${stripWhen(c, today, say)}.`;
}

/**
 * The sentence's WHEN, alone: "closed today" · "closed tomorrow (Fri, Nov 27)" · "closed through Sun, Nov 29" · "closed on
 * Sat, Nov 28" · "closed from … through …". The strip groups its closures by it (S2: one heading for the day).
 */
export function stripWhen(c: Pick<StripPlaceDays, 'firstDay' | 'lastDay'>, today: string, say: (day: string) => string): string {
  const oneDay = c.firstDay === c.lastDay;
  if (c.firstDay <= today) return oneDay || c.lastDay <= today ? 'closed today' : `closed through ${say(c.lastDay)}`;
  if (c.firstDay === nextDay(today)) return oneDay ? `closed tomorrow (${say(c.firstDay)})` : `closed from tomorrow (${say(c.firstDay)}) through ${say(c.lastDay)}`;
  return oneDay ? `closed on ${say(c.firstDay)}` : `closed from ${say(c.firstDay)} through ${say(c.lastDay)}`;
}
