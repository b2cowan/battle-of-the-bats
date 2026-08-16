'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Trophy, Archive, ChevronDown, Check } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import styles from '../../../../coaches.module.css';
import type { RepTeamEvent, RepTeamHistoryYear, RepTeamTag } from '@/lib/types';

const GAME_EVENT_TYPES = ['league_game', 'tournament_game', 'scrimmage'];
const TYPE_LABEL: Record<string, string> = { league_game: 'League', tournament_game: 'Tournament', scrimmage: 'Scrimmage' };

interface SeasonAccounting { duesCollected: number; duesOutstanding: number; totalExpenses: number }
interface HistoryYear extends RepTeamHistoryYear { accounting: SeasonAccounting | null }

function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function acceptanceRate(total: number, accepted: number): string {
  return total ? `${Math.round((accepted / total) * 100)}%` : '—';
}
function recordText(r: { wins: number; losses: number; ties: number }): string | null {
  return r.wins || r.losses || r.ties ? `${r.wins}W – ${r.losses}L – ${r.ties}T` : null;
}
function gameTitle(e: RepTeamEvent) {
  if (e.opponent) return `${e.homeAway === 'away' ? '@' : 'vs'} ${e.opponent}`;
  return e.name || 'Game';
}
function tally(list: RepTeamEvent[]) {
  return {
    w: list.filter(e => e.result === 'win').length,
    l: list.filter(e => e.result === 'loss').length,
    t: list.filter(e => e.result === 'tie').length,
  };
}
function recStr(r: { w: number; l: number; t: number }) {
  return `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}`;
}

// "How are we doing?" — the season's game log + past seasons as a plain ARCHIVE.
// Deliberately NO season-over-season deltas (owner 2026-07-09: youth seasons
// aren't comparable across years — past seasons are a scrapbook, not a scoreboard).
export default function CoachesResultsReportPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(paramsPromise);
  const { loading: ctxLoading } = useCoaches();
  /**
   * ⚠⚠ WHICH SEASON — the whole point of this page's 2026-08-16 rework (archive rail Phase 1).
   *
   * This page used to decide what to show from `!assignment && !!closedAssignment` — "does this
   * coach still hold a LIVE assignment?" — which is a different question from the one the coach
   * asked. One missing question produced TWO wrong answers: a coach who still ran the team opened
   * a past season and got THIS season's record and game log with no chip to say so, while a coach
   * with no live assignment had the game log suppressed outright, so the archive's own results
   * door showed no results.
   *
   * The season now decides, and WHO is reading decides nothing. `page.capabilities` are that
   * season's (governing rule 1) and `page.isReadOnly` is derived from the SEASON, never from the
   * team — a rolled-forward team is not itself closed.
   */
  const page = useCoachSeasonPage(orgSlug, teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const sportPack = getSportPack(page.teamSport ?? DEFAULT_SPORT);
  const scoreUnit = sportPack.score.unit.toLowerCase();

  const [events, setEvents] = useState<RepTeamEvent[]>([]);
  const [history, setHistory] = useState<HistoryYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /**
   * Guards the stale flash on client-side switches — the page doesn't remount for either.
   * ⚠ The key was `${teamId}|${seasonQuery}` while a season switcher could rewrite this page's
   * own URL without remounting it. That trigger is deleted (P2, 2026-08-16) and the composite key
   * went with it — the TEAM half is still real, because this component survives a team switch.
   */
  const loadKey = teamId;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  // Coach Tags: the team's game-tag library + which tags each event carries (both already
  // returned by the events GET — this report is the first consumer of them).
  const [teamTags, setTeamTags] = useState<RepTeamTag[]>([]);
  const [tagsByEventId, setTagsByEventId] = useState<Record<string, string[]>>({});
  const [activeTagId, setActiveTagId] = useState<string | null>(null);

  /**
   * ⚠⚠ EVERY WRITE IS GUARDED, not just the render (added by `/review` 2026-08-16).
   *
   * The `loadedFor`/`loadKey` pair guards what is PAINTED. It does not guard what is WRITTEN — and
   * once the season became a re-fire trigger, that gap became reachable in a routine flow: switch
   * to a slow season, switch again to a fast one, and the slow response lands last. Its `finally`
   * then stamps `loadedFor` with ITS season, which no longer matches the season on screen, so the
   * correct table the coach was already reading flips back to "Loading report…" — and stays there,
   * because nothing in `load`'s deps has changed, so the effect never re-fires. A page that paints
   * the right answer and then takes it away for good.
   *
   * Same `isStale()` shape the Lineups and Practice hubs adopted a day earlier for the same class
   * of bug. This page had only the render half of it.
   */
  const load = useCallback(async (isStale: () => boolean = () => false) => {
    setLoading(true);
    setError('');
    try {
      const [evRes, hiRes] = await Promise.all([
        // ⚠ The season goes to the API too, not just onto the header. `events` has been on the
        // season-read rail since Chunk F — it could always serve a past season; this page simply
        // never asked. `history` is deliberately year-less: it IS the cross-season summary.
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/history`),
      ]);
      // A team with NO season resolvable at all — not even a finished one — 403/404s on /events.
      // That is a legitimate state, not a failure: the Past seasons list below is the whole point
      // of this page then. ⚠ It is RARE now, because the route falls back to the newest finished
      // season, which is what gives a coach between seasons a game log at all. Any OTHER events
      // failure (a 500) is still a real error — swallowing it would render a misleading
      // "No results yet" over a team that has played games (adversarial review).
      const eventsClosedOut = !evRes.ok && (evRes.status === 403 || evRes.status === 404);
      if (!evRes.ok && !eventsClosedOut) throw new Error();
      if (!hiRes.ok && !evRes.ok) throw new Error();
      const ev = evRes.ok ? await evRes.json() : null;
      const hi = hiRes.ok ? await hiRes.json() : null;
      if (isStale()) return;
      // ⚠ CLEARED, not left alone, when the events read is refused. `eventsClosedOut` is a
      // legitimate state rather than an error, but skipping the writes entirely left the PREVIOUS
      // season's games in state while `loadedFor` said the new one had landed — which is the wrong
      // season's game log under the right season's chip, silently. Absent data reads as absent.
      setEvents(ev?.events ?? []);
      setTeamTags(ev?.tags ?? []);
      setTagsByEventId(ev?.tagsByEventId ?? {});
      if (hi) setHistory(hi.history ?? []);
    } catch {
      if (!isStale()) setError('This report couldn’t be loaded — refresh to try again.');
    } finally {
      // ⚠ A stale run must not stamp its own season here — that is the whole defect.
      if (!isStale()) {
        setLoadedFor(loadKey);
        setLoading(false);
      }
    }
  }, [orgSlug, teamId, loadKey]);

  useEffect(() => {
    if (ctxLoading) return;
    let cancelled = false;
    const isStale = () => cancelled;
    void Promise.resolve().then(() => load(isStale));
    return () => { cancelled = true; };
  }, [ctxLoading, load]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  // ⚠ `hasAccess` covers live AND archived assignments. The old test here was the live one only,
  // which is how the hub next door still tells a coach their own finished season's team "not found".
  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  // Finalized = a result exists (unscored games never count — a null result is not a loss).
  const finalized = events
    .filter(e => GAME_EVENT_TYPES.includes(e.eventType) && e.status !== 'cancelled' && e.result)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  const byType = GAME_EVENT_TYPES
    .map(t => ({ type: t, ...tally(finalized.filter(e => e.eventType === t)) }))
    .filter(r => r.w + r.l + r.t > 0);
  const scored = finalized.filter(e => e.teamScore != null && e.opponentScore != null);
  const close = tally(scored.filter(e => Math.abs((e.teamScore ?? 0) - (e.opponentScore ?? 0)) === 1));
  const closeGames = close.w + close.l + close.t;

  // Coach Tags — "vs tag" filter. Chips are built from finalized games only (this report's own
  // scope), so a chip's count always matches how many rows selecting it will show; a tag with zero
  // finalized games simply never gets a chip (self-hides per the plan). Derived every render
  // (not synced via an effect) so a tag deleted/merged elsewhere just quietly stops matching.
  //
  // ⚠ HIDDEN IN A RECORD (2026-08-16). Game tags are a LIVE vocabulary the coach edits today —
  // renaming, merging and deleting them as the season goes. Offering 2024's games filtered by a
  // tag invented last week is governing rule 3 broken ("what the coach could see AT THE TIME"),
  // and it fails silently: every row renders, the counts add up, and the page is quietly
  // answering a question nobody could have asked that year.
  const tagChips = page.isReadOnly ? [] : teamTags
    .map(tag => ({ tag, count: finalized.filter(e => (tagsByEventId[e.id] ?? []).includes(tag.id)).length }))
    .filter(c => c.count > 0)
    .sort((a, b) => a.tag.name.localeCompare(b.tag.name));
  const activeTag = tagChips.find(c => c.tag.id === activeTagId)?.tag ?? null;
  const visibleGames = activeTag
    ? finalized.filter(e => (tagsByEventId[e.id] ?? []).includes(activeTag.id))
    : finalized;
  const tagRecord = activeTag ? tally(visibleGames) : null;
  // Result and score are independent nullable fields (a coach can log a W/L/T with no score
  // entered) — sum only games that actually HAVE both numbers, same guard as `scored` above,
  // so an unscored result can't silently fold into the total as a phantom 0–0.
  const tagRuns = activeTag
    ? visibleGames
        .filter(e => e.teamScore != null && e.opponentScore != null)
        .reduce((acc, e) => ({
          rf: acc.rf + (e.teamScore ?? 0),
          ra: acc.ra + (e.opponentScore ?? 0),
        }), { rf: 0, ra: 0 })
    : null;

  return (
    <div className={styles.page}>
      {/* The hub is this page's parent in every season state — there is no longer a nav shape in
          which Insights points here directly, so the back link is never claiming a parent it does
          not have (the double-parent defect this once had). */}
      <CoachBackLink href={`${base}/history`}>Insights</CoachBackLink>
      {/* Page-header ruling 2026-08-11: the conditional line is deleted — the question in the h1
          already says what the page answers, and the results list below shows its own scope. It
          is a drill-in from the hub and inherits the hub's guide. */}
      <CoachPageHeader
        icon={Trophy}
        title="How are we doing?"
        helpLabel="Insights"
        help={{ module: 'coaches', sectionIds: ['premium-insights'], fullGuideHref: `/${orgSlug}/coaches/help#premium-insights` }}
      />

      {loading || loadedFor !== loadKey ? (
        <div className={styles.loadingState}>Loading report…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : (
        <>
          {finalized.length === 0 ? (
            <div className={styles.emptyState}>
              <Trophy size={26} style={{ opacity: 0.3, margin: '0 auto 0.6rem', display: 'block' }} />
              {/* ⚠ Past tense in a record, and no promise of anything arriving — nothing will.
                  Same rule the attendance report took on the same day. */}
              <p className={styles.emptyStateTitle}>{page.isReadOnly ? 'No results were recorded' : 'No results yet'}</p>
              <p className={styles.emptyStateSub}>
                {page.isReadOnly
                  ? 'No game in this season was finalized with a score.'
                  : 'Once a game gets a score, it shows up here.'}
              </p>
            </div>
          ) : (
            <>
              {activeTag ? (
                <div className={styles.insightsTagSummary}>
                  <span className={styles.insightsTagSummaryLbl}>vs {activeTag.name}:</span>
                  <span className={styles.insightsTagSummaryRec}>{recStr(tagRecord!)}</span>
                  <span className={styles.insightsTagSummaryRuns}>{tagRuns!.rf} {scoreUnit} for, {tagRuns!.ra} against</span>
                </div>
              ) : (
                <p className={styles.insightsBasis}>
                  {byType.map((r, i) => `${i > 0 ? ' · ' : ''}${TYPE_LABEL[r.type]} ${recStr(r)}`).join('')}
                  {closeGames > 0 && <> · {recStr(close)} in one-{scoreUnit} games</>}
                </p>
              )}

              {tagChips.length > 0 && (
                <div className={styles.lineupFilterBar} role="group" aria-label="Filter by tag">
                  <button
                    type="button"
                    aria-pressed={!activeTag}
                    className={`${styles.lineupFilterChip} ${!activeTag ? styles.lineupFilterChipActive : ''}`}
                    onClick={() => setActiveTagId(null)}
                  >
                    {!activeTag && <Check size={12} aria-hidden />} All
                  </button>
                  {tagChips.map(c => (
                    <button
                      key={c.tag.id}
                      type="button"
                      aria-pressed={activeTag?.id === c.tag.id}
                      className={`${styles.lineupFilterChip} ${activeTag?.id === c.tag.id ? styles.lineupFilterChipActive : ''}`}
                      onClick={() => setActiveTagId(c.tag.id)}
                    >
                      {activeTag?.id === c.tag.id && <Check size={12} aria-hidden />} {c.tag.name} <b className={styles.lineupFilterCount}>{c.count}</b>
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.insightsTableWrap}>
                <table className={styles.insightsTable}>
                  <thead><tr><th>Date</th><th>Game</th><th>Type</th><th>Result</th><th>Score</th>{tagChips.length > 0 && <th>Tags</th>}</tr></thead>
                  <tbody>
                    {visibleGames.map(e => (
                      <tr key={e.id}>
                        <td className={styles.insightsNum}>{new Date(e.startsAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</td>
                        <td>{gameTitle(e)}</td>
                        <td className={styles.mutedInline}>{TYPE_LABEL[e.eventType]}</td>
                        <td><span className={styles.wltPip} data-r={e.result ?? undefined}>{e.result === 'win' ? 'W' : e.result === 'loss' ? 'L' : 'T'}</span></td>
                        <td className={styles.insightsNum}>
                          {e.teamScore != null && e.opponentScore != null ? `${e.teamScore}–${e.opponentScore}` : '—'}
                        </td>
                        {tagChips.length > 0 && (
                          <td>
                            {(tagsByEventId[e.id] ?? []).length > 0 ? (
                              <div className={styles.lineupChips}>
                                {(tagsByEventId[e.id] ?? []).map(tagId => {
                                  const tag = teamTags.find(t => t.id === tagId);
                                  return tag ? <span key={tagId} className={styles.lineupChip}>{tag.name}</span> : null;
                                })}
                              </div>
                            ) : (
                              <span className={styles.mutedInline}>—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/**
            * ⚠⚠ **THE COMPARE LIST — this is the look-back layer now** (P2, 2026-08-16, Design A).
            *
            * With the archive deleted as a place, this section stopped being a nice extra at the
            * bottom of a report and became one of the three ways a coach reaches a finished season
            * at all (the others being Season's End and Season Wrapped, both of which it links to).
            * It is the team's SCRAPBOOK — per-season record, roster size, tryout acceptance, money
            * summaries — and it belongs to the TEAM, not to the season on screen, which is why it
            * renders whatever state that season is in.
            *
            * ⚠⚠ **EVERY CURRENT MEMBER SEES IT.** The head-coach-only restriction shipped hours
            * earlier on 2026-08-16 as a floor, while access was still per-season and an ex-coach
            * could still read the whole book. M1 removed that premise — only current staff hold a
            * membership at all — so the owner reverted it with Design A: an assistant on the team
            * today sees the seasons the team has played. Money figures inside stay money-gated
            * server-side, which is the grant that governs the sensitive half.
            */}
          <section style={{ marginTop: '1.75rem' }}>
            <p className={styles.sectionKicker}>Past seasons</p>
            {history.length === 0 ? (
              <p className={styles.insightsQuietText}>
                <Archive size={14} style={{ verticalAlign: '-2px', marginRight: '0.35rem', opacity: 0.5 }} aria-hidden />
                None yet — completed and archived seasons will appear here.
              </p>
            ) : (
              history.map(y => {
                const record = recordText(y);
                const acct = y.accounting;
                return (
                  <details key={y.id} className={styles.insightsSeasonRow}>
                    <summary>
                      <span className={styles.insightsSeasonName}>{y.name}</span>
                      <span className={styles.insightsSeasonMeta}>{record ?? '—'}</span>
                      <span
                        className={styles.insightsSeasonChip}
                        style={{
                          background: y.status === 'archived' ? 'var(--home-line, rgba(255,255,255,0.06))' : 'color-mix(in srgb, var(--success-light) 10%, transparent)',
                          color: y.status === 'archived' ? 'var(--home-dim, rgba(255,255,255,0.35))' : 'var(--success-light)',
                        }}
                      >
                        {y.status === 'archived' ? 'Archived' : 'Completed'}
                      </span>
                      <ChevronDown size={14} className={styles.insightsSeasonCaret} aria-hidden />
                    </summary>
                    <div className={styles.insightsSeasonBody}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{y.rosterCount}</div>
                        <div className={styles.insightsSeasonStatLbl}>Players</div>
                      </div>
                      {y.tryoutTotal > 0 && (
                        <div>
                          <div style={{ fontWeight: 600 }}>{acceptanceRate(y.tryoutTotal, y.tryoutAccepted)}</div>
                          <div className={styles.insightsSeasonStatLbl}>Tryout acceptance</div>
                        </div>
                      )}
                      {acct && (
                        <>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--success-light)' }}>{fmt(acct.duesCollected)}</div>
                            <div className={styles.insightsSeasonStatLbl}>Dues collected</div>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: acct.duesOutstanding > 0 ? 'var(--danger-light)' : 'var(--home-dim, rgba(255,255,255,0.5))' }}>{fmt(acct.duesOutstanding)}</div>
                            <div className={styles.insightsSeasonStatLbl}>Outstanding</div>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{fmt(acct.totalExpenses)}</div>
                            <div className={styles.insightsSeasonStatLbl}>Expenses</div>
                          </div>
                        </>
                      )}
                      {/* D4: every closed season's ceremony stays reachable, not just the newest. */}
                      <div style={{ flexBasis: '100%' }}>
                        <Link href={`${base}/season-end?year=${y.id}`} style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                          Season Wrapped →
                        </Link>
                      </div>
                    </div>
                  </details>
                );
              })
            )}
          </section>
        </>
      )}
    </div>
  );
}
