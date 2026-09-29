/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * HOW THE CLUB'S REP-TEAMS SCREENS SAY WHAT THE BOARD READ (Club Tier Stage 2, specimens 1–2).
 *
 * The board's figures are read ONCE, by one rule each, in `lib/club-team-board.ts` (server). This
 * module only turns them into the words the drawings show, so the health board, its phone cards and
 * the team page cannot say the same fact two ways:
 *   · a season is "2026 · Live" or "2026 · Closed" (Ask 1's two words; Draft reads as live), its
 *     caption the record ("12-8-1", "No games yet", "Final 21-6-3");
 *   · the next event is a day ("Sat Oct 3") and one line ("Harvest Classic", "vs Barrie · 10:00 a.m.",
 *     "Practice · 6:00 p.m.") in the org's zone and the house clock;
 *   · the lede is a count, never a verdict ("9 teams in 2 groups · 9 of 15 on your plan").
 *
 * ⚠ PURE AND CLIENT-SAFE: no reads, no server imports (types only).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import type { ClubBoardNextEvent, ClubBoardRow, ClubBoardSeason } from './club-team-board';
import { formatInOrgZone } from './timezone';
import { formatTime, pluralize } from './utils';

export type BoardSeasonTone = 'good' | 'neutral';

/** The Season cell: its chip and the record caption under it. Null = a team with no season yet. */
export function boardSeasonCell(season: ClubBoardSeason | null): { chip: string; tone: BoardSeasonTone; caption: string } | null {
  if (!season) return null;
  if (season.isLive) {
    return { chip: `${season.year} · Live`, tone: 'good', caption: season.recordText ?? 'No games yet' };
  }
  return { chip: `${season.year} · Closed`, tone: 'neutral', caption: season.recordText ? `Final ${season.recordText}` : 'No games played' };
}

/** "Sat Oct 3" — a day in the org's zone, weekday first. */
export function orgWeekdayDay(iso: string): string {
  return `${formatInOrgZone(iso, { weekday: 'short' })} ${formatInOrgZone(iso, { month: 'short' })} ${formatInOrgZone(iso, { day: 'numeric' })}`;
}

/** "10:00 a.m." — an instant's clock in the org's zone, through the house clock (`formatTime`). */
export function orgClock(iso: string): string {
  const hm = formatInOrgZone(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return hm ? formatTime(hm) : '';
}

const GAME_TYPES = new Set(['league_game', 'tournament_game']);

/** The Next event cell: the day, and one line saying what it is. */
export function nextEventLines(ev: ClubBoardNextEvent): { day: string; line: string } {
  const day = orgWeekdayDay(ev.startsAt);
  const clock = orgClock(ev.startsAt);
  let what: string;
  if (ev.eventType === 'external_tournament') {
    // A tournament is read by its name; a weekend has no single start the club needs here.
    return { day, line: ev.name || 'Tournament' };
  } else if (GAME_TYPES.has(ev.eventType) && ev.opponent) {
    what = `${ev.homeAway === 'away' ? 'at' : 'vs'} ${ev.opponent}`;
  } else if (ev.eventType === 'practice') {
    what = 'Practice';
  } else if (GAME_TYPES.has(ev.eventType)) {
    what = ev.isScrimmage ? 'Scrimmage' : 'Game';
  } else {
    what = ev.name || 'Team event';
  }
  return { day, line: clock ? `${what} · ${clock}` : what };
}

/** The Documents cell's figure ("14 of 14"), or null for the table standard's em dash. */
export function documentsText(row: Pick<ClubBoardRow, 'documents'>): string | null {
  return row.documents ? `${row.documents.signed} of ${row.documents.of}` : null;
}

/** The head coach cell: who is in place, an unanswered invitation, or nobody (the one thing only the club can fix). */
export type HeadCoachCell =
  | { kind: 'people'; names: string[]; you: boolean }
  | { kind: 'invited'; email: string }
  | { kind: 'none' };

export function headCoachCell(row: Pick<ClubBoardRow, 'headCoach'>, viewerUserId: string | null): HeadCoachCell {
  const people = row.headCoach.people;
  if (people.length > 0) {
    return {
      kind: 'people',
      names: people.map(p => p.name || p.email || 'A coach'),
      you: !!viewerUserId && people.some(p => p.userId === viewerUserId),
    };
  }
  const invite = row.headCoach.invited.find(i => !i.expired);
  if (invite) return { kind: 'invited', email: invite.email };
  return { kind: 'none' };
}

/** A live season with nobody on it — the one roster the board draws as a red chip (J4-008). */
export function isEmptyLiveRoster(row: Pick<ClubBoardRow, 'season' | 'rosterCount'>): boolean {
  return !!row.season?.isLive && row.rosterCount === 0;
}

export interface BoardGroup { id: string | null; name: string }
export interface BoardBand<T> { key: string; label: string; rows: T[] }

/**
 * The board's band rows: one per group in the club's own order, then Ungrouped, each saying how many
 * teams it holds ("Boys · 6 teams"). A club with no groups gets ONE unlabelled band — no band row is
 * drawn for it (a band that says nothing is noise).
 */
export function boardBands<T extends { groupId: string | null }>(
  rows: readonly T[],
  groups: readonly BoardGroup[],
): BoardBand<T>[] {
  if (groups.length === 0) return [{ key: 'all', label: '', rows: [...rows] }];
  const bands: BoardBand<T>[] = [];
  for (const g of groups) {
    const inGroup = rows.filter(r => r.groupId === g.id);
    if (inGroup.length > 0) bands.push({ key: g.id ?? 'none', label: `${g.name} · ${pluralize(inGroup.length, 'team')}`, rows: inGroup });
  }
  const known = new Set(groups.map(g => g.id));
  const ungrouped = rows.filter(r => !r.groupId || !known.has(r.groupId));
  if (ungrouped.length > 0) bands.push({ key: 'none', label: `Ungrouped · ${pluralize(ungrouped.length, 'team')}`, rows: ungrouped });
  return bands;
}

/**
 * The toolbar's lede: a count, never a verdict — "9 teams in 2 groups · 9 of 15 on your plan".
 * `limit` null (or the uncapped 9999) drops the plan half; a club with no groups drops the group half.
 */
export function boardLede(p: { teams: number; groups: number; used: number; limit: number | null }): string {
  const teams = p.groups > 0 ? `${pluralize(p.teams, 'team')} in ${pluralize(p.groups, 'group')}` : pluralize(p.teams, 'team');
  const cap = p.limit != null && p.limit < 9999 ? ` · ${p.used} of ${p.limit} on your plan` : '';
  return `${teams}${cap}`;
}

/** The phone card's one quiet line: who · how many · what's next (specimen 1, phone). */
export function boardPhoneLine(p: { coach: string | null; roster: number | null; nextDay: string | null }): string {
  return [
    p.coach,
    p.roster != null && p.roster > 0 ? pluralize(p.roster, 'player') : null,
    p.nextDay,
  ].filter(Boolean).join(' · ');
}

/** The sample colour code a team's colour field shows people (a value to read, not a style). */
export const TEAM_COLOUR_EXAMPLE = '#2F7D4A';
