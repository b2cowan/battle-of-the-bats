'use client';
import { useMemo, useState } from 'react';
import { formatShortWeekdayDate } from '@/lib/timezone';
import { pluralize } from '@/lib/utils';
import { HAND_BACK_WORDS as H } from '@/lib/club-hand-back-words';
import { SCHEDULE_SCREEN_WORDS as W } from '@/lib/club-schedule-words';
import { weekdayPlural } from '@/lib/permit-words';
import { scheduleOverview } from '@/lib/club-schedule-overview';
import { heldWords, slotTime, type PlaceRow, type SlotView } from '@/lib/club-schedule-view';
import sch from './Schedules.module.css';

const FIRST_EXCEPTIONS = 5;

export default function ScheduleOverview({ rows, days, slots, askedIds, nameOf, onOpenGrid }: {
  rows: readonly PlaceRow[];
  days: readonly string[];
  slots: readonly SlotView[];
  askedIds: ReadonlySet<string>;
  nameOf: (id: string) => string;
  onOpenGrid: (rowKey: string, day: string) => void;
}) {
  const [allExceptions, setAllExceptions] = useState(false);
  const patterns = useMemo(() => scheduleOverview(rows, days, slots, askedIds), [rows, days, slots, askedIds]);
  const exceptions = patterns.flatMap(pattern => pattern.different.map(read => ({ pattern, read })))
    .sort((a, b) => a.read.day.localeCompare(b.read.day) || a.pattern.place.name.localeCompare(b.pattern.place.name)
      || a.pattern.startClock.localeCompare(b.pattern.startClock));
  const shown = allExceptions ? exceptions : exceptions.slice(0, FIRST_EXCEPTIONS);

  const who = (list: readonly SlotView[]) => list.length ? list.map(slot => {
    if (slot.teamIds.length) return slot.teamIds.map(nameOf).join(' · ');
    if (slot.heldBy) return heldWords(slot.heldBy);
    return slot.handedBack?.teamId ? W.handedBackSlot(nameOf(slot.handedBack.teamId)) : W.openSlot;
  }).join(' · ') : 'No time held';
  const marks = (list: readonly SlotView[]) => [...new Set(list.flatMap(slot => [
    slot.clash ? 'Clash' : '', askedIds.has(slot.id) ? H.pill : '', slot.locked ? W.locked : '',
    slot.movedByHand ? 'Moved by hand' : '',
  ]).filter(Boolean))];

  if (!days.length || !patterns.length) return <p className={sch.overviewEmpty}>No time is scheduled on these dates. Open Grid to inspect the week.</p>;
  return (
    <div className={sch.overviewBody}>
      <p className={sch.overviewIntro}>The usual assignment on these {pluralize(days.length, 'date')}. Every different or empty date is listed beside it. Open Grid for an individual slot or an edit.</p>
      <div className={sch.overviewCols}>
        <section className={sch.overviewPanel} aria-labelledby="schedule-patterns-title">
          <div className={sch.overviewPanelHead}><h2 id="schedule-patterns-title">Typical {weekdayPlural(patterns[0].usual[0].weekday)}</h2><span>{pluralize(patterns.length, 'time row')}</span></div>
          {patterns.map(pattern => (
            <button key={pattern.key} type="button" className={sch.overviewPattern}
              onClick={() => onOpenGrid(pattern.place.key, pattern.usualDays[0] ?? days[0])}>
              <span className={sch.overviewPlace}>{pattern.place.name}<small>{pattern.place.venueName}</small></span>
              <span className={sch.overviewTime}>{slotTime(pattern.usual[0])}</span>
              <span className={sch.overviewWho}>{who(pattern.usual)}{marks(pattern.usual).length > 0 && <small>{marks(pattern.usual).join(' · ')}</small>}</span>
              <span className={`${sch.overviewCount}${pattern.different.length ? ` ${sch.overviewCountDifferent}` : ''}`}>{pattern.usualDays.length} of {days.length}</span>
            </button>
          ))}
        </section>
        <section className={sch.overviewPanel} aria-labelledby="schedule-exceptions-title">
          <div className={sch.overviewPanelHead}><h2 id="schedule-exceptions-title">Different on a date</h2><span>{pluralize(exceptions.length, 'difference')}</span></div>
          {exceptions.length ? shown.map(({ pattern, read }) => (
            <button key={`${pattern.key}|${read.day}`} type="button" className={sch.overviewException}
              onClick={() => onOpenGrid(pattern.place.key, read.day)}>
              <b>{formatShortWeekdayDate(read.day)} · {pattern.place.name}</b>
              <span>{slotTime(pattern.usual[0])} · {who(read.slots)}</span>
              {marks(read.slots).length > 0 && <small>{marks(read.slots).join(' · ')}</small>}
            </button>
          )) : <p className={sch.overviewQuiet}>The assignments match on every date shown.</p>}
          {exceptions.length > FIRST_EXCEPTIONS && <button type="button" className={sch.overviewMore}
            onClick={() => setAllExceptions(open => !open)} aria-expanded={allExceptions}>
            {allExceptions ? 'Show fewer differences' : `Show ${exceptions.length - FIRST_EXCEPTIONS} more differences`}
          </button>}
        </section>
      </div>
    </div>
  );
}
