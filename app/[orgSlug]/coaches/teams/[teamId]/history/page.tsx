'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Archive, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { winPct, compareValues, formatWinPct, type TrendDirection } from '@/lib/season-compare';
import styles from '../../../coaches.module.css';
import type { RepTeamHistoryYear } from '@/lib/types';

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

  useEffect(() => { load(); }, [load]);

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
          <div className={styles.headerIcon}><Archive size={22} /></div>
          <div>
            <nav className={styles.breadcrumb}>
              <Link href={`/${orgSlug}/coaches`}>Portal</Link>
              <span>/</span>
              <Link href={base}>{assignment.teamName}</Link>
              <span>/</span>
              <span>Season Review</span>
            </nav>
            <h1 className={styles.pageTitle}>Season Review</h1>
            <p className={styles.pageSub}>{assignment.teamName} — this season vs last, and past seasons</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingState}>Loading history…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : (
        <>
          {/* This season vs last */}
          {current && (
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: '1.25rem 1.35rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>This season vs last</div>
                <div style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.4)' }}>
                  {current.name} (in progress)
                  {previous && <span> · compared to {previous.name}</span>}
                </div>
              </div>

              {!previous ? (
                <p className={styles.muted} style={{ fontSize: '0.85rem', margin: 0 }}>
                  This is your first season — once a season wraps, next year&apos;s Season Review will show how you&apos;re trending.
                </p>
              ) : (
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
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
            </div>
          )}

          {history.length === 0 ? (
            <div className={styles.emptyState}>
              <Archive size={28} style={{ opacity: 0.3, margin: '0 auto 0.75rem', display: 'block' }} />
              <p className={styles.emptyStateTitle}>No past seasons yet</p>
              <p className={styles.emptyStateSub}>Completed and archived program years will appear here.</p>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.35)', marginBottom: '0.75rem' }}>
                Past seasons
              </div>
              {history.map(y => {
                const record = recordText(y);
                const acct = y.accounting;
                return (
                  <div
                    key={y.id}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10,
                      padding: '1.25rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>{y.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                          {y.year}
                          {record && <span style={{ marginLeft: '0.75rem' }}>{record}</span>}
                          {y.tryoutTotal > 0 && (
                            <span style={{ marginLeft: '0.75rem' }}>
                              Tryout acceptance: {acceptanceRate(y.tryoutTotal, y.tryoutAccepted)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: 4,
                          background: y.status === 'archived' ? 'rgba(255,255,255,0.06)' : 'rgba(74,222,128,0.1)',
                          color: y.status === 'archived' ? 'rgba(255,255,255,0.35)' : '#4ade80',
                        }}
                      >
                        {y.status === 'archived' ? 'Archived' : 'Completed'}
                      </span>
                    </div>

                    {/* Quick stats row */}
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{y.rosterCount}</div>
                        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>Players</div>
                      </div>
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
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
