'use client';
import { Fragment } from 'react';
import Link from 'next/link';
import { Calendar, CircleHelp, ClipboardList, Plus, TriangleAlert, Trophy } from 'lucide-react';
import { EVENT_ICONS, EVENT_COLORS } from '@/components/coaches/eventTypeMark';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { CoachRowList, CoachRowBand, CoachRow } from '@/components/coaches/CoachRowList';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { surfaceLabel } from '@/lib/sports';
import { opponentSuffix } from '@/lib/coach-tournament-games';
import type { CoachScheduleTournamentGame } from '@/lib/basic-coach-teams';
import { groupWeekDays, weekEmptyLine } from '@/lib/coach-schedule-phone';
import { SCRIMMAGE_LABEL } from '@/lib/coach-schedule-vocab';
import { formatInOrgZone, orgDayKey, tournamentToday } from '@/lib/timezone';
import { formatTryoutSessionTime, tryoutSessionDay } from '@/lib/tryout-session-label';
import {
  DAYS_OF_WEEK, dayStr, daysBetween, eventOnDay, fmtTime, monthKey, resultColor, shortDate,
  sortDayEvents, tournamentSpan,
} from '@/lib/coach-schedule-view';
import type { RepTeamEvent, RepTryoutSession } from '@/lib/types';

/**
 * THE SCHEDULE'S THREE CALENDAR VIEWS — List, Week and Month — and the three row kinds they draw
 * (a team event, a tournament's own game, a tryout session). Moved out of the schedule page,
 * unchanged, by the Schedule deep dive's split (stage 1 · S6, owner ruling 2026-09-25 — "split
 * first, a pure move"). The page keeps the data and the clock; these draw what they are handed and
 * hold no state of their own (Month's selected day and the cursor live on the page, which the
 * navigator above the views also moves).
 */

/** What every event row carries beyond the event itself — the page's per-event decorations. */
export interface ScheduleRowDecor {
  mismatchIds: Set<string>;
  awardCountByEventId: Record<string, number>;
  movedEventIds: Set<string>;
  bookRecordFor: (e: RepTeamEvent) => string | null;
  gameDayHrefById: Map<string, string>;
  openEvent: (e: RepTeamEvent) => void;
}

/** The data all three views draw from. */
export interface ScheduleViewData {
  events: RepTeamEvent[];
  tryoutSessions: RepTryoutSession[];
  unmirroredGames: CoachScheduleTournamentGame[];
  /** The team's sport id — the tryout row's field word. */
  sport: string;
  /** Where a tryout row goes (the Tryouts tab). */
  tryoutsHref: string;
  decor: ScheduleRowDecor;
}

// A tryout session projected onto the calendar — read-only, visually distinct from a game (dashed
// rail, clipboard, muted text), links to the Tryouts tab rather than opening the event editor.
//
// ⚠ THE DISTINCTNESS IS THE DASHED RAIL AND THE MUTED TEXT — NOT A DIFFERENT ROW SHAPE. This row
// was built on its own and drifted from its two siblings in two ways a coach reads as breakage
// (owner, 2026-08-24, from a screenshot):
//   · it never took `dayKey`, so the flat LIST view showed a bare "5:00 p.m." where every row
//     around it read "Aug 30 · 6:00 p.m." — the one view with no date anywhere else on the row;
//   · its clipboard sat INSIDE the title text with hand-rolled spacing, where `EventChip` and
//     `TournamentGameChip` both put their mark in the leading icon slot before the time.
// Both are fixed here; the dashed rail and the muted name stay exactly as they were.
function TryoutChip({ session, sport, dayKey, href, listRow }: { session: RepTryoutSession; sport: string; dayKey?: string; href: string; listRow?: boolean }) {
  // ⚠ A session is a real moment now, read in the CLUB's zone like every event beside it — see
  // lib/tryout-session-label for why it used to be sliced, and why that was wrong.
  const time = formatTryoutSessionTime(session.startsAt);
  // Same rule as the other two chips: a day-scoped view already carries the date in its column
  // header, the flat list does not.
  const lead = dayKey ? time : [shortDate(tryoutSessionDay(session.startsAt)), time].filter(Boolean).join(' · ');
  const place = [session.label, session.location, surfaceLabel(sport, session.fieldNumber)].filter(Boolean).join(' · ');
  // The LIST view's face (standard §3.10, F-26): the chip below is the calendar CELL's (K-21). The
  // clipboard is the one lead mark and the muted name carries the distinctness the dashed rail
  // carries in a cell.
  if (listRow) {
    return (
      <CoachRow
        as="link"
        href={href}
        data-day={tryoutSessionDay(session.startsAt)}
        tooltip="Tryout — opens your Tryouts tab"
        mark={<ClipboardList size={12} aria-hidden />}
        lead={lead}
        leadKind="date-time"
        title={<span className={styles.eventChipOpp}>Tryout{place ? ` · ${place}` : ''}</span>}
        titleWeight="plain"
      />
    );
  }
  return (
    <Link href={href} className={`${styles.eventChip} ${styles.tryoutChip}`} title="Tryout — opens your Tryouts tab">
      <ClipboardList size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} aria-hidden />
      <span className={styles.eventChipTime}>{lead}</span>
      <span className={styles.eventChipName}>
        Tryout{place ? <span className={styles.eventChipOpp}> · {place}</span> : null}
      </span>
    </Link>
  );
}

// WI-2B: a REAL tournament game projected onto the calendar — read-only, gold accent, links to the
// public game page (never opens the event editor). Mirrors TryoutChip; games flow through none of the
// editor / attendance / lineup / save paths. `dayKey` present in day-scoped views (week/month) → show
// the time only; the flat list shows the date too.
function TournamentGameChip({ game, dayKey, listRow }: { game: CoachScheduleTournamentGame; dayKey?: string; listRow?: boolean }) {
  const lead = dayKey
    ? (game.timeLabel ?? (game.phase === 'live' ? 'Live' : 'TBD'))
    : [game.dateLabel, game.timeLabel].filter(Boolean).join(' · ');
  // The name and the trail (a live score, or the final score and result) are built ONCE so the
  // calendar cell's chip and the list view's row cannot drift apart — the same shape EventChip
  // takes below.
  const title = (
    <>vs {game.opponentName}<span className={styles.eventChipOpp}> · </span><span className={styles.tournamentChipTag}>Tournament</span></>
  );
  const trail = game.phase === 'live' ? (
    <span className={styles.eventChipResult} style={{ color: 'var(--danger)' }}>
      <span className={styles.tournamentLiveDot} aria-hidden />{game.myScore ?? 0}–{game.oppScore ?? 0}
    </span>
  ) : game.phase === 'final' ? (
    <>
      <span className={styles.eventChipScore}>{game.myScore}–{game.oppScore}</span>
      {game.result && (
        <span className={styles.eventChipResult} style={{ color: resultColor(game.result) }}>{game.result.toUpperCase()}</span>
      )}
    </>
  ) : null;
  // The LIST view's face (§3.10, F-26); the chip is the calendar cell's (K-21).
  if (listRow) {
    const face = {
      mark: <Trophy size={12} style={{ color: 'var(--warning)' }} aria-hidden />,
      lead, leadKind: 'date-time' as const,
      title, titleWeight: 'plain' as const,
      trail,
      'data-day': game.gameDate ?? undefined,
    };
    return game.href
      ? <CoachRow as="link" href={game.href} tooltip="Open the live game page" {...face} />
      : <CoachRow as="static" {...face} />;
  }
  const inner = (
    <>
      <Trophy size={12} style={{ color: 'var(--warning)', flexShrink: 0 }} aria-hidden />
      <span className={styles.eventChipTime}>{lead}</span>
      <span className={styles.eventChipName}>{title}</span>
      <span className={styles.eventChipTrail}>{trail}</span>
    </>
  );
  return game.href ? (
    <Link href={game.href} className={`${styles.eventChip} ${styles.tournamentChip}`} title="Open the live game page">{inner}</Link>
  ) : (
    <div className={`${styles.eventChip} ${styles.tournamentChip}`} style={{ cursor: 'default' }}>{inner}</div>
  );
}

function EventChip({ event, onClick, dayKey, mismatch, awardCount, moved, bookRecord, gameDayHref, listRow }: { event: RepTeamEvent; onClick: () => void; dayKey?: string; mismatch?: boolean; awardCount?: number; moved?: boolean; bookRecord?: string | null; gameDayHref?: string | null; listRow?: boolean }) {
  const color = EVENT_COLORS[event.eventType];
  const Icon = EVENT_ICONS[event.eventType];
  const cancelled = event.status === 'cancelled';
  // Lead text (the slot that normally shows the start time). Tournaments are all-day and may
  // run multiple days, so they read as a date range (list view) or "Day n/N" (a specific
  // calendar day) instead of a misleading clock time.
  const span = tournamentSpan(event);
  let lead: string;
  if (span) {
    lead = dayKey
      ? (span.days > 1 ? `Day ${daysBetween(span.start, dayKey) + 1}/${span.days}` : 'All day')
      : (span.days > 1 ? `${shortDate(span.start)}–${shortDate(span.end)}` : shortDate(span.start));
  } else {
    // Day-scoped views (week/month/day-sheet) already carry the date as their column/header, so
    // show only the time there. The flat LIST view has just a month header, so prefix the day
    // ("Mar 15 · 2:00 p.m.") — otherwise a coach can't tell which day an event falls on.
    lead = event.startsAt
      ? (dayKey ? fmtTime(event.startsAt) : `${shortDate(dayStr(event.startsAt))} · ${fmtTime(event.startsAt)}`)
      : '';
  }
  // Opponent safety-net: games auto-name "vs Lady Jays" / "@ Lady Jays" (opponent already in the name),
  // so only append "vs/@ {opp}" when the opponent is set but NOT already in the name. One shared
  // rule (lib/coach-tournament-games) — the Attendance page names events the same way.
  const oppSuffix = opponentSuffix(event);
  // Final score (team-relative: your team first) for a played game.
  const hasScore = !span && event.teamScore != null && event.opponentScore != null;
  // The row stays ONE interactive element (it opens the drawer); the Game day action is a
  // SIBLING link beside it, never a control nested inside the button — invalid HTML and a
  // mis-tap magnet on a phone. Outside the live window the sibling simply isn't there.
  // The trail slot — STATE only (Moved, a mismatch, your record vs them, the score, cancelled).
  // Built once so the calendar cell's chip and the list view's row cannot drift apart.
  const trail = (
    <>
      {/* Batch 4: the organizer rescheduled this since the coach last looked here. Their lineup
          and attendance came with it — this only exists so they know the time changed. */}
      {moved && !cancelled && (
        <span className={styles.eventChipMoved} title="The organizer moved this game">Moved</span>
      )}
      {mismatch && !cancelled && (
        <TriangleAlert size={12} style={{ color: 'var(--warning)', flexShrink: 0 }} aria-label="Lineup and attendance don't match" />
      )}
      {/* Scouting Book glance: your record vs this opponent, upcoming games only (the
          caller passes null once a score exists — the trail slot is the score's then). */}
      {bookRecord && !cancelled && (
        <span className={styles.scoutRecChip} data-tone="even" title={`Your record vs ${event.opponent}`}>{bookRecord}</span>
      )}
      {/* The WORD for a scrimmage, whenever the box is ticked — muted on purpose: it says "left out
          of the record", never a result, and the mark beside the row stays the game's own (D6). */}
      {event.isScrimmage && <span className={styles.scrimmageChip}>{SCRIMMAGE_LABEL}</span>}
      {cancelled ? (
        <span className={styles.eventChipResult} style={{ color: 'var(--warning)' }}>CANCELLED</span>
      ) : (
        <>
          {!!awardCount && (
            <span className={styles.eventChipResult} title={`${awardCount} award${awardCount === 1 ? '' : 's'} given`} style={{ color: 'var(--logic-lime)' }}>
              🏆 {awardCount}
            </span>
          )}
          {hasScore && <span className={styles.eventChipScore}>{event.teamScore}–{event.opponentScore}</span>}
          {!span && event.result && (
            <span className={styles.eventChipResult} style={{ color: resultColor(event.result) }}>
              {event.result.toUpperCase()}
            </span>
          )}
        </>
      )}
    </>
  );
  // The LIST view's face (standard §3.10, F-26 — owner-ruled 2026-09-16): one row in one frame,
  // the type icon as the one lead mark (the 3px colour rail stays in the calendar cell, K-21), the
  // date-time as a date column, the name as a record read (400). The row is a real button that
  // opens the drawer; the Game day link sits BESIDE it in the same <li>, never inside it.
  if (listRow) {
    return (
      <CoachRow
        as="button"
        onClick={onClick}
        data-day={event.startsAt ? dayStr(event.startsAt) : undefined}
        className={cancelled ? styles.rowListMuted : undefined}
        mark={<Icon size={12} style={{ color }} aria-hidden />}
        lead={lead}
        leadKind={span ? 'text' : 'date-time'}
        title={<span style={cancelled ? { textDecoration: 'line-through' } : undefined}>{event.name}{oppSuffix && <span className={styles.eventChipOpp}>{oppSuffix}</span>}</span>}
        titleWeight="plain"
        trail={trail}
        beside={gameDayHref ? <Link href={gameDayHref} className={styles.gdEntryBtn}>Game day</Link> : undefined}
      />
    );
  }
  const chip = (
    <button
      className={styles.eventChip}
      style={{ borderLeftColor: color, ...(cancelled ? { opacity: 0.55 } : {}) }}
      onClick={onClick}
    >
      <Icon size={12} style={{ color, flexShrink: 0 }} />
      <span className={styles.eventChipTime}>{lead}</span>
      <span className={styles.eventChipName} style={cancelled ? { textDecoration: 'line-through' } : undefined}>
        {event.name}{oppSuffix && <span className={styles.eventChipOpp}>{oppSuffix}</span>}
      </span>
      <span className={styles.eventChipTrail}>
        {trail}
      </span>
    </button>
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
    />
  );
}

export function ScheduleListView({ data, canAddEvents, onAddEvent, onHelp }: {
  data: ScheduleViewData;
  canAddEvents: boolean;
  /** The empty state's "Add Event" — opens the header's add menu. */
  onAddEvent: () => void;
  onHelp: () => void;
}) {
  const { events, tryoutSessions, unmirroredGames, sport, tryoutsHref, decor } = data;
  if (!events.length && !tryoutSessions.length && !unmirroredGames.length) {
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
  const monthGroups = months.map(mk => {
    const label = new Date(mk + '-01T00:00:00').toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
    const trys = (tryByMonth[mk] ?? []).slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const games = (gamesByMonth[mk] ?? []).slice().sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
    /**
     * ⚠ ONE CHRONOLOGICAL LIST, NOT THREE STACKED BLOCKS (owner, 2026-08-24).
     *
     * This month used to render every self-entered event, then every tournament game, then
     * every tryout — so a tryout on the 27th sat BELOW a practice on the 30th and the month
     * simply was not in date order. It reads as a styling quirk and is actually the schedule
     * lying about when things happen.
     *
     * Sorted on the club-local day and clock every row DISPLAYS, built as a comparable
     * `YYYY-MM-DDTHH:mm`. Every kind is a real instant read in the club’s zone — including a
     * tryout session, since 2026-08-24 (it used to be stored AND read as a bare wall clock,
     * which is why sorting was the first thing to need a true ordering, and how that surfaced).
     * Undated rows sort last rather than jumping to the top.
     */
    const clock24 = (iso: string) => formatInOrgZone(iso, { hour: '2-digit', minute: '2-digit', hour12: false });
    const shownAt = (day: string, time: string) => `${day || '9999-12-31'}T${time || '99:99'}`;
    const rows = [
      ...(grouped[mk] ?? []).map(e => ({
        at: shownAt(e.startsAt ? orgDayKey(e.startsAt) : '', e.startsAt ? clock24(e.startsAt) : ''),
        node: <ScheduleEventChip key={e.id} event={e} decor={decor} listRow />,
      })),
      ...games.map(g => ({
        at: shownAt(g.gameDate ?? '', g.startsAt ? clock24(g.startsAt) : ''),
        node: <TournamentGameChip key={`g-${g.id}`} game={g} listRow />,
      })),
      ...trys.map(s => ({
        at: shownAt(tryoutSessionDay(s.startsAt), clock24(s.startsAt)),
        node: <TryoutChip key={s.id} session={s} sport={sport} href={tryoutsHref} listRow />,
      })),
    ].sort((a, b) => a.at.localeCompare(b.at));
    // A month is a BAND ROW inside the one frame (standard §3.10.5), not a kicker on the paper
    // over a separate stack — the feed's day header, on the schedule.
    return (
      <Fragment key={mk}>
        <CoachRowBand>{label}</CoachRowBand>
        {rows.map(r => r.node)}
      </Fragment>
    );
  });
  // The LIST view is a row list on the recipe (§3.10, F-26): one frame on the card, compact
  // rows with a hairline, months as bands. The week and month views keep their chips (K-21).
  // On a phone (stage 2 · C1, the owner's "no card gaps"): ONE white frame with hairlines — the
  // name, then the date-time beneath — and the month band pins at the top of the scroller as the
  // coach slides. The Schedule was one of the five lists that declared this form before it became
  // every list's (P1, 2026-09-29).
  return (
    <CoachRowList label="Schedule">
      {monthGroups}
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
  const weekStart = new Date(curWeek + 'T00:00:00');
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const cells = days.map(day => {
    // Built from calendar parts, so read back from calendar parts, as Month's cells are (C0): `toISOString()` on a
    // locally-built midnight reads the UTC day, a day early on any device east of UTC (Club Tier 6b, Ask 8).
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const dayEvents = sortDayEvents(events.filter(e => eventOnDay(e, key)));
    const dayTryouts = tryoutSessions.filter(s => tryoutSessionDay(s.startsAt) === key);
    const dayGames = unmirroredGames
      .filter(g => g.gameDate === key)
      .sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
    return {
      key, day, dayEvents, dayTryouts, dayGames,
      hasEvents: dayEvents.length + dayTryouts.length + dayGames.length > 0,
      // "Mon 14" — the quiet line's own words (en-CA short weekday + day number).
      label: day.toLocaleDateString('en-CA', { weekday: 'short', day: 'numeric' }),
    };
  });
  // A WEEK WITHOUT BLANKS (stage 2 · C2, owner ruling 2026-09-21): at ≤640 a run of empty days is
  // one quiet line — "Mon 14 – Thu 17 · nothing scheduled" — and a day with something keeps its
  // card exactly as built. Both forms render (the seven cards for ≥641, the grouped stack for
  // ≤640) and the stylesheet shows one per width, so the server and the browser agree on first
  // paint. The grouping is `groupWeekDays` (lib/coach-schedule-phone), unit-tested.
  const groups = groupWeekDays(cells);
  const byKey = new Map(cells.map(c => [c.key, c]));
  const renderDay = ({ key, day, dayEvents, dayTryouts, dayGames }: (typeof cells)[number]) => (
          <div key={key} className={styles.calWeekDay}>
            <div className={styles.calWeekDayLabel}>
              {day.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
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
          : <p key={g.from} className={styles.calWeekQuiet}>{weekEmptyLine(g.label)}</p>)}
      </div>
    </>
  );
}

export function ScheduleMonthView({ data, curMonth, selectedDay, onSelectDay, onOpenDay }: {
  data: ScheduleViewData;
  curMonth: string;
  /** Month on a phone (stage 2 · C2): the tapped day, whose rows sit under the grid. */
  selectedDay: string;
  onSelectDay: (key: string) => void;
  /** "+N more" in a cell: one event opens it, several open the day list. */
  onOpenDay: (key: string, dayEvents: RepTeamEvent[]) => void;
}) {
  const { events, tryoutSessions, unmirroredGames, sport, tryoutsHref, decor } = data;

  /**
   * One day's rows in the LIST's row shape with a time-only lead (`dayKey`) — the rows under the
   * month grid on a phone (stage 2 · C2). Sorted the way the list sorts a month: on the club-local
   * clock every row displays, every kind together (the 2026-08-24 one-chronological-list rule).
   */
  function dayRows(key: string) {
    const clock24 = (iso: string) => formatInOrgZone(iso, { hour: '2-digit', minute: '2-digit', hour12: false });
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

  const [yr, mo] = curMonth.split('-').map(Number);
  const firstDay = new Date(yr, mo - 1, 1);
  const lastDay  = new Date(yr, mo, 0);
  const startPad = firstDay.getDay();
  const cells: (Date | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => new Date(yr, mo - 1, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const grid = (
    <div className={styles.calMonthGrid}>
      {DAYS_OF_WEEK.map(d => (
        <div key={d} className={styles.calMonthHeader}>{d.slice(0, 3)}</div>
      ))}
      {cells.map((day, i) => {
        if (!day) return <div key={i} className={styles.calMonthCell} />;
        // Built from calendar parts, so read back from calendar parts — `toISOString()` on a
        // locally-constructed Date reads the UTC day and can name the wrong cell (C0).
        const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
        const dayEvents = sortDayEvents(events.filter(e => eventOnDay(e, key)));
        const dayTryouts = tryoutSessions.filter(s => tryoutSessionDay(s.startsAt) === key);
        const dayGames = unmirroredGames.filter(g => g.gameDate === key);
        const isToday = key === tournamentToday();
        const isSelected = key === selectedDay;
        // The cell's accessible name on a phone, where the chips are dots (C2): the day, and
        // what is on it.
        const longDay = day.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
        const onDay = dayEvents.length + dayGames.length + dayTryouts.length;
        return (
          <div key={key} className={`${styles.calMonthCell} ${isToday ? styles.calMonthCellToday : ''}${isSelected ? ` ${styles.calMonthCellSelected}` : ''}`}>
            <span className={styles.calMonthDayNum}>{day.getDate()}</span>
            {/* THE CELL IS THE TAP on a phone (stage 2 · C2): a button over the whole cell selects
                the day and its rows appear under the grid. Rendered at every width and shown only
                at ≤640 by the stylesheet — a button INSIDE the cell rather than the cell as a
                button, because the desktop's chips beneath are buttons of their own and a button
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
            <div className={styles.calMonthDayEvents}>
              {dayEvents.slice(0, 3).map(e => {
                // Multi-day tournament: continuation days get a "›" lead so the span reads as one run.
                const span = tournamentSpan(e);
                const isCont = !!span && key > span.start;
                const label = span && span.days > 1 ? `${isCont ? '› ' : ''}${e.name}` : e.name;
                const title = span
                  ? `${e.name} (${shortDate(span.start)}–${shortDate(span.end)})${e.status === 'cancelled' ? ' · cancelled' : ''}`
                  : `${e.status === 'cancelled' ? `${e.name} (cancelled)` : e.name}${e.isScrimmage ? ` · ${SCRIMMAGE_LABEL}` : ''}`;
                // A ticked game is drawn OUTLINED in the game's colour — a shape cue, not a colour
                // cue, because a 14-character cell has no room for the word (D6); the title carries it.
                const outlined = e.isScrimmage && e.status !== 'cancelled';
                return (
                  <button
                    key={e.id}
                    className={`${styles.calMonthEventDot}${outlined ? ` ${styles.calMonthEventDotOutline}` : ''}`}
                    style={outlined
                      ? { borderColor: EVENT_COLORS[e.eventType], color: EVENT_COLORS[e.eventType] }
                      : { background: EVENT_COLORS[e.eventType], ...(e.status === 'cancelled' ? { opacity: 0.55, textDecoration: 'line-through' } : {}) }}
                    title={title}
                    onClick={() => decor.openEvent(e)}
                  >
                    {label.slice(0, 14)}
                  </button>
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
              {dayGames.slice(0, 2).map(g => {
                const label = g.phase === 'live' ? `● ${g.opponentName}` : g.phase === 'final' ? `${g.myScore}–${g.oppScore} ${g.opponentName}` : `vs ${g.opponentName}`;
                const title = `${g.dateLabel}${g.timeLabel ? ` · ${g.timeLabel}` : ''} · vs ${g.opponentName}${g.tournamentName ? ` · ${g.tournamentName}` : ''}`;
                return g.href ? (
                  <Link key={`g-${g.id}`} href={g.href} className={`${styles.calMonthEventDot} ${styles.tournamentMonthDot}`} title={title}>
                    {label.slice(0, 14)}
                  </Link>
                ) : (
                  <span key={`g-${g.id}`} className={`${styles.calMonthEventDot} ${styles.tournamentMonthDot}`} title={title} style={{ cursor: 'default' }}>
                    {label.slice(0, 14)}
                  </span>
                );
              })}
              {/* Cap tournament-game dots like events do, so a busy pool-play day can't overflow the
                  cell (Week/List views show the full set). */}
              {dayGames.length > 2 && (
                <span className={`${styles.calMonthEventDot} ${styles.tournamentMonthDot}`} style={{ cursor: 'default' }} title="Switch to Week or List to see all games">
                  +{dayGames.length - 2} game{dayGames.length - 2 === 1 ? '' : 's'}
                </span>
              )}
              {dayTryouts.length > 0 && (
                <Link
                  href={tryoutsHref}
                  className={styles.calMonthEventDot}
                  style={{ background: 'transparent', border: '1px dashed var(--home-line-strong, rgba(255,255,255,0.4))', color: 'var(--home-ink-soft, rgba(255,255,255,0.75))' }}
                  title="Tryout"
                >
                  Tryout
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
  // THE SELECTED DAY'S ROWS UNDER THE GRID (stage 2 · C2): the list's own row shape with a
  // time-only lead, the day as the band; an empty day says so in one quiet line. Phone only —
  // the stylesheet hides it above 640, where the cells carry their chips and "+N more" opens the
  // day sheet as before.
  const selectedLong = new Date(`${selectedDay}T00:00:00`).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
  const selectedRows = dayRows(selectedDay);
  return (
    <>
      {grid}
      <div className={styles.calMonthDayRows}>
        <CoachRowList label={`On ${selectedLong}`}>
          <CoachRowBand>{selectedLong}</CoachRowBand>
          {selectedRows.length > 0
            ? selectedRows
            : <CoachRow as="static" title={<span className={styles.calMonthQuiet}>Nothing on {selectedLong}</span>} titleWeight="plain" />}
        </CoachRowList>
      </div>
    </>
  );
}
