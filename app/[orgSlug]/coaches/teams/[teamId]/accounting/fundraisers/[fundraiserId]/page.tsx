'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { Gift, Settings, X, Check } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import { moneySectionHref } from '@/lib/coach-money-links';
import styles from '../../../../../coaches.module.css';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import { applyCreditsToBills, normalizeCreditApplicationMode, type CreditApplicationMode } from '@/lib/dues-credits';

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

/** One open bill for the "Where it lands" preview — served in schedule order by the entries
 *  route; the preview walks them in the team's credit-application direction. */
interface OpenBill {
  installmentNumber: number;
  dueDate: string | null;
  amount: number;
  toSend: number;
}

interface PlayerRow {
  playerId: string;
  playerName: string;
  /** What the family is still asked to SEND (dues − cash − credits applied) — the honest name
   *  for the figure this page used to call remainingDues. */
  leftToSend: number;
  openBills: OpenBill[];
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

/**
 * The "Where it lands" preview — THE shared application arithmetic (lib/dues-credits.ts) run
 * over the open bills the entries route served, with the not-yet-saved rebate as the one
 * credit. Never a local re-derivation: the preview must show exactly what saving will do.
 */
function previewCreditLanding(openBills: OpenBill[], rebate: number, mode: CreditApplicationMode) {
  const position = applyCreditsToBills({
    coverage: openBills.map(b => ({
      installmentId: String(b.installmentNumber),
      installmentNumber: b.installmentNumber,
      allocated: 0,
      remaining: b.toSend,
      covered: false,
      completedOn: null,
    })),
    credits: [{ id: 'preview', amount: rebate, creditType: 'fundraiser', creditDate: '9999-01-01' }],
    mode,
  });
  const byNumber = new Map(position.perInstallment.map(c => [c.installmentNumber, c]));
  const rows = openBills
    .map(b => {
      const after = byNumber.get(b.installmentNumber);
      if (!after || after.creditApplied <= 0.005) return null;
      return {
        installmentNumber: b.installmentNumber,
        dueDate: b.dueDate,
        wasToSend: b.toSend,
        newToSend: after.toSend,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  return { rows, leftover: position.owedBack };
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
  // Normalized at the fetch boundary (mirror of the server's mapper), so everything below
  // trusts the state as a real mode.
  const [creditApplication, setCreditApplication] = useState<CreditApplicationMode>('last_first');
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
  // Money is three-state (off|read|write). Settings and the per-player log form are both
  // refused server-side for a read-only coach; don't offer them either.
  const canWriteMoney = assignment?.capabilities.money === 'write';
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  useOverlayOpen(showSettings);

  // Discard guard (review f7-3/f7-7). Settings is an EDIT form, so the baseline is the loaded
  // fundraiser rather than a blank object — otherwise opening it would read as dirty at once.
  const settingsDirty = !!fundraiser && (
    editName !== fundraiser.name
    || editDesc !== (fundraiser.description ?? '')
    || editRebate !== String(fundraiser.playerRebatePercent)
    || editStart !== (fundraiser.startDate ?? '')
    || editEnd !== (fundraiser.endDate ?? '')
    || editActive !== fundraiser.isActive
  );
  const closeSettings = useDiscardGuard({
    dirty: settingsDirty,
    close: () => setShowSettings(false),
    noun: 'change to the fundraiser',
  });

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
      setCreditApplication(normalizeCreditApplicationMode(data.creditApplication));
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
      <CoachBackLink href={moneySectionHref(base, 'fundraisers')}>Back to Fundraisers</CoachBackLink>
      {/* Page-header ruling 2026-08-11: the Active/Closed badge is STATE, so it rides the title
          row; the rebate % and dates are live facts about the entity, so they lead the body. */}
      <CoachPageHeader
        icon={Gift}
        title={fundraiser?.name ?? 'Fundraiser'}
        titleChips={fundraiser && (
          <span className={`${styles.badge} ${fundraiser.isActive ? styles.badgeActive : styles.badgeArchived}`}>
            {fundraiser.isActive ? 'Active' : 'Closed'}
          </span>
        )}
        actions={canWriteMoney && (
          <button className={styles.btnSecondary} onClick={openSettings} title="Edit fundraiser settings" aria-label="Fundraiser settings">
            <Settings size={15} aria-hidden /> <span className={styles.headerBtnLabel}>Settings</span>
          </button>
        )}
        helpLabel="Fundraisers"
        help={{ module: 'coaches', sectionIds: ['premium-money'], subtopicId: 'premium-money-budget', fullGuideHref: `/${orgSlug}/coaches/help#premium-money` }}
      />
      {fundraiser && (
        <p className={styles.muted} style={{ margin: '-1.25rem 0 1.5rem' }}>
          {fundraiser.playerRebatePercent}% player rebate
          {fundraiser.startDate && ` · ${fundraiser.startDate}`}
          {fundraiser.endDate && ` → ${fundraiser.endDate}`}
        </p>
      )}

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
            // One player per row: a list, so it stacks into cards at 640 (the Dues exemplar).
            // The trailing cell carries an inline form, so it stacks rather than trying to
            // fit two inputs and two buttons into a label/value line.
            <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Rank</th>
                    <th className={styles.th}>Player</th>
                    <th className={styles.th} style={{ textAlign: 'right' }}>Amount Raised</th>
                    <th className={styles.th} style={{ textAlign: 'right' }}>Rebate Earned</th>
                    {/* "Left to send" — dues minus cash minus credits applied: what this family
                        is actually asked for (the old "Remaining Dues" silently clamped a
                        different formula — plan §7.6). */}
                    <th className={styles.th} style={{ textAlign: 'right' }}>Left to Send</th>
                    <th className={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, idx) => {
                    const isLogging = logPlayerId === player.playerId;
                    const rank = player.entry ? idx + 1 : null;
                    return (
                      <tr key={player.playerId} className={styles.tr}>
                        <td className={styles.td} data-label="Rank" style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))', width: '2.5rem' }}>
                          {rank ?? '—'}
                        </td>
                        <td className={styles.td} data-label="Player">
                          <span className={styles.playerName}>{player.playerName}</span>
                        </td>
                        <td className={styles.td} data-label="Raised" style={{ textAlign: 'right' }}>
                          {player.entry ? (
                            <span style={{ fontWeight: 700, color: 'var(--success-light)' }}>{fmt(player.entry.amountRaised)}</span>
                          ) : (
                            <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.25))' }}>—</span>
                          )}
                        </td>
                        <td className={styles.td} data-label="Rebate" style={{ textAlign: 'right' }}>
                          {player.entry && player.entry.rebateAmount > 0 ? (
                            <span style={{ fontWeight: 600, color: 'var(--home-plum, #a855f7)' }}>{fmt(player.entry.rebateAmount)}</span>
                          ) : (
                            <span style={{ color: 'var(--home-dim, rgba(255,255,255,0.25))' }}>—</span>
                          )}
                        </td>
                        <td className={styles.td} data-label="Left to send" style={{ textAlign: 'right' }}>
                          <span style={{ color: player.leftToSend > 0 ? 'var(--home-amber, #f97316)' : 'var(--home-dim, rgba(255,255,255,0.4))' }}>
                            {player.leftToSend > 0 ? fmt(player.leftToSend) : '—'}
                          </span>
                        </td>
                        <td
                          className={`${styles.td} ${isLogging ? styles.cardStackCell : styles.cardActionCell}`}
                          style={{ width: '1%', whiteSpace: 'nowrap' }}
                        >
                          {isLogging ? (
                            <div className={styles.stack640} style={{ alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <input
                                className={`${styles.input} ${styles.inlineField}`}
                                style={{ '--inline-field-w': '90px' } as React.CSSProperties}
                                type="number"
                                min={0}
                                step="0.01"
                                value={logAmount}
                                onChange={e => setLogAmount(e.target.value)}
                                placeholder="0.00"
                                aria-label="Amount raised"
                                autoFocus
                              />
                              <input
                                className={`${styles.input} ${styles.inlineField}`}
                                style={{ '--inline-field-w': '120px' } as React.CSSProperties}
                                type="text"
                                value={logNotes}
                                onChange={e => setLogNotes(e.target.value)}
                                placeholder="Notes (optional)"
                                aria-label="Notes"
                              />
                              {logError && <p className={styles.errorText} style={{ margin: 0, fontSize: '0.78rem' }}>{logError}</p>}
                              {/* "Where it lands" (binding mockup §2) — the bills this rebate
                                  will lower, shown BEFORE saving. New entries only: an edit's
                                  preview would need the delta against the credit already
                                  applied, and the screen re-derives on save either way. */}
                              {!player.entry && (() => {
                                const raised = parseFloat(logAmount);
                                const pct = fundraiser?.playerRebatePercent ?? 0;
                                if (isNaN(raised) || raised <= 0 || pct <= 0) return null;
                                const rebate = Math.round(raised * pct) / 100;
                                if (rebate <= 0.005) return null;
                                const landing = previewCreditLanding(player.openBills, rebate, creditApplication);
                                return (
                                  <div style={{ flexBasis: '100%', whiteSpace: 'normal', border: '1px solid var(--home-line, rgba(255,255,255,0.1))', borderRadius: 7, overflow: 'hidden', marginTop: '0.2rem' }}>
                                    <div style={{ padding: '0.3rem 0.6rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'var(--home-dim, rgba(255,255,255,0.45))', borderBottom: '1px solid var(--home-line, rgba(255,255,255,0.08))', background: 'var(--home-card, rgba(255,255,255,0.03))' }}>
                                      Where it lands — {fmt(rebate)} credit ({pct}% of {fmt(raised)})
                                    </div>
                                    {landing.rows.length === 0 ? (
                                      <p className={styles.muted} style={{ margin: 0, padding: '0.45rem 0.6rem', fontSize: '0.75rem' }}>
                                        {creditApplication === 'keep_separate'
                                          ? 'Credits are kept separate on this team — bills don’t move; the amount is owed back at season’s end.'
                                          : 'No open bills — the credit becomes money owed back to this family.'}
                                      </p>
                                    ) : (
                                      landing.rows.map(r => (
                                        <div key={r.installmentNumber} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', padding: '0.35rem 0.6rem', fontSize: '0.76rem', fontVariantNumeric: 'tabular-nums', borderTop: '1px solid var(--home-line, rgba(255,255,255,0.06))' }}>
                                          <span style={{ color: 'var(--home-ink-soft, rgba(255,255,255,0.75))' }}>
                                            Installment #{r.installmentNumber}{r.dueDate ? ` — due ${r.dueDate}` : ''}
                                          </span>
                                          <span style={{ color: 'var(--success-light)', fontWeight: 600 }}>
                                            {r.newToSend <= 0.005 ? 'covered — nothing to send' : `was ${fmt(r.wasToSend)} to send — now ${fmt(r.newToSend)}`}
                                          </span>
                                        </div>
                                      ))
                                    )}
                                    {landing.leftover > 0.005 && creditApplication !== 'keep_separate' && (
                                      <p className={styles.muted} style={{ margin: 0, padding: '0.35rem 0.6rem', fontSize: '0.72rem', borderTop: '1px solid var(--home-line, rgba(255,255,255,0.06))' }}>
                                        {fmt(landing.leftover)} more than the open bills — owed back to this family.
                                      </p>
                                    )}
                                  </div>
                                );
                              })()}
                              {/* Named rather than icon-only: these were a bare tick and cross
                                  with only a title attribute, which reads as nothing on a phone
                                  and nothing to a screen reader. Full width once the row stacks. */}
                              <button
                                className={`${styles.btnPrimary} ${styles.block640} ${styles.compactAction}`}
                                disabled={logSaving}
                                onClick={() => saveLog(player)}
                              >
                                <Check size={14} aria-hidden /> {logSaving ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                className={`${styles.btnGhost} ${styles.block640} ${styles.compactAction}`}
                                onClick={cancelLog}
                              >
                                <X size={14} aria-hidden /> Cancel
                              </button>
                            </div>
                          ) : canWriteMoney ? (
                            <button
                              className={styles.btnGhost}
                              onClick={() => startLog(player.playerId, player.entry)}
                              style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                              disabled={!fundraiser?.isActive}
                              title={!fundraiser?.isActive ? 'Fundraiser is closed' : undefined}
                            >
                              {player.entry ? 'Edit amount' : 'Log amount'}
                            </button>
                          ) : null}
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
        <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) closeSettings(); }}>
          <div className={styles.modal}>
            <CoachModalHeader title="Fundraiser Settings" onClose={closeSettings} titleTag="h2" closeIconSize={18} />
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
                <button type="button" className={styles.btnGhost} onClick={closeSettings}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={editSaving}>
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <UnsavedChangesGuard
        active={showSettings && settingsDirty}
        message="You haven't saved your changes to this fundraiser. Leave without saving them?"
      />
    </div>
  );
}
