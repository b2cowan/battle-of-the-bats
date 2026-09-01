'use client';
import { useState, useEffect, useCallback, useRef, use, type ComponentType } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachTabBar from '@/components/coaches/CoachTabBar';
import SeasonTrendChart from '@/components/charts/SeasonTrendChart';
import { computeSeasonMomentum } from '@/lib/coach-season-momentum';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import {
  computeInsightFindings, ATTENDANCE_MIN_KNOWN,
  type InsightFinding, type InsightReport, type FindingsGameSummary,
} from '@/lib/insight-findings';
import { insightsSectionHref, type CoachInsightsSection } from '@/lib/coach-insights-links';
import styles from '../../../coaches.module.css';
import type { RepTeamEvent } from '@/lib/types';
import type { SeasonLineupAnalytics } from '@/lib/lineup-season-analytics';
import { canManageAwards, canViewMeasurables, type CoachCapabilities } from '@/lib/coach-capabilities';
import { formatRecord } from '@/lib/coach-season-record';

// ─────────────────────────────────────────────────────────────────────────────
// Insights — the REPORTS & ANALYTICS PORTAL (owner-approved mockups 2026-08-18;
// COACH_INSIGHTS_REPORTS_PORTAL_PLAN.md, P1).
//
// One page, seven tabs, the Money hub's mechanics exactly: `?section=` (never
// `?tab=`), panels in `./{tab}/panel.tsx` behind next/dynamic, visited panels
// stay mounted, and every legacy report URL permanently redirects into its tab.
//
// ⚠⚠ WHAT THIS REPLACED, so nobody rebuilds it: the hub used to be a scoreboard
// band, a findings strip, an "Ask about your team" bar and seven QUESTION-TITLED
// DOORWAY TILES that navigated away to seven separate pages. Depth-is-navigation
// was the right call when each report was a page; it is the wrong call once the
// reports are a set a coach compares. The tiles are gone, the Ask bar is retired
// (every answer it gave is now a permanent fixture in the report that owns it),
// and what is left on this Dashboard tab is the three things that were always
// ABOUT the whole season rather than about one report.
//
// ⚠⚠ NO MONEY, ANYWHERE (owner ruling 3, 2026-08-18; extended to the Sunday
// "week in review" push 2026-08-28). No dues tile, no dues fetch, no money
// finding, nowhere. Insights is player and team stats for COACHES; money's
// homes are the team Overview and the Money hub. The findings engine still HAS
// money rules — registry entries that fire only when a `dues` input is
// supplied, and since 2026-08-28 nothing supplies one — and the way they are
// kept off every surface is that the input is never passed. See
// `REPORT_SECTION` below.
//
// ⚠ LIVE SEASON ONLY, STRUCTURALLY. `CoachTeamSeasonGate` sends a team with no
// live season to its closed-season page before any live screen mounts, so this
// portal never needs a finished-season mode and must not grow one. No panel and
// no route here reads `?year=` (build-enforced:
// tests/unit/coach-history-endpoint-guard.test.ts). A closed season that needs
// to show something needs a SHELF on the season-end page.
// ─────────────────────────────────────────────────────────────────────────────

/* Code-split, not just lazy-mounted: the six panels are ~2,000 lines between them and several
   pull in their own modals and export paths, so a coach who only ever opens the Dashboard and one
   report shouldn't download all six. Panels live in ./{tab}/panel, NOT the page files: a page
   module may only export Next's page contract, and the build's route-type stubs fail `tsc` on any
   extra export (bitten on the Money hub, 2026-08-12). */
const ResultsPanel = dynamic(() => import('./results/panel').then(m => m.ResultsPanel), { ssr: false });
const AttendancePanel = dynamic(() => import('./attendance/panel').then(m => m.AttendancePanel), { ssr: false });
const PlayingTimePanel = dynamic(() => import('./playing-time/panel').then(m => m.PlayingTimePanel), { ssr: false });
const DevelopmentPanel = dynamic(() => import('./development/panel').then(m => m.DevelopmentPanel), { ssr: false });
const AwardsPanel = dynamic(() => import('./awards/panel').then(m => m.AwardsPanel), { ssr: false });
/* ⚠ The folder is `opponents`; the tab is `scouting`. The owner named the report "Scouting Book"
   over "Opponents", and its drill-in book keeps `history/opponents/[opponentKey]`. */
const ScoutingPanel = dynamic(() => import('./opponents/panel').then(m => m.ScoutingPanel), { ssr: false });

/** The portal's tab ids — the shared section list every outside caller links with
 *  (lib/coach-insights-links.ts) plus the Dashboard, which is the ABSENCE of a section.
 *  Derived, not restated: two hand-copied unions is how a renamed tab compiles clean in one file
 *  and 404s from the other. */
type SectionId = 'dashboard' | CoachInsightsSection;

type PanelProps = { params: Promise<{ orgSlug: string; teamId: string }> };

const PANELS: { id: CoachInsightsSection; Component: ComponentType<PanelProps> }[] = [
  { id: 'results', Component: ResultsPanel },
  { id: 'attendance', Component: AttendancePanel },
  { id: 'playing-time', Component: PlayingTimePanel },
  { id: 'development', Component: DevelopmentPanel },
  { id: 'awards', Component: AwardsPanel },
  { id: 'scouting', Component: ScoutingPanel },
];

/**
 * ⚠⚠ **ONE ROW PER TAB — the tab's name, the grant that opens it, and the guide behind its "?".**
 *
 * These three facts were three hand-kept-parallel lists (a `tabs` array with a `...(cond ? [] : [])`
 * spread per gated tab, and a separate `SECTION_HELP` record ninety lines away), which meant adding
 * an eighth report was four edits that had to agree on one id string. Now it is two: this table and
 * the `PANELS` array above — and `PANELS` genuinely cannot merge in, because `next/dynamic()` has to
 * be called at module scope for the code-splitting to happen at all.
 *
 * ⚠ **THE HELP TOPIC IS NAMED ONCE.** It used to be written twice per row (`ids: ['x']` beside
 * `anchor: 'x'`), which is the same "hand-copied and free to diverge" trap this file's own note on
 * `SectionId` warns about — the drawer and the full-guide link could quietly point at different
 * topics. The array the drawer wants is built from `helpAnchor` at the single call site.
 *
 * ⚠ Why help lives here at all: each report PAGE used to carry its own "?" pointing at its own guide
 * section. A portal has one header, so without this the Scouting Book and Attendance would have
 * silently inherited the generic Insights guide and their two written topics would have become
 * unreachable from the screens they describe.
 *
 * `gate` is `null` for a tab every coach who reaches this portal can open.
 */
type TabDef = {
  id: SectionId;
  label: string;
  gate: ((c: CoachCapabilities) => boolean) | null;
  helpLabel: string;
  helpAnchor: string;
};

const TABS: readonly TabDef[] = [
  { id: 'dashboard', label: 'Dashboard', gate: null, helpLabel: 'Insights', helpAnchor: 'premium-insights' },
  { id: 'results', label: 'Results', gate: null, helpLabel: 'Insights', helpAnchor: 'premium-insights' },
  { id: 'attendance', label: 'Attendance', gate: c => c.attendance, helpLabel: 'Attendance', helpAnchor: 'recipe-attendance' },
  { id: 'playing-time', label: 'Playing Time', gate: c => c.lineups, helpLabel: 'Insights', helpAnchor: 'premium-insights' },
  { id: 'development', label: 'Development', gate: canViewMeasurables, helpLabel: 'Development', helpAnchor: 'premium-development' },
  { id: 'awards', label: 'Awards', gate: canManageAwards, helpLabel: 'Awards', helpAnchor: 'recipe-game-day-details' },
  /* ⚠ "Scouting Book", not "Opponents" — the owner picked the name for what it IS over the name for
     what it lists (mockup session 2026-08-18). Gated on SCHEDULE, not record access: the book is
     open-contribution and Helpers read it too (owner, 2026-08-04). */
  { id: 'scouting', label: 'Scouting Book', gate: c => c.schedule, helpLabel: 'Scouting Book', helpAnchor: 'premium-scouting' },
];

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
  const { loading: ctxLoading } = useCoaches();
  /**
   * ⚠ WHICH SEASON — the team's LIVE one, always. A team with no live season never reaches this
   * portal: `CoachTeamSeasonGate` (decided SERVER-side by the team layout) redirects it to the
   * closed-season page before any live screen mounts.
   */
  const page = useCoachSeasonPage(orgSlug, teamId);
  const caps = page.capabilities;
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const sportPack = getSportPack(page.teamSport ?? DEFAULT_SPORT);
  const periodsWord = sportPack.periodLabelPlural.toLowerCase();
  const scoreUnitWord = sportPack.score.unit.toLowerCase();

  // ── Tab state (the Money hub's mechanics, copied deliberately) ─────────────
  // `?section=`, read from the URL so the active tab survives refresh, back/forward and is
  // shareable. `visited` tracks every tab ever opened this visit — once a panel mounts it stays
  // mounted (display:none while inactive), so switching away and back never re-fetches a report or
  // loses a filter chip the coach had set.
  const searchParams = useSearchParams();
  const rawSection = searchParams.get('section');
  const activeSection = (rawSection as SectionId | null) ?? 'dashboard';

  function sectionHref(id: SectionId): string {
    return id === 'dashboard' ? `${base}/history` : insightsSectionHref(base, id);
  }

  /**
   * ⚠ CAPABILITY-GATED TABS, and the gate is the FETCH as well as the tab (the rule this hub has
   * always followed for its tiles). A report a coach may not open is absent from the row entirely —
   * never present-and-refusing, and any summary read it would have needed is skipped with it.
   *
   * ⚠ Fail-OPEN while capabilities are still loading, matching every other coach surface: the route
   * behind each panel enforces its own grant server-side, so the worst case is a tab that appears
   * for a moment and then goes. Failing closed would blank the row on every cold load.
   */
  const visibleTabs = TABS.filter(t => !t.gate || !caps || t.gate(caps));
  const visibleIds = new Set(visibleTabs.map(t => t.id));
  const canLineups = visibleIds.has('playing-time');
  const canAttendance = visibleIds.has('attendance');
  const canDevelopment = visibleIds.has('development');
  /* A coach can land on a tab their grants don't open — an old bookmark, a link from a coach with
     more access. Rather than a dead end (a tab row with no active tab and nothing under it), fall
     back to the Dashboard, the same way the old hub simply didn't draw that tile. */
  const effectiveSection: SectionId = visibleIds.has(activeSection) ? activeSection : 'dashboard';

  const [visited, setVisited] = useState<Set<SectionId>>(() => new Set(['dashboard', effectiveSection]));
  // Adjusting state during render (not an effect) on a change-detection guard is the
  // React-sanctioned way to derive state from a URL change without an extra render pass.
  // ⚠ Seeded with the section a coach actually LANDS on as well as 'dashboard': seeding only the
  // first tab left a direct link to any other rendering a blank pane, since this guard fires on a
  // CHANGE after mount and never on mount itself (the Money hub paid for that once).
  const [trackedSection, setTrackedSection] = useState(effectiveSection);
  if (effectiveSection !== trackedSection) {
    setTrackedSection(effectiveSection);
    setVisited(v => new Set(v).add(effectiveSection));
  }

  // ── Dashboard data ────────────────────────────────────────────────────────
  /**
   * ⚠⚠ **ONE SUMMARY FETCH SURVIVES, AND THE OTHER TWO WERE DELETED WITH THE RAIL** (owner,
   * 2026-08-18). This hub used to make three small self-contained reads — awards, development and
   * opponents — purely to fill one line each in an "All reports" rail listing the same six reports
   * the tab row already lists. The rail went; two of the three reads had no other consumer and went
   * with it, along with the cross-season `/history` read behind its Results line.
   *
   * ⚠ THE DEVELOPMENT READ STAYS, and the reason is worth stating so it is not tidied away next:
   * it does NOT feed a tile — it feeds a FINDINGS RULE (the count-only coverage nudge, "N players
   * don't have a measurable yet"). Delete it and that finding silently stops firing, with no error
   * and no empty state, because the engine simply never runs a rule whose input is absent.
   *
   * ⚠ Lazy for the same reason as the coordinated load below: findings render on the Dashboard
   * only, so a coach who opens a bookmark straight into a report tab should not pay for this. The
   * Development PANEL makes its own, richer read (`?history=1&plans=1`) and is unaffected either way.
   */
  const [devSummary, setDevSummary] = useState<{ rosterCount: number; withMeasurable: number; withFocus: number } | null>(null);
  const onDashboard = effectiveSection === 'dashboard';
  /**
   * ⚠⚠ **THE MARKER RECORDS A COMMITTED WRITE, NOT A STARTED REQUEST** — and getting that backwards
   * cost this effect a real defect that two review lenses found independently.
   *
   * It records which TEAM's summary is actually ON SCREEN, so the fetch can be both LAZY (skipped
   * until the Dashboard is opened) and ONCE (not repeated every time the coach comes back to it).
   * A plain `onDashboard` dep without it would trade one wasted request for one per return trip.
   *
   * ⚠ The first version set it BEFORE the fetch, as an "in flight" flag. Under React StrictMode —
   * which double-invokes effects in dev — invocation 1 set the marker and started a request,
   * React tore that invocation down (`cancelled = true`, so its response was discarded), and
   * invocation 2 then saw the marker already set and never fetched at all. Net result: the summary
   * never loaded in development, so the coverage finding it feeds silently never fired — the exact
   * failure the comment below warns about, caused by the guard meant to be cheap.
   *
   * Marking on the committed write instead is correct in both worlds: dev pays one extra discarded
   * request (a plain GET, and the same cost every sibling panel already accepts), production makes
   * one, and a request that FAILS leaves the marker unset so a later visit retries rather than
   * looking identical to a success.
   */
  const devFetchedFor = useRef<string | null>(null);
  /* A team switch invalidates the previous team's summary — cleared, never left to sit under the
     new team's findings. Its own effect, declared FIRST so it runs before the fetch effect below
     on the render where `teamId` changes. */
  useEffect(() => {
    devFetchedFor.current = null;
    setDevSummary(null);
  }, [teamId]);
  useEffect(() => {
    if (!canDevelopment || !onDashboard || devFetchedFor.current === teamId) return;
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/development/board`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        // ⚠ `cancelled` gates the MARKER as well as the write. A superseded run must not stamp a
        // team it no longer describes, or the next visit would skip a fetch it needed.
        if (cancelled || !data) return;
        const rows: { goals: { status: string }[]; latest: Record<string, unknown> }[] = data.rows ?? [];
        devFetchedFor.current = teamId;
        setDevSummary({
          rosterCount: rows.length,
          withMeasurable: rows.filter(r => Object.keys(r.latest ?? {}).length > 0).length,
          withFocus: rows.filter(r => (r.goals ?? []).some(g => g.status === 'working')).length,
        });
      })
      // Non-fatal, and it leaves the marker unset on purpose — the coverage finding just doesn't
      // fire, and a later visit to the Dashboard tries again.
      .catch(() => { /* the coverage finding simply doesn't fire */ });
    return () => { cancelled = true; };
  }, [canDevelopment, onDashboard, orgSlug, teamId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<RepTeamEvent[]>([]);
  const [analytics, setAnalytics] = useState<SeasonLineupAnalytics | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[] | null>(null);
  /**
   * ⚠ `srcErrors` IS GONE with the rail (2026-08-18), and the honesty rule it served is now carried
   * by SHAPE instead of by a flag. It existed so a permitted fetch that genuinely FAILED showed
   * "Couldn't load" rather than the teach copy for "nothing recorded yet" — a distinction the rail
   * had to make in words because every row rendered either way. The scoreboard tiles do not: a tile
   * with no data is ABSENT, and an absent tile claims nothing. Restoring a per-source error flag
   * would mean the Dashboard had grown somewhere that states a figure it does not have.
   */
  /** Guards the stale flash: the body renders as loading until the data belongs to THIS team.
   *  This is a client component that survives a team switch, so a slow response for the old team
   *  could otherwise paint over the new one. */
  const loadKey = teamId;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  // Record scope mirrors the Overview widget's remembered per-team choice.
  const [included, setIncluded] = useState<Record<string, boolean>>(WLT_DEFAULT);

  /**
   * ONE coordinated load → ONE paint (no staggered pop-in). Each source degrades independently: a
   * failed/denied fetch just means its tile doesn't render.
   *
   * ⚠⚠ EVERY WRITE IS GUARDED, not just the render. `loadedFor` guards what is PAINTED; a
   * superseded run's response landing last would otherwise stamp ITS key, reverting the correct
   * scoreboard to "Loading insights…" for good — nothing in the effect's deps changed, so it never
   * re-fires. Same `isStale()` shape the results panel and the Practice hub carry.
   *
   * ⚠ The gate object is `gate`, NOT `caps`: this is a narrow two-boolean fetch gate, and the
   * page also holds `caps` (the season's full capability object) whose field names coincide.
   * Sharing the name would let code moved into or out of this callback read the wrong object with
   * no type error.
   *
   * ⚠⚠ THE `/dues` FETCH IS DELETED (owner ruling 3, 2026-08-18) — not merely its tile. A tile
   * hidden over a fetch still made is how a money figure leaks into a finding; and because
   * `computeInsightFindings` fires its money rules only when `dues` is present, not asking is
   * exactly what keeps money off this screen.
   */
  const load = useCallback(async (
    gate: { lineups: boolean; attendance: boolean },
    isStale: () => boolean = () => false,
  ) => {
    setLoading(true);
    setError('');
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
    /* ⚠ THE CROSS-SEASON `/history` READ IS GONE (2026-08-18). It served exactly one thing — the
       "N past seasons on file" clause on the rail's Results line — and the rail is deleted. The
       compare list itself is unaffected: it lives on the RESULTS tab, which makes its own read.
       This hub now asks only for the season it is describing. */
    const [ev, an, at] = await Promise.allSettled([
      get('/events'),
      gate.lineups ? get('/lineup-analytics') : Promise.reject(new Error('skipped')),
      gate.attendance ? get('/attendance') : Promise.reject(new Error('skipped')),
    ]);
    // ⚠ Nothing below this line may write for a run that has been superseded. The whole batch is
    // checked once, here, rather than per-source: a partial write from a stale run is the same
    // wrong-team paint as a full one.
    if (isStale()) return;
    // ⚠ CLEARED, not left alone, when a source is refused or skipped. Absent data must read as
    // absent — leaving the previous team's rows in state puts the wrong numbers on screen with no
    // error anywhere.
    setEvents(ev.status === 'fulfilled' ? ev.value.events ?? [] : []);
    setAnalytics(an.status === 'fulfilled' ? an.value.analytics ?? null : null);
    setAttendanceRows(at.status === 'fulfilled' ? at.value.players ?? [] : null);
    /* ⚠ THE PAGE-ERROR TEST NARROWED WITH THE BATCH, and it had to. It was "events AND history both
       failed", i.e. a total blackout across two independent reads. With `/history` gone, `events`
       is the only unconditional read left — so a failed `events` IS the blackout: no record, no
       form, no scoring difference, no findings about games. Leaving the old two-source condition
       would have made it permanently unreachable and shown an empty scoreboard as if the season had
       simply not started. */
    if (ev.status === 'rejected') {
      setError('Insights couldn’t be loaded — refresh to try again.');
    }
    setLoadedFor(loadKey);
    setLoading(false);
  }, [orgSlug, teamId, loadKey]);

  /**
   * ⚠⚠ **THE DASHBOARD'S READS ARE LAZY, LIKE THE PANELS THEY SIT BESIDE.** They used to fire on
   * mount whatever tab the coach had landed on — so opening a bookmark to `?section=results` made
   * three requests for a scoreboard nobody was looking at, and then the Results panel made its own.
   *
   * Two conditions, and both matter:
   * · `onDashboard` — the Dashboard is the only consumer of any of this (tiles + findings), and it
   *   is the landing tab, so the common path is unchanged: land here, load here.
   * · `loadedFor !== loadKey` — **this is what stops it re-fetching every time a coach comes BACK
   *   to the Dashboard.** Without it, adding `onDashboard` to the deps would turn one wasted load
   *   into a fresh round of three on every return trip, which is worse than what it replaced.
   *
   * ⚠ A team switch still reloads: `loadKey` is the team id, so the guard fails for the new team
   * and the effect fires — which is the case the whole `loadedFor` mechanism exists for.
   */
  useEffect(() => {
    if (ctxLoading || !page.hasAccess || !onDashboard || loadedFor === loadKey) return;
    let cancelled = false;
    const isStale = () => cancelled;
    void Promise.resolve().then(() =>
      load({ lineups: canLineups, attendance: canAttendance }, isStale));
    return () => { cancelled = true; };
  }, [ctxLoading, page.hasAccess, onDashboard, loadedFor, loadKey, canLineups, canAttendance, load]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
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
  // ⚠ `finalized`/`scoped` are sorted NEWEST first for the tiles above — the momentum chart needs
  // the reverse (oldest → newest) to plot a differential that actually rises left-to-right.
  const momentumSeries = computeSeasonMomentum([...scoped].reverse());
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
  // Derived from the momentum chart's own last point rather than a second independent subtraction
  // — the same rule (both scores required, team minus opponent), computed once, so the "Run diff"
  // tile and the chart's endpoint can never quietly disagree.
  const diff = momentumSeries.points.at(-1)?.cumulative ?? 0;

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
  /* ⚠ The "N players below 60%" count went with the rail (2026-08-18) — it was that row's second
     clause, and the tile above states a team rate, not a roster breakdown. The 60% bar itself is
     NOT gone: `ATTENDANCE_FLAG_BELOW` is still the findings engine's, and the engine still names
     the least-reliable player in "What stands out". One place says who; nothing needs to say how
     many, twice. */

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
    // ⚠ NO `dues` AND NO `todayISO` (owner ruling 3, 2026-08-18). `dues` is what every money rule
    // in the engine gates on, so omitting it is what makes "no money in Insights" true rather than
    // merely tidy; `todayISO` fed only the dues-deadline rule and has nothing left to time.
    development: canDevelopment ? devSummary : null,
  });

  /**
   * Where a finding's chip lands — a TAB of this portal, not a page any more.
   *
   * ⚠ `money` still exists in `InsightReport` and points OUT of the portal on purpose. The engine
   * keeps its money rules for the weekly digest (`lib/insights-digest.ts`), which is a
   * notification and not this screen; those rules cannot fire here because `dues` is never passed
   * above. If one ever did, this sends the coach to the Money hub — the correct destination — rather
   * than to a tab that does not exist.
   */
  const REPORT_SECTION: Record<InsightReport, { label: string; href: string }> = {
    'playing-time': { label: 'Playing time', href: insightsSectionHref(base, 'playing-time') },
    results:        { label: 'Results',      href: insightsSectionHref(base, 'results') },
    attendance:     { label: 'Attendance',   href: insightsSectionHref(base, 'attendance') },
    development:    { label: 'Development',  href: insightsSectionHref(base, 'development') },
    money:          { label: 'Money',        href: `${base}/accounting` },
  };

  const hasBand = scopedGames > 0 || last5.length > 0 || scoredGames.length > 0 || attendancePct != null;

  /* Falls back to the Dashboard's row rather than `!`-asserting: `effectiveSection` is always a
     visible tab by construction, but a lookup that cannot fail is cheaper to keep true than to
     prove. */
  const help = visibleTabs.find(t => t.id === effectiveSection) ?? TABS[0];

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      {/* Page-header ruling 2026-08-11: title + help, nothing under the title — the masthead above
          owns the team and the season. The portal has ONE header for seven reports; the tab row
          below is what tells a coach which one they are reading.
          ⚠ The help topic follows the TAB (see TABS): each report used to carry its own "?", and
          two of those guides would otherwise have become unreachable from the screens they
          describe. The drawer takes an ARRAY of topic ids, built here from the one place the topic
          is named — writing it twice per row is how the drawer and the full-guide link drift. */}
      <CoachPageHeader
        icon={BarChart3}
        title="Insights"
        helpLabel={help.helpLabel}
        help={{ module: 'coaches', sectionIds: [help.helpAnchor], fullGuideHref: `/${orgSlug}/coaches/help#${help.helpAnchor}` }}
      />

      <CoachTabBar
        tabs={visibleTabs.map(t => ({ id: t.id, label: t.label, href: sectionHref(t.id) }))}
        activeId={effectiveSection}
        ariaLabel="Reports"
      />

      {effectiveSection === 'dashboard' && (
        loading || loadedFor !== loadKey ? (
          <div className={styles.loadingState}>Loading insights…</div>
        ) : error ? (
          /**
           * ⚠⚠ **THE RETRY IS NOT DECORATION — WITHOUT IT THIS ERROR IS A DEAD END.** A failed load
           * still stamps `loadedFor`, and the load effect skips when `loadedFor === loadKey`, so
           * switching to Results and back does NOT try again: the coach would be left with one
           * sentence and no way forward short of a full page refresh. That is worse now than it was
           * as a standalone page, because tab-switching is the movement this whole screen is built
           * around and it looks like it should re-run things.
           *
           * Calls `load` directly rather than clearing `loadedFor` to re-trigger the effect —
           * clearing it would re-render the loading state from a stale key and race the effect.
           * Same "Try again" shape the Development panel already uses.
           */
          <p className={styles.errorText}>
            {error}{' '}
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: '0.78rem', padding: '0.15rem 0.5rem' }}
              onClick={() => { void load({ lineups: canLineups, attendance: canAttendance }); }}
            >
              Try again
            </button>
          </p>
        ) : (
          <>
            {/* ── 1 · Season scoreboard band ──
                ⚠ FIVE TILES, NOT SIX. The Dues tile is deleted with the rest of the money
                (owner ruling 3). Each tile is now a LINK to the report it comes from — the
                mockup's own affordance, and the thing that replaces the seven doorway tiles:
                a coach reads a number and taps the number, rather than reading a number and
                then hunting for the tile that explains it. */}
            {hasBand ? (
              <div className={styles.insightsBand}>
                {scopedGames > 0 && (
                  <Link href={insightsSectionHref(base, 'results')} className={styles.insightsStat}>
                    <span className={styles.insightsStatLbl}>Record</span>
                    <span className={styles.insightsStatVal}>{formatRecord(record)}</span>
                    <span className={styles.insightsStatCap}>{scopeCaption}</span>
                  </Link>
                )}
                {last5.length > 0 && (
                  <Link href={insightsSectionHref(base, 'results')} className={styles.insightsStat}>
                    <span className={styles.insightsStatLbl}>Form</span>
                    <span className={styles.wltFormPips} aria-label="Recent form, oldest to newest">
                      {last5.map((g, i) => (
                        <span key={i} className={styles.wltPip} data-r={g.result ?? undefined}>
                          {g.result === 'win' ? 'W' : g.result === 'loss' ? 'L' : 'T'}
                        </span>
                      ))}
                    </span>
                    {streakLabel && <span className={styles.insightsStatCap}>{streakLabel}</span>}
                  </Link>
                )}
                {scoredGames.length > 0 && (
                  <Link href={insightsSectionHref(base, 'results')} className={styles.insightsStat}>
                    <span className={styles.insightsStatLbl}>{sportPack.score.diff}</span>
                    <span className={styles.insightsStatVal} data-pos={diff >= 0 ? 'true' : 'false'}>{diff >= 0 ? `+${diff}` : diff}</span>
                    <span className={styles.insightsSegBar} aria-hidden><i style={{ width: `${Math.round((scoredFor / Math.max(1, scoredFor + scoredAgainst)) * 100)}%` }} /></span>
                    <span className={styles.insightsStatCap}>{scoredFor} scored · {scoredAgainst} allowed</span>
                  </Link>
                )}
                {closeTotal > 0 && (
                  <Link href={insightsSectionHref(base, 'results')} className={styles.insightsStat}>
                    <span className={styles.insightsStatLbl}>Close games</span>
                    <span className={styles.insightsStatVal}>{formatRecord(close)}</span>
                    <span className={styles.insightsStatCap}>in one-{scoreUnitWord} games</span>
                  </Link>
                )}
                {attendancePct != null && canAttendance && (
                  <Link href={insightsSectionHref(base, 'attendance')} className={styles.insightsStat}>
                    <span className={styles.insightsStatLbl}>Attendance</span>
                    <span className={styles.insightsStatVal}>{attendancePct}<small>%</small></span>
                    <span className={styles.insightsStatCap}>games + practices</span>
                  </Link>
                )}
              </div>
            ) : (
              // Insights is DERIVED — there is nothing to do here, so this teaches (quiet variant,
              // no CTA) and points at the sections that feed it. ⚠ The TAB ROW above stays visible
              // and is the navigation: this state replaces the scoreboard, never the tabs, so a
              // brand-new season can still open every report and see what each will hold.
              <CoachEmptyState
                quiet
                icon={<BarChart3 size={20} aria-hidden />}
                headline="Your season hasn't started filling in yet"
                description="Insights is your season read back to you — record and form, playing time, attendance and development. You never enter anything on this page."
                payoff={`Every figure is built from what you record elsewhere in the portal. Enter one game result, save one lineup, or take attendance once, and the matching part of this page appears — record, form, ${scoreUnitWord} difference and more.`}
                blocker="Nothing is invented to fill the space, so a brand-new season is honestly blank here."
              />
            )}

            {/* ── Season momentum (Insights P3, 2026-08-19) ── Only inside `hasBand`: when the whole
                scoreboard is the quiet empty state above, there are certainly no scored games either,
                and a second quiet card right under the first would just repeat it. The chart owns its
                own "no scored games yet" empty state — see SeasonTrendChart. */}
            {hasBand && (
              <SeasonTrendChart
                title="Season momentum"
                caption={`Cumulative ${scoreUnitWord} differential, game by game`}
                series={momentumSeries}
                unitWord={scoreUnitWord}
                sampleNoun="game"
                emptyDescription="Season momentum builds after your first game gets a final score."
                fill
                startLabel="Game 1"
                endLabel={`Game ${momentumSeries.totalCount}`}
              />
            )}

            {/* ── 2 · What stands out ── */}
            <section className={styles.insightsCallouts} aria-labelledby="insights-standout">
              <p className={styles.sectionKicker} id="insights-standout" style={{ margin: '0 0 0.6rem' }}>What stands out</p>
              {findings.length === 0 ? (
                <p className={styles.insightsCoQuiet}>
                  Nothing stands out yet — as you log games, lineups and attendance, this is where
                  we’ll flag what’s worth knowing.
                </p>
              ) : (
                findings.map((f, i) => (
                  <Link key={i} href={REPORT_SECTION[f.report].href} className={styles.insightsCo}>
                    <span className={styles.insightsCoDot} data-tone={f.tone} aria-hidden />
                    <span className={styles.insightsCoText}>{f.text}</span>
                    <span className={styles.insightsCoChip}>{REPORT_SECTION[f.report].label} →</span>
                  </Link>
                ))
              )}
            </section>

            {/* ⚠⚠ **THE "ALL REPORTS" RAIL IS DELETED, AND IT SHOULD NOT COME BACK** (owner, on the
                first look at the built page, 2026-08-18 — a deviation from the approved mockup made
                deliberately BY the owner, so the mockup is the superseded record here).

                It listed all six reports with one live stat each, one line under a tab row listing
                the same six reports. Two indexes of one set, a few pixels apart: *"the tabs have all
                the reports, this is redundant."*

                ⚠ The reasoning it shipped with — "so a coach can see where the news is without
                opening anything" — is the part worth keeping and the part that was wrong. That job
                belongs to **What stands out** above, which already reads every report FOR the coach
                and says the one thing worth knowing. The rail restated six reports in order to bury
                the same news inside them. If a report has something urgent to say, the answer is a
                findings rule, not a sixth line of standing text.

                Removed with it: the awards and opponents summary fetches and the cross-season
                history read, which existed ONLY to fill rail lines — three network requests per
                Dashboard load. The development summary stays; it feeds a findings rule. */}
          </>
        )
      )}

      {/* Panels: lazy-mount on first visit, then keep mounted (display:none while inactive) so
          switching tabs never re-fetches a report or loses a filter the coach has set. */}
      {PANELS.map(({ id, Component }) => {
        if (!visibleIds.has(id) || !visited.has(id)) return null;
        return (
          <div key={id} style={{ display: effectiveSection === id ? 'block' : 'none' }}>
            <Component params={paramsPromise} />
          </div>
        );
      })}
    </div>
  );
}
