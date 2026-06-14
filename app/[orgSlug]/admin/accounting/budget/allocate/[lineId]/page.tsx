'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DollarSign, Plus, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import styles from '../../../../rep-teams/rep-teams.module.css';

interface ProgramYearOption { id: string; name: string; year: number; status: string; }
interface TeamOption { id: string; name: string; years: ProgramYearOption[]; }

interface Period { id: string; label: string; periodDate: string | null; amount: number; }
interface BudgetLineInfo {
  id: string;
  description: string;
  totalAmount: number;
  notes: string | null;
  budget_categories: { name: string } | null;
}

interface Installment { installmentNumber: number; amount: string; dueDate: string; }

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
  teamId: '', programYearId: '',
  splitMethod: 'fixed', splitValue: '', amount: '',
  paymentSchedule: 'standard', standardDueDate: '',
  installments: [{ installmentNumber: 1, amount: '', dueDate: '' }],
  notes: '',
};

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function computeAmount(method: string, value: string, total: number, splitCount: number): number | null {
  const v = parseFloat(value);
  if (method === 'equal')      return splitCount > 0 ? parseFloat((total / splitCount).toFixed(2)) : null;
  if (isNaN(v) || v <= 0)     return null;
  if (method === 'fixed')      return v;
  if (method === 'percentage') return parseFloat((total * v / 100).toFixed(2));
  return null;
}

export default function AllocateBudgetLinePage({ params }: { params: Promise<{ lineId: string; orgSlug: string }> }) {
  const { lineId } = use(params);
  const router  = useRouter();
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const base    = `/${currentOrg?.slug ?? ''}/admin`;
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';

  const [step, setStep] = useState(1);
  const [lineInfo, setLineInfo]   = useState<BudgetLineInfo | null>(null);
  const [periods, setPeriods]     = useState<Period[]>([]);
  const [teams, setTeams]         = useState<TeamOption[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [lineLoading, setLineLoading]   = useState(true);

  const [splits, setSplits]       = useState<SplitRow[]>([{ ...BLANK_SPLIT }]);
  const [inheritPeriods, setInheritPeriods] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  // Load budget line info + periods
  useEffect(() => {
    if (!currentOrg) return;
    const year = new Date().getFullYear();
    const qs = new URLSearchParams({ year: String(year) });
    if (currentOrg.slug) qs.set('orgSlug', currentOrg.slug);
    fetch(`/api/admin/accounting/budget-plan?${qs}`)
      .then(r => r.json())
      .then(data => {
        const allLines = [
          ...(data.categories ?? []).flatMap((c: any) => c.lines ?? []),
          ...(data.uncategorized ?? []),
        ];
        const found = allLines.find((l: any) => l.id === lineId);
        if (found) {
          setLineInfo({
            id:               found.id,
            description:      found.description,
            totalAmount:      found.totalAmount,
            notes:            found.notes,
            budget_categories: found.categoryId ? { name: data.categories.find((c: any) => c.id === found.categoryId)?.name ?? '' } : null,
          });
          setPeriods(found.periods ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLineLoading(false));
  }, [currentOrg, lineId]);

  // Load teams + program years
  useEffect(() => {
    if (!currentOrg) return;
    fetch(`/api/admin/rep-teams/teams${orgQuery}`)
      .then(r => r.json())
      .then(data => {
        const teamList: TeamOption[] = (data.teams ?? []).map((s: any) => ({
          id: s.team.id, name: s.team.name, years: [],
        }));
        setTeams(teamList);
        Promise.all(
          teamList.map(t =>
            fetch(`/api/admin/rep-teams/teams/${t.id}/program-years${orgQuery}`)
              .then(r => r.json())
              .then(d => ({ teamId: t.id, years: d.programYears ?? [] })),
          ),
        ).then(results => {
          setTeams(prev => prev.map(t => {
            const r = results.find(x => x.teamId === t.id);
            return r ? { ...t, years: r.years } : t;
          }));
        }).finally(() => setTeamsLoading(false));
      })
      .catch(() => setTeamsLoading(false));
  }, [currentOrg, orgQuery]);

  if (loading || lineLoading) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_accounting')) {
    return (
      <div className={styles.accessDenied}>
        <DollarSign size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the Accounting module.</p>
      </div>
    );
  }

  if (userRole !== 'owner' && userRole !== 'treasurer') {
    return (
      <div className={styles.accessDenied}>
        <DollarSign size={32} />
        <h2>Owner or Treasurer Required</h2>
        <p>Only owners and treasurers can allocate budget lines to teams.</p>
      </div>
    );
  }

  if (!lineInfo) {
    return (
      <div className={styles.page}>
        <p className={styles.muted}>Budget line not found.</p>
        <Link href={`${base}/accounting/budget`} className="btn btn-secondary">← Back to Budget</Link>
      </div>
    );
  }

  const total = lineInfo.totalAmount;
  const splitSum = splits.reduce((s, sp) => s + (parseFloat(sp.amount) || 0), 0);

  // ── Split helpers ─────────────────────────────────────────────────────────

  function updateSplit(index: number, patch: Partial<SplitRow>) {
    setSplits(prev => {
      const next = [...prev];
      const updated = { ...next[index], ...patch };

      if ('splitMethod' in patch || 'splitValue' in patch) {
        const computed = computeAmount(updated.splitMethod, updated.splitValue, total, prev.length);
        if (computed !== null && updated.splitMethod !== 'sessions') {
          updated.amount = computed.toFixed(2);
        }
      }

      // Sync installments when on standard schedule
      if (('amount' in patch || 'standardDueDate' in patch) && updated.paymentSchedule === 'standard') {
        updated.installments = [{
          installmentNumber: 1,
          amount:  updated.amount,
          dueDate: updated.standardDueDate,
        }];
      }

      if ('paymentSchedule' in patch) {
        if (patch.paymentSchedule === 'standard') {
          updated.installments = [{
            installmentNumber: 1,
            amount:  updated.amount,
            dueDate: updated.standardDueDate,
          }];
        } else if (patch.paymentSchedule === 'custom') {
          // If periods available and inherit is on, pre-fill from period dates
          if (periods.length > 0 && inheritPeriods) {
            const splitAmt  = parseFloat(updated.amount) || 0;
            const perPeriod = periods.length > 0 ? parseFloat((splitAmt / periods.length).toFixed(2)) : 0;
            updated.installments = periods.map((p, i) => ({
              installmentNumber: i + 1,
              amount:  perPeriod.toFixed(2),
              dueDate: p.periodDate ?? '',
            }));
          } else {
            updated.installments = [{ installmentNumber: 1, amount: updated.amount, dueDate: '' }];
          }
        }
      }

      next[index] = updated;
      return next;
    });
  }

  function handleInheritToggle(checked: boolean) {
    setInheritPeriods(checked);
    if (checked && periods.length > 0) {
      setSplits(prev => prev.map(s => {
        if (s.paymentSchedule !== 'custom') return s;
        const splitAmt  = parseFloat(s.amount) || 0;
        const perPeriod = parseFloat((splitAmt / periods.length).toFixed(2));
        return {
          ...s,
          installments: periods.map((p, i) => ({
            installmentNumber: i + 1,
            amount:  perPeriod.toFixed(2),
            dueDate: p.periodDate ?? '',
          })),
        };
      }));
    }
  }

  // When split method changes to "equal", recompute all amounts
  function handleMethodChangeAll(method: 'equal' | 'percentage' | 'sessions' | 'fixed') {
    setSplits(prev => prev.map(s => {
      const computed = method === 'equal' ? parseFloat((total / prev.length).toFixed(2)) : null;
      const amount   = computed !== null ? computed.toFixed(2) : s.amount;
      const updated  = { ...s, splitMethod: method === 'equal' ? 'fixed' as const : method, splitValue: '', amount };
      if (updated.paymentSchedule === 'standard') {
        updated.installments = [{ installmentNumber: 1, amount: updated.amount, dueDate: updated.standardDueDate }];
      }
      return updated;
    }));
  }

  function addInstallment(si: number) {
    setSplits(prev => {
      const next = [...prev];
      const split = { ...next[si] };
      split.installments = [
        ...split.installments,
        { installmentNumber: split.installments.length + 1, amount: '', dueDate: '' },
      ];
      next[si] = split;
      return next;
    });
  }

  function removeInstallment(si: number, ii: number) {
    setSplits(prev => {
      const next = [...prev];
      const split = { ...next[si] };
      split.installments = split.installments
        .filter((_, i) => i !== ii)
        .map((inst, i) => ({ ...inst, installmentNumber: i + 1 }));
      next[si] = split;
      return next;
    });
  }

  function updateInstallment(si: number, ii: number, patch: Partial<Installment>) {
    setSplits(prev => {
      const next = [...prev];
      const split = { ...next[si] };
      split.installments = split.installments.map((inst, i) => i === ii ? { ...inst, ...patch } : inst);
      next[si] = split;
      return next;
    });
  }

  function addSplit() {
    setSplits(prev => [...prev, { ...BLANK_SPLIT }]);
  }

  function removeSplit(idx: number) {
    setSplits(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validateStep1(): string {
    if (splits.length === 0) return 'At least one team split is required.';
    for (let i = 0; i < splits.length; i++) {
      const s = splits[i];
      if (!s.teamId)        return `Split ${i + 1}: select a team.`;
      if (!s.programYearId) return `Split ${i + 1}: select a program year.`;
      const amt = parseFloat(s.amount);
      if (isNaN(amt) || amt <= 0) return `Split ${i + 1}: amount must be a positive number.`;
      for (let j = 0; j < s.installments.length; j++) {
        const inst = s.installments[j];
        if (!parseFloat(inst.amount) || parseFloat(inst.amount) <= 0)
          return `Split ${i + 1}, installment ${j + 1}: amount required.`;
        if (!inst.dueDate)
          return `Split ${i + 1}, installment ${j + 1}: due date required.`;
      }
      const instSum = s.installments.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
      if (Math.abs(instSum - amt) > 0.01)
        return `Split ${i + 1}: installment total (${fmt(instSum)}) must equal split amount (${fmt(amt)}).`;
    }
    if (splitSum > total + 0.001)
      return `Split total (${fmt(splitSum)}) exceeds budget line total (${fmt(total)}).`;
    return '';
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    const v = validateStep1();
    if (v) { setError(v); return; }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/accounting/budget-plan/lines/${lineId}/allocate-to-teams${orgQuery}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: lineInfo!.description,
          splits: splits.map(s => ({
            teamId:          s.teamId,
            programYearId:   s.programYearId,
            splitMethod:     s.splitMethod,
            splitValue:      parseFloat(s.splitValue) || 0,
            amount:          parseFloat(s.amount),
            paymentSchedule: s.paymentSchedule,
            notes:           s.notes.trim() || null,
            installments:    s.installments.map((inst, idx) => ({
              installmentNumber: inst.installmentNumber ?? idx + 1,
              amount:            parseFloat(inst.amount),
              dueDate:           inst.dueDate,
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page} style={{ maxWidth: 760 }}>
      <div className={styles.breadcrumb}>
        <Link href={`${base}/accounting`}>Accounting</Link>
        <span>/</span>
        <Link href={`${base}/accounting/budget`}>Org Budget</Link>
        <span>/</span>
        <span>Allocate to Teams</span>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><DollarSign size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Allocate to Teams</h1>
            <p className={styles.pageSub}>{lineInfo.description} — {fmt(total)}</p>
          </div>
        </div>
      </div>

      {/* Budget line summary */}
      <div className={styles.detailSection} style={{ marginBottom: '2rem' }}>
        <p className={styles.detailSectionTitle} style={{ marginBottom: '0.6rem' }}>Budget Line</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.3rem 1rem', fontSize: '0.88rem' }}>
          <span style={{ color: 'var(--white-40)' }}>Description</span>
          <span style={{ fontWeight: 600 }}>{lineInfo.description}</span>
          <span style={{ color: 'var(--white-40)' }}>Total</span>
          <span>{fmt(total)}</span>
          {lineInfo.budget_categories && (
            <>
              <span style={{ color: 'var(--white-40)' }}>Category</span>
              <span>{lineInfo.budget_categories.name}</span>
            </>
          )}
          {periods.length > 0 && (
            <>
              <span style={{ color: 'var(--white-40)' }}>Periods</span>
              <span>{periods.map(p => p.label).join(' · ')}</span>
            </>
          )}
        </div>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', alignItems: 'center' }}>
        {[1, 2].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: step >= s ? 'var(--blueprint-blue,#4fa3e0)' : 'var(--white-8)',
              color: step >= s ? '#fff' : 'var(--white-30)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
            }}>
              {s}
            </div>
            <span style={{ fontSize: '0.82rem', color: step === s ? 'var(--white-80)' : 'var(--white-30)' }}>
              {s === 1 ? 'Team Splits' : 'Review'}
            </span>
            {s < 2 && <ChevronRight size={14} style={{ color: 'var(--white-20)' }} />}
          </div>
        ))}
      </div>

      {/* ── Step 1 — Team Splits ── */}
      {step === 1 && (
        <div>
          {/* Period inheritance toggle */}
          {periods.length > 0 && (
            <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: 'var(--white-5)', borderRadius: '2px', border: '1px solid var(--white-8)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="checkbox"
                id="inherit-periods"
                checked={inheritPeriods}
                onChange={e => handleInheritToggle(e.target.checked)}
              />
              <label htmlFor="inherit-periods" style={{ fontSize: '0.85rem', color: 'var(--white-80)', cursor: 'pointer' }}>
                Inherit installment due dates from budget periods
                <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--white-40)' }}>
                  When using custom schedule, due dates will be pre-filled from this line&apos;s period dates.
                </span>
              </label>
            </div>
          )}

          <p className={styles.hint} style={{ marginBottom: '1.5rem', fontSize: '0.88rem' }}>
            Total: <strong style={{ color: 'var(--white-80)' }}>{fmt(total)}</strong>
            {' '}— Allocated so far: <strong style={{ color: splitSum > total + 0.001 ? '#f87171' : '#4ade80' }}>{fmt(splitSum)}</strong>
            {total > splitSum + 0.001 && (
              <span style={{ color: 'var(--white-40)' }}> (unallocated: {fmt(total - splitSum)})</span>
            )}
          </p>

          {/* Quick-split helper for equal split */}
          {splits.length > 1 && (
            <div style={{ marginBottom: '1rem' }}>
              <button
                type="button"
                className={styles.btnSecondary}
                style={{ fontSize: '0.8rem' }}
                onClick={() => handleMethodChangeAll('equal')}
              >
                Split equally ({fmt(parseFloat((total / splits.length).toFixed(2)))} each)
              </button>
            </div>
          )}

          {teamsLoading && <p className={styles.muted}>Loading teams…</p>}

          {splits.map((split, si) => {
            const teamYears = teams.find(t => t.id === split.teamId)?.years ?? [];
            return (
              <div key={si} className={styles.detailSection} style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--white-70)' }}>
                    Split {si + 1}
                  </span>
                  {splits.length > 1 && (
                    <button type="button" onClick={() => removeSplit(si)} className={styles.btnGhost} title="Remove">
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
                      onChange={e => updateSplit(si, {
                        splitMethod: e.target.value as SplitRow['splitMethod'],
                        splitValue: '', amount: '',
                      })}
                    >
                      <option value="fixed">Fixed ($)</option>
                      <option value="percentage">Percentage (%)</option>
                      <option value="sessions">Sessions (# sessions)</option>
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>
                      {split.splitMethod === 'percentage'
                        ? 'Percentage'
                        : split.splitMethod === 'sessions'
                        ? 'Session Count'
                        : 'Fixed Amount ($)'}
                    </label>
                    <input
                      className={styles.input}
                      type="number"
                      min={0.01}
                      step={split.splitMethod === 'percentage' ? 0.1 : 1}
                      value={split.splitMethod === 'fixed' ? split.amount : split.splitValue}
                      onChange={e => updateSplit(si,
                        split.splitMethod === 'fixed'
                          ? { amount: e.target.value }
                          : { splitValue: e.target.value },
                      )}
                      placeholder={
                        split.splitMethod === 'percentage' ? 'e.g. 33.33'
                        : split.splitMethod === 'sessions' ? 'e.g. 20'
                        : 'e.g. 1000.00'
                      }
                    />
                  </div>

                  {split.splitMethod !== 'fixed' && (
                    <div className={styles.field}>
                      <label className={styles.label}>Split Amount ($) <span style={{ color: '#f87171' }}>*</span></label>
                      <input
                        className={styles.input}
                        type="number" min={0.01} step={0.01}
                        value={split.amount}
                        onChange={e => updateSplit(si, { amount: e.target.value })}
                        placeholder="e.g. 1000.00"
                      />
                    </div>
                  )}

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
                          <input
                            className={styles.input}
                            type="number" min={0.01} step={0.01}
                            value={inst.amount}
                            onChange={e => updateInstallment(si, ii, { amount: e.target.value })}
                            placeholder={`Installment ${inst.installmentNumber} amount`}
                          />
                          <input
                            className={styles.input}
                            type="date"
                            value={inst.dueDate}
                            onChange={e => updateInstallment(si, ii, { dueDate: e.target.value })}
                          />
                          {split.installments.length > 1 && (
                            <button type="button" onClick={() => removeInstallment(si, ii)}
                              className={styles.btnGhost} title="Remove installment">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}
                        onClick={() => addInstallment(si)}
                      >
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

          <button type="button" className={styles.btnSecondary} onClick={addSplit} style={{ marginBottom: '1.5rem' }}>
            <Plus size={14} /> Add Another Team
          </button>

          {error && <p className={styles.errorText} style={{ marginBottom: '1rem' }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Link href={`${base}/accounting/budget`} className={styles.btnSecondary}>
              <ChevronLeft size={16} /> Back to Budget
            </Link>
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
              Review <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2 — Review ── */}
      {step === 2 && (
        <div>
          <div className={styles.detailSection} style={{ marginBottom: '1.5rem' }}>
            <p className={styles.detailSectionTitle}>Allocation Summary</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.4rem 1rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--white-40)' }}>Budget line</span>
              <span style={{ fontWeight: 600 }}>{lineInfo.description}</span>
              <span style={{ color: 'var(--white-40)' }}>Line total</span>
              <span>{fmt(total)}</span>
              <span style={{ color: 'var(--white-40)' }}>Allocated</span>
              <span style={{ color: splitSum > total + 0.001 ? '#f87171' : '#4ade80' }}>{fmt(splitSum)}</span>
              {total > splitSum + 0.001 && (
                <>
                  <span style={{ color: 'var(--white-40)' }}>Org retains</span>
                  <span style={{ color: 'var(--white-50)' }}>{fmt(total - splitSum)}</span>
                </>
              )}
            </div>
          </div>

          {splits.map((split, si) => {
            const teamName  = teams.find(t => t.id === split.teamId)?.name ?? split.teamId;
            const teamYears = teams.find(t => t.id === split.teamId)?.years ?? [];
            const yearLabel = teamYears.find(y => y.id === split.programYearId);
            const instSum   = split.installments.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
            return (
              <div key={si} className={styles.detailSection} style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <p className={styles.detailSectionTitle} style={{ margin: 0 }}>
                    {teamName} — {yearLabel ? `${yearLabel.name} (${yearLabel.year})` : '—'}
                  </p>
                  <strong style={{ color: 'var(--white-90)', fontSize: '0.95rem' }}>
                    {fmt(parseFloat(split.amount) || 0)}
                  </strong>
                </div>
                <div style={{ fontSize: '0.83rem', color: 'var(--white-50)', marginBottom: '0.5rem' }}>
                  {split.splitMethod === 'percentage' && `${split.splitValue}% of total`}
                  {split.splitMethod === 'sessions'   && `${split.splitValue} sessions`}
                  {split.splitMethod === 'fixed'      && 'Fixed amount'}
                  {' · '}
                  {split.paymentSchedule === 'standard' ? 'Lump sum' : `${split.installments.length} installments`}
                  {Math.abs(instSum - (parseFloat(split.amount) || 0)) > 0.01 && (
                    <span style={{ color: '#f87171' }}> ⚠ installment total {fmt(instSum)} ≠ split amount</span>
                  )}
                </div>
                <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', color: 'var(--white-30)', paddingBottom: '0.3rem', fontWeight: 600 }}>#</th>
                      <th style={{ textAlign: 'left', color: 'var(--white-30)', paddingBottom: '0.3rem', fontWeight: 600 }}>Amount</th>
                      <th style={{ textAlign: 'left', color: 'var(--white-30)', paddingBottom: '0.3rem', fontWeight: 600 }}>Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {split.installments.map((inst, ii) => (
                      <tr key={ii}>
                        <td style={{ color: 'var(--white-40)', padding: '0.2rem 0' }}>{inst.installmentNumber}</td>
                        <td style={{ color: 'var(--white-80)', padding: '0.2rem 0' }}>{fmt(parseFloat(inst.amount) || 0)}</td>
                        <td style={{ color: 'var(--white-60)', padding: '0.2rem 0' }}>{inst.dueDate || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {error && <p className={styles.errorText} style={{ margin: '1rem 0' }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
            <button type="button" className={styles.btnSecondary} onClick={() => { setError(''); setStep(1); }}>
              <ChevronLeft size={16} /> Back
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Creating…' : 'Confirm Allocation'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
