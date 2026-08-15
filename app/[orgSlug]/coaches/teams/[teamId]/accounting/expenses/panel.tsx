'use client';
import { useState, useEffect, useCallback, use, Fragment } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Receipt, Plus, CheckCircle2, AlertTriangle, Tag, Settings2, Upload, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import PayeeCombobox from '@/components/accounting/PayeeCombobox';
import PaymentMethodCombobox from '@/components/accounting/PaymentMethodCombobox';
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
import RowEditButton from '@/components/coaches/RowEditButton';
import { ledgerReversalPreview, lockedFields } from '@/lib/expense-ledger';
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

/**
 * Expense or payable? — the comparison that sits under BOTH empty states (owner review
 * 2026-08-15, Q7).
 *
 * The portal already explained this well in the help guide and in each empty state's own
 * description, but a coach only ever meets those before they have any rows: the empty state
 * disappears the moment the list fills, and the help is behind the "?" in the page header. So
 * the explanation was present exactly when it wasn't needed.
 *
 * ⚠ EXAMPLES ARE THE POINT, not the definitions. "A commitment you've agreed to pay" is the
 * wording that was already shipping and did not land; "a tournament entry due in March" is what
 * a coach recognises. Keep both columns' examples concrete and keep them plural — one example
 * reads as the only case that qualifies.
 */
function KindCompare() {
  return (
    <>
      <div className={styles.moneyKindCompare}>
        <div className={styles.moneyKindCard}>
          <h4>Expense</h4>
          <p>Money that has <strong>already left</strong> the team — you&apos;re recording what happened.</p>
          <p className={styles.moneyKindEgs}>Pizza night · a diamond you rented last week · uniforms you bought</p>
        </div>
        <div className={styles.moneyKindCard}>
          <h4>Payable</h4>
          <p>Money you&apos;ve <strong>promised but not paid</strong> — you&apos;re scheduling what&apos;s coming.</p>
          <p className={styles.moneyKindEgs}>A tournament entry due in March · a dome block · an umpire invoice</p>
        </div>
      </div>
      <p className={styles.moneyKindTest}>
        <strong>The quick test:</strong> if it has a due date, it&apos;s a payable. Payables appear on your
        Payment schedule; expenses don&apos;t.
      </p>
    </>
  );
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

/**
 * ONE form behind both kinds of record (owner review 2026-08-15, Q8).
 *
 * There used to be two blanks and two modals, opened from two lime buttons sitting side by side.
 * That made the expense-or-payable decision irreversible at the moment it was least informed — a
 * coach who picked wrong had to cancel, lose what they'd typed, and start again in the other form.
 * With one shape, the type becomes a control INSIDE the form: flipping it keeps description,
 * category and amount, which are the three fields both kinds share and the three most likely to
 * already be filled in when the coach realises.
 *
 * ⚠ The payable-only fields stay in this object when the kind is 'expense'. They are simply not
 * rendered and not sent — clearing them on every flip would delete a deposit schedule a coach had
 * entered, purely because they glanced at the other tab.
 */
const BLANK_RECORD = {
  description: '',
  category: '',
  amount: '',
  notes: '',
  paymentMethod: '',
  /** Out-of-pocket (owner Call 5, mig 234) — '' = the team paid, the usual case. Expense-only. */
  paidByPlayerId: '',
  /** Payable-only, all four. */
  depositAmount: '',
  depositDueDate: '',
  balanceAmount: '',
  balanceDueDate: '',
};

type RecordKind = 'expense' | 'payable';

/** The sub-tab a coach is standing on decides which kind the form opens as. */
function kindForTab(tab: ExpenseTab): RecordKind {
  return tab === 'expenses' ? 'expense' : 'payable';
}

/** Turn a saved record back into form strings, for Edit. */
function formFromExpense(e: RepTeamExpense): typeof BLANK_RECORD {
  const num = (v: number | null) => (v == null ? '' : String(v));
  return {
    description: e.description,
    category: e.category ?? '',
    amount: String(e.amount),
    notes: e.notes ?? '',
    paymentMethod: e.paymentMethod ?? '',
    paidByPlayerId: e.paidByPlayerId ?? '',
    depositAmount: num(e.depositAmount),
    depositDueDate: e.depositDueDate ?? '',
    balanceAmount: num(e.balanceAmount),
    balanceDueDate: e.balanceDueDate ?? '',
  };
}

/* Which figures on a saved record can no longer change comes from `lockedFields`
   (lib/expense-ledger.ts) — the same function the API refuses with, so the lock a coach SEES and
   the lock the server ENFORCES cannot drift. This panel reads it twice: to render the lock with
   its reason, and to leave locked fields out of the save entirely. */

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

  // One form, two kinds, two modes (add / edit) — see BLANK_RECORD.
  const [formOpen, setFormOpen] = useState(false);
  const [formKind, setFormKind] = useState<RecordKind>('expense');
  /** The record being edited, or null when adding. Held whole so the locks can read its paid state. */
  const [editing, setEditing] = useState<RepTeamExpense | null>(null);
  const [form, setForm] = useState(BLANK_RECORD);
  const [formPayee, setFormPayee] = useState<PayeeSelection | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [marking, setMarking] = useState<Record<string, boolean>>({});

  // Money tags (Phase 3): the team + org-shared expense-tag library, which tags each expense
  // carries, per-form selections, a filter chip, inline re-tag, and the manager modal.
  const [expenseTags, setExpenseTags] = useState<RepTeamTag[]>([]);
  const [tagsByExpenseId, setTagsByExpenseId] = useState<Record<string, string[]>>({});
  const [formTags, setFormTags] = useState<string[]>([]);
  /** The roster, for the "Paid by" choice. Fetched once — the picker is the only reader, and an
   *  expense form on a team with no players simply offers nothing but "The team". */
  const [roster, setRoster] = useState<Pick<RepRosterPlayer, 'id' | 'playerFirstName' | 'playerLastName'>[]>([]);
  const [filterTagId, setFilterTagId] = useState<string | null>(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  // Drives the form's two disclosures (Batch 2, P0 #8). Read on mount by each group, so a form
  // pre-filled with a schedule or a bookkeeping detail — an EDIT, most often — opens it by itself
  // rather than hiding what the coach came to change.
  const scheduleSet = Boolean(
    form.depositAmount || form.depositDueDate || form.balanceAmount || form.balanceDueDate,
  );
  const detailsSet = Boolean(
    form.paymentMethod || form.notes || formPayee || formTags.length,
  );
  const locks = lockedFields(editing);
  /* ⚠ THE SAVED RECORD WINS when there is one. The switch is hidden while editing, so `formKind`
     could only ever go stale there — deriving from the record instead means the form cannot render
     a payable's fields for an expense (or vice versa) because a state setter was forgotten. In add
     mode `formKind` is the coach's actual choice and is authoritative. */
  const isPayableForm = editing
    ? editing.expenseType === 'tournament_payable'
    : formKind === 'payable';
  /* What the coach is told before confirming a delete. Reads the same function the server reverses
     with (lib/expense-ledger.ts), so the sentence and the outcome cannot drift apart. */
  const deletePreview = editing
    ? ledgerReversalPreview(editing)
    : { amount: 0, legs: 0, owesFamily: false };

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

  // Nav-hide + body-scroll-lock registration for the record modal (mobile sheet default).
  useOverlayOpen(formOpen);

  /* Discard guards (Chunk A, review f7-3/f7-7): a backdrop tap on a half-filled form used to bin it
     silently. Dirtiness covers the combobox/tag selections too, not just the text fields.

     ⚠ WHEN EDITING, "dirty" IS MEASURED AGAINST THE SAVED RECORD, not against blank. Comparing an
     edit form to BLANK_RECORD would call every edit dirty the instant it opened — including one the
     coach opened to read and closed untouched — and the guard would cry wolf until it was ignored. */
  const formBaseline = editing ? formFromExpense(editing) : BLANK_RECORD;
  const baselineTags = editing ? (tagsByExpenseId[editing.id] ?? []) : [];
  const formDirty = touched(form, formBaseline)
    || (formPayee?.displayName ?? null) !== (editing?.payeePayer ?? null)
    || formTags.length !== baselineTags.length
    || formTags.some(id => !baselineTags.includes(id));
  const closeForm = useDiscardGuard({
    dirty: formDirty,
    close: () => { setFormOpen(false); resetForm(); },
    noun: isPayableForm ? 'payable' : 'expense',
  });

  /* One reset, three callers (close, save, delete). It was four lines repeated at each — which is
     the shape where a fifth form field gets added to two of them and quietly persists into the next
     record opened at the third. */
  function resetForm() {
    setEditing(null);
    setForm(BLANK_RECORD);
    setFormTags([]);
    setFormPayee(null);
    setConfirmDelete(false);
  }

  /** Open the form to ADD, as whichever kind the current sub-tab is about (Q8). */
  function openAdd(kind: RecordKind = kindForTab(tab)) {
    resetForm();
    setFormKind(kind);
    setSaveError('');
    setFormOpen(true);
  }

  /** Open the form to EDIT a saved record. Type is stated, never switchable (owner ruling) — which
   *  is why `formKind` is not set here: `isPayableForm` derives it from the record itself. */
  function openEdit(e: RepTeamExpense) {
    resetForm();
    setEditing(e);
    setForm(formFromExpense(e));
    setFormTags(tagsByExpenseId[e.id] ?? []);
    setFormPayee(e.payeePayer ? { payeeId: e.payeeId, payeePayer: e.payeePayer, displayName: e.payeePayer } : null);
    setSaveError('');
    setFormOpen(true);
  }

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
    if (!formOpen || formKind !== 'expense' || roster.length > 0) return;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const players = Array.isArray(d?.players) ? d.players : [];
        setRoster(players.filter((p: { status?: string }) => !p.status || p.status === 'active'));
      })
      .catch(() => {});
  }, [formOpen, formKind, roster.length, orgSlug, teamId]);

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

  /**
   * Save the form — a create or an update, both kinds, one path.
   *
   * ⚠ AN EDIT SENDS ONLY WHAT THE COACH COULD ACTUALLY CHANGE. A locked figure is left out of the
   * request entirely rather than sent back unchanged: the server refuses any locked field it is
   * given, so echoing the current amount on a paid record would turn "I renamed it" into a 409.
   */
  async function saveRecord() {
    setSaveError('');
    setSaving(true);
    try {
      /* ⚠ `isPayableForm`, NEVER `formKind`, AND THE DISTINCTION IS NOT COSMETIC. `formKind` is only
         written when ADDING; an edit derives its kind from the record. Reading the raw state here
         meant that opening the screen fresh and going straight to a pencil on a PAYABLE saved as
         though it were an expense — the deposit and balance were silently dropped from the request,
         the server saw no such fields, and the save returned 200 with the figures unchanged. The
         form rendered correctly the whole time, because the JSX had always used the derived value.
         Caught by the correctness lens, 2026-08-15; introduced by the cleanup pass that made
         `isPayableForm` derived without following it here. */
      const isPayable = isPayableForm;
      const amount = parseFloat(form.amount);
      if (!form.description.trim()) throw new Error('Description is required');
      if (isNaN(amount) || amount <= 0) {
        throw new Error(isPayable ? 'Enter a valid total amount' : 'Enter a valid amount');
      }

      const common = {
        description:   form.description.trim(),
        category:      form.category.trim() || null,
        notes:         form.notes.trim() || null,
        paymentMethod: form.paymentMethod.trim() || null,
        payeeId:       formPayee?.payeeId ?? null,
        payeePayer:    formPayee?.displayName ?? null,
        tagIds:        formTags,
      };
      const num = (v: string) => (v ? parseFloat(v) : null);

      /* An edit sends only what the coach could actually change. A locked figure is OMITTED rather
         than echoed back unchanged: the server refuses any locked field it is given, so resending
         the current amount would turn "I fixed a typo in the description" into a rejection. */
      const edits: Record<string, unknown> = { ...common };
      if (!locks.amount) edits.amount = amount;
      if (isPayable && !locks.deposit) {
        edits.depositAmount = num(form.depositAmount);
        edits.depositDueDate = form.depositDueDate || null;
      }
      if (isPayable && !locks.balance) {
        edits.balanceAmount = num(form.balanceAmount);
        edits.balanceDueDate = form.balanceDueDate || null;
      }

      const res = editing
        ? await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expenses/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(edits),
          })
        : await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              expenseType: isPayable ? 'tournament_payable' : 'expense',
              ...common,
              amount,
              ...(isPayable
                ? {
                    depositAmount:  num(form.depositAmount),
                    depositDueDate: form.depositDueDate || null,
                    balanceAmount:  num(form.balanceAmount),
                    balanceDueDate: form.balanceDueDate || null,
                  }
                : { paidByPlayerId: form.paidByPlayerId || null }),
            }),
          });

      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setFormOpen(false);
      resetForm();
      await load();
      if (tab === 'schedule') await loadSchedule();
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  /**
   * Delete the record being edited, reversing whatever it posted.
   *
   * The consequence is stated in the confirmation before this runs — see `deletePreview`. A refusal
   * (a pre-2026-08-15 payment whose ledger entry can't be identified uniquely) comes back as a
   * sentence written for the coach, so it is shown as-is and the form stays open.
   */
  async function deleteRecord() {
    if (!editing) return;
    setDeleting(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expenses/${editing.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not delete');
      setFormOpen(false);
      resetForm();
      await load();
      if (tab === 'schedule') await loadSchedule();
    } catch (e: any) {
      setSaveError(e.message);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
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

  /* The per-row tag editor that used to live here is gone (owner review 2026-08-15). Tags are a
     field on the record's own form now, so a row offers ONE door to a record rather than a general
     one and a narrower one to the same thing. Tagging costs a click more than it did; that trade
     was made deliberately, because tagging mostly happens at entry time in the Add form. */

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

  /**
   * "Paid by" — the out-of-pocket choice, which only an EXPENSE has and only at creation.
   *
   * ⚠ STAYS ABOVE THE DETAILS DISCLOSURE (Q1). It is the one field on this form that does not
   * DESCRIBE the record but changes what it MEANS: naming a family turns the entry into money the
   * team now owes them, saved as a credit against their dues. A consequence that size cannot be
   * discovered behind an "(optional)" toggle.
   *
   * ⚠ CREATION ONLY. Changing it later would move a debt to a different household without touching
   * the credit, so an edit shows it as a stated fact — and only when there is something to state.
   * A team-paid expense says nothing, because "Paid by: the team" is the absence of news.
   *
   * Extracted from the JSX because as an inline expression it was three nested ternaries deep, which
   * is the point at which a reader counts brackets instead of reading branches.
   */
  function renderPaidBy() {
    if (isPayableForm) return null;

    if (editing) {
      if (!form.paidByPlayerId) return null;
      return (
        <div className={`${styles.field} ${styles.formGridFull}`}>
          <label className={styles.label}>Paid by</label>
          <div className={styles.lockedField}>
            <span>A family, out of pocket</span>
            <span className={styles.lockedTag}>Set at creation</span>
          </div>
        </div>
      );
    }

    return (
      <div className={`${styles.field} ${styles.formGridFull}`}>
        <label className={styles.label}>Paid by</label>
        <select
          className={styles.input}
          value={form.paidByPlayerId}
          onChange={e => setForm(f => ({ ...f, paidByPlayerId: e.target.value }))}
        >
          <option value="">The team</option>
          {roster.map(p => (
            <option key={p.id} value={p.id}>
              A family, out of pocket — {[p.playerLastName, p.playerFirstName].filter(Boolean).join(', ')}
            </option>
          ))}
        </select>
        {form.paidByPlayerId && (
          <p className={`${styles.formHint} ${styles.formHintConsequence}`}>
            Counts in the budget as usual. <strong>No cash leaves the team</strong> — instead the
            team owes this family {form.amount ? fmt(Number(form.amount) || 0) : 'the amount'},
            saved as a credit you can put against their dues or pay out any time.
          </p>
        )}
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
      {/* ⚠ ONE ADD BUTTON (owner review 2026-08-15, Q8). Two lime buttons side by side forced the
          expense-or-payable decision at the moment it was least informed, with no way back except
          cancelling and retyping. The choice now lives at the top of the form, pre-selected from
          the sub-tab, and flipping it keeps what has been entered. The button stays a plain "Add"
          because it no longer names one outcome — the SAVE button names it instead. */}
      <button className={styles.btnPrimary} onClick={() => openAdd()}>
        <Plus size={14} aria-hidden /> Add
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
        variant={embedded ? 'embedded' : 'standard'}
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

      {/* ⚠ SUB-TABS AND ACTIONS SHARE ONE ROW (owner review 2026-08-15, Q2). They used to be two
          stacked bands, so a coach crossed THREE strips of chrome — hub tabs, sub-tabs, then a
          full-width toolbar — before the first row of money. That third strip carried nothing on
          its left whenever the team had no money tags, spending a whole band on three right-aligned
          buttons. Merging them is the whole fix: `.panelToolbarActions` already pins itself right
          with `margin-left: auto`, so the sub-tabs simply become the row's left-hand content.

          The tag filter joins the SAME row rather than reclaiming its own — `.panelToolbar` wraps,
          so it shares the line when it fits and drops below when it doesn't. It self-hides when the
          current tab has no tagged rows; the row itself always renders, because the ACTIONS are
          what must survive every empty state (rule 7), not the filter. The schedule tab is a
          due-date list across two sources, so a tag filter has nothing to narrow there. */}
      {/* Export lives here on every sub-tab, so the row can no longer disappear with the filter
          or the write gate. */}
      <div className={styles.panelToolbar}>
        {/* `.panelToolbarTabs` lets the sub-tab group shrink and wrap instead of sizing to its
            content — see the note on that class. */}
        <div className={`${styles.viewToggle} ${styles.panelToolbarTabs}`}>
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
                  rows: expenseRows(filteredActive, tagsByExpenseId, tagById),
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
          <>
            <CoachEmptyState
              icon={<Receipt size={22} aria-hidden />}
              headline="No expenses yet"
              description="Log what the team has actually spent, one at a time."
              primaryAction={canWriteMoney ? {
                label: 'Add Expense',
                icon: <Plus size={15} aria-hidden />,
                // Names the outcome even though the toolbar button doesn't: an empty state is
                // teaching, and "Add" alone would answer none of the question it just posed.
                onClick: () => openAdd('expense'),
              } : undefined}
            />
            <KindCompare />
          </>
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
                  /* The whole row opens the editor for a write coach — the portal's row-edit
                     convention (owner ruling 2026-08-15): the pencil is the SEMANTIC control, the
                     row is the pointer/touch shortcut, and once this stacks into cards the row is
                     the only visible door. A click that ends a text selection is someone copying
                     an amount, not tapping a row, so it is ignored. */
                  <tr
                    key={e.id}
                    className={`${styles.tr} ${canWriteMoney ? styles.rowTappable : ''}`}
                    onClick={canWriteMoney ? () => { if (window.getSelection()?.toString()) return; openEdit(e); } : undefined}
                  >
                    <td className={`${styles.td} ${styles.cardStackCell}`} data-label="Description">
                      {e.description}
                      {/* ⚠ THE PER-ROW TAG EDITOR IS GONE (owner review 2026-08-15). Tags are edited
                          in the record's own form now, so a row no longer offers a second, narrower
                          door to the same record. The chips stay, read-only — they cost nothing on
                          rows without them, which is also why Tags never became a column. */}
                      {tagChips(e.id)}
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
                        keeps square rows; card mode drops it when it renders nothing (a
                        read-only money coach) rather than drawing a blank line. */}
                    <td className={`${styles.td} ${styles.cardActionCell}`}>
                      {!e.expensePaidAt && canWriteMoney && (
                        <button
                          className={`${styles.btnSecondary} ${styles.compactAction}`}
                          disabled={!!marking[e.id + 'markExpensePaid']}
                          onClick={ev => { ev.stopPropagation(); doAction(e.id, 'markExpensePaid'); }}
                        >
                          {marking[e.id + 'markExpensePaid'] ? '…' : 'Mark Paid'}
                        </button>
                      )}
                      {canWriteMoney && <RowEditButton label={`Edit ${e.description}`} onClick={() => openEdit(e)} />}
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
          <>
            <CoachEmptyState
              icon={<Receipt size={22} aria-hidden />}
              headline="No payables yet"
              description="Record something you've agreed to pay — or bring a whole season's commitments in from a schedule your club already keeps."
              primaryAction={canWriteMoney ? {
                label: 'Add Payable',
                icon: <Plus size={15} aria-hidden />,
                onClick: () => openAdd('payable'),
              } : undefined}
              secondaryAction={canWriteMoney ? {
                label: 'Import a schedule',
                icon: <Upload size={15} aria-hidden />,
                onClick: () => setImportOpen(true),
              } : undefined}
            />
            <KindCompare />
          </>
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
                {/* Same row-edit convention as the Expenses tab beside it: row opens the editor,
                    pencil is the semantic control. The chevron keeps its own job — it EXPANDS the
                    deposit/balance pair in place, which is a different intent from editing, and
                    stops propagation so opening the pair never also opens the form. */}
                <tr
                  className={`${styles.tr} ${canWriteMoney ? styles.rowTappable : ''}`}
                  onClick={canWriteMoney ? () => { if (window.getSelection()?.toString()) return; openEdit(e); } : undefined}
                >
                  <td className={`${styles.td} ${styles.cardStackCell}`} data-label="Description">
                    {e.description}
                    {/* Chips on the ROW now, not only inside the drawer — a payable's tags used to
                        be invisible until you expanded it, while an expense showed its own. */}
                    {tagChips(e.id)}
                  </td>
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
                      onClick={ev => { ev.stopPropagation(); setExpandedPayable(open ? null : e.id); }}
                    >
                      {open ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
                      <span className={styles.cardActionLabel}>{open ? 'Hide details' : 'Payment details'}</span>
                    </button>
                    {canWriteMoney && <RowEditButton label={`Edit ${e.description}`} onClick={() => openEdit(e)} />}
                  </td>
                </tr>
                {open && (
                /* The detail row is NOT tappable-to-edit — it holds its own buttons, and a stray
                   tap between them opening a form would be the accidental-edit complaint the row
                   convention is otherwise careful to avoid. */
                <tr className={styles.tr} onClick={ev => ev.stopPropagation()}>
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
                      ) : <p className={styles.mutedInline} style={{ margin: 0, fontSize: '0.8rem' }}>—</p>}
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
                      ) : <p className={styles.mutedInline} style={{ margin: 0, fontSize: '0.8rem' }}>—</p>}
                    </div>
                  </div>

                  {/* Notes and tags are shown here but no longer EDITED here — both live in the
                      record's form, reached by the pencil or the row. */}
                  {e.notes && <p className={styles.mutedInline} style={{ margin: '0.75rem 0 0', fontSize: '0.78rem' }}>{e.notes}</p>}
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
                          {row.label && <span className={styles.mutedInline} style={{ display: 'block', fontSize: '0.75rem' }}>{row.label}</span>}
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
                            <span className={styles.mutedInline} style={{ fontSize: '0.8rem' }}>
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
            <p className={styles.mutedInline} style={{ fontSize: '0.78rem', marginTop: '0.75rem' }}>
              Money going out only — payable deposits and balances{summaryHasOrgRows ? ', plus what your club has allocated to this team' : ''}.
              Player dues are money coming in and live on{' '}
              <Link href={moneySectionHref(base, 'dues', undefined, seasonQuery)} className={styles.linkBtn}>Player Dues</Link>.
            </p>
          </>
        )
      )}

      {/* ── The record form — one modal for both kinds, add and edit (Q4 + Q8) ─────────────────
          Replaces the two "Add Expense" / "Add Payable" modals that used to sit here. The type is
          a control at the top when ADDING, and a stated fact when EDITING (owner ruling: type is
          set at creation — see the note beside the switch). */}
      {formOpen && (
        <div className={styles.modalOverlay} onClick={closeForm}>
          <div className={`${styles.modal} ${styles.modalScrollBody}`} onClick={e => e.stopPropagation()}>
            <CoachModalHeader
              title={editing
                ? (isPayableForm ? 'Edit payable' : 'Edit expense')
                : 'Add'}
              subtitle={editing ? undefined : 'Record something the team spent, or something it owes.'}
              onClose={closeForm}
            />
            <div className={styles.formGrid}>
              {/* ── What kind of record is this? ──────────────────────────────────────────────
                  ⚠ ONLY WHEN ADDING. A saved record never switches type: converting would mean
                  due-date and deposit fields materialising on an existing row, and a payable
                  converting the other way silently dropping a schedule it may already appear on
                  in the Payment schedule. With Delete available, the wrong type is cheap to fix
                  by deleting and re-adding, which is the honest correction rather than a
                  half-migration. */}
              {!editing ? (
                <div className={styles.formGridFull}>
                  <div className={styles.kindSwitch} role="radiogroup" aria-label="What kind of record is this?">
                    {(['expense', 'payable'] as const).map(k => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={formKind === k}
                        className={`${styles.kindSwitchOption} ${formKind === k ? styles.kindSwitchOptionOn : ''}`}
                        /* ⚠ SWITCHING KEEPS WHAT HAS BEEN TYPED. Description, category and amount
                           are common to both kinds and are exactly the fields already filled in
                           when a coach realises they picked wrong — clearing them would make the
                           switch as expensive as cancelling, which is what it exists to replace. */
                        onClick={() => setFormKind(k)}
                      >
                        <span className={styles.kindName}>{k === 'expense' ? 'Expense' : 'Payable'}</span>
                        <span className={styles.kindSub}>
                          {k === 'expense'
                            ? 'Already paid — recording what happened'
                            : 'Promised but not paid — scheduling what’s coming'}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className={styles.kindEgs}>
                    {isPayableForm
                      ? 'A tournament entry due in March · a dome block · an umpire invoice'
                      : 'Pizza night · a diamond you rented last week · uniforms you bought'}
                  </p>
                </div>
              ) : (
                <p className={`${styles.formHint} ${styles.formGridFull}`} style={{ marginTop: 0 }}>
                  {isPayableForm
                    ? 'A payable — money committed but not yet paid.'
                    : 'An expense — money the team has already spent.'}
                  {' '}Wrong kind? Delete this and add it again.
                </p>
              )}

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Description *</label>
                <input
                  className={styles.input}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={isPayableForm ? 'e.g. Spring tournament entry, summer dome block' : 'e.g. Diamond rental'}
                />
              </div>

              {categoryField(form.category, v => setForm(f => ({ ...f, category: v })))}

              {/* ⚠ A LOCKED FIGURE IS SHOWN WITH ITS VALUE AND ITS REASON, never greyed into
                  silence (owner ruling 2026-08-15). A coach has to be able to read the amount they
                  cannot change AND be told the way out, or the only remaining move is a support
                  question. The server enforces the same rule — this is the explanation, not the
                  guard. */}
              {locks.amount ? (
                <div className={styles.field}>
                  <label className={styles.label}>{isPayableForm ? 'Total Amount' : 'Amount'}</label>
                  <div className={styles.lockedField}>
                    <span>{fmt(Number(form.amount) || 0)}</span>
                    <span className={styles.lockedTag}>Locked</span>
                  </div>
                  <p className={`${styles.formHint} ${styles.formHintConsequence}`}>
                    Paid {locks.paidOn ? fmtDate(locks.paidOn) : ''} — this amount is already on the
                    team’s books. <strong>To change it, delete this and enter it again.</strong>
                  </p>
                </div>
              ) : (
                <div className={styles.field}>
                  <label className={styles.label}>{isPayableForm ? 'Total Amount *' : 'Amount *'}</label>
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              )}

              {/* ── Expense-only: who actually paid ─────────────────────────────────────────
                  ⚠ STAYS ABOVE THE DISCLOSURE (Q1). It is the one field here that does not
                  DESCRIBE the expense but changes what the record MEANS: naming a family turns the
                  entry into money the team now owes them, saved as a credit against their dues. A
                  consequence that size cannot be discovered behind an "(optional)" toggle.
                  ⚠ CREATION ONLY. Changing it later would move a debt to a different household
                  without touching the credit — the server refuses it outright. */}
              {renderPaidBy()}

              {/* ── Payable-only: the deposit / balance split ───────────────────────────────
                  The eleven-field payable (readiness review #8) opens as three: what it's for,
                  what kind, and how much. Each half locks on its own once IT has posted — a paid
                  deposit must never freeze a balance the coach still has to manage. */}
              {isPayableForm && (
                <div className={styles.formGridFull}>
                  <CoachFormDisclosure
                    label="Split into a deposit and a balance"
                    title="Payment schedule"
                    note="Big-ticket costs are often billed as a deposit now and a balance later — tournament entries, dome blocks, uniform orders. Leave this closed to record one amount due on one date."
                    meta={scheduleSet ? 'Set' : undefined}
                    defaultOpen={scheduleSet}
                  >
                    <div className={styles.formSectionGrid}>
                      {locks.deposit ? (
                        <div className={`${styles.field} ${styles.formSectionFull}`}>
                          <label className={styles.label}>Deposit</label>
                          <div className={styles.lockedField}>
                            <span>{fmt(Number(form.depositAmount) || 0)}{form.depositDueDate ? ` · due ${fmtDate(form.depositDueDate)}` : ''}</span>
                            <span className={styles.lockedTag}>Paid</span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className={styles.field}>
                            <label className={styles.label}>Deposit Amount</label>
                            <input className={styles.input} type="number" min={0} step="0.01" value={form.depositAmount} onChange={e => setForm(f => ({ ...f, depositAmount: e.target.value }))} placeholder="0.00" />
                          </div>
                          <div className={styles.field}>
                            <label className={styles.label}>Deposit Due Date</label>
                            <input className={styles.input} type="date" value={form.depositDueDate} onChange={e => setForm(f => ({ ...f, depositDueDate: e.target.value }))} />
                          </div>
                        </>
                      )}
                      {locks.balance ? (
                        <div className={`${styles.field} ${styles.formSectionFull}`}>
                          <label className={styles.label}>Balance</label>
                          <div className={styles.lockedField}>
                            <span>{fmt(Number(form.balanceAmount) || 0)}{form.balanceDueDate ? ` · due ${fmtDate(form.balanceDueDate)}` : ''}</span>
                            <span className={styles.lockedTag}>Paid</span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className={styles.field}>
                            <label className={styles.label}>Balance Amount</label>
                            <input className={styles.input} type="number" min={0} step="0.01" value={form.balanceAmount} onChange={e => setForm(f => ({ ...f, balanceAmount: e.target.value }))} placeholder="0.00" />
                          </div>
                          <div className={styles.field}>
                            <label className={styles.label}>Balance Due Date</label>
                            <input className={styles.input} type="date" value={form.balanceDueDate} onChange={e => setForm(f => ({ ...f, balanceDueDate: e.target.value }))} />
                          </div>
                        </>
                      )}
                    </div>
                  </CoachFormDisclosure>
                </div>
              )}

              {/* ── Shared bookkeeping detail, folded away on both kinds (Q1) ─────────────── */}
              <div className={styles.formGridFull}>
                <CoachFormDisclosure
                  label="Add details (optional)"
                  title="Details"
                  meta={detailsSet ? 'Set' : undefined}
                  defaultOpen={detailsSet}
                >
                  <div className={styles.formSectionGrid}>
                    <div className={styles.field}>
                      <label className={styles.label}>Payment Method</label>
                      <PaymentMethodCombobox
                        methodsApiUrl={`/api/coaches/${orgSlug}/teams/${teamId}/payment-methods`}
                        value={form.paymentMethod}
                        onChange={v => setForm(f => ({ ...f, paymentMethod: v }))}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Payee</label>
                      <PayeeCombobox
                        payeesApiUrl={`/api/coaches/${orgSlug}/teams/${teamId}/payees`}
                        value={formPayee}
                        onChange={setFormPayee}
                        saveScope="team"
                      />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Notes</label>
                    <textarea className={styles.textarea} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Tags</label>
                    <TagSearchCombobox library={expenseTags} selectedIds={formTags} onChange={setFormTags} onCreate={createMoneyTag} placeholder="Type to find or create a money tag…" />
                  </div>
                </CoachFormDisclosure>
              </div>
            </div>

            {saveError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{saveError}</p>}

            {/* ── Delete, in front of a confirmation that states the money consequence ────────
                ⚠ THE DIALOG NAMES DOLLARS, never a bare "Are you sure?". Deleting something
                already paid reverses what it posted, and a coach must be told the size of that
                before they can consent to it. `ledgerReversalPreview` is the SAME function the
                server reverses with, so the sentence and the outcome cannot drift apart. */}
            {confirmDelete && editing && (
              <div className={styles.dangerConfirm} role="alertdialog" aria-label="Confirm delete">
                <p className={styles.dangerConfirmTitle}>
                  Delete “{editing.description}”?
                </p>
                {deletePreview.amount > 0 && (
                  <p className={styles.dangerConfirmBody}>
                    This has already posted <strong>{fmt(deletePreview.amount)}</strong> out of the team’s
                    books{deletePreview.legs > 1 ? ' across two payments' : ''}. Deleting it will
                    reverse that, so cash on hand goes back up by {fmt(deletePreview.amount)}.
                  </p>
                )}
                {deletePreview.owesFamily && (
                  <p className={styles.dangerConfirmBody}>
                    A family paid this out of pocket. <strong>The credit the team owes them will be
                    removed too</strong> — no team cash moves either way.
                  </p>
                )}
                {deletePreview.amount === 0 && !deletePreview.owesFamily && (
                  <p className={styles.dangerConfirmBody}>Nothing has been paid against it, so no money moves.</p>
                )}
                <div className={styles.dangerConfirmActions}>
                  <button className={styles.btnGhost} disabled={deleting} onClick={() => setConfirmDelete(false)}>Keep it</button>
                  <button className={styles.btnDanger} disabled={deleting} onClick={deleteRecord}>
                    {deleting ? 'Deleting…' : deletePreview.amount > 0 ? 'Delete and reverse' : 'Delete'}
                  </button>
                </div>
              </div>
            )}

            <div className={styles.modalFooter}>
              {/* Delete lives in the FORM's footer, not on the row — the pattern Budget Plan set,
                  and the reason a row needs only one control (owner ruling 2026-08-15). */}
              {editing && canWriteMoney && !confirmDelete && (
                <button
                  className={styles.deleteRecordBtn}
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving || deleting}
                >
                  <Trash2 size={13} aria-hidden /> Delete
                </button>
              )}
              <button className={styles.btnGhost} onClick={closeForm}>Cancel</button>
              <button className={styles.btnPrimary} disabled={saving || deleting} onClick={saveRecord}>
                {saving
                  ? 'Saving…'
                  : editing
                    ? 'Save changes'
                    /* The SAVE button names the outcome, which is what lets the toolbar button be
                       a plain "Add" (Q8). */
                    : isPayableForm ? 'Add Payable' : 'Add Expense'}
              </button>
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
        active={formOpen && formDirty}
        interceptClicks={formOpen && formDirty && tabActive}
        message="You haven't saved what you entered on this form. Leave without saving it?"
      />
    </div>
  );
}
