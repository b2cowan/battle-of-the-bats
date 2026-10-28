'use client';
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { HandBackAskedPill, MoneyAskedPill, notOnWord } from './ClubSlotParts';
import Link from 'next/link';
import { Calendar, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, Plus, TriangleAlert, Trophy } from 'lucide-react';
import { EVENT_ICONS, EVENT_COLORS } from '@/components/coaches/eventTypeMark';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { CoachRowList, CoachRowBand, CoachRow } from '@/components/coaches/CoachRowList';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { ViewSwitch } from '@/components/coaches/kit';
import { surfaceLabel } from '@/lib/sports';
import { opponentSuffix } from '@/lib/coach-tournament-games';
import type { CoachScheduleTournamentGame } from '@/lib/basic-coach-teams';
import { WEEK_EMPTY_SUFFIX, groupWeekDays, weekEmptyLine } from '@/lib/coach-schedule-phone';
import { SCRIMMAGE_LABEL } from '@/lib/coach-schedule-vocab';
import { SCHEDULE_COACH_WORDS } from '@/lib/club-schedule-words';
import { formatEventDateRange, formatInOrgZone, formatWeekdayDate, orgDayKey, tournamentToday } from '@/lib/timezone';
import {
  WEEKDAY_HEADS, dayHeading, dayOfMonth, dayWords, monthCells, monthWords, nowLineAt, weekDays, weekRangeWords,
  widestRangeWords,
} from '@/lib/calendar-recipe';
import { formatTryoutSessionTime, tryoutSessionDay } from '@/lib/tryout-session-label';
import {
  dayStr, daysBetween, eventOnDay, fmtTime, monthKey, resultColor, sortDayEvents, tournamentSpan,
} from '@/lib/coach-schedule-view';
import type { RepTeamEvent, RepTryoutSession } from '@/lib/types';
import { homeAwayWord } from '@/lib/game-clock-labels';

/**
 * THE SCHEDULE'S THREE CALENDAR VIEWS — List, Week and Month — and the three row kinds they draw
 * (a team event, a tournament's own game, a tryout session). Moved out of the schedule page,
 * unchanged, by the Schedule deep dive's split (stage 1 · S6, owner ruling 2026-09-25 — "split
 * first, a pure move"). The page keeps the data and the clock; these draw what they are handed and
 * hold no state of their own (Month's selected day and the cursor live on the page, which the
 * navigator above the views also moves).
 *
 * ⚖ CLUB TIER STAGE 6c (ruled 2026-10-10, table standard §11) — these views are the calendar recipe's benchmark, and
 * since 6c a team's schedule (admin) draws them too, read-only (every write absent):
 *   · C2  Monday first in every grid; every day key built from calendar parts (`lib/calendar-recipe`).
 *   · C6  ONE calendar-cell chip — the time on its first line, the title on its second, the kind's colour on its edge,
 *         the attendance ⚠ as its corner flag (`CellChip`). A desk Month shows up to three, then "+N more".
 *   · C7  today said in words wherever a day is headed ("Today · Sat, Oct 10"); a season list marks it with a NOW
 *         LINE between the last played row and the next, never a band.
 *   · C8  one spelling: "Sat, Oct 10" on a heading, "Tue, Oct 13 · 1:00 p.m." as a list row's lead, "October 2026".
 *   · C9  one word per state, written once and styled by the chip: "Cancelled", "Win" / "Loss" / "Tie".
 */

/** What every event row carries beyond the event itself — the page's per-event decorations. */
export interface ScheduleRowDecor {
  mismatchIds: Set<string>;
  awardCountByEventId: Record<string, number>;
  movedEventIds: Set<string>;
  bookRecordFor: (e: RepTeamEvent) => string | null;
  gameDayHrefById: Map<string, string>;
  openEvent: (e: RepTeamEvent) => void;
  /**
   * A CLUB practice's source (Club Tier 11a — specimen 11, Ask 16): the schedule it came from, said after the practice's
   * name ("Practice · From Winter dome 2026–27", the mirror's construction — never a bare "From the club", P11-03), and
   * whether this team handed its slot back (a struck-through row reading "Handed back", never hidden — C9). Absent: a
   * page that doesn't read club sources (an admin's read of a team).
   */
  clubSourceOf?: (e: RepTeamEvent) => { scheduleName: string; handedBack: boolean; ask?: { id: string } | null } | null;
}

/** The data all three views draw from. */
export interface ScheduleViewData {
  events: RepTeamEvent[];
  tryoutSessions: RepTryoutSession[];
  unmirroredGames: CoachScheduleTournamentGame[];
  /** The team's sport id — the tryout row's field word. */
  sport: string;
  /** Where a tryout row goes (the Tryouts tab); null where the reader has no door to it (a read-only row). */
  tryoutsHref: string | null;
  decor: ScheduleRowDecor;
}

/** The result words, one spelling each (C9); the chip's style sets them in capitals. */
const RESULT_WORD: Record<string, string> = { win: 'Win', loss: 'Loss', tie: 'Tie' };
export const resultWord = (result: string): string => RESULT_WORD[result] ?? result;

/** An inline style carrying a chip's edge colour (its kind's, C6 / R4). */
const edge = (colour: string): CSSProperties => ({ ['--chip-edge' as string]: colour });

/**
 * THE CALENDAR-CELL CHIP (C6, register K-21) — one shape for every booking inside a Week column, a desk Month cell
 * and the day sheet: the time line (with the state words at its end), the title line, the edge in the kind's colour,
 * the ⚠ in the corner. On a phone the same element is a hairlined row in its day's frame, with a chevron.
 */
const CHIP_VARIANT = { tryout: styles.calChipDashed, scrimmage: styles.calChipOutline, tournament: styles.calChipTournament };

export function CellChip({ as, href, onClick, colour, time, states, name, flag, title, cancelled, variant }: {
  as: 'button' | 'link' | 'static';
  href?: string;
  onClick?: () => void;
  colour: string;
  time: ReactNode;
  states?: ReactNode;
  name: ReactNode;
  flag?: ReactNode;
  title?: string;
  cancelled?: boolean;
  /** A tryout's dashed edge; a scrimmage outlined in the game's colour (a shape cue, D6); a tournament game's gold wash. */
  variant?: keyof typeof CHIP_VARIANT;
}) {
  const cls = [styles.calChip, cancelled && styles.calChipCancelled, variant && CHIP_VARIANT[variant]].filter(Boolean).join(' ');
  const inner = (
    <>
      <span className={styles.calChipTime}>
        <span className={styles.calChipClock}>{time}</span>
        {states ? <span className={styles.calChipStates}>{states}</span> : null}
      </span>
      <span className={styles.calChipName}>{name}</span>
      {flag}
      <ChevronRight size={16} className={styles.calChipChevron} aria-hidden />
    </>
  );
  if (as === 'link' && href) return <Link href={href} className={cls} style={edge(colour)} title={title}>{inner}</Link>;
  if (as === 'button') return <button type="button" className={cls} style={edge(colour)} title={title} onClick={onClick}>{inner}</button>;
  return <div className={`${cls} ${styles.calChipStatic}`} style={edge(colour)} title={title}>{inner}</div>;
}

// A tryout session projected onto the calendar — read-only, visually distinct from a game (dashed
// rail, clipboard, muted text), links to the Tryouts tab rather than opening the event editor.
//
// ⚠ THE DISTINCTNESS IS THE DASHED RAIL AND THE MUTED TEXT — NOT A DIFFERENT ROW SHAPE (owner, 2026-08-24). The
// list row carries its day like every row around it, and its clipboard sits in the lead-mark slot.
function TryoutChip({ session, sport, dayKey, href, listRow }: { session: RepTryoutSession; sport: string; dayKey?: string; href: string | null; listRow?: boolean }) {
  // ⚠ A session is a real moment now, read in the CLUB's zone like every event beside it — see
  // lib/tryout-session-label for why it used to be sliced, and why that was wrong.
  const time = formatTryoutSessionTime(session.startsAt);
  const day = tryoutSessionDay(session.startsAt);
  // A day-scoped view already carries the date in its heading; the flat list leads with the day (C8).
  const lead = dayKey ? time : [dayWords(day), time].filter(Boolean).join(' · ');
  const place = [session.label, session.location, surfaceLabel(sport, session.fieldNumber)].filter(Boolean).join(' · ');
  // The LIST view's face (standard §3.10, F-26): the clipboard is the one lead mark and the muted name carries the
  // distinctness the dashed rail carries in a cell.
  if (listRow) {
    const face = {
      'data-day': day,
      mark: <ClipboardList size={12} aria-hidden />,
      lead, leadKind: dayKey ? 'time' as const : 'date-time' as const,
      title: <span className={styles.eventChipOpp}>Tryout{place ? ` · ${place}` : ''}</span>,
      titleWeight: 'plain' as const,
    };
    return href
      ? <CoachRow as="link" href={href} tooltip="Tryout — opens your Tryouts tab" {...face} />
      : <CoachRow as="static" {...face} />;
  }
  return (
    <CellChip
      as={href ? 'link' : 'static'}
      href={href ?? undefined}
      title="Tryout — opens your Tryouts tab"
      colour="var(--home-line-strong)"
      variant="tryout"
      time={time}
      name={<span className={styles.eventChipOpp}>Tryout{place ? ` · ${place}` : ''}</span>}
    />
  );
}

// WI-2B: a REAL tournament game projected onto the calendar — read-only, gold accent, links to the
// public game page (never opens the event editor). Mirrors TryoutChip; games flow through none of the
// editor / attendance / lineup / save paths. `dayKey` present in day-scoped views (week/month) → show
// the time only; the flat list shows the date too.
function TournamentGameChip({ game, dayKey, listRow }: { game: CoachScheduleTournamentGame; dayKey?: string; listRow?: boolean }) {
  const lead = dayKey
    ? (game.timeLabel ?? (game.phase === 'live' ? 'Live' : 'TBD'))
    : [game.gameDate ? dayWords(game.gameDate) : null, game.timeLabel].filter(Boolean).join(' · ') || game.dateLabel;
  // The name and the trail (a live score, or the final score and result) are built ONCE so the
  // calendar cell's chip and the list view's row cannot drift apart — the same shape EventChip
  // takes below.
  const title = (
    <>{homeAwayWord(game.homeAway === 'home')} {game.opponentName}<span className={styles.eventChipOpp}> · </span><span className={styles.tournamentChipTag}>Tournament</span></>
  );
  const trail = game.phase === 'live' ? (
    <span className={styles.eventChipResult} style={{ color: 'var(--danger)' }}>
      <span className={styles.tournamentLiveDot} aria-hidden />{game.myScore ?? 0}–{game.oppScore ?? 0}
    </span>
  ) : game.phase === 'final' ? (
    <>
      <span className={styles.eventChipScore}>{game.myScore}–{game.oppScore}</span>
      {game.result && (
        <span className={styles.eventChipResult} style={{ color: resultColor(game.result) }}>{resultWord(game.result)}</span>
      )}
    </>
  ) : null;
  // The LIST view's face (§3.10, F-26); the chip is the calendar cell's (K-21).
  if (listRow) {
    const face = {
      mark: <Trophy size={12} style={{ color: 'var(--warning)' }} aria-hidden />,
      lead, leadKind: dayKey ? 'time' as const : 'date-time' as const,
      title, titleWeight: 'plain' as const,
      trail,
      'data-day': game.gameDate ?? undefined,
    };
    return game.href
      ? <CoachRow as="link" href={game.href} tooltip="Open the live game page" {...face} />
      : <CoachRow as="static" {...face} />;
  }
  return (
    <CellChip
      as={game.href ? 'link' : 'static'}
      href={game.href ?? undefined}
      title="Open the live game page"
      colour="var(--warning)"
      variant="tournament"
      time={lead}
      states={trail}
      name={title}
    />
  );
}

function EventChip({ event, onClick, dayKey, mismatch, awardCount, moved, bookRecord, gameDayHref, listRow, clubSource }: { event: RepTeamEvent; onClick: () => void; dayKey?: string; mismatch?: boolean; awardCount?: number; moved?: boolean; bookRecord?: string | null; gameDayHref?: string | null; listRow?: boolean; clubSource?: { scheduleName: string; handedBack: boolean; ask?: { id: string; late?: boolean } | null } | null }) {
  const color = EVENT_COLORS[event.eventType];
  const Icon = EVENT_ICONS[event.eventType];
  const cancelled = event.status === 'cancelled';
  /* A ROW THAT ISN'T HAPPENING (Club Tier Stage 11d part C, Ask 14 — hub C1b option B, ruled 2026-10-16): struck, with a
     filled QUIET pill — Handed back, or Cancelled — right after its title, every event kind, at every width (a phone
     already lays it beside the title). What WAITS keeps the row's end in amber (Hand-back asked, Money asked): what the
     row IS reads with its title, what waits reads at its end — an exception to 2026-10-12's one chip place, ruled with it.
     A calendar CELL has no room beside its title (C6: time, then title): there the strike stays and the same pill rides
     the time line, quiet. */
  const notOn = cancelled ? notOnWord(clubSource?.handedBack) : null;
  // Lead text (the slot that normally shows the start time). Tournaments are all-day and may
  // run multiple days, so they read as a date range (list view) or "Day n/N" (a specific
  // calendar day) instead of a misleading clock time.
  const span = tournamentSpan(event);
  let lead: string;
  if (span) {
    lead = dayKey
      ? (span.days > 1 ? `Day ${daysBetween(span.start, dayKey) + 1}/${span.days}` : 'All day')
      : (formatEventDateRange(span.start, span.end, false) ?? '');
  } else {
    // Day-scoped views (week/month/day-sheet) already carry the date as their heading, so show only
    // the time there. The flat LIST view has just a month band, so the lead says the day — with its
    // weekday ("Tue, Oct 13 · 1:00 p.m.", C8): a coach scanning a season asks "is that a Tuesday?"
    lead = event.startsAt
      ? (dayKey ? fmtTime(event.startsAt) : `${dayWords(dayStr(event.startsAt))} · ${fmtTime(event.startsAt)}`)
      : '';
  }
  // Opponent safety-net: games auto-name "vs Lady Jays" / "@ Lady Jays" (opponent already in the name),
  // so only append "vs/@ {opp}" when the opponent is set but NOT already in the name. One shared
  // rule (lib/coach-tournament-games) — the Attendance page names events the same way.
  const oppSuffix = opponentSuffix(event);
  // Final score (team-relative: your team first) for a played game.
  const hasScore = !span && event.teamScore != null && event.opponentScore != null;
  // The trail — STATE only (Moved, your record vs them, Scrimmage, Cancelled, the score). Built once so the calendar
  // cell's chip and the list view's row cannot drift apart. The lineup ⚠ is the list row's trail and the chip's corner.
  const states = (
    <>
      {/* Batch 4: the organizer rescheduled this since the coach last looked here. Their lineup
          and attendance came with it — this only exists so they know the time changed. */}
      {moved && !cancelled && (
        <span className={styles.eventChipMoved} title="The organizer moved this game">Moved</span>
      )}
      {/* Scouting book glance: your record vs this opponent, upcoming games only (the
          caller passes null once a score exists — the trail slot is the score's then). */}
      {bookRecord && !cancelled && (
        <span className={styles.scoutRecChip} data-tone="even" title={`Your record vs ${event.opponent}`}>{bookRecord}</span>
      )}
      {/* The WORD for a scrimmage, whenever the box is ticked — muted on purpose: it says "left out
          of the record", never a result, and the mark beside the row stays the game's own (D6). */}
      {event.isScrimmage && <span className={styles.scrimmageChip}>{SCRIMMAGE_LABEL}</span>}
      {/* Club Tier Stage 11d (specimen 2): the practice is in an ask for money back the club hasn't answered — the built
          amber waiting badge; families see the practice as usual. Part C: a LATE ask waits on a practice already handed
          back — the amber Money asked, at the row's end, beside the struck title's Handed back. */}
      {clubSource?.ask && !cancelled && <HandBackAskedPill />}
      {clubSource?.ask?.late && cancelled && <MoneyAskedPill />}
      {cancelled ? (
        // One spelling, styled as a chip (C9). The list row says it beside the title instead (Ask 14).
        !listRow && <span className={styles.eventChipCancelled}>{notOn}</span>
      ) : (
        <>
          {!!awardCount && (
            <span className={styles.eventChipResult} title={`${awardCount} award${awardCount === 1 ? '' : 's'} given`} style={{ color: 'var(--logic-lime)' }}>
              🏆 {awardCount}
            </span>
          )}
          {hasScore && <span className={styles.eventChipScore}>{event.teamScore}–{event.opponentScore}</span>}
          {!span && event.result && (
            <span className={`${styles.eventChipResult} ${styles.eventChipResultWord}`} style={{ color: resultColor(event.result) }}>
              {resultWord(event.result)}
            </span>
          )}
        </>
      )}
    </>
  );
  const mismatchMark = mismatch && !cancelled
    ? <TriangleAlert size={12} style={{ color: 'var(--warning)', flexShrink: 0 }} aria-label="Lineup and attendance don't match" />
    : null;
  const name = (
    <>
      {event.name}{oppSuffix && <span className={styles.eventChipOpp}>{oppSuffix}</span>}
      {clubSource && <span className={styles.eventChipOpp}> · {SCHEDULE_COACH_WORDS.sourceLead} {clubSource.scheduleName}</span>}
    </>
  );
  // The list row's title: the struck title, the quiet pill right after it (Ask 14), then where it came from, unstruck
  // (the drawing strikes "Practice" and keeps its source readable — /design D-1, 2026-10-16).
  const listTitle = notOn ? (
    <span className={styles.notOnTitle}>
      <span className={styles.notOnName}>{event.name}{oppSuffix && <span className={styles.eventChipOpp}>{oppSuffix}</span>}</span>
      <span className={styles.eventChipCancelled}>{notOn}</span>
      {clubSource && <span className={styles.eventChipOpp}>{SCHEDULE_COACH_WORDS.sourceLead} {clubSource.scheduleName}</span>}
    </span>
  ) : name;
  // The LIST view's face (standard §3.10, F-26 — owner-ruled 2026-09-16): one row in one frame,
  // the type icon as the one lead mark (the colour edge stays in the calendar cell, K-21), the
  // date-time as a date column, the name as a record read (400). The row is a real button that
  // opens the drawer; the Game day link sits BESIDE it in the same <li>, never inside it.
  if (listRow) {
    return (
      <CoachRow
        as="button"
        onClick={onClick}
        data-day={event.startsAt ? dayStr(event.startsAt) : undefined}
        // No whole-row fade (C1b: the fade was spent — the struck title is already the caption's grey); the strike and
        // the pill say it.
        mark={<Icon size={12} style={{ color }} aria-hidden />}
        lead={lead}
        leadKind={span ? 'text' : dayKey ? 'time' : 'date-time'}
        title={listTitle}
        titleWeight="plain"
        trail={<>{mismatchMark}{states}</>}
        beside={gameDayHref ? <Link href={gameDayHref} className={styles.gdEntryBtn}>Game day</Link> : undefined}
      />
    );
  }
  const chip = (
    <CellChip
      as="button"
      onClick={onClick}
      colour={color}
      cancelled={cancelled}
      variant={event.isScrimmage && !cancelled ? 'scrimmage' : undefined}
      time={lead}
      states={states}
      name={name}
      flag={mismatchMark ? <span className={styles.calChipFlag}>{mismatchMark}</span> : null}
    />
  );
  if (!gameDayHref) return chip;
  return (
    <div className={styles.eventChipRow}>
      {chip}
      <Link href={gameDayHref} className={styles.gdEntryBtn}>Game day</Link>
    </div>
  );
}

/** One event's row or chip, carrying the page's decorations — the one call every view makes. */
export function ScheduleEventChip({ event, decor, dayKey, listRow }: { event: RepTeamEvent; decor: ScheduleRowDecor; dayKey?: string; listRow?: boolean }) {
  return (
    <EventChip
      event={event}
      dayKey={dayKey}
      onClick={() => decor.openEvent(event)}
      mismatch={decor.mismatchIds.has(event.id)}
      awardCount={decor.awardCountByEventId[event.id]}
      moved={decor.movedEventIds.has(event.id)}
      bookRecord={decor.bookRecordFor(event)}
      gameDayHref={decor.gameDayHrefById.get(event.id) ?? null}
      listRow={listRow}
      clubSource={decor.clubSourceOf?.(event) ?? null}
    />
  );
}

/** A row's club-local clock as a sortable "18:30" — every kind sorts on the clock it DISPLAYS. */
const clock24 = (iso: string) => formatInOrgZone(iso, { hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * THE NOW LINE (C7, the design review 2026-10-10): where today falls in a season list — between the last played row
 * and the next, or above today's first row on a day with events. The timeline's now line, never a band: a band would
 * head the rows under it, and those aren't today's. The list opens with it at the top of its frame (C3).
 */
function NowLine({ today }: { today: string }) {
  return (
    <li className={styles.rowListNow} data-now-line role="presentation">
      <span>{dayHeading(today, today)}</span>
    </li>
  );
}

export function ScheduleListView({ data, canAddEvents, onAddEvent, onHelp, readOnlyEmptyText }: {
  data: ScheduleViewData;
  canAddEvents: boolean;
  /** The empty state's "Add Event" — opens the header's add menu. */
  onAddEvent: () => void;
  onHelp: () => void;
  /** A team's schedule (admin): no create, no coach help — the empty state is this one sentence. */
  readOnlyEmptyText?: string;
}) {
  const { events, tryoutSessions, unmirroredGames, sport, tryoutsHref, decor } = data;
  if (!events.length && !tryoutSessions.length && !unmirroredGames.length) {
    if (readOnlyEmptyText) return <p className={styles.calReadOnlyEmpty}>{readOnlyEmptyText}</p>;
    return (
      <CoachEmptyState
        icon={<Calendar size={22} aria-hidden />}
        eyebrow="Schedule"
        headline="No events scheduled yet"
        description="One calendar for games, practices, meetings and tournaments — with arrival times, field numbers and a tap-to-open map on each one."
        payoff="It's what the rest of the portal builds on: lineups attach to these games, attendance is taken from them, your Overview shows the next one, and families see the same dates you do."
        blocker={canAddEvents
          ? undefined
          : 'Adding events needs schedule access — ask your head coach to turn it on.'}
        primaryAction={canAddEvents ? {
          label: 'Add Event',
          icon: <Plus size={15} aria-hidden />,
          onClick: onAddEvent,
        } : undefined}
        secondaryAction={{
          label: 'How the schedule works',
          icon: <CircleHelp size={15} aria-hidden />,
          onClick: onHelp,
        }}
      />
    );
  }
  const grouped: Record<string, RepTeamEvent[]> = {};
  for (const e of events) {
    const mk = monthKey(e.startsAt);
    (grouped[mk] ??= []).push(e);
  }
  const tryByMonth: Record<string, RepTryoutSession[]> = {};
  for (const s of tryoutSessions) {
    const mk = tryoutSessionDay(s.startsAt).slice(0, 7); // the club's calendar month, like every event
    (tryByMonth[mk] ??= []).push(s);
  }
  // WI-2B: group the real tournament games by month too, so they list alongside self-entered
  // events. A game with no date yet (an unresolved bracket slot) has no month — collect those
  // separately so the list view still shows them (a trailing "To be scheduled" group) rather than
  // silently dropping them, matching the free-portal Schedule.
  const gamesByMonth: Record<string, CoachScheduleTournamentGame[]> = {};
  const tbdGames: CoachScheduleTournamentGame[] = [];
  for (const g of unmirroredGames) {
    const mk = (g.gameDate ?? '').slice(0, 7);
    if (mk) (gamesByMonth[mk] ??= []).push(g);
    else tbdGames.push(g);
  }
  const months = Array.from(
    new Set([...Object.keys(grouped), ...Object.keys(tryByMonth), ...Object.keys(gamesByMonth)]),
  ).sort((a, b) => a.localeCompare(b));

  // The list as one flat run — each month's band, then its rows in time order — so the now line can be set between
  // two rows wherever today falls, even across a month with nothing left in it.
  type Item = { kind: 'band'; month: string } | { kind: 'row'; day: string; at: string; node: ReactNode; key: string };
  const items: Item[] = [];
  for (const mk of months) {
    const trys = tryByMonth[mk] ?? [];
    const games = gamesByMonth[mk] ?? [];
    /**
     * ⚠ ONE CHRONOLOGICAL LIST, NOT THREE STACKED BLOCKS (owner, 2026-08-24). Sorted on the club-local day and
     * clock every row DISPLAYS, built as a comparable `YYYY-MM-DDTHH:mm`; undated rows sort last.
     */
    const row = (key: string, day: string, time: string, node: ReactNode) =>
      ({ kind: 'row' as const, key, day: day || '9999-12-31', at: `${day || '9999-12-31'}T${time || '99:99'}`, node });
    const rows = [
      ...(grouped[mk] ?? []).map(e => row(e.id, e.startsAt ? orgDayKey(e.startsAt) : '', e.startsAt ? clock24(e.startsAt) : '',
        <ScheduleEventChip key={e.id} event={e} decor={decor} listRow />)),
      ...games.map(g => row(`g-${g.id}`, g.gameDate ?? '', g.startsAt ? clock24(g.startsAt) : '',
        <TournamentGameChip key={`g-${g.id}`} game={g} listRow />)),
      ...trys.map(s => row(s.id, tryoutSessionDay(s.startsAt), clock24(s.startsAt),
        <TryoutChip key={s.id} session={s} sport={sport} href={tryoutsHref} listRow />)),
    ].sort((a, b) => a.at.localeCompare(b.at));
    items.push({ kind: 'band', month: mk }, ...rows);
  }
  // Where today falls (C7 — `nowLineAt`, unit-tested): before the first row on or after today, closing the earlier
  // month when that row opens a later one; after the last row when the season is behind today.
  const today = tournamentToday();
  const nowAt = nowLineAt(items, today);

  // The LIST view is a row list on the recipe (§3.10, F-26): one frame on the card, compact
  // rows with a hairline, months as bands. The week and month views keep their chips (K-21).
  // It scrolls in its own frame at every width and opens on the now line (C3; the page sets the position).
  return (
    <CoachRowList label="Schedule">
      {items.map((item, i) => (
        <Fragment key={item.kind === 'band' ? `m-${item.month}` : item.key}>
          {i === nowAt && <NowLine today={today} />}
          {item.kind === 'band' ? <CoachRowBand>{monthWords(item.month)}</CoachRowBand> : item.node}
        </Fragment>
      ))}
      {nowAt === items.length && <NowLine today={today} />}
      {tbdGames.length > 0 && (
        <>
          <CoachRowBand>To be scheduled</CoachRowBand>
          {tbdGames.map(g => (
            <TournamentGameChip key={`g-${g.id}`} game={g} listRow />
          ))}
        </>
      )}
    </CoachRowList>
  );
}

export function ScheduleWeekView({ data, curWeek }: { data: ScheduleViewData; curWeek: string }) {
  const { events, tryoutSessions, unmirroredGames, sport, tryoutsHref, decor } = data;
  const today = tournamentToday();
  // The seven days from calendar parts, Monday first (C2) — never a locally-built midnight read back through a clock.
  const cells = weekDays(curWeek).map(key => {
    const dayEvents = sortDayEvents(events.filter(e => eventOnDay(e, key)));
    const dayTryouts = tryoutSessions.filter(s => tryoutSessionDay(s.startsAt) === key);
    const dayGames = unmirroredGames
      .filter(g => g.gameDate === key)
      .sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
    return {
      key, dayEvents, dayTryouts, dayGames,
      hasEvents: dayEvents.length + dayTryouts.length + dayGames.length > 0,
      // The phone's quiet line names its days in the one spelling ("Mon, Oct 5 – Tue, Oct 6"); an empty today
      // stands alone, said in words (C7).
      label: dayHeading(key, today),
      today: key === today,
    };
  });
  // A WEEK WITHOUT BLANKS (stage 2 · C2, owner ruling 2026-09-21): at ≤640 a run of empty days is
  // one quiet line and a day with something keeps its frame. Both forms render (the seven columns for ≥641, the
  // grouped stack for ≤640) and the stylesheet shows one per width, so the server and the browser agree on first
  // paint. The grouping is `groupWeekDays` (lib/coach-schedule-phone), unit-tested.
  const groups = groupWeekDays(cells);
  const byKey = new Map(cells.map(c => [c.key, c]));
  const renderDay = ({ key, dayEvents, dayTryouts, dayGames }: (typeof cells)[number]) => (
          <div key={key} className={`${styles.calWeekDay}${key === today ? ` ${styles.calWeekDayToday}` : ''}`}>
            {/* The day's heading in the display face, in capitals (2026-09-28 ruling 1); today says so in words (C7). */}
            <div className={styles.calWeekDayLabel}>{dayHeading(key, today)}</div>
            <div className={styles.calWeekDayEvents}>
              {dayEvents.length === 0 && dayTryouts.length === 0 && dayGames.length === 0
                ? <span className={styles.calWeekEmpty}>—</span>
                : (
                  <>
                    {dayEvents.map(e => (
                      <ScheduleEventChip key={e.id} event={e} decor={decor} dayKey={key} />
                    ))}
                    {dayGames.map(g => (
                      <TournamentGameChip key={`g-${g.id}`} game={g} dayKey={key} />
                    ))}
                    {dayTryouts.map(s => (
                      <TryoutChip key={s.id} session={s} sport={sport} dayKey={key} href={tryoutsHref} />
                    ))}
                  </>
                )
              }
            </div>
          </div>
  );
  return (
    <>
      <div className={`${styles.calWeekGrid} ${styles.calWeekWide}`}>
        {cells.map(renderDay)}
      </div>
      <div className={styles.calWeekPhone}>
        {groups.map(g => g.kind === 'day'
          ? renderDay(byKey.get(g.key)!)
          : g.today
            ? <p key={g.from} className={`${styles.calWeekQuiet} ${styles.calWeekQuietToday}`}><b>{g.label}</b> · {WEEK_EMPTY_SUFFIX}</p>
            : <p key={g.from} className={styles.calWeekQuiet}>{weekEmptyLine(g.label)}</p>)}
      </div>
    </>
  );
}

export function ScheduleMonthView({ data, curMonth, selectedDay, onSelectDay, onOpenDay }: {
  data: ScheduleViewData;
  curMonth: string;
  /** The touch Month (≤768, C6): the tapped day, whose rows sit under the grid. */
  selectedDay: string;
  onSelectDay: (key: string) => void;
  /** "+N more" in a cell: one event opens it, several open the day list. */
  onOpenDay: (key: string, dayEvents: RepTeamEvent[]) => void;
}) {
  const { events, tryoutSessions, unmirroredGames, sport, tryoutsHref, decor } = data;
  const today = tournamentToday();

  /**
   * One day's rows in the LIST's row shape with a time-only lead (`dayKey`) — the rows under the
   * touch Month (stage 2 · C2; ≤768 since 6c). Sorted the way the list sorts a month: on the club-local
   * clock every row displays, every kind together (the 2026-08-24 one-chronological-list rule).
   */
  function dayRows(key: string) {
    const rows = [
      ...sortDayEvents(events.filter(e => eventOnDay(e, key))).map(e => ({
        at: e.startsAt ? clock24(e.startsAt) : '99:99',
        node: <ScheduleEventChip key={e.id} event={e} decor={decor} dayKey={key} listRow />,
      })),
      ...unmirroredGames.filter(g => g.gameDate === key).map(g => ({
        at: g.startsAt ? clock24(g.startsAt) : '99:99',
        node: <TournamentGameChip key={`g-${g.id}`} game={g} dayKey={key} listRow />,
      })),
      ...tryoutSessions.filter(t => tryoutSessionDay(t.startsAt) === key).map(t => ({
        at: clock24(t.startsAt),
        node: <TryoutChip key={t.id} session={t} sport={sport} dayKey={key} href={tryoutsHref} listRow />,
      })),
    ].sort((a, b) => a.at.localeCompare(b.at));
    return rows.map(r => r.node);
  }

  // Monday first (C2): the cells come from calendar parts, like the Week one click away.
  const cells = monthCells(curMonth);

  const grid = (
    <div className={styles.calMonthGrid}>
      {WEEKDAY_HEADS.map(d => (
        <div key={d} className={styles.calMonthHeader}>{d}</div>
      ))}
      {cells.map((key, i) => {
        if (!key) return <div key={i} className={`${styles.calMonthCell} ${styles.calMonthCellPad}`} />;
        const dayEvents = sortDayEvents(events.filter(e => eventOnDay(e, key)));
        const dayTryouts = tryoutSessions.filter(s => tryoutSessionDay(s.startsAt) === key);
        const dayGames = unmirroredGames.filter(g => g.gameDate === key);
        const isToday = key === today;
        const isSelected = key === selectedDay;
        // The cell's accessible name on the touch Month, where the chips are dots: the day, in a sentence, and what
        // is on it.
        const longDay = `${isToday ? 'Today, ' : ''}${formatWeekdayDate(key)}`;
        const onDay = dayEvents.length + dayGames.length + dayTryouts.length;
        return (
          <div key={key} className={`${styles.calMonthCell} ${isToday ? styles.calMonthCellToday : ''}${isSelected ? ` ${styles.calMonthCellSelected}` : ''}`}>
            <span className={styles.calMonthDayNum}>{dayOfMonth(key)}</span>
            {/* THE CELL IS THE TAP on the touch Month (≤768, C6): a button over the whole cell selects
                the day and its rows appear under the grid. Rendered at every width and shown only
                at ≤768 by the stylesheet — a button INSIDE the cell rather than the cell as a
                button, because the desk's chips beneath are buttons of their own and a button
                cannot hold one. The dots are decoration; the name carries the day and its count. */}
            <button
              type="button"
              className={styles.calMonthDayBtn}
              aria-pressed={isSelected}
              aria-label={`${longDay}${onDay ? ` · ${onDay} event${onDay === 1 ? '' : 's'}` : ''}`}
              onClick={() => onSelectDay(key)}
            />
            <span className={styles.calMonthDots} aria-hidden>
              {dayEvents.slice(0, 4).map(e => {
                const outlined = e.isScrimmage && e.status !== 'cancelled';
                return (
                  <span
                    key={e.id}
                    className={`${styles.calMonthDot}${outlined ? ` ${styles.calMonthDotOutline}` : ''}${e.status === 'cancelled' ? ` ${styles.calMonthDotCancelled}` : ''}`}
                    style={{ color: EVENT_COLORS[e.eventType] }}
                  />
                );
              })}
              {dayGames.slice(0, 2).map(g => <span key={`g-${g.id}`} className={styles.calMonthDot} style={{ color: 'var(--warning)' }} />)}
              {dayTryouts.length > 0 && <span className={`${styles.calMonthDot} ${styles.calMonthDotOutline}`} style={{ color: 'var(--text-tertiary)' }} />}
            </span>
            {/* The desk Month says what and when (C6, F09): each chip the time over the title, cut with an ellipsis;
                up to three, then "+N more", which opens the day. */}
            <div className={styles.calMonthDayEvents}>
              {dayEvents.slice(0, 3).map(e => {
                // Multi-day tournament: continuation days get a "›" lead so the span reads as one run.
                const span = tournamentSpan(e);
                const isCont = !!span && key > span.start;
                const cancelled = e.status === 'cancelled';
                const label = span && span.days > 1 ? `${isCont ? '› ' : ''}${e.name}` : e.name;
                const time = span
                  ? (span.days > 1 ? `Day ${daysBetween(span.start, key) + 1}/${span.days}` : 'All day')
                  : (e.startsAt ? fmtTime(e.startsAt) : '');
                const title = [
                  label, span ? formatEventDateRange(span.start, span.end, false) : null,
                  // The not-on word, as the row says it (Ask 14): a practice this team handed back reads Handed back.
                  e.isScrimmage ? SCRIMMAGE_LABEL : null, cancelled ? notOnWord(decor.clubSourceOf?.(e)?.handedBack) : null,
                ].filter(Boolean).join(' · ');
                return (
                  <CellChip
                    key={e.id}
                    as="button"
                    onClick={() => decor.openEvent(e)}
                    colour={EVENT_COLORS[e.eventType]}
                    cancelled={cancelled}
                    variant={e.isScrimmage && !cancelled ? 'scrimmage' : undefined}
                    title={title}
                    time={time}
                    name={label}
                  />
                );
              })}
              {dayEvents.length > 3 && (
                <button
                  type="button"
                  className={styles.calMonthMoreDots}
                  onClick={() => onOpenDay(key, dayEvents)}
                >
                  +{dayEvents.length - 3} more
                </button>
              )}
              {dayGames.slice(0, 2).map(g => (
                <TournamentGameChip key={`g-${g.id}`} game={g} dayKey={key} />
              ))}
              {/* Cap tournament-game chips like events do, so a busy pool-play day can't overflow the
                  cell (Week/List views show the full set). */}
              {dayGames.length > 2 && (
                <span className={styles.calMonthMoreDots} title="Switch to Week or List to see all games">
                  +{dayGames.length - 2} game{dayGames.length - 2 === 1 ? '' : 's'}
                </span>
              )}
              {dayTryouts.slice(0, 1).map(s => (
                <TryoutChip key={s.id} session={s} sport={sport} dayKey={key} href={tryoutsHref} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
  // THE CHOSEN DAY'S ROWS UNDER THE GRID (the touch Month, ≤768): the list's own row shape with a time-only lead,
  // the day as the band in the one spelling ("Tue, Oct 13"; "Today · Sat, Oct 10"), and an empty day saying so once.
  // Hidden above 768, where the cells carry their chips and "+N more" opens the day sheet.
  const selectedRows = dayRows(selectedDay);
  return (
    <>
      {grid}
      <div className={styles.calMonthDayRows}>
        <CoachRowList label={`On ${formatWeekdayDate(selectedDay)}`}>
          <CoachRowBand>{dayHeading(selectedDay, today)}</CoachRowBand>
          {selectedRows.length > 0
            ? selectedRows
            : <CoachRow as="static" title={<span className={styles.calMonthQuiet}>{NOTHING_SCHEDULED}</span>} titleWeight="plain" />}
        </CoachRowList>
      </div>
    </>
  );
}

/**
 * ⚖ THE VIEW SWITCH — ONE control on every calendar (Club Tier 6c, Ask 13 — standard §11.3; owner 2026-10-10, §289): the
 * white card with the strong line, the chosen view olive, as hub v78 drew it (`.c6-seg`). The build first matched only the
 * chosen view's colour, and the coach's Schedule kept the portal's see-through `.viewToggle` beside the club's white switch
 * — the owner caught the two side by side. The coach's Schedule, the club Calendar and a team's schedule (admin) all render
 * this, never their own — the kit's `ViewSwitch` with the three calendar words.
 */
export type CalendarViewMode = 'list' | 'week' | 'month';
const CALENDAR_VIEW_WORD: Record<CalendarViewMode, string> = { list: 'List', week: 'Week', month: 'Month' };
export function CalendarViewSwitch<V extends CalendarViewMode>({ views, value, onChange, label }: {
  views: readonly V[]; value: V; onChange: (view: V) => void; label: string;
}) {
  return <ViewSwitch views={views.map(v => ({ id: v, label: CALENDAR_VIEW_WORD[v] }))} value={value} onChange={onChange} label={label} />;
}

/**
 * THE DATE ROW (Week / Month) — named arrows that step the calendar, and the range in the one spelling (C8): "Oct 5 – 11,
 * 2026", the year dropped on a phone; "October 2026". Every calendar draws it — the coach's schedule, a team's schedule
 * (admin) and the club Calendar (whose List is a week, so it passes 'week') — white boxes, as the switch (§289).
 */
export function ScheduleDateNav({ view, cursor, onStep, range }: {
  view: 'week' | 'month'; cursor: string; onStep: (dir: -1 | 1) => void;
  /**
   * A range of the caller's own instead of the cursor's week — the club scheduler's grid (Club Tier 11a, Ask 27): a
   * schedule held on one weekday reads that weekday's dates seven at a time ("Oct 4 – Nov 15, 2026"), and the arrows
   * stop at the schedule's own ends (absent there, never a dead press).
   */
  range?: { long: string; short: string; canBack: boolean; canForward: boolean; prevLabel: string; nextLabel: string };
}) {
  const back = range ? range.canBack : true, forward = range ? range.canForward : true;
  return (
    <div className={styles.calNav}>
      {/* At a range's end the arrow is ABSENT — hidden in place so the dates never shift (absent beats disabled). */}
      <button type="button" className={styles.calNavBtn} onClick={() => onStep(-1)} style={back ? undefined : { visibility: 'hidden' }}
        aria-label={range?.prevLabel ?? (view === 'month' ? 'Previous month' : 'Previous week')}><ChevronLeft size={16} aria-hidden /></button>
      <span className={styles.calNavLabel}>
        {range ? (
          <>
            <span className={styles.calNavLong}>{range.long}</span>
            <span className={styles.calNavShort}>{range.short}</span>
          </>
        ) : view === 'month' ? monthWords(cursor) : (
          <>
            <span className={styles.calNavLong}>{weekRangeWords(cursor)}</span>
            <span className={styles.calNavShort}>{weekRangeWords(cursor, false)}</span>
          </>
        )}
        <span className={styles.calNavSizer} aria-hidden>
          <span className={styles.calNavLong}>{widestRangeWords(cursor)}</span>
          <span className={styles.calNavShort}>{widestRangeWords(cursor, false)}</span>
        </span>
      </span>
      <button type="button" className={styles.calNavBtn} onClick={() => onStep(1)} style={forward ? undefined : { visibility: 'hidden' }}
        aria-label={range?.nextLabel ?? (view === 'month' ? 'Next month' : 'Next week')}><ChevronRight size={16} aria-hidden /></button>
    </div>
  );
}

/** An empty chosen day, said once (the band already names it). */
export const NOTHING_SCHEDULED = 'Nothing scheduled.';
