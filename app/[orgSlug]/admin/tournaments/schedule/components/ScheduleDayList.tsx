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
 */
import type { ReactNode } from 'react';
import type { Division, Game, Team, Venue } from '@/lib/types';
import type { BracketSide } from '@/lib/bracket-reading';
import { ClubRow, ClubRowBand, ClubRowFrame, ClubRowList, RepChip, type ChipTone } from '@/components/admin/kit/club/RepKit';
import { GameTeams, gameWhereLine } from '../../results/ResultsList';
import { GAME_STATE_WORD } from '@/lib/game-day-words';
import { gamesByDay, type ScheduleState } from '@/lib/schedule-day';
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
const isScored = (state: ScheduleState) => state === 'final' || state === 'forfeit' || state === 'pendingReview';

export type ScheduleRowCtx = { teams: Team[]; divisions: Division[]; venues: Venue[] };
type Ctx = ScheduleRowCtx;

/** The state the score can't say, as its chip — the day's rows and the bracket's cards wear the same one. */
export function stateChip(g: Game, state: ScheduleState): ReactNode {
  const tie = state === 'final' && g.homeScore != null && g.homeScore === g.awayScore;
  const chip = tie ? GAME_STATE_WORD.tie : CHIP_TONE[state] !== undefined ? W.states[state] : null;
  return chip ? <RepChip tone={tie ? 'neutral' : CHIP_TONE[state]}>{chip}</RepChip> : null;
}

/**
 * One game's row. The Bracket view's bands pass `lead` (the day with the time: "Fri 2:00 p.m."), `sides` (the
 * bracket's reading of the two teams) and `tail` (a waiting game's "waits for the toss").
 */
export function ScheduleGameRow({ ctx, g, state, onOpen, lead, sides, tail }: {
  ctx: Ctx; g: Game; state: ScheduleState; onOpen: (g: Game) => void;
  lead?: string; sides?: { away: BracketSide; home: BracketSide }; tail?: string;
}) {
  const scored = isScored(state);
  const chipEl = stateChip(g, state);
  const where = [gameWhereLine(ctx, g), tail].filter(Boolean).join(' · ');
  return (
    <ClubRow
      as="button"
      onClick={() => onOpen(g)}
      aria-haspopup="dialog"
      lead={lead ?? (g.time ? formatTime(g.time) : undefined)}
      captionFirst
      title={<GameTeams teams={ctx.teams} g={g} scored={scored} sides={sides} />}
      // The chip rides the when line on a phone (as drawn: "4:00 p.m. · Diamond 2 · U11 · Final  PLAYING NOW"), so a
      // state never costs a row a line of its own; at a desk it keeps its column before the chevron.
      caption={where || chipEl ? <>{where}{chipEl && <span className={sd.chipPhone}>{chipEl}</span>}</> : undefined}
      trail={chipEl ? <span className={sd.chipDesk}>{chipEl}</span> : undefined}
      chevron
    />
  );
}

export default function ScheduleDayList({
  mode, games, stateOf, teams, divisions, venues, onOpen, label, empty,
}: {
  /** `day`: one day's games in one frame; `all`: every day, in day bands. */
  mode: 'day' | 'all';
  /** Already narrowed by the Filter and Search; for `day`, the day's only. */
  games: Game[];
  stateOf: (g: Game) => ScheduleState;
  teams: Team[];
  divisions: Division[];
  venues: Venue[];
  onOpen: (g: Game) => void;
  /** The list's name for assistive tech (the day). */
  label: string;
  empty: ReactNode;
}) {
  const ctx: Ctx = { teams, divisions, venues };
  if (games.length === 0) return <>{empty}</>;
  const groups = gamesByDay(games);

  if (mode === 'day') {
    return (
      <div className={sd.list}>
        <ClubRowList label={label}>
          {groups.flatMap(g => g.games).map(g => <ScheduleGameRow key={g.id} ctx={ctx} g={g} state={stateOf(g)} onOpen={onOpen} />)}
        </ClubRowList>
      </div>
    );
  }
  return (
    <div className={sd.list}>
      <ClubRowFrame>
        {groups.map(({ day, games: list }) => {
          const name = day ? formatShortWeekdayDate(day) : W.noDate;
          return (
            <ClubRowList key={day ?? 'none'} inset label={name}>
              <ClubRowBand count={W.bandCount(list.length)}>{name}</ClubRowBand>
              {list.map(g => <ScheduleGameRow key={g.id} ctx={ctx} g={g} state={stateOf(g)} onOpen={onOpen} />)}
            </ClubRowList>
          );
        })}
      </ClubRowFrame>
    </div>
  );
}
