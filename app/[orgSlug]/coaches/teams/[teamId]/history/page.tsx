'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachAskBar from '@/components/coaches/CoachAskBar';
import { askReportHref } from '@/lib/coach-ask-questions';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
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
import { hasMeetings, hasBookContent } from '@/lib/coach-opponents';

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
  /**
   * ⚠⚠ WHICH SEASON — the team's WORKING one, which for a team between seasons is a finished one.
   *
   * This page held NO season resolver at all, and its live-assignment check fired first — so a
   * coach with no live season hit a "Team not found" wall on the hub describing the season they
   * ran themselves. The SEASON decides what this page describes; WHO is reading decides only what
   * they may open, and the API is the authority on that.
   */
  const page = useCoachSeasonPage(orgSlug, teamId);
  const caps = page.capabilities;
  const isRecord = page.isReadOnly;
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const sportPack = getSportPack(page.teamSport ?? DEFAULT_SPORT);
  const periodsWord = sportPack.periodLabelPlural.toLowerCase();
  const scoreUnitWord = sportPack.score.unit.toLowerCase();
  /** "that season" vs "this season" — said in several summary lines; decided once. */
  const seasonWord = isRecord ? 'that season' : 'this season';

  /**
   * ⚠⚠ HIDDEN ON A FINISHED SEASON, AND THE GATE IS THE FETCH AS WELL AS THE TILE. Playing-time
   * analytics were ruled live-season-only PERMANENTLY (owner, 2026-08-16): the figures are
   * RECOMPUTED from saved lineups every time the report is opened, so what it would show for a
   * finished season is what today's code makes of that season's lineups — not what the coach read
   * at the time. `lineup-analytics` therefore serves the live season only, and asking it here
   * would answer with THIS season's numbers under a finished season's heading. A tile hidden over
   * a fetch still made is how that number leaks into a finding.
   *
   * ⚠ The ruling's build-enforced home is `tests/unit/coach-history-endpoint-guard.test.ts`, which
   * fails if that route ever learns to serve a season it was handed. Reversing it needs a new
   * owner ruling AND an answer to the recomputation problem — not an edit here.
   */
  const canLineups = !isRecord && !!caps?.lineups;
  /**
   * ⚠ A1 (2026-08-03): this WAS one `canRoster` flag reading roster visibility, and it did two
   * jobs — deciding whether to fetch the attendance report, and whether to offer the door to it.
   * Both now belong to the attendance duty, because that is what the report gates on. Keeping a
   * record-access flag here would have fetched a 403 and drawn a door onto it.
   */
  const canAttendance = !!caps?.attendance;
  const canMoney = !!caps && caps.money !== 'off';
  const canAwards = !!caps && canManageAwards(caps);
  // Sixth doorway tile (3D, D4 Option B — logged ceiling exception): the report lists every
  // player by name, so it rides the board's own gate — record access since A1.
  const canDevelopment = !!caps && canViewMeasurables(caps);

  /**
   * "Who's earning it?" tile summary — a small self-contained fetch (not folded into the
   * scoreboard's load() below) so this addition can't disturb that orchestration's data shape.
   *
   * ⚠ THE RESET IS NOT DECORATION (Phase 2). These three tile fetches sit OUTSIDE the `loadedFor`
   * gate that hides the rest of the body while a season lands, so without clearing first, a season
   * switch leaves the previous year's summary sitting under the new year's chip until the new
   * response arrives — a wrong number presented confidently, which is this rail's whole defect
   * class. Clearing shows the tile's sparse state for a moment instead: absent reads as absent.
   */
  const [awardsSummary, setAwardsSummary] = useState<{ total: number; leaderName: string | null; leaderCount: number } | null>(null);
  useEffect(() => {
    setAwardsSummary(null);
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
    setDevSummary(null);
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

  /**
   * "Who are we up against?" tile summary — same self-contained-fetch pattern as the awards tile.
   * Gated on schedule (the book's own open-contribution gate), never record access.
   *
   * ⚠⚠ HIDDEN ON A FINISHED SEASON, by a standing owner ruling this phase re-confirmed rather
   * than reopened. The scouting book is an INSTRUMENT (owner 2026-08-04, ratified again
   * 2026-08-16): it reads every season's games to prepare for the LIVE one, and a build-enforced
   * test in `coach-history-endpoint-guard.test.ts` fails the moment it learns to answer for a
   * season it was handed. A book note written last week is not what the coach saw two years ago.
   * The per-season facts a coach wants from it — who we played, what the score was — are already
   * behind the results and schedule doors.
   */
  const canScouting = !isRecord && !!caps?.schedule;
  const [oppSummary, setOppSummary] = useState<{ total: number; withBook: number } | null>(null);
  useEffect(() => {
    setOppSummary(null);
    if (!canScouting) return;
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/opponents`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled || !data) return;
        const entries: { summary: string | null; observationCount: number; meetings: unknown[] }[] = data.opponents ?? [];
        setOppSummary({
          total: entries.filter(hasMeetings).length,
          withBook: entries.filter(hasBookContent).length,
        });
      })
      .catch(() => { /* non-fatal — the tile just shows its sparse state */ });
    return () => { cancelled = true; };
  }, [canScouting, orgSlug, teamId]);

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
  /**
   * Guards the stale flash: the body renders as loading until the data belongs to THIS team.
   *
   * ⚠ The key was `${teamId}|${seasonQuery}` while a season switcher could rewrite this page's own
   * URL without remounting it. That trigger is gone (P2, 2026-08-16), and the composite key went
   * with it — but the TEAM half is still real: this is a client component that survives a team
   * switch, so a slow response for the old team could still paint over the new one.
   */
  const loadKey = teamId;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  // Record scope mirrors the Overview widget's remembered per-team choice.
  const [included, setIncluded] = useState<Record<string, boolean>>(WLT_DEFAULT);

  // ONE coordinated load → ONE paint (no staggered pop-in). Each source degrades
  // independently: a failed/denied fetch just means its blocks/tiles don't render.
  // ⚠ A1 (2026-08-03): the middle flag was named `roster` and carried roster visibility, because
  // that is what the attendance route used to gate on. It gates on the attendance grant now, so a
  // stale name here would have fetched `/attendance` for anyone with record access and reported the
  // resulting 403 as a genuine failure — "couldn't be loaded" for a section they simply don't have.
  /**
   * ⚠⚠ EVERY WRITE IS GUARDED, not just the render.
   *
   * `loadedFor` guards what is PAINTED; it does not guard what is WRITTEN. A superseded run's
   * response landing last stamps ITS key into `loadedFor` — the correct scoreboard already on
   * screen reverts to "Loading insights…" and STAYS there, because nothing in the effect's deps
   * has changed so it never re-fires. A page that paints the right answer and then takes it away
   * for good.
   *
   * ⚠ The season switcher was the trigger that made this reachable, and it is deleted — but the
   * guard stays, because a team switch and a refresh race the same way. Same `isStale()` shape the
   * results page, the Lineups hub and the Practice hub all carry.
   */
  /**
   * ⚠ The gate object is `gate`, NOT `caps` (/simplify 2026-08-16). This parameter has always been
   * a narrow three-boolean fetch gate, but the page now also holds `caps` = the SEASON's full
   * capability object — and three of its field names coincide (`lineups`, `attendance`, `money`).
   * Sharing the name meant code moved into or out of this callback would silently read the wrong
   * object with no type error, which is the season-blindness this whole rail exists to end.
   */
  const load = useCallback(async (
    gate: { lineups: boolean; attendance: boolean; money: boolean },
    isStale: () => boolean = () => false,
  ) => {
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
      // ⚠ `history` is the CROSS-SEASON summary — it spans every year the team has played, and
      // the scrapbook belongs to the team rather than to the season on screen. Everything beside it
      // resolves the working season server-side; none of these carry a year, and none may.
      get(`/events`),
      get('/history'),
      gate.lineups ? get('/lineup-analytics') : Promise.reject(new Error('skipped')),
      gate.attendance ? get(`/attendance`) : Promise.reject(new Error('skipped')),
      gate.money ? get(`/dues`) : Promise.reject(new Error('skipped')),
    ]);
    // ⚠ Nothing below this line may write for a run that has been superseded — see the block
    // comment above. The whole batch is checked once, here, rather than per-source: a partial
    // write from a stale run is the same wrong-season paint as a full one.
    if (isStale()) return;
    // ⚠ CLEARED, not left alone, when a source is refused or skipped. Leaving the previous
    // season's rows in state while `loadedFor` advances puts the WRONG season's numbers under the
    // right season's chip, with no error anywhere — the sibling defect `/review` found on the
    // results page. Absent data must read as absent.
    setEvents(ev.status === 'fulfilled' ? ev.value.events ?? [] : []);
    if (hi.status === 'fulfilled') {
      const acct = hi.value.current?.accounting ?? null;
      setHistorySummary({
        pastSeasons: (hi.value.history ?? []).length,
        duesCollected: acct ? acct.duesCollected : null,
        duesOutstanding: acct ? acct.duesOutstanding : null,
      });
    } else {
      setHistorySummary({ pastSeasons: 0, duesCollected: null, duesOutstanding: null });
    }
    setAnalytics(an.status === 'fulfilled' ? an.value.analytics ?? null : null);
    setAttendanceRows(at.status === 'fulfilled' ? at.value.players ?? [] : null);
    if (du.status !== 'fulfilled') {
      setDuesStats(null);
    } else {
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
      lineups: realFailure(an, gate.lineups),
      attendance: realFailure(at, gate.attendance),
      dues: realFailure(du, gate.money),
    });
    // Only a total blackout is a page error — partial data renders what it can.
    if (ev.status === 'rejected' && hi.status === 'rejected') {
      setError('Insights couldn’t be loaded — refresh to try again.');
    }
    // ⚠ A stale run must not stamp its own season here — that is precisely what strands the page.
    setLoadedFor(loadKey);
    setLoading(false);
  }, [orgSlug, teamId, loadKey]);

  useEffect(() => {
    // ⚠ Gated on `hasAccess`, never on the live assignment (see the block comment above). The old
    // `!assignment` guard here is what walled a closed-only coach out of their own season.
    if (ctxLoading || !page.hasAccess) return;
    let cancelled = false;
    const isStale = () => cancelled;
    void Promise.resolve().then(() =>
      load({ lineups: canLineups, attendance: canAttendance, money: canMoney }, isStale));
    return () => { cancelled = true; };
  }, [ctxLoading, page.hasAccess, canLineups, canAttendance, canMoney, load]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  // ⚠ `hasAccess` covers live AND archived assignments. The live-assignment test that stood here
  // told a coach with no live assignment their own finished season's team was "not found" —
  // a wall on the hub describing the season they ran.
  if (!page.hasAccess) {
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
    vocab: { periodsWord, scoreUnitWord, positionLabels: sportPack.positionLabels },
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
    // ⚠ NO "today" IN A RECORD. The engine's one time-relative rule ("$X due in 3 days") gates on
    // this being present, and a deadline countdown against a season that ended is nonsense dressed
    // as urgency. Every other finding is a statement about what happened, which still reads true.
    todayISO: isRecord ? undefined : (todayISO || undefined),
  });
  // Hrefs come from the ONE shared resolver the ask bar's receipts use — the local copy of this
  // map covered five of the same seven destinations, which is how a finding and a receipt end up
  // pointing at different pages for the same word.
  const REPORT_CHIP: Record<InsightReport, string> = {
    'playing-time': 'Playing time', results: 'Results', attendance: 'Attendance', money: 'Money',
    development: 'Development',
  };

  /** The team's season history — EVERY current member sees it (the head-coach restriction was
   *  reverted with Design A, P2 2026-08-16: M1 already ensures only current staff hold access at
   *  all, so narrowing the team's own scrapbook was gating the wrong thing). Omitted while the
   *  team has no past seasons, rather than printing a zero. */
  const pastSeasonsClause = historySummary.pastSeasons > 0
    ? ` · ${historySummary.pastSeasons} past season${historySummary.pastSeasons === 1 ? '' : 's'} on file`
    : '';

  const overCapCount = analytics ? analytics.armCare.filter(r => r.overCapGames > 0).length : 0;
  const hasBand = scopedGames > 0 || last5.length > 0 || scoredGames.length > 0 || attendancePct != null || duesPct != null;

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      {/* Page-header ruling 2026-08-11: the team name is the masthead's, and "how your season is
          going" is what the whole page is — a title's worth of blurb under the title. */}
      {/* ⚠ No season chip (P2, 2026-08-16). The masthead above says "Complete" when the working
          season has finished, and there is no other season this page could be showing. */}
      <CoachPageHeader
        icon={BarChart3}
        title="Insights"
        helpLabel="Insights"
        help={{ module: 'coaches', sectionIds: ['premium-insights', 'premium-ask'], fullGuideHref: `/${orgSlug}/coaches/help#premium-insights` }}
      />

      {loading || loadedFor !== loadKey ? (
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
            // Insights is DERIVED — there is nothing to do here, so this teaches (quiet variant,
            // no CTA) and points at the sections that feed it. The report doorways below are the
            // real actions and stay visible.
            // ⚠ A record gets PAST TENSE and no promise of anything arriving — nothing will, the
            // season is over. Teaching a coach how to fill in a season that has ended is the same
            // mistake the results page and the attendance report both corrected the day before.
            <CoachEmptyState
              quiet
              icon={<BarChart3 size={20} aria-hidden />}
              headline={isRecord ? 'This season was never filled in' : "Your season hasn't started filling in yet"}
              description={isRecord
                ? 'Insights is a season read back to you — record and form, attendance and dues. Nothing was recorded for this one.'
                : 'Insights is your season read back to you — record and form, playing time, attendance and dues. You never enter anything on this page.'}
              payoff={isRecord
                ? 'Every figure here is built from what was recorded elsewhere in the portal during the season. No game result, lineup or attendance was entered, so there is nothing to read back.'
                : `Every figure is built from what you record elsewhere in the portal. Enter one game result, save one lineup, or take attendance once, and the matching part of this page appears — record, form, ${scoreUnitWord} difference and more.`}
              blocker={isRecord
                ? 'Nothing is invented to fill the space, so a season that was never recorded stays honestly blank.'
                : 'Nothing is invented to fill the space, so a brand-new season is honestly blank here.'}
            />
          )}

          {/* ── 2 · What stands out ── */}
          <section className={styles.insightsCallouts} aria-labelledby="insights-standout">
            <p className={styles.sectionKicker} id="insights-standout" style={{ margin: '0 0 0.6rem' }}>What stands out</p>
            {findings.length === 0 ? (
              <p className={styles.insightsCoQuiet}>
                {isRecord
                  ? 'Nothing stood out in this season’s record.'
                  : 'Nothing stands out yet — as you log games, lineups and attendance, this is where we’ll flag what’s worth knowing.'}
              </p>
            ) : (
              findings.map((f, i) => (
                /* ⚠ The season rides the finding's link too. A callout is a sentence ABOUT the
                   season on screen, so a bare href would hand the coach a 2024 statement and open
                   the live season's report to explain it. */
                <Link key={i} href={`${askReportHref(base, f.report)}`} className={styles.insightsCo}>
                  <span className={styles.insightsCoDot} data-tone={f.tone} aria-hidden />
                  <span className={styles.insightsCoText}>{f.text}</span>
                  <span className={styles.insightsCoChip}>{REPORT_CHIP[f.report]} →</span>
                </Link>
              ))
            )}
          </section>

          {/* ── 2b · Ask the Front Office (Phase A) ──
              The page's three voices, in order: the season PUSHES what stands out (above), the bar
              offers to be ASKED (here), and the doorways let the coach GO LOOK (below). Collapsed
              at rest, so the questions cost nothing until a coach wants them (owner 2026-08-02).
              Renders nothing at all when this coach's capabilities leave no questions to ask. */}
          {/* key={teamId} matches the pattern the Development pages already use: a team switch
              must REMOUNT this, never hand it a new team while it still holds the old team's
              answer. Today the page's `loadedFor` gate happens to unmount it anyway, but that is
              the parent's branch structure, not a property of the bar. */}
          {/* ⚠ NOT ON A FINISHED SEASON. The bar is an INSTRUMENT: it answers from the ACTIVE
              season, so on a season that has ended every answer would be about a season that has
              not started. Absent rather than quietly misleading. */}
          {!isRecord && assignment && (
            <CoachAskBar
              key={teamId}
              orgSlug={orgSlug}
              teamId={teamId}
              capabilities={assignment.capabilities}
              sport={assignment.teamSport}
            />
          )}

          {/* ── 3 · Report doorways (depth is always a page, never an expansion) ── */}
          <div className={styles.insightsDoors}>
            {/* ⚠ Every tile lands on a page that resolves the SAME working season this hub did —
                no link here carries a year, and none may (the guard test scans for it). A `?year=`
                on a link whose page ignores it was tried and reverted once (004ca10c); it dressed
                an unsolved problem up as solved. */}
            <Link href={`${base}/history/results`} className={`${styles.insightsDoor} ${finalized.length === 0 ? styles.insightsDoorSoft : ''}`}>
              <span className={styles.insightsDoorQ}>How are we doing?<span aria-hidden>→</span></span>
              <span className={styles.insightsDoorSum}>
                {/* Scoped record only when the scope actually holds results — otherwise a real
                    count, never a fabricated "0-0" (results may exist outside the record scope). */}
                {scopedGames > 0
                  ? `${recStr(record)} ${seasonWord}${pastSeasonsClause}`
                  : finalized.length > 0
                    ? `${finalized.length} result${finalized.length === 1 ? '' : 's'} ${seasonWord}${pastSeasonsClause}`
                    : isRecord
                      ? 'No result was recorded in this season'
                      : 'First season under way — your first result shows up here'}
              </span>
            </Link>
            {canLineups && (
              <Link href={`${base}/history/playing-time`} className={`${styles.insightsDoor} ${!analytics || analytics.gamesWithLineup === 0 ? styles.insightsDoorSoft : ''}`}>
                <span className={styles.insightsDoorQ}>Where is playing time going?<span aria-hidden>→</span></span>
                <span className={styles.insightsDoorSum}>
                  {srcErrors.lineups
                    ? 'Couldn’t load — refresh to try again'
                    : analytics && analytics.gamesWithLineup > 0
                      ? `${analytics.gamesWithLineup} lineup${analytics.gamesWithLineup === 1 ? '' : 's'} saved${overCapCount > 0 ? ` · ${overCapCount} arm-care flag${overCapCount === 1 ? '' : 's'}` : ''}`
                      : 'Save your first lineup to start tracking playing time'}
                </span>
              </Link>
            )}
            {/* ⚠ A1: keyed on the attendance duty, not record access — this is a DOOR to
                /attendance, and that page gates on its own grant now. Record access would have
                offered it to coaches who 403 on arrival. */}
            {canAttendance && (
              /* ⚠ "Who's showing up?" is now the ATTENDANCE PAGE'S OWN TITLE too (2026-08-15,
                 plan Phase 3) — it left the sidebar, so this tile is its only live door and the
                 two must read identically. Changing the wording here without changing the page
                 heading (or the reverse) puts a coach through a door named one thing onto a page
                 named another. */
              /* ⚠⚠ THE REPORT'S ONLY DOOR IN THE PRODUCT. Attendance is in NEITHER nav — it left
                 the live ones in 2026-08-15 and the archive menu died with the archive — so
                 deleting this tile makes the page unreachable. Pinned by
                 tests/unit/coach-attendance-home.test.ts. */
              <Link href={`${base}/attendance`} className={`${styles.insightsDoor} ${attendancePct == null ? styles.insightsDoorSoft : ''}`}>
                <span className={styles.insightsDoorQ}>Who&apos;s showing up?<span aria-hidden>→</span></span>
                <span className={styles.insightsDoorSum}>
                  {srcErrors.attendance
                    ? 'Couldn’t load — refresh to try again'
                    : attendancePct != null
                      ? `${attendancePct}% team rate${attendanceBelow > 0 ? ` · ${attendanceBelow} player${attendanceBelow === 1 ? '' : 's'} below ${attendanceBarPct}%` : ''}`
                      : isRecord
                        ? 'No attendance was taken in this season'
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
                      : isRecord
                        ? 'No dues were set up in this season'
                        : 'Set up dues in Money to track collections'}
                </span>
              </Link>
            )}
            {canAwards && (
              <Link href={`${base}/history/awards`} className={`${styles.insightsDoor} ${!awardsSummary || awardsSummary.total === 0 ? styles.insightsDoorSoft : ''}`}>
                <span className={styles.insightsDoorQ}>Who&apos;s earning it?<span aria-hidden>→</span></span>
                <span className={styles.insightsDoorSum}>
                  {awardsSummary && awardsSummary.total > 0
                    ? `${awardsSummary.total} award${awardsSummary.total === 1 ? '' : 's'} given${awardsSummary.leaderName ? ` · ${awardsSummary.leaderName.split(' ')[0]} ${isRecord ? 'led' : 'leads'} with ${awardsSummary.leaderCount}` : ''}`
                    : isRecord
                      ? 'No awards were given in this season'
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
                    ? `${devSummary.withMeasurable} of ${devSummary.rosterCount} player${devSummary.rosterCount === 1 ? '' : 's'} ${isRecord ? 'had' : 'have'} a measurable · ${devSummary.withFocus} with an ${isRecord ? 'open' : 'active'} focus area`
                    : isRecord
                      ? 'No measurables or focus areas were recorded in this season'
                      : 'Run an evaluation session or add a focus area to start the coverage picture'}
                </span>
              </Link>
            )}
            {/* Seventh tile — Opponent Scouting Book, owner-sanctioned with the project
                approval 2026-08-04 (the tile was in the approved mockups; new analytics
                land as Insights sections per the 2026-07-08 IA ruling). Gated on schedule
                (open-contribution model), NOT record access — Helpers read the book too. */}
            {canScouting && (
              <Link href={`${base}/history/opponents`} className={`${styles.insightsDoor} ${!oppSummary || oppSummary.total === 0 ? styles.insightsDoorSoft : ''}`}>
                <span className={styles.insightsDoorQ}>Who are we up against?<span aria-hidden>→</span></span>
                <span className={styles.insightsDoorSum}>
                  {oppSummary && oppSummary.total > 0
                    ? `${oppSummary.total} opponent${oppSummary.total === 1 ? '' : 's'} on file · ${oppSummary.withBook} in the book`
                    : 'Play a game with an opponent named to start your book'}
                </span>
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
