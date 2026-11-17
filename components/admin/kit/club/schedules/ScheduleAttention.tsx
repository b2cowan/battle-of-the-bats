'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatStoredDate } from '@/lib/timezone';
import { pluralize } from '@/lib/utils';
import { HAND_BACK_WORDS as H } from '@/lib/club-hand-back-words';
import { PART_WORDS as P, SCHEDULE_SCREEN_WORDS as W } from '@/lib/club-schedule-words';
import { weekdayPlural } from '@/lib/permit-words';
import { orderScheduleAsks } from '@/lib/club-schedule-overview';
import { askSundayLine, type ScheduleAsk, type SchedulePlace, type SlotView } from '@/lib/club-schedule-view';
import sch from './Schedules.module.css';

/** 13c Session C (C2 = A): the row while the permit's dates off still hold this schedule's slots — built by the page, so
 *  this stays words and doors. `action` (Take {day} off) is a computer's only: Regenerate is. */
export interface OutsideRow {
  head: string;
  line: string | null;
  league?: { line: string; door: { label: string; href: string } | null } | null;
  action?: { label: string; onClick: () => void } | null;
}

const FIRST_ASKS = 3;

export default function ScheduleAttention({ asks, slots, places, canMoney, changed, sentOn, changeLines, partNotes = [], outside = [], unbilledParts = [], onAnswer, onSend, onBillPart }: {
  asks: readonly ScheduleAsk[];
  slots: readonly SlotView[];
  places: readonly SchedulePlace[];
  canMoney: boolean;
  changed: boolean;
  sentOn: string;
  changeLines: readonly string[];
  /** An added part with no bill yet (Phase 8, drawing tab 4 note 2): said in the change row, never in the bill tile —
   *  "Time added Nov 16 isn’t billed yet. You can bill it when you send the changes." */
  partNotes?: readonly string[];
  /** The permits' pulled dates (C2), first — one row per permit (a schedule on several permits, Session B). */
  outside?: readonly OutsideRow[];
  /** An added part SENT without a bill (Phase 8, Session 3 — drawing tab 5, note 2): its row, and Bill it… for a money reader
   *  (the shipped final-not-billed path: Bill the teams, then Review the bill). */
  unbilledParts?: readonly { id: string; text: string }[];
  onAnswer: (id: string) => void;
  onSend: () => void;
  onBillPart?: (partId: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const ordered = useMemo(() => orderScheduleAsks(asks, slots), [asks, slots]);
  const shown = showAll ? ordered : ordered.slice(0, FIRST_ASKS);
  const count = ordered.length + (changed ? 1 : 0) + outside.length + unbilledParts.length;
  if (!count) return null;
  // One lime a screen: the first outside row that asks takes it; the asks and Send changes below it go outline.
  const firstOutsideAsk = outside.findIndex(o => o.action);
  const outsideAsks = firstOutsideAsk >= 0;

  return (
    <section className={sch.attention} aria-labelledby="schedule-attention-title">
      <div className={sch.attentionHead}><h2 id="schedule-attention-title">Needs attention</h2><small>{pluralize(count, 'item')}</small></div>
      {/* 13c Session C (C2): the permits' pulled dates first — the first ask takes the lime (the drawing's note 7); a second
          permit's row is outline (Session B: one lime a screen). */}
      {outside.map((o, i) => <div key={i} className={sch.attentionRow} data-outside-permit>
        <span className={sch.attentionKind}>{W.outsideChip}</span>
        <div className={sch.attentionBody}>
          <b>{o.head}</b>
          {o.line && <small>{o.line}</small>}
          {o.league && <small>{o.league.line}{o.league.door && <> <Link href={o.league.door.href} className={sch.door}>{o.league.door.label}<ChevronRight size={14} aria-hidden /></Link></>}</small>}
        </div>
        {o.action && <button type="button" className={`btn ${i === firstOutsideAsk ? 'btn-lime' : 'btn-outline'}`} onClick={o.action.onClick}>{o.action.label}</button>}
      </div>)}
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
          {canMoney && <button type="button" className={`btn ${index === 0 && !outsideAsks ? 'btn-lime' : 'btn-outline'}`} onClick={() => onAnswer(ask.id)}>{H.answer}</button>}
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
            {partNotes.map(note => <small key={note}>{note}</small>)}
            {changeLines.length > 0 && <small>{W.changesTail}</small>}
          </div>
          {changeLines.length > 0 && <button type="button" className={`btn ${(canMoney && ordered.length) || outsideAsks ? 'btn-outline' : 'btn-lime'}`} onClick={onSend}>{W.sendChanges}</button>}
        </div>
      </>}
      {unbilledParts.map(p => <div key={p.id} className={sch.attentionRow} data-part-unbilled>
        <span className={sch.attentionKind}>{P.sentNotBilledChip}</span>
        <div className={sch.attentionBody}><b>{p.text}</b></div>
        {onBillPart && <button type="button" className="btn btn-outline" onClick={() => onBillPart(p.id)}>{P.billIt}</button>}
      </div>)}
    </section>
  );
}
