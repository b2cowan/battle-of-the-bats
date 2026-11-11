/**
 * lib/coach-strip-facts.ts — what the strip's right end says about the team (navigation Phase 4, E7, C2, C5, C9; drawings
 * tab 17 "the strip's right end in every state the team bar had"). The team bar's words, moved, decided here so the rules
 * are tested rather than read off a component:
 *
 *   · the club's name first, for a club's team (C9) — a standalone Premium team names no club;
 *   · the season (`mastheadSeasonLabel`: ONE spelling of a season — "2026 season", or the club's typed name), and its
 *     state when it is not the everyday one ("Draft", C5);
 *   · the record, dropping a zero tie ("5-0") and never a 0-0 record (a season that hasn't started has none);
 *   · then ONE status: "Next" + day, time and the event's word; or the Game day chip with who and when and the way to
 *     the bench (E7: the chip replaces the record on game day); or, between seasons, "Complete" and the final record.
 *     Game day with no opponent and no event named shows the chip alone, never "Game day · Game day".
 *
 * The status speaks only for the season it was computed for (`statusYearId`) — a team mid-rollover holds two live
 * seasons, and the strip would rather say nothing than mix them (the team bar's rule).
 */
import { mastheadSeasonLabel } from './coach-season-label';
import { formatRecord, type WltTally } from './coach-season-record';
import { mastheadWhen, type MastheadGameDayConsole, type MastheadStatus } from './coach-masthead-status';
import { eventWord } from './coach-schedule-vocab';
import type { RepEventType } from './types';

export type StripFacts = {
  club: string | null;
  season: string | null;
  /** "Draft" — a season state that is not the everyday one (C5). */
  state: string | null;
  record: string | null;
  status:
    | { kind: 'next'; when: string }
    | { kind: 'game_day'; who: string | null; time: string; benchHref: string | null }
    | { kind: 'complete'; finalRecord: string | null }
    | null;
};

/** A record worth saying: none for 0-0. */
export function stripRecord(tally: WltTally | null | undefined): string | null {
  if (!tally || tally.w + tally.l + tally.t === 0) return null;
  return formatRecord(tally);
}

type Season = { programYearId: string; programYearName: string; programYearYear: number | null; programYearStatus?: string };

export function coachStripFacts(input: {
  teamName: string;
  orgName: string;
  isTeamWorkspace: boolean;
  /** The season on screen (live, else the newest closed), from the shared resolvers. */
  season: Season | null;
  seasonFinished: boolean;
  records: Record<string, WltTally>;
  status: MastheadStatus;
  statusYearId: string | null;
  gameDayConsole: MastheadGameDayConsole | null;
}): StripFacts {
  const { season } = input;
  const tally = season ? input.records[season.programYearId] ?? null : null;
  const record = stripRecord(tally);
  const status = season && season.programYearId === input.statusYearId ? input.status : null;
  const base = {
    club: input.isTeamWorkspace ? null : input.orgName || null,
    season: mastheadSeasonLabel(season?.programYearName, input.teamName, season?.programYearYear ?? null),
    state: !input.seasonFinished && season?.programYearStatus === 'draft' ? 'Draft' : null,
  };
  // Between seasons the strip's NAME is the season (C8), so the facts do not say it twice (tab 17: "Complete · Final …").
  if (input.seasonFinished) return { ...base, season: null, record: null, status: { kind: 'complete', finalRecord: record } };
  if (status?.kind === 'game_day') {
    const who = status.event.opponent?.trim() || status.event.name?.trim() || null;
    const benchHref = input.gameDayConsole?.eventId === status.event.id ? input.gameDayConsole.href : null;
    // E7: on game day the chip replaces the record.
    return { ...base, record: null, status: { kind: 'game_day', who, time: mastheadWhen(status.event.startsAt, status.daysAway).time, benchHref } };
  }
  if (status) {
    const { day, time } = mastheadWhen(status.event.startsAt, status.daysAway);
    const word = eventWord({ eventType: status.event.eventType as RepEventType, isScrimmage: status.event.isScrimmage });
    return { ...base, record, status: { kind: 'next', when: `${day} ${time} ${word}` } };
  }
  return { ...base, record, status: null };
}
