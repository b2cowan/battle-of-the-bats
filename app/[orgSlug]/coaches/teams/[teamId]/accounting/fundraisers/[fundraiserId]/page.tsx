'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Gift, Settings, X, Check, ArrowLeft } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import styles from '../../../../../coaches.module.css';

interface FundraiserDetail {
  id: string;
  name: string;
  description: string | null;
  playerRebatePercent: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

interface FundraiserEntry {
  id: string;
  fundraiserId: string;
  playerId: string;
  amountRaised: number;
  rebatePercent: number;
  rebateAmount: number;
  accountingEntryId: string | null;
  creditId: string | null;
  notes: string | null;
}

interface PlayerRow {
  playerId: string;
  playerName: string;
  remainingDues: number;
  entry: FundraiserEntry | null;
}

interface Summary {
  totalRaised: number;
  teamNet: number;
  totalCredits: number;
  playerCount: number;
}

function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function FundraiserDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string; fundraiserId: string }>;
}) {
  const params = use(paramsPromise);
  const { orgSlug, teamId, fundraiserId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();

  const [fundraiser, setFundraiser]   = useState<FundraiserDetail | null>(null);
  const [summary, setSummary]         = useState<Summary | null>(null);
  const [players, setPlayers]         = useState<PlayerRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  // Inline log-amount state
  const [logPlayerId, setLogPlayerId]   = useState<string | null>(null);
  const [logAmount, setLogAmount]       = useState('');
  const [logNotes, setLogNotes]         = useState('');
  const [logSaving, setLogSaving]       = useState(false);
  const [logError, setLogError]         = useState('');

  // Edit fundraiser settings
  const [showSettings, setShowSettings] = useState(false);
  const [editName, setEditName]         = useState('');
  const [editDesc, setEditDesc]         = useState('');
  const [editRebate, setEditRebate]     = useState('');
  const [editStart, setEditStart]       = useState('');
  const [editEnd, setEditEnd]           = useState('');
  const [editActive, setEditActive]     = useState(true);
  const [editSaving, setEditSaving]     = useState(false);
  const [editError, setEditError]       = useState('');

  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${fundraiserId}/entries`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      setFundraiser(data.fundraiser);
      setSummary(data.summary);
      setPlayers(data.players);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load fundraiser.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId, fundraiserId]);

  useEffect(() => { load(); }, [load]);

  function startLog(playerId: string, existingEntry: FundraiserEntry | null) {
    setLogPlayerId(playerId);
    setLogAmount(existingEntry ? String(existingEntry.amountRaised) : '');
    setLogNotes(existingEntry?.notes ?? '');
    setLogError('');
  }

  function cancelLog() {
    setLogPlayerId(null);
    setLogAmount('');
    setLogNotes('');
    setLogError('');
  }

  async function saveLog(player: PlayerRow) {
    const amount = Number(logAmount);
    if (isNaN(amount) || amount < 0) { setLogError('Enter a valid amount (0 or more).'); return; }
    setLogSaving(true);
    setLogError('');
    try {
      const existingEntry = player.entry;
      let res: Response;
      if (existingEntry) {
        res = await fetch(
          `/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${fundraiserId}/entries/${existingEntry.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amountRaised: amount, notes: logNotes || null }),
          },
        );
      } else {
        res = await fetch(
          `/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${fundraiserId}/entries`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: player.playerId, amountRaised: amount, notes: logNotes || null }),
          },
        );
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      cancelLog();
      await load();
    } catch (e: any) {
      setLogError(e.message);
    } finally {
      setLogSaving(false);
    }
  }

  function openSettings() {
    if (!fundraiser) return;
    setEditName(fundraiser.name);
    setEditDesc(fundraiser.description ?? '');
    setEditRebate(String(fundraiser.playerRebatePercent));
    setEditStart(fundraiser.startDate ?? '');
    setEditEnd(fundraiser.endDate ?? '');
    setEditActive(fundraiser.isActive);
    setEditError('');
    setShowSettings(true);
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) { setEditError('Name is required.'); return; }
    const rebate = Number(editRebate);
    if (isNaN(rebate) || rebate < 0 || rebate > 100) {
      setEditError('Rebate % must be between 0 and 100.');
      return;
    }
    setEditSaving(true);
    setEditError('');
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${fundraiserId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:               editName.trim(),
            description:        editDesc.trim() || null,
            playerRebatePercent: rebate,
            startDate:          editStart || null,
            endDate:            editEnd   || null,
            isActive:           editActive,
          }),
        },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setShowSettings(false);
      await load();
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditSaving(false);
    }
  }

  if (ctxLoading) return <p className={styles.muted}>Loading…</p>;
  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href={`${base}/accounting/fundraisers`} className={styles.backLink}>
        <ArrowLeft size={14} aria-hidden /> Back to Fundraisers
      </Link>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Gift size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>{fundraiser?.name ?? 'Fundraiser'}</h1>
            {fundraiser && (
              <p className={styles.pageSub}>
                {fundraiser.playerRebatePercent}% player rebate
                {fundraiser.startDate && ` · ${fundraiser.startDate}`}
                {fundraiser.endDate && ` → ${fundraiser.endDate}`}
              </p>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {fundraiser && (
            <span className={`${styles.badge} ${fundraiser.isActive ? styles.badgeActive : styles.badgeArchived}`}>
              {fundraiser.isActive ? 'Active' : 'Closed'}
            </span>
          )}
          <button className={styles.btnSecondary} onClick={openSettings} title="Edit fundraiser settings">
            <Settings size={15} /> Settings
          </button>
        </div>
      </div>

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : summary && (
        <>
          {/* Summary cards */}
          <div className={styles.summaryGrid} style={{ marginBottom: '2rem' }}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>Total Raised</span>
              <span className={styles.summaryCardValue} style={{ color: 'var(--success-light)' }}>
                {fmt(summary.totalRaised)}
              </span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>Team Keeps</span>
              <span className={styles.summaryCardValue}>
                {fmt(summary.teamNet)}
              </span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>Credits Issued</span>
              <span className={styles.summaryCardValue} style={{ color: 'var(--home-plum, #a855f7)' }}>
                {fmt(summary.totalCredits)}
              </span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardLabel}>Players Logged</span>
              <span className={styles.summaryCardValue}>
                {summary.playerCount}
              </span>
            </div>
          </div>

          {/* Per-player leaderboard table */}
          {players.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyStateTitle}>No roster players found</p>
              <p className={styles.emptyStateSub}>Add active players to this team's roster to start logging fundraising amounts.</p>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Rank</th>
                    <th className={styles.th}>Player</th>
                    <th className={styles.th} style={{ textAlign: 'right' }}>Amount Raised</th>
                    <th className={styles.th} style={{ textAlign: 'right' }}>Rebate Earned</th>
                    <th className={styles.th} style={{ textAlign: 'right' }}>Remaining Dues</th>
                    <th className={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, idx) => {
                    const isLogging = logPlayerId === player.playerId;
                    const rank = player.entry ? idx + 1 : null;
                    return (
                      <tr key={player.playerId} className={styles.tr}>
                        <td className={styles.td} style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))', width: '2.5rem' }}>
                          {rank ?? '—'}
                        </td>
                        <td className={styles.td}>
                          <span className={styles.playerName}>{player.playerName}</span>
                        </td>
                        <td className={styles.td} style={{ textAlign: 'right' }}>
                          {player.entry ? (
                            <span style={{ fontWeight: 700, color: 'var(--success-light)' }}>{fmt(player.entry.amountRaised)}</span>
                          ) : (
                            <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.25))' }}>—</span>
                          )}
                        </td>
                        <td className={styles.td} style={{ textAlign: 'right' }}>
                          {player.entry && player.entry.rebateAmount > 0 ? (
                            <span style={{ fontWeight: 600, color: 'var(--home-plum, #a855f7)' }}>{fmt(player.entry.rebateAmount)}</span>
                          ) : (
                            <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.25))' }}>—</span>
                          )}
                        </td>
                        <td className={styles.td} style={{ textAlign: 'right' }}>
                          <span style={{ color: player.remainingDues > 0 ? 'var(--home-amber, #f97316)' : 'var(--home-dim, rgba(255,255,255,0.4))' }}>
                            {player.remainingDues > 0 ? fmt(player.remainingDues) : '—'}
                          </span>
                        </td>
                        <td className={styles.td} style={{ width: '1%', whiteSpace: 'nowrap' }}>
                          {isLogging ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <input
                                className={styles.input}
                                type="number"
                                min={0}
                                step="0.01"
                                value={logAmount}
                                onChange={e => setLogAmount(e.target.value)}
                                placeholder="0.00"
                                style={{ width: '90px' }}
                                autoFocus
                              />
                              <input
                                className={styles.input}
                                type="text"
                                value={logNotes}
                                onChange={e => setLogNotes(e.target.value)}
                                placeholder="Notes (optional)"
                                style={{ width: '120px' }}
                              />
                              {logError && <p className={styles.errorText} style={{ margin: 0, fontSize: '0.78rem' }}>{logError}</p>}
                              <button
                                className={styles.btnPrimary}
                                disabled={logSaving}
                                onClick={() => saveLog(player)}
                                style={{ padding: '0.35rem 0.6rem' }}
                                title="Save"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                className={styles.btnGhost}
                                onClick={cancelLog}
                                style={{ padding: '0.35rem 0.5rem' }}
                                title="Cancel"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              className={styles.btnGhost}
                              onClick={() => startLog(player.playerId, player.entry)}
                              style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                              disabled={!fundraiser?.isActive}
                              title={!fundraiser?.isActive ? 'Fundraiser is closed' : undefined}
                            >
                              {player.entry ? 'Edit' : 'Log Amount'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Settings modal */}
      {showSettings && fundraiser && (
        <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Fundraiser Settings</h2>
              <button className={styles.modalCloseBtn} onClick={() => setShowSettings(false)}><X size={18} /></button>
            </div>
            <form onSubmit={saveSettings}>
              <div className={styles.formGrid}>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Name *</label>
                  <input
                    className={styles.input}
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    required
                  />
                </div>
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Description</label>
                  <textarea
                    className={styles.textarea}
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Player Rebate %</label>
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={editRebate}
                    onChange={e => setEditRebate(e.target.value)}
                  />
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--home-dim, rgba(255,255,255,0.3))' }}>
                    Only applies to new entries — existing entries keep their snapshotted rate
                  </p>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Status</label>
                  <select
                    className={styles.select}
                    value={editActive ? 'active' : 'closed'}
                    onChange={e => setEditActive(e.target.value === 'active')}
                  >
                    <option value="active">Active</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Start Date</label>
                  <input
                    className={styles.input}
                    type="date"
                    value={editStart}
                    onChange={e => setEditStart(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>End Date</label>
                  <input
                    className={styles.input}
                    type="date"
                    value={editEnd}
                    onChange={e => setEditEnd(e.target.value)}
                  />
                </div>
              </div>
              {editError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{editError}</p>}
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnGhost} onClick={() => setShowSettings(false)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={editSaving}>
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
