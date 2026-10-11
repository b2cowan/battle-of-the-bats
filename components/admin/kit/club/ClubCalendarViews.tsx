'use client';
/**
 * THE CLUB CALENDAR'S VIEWS (Club Tier Stage 6b, specimen 5 — hub K4MPu4ni53Ct7yrDcmWJd9 v64; redrawn to the calendar
 * recipe by Stage 6c, v78 — table standard §11): Week, List, Month, the phone's stacked week, and the read window. They
 * draw what `lib/club-calendar-view.ts` decides and hold no state; the page keeps the cursor, the view and the filters.
 *
 *   Week   — seven columns of booking chips: the RANGE ("5:30–7:30 p.m." — on a club-wide page the question is overlap,
 *            so the end matters, R9), who and what, where. A clashing booking carries the amber mark; one that only MAY
 *            clash (a facility unset) is drawn dashed. Each column headed "Tue, Oct 20"; today's "Today · Sat, Oct 10" (C7).
 *   List   — THE ROW LIST (6c Ask 5 — the admin kit's `ClubRow`, the portal's row in the admin kit, which the tournament's
 *            Day already wears; A41 answered): a band per day ("Tue, Oct 20", "Today · Sat, Oct 10"), no count on a band
 *            (the amber pill counts the week's clashes and each row says its own); a row's lead the time range, its one
 *            lead mark the team's swatch, its title "14U AA · Practice" / "Reds vs Blues", its caption where (with the
 *            program's word where more than one program shows), 6a's clash line under the place, the chevron, the whole
 *            row opening the read window. It replaced a table whose columns answered no column question. A computer's
 *            alone: on a phone it would be Week's stack again, so the page draws Week there (owner 2026-10-09, §288 W4).
 *   Month  — a count per day and an amber mark where a day has a clash (R2 — a club's day can hold twenty bookings); a day
 *            opens its List (its Week on a phone). A called-off booking is not in the count.
 *   Phone  — the coach's stack (C13): one frame per day with its heading inside, bookings as hairlined rows with the
 *            team's colour rail, the clash line, the chevron; a run of empty days is one dashed line; an empty TODAY is
 *            never folded into it. Each day with bookings carries `cal-day-<date>`, where Month's day scrolls to.
 *   Window — the booking, read-only (D3: no pencil): When, Where (address under it), the state when it is called off, the
 *            team and its head coach (or the season, or the tournament), then "Clashes with" as ONE white block with an
 *            amber edge. The foot's door, in olive text. ⚠ No "Done": a record window's × — a phone's ← — closes it (the
 *            2026-10-09 rulings took Close / Done out of record windows).
 *
 * ⚖ NOTHING HIDDEN (6c Ask 9, C9): a cancelled booking and a postponed league game are drawn struck through and dimmed,
 * with their word ("Cancelled"; "Postponed" in amber); never flagged as a clash.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import KitDialog from './KitDialog';
import { ClubRow, ClubRowBand, ClubRowList, RepChip, repKit } from './RepKit';
import { useTournament } from '@/lib/tournament-context';
import { WEEK_EMPTY_SUFFIX, groupWeekDays } from '@/lib/coach-schedule-phone';
import { tournamentToday } from '@/lib/timezone';
import { STATE_WORDS, WEEKDAY_HEADS, dayHeading, dayOfMonth, dayWords, monthCells, monthWords, weekDays } from '@/lib/calendar-recipe';
import { pluralize } from '@/lib/utils';
import {
  CALENDAR_WORDS as W, KIND_EYEBROW, PROGRAM_TAG, byDay, clashLineWords, clashPairCount, dayLong,
  otherTimeWords, timeWords, whereWords,
  type CalendarBooking,
} from '@/lib/club-calendar-view';
import cal from './ClubCalendar.module.css';
import { WhereLine } from '@/components/venue/WhereField';
import { permitCalendarLine } from '@/lib/permit-words';

type Open = (b: CalendarBooking) => void;

const edge = (b: CalendarBooking) => ({ '--tc': b.colour ?? undefined }) as React.CSSProperties;

/** "14U AA · Practice" (a team's booking: who, then what) · "Reds vs Blues" · the tournament's name. */
export function bookingTitle(b: CalendarBooking): string {
  return b.program === 'rep' ? `${b.who} · ${b.what}` : b.who;
}

/**
 * A booking's caption — where it is, with "House league · U9 Rookie ·" (the program's word, then what a league or
 * tournament booking is) ahead of it on a page that shows more than one program (C5). A team's own booking needs no
 * word: its colour and its name say whose.
 */
export function bookingCaption(b: CalendarBooking, multiProgram: boolean): string {
  const tag = multiProgram ? PROGRAM_TAG[b.program] : null;
  const what = b.program === 'rep' ? null : b.what;
  return [tag, what, whereWords(b)].filter(Boolean).join(' · ');
}

/** The called-off word as the kit's chip — "Cancelled"; "Postponed" in amber (C9). */
function StateChip({ b }: { b: CalendarBooking }) {
  if (!b.state) return null;
  return <RepChip tone={b.state === 'postponed' ? 'warn' : 'neutral'}>{STATE_WORDS[b.state]}</RepChip>;
}

/** The clash in words, under the place: "Clashes with 13U AAA practice" / "Busy then: …". */
function ClashLine({ b, size }: { b: CalendarBooking; size: number }) {
  const line = clashLineWords(b);
  if (!line) return null;
  return (
    <span className={`${cal.clashLine}${b.clash === 'busy_then' ? ` ${cal.busyLine}` : ''}`}>
      <AlertTriangle size={size} aria-hidden />{line}
    </span>
  );
}

/** One booking in a Week column — the calendar recipe's one chip (C6): the range, who and what, where. */
function BookingCard({ b, onOpen, multiProgram }: { b: CalendarBooking; onOpen: Open; multiProgram: boolean }) {
  const cls = `${cal.card}${b.state ? ` ${cal.cardOff}` : b.clash === 'booked_by' ? ` ${cal.cardClash}` : b.clash === 'busy_then' ? ` ${cal.cardBusy}` : ''}`;
  const where = [multiProgram ? PROGRAM_TAG[b.program] : null, b.state ? STATE_WORDS[b.state] : whereWords(b)].filter(Boolean).join(' · ');
  return (
    <button type="button" className={cls} style={edge(b)} onClick={() => onOpen(b)} aria-haspopup="dialog"
      aria-label={`${bookingTitle(b)}, ${timeWords(b)}${b.state ? `, ${STATE_WORDS[b.state]}` : b.clash === 'booked_by' ? ', clashes' : b.clash === 'busy_then' ? ', may clash' : ''}`}>
      {b.clash === 'booked_by' && !b.state && <AlertTriangle size={14} className={cal.flag} aria-hidden />}
      <span className={cal.cardTime}>{timeWords(b)}</span>
      <span className={cal.cardWho}>{bookingTitle(b)}</span>
      {where && <span className={cal.cardWhere}>{where}</span>}
    </button>
  );
}

/** One booking as a phone row inside its day's frame: the range, who and what, where, its clash in words, a chevron. */
function PhoneRow({ b, onOpen, multiProgram }: { b: CalendarBooking; onOpen: Open; multiProgram: boolean }) {
  const caption = bookingCaption(b, multiProgram);
  return (
    <button type="button" className={`${cal.prow}${b.state ? ` ${cal.prowOff}` : ''}`} style={edge(b)} onClick={() => onOpen(b)} aria-haspopup="dialog">
      <span className={cal.prowTime}>{timeWords(b)}<StateChip b={b} /></span>
      <span className={cal.prowWho}>{bookingTitle(b)}</span>
      {caption && <span className={cal.prowWhere}>{caption}</span>}
      <ClashLine b={b} size={14} />
      <ChevronRight size={16} className={cal.prowChevron} aria-hidden />
    </button>
  );
}

export function WeekView({ cursor, bookings, onOpen, multiProgram }: { cursor: string; bookings: readonly CalendarBooking[]; onOpen: Open; multiProgram: boolean }) {
  const days = weekDays(cursor);
  const map = byDay(bookings);
  const today = tournamentToday();
  const groups = groupWeekDays(days.map(d => ({ key: d, label: dayHeading(d, today), hasEvents: (map.get(d) ?? []).length > 0, today: d === today })));
  return (
    <>
      <div className={`${cal.week} ${cal.deskOnly}`}>
        {days.map(d => (
          <section key={d} className={`${cal.day}${d === today ? ` ${cal.dayToday}` : ''}`} aria-label={dayLong(d)}>
            {/* "Tue, Oct 20" in the display face, in capitals; today's says so in words (C7, C8). */}
            <div className={cal.dayHead}><span className={cal.dayName}>{dayHeading(d, today)}</span></div>
            <div className={cal.dayBody}>
              {(map.get(d) ?? []).length === 0
                ? <span className={cal.dayEmpty}>—</span>
                : map.get(d)!.map(b => <BookingCard key={b.key} b={b} onOpen={onOpen} multiProgram={multiProgram} />)}
            </div>
          </section>
        ))}
      </div>
      <div className={cal.stack}>
        {groups.map(g => g.kind === 'day' ? (
          <section key={g.key} id={`cal-day-${g.key}`} className={`${cal.pday} ${cal.jumpTarget}${g.key === today ? ` ${cal.pdayToday}` : ''}`} aria-label={dayLong(g.key)}>
            <h3 className={cal.pdayHead}>{dayHeading(g.key, today)}</h3>
            {map.get(g.key)!.map(b => <PhoneRow key={b.key} b={b} onOpen={onOpen} multiProgram={multiProgram} />)}
          </section>
        ) : g.today
          ? <p key={g.from} className={`${cal.pquiet} ${cal.pquietToday}`}><b>{g.label}</b> · {WEEK_EMPTY_SUFFIX}</p>
          : <p key={g.from} className={cal.pquiet}>{g.label} · {WEEK_EMPTY_SUFFIX}</p>)}
      </div>
    </>
  );
}

export function ListView({ bookings, onOpen, multiProgram }: { bookings: readonly CalendarBooking[]; onOpen: Open; multiProgram: boolean }) {
  const map = byDay(bookings);
  const today = tournamentToday();
  return (
    <ClubRowList label="Bookings">
      {[...map].flatMap(([day, list]) => [
        <ClubRowBand key={`band-${day}`} id={`cal-band-${day}`} className={cal.jumpTarget}>{dayHeading(day, today)}</ClubRowBand>,
        ...list.map(b => {
          const caption = bookingCaption(b, multiProgram);
          return (
          <ClubRow
            key={b.key}
            as="button"
            onClick={() => onOpen(b)}
            aria-haspopup="dialog"
            muted={!!b.state}
            mark={<span className={cal.swatch} style={edge(b)} />}
            lead={<span className={cal.timeCell}>{timeWords(b)}</span>}
            title={<span className={b.state ? cal.struck : undefined}>{bookingTitle(b)}</span>}
            caption={caption || b.clash ? <>{caption}<ClashLine b={b} size={13} /></> : undefined}
            trail={b.state ? <StateChip b={b} /> : undefined}
            chevron
          />
          );
        }),
      ])}
    </ClubRowList>
  );
}

export function MonthView({ cursor, bookings, onDay }: { cursor: string; bookings: readonly CalendarBooking[]; onDay: (day: string) => void }) {
  const map = byDay(bookings);
  const today = tournamentToday();
  return (
    <div className={cal.month} role="grid" aria-label={monthWords(cursor)}>
      {WEEKDAY_HEADS.map(d => <div key={d} className={cal.monthHead} role="columnheader">{d}</div>)}
      {monthCells(cursor).map((d, i) => {
        if (!d) return <div key={`pad-${i}`} className={cal.monthPad} aria-hidden />;
        // A called-off booking is shown on its day's List and Week, never in a count (C9).
        const list = (map.get(d) ?? []).filter(b => !b.state);
        const clashes = clashPairCount(list);
        return (
          <button key={d} type="button" className={`${cal.monthCell}${d === today ? ` ${cal.monthToday}` : ''}`} role="gridcell"
            onClick={() => onDay(d)} aria-label={`${d === today ? 'Today, ' : ''}${dayLong(d)}${list.length ? `, ${pluralize(list.length, 'booking')}` : ''}${clashes ? `, ${W.clashes(clashes)}` : ''}`}>
            <span className={cal.monthNum}>{dayOfMonth(d)}</span>
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
  const when = `${dayWords(b.day)} · ${timeWords(b)}`;
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
        {/* The state, said in the window too (C9): a called-off booking is never read as on. */}
        {b.state && <><dt>Status</dt><dd><StateChip b={b} /></dd></>}
        <dt>Where</dt>
        <dd>{where || <span className={repKit.dim}>Not set</span>}{b.where.address && <small>{b.where.address}</small>}</dd>
        {b.program === 'rep' && <><dt>Team</dt><dd>{b.ownerName}{b.headCoach && <small>{b.headCoach}</small>}</dd></>}
        {b.program === 'league' && <><dt>Season</dt><dd>{b.ownerName}{b.what && <small>{b.what}</small>}</dd></>}
        {b.program === 'tournament' && <><dt>Tournament</dt><dd>{b.ownerName}<small>{b.what}</small></dd></>}
      </dl>
      {pairBlock(W.clashesWithHeading, exact)}
      {pairBlock(W.mayClashHeading, busy)}
      {/* Once, here, never on the row (Club Tier 10a, Ask 3): the time is outside the club's permit there. Quiet. */}
      {b.permit && <WhereLine tone="quiet" mark="clock" rest={permitCalendarLine(b.permit, b.sport)} />}
    </KitDialog>
  );
}
