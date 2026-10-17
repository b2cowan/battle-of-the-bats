'use client';
/**
 * Rep Teams › a team › Schedule — READ-ONLY, on the team's live season (Club Tier Stage 2: the rail's
 * team block, specimen 2). The club reads the schedule the coach writes (ruling D3: the admin never
 * writes a team's schedule). It moved here from the season page: the club works on the team's live
 * season, never a year it picks; a team with no live season shows its last closed season as a record.
 *
 * ⚖ THE COACH'S OWN VIEWS, READ-ONLY (Club Tier Stage 6c, Ask 14 — ruled 2026-10-10, hub v78 specimen 2; standard §11).
 * This page used to be a second, older copy of the coach's List, Week and Month (gapped cards, Won / Lost with no score,
 * "Sat Oct 10" without its comma, a Month whose "+N more" was dead, a Week whose names spilled into the next column at
 * 1440, and no phone form at all). It now draws the coach's `ScheduleListView` / `ScheduleWeekView` /
 * `ScheduleMonthView` themselves — the same rows, words, scores, Win / Loss / Tie, Moved and Scrimmage, opening on
 * today, the coach's phone form — with every write absent: no Add, no Import, no Export (register R7: the club
 * calendar's Team filter exports a range), no attendance or lineup taps. The season record card and the header stay;
 * the view switch (the portal's olive, Ask 13) leads the line and the read-only sentence takes its end.
 *
 * ⚠ The event opens the KIT'S window, not the coach's event sheet — a departure the 6c prompt allowed, said here: the
 * coach's sheet is a working surface (attendance, the lineup, the scouting book, awards, the score form) that reads a
 * dozen of the coach's own endpoints and capabilities; drawn read-only it would be a sheet of absent doors. The kit's
 * window reads first (When, Where, the opponent, the score and result, the state, notes) and has NO FOOT — no Done
 * (the 2026-10-09 rulings; standard §11 C12): its × (a phone's ←) closes it.
 */
import { use, useCallback, useMemo, useRef, useState } from 'react';
import { CalendarDays, CalendarRange, List } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { CoachCard, CoachEyebrow, CoachFigure, CoachListToolbar, kit } from '@/components/coaches/kit';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import {
  CalendarViewSwitch, ScheduleDateNav, ScheduleEventChip, ScheduleListView, ScheduleMonthView, ScheduleWeekView, resultWord,
  type ScheduleRowDecor, type ScheduleViewData,
} from '@/components/coaches/ScheduleCalendarViews';
import { useScheduleOpensOnToday } from '@/components/coaches/useScheduleOpensOnToday';
import {
  EmptyCard, LoadFailed, PageLoading, RepChip, repKit, TwoOpenNote, useDeferredLoad, useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import { usePublishRailTeam } from '@/components/admin/kit/useRailTeam';
import { EVENT_LABELS, SCRIMMAGE_LABEL } from '@/lib/coach-schedule-vocab';
import { mondayOfDay, tournamentToday } from '@/lib/timezone';
import { STATE_WORDS, dayHeading, eventWhenWords } from '@/lib/calendar-recipe';
import { chosenDayAfterStep, stepScheduleCursor } from '@/lib/coach-schedule-view';
import { formatRecord } from '@/lib/coach-season-record';
import { hasDecidedGames, seasonRecordOf } from '@/lib/team-season-figures';
import { latestClosedSeasonOf, liveSeasonOf } from '@/lib/season-live';
import coach from '@/app/[orgSlug]/coaches/coaches.module.css';
import cal from '@/components/admin/kit/club/ClubCalendar.module.css';
import styles from '../../../rep-teams.module.css';
import type { RepProgramYear, RepTeam, RepTeamEvent } from '@/lib/types';
import { possessive } from '@/lib/utils';

type ViewMode = 'list' | 'week' | 'month';
const VIEWS: ViewMode[] = ['list', 'week', 'month'];
const VIEW_WORD: Record<ViewMode, string> = { list: 'List', week: 'Week', month: 'Month' };
const VIEW_GLYPH: Record<ViewMode, React.ElementType> = { list: List, week: CalendarRange, month: CalendarDays };

/** The words a reader of someone else's schedule needs (/marketing to settle). */
const readOnlyWords = (team: string) => `${possessive(team)} coaches keep the schedule in their Coaches Portal; the club reads it here.`;
const emptyWords = (team: string) => `${possessive(team)} coaches add games, practices and events in their Coaches Portal; they show here as they do.`;

interface TeamRead { team: RepTeam; programYears: RepProgramYear[] }

export default function TeamSchedulePage({ params }: { params: Promise<{ orgSlug: string; teamId: string }> }) {
  const { orgSlug, teamId } = use(params);
  const { loading: orgLoading } = useOrg();
  const q = `orgSlug=${encodeURIComponent(orgSlug)}`;
  const teamBase = `/${orgSlug}/admin/rep-teams/teams/${teamId}`;

  const [read, setRead] = useState<TeamRead | null>(null);
  const [events, setEvents] = useState<RepTeamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<ViewMode>('list');
  const [cursor, setCursor] = useState(() => tournamentToday());
  /** The touch Month's chosen day (≤768) — today at open, kept on the grid by the arrows (the coach's rule). */
  const [selectedDay, setSelectedDay] = useState(() => tournamentToday());
  const [selected, setSelected] = useState<RepTeamEvent | null>(null);
  /** A desk Month's "+N more": the day's events, every one reachable (it was a dead line of text — C6-05). */
  const [daySheet, setDaySheet] = useState<{ day: string; events: RepTeamEvent[] } | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const tailRef = useRef<HTMLDivElement | null>(null);

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    setLoadError(false);
    try {
      const teamRes = await fetch(`/api/admin/rep-teams/teams/${teamId}?light=1&${q}`, { cache: 'no-store' });
      if (!teamRes.ok) { if (current()) setLoadError(true); return; }
      const teamData = await teamRes.json() as TeamRead;
      if (!current()) return;
      setRead(teamData);
      const season = liveSeasonOf(teamData.programYears) ?? latestClosedSeasonOf(teamData.programYears);
      if (!season) { setEvents([]); return; }
      const res = await fetch(`/api/admin/rep-teams/teams/${teamId}/program-years/${season.id}/events?${q}`, { cache: 'no-store' });
      if (!res.ok) { if (current()) setLoadError(true); return; }
      const list = ((await res.json()).events ?? []) as RepTeamEvent[];
      if (current()) setEvents(list);
    } catch {
      if (current()) setLoadError(true);
    } finally {
      if (current()) setLoading(false);
    }
  }, [teamId, q, beginRead]);

  useDeferredLoad(!orgLoading, load);

  const team = read?.team ?? null;
  usePageTitle(team ? `Schedule · ${team.name}` : 'Schedule');
  usePublishRailTeam(teamId, team?.name);
  const season = useMemo(() => (read ? liveSeasonOf(read.programYears) ?? latestClosedSeasonOf(read.programYears) : null), [read]);
  const isLive = !!season && (season.status === 'draft' || season.status === 'active');
  const record = seasonRecordOf(events);

  // The List opens on today in its own frame, at every width — the coach's hook and frame (C3).
  useScheduleOpensOnToday({ scrollerRef, tailRef, active: !loading && !loadError && !!season && view === 'list', trigger: `${teamId}|${view}|${loading}` });

  // Every write absent: no openers but the read window; no lineup, game-day, award or scouting decorations.
  const decor: ScheduleRowDecor = useMemo(() => ({
    mismatchIds: new Set(), awardCountByEventId: {}, movedEventIds: new Set(),
    bookRecordFor: () => null, gameDayHrefById: new Map(), openEvent: setSelected,
  }), []);
  const viewData: ScheduleViewData = {
    events, tryoutSessions: [], unmirroredGames: [], sport: team?.sport ?? 'softball', tryoutsHref: null, decor,
  };

  const ViewGlyph = VIEW_GLYPH[view];
  const header = (
    <AdminPageHeader
      backTo={{ href: teamBase, label: team?.name ?? 'Team' }}
      crumbs={[{ label: 'Rep Teams' }, team?.groupName ? { label: team.groupName } : null]}
      title="Schedule"
      titleChips={season ? <RepChip tone={isLive ? 'good' : 'neutral'}>{season.name} · {isLive ? 'Live' : 'Closed'}</RepChip> : null}
      inlineActions
      actions={
        // THE VIEW MENU on a phone (the coach's, stage 2 · C1): the current view's glyph opening List, Week and Month in
        // a drawer titled View. Hidden above 640, where the line's switch leads instead.
        <span className={cal.viewPhone}>
          <CoachToolbarMenu label={`Change view · ${VIEW_WORD[view]}`} icon={<ViewGlyph size={20} aria-hidden />} variant="glyph" drawerOnPhone drawerTitle="View">
            {VIEWS.map(v => {
              const Glyph = VIEW_GLYPH[v];
              return <CoachToolbarMenuItem key={v} icon={<Glyph size={16} aria-hidden />} label={VIEW_WORD[v]} checked={view === v} onSelect={() => setView(v)} />;
            })}
          </CoachToolbarMenu>
        </span>
      }
    />
  );

  if (orgLoading || loading) return <PageLoading header={header} label="Loading this team’s schedule…" />;
  if (loadError || !team) {
    return (
      <div className={repKit.page}>
        {header}
        <LoadFailed title="We couldn’t load this team’s schedule." onRetry={() => { setLoading(true); void load(); }} />
      </div>
    );
  }
  if (!season) {
    return (
      <div className={repKit.page}>
        {header}
        <EmptyCard title="No season yet">A team’s schedule belongs to its season. Start {possessive(team.name)} first season from its team page.</EmptyCard>
      </div>
    );
  }

  // The date arrows — the coach's calendar-date steps (C6-01), never a clock; the touch Month's day stays on its grid.
  const step = (dir: -1 | 1) => {
    const next = stepScheduleCursor(view, cursor, dir);
    setCursor(next);
    setSelectedDay(chosen => chosenDayAfterStep(view, next, chosen, tournamentToday()));
  };
  const curWeek = mondayOfDay(cursor);
  const dateNav = view === 'list' ? null : <ScheduleDateNav view={view} cursor={cursor} onStep={step} />;

  return (
    <div className={repKit.page}>
      {header}
      <TwoOpenNote teamName={read!.team.name} seasons={read!.programYears} showingName={season.name} teamHref={teamBase} />

      {hasDecidedGames(record) && (
        <div className={repKit.recordRow}>
          <CoachCard>
            <CoachEyebrow>Season record</CoachEyebrow>
            <CoachFigure>{formatRecord(record)}</CoachFigure>
            <p className={kit.sub}>League and tournament games</p>
          </CoachCard>
        </div>
      )}

      {/* THE LINE (C4): the view switch leads (olive, Ask 13), the dates follow it wider than 900 px, the read-only
          sentence at its end. No Export (R7) and no create — every write is absent. */}
      <CoachListToolbar actions={<p className={styles.scheduleReadOnly}>{readOnlyWords(team.name)}</p>}>
        <span className={cal.viewDesk}>
          <CalendarViewSwitch views={VIEWS} value={view} onChange={setView} label="Show the schedule as" />
        </span>
        {view !== 'list' && <div className={coach.calNavOnLine}>{dateNav}</div>}
      </CoachListToolbar>
      {view !== 'list' && <div className={coach.calNavOwnRow}>{dateNav}</div>}

      {/* The coach's views, drawn read-only. The List scrolls in its own frame and opens on today (C3). */}
      {view === 'list' ? (
        <div ref={scrollerRef} className={`${coach.scheduleScroller} ${coach.scheduleListFrame}`}>
          <ScheduleListView data={viewData} canAddEvents={false} onAddEvent={() => {}} onHelp={() => {}} readOnlyEmptyText={emptyWords(team.name)} />
          <div ref={tailRef} className={styles.scheduleTail} aria-hidden />
        </div>
      ) : view === 'week' ? (
        <ScheduleWeekView data={viewData} curWeek={curWeek} />
      ) : (
        <ScheduleMonthView data={viewData} curMonth={cursor.slice(0, 7)} selectedDay={selectedDay} onSelectDay={setSelectedDay}
          onOpenDay={(day, dayEvents) => setDaySheet({ day, events: dayEvents })} />
      )}

      {/* "+N more" opens the day, as on the coach's Month: its events as the calendar's chips, each opening its read. */}
      {daySheet && (
        <KitDialog kind="form" eyebrow="Schedule" title={dayHeading(daySheet.day, tournamentToday())} onClose={() => setDaySheet(null)}>
          <div className={coach.calEventList}>
            {daySheet.events.map(e => (
              <ScheduleEventChip key={e.id} event={e} dayKey={daySheet.day} decor={{ ...decor, openEvent: ev => { setDaySheet(null); setSelected(ev); } }} />
            ))}
          </div>
        </KitDialog>
      )}

      {selected && (
        <KitDialog
          kind="form"
          eyebrow={selected.isScrimmage ? SCRIMMAGE_LABEL : EVENT_LABELS[selected.eventType]}
          title={selected.name}
          onClose={() => setSelected(null)}
        >
          <dl className={repKit.detailList}>
            <dt>When</dt>
            <dd>{eventWhenWords(selected.startsAt, selected.endsAt)}</dd>
            {selected.status === 'cancelled' && <><dt>Status</dt><dd>{STATE_WORDS.cancelled}</dd></>}
            {selected.location && <><dt>Where</dt><dd>{selected.location}</dd></>}
            {selected.opponent && <><dt>Opponent</dt><dd>{selected.opponent}{selected.homeAway ? ` · ${selected.homeAway === 'neutral' ? 'neutral site' : selected.homeAway}` : ''}</dd></>}
            {selected.teamScore != null && (
              <><dt>Score</dt><dd>{selected.teamScore}–{selected.opponentScore}{selected.result ? ` · ${resultWord(selected.result)}` : ''}</dd></>
            )}
            {selected.description && <><dt>Notes</dt><dd>{selected.description}</dd></>}
          </dl>
        </KitDialog>
      )}
    </div>
  );
}
