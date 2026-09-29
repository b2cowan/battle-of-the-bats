'use client';
/**
 * Rep Teams › a team › Schedule — READ-ONLY, on the team's live season (Club Tier Stage 2: the rail's
 * team block, specimen 2). The club reads the schedule the coach writes (ruling D3: the admin never
 * writes a team's schedule). It moved here from the season page: the club works on the team's live
 * season, never a year it picks; a team with no live season shows its last closed season as a record.
 *
 * Not drawn in the Stage 2 hub — built to the same benchmark: the portal's page header (back to the
 * team), the season record as a kit card, the three views as a segmented lens, every date and time in
 * the org's zone through the house clock (the old page read the DEVICE's zone), and an event's details
 * in the kit's window rather than the legacy slide-over.
 */
import { use, useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Dumbbell, Shield, Trophy, Users } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { CoachCard, CoachEyebrow, CoachFigure, CoachListToolbar, kit } from '@/components/coaches/kit';
import {
  EmptyCard, LoadFailed, PageLoading, RepChip, repKit, TwoOpenNote, useDeferredLoad, useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import { usePublishRailTeam } from '@/components/admin/kit/useRailTeam';
import { SCRIMMAGE_LABEL, EVENT_COLORS } from '@/lib/coach-schedule-vocab';
import { formatInOrgZone, orgDayKey, tournamentToday } from '@/lib/timezone';
import { orgClock, orgWeekdayDay } from '@/lib/club-board-view';
import { formatRecord } from '@/lib/coach-season-record';
import { hasDecidedGames, seasonRecordOf } from '@/lib/team-season-figures';
import { latestClosedSeasonOf, liveSeasonOf } from '@/lib/season-live';
import styles from '../../../rep-teams.module.css';
import type { RepEventType, RepProgramYear, RepTeam, RepTeamEvent } from '@/lib/types';

const EVENT_LABELS: Record<RepEventType, string> = {
  external_tournament: 'Tournament',
  tournament_game: 'Game (Tournament)',
  league_game: 'Game',
  practice: 'Practice',
  team_event: 'Team event',
};
const EVENT_ICONS: Record<RepEventType, React.ElementType> = {
  external_tournament: Trophy, tournament_game: Trophy, league_game: Shield, practice: Dumbbell, team_event: Users,
};
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
type ViewMode = 'list' | 'week' | 'month';

/** Add days to a YYYY-MM-DD calendar date (no zone in it — pure arithmetic on the date). */
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function mondayOf(date: string): string {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -((dow + 6) % 7));
}
const monthLabel = (ym: string) => formatInOrgZone(`${ym}-15T12:00:00Z`, { month: 'long', year: 'numeric' });
const shortDay = (date: string) => formatInOrgZone(`${date}T12:00:00Z`, { month: 'short', day: 'numeric' });

function resultWord(e: RepTeamEvent): string | null {
  return e.result === 'win' ? 'Won' : e.result === 'loss' ? 'Lost' : e.result === 'tie' ? 'Tied' : null;
}

function EventChip({ event, onClick }: { event: RepTeamEvent; onClick: () => void }) {
  const color = EVENT_COLORS[event.eventType];
  const Icon = EVENT_ICONS[event.eventType];
  const cancelled = event.status === 'cancelled';
  const result = resultWord(event);
  return (
    <button type="button" className={`${styles.eventChip}${cancelled ? ` ${repKit.eventCancelled}` : ''}`} style={{ borderLeftColor: color }} onClick={onClick}>
      <Icon size={12} style={{ color, flexShrink: 0 }} aria-hidden />
      <span className={styles.eventChipTime}>{orgWeekdayDay(event.startsAt)} · {orgClock(event.startsAt)}</span>
      <span className={styles.eventChipName}>{event.name}</span>
      {cancelled ? <RepChip tone="warn">Cancelled</RepChip> : result && <RepChip tone={event.result === 'win' ? 'good' : event.result === 'loss' ? 'bad' : 'neutral'}>{result}</RepChip>}
    </button>
  );
}

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
  const [selected, setSelected] = useState<RepTeamEvent | null>(null);

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
  const byDay = useMemo(() => {
    const m = new Map<string, RepTeamEvent[]>();
    for (const e of [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
      const k = orgDayKey(e.startsAt);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [events]);

  const header = (
    <AdminPageHeader
      backTo={{ href: teamBase, label: team?.name ?? 'Team' }}
      crumbs={[{ label: 'Rep Teams' }, team?.groupName ? { label: team.groupName } : null]}
      title="Schedule"
      titleChips={season ? <RepChip tone={isLive ? 'good' : 'neutral'}>{season.name} · {isLive ? 'Live' : 'Closed'}</RepChip> : null}
    />
  );

  if (orgLoading || loading) return <PageLoading header={header} />;
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
        <EmptyCard title="No season yet">A team’s schedule belongs to its season. Start {team.name}’s first season from its team page.</EmptyCard>
      </div>
    );
  }

  const monthKeys = [...new Set([...byDay.keys()].map(k => k.slice(0, 7)))].sort();
  const weekStart = mondayOf(cursor);
  const ym = cursor.slice(0, 7);

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

      <CoachListToolbar
        lede={`Read-only — ${team.name}’s coaches keep the schedule in their Coaches Portal.`}
        actions={
          <div className={repKit.views} role="group" aria-label="Show the schedule as">
            {(['list', 'week', 'month'] as ViewMode[]).map(v => (
              <button key={v} type="button" className={`${repKit.view}${view === v ? ` ${repKit.viewOn}` : ''}`} aria-pressed={view === v} onClick={() => setView(v)}>
                {v === 'list' ? 'List' : v === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        }
      />

      {view !== 'list' && (
        <div className={styles.calNav}>
          <button type="button" className={styles.calNavBtn} onClick={() => setCursor(view === 'month' ? addDays(`${ym}-01`, -1).slice(0, 7) + '-01' : addDays(cursor, -7))} aria-label="Earlier">
            <ChevronLeft size={16} aria-hidden />
          </button>
          <span className={styles.calNavLabel}>
            {view === 'month' ? monthLabel(ym) : `${shortDay(weekStart)} – ${shortDay(addDays(weekStart, 6))}`}
          </span>
          <button type="button" className={styles.calNavBtn} onClick={() => setCursor(view === 'month' ? addDays(`${ym}-28`, 7).slice(0, 7) + '-01' : addDays(cursor, 7))} aria-label="Later">
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      )}

      {events.length === 0 && view === 'list' ? (
        <EmptyCard title="Nothing scheduled">{team.name}’s coaches add games, practices and events in their Coaches Portal; they show here as they do.</EmptyCard>
      ) : view === 'list' ? (
        monthKeys.map(mk => (
          <div key={mk} className={styles.calMonthGroup}>
            <div className={styles.calMonthLabel}>{monthLabel(mk)}</div>
            <div className={styles.calEventList}>
              {[...byDay.entries()].filter(([k]) => k.startsWith(mk)).flatMap(([, list]) => list)
                .map(e => <EventChip key={e.id} event={e} onClick={() => setSelected(e)} />)}
            </div>
          </div>
        ))
      ) : view === 'week' ? (
        <div className={styles.calWeekGrid}>
          {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map(day => (
            <div key={day} className={styles.calWeekDay}>
              <div className={styles.calWeekDayLabel}>{DAYS[new Date(`${day}T12:00:00Z`).getUTCDay()]} {shortDay(day)}</div>
              <div className={styles.calWeekDayEvents}>
                {(byDay.get(day) ?? []).length === 0
                  ? <span className={styles.calWeekEmpty}>—</span>
                  : (byDay.get(day) ?? []).map(e => <EventChip key={e.id} event={e} onClick={() => setSelected(e)} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.calMonthGrid}>
          {DAYS.map(d => <div key={d} className={styles.calMonthHeader}>{d}</div>)}
          {(() => {
            const first = `${ym}-01`;
            const pad = new Date(`${first}T12:00:00Z`).getUTCDay();
            const cells: (string | null)[] = [...Array(pad).fill(null)];
            for (let d = first; d.startsWith(ym); d = addDays(d, 1)) cells.push(d);
            while (cells.length % 7 !== 0) cells.push(null);
            const today = tournamentToday();
            return cells.map((day, i) => day == null ? <div key={`pad-${i}`} className={styles.calMonthCell} /> : (
              <div key={day} className={`${styles.calMonthCell}${day === today ? ` ${styles.calMonthCellToday}` : ''}`}>
                <span className={styles.calMonthDayNum}>{Number(day.slice(8))}</span>
                <div className={styles.calMonthDayEvents}>
                  {(byDay.get(day) ?? []).slice(0, 3).map(e => (
                    <button key={e.id} type="button" className={styles.calMonthEventDot} style={{ background: EVENT_COLORS[e.eventType] }} title={e.name} onClick={() => setSelected(e)}>
                      {e.name.slice(0, 14)}
                    </button>
                  ))}
                  {(byDay.get(day) ?? []).length > 3 && <span className={styles.calMonthMoreDots}>+{(byDay.get(day) ?? []).length - 3} more</span>}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {selected && (
        <KitDialog
          kind="form"
          eyebrow={selected.isScrimmage ? SCRIMMAGE_LABEL : EVENT_LABELS[selected.eventType]}
          title={selected.name}
          onClose={() => setSelected(null)}
          footer={<button type="button" className="btn btn-outline" onClick={() => setSelected(null)}>Done</button>}
        >
          <dl className={repKit.detailList}>
            <dt>When</dt>
            <dd>{orgWeekdayDay(selected.startsAt)} · {orgClock(selected.startsAt)}{selected.endsAt ? ` – ${orgClock(selected.endsAt)}` : ''}</dd>
            {selected.location && <><dt>Where</dt><dd>{selected.location}</dd></>}
            {selected.opponent && <><dt>Opponent</dt><dd>{selected.opponent}{selected.homeAway ? ` · ${selected.homeAway === 'neutral' ? 'neutral site' : selected.homeAway}` : ''}</dd></>}
            {selected.teamScore != null && (
              <><dt>Score</dt><dd>{selected.teamScore}–{selected.opponentScore}{resultWord(selected) ? ` · ${resultWord(selected)}` : ''}</dd></>
            )}
            {selected.status === 'cancelled' && <><dt>Status</dt><dd>Cancelled</dd></>}
            {selected.description && <><dt>Notes</dt><dd>{selected.description}</dd></>}
          </dl>
        </KitDialog>
      )}
    </div>
  );
}
