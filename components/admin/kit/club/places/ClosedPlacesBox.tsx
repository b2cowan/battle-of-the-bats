'use client';
/**
 * THE VENUE LIBRARY'S "CLOSED PLACES" BOX (Club Website Stage 2, K11; S4, owner 2026-11-26; days and ticks, owner
 * 2026-11-27 "build it as sketched"). The closures showing, under a heading per day ("Today, Fri, Nov 27" · "Tomorrow, Sat,
 * Nov 28"), soonest first, so one set for tomorrow is never lost at the foot of today's. A row per park and dates, its
 * plain lines under its name (never a dotted one) and its own Reopen; with "All our fields" showing, every other row sits
 * under it ("Also closed on their own").
 * Ticks reopen several at once: a row's, or a day heading's for everything under it; "Reopen 4 places" appears in the
 * box's heading once something is ticked. Nothing starts ticked (reopening emails coaches). One closure showing has
 * nothing to pick from, so it wears no ticks.
 */
import { useEffect, useMemo, useRef } from 'react';
import {
  CLOSE_WORDS as W, alsoWords, closedDays, lowerEvery, pickedLabel, rowDays, rowLinesUnder, rowsUnder, type ClosureRow,
} from '@/lib/place-closure-window';
import own from '../VenueLibrary.module.css';

/** A day heading's tick, beside the heading (never inside it, so the heading's name is the day alone). */
function DayTick({ id, label, keys, ticked, onTick }: {
  id: string; label: string; keys: readonly string[]; ticked: ReadonlySet<string>; onTick: (keys: readonly string[], on: boolean) => void;
}) {
  const on = keys.filter(k => ticked.has(k)).length;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = on > 0 && on < keys.length; }, [on, keys.length]);
  return (
    <input ref={ref} id={id} type="checkbox" className={own.closedTick} checked={on === keys.length}
      aria-label={W.pickDayAria(label)} onChange={e => onTick(keys, e.target.checked)} />
  );
}

export default function ClosedPlacesBox({ rows, today, ticked, onTick, onReopen }: {
  rows: readonly ClosureRow[];
  today: string;
  /** The ticked rows' keys. */
  ticked: ReadonlySet<string>;
  onTick: (keys: readonly string[], on: boolean) => void;
  /** One row from its own button, or the ticked rows from the heading's. */
  onReopen: (picked: ClosureRow[]) => void;
}) {
  const days = useMemo(() => closedDays(rows, today), [rows, today]);
  const picks = rows.length > 1;
  // In the order the box shows them, so the window lists them the same way.
  const picked = days.flatMap(d => d.rows).filter(r => ticked.has(r.key));
  return (
    <section className={`${own.closedBox}${picks ? ` ${own.closedPicks}` : ''}`} aria-label={W.closedBox}>
      <div className={own.closedTop}>
        <h2 className={own.closedHead}>{W.closedBox}</h2>
        {picked.length > 0 && (
          <button type="button" className={`btn btn-outline ${own.closedMany}`} aria-haspopup="dialog" onClick={() => onReopen(picked)}>
            {pickedLabel(picked)}
          </button>
        )}
      </div>
      {days.map(day => (
        <div key={day.key}>
          <div className={own.closedDay}>
            {picks && <DayTick id={`closed-day-${day.key}`} label={day.label} keys={day.rows.map(r => r.key)} ticked={ticked} onTick={onTick} />}
            <h3 className={own.closedDayName}>{picks ? <label htmlFor={`closed-day-${day.key}`}>{day.label}</label> : day.label}</h3>
          </div>
          {day.rows.map(r => {
            const parent = r.under ? rows.find(x => x.key === r.under) ?? null : null;
            const under = parent ? rowsUnder(rows, parent.key) : [];
            const id = `closed-${r.key}`;
            return (
              <div key={r.key}>
                {parent && under[0]?.key === r.key && <p className={own.closedBand}>{W.alsoBand(parent.scope === 'all' ? lowerEvery(W.everyPlace) : parent.placeName ?? parent.title, alsoWords(under).one)}</p>}
                <div className={`${own.closedRow}${r.under ? ` ${own.closedUnder}` : ''}`}>
                  {picks && (
                    <input id={id} type="checkbox" className={`${own.closedTick} ${own.closedRowTick}`} checked={ticked.has(r.key)}
                      aria-label={W.pickRowAria(r.title, rowDays(r))} onChange={e => onTick([r.key], e.target.checked)} />
                  )}
                  <strong className={own.closedName}>{picks ? <label htmlFor={id}>{r.title}</label> : r.title}</strong>
                  <button type="button" className={`btn btn-outline ${own.closedReopen}`} aria-haspopup="dialog"
                    aria-label={W.reopenAria(`${r.scope === 'all' ? lowerEvery(r.title) : r.scope === 'place' ? r.placeName ?? r.title : r.title}, ${rowDays(r)}`)}
                    onClick={() => onReopen([r])}>{W.reopen}</button>
                  <div className={own.closedFacts}>{rowLinesUnder(r, day).map(line => <span key={line} className={own.closedLine}>{line}</span>)}</div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
