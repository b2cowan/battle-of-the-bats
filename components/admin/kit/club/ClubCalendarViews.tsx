'use client';
/**
 * THE CLUB CALENDAR'S VIEWS (Club Tier Stage 6b, specimen 5 — hub K4MPu4ni53Ct7yrDcmWJd9 v64): Week, List, Month, the
 * phone's stacked week, and the read window. They draw what `lib/club-calendar-view.ts` decides and hold no state; the
 * page keeps the cursor, the view and the filters.
 *
 *   Week   — seven columns of booking cards: time, the program's word (house league, tournament), who, what · where.
 *            A clashing booking carries the amber mark; one that only MAY clash (a facility unset) is drawn dashed.
 *   List   — the kit's table, one row per booking, days as band rows; "Clashes with …" in words under the place (the
 *            row opens both sides — nothing in a cell to click); the name is the row's keyboard door; one chevron.
 *            On a phone, white cards with a corner chevron.
 *   Month  — a count per day and an amber mark where a day has a clash; a day opens its List.
 *   Phone  — the portal's stacked week: a run of empty days folds into one quiet line (`groupWeekDays`).
 *   Window — the booking, read-only (D3: no pencil): When, Where (address under it), the team and its head coach (or the
 *            season, or the tournament), then "Clashes with" as ONE white block with an amber edge — the other side, its
 *            facility, its head coach. The foot's door, in olive text: the team's schedule, or the Coaches Portal for
 *            someone who coaches that team; a house-league booking its season's schedule; a tournament the tournament.
 *            ⚠ No "Done" (a departure from the drawing, said at build time): a record window's × — a phone's ← — closes
 *            it; the 2026-10-09 rulings took Close / Done out of record windows (the team's bill, Payees).
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import KitDialog from './KitDialog';
import { repKit } from './RepKit';
import { useTournament } from '@/lib/tournament-context';
import { groupWeekDays, weekEmptyLine } from '@/lib/coach-schedule-phone';
import { formatInOrgZone, tournamentToday } from '@/lib/timezone';
import { pluralize } from '@/lib/utils';
import {
  CALENDAR_WORDS as W, KIND_EYEBROW, PROGRAM_TAG, byDay, clashLineWords, clashPairCount, clockOf, dayLong, dayShort,
  monthCells, otherTimeWords, timeWords, weekDays, weekdayShort, whereWords,
  type CalendarBooking,
} from '@/lib/club-calendar-view';
import cal from './ClubCalendar.module.css';

type Open = (b: CalendarBooking) => void;

const edge = (b: CalendarBooking) => ({ '--tc': b.colour ?? undefined }) as React.CSSProperties;

/** One booking in a Week column. */
function BookingCard({ b, onOpen }: { b: CalendarBooking; onOpen: Open }) {
  const tag = PROGRAM_TAG[b.program];
  const cls = `${cal.card}${b.clash === 'booked_by' ? ` ${cal.cardClash}` : b.clash === 'busy_then' ? ` ${cal.cardBusy}` : ''}`;
  return (
    <button type="button" className={cls} style={edge(b)} onClick={() => onOpen(b)} aria-haspopup="dialog"
      aria-label={`${b.who}, ${b.what}, ${timeWords(b)}${b.clash === 'booked_by' ? ', clashes' : b.clash === 'busy_then' ? ', may clash' : ''}`}>
      {b.clash === 'booked_by' && <AlertTriangle size={14} className={cal.flag} aria-hidden />}
      <span className={cal.cardTime}>{b.allDay ? 'All day' : b.program === 'tournament' ? timeWords(b) : clockOf(b.startMs)}</span>
      {tag && <span className={cal.cardTag}>{tag}</span>}
      <span className={cal.cardWho}>{b.who}</span>
      <span className={cal.cardWhere}>{[b.what, whereWords(b)].filter(Boolean).join(' · ')}</span>
    </button>
  );
}

/** One booking as a phone card: time, who · what, where, its clash in words, a corner chevron. */
function PhoneCard({ b, onOpen }: { b: CalendarBooking; onOpen: Open }) {
  const line = clashLineWords(b);
  return (
    <button type="button" className={cal.pcard} style={edge(b)} onClick={() => onOpen(b)} aria-haspopup="dialog">
      <span className={cal.cardTime}>{timeWords(b)}</span>
      {PROGRAM_TAG[b.program] && <span className={cal.cardTag}>{PROGRAM_TAG[b.program]}</span>}
      <span className={cal.pcardWho}>{b.who} · {b.what}</span>
      {whereWords(b) && <span className={cal.pcardWhere}>{whereWords(b)}</span>}
      {line && (
        <span className={`${cal.clashLine}${b.clash === 'busy_then' ? ` ${cal.busyLine}` : ''}`}>
          <AlertTriangle size={14} aria-hidden />{line}
        </span>
      )}
      <ChevronRight size={16} className={cal.pcardChevron} aria-hidden />
    </button>
  );
}

export function WeekView({ cursor, bookings, onOpen }: { cursor: string; bookings: readonly CalendarBooking[]; onOpen: Open }) {
  const days = weekDays(cursor);
  const map = byDay(bookings);
  const today = tournamentToday();
  const groups = groupWeekDays(days.map(d => ({ key: d, label: dayShort(d), hasEvents: (map.get(d) ?? []).length > 0 })));
  return (
    <>
      <div className={`${cal.week} ${cal.deskOnly}`}>
        {days.map(d => (
          <section key={d} className={`${cal.day}${d === today ? ` ${cal.dayToday}` : ''}`} aria-label={dayLong(d)}>
            <div className={cal.dayHead}><span className={cal.dayName}>{weekdayShort(d)}</span><span className={cal.dayNum}>{Number(d.slice(8))}</span></div>
            <div className={cal.dayBody}>
              {(map.get(d) ?? []).length === 0
                ? <span className={cal.dayEmpty}>—</span>
                : map.get(d)!.map(b => <BookingCard key={b.key} b={b} onOpen={onOpen} />)}
            </div>
          </section>
        ))}
      </div>
      <div className={cal.stack}>
        {groups.map(g => g.kind === 'day' ? (
          <section key={g.key} aria-label={dayLong(g.key)}>
            <h3 className={cal.stackDay}>{dayShort(g.key)}</h3>
            <div className={cal.stackCards}>{map.get(g.key)!.map(b => <PhoneCard key={b.key} b={b} onOpen={onOpen} />)}</div>
          </section>
        ) : <p key={g.from} className={cal.stackQuiet}>{weekEmptyLine(g.label)}</p>)}
      </div>
    </>
  );
}

export function ListView({ bookings, onOpen }: { bookings: readonly CalendarBooking[]; onOpen: Open }) {
  const map = byDay(bookings);
  return (
    <>
      <div className={`${repKit.tableFrame} ${cal.deskOnly}`}>
        <table className={repKit.table}>
          <thead>
            <tr>
              <th scope="col" style={{ width: '10rem' }}>Time</th>
              <th scope="col">Who</th>
              <th scope="col">What</th>
              <th scope="col">Where</th>
              <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
            </tr>
          </thead>
          <tbody>
            {[...map].flatMap(([day, list]) => [
              <tr key={`band-${day}`} id={`cal-band-${day}`} className={repKit.band}><td colSpan={5}>{dayLong(day)}</td></tr>,
              ...list.map(b => {
                const line = clashLineWords(b);
                return (
                  <tr key={b.key} className={repKit.rowOpens} onClick={() => { if (window.getSelection()?.toString()) return; onOpen(b); }}>
                    <td className={cal.timeCell}>{timeWords(b)}</td>
                    <td>
                      {PROGRAM_TAG[b.program] && <span className={cal.whoTag}>{PROGRAM_TAG[b.program]}</span>}
                      <span className={cal.swatch} style={edge(b)} aria-hidden />
                      <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} onClick={e => { e.stopPropagation(); onOpen(b); }}>{b.who}</button>
                    </td>
                    <td>{b.what}</td>
                    <td>
                      {whereWords(b)}
                      {line && (
                        <span className={`${cal.clashLine}${b.clash === 'busy_then' ? ` ${cal.busyLine}` : ''}`}>
                          <AlertTriangle size={13} aria-hidden />{line}
                        </span>
                      )}
                    </td>
                    <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                  </tr>
                );
              }),
            ])}
          </tbody>
        </table>
      </div>
      <div className={cal.stack}>
        {[...map].map(([day, list]) => (
          <section key={day} id={`cal-day-${day}`} aria-label={dayLong(day)}>
            <h3 className={cal.stackDay}>{dayShort(day)}</h3>
            <div className={cal.stackCards}>{list.map(b => <PhoneCard key={b.key} b={b} onOpen={onOpen} />)}</div>
          </section>
        ))}
      </div>
    </>
  );
}

export function MonthView({ cursor, bookings, onDay }: { cursor: string; bookings: readonly CalendarBooking[]; onDay: (day: string) => void }) {
  const map = byDay(bookings);
  const today = tournamentToday();
  return (
    <div className={cal.month} role="grid" aria-label={formatInOrgZone(`${cursor.slice(0, 7)}-15T12:00:00Z`, { month: 'long', year: 'numeric' })}>
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className={cal.monthHead} role="columnheader">{d}</div>)}
      {monthCells(cursor).map((d, i) => {
        if (!d) return <div key={`pad-${i}`} className={cal.monthPad} aria-hidden />;
        const list = map.get(d) ?? [];
        const clashes = clashPairCount(list);
        return (
          <button key={d} type="button" className={`${cal.monthCell}${d === today ? ` ${cal.monthToday}` : ''}`} role="gridcell"
            onClick={() => onDay(d)} aria-label={`${dayLong(d)}${list.length ? `, ${pluralize(list.length, 'booking')}` : ''}${clashes ? `, ${W.clashes(clashes)}` : ''}`}>
            <span className={cal.monthNum}>{Number(d.slice(8))}</span>
            {list.length > 0 && (
              <span className={cal.monthCount} aria-hidden>
                <span className={cal.wide}>{pluralize(list.length, 'booking')}</span><span className={cal.narrow}>{list.length}</span>
              </span>
            )}
            {clashes > 0 && (
              <span className={cal.monthClash} aria-hidden>
                <AlertTriangle size={12} />
                <span className={cal.wide}>{W.clashes(clashes)}</span><span className={cal.narrow}>{clashes}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The booking's own name as a window title: "13U AAA practice", "13U AAA vs Northside Thunder", "Reds vs Blues". */
function windowTitle(b: CalendarBooking): string {
  if (b.program !== 'rep') return b.who;
  if (b.kind === 'practice') return `${b.who} practice`;
  if (b.kind === 'tryout') return `${b.who} tryout`;
  return `${b.who} ${b.what}`;
}

function eyebrowOf(b: CalendarBooking): string {
  if (b.program === 'league') return `House league · ${KIND_EYEBROW[b.kind]}`;
  return KIND_EYEBROW[b.kind];
}

export function BookingWindow({ b, onClose }: { b: CalendarBooking; onClose: () => void }) {
  const router = useRouter();
  const { tournaments, setCurrentTournament } = useTournament();
  const when = `${formatInOrgZone(`${b.day}T12:00:00Z`, { weekday: 'short', month: 'short', day: 'numeric' })} · ${timeWords(b)}`;
  const where = whereWords(b);
  const exact = b.clashesWith.filter(o => o.clash === 'booked_by');
  const busy = b.clashesWith.filter(o => o.clash === 'busy_then');
  const door = b.door;
  const doorNode = !door ? undefined : door.tournamentId ? (
    <button type="button" className={cal.door} onClick={() => {
      // A tournament opens as the admin's current tournament — set it, then go, with the window still open (the kit's
      // rule for a button that navigates out of a window).
      const t = tournaments.find(x => x.id === door.tournamentId);
      if (t) setCurrentTournament(t);
      router.push(door.href);
    }}>{door.label}</button>
  ) : <Link href={door.href} className={cal.door}>{door.label}</Link>;
  const pairBlock = (head: string, list: typeof b.clashesWith) => list.length > 0 && (
    <div className={cal.pair}>
      <p className={cal.pairHead}>{head}</p>
      {list.map(o => (
        <div key={o.key} className={cal.pairItem}>
          {[o.label, otherTimeWords(o), o.where].filter(Boolean).join(' · ')}
          {o.contact && <span className={cal.pairContact}>{o.contact}</span>}
        </div>
      ))}
    </div>
  );
  return (
    <KitDialog kind="form" eyebrow={eyebrowOf(b)} title={windowTitle(b)} onClose={onClose} footerStart={doorNode}>
      <dl className={cal.read}>
        <dt>When</dt><dd>{when}</dd>
        <dt>Where</dt>
        <dd>{where || <span className={repKit.dim}>Not set</span>}{b.where.address && <small>{b.where.address}</small>}</dd>
        {b.program === 'rep' && <><dt>Team</dt><dd>{b.ownerName}{b.headCoach && <small>{b.headCoach}</small>}</dd></>}
        {b.program === 'league' && <><dt>Season</dt><dd>{b.ownerName}{b.what && <small>{b.what}</small>}</dd></>}
        {b.program === 'tournament' && <><dt>Tournament</dt><dd>{b.ownerName}<small>{b.what}</small></dd></>}
      </dl>
      {pairBlock(W.clashesWithHeading, exact)}
      {pairBlock(W.mayClashHeading, busy)}
    </KitDialog>
  );
}
