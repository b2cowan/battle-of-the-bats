'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Archive, TrendingUp, TrendingDown, Minus, BarChart3, CalendarCheck, DollarSign, ChevronDown, ChevronRight } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { winPct, compareValues, formatWinPct, type TrendDirection } from '@/lib/season-compare';
import styles from '../../../coaches.module.css';
import type { RepTeamHistoryYear } from '@/lib/types';
import type { SeasonLineupAnalytics } from '@/lib/lineup-season-analytics';

interface SeasonAccounting {
  duesCollected: number;
  duesOutstanding: number;
  totalExpenses: number;
}

interface HistoryYear extends RepTeamHistoryYear {
  accounting: SeasonAccounting | null;
}

interface CurrentSeason {
  id: string;
  name: string;
  year: number;
  status: string;
  rosterCount: number;
  wins: number;
  losses: number;
  ties: number;
  tryoutTotal: number;
  tryoutAccepted: number;
  accounting: SeasonAccounting | null;
}

function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function acceptanceRate(total: number, accepted: number): string {
  if (!total) return '—';
  return `${Math.round((accepted / total) * 100)}%`;
}

function recordText(r: { wins: number; losses: number; ties: number }): string | null {
  return r.wins || r.losses || r.ties ? `${r.wins}W – ${r.losses}L – ${r.ties}T` : null;
}

// ── "This season vs last" comparison ──────────────────────────────────────────

// One metric in the comparison panel: a headline value + how it moved vs last season.
function TrendStat({
  label, valueText, direction, deltaText, judged,
}: {
  label: string;
  valueText: string;
  direction: TrendDirection;
  deltaText: string | null;
  // 'good-up' → up is green / down is red; 'neutral' → arrow shown but never coloured good/bad.
  judged: 'good-up' | 'neutral';
}) {
  const color =
    direction === 'na' || direction === 'flat' || judged === 'neutral'
      ? 'rgba(255,255,255,0.45)'
      : direction === 'up'
        ? '#4ade80'
        : '#f87171';
  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)', marginBottom: '0.2rem' }}>
        {label}
      </div>
      <div style={{ fontWeight: 700, fontSize: '1.15rem', fontVariantNumeric: 'tabular-nums' }}>{valueText}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem', fontSize: '0.75rem', color }}>
        {direction !== 'na' && <Icon size={13} aria-hidden />}
        <span>{direction === 'na' ? '— not enough yet to compare' : deltaText}</span>
      </div>
    </div>
  );
}

// The one Review-rubric destination (design log 2026-07-08 "Insights" consolidation), laid out as a
// DASHBOARD GRID (owner rule 2026-07-09): each domain is one compact side-by-side card — results,
// playing time, attendance, money — all visible in a desktop viewport. Page scroll is never how you
// travel between domains; depth is on demand INSIDE a card (expandable rows) or one tap deeper.
// Sections whose capability fails never render; money analytics stay in the Money hub.
export default function CoachesHistoryPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const params = use(paramsPromise);
  const { orgSlug, teamId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const [history, setHistory] = useState<HistoryYear[]>([]);
  const [current, setCurrent] = useState<CurrentSeason | null>(null);
  const [canViewMoney, setCanViewMoney] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Playing time & lineups card (fails closed until the assignment resolves; the server enforces
  // the lineups capability on the analytics route regardless).
  const canLineups = !!assignment?.capabilities.lineups;
  const canRoster = !!assignment && assignment.capabilities.roster !== 'off';
  const [analytics, setAnalytics] = useState<SeasonLineupAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');
  const [analyticsDenied, setAnalyticsDenied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/history`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      setHistory(data.history ?? []);
      setCurrent(data.current ?? null);
      setCanViewMoney(!!data.canViewMoney);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load history.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-analytics`);
      if (res.status === 403) {
        // Stale client capabilities — the server says no lineup visibility; hide the card
        // rather than showing an error inside a card this coach shouldn't see.
        setAnalyticsDenied(true);
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAnalytics(data.analytics ?? null);
    } catch {
      setAnalyticsError('Season analytics couldn’t be loaded — refresh to try again.');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (ctxLoading || !canLineups) return;
    void Promise.resolve().then(loadAnalytics);
  }, [ctxLoading, canLineups, loadAnalytics]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  // The comparison pairs the current season against the most recent past season (history is
  // returned newest-first). Only shown when there IS a current season.
  const previous = history.length ? history[0] : null;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><BarChart3 size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>Insights</h1>
            <p className={styles.pageSub}>{assignment.teamName} — results, playing time, attendance &amp; past seasons</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingState}>Loading insights…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : (
        <div className={styles.insightsGrid}>
          {/* ── Results & records ── */}
          <section className={styles.insightsCard} aria-labelledby="insights-results">
            <p className={styles.insightsCardKicker} id="insights-results">Results &amp; records</p>

            {current && (
              <>
                <div className={styles.insightsCompareHead}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>This season vs last</div>
                  <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.4)' }}>
                    {current.name} (in progress)
                    {previous && <span> · vs {previous.name}</span>}
                  </div>
                </div>

                {!previous ? (
                  <p className={styles.muted} style={{ fontSize: '0.85rem', margin: 0 }}>
                    This is your first season — once a season wraps, next year&apos;s Insights will show how you&apos;re trending.
                  </p>
                ) : (
                  <div style={{ display: 'flex', gap: '1.25rem 1.75rem', flexWrap: 'wrap' }}>
                    {(() => {
                      const curPct = winPct(current);
                      const prevPct = winPct(previous);
                      const t = compareValues(curPct, prevPct);
                      const deltaPts = t.delta == null ? null : `${t.delta >= 0 ? '+' : ''}${Math.round(t.delta * 100)} pts vs last`;
                      return (
                        <TrendStat
                          label="Winning %"
                          valueText={`${formatWinPct(curPct)}${recordText(current) ? ` · ${recordText(current)}` : ''}`}
                          direction={t.direction}
                          deltaText={deltaPts}
                          judged="good-up"
                        />
                      );
                    })()}

                    {(() => {
                      const t = compareValues(current.rosterCount, previous.rosterCount);
                      return (
                        <TrendStat
                          label="Roster size"
                          valueText={`${current.rosterCount}`}
                          direction={t.direction}
                          deltaText={t.delta == null ? null : `${t.delta >= 0 ? '+' : ''}${t.delta} vs last`}
                          judged="good-up"
                        />
                      );
                    })()}

                    {canViewMoney && current.accounting && previous.accounting && (() => {
                      const t = compareValues(current.accounting!.duesCollected, previous.accounting!.duesCollected);
                      return (
                        <TrendStat
                          label="Dues collected"
                          valueText={fmt(current.accounting!.duesCollected)}
                          direction={t.direction}
                          deltaText={t.delta == null ? null : `${t.delta >= 0 ? '+' : '−'}${fmt(t.delta)} vs last`}
                          judged="good-up"
                        />
                      );
                    })()}

                    {canViewMoney && current.accounting && previous.accounting && (() => {
                      const t = compareValues(current.accounting!.totalExpenses, previous.accounting!.totalExpenses);
                      return (
                        <TrendStat
                          label="Expenses"
                          valueText={fmt(current.accounting!.totalExpenses)}
                          direction={t.direction}
                          deltaText={t.delta == null ? null : `${t.delta >= 0 ? '+' : '−'}${fmt(t.delta)} vs last`}
                          judged="neutral"
                        />
                      );
                    })()}
                  </div>
                )}
              </>
            )}

            <p className={styles.insightsSubLabel}>Past seasons</p>
            {history.length === 0 ? (
              <p className={styles.muted} style={{ fontSize: '0.82rem', margin: 0 }}>
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
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>Players</div>
                      </div>
                      {y.tryoutTotal > 0 && (
                        <div>
                          <div style={{ fontWeight: 600 }}>{acceptanceRate(y.tryoutTotal, y.tryoutAccepted)}</div>
                          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>Tryout acceptance</div>
                        </div>
                      )}
                      {acct && (
                        <>
                          <div>
                            <div style={{ fontWeight: 600, color: '#4ade80' }}>{fmt(acct.duesCollected)}</div>
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>Dues collected</div>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: acct.duesOutstanding > 0 ? '#f87171' : 'rgba(255,255,255,0.5)' }}>
                              {fmt(acct.duesOutstanding)}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>Outstanding</div>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{fmt(acct.totalExpenses)}</div>
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>Expenses</div>
                          </div>
                        </>
                      )}
                    </div>
                  </details>
                );
              })
            )}
          </section>

          {/* ── Playing time & lineups (moved from the Lineups page, 2026-07-08) ── */}
          {canLineups && !analyticsDenied && (
            <section className={styles.insightsCard} aria-labelledby="insights-lineups">
              <p className={styles.insightsCardKicker} id="insights-lineups">Playing time &amp; lineups</p>
              {analyticsLoading ? (
                <div className={styles.loadingState}>Loading analytics…</div>
              ) : analyticsError ? (
                <p className={styles.errorText}>{analyticsError}</p>
              ) : !analytics || analytics.gamesWithLineup === 0 ? (
                <p className={styles.muted} style={{ fontSize: '0.82rem', margin: 0 }}>
                  <BarChart3 size={14} style={{ verticalAlign: '-2px', marginRight: '0.35rem', opacity: 0.5 }} aria-hidden />
                  No season trends yet — save a lineup for a few games and your fair-play, position, arm-care and lineup-record trends will show up here.
                </p>
              ) : (
                <>
                  <p className={styles.lineupAnalyticsBasis}>Based on the {analytics.gamesWithLineup} game{analytics.gamesWithLineup === 1 ? '' : 's'} you&apos;ve saved a lineup for.</p>

                  <details className={styles.lineupAnalyticsCard}>
                    <summary className={styles.lineupAnalyticsSummary}>Fair playing time <ChevronDown size={16} className={styles.lineupAnalyticsCaret} aria-hidden /></summary>
                    <div className={styles.lineupAnalyticsBody}>
                      {analytics.fairPlay.map(r => {
                        const total = r.fieldInnings + r.benchInnings;
                        const pct = total > 0 ? Math.round((r.fieldInnings / total) * 100) : 0;
                        return (
                          <div key={r.playerId} className={styles.lineupAnalyticsRow}>
                            <span className={styles.lineupAnalyticsName}>{r.name}</span>
                            <span className={styles.lineupAnalyticsBar}><i style={{ width: `${pct}%` }} /></span>
                            <span className={styles.lineupAnalyticsVal}>{r.fieldInnings} on · {r.benchInnings} bench</span>
                          </div>
                        );
                      })}
                    </div>
                  </details>

                  <details className={styles.lineupAnalyticsCard}>
                    <summary className={styles.lineupAnalyticsSummary}>Bench balance <ChevronDown size={16} className={styles.lineupAnalyticsCaret} aria-hidden /></summary>
                    <div className={styles.lineupAnalyticsBody}>
                      {analytics.benchBalance.map(r => (
                        <div key={r.playerId} className={styles.lineupAnalyticsRow}>
                          <span className={styles.lineupAnalyticsName}>{r.name}</span>
                          <span className={styles.lineupAnalyticsVal}>
                            {r.benchInnings} bench inning{r.benchInnings === 1 ? '' : 's'}
                            {r.backToBackGames > 0 && <em className={styles.lineupAnalyticsFlag}> · {r.backToBackGames} back-to-back</em>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>

                  <details className={styles.lineupAnalyticsCard}>
                    <summary className={styles.lineupAnalyticsSummary}>Position variety <ChevronDown size={16} className={styles.lineupAnalyticsCaret} aria-hidden /></summary>
                    <div className={styles.lineupAnalyticsBody}>
                      {analytics.positionVariety.map(r => (
                        <div key={r.playerId} className={styles.lineupAnalyticsRow}>
                          <span className={styles.lineupAnalyticsName}>{r.name}</span>
                          <span className={styles.lineupAnalyticsVal}>
                            <strong>{r.count}</strong> · {r.positions.length ? r.positions.join(', ') : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>

                  {analytics.armCare.length > 0 && (
                    <details className={styles.lineupAnalyticsCard}>
                      <summary className={styles.lineupAnalyticsSummary}>Arm-care / pitching load <ChevronDown size={16} className={styles.lineupAnalyticsCaret} aria-hidden /></summary>
                      <div className={styles.lineupAnalyticsBody}>
                        {analytics.armCare.map(r => (
                          <div key={r.playerId} className={styles.lineupAnalyticsRow}>
                            <span className={styles.lineupAnalyticsName}>{r.name}</span>
                            <span className={styles.lineupAnalyticsVal}>
                              {r.inningsPitched} IP · {r.gamesPitched} game{r.gamesPitched === 1 ? '' : 's'}
                              {r.perGameCap != null && <> · cap {r.perGameCap}/g</>}
                              {r.overCapGames > 0 && <em className={styles.lineupAnalyticsFlag}> · ⚠ {r.overCapGames} over cap</em>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  <details className={styles.lineupAnalyticsCard}>
                    <summary className={styles.lineupAnalyticsSummary}>Records by reused lineup <ChevronDown size={16} className={styles.lineupAnalyticsCaret} aria-hidden /></summary>
                    <div className={styles.lineupAnalyticsBody}>
                      {analytics.reusedLineups.length === 0 ? (
                        <p className={styles.lineupAnalyticsEmpty}>No batting order has been reused across multiple games yet.</p>
                      ) : analytics.reusedLineups.map((r, i) => (
                        <div key={i} className={styles.lineupAnalyticsRow}>
                          <span className={styles.lineupAnalyticsName}>{r.label}</span>
                          <span className={styles.lineupAnalyticsVal}>
                            {r.scoredGames > 0
                              ? <><b className={styles.lineupAnalyticsRec}>{r.wins}-{r.losses}{r.ties ? `-${r.ties}` : ''}</b> · {r.games} game{r.games === 1 ? '' : 's'}{r.scoredGames < r.games ? ` (${r.scoredGames} scored)` : ''}</>
                              : <>{r.games} games · no scores yet</>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                </>
              )}
            </section>
          )}

          {/* ── Attendance & reliability (whole-card link) ── */}
          {canRoster && (
            <Link href={`${base}/attendance`} className={`${styles.insightsCard} ${styles.insightsLinkCard}`} aria-labelledby="insights-attendance">
              <p className={styles.insightsCardKicker} id="insights-attendance">Attendance &amp; reliability</p>
              <span className={styles.insightsLinkBody}>
                <span className={styles.moneyCardIcon}><CalendarCheck size={18} /></span>
                <span className={styles.moneyCardBody}>
                  <p className={styles.moneyCardTitle}>Season attendance</p>
                  <p className={styles.moneyCardDesc}>Who&apos;s been making it out — per-player games and practices attended.</p>
                </span>
                <ChevronRight size={16} className={styles.moneyCardChevron} aria-hidden />
              </span>
            </Link>
          )}

          {/* ── Money reports (cross-link only — reports live with money operations in Money) ── */}
          {canViewMoney && (
            <Link href={`${base}/accounting`} className={`${styles.insightsCard} ${styles.insightsLinkCard}`} aria-labelledby="insights-money">
              <p className={styles.insightsCardKicker} id="insights-money">Money reports</p>
              <span className={styles.insightsLinkBody}>
                <span className={styles.moneyCardIcon}><DollarSign size={18} /></span>
                <span className={styles.moneyCardBody}>
                  <p className={styles.moneyCardTitle}>Budget vs. actual &amp; player dues</p>
                  <p className={styles.moneyCardDesc}>Spending against plan, who&apos;s paid, expenses and fundraisers — in Money.</p>
                </span>
                <ChevronRight size={16} className={styles.moneyCardChevron} aria-hidden />
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
