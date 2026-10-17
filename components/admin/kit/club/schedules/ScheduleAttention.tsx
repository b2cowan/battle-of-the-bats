'use client';
import { useMemo, useState } from 'react';
import { formatStoredDate } from '@/lib/timezone';
import { pluralize } from '@/lib/utils';
import { HAND_BACK_WORDS as H } from '@/lib/club-hand-back-words';
import { SCHEDULE_SCREEN_WORDS as W } from '@/lib/club-schedule-words';
import { weekdayPlural } from '@/lib/permit-words';
import { orderScheduleAsks } from '@/lib/club-schedule-overview';
import { askSundayLine, type ScheduleAsk, type SchedulePlace, type SlotView } from '@/lib/club-schedule-view';
import sch from './Schedules.module.css';

const FIRST_ASKS = 3;

export default function ScheduleAttention({ asks, slots, places, canMoney, changed, sentOn, changeLines, onAnswer, onSend }: {
  asks: readonly ScheduleAsk[];
  slots: readonly SlotView[];
  places: readonly SchedulePlace[];
  canMoney: boolean;
  changed: boolean;
  sentOn: string;
  changeLines: readonly string[];
  onAnswer: (id: string) => void;
  onSend: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const ordered = useMemo(() => orderScheduleAsks(asks, slots), [asks, slots]);
  const shown = showAll ? ordered : ordered.slice(0, FIRST_ASKS);
  const count = ordered.length + (changed ? 1 : 0);
  if (!count) return null;

  return (
    <section className={sch.attention} aria-labelledby="schedule-attention-title">
      <div className={sch.attentionHead}><h2 id="schedule-attention-title">Needs attention</h2><small>{pluralize(count, 'item')}</small></div>
      {ordered.length > FIRST_ASKS && <div className={sch.attentionGroup}>
        Hand-back asks <span className={sch.attentionCount}>{ordered.length}</span>
        <small>Soonest affected day first · {showAll ? 'all shown' : 'first three shown'}</small>
      </div>}
      {shown.map((ask, index) => {
        const sundays = ask.sundays.map(sunday => askSundayLine(sunday, places));
        return <div key={ask.id} className={sch.attentionRow} data-ask-callout>
          <span className={sch.attentionKind}>{ordered.length > FIRST_ASKS ? `${formatStoredDate(ask.askedOn, { withYear: false })} ask` : 'Hand-back ask'}</span>
          <div className={sch.attentionBody}>
            <b>{ask.late ? H.calloutHeadLate(ask) : H.calloutHead(ask)}</b>
            {sundays.length > 0 && <small>{sundays[0]}{sundays.length > 1 ? ` · and ${pluralize(sundays.length - 1, 'other')}` : ''}</small>}
            <small>{ask.late ? H.calloutTailLate(ask, canMoney) : H.calloutTail(ask, canMoney)}</small>
            {sundays.length > 1 && <details className={sch.attentionDetails}>
              <summary>All {ask.weekday == null ? pluralize(sundays.length, 'date') : `${sundays.length} ${weekdayPlural(ask.weekday)}`}</summary>
              <ul>{sundays.map((line, i) => <li key={`${line}|${i}`}>{line}</li>)}</ul>
            </details>}
          </div>
          {canMoney && <button type="button" className={`btn ${index === 0 ? 'btn-lime' : 'btn-outline'}`} onClick={() => onAnswer(ask.id)}>{H.answer}</button>}
        </div>;
      })}
      {ordered.length > FIRST_ASKS && <button type="button" className={sch.attentionMore}
        onClick={() => setShowAll(open => !open)} aria-expanded={showAll}>
        {showAll ? 'Show fewer hand-back asks' : `Show ${ordered.length - FIRST_ASKS} more hand-back asks`}
      </button>}
      {changed && <>
        {ordered.length > FIRST_ASKS && <div className={sch.attentionGroup}>Schedule updates <span className={sch.attentionCount}>1</span><small>Kept visible while asks are collapsed</small></div>}
        <div className={sch.attentionRow}>
          <span className={sch.attentionKind}>Unsent change</span>
          <div className={sch.attentionBody}>
            <b>{changeLines.length ? W.changesHead(changeLines.length, sentOn) : W.changesNone}</b>
            {changeLines.length > 0 && <small>{changeLines[0]}</small>}
            {changeLines.length > 1 && <details className={sch.attentionDetails}>
              <summary>All {pluralize(changeLines.length, 'change')}</summary>
              <ul>{changeLines.map((line, i) => <li key={`${line}|${i}`}>{line}</li>)}</ul>
            </details>}
            {changeLines.length > 0 && <small>{W.changesTail}</small>}
          </div>
          {changeLines.length > 0 && <button type="button" className={`btn ${canMoney && ordered.length ? 'btn-outline' : 'btn-lime'}`} onClick={onSend}>{W.sendChanges}</button>}
        </div>
      </>}
    </section>
  );
}
