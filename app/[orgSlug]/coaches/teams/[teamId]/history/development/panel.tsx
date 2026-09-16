'use client';
import { use, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  insightsDevelopmentHref, parseInsightsDevelopmentAddress, playerDevelopmentHref,
  type InsightsDevelopmentAddress, type DevelopmentReport, type ProgressShow, type CompareWindow,
} from '@/lib/development-address';
import {
  REPORT_LABELS, COMPARE_LABELS, progressSeries, scopeLine, coverageCell, coverageDenominator, COVERAGE_DENOMINATOR_NOTE,
  showOptions, type ProgressSeries, type ProgressPoint, type ReportDefinition,
} from '@/lib/development-report';
import { goalTimeline } from '@/lib/development-goal-history';
import { playerTabHref } from '@/lib/coach-player-tabs';
import { headlineLabel } from '@/lib/measurable-series';
import DevelopmentProgressChart from '@/components/charts/DevelopmentProgressChart';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { Info, TrendingUp } from 'lucide-react';
import { formatShortDate, formatValue } from '@/lib/measurable-format';
import { playerName as rosterName } from '@/lib/coach-roster-name';
import { formatInOrgZone } from '@/lib/timezone';
import { UNTAGGED_FILTER, collectTags, filterTagged } from '@/lib/rep-drills';
import { PRACTICE_TRUTH_LABELS, type PracticeTruth } from '@/lib/practice-truth';
import type { SectionRead } from '@/lib/report-section-state';
import type {
  RepTeamMeasurableType, RepPlayerMeasurable, RepPlayerDevelopmentGoal, RepPlayerObservation, RepDevelopmentGoalReview,
} from '@/lib/types';
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
  /** metric id → the date of the latest session that marked this player not assessed on it. */
  notAssessedOn: Record<string, string>;
  lastRecordedOn: string | null;
  historyLinked: string | null;
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
  types: RepTeamMeasurableType[];
  rows: ReportRow[];
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
/** "60-yd sprint · test" · "Changeup speed · test with a range" · "Sets feet before throwing · skill". */
const metricOptionLabel = (t: RepTeamMeasurableType) =>
  `${t.name} · ${t.kind === 'skill' ? 'skill' : t.aim === 'range' ? 'test with a range' : 'test'}${t.isActive ? '' : ' (retired)'}`;

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
      // ?history=1 → the History-linked column. ?plans=1 → the three Phase 3 sections. Both are
      // opt-in because each costs a scan the board page and the hub tile don't render.
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/development/board?history=1&plans=1`,
      );
      const json = await res.json().catch(() => null);
      if (seq !== loadSeqRef.current) return;
      // No active program year is a legitimate state, not a retryable failure (board parity).
      if (res.status === 404) {
        setNoSeason(true);
        setData({
          showGoals: false, showMeasurables: false, types: [], rows: [],
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
  const anyData = rows.some(r => r.goals.length > 0 || Object.keys(r.latest).length > 0 || r.historyLinked)
    || practices.length > 0 || practiceTrouble;

  // The effective selections: what the address says, or the honest default — the first active
  // test, the first roster row, the headline, the season. Never an id the lists do not hold.
  const report: DevelopmentReport = address.report === 'practices' && !showPlans ? 'coverage' : address.report;
  const metric = metricOptions.find(t => t.id === address.metricId) ?? metricOptions.find(t => t.isActive && t.kind === 'test') ?? metricOptions[0] ?? null;
  const player = rows.find(r => r.playerId === address.playerId) ?? rows[0] ?? null;
  const show: ProgressShow = address.show ?? 'headline';
  const compare: CompareWindow = address.compare ?? 'season';
  /** Where a player link comes back to: this report, with every selection it holds. */
  const here = insightsDevelopmentHref(base, {
    tag: address.tag, report,
    playerId: report === 'progress' ? player?.playerId : null,
    metricId: report !== 'practices' ? metric?.id : null,
    show: report === 'progress' ? address.show : null,
    compare: report === 'progress' ? address.compare : null,
  });

  const reportChoices: DevelopmentReport[] = showPlans ? ['coverage', 'progress', 'practices'] : ['coverage', 'progress'];
  const showChoices = metric ? showOptions(metric) : [];

  return (
    /* ⚠ NO WRAPPER AND NO HEADER — this is a PANEL (reports portal P1, 2026-08-18). The hub owns
       `styles.page`, the <h1> and the help "?".

       ⚠ THE REPORT KEEPS THE WORD "DEVELOPMENT" AND THE NAV WORKBENCH DOES NOT: the sidebar item
       is now "Skills & Goals" (owner ruling 5, 2026-08-18). That collision — two doors both called
       Development, one a coverage report and one a workbench — is why this file's old title asked a
       question instead of naming itself. The tab can be called what it is now, and the cross-link
       under Coverage below names the other door so a coach who wants to ACT on what they read here
       knows exactly where to go. */
    <>
      {noSeason ? (
        <p className={styles.detailPlaceholder}>
          No active season for this team yet — the report fills in once a season is set up.
        </p>
      ) : !anyData ? (
        <p className={styles.detailPlaceholder}>
          Nothing to cover yet — run an evaluation session in Development, add a focus area from any
          player&apos;s profile, or write a plan for a practice.
        </p>
      ) : (
        <>
          {/* ── The Report selector (Phase 3): ONE labelled row of form controls, never tabs. On a
              phone the fields wrap as labelled full-width controls (plan §6). ── */}
          <div className={styles.devReportToolbar}>
            <label className={styles.field}>
              <span className={styles.label}>Report</span>
              <select className={`${styles.select} ${styles.devToolbarControl}`} value={report} onChange={e => setAddress({ report: e.target.value as DevelopmentReport })}>
                {reportChoices.map(id => <option key={id} value={id}>{REPORT_LABELS[id]}</option>)}
              </select>
            </label>
            {report === 'progress' && rows.length > 0 && (
              // Roster order, never ranked. Changing the player keeps the report, the metric and the window.
              <label className={styles.field}>
                <span className={styles.label}>Player</span>
                <select className={`${styles.select} ${styles.devToolbarControl}`} value={player?.playerId ?? ''} onChange={e => setAddress({ playerId: e.target.value })}>
                  {rows.map(r => <option key={r.playerId} value={r.playerId}>{r.number ? `#${r.number} ` : ''}{playerName(r)}</option>)}
                </select>
              </label>
            )}
            {report !== 'practices' && metricOptions.length > 0 && (
              <label className={styles.field}>
                <span className={styles.label}>Metric</span>
                <select className={`${styles.select} ${styles.devToolbarControl}`} value={metric?.id ?? ''} onChange={e => setAddress({ metricId: e.target.value })}>
                  {metricOptions.map(t => <option key={t.id} value={t.id}>{metricOptionLabel(t)}</option>)}
                </select>
              </label>
            )}
            {report === 'progress' && showChoices.length > 1 && (
              <label className={styles.field}>
                <span className={styles.label}>Show</span>
                <select className={`${styles.select} ${styles.devToolbarControl}`} value={show} onChange={e => setAddress({ show: e.target.value as ProgressShow })}>
                  {showChoices.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
            )}
            {report === 'progress' && metric?.kind === 'test' && (
              <label className={styles.field}>
                <span className={styles.label}>Compare</span>
                <select className={`${styles.select} ${styles.devToolbarControl}`} value={compare} onChange={e => setAddress({ compare: e.target.value as CompareWindow })}>
                  {(['season', 'last-two'] as const).map(id => <option key={id} value={id}>{COMPARE_LABELS[id]}</option>)}
                </select>
              </label>
            )}
          </div>

          {report === 'coverage' && (
            <CoverageReport data={data} metric={metric} base={base} here={here} tag={address.tag} />
          )}
          {report === 'progress' && (
            player && metric
              ? <ProgressReport key={player.playerId} orgSlug={orgSlug} teamId={teamId} base={base} player={player} metric={metric} show={show} compare={compare} here={here} />
              : <p className={styles.detailPlaceholder}>No active players or metrics to read yet.</p>
          )}
          {report === 'practices' && showPlans && (
            <PracticeReview data={data} base={base} tag={address.tag} setTag={tag => setAddress({ tag })} loading={loading} reload={load} />
          )}
        </>
      )}
    </>
  );
}

// ── Coverage (RESTYLED — screen 5): the selected metric, with ITS date, per player (F12) ──────────
function CoverageReport({ data, metric, base, here, tag }: {
  data: ReportData; metric: RepTeamMeasurableType | null; base: string; here: string; tag: string | null;
}) {
  const { showGoals, rows, showPlans, planFinding, uncoveredFocus, practiceRead, practiceCap, tagRead } = data;
  /**
   * The coverage column appears only when the question is ANSWERABLE — the API sends `inPlan: null`
   * on every row otherwise. Assigning players to blocks is optional: a coach whose practice is
   * "everyone rotates through four stations" names nobody, and flagging their entire roster would
   * be the product misreading its own data as a coaching failure.
   */
  const showCoverage = showPlans && rows.some(r => r.inPlan !== null);
  const cells = metric
    ? rows.map(r => coverageCell({
      latest: r.latest[metric.id] ?? null,
      latestObservation: r.latestObservation?.[metric.id] ?? null,
      notAssessedOn: r.notAssessedOn?.[metric.id] ?? null,
    }, metric))
    : null;
  const recorded = cells ? cells.filter(c => c.state === 'recorded').length : 0;

  return (
    <>
      {/* ── Section 1 · Coverage ── */}
      <p className={styles.reportSectionTitle}>Coverage</p>
      {/* The coverage framing is REQUIRED wording (binding coverage ruling) — it moved here
          from the retired subtitle so it sits with the roster order it frames. */}
      <p className={styles.reportSectionSub}>
        {showCoverage
          ? 'Who has been named in a practice plan, and where each player is up to.'
          : 'Where each player is up to.'}
        {' '}Roster order — a coverage checklist, not a ranking. The date belongs to the selected metric.
      </p>
      {/* The explicit denominator (plan §9): what this table describes, and what it does not. */}
      {metric && cells && (
        <p className={styles.devReportDenominator}>
          {coverageDenominator(recorded, rows.length, metric)}
          <br /><span className={styles.devReportAnswerSub}>{COVERAGE_DENOMINATOR_NOTE}</span>
        </p>
      )}
      {/* ⚠ THE CROSS-LINK IS IN THE APPROVED MOCKUP, and it is the answer to the one question
          this report cannot answer itself: it MEASURES coverage and offers no way to change it.
          Every act — setting a focus area, recording a measurable, running an evaluation
          session — happens on the workbench, which is called "Skills & Goals" from 2026-08-18.
          Naming the destination by its NEW name is the whole point: a coach who reads "no
          active focus" here and goes looking for "Development" in the sidebar will not find it. */}
      {/* ⚠ `.insightsOpsLink`, not a bare <a> in a <p>. The first build of this line was a
          15px-tall link inside a paragraph, caught by `check:layout` at 361px and 390px — which
          is the whole reason that sweep addresses each tab separately now. It shares a class
          with Playing Time's "Manage lineups →" because it is the same thing: the quiet "go do
          something about this" link at the foot of a report. The 44px tap floor went ON THAT
          CLASS rather than here, which fixed the older link's identical finding at the same
          time. */}
      <Link href={`${base}/development`} className={styles.insightsOpsLink}>
        Set goals and record in Skills &amp; Goals →
      </Link>

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

      {/* .tableAsCards reflows the table into stacked cards @640 (the Roster idiom). */}
      <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
        <table className={styles.devBoardTable}>
          <thead>
            <tr>
              {/* ⚠ NO sort affordance on any column, ever. Roster order is the only order. */}
              <th>Player</th>
              {showGoals && <th>Active focus</th>}
              {/* The selected metric, and ITS date — never one "last measurable" for everything (F12). */}
              {metric && <th>Selected metric</th>}
              {metric && <th>Recorded on</th>}
              {/* ⚠ "In a plan" — never "worked on", "covered" or "did". A recap existing in the
                  section below does not license this column to claim the plan happened. */}
              {showCoverage && <th>In a plan</th>}
              {/* Measures cross-season identity continuity, not attention — the old
                  "History linked" label undercut this report's own headline (WI-5). */}
              <th>Returning player</th>
              {metric && <th aria-label="Progress" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const name = playerName(r);
              const working = r.goals.filter(g => g.status === 'working').length;
              const cell = cells?.[i] ?? null;
              return (
                <tr key={r.playerId}>
                  <td>
                    {/* The record, opened on Development's Goals view, carrying the way back (F09). */}
                    <Link href={playerDevelopmentHref(base, r.playerId, { view: 'goals', returnTo: here })} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {r.number ? <span className={styles.devRowNum}>#{r.number} </span> : null}{name}
                    </Link>
                  </td>
                  {showGoals && (
                    <td data-label="Active focus" className={styles.devBoardVal}>
                      {working > 0 ? working : <span className={styles.devBoardMuted}>none yet</span>}
                    </td>
                  )}
                  {metric && cell && (
                    <td data-label="Selected metric" className={styles.devBoardVal} style={{ whiteSpace: 'normal' }}>
                      {cell.state === 'recorded' ? cell.text : <span className={styles.devBoardMuted}>{cell.text}</span>}
                    </td>
                  )}
                  {metric && cell && (
                    <td data-label="Recorded on" className={styles.devBoardVal}>
                      {cell.on ? formatShortDate(cell.on) : <span className={styles.devBoardMuted}>—</span>}
                    </td>
                  )}
                  {showCoverage && (
                    <td data-label="In a plan" className={styles.devBoardVal}>
                      {/* ⚠ A FLAG OR A QUIET TICK — never a number. There is no count of plans
                          here, no percentage, no streak, and no team average on the row,
                          because any of those could be read against another child's row. */}
                      {r.inPlan
                        ? <span className={styles.devBoardMuted} aria-label="In a plan">✓</span>
                        : <span className={styles.reportFlag}>— not in a plan yet</span>}
                    </td>
                  )}
                  <td data-label="Returning player" className={styles.devBoardVal}>
                    {r.historyLinked ? `${r.historyLinked} ✓` : <span className={styles.devBoardMuted}>—</span>}
                  </td>
                  {metric && (
                    <td data-label="Progress" className={styles.devBoardVal}>
                      {/* The same player in the progress report, the metric kept. */}
                      <Link href={insightsDevelopmentHref(base, { tag, report: 'progress', playerId: r.playerId, metricId: metric.id })}
                        className={styles.devReportRowLink} aria-label={`Open ${name}’s progress`}>
                        Progress →
                      </Link>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
            <p className={styles.reportSectionSub}>What the coach saw, in a stated setting — dated entries, newest first.</p>
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
            <p className={styles.formHint} style={{ marginTop: '0.6rem' }}>
              These observations describe what the coach saw in the setting they name. They do not establish game performance or an overall rating. Visible to coaches with Internal notes.
            </p>
            {/* A goal the observations are evidence for: its review history, the same events the profile shows. */}
            {goalsWithEvidence.map(g => {
              const events = goalTimeline(g, dev.reviews, dev.observations);
              return (
                <div key={g.id}>
                  <p className={styles.reportSectionTitle}>How the goal &ldquo;{g.focusArea}&rdquo; has developed</p>
                  <ol className={styles.devReportTimeline}>
                    {events.map((ev, i) => (
                      <li key={`${ev.kind}-${ev.reviewId ?? ev.observationId ?? i}`}>
                        <time dateTime={ev.on}>{formatShortDate(ev.on)}{ev.by && author(ev.by) ? ` · ${author(ev.by)}` : ''}</time>
                        <p><strong>{ev.title}</strong></p>
                        {ev.text && <p>{ev.text}</p>}
                        {ev.nextReviewOn && <p className={styles.devCardNote}>Next review: {formatShortDate(ev.nextReviewOn)}</p>}
                        {/* Opens the record on this goal — and, for an observation, its sheet (E2). */}
                        {(ev.reviewId || ev.observationId) && (
                          <Link href={playerDevelopmentHref(base, player.playerId, { view: 'goals', goalId: g.id, observationId: ev.observationId ?? null, returnTo: here })} className={styles.devReportRowLink}>
                            Open →
                          </Link>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
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
  const newestFirst = [...series.points].reverse();
  /** One row of "Records behind the chart". */
  const recordRow = (row: ProgressPoint<RepPlayerMeasurable>['row']) => {
    const corrected = row.attempts.filter(a => a.correctedFrom != null);
    const by = author(row.attempts[0]?.createdBy ?? null);
    return (
      <tr key={row.key}>
        <td data-label="Date" className={styles.devBoardVal}>{formatShortDate(row.recordedOn)}</td>
        <td data-label={unitHead} className={styles.devBoardVal} style={{ whiteSpace: 'normal' }}>
          {/* Every attempt the row holds — the plan it was run against is the session's own fact
              (re-evaluation stage 2, C1) and is reported there ("fewer than planned"), not here. */}
          {row.values.map(formatValue).join(' · ')}
          {corrected.length > 0 && (
            <span className={styles.devCardNote}>corrected — was {corrected.map(a => formatValue(a.correctedFrom!)).join(' · ')}</span>
          )}
        </td>
        <td data-label={isRange ? 'In range' : 'Headline'} className={styles.devBoardVal}>
          {isRange ? `${row.headline ?? 0} of ${row.values.length}` : headlineLabel(row, def)}
        </td>
        <td data-label="Average" className={styles.devBoardVal}>
          {row.average != null && row.values.length > 1 ? formatValue(row.average) : <span className={styles.devBoardMuted}>—</span>}
        </td>
        <td data-label="Source" className={styles.devBoardVal}>
          {row.sessionId
            ? (dev.canWrite ? <Link href={`${base}/development/sessions/${row.sessionId}`} className={styles.devReportRowLink}>Session →</Link> : 'In a session')
            : 'Outside a session'}
          {by ? <span className={styles.devCardNote}>entered by {by}</span> : null}
        </td>
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
      <p className={styles.reportSectionSub}>Current season only · every attempt, exactly as recorded · newest first</p>
      <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
        <table className={styles.devBoardTable}>
          <thead>
            <tr>
              <th>Date</th>
              <th>{unitHead}</th>
              <th>{isRange ? 'In range' : series.lineWord === 'average of attempts' ? 'Headline' : series.lineWord === 'last attempt' ? 'Last' : 'Best'}</th>
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
  // array and a `name`, which a practice row already has.
  const shownPractices = filterTagged(practices, '', tag);
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
                {/* ⚠ THE ARCHIVE DOOR, and the only route to it. A past plan is readable
                    read-only in any season, reached only from this list — the schedule's
                    practice section stays hidden in a finished season, as 1b ruled. The page it
                    opens shows the plan AND "How it went", so the link says so when a recap exists. */}
                {p.hasPlan && (
                  <Link href={`${base}/history/development/practices/${p.eventId}`}
                    className={styles.reportRecapLink}>
                    {p.recap ? 'Open plan and recap →' : 'Open the plan →'}
                  </Link>
                )}
              </div>
              {/* ⚠ Silence is STATED, never rendered blank: a practice with nothing written
                  must not read as a practice where nothing happened — and a plan alone does not
                  establish that it did (F03). */}
              <p>{p.recap ?? (p.truth === 'upcoming' ? 'Nothing written yet — the practice is still to come.' : 'A plan was saved. Nothing was written afterwards.')}</p>
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
