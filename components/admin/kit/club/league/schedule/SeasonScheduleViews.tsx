'use client';
/**
 * A HOUSE-LEAGUE SEASON'S SCHEDULE VIEWS (House League Stage 9d-2a step 3; ruling 9d2·12, frames b1–b3, drawings
 * TdXm5jmTEJ9qPvR3T5H9qU v4; words HOUSE_LEAGUE_STAGE9D2_11B_COPY.md "Stage 9d-2a"). Games and practices together, drawn from
 * the season's bookings (`lib/league-season-calendar.ts` — the club calendar's `CalendarBooking`, so no fourth calendar).
 * The page keeps the view, the cursor and the filters; these draw what they are handed.
 *
 *   Week   — not here: the club calendar's own `WeekView` (seven columns at a desk, the week's day frames stacked on a phone,
 *            C13). ⚖ The drawing's phone pager ("Previous day" / "Next day", one day at a time) is not built: C13 is "a week
 *            stacks its days, each one frame … a run of empty days folds into one quiet line", and its reason (the coach's
 *            and the club's phone weeks ran one grouping two ways) decides over a drawing (§11's own rule).
 *   List   — the SEASON (R1: a list is the surface's natural range — a team's season, the club's week; a division's is its
 *            season). ⚖ The product's row list (C5), not the drawing's When · What · Place table: no column there is
 *            compared down or totalled, which is C5's reason. A band per week ("Jun 14 – 20, 2027 · this week"), opening on
 *            this week with the earlier weeks folded behind "Show {n} earlier weeks" (C3); a row's lead its day and time
 *            ("Tue, Jun 15 · 6:00 p.m." — no day bands, C8); the now line "Today · Thu, Jun 17" before today's first row
 *            (C7); a night of one division's practices folded into one row that opens to each team's hour (9d2·12).
 *   Month  — a division's day holds a few bookings, so its Month NAMES them (R2's reason, the coach's Month): the coach's
 *            grid and its one cell chip (C6) — the whole clock first ("6:00 p.m.", the clock ruling has no dense-cell
 *            carve-out), up to three, then "+{n} more", which opens the day (in List; in Week on a phone — the page decides).
 *            A night of practices is one chip, "Practices · 5". A postponed game shows on the day it had, "· Postponed"; at
 *            and under 768 px it is the touch Month (dots; the whole day taps).
 *   Fold   — "Needs a new date" (9d2·10): the postponed games, and any game saved with no date, above every view with the
 *            amber count (the waiting-count ruling), collapsed. They are never in a week: a view must not draw them as on.
 *
 * ⚖ NOTHING HIDDEN (C9): a cancelled booking is struck in its place with its word, never a clash.
 */
import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ClubRow, ClubRowBand, ClubRowList, RepChip } from '../../RepKit';
import { ClashLine, StateChip } from '../../ClubCalendarViews';
import { CellChip, NowLine } from '@/components/coaches/ScheduleCalendarViews';
import cal from '../../ClubCalendar.module.css';
import coach from '@/app/[orgSlug]/coaches/coaches.module.css';
import sv from './SeasonSchedule.module.css';
import { WEEKDAY_HEADS, dayOfMonth, dayWords, monthCells, monthWords, weekRangeWords } from '@/lib/calendar-recipe';
import { mondayOfDay } from '@/lib/timezone';
import { clockOf, dayLong, timeWords, whereWords } from '@/lib/club-calendar-view';
import { facilityWords } from '@/lib/venue-clash-words';
import { pluralize } from '@/lib/utils';
import { SCHEDULE_PUBLIC_WORDS } from '@/lib/league-schedule-words';
import {
  SEASON_PUBLIC_WORDS, SEASON_SCHEDULE_WORDS as W, foldNights, nightPlaces, seasonWeeks, todayLineAt,
  type SeasonBooking, type SeasonListRow,
} from '@/lib/league-season-calendar';

type Open = (b: SeasonBooking) => void;

const edge = (b: { colour: string | null }) => ({ '--tc': b.colour ?? undefined }) as React.CSSProperties;

/** A night's span, as a booking's time reads ("6:00–9:00 p.m."). */
const nightTime = (n: { startMs: number; endMs: number }) => timeWords({ startMs: n.startMs, endMs: n.endMs, hasEnd: true, allDay: false });

/** "Maple Grove Park · Diamond 1, Diamond 2" — a night's places, one venue named once. */
function nightPlaceWords(night: { practices: readonly SeasonBooking[] }, sport: string | null): string {
  const byVenue = new Map<string, string[]>();
  for (const w of nightPlaces(night)) {
    const venue = w.venueName ?? w.text ?? '';
    const fac = w.venueName ? facilityWords(sport, w.facility) : '';
    byVenue.set(venue, [...(byVenue.get(venue) ?? []), ...(fac ? [fac] : [])]);
  }
  return [...byVenue].map(([venue, facs]) => (facs.length ? `${venue} · ${facs.join(', ')}` : venue)).filter(Boolean).join('; ');
}

/**
 * The trail of a row: a change still waiting to be sent ("Moved · not sent", 9d-2b f1), its result ("Final 7–4"), its
 * called-off word, or "Moved" on a game re-dated since families first heard it, until it is played (9d2·10).
 */
function Trail({ b }: { b: SeasonBooking }) {
  if (b.held) return <RepChip tone="warn">{b.held}</RepChip>;
  if (b.state) return <StateChip b={b} />;
  if (b.result) return <RepChip tone="neutral">{b.result}</RepChip>;
  if (b.source.kind === 'game' && b.source.game.status === 'scheduled' && b.source.game.movedFrom) {
    return <RepChip tone="neutral">{SCHEDULE_PUBLIC_WORDS.moved}</RepChip>;
  }
  return null;
}

/** One booking as a List row. `lead` is the caller's (a day and a time; a time alone inside a night). */
function BookingRow({ b, lead, onOpen }: { b: SeasonBooking; lead: string; onOpen: Open }) {
  const where = whereWords(b);
  return (
    <ClubRow
      as="button"
      onClick={() => onOpen(b)}
      aria-haspopup="dialog"
      muted={!!b.state}
      mark={<span className={cal.swatch} style={edge(b)} />}
      lead={<span className={cal.timeCell}>{lead}</span>}
      title={<span className={b.state ? cal.struck : undefined}>{b.who}</span>}
      caption={where || b.clash ? <>{where}<ClashLine b={b} size={13} /></> : undefined}
      trail={<Trail b={b} />}
      chevron
    />
  );
}

export function SeasonListView({ bookings, today, sport, teamName, onOpen }: {
  bookings: readonly SeasonBooking[];
  today: string;
  sport: string | null;
  teamName: ReadonlyMap<string, string>;
  onOpen: Open;
}) {
  const [showEarlier, setShowEarlier] = useState(false);
  const [openNights, setOpenNights] = useState<ReadonlySet<string>>(() => new Set());
  const items = foldNights(bookings).map(row => ({ day: row.kind === 'one' ? row.booking.day : row.day, row }));
  const { earlier, ahead } = seasonWeeks(items, today);
  const weeks = showEarlier ? [...earlier, ...ahead] : ahead;
  const thisMonday = ahead[0] && todayLineAt(ahead[0], today) != null ? ahead[0].monday : null;
  // This week empty: the now line sits between the weeks behind today and the next one (C7), or ends a finished season.
  const lineBeforeWeek = thisMonday ? null : (() => {
    const at = weeks.findIndex(w => w.monday > mondayOfDay(today));
    return at < 0 ? weeks.length : at;
  })();

  const toggleNight = (key: string) => setOpenNights(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const rowOf = (row: SeasonListRow) => {
    if (row.kind === 'one') {
      const b = row.booking;
      return <BookingRow key={b.key} b={b} lead={`${dayWords(b.day)} · ${timeWords(b)}`} onOpen={onOpen} />;
    }
    const open = openNights.has(row.key);
    const names = row.practices.map(p => teamName.get(p.teamId ?? '') ?? p.ownerName);
    return (
      <Fragment key={row.key}>
        <ClubRow
          as="button"
          onClick={() => toggleNight(row.key)}
          aria-expanded={open}
          mark={<span className={cal.swatch} style={edge(row.practices[0])} />}
          lead={<span className={cal.timeCell}>{`${dayWords(row.day)} · ${nightTime(row)}`}</span>}
          title={W.nightTitle(row.practices.length)}
          caption={<>{names.join(', ')}<span className={sv.nightPlace}>{nightPlaceWords(row, sport)}</span></>}
          trail={open ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
        />
        {/* Open: each team's hour, a row of its own that opens the practice's window (h2). */}
        {open && row.practices.map(p => <BookingRow key={p.key} b={p} lead={timeWords(p)} onOpen={onOpen} />)}
      </Fragment>
    );
  };

  return (
    <ClubRowList label="Schedule">
      {earlier.length > 0 && !showEarlier && (
        <ClubRow as="button" onClick={() => setShowEarlier(true)} aria-expanded={false}
          title={<span className={sv.earlier}>{W.earlierWeeks(earlier.length)}</span>} />
      )}
      {weeks.map((week, w) => {
        const line = todayLineAt(week, today);
        return (
          <Fragment key={week.monday}>
            {w === lineBeforeWeek && <NowLine today={today} />}
            <ClubRowBand id={`season-week-${week.monday}`} className={cal.jumpTarget}>
              {weekRangeWords(week.monday)}{week.monday === thisMonday ? ` · ${W.thisWeek}` : ''}
            </ClubRowBand>
            {week.bookings.map((item, i) => (
              <Fragment key={item.row.kind === 'one' ? item.row.booking.key : item.row.key}>
                {i === line && <NowLine today={today} />}
                {rowOf(item.row)}
              </Fragment>
            ))}
            {line === week.bookings.length && <NowLine today={today} />}
          </Fragment>
        );
      })}
      {lineBeforeWeek === weeks.length && weeks.length > 0 && <NowLine today={today} />}
    </ClubRowList>
  );
}

/** Up to three chips a desk cell (C6), then "+{n} more". */
const MONTH_CHIPS = 3;

export function SeasonMonthView({ cursor, bookings, today, onOpen, onDay }: {
  cursor: string;
  /** The month's bookings, the postponed ones with a date included (they show on the day they had). */
  bookings: readonly SeasonBooking[];
  today: string;
  onOpen: Open;
  /** "+{n} more", a night's chip, and the touch Month's day: open that day. */
  onDay: (day: string) => void;
}) {
  const byDay = new Map<string, SeasonBooking[]>();
  for (const b of bookings) byDay.set(b.day, [...(byDay.get(b.day) ?? []), b]);
  return (
    <div className={coach.calMonthGrid} role="grid" aria-label={monthWords(cursor)}>
      {WEEKDAY_HEADS.map(d => <div key={d} className={coach.calMonthHeader} role="columnheader">{d}</div>)}
      {monthCells(cursor).map((d, i) => {
        if (!d) return <div key={`pad-${i}`} className={`${coach.calMonthCell} ${coach.calMonthCellPad}`} aria-hidden />;
        const rows = foldNights(byDay.get(d) ?? []);
        const isToday = d === today;
        const on = (byDay.get(d) ?? []).filter(b => !b.state).length;
        return (
          <div key={d} role="gridcell" className={`${coach.calMonthCell}${isToday ? ` ${coach.calMonthCellToday}` : ''}`}>
            <span className={coach.calMonthDayNum}>{dayOfMonth(d)}{isToday ? ' · Today' : ''}</span>
            {/* The touch Month (≤768, C6): the whole day is the tap; shown there by the coach's stylesheet. */}
            <button type="button" className={coach.calMonthDayBtn} onClick={() => onDay(d)}
              aria-label={`${isToday ? 'Today, ' : ''}${dayLong(d)}${on ? `, ${pluralize(on, 'booking')}` : ''}`} />
            <span className={coach.calMonthDots} aria-hidden>
              {rows.slice(0, 4).map(r => {
                const b = r.kind === 'one' ? r.booking : r.practices[0];
                return <span key={r.kind === 'one' ? b.key : r.key}
                  className={`${coach.calMonthDot}${r.kind === 'one' && b.state ? ` ${coach.calMonthDotCancelled}` : ''}`} style={{ color: b.colour ?? undefined }} />;
              })}
            </span>
            <div className={coach.calMonthDayEvents}>
              {rows.slice(0, MONTH_CHIPS).map(r => {
                if (r.kind === 'night') {
                  const name = `Practices · ${r.practices.length}`;
                  return <CellChip key={r.key} as="button" onClick={() => onDay(d)} colour={r.practices[0].colour ?? ''}
                    time={clockOf(r.startMs)} name={name} title={`${clockOf(r.startMs)} ${name}`} />;
                }
                const b = r.booking;
                const name = `${b.who}${b.state === 'postponed' ? ' · Postponed' : ''}`;
                return <CellChip key={b.key} as="button" onClick={() => onOpen(b)} colour={b.colour ?? ''}
                  cancelled={b.state === 'cancelled'} time={clockOf(b.startMs)} name={name}
                  title={`${clockOf(b.startMs)} ${name}${b.state === 'cancelled' ? ' · Cancelled' : ''}`} />;
              })}
              {rows.length > MONTH_CHIPS && (
                <button type="button" className={coach.calMonthMoreDots} onClick={() => onDay(d)}>+{rows.length - MONTH_CHIPS} more</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * "NEEDS A NEW DATE" (9d2·10, b1/b3): the postponed games and any game saved with no date, above the views, collapsed, with
 * the amber count. Each row opens its game's window, which offers "Give it a new date".
 */
export function NeedsDateFold({ bookings, onOpen }: { bookings: readonly SeasonBooking[]; onOpen: Open }) {
  if (!bookings.length) return null;
  return (
    <details className={sv.fold}>
      <summary className={sv.foldHead}>
        <span className={sv.foldTitle}>{W.needsDate}</span>
        <span className={sv.foldCount} aria-label={pluralize(bookings.length, 'game')}>{bookings.length}</span>
      </summary>
      <ClubRowList label={W.needsDate}>
        {bookings.map(b => (
          <BookingRow key={b.key} b={b} onOpen={onOpen}
            lead={b.startMs ? SEASON_PUBLIC_WORDS.was(`${dayWords(b.day)} · ${timeWords(b)}`) : SEASON_PUBLIC_WORDS.dateToCome} />
        ))}
      </ClubRowList>
    </details>
  );
}
