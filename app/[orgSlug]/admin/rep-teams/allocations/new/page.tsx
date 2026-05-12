'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DollarSign, Plus, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import styles from '../../rep-teams.module.css';

interface ProgramYearOption { id: string; name: string; year: number; status: string; }
interface TeamOption { id: string; name: string; years: ProgramYearOption[]; }

interface Installment {
  installmentNumber: number;
  amount: string;
  dueDate: string;
}

interface SplitRow {
  teamId: string;
  programYearId: string;
  splitMethod: 'percentage' | 'sessions' | 'fixed';
  splitValue: string;
  amount: string;
  paymentSchedule: 'standard' | 'custom';
  standardDueDate: string;
  installments: Installment[];
  notes: string;
}

const BLANK_SPLIT: SplitRow = {
  teamId: '',
  programYearId: '',
  splitMethod: 'fixed',
  splitValue: '',
  amount: '',
  paymentSchedule: 'standard',
  standardDueDate: '',
  installments: [{ installmentNumber: 1, amount: '', dueDate: '' }],
  notes: '',
};

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function computeAmount(method: string, value: string, total: number): number | null {
  const v = parseFloat(value);
  if (isNaN(v) || v <= 0) return null;
  if (method === 'fixed') return v;
  if (method === 'percentage') return Math.round(total * v) / 100;
  if (method === 'sessions') return v; // dollar-per-session; caller interprets
  return null;
}

export default function NewAllocationPage() {
  const router = useRouter();
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin`;

  const [step, setStep] = useState(1);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);

  // Step 1 fields
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [sourceEntryId, setSourceEntryId] = useState('');

  // Step 2 fields
  const [splits, setSplits] = useState<SplitRow[]>([{ ...BLANK_SPLIT }]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentOrg) return;
    fetch('/api/admin/rep-teams/teams')
      .then(r => r.json())
      .then(data => {
        const teamList: TeamOption[] = (data.teams ?? []).map((s: any) => ({
          id: s.team.id,
          name: s.team.name,
          years: [],
        }));
        setTeams(teamList);
        // Fetch program years for each team
        Promise.all(
          teamList.map((t: TeamOption) =>
            fetch(`/api/admin/rep-teams/teams/${t.id}/program-years`)
              .then(r => r.json())
              .then(d => ({ teamId: t.id, years: d.programYears ?? [] })),
          ),
        ).then(results => {
          setTeams(prev =>
            prev.map(t => {
              const r = results.find(x => x.teamId === t.id);
              return r ? { ...t, years: r.years } : t;
            }),
          );
        }).finally(() => setTeamsLoading(false));
      })
      .catch(() => setTeamsLoading(false));
  }, [currentOrg]);

  if (loading) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_rep_teams')) {
    return (
      <div className={styles.accessDenied}>
        <DollarSign size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to this module.</p>
      </div>
    );
  }

  if (userRole !== 'owner' && userRole !== 'treasurer') {
    return (
      <div className={styles.accessDenied}>
        <DollarSign size={32} />
        <h2>Owner or Treasurer Required</h2>
        <p>Only owners and treasurers can create cost allocations.</p>
      </div>
    );
  }

  const total = parseFloat(totalAmount) || 0;

  function updateSplit(index: number, patch: Partial<SplitRow>) {
    setSplits(prev => {
      const next = [...prev];
      const updated = { ...next[index], ...patch };

      // Recompute computed amount when method or value changes
      if ('splitMethod' in patch || 'splitValue' in patch || 'totalAmount' in patch) {
        const computed = computeAmount(
          updated.splitMethod,
          updated.splitValue,
          total,
        );
        if (computed !== null && updated.splitMethod !== 'sessions') {
          updated.amount = computed.toFixed(2);
        }
      }

      // Sync standard installment amount when amount changes
      if ('amount' in patch && updated.paymentSchedule === 'standard') {
        updated.installments = [{
          installmentNumber: 1,
          amount: updated.amount,
          dueDate: updated.standardDueDate,
        }];
      }
      if ('standardDueDate' in patch && updated.paymentSchedule === 'standard') {
        updated.installments = [{
          installmentNumber: 1,
          amount: updated.amount,
          dueDate: updated.standardDueDate,
        }];
      }
      if ('paymentSchedule' in patch) {
        if (patch.paymentSchedule === 'standard') {
          updated.installments = [{
            installmentNumber: 1,
            amount: updated.amount,
            dueDate: updated.standardDueDate,
          }];
        } else {
          updated.installments = [{ installmentNumber: 1, amount: updated.amount, dueDate: '' }];
        }
      }

      next[index] = updated;
      return next;
    });
  }

  function addInstallment(splitIndex: number) {
    setSplits(prev => {
      const next = [...prev];
      const split = { ...next[splitIndex] };
      split.installments = [
        ...split.installments,
        {
          installmentNumber: split.installments.length + 1,
          amount: '',
          dueDate: '',
        },
      ];
      next[splitIndex] = split;
      return next;
    });
  }

  function removeInstallment(splitIndex: number, instIndex: number) {
    setSplits(prev => {
      const next = [...prev];
      const split = { ...next[splitIndex] };
      split.installments = split.installments
        .filter((_, i) => i !== instIndex)
        .map((inst, i) => ({ ...inst, installmentNumber: i + 1 }));
      next[splitIndex] = split;
      return next;
    });
  }

  function updateInstallment(splitIndex: number, instIndex: number, patch: Partial<Installment>) {
    setSplits(prev => {
      const next = [...prev];
      const split = { ...next[splitIndex] };
      split.installments = split.installments.map((inst, i) =>
        i === instIndex ? { ...inst, ...patch } : inst,
      );
      next[splitIndex] = split;
      return next;
    });
  }

  function addSplit() {
    setSplits(prev => [...prev, { ...BLANK_SPLIT }]);
  }

  function removeSplit(index: number) {
    setSplits(prev => prev.filter((_, i) => i !== index));
  }

  const splitSum = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

  function validateStep1(): string {
    if (!description.trim()) return 'Description is required.';
    const t = parseFloat(totalAmount);
    if (isNaN(t) || t <= 0) return 'Total amount must be a positive number.';
    return '';
  }

  function validateStep2(): string {
    if (splits.length === 0) return 'At least one team split is required.';
    for (let i = 0; i < splits.length; i++) {
      const s = splits[i];
      if (!s.teamId) return `Split ${i + 1}: select a team.`;
      if (!s.programYearId) return `Split ${i + 1}: select a program year.`;
      const amt = parseFloat(s.amount);
      if (isNaN(amt) || amt <= 0) return `Split ${i + 1}: amount must be a positive number.`;
      for (let j = 0; j < s.installments.length; j++) {
        const inst = s.installments[j];
        const iAmt = parseFloat(inst.amount);
        if (isNaN(iAmt) || iAmt <= 0) return `Split ${i + 1}, installment ${j + 1}: amount required.`;
        if (!inst.dueDate) return `Split ${i + 1}, installment ${j + 1}: due date required.`;
      }
      const instSum = s.installments.reduce((sum, inst) => sum + (parseFloat(inst.amount) || 0), 0);
      if (Math.abs(instSum - amt) > 0.01) {
        return `Split ${i + 1}: installment amounts (${fmt(instSum)}) must equal split amount (${fmt(amt)}).`;
      }
    }
    if (splitSum > total + 0.001) {
      return `Split amounts (${fmt(splitSum)}) exceed total amount (${fmt(total)}).`;
    }
    return '';
  }

  async function handleSubmit() {
    const v2 = validateStep2();
    if (v2) { setError(v2); return; }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/rep-teams/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          totalAmount: parseFloat(totalAmount),
          sourceEntryId: sourceEntryId.trim() || null,
          splits: splits.map(s => ({
            teamId: s.teamId,
            programYearId: s.programYearId,
            splitMethod: s.splitMethod,
            splitValue: parseFloat(s.splitValue) || 0,
            amount: parseFloat(s.amount),
            paymentSchedule: s.paymentSchedule,
            notes: s.notes.trim() || null,
            installments: s.installments.map(inst => ({
              installmentNumber: inst.installmentNumber,
              amount: parseFloat(inst.amount),
              dueDate: inst.dueDate,
            })),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create allocation');
      router.push(`${base}/rep-teams/allocations/${data.allocation.id}`);
    } catch (e: any) {
      setError(e.message ?? 'Failed to create allocation.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page} style={{ maxWidth: 720 }}>
      <div className={styles.breadcrumb}>
        <Link href={`${base}/rep-teams`}>Rep Teams</Link>
        <span>/</span>
        <Link href={`${base}/rep-teams/allocations`}>Cost Allocations</Link>
        <span>/</span>
        <span>New Allocation</span>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><DollarSign size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>New Cost Allocation</h1>
            <p className={styles.pageSub}>Split a shared expense across teams</p>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', alignItems: 'center' }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: step >= s ? 'var(--blueprint-blue,#4fa3e0)' : 'rgba(255,255,255,0.08)',
              color: step >= s ? '#fff' : 'rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
            }}>
              {s}
            </div>
            <span style={{ fontSize: '0.82rem', color: step === s ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)' }}>
              {s === 1 ? 'Details' : s === 2 ? 'Team Splits' : 'Review'}
            </span>
            {s < 3 && <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.2)' }} />}
          </div>
        ))}
      </div>

      {/* ── Step 1 ── */}
      {step === 1 && (
        <div>
          <div className={styles.formGrid} style={{ gridTemplateColumns: '1fr' }}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="alloc-desc">
                Description <span style={{ color: '#f87171' }}>*</span>
              </label>
              <input
                id="alloc-desc"
                className={styles.input}
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Field rental — 2025 season"
                maxLength={200}
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="alloc-total">
                Total Amount ($) <span style={{ color: '#f87171' }}>*</span>
              </label>
              <input
                id="alloc-total"
                className={styles.input}
                type="number"
                min={0.01}
                step={0.01}
                value={totalAmount}
                onChange={e => setTotalAmount(e.target.value)}
                placeholder="e.g. 3000.00"
              />
              <p className={styles.hint}>The full shared expense being split. You can allocate less than this total if the org retains a portion.</p>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="alloc-entry">Org Ledger Entry ID (optional)</label>
              <input
                id="alloc-entry"
                className={styles.input}
                type="text"
                value={sourceEntryId}
                onChange={e => setSourceEntryId(e.target.value)}
                placeholder="Paste accounting entry ID to link"
              />
              <p className={styles.hint}>Link this allocation to the expense entry in your org ledger.</p>
            </div>
          </div>

          {error && <p className={styles.errorText} style={{ marginTop: '1rem' }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                const v = validateStep1();
                if (v) { setError(v); return; }
                setError('');
                setStep(2);
              }}
            >
              Team Splits <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2 ── */}
      {step === 2 && (
        <div>
          <p className={styles.hint} style={{ marginBottom: '1.5rem', fontSize: '0.88rem' }}>
            Total: <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{fmt(total)}</strong>
            {' '}— Allocated so far: <strong style={{ color: splitSum > total + 0.001 ? '#f87171' : '#4ade80' }}>{fmt(splitSum)}</strong>
            {total > splitSum + 0.001 && (
              <span style={{ color: 'rgba(255,255,255,0.4)' }}> (unallocated: {fmt(total - splitSum)})</span>
            )}
          </p>

          {teamsLoading && <p className={styles.muted}>Loading teams…</p>}

          {splits.map((split, si) => {
            const teamYears = teams.find(t => t.id === split.teamId)?.years ?? [];
            return (
              <div key={si} className={styles.detailSection} style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                    Split {si + 1}
                  </span>
                  {splits.length > 1 && (
                    <button type="button" onClick={() => removeSplit(si)} className={styles.btnGhost}
                      title="Remove split">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label className={styles.label}>Team <span style={{ color: '#f87171' }}>*</span></label>
                    <select
                      className={styles.select}
                      value={split.teamId}
                      onChange={e => updateSplit(si, { teamId: e.target.value, programYearId: '' })}
                    >
                      <option value="">Select team…</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Program Year <span style={{ color: '#f87171' }}>*</span></label>
                    <select
                      className={styles.select}
                      value={split.programYearId}
                      onChange={e => updateSplit(si, { programYearId: e.target.value })}
                      disabled={!split.teamId}
                    >
                      <option value="">Select year…</option>
                      {teamYears.map(y => (
                        <option key={y.id} value={y.id}>
                          {y.name} ({y.year}) — {y.status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Split Method</label>
                    <select
                      className={styles.select}
                      value={split.splitMethod}
                      onChange={e => updateSplit(si, { splitMethod: e.target.value as SplitRow['splitMethod'], splitValue: '', amount: '' })}
                    >
                      <option value="fixed">Fixed ($)</option>
                      <option value="percentage">Percentage (%)</option>
                      <option value="sessions">Sessions (# sessions)</option>
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>
                      {split.splitMethod === 'percentage' ? 'Percentage' : split.splitMethod === 'sessions' ? 'Session Count' : 'Fixed Amount'}
                    </label>
                    <input
                      className={styles.input}
                      type="number"
                      min={0.01}
                      step={split.splitMethod === 'percentage' ? 0.1 : 1}
                      value={split.splitValue}
                      onChange={e => updateSplit(si, { splitValue: e.target.value })}
                      placeholder={split.splitMethod === 'percentage' ? 'e.g. 33.33' : split.splitMethod === 'sessions' ? 'e.g. 20' : 'e.g. 1000'}
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Split Amount ($) <span style={{ color: '#f87171' }}>*</span></label>
                    <input
                      className={styles.input}
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={split.amount}
                      onChange={e => updateSplit(si, { amount: e.target.value })}
                      placeholder="e.g. 1000.00"
                    />
                    <p className={styles.hint}>Final dollar amount charged to this team.</p>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Payment Schedule</label>
                    <select
                      className={styles.select}
                      value={split.paymentSchedule}
                      onChange={e => updateSplit(si, { paymentSchedule: e.target.value as 'standard' | 'custom' })}
                    >
                      <option value="standard">Lump Sum (single payment)</option>
                      <option value="custom">Custom (multiple installments)</option>
                    </select>
                  </div>

                  {split.paymentSchedule === 'standard' && (
                    <div className={`${styles.field} ${styles.formGridFull}`}>
                      <label className={styles.label}>Due Date <span style={{ color: '#f87171' }}>*</span></label>
                      <input
                        className={styles.input}
                        type="date"
                        value={split.standardDueDate}
                        onChange={e => updateSplit(si, { standardDueDate: e.target.value })}
                      />
                    </div>
                  )}

                  {split.paymentSchedule === 'custom' && (
                    <div className={`${styles.field} ${styles.formGridFull}`}>
                      <label className={styles.label}>Installments</label>
                      {split.installments.map((inst, ii) => (
                        <div key={ii} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                          <div>
                            <input
                              className={styles.input}
                              type="number"
                              min={0.01}
                              step={0.01}
                              value={inst.amount}
                              onChange={e => updateInstallment(si, ii, { amount: e.target.value })}
                              placeholder={`Installment ${inst.installmentNumber} amount`}
                            />
                          </div>
                          <div>
                            <input
                              className={styles.input}
                              type="date"
                              value={inst.dueDate}
                              onChange={e => updateInstallment(si, ii, { dueDate: e.target.value })}
                            />
                          </div>
                          <div>
                            {split.installments.length > 1 && (
                              <button type="button" onClick={() => removeInstallment(si, ii)}
                                className={styles.btnGhost} title="Remove installment">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      <button type="button" className={styles.btnSecondary}
                        style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}
                        onClick={() => addInstallment(si)}>
                        <Plus size={13} /> Add Installment
                      </button>
                    </div>
                  )}

                  <div className={`${styles.field} ${styles.formGridFull}`}>
                    <label className={styles.label}>Notes (optional)</label>
                    <input
                      className={styles.input}
                      type="text"
                      value={split.notes}
                      onChange={e => updateSplit(si, { notes: e.target.value })}
                      placeholder="Internal note for this split"
                      maxLength={200}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <button type="button" className={styles.btnSecondary} onClick={addSplit}
            style={{ marginBottom: '1.5rem' }}>
            <Plus size={14} /> Add Another Team
          </button>

          {error && <p className={styles.errorText} style={{ marginBottom: '1rem' }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
            <button type="button" className={styles.btnSecondary} onClick={() => { setError(''); setStep(1); }}>
              <ChevronLeft size={16} /> Back
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                const v = validateStep2();
                if (v) { setError(v); return; }
                setError('');
                setStep(3);
              }}
            >
              Review <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3 — Review ── */}
      {step === 3 && (
        <div>
          <div className={styles.detailSection} style={{ marginBottom: '1.5rem' }}>
            <p className={styles.detailSectionTitle}>Allocation Details</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.4rem 1rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Description</span>
              <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{description}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Total amount</span>
              <span style={{ color: 'rgba(255,255,255,0.9)' }}>{fmt(total)}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>Allocated</span>
              <span style={{ color: splitSum > total + 0.001 ? '#f87171' : '#4ade80' }}>{fmt(splitSum)}</span>
              {total > splitSum + 0.001 && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>Org retains</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>{fmt(total - splitSum)}</span>
                </>
              )}
            </div>
          </div>

          {splits.map((split, si) => {
            const teamName = teams.find(t => t.id === split.teamId)?.name ?? split.teamId;
            const teamYears = teams.find(t => t.id === split.teamId)?.years ?? [];
            const yearLabel = teamYears.find(y => y.id === split.programYearId);
            const instSum = split.installments.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
            return (
              <div key={si} className={styles.detailSection} style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <p className={styles.detailSectionTitle} style={{ margin: 0 }}>
                    {teamName} — {yearLabel ? `${yearLabel.name} (${yearLabel.year})` : '—'}
                  </p>
                  <strong style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem' }}>{fmt(parseFloat(split.amount) || 0)}</strong>
                </div>
                <div style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem' }}>
                  {split.splitMethod === 'percentage' && `${split.splitValue}% of total`}
                  {split.splitMethod === 'sessions' && `${split.splitValue} sessions`}
                  {split.splitMethod === 'fixed' && 'Fixed amount'}
                  {' · '}
                  {split.paymentSchedule === 'standard' ? 'Lump sum' : `${split.installments.length} installments`}
                  {Math.abs(instSum - (parseFloat(split.amount) || 0)) > 0.01 && (
                    <span style={{ color: '#f87171' }}> ⚠ installment total {fmt(instSum)} ≠ split amount</span>
                  )}
                </div>
                <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', color: 'rgba(255,255,255,0.3)', paddingBottom: '0.3rem', fontWeight: 600 }}>#</th>
                      <th style={{ textAlign: 'left', color: 'rgba(255,255,255,0.3)', paddingBottom: '0.3rem', fontWeight: 600 }}>Amount</th>
                      <th style={{ textAlign: 'left', color: 'rgba(255,255,255,0.3)', paddingBottom: '0.3rem', fontWeight: 600 }}>Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {split.installments.map((inst, ii) => (
                      <tr key={ii}>
                        <td style={{ color: 'rgba(255,255,255,0.4)', padding: '0.2rem 0' }}>{inst.installmentNumber}</td>
                        <td style={{ color: 'rgba(255,255,255,0.8)', padding: '0.2rem 0' }}>{fmt(parseFloat(inst.amount) || 0)}</td>
                        <td style={{ color: 'rgba(255,255,255,0.6)', padding: '0.2rem 0' }}>{inst.dueDate || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {error && <p className={styles.errorText} style={{ margin: '1rem 0' }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
            <button type="button" className={styles.btnSecondary} onClick={() => { setError(''); setStep(2); }}>
              <ChevronLeft size={16} /> Back
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Creating…' : 'Create Allocation'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
