/**
 * venue-clash.ts — THE one rule for "is one of the club's venues already booked then, by someone else?"
 * (Club Tier Stage 6a, Ask 3, ratified 2026-10-08 — hub K4MPu4ni53Ct7yrDcmWJd9 v64, Mockups → Stage 6 →
 * "What counts as a clash"). Pure and client-safe: the server lookup (`lib/venue-clash-lookup.ts`) and
 * every writer call it, and its unit test IS the hub's table, case by case.
 *
 * Why a module of its own, beside `lib/venue-identity.ts` and not inside it
 * --------------------------------------------------------------------------
 * venue-identity answers "same surface?" for ONE program's engine — house league's and the tournament's,
 * each comparing its own bookings, each with its own refusal. This rule answers the question no engine could:
 * ACROSS programs (rep × rep, rep × league, rep × tournament, league × tournament, two of the club's
 * tournaments), where the three venue books shared no key until mig 319. It never refuses (Ask 4: a form
 * refusing one volunteer's booking because another program saved first hands one person a veto over
 * another's schedule); it returns FINDINGS, and every caller only tells.
 *
 * The rule, exactly as the hub's table
 * ------------------------------------
 *   same club venue + same facility + overlap ......... `booked_by`  ("Diamond 2 is booked by …")
 *   same club venue, facility unset on either side ..... `busy_then`  (softer: "Lions Park is busy then …")
 *   a place the club doesn't own (a coach's own place,
 *     typed words, a tournament's own venue) ........... never compared (no `venueId`)
 *   cancelled ......................................... never
 *   a postponed league game ............................ not at its old time (the constructors drop it)
 *   a rep event / tryout / league booking with no end .. the one 90-minute length (`lib/booking-length.ts`)
 *   a tournament game ................................... its own length: game → division → tournament → 90
 *   a team's mirrored copy of its own tournament game ... never against that game (S6-06)
 *   one owner against itself ............................ no line (a team against itself; two league bookings
 *                                                         are house league's own rule; two games in one
 *                                                         tournament are the tournament's)
 *   an outside tournament (dates only) .................. never (the constructor returns null)
 *   overlap = one starts before the other ends ........... a 6:00 end and a 6:00 start do not clash
 *
 * ONE CLOCK: every window is an instant pair (epoch ms). League and rep rows are instants already; a tournament
 * game's local date + time are converted in the platform zone with `zonedWallClockToUtc` (the conversion the
 * live-score code uses), daylight saving included. A string is never compared with an instant.
 *
 * THE PERMIT HOOK: a finding carries a `kind`. Stage 10 adds `outside_permit` ("outside the club's permit for
 * this diamond") without changing a caller — every caller switches on `kind` through the words module.
 */
import { DEFAULT_BOOKING_MINUTES } from './booking-length.ts';
import { zonedWallClockToUtc } from './timezone.ts';

const MIN = 60_000;

/** Which program a booking belongs to. A tryout day is the rep team's (it is that team's diamond time). */
export type ClashProgram = 'rep' | 'league' | 'tournament';

/** What a booking IS, in the only words another program's reader may see (Ask 5: name, kind, time — nothing else). */
export type ClashBookingKind = 'practice' | 'game' | 'tryout' | 'team_event';

/** The finding kinds. Stage 10 adds `outside_permit`. */
export type ClashKind = 'booked_by' | 'busy_then';

/**
 * One booking on one of the club's venues, in the rule's terms. Built by the constructors below from a row of
 * any of the five tables (rep events, tryout sessions, league games, league practices, tournament games), so
 * the comparison never knows which table a row came from.
 */
export interface ClubBooking {
  /** Stable across the five tables: `${source}:${id}` (ids from different tables could collide). */
  key: string;
  program: ClashProgram;
  /**
   * Who answers for it. Two bookings with the same owner never produce a finding here: `team:<id>` (a team
   * against itself is a schedule mistake the coach sees on the schedule), `league` (two league bookings are
   * house league's own rule, which refuses on its own), `tournament:<id>` (two games in one tournament are
   * the tournament's own rule). Two DIFFERENT tournaments of the club do compare.
   */
  owner: string;
  /** How the line names the owner: "14U AA", "2026 Fall House League", "UAT Rep Club Invitational 2026". */
  ownerName: string;
  kind: ClashBookingKind;
  startMs: number;
  endMs: number;
  /** The club's venue (`org_venues.id`). Null = not one of the club's venues: never compared. */
  venueId: string | null;
  /** The facility at that venue (`org_venue_facilities.id`); null = not set ("busy then"). */
  facilityId: string | null;
  /** The club's names, for the words (the rule never reads them). */
  venueName: string | null;
  facilityName: string | null;
  /** On a team's mirrored copy of a tournament game: that game's key. Never compared with it (S6-06). */
  mirrorOf?: string | null;
}

/** Another booking, as the line may describe it — and nothing more (Ask 5). */
export interface ClashOther {
  program: ClashProgram;
  ownerName: string;
  kind: ClashBookingKind;
  startMs: number;
  endMs: number;
  venueName: string | null;
  facilityName: string | null;
}

export interface ClashFinding {
  kind: ClashKind;
  other: ClashOther;
}

// ---------------------------------------------------------------------------
// Constructors — one per table; each returns null for a row that is never a booking
// ---------------------------------------------------------------------------

function windowOf(startIso: string | null | undefined, endIso: string | null | undefined): { startMs: number; endMs: number } | null {
  if (!startIso) return null;
  const startMs = Date.parse(startIso);
  if (Number.isNaN(startMs)) return null;
  const endParsed = endIso ? Date.parse(endIso) : NaN;
  // A missing end, or one at/before the start, is the one booking length — never a zero-length booking.
  const endMs = !Number.isNaN(endParsed) && endParsed > startMs ? endParsed : startMs + DEFAULT_BOOKING_MINUTES * MIN;
  return { startMs, endMs };
}

function placed(venueId: string | null | undefined, facilityId: string | null | undefined) {
  return { venueId: venueId || null, facilityId: venueId ? (facilityId || null) : null };
}

const REP_KIND: Record<string, ClashBookingKind | null> = {
  practice: 'practice',
  league_game: 'game',
  tournament_game: 'game',
  team_event: 'team_event',
  // An outside tournament holds dates, no venue and no time of day: never compared.
  external_tournament: null,
};

/** A rep team's event (`rep_team_events`). */
export function repEventBooking(row: {
  id: string; team_id: string; event_type: string; starts_at: string | null; ends_at?: string | null;
  status?: string | null; org_venue_id?: string | null; org_venue_facility_id?: string | null;
  source_tournament_game_id?: string | null;
}, names: { team: string; venue?: string | null; facility?: string | null }): ClubBooking | null {
  const kind = REP_KIND[row.event_type === 'scrimmage' ? 'league_game' : row.event_type] ?? null;
  if (!kind || row.status === 'cancelled') return null;
  const w = windowOf(row.starts_at, row.ends_at);
  if (!w) return null;
  return {
    key: `rep_event:${row.id}`, program: 'rep', owner: `team:${row.team_id}`, ownerName: names.team, kind,
    ...w, ...placed(row.org_venue_id, row.org_venue_facility_id),
    venueName: names.venue ?? null, facilityName: names.facility ?? null,
    mirrorOf: row.source_tournament_game_id ? `tournament_game:${row.source_tournament_game_id}` : null,
  };
}

/** A rep team's tryout day (`rep_tryout_sessions`) — the owner's "Join the check" (2026-10-08). */
export function tryoutSessionBooking(row: {
  id: string; team_id: string; starts_at: string | null; ends_at?: string | null; status?: string | null;
  org_venue_id?: string | null; org_venue_facility_id?: string | null;
}, names: { team: string; venue?: string | null; facility?: string | null }): ClubBooking | null {
  if (row.status === 'cancelled') return null;
  const w = windowOf(row.starts_at, row.ends_at);
  if (!w) return null;
  return {
    key: `tryout_session:${row.id}`, program: 'rep', owner: `team:${row.team_id}`, ownerName: names.team, kind: 'tryout',
    ...w, ...placed(row.org_venue_id, row.org_venue_facility_id),
    venueName: names.venue ?? null, facilityName: names.facility ?? null,
  };
}

/**
 * A house-league game or practice (`league_games` / `league_practices`). A cancelled one vacates its slot, and a
 * POSTPONED game never clashes at its old time — it clashes once it has a new one (house league's own rule).
 */
export function leagueBooking(row: {
  id: string; kind: 'game' | 'practice'; scheduled_at: string | null; ends_at?: string | null; status?: string | null;
  org_venue_id?: string | null; org_venue_facility_id?: string | null;
}, names: { season: string; venue?: string | null; facility?: string | null }): ClubBooking | null {
  if (row.status === 'cancelled' || row.status === 'postponed') return null;
  const w = windowOf(row.scheduled_at, row.ends_at);
  if (!w) return null;
  return {
    key: `league_${row.kind}:${row.id}`, program: 'league', owner: 'league', ownerName: names.season, kind: row.kind,
    ...w, ...placed(row.org_venue_id, row.org_venue_facility_id),
    venueName: names.venue ?? null, facilityName: names.facility ?? null,
  };
}

/**
 * The tournament's own length chain — the game's, else its division's, else the tournament's, else the one
 * booking length. Read once, here, for the cross-program check (the tournament's own engine keeps its own,
 * with its buffer, which never crosses a program: across programs only real overlap counts).
 */
export function tournamentGameMinutes(game: { duration_minutes?: number | null }, divisionMinutes?: unknown, tournamentMinutes?: unknown): number {
  const pos = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined);
  return pos(game.duration_minutes) ?? pos(divisionMinutes) ?? pos(tournamentMinutes) ?? DEFAULT_BOOKING_MINUTES;
}

/**
 * A tournament game (`games`). Its date and time are a LOCAL wall clock; converted here in the platform zone.
 * `venueId` / `facilityId` are the LIBRARY ids its tournament copy carries (`diamonds.source_org_venue_id`,
 * `venue_facilities.source_org_facility_id`, S6-04) — a venue the tournament made itself has none and is never
 * compared.
 */
export function tournamentGameBooking(row: {
  id: string; tournament_id: string; game_date: string | null; game_time: string | null; status?: string | null;
  duration_minutes?: number | null;
}, link: { venueId: string | null; facilityId: string | null; minutes: number },
names: { tournament: string; venue?: string | null; facility?: string | null }): ClubBooking | null {
  if (row.status === 'cancelled') return null;
  const startIso = zonedWallClockToUtc(row.game_date, row.game_time ? row.game_time.slice(0, 5) : null);
  if (!startIso) return null;
  const startMs = Date.parse(startIso);
  return {
    key: `tournament_game:${row.id}`, program: 'tournament', owner: `tournament:${row.tournament_id}`,
    ownerName: names.tournament, kind: 'game',
    startMs, endMs: startMs + link.minutes * MIN, ...placed(link.venueId, link.facilityId),
    venueName: names.venue ?? null, facilityName: names.facility ?? null,
  };
}

// ---------------------------------------------------------------------------
// The rule
// ---------------------------------------------------------------------------

/** Overlap: one starts before the other ends. Touching ends (6:00 end, 6:00 start) do not clash. */
export function windowsOverlap(a: { startMs: number; endMs: number }, b: { startMs: number; endMs: number }): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

function describe(b: ClubBooking): ClashOther {
  return {
    program: b.program, ownerName: b.ownerName, kind: b.kind, startMs: b.startMs, endMs: b.endMs,
    venueName: b.venueName, facilityName: b.facilityName,
  };
}

/** Would these two bookings be compared at all? The rule's exclusions, in one place. */
function comparable(p: ClubBooking, o: ClubBooking): boolean {
  if (p.key === o.key) return false;
  if (p.owner === o.owner) return false;
  if (p.mirrorOf && p.mirrorOf === o.key) return false;
  if (o.mirrorOf && o.mirrorOf === p.key) return false;
  return !!p.venueId && p.venueId === o.venueId;
}

/**
 * Every finding for one proposed booking against the club's other bookings in its window. `booked_by` first,
 * then `busy_then`, each by start. Empty when the proposed booking is not on one of the club's venues — the
 * caller says the quiet "isn't checked" line itself, because only it knows whether the club has a library.
 */
export function findClubClashes(proposed: ClubBooking, others: readonly ClubBooking[]): ClashFinding[] {
  if (!proposed.venueId) return [];
  const out: ClashFinding[] = [];
  for (const o of others) {
    const kind = clashKindOf(proposed, o);
    if (kind) out.push({ kind, other: describe(o) });
  }
  return out.sort((a, b) => (a.kind === b.kind ? a.other.startMs - b.other.startMs : a.kind === 'booked_by' ? -1 : 1));
}

/** THE rule for one pair: `booked_by`, `busy_then`, or null (not compared, no overlap, or two different facilities). */
function clashKindOf(p: ClubBooking, o: ClubBooking): ClashKind | null {
  if (!comparable(p, o) || !windowsOverlap(p, o)) return null;
  if (p.facilityId && o.facilityId) {
    // Two different diamonds in one park are not a clash.
    return p.facilityId === o.facilityId ? 'booked_by' : null;
  }
  return 'busy_then';
}

/**
 * Every clashing PAIR among a set of bookings, each once (Club Tier Stage 6b — the club calendar, which marks both
 * sides of a clash and counts them). The same rule as `findClubClashes`, read over a whole week instead of one
 * proposed booking; the caller keeps the bookings' keys, which a finding deliberately does not carry (Ask 5).
 */
export function findClashPairs(bookings: readonly ClubBooking[]): { a: ClubBooking; b: ClubBooking; kind: ClashKind }[] {
  const byVenue = new Map<string, ClubBooking[]>();
  for (const b of bookings) {
    if (!b.venueId) continue;
    const list = byVenue.get(b.venueId);
    if (list) list.push(b); else byVenue.set(b.venueId, [b]);
  }
  const out: { a: ClubBooking; b: ClubBooking; kind: ClashKind }[] = [];
  for (const list of byVenue.values()) {
    const sorted = [...list].sort((x, y) => x.startMs - y.startMs);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length && sorted[j].startMs < sorted[i].endMs; j++) {
        const kind = clashKindOf(sorted[i], sorted[j]);
        if (kind) out.push({ a: sorted[i], b: sorted[j], kind });
      }
    }
  }
  return out;
}

/** Convenience for a writer that saved several bookings at once (a series, an import, a generator): findings per key. */
export function findClubClashesFor(proposed: readonly ClubBooking[], others: readonly ClubBooking[]): Map<string, ClashFinding[]> {
  const out = new Map<string, ClashFinding[]>();
  for (const p of proposed) {
    const f = findClubClashes(p, others);
    if (f.length) out.set(p.key, f);
  }
  return out;
}
