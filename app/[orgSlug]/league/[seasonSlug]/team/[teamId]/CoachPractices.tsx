import type { CoachPractice } from '@/lib/house-league-coach';
import { COACH_PRACTICE_WORDS as W } from '@/lib/league-practice-time';
import { formatInOrgZone, utcToZonedInputs } from '@/lib/timezone';
import { formatTimeRange } from '@/lib/utils';
import kit from '@/components/public/ClubKit.module.css';
import s from './CoachPractices.module.css';

/**
 * THE TEAM'S PRACTICES on a house-league coach's page (Club Tier Stage 11b Part 4, ruling 11b·C): from today on, a club
 * practice reading "From {schedule}", a hand-booked one too, a cancelled one marked. Read only — the league admin
 * changes them. 9d-2b adds the games beside them. Never on a family-facing page: practices stay off the public schedule.
 */
export default function CoachPractices({ practices }: { practices: CoachPractice[] }) {
  return (
    <>
      <h3 className={s.heading}>{W.heading}</h3>
      {practices.length === 0 ? (
        <p className={kit.sub}>{W.none}</p>
      ) : (
        <ul className={`${kit.list} ${s.list}`}>
          {practices.map(p => {
            const start = utcToZonedInputs(p.startsAt), end = p.endsAt ? utcToZonedInputs(p.endsAt) : null;
            const sub = [p.location, p.fromClub ? W.from(p.fromSchedule) : null].filter(Boolean).join(' · ');
            return (
              <li key={p.id} className={`${kit.row} ${s.row}${p.cancelled ? ` ${s.cancelled}` : ''}`}>
                <span className={kit.rowMain}>
                  <span className={kit.rowName}>
                    {formatInOrgZone(p.startsAt, { weekday: 'short', month: 'short', day: 'numeric' })} · {formatTimeRange(start.time, end?.time ?? null)}
                  </span>
                  {sub && <span className={kit.rowSub}>{sub}</span>}
                </span>
                {p.cancelled && <span className={`${kit.chip} ${kit.chipNeutral}`}>{W.cancelled}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
