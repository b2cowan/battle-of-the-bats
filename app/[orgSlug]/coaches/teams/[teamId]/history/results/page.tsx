'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Trophy, Archive, ChevronDown, Check } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
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
  const { assignments, loading: ctxLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const sportPack = getSportPack(assignment?.teamSport ?? DEFAULT_SPORT);
  const scoreUnit = sportPack.score.unit.toLowerCase();

  const [events, setEvents] = useState<RepTeamEvent[]>([]);
  const [history, setHistory] = useState<HistoryYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Guards the stale-team flash on client-side team switches (page doesn't remount).
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  // Coach Tags: the team's game-tag library + which tags each event carries (both already
  // returned by the events GET — this report is the first consumer of them).
  const [teamTags, setTeamTags] = useState<RepTeamTag[]>([]);
  const [tagsByEventId, setTagsByEventId] = useState<Record<string, string[]>>({});
  const [activeTagId, setActiveTagId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [evRes, hiRes] = await Promise.all([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/history`),
      ]);
      if (!evRes.ok) throw new Error();
      const ev = await evRes.json();
      setEvents(ev.events ?? []);
      setTeamTags(ev.tags ?? []);
      setTagsByEventId(ev.tagsByEventId ?? {});
      if (hiRes.ok) {
        const hi = await hiRes.json();
        setHistory(hi.history ?? []);
      }
    } catch {
      setError('This report couldn’t be loaded — refresh to try again.');
    } finally {
      setLoadedFor(teamId);
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => {
    if (ctxLoading) return;
    void Promise.resolve().then(load);
  }, [ctxLoading, load]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) {
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
  const tagChips = teamTags
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
      <Link href={`${base}/history`} className={styles.lineupBackLink}>← Insights</Link>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Trophy size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>How are we doing?</h1>
            <p className={styles.pageSub}>Every result this season, plus your past seasons</p>
          </div>
        </div>
      </div>

      {loading || loadedFor !== teamId ? (
        <div className={styles.loadingState}>Loading report…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : (
        <>
          {finalized.length === 0 ? (
            <div className={styles.emptyState}>
              <Trophy size={26} style={{ opacity: 0.3, margin: '0 auto 0.6rem', display: 'block' }} />
              <p className={styles.emptyStateTitle}>No results yet</p>
              <p className={styles.emptyStateSub}>Once a game gets a score, it shows up here.</p>
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
                          background: y.status === 'archived' ? 'rgba(255,255,255,0.06)' : 'rgba(74,222,128,0.1)',
                          color: y.status === 'archived' ? 'rgba(255,255,255,0.35)' : '#4ade80',
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
                            <div style={{ fontWeight: 600, color: '#4ade80' }}>{fmt(acct.duesCollected)}</div>
                            <div className={styles.insightsSeasonStatLbl}>Dues collected</div>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: acct.duesOutstanding > 0 ? '#f87171' : 'rgba(255,255,255,0.5)' }}>{fmt(acct.duesOutstanding)}</div>
                            <div className={styles.insightsSeasonStatLbl}>Outstanding</div>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{fmt(acct.totalExpenses)}</div>
                            <div className={styles.insightsSeasonStatLbl}>Expenses</div>
                          </div>
                        </>
                      )}
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
