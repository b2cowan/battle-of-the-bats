'use client';
import { useState, useEffect, useCallback, use, Fragment } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Receipt, Plus, CheckCircle2, AlertTriangle, Tag, Settings2, Upload, ChevronDown, ChevronUp } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import PayeeCombobox from '@/components/accounting/PayeeCombobox';
import type { PayeeSelection } from '@/components/accounting/PayeeCombobox';
import type { PayableItem } from '@/components/accounting/UpcomingPayablesPanel';
import TagSearchCombobox from '@/components/coaches/TagSearchCombobox';
import TagManagerModal from '@/components/coaches/TagManagerModal';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import CoachFormDisclosure from '@/components/coaches/CoachFormDisclosure';
import BudgetImportSheet from '@/components/coaches/BudgetImportSheet';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import { useDiscardGuard, touched } from '@/components/coaches/useDiscardGuard';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import MoneyExportButton from '@/components/coaches/MoneyExportButton';
import { moneySectionHref } from '@/lib/coach-money-links';
import {
  EXPENSE_COLUMNS, expenseRows,
  // Aliased: this panel already has a local `scheduleRows` holding the filtered schedule ROWS,
  // and the import is the function that turns them into export rows.
  SCHEDULE_COLUMNS, scheduleRows as scheduleExportRows,
} from '@/lib/coach-money-exports';
import styles from '../../../../coaches.module.css';
import type { RepTeamExpense, RepTeamTag, BudgetCategoryWithItems, RepBudgetPlan, RepRosterPlayer } from '@/lib/types';
import { isInstallmentOverdue } from '@/lib/dues-status';
import { useMoneyRevision } from '@/lib/coach-money-refresh';

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s.length === 10 ? s + 'T00:00:00' : s);
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Where a payable stands, as one word — the summary its row shows now that the deposit/balance
 * pair lives one click in (Money-hub table pass 2026-08-13).
 *
 * ⚠ IT REPORTS ONLY WHAT IS RECORDED. A payable with no deposit and no balance set has nothing
 * scheduled, and says so rather than claiming to be unpaid: the coach recorded a commitment and
 * has not yet said when it is due. "Overdue" is reserved for a due date that has actually passed
 * with nothing marked against it — the same restraint the Dues never-paid banner learned, where
 * flagging everyone before anything was due made the warning worth ignoring.
 */
function payableStatus(
  e: { depositAmount: number | null; depositPaidAt: string | null; balanceAmount: number | null; balancePaidAt: string | null },
  overdue: { deposit: boolean; balance: boolean },
): { label: string; cls: string } {
  const halves = [
    e.depositAmount != null ? !!e.depositPaidAt : null,
    e.balanceAmount != null ? !!e.balancePaidAt : null,
  ].filter((v): v is boolean => v !== null);

  /* ⚠ A HALF IS ONLY OVERDUE IF IT EXISTS. `isInstallmentOverdue` reads a due DATE and a paid-at,
     and knows nothing about whether an amount was ever recorded — while the payable form saves a
     due date independently of its amount. So a payable with a real, not-yet-due balance and a
     leftover deposit DATE with the amount cleared was being labelled "Overdue" with nothing
     actually owed. Caught in review 2026-08-13. Gating here rather than at the call site keeps the
     rule with the function that owns the definition of a "half". */
  const anyOverdue = (e.depositAmount != null && overdue.deposit)
    || (e.balanceAmount != null && overdue.balance);

  if (halves.length === 0) return { label: 'No schedule', cls: styles.badgeArchived };
  if (halves.every(Boolean)) return { label: 'Paid', cls: styles.badgeActive };
  if (anyOverdue) return { label: 'Overdue', cls: styles.badgeOverdue };
  if (halves.some(Boolean)) return { label: 'Part paid', cls: styles.badgeCompleted };
  return { label: 'Scheduled', cls: styles.badgeDraft };
}

type ExpenseTab = 'expenses' | 'payables' | 'schedule';

type ScheduleFilter = 'unpaid' | 'paid' | 'all';

/** A commitment on the schedule tab: exactly what the payables API returns, plus which lane it
 *  came from. Reuses `PayableItem` so the hub panel and this tab can't drift apart. */
type ScheduleRow = PayableItem & { source: 'team' | 'org' };

const BLANK_EXPENSE = {
  description: '',
  category: '',
  amount: '',
  notes: '',
  paymentMethod: '',
  /** Out-of-pocket (owner Call 5, mig 234) — '' = the team paid, the usual case. */
  paidByPlayerId: '',
};

const BLANK_PAYABLE = {
  description: '',
  category: '',
  amount: '',
  depositAmount: '',
  depositDueDate: '',
  balanceAmount: '',
  balanceDueDate: '',
  notes: '',
  paymentMethod: '',
};

export function ExpensesPayablesPanel({
  params: paramsPromise,
  embedded = false,
  tabActive = true,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
  /** Rendered as a Money hub tab — suppress the standalone "back to Money" affordance. */
  embedded?: boolean;
  /** Is this panel the tab currently on screen? See UnsavedChangesGuard's `interceptClicks`. */
  tabActive?: boolean;
}) {
  const params = use(paramsPromise);
  const { orgSlug, teamId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();

  const [expenses, setExpenses] = useState<RepTeamExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<ExpenseTab>('expenses');

  // Structured categories (owner decision 2026-07-08: free-text retired). The picker
  // shares the budget taxonomy so Budget vs. Actual's name-match join can't misfire.
  const [categories, setCategories] = useState<BudgetCategoryWithItems[]>([]);
  const [budgetedCategories, setBudgetedCategories] = useState<Set<string>>(new Set());
  const [hasBudgetPlan, setHasBudgetPlan] = useState(false);

  /* Which payable has its deposit/balance detail open. One at a time — the pair is tall, and a
     list with every row expanded is the card list this replaced. */
  const [expandedPayable, setExpandedPayable] = useState<string | null>(null);

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddPayable, setShowAddPayable] = useState(false);
  const [expenseForm, setExpenseForm] = useState(BLANK_EXPENSE);
  const [payableForm, setPayableForm] = useState(BLANK_PAYABLE);
  const [expensePayee, setExpensePayee] = useState<PayeeSelection | null>(null);
  const [payablePayee, setPayablePayee] = useState<PayeeSelection | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [marking, setMarking] = useState<Record<string, boolean>>({});

  // Money tags (Phase 3): the team + org-shared expense-tag library, which tags each expense
  // carries, per-form selections, a filter chip, inline re-tag, and the manager modal.
  const [expenseTags, setExpenseTags] = useState<RepTeamTag[]>([]);
  const [tagsByExpenseId, setTagsByExpenseId] = useState<Record<string, string[]>>({});
  const [expenseFormTags, setExpenseFormTags] = useState<string[]>([]);
  /** The roster, for the "Paid by" choice. Fetched once — the picker is the only reader, and an
   *  expense form on a team with no players simply offers nothing but "The team". */
  const [roster, setRoster] = useState<Pick<RepRosterPlayer, 'id' | 'playerFirstName' | 'playerLastName'>[]>([]);
  const [payableFormTags, setPayableFormTags] = useState<string[]>([]);
  const [filterTagId, setFilterTagId] = useState<string | null>(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  // Drives the two "Add Payable" disclosures (Batch 2, P0 #8). Read on mount by the group, so a
  // payable form pre-filled with a schedule or bookkeeping detail opens that group by itself.
  const payableScheduleSet = Boolean(
    payableForm.depositAmount || payableForm.depositDueDate || payableForm.balanceAmount || payableForm.balanceDueDate,
  );
  const payableDetailsSet = Boolean(
    payableForm.paymentMethod || payableForm.notes || payablePayee || payableFormTags.length,
  );
  const [editingTagsFor, setEditingTagsFor] = useState<string | null>(null);
  const [editTagIds, setEditTagIds] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);

  // Chunk H — the payment schedule: every money-OUT commitment in one list, by due date.
  // Player dues stay on the Dues page, where the reminders that chase them live.
  const [schedule, setSchedule] = useState<ScheduleRow[] | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>('unpaid');

  // Chunk H2 — a season of commitments arrives as a schedule far more often than one at a time.
  const [importOpen, setImportOpen] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [seasonYear, setSeasonYear] = useState<number>(() => new Date().getFullYear());

  // Nav-hide + body-scroll-lock registration for the two Add modals (mobile sheet default).
  useOverlayOpen(showAddExpense);
  useOverlayOpen(showAddPayable);

  // Discard guards (Chunk A, review f7-3/f7-7): a backdrop tap on a half-filled form used to
  // bin it silently. Dirtiness covers the combobox/tag selections too, not just the text fields.
  const expenseDirty = touched(expenseForm, BLANK_EXPENSE) || !!expensePayee || expenseFormTags.length > 0;
  const payableDirty = touched(payableForm, BLANK_PAYABLE) || !!payablePayee || payableFormTags.length > 0;
  const closeAddExpense = useDiscardGuard({
    dirty: expenseDirty,
    close: () => setShowAddExpense(false),
    noun: 'expense',
  });
  const closeAddPayable = useDiscardGuard({
    dirty: payableDirty,
    close: () => setShowAddPayable(false),
    noun: 'payable',
  });

  // Chunk F — which SEASON is on screen. `page.capabilities` are that season's (rule 1)
  // and `page.canWrite()` folds in read-only, so write flags go through it.
  const seasonSearchParams = useSearchParams();
  const page = useCoachSeasonPage(orgSlug, teamId, seasonSearchParams.get('year'));
  const seasonQuery = page.query;
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const canWriteMoney = page.canWrite(page.capabilities?.money === 'write');
  // The team's OWN money tags (org-shared ones are managed by the org admin, not here).
  const ownMoneyTags = expenseTags.filter(t => t.teamId !== null);
  const tagById = new Map(expenseTags.map(t => [t.id, t]));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [res, catRes, planRes] = await Promise.all([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expenses${seasonQuery}`),
        fetch(`/api/coaches/${orgSlug}/budget-items`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan${seasonQuery}`),
      ]);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      setExpenses(data.expenses ?? []);
      setExpenseTags(data.expenseTags ?? []);
      setTagsByExpenseId(data.tagsByExpenseId ?? {});
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.categories ?? []);
      }
      if (planRes.ok) {
        const planData = await planRes.json();
        const plan = planData.plan as RepBudgetPlan | undefined;
        const budgeted = new Set<string>(
          (plan?.lines ?? [])
            .map(l => (l.categoryName ?? '').toLowerCase())
            .filter(Boolean),
        );
        setBudgetedCategories(budgeted);
        setHasBudgetPlan((plan?.lines.length ?? 0) > 0);
        if (typeof planData.seasonYear === 'number') setSeasonYear(planData.seasonYear);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load expenses.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId, seasonQuery]);

  // Re-read (never remount) when the hub's Import menu commits payables while this panel is
  // mounted but off-screen — an in-progress expense form on another tab must survive it.
  const moneyRevision = useMoneyRevision();
  useEffect(() => { load(); }, [load, moneyRevision]);

  // The roster behind "Paid by" — fetched the first time the Add Expense form opens, not on
  // every mount (the same lazy rule this panel already applies to the schedule tab, and the
  // payee picker to its own search). Best-effort: a failure just means the picker offers only
  // "The team", never a broken form.
  useEffect(() => {
    if (!showAddExpense || roster.length > 0) return;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const players = Array.isArray(d?.players) ? d.players : [];
        setRoster(players.filter((p: { status?: string }) => !p.status || p.status === 'active'));
      })
      .catch(() => {});
  }, [showAddExpense, roster.length, orgSlug, teamId]);

  // The schedule is its own fetch (no window, paid rows included) and only runs when the coach
  // opens that tab — the other two tabs shouldn't pay for a list they aren't showing.
  const loadSchedule = useCallback(async () => {
    setScheduleLoading(true);
    setScheduleError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/upcoming-payables?days=0&includePaid=1`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      const lanes = (data.lanes ?? []) as Array<{ id: string; items: Omit<ScheduleRow, 'source'>[] }>;
      const rows: ScheduleRow[] = [
        ...(lanes.find(l => l.id === 'team_payables')?.items ?? []).map(i => ({ ...i, source: 'team' as const })),
        ...(lanes.find(l => l.id === 'org_payables')?.items ?? []).map(i => ({ ...i, source: 'org' as const })),
      ].sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
      setSchedule(rows);
    } catch (e: any) {
      setScheduleError(e.message ?? 'Failed to load the payment schedule.');
    } finally {
      setScheduleLoading(false);
    }
  }, [orgSlug, teamId, seasonQuery]);

  useEffect(() => { if (tab === 'schedule') loadSchedule(); }, [tab, loadSchedule]);

  // ?tab=schedule — where a Scheduled cell in the month grid (or the Money hub's
  // "See full schedule" link) lands. Reactive on the search param, not mount-only: under
  // the Money hub this panel can stay mounted across visits, so revisiting with the
  // param freshly set (e.g. clicking "See full schedule" a second time) needs to jump
  // the sub-tab again, not silently do nothing because it already fired once before.
  const wantedTab = seasonSearchParams.get('tab');
  useEffect(() => {
    if (wantedTab === 'schedule' || wantedTab === 'payables' || wantedTab === 'expenses') setTab(wantedTab);
  }, [wantedTab]);

  // Create a new money tag on the fly from the combobox; returns the new tag so the picker can
  // select it immediately. Adds it to the loaded library so it shows up without a full reload.
  async function createMoneyTag(name: string): Promise<RepTeamTag | null> {
    setSaveError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expense-tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        setSaveError((await res.json().catch(() => ({}))).error ?? 'Could not create tag');
        return null;
      }
      const { tag } = await res.json();
      setExpenseTags(prev => [...prev, tag]);
      return tag as RepTeamTag;
    } catch {
      setSaveError('Could not create tag');
      return null;
    }
  }

  async function addExpense() {
    setSaveError('');
    setSaving(true);
    try {
      const amount = parseFloat(expenseForm.amount);
      if (!expenseForm.description.trim()) throw new Error('Description is required');
      if (isNaN(amount) || amount <= 0) throw new Error('Enter a valid amount');
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenseType:   'expense',
          description:   expenseForm.description.trim(),
          category:      expenseForm.category.trim() || null,
          amount,
          notes:         expenseForm.notes.trim() || null,
          paymentMethod: expenseForm.paymentMethod.trim() || null,
          payeeId:       expensePayee?.payeeId ?? null,
          payeePayer:    expensePayee?.displayName ?? null,
          paidByPlayerId: expenseForm.paidByPlayerId || null,
          tagIds:        expenseFormTags,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setShowAddExpense(false);
      setExpenseForm(BLANK_EXPENSE);
      setExpenseFormTags([]);
      setExpensePayee(null);
      await load();
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function addPayable() {
    setSaveError('');
    setSaving(true);
    try {
      const amount = parseFloat(payableForm.amount);
      if (!payableForm.description.trim()) throw new Error('Description is required');
      if (isNaN(amount) || amount <= 0) throw new Error('Enter a valid total amount');
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenseType:    'tournament_payable',
          description:    payableForm.description.trim(),
          category:       payableForm.category.trim() || null,
          amount,
          depositAmount:  payableForm.depositAmount ? parseFloat(payableForm.depositAmount) : null,
          depositDueDate: payableForm.depositDueDate || null,
          balanceAmount:  payableForm.balanceAmount ? parseFloat(payableForm.balanceAmount) : null,
          balanceDueDate: payableForm.balanceDueDate || null,
          notes:          payableForm.notes.trim() || null,
          paymentMethod:  payableForm.paymentMethod.trim() || null,
          payeeId:        payablePayee?.payeeId ?? null,
          payeePayer:     payablePayee?.displayName ?? null,
          tagIds:         payableFormTags,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setShowAddPayable(false);
      setPayableForm(BLANK_PAYABLE);
      setPayableFormTags([]);
      setPayablePayee(null);
      await load();
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function doAction(expenseId: string, action: string) {
    setMarking(prev => ({ ...prev, [expenseId + action]: true }));
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expenses/${expenseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed');
      await load();
      // Marking a payable paid changes the schedule too — refresh it so the row doesn't sit
      // there still reading "unpaid" until the coach navigates away and back.
      if (tab === 'schedule') await loadSchedule();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMarking(prev => ({ ...prev, [expenseId + action]: false }));
    }
  }

  function startEditTags(expenseId: string) {
    setEditingTagsFor(expenseId);
    setEditTagIds(tagsByExpenseId[expenseId] ?? []);
  }

  async function saveExpenseTags(expenseId: string) {
    setSavingTags(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expenses/${expenseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: editTagIds }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save tags');
      setTagsByExpenseId(prev => ({ ...prev, [expenseId]: editTagIds }));
      setEditingTagsFor(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingTags(false);
    }
  }

  // Read-only chip row for an expense's tags (colour distinguishes org-shared from team-own).
  function tagChips(expenseId: string) {
    const ids = tagsByExpenseId[expenseId] ?? [];
    if (ids.length === 0) return null;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.3rem' }}>
        {ids.map(id => {
          const tag = tagById.get(id);
          if (!tag) return null;
          return (
            <span key={id} className={`${styles.moneyTagChip} ${tag.teamId === null ? styles.moneyTagChipOrg : ''}`}>
              {tag.name}
            </span>
          );
        })}
      </div>
    );
  }

  // Structured category picker (shared budget taxonomy) + an entry-time honesty hint:
  // anything that won't match a budget line is flagged BEFORE it silently lands in
  // "Unbudgeted" on Budget vs. Actual.
  function categoryField(value: string, onChange: (v: string) => void) {
    const unmatched = hasBudgetPlan && value !== '' && !budgetedCategories.has(value.toLowerCase());
    const uncategorized = hasBudgetPlan && value === '';
    return (
      <div className={styles.field}>
        <label className={styles.label}>Category</label>
        <select className={styles.select} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">— No category —</option>
          {categories.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
        {(unmatched || uncategorized) && (
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: 'var(--warning)', display: 'flex', alignItems: 'flex-start', gap: '0.3rem' }}>
            <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
            <span>
              {unmatched
                ? 'Not in your budget plan — this will show as Unbudgeted in Budget vs. Actual.'
                : 'Uncategorized spending shows as Unbudgeted in Budget vs. Actual.'}
            </span>
          </p>
        )}
      </div>
    );
  }

  if (ctxLoading) return <p className={styles.muted}>Loading…</p>;
  if (!page.hasAccess) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  const allIndependent = expenses.filter(e => e.expenseType === 'expense');
  const allPayables = expenses.filter(e => e.expenseType === 'tournament_payable');
  const tagMatch = (e: RepTeamExpense) => !filterTagId || (tagsByExpenseId[e.id] ?? []).includes(filterTagId);
  const independentExpenses = allIndependent.filter(tagMatch);
  const tournamentPayables = allPayables.filter(tagMatch);

  // Filter chip row: tags actually used by the current tab's expenses, with counts (mirrors the
  // game "vs tag" report). Selecting one narrows the list + shows a tag total.
  const activeAll = tab === 'expenses' ? allIndependent : allPayables;
  const tagCounts = new Map<string, number>();
  for (const e of activeAll) for (const id of (tagsByExpenseId[e.id] ?? [])) tagCounts.set(id, (tagCounts.get(id) ?? 0) + 1);
  const usedTagIds = [...tagCounts.keys()]
    .map(id => tagById.get(id))
    .filter((t): t is RepTeamTag => !!t)
    .sort((a, b) => a.name.localeCompare(b.name));
  const filteredActive = tab === 'expenses' ? independentExpenses : tournamentPayables;

  const scheduleRows = (schedule ?? []).filter(r =>
    scheduleFilter === 'all' ? true : scheduleFilter === 'paid' ? !!r.paid : !r.paid);
  const summaryHasOrgRows = (schedule ?? []).some(r => r.source === 'org');
  const filterTotal = filterTagId ? filteredActive.reduce((s, e) => s + e.amount, 0) : 0;
  const filterTag = filterTagId ? tagById.get(filterTagId) : null;

  // Page-level action ruling 2026-08-13. The creates and the tag library act on THIS LIST, and
  // the nearest chrome that names the list is the list's own toolbar — not the Money hub header
  // above the tabs, which names the container. So they all come down here.
  //
  // Rule 5, one name one weight: both creates are the FILLED LIME button now (they were
  // outlined while New Fundraiser one tab away was filled), and "Import payables" is just
  // "Import" — one idea, one name.
  //
  // ⚠ Every affordance here stays write-gated (Chunk A probe): a read-only money assistant could
  // otherwise open a sheet only the server would refuse.
  const expenseToolbarActions = canWriteMoney ? (
    <>
      <button className={styles.btnPrimary} onClick={() => { setShowAddExpense(true); setExpenseForm(BLANK_EXPENSE); setExpenseFormTags([]); setExpensePayee(null); setSaveError(''); }}>
        <Plus size={14} aria-hidden /> Add Expense
      </button>
      <button className={styles.btnPrimary} onClick={() => { setShowAddPayable(true); setPayableForm(BLANK_PAYABLE); setPayableFormTags([]); setPayablePayee(null); setSaveError(''); }}>
        <Plus size={14} aria-hidden /> Add Payable
      </button>
      {ownMoneyTags.length > 0 && (
        <button className={styles.btnSecondary} onClick={() => setTagManagerOpen(true)} title="Rename, merge, or delete your money tags">
          <Settings2 size={14} aria-hidden /> Manage tags
        </button>
      )}
    </>
  ) : null;

  // ⚠ IMPORT IS HEADER-LEVEL ONLY WHEN THIS PANEL IS ITS OWN PAGE. Inside the hub the constant
  // `Import ▾` menu above the tabs owns it and lists this dataset by name; a second Import here
  // would be the same door twice, one line apart. On the standalone route there is no such menu,
  // so the button stays (rule 8: single-dataset screens keep plain buttons).
  /** Is there a tag filter to draw on the left of the toolbar? */
  const showTagFilter = usedTagIds.length > 0 && tab !== 'schedule';

  const expenseHeaderActions = !embedded && canWriteMoney ? (
    <button className={styles.btnSecondary} onClick={() => setImportOpen(true)} aria-label="Import">
      <Upload size={14} aria-hidden /> <span className={styles.headerBtnLabel}>Import</span>
    </button>
  ) : null;

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      {!embedded && (
        <CoachBackLink href={`${base}/accounting${seasonQuery}`}>Back to Money</CoachBackLink>
      )}
      {/* Page-header ruling 2026-08-11: one shape, actions right, phone secondaries icon-only.
          ⚠ The write gates stand (Chunk A probe): a read-only money assistant sees no sheet
          door the server would refuse. "Tournament" stays retired from the title (D-H9). */}
      <CoachPageHeader
        embedded={embedded}
        icon={Receipt}
        title={<>Expenses &amp; Payables</>}
        season={page.season}
        teamBase={page.teamBase}
        actions={expenseHeaderActions}
        helpLabel="Expenses & Payables"
        help={{ module: 'coaches', sectionIds: ['premium-money'], subtopicId: 'premium-money-payables', fullGuideHref: `/${orgSlug}/coaches/help#premium-money` }}
      />

      {importMessage && (
        <p className={styles.moneyTagSummary} role="status" style={{ marginBottom: '1rem' }}>{importMessage}</p>
      )}

      {/* Tab toggle */}
      <div className={styles.viewToggle} style={{ marginBottom: '1.5rem' }}>
        <button className={`${styles.viewToggleBtn} ${tab === 'expenses' ? styles.viewToggleBtnActive : ''}`} onClick={() => setTab('expenses')}>
          Expenses ({allIndependent.length})
        </button>
        <button className={`${styles.viewToggleBtn} ${tab === 'payables' ? styles.viewToggleBtnActive : ''}`} onClick={() => setTab('payables')}>
          Payables ({allPayables.length})
        </button>
        <button className={`${styles.viewToggleBtn} ${tab === 'schedule' ? styles.viewToggleBtnActive : ''}`} onClick={() => setTab('schedule')}>
          Payment schedule
        </button>
      </div>

      {/* The tab's own toolbar (ruling 2026-08-13, decision 2): the money-tag filter it already
          had on the left, its actions pinned right. The filter self-hides when the current tab
          has no tagged expenses — and the row still renders, because the ACTIONS are what must
          survive every empty state (rule 7), not the filter. The schedule tab is a due-date
          list across two sources, so a tag filter has nothing to narrow there. */}
      {/* Always rendered now: Export lives here on every sub-tab, so the row can no longer
          disappear with the filter or the write gate. */}
      {(
        <div className={styles.panelToolbar}>
          {showTagFilter && (
            <div className={styles.moneyFilterBar} style={{ marginBottom: 0 }}>
              <Tag size={13} style={{ color: 'var(--white-40)' }} aria-hidden />
              {usedTagIds.map(t => {
                const isOrg = t.teamId === null;
                const active = filterTagId === t.id;
                const cls = `${styles.moneyFilterChip} ${active ? styles.moneyFilterChipActive : ''} ${isOrg ? (active ? styles.moneyFilterChipOrgActive : styles.moneyFilterChipOrg) : ''}`;
                return (
                  <button key={t.id} className={cls} onClick={() => setFilterTagId(active ? null : t.id)}>
                    {t.name} <span className={styles.moneyFilterCount}>{tagCounts.get(t.id)}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className={styles.panelToolbarActions}>
            {/* ⚠ EXPORTS THE SUB-TAB YOU ARE ON, honouring the tag filter beside it — which is
                the whole argument for Export living down here. A hub-wide menu could only ever
                have offered "expenses and payables" as one undifferentiated lump. */}
            <MoneyExportButton
              label={tab === 'schedule' ? 'Payment schedule' : tab === 'payables' ? 'Payables' : 'Expenses'}
              formats={['xlsx', 'csv']}
              build={() => (tab === 'schedule'
                ? {
                    dataset: 'payment-schedule',
                    title: 'Payment Schedule',
                    columns: SCHEDULE_COLUMNS,
                    rows: scheduleExportRows(scheduleRows),
                    scopeLabel: assignment?.programYearName ?? '',
                    teamName: assignment?.teamName ?? '',
                    emptyMessage: 'There is nothing on the payment schedule yet.',
                  }
                : {
                    dataset: tab === 'payables' ? 'payables' : 'expenses',
                    title: tab === 'payables' ? 'Payables' : 'Expenses',
                    columns: EXPENSE_COLUMNS,
                    rows: expenseRows(filteredActive),
                    scopeLabel: assignment?.programYearName ?? '',
                    teamName: assignment?.teamName ?? '',
                    emptyMessage: tab === 'payables'
                      ? 'No payables have been logged yet.'
                      : 'No expenses have been logged yet.',
                  })}
              // Matches every sibling tab. Without it, an Export with nothing behind it reads as
              // available right up until you press it — the dialog would still explain itself,
              // but the button should not have invited the click.
              disabled={tab === 'schedule' ? scheduleRows.length === 0 : filteredActive.length === 0}
            />
            {expenseToolbarActions}
          </div>
        </div>
      )}
      {showTagFilter && (
        <div className={styles.tagComboLegend} style={{ margin: '-0.5rem 0 0.7rem' }}>
          <span className={styles.tagComboLegendItem}>
            <span className={styles.tagComboLegendDot} style={{ background: 'rgba(var(--blueprint-blue-rgb),0.55)', border: '1px solid rgba(var(--blueprint-blue-rgb),0.7)' }} /> Org tag
          </span>
          <span className={styles.tagComboLegendItem}>
            <span className={styles.tagComboLegendDot} style={{ background: 'rgba(var(--logic-lime-rgb),0.55)', border: '1px solid rgba(var(--logic-lime-rgb),0.7)' }} /> Team tag
          </span>
        </div>
      )}
      {filterTag && (
        <div className={styles.moneyTagSummary}>
          vs <strong>{filterTag.name}</strong>: {filteredActive.length} {tab === 'expenses' ? 'expense' : 'payable'}{filteredActive.length !== 1 ? 's' : ''}, <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(filterTotal)}</span> total
        </div>
      )}

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : tab === 'expenses' ? (
        independentExpenses.length === 0 ? (
          <CoachEmptyState
            icon={<Receipt size={22} aria-hidden />}
            headline="No expenses yet"
            description="Log what the team has actually spent, one at a time."
            primaryAction={canWriteMoney ? {
              label: 'Add Expense',
              icon: <Plus size={15} aria-hidden />,
              onClick: () => { setShowAddExpense(true); setExpenseForm(BLANK_EXPENSE); setExpenseFormTags([]); setExpensePayee(null); setSaveError(''); },
            } : undefined}
          />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Description</th>
                  <th className={styles.th}>Category</th>
                  <th className={`${styles.th} ${styles.thNum}`}>Amount</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {independentExpenses.map(e => (
                  <tr key={e.id} className={styles.tr}>
                    <td className={`${styles.td} ${styles.cardStackCell}`} data-label="Description">
                      {e.description}
                      {editingTagsFor === e.id ? (
                        <div style={{ marginTop: '0.45rem', maxWidth: 340 }}>
                          <TagSearchCombobox library={expenseTags} selectedIds={editTagIds} onChange={setEditTagIds} onCreate={createMoneyTag} showLegend={false} placeholder="Add money tags…" />
                          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                            <button className={styles.btnSecondary} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }} disabled={savingTags} onClick={() => saveExpenseTags(e.id)}>{savingTags ? 'Saving…' : 'Save tags'}</button>
                            <button className={styles.btnGhost} style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }} disabled={savingTags} onClick={() => setEditingTagsFor(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {tagChips(e.id)}
                          {canWriteMoney && (
                            <button
                              onClick={() => startEditTags(e.id)}
                              style={{ background: 'none', border: 'none', padding: 0, marginTop: '0.3rem', cursor: 'pointer', fontSize: '0.68rem', color: 'var(--blueprint-blue)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                            >
                              <Tag size={10} /> {(tagsByExpenseId[e.id] ?? []).length ? 'Edit tags' : 'Add tags'}
                            </button>
                          )}
                        </>
                      )}
                    </td>
                    <td className={styles.td} data-label="Category" style={{ color: 'var(--home-dim, rgba(255,255,255,0.5))' }}>{e.category ?? '—'}</td>
                    <td className={`${styles.td} ${styles.tdNum}`} data-label="Amount">{fmt(e.amount)}</td>
                    <td className={styles.td} data-label="Status">
                      {e.expensePaidAt ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--success-light)' }}>
                          <CheckCircle2 size={12} /> Paid {fmtDate(e.expensePaidAt)}
                        </span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeDraft}`} style={{ fontSize: '0.75rem' }}>Unpaid</span>
                      )}
                    </td>
                    {/* Trailing action cell. Left unlabelled and always present so the table
                        keeps square rows; card mode drops it when it renders nothing (a paid
                        expense, or a read-only money coach) rather than drawing a blank line. */}
                    <td className={`${styles.td} ${styles.cardActionCell}`}>
                      {!e.expensePaidAt && canWriteMoney && (
                        <button
                          className={`${styles.btnSecondary} ${styles.compactAction}`}
                          disabled={!!marking[e.id + 'markExpensePaid']}
                          onClick={() => doAction(e.id, 'markExpensePaid')}
                        >
                          {marking[e.id + 'markExpensePaid'] ? '…' : 'Mark Paid'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : tab === 'payables' ? (
        tournamentPayables.length === 0 ? (
          /* ⚠ THE SECONDARY ACTION HERE IS THE MANDATORY PHONE MITIGATION (ruling 2026-08-13,
             decision 4). Import left the page header on phones, and the importer's paste-a-block
             mode exists precisely because phones have no file picker — so an empty state that can
             accept an import must keep offering one AT EVERY WIDTH. This door had no equivalent
             before this pass; without it, hiding the header menu would make a shipped feature
             unreachable at 390px. Do not remove it without reopening the rule. */
          <CoachEmptyState
            icon={<Receipt size={22} aria-hidden />}
            headline="No payables yet"
            description="Record something you've agreed to pay — or bring a whole season's commitments in from a schedule your club already keeps."
            primaryAction={canWriteMoney ? {
              label: 'Add Payable',
              icon: <Plus size={15} aria-hidden />,
              onClick: () => { setShowAddPayable(true); setPayableForm(BLANK_PAYABLE); setPayableFormTags([]); setPayablePayee(null); setSaveError(''); },
            } : undefined}
            secondaryAction={canWriteMoney ? {
              label: 'Import a schedule',
              icon: <Upload size={15} aria-hidden />,
              onClick: () => setImportOpen(true),
            } : undefined}
          />
        ) : (
          /* ⚠ WAS A HAND-BUILT CARD LIST until 2026-08-13 (Money-hub table consistency). It
             carried no shared class at all — every border, size and colour was written at this
             call site — and it printed "Deposit" and "Balance" as headings on EVERY card. It is
             now the same list table as the Expenses sub-tab beside it, so the two halves of one
             screen finally agree on what a row of money looks like.

             ⚠ THE DEPOSIT/BALANCE PAIR IS UNCHANGED, it has just moved one click in. It is the
             one genuinely NESTED row in the hub — two instalments, two due dates, two buttons —
             and flattening that into columns would have cost the Mark-paid actions their home.
             So the row summarises and the chevron opens exactly the pair that was there before.
             (A coach who wants every half on one screen has the Payment schedule sub-tab, which
             already lists them by due date.) */
          <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Description</th>
                  <th className={styles.th}>Category</th>
                  <th className={`${styles.th} ${styles.thNum}`}>Amount</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}></th>
                </tr>
              </thead>
              <tbody>
            {tournamentPayables.map(e => {
              const depositOverdue = isInstallmentOverdue(e.depositDueDate, e.depositPaidAt);
              const balanceOverdue = isInstallmentOverdue(e.balanceDueDate, e.balancePaidAt);
              const open = expandedPayable === e.id;
              const status = payableStatus(e, { deposit: depositOverdue, balance: balanceOverdue });
              return (
                <Fragment key={e.id}>
                <tr className={styles.tr}>
                  <td className={`${styles.td} ${styles.cardStackCell}`} data-label="Description">{e.description}</td>
                  <td className={styles.td} data-label="Category" style={{ color: 'var(--home-dim, rgba(255,255,255,0.5))' }}>{e.category ?? '—'}</td>
                  <td className={`${styles.td} ${styles.tdNum}`} data-label="Amount">{fmt(e.amount)}</td>
                  <td className={styles.td} data-label="Status">
                    <span className={`${styles.badge} ${status.cls}`} style={{ fontSize: '0.75rem' }}>{status.label}</span>
                  </td>
                  <td className={`${styles.td} ${styles.cardActionCell}`}>
                    <button
                      type="button"
                      className={`${styles.btnGhost} ${styles.compactAction}`}
                      aria-expanded={open}
                      /* ⚠ The aria-label is NOT redundant with the span beside it. `.cardActionLabel`
                         is `display: none` above 640px, so on a desktop the span is out of the
                         accessibility tree and the icon is aria-hidden — without this the button
                         would announce with NO NAME AT ALL. Caught in review 2026-08-13; the
                         identical control on Payment requests had it and this one did not. */
                      aria-label={open ? `Hide ${e.description}'s payment details` : `Show ${e.description}'s payment details`}
                      onClick={() => setExpandedPayable(open ? null : e.id)}
                    >
                      {open ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
                      <span className={styles.cardActionLabel}>{open ? 'Hide details' : 'Payment details'}</span>
                    </button>
                  </td>
                </tr>
                {open && (
                <tr className={styles.tr}>
                  <td className={`${styles.td} ${styles.cardStackCell}`} colSpan={5}>

                  {/* Deposit + balance share a row on a desktop and stack on a phone. Two
                      ~150px boxes each holding an amount, a due date, an overdue warning and a
                      button was the worst-value split in Money (Chunk A D5). */}
                  <div className={styles.stack640} style={{ gap: '0.75rem' }}>
                    {/* Deposit */}
                    <div style={{ flex: 1, minWidth: 0, background: 'var(--home-card, rgba(255,255,255,0.04))', borderRadius: 6, padding: '0.65rem 0.85rem' }}>
                      <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: 'var(--home-dim, rgba(255,255,255,0.4))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Deposit</p>
                      {e.depositAmount != null ? (
                        <>
                          <p style={{ margin: 0, fontWeight: 600 }}>{fmt(e.depositAmount)}</p>
                          <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: depositOverdue ? 'var(--danger-light)' : 'var(--home-dim, rgba(255,255,255,0.5))' }}>
                            Due {fmtDate(e.depositDueDate)}
                            {depositOverdue && <AlertTriangle size={11} style={{ marginLeft: 3, verticalAlign: 'middle' }} />}
                          </p>
                          {e.depositPaidAt ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--success-light)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.35rem' }}>
                              <CheckCircle2 size={11} /> Paid
                            </span>
                          ) : (
                            <button
                              className={`${styles.btnSecondary} ${styles.block640} ${styles.compactAction}`}
                              style={{ marginTop: '0.4rem' }}
                              disabled={!!marking[e.id + 'markDepositPaid']}
                              onClick={() => doAction(e.id, 'markDepositPaid')}
                            >
                              {marking[e.id + 'markDepositPaid'] ? '…' : 'Mark deposit paid'}
                            </button>
                          )}
                        </>
                      ) : <p className={styles.muted} style={{ margin: 0, fontSize: '0.8rem' }}>—</p>}
                    </div>

                    {/* Balance */}
                    <div style={{ flex: 1, minWidth: 0, background: 'var(--home-card, rgba(255,255,255,0.04))', borderRadius: 6, padding: '0.65rem 0.85rem' }}>
                      <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: 'var(--home-dim, rgba(255,255,255,0.4))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Balance</p>
                      {e.balanceAmount != null ? (
                        <>
                          <p style={{ margin: 0, fontWeight: 600 }}>{fmt(e.balanceAmount)}</p>
                          <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: balanceOverdue ? 'var(--danger-light)' : 'var(--home-dim, rgba(255,255,255,0.5))' }}>
                            Due {fmtDate(e.balanceDueDate)}
                            {balanceOverdue && <AlertTriangle size={11} style={{ marginLeft: 3, verticalAlign: 'middle' }} />}
                          </p>
                          {e.balancePaidAt ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--success-light)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.35rem' }}>
                              <CheckCircle2 size={11} /> Paid
                            </span>
                          ) : (
                            <button
                              className={`${styles.btnSecondary} ${styles.block640} ${styles.compactAction}`}
                              style={{ marginTop: '0.4rem' }}
                              disabled={!!marking[e.id + 'markBalancePaid']}
                              onClick={() => doAction(e.id, 'markBalancePaid')}
                            >
                              {marking[e.id + 'markBalancePaid'] ? '…' : 'Mark balance paid'}
                            </button>
                          )}
                        </>
                      ) : <p className={styles.muted} style={{ margin: 0, fontSize: '0.8rem' }}>—</p>}
                    </div>
                  </div>

                  {e.notes && <p className={styles.muted} style={{ margin: '0.75rem 0 0', fontSize: '0.78rem' }}>{e.notes}</p>}

                  {editingTagsFor === e.id ? (
                    <div style={{ marginTop: '0.6rem', maxWidth: 360 }}>
                      <TagSearchCombobox library={expenseTags} selectedIds={editTagIds} onChange={setEditTagIds} onCreate={createMoneyTag} showLegend={false} placeholder="Add money tags…" />
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                        <button className={`${styles.btnSecondary} ${styles.compactAction}`} disabled={savingTags} onClick={() => saveExpenseTags(e.id)}>{savingTags ? 'Saving…' : 'Save tags'}</button>
                        <button className={`${styles.btnGhost} ${styles.compactAction}`} disabled={savingTags} onClick={() => setEditingTagsFor(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: '0.6rem' }}>
                      {tagChips(e.id)}
                      {canWriteMoney && (
                        <button
                          onClick={() => startEditTags(e.id)}
                          style={{ background: 'none', border: 'none', padding: 0, marginTop: '0.3rem', cursor: 'pointer', fontSize: '0.68rem', color: 'var(--blueprint-blue)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                        >
                          <Tag size={10} /> {(tagsByExpenseId[e.id] ?? []).length ? 'Edit tags' : 'Add tags'}
                        </button>
                      )}
                    </div>
                  )}
                  </td>
                </tr>
                )}
                </Fragment>
              );
            })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* ── Payment schedule (chunk H) ────────────────────────────────────────────────
           Every money-OUT commitment in one place, by due date: this team's payable
           deposits and balances, plus the org's allocation instalments on a club-run team.
           Player dues are money IN and stay on the Dues page, where the reminders live.
           A LIST, one row per commitment — so it stacks into cards at 640 (Chunk A D1). */
        scheduleLoading ? (
          <p className={styles.muted}>Loading…</p>
        ) : scheduleError ? (
          <p className={styles.errorText}>{scheduleError}</p>
        ) : (
          <>
            <div className={styles.viewToggle} style={{ marginBottom: '1rem' }}>
              {(['unpaid', 'paid', 'all'] as const).map(f => (
                <button
                  key={f}
                  className={`${styles.viewToggleBtn} ${scheduleFilter === f ? styles.viewToggleBtnActive : ''}`}
                  onClick={() => setScheduleFilter(f)}
                >
                  {f === 'unpaid' ? 'Unpaid' : f === 'paid' ? 'Paid' : 'All'}
                </button>
              ))}
            </div>
            {scheduleRows.length === 0 ? (
              <div className={styles.emptyState}>
                {scheduleFilter === 'paid'
                  ? 'Nothing has been paid off yet.'
                  : scheduleFilter === 'unpaid'
                    ? 'Nothing is outstanding — every commitment with a due date has been paid.'
                    : 'No commitments with a due date yet. Add a payable to see it here.'}
              </div>
            ) : (
              <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Due</th>
                      <th className={styles.th}>What</th>
                      <th className={styles.th}>Category</th>
                      <th className={`${styles.th} ${styles.thNum}`}>Amount</th>
                      <th className={styles.th}>Status</th>
                      <th className={styles.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleRows.map(row => (
                      <tr key={row.id} className={styles.tr}>
                        <td className={styles.td} data-label="Due">{fmtDate(row.dueDate)}</td>
                        <td className={styles.td} data-label="What">
                          {row.description}
                          {row.label && <span className={styles.muted} style={{ display: 'block', fontSize: '0.75rem' }}>{row.label}</span>}
                        </td>
                        <td className={styles.td} data-label="Category" style={{ color: 'var(--home-dim, rgba(255,255,255,0.5))' }}>
                          {row.source === 'org' ? 'Org allocation' : (row.category ?? '—')}
                        </td>
                        <td className={`${styles.td} ${styles.tdNum}`} data-label="Amount">{fmt(row.amount)}</td>
                        <td className={styles.td} data-label="Status">
                          {row.paid ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--success-light)' }}>
                              <CheckCircle2 size={12} /> Paid
                            </span>
                          ) : row.overdue ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--danger-light)' }}>
                              <AlertTriangle size={12} /> {Math.abs(row.daysUntilDue ?? 0)} days overdue
                            </span>
                          ) : (
                            <span className={styles.muted} style={{ fontSize: '0.8rem' }}>
                              {row.daysUntilDue === 0 ? 'Due today' : `In ${row.daysUntilDue} days`}
                            </span>
                          )}
                        </td>
                        {/* Marking paid works on this team's OWN payables. An org allocation is
                            settled through Org Allocations, which owns that conversation. */}
                        <td className={`${styles.td} ${styles.cardActionCell}`}>
                          {!row.paid && canWriteMoney && row.source === 'team' && row.expenseId && (
                            <button
                              className={`${styles.btnSecondary} ${styles.block640} ${styles.compactAction}`}
                              disabled={!!marking[row.expenseId + (row.half === 'deposit' ? 'markDepositPaid' : 'markBalancePaid')]}
                              onClick={() => doAction(row.expenseId!, row.half === 'deposit' ? 'markDepositPaid' : 'markBalancePaid')}
                            >
                              Mark paid
                            </button>
                          )}
                          {row.source === 'org' && !row.paid && (
                            <Link href={moneySectionHref(base, 'allocations', undefined, seasonQuery)} className={styles.linkBtn}>Open allocations</Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className={styles.muted} style={{ fontSize: '0.78rem', marginTop: '0.75rem' }}>
              Money going out only — payable deposits and balances{summaryHasOrgRows ? ', plus what your club has allocated to this team' : ''}.
              Player dues are money coming in and live on{' '}
              <Link href={moneySectionHref(base, 'dues', undefined, seasonQuery)} className={styles.linkBtn}>Player Dues</Link>.
            </p>
          </>
        )
      )}

      {/* Add Expense modal */}
      {showAddExpense && (
        <div className={styles.modalOverlay} onClick={closeAddExpense}>
          <div className={`${styles.modal} ${styles.modalScrollBody}`} onClick={e => e.stopPropagation()}>
            <CoachModalHeader title="Add Expense" onClose={closeAddExpense} />
            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Description *</label>
                <input className={styles.input} value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Diamond rental" />
              </div>
              {categoryField(expenseForm.category, v => setExpenseForm(f => ({ ...f, category: v })))}
              <div className={styles.field}>
                <label className={styles.label}>Amount *</label>
                <input className={styles.input} type="number" min={0} step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Payment Method</label>
                <input className={styles.input} value={expenseForm.paymentMethod} onChange={e => setExpenseForm(f => ({ ...f, paymentMethod: e.target.value }))} placeholder="e.g. E-transfer, Cash" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Payee</label>
                <PayeeCombobox
                  payeesApiUrl={`/api/coaches/${orgSlug}/teams/${teamId}/payees`}
                  value={expensePayee}
                  onChange={setExpensePayee}
                  saveScope="team"
                />
              </div>
              {/* Paid by (owner Call 5, mig 234). Team is the default and the usual case; the
                  other answer is a parent who bought the pizza. The consequence is stated below
                  rather than discovered on the books afterwards. */}
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Paid by</label>
                <select
                  className={styles.input}
                  value={expenseForm.paidByPlayerId}
                  onChange={e => setExpenseForm(f => ({ ...f, paidByPlayerId: e.target.value }))}
                >
                  <option value="">The team</option>
                  {roster.map(p => (
                    <option key={p.id} value={p.id}>
                      A family, out of pocket — {[p.playerLastName, p.playerFirstName].filter(Boolean).join(', ')}
                    </option>
                  ))}
                </select>
                {expenseForm.paidByPlayerId && (
                  <p className={styles.muted} style={{ margin: '0.35rem 0 0', fontSize: '0.78rem' }}>
                    Counts in the budget as usual. <strong>No cash leaves the team</strong> — instead the
                    team owes this family {expenseForm.amount ? fmt(Number(expenseForm.amount) || 0) : 'the amount'},
                    saved as a credit you can put against their dues or pay out any time.
                  </p>
                )}
              </div>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Notes</label>
                <textarea className={styles.textarea} rows={2} value={expenseForm.notes} onChange={e => setExpenseForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Tags</label>
                <TagSearchCombobox library={expenseTags} selectedIds={expenseFormTags} onChange={setExpenseFormTags} onCreate={createMoneyTag} placeholder="Type to find or create a money tag…" />
              </div>
            </div>
            {saveError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{saveError}</p>}
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={closeAddExpense}>Cancel</button>
              <button className={styles.btnPrimary} disabled={saving} onClick={addExpense}>{saving ? 'Saving…' : 'Add Expense'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Payable modal */}
      {showAddPayable && (
        <div className={styles.modalOverlay} onClick={closeAddPayable}>
          <div className={`${styles.modal} ${styles.modalScrollBody}`} onClick={e => e.stopPropagation()}>
            <CoachModalHeader title="Add Payable" onClose={closeAddPayable} />
            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Description *</label>
                <input className={styles.input} value={payableForm.description} onChange={e => setPayableForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Spring tournament entry, summer dome block" />
              </div>
              {categoryField(payableForm.category, v => setPayableForm(f => ({ ...f, category: v })))}
              <div className={styles.field}>
                <label className={styles.label}>Total Amount *</label>
                <input className={styles.input} type="number" min={0} step="0.01" value={payableForm.amount} onChange={e => setPayableForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>

              {/* The eleven-field payable (readiness review #8) opens as three: what it's for,
                  what kind, and how much. The deposit/balance split and the bookkeeping fields
                  open on demand; both groups open by themselves when they already hold a value. */}
              <div className={styles.formGridFull}>
                <CoachFormDisclosure
                  label="Split into a deposit and a balance"
                  title="Payment schedule"
                  note="Big-ticket costs are often billed as a deposit now and a balance later — tournament entries, dome blocks, uniform orders. Leave this closed to record one amount due on one date."
                  meta={payableScheduleSet ? 'Set' : undefined}
                  defaultOpen={payableScheduleSet}
                >
                  <div className={styles.formSectionGrid}>
                    <div className={styles.field}>
                      <label className={styles.label}>Deposit Amount</label>
                      <input className={styles.input} type="number" min={0} step="0.01" value={payableForm.depositAmount} onChange={e => setPayableForm(f => ({ ...f, depositAmount: e.target.value }))} placeholder="0.00" />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Deposit Due Date</label>
                      <input className={styles.input} type="date" value={payableForm.depositDueDate} onChange={e => setPayableForm(f => ({ ...f, depositDueDate: e.target.value }))} />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Balance Amount</label>
                      <input className={styles.input} type="number" min={0} step="0.01" value={payableForm.balanceAmount} onChange={e => setPayableForm(f => ({ ...f, balanceAmount: e.target.value }))} placeholder="0.00" />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Balance Due Date</label>
                      <input className={styles.input} type="date" value={payableForm.balanceDueDate} onChange={e => setPayableForm(f => ({ ...f, balanceDueDate: e.target.value }))} />
                    </div>
                  </div>
                </CoachFormDisclosure>
              </div>

              <div className={styles.formGridFull}>
                <CoachFormDisclosure
                  label="Add details (optional)"
                  title="Details"
                  meta={payableDetailsSet ? 'Set' : undefined}
                  defaultOpen={payableDetailsSet}
                >
                  <div className={styles.formSectionGrid}>
                    <div className={styles.field}>
                      <label className={styles.label}>Payment Method</label>
                      <input className={styles.input} value={payableForm.paymentMethod} onChange={e => setPayableForm(f => ({ ...f, paymentMethod: e.target.value }))} placeholder="e.g. E-transfer, Cash" />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Payee</label>
                      <PayeeCombobox
                        payeesApiUrl={`/api/coaches/${orgSlug}/teams/${teamId}/payees`}
                        value={payablePayee}
                        onChange={setPayablePayee}
                        saveScope="team"
                      />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Notes</label>
                    <textarea className={styles.textarea} rows={2} value={payableForm.notes} onChange={e => setPayableForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Tags</label>
                    <TagSearchCombobox library={expenseTags} selectedIds={payableFormTags} onChange={setPayableFormTags} onCreate={createMoneyTag} placeholder="Type to find or create a money tag…" />
                  </div>
                </CoachFormDisclosure>
              </div>
            </div>
            {saveError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{saveError}</p>}
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={closeAddPayable}>Cancel</button>
              <button className={styles.btnPrimary} disabled={saving} onClick={addPayable}>{saving ? 'Saving…' : 'Add Payable'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Chunk H2 — the payables importer (write-gated, like every other write door) ── */}
      {importOpen && canWriteMoney && (
        <BudgetImportSheet
          orgSlug={orgSlug}
          teamId={teamId}
          categories={categories.map(c => ({ id: c.id, name: c.name, items: c.items.map(i => ({ id: i.id, name: i.name })) }))}
          existingLines={[]}
          existingPayableDescriptions={expenses.map(e => e.description)}
          seasonYear={seasonYear}
          gridMonths={[]}
          todayMonth={new Date().toISOString().slice(0, 7)}
          initialShape="payables"
          onClose={() => setImportOpen(false)}
          onImported={message => {
            setImportOpen(false);
            setImportMessage(message);
            void load();
            if (tab === 'schedule') void loadSchedule();
          }}
        />
      )}

      {/* Money-tag manager (rename / merge / delete the team's OWN money tags) */}
      {tagManagerOpen && (
        <TagManagerModal
          orgSlug={orgSlug}
          teamId={teamId}
          tags={ownMoneyTags}
          basePath={`/api/coaches/${orgSlug}/teams/${teamId}/expense-tags`}
          title="Manage money tags"
          itemNoun="expense"
          onClose={() => setTagManagerOpen(false)}
          onChanged={load}
        />
      )}

      {/* The discard guard covers dismissing the sheet; this covers walking away from it —
          a tap on the sidebar, the bottom nav, or a browser refresh mid-form. */}
      <UnsavedChangesGuard
        active={(showAddExpense && expenseDirty) || (showAddPayable && payableDirty)}
        interceptClicks={((showAddExpense && expenseDirty) || (showAddPayable && payableDirty)) && tabActive}
        message="You haven't saved what you entered on this form. Leave without saving it?"
      />
    </div>
  );
}
