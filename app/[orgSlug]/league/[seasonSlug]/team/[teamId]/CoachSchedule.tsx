import type { ReactNode } from 'react';
import type { CoachGame, CoachPractice } from '@/lib/house-league-coach';
import { COACH_PRACTICE_WORDS as W } from '@/lib/league-practice-time';
import { SCHEDULE_PUBLIC_WORDS as P } from '@/lib/league-schedule-words';
import { SEASON_PUBLIC_WORDS, SEASON_SCHEDULE_WORDS } from '@/lib/league-season-calendar';
import { STATE_WORDS, TODAY_WORD, dayWords } from '@/lib/calendar-recipe';
import { formatInOrgZone, orgDayKey, utcToZonedInputs } from '@/lib/timezone';
import { formatTime, formatTimeRange } from '@/lib/utils';
import column from '../../../league-column.module.css';
import kit from '@/components/public/ClubKit.module.css';
import s from './CoachSchedule.module.css';

/**
 * THE TEAM'S SCHEDULE on a house-league coach's page (House League 9d-2b Part 5, frame g3, ruling 9d2·7; 11b·C's
 * practices): one list from today on, games and practices together in date order, each row the public schedule's game
 * row ("Today / Jun 17 · Twins vs Royals · 6:00 p.m."). Games are only the PUBLISHED ones, as families last heard them —
 * a coach never reads a game or a change families haven't been told about. A game waiting for a new date follows the list
 * under "Needs a new date", whatever its old day. Read only: the league admin changes them. Never on a family-facing page:
 * practices stay off the public schedule.
 */
export default function CoachSchedule({ practices, games, gamesPublished, divisionName }: {
  practices: CoachPractice[];
  games: CoachGame[];
  gamesPublished: boolean;
  divisionName: string;
}) {
  const today = orgDayKey(new Date().toISOString());
  const dated = games.filter(g => g.state !== 'postponed' && g.startsAt);
  const waiting = games.filter(g => g.state === 'postponed' || !g.startsAt);
  // A game and a practice at one minute: the game first (the season calendar's order).
  const rows: { ms: number; order: number; node: ReactNode }[] = [
    ...dated.map(g => ({ ms: Date.parse(g.startsAt!), order: 0, node: <GameRow key={g.id} game={g} today={today} /> })),
    ...practices.map(p => ({ ms: Date.parse(p.startsAt), order: 1, node: <PracticeRow key={p.id} practice={p} today={today} /> })),
  ].sort((a, b) => a.ms - b.ms || a.order - b.order);

  return (
    <>
      {rows.length > 0 && <ul className={`${kit.list} ${s.list}`}>{rows.map(r => r.node)}</ul>}
      {waiting.length > 0 && (
        <>
          <h3 className={s.heading}>{SEASON_SCHEDULE_WORDS.needsDate}</h3>
          <ul className={`${kit.list} ${s.list}`}>{waiting.map(g => <GameRow key={g.id} game={g} today={today} />)}</ul>
        </>
      )}
      <div className={s.notes}>
        {!gamesPublished
          ? <p className={kit.sub}>{P.coachUnpublished(divisionName)}</p>
          : games.length === 0 && <p className={kit.sub}>{P.coachNoneAhead}</p>}
        {practices.length === 0 && <p className={kit.sub}>{W.none}</p>}
      </div>
    </>
  );
}

/** The day cell: "Today" or "Wed" over "Jun 23" (g3); a postponed game's "Was Sat" over the day it had. */
function When({ iso, today, was }: { iso: string; today: string; was?: boolean }) {
  const weekday = formatInOrgZone(iso, { weekday: 'short' });
  const top = was ? SEASON_PUBLIC_WORDS.was(weekday) : orgDayKey(iso) === today ? TODAY_WORD : weekday;
  return (
    <time className={column.when} dateTime={iso}>
      {top}<span>{formatInOrgZone(iso, { month: 'short', day: 'numeric' })}</span>
    </time>
  );
}

const clockAt = (iso: string) => formatTime(utcToZonedInputs(iso).time);

function GameRow({ game: g, today }: { game: CoachGame; today: string }) {
  const cancelled = g.state === 'cancelled', postponed = g.state === 'postponed';
  // Moved (9d2·10): re-dated since families first heard, once sent — the public schedule's rule.
  const movedFrom = g.movedFrom && !postponed && !cancelled && !g.result ? g.movedFrom : null;
  return (
    <li className={`${column.game}${cancelled ? ` ${column.struck}` : ''}`}>
      {g.startsAt ? <When iso={g.startsAt} today={today} was={postponed} /> : <span className={column.when}>{SEASON_PUBLIC_WORDS.dateToCome}</span>}
      <span className={column.match}>
        <span className={column.matchName}>{g.startsAt && !postponed ? `${g.title} · ${clockAt(g.startsAt)}` : g.title}</span>
        {g.place && <span className={column.place}>{g.place}</span>}
        {movedFrom && <span className={column.place}>{P.movedWas(dayWords(orgDayKey(movedFrom)), clockAt(movedFrom))}</span>}
      </span>
      {postponed ? <span className={column.state}><span className={`${kit.chip} ${kit.chipWarn}`}>{STATE_WORDS.postponed}</span></span>
        : cancelled ? <span className={column.state}><span className={`${kit.chip} ${kit.chipNeutral}`}>{STATE_WORDS.cancelled}</span></span>
        : g.result ? <span className={column.state}>{g.result}</span>
        : movedFrom ? <span className={column.state}><span className={`${kit.chip} ${kit.chipWarn}`}>{P.moved}</span></span>
        : null}
    </li>
  );
}

function PracticeRow({ practice: p, today }: { practice: CoachPractice; today: string }) {
  const start = utcToZonedInputs(p.startsAt), end = p.endsAt ? utcToZonedInputs(p.endsAt) : null;
  const sub = [p.location, p.fromClub ? W.from(p.fromSchedule) : null].filter(Boolean).join(' · ');
  return (
    <li className={`${column.game}${p.cancelled ? ` ${column.struck}` : ''}`}>
      <When iso={p.startsAt} today={today} />
      <span className={column.match}>
        <span className={column.matchName}>{W.practice} · {formatTimeRange(start.time, end?.time ?? null)}</span>
        {sub && <span className={column.place}>{sub}</span>}
      </span>
      {p.cancelled && <span className={column.state}><span className={`${kit.chip} ${kit.chipNeutral}`}>{W.cancelled}</span></span>}
    </li>
  );
}
