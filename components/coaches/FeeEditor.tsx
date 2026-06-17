'use client';

import { useMemo, useState } from 'react';
import { Check, CheckCircle2, CircleDollarSign, Pencil, Plus, Trash2, Wallet, X } from 'lucide-react';
import type { BasicCoachTeamFee } from '@/lib/basic-coach-fees';
import type { BasicCoachTeamPlayer } from '@/lib/basic-coach-roster';
import CoachEmptyState from './CoachEmptyState';
import FeedbackModal from '@/components/FeedbackModal';
import styles from './FeeEditor.module.css';

type Props = {
  basicTeamId: string;
  initialFees: BasicCoachTeamFee[];
  players: BasicCoachTeamPlayer[];
};

type FeeInput = {
  playerId: string | null;
  label: string;
  amount: string;
  notes: string | null;
  /** Add-mode only: create one independent fee for EVERY roster player. */
  applyToAll?: boolean;
};

type Totals = {
  owed: number;
  paid: number;
  unpaid: number;
};

function byLedgerOrder(a: BasicCoachTeamFee, b: BasicCoachTeamFee) {
  if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPaidDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function totalsFor(fees: BasicCoachTeamFee[]): Totals {
  return fees.reduce<Totals>(
    (acc, fee) => {
      acc.owed += fee.amount;
      if (fee.status === 'paid') acc.paid += fee.amount;
      else acc.unpaid += fee.amount;
      return acc;
    },
    { owed: 0, paid: 0, unpaid: 0 },
  );
}

function amountInput(amount: number): string {
  return Number.isFinite(amount) ? amount.toFixed(2) : '';
}

function amountNumber(amount: string): number {
  const n = Number(amount);
  return Number.isFinite(n) ? n : 0;
}

function moneyLooksValid(amount: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(amount.trim()) && amount.trim().length > 0;
}

export default function FeeEditor({ basicTeamId, initialFees, players }: Props) {
  const [fees, setFees] = useState<BasicCoachTeamFee[]>([...initialFees].sort(byLedgerOrder));
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmFee, setConfirmFee] = useState<BasicCoachTeamFee | null>(null);

  const playerMap = useMemo(() => new Map(players.map(player => [player.id, player])), [players]);
  const base = `/api/coaches/teams/${basicTeamId}/fees`;
  const locked = adding || editingId !== null || busy;

  const grouped = useMemo(() => {
    const byPlayer = new Map<string, BasicCoachTeamFee[]>();
    const teamWide: BasicCoachTeamFee[] = [];
    for (const fee of fees) {
      if (fee.playerId && playerMap.has(fee.playerId)) {
        byPlayer.set(fee.playerId, [...(byPlayer.get(fee.playerId) ?? []), fee]);
      } else {
        teamWide.push(fee);
      }
    }
    for (const [id, list] of byPlayer) byPlayer.set(id, list.sort(byLedgerOrder));
    teamWide.sort(byLedgerOrder);
    return { byPlayer, teamWide };
  }, [fees, playerMap]);

  const allTotals = totalsFor(fees);
  const hasPlayers = players.length > 0;
  const hasFees = fees.length > 0;
  // Only players who actually have a fee become ledger rows; the rest collapse
  // into one quiet line so empty $0 rows can't imply a team-wide fee is "split".
  const playersWithFees = useMemo(
    () => players.filter(player => (grouped.byPlayer.get(player.id)?.length ?? 0) > 0),
    [players, grouped],
  );
  const playersWithoutFeesCount = players.length - playersWithFees.length;

  async function addFee(input: FeeInput) {
    if (input.applyToAll) return addFeeForEveryone(input);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.fee) throw new Error(data.error ?? 'Could not add the fee.');
      setFees(prev => [...prev, data.fee as BasicCoachTeamFee].sort(byLedgerOrder));
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the fee.');
    } finally {
      setBusy(false);
    }
  }

  // "Everyone" — bulk-create one independent fee per roster player. The server
  // insert is atomic (all-or-nothing); on success we append every returned fee,
  // so the ledger is never half-populated.
  async function addFeeForEveryone(input: FeeInput) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: input.label, amount: input.amount, notes: input.notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.fees)) throw new Error(data.error ?? 'Could not add the fee to your roster.');
      setFees(prev => [...prev, ...(data.fees as BasicCoachTeamFee[])].sort(byLedgerOrder));
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the fee to your roster.');
    } finally {
      setBusy(false);
    }
  }

  async function saveFee(feeId: string, input: FeeInput) {
    const prev = fees;
    setBusy(true);
    setError(null);
    setEditingId(null);
    setFees(curr => curr.map(fee => (
      fee.id === feeId
        ? {
            ...fee,
            playerId: input.playerId,
            label: input.label,
            amount: amountNumber(input.amount),
            notes: input.notes,
            updatedAt: new Date().toISOString(),
          }
        : fee
    )).sort(byLedgerOrder));
    try {
      const res = await fetch(`${base}/${feeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not update the fee.');
      setFees(curr => curr.map(fee => (fee.id === feeId ? (data.fee as BasicCoachTeamFee) : fee)).sort(byLedgerOrder));
    } catch (e) {
      setFees(prev);
      setEditingId(feeId);
      setError(e instanceof Error ? e.message : 'Could not update the fee.');
    } finally {
      setBusy(false);
    }
  }

  async function togglePaid(fee: BasicCoachTeamFee) {
    const prev = fees;
    const nextStatus = fee.status === 'paid' ? 'unpaid' : 'paid';
    const paidAt = nextStatus === 'paid' ? new Date().toISOString() : null;
    setBusy(true);
    setError(null);
    setFees(curr => curr.map(row => (
      row.id === fee.id ? { ...row, status: nextStatus, markedPaidAt: paidAt, updatedAt: new Date().toISOString() } : row
    )));
    try {
      const res = await fetch(`${base}/${fee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not update the fee status.');
      setFees(curr => curr.map(row => (row.id === fee.id ? (data.fee as BasicCoachTeamFee) : row)).sort(byLedgerOrder));
    } catch (e) {
      setFees(prev);
      setError(e instanceof Error ? e.message : 'Could not update the fee status.');
    } finally {
      setBusy(false);
    }
  }

  async function removeFee(feeId: string) {
    const prev = fees;
    setBusy(true);
    setError(null);
    setFees(curr => curr.filter(fee => fee.id !== feeId));
    try {
      const res = await fetch(`${base}/${feeId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not remove the fee.');
      }
      if (editingId === feeId) setEditingId(null);
    } catch (e) {
      setFees(prev);
      setError(e instanceof Error ? e.message : 'Could not remove the fee.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.editor}>
      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.purposeNote}>
        <Wallet size={18} className={styles.purposeIcon} aria-hidden />
        <div className={styles.purposeText}>
          <p className={styles.purposeLead}>
            <strong>Track what your players owe you</strong> — season fees, dues, a cost you&apos;re
            splitting. Charge everyone at once or one player at a time, and check each off as you collect it.
          </p>
          <p className={styles.purposeAside}>
            Everything here is money owed <em>to you</em> — your private record of what to collect.
            No payments run through FieldLogicHQ, and it&apos;s not where you pay a tournament&apos;s
            entry fee.
          </p>
        </div>
      </div>

      {!hasPlayers && !hasFees ? (
        <CoachEmptyState
          compact
          icon={<CircleDollarSign size={20} aria-hidden />}
          headline="No roster to bill yet"
          description="Add players on the Roster tab to start tracking fees against your roster."
        />
      ) : !hasFees && !adding ? (
        <CoachEmptyState
          icon={<CircleDollarSign size={22} aria-hidden />}
          headline="No fees yet"
          description="Charge your whole roster a season fee, or bill one player. You'll mark each off as you collect it."
          primaryAction={{
            label: 'Add your first fee',
            icon: <Plus size={15} aria-hidden />,
            onClick: () => { setEditingId(null); setAdding(true); },
          }}
        />
      ) : (
        <>
          {hasFees && (
            <div className={styles.summary} aria-label="Fee summary">
              <SummaryStat label="Owed" value={formatMoney(allTotals.owed)} />
              <SummaryStat label="Paid" value={formatMoney(allTotals.paid)} />
              <SummaryStat label="Unpaid" value={formatMoney(allTotals.unpaid)} tone={allTotals.unpaid > 0 ? 'warn' : 'ok'} />
            </div>
          )}

          {adding ? (
            <div className={styles.formRow}>
              <FeeForm
                players={players}
                busy={busy}
                onCancel={() => setAdding(false)}
                onSubmit={addFee}
              />
            </div>
          ) : (
            <button
              type="button"
              className={styles.addBtn}
              onClick={() => { setEditingId(null); setAdding(true); }}
              disabled={editingId !== null || busy}
            >
              <Plus size={15} aria-hidden /> Add fee
            </button>
          )}

          {hasFees && (
            <>
              {hasPlayers && (
              <div className={styles.block}>
                <div className={styles.blockHeader}>
                  <div className={styles.blockTitleWrap}>
                    <h3 className={styles.blockTitle}>Roster fees</h3>
                    {playersWithFees.length > 0 && (
                      <p className={styles.blockSub}>What each player owes you. Charge everyone at once, or one player at a time.</p>
                    )}
                  </div>
                </div>
                {playersWithFees.length > 0 ? (
                  <>
                    <div className={styles.playerList}>
                      {playersWithFees.map(player => {
                        const playerFees = grouped.byPlayer.get(player.id) ?? [];
                        const playerTotals = totalsFor(playerFees);
                        return (
                          <div key={player.id} className={styles.playerGroup}>
                            <div className={styles.playerHeader}>
                              <div className={styles.playerName}>
                                <span>{player.name}</span>
                                {player.jerseyNumber ? <span className={styles.playerMeta}>#{player.jerseyNumber}</span> : null}
                              </div>
                              <div className={styles.playerTotals}>
                                <span>{formatMoney(playerTotals.unpaid)} unpaid</span>
                                <span>{formatMoney(playerTotals.paid)} paid</span>
                              </div>
                            </div>
                            <FeeList
                              fees={playerFees}
                              editingId={editingId}
                              locked={locked}
                              busy={busy}
                              players={players}
                              onEdit={feeId => { setAdding(false); setEditingId(feeId); }}
                              onCancelEdit={() => setEditingId(null)}
                              onSave={saveFee}
                              onTogglePaid={togglePaid}
                              onRequestRemove={setConfirmFee}
                            />
                          </div>
                        );
                      })}
                    </div>
                    {playersWithoutFeesCount > 0 && (
                      <p className={styles.remainderRow}>
                        {playersWithoutFeesCount === 1
                          ? '1 player has no fee yet.'
                          : `${playersWithoutFeesCount} players have no fee yet.`}
                      </p>
                    )}
                  </>
                ) : (
                  <p className={styles.playerFeesEmpty}>
                    No player fees yet — use <strong>Add fee</strong> above to charge your whole roster at once, or bill one player.
                  </p>
                )}
              </div>
              )}

              {grouped.teamWide.length > 0 && (
                <div className={`${styles.block} ${styles.legacyBlock}`}>
                  <div className={styles.blockHeader}>
                    <div className={styles.blockTitleWrap}>
                      <h3 className={styles.legacyTitle}>Other fees</h3>
                      <p className={styles.blockSub}>Older fees that aren&apos;t linked to a player. Mark them paid or remove them — new fees now go to your whole roster or one player.</p>
                    </div>
                    <span className={styles.blockMeta}>{grouped.teamWide.length}</span>
                  </div>
                  <FeeList
                    fees={grouped.teamWide}
                    editingId={editingId}
                    locked={locked}
                    busy={busy}
                    players={players}
                    onEdit={feeId => { setAdding(false); setEditingId(feeId); }}
                    onCancelEdit={() => setEditingId(null)}
                    onSave={saveFee}
                    onTogglePaid={togglePaid}
                    onRequestRemove={setConfirmFee}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      <FeedbackModal
        isOpen={confirmFee !== null}
        onClose={() => setConfirmFee(null)}
        onConfirm={() => { if (confirmFee) removeFee(confirmFee.id); }}
        title="Remove this fee?"
        message={confirmFee
          ? `"${confirmFee.label}" (${formatMoney(confirmFee.amount)}) will be removed from your ledger. This can't be undone.`
          : ''}
        confirmText="Remove fee"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className={styles.summaryItem} data-tone={tone ?? 'neutral'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FeeList({
  fees,
  editingId,
  locked,
  busy,
  players,
  onEdit,
  onCancelEdit,
  onSave,
  onTogglePaid,
  onRequestRemove,
}: {
  fees: BasicCoachTeamFee[];
  editingId: string | null;
  locked: boolean;
  busy: boolean;
  players: BasicCoachTeamPlayer[];
  onEdit: (feeId: string) => void;
  onCancelEdit: () => void;
  onSave: (feeId: string, input: FeeInput) => void;
  onTogglePaid: (fee: BasicCoachTeamFee) => void;
  onRequestRemove: (fee: BasicCoachTeamFee) => void;
}) {
  return (
    <ul className={styles.list}>
      {fees.map(fee => (
        <li key={fee.id} className={editingId === fee.id ? styles.formRow : styles.row}>
          {editingId === fee.id ? (
            <FeeForm
              fee={fee}
              players={players}
              busy={busy}
              onCancel={onCancelEdit}
              onSubmit={input => onSave(fee.id, input)}
            />
          ) : (
            <>
              <div className={styles.rowMain}>
                <span className={styles.name}>{fee.label}</span>
                <span className={styles.meta}>
                  {formatMoney(fee.amount)}
                  {fee.notes ? ` · ${fee.notes}` : ''}
                </span>
              </div>
              {fee.status === 'paid' ? (
                <div className={styles.paidState}>
                  <span className={styles.paidPill}>
                    <CheckCircle2 size={13} aria-hidden /> Paid
                    {formatPaidDate(fee.markedPaidAt) ? ` · ${formatPaidDate(fee.markedPaidAt)}` : ''}
                  </span>
                  <button
                    type="button"
                    className={styles.undoBtn}
                    onClick={() => onTogglePaid(fee)}
                    disabled={locked}
                    aria-label={`Mark ${fee.label} unpaid`}
                  >
                    Undo
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.markPaidBtn}
                  onClick={() => onTogglePaid(fee)}
                  disabled={locked}
                  aria-label={`Mark ${fee.label} paid`}
                >
                  <Check size={14} aria-hidden /> Mark paid
                </button>
              )}
              <div className={styles.rowActions}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => onEdit(fee.id)}
                  disabled={locked}
                  aria-label={`Edit ${fee.label}`}
                >
                  <Pencil size={15} aria-hidden />
                </button>
                <button
                  type="button"
                  className={styles.iconBtnDanger}
                  onClick={() => onRequestRemove(fee)}
                  disabled={locked}
                  aria-label={`Remove ${fee.label}`}
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function FeeForm({
  fee,
  players,
  busy,
  onSubmit,
  onCancel,
}: {
  fee?: BasicCoachTeamFee;
  players: BasicCoachTeamPlayer[];
  busy: boolean;
  onSubmit: (input: FeeInput) => void;
  onCancel: () => void;
}) {
  const isEdit = !!fee;
  const [scope, setScope] = useState<'all' | 'one'>(isEdit ? 'one' : 'all');
  const [playerId, setPlayerId] = useState(fee?.playerId ?? '');
  const [label, setLabel] = useState(fee?.label ?? '');
  const [amount, setAmount] = useState(fee ? amountInput(fee.amount) : '');
  const [notes, setNotes] = useState(fee?.notes ?? '');
  const [showNotes, setShowNotes] = useState(!!fee?.notes);

  const amountValid = moneyLooksValid(amount);
  const needsPlayer = !isEdit && scope === 'one';
  const canSave =
    label.trim().length > 0 && amountValid && (!needsPlayer || playerId.length > 0) && !busy;

  const playerCount = players.length;
  const amountNum = amountValid ? amountNumber(amount) : 0;
  const everyoneActive = !isEdit && scope === 'all';

  function submit() {
    if (!canSave) return;
    onSubmit({
      playerId: everyoneActive ? null : (playerId || (isEdit ? (fee?.playerId ?? null) : null)),
      label: label.trim(),
      amount: amount.trim(),
      notes: notes.trim() || null,
      applyToAll: everyoneActive || undefined,
    });
  }

  return (
    <div className={styles.form}>
      {!isEdit && (
        <>
          <span className={styles.fieldLabel}>Who owes this?</span>
          <div className={styles.segmented} role="group" aria-label="Who owes this fee">
            <button
              type="button"
              className={styles.segmentBtn}
              data-active={scope === 'all'}
              onClick={() => setScope('all')}
            >
              Everyone
            </button>
            <button
              type="button"
              className={styles.segmentBtn}
              data-active={scope === 'one'}
              onClick={() => setScope('one')}
            >
              One player
            </button>
          </div>
          {scope === 'one' && (
            <select
              className={styles.input}
              value={playerId}
              onChange={e => setPlayerId(e.target.value)}
              aria-label="Player who owes this fee"
            >
              <option value="">Choose a player…</option>
              {players.map(player => (
                <option key={player.id} value={player.id}>
                  {player.jerseyNumber ? `#${player.jerseyNumber} ` : ''}{player.name}
                </option>
              ))}
            </select>
          )}
          <p className={styles.assignNote}>
            {scope === 'all'
              ? amountValid
                ? `Adds a ${formatMoney(amountNum)} fee to ${playerCount === 1 ? 'your 1 player' : `all ${playerCount} players`}${playerCount > 1 ? ` — ${formatMoney(amountNum * playerCount)} total` : ''}.`
                : `Adds this fee to ${playerCount === 1 ? 'your 1 player' : `every player on your roster (${playerCount})`} — each pays their own.`
              : playerId
                ? 'Only this player owes it.'
                : 'Pick the player who owes this.'}
          </p>
        </>
      )}

      <div className={styles.formTopRow}>
        <input
          className={styles.nameInput}
          placeholder="Fee label"
          maxLength={120}
          autoFocus
          value={label}
          onChange={e => setLabel(e.target.value)}
          aria-label="Fee label"
        />
        <input
          className={styles.amountInput}
          inputMode="decimal"
          placeholder="0.00"
          maxLength={11}
          value={amount}
          onChange={e => setAmount(e.target.value)}
          aria-label="Amount"
        />
      </div>

      {showNotes ? (
        <textarea
          className={styles.textarea}
          placeholder="Note (optional)"
          maxLength={500}
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          aria-label="Note"
        />
      ) : (
        <button type="button" className={styles.panelToggle} onClick={() => setShowNotes(true)}>
          <Plus size={13} aria-hidden /> Add note (optional)
        </button>
      )}

      <div className={styles.formActions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={busy}>
          <X size={14} aria-hidden /> Cancel
        </button>
        <button type="button" className={styles.saveBtn} onClick={submit} disabled={!canSave}>
          <Check size={14} aria-hidden /> {busy
            ? 'Saving...'
            : isEdit
              ? 'Save'
              : everyoneActive && playerCount > 1
                ? `Add fee for ${playerCount} players`
                : 'Add fee'}
        </button>
      </div>
    </div>
  );
}
