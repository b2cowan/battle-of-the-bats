'use client';
import { use, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Info, TrendingUp } from 'lucide-react';
import {
  insightsDevelopmentHref, parseInsightsDevelopmentAddress, playerDevelopmentHref, COVERAGE_FOCUS, REPORTS_WITH_METRIC,
  type InsightsDevelopmentAddress, type DevelopmentReport, type ProgressShow, type CompareWindow,
} from '@/lib/development-address';
import {
  REPORT_LABELS, COMPARE_LABELS, progressSeries, scopeLine, coverageCell, coverageDenominator, COVERAGE_ORDER_NOTE,
  COVERAGE_DASH, developmentReports, showOptions, teamChangeSummary, teamPlayersCell, teamCountLine, teamLegend, TEAM_COUNT_NOTE,
  type ProgressSeries, type ProgressPoint, type ReportDefinition, type TeamMetricCounts,
} from '@/lib/development-report';
import { playerTabHref } from '@/lib/coach-player-tabs';
import { headlineLabel, headlineLead } from '@/lib/measurable-series';
import { aimSentence } from '@/lib/measurable-definition';
import DevelopmentProgressChart from '@/components/charts/DevelopmentProgressChart';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import QuestionShell from '@/components/coaches/QuestionShell';
import { formatShortDate, formatValue } from '@/lib/measurable-format';
import { playerName as rosterName } from '@/lib/coach-roster-name';
import { formatInOrgZone } from '@/lib/timezone';
import { UNTAGGED_FILTER, collectTags, filterTagged } from '@/lib/rep-drills';
import { PRACTICE_TRUTH_LABELS, type PracticeTruth } from '@/lib/practice-truth';
import type { SectionRead } from '@/lib/report-section-state';
import type {
  RepTeamMeasurableType, RepPlayerMeasurable, RepPlayerDevelopmentGoal, RepPlayerObservation, RepDevelopmentGoalReview,
} from '@/lib/types';
import Muted from '@/components/coaches/Muted';
import { LibraryTable } from '@/components/coaches/LibraryRow';
import SublinedChoice, { type SublinedOption } from '@/components/coaches/SublinedChoice';
import styles from '../../../../coaches.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Development report (Player Development 3D — D4 Option B, owner 2026-07-17).
// The page behind the Insights hub's sixth doorway tile: one row per active
// player, ROSTER ORDER ONLY — a coverage checklist, never a leaderboard.
//
// Development lifecycle Phase 3 (mockup screen 5, 2026-09-13): ONE labelled
// "Report" selector under the seven tabs — Coverage · Player progress · Practice
// review — not a third row of tabs and not a seventh tab. Every selector rides
// the hub's own `?section=development` address (report · player · metric · show
// · compare · tag), read on EVERY render, so Back/Forward and a fresh link move
// the selectors with them.
//
// ⚠ TEAM PROGRESS IS THE ONE TEAM-LEVEL READ (owner rulings T1–T8, 2026-09-16 — the D8 the
// re-evaluation parked): counts of motion per METRIC, the rows metrics and never players, so the
// table cannot rank children by construction. Its counts arrive from the board route as counts
// (a per-player first never travels), and every one is a fold over the same series reader the
// chart draws from. The Overview does not change — its rail's report count reads 4 by computation.
//
// ⚠ COVERAGE IS THE ONE ROSTER TABLE (re-evaluation stage 4, owner ruling G1,
// 2026-09-16). The Skills & Goals Players tab drew the same cell from the same
// board read; the gate decided which copy stays — that hub is all-or-nothing
// behind the Development grant, this report is read by every coach with record
// access, and a read must not move behind a write grant. So Coverage took the one
// thing Players had (Current focus — the goals as words — as its first Show
// choice), lost the Active-focus count and the Returning-player column (an
// identity fact, E9), and opens on its count line: the heading, the description
// and the disclaimer live in the help. An absence is a dash, whatever the reason
// (owner, 2026-09-17: a session marking a player not-assessed is not shown as
// such here — whether the player was there is noise the table no longer carries,
// and the no-legend footer that used to explain the dash is gone with it).
//
// Practice Plans Phase 3 added three sections (frames 08–09), and this is the
// surface where §4's no-ranking rules are sharpest, because it is the one that
// NAMES CHILDREN WHO HAVE BEEN MISSED:
//   · ROSTER ORDER ONLY. No sort control on any column, ever — and emphatically
//     not "least covered first".
//   · A FLAG OR A BLANK, NEVER A COMPARABLE NUMBER. No count, percentage,
//     streak or average beside a child's name; no team average, no percentile.
//   · The vocabulary is coverage of the COACH'S ATTENTION, not assessment of a
//     player: the column reads "In a plan" — never "worked on", "covered" or
//     "did".
//   · The finding is COUNT-ONLY AND NAMELESS, and silent until real usage.
//
// ⚠ TWO TRUTH STATUSES ON ONE SCREEN, DELIBERATELY KEPT APART (the §10.2
// "Recorded here" precedent). Coverage says PLANNED. Practice review labels each
// practice by what its records support (F03, 2026-09-11): an upcoming plan, a
// past plan with no recap, or a recap — and only the recap describes reality,
// because a coach sat down afterwards and wrote it. A recap existing there does
// NOT license the coverage table to claim the plan happened.
//
// ⚠ EACH READ CARRIES ITS STATE (F05). "Couldn't load" and "incomplete" are said
// in the section, never rendered as "nothing here" — and no gap (the column, the
// finding, the uncovered tags) is drawn from a read that did not fully arrive.
// The progress report's own read (one player) says "couldn't load" the same way.
//
// ⚠ READS STAY BOUNDED (plan §10): Coverage reads the board once (it already
// carries the latest per metric); Player progress reads ONE player's development.
// Never every player's full history to draw one chart.
//
// ⚠ ONE DISCLAIMER PER SCREEN (G3): Player progress keeps "A change in this test
// does not explain why it happened." — the one sentence a coach reading a
// falling line might otherwise forget. Everything else the reports used to say
// about themselves is in the help article the page's "?" opens.
// ─────────────────────────────────────────────────────────────────────────────

interface ReportRow {
  playerId: string;
  firstName: string;
  lastName: string | null;
  number: string | null;
  goals: { focusArea: string; status: string }[];
  /** The headline of the player's latest SESSION per metric (Phase 2, 2026-09-13) — the value is
   *  the average for a range test, with the attempt count and how many landed in range. */
  latest: Record<string, { value: number; unit: string; recordedOn: string; attempts: number; inRange: number | null }>;
  /** The latest observation per observed skill — sent only with the notes gate. */
  latestObservation: Record<string, { descriptor: string | null; note: string | null; observedOn: string }>;
  lastRecordedOn: string | null;
  /** ⚠ ONE boolean, or null when the question can't be answered. Never a count. */
  inPlan: boolean | null;
}

interface PracticeRow {
  eventId: string;
  name: string;
  startsAt: string;
  tags: { id: string; name: string }[];
  recap: string | null;
  hasPlan: boolean;
  /** Stamped by the server — one clock for every row. */
  truth: PracticeTruth;
  planSummary: string | null;
}

interface ReportData {
  showGoals: boolean;
  showMeasurables: boolean;
  /** The Development grant — the only key that opens Skills & Goals (stage 0, D5); decided by the server. */
  canWrite: boolean;
  types: RepTeamMeasurableType[];
  rows: ReportRow[];
  /** Team progress — metric id → counts, nameless by construction; a skill only with the notes gate. */
  team: Record<string, TeamMetricCounts>;
  showPlans: boolean;
  planFinding: string | null;
  uncoveredFocus: { id: string; name: string }[];
  practices: PracticeRow[];
  practiceRead: SectionRead;
  practiceCap: number;
  tagRead: SectionRead;
}

/** ONE player's development, as the profile reads it — the progress report's bounded read. */
interface PlayerDevelopment {
  showGoals: boolean;
  showMeasurables: boolean;
  types: RepTeamMeasurableType[];
  measurables: RepPlayerMeasurable[];
  goals: RepPlayerDevelopmentGoal[];
  observations: RepPlayerObservation[];
  reviews: RepDevelopmentGoalReview[];
  authors: Record<string, string>;
  /** The Development grant — the only key that opens a session's page (stage 0, D5). */
  canWrite: boolean;
}

export function DevelopmentPanel({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  // Fresh instance per team — no cross-team fetch races (3A key= pattern).
  return <ReportView key={teamId} orgSlug={orgSlug} teamId={teamId} />;
}

/** The board's wire shape, named the way every roster surface names a player (one home, defensive of stray "null"s). */
const playerName = (r: { firstName: string; lastName: string | null }) => rosterName({ playerFirstName: r.firstName, playerLastName: r.lastName });
/** "60-yd sprint" · sub "test" · "Changeup speed" · sub "test with a range" · "Sets feet before throwing" · sub "skill". */
const metricOptionSub = (t: RepTeamMeasurableType) => t.kind === 'skill' ? 'skill' : t.aim === 'range' ? 'test with a range' : 'test';
/** A retired metric's option carries a "Retired" group instead of repeating the word on every row (SublinedChoice draws it as ONE header above the run). */
const metricOptionGroup = (t: RepTeamMeasurableType) => t.isActive ? undefined : 'Retired';
const workingGoals = (r: ReportRow) => r.goals.filter(g => g.status === 'working');

function ReportView({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  // ⚠ No season lookup here, and none is needed: the board route resolves the team's WORKING
  // season on its own, and P2 deleted the dial that could have named another (2026-08-16). The
  // `useCoachSeasonPage` call this page carried until P3 C1 read a season nothing on the screen
  // then used — a dead call is how a page quietly re-grows a season mode.

  const [data, setData] = useState<ReportData | null>(null);
  const [noSeason, setNoSeason] = useState(false);
  const [error, setError] = useState('');
  /**
   * Every selector rides `?section=development`'s own address (Phase 1 gave it the practice-review
   * `tag=`; Phase 3 adds report · player · metric · show · compare). Read from the address on EVERY
   * render, not copied into state once: the hub keeps this panel mounted, so a Back/Forward or a
   * fresh link that changes any of them must move the selectors with it. A player link from a
   * report carries the report WITH its state back, so the way back lands where the coach was.
   */
  const router = useRouter();
  const searchParams = useSearchParams();
  const address = parseInsightsDevelopmentAddress(searchParams);
  /**
   * Two selector changes can land before the first navigation has updated the address — a second
   * patch built from the render's `address` would silently drop the first. The pending address is
   * the base until the URL catches up (the effect below clears it on every address change).
   */
  const pendingRef = useRef<InsightsDevelopmentAddress | null>(null);
  useEffect(() => { pendingRef.current = null; }, [searchParams]);
  const setAddress = (patch: Partial<InsightsDevelopmentAddress>) => {
    const next = { ...(pendingRef.current ?? address), ...patch };
    pendingRef.current = next;
    router.replace(insightsDevelopmentHref(base, next), { scroll: false });
  };
  /** The phone's sheet over the Progress selectors (G4) — this panel's own state; the choices ride the address. */
  const [sheetOpen, setSheetOpen] = useState(false);
  /**
   * ⚠ The hub keeps this panel MOUNTED and hidden when another Insights tab is active, and the sheet
   * is inline, not portaled — so its `open` must include the tab's own activity (QuestionShell's
   * contract): a sheet left armed on a hidden panel kept the bottom nav hidden and answered Escape
   * on whatever tab the coach was on. Leaving the tab or the report (a back gesture, a tab tap)
   * CLOSES it, the way the hub resets its own tracked section — coming back never re-opens a sheet
   * the coach did not ask for.
   */
  const sheetShown = sheetOpen && searchParams.get('section') === 'development' && address.report === 'progress';
  if (sheetOpen && !sheetShown) setSheetOpen(false);

  /**
   * Sequence guard (the session screen's idiom): the failed-practices "Try again" can be pressed
   * while an earlier load is still in flight, and a slow older response must never land over a
   * newer one. `loading` also disables that button so a coach cannot queue several.
   */
  const loadSeqRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      // ?plans=1 → the three Phase 3 sections — opt-in because it costs a walk of the season's
      // plans the hub tile doesn't render. (⚰ `?history=1` — the Returning-player column's scan of
      // prior-season identities — is no longer asked for: the column left with stage 4, G1/E9.)
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/development/board?plans=1`,
      );
      const json = await res.json().catch(() => null);
      if (seq !== loadSeqRef.current) return;
      // No active program year is a legitimate state, not a retryable failure (board parity).
      if (res.status === 404) {
        setNoSeason(true);
        setData({
          showGoals: false, showMeasurables: false, canWrite: false, types: [], rows: [], team: {},
          showPlans: false, planFinding: null, uncoveredFocus: [], practices: [],
          practiceRead: { state: 'empty', truncated: false }, practiceCap: 0,
          tagRead: { state: 'empty', truncated: false },
        });
        setError('');
        return;
      }
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not load the report — try again.');
      setData(json);
      setError('');
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      setError(e instanceof Error ? e.message : 'Could not load the report — try again.');
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => { load(); }, [load]);

  /**
   * The Metric choices: every definition in library order, active first, retired after (a retired
   * test's results are still a record) — and an observed skill ONLY when this coach reads
   * observations (they ride the notes gate): a report that quotes them is gated the way the read is.
   */
  const metricOptions = useMemo(() => {
    if (!data) return [];
    const byOrder = (a: RepTeamMeasurableType, b: RepTeamMeasurableType) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
    const readable = data.types.filter(t => t.kind === 'test' || data.showGoals);
    return [...readable.filter(t => t.isActive).sort(byOrder), ...readable.filter(t => !t.isActive).sort(byOrder)];
  }, [data]);

  // ⚠ Both early returns lost their `styles.page` wrapper with the move to a panel — the hub
  // supplies it, and a second one nested inside re-applies the page's padding and max-width to a
  // single line of text.
  if (!data && !error) {
    return <div className={styles.loadingState}>Loading the report…</div>;
  }
  if (!data) {
    return (
      <p className={styles.detailPlaceholder}>
        {error}{' '}
        <button type="button" className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '0.15rem 0.5rem' }}
          onClick={() => { setError(''); load(); }}>
          Try again
        </button>
      </p>
    );
  }

  const { rows, showPlans, practices, practiceRead } = data;
  // A failed read is something to SHOW, not an absence — it must not collapse into "nothing yet".
  const practiceTrouble = showPlans && (practiceRead.state === 'failed' || practiceRead.state === 'incomplete');
  const anyData = rows.some(r => r.goals.length > 0 || Object.keys(r.latest).length > 0 || Object.keys(r.latestObservation ?? {}).length > 0)
    || practices.length > 0 || practiceTrouble;

  // The effective selections: what the address says, or the honest default — the first active
  // test, the first roster row, the headline, the season. Never an id the lists do not hold.
  const report: DevelopmentReport = address.report === 'practices' && !showPlans ? 'coverage' : address.report;
  const metric = metricOptions.find(t => t.id === address.metricId) ?? metricOptions.find(t => t.isActive && t.kind === 'test') ?? metricOptions[0] ?? null;
  // Coverage's first Show choice — the goals as words — rides `metric=focus` (G1), with Internal notes
  // only. It is also the honest default when the team has defined NO test or skill yet (goals and
  // plans can exist before a metric does): there is no figure column to show, so the words are it.
  const focus = report === 'coverage' && data.showGoals && (address.metricId === COVERAGE_FOCUS || metric === null);
  const player = rows.find(r => r.playerId === address.playerId) ?? rows[0] ?? null;
  const show: ProgressShow = address.show ?? 'headline';
  const compare: CompareWindow = address.compare ?? 'season';
  /** Where a player link comes back to: this report, with every selection it holds. */
  const here = insightsDevelopmentHref(base, {
    tag: address.tag, report,
    playerId: report === 'progress' ? player?.playerId : null,
    metricId: !REPORTS_WITH_METRIC.has(report) ? null : focus ? COVERAGE_FOCUS : metric?.id,
    show: report === 'progress' ? address.show : null,
    compare: report === 'progress' ? address.compare : null,
  });

  const reportChoices = developmentReports(showPlans);
  const showChoices = metric ? showOptions(metric) : [];
  const playerLabel = (r: ReportRow) => `${r.number ? `#${r.number} ` : ''}${playerName(r)}`;

  /** Metric choices shared by the Progress select and the Coverage "Show" select — the metric's own kind ("test" · "test with a range" · "skill") as the Progress qualifier, retired ones grouped under ONE "Retired" header instead of a tag repeated on every row. */
  const progressMetricOptions: SublinedOption<string>[] = metricOptions.map(t => ({
    value: t.id, name: t.name, sub: metricOptionSub(t), group: metricOptionGroup(t),
  }));

  /* The Progress selectors — Player · Metric · Show · Compare — as a row of fields on a desktop, and
     drawn ONCE so the sheet on a phone (G4) is the same four controls in a column. Takes an idPrefix
     because BOTH call sites can be mounted at once (`.devReportDesktopOnly` hides its copy with CSS,
     not unmount) — a hardcoded id on the Metric field would duplicate across them. */
  const progressFields = (idPrefix: string) => metric && (
    <>
      {/* Roster order, never ranked. Changing the player keeps the report, the metric and the window. */}
      <label className={styles.field}>
        <span className={styles.label}>Player</span>
        <select className={`${styles.select} ${styles.devToolbarControl}`} value={player?.playerId ?? ''} onChange={e => setAddress({ playerId: e.target.value })}>
          {rows.map(r => <option key={r.playerId} value={r.playerId}>{playerLabel(r)}</option>)}
        </select>
      </label>
      <div className={styles.field}>
        {/* ⚠ SublinedChoice draws NO visible label — its `label` prop is the ARIA name only. */}
        <label className={styles.label} htmlFor={`${idPrefix}-metric`}>Metric</label>
        <SublinedChoice
          id={`${idPrefix}-metric`}
          label="Metric"
          variant="toolbar"
          showClosedSub
          options={progressMetricOptions}
          value={metric.id}
          onChange={v => setAddress({ metricId: v })}
        />
      </div>
      {showChoices.length > 1 && (
        <label className={styles.field}>
          <span className={styles.label}>Show</span>
          <select className={`${styles.select} ${styles.devToolbarControl}`} value={show} onChange={e => setAddress({ show: e.target.value as ProgressShow })}>
            {showChoices.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
      )}
      {metric.kind === 'test' && (
        <label className={styles.field}>
          <span className={styles.label}>Compare</span>
          <select className={`${styles.select} ${styles.devToolbarControl}`} value={compare} onChange={e => setAddress({ compare: e.target.value as CompareWindow })}>
            {(['season', 'last-two'] as const).map(id => <option key={id} value={id}>{COMPARE_LABELS[id]}</option>)}
          </select>
        </label>
      )}
    </>
  );
  /** The phone's one line for the four choices — "Best attempt · This season" under the player and the metric. */
  const progressSummarySub = metric && metric.kind === 'test'
    ? [showChoices.length > 1 ? (showChoices.find(o => o.id === show)?.label ?? null) : null, COMPARE_LABELS[compare]].filter(Boolean).join(' · ')
    : null;

  return (
    /* ⚠ NO WRAPPER AND NO HEADER — this is a PANEL (reports portal P1, 2026-08-18). The hub owns
       `styles.page`, the <h1> and the help "?".

       ⚠ THE REPORT KEEPS THE WORD "DEVELOPMENT" AND THE NAV WORKBENCH DOES NOT: the sidebar item
       is now "Skills & Goals" (owner ruling 5, 2026-08-18). That collision — two doors both called
       Development, one a coverage report and one a workbench — is why this file's old title asked a
       question instead of naming itself. The door under the Coverage table names the room for a
       coach who holds the grant to it. */
    <>
      {noSeason ? (
        <p className={styles.detailPlaceholder}>
          No active season for this team yet — the report fills in once a season is set up.
        </p>
      ) : !anyData ? (
        <p className={styles.detailPlaceholder}>
          Nothing to cover yet — run a session in Skills &amp; Goals, add a goal from any
          player&apos;s record, or write a plan for a practice.
        </p>
      ) : (
        <>
          {/* ── The Report selector (Phase 3): ONE labelled row of form controls, never tabs. On a
              phone the Report field stays a field and Progress's other four fold into ONE summary
              control that opens a sheet (G4) — the answer lands on the first screen. ── */}
          <div className={styles.devReportToolbar}>
            {/* Report and Show are plain labelled selects (2026-09-17) — the SAME `.field` +
                `.label` + `.select` .devToolbarControl recipe Player/Metric/Compare already use
                two lines down in `progressFields`, and the Skills & Goals workbench this toolbar
                was always meant to match (this file's own header comment named that intent when
                the toolbar was built). SublinedChoice's one-off "toolbar" variant — a <button>
                standing in for a <select> — never quite read as one of them; a real <select>
                does, at zero CSS cost, because `.select`/`.devToolbarControl` already style it. */}
            <label className={styles.field}>
              <span className={styles.label}>Report</span>
              <select
                className={`${styles.select} ${styles.devToolbarControl}`}
                value={report}
                onChange={e => setAddress({ report: e.target.value as DevelopmentReport })}
              >
                {reportChoices.map(id => <option key={id} value={id}>{REPORT_LABELS[id]}</option>)}
              </select>
            </label>
            {report === 'coverage' && (data.showGoals || metricOptions.length > 0) && (
              // Show: Current focus first (with Internal notes — the goals as words), then every
              // metric — active in the open run, retired grouped under one native <optgroup> (a
              // real browser group header, never a tag repeated on every option the way a plain
              // <option> had to say "(retired)" on every single row).
              <label className={styles.field}>
                <span className={styles.label}>Show</span>
                <select
                  className={`${styles.select} ${styles.devToolbarControl}`}
                  value={focus ? COVERAGE_FOCUS : (metric?.id ?? '')}
                  onChange={e => setAddress({ metricId: e.target.value })}
                >
                  {data.showGoals && <option value={COVERAGE_FOCUS}>Current focus</option>}
                  {metricOptions.filter(t => t.isActive).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                  {metricOptions.some(t => !t.isActive) && (
                    <optgroup label="Retired">
                      {metricOptions.filter(t => !t.isActive).map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
            )}
            {report === 'progress' && player && metric && (
              <>
                <div className={styles.devReportDesktopOnly}>{progressFields('progress-desktop')}</div>
                <button type="button" className={`${styles.devReportSummary} ${styles.devReportPhoneOnly}`} onClick={() => setSheetOpen(true)} aria-haspopup="dialog">
                  <span className={styles.devReportSummaryMain}>
                    <b>{playerName(player)}{player.number ? <span className={styles.devBoardMuted}> #{player.number}</span> : null}</b> · {metric.name}
                    {progressSummarySub && <small>{progressSummarySub}</small>}
                  </span>
                  <span className={styles.devReportSummaryDoor}>Change ›</span>
                </button>
              </>
            )}
          </div>

          {report === 'coverage' && (
            <CoverageReport data={data} metric={metric} focus={focus} base={base} here={here} tag={address.tag} />
          )}
          {report === 'team' && (
            <TeamReport data={data} metrics={metricOptions} base={base} tag={address.tag} />
          )}
          {report === 'progress' && (
            player && metric
              ? <ProgressReport key={player.playerId} orgSlug={orgSlug} teamId={teamId} base={base} player={player} metric={metric} show={show} compare={compare} here={here} />
              : <p className={styles.detailPlaceholder}>No active players or metrics to read yet.</p>
          )}
          {report === 'practices' && showPlans && (
            <PracticeReview data={data} base={base} tag={address.tag} setTag={tag => setAddress({ tag })} loading={loading} reload={load} />
          )}

          {/* The phone's sheet (G4): the same four choices, one column, Done — on the one form chrome.
              Each change already rides the address; Done only closes it onto the chart. */}
          {report === 'progress' && player && metric && (
            <QuestionShell open={sheetShown} onClose={() => setSheetOpen(false)} ariaLabel="Change what Player progress shows" title="Player progress">
              <div className={styles.devReportSheetFields}>
                {progressFields('progress-sheet')}
                <p className={styles.formHint}>Roster order. A skill has no Show or Compare; a range test no Show.</p>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`btn btn-lime ${styles.tapFloor}`} onClick={() => setSheetOpen(false)}>Done</button>
              </div>
            </QuestionShell>
          )}
        </>
      )}
    </>
  );
}

// ── Coverage — the ONE roster table (G1): the chosen metric, or the goals as words, per player ───
function CoverageReport({ data, metric, focus, base, here, tag }: {
  data: ReportData; metric: RepTeamMeasurableType | null; focus: boolean; base: string; here: string; tag: string | null;
}) {
  const { rows, showPlans, planFinding, uncoveredFocus, practiceRead, practiceCap, tagRead, canWrite } = data;
  /**
   * The coverage column appears only when the question is ANSWERABLE — the API sends `inPlan: null`
   * on every row otherwise. Assigning players to blocks is optional: a coach whose practice is
   * "everyone rotates through four stations" names nobody, and flagging their entire roster would
   * be the product misreading its own data as a coaching failure.
   */
  const showCoverage = showPlans && rows.some(r => r.inPlan !== null);
  const shownMetric = focus ? null : metric;
  const cells = shownMetric
    ? rows.map(r => coverageCell({
      latest: r.latest[shownMetric.id] ?? null,
      latestObservation: r.latestObservation?.[shownMetric.id] ?? null,
    }, shownMetric))
    : null;
  /** Current focus: each row's goals being worked on, as words — computed once for the count and the rows. */
  const workingByRow = focus ? rows.map(r => workingGoals(r).map(g => g.focusArea)) : null;
  const recorded = workingByRow ? workingByRow.filter(w => w.length > 0).length : cells ? cells.filter(c => c.state === 'recorded').length : 0;
  const isSkill = shownMetric?.kind === 'skill';
  /** The record, opened where the chosen thing lives — Goals, the metric's Results row, or (a skill) the Notes tab — carrying the way back (F09). */
  const recordHref = (r: ReportRow) => focus || !shownMetric
    ? playerDevelopmentHref(base, r.playerId, { view: 'goals', returnTo: here })
    : isSkill
      ? playerTabHref(`${base}/roster/${r.playerId}`, 'notes', { returnTo: here })
      : playerDevelopmentHref(base, r.playerId, { view: 'results', metricId: shownMetric.id, returnTo: here });

  return (
    <>
      {/* ── The count line — the first thing under the toolbar, and the one place the binding
          coverage wording is said (G1). The heading, the description and the disclaimer it used
          to sit under are in the help. ── */}
      {(focus || (shownMetric && cells)) && (
        <p className={styles.devReportDenominator}>
          {coverageDenominator(recorded, rows.length, focus ? 'focus' : shownMetric!)}
          <span className={styles.devReportOrderNote}> · {COVERAGE_ORDER_NOTE}</span>
        </p>
      )}

      {/* ⚠ COUNT-ONLY AND NAMELESS, and silent until there is real usage. This is the findings
          rule applied in place — there is deliberately no seventh Insights tile. */}
      {planFinding && (
        <p className={styles.reportFinding}>
          <Info size={15} aria-hidden />
          <span>{planFinding}</span>
        </p>
      )}
      {/* F05 — the column and the finding are WITHHELD on a read that did not fully arrive, and
          the reason is said here rather than left as a column that quietly isn't there. */}
      {showPlans && practiceRead.state === 'failed' && (
        <p className={styles.reportFinding}>
          <Info size={15} aria-hidden />
          <span>The practice plans couldn&apos;t be loaded, so &ldquo;In a plan&rdquo; isn&apos;t shown — nothing here is a finding about a player.</span>
        </p>
      )}
      {showPlans && practiceRead.state === 'incomplete' && (
        <p className={styles.reportFinding}>
          <Info size={15} aria-hidden />
          <span>This season has more than {practiceCap} practices with a plan or recap. Only the most recent {practiceCap} were read, so &ldquo;In a plan&rdquo; isn&apos;t shown — it can&apos;t be answered from part of the season.</span>
        </p>
      )}

      {/* .tableAsCards reflows the table into stacked cards @640 (the Roster idiom) — and on a phone
          (G4) each card is ONE LINE: the name, then the result and its date, a tick for In a plan,
          the chevron to Progress. The figure cells are hidden there and the lead cell carries the
          line — the shared `.cardPhoneLine` / `.cardDesktopCell` family, with `.cardsOneLine` as its one-line
          variant (folded from this table's own pair by the shared style kit, 2026-09-16). */}
      <div className={`${styles.tableWrap} ${styles.tableAsCards} ${styles.cardsOneLine}`}>
        <table className={styles.devBoardTable}>
          <thead>
            <tr>
              {/* ⚠ NO sort affordance on any column, ever. Roster order is the only order. */}
              <th>Player</th>
              {focus ? (
                <>
                  <th>Current focus</th>
                  <th>Status</th>
                </>
              ) : shownMetric ? (
                <>
                  {/* The chosen metric, and ITS date — never one "last measurable" for everything (F12). */}
                  <th>{shownMetric.name}</th>
                  <th>{isSkill ? 'Observed on' : 'Recorded on'}</th>
                </>
              ) : null}
              {/* ⚠ "In a plan" — never "worked on", "covered" or "did". A recap existing in the
                  section below does not license this column to claim the plan happened. */}
              {showCoverage && <th>In a plan</th>}
              {shownMetric && <th aria-label="Progress" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const name = playerName(r);
              const working = workingByRow?.[i] ?? [];
              const cell = cells?.[i] ?? null;
              const on = cell?.on ? formatShortDate(cell.on) : null;
              // The phone's one line: "8.28 seconds · 15 Sept · ✓" · "— · ✓".
              const phoneLine = [
                focus ? (working.length > 0 ? working.join(' · ') : COVERAGE_DASH) : cell ? (on ? `${cell.text} · ${on}` : cell.text) : null,
                showCoverage && r.inPlan ? '✓' : null,
              ].filter(Boolean).join(' · ');
              return (
                <tr key={r.playerId}>
                  <td className={`${styles.cardStackCell} ${styles.cardsOneLineLead}`}>
                    <Link href={recordHref(r)} className={styles.devCellLink}>
                      {r.number ? <span className={styles.devRowNum}>#{r.number} </span> : null}{name}
                    </Link>
                    {phoneLine && <span className={styles.cardPhoneLine}>{phoneLine}</span>}
                  </td>
                  {focus ? (
                    <>
                      <td data-label="Current focus" className={styles.cardDesktopCell}>
                        {working.length > 0
                          ? working.join(' · ')
                          : r.goals.length > 0 ? <Muted>{r.goals.length} achieved/parked</Muted> : <Muted>{COVERAGE_DASH}</Muted>}
                      </td>
                      <td data-label="Status" className={styles.cardDesktopCell}>
                        {working.length > 0 ? `${working.length} active focus area${working.length === 1 ? '' : 's'}` : <Muted>{COVERAGE_DASH}</Muted>}
                      </td>
                    </>
                  ) : shownMetric && cell ? (
                    <>
                      <td data-label={shownMetric.name} className={`${styles.devBoardVal} ${styles.cardDesktopCell}`} style={{ whiteSpace: 'normal' }}>
                        {cell.state === 'recorded' ? cell.text : <Muted>{cell.text}</Muted>}
                      </td>
                      {/* A date, in the body face like every other list's (standard §3.4); only the
                          measurement beside it keeps the data face (K-20). */}
                      <td data-label={isSkill ? 'Observed on' : 'Recorded on'} className={`${styles.tdDate} ${styles.cardDesktopCell}`}>
                        {on ?? <Muted>{COVERAGE_DASH}</Muted>}
                      </td>
                    </>
                  ) : null}
                  {showCoverage && (
                    <td data-label="In a plan" className={styles.cardDesktopCell}>
                      {/* ⚠ A FLAG OR A QUIET TICK — never a number. There is no count of plans
                          here, no percentage, no streak, and no team average on the row,
                          because any of those could be read against another child's row. */}
                      {r.inPlan
                        ? <span className={styles.devBoardMuted} aria-label="In a plan">✓</span>
                        : <span className={styles.reportFlag}>— not in a plan yet</span>}
                    </td>
                  )}
                  {shownMetric && (
                    <td className={`${styles.cardActionCell} ${styles.cardActionCorner}`}>
                      {/* The same player in the progress report, the metric kept — the words on a desktop,
                          the card's corner chevron on a phone; one link, one door. ⚠ WORDS, not the
                          standard's bare chevron (register K-19): the name beside it is already a door
                          (the player's record), and a second chevron on the row would read as the same
                          door. A row with two doors names the second. */}
                      <span className={styles.listRowActions}>
                        <Link href={insightsDevelopmentHref(base, { tag, report: 'progress', playerId: r.playerId, metricId: shownMetric.id })}
                          className={`${styles.devReportRowLink} ${styles.devReportDoor}`} aria-label={`Open ${name}’s progress`}>
                          <span className={styles.cardDesktopCell}>Progress →</span>
                          <ChevronRight size={16} className={`${styles.listRowChevron} ${styles.devReportPhoneOnly}`} aria-hidden />
                        </Link>
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* The door to the room, for the coaches who hold the key: a session is where the roster gets
          recorded, and a door a coach cannot open is not offered (the closed-season rule, one door at
          a time). `.insightsOpsLink` — the quiet "go do something about this" link at the foot of a
          report, on the 44px floor. */}
      {canWrite && (
        <Link href={`${base}/development`} className={styles.insightsOpsLink}>
          Record in Skills &amp; Goals →
        </Link>
      )}

      {/* ── Section 2 · Focus areas that haven't appeared in a plan ──
          ⚠ TAGS, never focus areas and never players. A focus area is the coach's own specific
          words about one child, and printing those in a list of gaps would put a paraphrased
          judgement about a named minor on a report page. An UNTAGGED area is never listed at
          all: the product cannot tell whether tonight covered it, and absence of data must not
          read as absence of need. */}
      {showPlans && tagRead.state === 'failed' && (
        <p className={styles.reportFinding}>
          <Info size={15} aria-hidden />
          <span>The practice tags couldn&apos;t be loaded, so focus areas can&apos;t be matched against plans right now and the practices are shown without their tags.</span>
        </p>
      )}
      {showPlans && uncoveredFocus.length > 0 && (
        <>
          <p className={styles.reportSectionTitle}>Focus areas that haven&apos;t appeared in a plan</p>
          <p className={styles.reportSectionSub}>
            Tags on your players&apos; active focus areas, matched against what you planned.
            Untagged areas aren&apos;t listed — the product can&apos;t tell, so it doesn&apos;t guess.
          </p>
          <div className={styles.ppSuggestWrap}>
            {uncoveredFocus.map(t => (
              <span key={t.id} className={styles.ppChip}>{t.name}</span>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ── Player progress (NEW — screen 5): one player, one metric, a dated chart and the records ──────
function ProgressReport({ orgSlug, teamId, base, player, metric, show, compare, here }: {
  orgSlug: string; teamId: string; base: string; player: ReportRow; metric: RepTeamMeasurableType;
  show: ProgressShow; compare: CompareWindow; here: string;
}) {
  const [dev, setDev] = useState<PlayerDevelopment | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Sequenced (`loadSeqRef`): the player can change while a read is in flight — a slow older
  // player's response must never land under a newer player's name.
  const loadSeqRef = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster/${player.playerId}/development`);
      const json = await res.json().catch(() => null);
      if (seq !== loadSeqRef.current) return;
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not load this player’s records — try again.');
      setDev(json);
      setError('');
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      setError(e instanceof Error ? e.message : 'Could not load this player’s records — try again.');
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [orgSlug, teamId, player.playerId]);
  useEffect(() => { load(); }, [load]);

  const name = playerName(player);
  const first = player.firstName;

  if (!dev && !error) return <div className={styles.loadingState}>Loading {first}’s records…</div>;
  if (!dev) {
    // F05: a failed read says so — it is never "nothing recorded".
    return (
      <p className={styles.detailPlaceholder}>
        {error} This is a loading problem, not an empty record.{' '}
        <button type="button" className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '0.15rem 0.5rem' }}
          disabled={loading} onClick={() => load()}>
          {loading ? 'Loading…' : 'Try again'}
        </button>
      </p>
    );
  }

  const author = (id: string | null) => (id ? (dev.authors[id] ?? 'a coach') : null);
  const def: ReportDefinition = metric;
  const isSkill = metric.kind === 'skill';
  // A test's home on the player is its Results row; a skill's observations live on the NOTES tab
  // (re-evaluation stage 3, E1/E2 — the Observations view is gone), read with the way back.
  const openHref = isSkill
    ? playerTabHref(`${base}/roster/${player.playerId}`, 'notes', { returnTo: here })
    : playerDevelopmentHref(base, player.playerId, { view: 'results', metricId: metric.id, returnTo: here });

  const head = (
    <div className={styles.devReportHead}>
      <h2>{name}{player.number ? <span className={styles.devBoardMuted}> #{player.number}</span> : null}</h2>
      <span className={styles.reportSectionSub} style={{ margin: 0 }}>Current season</span>
    </div>
  );

  // ── An observed skill: the observation timeline — no line ever joins descriptors ──
  if (isSkill) {
    const observations = dev.observations.filter(o => o.measurableTypeId === metric.id);
    const goalById = new Map(dev.goals.map(g => [g.id, g]));
    const goalsWithEvidence = dev.goals.filter(g => observations.some(o => o.goalId === g.id));
    return (
      <>
        {head}
        <div className={styles.devReportHead}>
          <h2 style={{ fontSize: 'var(--type-body)' }}>{metric.name}</h2>
          <span className={styles.tagRead}>Skill</span>
        </div>
        {observations.length === 0 ? (
          <CoachEmptyState quiet compact icon={<TrendingUp size={18} aria-hidden />}
            headline={`No observation recorded for ${name} in this skill this season`}
            description="Stated as an absence of records, never as a judgement. Record one from a session or from a goal on the player’s record."
            primaryAction={{ href: openHref, label: `Open ${first}’s development →`, variant: 'ghost' }} />
        ) : (
          <>
            <p className={styles.reportSectionSub}>What the coach saw, in a stated setting — newest first.</p>
            <ol className={styles.devReportTimeline}>
              {observations.map(o => {
                const goal = o.goalId ? goalById.get(o.goalId) : null;
                return (
                  <li key={o.id}>
                    <time dateTime={o.observedOn}>{formatShortDate(o.observedOn)}{author(o.createdBy) ? ` · written by ${author(o.createdBy)}` : ''}</time>
                    {o.descriptor && <p><strong>{o.descriptor}</strong></p>}
                    {o.note && <p>{o.note}</p>}
                    {(o.sessionId || goal) && (
                      <p className={styles.devCardNote}>
                        {/* The session it was taken in is a DOOR (stage 3 housekeeping — "in an evaluation session" had none). */}
                        {o.sessionId && (dev.canWrite
                          ? <Link href={`${base}/development/sessions/${o.sessionId}`} className={styles.devReportRowLink}>in a session ›</Link>
                          : 'in a session')}
                        {o.sessionId && goal ? ' · ' : ''}
                        {goal ? `Evidence for: ${goal.focusArea}` : ''}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
            {/* The observation is listed ONCE (G3): a goal it is evidence for is a DOOR to the record,
                where stage 3 put the goal's history — in the open goal row, carrying the way back. */}
            {goalsWithEvidence.map(g => (
              <p key={g.id} className={styles.formHint} style={{ marginTop: '0.6rem' }}>
                <Link href={playerDevelopmentHref(base, player.playerId, { view: 'goals', goalId: g.id, returnTo: here })} className={styles.devReportRowLink}>
                  How &ldquo;{g.focusArea}&rdquo; has developed ›
                </Link>
                <span className={styles.devBoardMuted}> on {first}’s record</span>
              </p>
            ))}
          </>
        )}
        <Link href={openHref} className={styles.insightsOpsLink}>Open {first}’s development →</Link>
      </>
    );
  }

  // ── A measured test: the answer in words, the chart, the records behind it ──
  const readings = dev.measurables.filter(m => m.measurableTypeId === metric.id);
  const series: ProgressSeries<RepPlayerMeasurable> = progressSeries(readings, def, { show, compare });
  if (series.points.length === 0) {
    return (
      <>
        {head}
        <CoachEmptyState quiet compact icon={<TrendingUp size={18} aria-hidden />}
          headline={`No result recorded for ${name} in this test this season`}
          description="Stated as an absence of records, never as a judgement. Record one from a session or from the player’s Results."
          primaryAction={{ href: openHref, label: `Open ${first}’s development →`, variant: 'ghost' }} />
      </>
    );
  }
  const isRange = series.band != null;
  const unitHead = `Attempts · ${series.unit}`;
  const headWord = isRange ? 'In range' : headlineLead(def) === 'average' ? 'Headline' : headlineLead(def) === 'last' ? 'Last' : 'Best';
  const newestFirst = [...series.points].reverse();
  /** The phone's attempts line under a card's title — "8.31* · 8.24 · average 8.275" (the grid's correction mark); nothing for one clean attempt. */
  const phoneAttempts = (row: ProgressPoint<RepPlayerMeasurable>['row']) => {
    if (row.values.length < 2 && !row.attempts.some(a => a.correctedFrom != null)) return null;
    const marks = row.attempts.map(a => `${formatValue(a.value)}${a.correctedFrom != null ? '*' : ''}`).join(' · ');
    return row.values.length > 1 && row.average != null && !isRange ? `${marks} · average ${formatValue(row.average)}` : marks;
  };
  /** The source is the DOOR (C7 — no "entered by" on a row; the session and the sheet say who): the
   *  session, or the result's own sheet on the player's Results row; the words alone for a reader. */
  const source = (row: ProgressPoint<RepPlayerMeasurable>['row']) => row.sessionId
    ? (dev.canWrite ? <Link href={`${base}/development/sessions/${row.sessionId}`} className={styles.devReportRowLink}>Session ›</Link> : 'In a session')
    : (dev.canWrite
      ? <Link href={playerDevelopmentHref(base, player.playerId, { view: 'results', metricId: metric.id, returnTo: here })} className={styles.devReportRowLink}>Outside a session ›</Link>
      : 'Outside a session');
  /** One row of "Records behind the chart" — and, on a phone, one card: date and headline, the attempts, the door. */
  const recordRow = (row: ProgressPoint<RepPlayerMeasurable>['row']) => {
    const corrected = row.attempts.filter(a => a.correctedFrom != null);
    const attempts = phoneAttempts(row);
    return (
      <tr key={row.key}>
        {/* The date in the body face (standard §3.4); the three measurement columns keep the data face (K-20). */}
        <td className={`${styles.tdDate} ${styles.cardStackCell}`}>
          <span className={styles.cardDesktopCell}>{formatShortDate(row.recordedOn)}</span>
          <span className={styles.cardPhoneLine}><b>{formatShortDate(row.recordedOn)} · {isRange ? `${row.headline ?? 0} of ${row.values.length} in range` : headlineLabel(row, def)}</b></span>
          {attempts && <span className={styles.cardPhoneLine}>{attempts}</span>}
        </td>
        <td data-label={unitHead} className={`${styles.devBoardVal} ${styles.cardDesktopCell}`} style={{ whiteSpace: 'normal' }}>
          {/* Every attempt the row holds — the plan it was run against is the session's own fact
              (re-evaluation stage 2, C1) and is reported there ("fewer than planned"), not here. */}
          {row.values.map(formatValue).join(' · ')}
          {corrected.length > 0 && (
            <span className={styles.devCardNote}>corrected — was {corrected.map(a => formatValue(a.correctedFrom!)).join(' · ')}</span>
          )}
        </td>
        <td data-label={headWord} className={`${styles.devBoardVal} ${styles.cardDesktopCell}`}>
          {isRange ? `${row.headline ?? 0} of ${row.values.length}` : headlineLabel(row, def)}
        </td>
        <td data-label="Average" className={`${styles.devBoardVal} ${styles.cardDesktopCell}`}>
          {row.average != null && row.values.length > 1 ? formatValue(row.average) : <Muted>—</Muted>}
        </td>
        <td>{source(row)}</td>
      </tr>
    );
  };

  return (
    <>
      {head}
      <div className={styles.devReportHead}>
        <h2 style={{ fontSize: 'var(--type-body)' }}>{metric.name}</h2>
      </div>
      {series.answer && (
        <p className={styles.devReportAnswer}>
          <strong>{series.answer.value}</strong> on {formatShortDate(series.answer.on)}
          {series.change && <span className={styles.devReportAnswerSub}> · {series.change}</span>}
        </p>
      )}
      <p className={styles.formHint}>{scopeLine(series)}</p>
      <DevelopmentProgressChart series={series} playerName={first} />

      <p className={styles.reportSectionTitle}>Records behind the chart</p>
      <p className={styles.reportSectionSub}>Every attempt, as recorded · newest first</p>
      <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
        <table className={styles.devBoardTable}>
          <thead>
            <tr>
              <th>Date</th>
              <th>{unitHead}</th>
              <th>{headWord}</th>
              <th>Average</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {newestFirst.map(p => recordRow(p.row))}
          </tbody>
        </table>
      </div>
      <p className={styles.formHint} style={{ marginTop: '0.6rem' }}>A change in this test does not explain why it happened.</p>
      <Link href={openHref} className={styles.insightsOpsLink}>Open {first}’s development →</Link>
    </>
  );
}

// ── Practice review (RESTYLED — screen 5): each practice labelled by what its records support ─────
function PracticeReview({ data, base, tag, setTag, loading, reload }: {
  data: ReportData; base: string; tag: string | null; setTag: (tag: string | null) => void; loading: boolean; reload: () => void;
}) {
  const { practices, practiceRead, practiceCap, tagRead } = data;
  // The SAME predicate the drill library and the template room use. `filterTagged` needs a `tags`
  // array and a `name`, which a practice row already has. This screen keeps its own single-select
  // chip row (a URL-addressable `tag`, not the library's multi-select dropdown) — wrapped into a
  // one-element set for the shared predicate's now-multi-select contract.
  const shownPractices = filterTagged(practices, '', tag == null ? new Set() : new Set([tag]));
  // ⚠ `collectTags`, not a hand-rolled dedup. Its own doc names this list as one of its three
  // callers, and a second copy of "unique tags in first-seen order" is exactly how two surfaces
  // start quietly disagreeing — which is what the shared module exists to prevent.
  const practiceTagChips = collectTags(practices);

  /* ⚠ Each practice is labelled by what its records SUPPORT (F03): Upcoming plan · Past
     plan · no recap · Recap recorded. Only a recap describes what happened, and it earns
     that because a coach sat down afterwards and wrote it. Kept apart from coverage
     on purpose (the §10.2 "Recorded here" precedent).

     This is also the payoff for writing a recap at all: a coach about to plan a hitting
     practice filters to Hitting and gets every hitting practice they planned, what was in
     it, and what they said afterwards. */
  return (
    <>
      <p className={styles.reportSectionTitle}>Practice review</p>
      <p className={styles.reportSectionSub}>
        What was planned, and what was written afterwards. Filter by tag to see what you did last time — and how it went.
        {practiceRead.state === 'incomplete' && ` Showing the ${practiceCap} most recent — the season holds more.`}
      </p>
      {tagRead.state === 'failed' && (
        <p className={styles.reportFinding}>
          <Info size={15} aria-hidden />
          <span>The practice tags couldn&apos;t be loaded, so the practices below are shown without their tags.</span>
        </p>
      )}
      {practiceRead.state === 'failed' ? (
        <p className={styles.detailPlaceholder}>
          Couldn&apos;t load the practices — this is a loading problem, not an empty season.{' '}
          <button type="button" className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '0.15rem 0.5rem' }}
            disabled={loading} onClick={() => reload()}>
            {loading ? 'Loading…' : 'Try again'}
          </button>
        </p>
      ) : practices.length === 0 ? (
        <p className={styles.detailPlaceholder}>No practice has a plan or a recap yet this season.</p>
      ) : (
        <>
          <div className={styles.ppSuggestWrap}>
            <button type="button" className={styles.ppSuggestChip} data-on={tag == null ? 'on' : undefined}
              onClick={() => setTag(null)}>All <span>{practices.length}</span></button>
            {practiceTagChips.map(t => (
              <button key={t.id} type="button" className={styles.ppSuggestChip}
                data-on={tag === t.id ? 'on' : undefined} onClick={() => setTag(t.id)}>
                {t.name} <span>{practices.filter(p => p.tags.some(x => x.id === t.id)).length}</span>
              </button>
            ))}
            {/* Always offered when it applies — an untagged practice must never become
                unreachable simply by carrying no tags. */}
            {practices.some(p => p.tags.length === 0) && (
              <button type="button" className={styles.ppSuggestChip}
                data-on={tag === UNTAGGED_FILTER ? 'on' : undefined}
                onClick={() => setTag(UNTAGGED_FILTER)}>
                No tags <span>{practices.filter(p => p.tags.length === 0).length}</span>
              </button>
            )}
          </div>

          {shownPractices.length === 0 ? (
            <p className={styles.formHint}>No practices carry that tag yet.</p>
          ) : shownPractices.map(p => (
            <div key={p.eventId} className={styles.reportRecap} data-none={p.recap ? undefined : 'none'}>
              <div className={styles.reportRecapHead}>
                <span className={styles.reportRecapDate}>
                  {formatInOrgZone(p.startsAt, { day: 'numeric', month: 'short' })}
                </span>
                <span className={styles.reportRecapTitle}>{p.name}</span>
                {/* F03 — the truth label, from the one shared table. */}
                <span className={styles.tagRead} data-truth={p.truth}>{PRACTICE_TRUTH_LABELS[p.truth].label}</span>
                {p.tags.map(t => <span key={t.id} className={styles.tagRead}>{t.name}</span>)}
                {/* ⚠ THE PRACTICE'S OWN PAGE (practices re-evaluation stage 6, R5, 2026-09-18).
                    This report is always the team's WORKING season, and a finished practice's own
                    page IS the record's face now — "How it went" first, the sheet read-only — so
                    this row opens it there, and a working-season practice has one face, not two.
                    The look-back reader (`history/development/practices/[eventId]`) is reached from
                    a finished season's shelf only; this list no longer sends anyone to it. The link
                    says what the page holds when a recap exists. */}
                {p.hasPlan && (
                  <Link href={`${base}/practice/${p.eventId}`}
                    className={styles.reportRecapLink}>
                    {p.recap ? 'Open plan and recap →' : 'Open the plan →'}
                  </Link>
                )}
              </div>
              {/* ⚠ Silence is STATED, never rendered blank: a practice with nothing written
                  must not read as a practice where nothing happened — and a plan alone does not
                  establish that it did (F03). An upcoming plan says ONE thing (G2 housekeeping) —
                  its truth label's own line would have said it a second time. */}
              <p>{p.recap ?? (p.truth === 'upcoming' ? 'The practice is still to come.' : 'A plan was saved. Nothing was written afterwards.')}</p>
              {PRACTICE_TRUTH_LABELS[p.truth].meta && (
                <p className={styles.devCardNote}>{PRACTICE_TRUTH_LABELS[p.truth].meta}</p>
              )}
            </div>
          ))}
          <p className={styles.formHint} style={{ marginTop: '0.9rem' }}>
            A topic appearing in a plan does not prove that a specific player worked on or achieved a goal.
          </p>
        </>
      )}
    </>
  );
}

// ── Team progress — counts of motion per METRIC, naming nobody (owner rulings T1–T8, 2026-09-16) ──
/**
 * One row per metric, active first and retired under the Metrics tab's own fold; the columns Players
 * with a result · Since their first result · Last recorded; the ROW is the door to Coverage on
 * that metric — the names behind the count, in roster order, and from there one child's chart. The
 * drill path only ever runs counts → names → one child. On the library's list recipe (the row is
 * the door, a bare chevron — register K-19: a row with ONE door does not name it), and on a phone one
 * card per metric two lines tall — the name, then the counts — on the shared `cardPhoneLine` pair:
 * Coverage's one-line card does not fit "4 of 12 · 2 lower · 1 higher · 15 Sept" beside a name.
 */
function TeamReport({ data, metrics, base, tag }: {
  data: ReportData; metrics: RepTeamMeasurableType[]; base: string; tag: string | null;
}) {
  const router = useRouter();
  const { rows, canWrite, team } = data;
  const total = rows.length;
  // The count line's numerator is the OVERVIEW's "players measured" rule — a result OR an observation — so the two
  // screens can never disagree by the one player whose only record is an observation (/review, 2026-09-16).
  const withAny = rows.filter(r => Object.keys(r.latest).length > 0 || Object.keys(r.latestObservation ?? {}).length > 0).length;
  const active = metrics.filter(t => t.isActive), retired = metrics.filter(t => !t.isActive);
  const dash = <Muted>{COVERAGE_DASH}</Muted>;
  /** "seconds · lower is the aim" · "mph · aim: 62–68 mph" · "km/h · record only" · "skill" — the Metrics tab's own words. */
  const subLine = (t: RepTeamMeasurableType) => t.kind === 'skill' ? 'skill' : [t.unit, aimSentence(t)].filter(Boolean).join(' · ');
  const coverageHref = (t: RepTeamMeasurableType) => insightsDevelopmentHref(base, { tag, report: 'coverage', metricId: t.id });

  const row = (t: RepTeamMeasurableType) => {
    const c = team[t.id];
    const players = c ? teamPlayersCell(c, total, t) : null;
    const change = c ? teamChangeSummary(c, t) : null;
    const href = coverageHref(t);
    const lastRecorded = c?.lastRecordedOn ? formatShortDate(c.lastRecordedOn) : null;
    // The phone's one line under the name: "4 of 12 · 2 lower · 1 higher · 15 Sept" — the same facts as the cells.
    const facts = [players, change, lastRecorded].filter(Boolean).join(' · ') || COVERAGE_DASH;
    return (
      <tr key={t.id} className={`${styles.tr} ${styles.rowTappable}${t.isActive ? '' : ` ${styles.devRetiredRow}`}`} onClick={() => router.push(href)}>
        {/* `libRowLead` — the library row's lead cell: on the phone card its stacked lines sit close, so the card is as tall as its words. */}
        <td className={`${styles.td} ${styles.cardStackCell} ${styles.libRowLead}`}>
          <Link href={href} className={`${styles.devCellLink} ${styles.libRowName}`} onClick={e => e.stopPropagation()}>{t.name}</Link>
          <span className={`${styles.listRowSub} ${styles.cardDesktopLine}`}>{subLine(t)}</span>
          <span className={`${styles.listRowSub} ${styles.cardPhoneLine}`}>{facts}</span>
        </td>
        <td data-label="Players with a result" className={`${styles.td} ${styles.cardDesktopCell} ${styles.libRowData}`}>
          {players ?? dash}{c && c.notAssessed > 0 && <span className={styles.devBoardMuted}> · {c.notAssessed} not assessed</span>}
        </td>
        <td data-label="Since their first result" className={`${styles.td} ${styles.cardDesktopCell} ${styles.libRowData}`}>
          {change ?? dash}
        </td>
        {/* A date in the body face, like every other list's (standard §3.4). */}
        <td data-label="Last recorded" className={`${styles.td} ${styles.tdDate} ${styles.cardDesktopCell}`}>
          {lastRecorded ?? dash}
        </td>
        <td className={`${styles.td} ${styles.cardActionCell} ${styles.cardActionCorner}`}>
          <span className={styles.listRowActions}>
            <Link href={href} className={`${styles.linkBtn} ${styles.listRowToggle}`} aria-label={`Open Coverage on ${t.name}`} onClick={e => e.stopPropagation()}>
              <ChevronRight size={16} className={styles.listRowChevron} aria-hidden />
            </Link>
          </span>
        </td>
      </tr>
    );
  };
  /* The library tabs' own frame (the list recipe); it adds the trailing "Open" heading for the chevron column.
     ⚠ NO sort affordance on any column, ever — library order is the only order. */
  const table = (list: RepTeamMeasurableType[], label: string) => (
    <LibraryTable label={label} head={<>
      <th className={styles.th}>Metric</th>
      <th className={styles.th}>Players with a result</th>
      {/* The cell carries its own denominator ("3 compared · …") — a separate "Two or more" column read as a bare number (owner, 2026-09-17). */}
      <th className={styles.th}>Since their first result</th>
      <th className={styles.th}>Last recorded</th>
    </>}>
      {list.map(row)}
    </LibraryTable>
  );

  return (
    <>
      {/* The count line first — the whole-roster denominator said once (Coverage's rule, G1). */}
      <p className={styles.devReportDenominator}>
        {teamCountLine(withAny, total)}
        <span className={styles.devReportOrderNote}> · {TEAM_COUNT_NOTE}</span>
      </p>
      {active.length === 0
        ? <p className={styles.detailPlaceholder}>No active metric to read yet.</p>
        : table(active, 'Team progress, active metrics')}
      {/* Retired metrics under the Metrics tab's own fold — a retired test's results are still a record. */}
      {retired.length > 0 && (
        <details style={{ marginTop: '0.8rem' }}>
          <summary className={`${styles.devCardNote} ${styles.devDisclosureSummary}`}>Retired ({retired.length})</summary>
          <div style={{ marginTop: '0.4rem' }}>{table(retired, 'Team progress, retired metrics')}</div>
        </details>
      )}
      {/* One legend, one disclaimer (G3's rule) — the sentence Player progress keeps, said once for the table. */}
      <p className={styles.formHint} style={{ marginTop: '0.5rem' }}>{teamLegend()}</p>
      <p className={styles.formHint} style={{ marginTop: '0.35rem' }}>A change in a test does not explain why it happened.</p>
      {canWrite && (
        <Link href={`${base}/development`} className={styles.insightsOpsLink}>
          Record in Skills &amp; Goals →
        </Link>
      )}
    </>
  );
}
