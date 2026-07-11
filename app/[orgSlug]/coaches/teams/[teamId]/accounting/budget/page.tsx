'use client';
import { useState, useEffect, useCallback, useRef, use } from 'react';
import Link from 'next/link';
import { BarChart3, Plus, X, ChevronDown, ChevronRight, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import BudgetItemPicker from '@/components/accounting/BudgetItemPicker';
import type {
  RepBudgetPlan,
  RepBudgetLineWithPeriods,
  BudgetCategoryWithItems,
  RepInstallmentPreviewRow,
} from '@/lib/types';
import styles from './budget.module.css';
import shared from '../../../../coaches.module.css';

function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

interface PeriodRow { label: string; date: string; amount: string }
const BLANK_PERIOD: PeriodRow = { label: '', date: '', amount: '' };

interface LineForm {
  description: string;
  categoryId: string;
  itemId: string | null;
  categoryName: string;
  itemName: string;
  totalAmount: string;
  notes: string;
  usePeriods: boolean;
  periodMode: 'amount' | 'percent';
  periods: PeriodRow[];
}

const BLANK_FORM: LineForm = {
  description:  '',
  categoryId:   '',
  itemId:       null,
  categoryName: '',
  itemName:     '',
  totalAmount:  '',
  notes:        '',
  usePeriods:   false,
  periodMode:   'amount',
  periods:      [{ ...BLANK_PERIOD }],
};

interface InstallmentRow { date: string; amount: string }
const DEFAULT_INSTALLMENT: InstallmentRow = { date: '', amount: '' };

export default function BudgetPlannerPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const params = use(paramsPromise);
  const { orgSlug, teamId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const [plan,       setPlan]       = useState<RepBudgetPlan | null>(null);
  const [categories, setCategories] = useState<BudgetCategoryWithItems[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  // Optional single "season total" (owner decision 2026-07-08: both budget styles
  // coexist — a total above the itemized sum shows as a non-itemized buffer).
  const [seasonTotal,   setSeasonTotal]   = useState<number | null>(null);
  const [editingSeason, setEditingSeason] = useState(false);
  const [seasonInput,   setSeasonInput]   = useState('');
  const [seasonSaving,  setSeasonSaving]  = useState(false);
  const [seasonError,   setSeasonError]   = useState('');

  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());

  // Add/Edit modal
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editingLine, setEditingLine] = useState<RepBudgetLineWithPeriods | null>(null);
  const [form,        setForm]        = useState<LineForm>(BLANK_FORM);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState('');

  // Delete confirm
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [deleting,    setDeleting]    = useState(false);

  // Generate installments modal
  const [genOpen,          setGenOpen]          = useState(false);
  const [genInstallments,  setGenInstallments]  = useState<InstallmentRow[]>([{ ...DEFAULT_INSTALLMENT }]);
  const [preview,          setPreview]          = useState<RepInstallmentPreviewRow[] | null>(null);
  const [previewLoading,   setPreviewLoading]   = useState(false);
  const [previewError,     setPreviewError]     = useState('');
  const [generating,       setGenerating]       = useState(false);
  const [generateError,    setGenerateError]    = useState('');
  const [generateSuccess,  setGenerateSuccess]  = useState(false);

  const assignment = assignments.find(a => a.teamId === teamId);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [planRes, catRes] = await Promise.all([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan`),
        fetch(`/api/coaches/${orgSlug}/budget-items`),
      ]);
      const planData = await planRes.json();
      const catData  = await catRes.json();
      if (!planRes.ok) throw new Error(planData.error ?? 'Failed to load plan');
      setPlan(planData.plan);
      setSeasonTotal(planData.seasonBudgetAmount ?? null);
      setSeasonInput(planData.seasonBudgetAmount != null ? String(planData.seasonBudgetAmount) : '');
      setCategories(catData.categories ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => { load(); }, [load]);

  // Deep link from the Money hub / Dues page: ?generate=1 opens the Generate
  // Installments modal directly (one-shot; only when the CTA would be shown,
  // which includes money-write capability — read-only coaches never get it).
  const genDeepLinkDone = useRef(false);
  useEffect(() => {
    if (genDeepLinkDone.current || loading || !plan) return;
    const a = assignments.find(x => x.teamId === teamId);
    if (!a) return; // assignments still loading — try again next render
    genDeepLinkDone.current = true;
    if (a.capabilities.money !== 'write') return;
    const wantsGenerate = typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('generate') === '1';
    if (wantsGenerate && plan.lines.length > 0 && !plan.hasInstallments) {
      setGenOpen(true);
      setGenerateSuccess(false);
      setPreview(null);
      setGenInstallments([{ ...DEFAULT_INSTALLMENT }]);
    }
  }, [loading, plan, assignments, teamId]);

  async function saveSeasonTotal() {
    setSeasonError('');
    setSeasonSaving(true);
    try {
      const amount = parseFloat(seasonInput);
      if (isNaN(amount) || amount < 0) throw new Error('Enter a valid amount');
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgetAmount: amount }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setSeasonTotal(amount);
      setEditingSeason(false);
    } catch (e: unknown) {
      setSeasonError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSeasonSaving(false);
    }
  }

  function openAdd() {
    setEditingLine(null);
    setForm(BLANK_FORM);
    setSaveError('');
    setModalOpen(true);
  }

  function openEdit(line: RepBudgetLineWithPeriods) {
    setEditingLine(line);
    setForm({
      description:  line.description,
      categoryId:   line.categoryId ?? '',
      itemId:       line.itemId,
      categoryName: line.categoryName ?? '',
      itemName:     line.itemName    ?? line.description,
      totalAmount:  String(line.totalAmount),
      notes:        line.notes ?? '',
      usePeriods:   line.periods.length > 0,
      periodMode:   'amount', // stored periods are always dollars
      periods:      line.periods.length > 0
        ? line.periods.map(p => ({ label: p.periodLabel, date: p.periodDate ?? '', amount: String(p.amount) }))
        : [{ ...BLANK_PERIOD }],
    });
    setSaveError('');
    setModalOpen(true);
  }

  function periodSum(): number {
    return form.periods.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  }

  function periodSumError(): string | null {
    if (!form.usePeriods || form.periods.length === 0) return null;
    const total = parseFloat(form.totalAmount) || 0;
    if (form.periodMode === 'percent') {
      if (total <= 0) return 'Enter the line total first — percentages are computed against it';
      const diff = Math.abs(periodSum() - 100);
      if (diff > 0.1) return `Percentages (${periodSum().toFixed(1)}%) must add up to 100%`;
      return null;
    }
    if (total <= 0) return null;
    const diff = Math.abs(periodSum() - total);
    if (diff > 0.02) return `Period total (${fmt(periodSum())}) must equal line total (${fmt(total)})`;
    return null;
  }

  // Convert the working period values to the DOLLAR amounts we store. In percent
  // mode the last period absorbs the rounding remainder so the sum is exact to
  // the cent; dollar mode passes values through.
  function periodDollarAmounts(): number[] {
    const total = parseFloat(form.totalAmount) || 0;
    const values = form.periods.map(p => parseFloat(p.amount) || 0);
    if (form.periodMode !== 'percent') return values;
    const dollars = values.map(v => Math.round(total * v) / 100);
    if (dollars.length > 0) {
      const allButLast = dollars.slice(0, -1).reduce((s, v) => s + v, 0);
      dollars[dollars.length - 1] = Math.round((total - allButLast) * 100) / 100;
    }
    return dollars;
  }

  // Toggle $ ⇄ % — converting existing values when the line total allows it.
  // The last row absorbs the rounding remainder (an equal 3-way split would
  // otherwise convert to 33.3×3 = 99.9% and spuriously fail validation).
  function switchPeriodMode(mode: 'amount' | 'percent') {
    setForm(f => {
      if (f.periodMode === mode) return f;
      const total = parseFloat(f.totalAmount) || 0;
      const values = f.periods.map(p => parseFloat(p.amount));
      const allNumeric = total > 0 && values.length > 0 && values.every(v => !isNaN(v));
      const converted = values.map(v => {
        if (isNaN(v) || total <= 0) return null;
        return mode === 'percent'
          ? Math.round((v / total) * 1000) / 10   // $ → %
          : Math.round(total * v) / 100;          // % → $
      });
      if (allNumeric) {
        const whole = mode === 'percent' ? 100 : total;
        const allButLast = converted.slice(0, -1).reduce((s: number, v) => s + (v ?? 0), 0);
        const scale = mode === 'percent' ? 10 : 100; // one decimal for %, cents for $
        converted[converted.length - 1] = Math.round((whole - allButLast) * scale) / scale;
      }
      const periods = f.periods.map((p, i) => ({
        ...p,
        amount: converted[i] == null ? '' : String(converted[i]),
      }));
      return { ...f, periodMode: mode, periods };
    });
  }

  // Fill periods evenly (in the current mode); the last row absorbs the remainder.
  function splitEvenly() {
    setForm(f => {
      const n = f.periods.length;
      if (n === 0) return f;
      const total = parseFloat(f.totalAmount) || 0;
      const whole = f.periodMode === 'percent' ? 100 : total;
      if (whole <= 0) return f;
      const share = Math.floor((whole / n) * 100) / 100;
      const last = Math.round((whole - share * (n - 1)) * 100) / 100;
      const periods = f.periods.map((p, i) => ({ ...p, amount: String(i === n - 1 ? last : share) }));
      return { ...f, periods };
    });
  }

  async function handleSaveLine() {
    const description = form.description.trim() || form.itemName.trim();
    const totalAmount = parseFloat(form.totalAmount);

    if (!description) { setSaveError('Description is required'); return; }
    if (isNaN(totalAmount) || totalAmount <= 0) { setSaveError('Enter a valid total amount'); return; }
    if (form.usePeriods && periodSumError()) { setSaveError(periodSumError()!); return; }
    if (form.usePeriods) {
      for (const p of form.periods) {
        if (!p.label.trim()) { setSaveError('Each period must have a label'); return; }
        if (!p.date)          { setSaveError('Each period must have a date'); return; }
      }
    }

    setSaving(true);
    setSaveError('');
    try {
      const isEdit = !!editingLine;
      const url    = isEdit
        ? `/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/lines/${editingLine!.id}`
        : `/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/lines`;

      const res  = await fetch(url, {
        method:  isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          categoryId:  form.categoryId || null,
          itemId:      form.itemId,
          totalAmount,
          notes:       form.notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');

      const lineId = isEdit ? editingLine!.id : data.line.id;

      // Save period distribution (always stored as dollars; % mode converts here)
      if (form.usePeriods && form.periods.length > 0) {
        const dollarAmounts = periodDollarAmounts();
        const periodsPayload = form.periods.map((p, i) => ({
          periodLabel: p.label.trim(),
          periodDate:  p.date || null,
          amount:      dollarAmounts[i],
          sortOrder:   i,
        }));
        await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/lines/${lineId}/periods`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ periods: periodsPayload }),
        });
      } else if (!form.usePeriods && isEdit && editingLine!.periods.length > 0) {
        // Clear periods if user toggled off
        await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/lines/${lineId}/periods`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ periods: [] }),
        });
      }

      setModalOpen(false);
      await load();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(lineId: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/lines/${lineId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to delete');
      }
      setDeletingId(null);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  async function loadPreview() {
    const validInstallments = genInstallments.filter(i => i.date && parseFloat(i.amount) > 0);
    if (validInstallments.length === 0) { setPreviewError('Add at least one installment with a date and amount'); return; }

    setPreviewLoading(true);
    setPreviewError('');
    setPreview(null);

    const qs = new URLSearchParams({ installmentCount: String(validInstallments.length) });
    validInstallments.forEach(i => qs.append('dates[]', i.date));

    try {
      const res  = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/installment-preview?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Preview failed');
      setPreview(data.preview);
    } catch (e: unknown) {
      setPreviewError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleGenerate() {
    const validInstallments = genInstallments.filter(i => i.date && parseFloat(i.amount) > 0);
    if (!preview || validInstallments.length === 0) return;

    setGenerating(true);
    setGenerateError('');
    try {
      const res  = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/generate-installments`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installments: validInstallments.map((inst, i) => ({
            installmentNumber: i + 1,
            dueDate:           inst.date,
            amount:            parseFloat(inst.amount),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      setGenerateSuccess(true);
      await load();
    } catch (e: unknown) {
      setGenerateError(e instanceof Error ? e.message : 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  }

  // Group lines by category name for display
  function groupLines(lines: RepBudgetLineWithPeriods[]) {
    const grouped: Map<string, RepBudgetLineWithPeriods[]> = new Map();
    for (const line of lines) {
      const key = line.categoryName ?? 'Uncategorized';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(line);
    }
    return [...grouped.entries()];
  }

  if (ctxLoading) return <p className={styles.muted}>Loading…</p>;
  if (!assignment) return <p className={styles.muted}>Team not found.</p>;

  const totalBudget = plan?.totalBudget ?? 0; // itemized sum
  const groups      = groupLines(plan?.lines ?? []);
  // Read-only money assistants see the plan but no write affordances (server
  // enforces regardless; this matches the gating on the Dues/BvA pages).
  const moneyCanWrite = assignment.capabilities.money === 'write';

  // Reconciliation: effective total = the larger of the season total and the itemized
  // sum; a season total above the itemized sum is a "non-itemized buffer", never a
  // silent disagreement. No season total → the total IS the sum of line items.
  const effectiveTotal = Math.max(totalBudget, seasonTotal ?? 0);
  const buffer         = seasonTotal != null && seasonTotal > totalBudget ? seasonTotal - totalBudget : 0;
  const overItemized   = seasonTotal != null && seasonTotal > 0 && totalBudget > seasonTotal;

  return (
    <div className={styles.page}>
      {/* Header */}
      <Link href={`${base}/accounting`} className={shared.backLink}>
        <ArrowLeft size={14} aria-hidden /> Back to Money
      </Link>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><BarChart3 size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>Season Budget Plan</h1>
            <p className={styles.pageSub}>{assignment.programYearName} — estimated costs</p>
          </div>
        </div>
        {moneyCanWrite && (
          <button type="button" className={shared.btnSecondary} onClick={openAdd}>
            <Plus size={15} /> Add Line
          </button>
        )}
      </div>

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : (
        <>
          {/* Budget summary banner — reconciles the optional season total with the
              itemized sum (buffer / over-itemized / sum-of-lines states). */}
          <div className={styles.summaryBanner}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Total Planned Budget</span>
              <span className={styles.summaryValue}>{fmt(effectiveTotal)}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Season Total</span>
              {editingSeason ? (
                <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    step="0.01"
                    value={seasonInput}
                    onChange={e => setSeasonInput(e.target.value)}
                    style={{ width: 110 }}
                    autoFocus
                  />
                  <button type="button" className={shared.btnPrimary} style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }} disabled={seasonSaving} onClick={saveSeasonTotal}>
                    {seasonSaving ? '…' : 'Save'}
                  </button>
                  <button type="button" className={shared.btnGhost} style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }} onClick={() => { setEditingSeason(false); setSeasonError(''); }}>
                    Cancel
                  </button>
                </span>
              ) : (
                <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
                  <span className={styles.summaryValue}>{seasonTotal != null ? fmt(seasonTotal) : '—'}</span>
                  {moneyCanWrite && (
                    <button type="button" className={styles.inlineLink} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: '0.78rem' }} onClick={() => setEditingSeason(true)}>
                      {seasonTotal != null ? 'Edit' : 'Set'}
                    </button>
                  )}
                </span>
              )}
              {seasonError && <span className={styles.errorText} style={{ fontSize: '0.75rem' }}>{seasonError}</span>}
            </div>
            {buffer > 0 && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Non-Itemized Buffer</span>
                <span className={styles.summaryValue}>{fmt(buffer)}</span>
              </div>
            )}
            {plan && plan.rosterCount > 0 && effectiveTotal > 0 && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Per Player</span>
                <span className={styles.summaryValue}>{fmt(effectiveTotal / plan.rosterCount)}</span>
              </div>
            )}
            {plan && plan.rosterCount > 0 && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Roster Size</span>
                <span className={styles.summaryValue}>{plan.rosterCount} players</span>
              </div>
            )}
          </div>
          {overItemized && (
            <p className={styles.errorText} style={{ margin: '-0.5rem 0 1rem', fontSize: '0.82rem' }}>
              Your line items ({fmt(totalBudget)}) exceed the season total ({fmt(seasonTotal ?? 0)}) — the plan uses the itemized sum. Update the season total or trim line items.
            </p>
          )}
          {seasonTotal == null && totalBudget > 0 && (
            <p className={styles.muted} style={{ margin: '-0.5rem 0 1rem', fontSize: '0.8rem' }}>
              No season total set — your total planned budget is the sum of your line items.
            </p>
          )}
          {buffer > 0 && totalBudget > 0 && (
            <p className={styles.muted} style={{ margin: '-0.5rem 0 1rem', fontSize: '0.8rem' }}>
              {fmt(buffer)} of your season total isn&apos;t itemized yet — it shows as a buffer until you add line items for it.
            </p>
          )}

          {/* Line items grouped by category */}
          {groups.length === 0 ? (
            <div className={styles.emptyState}>
              <BarChart3 size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p>No budget lines yet.</p>
              <p className={styles.emptyHint}>Add cost lines to build your season budget estimate.</p>
              {moneyCanWrite && (
                <button type="button" className={shared.btnPrimary} style={{ marginTop: '1rem' }} onClick={openAdd}>
                  + Add First Line
                </button>
              )}
            </div>
          ) : (
            <div className={styles.linesContainer}>
              {groups.map(([catName, lines]) => (
                <div key={catName} className={styles.categoryGroup}>
                  <div className={styles.categoryHeader}>
                    <span className={styles.categoryName}>{catName}</span>
                    <span className={styles.categoryTotal}>
                      {fmt(lines.reduce((s, l) => s + l.totalAmount, 0))}
                    </span>
                  </div>
                  {lines.map(line => {
                    const expanded = expandedLines.has(line.id);
                    return (
                      <div key={line.id} className={styles.lineRow}>
                        <div className={styles.lineMain}>
                          {line.periods.length > 0 && (
                            <button
                              type="button"
                              className={styles.expandBtn}
                              onClick={() => setExpandedLines(prev => {
                                const next = new Set(prev);
                                expanded ? next.delete(line.id) : next.add(line.id);
                                return next;
                              })}
                            >
                              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          )}
                          {line.periods.length === 0 && <span className={styles.expandSpacer} />}

                          <div className={styles.lineInfo}>
                            <span className={styles.lineDesc}>{line.description}</span>
                            {line.notes && <span className={styles.lineNotes}>{line.notes}</span>}
                          </div>

                          <span className={styles.lineAmount}>{fmt(line.totalAmount)}</span>

                          {moneyCanWrite && <div className={styles.lineActions}>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              title="Edit line"
                              onClick={() => openEdit(line)}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                              title="Delete line"
                              onClick={() => setDeletingId(line.id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>}
                        </div>

                        {/* Period breakdown */}
                        {expanded && line.periods.length > 0 && (
                          <div className={styles.periodsTable}>
                            {line.periods.map((p, i) => (
                              <div key={i} className={styles.periodRow}>
                                <span className={styles.periodLabel}>{p.periodLabel}</span>
                                {p.periodDate && (
                                  <span className={styles.periodDate}>
                                    {new Date(p.periodDate + 'T00:00:00').toLocaleDateString('en-CA', {
                                      month: 'short', day: 'numeric', year: 'numeric',
                                    })}
                                  </span>
                                )}
                                <span className={styles.periodAmount}>{fmt(p.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Non-itemized buffer pseudo-row — the slice of the season total not
                  yet covered by line items. */}
              {buffer > 0 && (
                <div className={styles.categoryGroup}>
                  <div className={styles.categoryHeader}>
                    <span className={styles.categoryName}>Non-itemized buffer</span>
                    <span className={styles.categoryTotal}>{fmt(buffer)}</span>
                  </div>
                </div>
              )}

              {/* Grand total row */}
              <div className={styles.grandTotal}>
                <span>Total planned budget{seasonTotal == null ? ' (sum of line items)' : ''}</span>
                <span className={styles.grandTotalValue}>{fmt(effectiveTotal)}</span>
              </div>
            </div>
          )}

          {/* Generate Installments CTA */}
          {moneyCanWrite && plan && plan.lines.length > 0 && !plan.hasInstallments && (
            <div className={styles.generateSection}>
              <div>
                <p className={styles.generateTitle}>Ready to assign dues to players?</p>
                <p className={styles.generateSub}>
                  Generate a player installment schedule based on this budget.
                  Each active roster player gets the same due dates and amounts.
                </p>
              </div>
              <button type="button" className={shared.btnPrimary} onClick={() => { setGenOpen(true); setGenerateSuccess(false); setPreview(null); setGenInstallments([{ ...DEFAULT_INSTALLMENT }]); }}>
                Generate Installments
              </button>
            </div>
          )}

          {plan?.hasInstallments && (
            <div className={styles.installmentsExist}>
              ✓ Player installments have been generated.{' '}
              <Link href={`${base}/accounting/dues`} className={styles.inlineLink}>View dues →</Link>
            </div>
          )}

          {effectiveTotal > 0 && (
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <Link href={`${base}/accounting/budget-vs-actual`} className={styles.inlineLink}>
                View Budget vs. Actual →
              </Link>
            </div>
          )}
        </>
      )}

      {/* ── Add / Edit Line Modal ───────────────────────────────────────────── */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{editingLine ? 'Edit Budget Line' : 'Add Budget Line'}</h3>
              <button className={styles.modalCloseBtn} onClick={() => setModalOpen(false)}><X size={16} /></button>
            </div>

            <p className={styles.formHint}><span className={styles.labelRequired}>*</span> Required</p>

            {/* Item picker */}
            <div className={styles.field}>
              <label className={styles.label}>Category &amp; Item</label>
              <BudgetItemPicker
                categories={categories}
                value={form.categoryId ? {
                  categoryId:      form.categoryId,
                  categoryName:    form.categoryName,
                  itemId:          form.itemId,
                  itemName:        form.itemName,
                  suggestedAmount: null,
                } : null}
                onChange={v => setForm(f => ({
                  ...f,
                  categoryId:   v.categoryId,
                  categoryName: v.categoryName,
                  itemId:       v.itemId,
                  itemName:     v.itemName,
                  // Description stays user-typed only — the save path already falls
                  // back to the item name when it's left blank (no "Misc" stamping).
                  totalAmount:  f.totalAmount || (v.suggestedAmount ? String(v.suggestedAmount) : f.totalAmount),
                }))}
                createItemEndpoint={`/api/coaches/${orgSlug}/budget-items`}
                createItemMode="coach"
                allowCreateCategory
              />
            </div>

            {/* Description override */}
            <div className={styles.field}>
              <label className={styles.label}>Description</label>
              <input
                className={styles.input}
                type="text"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value.slice(0, 200) }))}
                placeholder={form.itemName || 'e.g. May tournament entry fee'}
                maxLength={200}
              />
            </div>

            {/* Total amount + period toggle */}
            <div className={styles.formRow}>
              <div className={styles.field} style={{ flex: 1 }}>
                <label className={styles.label}>Total Amount ($) <span className={styles.labelRequired}>*</span></label>
                <input
                  className={styles.input}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.totalAmount}
                  onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div style={{ paddingTop: '1.6rem' }}>
                <label className={styles.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={form.usePeriods}
                    onChange={e => setForm(f => ({ ...f, usePeriods: e.target.checked }))}
                  />{' '}
                  Split by period
                </label>
              </div>
            </div>

            {/* Period distribution */}
            {form.usePeriods && (
              <div className={styles.periodsSection}>
                <div className={styles.periodsSectionHeader}>
                  <span className={styles.label}>Period Breakdown</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ display: 'inline-flex', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, overflow: 'hidden' }}>
                      {(['amount', 'percent'] as const).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => switchPeriodMode(mode)}
                          style={{
                            padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', border: 'none',
                            background: form.periodMode === mode ? 'rgba(255,255,255,0.14)' : 'transparent',
                            color: form.periodMode === mode ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)',
                          }}
                        >
                          {mode === 'amount' ? '$' : '%'}
                        </button>
                      ))}
                    </span>
                    <button type="button" className={styles.addPeriodBtn} onClick={splitEvenly}>
                      Split evenly
                    </button>
                    <button
                      type="button"
                      className={styles.addPeriodBtn}
                      onClick={() => setForm(f => ({ ...f, periods: [...f.periods, { ...BLANK_PERIOD }] }))}
                    >
                      + Add Period
                    </button>
                  </span>
                </div>
                {form.periods.map((p, i) => (
                  <div key={i} className={styles.periodInputRow}>
                    <input
                      className={styles.input}
                      style={{ flex: 2 }}
                      type="text"
                      placeholder="Label (e.g. May)"
                      value={p.label}
                      onChange={e => setForm(f => {
                        const ps = [...f.periods]; ps[i] = { ...ps[i], label: e.target.value }; return { ...f, periods: ps };
                      })}
                    />
                    <input
                      className={styles.input}
                      style={{ flex: 1.5 }}
                      type="date"
                      value={p.date}
                      onChange={e => setForm(f => {
                        const ps = [...f.periods]; ps[i] = { ...ps[i], date: e.target.value }; return { ...f, periods: ps };
                      })}
                    />
                    <input
                      className={styles.input}
                      style={{ flex: 1 }}
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder={form.periodMode === 'percent' ? '%' : '$'}
                      value={p.amount}
                      onChange={e => setForm(f => {
                        const ps = [...f.periods]; ps[i] = { ...ps[i], amount: e.target.value }; return { ...f, periods: ps };
                      })}
                    />
                    {form.periodMode === 'percent' && (
                      <span style={{ flexShrink: 0, minWidth: 70, textAlign: 'right', fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', fontVariantNumeric: 'tabular-nums' }}>
                        {(parseFloat(form.totalAmount) || 0) > 0 && parseFloat(p.amount) > 0
                          ? fmt(((parseFloat(form.totalAmount) || 0) * parseFloat(p.amount)) / 100)
                          : '—'}
                      </span>
                    )}
                    {form.periods.length > 1 && (
                      <button
                        type="button"
                        className={styles.removePeriodBtn}
                        onClick={() => setForm(f => ({ ...f, periods: f.periods.filter((_, j) => j !== i) }))}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
                {(() => {
                  const err = periodSumError();
                  const sum = periodSum();
                  const total = parseFloat(form.totalAmount) || 0;
                  return (
                    <div className={`${styles.periodSumRow} ${err ? styles.periodSumError : ''}`}>
                      <span>Period total</span>
                      <span>
                        {form.periodMode === 'percent'
                          ? <>{sum.toFixed(1)}% {total > 0 && `= ${fmt((total * sum) / 100)}`}</>
                          : <>{fmt(sum)} {total > 0 && `/ ${fmt(total)}`}</>}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Notes */}
            <div className={styles.field}>
              <label className={styles.label}>Notes</label>
              <input
                className={styles.input}
                type="text"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any additional context"
                maxLength={500}
              />
            </div>

            {saveError && <p className={styles.errorText}>{saveError}</p>}
            <div className={styles.modalFooter}>
              <button type="button" className={shared.btnGhost} onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="button" className={shared.btnPrimary} onClick={handleSaveLine} disabled={saving}>
                {saving ? 'Saving…' : editingLine ? 'Save Changes' : 'Add Line'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ───────────────────────────────────────────────────── */}
      {deletingId && (
        <div className={styles.modalOverlay} onClick={() => setDeletingId(null)}>
          <div className={styles.modal} style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Delete Budget Line?</h3>
              <button className={styles.modalCloseBtn} onClick={() => setDeletingId(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', margin: '0 0 1.25rem' }}>
              This will also remove any period breakdown for this line. This cannot be undone.
            </p>
            <div className={styles.modalFooter}>
              <button type="button" className={shared.btnGhost} onClick={() => setDeletingId(null)}>Cancel</button>
              <button
                type="button"
                className={shared.btnDanger}
                disabled={deleting}
                onClick={() => handleDelete(deletingId)}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generate Installments Modal ──────────────────────────────────────── */}
      {genOpen && (
        <div className={styles.modalOverlay} onClick={() => setGenOpen(false)}>
          <div className={`${styles.modal} ${styles.modalLg}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Generate Player Installments</h3>
              <button className={styles.modalCloseBtn} onClick={() => setGenOpen(false)}><X size={16} /></button>
            </div>

            {generateSuccess ? (
              <div className={styles.successState}>
                <p>✓ Installments generated successfully.</p>
                <Link href={`${base}/accounting/dues`} className={shared.btnPrimary} style={{ marginTop: '1rem' }}>
                  View Player Dues →
                </Link>
              </div>
            ) : (
              <>
                <p className={styles.genInstructions}>
                  Set due dates and amounts for each installment. Every active roster player will receive the same schedule.
                  Total budget: <strong>{fmt(effectiveTotal)}</strong> ÷ {plan?.rosterCount ?? '?'} players.
                </p>

                <div className={styles.genInstallmentsSection}>
                  <div className={styles.genInstallmentsHeader}>
                    <span className={styles.label}>Installments</span>
                    <button
                      type="button"
                      className={styles.addPeriodBtn}
                      onClick={() => { setGenInstallments(p => [...p, { ...DEFAULT_INSTALLMENT }]); setPreview(null); }}
                    >
                      + Add
                    </button>
                  </div>
                  {genInstallments.map((inst, i) => (
                    <div key={i} className={styles.periodInputRow}>
                      <span className={styles.installmentNum}>#{i + 1}</span>
                      <input
                        className={styles.input}
                        type="date"
                        value={inst.date}
                        min={today()}
                        onChange={e => { setGenInstallments(p => { const n=[...p]; n[i]={...n[i],date:e.target.value}; return n; }); setPreview(null); }}
                      />
                      <input
                        className={styles.input}
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Amount per player ($)"
                        value={inst.amount}
                        onChange={e => { setGenInstallments(p => { const n=[...p]; n[i]={...n[i],amount:e.target.value}; return n; }); setPreview(null); }}
                      />
                      {genInstallments.length > 1 && (
                        <button
                          type="button"
                          className={styles.removePeriodBtn}
                          onClick={() => { setGenInstallments(p => p.filter((_, j) => j !== i)); setPreview(null); }}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {previewError && <p className={styles.errorText}>{previewError}</p>}

                {!preview ? (
                  <div className={styles.modalFooter}>
                    <button type="button" className={shared.btnGhost} onClick={() => setGenOpen(false)}>Cancel</button>
                    <button type="button" className={shared.btnSecondary} onClick={loadPreview} disabled={previewLoading}>
                      {previewLoading ? 'Loading preview…' : 'Preview'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={styles.previewSection}>
                      <div className={styles.label} style={{ marginBottom: '0.6rem' }}>Preview — {preview.length} players</div>
                      <div className={styles.previewTable}>
                        <div className={styles.previewHeader}>
                          <span>Player</span>
                          {preview[0]?.installments.map((_, i) => (
                            <span key={i} style={{ textAlign: 'right' }}>#{i + 1}</span>
                          ))}
                        </div>
                        {preview.slice(0, 10).map(row => (
                          <div key={row.playerId} className={styles.previewRow}>
                            <span>{[row.playerLastName, row.playerFirstName].filter(Boolean).join(', ')}</span>
                            {row.installments.map((inst, i) => (
                              <span key={i} style={{ textAlign: 'right' }}>{fmt(inst.amount)}</span>
                            ))}
                          </div>
                        ))}
                        {preview.length > 10 && (
                          <div className={styles.previewMore}>+{preview.length - 10} more players</div>
                        )}
                      </div>
                    </div>

                    {generateError && <p className={styles.errorText}>{generateError}</p>}

                    <div className={styles.modalFooter}>
                      <button type="button" className={shared.btnGhost} onClick={() => setPreview(null)}>Back</button>
                      <button type="button" className={shared.btnPrimary} onClick={handleGenerate} disabled={generating}>
                        {generating ? 'Generating…' : `Confirm & Generate for ${preview.length} Players`}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
