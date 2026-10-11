/**
 * lib/export/team-feed-words.ts
 * THE WORDS EVERY TEAM CALENDAR WRITES — the feed recipe F1–F10 (Club Tier Stage 6d, ruled 2026-10-11; the table
 * standard's §11.4). React-free and server-free: the coach's feed, the public team feed and the connected family's
 * feed compose through it on the server, and the coach's calendar DOWNLOAD composes through it in the browser — so a
 * file and a subscription can never say one event two ways.
 *
 * ⚠ ONE HOME, ON PURPOSE. Before 6d the family feed and the coach's download each wrote their own entries and
 * disagreed on every line: "13U AAA — Practice" against "Practice", always "vs" against "@", a cancelled game dropped
 * against marked, "Arrive by 17:30" against "Arrive by 5:30 p.m.", two hours for everything against a practice's
 * hour and a half. A new reader of a team's schedule passes a READER here, never a mapper of its own.
 *
 *   F1  the team leads the title: "13U AAA · Practice", "13U AAA vs Oakridge Hawks", "13U AAA @ Ridgeview Owls"
 *       (`sideWord`: away → "@"; home, neutral, unknown → "vs"), "13U AAA · {the event's name}", "13U AAA · Tryouts";
 *   F2  a cancelled entry is KEPT: "Cancelled · " leads its title, it is marked cancelled and shown as free time;
 *   F3  postponed — a team's schedule has no such state (scheduled or cancelled); an organizer's game is never
 *       written at a time it won't be played (the deferred club feed carries the rule for league games);
 *   F4  the instant; no end → a game two hours, a practice an hour and a half; an outside tournament ALL DAY;
 *   F5  "Kinsmen Park · Diamond 2, 15 Main St";
 *   F6  "Arrive by 5:30 p.m. (Eastern time)", either stored clock form; a coach's adds uniform and notes;
 *   F7  a link back, built by the caller (it knows its own origin and door);
 *   F8–F10 the calendar's name, the refresh hint and the stopped link are the composer's and the routes'.
 */

import type { ICSInstantEventInput } from './ics';
import { surfaceLabel } from '../sports';
import { sideWord, COACH_GAME_EVENT_TYPES } from '../coach-tournament-games';
import { tournamentSpan } from '../coach-schedule-view';
import { formatStoredClock, isStoredClock } from '../utils';
import { isAutoShapedName } from '../coach-schedule-vocab';
import { ORG_TIME_ZONE, zoneTimeWords } from '../timezone';

/**
 * Who the entries are for. A COACH's carry what the coach's screen shows — uniform, the event's notes, the tryout days
 * they run, the organizer's games; a FAMILY's carry what the family list carries (its allow-list leaves the rest out).
 */
export type FeedReader = 'coach' | 'family';

/** A team event as either reader holds it. `uniform` and `description` exist only on the coach's side. */
export interface FeedTeamEvent {
  id: string;
  name: string;
  eventType: string;
  opponent: string | null;
  homeAway: string | null;
  startsAt: string | null;
  endsAt: string | null;
  arrivalTime: string | null;
  location: string | null;
  locationAddress: string | null;
  fieldNumber: string | null;
  status: string;
  uniform?: string | null;
  description?: string | null;
  /** Set on a game the organizer's tournament copied onto the team's list — what de-duplicates the overlay. */
  sourceTournamentGameId?: string | null;
}

/** A tryout day, as the coach's Schedule overlays it (only for a coach who runs tryouts). */
export interface FeedTryoutDay {
  id: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  locationAddress: string | null;
  fieldNumber: string | null;
  label: string | null;
  status: string;
}

/** One of the organizer's tournament games, as the coach's Schedule overlays it. */
export interface FeedOrganizerGame {
  id: string;
  /** The game's instant (its date + clock in the club's zone), or null when it has no date. */
  startsAt: string | null;
  gameDate: string | null;
  /** Null when the organizer has set a date and no clock yet. */
  timeLabel: string | null;
  opponentName: string;
  homeAway: 'home' | 'away';
  location: string | null;
  status: string;
  tournamentName: string;
}

export type FeedEntryKind = 'event' | 'tryout' | 'organizer_game';

export interface TeamFeedInput {
  teamName: string;
  /** The team's sport — names the facility ("Diamond 2"). Null reads the default noun. */
  sport: string | null;
  reader: FeedReader;
  events: readonly FeedTeamEvent[];
  /** A coach's only, and only when they run tryouts — the caller decides; a family is never passed any. */
  tryoutDays?: readonly FeedTryoutDay[];
  /** A coach's only. Every game the overlay read returned — the ones already on the list are dropped here. */
  organizerGames?: readonly FeedOrganizerGame[];
  /** F7 — the link back for one entry, or null for none. */
  linkFor?: (kind: FeedEntryKind, id: string) => string | null;
  timeZone?: string;
}

/** F2's leading word. A /marketing word (6d, B5): the title must say it because Google draws no strike. */
export const CANCELLED_LEAD = 'Cancelled · ';

/** F4 — the length of an entry with no end entered: one default per kind (the download wrote two hours for all). */
const GAME_HOURS = 2;
const PRACTICE_HOURS = 1.5;

/** F8 — "13U AAA · UAT Rep Club": the team and the club, so two teams' feeds never read alike in a list of calendars. */
export function teamCalendarName(teamName: string, clubName: string | null | undefined): string {
  return clubName ? `${teamName} · ${clubName}` : teamName;
}


/**
 * F6 — "Arrive by 5:30 p.m. (Eastern time)". The stored arrival is either "17:30" or the older "5:45 PM"; both are
 * spelled in the house clock. The zone is said because the reader's calendar may sit elsewhere while the arrival is
 * the club's clock — and it is said only after a clock: a free-text arrival is the coach's own words, kept as typed.
 */
export function arrivalNote(arrivalTime: string | null | undefined, timeZone: string = ORG_TIME_ZONE): string | null {
  const raw = (arrivalTime ?? '').trim();
  if (!raw) return null;
  const clock = formatStoredClock(raw);
  return isStoredClock(raw) ? `Arrive by ${clock} (${zoneTimeWords(timeZone)})` : `Arrive by ${clock}`;
}

/** F5 — "Kinsmen Park · Diamond 2, 15 Main St": the place, its facility in the sport's word, the street address. */
function feedPlace(location: string | null, fieldNumber: string | null, address: string | null, sport: string | null): string | undefined {
  const place = [location, surfaceLabel(sport, fieldNumber)].filter(Boolean).join(' · ');
  return [place, address].filter(Boolean).join(', ') || undefined;
}

const isGameKind = (eventType: string) => COACH_GAME_EVENT_TYPES.includes(eventType);

/** "@ Ridgeview" / "vs Ridgeview" — the matchup half of a game's title. */
function matchup(homeAway: string | null, opponent: string): string {
  return `${sideWord(homeAway)} ${opponent}`;
}

/** F1 + F2 — an event's title. */
function eventTitle(teamName: string, e: FeedTeamEvent): string {
  const opponent = e.opponent?.trim();
  const body = e.eventType === 'practice'
    ? `${teamName} · Practice`
    : isGameKind(e.eventType) && opponent
      ? `${teamName} ${matchup(e.homeAway, opponent)}`
      : `${teamName} · ${e.name}`;
  return e.status === 'cancelled' ? `${CANCELLED_LEAD}${body}` : body;
}

/**
 * A game's OWN name, when the title above leaves it out: "Semi-final" on a game against the Lions titles
 * "13U AAA vs Lions", so a coach's entry keeps the name as the first line of its notes (their screen reads
 * "Semi-final · vs Lions"). A name the product wrote (`isAutoShapedName` — "@ Lions", "Tournament Game vs Lions")
 * says nothing the title doesn't. A family's entry follows the family list, which titles the matchup alone.
 */
function ownGameName(e: FeedTeamEvent): string | null {
  const opponent = e.opponent?.trim();
  if (!isGameKind(e.eventType) || !opponent) return null;
  if (isAutoShapedName(e.name, e.eventType as never, opponent, e.homeAway)) return null;
  // A bare matchup in either side's word ("vs Northgate" on an away game, written before the side mattered — mig 306)
  // says nothing the title doesn't, and would contradict its "@" (found walking dev's feed, 2026-10-11).
  const bare = e.name.trim().replace(/^(vs\.?|v\.?|@|at)\s+/i, '');
  return bare.toLowerCase() === opponent.toLowerCase() ? null : e.name.trim();
}

function eventNotes(e: FeedTeamEvent, reader: FeedReader, timeZone: string): string | undefined {
  const arrival = arrivalNote(e.arrivalTime, timeZone);
  if (reader === 'family') return arrival ?? undefined;
  return [
    ownGameName(e),
    arrival,
    e.uniform?.trim() ? `Uniform: ${e.uniform.trim()}` : null,
    e.description?.trim() || null,
  ].filter(Boolean).join('\n') || undefined;
}

/** The organizer's games the team's list doesn't already hold — de-duplicated by the copy's source id, exactly as
 *  the coach's Schedule draws its overlay (one rule, read by the screen, the download and the feed). */
export function unmirroredOrganizerGames<G extends { id: string }>(
  events: readonly Pick<FeedTeamEvent, 'sourceTournamentGameId'>[],
  games: readonly G[],
): G[] {
  const mirrored = new Set(events.map(e => e.sourceTournamentGameId).filter(Boolean) as string[]);
  return games.filter(g => !mirrored.has(g.id));
}

/**
 * Every calendar entry a team's schedule writes for one reader, in the recipe's words. An event with no start is left
 * out rather than written at a guessed time; so is an organizer's game with no date, or one marked postponed.
 */
export function teamFeedEntries(input: TeamFeedInput): ICSInstantEventInput[] {
  const { teamName, sport, reader, linkFor } = input;
  const timeZone = input.timeZone ?? ORG_TIME_ZONE;
  const link = (kind: FeedEntryKind, id: string) => linkFor?.(kind, id) ?? undefined;
  const out: ICSInstantEventInput[] = [];

  for (const e of input.events) {
    if (!e.startsAt) continue;
    const span = tournamentSpan({ eventType: e.eventType as never, startsAt: e.startsAt, endsAt: e.endsAt });
    out.push({
      uid: e.id,
      title: eventTitle(teamName, e),
      startsAtIso: e.startsAt,
      endsAtIso: e.endsAt ?? null,
      durationHours: e.eventType === 'practice' ? PRACTICE_HOURS : GAME_HOURS,
      ...(span ? { allDay: { start: span.start, end: span.end } } : {}),
      location: feedPlace(e.location, e.fieldNumber, e.locationAddress, sport),
      description: eventNotes(e, reader, timeZone),
      url: link('event', e.id),
      cancelled: e.status === 'cancelled',
    });
  }

  if (reader === 'coach') {
    for (const t of input.tryoutDays ?? []) {
      if (!t.startsAt) continue;
      const cancelled = t.status === 'cancelled';
      out.push({
        uid: `tryout-${t.id}`,
        title: `${cancelled ? CANCELLED_LEAD : ''}${teamName} · Tryouts`,
        startsAtIso: t.startsAt,
        endsAtIso: t.endsAt,
        durationHours: GAME_HOURS,
        location: feedPlace(t.location, t.fieldNumber, t.locationAddress, sport),
        description: t.label?.trim() || undefined,
        url: link('tryout', t.id),
        cancelled,
      });
    }

    for (const g of unmirroredOrganizerGames(input.events, input.organizerGames ?? [])) {
      if (!g.startsAt || !g.gameDate || g.status === 'postponed') continue;
      const cancelled = g.status === 'cancelled';
      const timed = !!g.timeLabel && !Number.isNaN(Date.parse(g.startsAt));
      out.push({
        uid: `game-${g.id}`,
        title: `${cancelled ? CANCELLED_LEAD : ''}${teamName} ${matchup(g.homeAway, g.opponentName)}`,
        // A date with no clock yet (or a clock that doesn't read) is the day, never midnight — and orders by that day.
        startsAtIso: timed ? g.startsAt : `${g.gameDate}T12:00:00.000Z`,
        durationHours: GAME_HOURS,
        ...(timed ? {} : { allDay: { start: g.gameDate, end: g.gameDate } }),
        location: g.location ?? undefined,
        description: g.tournamentName || undefined,
        url: link('organizer_game', g.id),
        cancelled,
      });
    }
  }

  // Instants compared as instants (a stored "+00:00" and a built "Z" sort apart as strings); an entry's order in the
  // file is cosmetic, but one order every read keeps the file byte-stable for a calendar that diffs it.
  return out.sort((a, b) => Date.parse(a.startsAtIso) - Date.parse(b.startsAtIso) || a.uid.localeCompare(b.uid));
}
