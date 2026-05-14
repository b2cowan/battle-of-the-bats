'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Users, X, CheckCircle2, AlertTriangle, ChevronRight, Plus, Trash2, ChevronDown } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import HelpTooltip from '@/components/help/HelpTooltip';
import styles from '../../../../coaches.module.css';
import type {
  RepRosterPlayer,
  RepPlayerDuesSchedule,
  RepPlayerDuesInstallment,
  DuesCredit,
  DuesCreditType,
  SeasonRefundRow,
} from '@/lib/types';

interface PlayerWithDues {
  player: RepRosterPlayer;
  schedule: RepPlayerDuesSchedule | null;
  installments: RepPlayerDuesInstallment[];
  paidAmount: number;
  outstanding: number;
  credits: DuesCredit[];
  totalCredits: number;
  rollingBalance: number;
}

interface SeasonSurplusData {
  surplus: { id: string; totalSurplus: number; notes: string | null } | null;
  breakdown: SeasonRefundRow[];
  totalAllCredits: number;
  evenPool: number;
  playerCount: number;
}

function fmt(n: number) {
  const abs = Math.abs(n);
  const str = abs.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-$${str}` : `$${str}`;
}

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dueDate: string, paidAt: string | null) {
  if (paidAt) return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

function balanceColor(b: number): string {
  if (b < -0.005) return '#4ade80'; // in credit (good)
  if (b > 0.005)  return '#f59e0b'; // still owes
  return '#4ade80';                 // fully clear
}

function statusLabel(p: PlayerWithDues) {
  if (!p.schedule) return { label: 'Not set', color: 'rgba(255,255,255,0.3)' };
  if (p.rollingBalance < -0.005) return { label: 'In credit', color: '#4ade80' };
  if (p.rollingBalance <= 0.005) return { label: 'Fully paid', color: '#4ade80' };
  if (p.paidAmount > 0 || p.totalCredits > 0) return { label: 'Partial', color: '#f59e0b' };
  return { label: 'Unpaid', color: 'rgba(255,255,255,0.4)' };
}

const CREDIT_TYPE_LABELS: Record<DuesCreditType, string> = {
  contribution: 'Contribution',
  fundraiser:   'Fundraiser',
  overpayment:  'Overpayment',
  other:        'Other',
};

interface InstallmentRow {
  installmentNumber: number;
  amount: string;
  dueDate: string;
}

const BLANK_SCHEDULE_FORM = { totalAmount: '', notes: '' };

const BLANK_CREDIT_FORM = {
  amount:     '',
  description:'',
  creditType: 'contribution' as DuesCreditType,
  creditDate: new Date().toISOString().slice(0, 10),
  notes:      '',
};

export default function CoachesDuesPage({
  params,
}: {
  params: { orgSlug: string; teamId: string };
}) {
  const { orgSlug, teamId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();

  const [players, setPlayers] = useState<PlayerWithDues[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<PlayerWithDues | null>(null);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [form, setForm] = useState(BLANK_SCHEDULE_FORM);
  const [installmentRows, setInstallmentRows] = useState<InstallmentRow[]>([
    { installmentNumber: 1, amount: '', dueDate: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [marking, setMarking] = useState<Record<string, boolean>>({});

  // Credits
  const [addingCredit, setAddingCredit] = useState(false);
  const [creditForm, setCreditForm] = useState(BLANK_CREDIT_FORM);
  const [creditSaving, setCreditSaving] = useState(false);
  const [creditError, setCreditError] = useState('');
  const [deletingCreditId, setDeletingCreditId] = useState<string | null>(null);

  // Apply to all
  const [applyAllOpen, setApplyAllOpen] = useState(false);
  const [allForm, setAllForm] = useState(BLANK_SCHEDULE_FORM);
  const [allInstallmentRows, setAllInstallmentRows] = useState<InstallmentRow[]>([
    { installmentNumber: 1, amount: '', dueDate: '' },
  ]);
  const [applyAllSaving, setApplyAllSaving] = useState(false);
  const [applyAllError, setApplyAllError] = useState('');

  // Reminders
  const [sendingReminders, setSendingReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ emailsSent: number; installmentsTagged: number } | null>(null);
  const [reminderError, setReminderError] = useState('');

  // Season refund
  const [refundOpen, setRefundOpen] = useState(false);
  const [surplusData, setSurplusData] = useState<SeasonSurplusData | null>(null);
  const [surplusLoading, setSurplusLoading] = useState(false);
  const [surplusInput, setSurplusInput] = useState('');
  const [surplusNotes, setSurplusNotes] = useState('');
  const [surplusSaving, setSurplusSaving] = useState(false);
  const [surplusError, setSurplusError] = useState('');

  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/dues`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      setPlayers(data.players ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load player dues.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => { load(); }, [load]);

  // Keep selected player data fresh after reload
  useEffect(() => {
    if (!selected) return;
    const updated = players.find(p => p.player.id === selected.player.id);
    if (updated) setSelected(updated);
  }, [players]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSurplus() {
    setSurplusLoading(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/season-surplus`);
      const data = await res.json();
      setSurplusData(data);
      setSurplusInput(data.surplus ? String(data.surplus.totalSurplus) : '');
      setSurplusNotes(data.surplus?.notes ?? '');
    } finally {
      setSurplusLoading(false);
    }
  }

  function openEdit(p: PlayerWithDues) {
    setSelected(p);
    setForm({
      totalAmount: p.schedule ? String(p.schedule.totalAmount) : '',
      notes: p.schedule?.notes ?? '',
    });
    setInstallmentRows(
      p.installments.length
        ? p.installments.map(i => ({
            installmentNumber: i.installmentNumber,
            amount: String(i.amount),
            dueDate: i.dueDate,
          }))
        : [{ installmentNumber: 1, amount: '', dueDate: '' }],
    );
    setEditingSchedule(true);
    setSaveError('');
  }

  async function saveSchedule(playerId: string) {
    setSaveError('');
    setSaving(true);
    try {
      const totalAmount = parseFloat(form.totalAmount);
      if (isNaN(totalAmount) || totalAmount <= 0) throw new Error('Enter a valid total amount');
      const installments = installmentRows.map((r, idx) => ({
        installmentNumber: r.installmentNumber ?? idx + 1,
        amount: parseFloat(r.amount),
        dueDate: r.dueDate,
      }));
      if (installments.some(i => isNaN(i.amount) || !i.dueDate)) {
        throw new Error('All installments need a valid amount and due date');
      }
      const instSum = installments.reduce((s, i) => s + i.amount, 0);
      if (Math.abs(instSum - totalAmount) > 0.01) {
        throw new Error(`Installments sum (${fmt(instSum)}) must equal total (${fmt(totalAmount)})`);
      }
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/dues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, totalAmount, notes: form.notes || null, installments }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setEditingSchedule(false);
      await load();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(p: PlayerWithDues, inst: RepPlayerDuesInstallment) {
    if (!p.schedule) return;
    setMarking(prev => ({ ...prev, [inst.id]: true }));
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/dues/${p.schedule.id}/installments/${inst.id}`,
        { method: 'PATCH' },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed');
      await load();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setMarking(prev => ({ ...prev, [inst.id]: false }));
    }
  }

  async function saveCredit() {
    if (!selected) return;
    setCreditError('');
    setCreditSaving(true);
    try {
      const amount = parseFloat(creditForm.amount);
      if (isNaN(amount) || amount <= 0) throw new Error('Enter a valid credit amount');
      if (!creditForm.description.trim()) throw new Error('Description is required');
      if (!creditForm.creditDate) throw new Error('Date is required');
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/players/${selected.player.id}/dues-credits`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            description: creditForm.description.trim(),
            creditType:  creditForm.creditType,
            creditDate:  creditForm.creditDate,
            notes:       creditForm.notes.trim() || null,
          }),
        },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to save credit');
      setAddingCredit(false);
      setCreditForm(BLANK_CREDIT_FORM);
      await load();
    } catch (e: unknown) {
      setCreditError(e instanceof Error ? e.message : 'Failed to save credit');
    } finally {
      setCreditSaving(false);
    }
  }

  async function deleteCredit(creditId: string) {
    if (!selected) return;
    setDeletingCreditId(creditId);
    try {
      await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/players/${selected.player.id}/dues-credits/${creditId}`,
        { method: 'DELETE' },
      );
      await load();
    } finally {
      setDeletingCreditId(null);
    }
  }

  async function saveSurplus() {
    setSurplusError('');
    setSurplusSaving(true);
    try {
      const totalSurplus = parseFloat(surplusInput);
      if (isNaN(totalSurplus) || totalSurplus < 0) throw new Error('Enter a valid surplus amount (0 or more)');
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/season-surplus`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalSurplus, notes: surplusNotes.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      const data = await res.json();
      setSurplusData(data);
    } catch (e: unknown) {
      setSurplusError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSurplusSaving(false);
    }
  }

  async function applyToAll() {
    setApplyAllError('');
    setApplyAllSaving(true);
    try {
      const totalAmount = parseFloat(allForm.totalAmount);
      if (isNaN(totalAmount) || totalAmount <= 0) throw new Error('Enter a valid total amount');
      const installments = allInstallmentRows.map((r, idx) => ({
        installmentNumber: r.installmentNumber ?? idx + 1,
        amount: parseFloat(r.amount),
        dueDate: r.dueDate,
      }));
      if (installments.some(i => isNaN(i.amount) || !i.dueDate)) {
        throw new Error('All installments need a valid amount and due date');
      }
      const instSum = installments.reduce((s, i) => s + i.amount, 0);
      if (Math.abs(instSum - totalAmount) > 0.01) {
        throw new Error(`Installments sum (${fmt(instSum)}) must equal total (${fmt(totalAmount)})`);
      }
      for (const p of players) {
        await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/dues`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: p.player.id, totalAmount, notes: allForm.notes || null, installments }),
        });
      }
      setApplyAllOpen(false);
      await load();
    } catch (e: unknown) {
      setApplyAllError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setApplyAllSaving(false);
    }
  }

  async function sendReminders() {
    setSendingReminders(true);
    setReminderError('');
    setReminderResult(null);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/dues/send-reminders`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send reminders');
      setReminderResult({ emailsSent: data.emailsSent, installmentsTagged: data.installmentsTagged });
    } catch (e: unknown) {
      setReminderError(e instanceof Error ? e.message : 'Failed to send reminders.');
    } finally {
      setSendingReminders(false);
    }
  }

  function addInstallmentRow(rows: InstallmentRow[], setRows: (r: InstallmentRow[]) => void) {
    setRows([...rows, { installmentNumber: rows.length + 1, amount: '', dueDate: '' }]);
  }

  function removeInstallmentRow(idx: number, rows: InstallmentRow[], setRows: (r: InstallmentRow[]) => void) {
    setRows(rows.filter((_, i) => i !== idx).map((r, i) => ({ ...r, installmentNumber: i + 1 })));
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
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Users size={22} /></div>
          <div>
            <nav className={styles.breadcrumb}>
              <Link href={`/${orgSlug}/coaches`}>Portal</Link>
              <span>/</span>
              <Link href={base}>{assignment.teamName}</Link>
              <span>/</span>
              <Link href={`${base}/accounting`}>Accounting</Link>
              <span>/</span>
              <span>Player Dues</span>
            </nav>
            <h1 className={styles.pageTitle}>Player Dues</h1>
            <p className={styles.pageSub}>{assignment.programYearName}</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={styles.btnSecondary} onClick={() => { setApplyAllOpen(true); setApplyAllError(''); }}>
              Set dues for all players
            </button>
            <button
              className={styles.btnSecondary}
              onClick={sendReminders}
              disabled={sendingReminders}
              style={{ opacity: sendingReminders ? 0.6 : 1 }}
            >
              {sendingReminders ? 'Sending…' : 'Send Due Reminders'}
            </button>
          </div>
          {reminderResult && reminderResult.emailsSent > 0 && (
            <span style={{ fontSize: '0.8rem', color: '#4ade80' }}>
              Sent {reminderResult.emailsSent} reminder email{reminderResult.emailsSent !== 1 ? 's' : ''} covering {reminderResult.installmentsTagged} installment{reminderResult.installmentsTagged !== 1 ? 's' : ''}.
            </span>
          )}
          {reminderResult && reminderResult.emailsSent === 0 && (
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
              No reminders needed — no installments due within 3 days.
            </span>
          )}
          {reminderError && <span style={{ fontSize: '0.8rem', color: '#f87171' }}>{reminderError}</span>}
        </div>
      </div>

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : !players.length ? (
        <div className={styles.emptyState}>No active roster players found.</div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Player</th>
                  <th className={styles.th}>Total Dues</th>
                  <th className={styles.th}>Credits</th>
                  <th className={styles.th}>Paid</th>
                  <th className={styles.th}>Balance</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {players.map(p => {
                  const { label, color } = statusLabel(p);
                  return (
                    <tr
                      key={p.player.id}
                      className={styles.tr}
                      style={{ cursor: 'pointer' }}
                      onClick={() => { setSelected(p); setEditingSchedule(false); setAddingCredit(false); setSaveError(''); }}
                    >
                      <td className={styles.td}>
                        {p.player.playerFirstName} {p.player.playerLastName}
                      </td>
                      <td className={styles.td} style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {p.schedule ? fmt(p.schedule.totalAmount) : '—'}
                      </td>
                      <td className={styles.td} style={{ color: p.totalCredits > 0 ? '#4ade80' : 'rgba(255,255,255,0.3)', fontVariantNumeric: 'tabular-nums' }}>
                        {p.totalCredits > 0 ? `-${fmt(p.totalCredits)}` : '—'}
                      </td>
                      <td className={styles.td} style={{ color: '#4ade80', fontVariantNumeric: 'tabular-nums' }}>
                        {p.schedule ? fmt(p.paidAmount) : '—'}
                      </td>
                      <td className={styles.td} style={{ color: balanceColor(p.rollingBalance), fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {p.schedule ? fmt(p.rollingBalance) : '—'}
                      </td>
                      <td className={styles.td}>
                        <span style={{ color, fontSize: '0.82rem', fontWeight: 500 }}>{label}</span>
                      </td>
                      <td className={styles.td}>
                        <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Season Refund Calculator */}
          <div style={{
            marginTop: '2rem',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}>
            <button
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '0.85rem 1.25rem', background: 'rgba(255,255,255,0.03)',
                border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)',
              }}
              onClick={() => {
                const next = !refundOpen;
                setRefundOpen(next);
                if (next && !surplusData) loadSurplus();
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Season Refund Calculator</span>
              {refundOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {refundOpen && (
              <div style={{ padding: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.5)', margin: '0 0 1rem' }}>
                  Enter the total remaining team funds at season end. Each player&apos;s individual credits come off the top, then the remainder is divided evenly.
                </p>

                {surplusLoading ? (
                  <p className={styles.muted}>Loading…</p>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <label className={styles.label}>Total Remaining Funds</label>
                        <input
                          className={styles.input}
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="e.g. 10500"
                          value={surplusInput}
                          onChange={e => setSurplusInput(e.target.value)}
                          style={{ width: '160px' }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <label className={styles.label}>Notes <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.3)' }}>(optional)</span></label>
                        <input
                          className={styles.input}
                          placeholder="e.g. End of 2025 season"
                          value={surplusNotes}
                          onChange={e => setSurplusNotes(e.target.value)}
                        />
                      </div>
                      <button
                        className={styles.btnPrimary}
                        disabled={surplusSaving}
                        onClick={saveSurplus}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {surplusSaving ? 'Saving…' : 'Calculate'}
                      </button>
                    </div>
                    {surplusError && <p className={styles.errorText}>{surplusError}</p>}

                    {surplusData && surplusData.surplus && surplusData.breakdown.length > 0 && (
                      <>
                        <div style={{
                          display: 'flex', gap: '1.5rem', flexWrap: 'wrap',
                          padding: '0.75rem 1rem', borderRadius: 8,
                          background: 'rgba(74,222,128,0.05)',
                          border: '1px solid rgba(74,222,128,0.15)',
                          marginBottom: '1rem', fontSize: '0.82rem',
                        }}>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                            Total: <strong style={{ color: '#f0f0f0' }}>{fmt(surplusData.surplus.totalSurplus)}</strong>
                          </span>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                            Individual credits: <strong style={{ color: '#4ade80' }}>-{fmt(surplusData.totalAllCredits)}</strong>
                          </span>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                            Even pool: <strong style={{ color: '#f0f0f0' }}>{fmt(surplusData.evenPool)}</strong>
                          </span>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                            Per player (base): <strong style={{ color: '#f0f0f0' }}>
                              {fmt(surplusData.evenPool / (surplusData.playerCount || 1))}
                            </strong>
                          </span>
                        </div>

                        <div className={styles.tableWrap}>
                          <table className={styles.table}>
                            <thead>
                              <tr>
                                <th className={styles.th}>Player</th>
                                <th className={styles.th}>Rolling Balance</th>
                                <th className={styles.th}>Credit Portion</th>
                                <th className={styles.th}>Even Share</th>
                                <th className={styles.th}>Total Refund</th>
                              </tr>
                            </thead>
                            <tbody>
                              {surplusData.breakdown.map(row => (
                                <tr key={row.playerId} className={styles.tr}>
                                  <td className={styles.td}>{row.playerFirstName} {row.playerLastName}</td>
                                  <td className={styles.td} style={{ color: balanceColor(row.rollingBalance), fontVariantNumeric: 'tabular-nums' }}>
                                    {fmt(row.rollingBalance)}
                                  </td>
                                  <td className={styles.td} style={{ color: row.creditPortion > 0 ? '#4ade80' : 'rgba(255,255,255,0.3)', fontVariantNumeric: 'tabular-nums' }}>
                                    {row.creditPortion > 0 ? fmt(row.creditPortion) : '—'}
                                  </td>
                                  <td className={styles.td} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(row.evenShare)}</td>
                                  <td className={styles.td} style={{ color: '#4ade80', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                    {fmt(row.totalRefund)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Player slide-over */}
      {selected && (
        <div className={styles.modalOverlay} onClick={() => { setSelected(null); setEditingSchedule(false); setAddingCredit(false); }}>
          <div className={styles.slideOver} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
                {selected.player.playerFirstName} {selected.player.playerLastName}
              </span>
              <button className={styles.modalCloseBtn} onClick={() => { setSelected(null); setEditingSchedule(false); setAddingCredit(false); }}>
                <X size={18} />
              </button>
            </div>

            {!editingSchedule ? (
              <>
                {selected.schedule ? (
                  <>
                    {/* Rolling balance summary */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem',
                      padding: '0.85rem 1rem', marginBottom: '1rem',
                      background: 'rgba(255,255,255,0.03)', borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      {[
                        { label: 'Total Dues', value: fmt(selected.schedule.totalAmount), color: undefined },
                        { label: 'Credits', value: selected.totalCredits > 0 ? `-${fmt(selected.totalCredits)}` : '—', color: selected.totalCredits > 0 ? '#4ade80' : undefined },
                        { label: 'Paid', value: fmt(selected.paidAmount), color: '#4ade80' },
                        { label: 'Balance', value: fmt(selected.rollingBalance), color: balanceColor(selected.rollingBalance) },
                      ].map(stat => (
                        <div key={stat.label}>
                          <span style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.35)', marginBottom: '0.15rem' }}>
                            {stat.label}
                          </span>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: stat.color ?? 'rgba(255,255,255,0.85)', fontVariantNumeric: 'tabular-nums' }}>
                            {stat.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {selected.rollingBalance < -0.005 && (
                      <div style={{
                        padding: '0.6rem 0.85rem', marginBottom: '1rem', borderRadius: 7,
                        background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
                        fontSize: '0.82rem', color: '#4ade80',
                      }}>
                        This player is in credit — their balance is {fmt(Math.abs(selected.rollingBalance))} in their favour.
                      </div>
                    )}

                    {/* Edit schedule link */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                      <button className={styles.btnGhost} onClick={() => openEdit(selected)} style={{ fontSize: '0.78rem' }}>
                        Edit schedule
                      </button>
                    </div>

                    {/* Installments */}
                    {selected.installments.length > 0 && (
                      <div className={styles.tableWrap} style={{ marginBottom: '1.25rem' }}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th className={styles.th}>#</th>
                              <th className={styles.th}>Amount</th>
                              <th className={styles.th}>Due</th>
                              <th className={styles.th}>Status</th>
                              <th className={styles.th}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {selected.installments.map(inst => {
                              const overdue = isOverdue(inst.dueDate, inst.paidAt);
                              return (
                                <tr key={inst.id} className={styles.tr}>
                                  <td className={styles.td} style={{ color: 'rgba(255,255,255,0.4)' }}>{inst.installmentNumber}</td>
                                  <td className={styles.td} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(inst.amount)}</td>
                                  <td className={styles.td} style={{ color: overdue ? '#f87171' : 'rgba(255,255,255,0.65)' }}>
                                    {fmtDate(inst.dueDate)}
                                    {overdue && <AlertTriangle size={11} style={{ marginLeft: 4, verticalAlign: 'middle', color: '#f87171' }} />}
                                  </td>
                                  <td className={styles.td}>
                                    {inst.paidAt ? (
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#4ade80' }}>
                                        <CheckCircle2 size={12} /> Paid {fmtDate(inst.paidAt)}
                                      </span>
                                    ) : (
                                      <span className={`${styles.badge} ${overdue ? styles.badgeCompleted : styles.badgeDraft}`} style={{ fontSize: '0.75rem' }}>
                                        {overdue ? 'Overdue' : 'Unpaid'}
                                      </span>
                                    )}
                                  </td>
                                  <td className={styles.td}>
                                    {!inst.paidAt && (
                                      <button
                                        className={styles.btnSecondary}
                                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
                                        disabled={!!marking[inst.id]}
                                        onClick={() => markPaid(selected, inst)}
                                      >
                                        {marking[inst.id] ? '…' : 'Mark Paid'}
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

                    {/* Credits section */}
                    <div style={{
                      borderTop: '1px solid rgba(255,255,255,0.07)',
                      paddingTop: '1rem',
                      marginTop: selected.installments.length > 0 ? 0 : '0.5rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)' }}>
                          Credits
                        </span>
                        {!addingCredit && (
                          <button
                            className={styles.btnGhost}
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            onClick={() => { setAddingCredit(true); setCreditForm(BLANK_CREDIT_FORM); setCreditError(''); }}
                          >
                            <Plus size={12} /> Add Credit
                          </button>
                        )}
                      </div>

                      {/* Add credit form */}
                      {addingCredit && (
                        <div style={{
                          padding: '0.85rem', marginBottom: '0.85rem',
                          background: 'rgba(255,255,255,0.03)', borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
                            <div>
                              <label className={styles.label}>Amount *</label>
                              <input
                                className={styles.input}
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder="e.g. 300"
                                value={creditForm.amount}
                                onChange={e => setCreditForm(f => ({ ...f, amount: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className={styles.label}>Date *</label>
                              <input
                                className={styles.input}
                                type="date"
                                value={creditForm.creditDate}
                                onChange={e => setCreditForm(f => ({ ...f, creditDate: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div style={{ marginBottom: '0.6rem' }}>
                            <label className={styles.label}>Description *</label>
                            <input
                              className={styles.input}
                              placeholder="e.g. Player bat contribution"
                              value={creditForm.description}
                              onChange={e => setCreditForm(f => ({ ...f, description: e.target.value }))}
                            />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
                            <div>
                              <label className={styles.label}>Type</label>
                              <select
                                className={styles.input}
                                value={creditForm.creditType}
                                onChange={e => setCreditForm(f => ({ ...f, creditType: e.target.value as DuesCreditType }))}
                              >
                                {(Object.entries(CREDIT_TYPE_LABELS) as [DuesCreditType, string][]).map(([v, l]) => (
                                  <option key={v} value={v}>{l}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className={styles.label}>Notes <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.3)' }}>(optional)</span></label>
                              <input
                                className={styles.input}
                                placeholder="Optional notes"
                                value={creditForm.notes}
                                onChange={e => setCreditForm(f => ({ ...f, notes: e.target.value }))}
                              />
                            </div>
                          </div>
                          {creditError && <p className={styles.errorText}>{creditError}</p>}
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button className={styles.btnGhost} onClick={() => { setAddingCredit(false); setCreditError(''); }} style={{ fontSize: '0.8rem' }}>Cancel</button>
                            <button className={styles.btnPrimary} disabled={creditSaving} onClick={saveCredit} style={{ fontSize: '0.8rem' }}>
                              {creditSaving ? 'Saving…' : 'Save Credit'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Credits list */}
                      {selected.credits.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          {selected.credits.map(c => (
                            <div key={c.id} style={{
                              display: 'flex', alignItems: 'center', gap: '0.6rem',
                              padding: '0.5rem 0.65rem', borderRadius: 7,
                              background: 'rgba(74,222,128,0.05)',
                              border: '1px solid rgba(74,222,128,0.12)',
                              fontSize: '0.83rem',
                            }}>
                              <span style={{ color: '#4ade80', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                -{fmt(c.amount as number)}
                              </span>
                              <span style={{ flex: 1, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.description}
                              </span>
                              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', flexShrink: 0 }}>
                                {CREDIT_TYPE_LABELS[c.creditType]} · {fmtDate(c.creditDate as string)}
                              </span>
                              <button
                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '0.15rem', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                                disabled={deletingCreditId === c.id}
                                onClick={() => deleteCredit(c.id)}
                                title="Remove credit"
                              >
                                {deletingCreditId === c.id ? '…' : <Trash2 size={13} />}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        !addingCredit && (
                          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                            No credits applied to this player.
                          </p>
                        )
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                    <p className={styles.muted} style={{ marginBottom: '1rem' }}>No dues schedule set for this player.</p>
                    <button className={styles.btnPrimary} onClick={() => openEdit(selected)}>
                      Set dues schedule
                    </button>
                  </div>
                )}
                {saveError && <p className={styles.errorText} style={{ marginTop: '0.5rem' }}>{saveError}</p>}
              </>
            ) : (
              <ScheduleForm
                form={form}
                setForm={setForm}
                installmentRows={installmentRows}
                setInstallmentRows={setInstallmentRows}
                saveError={saveError}
                saving={saving}
                onSave={() => saveSchedule(selected.player.id)}
                onCancel={() => { setEditingSchedule(false); setSaveError(''); }}
                addRow={() => addInstallmentRow(installmentRows, setInstallmentRows)}
                removeRow={(idx) => removeInstallmentRow(idx, installmentRows, setInstallmentRows)}
              />
            )}
          </div>
        </div>
      )}

      {/* Apply to all modal */}
      {applyAllOpen && (
        <div className={styles.modalOverlay} onClick={() => setApplyAllOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Set dues for all players</h3>
              <button className={styles.modalCloseBtn} onClick={() => setApplyAllOpen(false)}><X size={16} /></button>
            </div>
            <p className={styles.muted} style={{ fontSize: '0.82rem', marginBottom: '1rem' }}>
              This will create or replace the dues schedule for every active roster player ({players.length} players).
            </p>
            <ScheduleForm
              form={allForm}
              setForm={setAllForm}
              installmentRows={allInstallmentRows}
              setInstallmentRows={setAllInstallmentRows}
              saveError={applyAllError}
              saving={applyAllSaving}
              onSave={applyToAll}
              onCancel={() => { setApplyAllOpen(false); setApplyAllError(''); }}
              addRow={() => addInstallmentRow(allInstallmentRows, setAllInstallmentRows)}
              removeRow={(idx) => removeInstallmentRow(idx, allInstallmentRows, setAllInstallmentRows)}
              saveLabel={`Apply to all ${players.length} players`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared schedule form ──────────────────────────────────────────────────────

interface ScheduleFormProps {
  form: { totalAmount: string; notes: string };
  setForm: (f: { totalAmount: string; notes: string }) => void;
  installmentRows: { installmentNumber: number; amount: string; dueDate: string }[];
  setInstallmentRows: (r: { installmentNumber: number; amount: string; dueDate: string }[]) => void;
  saveError: string;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  addRow: () => void;
  removeRow: (idx: number) => void;
  saveLabel?: string;
}

function ScheduleForm({
  form, setForm, installmentRows, setInstallmentRows,
  saveError, saving, onSave, onCancel, addRow, removeRow,
  saveLabel = 'Save schedule',
}: ScheduleFormProps) {
  return (
    <div>
      <div className={styles.formGrid} style={{ marginBottom: '1rem' }}>
        <div className={`${styles.field} ${styles.formGridFull}`}>
          <label className={styles.label}>Total amount *</label>
          <input
            className={styles.input}
            type="number"
            min={0}
            step="0.01"
            value={form.totalAmount}
            onChange={e => setForm({ ...form, totalAmount: e.target.value })}
            placeholder="e.g. 1200"
          />
        </div>
        <div className={`${styles.field} ${styles.formGridFull}`}>
          <label className={styles.label}>Notes</label>
          <input className={styles.input} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
        </div>
      </div>

      <p className={styles.label} style={{ marginBottom: '0.5rem' }}>
        Installments
        <HelpTooltip
          title="What is an installment?"
          body="An installment is one payment in a dues schedule. For example, a $500 annual due might be split into 5 monthly installments of $100 each."
        />
      </p>
      {installmentRows.map((row, idx) => (
        <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', width: '1.5rem', textAlign: 'right', flexShrink: 0 }}>#{row.installmentNumber}</span>
          <input
            className={styles.input}
            type="number"
            min={0}
            step="0.01"
            placeholder="Amount"
            style={{ width: '7rem' }}
            value={row.amount}
            onChange={e => {
              const updated = installmentRows.map((r, i) => i === idx ? { ...r, amount: e.target.value } : r);
              setInstallmentRows(updated);
            }}
          />
          <input
            className={styles.input}
            type="date"
            style={{ flex: 1 }}
            value={row.dueDate}
            onChange={e => {
              const updated = installmentRows.map((r, i) => i === idx ? { ...r, dueDate: e.target.value } : r);
              setInstallmentRows(updated);
            }}
          />
          {installmentRows.length > 1 && (
            <button className={styles.btnGhost} onClick={() => removeRow(idx)} style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}>×</button>
          )}
        </div>
      ))}
      <button className={styles.btnGhost} onClick={addRow} style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
        + Add installment
      </button>

      {saveError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{saveError}</p>}

      <div className={styles.modalFooter}>
        <button className={styles.btnGhost} onClick={onCancel}>Cancel</button>
        <button className={styles.btnPrimary} disabled={saving} onClick={onSave}>
          {saving ? 'Saving…' : saveLabel}
        </button>
      </div>
    </div>
  );
}
