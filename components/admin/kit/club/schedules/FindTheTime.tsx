'use client';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * FIND THE TIME — a level of New schedule (a schedule on several permits, Session D; drawing
 * CLUB_SCHEDULE_SEVERAL_PERMITS_DRAWINGS.html tab 2; plan §4d; owner rulings 2026-11-14 N1 A, P4 A, P7 A, P7b A, P12 A).
 *
 * Every place the club holds on any permit in the dates, narrowed as the filters are set — dates, days, hours (with more
 * ranges), kind, where, town, shortest useful block — each row saying how much matching time is left ("Tue and Thu
 * 6:00–8:00 p.m. · 36 h · 15 evenings free of 17"). The reading is `freeTime` (`lib/permit-free-time.ts`) through
 * `POST /api/admin/schedules/free-time`; this file only shows it. The window keeps the filters and the ticks, so Back
 * keeps everything typed in New schedule and opening the finder again keeps its filters; while a filter recomputes, the
 * list shows the one loading line (/ux 6). Computer-only, like New schedule (absent at phone width by ruling, §5.9).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Check, Plus, X } from 'lucide-react';
import ck from '../ClubKit.module.css';
import { jsonInit, moneyFetch } from '../money/MoneyKit';
import { CheckChoice } from '@/components/admin/tournament/ScreenParts';
import LoadingState from '@/components/shared/LoadingState';
import DateInput from '@/components/shared/DateInput';
import TimeInput from '@/components/shared/TimeInput';
import { joinWithAnd } from '@/lib/utils';
import { addCalendarMonths, formatShortWeekdayDate, formatStoredDate, isCalendarDate } from '@/lib/timezone';
import { WEEKDAY_OPTIONS, weekdayCount, weekdaysWords } from '@/lib/permit-words';
import { weekdayOf } from '@/lib/permit-time';
import { newKey } from '@/lib/club-schedule-form';
import { SCHEDULE_SCREEN_WORDS as W } from '@/lib/club-schedule-words';
import { FACILITY_TYPE_LABELS, type FacilityType } from '@/lib/types';
import type { FreeRow, FreeTime } from '@/lib/permit-free-time';
import { sectionsOf, tickLabel, type FieldSections } from '@/lib/field-parts';
import { partRowKey } from '@/lib/club-schedule-view';
import sch from './Schedules.module.css';

/** The finder's filters as the form holds them: hours as rows of From and Until (blank = any time). */
export interface FindFilters {
  from: string;
  to: string;
  weekdays: number[];
  hours: { key: string; start: string; end: string }[];
  kinds: string[];
  venueIds: string[];
  issuers: string[];
  minMinutes: number;
}

/** Today → three months on, every day, any time, every kind and place, an hour at least (plan §4d). */
export const findFiltersFrom = (today: string): FindFilters => ({
  from: today, to: addCalendarMonths(today, 3), weekdays: [], hours: [{ key: newKey('hrs'), start: '', end: '' }],
  kinds: [], venueIds: [], issuers: [], minMinutes: 60,
});

/** A row's key: its place, and its part of a split field (Session 2D; a whole place's key is unchanged). */
export const findRowKey = (r: Pick<FreeRow, 'venueId' | 'unit' | 'sectionMask'>) => partRowKey(r.venueId, r.unit, r.sectionMask);

/** The time the form already holds, sent so the finder never offers it again. */
interface FindOwnTime { startsOn: string; endsOn: string; blocks: readonly object[]; datesOff: readonly object[] }

const SHORTEST = [30, 45, 60, 90, 120, 180, 240];

/** The filters as the route reads them: only whole ranges of hours. */
function bodyOf(f: FindFilters, own: FindOwnTime | null, scheduleId: string | null) {
  const hours = f.hours.filter(h => h.start && h.end && h.end > h.start).map(h => ({ start: h.start, end: h.end }));
  return {
    from: f.from, to: f.to, weekdays: f.weekdays, hours, kinds: f.kinds, venueIds: f.venueIds, issuers: f.issuers, minMinutes: f.minMinutes, own,
    // Add time (Session E): the schedule asking, so its own slots are taken too (drawing tab 3, "This schedule’s own
    // practices are taken").
    ...(scheduleId ? { scheduleId } : {}),
  };
}

/** The finder's reading, asked again a moment after the filters stop changing; the last answer stays while it does. */
export function useFreeTime(q: string, filters: FindFilters | null, own: FindOwnTime | null, scheduleId: string | null = null) {
  const [data, setData] = useState<FreeTime | null>(null);
  /** The question the last answer (or refusal) was to: loading is "the filters have moved on since". */
  const [answered, setAnswered] = useState<{ key: string; ok: boolean; error?: string } | null>(null);
  // The question as text, so the effect depends on what is asked and not on a new object each render.
  const key = filters && isCalendarDate(filters.from) && isCalendarDate(filters.to) && filters.to >= filters.from
    ? JSON.stringify(bodyOf(filters, own, scheduleId)) : null;
  useEffect(() => {
    if (!key) return;
    let live = true;
    const t = setTimeout(() => {
      // org-slug-ok: `q` is the host page's "orgSlug=…" query
      moneyFetch<FreeTime>(`/api/admin/schedules/free-time?${q}`, jsonInit('POST', JSON.parse(key)))
        .then(r => {
          if (!live) return;
          if (r.ok) setData(r.data);
          // A refusal the route worded for the person (a 400) is said as it came; anything else is the generic "didn't load".
          const said = (r.data as { error?: unknown } | null)?.error;
          setAnswered({ key, ok: r.ok, error: !r.ok && r.status === 400 && typeof said === 'string' ? said : undefined });
        })
        .catch(() => { if (live) setAnswered({ key, ok: false }); });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [q, key]);
  const failed = !!answered && !answered.ok && answered.key === key;
  return {
    data, failed, failedWords: failed ? answered?.error : undefined,
    loading: !!key && answered?.key !== key,
    /** Both dates make a question. Without them the list on screen is an old answer, not this one. */
    asking: !!key,
    /** The list on screen answers the filters on screen — only then can a row be picked (a failed or unasked list is old). */
    current: !!key && answered?.key === key && answered.ok,
  };
}

interface Place { venueId: string; venueName: string; facilities: { id: string; name: string; sections?: FieldSections }[] }
interface Permit { id: string; name: string; issuer: string | null }

/** "Thu, Apr 8" days said short: the first three, then how many more. */
const daysSaid = (days: readonly string[]) => {
  const said = days.map(d => formatShortWeekdayDate(d));
  return said.length > 3 ? `${said.slice(0, 3).join(', ')} and ${said.length - 3} more` : joinWithAnd(said);
};

/** "4 Thursdays" when the days are one weekday, else "4 days" — a found row's draft-held days (P7b A). */
export function draftDaysSaid(days: readonly string[]): string {
  const wd = new Set(days.map(weekdayOf));
  return wd.size === 1 ? weekdayCount(days.length, [...wd][0]) : `${days.length} days`;
}

export default function FindTheTime({ filters, onFilters, read, ticked, onTick, pricedBy, onPricedBy, places, permitById, orgSlug }: {
  filters: FindFilters;
  onFilters: (next: FindFilters) => void;
  read: ReturnType<typeof useFreeTime>;
  ticked: ReadonlySet<string>;
  onTick: (key: string, on: boolean) => void;
  /** The permit chosen to price each row's shared days (P4 A); absent = the row's own default (the newer). */
  pricedBy: Readonly<Record<string, string>>;
  onPricedBy: (key: string, permitId: string) => void;
  places: readonly Place[];
  permitById: ReadonlyMap<string, Permit>;
  orgSlug: string;
}) {
  const { data, loading, failed, failedWords, asking } = read;
  const countId = useId();
  const set = (patch: Partial<FindFilters>) => onFilters({ ...filters, ...patch });
  const toggle = (list: readonly (string | number)[], v: string | number) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  const venueName = (id: string) => places.find(p => p.venueId === id)?.venueName ?? '';
  /** The row's place: the venue, the facility, or a split field in New schedule's tick-list words — "Field 1 (whole)",
   *  "Field 1, side B" (2D design check F5). The row it brings keeps its box words ("Field 1 side B"). */
  const facilityName = (venueId: string, unit: string | null, mask?: number) => {
    if (!unit) return venueName(venueId);
    const f = places.find(p => p.venueId === venueId)?.facilities.find(x => x.id === unit);
    return f ? tickLabel(f.name, mask, sectionsOf(f.sections)) : '';
  };
  const md = (d: string) => formatStoredDate(d, { withYear: false });

  const chips = <T extends string | number>(options: readonly { id: T; label: string }[], on: readonly T[], pick: (v: T) => void, label: string) => (
    <div className={sch.chips} role="group" aria-label={label}>
      {options.map(o => {
        const pressed = on.includes(o.id);
        return (
          <button key={String(o.id)} type="button" className={sch.chip} aria-pressed={pressed} onClick={() => pick(o.id)}>
            {pressed && <Check size={13} aria-hidden />}{o.label}
          </button>
        );
      })}
    </div>
  );

  const hourRows = filters.hours.map((h, i) => (
    <div key={h.key} className={sch.findHours}>
      <label className={ck.field} htmlFor={`ft-hs-${i}`}>
        <span className={ck.label}>{W.from}</span>
        <TimeInput id={`ft-hs-${i}`} step={900} className={ck.input} value={h.start} placeholder={W.findAnyTime}
          onChange={v => set({ hours: filters.hours.map(x => (x.key === h.key ? { ...x, start: v } : x)) })} />
      </label>
      <label className={ck.field} htmlFor={`ft-he-${i}`}>
        <span className={ck.label}>{W.until}</span>
        <TimeInput id={`ft-he-${i}`} step={900} className={ck.input} value={h.end} placeholder={W.findAnyTime}
          onChange={v => set({ hours: filters.hours.map(x => (x.key === h.key ? { ...x, end: v } : x)) })} />
      </label>
      {filters.hours.length > 1 && (
        <button type="button" className={sch.remove} aria-label={W.findRemoveTime(i + 1)} onClick={() => set({ hours: filters.hours.filter(x => x.key !== h.key) })}>
          <X size={15} aria-hidden />
        </button>
      )}
    </div>
  ));

  const kinds = (data?.kinds ?? []).map(k => ({ id: k, label: FACILITY_TYPE_LABELS[k as FacilityType] ?? k }));
  const venues = (data?.venueIds ?? []).map(id => ({ id, label: venueName(id) })).sort((a, b) => a.label.localeCompare(b.label));
  const towns = (data?.issuers ?? []).map(x => ({ id: x, label: x }));

  const filterBox = (
    <div className={sch.findFilters}>
      <label className={ck.field} htmlFor="ft-from">
        <span className={ck.label}>{W.from}</span>
        <DateInput id="ft-from" className={ck.input} value={filters.from} onChange={v => set({ from: v })} />
      </label>
      <label className={ck.field} htmlFor="ft-to">
        <span className={ck.label}>{W.to}</span>
        <DateInput id="ft-to" className={ck.input} value={filters.to} min={filters.from || undefined} rangeStart={filters.from || undefined} onChange={v => set({ to: v })} />
      </label>
      <label className={ck.field} htmlFor="ft-min">
        <span className={ck.label}>{W.findShortest}</span>
        <select id="ft-min" className={ck.select} value={filters.minMinutes} onChange={e => set({ minMinutes: Number(e.target.value) })} aria-describedby="ft-min-hint">
          {SHORTEST.map(n => <option key={n} value={n}>{W.minutes(n)}</option>)}
        </select>
        <span id="ft-min-hint" className={ck.hint}>{W.findShortestHint}</span>
      </label>
      <div className={`${ck.field} ${sch.findWide}`}>
        <span className={ck.label}>{W.days}</span>
        {chips(WEEKDAY_OPTIONS.map(o => ({ id: Number(o.id), label: o.label })), filters.weekdays, v => set({ weekdays: toggle(filters.weekdays, v) as number[] }), W.days)}
        {!filters.weekdays.length && <span className={ck.hint}>{W.findDaysHint}</span>}
      </div>
      <div className={sch.findWide}>
        {hourRows}
        <button type="button" className={sch.door} onClick={() => set({ hours: [...filters.hours, { key: newKey('hrs'), start: '', end: '' }] })}>
          <Plus size={14} aria-hidden />{W.findAnotherTime}
        </button>
      </div>
      {kinds.length > 1 && (
        <div className={`${ck.field} ${sch.findWide}`}>
          <span className={ck.label}>{W.findKind}</span>
          {chips(kinds, filters.kinds, v => set({ kinds: toggle(filters.kinds, v) as string[] }), W.findKind)}
        </div>
      )}
      {venues.length > 1 && (
        <div className={`${ck.field} ${sch.findWide}`}>
          <span className={ck.label}>{W.findWhere}</span>
          {chips(venues, filters.venueIds, v => set({ venueIds: toggle(filters.venueIds, v) as string[] }), W.findWhere)}
        </div>
      )}
      {towns.length > 1 && (
        <div className={`${ck.field} ${sch.findWide}`}>
          <span className={ck.label}>{W.findTown}</span>
          {chips(towns, filters.issuers, v => set({ issuers: toggle(filters.issuers, v) as string[] }), W.findTown)}
        </div>
      )}
    </div>
  );

  // ── The list ──
  let list: ReactNode;
  if (failed && !data) list = <p className={sch.findEmpty}>{failedWords ?? W.findFailed}</p>;
  else if (!data && !asking) list = <p className={sch.findEmpty}>{W.findNeedDates}</p>;
  else if (!data) list = <LoadingState inline label={W.findLoading} />;
  else if (!data.permitsInDates) {
    list = (
      <div className={sch.findEmpty}>
        <b>{W.findNoPermit(md(filters.from), md(filters.to))}</b>
        <span className={sch.findDoors}>
          <Link className={sch.door} href={`/${orgSlug}/admin/permits`}>{W.findAddPermit} ›</Link>
          <button type="button" className={sch.door} onClick={() => set({ to: addCalendarMonths(filters.to, 3) })}>{W.findWiden}</button>
        </span>
      </div>
    );
  } else if (!data.rows.length) {
    const byDays = filters.weekdays.length > 0 && !filters.weekdays.some(d => data.heldWeekdays.includes(d));
    list = (
      <div className={sch.findEmpty}>
        <b>{byDays ? W.findNoneDays(weekdaysWords(filters.weekdays), md(filters.from), md(filters.to)) : W.findNoneFilters(md(filters.from), md(filters.to))}</b>
        {byDays && data.heldWeekdays.length > 0 && <span>{W.findHeldDays(weekdaysWords(data.heldWeekdays))}</span>}
        <span className={sch.findDoors}>
          {byDays
            ? <button type="button" className={sch.door} onClick={() => set({ weekdays: [] })}>{W.findClearDays}</button>
            : <button type="button" className={sch.door} onClick={() => onFilters({ ...findFiltersFrom(filters.from), to: filters.to })}>{W.findClearFilters}</button>}
          <button type="button" className={sch.door} onClick={() => set({ to: addCalendarMonths(filters.to, 3) })}>{W.findWiden}</button>
        </span>
      </div>
    );
  } else {
    list = (
      <div className={sch.findList} aria-busy={loading}>
        {/* Facilities, not rows, and each piece of ground's hours once (2D design check F6): the reading's own totals. */}
        <p id={countId} className={sch.findCount}>{loading ? W.findLoading : W.findCount(data.places, data.freeMinutes)}</p>
        {/* The rows read as a table (2D design check P2): the header names the columns, each row's three parts are its
            cells. Kept a grid of divs so the tick box leads the first cell (TABLE_EXCEPTION_REGISTER K-33). */}
        <div role="table" aria-labelledby={countId}>
        <div role="row" className={`${sch.findRow} ${sch.findHead}`}>
          <span role="columnheader">{W.findHeadPlace}</span><span role="columnheader">{W.findHeadPermit}</span>
          <span role="columnheader" className={sch.findRight}>{W.findHeadFree}</span>
        </div>
        {data.rows.map(r => {
          const key = findRowKey(r);
          const names = r.permitIds.map(id => permitById.get(id)?.name ?? '').filter(Boolean);
          const issuers = [...new Set(r.permitIds.map(id => permitById.get(id)?.issuer).filter((x): x is string => !!x))];
          const stretches = r.patterns.map(p => W.findStretch(weekdaysWords(p.weekdays), p.startTime, p.endTime));
          const choosable = r.shared.length > 0 && r.permitIds.length > 1;
          const chosen = pricedBy[key] ?? r.pricedBy ?? '';
          const pickable = r.freeDays + r.draftDays > 0;
          return (
            <div key={key} role="row" className={sch.findRow}>
              <span role="cell">
                <CheckChoice checked={ticked.has(key)} disabled={!pickable} onChange={on => onTick(key, on)}
                  title={facilityName(r.venueId, r.unit, r.sectionMask)} caption={r.unit ? venueName(r.venueId) : undefined} />
              </span>
              <span role="cell" className={sch.findCell}>
                <b>{joinWithAnd(names)}</b>
                {issuers.length > 0 && <small>{joinWithAnd(issuers)}</small>}
                {choosable && (
                  <>
                    <small className={sch.amber}>{W.findShared(daysSaid(r.shared), r.shared.length > 1)}</small>
                    <select className={`${ck.select} ${sch.findPriced}`} aria-label={W.findPricedByLabel} value={chosen} onChange={e => onPricedBy(key, e.target.value)}>
                      {r.permitIds.map(id => <option key={id} value={id}>{W.findPricedBy(permitById.get(id)?.name ?? '')}</option>)}
                    </select>
                  </>
                )}
              </span>
              <span role="cell" className={`${sch.findCell} ${sch.findRight}`}>
                <b>{W.findFreeOf(r.freeDays, r.heldDays, r.evening)}</b>
                <small>{W.findPattern(stretches, r.freeMinutes)}</small>
                {r.draftDays > 0 && <small className={sch.amber}>{W.findDraftHeld(r.draftDays, r.draftBy)}</small>}
              </span>
            </div>
          );
        })}
        </div>
      </div>
    );
  }

  return (
    <div className={sch.finder}>
      {filterBox}
      {failed && data && <p className={sch.amber} role="alert">{failedWords ?? W.findFailed}</p>}
      {!asking && data && <p className={sch.amber}>{W.findNeedDates}</p>}
      {list}
    </div>
  );
}
