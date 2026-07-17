'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import {
  computeInsightFindings, summarizeDuesForFindings, ATTENDANCE_MIN_KNOWN, ATTENDANCE_FLAG_BELOW,
  type InsightFinding, type InsightReport, type FindingsGameSummary, type FindingsDuesSummary,
  type FindingsDuesRow,
} from '@/lib/insight-findings';
import styles from '../../../coaches.module.css';
import type { RepTeamEvent, RepPlayerAward } from '@/lib/types';
import type { SeasonLineupAnalytics } from '@/lib/lineup-season-analytics';
import { canManageAwards, canViewMeasurables } from '@/lib/coach-capabilities';

// ─────────────────────────────────────────────────────────────────────────────
// Insights V3 — "Scoreboard + What stands out" (design log 2026-07-09).
// Three regions, one direction, nothing ever expands in place:
//   1. Scoreboard band — the numbers a coach recites (blocks omit without data).
//   2. "What stands out" — the findings engine reads the reports FOR the coach.
//   3. Question-titled doorway tiles → full report pages (depth = navigation).
// Season-over-season comparisons are RETIRED (owner 2026-07-09) — every signal
// here is within-season. Gated sections vanish; sparse sections soften.
// ─────────────────────────────────────────────────────────────────────────────

const GAME_EVENT_TYPES = ['league_game', 'tournament_game', 'scrimmage'];
// Same categories + defaults + storage key as SeasonRecordWidget, so the band's
// record can never disagree with the Overview's record glance.
const WLT_DEFAULT: Record<string, boolean> = { league_game: true, tournament_game: true, scrimmage: false };
const WLT_LABEL: Record<string, string> = { league_game: 'League', tournament_game: 'Tournament', scrimmage: 'Scrimmage' };

interface AttendanceRow {
  playerId: string;
  playerFirstName: string;
  playerLastName: string;
  games: { attended: number; known: number };
  practices: { attended: number; known: number };
}
interface HistorySummary { pastSeasons: number; duesCollected: number | null; duesOutstanding: number | null }

function recStr(r: { w: number; l: number; t: number }) {
  return `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}`;
}
function tally(list: RepTeamEvent[]) {
  return {
    w: list.filter(e => e.result === 'win').length,
    l: list.filter(e => e.result === 'loss').length,
    t: list.filter(e => e.result === 'tie').length,
  };
}

export default function CoachesInsightsPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(paramsPromise);
  const { assignments, loading: ctxLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const sportPack = getSportPack(assignment?.teamSport ?? DEFAULT_SPORT);
  const periodsWord = sportPack.periodLabelPlural.toLowerCase();
  const scoreUnitWord = sportPack.score.unit.toLowerCase();

  const canLineups = !!assignment?.capabilities.lineups;
  const canRoster = !!assignment && assignment.capabilities.roster !== 'off';
  const canMoney = !!assignment && assignment.capabilities.money !== 'off';
  const canAwards = !!assignment && canManageAwards(assignment.capabilities);
  // Sixth doorway tile (3D, D4 Option B — logged ceiling exception): the report lists every
  // player by name, so it rides the board's identity gate (roster visibility).
  const canDevelopment = !!assignment && canViewMeasurables(assignment.capabilities);

  // "Who's earning it?" tile summary — a small self-contained fetch (not folded into the
  // scoreboard's load() below) so this addition can't disturb that orchestration's data shape.
  const [awardsSummary, setAwardsSummary] = useState<{ total: number; leaderName: string | null; leaderCount: number } | null>(null);
  useEffect(() => {
    if (!canAwards) return;
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/awards`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled || !data) return;
        const awards: RepPlayerAward[] = data.awards ?? [];
        const counts = new Map<string, number>();
        for (const a of awards) counts.set(a.playerId, (counts.get(a.playerId) ?? 0) + 1);
        let leaderId: string | null = null, leaderCount = 0;
        for (const [pid, c] of counts) if (c > leaderCount) { leaderId = pid; leaderCount = c; }
        const leader = leaderId ? awards.find(a => a.playerId === leaderId) : undefined;
        setAwardsSummary({ total: awards.length, leaderName: leader?.playerName ?? null, leaderCount });
      })
      .catch(() => { /* non-fatal — the tile just shows its sparse state */ });
    return () => { cancelled = true; };
  }, [canAwards, orgSlug, teamId]);

  // "Is everyone getting attention?" tile summary — same self-contained-fetch pattern as
  // the awards tile; rides the board GET (one dataset, several doors). 404 = no active
  // season → the tile just shows its sparse state.
  const [devSummary, setDevSummary] = useState<{ rosterCount: number; withMeasurable: number; withFocus: number } | null>(null);
  useEffect(() => {
    if (!canDevelopment) return;
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/development/board`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled || !data) return;
        const rows: { goals: { status: string }[]; latest: Record<string, unknown> }[] = data.rows ?? [];
        setDevSummary({
          rosterCount: rows.length,
          withMeasurable: rows.filter(r => Object.keys(r.latest ?? {}).length > 0).length,
          withFocus: rows.filter(r => (r.goals ?? []).some(g => g.status === 'working')).length,
        });
      })
      .catch(() => { /* non-fatal — the tile just shows its sparse state */ });
    return () => { cancelled = true; };
  }, [canDevelopment, orgSlug, teamId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<RepTeamEvent[]>([]);
  const [historySummary, setHistorySummary] = useState<HistorySummary>({ pastSeasons: 0, duesCollected: null, duesOutstanding: null });
  const [analytics, setAnalytics] = useState<SeasonLineupAnalytics | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[] | null>(null);
  const [duesStats, setDuesStats] = useState<FindingsDuesSummary | null>(null);
  // Local calendar date (not UTC) — feeds the dues-deadline rule's window math.
  const [todayISO, setTodayISO] = useState('');
  // A capability-permitted fetch that genuinely FAILED (network/500) must not read as
  // "no data yet" — its tile shows a quiet error instead of teach copy (honesty).
  const [srcErrors, setSrcErrors] = useState({ lineups: false, attendance: false, dues: false });
  // Guards the stale-team flash: the body renders as loading until data belongs to THIS team.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  // Record scope mirrors the Overview widget's remembered per-team choice.
  const [included, setIncluded] = useState<Record<string, boolean>>(WLT_DEFAULT);

  // ONE coordinated load → ONE paint (no staggered pop-in). Each source degrades
  // independently: a failed/denied fetch just means its blocks/tiles don't render.
  const load = useCallback(async (caps: { lineups: boolean; roster: boolean; money: boolean }) => {
    setLoading(true);
    setError('');
    // Record scope: the Overview widget's remembered per-team choice (read here, inside the
    // async load, so the band and the Overview glance can never disagree).
    try {
      const raw = localStorage.getItem(`flhq.coachWlt.${teamId}`);
      if (raw) setIncluded({ ...WLT_DEFAULT, ...JSON.parse(raw) });
    } catch { /* ignore unreadable storage */ }
    const api = `/api/coaches/${orgSlug}/teams/${teamId}`;
    const get = async (path: string) => {
      const res = await fetch(`${api}${path}`);
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    };
    const [ev, hi, an, at, du] = await Promise.allSettled([
      get('/events'),
      get('/history'),
      caps.lineups ? get('/lineup-analytics') : Promise.reject(new Error('skipped')),
      caps.roster ? get('/attendance') : Promise.reject(new Error('skipped')),
      caps.money ? get('/dues') : Promise.reject(new Error('skipped')),
    ]);
    if (ev.status === 'fulfilled') setEvents(ev.value.events ?? []);
    if (hi.status === 'fulfilled') {
      const acct = hi.value.current?.accounting ?? null;
      setHistorySummary({
        pastSeasons: (hi.value.history ?? []).length,
        duesCollected: acct ? acct.duesCollected : null,
        duesOutstanding: acct ? acct.duesOutstanding : null,
      });
    }
    if (an.status === 'fulfilled') setAnalytics(an.value.analytics ?? null);
    if (at.status === 'fulfilled') setAttendanceRows(at.value.players ?? []);
    if (du.status === 'fulfilled') {
      const players: FindingsDuesRow[] = du.value.players ?? [];
      // Local calendar date (never UTC) — summarizeDuesForFindings is the ONE shared shaping
      // (dashboard + weekly digest), midnight-truncated so a due-today installment isn't overdue.
      const now = new Date();
      const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      setTodayISO(localToday);
      setDuesStats(summarizeDuesForFindings(players, localToday));
    }
    // A permitted-but-failed source is an ERROR state, not an honest empty (a 'skipped'
    // rejection is the capability gate, not a failure).
    const realFailure = (r: PromiseSettledResult<unknown>, wanted: boolean) =>
      wanted && r.status === 'rejected' && (r.reason as Error | undefined)?.message !== 'skipped';
    setSrcErrors({
      lineups: realFailure(an, caps.lineups),
      attendance: realFailure(at, caps.roster),
      dues: realFailure(du, caps.money),
    });
    // Only a total blackout is a page error — partial data renders what it can.
    if (ev.status === 'rejected' && hi.status === 'rejected') {
      setError('Insights couldn’t be loaded — refresh to try again.');
    }
    setLoadedFor(teamId);
    setLoading(false);
  }, [orgSlug, teamId]);

  useEffect(() => {
    if (ctxLoading || !assignment) return;
    void Promise.resolve().then(() => load({ lineups: canLineups, roster: canRoster, money: canMoney }));
  }, [ctxLoading, assignment, canLineups, canRoster, canMoney, load]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  // ── Scoreboard math (within-season only; unscored games never count) ──
  const finalized = events
    .filter(e => GAME_EVENT_TYPES.includes(e.eventType) && e.status !== 'cancelled' && e.result)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  const scoped = finalized.filter(e => included[e.eventType]);
  const record = tally(scoped);
  const scopedGames = record.w + record.l + record.t;
  const activeLabels = GAME_EVENT_TYPES.filter(t => included[t]).map(t => WLT_LABEL[t]);
  const scopeCaption = activeLabels.length === 0
    ? 'No categories selected'
    : activeLabels.length === GAME_EVENT_TYPES.length ? 'All games' : activeLabels.join(' + ');

  const last5 = scoped.slice(0, 5).reverse(); // oldest → newest
  let streakCount = 0;
  const streakType = (scoped[0]?.result ?? null) as 'win' | 'loss' | 'tie' | null;
  for (const g of scoped) { if (g.result === streakType) streakCount += 1; else break; }
  const streakLabel = streakType && streakCount > 0
    ? `${streakType === 'win' ? 'Won' : streakType === 'loss' ? 'Lost' : 'Tied'} ${streakCount}${streakCount > 1 ? ' straight' : ''}`
    : '';

  const scoredGames = scoped.filter(e => e.teamScore != null && e.opponentScore != null);
  const scoredFor = scoredGames.reduce((s, e) => s + (e.teamScore ?? 0), 0);
  const scoredAgainst = scoredGames.reduce((s, e) => s + (e.opponentScore ?? 0), 0);
  const diff = scoredFor - scoredAgainst;

  const close = tally(scoredGames.filter(e => Math.abs((e.teamScore ?? 0) - (e.opponentScore ?? 0)) === 1));
  const closeTotal = close.w + close.l + close.t;

  const knownSide = scoped.filter(e => e.homeAway === 'home' || e.homeAway === 'away');
  const homeGames = knownSide.filter(e => e.homeAway === 'home');
  const homeRec = tally(homeGames);
  const gamesSummary: FindingsGameSummary = {
    wins: record.w, losses: record.l, ties: record.t,
    streakType, streakCount,
    home: knownSide.length > 0 ? { wins: homeRec.w, losses: homeRec.l, ties: homeRec.t, games: homeGames.length } : null,
    awayLosses: knownSide.filter(e => e.homeAway === 'away' && e.result === 'loss').length,
    recentResults: scoped.slice(0, 10).map(e => e.result as 'win' | 'loss' | 'tie'),
  };

  // ── Attendance rollup (known excludes no-reply upstream; 0/0 never judged; the team %
  // needs the same minimum sample the findings engine demands — one session isn't a rate) ──
  const attTotals = (attendanceRows ?? []).reduce(
    (acc, r) => ({
      attended: acc.attended + r.games.attended + r.practices.attended,
      known: acc.known + r.games.known + r.practices.known,
    }),
    { attended: 0, known: 0 },
  );
  const attendancePct = attTotals.known >= ATTENDANCE_MIN_KNOWN ? Math.round((attTotals.attended / attTotals.known) * 100) : null;
  // Same 60% bar as the findings engine (shared constant) so the tile and the strip agree.
  const attendanceBelow = (attendanceRows ?? [])
    .map(r => ({ known: r.games.known + r.practices.known, attended: r.games.attended + r.practices.attended }))
    .filter(r => r.known >= ATTENDANCE_MIN_KNOWN && r.attended / r.known < ATTENDANCE_FLAG_BELOW).length;
  const attendanceBarPct = Math.round(ATTENDANCE_FLAG_BELOW * 100);

  // ── Dues headline (server-computed season totals; money-gated upstream) ──
  const duesDenom = (historySummary.duesCollected ?? 0) + (historySummary.duesOutstanding ?? 0);
  const duesPct = historySummary.duesCollected != null && duesDenom > 0
    ? Math.round((historySummary.duesCollected / duesDenom) * 100)
    : null;
  const fmtMoney = (n: number) => `$${Math.round(n).toLocaleString('en-CA')}`;

  // ── The findings ──
  const findings: InsightFinding[] = computeInsightFindings({
    vocab: { periodsWord, scoreUnitWord },
    analytics,
    games: scopedGames > 0 ? gamesSummary : null,
    attendance: attendanceRows?.map(r => ({
      name: `${r.playerFirstName} ${r.playerLastName}`.trim(),
      games: { attended: r.games.attended, known: r.games.known },
      practices: { attended: r.practices.attended, known: r.practices.known },
    })) ?? null,
    dues: duesStats,
    // FindingsDevelopmentSummary reads only rosterCount + withMeasurable (the extra withFocus
    // field is harmless); pass the summary straight through.
    development: canDevelopment ? devSummary : null,
    todayISO: todayISO || undefined,
  });
  const REPORT_HREF: Record<InsightReport, string> = {
    'playing-time': `${base}/history/playing-time`,
    results: `${base}/history/results`,
    attendance: `${base}/attendance`,
    money: `${base}/accounting`,
    development: `${base}/history/development`,
  };
  const REPORT_CHIP: Record<InsightReport, string> = {
    'playing-time': 'Playing time', results: 'Results', attendance: 'Attendance', money: 'Money',
    development: 'Development',
  };

  const overCapCount = analytics ? analytics.armCare.filter(r => r.overCapGames > 0).length : 0;
  const hasBand = scopedGames > 0 || last5.length > 0 || scoredGames.length > 0 || attendancePct != null || duesPct != null;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><BarChart3 size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>Insights</h1>
            <p className={styles.pageSub}>{assignment.teamName} — how your season is going</p>
          </div>
        </div>
      </div>

      {loading || loadedFor !== teamId ? (
        <div className={styles.loadingState}>Loading insights…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : (
        <>
          {/* ── 1 · Season scoreboard band ── */}
          {hasBand ? (
            <div className={styles.insightsBand}>
              {scopedGames > 0 && (
                <div className={styles.insightsStat}>
                  <p className={styles.insightsStatLbl}>Record</p>
                  <p className={styles.insightsStatVal}>{recStr(record)}</p>
                  <p className={styles.insightsStatCap}>{scopeCaption}</p>
                </div>
              )}
              {last5.length > 0 && (
                <div className={styles.insightsStat}>
                  <p className={styles.insightsStatLbl}>Form</p>
                  <span className={styles.wltFormPips} aria-label="Recent form, oldest to newest">
                    {last5.map((g, i) => (
                      <span key={i} className={styles.wltPip} data-r={g.result ?? undefined}>
                        {g.result === 'win' ? 'W' : g.result === 'loss' ? 'L' : 'T'}
                      </span>
                    ))}
                  </span>
                  {streakLabel && <p className={styles.insightsStatCap}>{streakLabel}</p>}
                </div>
              )}
              {scoredGames.length > 0 && (
                <div className={styles.insightsStat}>
                  <p className={styles.insightsStatLbl}>{sportPack.score.diff}</p>
                  <p className={styles.insightsStatVal} data-pos={diff >= 0 ? 'true' : 'false'}>{diff >= 0 ? `+${diff}` : diff}</p>
                  <span className={styles.insightsSegBar} aria-hidden><i style={{ width: `${Math.round((scoredFor / Math.max(1, scoredFor + scoredAgainst)) * 100)}%` }} /></span>
                  <p className={styles.insightsStatCap}>{scoredFor} scored · {scoredAgainst} allowed</p>
                </div>
              )}
              {closeTotal > 0 && (
                <div className={styles.insightsStat}>
                  <p className={styles.insightsStatLbl}>Close games</p>
                  <p className={styles.insightsStatVal}>{recStr(close)}</p>
                  <p className={styles.insightsStatCap}>in one-{scoreUnitWord} games</p>
                </div>
              )}
              {attendancePct != null && (
                <div className={styles.insightsStat}>
                  <p className={styles.insightsStatLbl}>Attendance</p>
                  <p className={styles.insightsStatVal}>{attendancePct}<small>%</small></p>
                  <p className={styles.insightsStatCap}>games + practices</p>
                </div>
              )}
              {duesPct != null && (
                <div className={styles.insightsStat}>
                  <p className={styles.insightsStatLbl}>Dues</p>
                  <p className={styles.insightsStatVal}>{duesPct}<small>%</small></p>
                  <span className={styles.insightsSegBar} aria-hidden><i style={{ width: `${duesPct}%` }} /></span>
                  <p className={styles.insightsStatCap}>{fmtMoney(historySummary.duesCollected ?? 0)} of {fmtMoney(duesDenom)} collected</p>
                </div>
              )}
            </div>
          ) : (
            <p className={styles.insightsCalm}>Play a few games and your season scoreboard shows up here — record, form, {scoreUnitWord} difference and more.</p>
          )}

          {/* ── 2 · What stands out ── */}
          <section className={styles.insightsCallouts} aria-labelledby="insights-standout">
            <p className={styles.sectionKicker} id="insights-standout" style={{ margin: '0 0 0.6rem' }}>What stands out</p>
            {findings.length === 0 ? (
              <p className={styles.insightsCoQuiet}>Nothing stands out yet — as you log games, lineups and attendance, this is where we&apos;ll flag what&apos;s worth knowing.</p>
            ) : (
              findings.map((f, i) => (
                <Link key={i} href={REPORT_HREF[f.report]} className={styles.insightsCo}>
                  <span className={styles.insightsCoDot} data-tone={f.tone} aria-hidden />
                  <span className={styles.insightsCoText}>{f.text}</span>
                  <span className={styles.insightsCoChip}>{REPORT_CHIP[f.report]} →</span>
                </Link>
              ))
            )}
          </section>

          {/* ── 3 · Report doorways (depth is always a page, never an expansion) ── */}
          <div className={styles.insightsDoors}>
            <Link href={`${base}/history/results`} className={`${styles.insightsDoor} ${finalized.length === 0 ? styles.insightsDoorSoft : ''}`}>
              <span className={styles.insightsDoorQ}>How are we doing?<span aria-hidden>→</span></span>
              <span className={styles.insightsDoorSum}>
                {/* Scoped record only when the scope actually holds results — otherwise a real
                    count, never a fabricated "0-0" (results may exist outside the record scope). */}
                {scopedGames > 0
                  ? `${recStr(record)} this season · ${historySummary.pastSeasons} past season${historySummary.pastSeasons === 1 ? '' : 's'} on file`
                  : finalized.length > 0
                    ? `${finalized.length} result${finalized.length === 1 ? '' : 's'} this season · ${historySummary.pastSeasons} past season${historySummary.pastSeasons === 1 ? '' : 's'} on file`
                    : 'First season under way — your first result shows up here'}
              </span>
            </Link>
            {canLineups && (
              <Link href={`${base}/history/playing-time`} className={`${styles.insightsDoor} ${!analytics || analytics.gamesWithLineup === 0 ? styles.insightsDoorSoft : ''}`}>
                <span className={styles.insightsDoorQ}>Is playing time fair?<span aria-hidden>→</span></span>
                <span className={styles.insightsDoorSum}>
                  {srcErrors.lineups
                    ? 'Couldn’t load — refresh to try again'
                    : analytics && analytics.gamesWithLineup > 0
                      ? `${analytics.gamesWithLineup} lineup${analytics.gamesWithLineup === 1 ? '' : 's'} saved${overCapCount > 0 ? ` · ${overCapCount} arm-care flag${overCapCount === 1 ? '' : 's'}` : ''}`
                      : 'Save your first lineup to start tracking playing time'}
                </span>
              </Link>
            )}
            {canRoster && (
              <Link href={`${base}/attendance`} className={`${styles.insightsDoor} ${attendancePct == null ? styles.insightsDoorSoft : ''}`}>
                <span className={styles.insightsDoorQ}>Who shows up?<span aria-hidden>→</span></span>
                <span className={styles.insightsDoorSum}>
                  {srcErrors.attendance
                    ? 'Couldn’t load — refresh to try again'
                    : attendancePct != null
                      ? `${attendancePct}% team rate${attendanceBelow > 0 ? ` · ${attendanceBelow} player${attendanceBelow === 1 ? '' : 's'} below ${attendanceBarPct}%` : ''}`
                      : 'Take attendance at a practice or game to start'}
                </span>
              </Link>
            )}
            {canMoney && (
              <Link href={`${base}/accounting`} className={`${styles.insightsDoor} ${duesPct == null ? styles.insightsDoorSoft : ''}`}>
                <span className={styles.insightsDoorQ}>Where&apos;s the money?<span aria-hidden>→</span></span>
                <span className={styles.insightsDoorSum}>
                  {srcErrors.dues
                    ? 'Couldn’t load — refresh to try again'
                    : duesPct != null
                      ? `${duesPct}% collected${duesStats && duesStats.neverPaidCount > 0 ? ` · ${duesStats.neverPaidCount} never paid` : ''} — in Money`
                      : 'Set up dues in Money to track collections'}
                </span>
              </Link>
            )}
            {canAwards && (
              <Link href={`${base}/history/awards`} className={`${styles.insightsDoor} ${!awardsSummary || awardsSummary.total === 0 ? styles.insightsDoorSoft : ''}`}>
                <span className={styles.insightsDoorQ}>Who&apos;s earning it?<span aria-hidden>→</span></span>
                <span className={styles.insightsDoorSum}>
                  {awardsSummary && awardsSummary.total > 0
                    ? `${awardsSummary.total} award${awardsSummary.total === 1 ? '' : 's'} given${awardsSummary.leaderName ? ` · ${awardsSummary.leaderName.split(' ')[0]} leads with ${awardsSummary.leaderCount}` : ''}`
                    : 'Give your first award after a game to start the leaderboard'}
                </span>
              </Link>
            )}
            {/* Sixth tile (3D, D4 Option B — owner-sanctioned exception to the 5-tile
                ceiling, logged in design decisions 2026-07-17). */}
            {canDevelopment && (
              <Link href={`${base}/history/development`} className={`${styles.insightsDoor} ${!devSummary || devSummary.withMeasurable === 0 ? styles.insightsDoorSoft : ''}`}>
                <span className={styles.insightsDoorQ}>Is everyone getting attention?<span aria-hidden>→</span></span>
                <span className={styles.insightsDoorSum}>
                  {devSummary && (devSummary.withMeasurable > 0 || devSummary.withFocus > 0)
                    ? `${devSummary.withMeasurable} of ${devSummary.rosterCount} player${devSummary.rosterCount === 1 ? '' : 's'} have a measurable · ${devSummary.withFocus} with an active focus area`
                    : 'Run an evaluation session or add a focus area to start the coverage picture'}
                </span>
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
