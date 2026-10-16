'use client';
/**
 * THE CLUB SCHEDULER'S SMALL SHARED PARTS (Club Tier Stage 11a, part B — hub Stages 10 + 11, specimens 4–13): the one
 * state chip a schedule's name carries, a team's swatch, the joined band of Fair shares, the one-statement box the
 * tournament generator's frame wears (its look, the scheduler's own part — Ask 5: never the tournament's code), and an
 * ask's callout on the schedule's page (Stage 11d part B).
 */
import type { CSSProperties, ReactNode } from 'react';
import { RepChip } from '../RepKit';
import { SCHEDULE_WORDS } from '@/lib/club-schedule-words';
import { HAND_BACK_WORDS as H } from '@/lib/club-hand-back-words';
import { askSundayLine, type ScheduleAsk, type SchedulePlace } from '@/lib/club-schedule-view';
import sch from './Schedules.module.css';

/** The one state chip, only where it needs saying: Draft · In review (olive) · the amber Changed since sent. A sent
 *  schedule with nothing waiting says nothing more. */
export function ScheduleStateChip({ state, changed }: { state: 'draft' | 'in_review' | 'final'; changed: boolean }) {
  if (state === 'final') return changed ? <RepChip tone="warn">{SCHEDULE_WORDS.changedSinceSent}</RepChip> : null;
  if (state === 'in_review') return <span className={sch.reviewChip}>{SCHEDULE_WORDS.inReview}</span>;
  return <RepChip>{SCHEDULE_WORDS.draft}</RepChip>;
}

/** A team's colour as a small square — the one lead mark a list row carries (§3.10.7), never a rail on the row. */
export function Swatch({ colour }: { colour: string }) {
  return <span className={sch.swatch} style={{ '--tc': colour } as CSSProperties} aria-hidden />;
}

/** The statement box: one bold lead, the rest, and its bullets — what saving (or sending) does, said once. */
export function Statement({ lead, rest, bullets }: { lead: ReactNode; rest?: ReactNode; bullets?: readonly string[] }) {
  return (
    <div className={sch.statement}>
      <b>{lead}</b>{rest ? <> {rest}</> : null}
      {bullets && bullets.length > 0 && <ul>{bullets.map(b => <li key={b}>{b}</li>)}</ul>}
    </div>
  );
}

/** The joined band: tiles CONNECTED, never cards with gaps (2026-10-08) — Fair shares' four figures. `across`: one row of
 *  four, above the toolbar (Fair shares B); otherwise two by two. */
export function JoinedBand({ tiles, label, across = false }: { label: string; across?: boolean; tiles: { key: string; label: string; value: ReactNode; amber?: boolean }[] }) {
  return (
    <div className={`${sch.band}${across ? ` ${sch.bandAcross}` : ''}`} role="group" aria-label={label}>
      {tiles.map(t => (
        <div key={t.key} className={sch.bandTile}>
          <span className={sch.bandLabel}>{t.label}</span>
          <span className={`${sch.bandValue}${t.amber ? ` ${sch.amber}` : ''}`}>{t.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Up to this many of an ask's Sundays read one by one in its callout; past it, how many more. */
const ASK_LINES = 6;

/**
 * AN ASK ON THE SCHEDULE'S PAGE (Stage 11d part B, specimen 3 — Asks 3, 4): the white callout with the page's amber
 * waiting edge — who, how many Sundays and how much, which Sundays, who asked and when — and Answer, which opens the one
 * Answer window over the page. A LATE ask (part C) reads the money only; its Sundays are already open. A reader who can't
 * move club money reads it without the figure and without Answer, and is told who answers (Ask 4). `lime`: the page's one
 * lime is the oldest ask's Answer (a second ask's Answer is outlined).
 */
export function AskCallout({ ask, places, onAnswer, lime }: { ask: ScheduleAsk; places: readonly SchedulePlace[]; onAnswer?: () => void; lime: boolean }) {
  const head = ask.late ? H.calloutHeadLate(ask) : H.calloutHead(ask);
  const shown = ask.sundays.slice(0, ASK_LINES);
  const more = ask.sundays.length - shown.length;
  const tail = ask.late ? H.calloutTailLate(ask) : H.calloutTail(ask);
  return (
    <div className={sch.callout} data-ask-callout>
      <div className={sch.calloutBody}>
        <b>{head}</b>
        <ul>
          {shown.map(s => <li key={`${s.slotId ?? ''}|${s.startsAt}`}>{askSundayLine(s, places)}</li>)}
          {more > 0 && <li>{H.calloutMore(more, ask.weekday)}</li>}
        </ul>
        <span className={sch.calloutTail}>{onAnswer ? tail : `${tail} ${H.answeredBySomeoneElse}`}</span>
      </div>
      {onAnswer && <button type="button" className={`btn ${lime ? 'btn-lime' : 'btn-outline'}`} onClick={onAnswer}>{H.answer}</button>}
    </div>
  );
}
