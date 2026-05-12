'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Users, X, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import HelpTooltip from '@/components/help/HelpTooltip';
import styles from '../../../../coaches.module.css';
import type { RepRosterPlayer, RepPlayerDuesSchedule, RepPlayerDuesInstallment } from '@/lib/types';

interface PlayerWithDues {
  player: RepRosterPlayer;
  schedule: RepPlayerDuesSchedule | null;
  installments: RepPlayerDuesInstallment[];
  paidAmount: number;
  outstanding: number;
}

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dueDate: string, paidAt: string | null) {
  if (paidAt) return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

function statusLabel(p: PlayerWithDues) {
  if (!p.schedule) return { label: 'Not set', color: 'rgba(255,255,255,0.3)' };
  if (p.outstanding <= 0) return { label: 'Fully paid', color: '#4ade80' };
  if (p.paidAmount > 0) return { label: 'Partial', color: '#f59e0b' };
  return { label: 'Unpaid', color: 'rgba(255,255,255,0.4)' };
}

interface InstallmentRow {
  installmentNumber: number;
  amount: string;
  dueDate: string;
}

const BLANK_FORM = { totalAmount: '', notes: '' };

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
  const [form, setForm] = useState(BLANK_FORM);
  const [installmentRows, setInstallmentRows] = useState<InstallmentRow[]>([
    { installmentNumber: 1, amount: '', dueDate: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [marking, setMarking] = useState<Record<string, boolean>>({});

  const [applyAllOpen, setApplyAllOpen] = useState(false);
  const [allForm, setAllForm] = useState(BLANK_FORM);
  const [allInstallmentRows, setAllInstallmentRows] = useState<InstallmentRow[]>([
    { installmentNumber: 1, amount: '', dueDate: '' },
  ]);
  const [applyAllSaving, setApplyAllSaving] = useState(false);
  const [applyAllError, setApplyAllError] = useState('');

  const [sendingReminders, setSendingReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ emailsSent: number; installmentsTagged: number } | null>(null);
  const [reminderError, setReminderError] = useState('');

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
    } catch (e: any) {
      setError(e.message ?? 'Failed to load player dues.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => { load(); }, [load]);

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
      setSelected(null);
      await load();
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(p: PlayerWithDues, inst: RepPlayerDuesInstallment) {
    if (!p.schedule) return;
    const key = inst.id;
    setMarking(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/dues/${p.schedule.id}/installments/${inst.id}`,
        { method: 'PATCH' },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed');
      await load();
      // Refresh selected player data
      const updated = players.find(pl => pl.player.id === p.player.id);
      if (updated) setSelected(updated);
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setMarking(prev => ({ ...prev, [key]: false }));
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
      // Apply to each player sequentially
      for (const p of players) {
        await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/dues`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId: p.player.id,
            totalAmount,
            notes: allForm.notes || null,
            installments,
          }),
        });
      }
      setApplyAllOpen(false);
      await load();
    } catch (e: any) {
      setApplyAllError(e.message);
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
    } catch (e: any) {
      setReminderError(e.message ?? 'Failed to send reminders.');
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
          {reminderError && (
            <span style={{ fontSize: '0.8rem', color: '#f87171' }}>{reminderError}</span>
          )}
        </div>
      </div>

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : !players.length ? (
        <div className={styles.emptyState}>No active roster players found.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Player</th>
                <th className={styles.th}>Total Dues</th>
                <th className={styles.th}>Paid</th>
                <th className={styles.th}>Outstanding</th>
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
                    onClick={() => { setSelected(p); setEditingSchedule(false); setSaveError(''); }}
                  >
                    <td className={styles.td}>
                      {p.player.playerFirstName} {p.player.playerLastName}
                    </td>
                    <td className={styles.td} style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {p.schedule ? fmt(p.schedule.totalAmount) : '—'}
                    </td>
                    <td className={styles.td} style={{ color: '#4ade80', fontVariantNumeric: 'tabular-nums' }}>
                      {p.schedule ? fmt(p.paidAmount) : '—'}
                    </td>
                    <td className={styles.td} style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {p.schedule ? fmt(p.outstanding) : '—'}
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
      )}

      {/* Player slide-over */}
      {selected && (
        <div className={styles.modalOverlay} onClick={() => { setSelected(null); setEditingSchedule(false); }}>
          <div className={styles.slideOver} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
                {selected.player.playerFirstName} {selected.player.playerLastName}
              </span>
              <button className={styles.modalCloseBtn} onClick={() => { setSelected(null); setEditingSchedule(false); }}>
                <X size={18} />
              </button>
            </div>

            {!editingSchedule ? (
              <>
                {selected.schedule ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{fmt(selected.schedule.totalAmount)}</p>
                        <p className={styles.muted} style={{ margin: 0, fontSize: '0.8rem' }}>
                          {fmt(selected.paidAmount)} paid · {fmt(selected.outstanding)} outstanding
                        </p>
                        {selected.schedule.notes && (
                          <p className={styles.muted} style={{ margin: '0.4rem 0 0', fontSize: '0.8rem' }}>{selected.schedule.notes}</p>
                        )}
                      </div>
                      <button className={styles.btnGhost} onClick={() => openEdit(selected)} style={{ fontSize: '0.8rem' }}>
                        Edit schedule
                      </button>
                    </div>

                    {selected.installments.length > 0 ? (
                      <div className={styles.tableWrap}>
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
                    ) : (
                      <p className={styles.muted} style={{ fontSize: '0.82rem' }}>No installments set.</p>
                    )}
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

// ── Shared schedule form component ────────────────────────────────────────────

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
