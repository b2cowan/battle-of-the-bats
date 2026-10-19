'use client';
/**
 * THE SCHEDULE'S DAY AND ALL GAMES — Tournament admin redesign Stage 3, S1 (ruled 2026-10-09).
 *
 * Every game of the day in one frame, by time: both divisions, both stages, every state. The row is Results' row
 * (Stage 1, G4) — the kit's one row recipe (`ClubRow`) with Results' own title (`GameTeams`, the two teams with their
 * scores) and where-line — never a second row. It adds what Results' bands say for it: the one state the score can't
 * say, as a chip (Playing now, Pending Review, Needs a score, Forfeit, Cancelled; a level final says Tie, as Results
 * does). No coloured rail (a list draws none, §3.10.7). The whole row opens the game.
 *
 * All games is the same rows in day bands ("Fri, Oct 9 · 4 games"), then the games with no day yet. The Bracket view's
 * phone bands are this row too (S6), reading each side the bracket's way (`sides`).
 *
 * At a desk the Day and All games read down columns instead (Sidebar Strip Stage 3, Ask 16: `GameTable`, the same
 * chip in its Status column); a phone, or a list too narrow for the columns, keeps this stacked row exactly.
 */
import type { ReactNode } from 'react';
import type { Division, Game, Team, Venue } from '@/lib/types';
import type { BracketSide } from '@/lib/bracket-reading';
import { ClubRow, ClubRowBand, ClubRowFrame, ClubRowList, RepChip, type ChipTone } from '@/components/admin/kit/club/RepKit';
import { GameTeams, gameWhereLine } from '../../results/ResultsList';
import GameTable, { useGameTableFits } from '../../results/GameTable';
import { GAME_STATE_WORD } from '@/lib/game-day-words';
import { gamesByDay, type ScheduleConflict, type ScheduleState } from '@/lib/schedule-day';
import { SCHEDULE_DAY_WORDS as W } from '@/lib/schedule-words';
import { formatShortWeekdayDate } from '@/lib/timezone';
import { formatTime } from '@/lib/utils';
import sd from './ScheduleDay.module.css';

/** A state the score can't say wears a chip; a played game's score says Final itself. */
const CHIP_TONE: Partial<Record<ScheduleState, ChipTone>> = {
  playingNow: 'good',
  pendingReview: 'warn',
  needsScore: 'neutral',
  forfeit: 'neutral',
  cancelled: 'neutral',
};

/** The numbers are a result: played, waiting for the organizer, or forfeited (a scheduled game's zeros are not). */
export const isScored = (state: ScheduleState) => state === 'final' || state === 'forfeit' || state === 'pendingReview';

export type ScheduleRowCtx = { teams: Team[]; divisions: Division[]; venues: Venue[] };
type Ctx = ScheduleRowCtx;

/** The state the score can't say, as its chip — the day's rows and the bracket's cards wear the same one. A game still
 *  to play wears no state chip, so its conflict takes the place (walk §294): amber "Tight turnover", red "Double-booked".
 *  `conflict` is already `toPlayConflict`'s — only a game still to play has one. */
export function stateChip(g: Game, state: ScheduleState, conflict: ScheduleConflict | null = null): ReactNode {
  if (conflict) return <RepChip tone={conflict === 'overlap' ? 'bad' : 'warn'}>{W.conflicts[conflict]}</RepChip>;
  const tie = state === 'final' && g.homeScore != null && g.homeScore === g.awayScore;
  const chip = tie ? GAME_STATE_WORD.tie : CHIP_TONE[state] !== undefined ? W.states[state] : null;
  return chip ? <RepChip tone={tie ? 'neutral' : CHIP_TONE[state]}>{chip}</RepChip> : null;
}

/**
 * One game's row. The Bracket view's bands pass `lead` (the day with the time: "Fri 2:00 p.m."), `sides` (the
 * bracket's reading of the two teams) and `tail` (a waiting game's "waits for the toss").
 */
export function ScheduleGameRow({ ctx, g, state, conflict = null, onOpen, lead, sides, tail }: {
  ctx: Ctx; g: Game; state: ScheduleState; onOpen: (g: Game) => void;
  /** The game's conflict, if it is still to play (`toPlayConflict`) — its chip (walk §294). */
  conflict?: ScheduleConflict | null;
  lead?: string; sides?: { away: BracketSide; home: BracketSide }; tail?: string;
}) {
  const scored = isScored(state);
  const chipEl = stateChip(g, state, conflict);
  const where = [gameWhereLine(ctx, g), tail].filter(Boolean).join(' · ');
  return (
    <ClubRow
      as="button"
      onClick={() => onOpen(g)}
      aria-haspopup="dialog"
      lead={lead ?? (g.time ? formatTime(g.time) : undefined)}
      // The day's own rows lead with a clock alone; the Bracket view's bands lead with the day too ("Fri 2:00 p.m.").
      leadTime={lead == null}
      captionFirst
      title={<GameTeams teams={ctx.teams} g={g} scored={scored} sides={sides} />}
      caption={where || undefined}
      // One place at every width: before the chevron at a desk, beside the two teams next to the corner chevron on a
      // phone (owner, 2026-10-12, walk §294 Ask 5 — on the when line it wrapped onto a line of its own).
      trail={chipEl ?? undefined}
      chevron
    />
  );
}

export default function ScheduleDayList({
  mode, games, stateOf, conflictOf, teams, divisions, venues, onOpen, label, empty,
}: {
  /** `day`: one day's games in one frame; `all`: every day, in day bands. */
  mode: 'day' | 'all';
  /** Already narrowed by the Filter and Search; for `day`, the day's only. */
  games: Game[];
  stateOf: (g: Game) => ScheduleState;
  /** A game still to play's conflict, for its chip (walk §294). */
  conflictOf?: (g: Game) => ScheduleConflict | null;
  teams: Team[];
  divisions: Division[];
  venues: Venue[];
  onOpen: (g: Game) => void;
  /** The list's name for assistive tech (the day). */
  label: string;
  empty: ReactNode;
}) {
  const ctx: Ctx = { teams, divisions, venues };
  const { ref, fits } = useGameTableFits();
  if (games.length === 0) return <>{empty}</>;
  const groups = gamesByDay(games);

  const row = (g: Game) => <ScheduleGameRow key={g.id} ctx={ctx} g={g} state={stateOf(g)} conflict={conflictOf?.(g) ?? null} onOpen={onOpen} />;
  const tableRow = (g: Game) => {
    const state = stateOf(g);
    return {
      g,
      game: <GameTeams teams={teams} g={g} scored={isScored(state)} />,
      status: stateChip(g, state, conflictOf?.(g) ?? null),
      onOpen: () => onOpen(g),
      opensDialog: true,
    };
  };
  const bandName = (day: string | null) => (day ? formatShortWeekdayDate(day) : W.noDate);

  return (
    <div className={sd.list} ref={ref}>
      {fits ? (
        <GameTable
          kind="day"
          label={label}
          teams={teams}
          divisions={divisions}
          venues={venues}
          groups={mode === 'day'
            ? [{ key: 'day', rows: groups.flatMap(d => d.games).map(tableRow) }]
            : groups.map(({ day, games: list }) => ({
              key: day ?? 'none', band: { name: bandName(day), count: W.bandCount(list.length) }, rows: list.map(tableRow),
            }))}
        />
      ) : mode === 'day' ? (
        <ClubRowList label={label}>{groups.flatMap(d => d.games).map(row)}</ClubRowList>
      ) : (
        <ClubRowFrame>
          {groups.map(({ day, games: list }) => (
            <ClubRowList key={day ?? 'none'} inset label={bandName(day)}>
              <ClubRowBand count={W.bandCount(list.length)}>{bandName(day)}</ClubRowBand>
              {list.map(row)}
            </ClubRowList>
          ))}
        </ClubRowFrame>
      )}
    </div>
  );
}
