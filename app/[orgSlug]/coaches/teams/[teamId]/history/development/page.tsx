'use client';
import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Info, TrendingUp } from 'lucide-react';
import { useCoachSeasonPage } from '@/lib/coaches-context';
import CoachSeasonChip from '@/components/coaches/CoachSeasonChip';
import { formatShortDate } from '@/lib/measurable-format';
import { formatInOrgZone } from '@/lib/timezone';
import { UNTAGGED_FILTER, collectTags, filterTagged } from '@/lib/rep-drills';
import styles from '../../../../coaches.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Development report (Player Development 3D — D4 Option B, owner 2026-07-17).
// The page behind the Insights hub's sixth doorway tile: one row per active
// player, ROSTER ORDER ONLY — a coverage checklist, never a leaderboard.
//
// Practice Plans Phase 3 adds three sections (frames 08–09), and this is the
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
// "Recorded here" precedent). Coverage says PLANNED. "Practices you've run" is
// the one section allowed to describe reality, and it earns that because a coach
// sat down afterwards and wrote it — a recap existing there does NOT license the
// coverage table to claim the plan happened.
// ─────────────────────────────────────────────────────────────────────────────

interface ReportRow {
  playerId: string;
  firstName: string;
  lastName: string | null;
  number: string | null;
  goals: { focusArea: string; status: string }[];
  latest: Record<string, { value: number; unit: string; recordedOn: string }>;
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
  planSummary: string | null;
}

interface ReportData {
  showGoals: boolean;
  showMeasurables: boolean;
  rows: ReportRow[];
  showPlans: boolean;
  planFinding: string | null;
  uncoveredFocus: { id: string; name: string }[];
  practices: PracticeRow[];
}

export default function DevelopmentReportPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  // Fresh instance per team — no cross-team fetch races (3A key= pattern).
  return <ReportView key={teamId} orgSlug={orgSlug} teamId={teamId} />;
}

function ReportView({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  // Chunk F — which SEASON is on screen. The board route this page reads has been on the
  // season-read rail since Chunk F; the page simply never passed the parameter, so a coach opening
  // the report from an archived season silently got the live one.
  const seasonSearchParams = useSearchParams();
  const page = useCoachSeasonPage(orgSlug, teamId, seasonSearchParams.get('year'));
  const seasonQuery = page.query;

  const [data, setData] = useState<ReportData | null>(null);
  const [noSeason, setNoSeason] = useState(false);
  const [error, setError] = useState('');
  /** null = every practice. A tag id, or the "no tags" sentinel. */
  const [practiceTag, setPracticeTag] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // ?history=1 → the History-linked column. ?plans=1 → the three Phase 3 sections. Both are
      // opt-in because each costs a scan the board page and the hub tile don't render.
      const sep = seasonQuery ? '&' : '?';
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/development/board${seasonQuery}${sep}history=1&plans=1`,
      );
      const json = await res.json().catch(() => null);
      // No active program year is a legitimate state, not a retryable failure (board parity).
      if (res.status === 404) {
        setNoSeason(true);
        setData({
          showGoals: false, showMeasurables: false, rows: [],
          showPlans: false, planFinding: null, uncoveredFocus: [], practices: [],
        });
        setError('');
        return;
      }
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not load the report — try again.');
      setData(json);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the report — try again.');
    }
  }, [orgSlug, teamId, seasonQuery]);

  useEffect(() => { load(); }, [load]);

  if (!data && !error) {
    return <div className={styles.page}><div className={styles.loadingState}>Loading the report…</div></div>;
  }
  if (!data) {
    return (
      <div className={styles.page}>
        <Link href={`${base}/history${seasonQuery}`} className={styles.lineupBackLink}>← Insights</Link>
        <p className={styles.detailPlaceholder}>
          {error}{' '}
          <button type="button" className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '0.15rem 0.5rem' }}
            onClick={() => { setError(''); load(); }}>
            Try again
          </button>
        </p>
      </div>
    );
  }

  const { showGoals, rows, showPlans, planFinding, uncoveredFocus, practices } = data;
  const anyData = rows.some(r => r.goals.length > 0 || Object.keys(r.latest).length > 0 || r.historyLinked)
    || practices.length > 0;

  /**
   * The coverage column appears only when the question is ANSWERABLE — the API sends `inPlan: null`
   * on every row otherwise. Assigning players to blocks is optional: a coach whose practice is
   * "everyone rotates through four stations" names nobody, and flagging their entire roster would
   * be the product misreading its own data as a coaching failure.
   */
  const showCoverage = showPlans && rows.some(r => r.inPlan !== null);

  // The SAME predicate the drill library and the template room use. `filterTagged` needs a `tags`
  // array and a `name`, which a practice row already has.
  const shownPractices = filterTagged(practices, '', practiceTag);
  // ⚠ `collectTags`, not a hand-rolled dedup. Its own doc names this list as one of its three
  // callers, and a second copy of "unique tags in first-seen order" is exactly how two surfaces
  // start quietly disagreeing — which is what the shared module exists to prevent.
  const practiceTagChips = collectTags(practices);

  return (
    <div className={styles.page}>
      <Link href={`${base}/history${seasonQuery}`} className={styles.lineupBackLink}>← Insights</Link>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><TrendingUp size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>
              Development<CoachSeasonChip season={page.season} teamBase={page.teamBase} />
            </h1>
            <p className={styles.pageSub}>Is everyone getting attention? — roster order, a coverage checklist, not a ranking</p>
          </div>
        </div>
      </div>

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
          {/* ── Section 1 · Coverage ── */}
          <p className={styles.reportSectionTitle}>Coverage</p>
          <p className={styles.reportSectionSub}>
            {showCoverage
              ? 'Who has been named in a practice plan, and where each player is up to.'
              : 'Where each player is up to.'}
          </p>

          {/* ⚠ COUNT-ONLY AND NAMELESS, and silent until there is real usage. This is the findings
              rule applied in place — there is deliberately no seventh Insights tile. */}
          {planFinding && (
            <p className={styles.reportFinding}>
              <Info size={15} aria-hidden />
              <span>{planFinding}</span>
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
                  {/* ⚠ "In a plan" — never "worked on", "covered" or "did". A recap existing in the
                      section below does not license this column to claim the plan happened. */}
                  {showCoverage && <th>In a plan</th>}
                  <th>Last measurable</th>
                  {/* Measures cross-season identity continuity, not attention — the old
                      "History linked" label undercut this report's own headline (WI-5). */}
                  <th>Returning player</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const name = [r.firstName, r.lastName].filter(Boolean).join(' ');
                  const working = r.goals.filter(g => g.status === 'working').length;
                  return (
                    <tr key={r.playerId}>
                      <td>
                        <Link href={`${base}/roster/${r.playerId}${seasonQuery}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {r.number ? <span className={styles.devRowNum}>#{r.number} </span> : null}{name}
                        </Link>
                      </td>
                      {showGoals && (
                        <td data-label="Active focus" className={styles.devBoardVal}>
                          {working > 0 ? working : <span className={styles.devBoardMuted}>none yet</span>}
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
                      <td data-label="Last measurable" className={styles.devBoardVal}>
                        {r.lastRecordedOn ? formatShortDate(r.lastRecordedOn) : <span className={styles.devBoardMuted}>—</span>}
                      </td>
                      <td data-label="Returning player" className={styles.devBoardVal}>
                        {r.historyLinked ? `${r.historyLinked} ✓` : <span className={styles.devBoardMuted}>—</span>}
                      </td>
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

          {/* ── Section 3 · Practices you've run ──
              ⚠ The one section allowed to describe what actually HAPPENED, and it earns that
              because a coach sat down afterwards and wrote it. Kept apart from coverage above on
              purpose (the §10.2 "Recorded here" precedent).

              This is also the payoff for writing a recap at all: a coach about to plan a hitting
              practice filters to Hitting and gets every hitting practice they have run, what was
              in it, and what they said about it. */}
          {showPlans && practices.length > 0 && (
            <>
              <p className={styles.reportSectionTitle}>Practices you&apos;ve run</p>
              <p className={styles.reportSectionSub}>Filter by tag to see what you did last time — and how it went.</p>

              <div className={styles.ppSuggestWrap}>
                <button type="button" className={styles.ppSuggestChip} data-on={practiceTag == null ? 'on' : undefined}
                  onClick={() => setPracticeTag(null)}>All <span>{practices.length}</span></button>
                {practiceTagChips.map(t => (
                  <button key={t.id} type="button" className={styles.ppSuggestChip}
                    data-on={practiceTag === t.id ? 'on' : undefined} onClick={() => setPracticeTag(t.id)}>
                    {t.name} <span>{practices.filter(p => p.tags.some(x => x.id === t.id)).length}</span>
                  </button>
                ))}
                {/* Always offered when it applies — an untagged practice must never become
                    unreachable simply by carrying no tags. */}
                {practices.some(p => p.tags.length === 0) && (
                  <button type="button" className={styles.ppSuggestChip}
                    data-on={practiceTag === UNTAGGED_FILTER ? 'on' : undefined}
                    onClick={() => setPracticeTag(UNTAGGED_FILTER)}>
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
                    {p.tags.map(t => <span key={t.id} className={styles.tagRead}>{t.name}</span>)}
                    {/* ⚠ THE NEW ARCHIVE DOOR, and the only route to it. A past plan is readable
                        read-only in any season, reached only from this list — the schedule's
                        practice section stays hidden in a finished season, as 1b ruled. The link
                        carries the viewed season so the page it opens resolves the same one. */}
                    {p.hasPlan && (
                      <Link href={`${base}/history/development/practices/${p.eventId}${seasonQuery}`}
                        className={styles.reportRecapLink}>
                        Open the plan →
                      </Link>
                    )}
                  </div>
                  {/* ⚠ Silence is STATED, never rendered blank: a practice with nothing written
                      must not read as a practice where nothing happened. */}
                  <p>{p.recap ?? 'Nothing written down for this one.'}</p>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
