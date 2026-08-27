'use client';
import { useState, useEffect, useCallback, useMemo, useRef, use } from 'react';
import {
  Building2, ArrowUpRight, ArrowDownLeft, Plus, Trash2, Clock,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import CoachNotOnTeam from '@/components/coaches/CoachNotOnTeam';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import RowEditButton from '@/components/coaches/RowEditButton';
import MoneyExportButton from '@/components/coaches/MoneyExportButton';
import BudgetItemPicker, { type BudgetItemSelection } from '@/components/accounting/BudgetItemPicker';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import { useSharedMoneyRead, useBumpMoneyRevision, useOnMoneyRevisionBump } from '@/lib/coach-money-refresh';
import { CLUB_MONEY_ITEM_DIRECTION, type ClubRequest, type ClubRequestType } from '@/lib/coach-club-money';
import { tournamentToday, formatStoredDate } from '@/lib/timezone';
import { isInstallmentOverdue } from '@/lib/dues-status';
import type { RepAllocationInstallment, BudgetCategoryWithItems } from '@/lib/types';
import {
  ALLOCATION_COLUMNS, allocationRows,
  PAYMENT_REQUEST_COLUMNS, paymentRequestRows,
} from '@/lib/coach-money-exports';
import CoachLoadError from '@/components/coaches/CoachLoadError';
import CoachLoading from '@/components/coaches/CoachLoading';
import styles from '../../../../coaches.module.css';

/**
 * ═══ THE CLUB TAB — one relationship, one screen (money redesign P4, owner-ruled 2026-08-17) ═══
 *
 * Two tabs became one. *Allocations* (what the club bills the team) and *Payments* (what the team
 * asks of the club) were two halves of one relationship, and a coach had to hold both in their head
 * to answer the only question either of them exists for: **where do we stand with the club?**
 *
 * ⚠ THIS IS NOT A SECOND DATED BOOK. A flat, dated list of club money already exists — the register
 * filtered to Club (§4.2/§4.3 of the redesign plan) — and building another here would be two books
 * telling one story. This screen is the WORKSPACE: the standing band on top, then the two workflows
 * in the order money flows. An obligation with due dates first, the conversation second.
 *
 * ⚠⚠ WHAT THE MERGE DELIBERATELY DID NOT TOUCH. Everything §35 established carries in whole: the
 * record window, editing while pending, pencil-vs-eye on the row, the withdraw confirmation naming
 * the request, the busy-window lock, the read-only assistant. Moving a door is not re-opening a
 * decision — every one of those rules is reproduced below with its reasoning, not re-derived.
 *
 * ⚠ SEASON-SCOPED, BOTH HALVES (owner ruling 2026-08-17). The two APIs behind this screen were the
 * last team-LIFETIME readers of club money in the product; Cash on hand, the register and the
 * season close-out pot had all been season-scoped by P3, so on any team past its first year this
 * screen's own figures disagreed with the Money overview. Nothing showed the two side by side —
 * which is exactly what a merged tab does.
 *
 * ⚠ IT RENDERS BETWEEN SEASONS, READ-ONLY. Both old tabs vanished the moment a season finished, so
 * a coach could see the club's money on the register but could not open the workspace to read what
 * those instalments were or how a request was decided. These are RECORDS — nothing here recomputes
 * — so they render in place with every write control withdrawn. `isReadOnly` comes from the server,
 * not from the client's own guess about the season.
 */

interface AllocationSplit {
  id: string;
  allocationId: string;
  allocationDescription: string;
  amount: number;
  notes: string | null;
  budgetCategoryId: string | null;
  budgetItemId: string | null;
  budgetCategoryName: string | null;
  budgetItemName: string | null;
  installments: RepAllocationInstallment[];
}

const PAYMENT_METHODS = ['Cash', 'E-Transfer', 'Cheque', 'Card', 'Other'];

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ⚠ `formatStoredDate`, never a hand-rolled `new Date(s)` — this screen mixes bare `date` columns
   (an instalment's due date) with timestamps held at org noon (a review stamp), and both hand-rolls
   have already printed the wrong day on three screens in this portal. */
function fmtDate(s: string | null | undefined) {
  return formatStoredDate(s);
}

/**
 * ⚠⚠ THE WORD IS "CLUB", EVERYWHERE, INCLUDING ON THE BADGES (owner ruling 2026-08-17).
 *
 * These said **Pay Org** / **From Org** until P4, which left a tab called Club whose every row said
 * Org. Argued from the code rather than from taste: coach-facing prose in this portal already ran
 * 57 uses of *club* to 38 of *org*, the empty states and the help guide say *club*, and the
 * register's own chip and filter on these exact rows have read `Club` / `from Club` since P3.
 *
 * ⚠ THE DIRECTION IS STATED FROM THE TEAM'S SIDE, which is the whole reason the original one-line
 * version failed: "Pay Org" and "Request from Org" name the BUTTON, not the outcome, and a coach
 * reading them cold cannot tell which way the money goes.
 */
function DirectionBadge({ type }: { type: ClubRequestType }) {
  const isPay = type === 'payment_to_org';
  return (
    <span className={`${styles.badge} ${styles.badgeDirection} ${isPay ? styles.badgeToOrg : styles.badgeFromOrg}`}>
      {isPay
        ? <><ArrowUpRight size={11} aria-hidden /> To club</>
        : <><ArrowDownLeft size={11} aria-hidden /> From club</>}
    </span>
  );
}

/**
 * ⚠⚠ A PENDING REQUEST SAYS WHO IS HOLDING IT, not merely that it is pending.
 *
 * "Pending" is a status word that answers nothing — a coach reading it cannot tell whether they owe
 * an action or the club does. **Awaiting the club** says whose move it is, which is the one fact
 * this row exists to communicate, and it matches the chip the register now carries on the same
 * money in its forward view.
 */
const STATUS_CHIP: Record<string, { cls: string; label: string }> = {
  pending:  { cls: 'badgePending',  label: 'Awaiting the club' },
  approved: { cls: 'badgeApproved', label: 'Approved' },
  denied:   { cls: 'badgeDenied',   label: 'Declined' },
};

function StatusBadge({ status }: { status: string }) {
  const chip = STATUS_CHIP[status] ?? { cls: 'badgeDraft', label: status };
  return (
    <span className={`${styles.badge} ${styles[chip.cls]}`}>
      {status === 'pending' && <Clock size={11} aria-hidden />} {chip.label}
    </span>
  );
}

/**
 * A stored filing → the picker's selection shape, or null when nothing is filed.
 *
 * ⚠ ONE BUILDER, TWO OPENERS. The bill's filing modal and the request record window each rebuilt
 * this five-field object with the same null-guard off a different source row (`/simplify`, 2026-08-17).
 * Both levels must be present or neither: a selection carrying an item with no category would hand
 * the picker a half-resolved value and let a save write one level of the pair.
 */
function toSelection(
  r: { budgetCategoryId: string | null; budgetItemId: string | null; budgetCategoryName: string | null; budgetItemName: string | null },
): BudgetItemSelection | null {
  if (!r.budgetItemId || !r.budgetCategoryId) return null;
  return {
    categoryId: r.budgetCategoryId,
    categoryName: r.budgetCategoryName ?? '',
    itemId: r.budgetItemId,
    itemName: r.budgetItemName ?? '',
    suggestedAmount: null,
  };
}

/** `Category · Item`, or the honest gap. One renderer, three tables. */
function Filing({ category, item }: { category: string | null; item: string | null }) {
  if (!item && !category) return <span className={styles.mutedInline}>Not filed</span>;
  return (
    <span className={styles.clubFiling}>
      {category && <span className={styles.clubFilingCat}>{category} · </span>}
      {item ?? ''}
    </span>
  );
}

/**
 * What the two halves of this relationship ARE — the teaching pair under the empty state.
 *
 * ⚠⚠ ONE EMPTY STATE WITH ONE ACTION, AND THE MERGE FORCED THE QUESTION. The two old screens
 * disagreed on purpose: Allocations had NO call to action at all (a coach genuinely cannot create
 * one, which is why it used the QUIET empty-state variant), while Payments offered *Make a request*.
 * Merged, one block holds both halves — so it takes the standard variant with the single action a
 * coach can actually perform, and the cards carry the reason the other half has no button. Dropping
 * either would lose something: no action at all strands the one thing they CAN do, and an
 * unexplained missing button reads as a bug.
 *
 * ⚠ THIS IS THE ONLY PLACE A COACH EVER LEARNS ANY OF IT. Merged, the screen has no other teaching
 * surface — the band and both toolbars go quiet when there is nothing to describe.
 */
function ClubExplainer() {
  return (
    <>
      <div className={styles.moneyKindCompare}>
        <div className={`${styles.moneyKindCard} ${styles.moneyKindCardPay}`}>
          <h4><ArrowUpRight size={13} aria-hidden /> What they bill you</h4>
          <p>
            Your club&apos;s <strong>owner or treasurer</strong> splits a shared cost across its teams.
            Your share arrives here already divided into installments with due dates — file it under one
            of your own budget words and mark each installment paid as you pay it.
          </p>
          <p className={styles.moneyKindEgs}>Field and diamond fees · league insurance · association dues</p>
        </div>
        <div className={`${styles.moneyKindCard} ${styles.moneyKindCardClaim}`}>
          <h4><ArrowDownLeft size={13} aria-hidden /> What you ask of them</h4>
          <p>
            You ask the club to <strong>cover or pay back</strong> a cost — or you send money back to
            them. Every request waits as undecided until someone at the club answers, and a decline
            always comes back with a written reason.
          </p>
          <p className={styles.moneyKindEgs}>
            A permit you paid out of pocket · an entry fee the club agreed to fund
          </p>
        </div>
      </div>
      <p className={`${styles.moneyKindTest} ${styles.moneyKindTestStart}`}>
        <strong>There&apos;s no button for the first one, and that isn&apos;t an oversight</strong> — only
        your club can bill your team. And neither is the same as an expense: anything you owe a supplier
        outside the club belongs on <strong>Payables</strong>.
      </p>
    </>
  );
}

export function ClubPanel({
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
  const { assignments, closedAssignments, loading: ctxLoading } = useCoaches();

  const sharedRead = useSharedMoneyRead();
  const bumpMoneyRevision = useBumpMoneyRevision();

  const [splits, setSplits] = useState<AllocationSplit[]>([]);
  const [requests, setRequests] = useState<ClubRequest[]>([]);
  const [categories, setCategories] = useState<BudgetCategoryWithItems[]>([]);
  const [seasonName, setSeasonName] = useState('');
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [marking, setMarking] = useState<Record<string, boolean>>({});

  // ── The request record window ────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ClubRequest | null>(null);
  const [formType, setFormType] = useState<ClubRequestType>('payment_to_org');
  const [formAmount, setFormAmount] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formMethod, setFormMethod] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formItem, setFormItem] = useState<BudgetItemSelection | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  // ── Filing a club bill ───────────────────────────────────────────────────
  const [filingSplit, setFilingSplit] = useState<AllocationSplit | null>(null);
  const [filingItem, setFilingItem] = useState<BudgetItemSelection | null>(null);
  const [filingSaving, setFilingSaving] = useState(false);
  const [filingError, setFilingError] = useState('');

  const assignment = assignments.find(a => a.teamId === teamId);
  const closed = closedAssignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const today = tournamentToday();

  useOverlayOpen(showForm || !!filingSplit);

  /* Money is three-state (off|read|write), and a finished season withdraws every write regardless.
     Read off `assignments`/`closedAssignments` directly because this is needed ABOVE the
     not-on-team guard — the record window's locked state depends on it. */
  const capabilities = assignment?.capabilities ?? closed?.capabilities;
  const canWriteMoney = capabilities?.money === 'write' && !isReadOnly;

  /* Once the club has approved or declined a request the window opens read-only — the record answers
     what the club acted on, and rewriting it would make that answer a lie. The server refuses the
     same edit; this only decides what a coach is OFFERED.

     ⚠ A READ-ONLY MONEY ASSISTANT GETS THE SAME LOCKED WINDOW ON A PENDING REQUEST. They can open
     any row (the list is theirs to read), but without this they would be handed live inputs and no
     Save button — the broken affordance the write gate on the toolbar exists to prevent. */
  const readOnly = !!editing && (editing.status !== 'pending' || !canWriteMoney);
  const canEditRecord = !editing || editing.status === 'pending';

  /* ⚠⚠ WHILE A SAVE OR A WITHDRAW IS IN FLIGHT THE WINDOW CANNOT BE DISMISSED — not by the X, not by
     the overlay, not by Cancel (review 2026-08-16, carried in whole).

     Without this the request outlives the window that started it, and its success handler then closes
     whatever window is open BY THEN: withdraw request A on a slow connection, tap Cancel while it is
     still in flight, open request B, start typing — A's delete comes back and slams B shut, discarding
     typed work with no prompt, straight past the discard guard this file goes out of its way to
     implement. Closing the exit is the fix rather than teaching the handlers what they are closing. */
  const busy = saving || withdrawing;

  /* ⚠ DIRTINESS IS MEASURED AGAINST WHAT THE FORM OPENED WITH, not against "is anything typed here".
     The old test (any field non-empty) was right for a blank create form and completely wrong the
     moment the same form could open an existing record, where it prompted "discard?" on the way out
     of a request the coach had only looked at. Amount is compared in its DISPLAY form so a stored
     180.5 and the "180.50" in the box are not read as an edit. */
  const original = editing
    ? {
        type:   editing.requestType as string,
        amount: editing.amount.toFixed(2),
        desc:   editing.description,
        method: editing.paymentMethod ?? '',
        notes:  editing.notes ?? '',
        itemId: editing.budgetItemId ?? '',
      }
    : { type: 'payment_to_org', amount: '', desc: '', method: '', notes: '', itemId: '' };

  const formDirty = !readOnly && (
    formType !== original.type ||
    formAmount !== original.amount ||
    formDesc !== original.desc ||
    formMethod !== original.method ||
    formNotes !== original.notes ||
    (formItem?.itemId ?? '') !== original.itemId
  );

  const closeForm = useDiscardGuard({
    dirty: formDirty,
    close: () => { setShowForm(false); setConfirmWithdraw(false); },
    noun: 'club request',
  });

  /* ⚠⚠ THE FILING MODAL NEEDS THE SAME GUARD, and shipped without one (`/review`, concurrency lens,
     2026-08-17). It looks trivial — one picker — but a coach can CREATE a brand-new budget word
     inside it (`allowCreateCategory`, inline item create), so tapping the backdrop threw away work
     that does not exist anywhere else yet. Worse, this modal sits in the same component as the
     request window, which DOES prompt: one of the two overlays asking before it discards and the
     other silently dropping the answer is the kind of inconsistency a coach reads as the product
     losing their input at random.

     ⚠ Dirty is measured against what the modal OPENED with — the split's stored filing — never
     "is anything selected", or re-opening a bill that is already filed and closing it would prompt. */
  const filingDirty = !!filingSplit
    && (filingItem?.itemId ?? '') !== (filingSplit.budgetItemId ?? '');

  const closeFiling = useDiscardGuard({
    dirty: filingDirty,
    close: () => setFilingSplit(null),
    noun: 'filing',
  });

  /* ⚠⚠ EVERY LOAD CARRIES A SEQUENCE AND DISCARDS STALE RESPONSES (the P3 review finding, inherited
     rather than re-learned). Every write here reloads twice — once explicitly, once because the
     revision bump re-fires the effect — and nothing decided which won. A slower earlier response
     landing last is how a payment a coach just made reverts on screen.
     ⚠ A ref, not state: bumping a counter must never itself cause a render. */
  const loadSeq = useRef(0);

  /* `quiet` joins the stamp-and-drop this panel already had — the shared Money-panel loading
     convention, written once above `useMoneyRevision` in lib/coach-money-refresh.tsx. Club was
     the last tab still blanking itself whenever money was recorded anywhere else in the hub. */
  const load = useCallback(async (quiet = false) => {
    const seq = ++loadSeq.current;
    if (!quiet) { setLoading(true); setError(''); }
    try {
      /* ⚠ The taxonomy goes through `sharedRead` because the money form one tab over reads the same
         URL; the two club reads are this panel's alone and stay on a plain fetch, the same split the
         Transactions panel makes and for the same reason. */
      const [allocRes, reqRes, catRes] = await Promise.all([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/allocations`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/payment-requests`),
        sharedRead(`/api/coaches/${orgSlug}/budget-items?teamId=${teamId}`),
      ]);
      /* ⚠ EVERY BODY IS READ BEFORE ANYTHING IS WRITTEN, so the staleness guard below has exactly one
         place to sit. Reading a body is another await, and a guard with awaits after it guards only
         the statements it happens to precede. */
      const allocData = await allocRes.json().catch(() => ({}));
      const reqData = await reqRes.json().catch(() => ({}));

      if (seq !== loadSeq.current) return;

      if (!allocRes.ok) throw new Error(allocData?.error ?? 'Failed to load what the club has billed this team.');
      if (!reqRes.ok) throw new Error(reqData?.error ?? 'Failed to load this team\'s club requests.');

      setError(''); // a winning load that succeeded means there is no error any more — see the convention
      const fetchedSplits: AllocationSplit[] = allocData.splits ?? [];
      setSplits(fetchedSplits);
      setRequests(reqData.requests ?? []);
      setIsReadOnly(!!allocData.isReadOnly);
      setSeasonName(allocData.programYearName ?? '');
      if (fetchedSplits.length > 0) setExpanded(prev => (
        Object.keys(prev).length ? prev : { [fetchedSplits[0].id]: true }
      ));
      /* Best-effort: the taxonomy decorates this screen and drives one picker. A failure there must
         not blank the club money a coach came here to read. */
      if (catRes.ok) setCategories((catRes.data.categories as BudgetCategoryWithItems[]) ?? []);
    } catch (e: any) {
      if (quiet || seq !== loadSeq.current) return;
      setError(e.message ?? 'Failed to load your club money.');
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [orgSlug, teamId, sharedRead]);

  useEffect(() => { load(); }, [load]);
  const quietReload = useCallback(() => { void load(true); }, [load]);
  useOnMoneyRevisionBump(quietReload);

  /**
   * WHAT EVERY WRITE ON THIS SCREEN DOES AFTERWARDS. One function, four callers.
   *
   * ⚠⚠ THE ORDER IS THE WHOLE REASON IT EXISTS (money redesign P3, carried here). The shared read is
   * cached per revision, so a `load()` run BEFORE the invalidation replays the answers the save has
   * just made wrong — the screen settles back to exactly what it looked like before the coach
   * pressed Save. The bump clears the cache, so it has to come first.
   */
  const refreshAfterWrite = useCallback(async () => {
    bumpMoneyRevision();
    await load();
  }, [bumpMoneyRevision, load]);

  // ── The standing band ────────────────────────────────────────────────────
  const standing = useMemo(() => {
    const allInstallments = splits.flatMap(s => s.installments);
    const owed = allInstallments.filter(i => !i.paidAt).reduce((s, i) => s + i.amount, 0);
    const owedCount = allInstallments.filter(i => !i.paidAt).length;
    const overdueCount = allInstallments.filter(i => !i.paidAt && i.dueDate < today).length;
    const allocationsPaid = allInstallments.filter(i => i.paidAt).reduce((s, i) => s + i.amount, 0);

    const pending = requests.filter(r => r.status === 'pending');
    const approved = requests.filter(r => r.status === 'approved');
    /* ⚠ `charge_to_org` is money the club sends the TEAM; `payment_to_org` is money the team sends
       the club. Read off the stored type, never off a display label. */
    const settledIn = approved.filter(r => r.requestType === 'charge_to_org').reduce((s, r) => s + r.amount, 0);
    const settledOut = allocationsPaid
      + approved.filter(r => r.requestType === 'payment_to_org').reduce((s, r) => s + r.amount, 0);

    return {
      owed, owedCount, overdueCount,
      waiting: pending.reduce((s, r) => s + r.amount, 0),
      waitingCount: pending.length,
      settledIn, settledOut, settledNet: settledOut - settledIn,
    };
  }, [splits, requests, today]);

  /* ⚠ PENDING FIRST, ALWAYS, THEN NEWEST. A request awaiting an answer is the only row on this table
     a coach may still act on, and the server already returns the list newest-first — so this is a
     STABLE partition of that order, never a re-sort. */
  const orderedRequests = useMemo(() => [
    ...requests.filter(r => r.status === 'pending'),
    ...requests.filter(r => r.status !== 'pending'),
  ], [requests]);

  /**
   * ⚠⚠ MEMOISED BECAUSE THE MERGE PUT A FORM IN THIS COMPONENT (`/simplify`, efficiency lens,
   * 2026-08-17). The old Allocations panel computed these three figures inline per bill and could
   * afford to: it had no form of its own, so nothing re-rendered it rapidly. This panel holds the
   * request record window AND the filing modal, both rendered as OVERLAYS — the bill list beneath
   * is never unmounted — so every character typed into either form re-ran a filter+reduce over
   * every instalment of every club bill.
   *
   * This is the identical trap `expenses/panel.tsx` and `budget/panel.tsx` each carry a warning
   * about; the merge quietly recreated the conditions for it, which is exactly the kind of thing
   * moving code between components does.
   */
  const splitFigures = useMemo(() => {
    const byId = new Map<string, { paid: number; outstanding: number; overdue: number }>();
    for (const s of splits) {
      let paid = 0, outstanding = 0, overdue = 0;
      // One pass per bill, not three — the three figures partition the same list.
      for (const i of s.installments) {
        if (i.paidAt) { paid += i.amount; continue; }
        outstanding += i.amount;
        if (i.dueDate < today) overdue += 1;
      }
      byId.set(s.id, { paid, outstanding, overdue });
    }
    return byId;
  }, [splits, today]);

  const hasAnything = splits.length > 0 || requests.length > 0;

  // ── Writes ───────────────────────────────────────────────────────────────
  async function markPaid(split: AllocationSplit, inst: RepAllocationInstallment) {
    setMarking(prev => ({ ...prev, [inst.id]: true }));
    setActionError('');
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/allocations/${split.id}/installments/${inst.id}`,
        { method: 'PATCH' },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to mark this installment paid.');
      await refreshAfterWrite();
    } catch (e: any) {
      setActionError(e.message ?? 'Failed to mark this installment paid.');
    } finally {
      setMarking(prev => ({ ...prev, [inst.id]: false }));
    }
  }

  function openFiling(split: AllocationSplit) {
    setFilingSplit(split);
    setFilingError('');
    setFilingItem(toSelection(split));
  }

  async function saveFiling() {
    if (!filingSplit) return;
    setFilingSaving(true);
    setFilingError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/allocations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ splitId: filingSplit.id, budgetItemId: filingItem?.itemId ?? null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to file this bill.');
      setFilingSplit(null);
      await refreshAfterWrite();
    } catch (e: any) {
      setFilingError(e.message ?? 'Failed to file this bill.');
    } finally {
      setFilingSaving(false);
    }
  }

  function openForm() {
    setEditing(null);
    setFormType('payment_to_org');
    setFormAmount('');
    setFormDesc('');
    setFormMethod('');
    setFormNotes('');
    setFormItem(null);
    setFormError('');
    setConfirmWithdraw(false);
    setShowForm(true);
  }

  /** Open an existing request — editable while pending, read-only once the club has acted. */
  function openRecord(r: ClubRequest) {
    setEditing(r);
    setFormType(r.requestType);
    setFormAmount(r.amount.toFixed(2));
    setFormDesc(r.description);
    setFormMethod(r.paymentMethod ?? '');
    setFormNotes(r.notes ?? '');
    setFormItem(toSelection(r));
    setFormError('');
    setConfirmWithdraw(false);
    setShowForm(true);
  }

  async function handleSubmit() {
    setFormError('');
    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) { setFormError('Enter an amount greater than 0.'); return; }
    if (!formDesc.trim()) { setFormError('Say what this request is for.'); return; }

    setSaving(true);
    try {
      // One door, two verbs — the create form and the correction form are the same fields, so they
      // are the same submit with a different target.
      const res = await fetch(
        editing
          ? `/api/coaches/${orgSlug}/teams/${teamId}/payment-requests/${editing.id}`
          : `/api/coaches/${orgSlug}/teams/${teamId}/payment-requests`,
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestType:   formType,
            amount,
            description:   formDesc.trim(),
            paymentMethod: formMethod || null,
            notes:         formNotes.trim() || null,
            budgetItemId:  formItem?.itemId ?? null,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to save this request.');
      setShowForm(false);
      await refreshAfterWrite();
    } catch (e: any) {
      setFormError(e.message ?? 'Failed to save this request.');
      /* ⚠⚠ A FAILED SAVE STILL REFRESHES THE LIST, and the 409 is exactly why (`/review`, 2026-08-17).
         The server refuses this edit when the club has approved the request in the meantime — which
         means the row behind this window is now STALE, still chipped *Awaiting the club* for
         something already decided. Leaving it that way told a coach the opposite of what the refusal
         had just said, until some unrelated write happened to bump the revision.
         ⚠ The window stays OPEN with the coach's typing intact — nothing was written, so there is
         nothing to discard; only the list underneath is brought up to date. */
      await refreshAfterWrite();
    } finally {
      setSaving(false);
    }
  }

  /* ⚠ REACHED ONLY THROUGH THE CONFIRMATION IN THE WINDOW. This used to be a bare "Cancel" on every
     pending row that deleted the request on one tap, with nothing asked and no way back — the most
     destructive control on the screen was also its smallest and most ambiguously worded ("Cancel"
     means "dismiss" in every other form in the portal). */
  async function handleWithdraw() {
    if (!editing) return;
    setWithdrawing(true);
    setFormError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/payment-requests/${editing.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Failed to withdraw this request.');
      setShowForm(false);
      setConfirmWithdraw(false);
      await refreshAfterWrite();
    } catch (e: any) {
      setFormError(e.message ?? 'Failed to withdraw this request.');
    } finally {
      setWithdrawing(false);
    }
  }

  if (ctxLoading) return <CoachLoading label="Loading the club's money…" />;
  if (!assignment && !closed) {
    return <CoachNotOnTeam />;
  }

  const teamName = assignment?.teamName ?? closed?.teamName ?? '';

  /**
   * WHAT SAVING THIS REQUEST WILL DO, in dollars — the consequence line every money form in this
   * hub now carries (redesign §2).
   *
   * ⚠ IT COVERS EVERY STATE, including the one where nothing has been typed yet, because a line that
   * appears only once the form is valid is a line a coach never learns to read.
   */
  function consequenceLine() {
    const amount = parseFloat(formAmount);
    const money = isNaN(amount) || amount <= 0 ? null : fmt(amount);
    const filed = formItem?.itemId
      ? <> against <strong>{formItem.categoryName} · {formItem.itemName}</strong></>
      : <> with <strong>nothing to file it under</strong>, so it won&apos;t reach Budget vs. Actual</>;
    if (!money) {
      return <>Enter an amount and the club will see a request for it{formItem?.itemId ? <>{filed}</> : null}. Nothing moves until they approve it.</>;
    }
    return formType === 'payment_to_org'
      ? <>The club sees a request to send them <strong>{money}</strong>{filed}. Nothing leaves your books until they approve it{editing ? ', and you can change or withdraw it until then' : ''}.</>
      : <>The club sees a request for <strong>{money}</strong>{filed}. Nothing arrives on your books until they approve it{editing ? ', and you can change or withdraw it until then' : ''}.</>;
  }

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      {/* ⚰ The "Back to Money" row that stood here is GONE (back-in-header ruling, 2026-08-26).
          It rendered only on the legacy standalone route, and every legacy money route is a
          permanent redirect into the hub — so no coach has seen it since that sweep. Deleted as
          dead code rather than migrated to the header arrow, which is for live drill-ins. */}
      <CoachPageHeader
        variant={embedded ? 'embedded' : 'standard'}
        icon={Building2}
        title="Club"
        helpLabel="Club money"
        help={{ module: 'coaches', sectionIds: ['premium-money'], subtopicId: 'premium-money-org', fullGuideHref: `/${orgSlug}/coaches/help#premium-money` }}
      />

      {loading ? (
        <CoachLoading label="Loading the club's money…" />
      ) : error ? (
        <CoachLoadError message={error} onRetry={() => { void load(); }} />
      ) : !hasAnything ? (
        <>
          <CoachEmptyState
            icon={<Building2 size={22} aria-hidden />}
            headline="Nothing has moved between this team and the club yet"
            description="This is the whole story of your team's money with your club — what they bill you, what you ask of them, and what has settled."
            primaryAction={canWriteMoney ? {
              label: 'Make a request',
              icon: <Plus size={15} aria-hidden />,
              onClick: openForm,
            } : undefined}
          />
          <ClubExplainer />
        </>
      ) : (
        <>
          {/* ── The standing band: where we stand, in one read ──────────────
              ⚠⚠ THREE FIGURES WHERE THE TWO OLD TABS CARRIED SEVEN between them (Total allocated,
              Paid, Outstanding, Overdue · Pending, Approved, Denied). Those counted each LIST; these
              describe the RELATIONSHIP, which is the only reason the two lists now share a screen.
              The old per-list counts survive where they belong — beside their own rows. */}
          <div className={styles.clubBand}>
            <div className={styles.clubBandCell}>
              <span className={styles.clubBandLabel}>Still to pay the club</span>
              <span className={`${styles.clubBandFigure} ${styles.clubBandOut}`}>{fmt(standing.owed)}</span>
              <span className={styles.clubBandSub}>
                {standing.owedCount === 0
                  ? 'nothing outstanding'
                  : `${standing.owedCount} installment${standing.owedCount === 1 ? '' : 's'}`}
                {standing.overdueCount > 0 && (
                  <> · <span className={styles.clubBandOverdue}>
                    <AlertTriangle size={11} aria-hidden /> {standing.overdueCount} overdue
                  </span></>
                )}
              </span>
            </div>
            <div className={styles.clubBandCell}>
              <span className={styles.clubBandLabel}>Waiting on the club</span>
              <span className={`${styles.clubBandFigure} ${styles.clubBandWait}`}>{fmt(standing.waiting)}</span>
              <span className={styles.clubBandSub}>
                {standing.waitingCount === 0
                  ? 'nothing awaiting a decision'
                  : `${standing.waitingCount} request${standing.waitingCount === 1 ? '' : 's'}, not yet decided`}
              </span>
            </div>
            <div className={styles.clubBandCell}>
              <span className={styles.clubBandLabel}>Settled this season</span>
              <span className={styles.clubBandFigure}>
                {fmt(Math.abs(standing.settledNet))}
                <span className={styles.clubBandDirection}>{standing.settledNet >= 0 ? 'out' : 'in'}</span>
              </span>
              <span className={styles.clubBandSub}>
                {fmt(standing.settledOut)} out · {fmt(standing.settledIn)} in
              </span>
            </div>
          </div>
          {/* ⚠⚠ THE ONE SENTENCE THIS SCREEN CANNOT DO WITHOUT. A pending request sits inches from
              money that has genuinely moved, and the two are not the same kind of thing. It is out
              of Cash on hand and out of the Budget Plan — but since P4 it DOES appear in the
              register's forward view (owner ruling 2026-08-17), so saying "it appears nowhere" would
              now be a lie. The line says where it is and what it is not. */}
          <p className={styles.clubBandNote}>
            <strong>Waiting on the club isn&apos;t your money yet</strong> — it&apos;s out of your cash on
            hand and out of your plan. It shows in <strong>Transactions</strong> under
            {' '}<em>include what&apos;s scheduled</em>, marked as still a question.
          </p>

          {actionError && <p className={styles.errorText} style={{ marginBottom: '1rem' }}>{actionError}</p>}

          {/* ── What the club has billed us ───────────────────────────────── */}
          <section className={styles.clubBlock}>
            <div className={styles.panelToolbar}>
              <h3 className={styles.clubBlockTitle}>What the club has billed us</h3>
              {splits.length > 0 && (
                <div className={styles.panelToolbarActions}>
                  <MoneyExportButton
                    label="Club bills"
                    formats={['xlsx', 'csv']}
                    build={() => ({
                      dataset: 'club-allocations',
                      title: 'Club Bills',
                      columns: ALLOCATION_COLUMNS,
                      // One row per INSTALMENT, not per allocation — a payment is what gets matched.
                      rows: allocationRows(splits, today),
                      scopeLabel: seasonName,
                      teamName,
                      emptyMessage: 'Your club has not billed this team this season.',
                    })}
                  />
                </div>
              )}
            </div>

            {splits.length === 0 ? (
              /* ⚠ THE QUIET VARIANT, because this block genuinely carries no action — a coach cannot
                 create an allocation. That pairing is the rule (empty-state addendum §iii): the
                 trigger is the absence of an action ON THE BLOCK, and adding a button here would
                 break it. */
              <CoachEmptyState
                quiet
                icon={<Building2 size={18} aria-hidden />}
                headline="Your club hasn't billed this team this season"
                description="When your club splits a shared cost across its teams, this team's share shows up here with its own payment schedule."
              />
            ) : splits.map(split => {
              const isOpen = !!expanded[split.id];
              const { paid, outstanding, overdue: splitOverdue } =
                splitFigures.get(split.id) ?? { paid: 0, outstanding: 0, overdue: 0 };

              return (
                <div key={split.id} className={styles.detailSection} style={{ marginBottom: '0.75rem', padding: 0 }}>
                  {/* Title left, the two money chips right — until a phone, where the row stacks so
                      neither the bill's name nor the paid/due figures get squeezed off the edge. */}
                  <button
                    type="button"
                    className={styles.stack640}
                    style={{
                      alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      padding: '1rem 1.25rem', textAlign: 'left',
                    }}
                    onClick={() => setExpanded(prev => ({ ...prev, [split.id]: !prev[split.id] }))}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
                      <span style={{ fontWeight: 700, color: 'var(--home-ink, rgba(255,255,255,0.9))', fontSize: '0.95rem' }}>
                        {split.allocationDescription}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--home-dim, rgba(255,255,255,0.4))' }}>
                        {fmt(split.amount)} total
                        {' · '}
                        <Filing category={split.budgetCategoryName} item={split.budgetItemName} />
                        {splitOverdue > 0 && (
                          <span style={{ color: 'var(--danger-light)', marginLeft: '0.5rem' }}>
                            <AlertTriangle size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                            {splitOverdue} overdue
                          </span>
                        )}
                      </span>
                    </div>
                    <div className={styles.allocFigures}>
                      <span className={`${styles.allocFigure} ${styles.allocFigurePaid}`}>{fmt(paid)} paid</span>
                      {/* Always present — a fully-paid share renders an empty slot rather than
                          collapsing the column. */}
                      <span className={`${styles.allocFigure} ${styles.allocFigureDue}`}>
                        {outstanding > 0 ? `${fmt(outstanding)} due` : ''}
                      </span>
                      {isOpen
                        ? <ChevronUp size={16} style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))', flexShrink: 0 }} />
                        : <ChevronDown size={16} style={{ color: 'var(--home-dim, rgba(255,255,255,0.3))', flexShrink: 0 }} />}
                    </div>
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: '1px solid var(--home-line, rgba(255,255,255,0.07))', padding: '1rem 1.25rem' }}>
                      {split.notes && (
                        <p style={{ fontSize: '0.82rem', color: 'var(--home-dim, rgba(255,255,255,0.4))', marginBottom: '1rem' }}>
                          {split.notes}
                        </p>
                      )}

                      {/* ⚠⚠ THE FILING CONTROL LIVES HERE, NOT IN THE HEADER ROW — that row is a
                          <button>, and a button inside a button is invalid markup whose click
                          behaviour is undefined. It is also once per SPLIT rather than per
                          instalment: the instalments are a payment schedule for one thing, and
                          asking the same question four times invites four answers the report would
                          then have to choose between. */}
                      <div className={styles.clubFilingRow}>
                        <span className={styles.clubFilingLabel}>Files under</span>
                        <Filing category={split.budgetCategoryName} item={split.budgetItemName} />
                        {canWriteMoney && (
                          <button type="button" className={`${styles.btnSecondary} ${styles.compactAction}`} onClick={() => openFiling(split)}>
                            {split.budgetItemId ? 'Change' : 'File it'}
                          </button>
                        )}
                        {!split.budgetItemId && (
                          <span className={styles.clubFilingHint}>
                            Until it&apos;s filed, this bill doesn&apos;t appear on Budget vs. Actual.
                          </span>
                        )}
                      </div>

                      {/* One instalment per row: a list, so it stacks into cards at 640 rather than
                          scrolling sideways. */}
                      <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th className={styles.th}>#</th>
                              <th className={`${styles.th} ${styles.thNum}`}>Amount</th>
                              <th className={styles.th}>Due date</th>
                              <th className={styles.th}>Status</th>
                              <th className={styles.th}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {split.installments.map(inst => {
                              const overdue = isInstallmentOverdue(inst.dueDate, inst.paidAt);
                              return (
                                <tr key={inst.id} className={styles.tr}>
                                  <td className={styles.td} data-label="Installment" style={{ color: 'var(--home-dim, rgba(255,255,255,0.4))' }}>{inst.installmentNumber}</td>
                                  <td className={`${styles.td} ${styles.tdNum}`} data-label="Amount">{fmt(inst.amount)}</td>
                                  <td className={styles.td} data-label="Due date" style={{ color: overdue ? 'var(--danger-light)' : 'var(--home-ink-soft, rgba(255,255,255,0.65))' }}>
                                    {fmtDate(inst.dueDate)}
                                    {overdue && <AlertTriangle size={12} style={{ marginLeft: 4, verticalAlign: 'middle', color: 'var(--danger-light)' }} />}
                                  </td>
                                  <td className={styles.td} data-label="Status">
                                    {inst.paidAt ? (
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', color: 'var(--success-light)' }}>
                                        <CheckCircle2 size={13} /> Paid {fmtDate(inst.paidAt)}
                                      </span>
                                    ) : (
                                      /* ⚠ `badgeOverdue`, NOT `badgeCompleted`. This row said "Overdue"
                                         in the AMBER of a completed season while the Overdue figure
                                         above it — and every other overdue mark in the portal — said
                                         it in red. */
                                      <span className={`${styles.badge} ${overdue ? styles.badgeOverdue : styles.badgeDraft}`}>
                                        {overdue ? 'Overdue' : 'Unpaid'}
                                      </span>
                                    )}
                                  </td>
                                  <td className={`${styles.td} ${styles.cardActionCell}`}>
                                    {!inst.paidAt && canWriteMoney && (
                                      <button
                                        type="button"
                                        className={`${styles.btnSecondary} ${styles.compactAction}`}
                                        disabled={!!marking[inst.id]}
                                        onClick={() => markPaid(split, inst)}
                                      >
                                        {/* ⚖ RENAMED FROM "Mark paid" (owner ruling, money
                                            centralization P2 gate 2026-08-23) — the same call
                                            Player Dues made on 2026-08-14, and for the same
                                            reason: this button is not a flag. It RECORDS a
                                            payment — the server derives the amount, the date and
                                            the description, and the money shows on the register
                                            like any other. "Mark paid" described the world before
                                            there were payment records.
                                            ⚠⚠ AND IT STAYS ONE TAP. P2 re-pointed every other
                                            money door at the one conversation; this one was
                                            deliberately left alone. A club installment is
                                            FIELDLESS by design — there is nowhere to put an
                                            amount, a method or a note — so opening a form would
                                            add a step and ask nothing, which is exactly what the
                                            "not one tap slower" rule forbids. Same standing as
                                            Player Dues' "Record as paid" one-taps. */}
                                        {marking[inst.id] ? '…' : 'Record as paid'}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          {/* ── What we've asked the club ─────────────────────────────────── */}
          <section className={styles.clubBlock}>
            <div className={styles.panelToolbar}>
              <h3 className={styles.clubBlockTitle}>What we&apos;ve asked the club</h3>
              {/* ⚠ RENDERS AT EVERY STATE INCLUDING THE EMPTY ONE (rule 7 — "nothing hides"): this
                  block's own empty state offers no button, so gating the toolbar on
                  `requests.length` would leave a coach with no way to make their first request. */}
              <div className={styles.panelToolbarActions}>
                <MoneyExportButton
                  label="Club requests"
                  formats={['xlsx', 'csv']}
                  build={() => ({
                    dataset: 'payment-requests',
                    title: 'Club Requests',
                    columns: PAYMENT_REQUEST_COLUMNS,
                    rows: paymentRequestRows(requests),
                    scopeLabel: seasonName,
                    teamName,
                    emptyMessage: 'This team has made no club requests this season.',
                  })}
                  disabled={requests.length === 0}
                />
                {canWriteMoney && (
                  <button type="button" className={styles.btnPrimary} onClick={openForm}>
                    <Plus size={15} aria-hidden /> Make a request
                  </button>
                )}
              </div>
            </div>

            {requests.length === 0 ? (
              <CoachEmptyState
                quiet
                icon={<ArrowUpRight size={18} aria-hidden />}
                headline="You haven't asked the club for anything this season"
                description="Ask them to cover or pay back a cost, or send money back to them. Every request goes to the club office for a decision."
              />
            ) : (
              <>
                {standing.waitingCount > 0 && (
                  <p className={styles.clubPendingNote}>
                    <Clock size={13} aria-hidden />
                    <span>
                      <strong>
                        {standing.waitingCount === 1
                          ? 'One request is still with the club.'
                          : `${standing.waitingCount} requests are still with the club.`}
                      </strong>
                      {' '}They sit at the top until someone answers, and they show in Transactions&apos;
                      scheduled rows marked as undecided.
                    </span>
                  </p>
                )}
                <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>Request</th>
                        <th className={styles.th}>Files under</th>
                        <th className={styles.th}>Direction</th>
                        <th className={`${styles.th} ${styles.thNum}`}>Amount</th>
                        <th className={styles.th}>Status</th>
                        <th className={styles.th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderedRequests.map(r => {
                        /* Pending → a pencil, because it can still be corrected. Reviewed → an eye,
                           because the club has acted on it. The icon is what tells a coach which
                           they are about to get, one row before they tap. */
                        const pending = r.status === 'pending';
                        return (
                          <tr
                            key={r.id}
                            className={`${styles.tr} ${styles.rowTappable} ${pending ? styles.clubRowPending : ''}`}
                            onClick={() => { if (window.getSelection()?.toString()) return; openRecord(r); }}
                          >
                            <td className={`${styles.td} ${styles.cardStackCell}`} data-label="Request">{r.description}</td>
                            <td className={styles.td} data-label="Files under">
                              <Filing category={r.budgetCategoryName} item={r.budgetItemName} />
                            </td>
                            <td className={styles.td} data-label="Direction"><DirectionBadge type={r.requestType} /></td>
                            <td className={`${styles.td} ${styles.tdNum}`} data-label="Amount" style={{ fontWeight: 700 }}>{fmt(r.amount)}</td>
                            <td className={styles.td} data-label="Status">
                              <StatusBadge status={r.status} />
                              {r.reviewedAt && (
                                <span className={styles.clubReviewedOn}> {fmtDate(r.reviewedAt)}</span>
                              )}
                            </td>
                            <td className={`${styles.td} ${styles.cardActionCell}`}>
                              <RowEditButton
                                mode={pending && canWriteMoney ? 'edit' : 'view'}
                                label={`${pending && canWriteMoney ? 'Edit' : 'View'} ${r.description}`}
                                onClick={() => openRecord(r)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      )}

      {/* ── Filing a club bill ─────────────────────────────────────────────── */}
      {filingSplit && (
        <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (filingSaving ? undefined : closeFiling)?.(); }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <CoachModalHeader
              title="What was this bill for?"
              subtitle={filingSplit.allocationDescription}
              onClose={filingSaving ? () => {} : closeFiling}
            />
            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="club-bill-item">Category &amp; item</label>
                {/* ⚠ THE MONEY-OUT SIDE. A club bill is a cost; there is no direction question here.
                    (A request is the interesting case — see the picker in the record window.) */}
                <BudgetItemPicker
                  categories={categories}
                  value={filingItem}
                  onChange={setFilingItem}
                  direction={CLUB_MONEY_ITEM_DIRECTION}
                  createItemEndpoint={`/api/coaches/${orgSlug}/budget-items`}
                  createItemMode="coach"
                  teamId={teamId}
                  allowCreateCategory
                  selectId="club-bill-item"
                  disabled={filingSaving}
                />
              </div>
              <p className={`${styles.formGridFull} ${styles.formHint} ${styles.formHintConsequence}`}>
                {filingItem?.itemId
                  ? <>Every installment of this bill will report under <strong>{filingItem.categoryName} · {filingItem.itemName}</strong> on Budget vs. Actual. Filing it moves no money.</>
                  : <>Until this bill is filed under one of your budget words, it won&apos;t appear on Budget vs. Actual at all.</>}
              </p>
              {filingError && <p className={`${styles.errorText} ${styles.formGridFull}`}>{filingError}</p>}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.btnGhost} onClick={closeFiling} disabled={filingSaving}>Cancel</button>
              <button type="button" className={styles.btnPrimary} onClick={saveFiling} disabled={filingSaving}>
                {filingSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── The record window: one shape for making a request and for looking one up ──────────
          Opened blank by "Make a request", or on a record by tapping its row. A pending request is
          fully editable here; a reviewed one is the same window read-only. */}
      {showForm && (
        <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (busy ? undefined : closeForm)?.(); }}>
          {/* ⚠ `modalFlushFooter` IS REQUIRED ON ANY MODAL TALL ENOUGH TO SCROLL, and this one is —
              the direction picker, the item picker, four fields and a notes box clear 90vh on a
              laptop. Without it the footer's bottom bleed sits inside the panel's own bottom padding
              (a band of dead space under the buttons) AND shortens the scroll extent, so the last
              field can never quite be scrolled into view. */}
          <div className={`${styles.modal} ${styles.modalFlushFooter}`} onClick={e => e.stopPropagation()}>
            <CoachModalHeader
              title={editing ? 'Club request' : 'New club request'}
              subtitle={editing
                ? `Raised ${fmtDate(editing.createdAt)}${
                    editing.reviewedAt
                      ? ` · ${editing.status === 'approved' ? 'approved' : 'declined'} ${fmtDate(editing.reviewedAt)}`
                      : ' · not yet answered'}`
                : seasonName}
              onClose={busy ? () => {} : closeForm}
            />

            <div className={styles.formGrid}>
              {/* The club's answer comes FIRST on a declined request — it is the only thing the coach
                  opened this window to read, and burying it under fields they already know would make
                  them hunt for it. */}
              {readOnly && editing?.status === 'denied' && editing.denialReason && (
                <div className={`${styles.formGridFull} ${styles.clubDeclineReason}`}>
                  <p className={styles.clubDeclineTitle}>Why this was declined</p>
                  <p className={styles.clubDeclineBody}>{editing.denialReason}</p>
                </div>
              )}

              {/* Direction — a picker while it can still change, the badge it will read as once it can't. */}
              {readOnly ? (
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <span className={styles.label}>Direction</span>
                  <div><DirectionBadge type={formType} /></div>
                </div>
              ) : (
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Which way is the money going? *</label>
                  <div className={styles.clubDirectionPair}>
                    <button
                      type="button"
                      className={`${styles.clubDirectionPick} ${formType === 'charge_to_org' ? styles.clubDirectionOn : ''}`}
                      data-side="in"
                      onClick={() => setFormType('charge_to_org')}
                      aria-pressed={formType === 'charge_to_org'}
                    >
                      <span className={styles.clubDirectionHead}><ArrowDownLeft size={14} aria-hidden /> From the club</span>
                      <span className={styles.clubDirectionSub}>They cover or pay back a cost</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.clubDirectionPick} ${formType === 'payment_to_org' ? styles.clubDirectionOn : ''}`}
                      data-side="out"
                      onClick={() => setFormType('payment_to_org')}
                      aria-pressed={formType === 'payment_to_org'}
                    >
                      <span className={styles.clubDirectionHead}><ArrowUpRight size={14} aria-hidden /> To the club</span>
                      <span className={styles.clubDirectionSub}>We send them money</span>
                    </button>
                  </div>
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.label} htmlFor="club-amount">Amount ($) {!readOnly && '*'}</label>
                {readOnly ? (
                  <p className={styles.recordValue} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(parseFloat(formAmount) || 0)}</p>
                ) : (
                  <input
                    id="club-amount"
                    className={styles.input}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={formAmount}
                    onChange={e => setFormAmount(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                  />
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="club-method">Payment method</label>
                {readOnly ? (
                  <p className={styles.recordValue}>{formMethod || '—'}</p>
                ) : (
                  <select id="club-method" className={styles.select} value={formMethod} onChange={e => setFormMethod(e.target.value)}>
                    <option value="">— optional —</option>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                )}
              </div>

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="club-desc">Description {!readOnly && '*'}</label>
                {readOnly ? (
                  <p className={styles.recordValue}>{formDesc}</p>
                ) : (
                  <input
                    id="club-desc"
                    className={styles.input}
                    type="text"
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    placeholder="e.g. Diamond permit reimbursement — July 14"
                    maxLength={500}
                  />
                )}
              </div>

              {/* ⚠⚠ THE FIELD THIS WHOLE PHASE TURNS ON (mig 250, owner's question at the P4 mockup
                  review). Without it an approved request reached NO part of Budget vs. Actual — the
                  report reads neither this table nor the allocations — so on a club-run team the
                  season's largest money was missing from the screen that compares spending to plan.

                  ⚠⚠ THE MONEY-**OUT** SIDE, ON BOTH DIRECTIONS. A "From the club" request brings
                  money IN, but what it is FOR is a cost — it is a reimbursement, and the refund rule
                  applies: the direction flips the money, never the list. Filing it as revenue would
                  count the season twice, which is the arithmetic `rep_team_money_in`'s own table
                  comment spells out. The constant is imported rather than typed as a literal so the
                  rule has one home. */}
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label} htmlFor="club-item">What is it for?</label>
                {readOnly ? (
                  <p className={styles.recordValue}>
                    <Filing category={editing?.budgetCategoryName ?? null} item={editing?.budgetItemName ?? null} />
                  </p>
                ) : (
                  <BudgetItemPicker
                    categories={categories}
                    value={formItem}
                    onChange={setFormItem}
                    direction={CLUB_MONEY_ITEM_DIRECTION}
                    createItemEndpoint={`/api/coaches/${orgSlug}/budget-items`}
                    createItemMode="coach"
                    teamId={teamId}
                    allowCreateCategory
                    selectId="club-item"
                    disabled={saving}
                  />
                )}
              </div>

              {/* An empty Notes box is worth offering while a request can still be written; on a
                  reviewed one it would be a labelled dash saying nothing. */}
              {(!readOnly || formNotes) && (
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label} htmlFor="club-notes">Notes</label>
                  {readOnly ? (
                    <p className={styles.recordValue}>{formNotes}</p>
                  ) : (
                    <textarea
                      id="club-notes"
                      className={styles.textarea}
                      value={formNotes}
                      onChange={e => setFormNotes(e.target.value)}
                      placeholder="Optional — any context for the club office"
                      rows={2}
                    />
                  )}
                </div>
              )}

              {/* ⚠ THE CONSEQUENCE LINE COVERS EVERY STATE, including before an amount is typed — a
                  line that appears only once the form is valid is one a coach never learns to read. */}
              {!readOnly && (
                <p className={`${styles.formGridFull} ${styles.formHint} ${styles.formHintConsequence}`}>{consequenceLine()}</p>
              )}

              {formError && <p className={`${styles.errorText} ${styles.formGridFull}`}>{formError}</p>}
            </div>

            {/* ⚠ THE CONFIRMATION NAMES THE REQUEST AND SAYS WHAT SURVIVES — never a bare "Are you
                sure?". Withdrawing removes the request outright; the club never sees it and there is
                nothing to restore, so that has to be said before a coach can agree to it. */}
            {confirmWithdraw && editing && (
              <div className={styles.dangerConfirm} role="alertdialog" aria-label="Confirm withdraw">
                <p className={styles.dangerConfirmTitle}>Withdraw “{editing.description}”?</p>
                <p className={styles.dangerConfirmBody}>
                  This takes the request off the club&apos;s list for good — there&apos;s no record kept
                  and no way to bring it back. You can always make a new one.
                </p>
                <div className={styles.dangerConfirmActions}>
                  <button type="button" className={styles.btnGhost} disabled={withdrawing} onClick={() => setConfirmWithdraw(false)}>Keep it</button>
                  <button type="button" className={styles.btnDanger} disabled={withdrawing} onClick={handleWithdraw}>
                    {withdrawing ? 'Withdrawing…' : 'Withdraw request'}
                  </button>
                </div>
              </div>
            )}

            <div className={styles.modalFooter}>
              {/* Withdraw sits in the FORM's footer, never on the row — the rule Budget Plan set and
                  the money screens follow, and the reason a row needs only one control. */}
              {editing && canWriteMoney && !readOnly && !confirmWithdraw && (
                <button type="button" className={styles.deleteRecordBtn} onClick={() => setConfirmWithdraw(true)} disabled={busy}>
                  <Trash2 size={13} aria-hidden /> Withdraw request
                </button>
              )}
              {/* ⚠ THE LONE ACTION IS NEVER THE BORDERLESS ONE. On a locked record "Close" is not the
                  quiet alternative to Save — it is the only thing in the footer, and a ghost control
                  with no edge reads as unfinished text floating in the band. It takes a shape when it
                  stands alone and steps back to the ghost beside Save.
                  ⚠ BOTH FOOTER CONTROLS STAND DOWN WHILE THE WITHDRAW CONFIRMATION IS UP: that block
                  asks one yes/no question, and a live "Save changes" beneath it let a coach save the
                  very edit they were abandoning, closing the window having never answered. */}
              <button
                type="button"
                className={readOnly ? styles.btnSecondary : styles.btnGhost}
                onClick={closeForm}
                disabled={busy || confirmWithdraw}
              >
                {readOnly ? 'Close' : 'Cancel'}
              </button>
              {canEditRecord && canWriteMoney && (
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handleSubmit}
                  disabled={busy || confirmWithdraw || !formAmount || !formDesc.trim()}
                >
                  {saving ? 'Saving…' : (editing ? 'Save changes' : 'Submit request')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <UnsavedChangesGuard
        active={showForm && formDirty}
        interceptClicks={showForm && formDirty && tabActive}
        message={editing
          ? "You've changed this club request but haven't saved it. Leave without saving?"
          : "You haven't submitted this club request. Leave without saving it?"}
      />
    </div>
  );
}
