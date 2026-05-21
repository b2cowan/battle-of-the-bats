'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { DollarSign, ChevronDown, ChevronRight, Pencil, Trash2, Plus, X, Check } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import BudgetItemPicker, { type BudgetItemSelection } from '@/components/accounting/BudgetItemPicker';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import ExportMenu from '@/components/admin/ExportMenu';
import type { BudgetCategoryWithItems } from '@/lib/types';
import styles from './budget.module.css';

// ── Export definition ─────────────────────────────────────────────────────────

const BUDGET_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Category',    key: 'category',    format: 'text'     },
  { label: 'Description', key: 'description', format: 'text'     },
  { label: 'Total',       key: 'total',       format: 'currency' },
  { label: 'Allocated',   key: 'allocated',   format: 'currency' },
  { label: 'Collected',   key: 'collected',   format: 'currency' },
  { label: 'Periods',     key: 'periodCount', format: 'number'   },
  { label: 'Allocated?',  key: 'isAllocated', format: 'text'     },
];

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface Period { id: string; label: string; periodDate: string | null; amount: number; sortOrder: number; }
interface AllocationSummary { id: string; teamCount: number; totalAllocated: number; collected: number; outstanding: number; }
interface BudgetLine {
  id: string;
  description: string;
  totalAmount: number;
  notes: string | null;
  sortOrder: number;
  categoryId: string | null;
  itemId: string | null;
  itemName: string | null;
  createdAt: string;
  periods: Period[];
  allocation: AllocationSummary | null;
}
interface CategoryGroup { id: string; name: string; sortOrder: number; lines: BudgetLine[]; }
interface Summary { totalBudgeted: number; totalAllocated: number; totalCollected: number; orgHeadroom: number; }
interface PlanData {
  year: number;
  availableYears: number[];
  summary: Summary;
  categories: CategoryGroup[];
  uncategorized: BudgetLine[];
}

interface PeriodDraft { label: string; periodDate: string; amount: string; }

const BLANK_PERIOD: PeriodDraft = { label: '', periodDate: '', amount: '' };

function blankPeriods(): PeriodDraft[] { return [{ ...BLANK_PERIOD }]; }

export default function OrgBudgetPage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  const canWrite = userRole === 'owner' || userRole === 'treasurer';

  const [year, setYear]     = useState(new Date().getFullYear());
  const [plan, setPlan]     = useState<PlanData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError]   = useState('');

  // BudgetItemPicker data
  const [categories, setCategories] = useState<BudgetCategoryWithItems[]>([]);

  // Add-line form state
  const [addOpen,       setAddOpen]       = useState(false);
  const [addPicker,     setAddPicker]     = useState<BudgetItemSelection | null>(null);
  const [addDesc,       setAddDesc]       = useState('');
  const [addAmount,     setAddAmount]     = useState('');
  const [addNotes,      setAddNotes]      = useState('');
  const [addPeriods,    setAddPeriods]    = useState<PeriodDraft[]>([]);
  const [showPeriodsForm, setShowPeriodsForm] = useState(false);
  const [addSaving,     setAddSaving]     = useState(false);
  const [addError,      setAddError]      = useState('');

  // Expanded periods rows
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());

  // Edit line state
  const [editLineId,    setEditLineId]    = useState<string | null>(null);
  const [editDesc,      setEditDesc]      = useState('');
  const [editAmount,    setEditAmount]    = useState('');
  const [editNotes,     setEditNotes]     = useState('');
  const [editSaving,    setEditSaving]    = useState(false);
  const [editError,     setEditError]     = useState('');

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async (y: number) => {
    setFetching(true);
    setError('');
    try {
      const res  = await fetch(`/api/admin/accounting/budget-plan?year=${y}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setPlan(data);
      setYear(y);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load budget plan.');
    } finally {
      setFetching(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    const res  = await fetch('/api/admin/accounting/budget-categories?scope=org');
    const data = await res.json();
    if (res.ok) setCategories(data.categories ?? []);
  }, []);

  useEffect(() => {
    if (currentOrg) {
      load(year);
      loadCategories();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg]);

  if (loading) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_accounting')) {
    return (
      <div className={styles.accessDenied}>
        <DollarSign size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the Accounting module.</p>
      </div>
    );
  }

  function toggleExpand(id: string) {
    setExpandedLines(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Add line ──────────────────────────────────────────────────────────────

  function handlePickerChange(sel: BudgetItemSelection) {
    setAddPicker(sel);
    if (!addDesc || addDesc === '') {
      setAddDesc(sel.itemName);
    }
    if (!addAmount && sel.suggestedAmount) {
      setAddAmount(String(sel.suggestedAmount));
    }
  }

  async function handleAddLine() {
    const desc = addDesc.trim();
    if (!desc) { setAddError('Description is required.'); return; }
    const amount = Number(addAmount);
    if (isNaN(amount) || amount <= 0) { setAddError('Amount must be a positive number.'); return; }

    // Validate periods if entered
    if (showPeriodsForm && addPeriods.some(p => p.label || p.amount)) {
      const filled = addPeriods.filter(p => p.label.trim() && p.amount);
      const periodSum = filled.reduce((s, p) => s + Number(p.amount), 0);
      if (Math.abs(periodSum - amount) > 0.01) {
        setAddError(`Period amounts (${fmt(periodSum)}) must equal line total (${fmt(amount)}).`);
        return;
      }
      for (const p of filled) {
        if (!p.label.trim()) { setAddError('Each period needs a label.'); return; }
        if (!p.amount || Number(p.amount) <= 0) { setAddError('Each period needs a positive amount.'); return; }
      }
    }

    setAddSaving(true);
    setAddError('');
    try {
      const res = await fetch('/api/admin/accounting/budget-plan/lines', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonYear:  year,
          categoryId:  addPicker?.categoryId ?? null,
          itemId:      addPicker?.itemId     ?? null,
          description: desc,
          totalAmount: amount,
          notes:       addNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to add line');

      // If periods are filled, upsert them
      if (showPeriodsForm) {
        const filled = addPeriods.filter(p => p.label.trim() && p.amount);
        if (filled.length > 0) {
          await fetch(`/api/admin/accounting/budget-plan/lines/${data.line.id}/periods`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              periods: filled.map((p, i) => ({
                label:      p.label.trim(),
                periodDate: p.periodDate || null,
                amount:     Number(p.amount),
                sortOrder:  i,
              })),
            }),
          });
        }
      }

      resetAddForm();
      await load(year);
    } catch (e: any) {
      setAddError(e.message ?? 'Failed to add line.');
    } finally {
      setAddSaving(false);
    }
  }

  function resetAddForm() {
    setAddOpen(false);
    setAddPicker(null);
    setAddDesc('');
    setAddAmount('');
    setAddNotes('');
    setAddPeriods([]);
    setShowPeriodsForm(false);
    setAddError('');
  }

  // ── Edit line ─────────────────────────────────────────────────────────────

  function startEdit(line: BudgetLine) {
    setEditLineId(line.id);
    setEditDesc(line.description);
    setEditAmount(String(line.totalAmount));
    setEditNotes(line.notes ?? '');
    setEditError('');
  }

  async function handleSaveEdit() {
    if (!editLineId) return;
    const desc = editDesc.trim();
    if (!desc) { setEditError('Description is required.'); return; }
    const amount = Number(editAmount);
    if (isNaN(amount) || amount <= 0) { setEditError('Amount must be a positive number.'); return; }

    setEditSaving(true);
    setEditError('');
    try {
      const res = await fetch(`/api/admin/accounting/budget-plan/lines/${editLineId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc, totalAmount: amount, notes: editNotes.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      setEditLineId(null);
      await load(year);
    } catch (e: any) {
      setEditError(e.message ?? 'Failed to save.');
    } finally {
      setEditSaving(false);
    }
  }

  // ── Delete line ───────────────────────────────────────────────────────────

  async function handleDelete(lineId: string) {
    setDeletingId(lineId);
    try {
      const res  = await fetch(`/api/admin/accounting/budget-plan/lines/${lineId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete');
      await load(year);
    } catch (e: any) {
      setError(e.message ?? 'Failed to delete line.');
    } finally {
      setDeletingId(null);
    }
  }

  // ── Period draft helpers ──────────────────────────────────────────────────

  function updatePeriod(idx: number, patch: Partial<PeriodDraft>) {
    setAddPeriods(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  }

  // ── Export ────────────────────────────────────────────────────────────────

  function buildBudgetExportRows() {
    if (!plan) return [];
    const rows: Record<string, unknown>[] = [];

    for (const cat of plan.categories) {
      for (const line of cat.lines) {
        rows.push({
          category:    cat.name,
          description: line.description,
          total:       line.totalAmount,
          allocated:   line.allocation?.totalAllocated ?? 0,
          collected:   line.allocation?.collected ?? 0,
          periodCount: line.periods.length,
          isAllocated: line.allocation ? 'Yes' : 'No',
        });
      }
    }
    for (const line of plan.uncategorized) {
      rows.push({
        category:    'Uncategorized',
        description: line.description,
        total:       line.totalAmount,
        allocated:   line.allocation?.totalAllocated ?? 0,
        collected:   line.allocation?.collected ?? 0,
        periodCount: line.periods.length,
        isAllocated: line.allocation ? 'Yes' : 'No',
      });
    }
    return rows;
  }

  function handleExportXLSX() {
    const rows     = buildBudgetExportRows();
    const headers  = serializeHeaders(BUDGET_EXPORT_COLS);
    const data     = serializeRows(rows as Record<string, unknown>[], BUDGET_EXPORT_COLS);
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'budget-plan', scope: String(year) },
      'xlsx',
    );
    downloadXLSX(filename, headers, data, 'Budget Plan');
  }

  function handleExportCSV() {
    const rows     = buildBudgetExportRows();
    const headers  = serializeHeaders(BUDGET_EXPORT_COLS);
    const data     = serializeRows(rows as Record<string, unknown>[], BUDGET_EXPORT_COLS);
    const filename = buildFilename(
      { org: currentOrg?.slug, dataset: 'budget-plan', scope: String(year) },
      'csv',
    );
    downloadCSVBlob(filename, generateCSV(headers, data));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const allLines = plan
    ? [...plan.categories.flatMap(c => c.lines), ...plan.uncategorized]
    : [];

  function renderLines(lines: BudgetLine[]) {
    return lines.map(line => {
      const isExpanded = expandedLines.has(line.id);
      const isEditing  = editLineId === line.id;
      const isDeleting = deletingId === line.id;

      return [
        // Main row
        <tr key={line.id} className={styles.tr}>
          <td className={styles.td} style={{ width: '40%' }}>
            {isEditing ? (
              <input
                className={styles.input}
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                maxLength={200}
                autoFocus
              />
            ) : (
              <>
                <div className={styles.lineDesc}>{line.description}</div>
                {line.itemName && <div className={styles.lineItem}>{line.itemName}</div>}
              </>
            )}
          </td>

          <td className={`${styles.td} ${styles.tdRight}`} style={{ width: '15%' }}>
            {isEditing ? (
              <input
                className={styles.input}
                type="number" min={0.01} step={0.01}
                value={editAmount}
                onChange={e => setEditAmount(e.target.value)}
                style={{ width: 100 }}
              />
            ) : (
              <span className={styles.lineAmount}>{fmt(line.totalAmount)}</span>
            )}
          </td>

          <td className={styles.td} style={{ width: '20%' }}>
            {line.periods.length > 0 && !isEditing && (
              <button
                type="button"
                className={styles.periodToggleBtn}
                onClick={() => toggleExpand(line.id)}
              >
                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {line.periods.length} period{line.periods.length !== 1 ? 's' : ''}
              </button>
            )}
          </td>

          <td className={styles.td} style={{ width: '15%' }}>
            {line.allocation ? (
              <span className={styles.badgeAllocated}>
                <Check size={11} /> Allocated
              </span>
            ) : null}
          </td>

          <td className={`${styles.td} ${styles.tdRight}`} style={{ width: '10%' }}>
            {isEditing ? (
              <div className={styles.actionsCell}>
                <button type="button" className={styles.btnIcon} onClick={handleSaveEdit} disabled={editSaving} title="Save">
                  <Check size={15} />
                </button>
                <button type="button" className={styles.btnIcon} onClick={() => setEditLineId(null)} title="Cancel">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className={styles.actionsCell}>
                {!line.allocation && canWrite && (
                  <Link
                    href={`${base}/accounting/budget/allocate/${line.id}`}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', whiteSpace: 'nowrap' }}
                  >
                    Allocate to Teams
                  </Link>
                )}
                {line.allocation && (
                  <Link
                    href={`${base}/rep-teams/allocations/${line.allocation.id}`}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem', whiteSpace: 'nowrap' }}
                  >
                    View Allocation →
                  </Link>
                )}
                {canWrite && (
                  <>
                    <button
                      type="button"
                      className={styles.btnIcon}
                      onClick={() => startEdit(line)}
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    {!line.allocation && (
                      <button
                        type="button"
                        className={`${styles.btnIcon} ${styles.btnIconDanger}`}
                        onClick={() => handleDelete(line.id)}
                        disabled={isDeleting}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </td>
        </tr>,

        // Edit error row
        isEditing && editError ? (
          <tr key={`${line.id}-edit-err`} className={styles.tr}>
            <td colSpan={5} className={styles.td}>
              <p className={styles.errorText}>{editError}</p>
            </td>
          </tr>
        ) : null,

        // Periods expand row
        isExpanded && line.periods.length > 0 && !isEditing ? (
          <tr key={`${line.id}-periods`} className={styles.periodsRow}>
            <td colSpan={5} className={styles.td}>
              <div className={styles.periodsInner}>
                <table className={styles.periodTable}>
                  <thead>
                    <tr>
                      <th className={styles.periodTh}>Period</th>
                      <th className={styles.periodTh}>Date</th>
                      <th className={styles.periodTh} style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {line.periods.map(p => (
                      <tr key={p.id} className={styles.periodTr}>
                        <td>{p.label}</td>
                        <td>{p.periodDate ?? '—'}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </td>
          </tr>
        ) : null,
      ];
    });
  }

  const noLines = !fetching && plan && allLines.length === 0;

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href={`${base}/accounting`}>Accounting</Link>
        <span>/</span>
        <span>Org Budget</span>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><DollarSign size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Org Budget</h1>
            <p className={styles.pageSub}>{currentOrg?.name} — season planning</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <ExportMenu
            formats={['xlsx', 'csv']}
            onExportXLSX={handleExportXLSX}
            onExportCSV={handleExportCSV}
            disabled={!plan || allLines.length === 0}
          />
          {canWrite && !addOpen && (
            <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
              <Plus size={15} /> Add Line
            </button>
          )}
        </div>
      </div>

      {/* Year selector */}
      <div className={styles.yearRow}>
        <span>Season year:</span>
        <select
          className={styles.yearSelect}
          value={year}
          onChange={e => load(Number(e.target.value))}
          disabled={fetching}
        >
          {(plan?.availableYears ?? [year]).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {error && <p className={styles.errorText} style={{ marginBottom: '1rem' }}>{error}</p>}

      {/* Summary cards */}
      {plan && (
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Total Budgeted</div>
            <div className={styles.summaryValue}>{fmt(plan.summary.totalBudgeted)}</div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Allocated to Teams</div>
            <div className={`${styles.summaryValue} ${plan.summary.totalAllocated > 0 ? styles.summaryValueMuted : ''}`}>
              {fmt(plan.summary.totalAllocated)}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Collected from Teams</div>
            <div className={`${styles.summaryValue} ${plan.summary.totalCollected > 0 ? styles.summaryValuePos : ''}`}>
              {fmt(plan.summary.totalCollected)}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Unallocated Budget</div>
            <div className={`${styles.summaryValue} ${plan.summary.orgHeadroom < 0 ? styles.summaryValueNeg : ''}`}>
              {fmt(plan.summary.orgHeadroom)}
            </div>
          </div>
        </div>
      )}

      {fetching ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <>
          {/* Budget lines — by category */}
          {noLines ? (
            <div className={styles.emptyBudget}>
              <p>No budget lines for {year} yet.</p>
              {canWrite && (
                <button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>
                  <Plus size={15} /> Add First Line
                </button>
              )}
            </div>
          ) : (
            <>
              {plan?.categories.map(cat => (
                <div key={cat.id} className={styles.categorySection}>
                  <div className={styles.categoryHeader}>
                    <span className={styles.categoryName}>{cat.name}</span>
                    <span className={styles.categoryTotal}>
                      {fmt(cat.lines.reduce((s, l) => s + l.totalAmount, 0))}
                    </span>
                  </div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.th}>Description</th>
                          <th className={`${styles.th} ${styles.thRight}`}>Total</th>
                          <th className={styles.th}>Periods</th>
                          <th className={styles.th}>Status</th>
                          <th className={styles.th}></th>
                        </tr>
                      </thead>
                      <tbody>{renderLines(cat.lines)}</tbody>
                    </table>
                  </div>
                </div>
              ))}

              {plan && plan.uncategorized.length > 0 && (
                <div className={styles.categorySection}>
                  <div className={styles.categoryHeader}>
                    <span className={styles.categoryName}>Uncategorized</span>
                    <span className={styles.categoryTotal}>
                      {fmt(plan.uncategorized.reduce((s, l) => s + l.totalAmount, 0))}
                    </span>
                  </div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.th}>Description</th>
                          <th className={`${styles.th} ${styles.thRight}`}>Total</th>
                          <th className={styles.th}>Periods</th>
                          <th className={styles.th}>Status</th>
                          <th className={styles.th}></th>
                        </tr>
                      </thead>
                      <tbody>{renderLines(plan.uncategorized)}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Add Line form */}
          {canWrite && addOpen && (
            <div className={styles.addLineSection}>
              <div className={styles.addLineHeader}>
                <span>Add Budget Line</span>
                <button type="button" className={styles.btnIcon} onClick={resetAddForm}>
                  <X size={16} />
                </button>
              </div>
              <div className={styles.addLineBody}>
                <div style={{ marginBottom: '1rem' }}>
                  <BudgetItemPicker
                    categories={categories}
                    value={addPicker}
                    onChange={handlePickerChange}
                    createItemEndpoint="/api/admin/accounting/budget-categories"
                    createItemMode="admin"
                  />
                </div>

                <div className={styles.formGrid}>
                  <div className={`${styles.field} ${styles.formGridFull}`}>
                    <label className={styles.label} htmlFor="add-desc">
                      Description <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <input
                      id="add-desc"
                      className={styles.input}
                      type="text"
                      value={addDesc}
                      onChange={e => setAddDesc(e.target.value)}
                      maxLength={200}
                      placeholder="e.g. Diamond Permits — 2026 season"
                      autoFocus
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="add-amount">
                      Total Amount ($) <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <input
                      id="add-amount"
                      className={styles.input}
                      type="number" min={0.01} step={0.01}
                      value={addAmount}
                      onChange={e => setAddAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="add-notes">Notes (optional)</label>
                    <input
                      id="add-notes"
                      className={styles.input}
                      type="text"
                      value={addNotes}
                      onChange={e => setAddNotes(e.target.value)}
                      maxLength={300}
                      placeholder="Internal note"
                    />
                  </div>
                </div>

                {/* Period distribution toggle */}
                <div style={{ marginTop: '1rem' }}>
                  <button
                    type="button"
                    className={styles.periodToggleBtn}
                    style={{ fontSize: '0.82rem' }}
                    onClick={() => {
                      setShowPeriodsForm(p => {
                        if (!p) setAddPeriods(blankPeriods());
                        return !p;
                      });
                    }}
                  >
                    {showPeriodsForm ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    {showPeriodsForm ? 'Hide' : 'Add'} period distribution (optional)
                  </button>
                </div>

                {showPeriodsForm && (
                  <div style={{ marginTop: '0.75rem', paddingLeft: '0.5rem', borderLeft: '2px solid rgba(255,255,255,0.08)' }}>
                    <p className={styles.hint} style={{ marginBottom: '0.6rem' }}>
                      Break this budget line into monthly or phase-based amounts. Totals must equal the line total.
                    </p>
                    {addPeriods.map((p, i) => (
                      <div key={i} className={styles.periodEditorRow}>
                        <input
                          className={styles.input}
                          value={p.label}
                          onChange={e => updatePeriod(i, { label: e.target.value })}
                          placeholder="Label (e.g. May)"
                          maxLength={40}
                        />
                        <input
                          className={styles.input}
                          type="date"
                          value={p.periodDate}
                          onChange={e => updatePeriod(i, { periodDate: e.target.value })}
                        />
                        <input
                          className={styles.input}
                          type="number" min={0.01} step={0.01}
                          value={p.amount}
                          onChange={e => updatePeriod(i, { amount: e.target.value })}
                          placeholder="Amount"
                        />
                        <button
                          type="button"
                          className={`${styles.btnIcon} ${styles.btnIconDanger}`}
                          onClick={() => setAddPeriods(prev => prev.filter((_, j) => j !== i))}
                          disabled={addPeriods.length === 1}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
                        onClick={() => setAddPeriods(prev => [...prev, { ...BLANK_PERIOD }])}
                      >
                        <Plus size={12} /> Add Period
                      </button>
                      {addAmount && addPeriods.some(p => p.amount) && (
                        <span className={styles.hint}>
                          Period sum: {fmt(addPeriods.reduce((s, p) => s + (Number(p.amount) || 0), 0))}
                          {' / '}Total: {fmt(Number(addAmount) || 0)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {addError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{addError}</p>}

                <div className={styles.formActions}>
                  <button type="button" className="btn btn-ghost" onClick={resetAddForm}>Cancel</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleAddLine}
                    disabled={addSaving}
                  >
                    {addSaving ? 'Adding…' : 'Add Line'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {canWrite && !addOpen && !noLines && (
            <div style={{ marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setAddOpen(true)}>
                <Plus size={14} /> Add Line
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
