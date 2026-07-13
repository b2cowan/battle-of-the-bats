'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Award, Check, Trash2 } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import GiveAwardModal from '@/components/coaches/GiveAwardModal';
import AwardTypeManagerModal from '@/components/coaches/AwardTypeManagerModal';
import { canManageAwards } from '@/lib/coach-capabilities';
import styles from '../../../../coaches.module.css';
import type { RepPlayerAward, RepTeamAwardType } from '@/lib/types';

// "Who's earning it?" — a new report (not a metric folded into an existing one, unlike the
// "vs tag" report) because a player leaderboard is a genuinely different shape: players ranked
// by recognition, not games. Owner-confirmed placement as the Insights hub's 5th tile,
// 2026-07-12 (see COACH_TAGS_AWARDS_PLAN.md P2).
export default function CoachesAwardsReportPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(paramsPromise);
  const { assignments, loading: ctxLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const confirm = useConfirm();

  const [awardTypes, setAwardTypes] = useState<RepTeamAwardType[]>([]);
  const [awards, setAwards] = useState<RepPlayerAward[]>([]);
  const [players, setPlayers] = useState<{ id: string; name: string; number: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [activeTypeId, setActiveTypeId] = useState<string | null>(null);
  const [giveOpen, setGiveOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [typesRes, awardsRes] = await Promise.all([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/award-types`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/awards`),
      ]);
      if (!typesRes.ok || !awardsRes.ok) throw new Error();
      const types = await typesRes.json();
      const data = await awardsRes.json();
      setAwardTypes(types.awardTypes ?? []);
      setAwards(data.awards ?? []);
      setPlayers(data.players ?? []);
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
  if (!canManageAwards(assignment.capabilities)) {
    return (
      <div className={styles.notAssigned}>
        <h2>No access</h2>
        <p>You don’t have access to awards for this team.</p>
      </div>
    );
  }

  // Filter chips are built from types with at least one award (self-hides an unused type,
  // same convention as the "vs tag" report's per-tag chip self-hide).
  const typeChips = awardTypes
    .map(t => ({ type: t, count: awards.filter(a => a.awardTypeId === t.id).length }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count);
  const activeType = typeChips.find(c => c.type.id === activeTypeId)?.type ?? null;
  const visibleAwards = activeType ? awards.filter(a => a.awardTypeId === activeType.id) : awards;

  const leaderboard = (() => {
    const byPlayer = new Map<string, { playerId: string; playerName: string; total: number; byType: Map<string, { type: RepTeamAwardType | undefined; count: number }> }>();
    for (const a of visibleAwards) {
      const entry = byPlayer.get(a.playerId) ?? { playerId: a.playerId, playerName: a.playerName ?? 'Unknown player', total: 0, byType: new Map() };
      entry.total += 1;
      const t = entry.byType.get(a.awardTypeId) ?? { type: a.awardType, count: 0 };
      t.count += 1;
      entry.byType.set(a.awardTypeId, t);
      byPlayer.set(a.playerId, entry);
    }
    return Array.from(byPlayer.values()).sort((a, b) => b.total - a.total);
  })();

  async function handleDelete(award: RepPlayerAward) {
    const ok = await confirm({
      title: 'Remove this award?',
      message: `Undo ${award.awardType?.name ?? 'this award'} for ${award.playerName}? This can’t be undone.`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setDeleteError('');
    setBusyId(award.id);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/awards/${award.id}`, { method: 'DELETE' });
      if (res.ok) {
        void load();
      } else {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        setDeleteError(d.error ?? 'Could not remove this award');
      }
    } catch {
      setDeleteError('Could not remove this award — check your connection and try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={styles.page}>
      <Link href={`${base}/history`} className={styles.lineupBackLink}>← Insights</Link>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Award size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>Who&apos;s earning it?</h1>
            <p className={styles.pageSub}>Every award given this season</p>
          </div>
        </div>
      </div>

      {loading || loadedFor !== teamId ? (
        <div className={styles.loadingState}>Loading report…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : (
        <>
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button className={styles.btnPrimary} onClick={() => setGiveOpen(true)}>🏆 Give an award</button>
            <button className={styles.tagManageLink} onClick={() => setManageOpen(true)}>Manage award types</button>
          </div>

          {awards.length === 0 ? (
            <div className={styles.emptyState}>
              <Award size={26} style={{ opacity: 0.3, margin: '0 auto 0.6rem', display: 'block' }} />
              <p className={styles.emptyStateTitle}>No awards given yet</p>
              <p className={styles.emptyStateSub}>Hand out your first one right after a game wraps, or use the button above.</p>
            </div>
          ) : (
            <>
              {activeType ? (
                <div className={styles.insightsTagSummary}>
                  <span className={styles.insightsTagSummaryLbl}>{activeType.emoji ? `${activeType.emoji} ` : ''}{activeType.name}:</span>
                  <span className={styles.insightsTagSummaryRec}>{visibleAwards.length} given</span>
                </div>
              ) : (
                <p className={styles.insightsBasis}>
                  {awards.length} award{awards.length === 1 ? '' : 's'} given this season across {typeChips.length} award type{typeChips.length === 1 ? '' : 's'}
                </p>
              )}

              {typeChips.length > 1 && (
                <div className={styles.lineupFilterBar} role="group" aria-label="Filter by award">
                  <button
                    type="button"
                    aria-pressed={!activeType}
                    className={`${styles.lineupFilterChip} ${!activeType ? styles.lineupFilterChipActive : ''}`}
                    onClick={() => setActiveTypeId(null)}
                  >
                    {!activeType && <Check size={12} aria-hidden />} All
                  </button>
                  {typeChips.map(c => (
                    <button
                      key={c.type.id}
                      type="button"
                      aria-pressed={activeType?.id === c.type.id}
                      className={`${styles.lineupFilterChip} ${activeType?.id === c.type.id ? styles.lineupFilterChipActive : ''}`}
                      onClick={() => setActiveTypeId(c.type.id)}
                    >
                      {activeType?.id === c.type.id && <Check size={12} aria-hidden />} {c.type.emoji ? `${c.type.emoji} ` : ''}{c.type.name} <b className={styles.lineupFilterCount}>{c.count}</b>
                    </button>
                  ))}
                </div>
              )}

              <section style={{ marginBottom: '1.75rem' }}>
                <p className={styles.sectionKicker}>Leaderboard</p>
                {leaderboard.map((row, i) => (
                  <div key={row.playerId} className={styles.tagManagerRow}>
                    <span className={styles.mutedInline} style={{ width: '1.5rem', flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{row.playerName}</div>
                      <div className={styles.lineupChips} style={{ marginTop: '0.25rem' }}>
                        {Array.from(row.byType.values()).map((t, ti) => (
                          <span key={ti} className={styles.lineupChip}>{t.type?.emoji ? `${t.type.emoji} ` : ''}{t.count}× {t.type?.name ?? 'Award'}</span>
                        ))}
                      </div>
                    </div>
                    <span style={{ fontWeight: 800, fontFamily: 'var(--font-data)' }}>{row.total}</span>
                  </div>
                ))}
              </section>

              <section>
                <p className={styles.sectionKicker}>Full history</p>
                {deleteError && <p className={styles.errorText}>{deleteError}</p>}
                <div className={styles.insightsTableWrap}>
                  <table className={styles.insightsTable}>
                    <thead><tr><th>Player</th><th>Award</th><th>For</th><th>Date</th><th>Note</th><th aria-hidden /></tr></thead>
                    <tbody>
                      {visibleAwards.map(a => (
                        <tr key={a.id}>
                          <td>{a.playerName}</td>
                          <td>{a.awardType?.emoji ? `${a.awardType.emoji} ` : ''}{a.awardType?.name ?? '—'}</td>
                          <td className={styles.mutedInline}>{a.eventOpponent ? `vs ${a.eventOpponent}` : (a.tournamentLabel || 'General')}</td>
                          <td className={styles.insightsNum}>{new Date(`${a.awardedAt}T00:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</td>
                          <td className={styles.mutedInline}>{a.note || '—'}</td>
                          <td>
                            <button
                              title="Remove"
                              disabled={busyId === a.id}
                              onClick={() => handleDelete(a)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--white-45)', padding: '0.2rem' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}

      {giveOpen && (
        <GiveAwardModal
          orgSlug={orgSlug}
          teamId={teamId}
          players={players}
          awardTypes={awardTypes}
          eventContext={null}
          onClose={() => setGiveOpen(false)}
          onChanged={() => { void load(); }}
        />
      )}
      {manageOpen && (
        <AwardTypeManagerModal
          orgSlug={orgSlug}
          teamId={teamId}
          /* Team's OWN types only — org-shared types (teamId null, Phase 3) are managed by the
             org admin in the Shared Library, not editable/retirable from a team. The give-award
             picker above still offers shared types; only management is team-scoped. */
          awardTypes={awardTypes.filter(t => t.teamId !== null)}
          onClose={() => setManageOpen(false)}
          onChanged={() => { void load(); }}
        />
      )}
    </div>
  );
}
