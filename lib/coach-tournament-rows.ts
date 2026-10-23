import { deriveCoachLifecycleChip, isFinishedLifecycle, sortByCoachLifecycle } from './coach-tournament-lifecycle';
import { formatEventDateRange } from './timezone';
import { registrationStatusLabel } from './coaches-status';
import { ordinal } from './playoff-bracket';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ONE ROW FOR EVERY COACH TOURNAMENTS LIST (Club Tier Stage 7d, Ask 8 + Ask 12; drawing 6).
 *
 * Three lists show a coach's tournament entries — the paid portal's team list, the free team's
 * list and the free account hub — and until 7d each drew a stacked card. They are now the portal's
 * row list (`CoachRowList`), banded Coming up / Finished, and THIS is where a row's words are
 * decided, once: which band, the date that leads it, the host in its caption, the finish a
 * finished row ends with, and the one chip it carries — only where the chip says something.
 * The three lists render `tournamentRowFace` and nothing else, so neither the two portals nor the
 * phone and computer faces can drift (`coach-tournament-rows.test.ts`).
 *
 * The phone and computer faces come from the recipe, not from here: the date is the row's `lead`,
 * which leads as a plain column on a computer and rides the caption line on a phone ("Nov 6–8 ·
 * Guelph Minor Ball").
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The meta for a tournament the coach's own club runs, with the team entered as its own (7a). */
export const OWN_CLUB_TOURNAMENT_HOST = "Your club's tournament";
/** The chip for an entry the organizer has not decided on yet (a placement, /marketing's words). */
export const WAITING_ON_ORGANIZER = 'Waiting on them';

export type TournamentFinish = { rank: number; of: number };

export type TournamentRowEntry = {
  registration: { id: string; name: string; status: string };
  tournament: { name: string; startDate: string | null; endDate: string | null; status: string } | null;
  org: { name: string } | null;
  /** The club's own team in its own club's tournament (lib/club-own-tournament-team.ts). */
  ourTeam?: boolean;
  /** Where the team finished — present only when the organizer publishes round-robin standings. */
  finish?: TournamentFinish | null;
};

export type TournamentChipTone = 'ok' | 'waiting' | 'live' | 'mute';

type TournamentRowFace = {
  band: 'coming' | 'finished';
  title: string;
  /** "Nov 6–8" — null for an event with no dates yet. */
  lead: string | null;
  /** The host, then the finish: "Guelph Minor Ball" · "Your club's tournament · 2nd of 4". */
  caption: string | null;
  chip: { label: string; tone: TournamentChipTone } | null;
};

/** "2nd of 4". */
export function finishLabel(finish: TournamentFinish): string {
  return `${ordinal(finish.rank)} of ${finish.of}`;
}

/**
 * Where a team finished, read off its division's standings rows (already in rank order): within its
 * POOL when the division is pooled — "7th of 12" across the division is the wrong answer for a Pool
 * A team — and null when the team played no standings game, is not in the table, or sits in a tie still
 * waiting on a coin toss (its place in the table is arbitrary until the toss is recorded, so no
 * definite "2nd of 4" is said yet).
 */
export function finishFromStandings(
  rows: Array<{ teamId: string; poolId?: string | null; gp: number; needsCoinToss?: boolean }>,
  teamId: string,
): TournamentFinish | null {
  const mine = rows.find(r => r.teamId === teamId);
  if (!mine || mine.gp <= 0 || mine.needsCoinToss) return null;
  const group = mine.poolId ? rows.filter(r => r.poolId === mine.poolId) : rows;
  return { rank: group.findIndex(r => r.teamId === teamId) + 1, of: group.length };
}

/**
 * The entry's REGISTRATION chip — the list row's and the record's (the one status chip under the
 * page title, T4), so "Waiting on them" is spelled in one place.
 */
export function registrationChip(status: string): { label: string; tone: TournamentChipTone } {
  if (status === 'accepted') return { label: registrationStatusLabel(status), tone: 'ok' };
  if (status === 'pending') return { label: WAITING_ON_ORGANIZER, tone: 'waiting' };
  if (status === 'waitlist') return { label: registrationStatusLabel(status), tone: 'waiting' };
  return { label: registrationStatusLabel(status), tone: 'mute' };
}

function isFinished(entry: TournamentRowEntry, today: string): boolean {
  const t = entry.tournament;
  if (!t) return false;
  return isFinishedLifecycle(deriveCoachLifecycleChip(t.startDate, t.endDate, today, t.status).state);
}

export function tournamentRowFace(entry: TournamentRowEntry, today: string): TournamentRowFace {
  const t = entry.tournament;
  const band = isFinished(entry, today) ? 'finished' : 'coming';
  const status = entry.registration.status;

  const host = entry.ourTeam ? OWN_CLUB_TOURNAMENT_HOST : entry.org?.name ?? null;
  const finish = band === 'finished' && status === 'accepted' && entry.finish ? finishLabel(entry.finish) : null;
  const caption = [host, finish].filter(Boolean).join(' · ') || null;

  let chip: TournamentRowFace['chip'] = null;
  if (status !== 'accepted') {
    // An undecided entry on a finished event is no longer waiting on anyone — it reads quiet.
    chip = band === 'finished' ? { label: registrationStatusLabel(status), tone: 'mute' } : registrationChip(status);
  } else if (band === 'coming' && t) {
    // A finished accepted row carries no chip: its caption's finish says how it went.
    const life = deriveCoachLifecycleChip(t.startDate, t.endDate, today, t.status).state;
    chip = life === 'live' ? { label: 'Live', tone: 'live' }
      : life === 'game_day' ? { label: 'Game day', tone: 'live' }
      : { label: registrationStatusLabel(status), tone: 'ok' };
  }

  return {
    band,
    title: t?.name ?? entry.registration.name,
    lead: formatEventDateRange(t?.startDate, t?.endDate, false),
    caption,
    chip,
  };
}

/** The two bands, each in the lifecycle order (live first; finished most recent first). */
export function bandTournamentRows<T extends TournamentRowEntry>(entries: T[], today: string): { coming: T[]; finished: T[] } {
  const sorted = sortByCoachLifecycle(
    entries,
    e => e.tournament?.startDate ?? null,
    e => e.tournament?.endDate ?? null,
    today,
    e => e.tournament?.status ?? null,
  );
  return {
    coming: sorted.filter(e => !isFinished(e, today)),
    finished: sorted.filter(e => isFinished(e, today)),
  };
}
