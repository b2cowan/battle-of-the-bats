'use client';
/**
 * THE PHONE'S MOVE SHEET (Tournament admin redesign Stage 3, S4 — A36, A37). A tap on a timeline block on a phone
 * opens it: the game's own head ("Storm vs Mustangs", "U13 · Round robin · now 5:00 p.m. · Diamond 4"), then Day ·
 * Start · Venue · Diamond — the club's ONE field (6a), worn as built — and the line under it: red when another game of
 * the tournament holds that diamond then (Move waits), the busy ink for a short gap. Its lime names who it tells: a
 * published game on a plan with alerts says "Move · tells both teams", so the sheet IS the asking (no second
 * question); anything else says "Move". The move ends in the page's notice with Undo.
 *
 * On the admin's bottom sheet, which Stage 6 put on the Sheet Frame's terms for all its users (A29): the record head,
 * the plain ×, the form layer over the bar. Replaces the old reschedule sheet (a 15-minute stepper, a field list and a
 * warn-and-save status line).
 */
import { useState } from 'react';
import BottomSheet from '@/components/admin/BottomSheet';
import WhereField from '@/components/venue/WhereField';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import type { Division, Game, Team, Tournament, Venue } from '@/lib/types';
import { bracketGameLabel } from '@/lib/playoff-bracket';
import { placeOfWhere, samePlace, tournamentSourceLine, tournamentVenueOptions, whereOfGame } from '@/lib/tournament-where';
import { GAME_WINDOW_WORDS as G, MOVE_WORDS as M, SCHEDULE_DAY_WORDS as W, slotWords } from '@/lib/schedule-words';
import { resolveGameFieldLabel } from '@/lib/venue-label';
import { formatTime } from '@/lib/utils';
import { fieldNounFor } from '@/lib/sports';
import { useOverlapLine } from './useOverlapLine';
import ms from './MoveSheet.module.css';

/** Where a move sends a game: the games route's own keys (a picked venue's ids, or typed words). */
export type MoveTarget = { date: string; time: string; venueId: string | null; venueFacilityId: string | null; location: string | null };

export default function MoveSheet({
  game, games, teams, divisions, venues, tournament, days, today, tells, onClose, onMove,
}: {
  game: Game;
  /** Every game of the tournament (the line checks against all of them). */
  games: readonly Game[];
  teams: readonly Team[];
  divisions: Division[];
  venues: readonly Venue[];
  tournament: Tournament | null;
  /** The event's days, for the Day dropdown. */
  days: readonly string[];
  today: string;
  /** A published game on a plan with phone alerts: the lime says it tells both teams. */
  tells: boolean;
  onClose: () => void;
  onMove: (to: MoveTarget) => void;
}) {
  const [date, setDate] = useState(game.date ?? days[0] ?? '');
  const [time, setTime] = useState((game.time ?? '09:00').slice(0, 5));
  const [where, setWhere] = useState(() => whereOfGame(game, venues));
  const noun = fieldNounFor(tournament?.sport);
  const { refused, line } = useOverlapLine({
    active: true, id: game.id, date, time, where, divisionId: game.divisionId ?? null,
    durationMinutes: game.durationMinutes ?? null, games, teams, divisions, tournament, noun,
  });

  const team = (id: string | null | undefined, ph: string | null | undefined) =>
    (id ? teams.find(t => t.id === id)?.name : null) || slotWords(ph) || 'TBD';
  const division = divisions.find(d => d.id === game.divisionId);
  const stage = game.isPlayoff && game.bracketCode ? bracketGameLabel(game.bracketCode) : W.stages.pool;
  const unchanged = date === (game.date ?? '') && time === (game.time ?? '').slice(0, 5) && samePlace(where, whereOfGame(game, venues));
  const dayChoices = Array.from(new Set([...days, ...(date ? [date] : [])])).sort();
  const venueOptions = tournamentVenueOptions(venues);

  const move = () => {
    if (refused || unchanged || !date || !time) return;
    onMove({ date, time, ...placeOfWhere(where) });
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={G.vs(team(game.awayTeamId, game.awayPlaceholder), team(game.homeTeamId, game.homePlaceholder))}
      subtitle={M.sheetCaption(division?.name ?? '', stage, game.time ? formatTime(game.time) : '', resolveGameFieldLabel(game, [...venues]))}
      footer={(
        <div className={ms.foot}>
          <button type="button" className={screenParts.plainButton} onClick={onClose}>{G.cancel}</button>
          <button type="button" className={`btn btn-lime ${ms.go}`} onClick={move} disabled={refused || unchanged || !date || !time}>
            {tells ? M.moveTells : M.move}
          </button>
        </div>
      )}
    >
      <div className={ms.body}>
        <div className={ms.pair}>
          <label className={ck.field}>
            <span className={ck.label}>{G.fields.day}</span>
            <select className={ck.select} value={date} onChange={e => setDate(e.target.value)}>
              {dayChoices.map(d => <option key={d} value={d}>{W.dayLabel(d, today)}</option>)}
            </select>
          </label>
          <label className={ck.field}>
            <span className={ck.label}>{G.fields.start}</span>
            <input className={ck.input} type="time" step={300} value={time} onChange={e => setTime(e.target.value)} />
          </label>
        </div>
        <WhereField
          idPrefix={`move-${game.id}`}
          sport={tournament?.sport}
          value={where}
          onChange={setWhere}
          clubVenues={venueOptions}
          inClub={venueOptions.length > 0}
          clubGroupLabel={G.venueGroup}
          sourceLine={tournamentSourceLine(where, venues, G.venueSource)}
          classes={{ field: ck.field, label: ck.label, input: ck.input, select: ck.select, hint: ck.label }}
          line={line}
        />
      </div>
    </BottomSheet>
  );
}
