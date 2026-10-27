'use client';
import { Fragment } from 'react';
import { CalendarDays } from 'lucide-react';
import { divisionTimeLine, timeLineWords, LEAGUE_TIME_WORDS as W, type LeagueTime } from '@/lib/league-time';
import s from './LeagueTime.module.css';

/**
 * THE TIME LINE (Club Tier Stage 11b Part 3; drawings "The schedule page" c, ruled 2026-10-27 card 8): one quiet line under
 * the house-league Schedule page's title naming where the picked division's time comes from, ending in the door to House
 * league's time. Days and clocks only, no facilities; a clause only for what the division has. A phone reads one line.
 *
 * ⚖ Shown only when the club has given house league time this season can divide, or the viewer builds Schedules (an
 * owner or an admin, so a division with none yet has a way to start). Otherwise ABSENT: a club that books by hand never
 * gets a permanent nag. The caller decides with `showTimeLine`.
 */
export const showTimeLine = (time: LeagueTime | null, buildsSchedules: boolean) =>
  !!time && (time.sources.length > 0 || buildsSchedules);

export default function HouseLeagueTimeLine({ time, divisionId, divisionName, onOpen }: {
  time: LeagueTime;
  divisionId: string;
  divisionName: string;
  onOpen: () => void;
}) {
  const words = timeLineWords(divisionName, divisionTimeLine(time.sources, divisionId));
  const door = <button type="button" className={s.lineDoor} onClick={onOpen}>{W.line.door}</button>;
  return (
    <p className={s.line}>
      <CalendarDays size={15} aria-hidden className={s.lineIcon} />
      <span className={s.lineDesk}>
        {words
          ? <>{words.lead}{words.schedules.map((name, i) => (
              <Fragment key={name}>
                <b>{name}</b>
                {i < words.schedules.length - 2 ? ', ' : i === words.schedules.length - 2 ? ' and ' : ''}
              </Fragment>
            ))}{words.tail} </>
          : <>{W.line.none(divisionName)} </>}
        {door}
      </span>
      <span className={s.linePhone}><span className={s.linePhoneText}>{W.line.phone} ·</span> {door}</span>
    </p>
  );
}
