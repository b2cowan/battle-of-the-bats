'use client';
import { useState, useEffect, useCallback, useMemo, useRef, use, Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Receipt, Plus, CheckCircle2, AlertTriangle, Tag, Settings2, Upload, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import BudgetItemPicker from '@/components/accounting/BudgetItemPicker';
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
import { ledgerReversalPreview } from '@/lib/expense-ledger';
import MoneyExportButton from '@/components/coaches/MoneyExportButton';
import { moneySectionHref } from '@/lib/coach-money-links';
import {
  EXPENSE_COLUMNS, expenseRows,
  // Aliased: this panel already has a local `scheduleRows` holding the filtered schedule ROWS,
  // and the import is the function that turns them into export rows.
  SCHEDULE_COLUMNS, scheduleRows as scheduleExportRows,
  REGISTER_COLUMNS, registerExportRows,
} from '@/lib/coach-money-exports';
import {
  REGISTER_FILTERS, REGISTER_KIND_LABEL, balanceIsMeaningful, matchesFilter,
  type RegisterBookRow, type RegisterFilter,
} from '@/lib/coach-register';
import styles from '../../../../coaches.module.css';
import type {
  RepTeamExpense, RepTeamTag, BudgetCategoryWithItems, RepBudgetPlan, RepRosterPlayer,
  RepTeamMoneyIn,
} from '@/lib/types';
import { isInstallmentOverdue } from '@/lib/dues-status';
import { isFundingKind } from '@/lib/coach-budget-totals';
import { useMoneyRevision, useBumpMoneyRevision, useSharedMoneyRead } from '@/lib/coach-money-refresh';
import { formatStoredDate, tournamentToday, orgDayKey } from '@/lib/timezone';
import { taxonomyKey } from '@/lib/coach-money-derived';
import {
  MONEY_IN_SOURCES, MONEY_IN_SOURCE_LABEL, moneyInReversalPreview,
} from '@/lib/coach-money-in';

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
/** One card in the comparison: a name, what it means, and the examples that do the real work. */
interface KindCard { title: string; body: ReactNode; examples: string }

/** The two-card comparison itself, plus the one-line test underneath. Shared, because there are
 *  now two of these (money out, money in) and the shape invites a third. */
function KindComparePanel({ cards, test }: { cards: KindCard[]; test: ReactNode }) {
  return (
    <>
      <div className={styles.moneyKindCompare}>
        {cards.map(card => (
          <div key={card.title} className={styles.moneyKindCard}>
            <h4>{card.title}</h4>
            <p>{card.body}</p>
            <p className={styles.moneyKindEgs}>{card.examples}</p>
          </div>
        ))}
      </div>
      <p className={styles.moneyKindTest}>{test}</p>
    </>
  );
}

/**
 * Expense or commitment? — under both empty states.
 *
 * ⚠ THE TWO NOW LIVE ON DIFFERENT TABS (Money split P1, 2026-08-16), which makes this panel MORE
 * useful, not less: a coach who reads it on the wrong tab needs to be told where the other one is,
 * not merely what it is called. So the quick test names the tab, and the panel takes the address of
 * the one it is not standing on.
 */
function KindCompare({ otherHref, onPayables }: { otherHref: string; onPayables: boolean }) {
  return (
    <KindComparePanel
      cards={[
        {
          title: 'Expense',
          body: <>Money that has <strong>already left</strong> the team — you&apos;re recording what happened.</>,
          examples: 'Pizza night · a diamond you rented last week · uniforms you bought',
        },
        {
          title: 'Commitment',
          body: <>Money you&apos;ve <strong>promised but not paid</strong> — you&apos;re scheduling what&apos;s coming.</>,
          examples: 'A tournament entry due in March · a dome block · an umpire invoice',
        },
      ]}
      test={<>
        <strong>The quick test:</strong> if it has a due date, it&apos;s a commitment — and it lives on{' '}
        {onPayables
          ? <>this tab. Money that has already gone out belongs on <Link href={otherHref} className={styles.linkBtn}>Transactions</Link>.</>
          : <><Link href={otherHref} className={styles.linkBtn}>Payables</Link>, with your payment schedule.</>}
      </>}
    />
  );
}

/**
 * Income or money back? — the comparison under the register's empty state (mig 243).
 *
 * ⚠⚠ THE THIRD CARD IS THE POINT, and it is not about money in at all. A coach says
 * *"a parent paid me back"* for two opposite things, and the one that already exists — a cost the
 * family paid the vendor directly — leaves the team OWING that family a credit. Teaching the
 * income/money-back pair without naming the out-of-pocket case is teaching two thirds of a
 * distinction, and the third is the one that moves money in a real family's ledger.
 *
 * Same shape and same reasoning as `KindCompare` above: examples are what land, definitions are
 * not, and this is the one moment a coach is reading rather than typing.
 */
function MoneyInCompare() {
  return (
    <KindComparePanel
      cards={[
        {
          title: 'Income',
          body: <>Money the team <strong>earned or was given</strong>.</>,
          examples: 'Registrations for a tournament you hosted · concession takings · a grant',
        },
        {
          title: 'Money back',
          body: <>The team paid for something and <strong>some of it came back</strong>.</>,
          examples: 'A cancelled entry refunded · a vendor credit · the club paying back a permit',
        },
      ]}
      test={<>
        <strong>The quick test:</strong> a refund isn’t income — a refunded $150 entry means the team
        <em> spent $150 less</em>, so it reduces that item instead of adding a row.{' '}
        <strong>And neither one is “a family paid the vendor directly”</strong> — that is a cost with{' '}
        <strong>Paid by</strong> set to the family, and it leaves the team owing them a credit.
      </>}
    />
  );
}

/**
 * ⚠⚠ THE SHARED FORMATTER, NOT A LOCAL ONE (/review, 2026-08-16). This was a hand-rolled
 * `new Date(...).toLocaleDateString()` that rendered in the VIEWER'S timezone — so a paid stamp
 * held at org noon printed the NEXT day for anyone whose device sat at UTC+8 or later, and the
 * screen beside it (which already used `formatStoredDate`) disagreed about the same row.
 *
 * It survived because `expense_paid_at` was almost always "a moment earlier today", where local and
 * org agree. Letting a coach CHOOSE the date made every paid cost carry one, which is what turned a
 * latent inconsistency into a wrong day on an ordinary screen.
 *
 * `formatStoredDate` handles both shapes this screen passes it — a bare `date` column like a due
 * date, and a `timestamptz` like a paid stamp — resolving the second through the ORG's calendar.
 * Keeping the name local so the call sites read the same; the behaviour is now the shared one.
 */
const fmtDate = (s: string | null) => formatStoredDate(s);

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

/**
 * WHICH OF THE TWO TABS THIS PANEL IS BEING (Money split P1, 2026-08-16).
 *
 * One screen used to hold four sub-tabs that divided cleanly along a line nobody had drawn:
 * Expenses and Money in record what HAPPENED, while Payables and the Payment schedule manage what
 * is OWED. The split makes that line the tab boundary.
 *
 * ⚠ THE FACE IS A PROP, NOT A SECOND FILE, and that is a deliberate trade. Both tabs share the
 * record form, the taxonomy picker, the money-tag library, the importer and every fetch — two
 * files would mean two copies of the one form this release turns on. The cost is that a coach who
 * visits both tabs loads the same data twice; the hub only mounts a tab that is actually opened,
 * so nobody pays for a tab they never open.
 */
type MoneyFace = 'transactions' | 'payables';

/**
 * The sub-views, per face. `commitments`/`schedule` live on Payables; Transactions has exactly ONE.
 *
 * ⚠⚠ TRANSACTIONS HAS NO SUB-TABS ANY MORE (money redesign P3, plan §4.3). Its two lists —
 * Expenses and Money in — are gone, replaced by one dated book with a filter strip. They were never
 * two different things: a coach reading their books asks "what happened, in order", and splitting
 * that by direction meant neither list could ever carry a running balance, because half the money
 * was on the other one.
 *
 * ⚠ The union keeps `register` as a member rather than the face becoming tab-less, because the
 * `?tab=` reader, the export label and the empty states are all one check across both faces — and a
 * face with no tab at all would have needed every one of them to learn a second shape.
 */
type ExpenseTab = 'register' | 'commitments' | 'schedule';

const FACE_TABS: Record<MoneyFace, ExpenseTab[]> = {
  transactions: ['register'],
  /* ⚠ SCHEDULE FIRST, AND IT IS THE DEFAULT (plan §0, recommended and adopted). A coach opening
     Payables is asking "what do we owe and when" — a dated list answers that; a list of
     commitments in entry order does not. Commitments is where a record is MANAGED, which is the
     second thing you want, not the first. */
  payables: ['schedule', 'commitments'],
};

type ScheduleFilter = 'unpaid' | 'paid' | 'all';

/** The three ways money-out turns paid. One union, because the settle door and the inline prompt
 *  both have to name one and a fourth would otherwise be added to only one of them. */
type MarkPaidAction = 'markExpensePaid' | 'markDepositPaid' | 'markBalancePaid';

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
  /** What this cost IS (mig 240): the category and the item, which together are the key both
   *  reports group on. Empty until the coach chooses — nothing is assumed for them. */
  budgetCategoryId: '',
  budgetItemId: '',
  /**
   * The chosen item's NAME, as the picker reported it (/review, 2026-08-16 — Critical).
   *
   * ⚠⚠ WITHOUT THIS, AN ITEM CREATED INSIDE THE FORM HAS NO NAME HERE. The picker keeps its own
   * copy of the library and appends an inline-created item to that copy alone — this panel's
   * `categories` does not learn about it until the next full reload, which happens on SAVE. So
   * every reader that looked the name up by id got nothing for exactly the item a coach had just
   * invented: the picker rendered "Equipment · " with a blank half, and — the real damage — the
   * description rule could not recognise its own pre-fill, so picking a DIFFERENT item afterwards
   * left the first item's name sitting on the record. "Bat bag" saved against Umpire fees: the
   * name/thing mismatch this whole taxonomy exists to prevent, reintroduced through the create path.
   *
   * ⚠ NOT SENT TO THE SERVER and not stored: the item id is the record. This is the form
   * remembering what it was told, instead of asking a list that lags behind it.
   */
  budgetItemName: '',
  amount: '',
  notes: '',
  paymentMethod: '',
  /** Out-of-pocket (owner Call 5, mig 234) — '' = the team paid, the usual case. Expense-only. */
  paidByPlayerId: '',
  /**
   * A commitment's ONE due date — the un-split case (Money split P1, 2026-08-16).
   *
   * ⚠⚠ THE FORM PROMISED THIS FIELD AND DID NOT HAVE IT. The split group's note read "Leave this
   * closed to record one amount due on one date", but with it closed there was NO date input at
   * all: the commitment saved with no due date, showed "No schedule", never reached the payment
   * schedule and had no Mark paid button anywhere. A coach could record what the team owed and
   * then never be reminded of it.
   *
   * ⚠ IT IS STORED AS THE DEPOSIT HALF, which is not a workaround — it is the convention the bulk
   * importer has always used for exactly this row ("No explicit split → the whole amount is due on
   * the one date, stored as the deposit half"). Reusing it means a hand-typed commitment and an
   * imported one are the same record, so the schedule, the exports and every sum keep working with
   * nothing new in the data.
   */
  dueDate: '',
  /** Commitment-only, all four — the deposit/balance split when the coach opens it. */
  depositAmount: '',
  depositDueDate: '',
  balanceAmount: '',
  balanceDueDate: '',
  /** Money-in only (mig 243): the day it ARRIVED, and — on a refund — who paid it back. */
  receivedDate: '',
  receivedFrom: '',
  /** A paid cost's own date (2026-08-16) — the money-out twin of `receivedDate`. Expense-only:
   *  a payable is settled through its halves, each with its own due and paid date. */
  paidDate: '',
};

/**
 * THREE ANSWERS, BECAUSE ACCOUNTING HAS THREE (COACH_MONEY_IN_TAXONOMY_PLAN §3.1, mockup
 * `ee76cc79`). Replaces the two-way Expense · Payable switch.
 *
 * ⚠ `refund` IS NOT INCOME, and that is the whole reason there are three rather than two. A
 * refunded tournament entry means the team spent $150 less, not that it earned $150 — booking it
 * as income overstates both sides and corrupts every per-item cost figure downstream.
 *
 * ⚠ AND `refund` IS NOT "PAID OUT OF POCKET" (`paidByPlayerId`, the field a few lines down). A
 * coach describes both as "a parent paid me back": one returns money the team spent, the other
 * means the team OWES that family a credit. The form says so out loud on the refund branch.
 *
 * ⚠ THE IDS DELIBERATELY AVOID THE WORDS `cost`, `funding` AND `sponsorship`. Those are budget-LINE
 * kinds, and `tests/unit/budget-line-kind-guard.test.ts` bans comparing them to literals anywhere
 * in a file that touches the kind — this one does (`isFundingKind`, below). Different vocabulary,
 * different names, no collision.
 */
type EntryKind = 'expense' | 'income' | 'refund';

/**
 * ⚠ PAYABLE IS A TIMING ATTRIBUTE, NOT A FOURTH ANSWER (plan §3.1, decided deliberately).
 *
 * A payable has always been a cost with a due date — the money is the same money, only later. Made
 * a peer of Income it would have claimed to be a different KIND of money, and the three-way
 * question the whole release rests on would have read as four unrelated things. So it lives one
 * level down, appearing only once "A cost" is chosen. A scheduled INCOME needs no equivalent: that
 * is a budget line, which the plan side already models.
 */
type CostTiming = 'paid' | 'payable';

/**
 * What the form is called, in every place it has to name itself.
 *
 * ⚠ ONE EXHAUSTIVE RECORD, NOT SIX TERNARY CHAINS. The modal title, the discard-guard noun, the
 * examples line, the stated-fact sentence on an edit, the delete-confirm title and the save button
 * each spelled the same four-way fork out for themselves — so a fifth kind, or a reworded example,
 * meant finding all six and getting all six right. A `Record` keyed by the resolved tag makes a
 * missing case a compile error, which is the same lesson `LINE_KIND_LABEL` and friends already
 * encode one module over.
 *
 * ⚠ Keyed by the RESOLVED tag (payable split out of cost), because that is what the copy varies
 * by — `entryKind` alone cannot tell an expense from a payable.
 */
type FormKindTag = 'expense' | 'payable' | 'income' | 'refund';

/* ⚠ `examples` AND `addLabel` ARE GONE (owner ruling 2026-08-16, P2 §5 and §6). The examples were
   teaching copy on a form — the comparison panels on the two empty states and the help guide say
   the same thing, at the moment a coach is reading rather than typing. `addLabel` named the outcome
   on the save button; the consequence line does that in dollars now, and the button says `Save`. */
const FORM_COPY: Record<FormKindTag, {
  /** Modal title when editing a saved record. */
  editTitle: string;
  /** What the discard guard calls the thing being abandoned. */
  noun: string;
  /** The stated fact shown instead of the switch on an edit. */
  statedFact: string;
}> = {
  expense: {
    editTitle: 'Edit expense',
    noun: 'expense',
    statedFact: 'An expense — money the team has already spent.',
  },
  /* ⚠ THE RECORD IS A COMMITMENT; THE TAB IS STILL PAYABLES (plan §6 + prompt §3, 2026-08-16).
     "Commitment" is what a coach calls the thing and what the door says; "Payables" is the
     established in-product word for the WORKSPACE, kept because the schedule, the exports, the
     help guide and the QA ledger all speak it and renaming those buys nothing. */
  payable: {
    editTitle: 'Edit commitment',
    noun: 'commitment',
    statedFact: 'A commitment — money the team owes but has not paid.',
  },
  income: {
    editTitle: 'Edit income',
    noun: 'income entry',
    statedFact: 'Income — money the team earned or was given.',
  },
  refund: {
    editTitle: 'Edit money back',
    noun: 'money-back entry',
    statedFact: 'Money back — a refund, credit or reimbursement of something already recorded.',
  },
};

/** The sub-view a coach is standing on decides how the form opens. On either Payables view that is
 *  always a commitment — the tab has exactly one kind of record in it, which is the point of it.
 *  ⚠ The register opens on a paid EXPENSE, not on income: the book holds both directions, and the
 *  form's two pills are one click apart, so the door opens on the far commoner of the two. */
function kindForTab(tab: ExpenseTab): { kind: EntryKind; timing: CostTiming } {
  if (tab === 'commitments' || tab === 'schedule') return { kind: 'expense', timing: 'payable' };
  return { kind: 'expense', timing: 'paid' };
}

/**
 * Does this commitment carry a deposit/balance split, or is it one amount on one date?
 *
 * ⚠ THE BALANCE HALF IS THE TELL, not "has any half at all". The un-split case is stored as the
 * deposit alone (see `dueDate` on `BLANK_RECORD`), so testing for a deposit would call every
 * simple commitment a split one and hide its due date behind a group the coach never opened.
 */
function hasDepositBalanceSplit(e: Pick<RepTeamExpense, 'balanceAmount' | 'balanceDueDate'>): boolean {
  return e.balanceAmount != null || !!e.balanceDueDate;
}

/** Turn a saved record back into form strings, for Edit. */
function formFromExpense(e: RepTeamExpense): typeof BLANK_RECORD {
  const num = (v: number | null) => (v == null ? '' : String(v));
  return {
    ...BLANK_RECORD,
    description: e.description,
    category: e.category ?? '',
    budgetCategoryId: e.budgetCategoryId ?? '',
    budgetItemId: e.budgetItemId ?? '',
    amount: String(e.amount),
    notes: e.notes ?? '',
    paymentMethod: e.paymentMethod ?? '',
    paidByPlayerId: e.paidByPlayerId ?? '',
    depositAmount: num(e.depositAmount),
    depositDueDate: e.depositDueDate ?? '',
    balanceAmount: num(e.balanceAmount),
    balanceDueDate: e.balanceDueDate ?? '',
    /* The un-split commitment reads its one due date back off the deposit half it was stored in.
       A split one leaves this empty — its dates are the two halves' own, and the form hides this
       field entirely rather than showing a third date with nothing to mean. */
    dueDate: hasDepositBalanceSplit(e) ? '' : (e.depositDueDate ?? ''),
    /* ⚠ THE STORED INSTANT BECOMES THE ORG'S DAY for the picker (2026-08-16). `expense_paid_at` is
       a timestamptz held at org noon; a `<input type="date">` wants `YYYY-MM-DD`, and slicing the
       raw ISO string would hand it the UTC day — the same off-by-one this release exists to close,
       arriving through the edit form instead of the write. */
    paidDate: e.expensePaidAt ? orgDayKey(e.expensePaidAt) : '',
  };
}

/** The same, for an arrival. Shares BLANK_RECORD so the two halves of one form stay one shape. */
function formFromMoneyIn(m: RepTeamMoneyIn): typeof BLANK_RECORD {
  return {
    ...BLANK_RECORD,
    description: m.description ?? '',
    budgetCategoryId: m.budgetCategoryId ?? '',
    budgetItemId: m.budgetItemId ?? '',
    /* An arrival carries its item's NAME as well as its id — the reader joins it — so the form can
       be seeded directly. A cost cannot: `RepTeamExpense` stores ids only, and `chosenItemName`
       falls back to the library lookup for those, which is always loaded for a saved record. */
    budgetItemName: m.budgetItemName ?? '',
    amount: String(m.amount),
    notes: m.notes ?? '',
    receivedDate: m.receivedDate,
    receivedFrom: m.receivedFrom ?? '',
  };
}

/* ⚖ NOTHING ON A SAVED RECORD IS READ-ONLY ANY MORE (owner ruling 2026-08-16). This used to read a
   shared lock predicate twice — once to grey a posted figure, once to strip it out of the save —
   and both copies are gone with the rule. The server moves the team's books to match whatever it is
   given, so the form's job is to say what a change will DO, not to prevent it. */

interface MoneyPanelProps {
  params: Promise<{ orgSlug: string; teamId: string }>;
  /** Rendered as a Money hub tab — suppress the standalone "back to Money" affordance. */
  embedded?: boolean;
  /** Is this panel the tab currently on screen? See UnsavedChangesGuard's `interceptClicks`. */
  tabActive?: boolean;
}

/** The Transactions tab — what has already happened. Two views: the Expenses list and Money in.
 *  ⚠ P3 REPLACES THIS FACE ENTIRELY with the register (one dated book, running balance). The two
 *  lists are carried across unreshaped on purpose, so P1 changes where things live and P3 changes
 *  what they look like — never both in one release. */
export function TransactionsPanel(props: MoneyPanelProps) {
  return <MoneyRecordsPanel {...props} face="transactions" />;
}

/** The Payables tab — what the team owes. The payment Schedule (its landing view) and the
 *  commitment list, both moved whole from the screen they used to share with the two above. */
export function PayablesPanel(props: MoneyPanelProps) {
  return <MoneyRecordsPanel {...props} face="payables" />;
}

function MoneyRecordsPanel({
  params: paramsPromise,
  embedded = false,
  tabActive = true,
  face,
}: MoneyPanelProps & { face: MoneyFace }) {
  const params = use(paramsPromise);
  const { orgSlug, teamId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();

  const [expenses, setExpenses] = useState<RepTeamExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<ExpenseTab>(FACE_TABS[face][0]);

  /* ⚠ THE WRAPPER SURVIVES ITS ONE JOB, DELIBERATELY. It existed to cancel the inline "when was
     this paid?" prompt on a view change (/review, 2026-08-16) — an open prompt was anchored to a row
     id, so leaving and returning reopened it with its old date on a visit started for another
     reason. That prompt is gone (money redesign P3), but the lesson is about the NEXT piece of
     per-row state a view picks up, and one wrapper is what makes "clear it on the way out"
     checkable rather than remembered at each call site. */
  const goToTab = useCallback((next: ExpenseTab) => {
    setTab(next);
  }, []);

  // Structured categories (owner decision 2026-07-08: free-text retired). The picker
  // shares the budget taxonomy so Budget vs. Actual's name-match join can't misfire.
  const [categories, setCategories] = useState<BudgetCategoryWithItems[]>([]);
  /* Which category+item pairs this team actually BUDGETED for (mig 240) — cost lines only.
     ⚠ IT EXISTS ONLY TO SAY SO AT ENTRY TIME. Nothing here is saved on the cost; the report
     derives the same answer from the same two ids. A coach filing something the plan never
     mentioned is told, in the moment, that it will appear as unplanned spending — the same honesty
     the old category warning carried, one level finer. The panel already fetched the plan, so this
     costs no extra request. */
  const [budgetLines, setBudgetLines] = useState<
    Array<{ categoryId: string | null; itemId: string | null; direction: 'in' | 'out' }>
  >([]);

  /* Which payable has its deposit/balance detail open. One at a time — the pair is tall, and a
     list with every row expanded is the card list this replaced. */
  const [expandedPayable, setExpandedPayable] = useState<string | null>(null);

  /* Money coming IN (mig 243): income and money back, in one list beside the two money-out ones.
     `derivedKeys` are the category+item rows whose actual already comes from a fundraiser or a
     sponsor — the form greys those out and says why, and the server refuses them regardless. */
  const [moneyIn, setMoneyIn] = useState<RepTeamMoneyIn[]>([]);
  const [derivedKeys, setDerivedKeys] = useState<Set<string>>(new Set());

  /* ── The register (money redesign P3) ──────────────────────────────────────────────────────
     The whole season's book, assembled server-side, with each row's balance already attached.
     ⚠ THE BALANCE IS NOT RECOMPUTED HERE. The screen's headline claim is that its closing balance
     IS Cash on hand, and that figure is produced by a different route from the same records — a
     second arithmetic in the browser is exactly how the two would start disagreeing by a cent on a
     screen whose entire point is that they don't. */
  const [book, setBook] = useState<{
    scheduled: RegisterBookRow[]; settled: RegisterBookRow[];
    cashOnHand: number; projectedBalance: number | null; orgLinked: boolean;
  } | null>(null);
  const [registerFilter, setRegisterFilter] = useState<RegisterFilter>('all');
  /** Narrowing by one budget word. Shares the balance rule with the type filter — any narrowing
   *  at all takes the Balance column away. */
  const [registerItemId, setRegisterItemId] = useState('');
  /* ⚠ ON BY DEFAULT (plan §4.4, recommended and adopted). The book then answers "what happened"
     and "what's coming" in one read, and the Today rule plus the projected styling keep the two
     halves unmistakable. Colour never carries that distinction alone. */
  const [showScheduled, setShowScheduled] = useState(true);

  // One form, three answers, two modes (add / edit) — see BLANK_RECORD and EntryKind.
  const [formOpen, setFormOpen] = useState(false);
  const [formKind, setFormKind] = useState<EntryKind>('expense');
  const [formTiming, setFormTiming] = useState<CostTiming>('paid');
  /** The record being edited, or null when adding. Held whole so the locks can read its paid state. */
  const [editing, setEditing] = useState<RepTeamExpense | null>(null);
  /** The ARRIVAL being edited. Separate from `editing` on purpose: they are different records in
   *  different tables with different rules, and one nullable union would invite a reader to
   *  forget which they were holding. Exactly one of the two is ever set. */
  const [editingMoneyIn, setEditingMoneyIn] = useState<RepTeamMoneyIn | null>(null);
  const [form, setForm] = useState(BLANK_RECORD);
  const [formPayee, setFormPayee] = useState<PayeeSelection | null>(null);
  /**
   * Is the deposit/balance split open on the commitment form?
   *
   * ⚠ CONTROLLED HERE RATHER THAN INSIDE A `CoachFormDisclosure`, which is what it used to be. The
   * plain "Due date" field has to DISAPPEAR when the split opens — two halves carry their own
   * dates, and a third date beside them would mean nothing — and a disclosure that owns its own
   * open state cannot tell the field outside it to go away.
   */
  const [formSplit, setFormSplit] = useState(false);
  /**
   * The commitment — or the half — this form is SETTLING, when it was opened by Mark paid.
   *
   * ⚠⚠ SETTLING IS A PATCH ON THE EXISTING RECORD, NEVER A NEW ONE (plan §8). A transaction and a
   * commitment both carrying the same $600 is the double-count the whole split exists to prevent,
   * so this holds the record's own id and the action that settles it; save sends the coach's edits
   * and the mark-paid action in ONE request, which the route already handles as a pair.
   */
  const [settling, setSettling] = useState<
    { expenseId: string; action: MarkPaidAction; describes: string; half: 'deposit' | 'balance' | null } | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  /** Was the last save refused for a future date? Its own flag rather than a longer sentence,
   *  because the answer needs a LINK to the commitment door and a thrown message cannot carry one. */
  const [futureDateRefused, setFutureDateRefused] = useState(false);
  /* ⚠ `marking` AND `paidPrompt` ARE GONE with the inline date prompt they served (money redesign
     P3) — see the note where `doAction` used to be. Every Mark paid opens the money form now, and
     the form has its own busy state, so a second per-row one would have been a spinner nothing
     could turn off. */

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

  // Drives the form's Details disclosure (Batch 2, P0 #8). Read on mount, so a form pre-filled
  // with a bookkeeping detail — an EDIT, most often — opens it by itself rather than hiding what
  // the coach came to change. (The deposit/balance split used to be one of these and is now
  // controlled by `formSplit` — see the note there.)
  /* ⚠ `paidByPlayerId` COUNTS NOW (Money form P2). It moved inside this fold, so a saved
     out-of-pocket cost opened for editing would otherwise hide the very fact that makes it
     unusual — behind a toggle labelled as optional. It is the strongest reason a form has to open
     itself. */
  const detailsSet = Boolean(
    form.paymentMethod || form.notes || formPayee || formTags.length || form.paidByPlayerId,
  );
  /* ⚠ `editedPaidOn` IS GONE (Money form P2). It existed for one sentence under the Amount field —
     "Paid <date>. Changing this updates the team's books too" — which is now one branch of
     `consequenceLine`, reading `editing.expensePaidAt` where it is needed. A derived value kept
     alive for a paragraph that moved is how the next reader learns a rule that no longer applies. */
  /* ⚠ THE SAVED RECORD WINS when there is one. The switch is hidden while editing, so `formKind`
     could only ever go stale there — deriving from the record instead means the form cannot render
     a payable's fields for an expense (or vice versa) because a state setter was forgotten. In add
     mode `formKind` is the coach's actual choice and is authoritative. */
  const entryKind: EntryKind = editingMoneyIn
    ? (editingMoneyIn.kind === 'income' ? 'income' : 'refund')
    : editing ? 'expense'
    : formKind;
  const isMoneyInForm = entryKind !== 'expense';
  /**
   * WHICH PILL IS PRESSED, and which words the picker may offer (owner ruling 2026-08-16, mig 246).
   *
   * ⚠⚠ A REFUND SITS ON THE **EXPENSE** PILL, and this one line is where the whole tick-box design
   * holds together. The money moves IN on a refund — but the thing it is paying back is something
   * the team SPENT, so the word it is filed against is an expense word. §2's "the tick box flips
   * the direction of the money and never changes the list you choose from" is exactly this: the
   * pill decides the list, the tick decides the direction, and only `income` is on the other side.
   */
  const formSide: 'in' | 'out' = entryKind === 'income' ? 'in' : 'out';
  /**
   * The item a set of form values points at, or null.
   *
   * ⚠ ONE LOOKUP, THREE READERS (/simplify, 2026-08-16). The category→item find→find chain was
   * written out three times in this file — in the picker field, in the refund consequence sentence,
   * and in `setEntrySide` — and the third copy had already dropped one branch of the shared rule.
   * It takes the values rather than reading `form` because `setEntrySide` runs inside a functional
   * updater, where the render-scope `form` is the stale one.
   */
  const itemFor = useCallback((values: Pick<typeof BLANK_RECORD, 'budgetCategoryId' | 'budgetItemId'>) =>
    (categories.find(c => c.id === values.budgetCategoryId)?.items ?? [])
      .find(i => i.id === values.budgetItemId) ?? null,
  [categories]);
  /**
   * What the chosen item is CALLED — the form's own memory first, the library second.
   *
   * ⚠⚠ THE ORDER IS THE FIX (/review, Critical). The library lookup alone cannot name an item the
   * coach created inside this form, because the picker adds it to its own copy and this panel does
   * not reload until the save. `budgetItemName` is what the picker actually handed us, so it is
   * right in exactly the case the lookup is wrong; the lookup still covers a record opened from a
   * list, which carries ids and no name (`RepTeamExpense` stores no item name).
   */
  const chosenItemName = useCallback((values: typeof BLANK_RECORD) =>
    values.budgetItemName || itemFor(values)?.name || '',
  [itemFor]);
  /**
   * Is this description still just the item's own pre-filled name?
   *
   * ⚠⚠ THE RULE THAT DECIDES WHETHER A COACH'S TYPING SURVIVES, and it had two definitions. The
   * picker's `onChange` and `setEntrySide` each spelled it out, and they disagreed: only one
   * treated an EMPTY description as untouched. That happened not to matter because the two paths
   * clear different things — which is precisely the kind of accident that stops being true when a
   * third caller arrives.
   */
  const isItemLabel = useCallback((values: typeof BLANK_RECORD) => {
    const previousName = chosenItemName(values);
    return values.description.trim() === ''
      || (previousName !== '' && values.description.trim() === previousName);
  }, [chosenItemName]);
  /**
   * Press a pill.
   *
   * ⚠ THE ITEM CLEARS AND THE DESCRIPTION FOLLOWS IT. Since mig 246 the picker offers one side's
   * words only, so an item carried across the switch would be a selection sitting in a control that
   * can never re-offer it — the coach sees a filled field they cannot change back to. Clearing it
   * costs one re-pick; leaving it costs a save filed against a word from the wrong side of the
   * books. The description clears with it only when it is still the ITEM'S name, never words the
   * coach typed — the same rule the picker's own pre-fill has always followed.
   */
  function setEntrySide(side: 'in' | 'out') {
    if (side === formSide) return;
    setFormKind(side === 'in' ? 'income' : 'expense');
    setForm(f => ({
      ...f,
      budgetCategoryId: '',
      budgetItemId: '',
      budgetItemName: '',
      category: '',
      description: isItemLabel(f) ? '' : f.description,
    }));
  }
  /** Opened by Mark paid — the money door standing over a commitment, not the commitment's form. */
  const isSettling = !!settling;
  /**
   * WHAT THE FORM IS DOING, resolved once (/simplify, 2026-08-16).
   *
   * ⚠ THE PRIORITY IS THE POINT, and it was being re-derived at four call sites — the modal title,
   * its subtitle, the Delete gate and the save button each spelled out `settling ? … : editing ? …`
   * for themselves. A settle sets `editing` too (it stands over a saved record), so ANY site that
   * tested `editing` first silently got the wrong answer; four copies is four chances to write it
   * in the wrong order, and a fifth mode would need all four found. Same lesson as `FORM_COPY`
   * above and `resetForm` below.
   */
  const formMode: 'settle' | 'edit' | 'add' =
    settling ? 'settle' : (editing || editingMoneyIn) ? 'edit' : 'add';
  /**
   * ⚠ A SETTLE WEARS THE MONEY FORM, NOT THE COMMITMENT FORM (plan §3). `editing` holds a payable
   * while settling one, so reading the record alone would have drawn due-date fields and a
   * deposit/balance split over a question that is only ever "how much left, and when?". The
   * commitment's own fields are one Cancel away, on its row.
   */
  const isPayableForm = isSettling
    ? false
    : editing
      ? editing.expenseType === 'tournament_payable'
      : entryKind === 'expense' && formTiming === 'payable';
  /** The one place the four-way fork is resolved; every label below reads from `copy`. */
  const formTag: FormKindTag = entryKind !== 'expense' ? entryKind : isPayableForm ? 'payable' : 'expense';
  const copy = FORM_COPY[formTag];
  /* What the coach is told before confirming a delete. Reads the same functions the server reverses
     with (lib/expense-ledger.ts, lib/coach-money-in.ts), so the sentence and the outcome cannot
     drift apart. ⚠ Money IN reverses the other way — deleting it LOWERS cash on hand — so it gets
     its own sentence rather than sharing the expense one with a flipped word. */
  const deletePreview = editing
    ? ledgerReversalPreview(editing)
    : { amount: 0, legs: 0, owesFamily: false };
  const moneyInDeletePreview = editingMoneyIn ? moneyInReversalPreview(editingMoneyIn) : null;

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
     coach opened to read and closed untouched — and the guard would cry wolf until it was ignored.

     ⚠⚠ THE BASELINE IS WHAT THE FORM OPENED WITH, not a re-derivation of it (/review, 2026-08-16).
     Re-deriving from the record was already wrong for anything an opener PRE-FILLS, and the guard
     had been crying wolf for exactly that reason: every Add form seeds today's date, and a settle
     seeds the half's amount and today's date — none of which appear in `BLANK_RECORD` or in
     `formFromExpense`, so the form read as dirty before a single keystroke. A coach opening Mark
     paid, thinking better of it and pressing Cancel got "Discard this commitment?" over a form
     they had not touched. Recording the opening state makes "dirty" mean what it says, whatever a
     future opener decides to pre-fill. */
  const [formOpenedWith, setFormOpenedWith] = useState(BLANK_RECORD);
  const formBaseline = formOpenedWith;
  const baselineTags = editing ? (tagsByExpenseId[editing.id] ?? []) : [];
  const formDirty = touched(form, formBaseline)
    || (formPayee?.displayName ?? null) !== (editing?.payeePayer ?? null)
    || formTags.length !== baselineTags.length
    || formTags.some(id => !baselineTags.includes(id));
  const closeForm = useDiscardGuard({
    dirty: formDirty,
    close: () => { setFormOpen(false); resetForm(); },
    noun: copy.noun,
  });

  /* One reset, three callers (close, save, delete). It was four lines repeated at each — which is
     the shape where a fifth form field gets added to two of them and quietly persists into the next
     record opened at the third. */
  function resetForm() {
    setEditing(null);
    setEditingMoneyIn(null);
    setForm(BLANK_RECORD);
    // The guard's reference point resets with the form it describes — an opener that pre-fills
    // overwrites it a line later; anything that does not is genuinely comparing against blank.
    setFormOpenedWith(BLANK_RECORD);
    setFormTags([]);
    setFormPayee(null);
    setConfirmDelete(false);
    /* Both new pieces of form state clear with everything else, for the reason this function
       exists: a settle left half-finished must not turn the NEXT record a coach opens into a
       payment against the commitment they walked away from. */
    setSettling(null);
    setFormSplit(false);
    setFutureDateRefused(false);
    /* ⚠ THE RULE THIS FUNCTION IS FOR, restated because its most recent example has just been
       deleted: state added for one row must clear here, or it persists into the NEXT record. The
       inline "when was this paid?" prompt was left out when it was added, and a coach who opened it
       on one row, added a different cost and saved found it reopened on the first row afterwards,
       holding a date they had typed before doing something else entirely (/review, 2026-08-16).
       The prompt went with the register (P3); the trap is still here for whatever is added next. */
  }

  /** Open the form to ADD, opening on whatever the current sub-tab is about (Q8). */
  function openAdd(opening: { kind: EntryKind; timing: CostTiming } = kindForTab(tab)) {
    resetForm();
    setFormKind(opening.kind);
    setFormTiming(opening.timing);
    /* An arrival is dated the day it landed, and a payment the day it left — almost always today,
       either way. Pre-filled through the ORG's clock, never the runtime's, or a coach entering
       after 8 PM Eastern gets tomorrow.
       ⚠ ONLY THE DATE THIS FORM WILL ACTUALLY SHOW. Seeding both put a paid date on the commitment
       door, which does not render one — invisible state that still counted as a change. */
    const seeded = {
      ...BLANK_RECORD,
      ...(opening.kind !== 'expense' ? { receivedDate: tournamentToday() } : {}),
      ...(opening.kind === 'expense' && opening.timing === 'paid' ? { paidDate: tournamentToday() } : {}),
    };
    setForm(seeded);
    setFormOpenedWith(seeded);
    setSaveError('');
    setFormOpen(true);
  }

  /**
   * Everything that is true of opening a SAVED record, whichever door was used.
   *
   * ⚠ ONE PLACE, TWO CALLERS (/simplify, 2026-08-16). Edit and settle repeated five identical
   * setup lines with the settle's own two dropped in the middle — which is the shape `resetForm`
   * already carries a warning about one screen up: the next field added to "open a record" gets
   * remembered in one of them and quietly persists stale state in the other. The caller supplies
   * only what actually differs: the form values, and (on a settle) what is being settled.
   */
  function openSavedRecord(e: RepTeamExpense, values: typeof BLANK_RECORD) {
    resetForm();
    setEditing(e);
    /* ⚠ THE VALUES COME IN so the form and the guard's baseline are set from ONE object. Letting
       the caller `setForm` afterwards is how a settle's pre-filled amount ended up counting as an
       unsaved change: two writes, one of them forgotten. */
    setForm(values);
    setFormOpenedWith(values);
    // Open the split for a commitment that has one, so nothing already recorded is hidden from
    // the coach who came here to change it — the rule every disclosure on this form follows.
    setFormSplit(hasDepositBalanceSplit(e));
    setFormTags(tagsByExpenseId[e.id] ?? []);
    setFormPayee(e.payeePayer ? { payeeId: e.payeeId, payeePayer: e.payeePayer, displayName: e.payeePayer } : null);
    setSaveError('');
    setFormOpen(true);
  }

  /** Open the form to EDIT a saved record. Type is stated, never switchable (owner ruling) — which
   *  is why `formKind` is not set here: `entryKind` derives it from the record itself. */
  function openEdit(e: RepTeamExpense) {
    openSavedRecord(e, formFromExpense(e));
  }

  /**
   * Mark paid, THROUGH THE MONEY DOOR (plan §3, ruled 2026-08-16).
   *
   * Opens *Add money* already filled in from the commitment — what it is for, how much, what it is
   * called — and asks the one thing the record cannot know: when the money actually left. Saving
   * settles the commitment; it does not add a row beside it.
   *
   * ⚠ THE HALF DECIDES THE AMOUNT. A $600 entry paid as a $200 deposit and a $400 balance settles
   * in two goes, and the form must open showing the $200 — pre-filling the record's total would
   * invite a coach to confirm a figure four hundred dollars larger than the payment they made.
   */
  function openSettle(e: RepTeamExpense, half: 'deposit' | 'balance' | null) {
    const halfAmount = half === 'deposit' ? e.depositAmount
      : half === 'balance' ? e.balanceAmount
      : null;
    openSavedRecord(e, {
      ...formFromExpense(e),
      // Falls back to the record's own total, matching what the server posts when a half carries
      // no amount of its own — the figure on screen is then the figure that reaches the books.
      amount: String(halfAmount ?? e.amount),
      paidDate: tournamentToday(),
    });
    setSettling({
      expenseId: e.id,
      action: half === 'deposit' ? 'markDepositPaid' : half === 'balance' ? 'markBalancePaid' : 'markExpensePaid',
      describes: half ? `${e.description} ${half}` : e.description,
      half,
    });
  }

  /** The same door for an arrival. Its kind is stated too — income and money back are not two
   *  labels on one event, so switching between them is a delete and a re-add. */
  function openEditMoneyIn(m: RepTeamMoneyIn) {
    resetForm();
    setEditingMoneyIn(m);
    const values = formFromMoneyIn(m);
    setForm(values);
    setFormOpenedWith(values);
    setSaveError('');
    setFormOpen(true);
  }

  // Chunk F — which SEASON is on screen. `page.capabilities` are that season's (rule 1)
  // and `page.canWrite()` folds in read-only, so write flags go through it.
  const seasonSearchParams = useSearchParams();
  const page = useCoachSeasonPage(orgSlug, teamId);
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const canWriteMoney = page.canWrite(page.capabilities?.money === 'write');
  // The team's OWN money tags (org-shared ones are managed by the org admin, not here).
  const ownMoneyTags = expenseTags.filter(t => t.teamId !== null);
  /** The category+item pairs this team budgeted for — rebuilt only when the plan reloads, not on
   *  every keystroke in the open form (the form's state lives in this same component). */
  const plannedPairs = useMemo(() => ({
    out: new Set(budgetLines.filter(l => l.direction === 'out').map(l => taxonomyKey(l.categoryId, l.itemId))),
    in:  new Set(budgetLines.filter(l => l.direction === 'in').map(l => taxonomyKey(l.categoryId, l.itemId))),
  }), [budgetLines]);
  const tagById = new Map(expenseTags.map(t => [t.id, t]));

  /** One request per URL per revision, across both money faces — see the provider. */
  const sharedRead = useSharedMoneyRead();

  /**
   * ⚠⚠ MONOTONIC REQUEST SEQUENCES — THE LAST RESPONSE TO ARRIVE MUST NOT WIN (/review, 2026-08-17).
   *
   * Every write on this screen reloads TWICE: once explicitly, and once more because bumping the
   * money revision re-fires the load effect. That has always been true here (the pre-P3 code did
   * `await load(); bumpMoneyRevision();` — same two loads, opposite order), and it was survivable
   * while a load only refreshed a sub-list. The register made it the WHOLE SCREEN, so the symptom
   * changed: a coach marking two commitments paid a few seconds apart can have the first write's
   * slower response land after the second's, and **the payment they just made reverts to Scheduled
   * in front of them** until something else refreshes it.
   *
   * The fix is the one this portal already uses one file over (`MoneyNextThirtyDays`): stamp each
   * call, and let a response that is no longer the newest drop on the floor. It costs nothing and
   * it makes "which answer wins" a fact rather than a race.
   *
   * ⚠ A ref, not state — bumping a counter must never itself cause a render.
   */
  const loadSeq = useRef(0);
  const scheduleSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError('');
    try {
      /* ⚠⚠ THE THREE SHARED READS GO THROUGH `sharedRead`, WHICH IS THE OTHER HALF OF P1'S
         `/simplify` FINDING (money plan §10 P1, deferred to here). Transactions and Payables are two
         mounted instances of this component, so `/expenses`, `/budget-items` and `/budget-plan` ran
         TWICE for a coach who opened both — and thereafter every save re-ran all six, for the rest
         of the session. The provider now collapses them to one request per URL per revision, and a
         bump is what clears it, so the cache can never be staler than the screen already was.

         ⚠ THE OTHER TWO STAY ON A PLAIN FETCH, deliberately. The arrivals and the register are read
         by the Transactions face ALONE — Payables renders neither, and its form is always a
         commitment so the derived-row warning cannot fire either — so there is no second caller to
         share with, and putting them in a shared cache would only make them harder to re-read on
         their own. The register is also the heaviest read on the screen: it touches every money
         table the season has. */
      const [res, catRes, planRes, inRes, bookRes] = await Promise.all([
        sharedRead(`/api/coaches/${orgSlug}/teams/${teamId}/expenses`),
        sharedRead(`/api/coaches/${orgSlug}/budget-items?teamId=${teamId}`),
        sharedRead(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan`),
        face === 'transactions'
          ? fetch(`/api/coaches/${orgSlug}/teams/${teamId}/money-in`)
          : null,
        face === 'transactions'
          ? fetch(`/api/coaches/${orgSlug}/teams/${teamId}/register`)
          : null,
      ]);
      /* ⚠ EVERY BODY IS READ BEFORE ANYTHING IS WRITTEN, so the staleness check below has exactly
         one place to sit. Reading a body is another await, and a guard with awaits after it guards
         only the statements it happens to precede. */
      const inData = inRes?.ok ? await inRes.json() : null;
      const bookData = bookRes ? await bookRes.json().catch(() => ({})) : null;

      /* ⚠⚠ FROM HERE DOWN IS THE WRITING, AND ONLY THE NEWEST LOAD MAY DO IT. A slower earlier
         response landing last is how a payment a coach just made reverts to Scheduled in front of
         them. Bailing here also skips the `finally`'s spinner reset — correct, because the newer
         load owns the spinner now. */
      if (seq !== loadSeq.current) return;

      if (!res.ok) throw new Error((res.data.error as string) ?? 'Failed to load');
      const data = res.data as {
        expenses?: RepTeamExpense[]; expenseTags?: RepTeamTag[];
        tagsByExpenseId?: Record<string, string[]>;
      };
      setExpenses(data.expenses ?? []);
      setExpenseTags(data.expenseTags ?? []);
      setTagsByExpenseId(data.tagsByExpenseId ?? {});
      /* Best-effort, like the taxonomy beside it: a money-in read that fails must not blank the
         expenses list a coach came here for. The tab shows its own empty state instead. */
      if (inData) {
        setMoneyIn(inData.moneyIn ?? []);
        setDerivedKeys(new Set<string>(inData.derivedKeys ?? []));
      }
      /* ⚠ NOT BEST-EFFORT. The other reads here decorate a list; this one IS the list. A silent
         failure would render an empty book on a team with a season of money in it — the worst
         possible answer on a screen a coach opens to reconcile their books. */
      if (bookRes) {
        if (!bookRes.ok) throw new Error(bookData?.error ?? 'Failed to load the register');
        setBook(bookData);
      }
      if (catRes.ok) {
        setCategories((catRes.data.categories as BudgetCategoryWithItems[]) ?? []);
      }
      if (planRes.ok) {
        const planData = planRes.data;
        const plan = planData.plan as RepBudgetPlan | undefined;
        /* ⚠ BOTH DIRECTIONS NOW (mig 243). This used to drop money-in lines, which was correct
           while they carried no category or item; they carry both from this release, and an income
           entry needs the same "is this in your plan?" honesty a cost gets. The direction comes
           from `isFundingKind`, never a literal — the whole-tree guard, and the reason a fourth
           kind will reach this line for free. */
        setBudgetLines((plan?.lines ?? []).map(l => ({
          categoryId: l.categoryId,
          itemId: l.itemId,
          direction: isFundingKind(l.lineKind) ? 'in' as const : 'out' as const,
        })));
        if (typeof planData.seasonYear === 'number') setSeasonYear(planData.seasonYear);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load expenses.');
    } finally {
      setLoading(false);
    }
    // `face` decides whether the arrivals fetch runs at all, so it belongs here — a panel is one
    // face for its whole life, so this never actually re-fires; leaving it out would just be a lie
    // to the next reader (and to the linter). `sharedRead` is stable from the provider.
  }, [orgSlug, teamId, face, sharedRead]);

  // Re-read (never remount) when the hub's Import menu commits payables while this panel is
  // mounted but off-screen — an in-progress expense form on another tab must survive it.
  const moneyRevision = useMoneyRevision();
  /**
   * ⚠ THIS SCREEN'S WRITES MAKE THE REST OF MONEY STALE, and it was not saying so (/review,
   * concurrency lens). The hub keeps every visited tab MOUNTED behind `display:none`, and Budget
   * vs. Actual and the Budget Plan only re-read when this revision changes — so a coach who read
   * the report, came here, recorded a $500 income entry and switched back saw the old Season net
   * until a hard reload. The Fundraisers panel has bumped this since sponsors shipped, for exactly
   * the same reason; the money form simply never joined it.
   *
   * ⚠ It covers COSTS as well as arrivals, which closes the same pre-existing gap: an expense
   * marked paid changes the report just as much as an arrival does.
   */
  const bumpMoneyRevision = useBumpMoneyRevision();
  useEffect(() => { load(); }, [load, moneyRevision]);


  // The roster behind "Paid by" — fetched the first time the Add Expense form opens, not on
  // every mount (the same lazy rule this panel already applies to the schedule tab, and the
  // payee picker to its own search). Best-effort: a failure just means the picker offers only
  // "The team", never a broken form.
  /* ⚠⚠ GATED ON `entryKind`, NEVER THE RAW `formKind` (/review, 2026-08-16 — High). `formKind` is
     written only by `openAdd` and the refund tick, and `resetForm` deliberately leaves it alone —
     so it goes STALE the moment a coach opens Add Income, cancels, and then edits a cost. The
     effective kind of a saved record is `entryKind`, derived from the record itself.
     The stale gate meant the roster never loaded for the rest of that session, and this release is
     what made it visible: the consequence line names the family from `roster`, so an out-of-pocket
     cost read "the team owes that family" in the one sentence built to say WHICH household. */
  useEffect(() => {
    if (!formOpen || entryKind !== 'expense' || roster.length > 0) return;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const players = Array.isArray(d?.players) ? d.players : [];
        setRoster(players.filter((p: { status?: string }) => !p.status || p.status === 'active'));
      })
      .catch(() => {});
  }, [formOpen, entryKind, roster.length, orgSlug, teamId]);

  // The schedule is its own fetch (no window, paid rows included) and only runs when the coach
  // opens that tab — the other two tabs shouldn't pay for a list they aren't showing.
  const loadSchedule = useCallback(async () => {
    // Its own sequence, for the reason spelled out over `loadSeq` — this list is reloaded twice per
    // write as well, and it is the one screen whose entire job is to be current.
    const seq = ++scheduleSeq.current;
    setScheduleLoading(true);
    setScheduleError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/upcoming-payables?days=0&includePaid=1`);
      const data = await res.json().catch(() => ({}));
      if (seq !== scheduleSeq.current) return;
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      const lanes = (data.lanes ?? []) as Array<{ id: string; items: Omit<ScheduleRow, 'source'>[] }>;
      const rows: ScheduleRow[] = [
        ...(lanes.find(l => l.id === 'team_payables')?.items ?? []).map(i => ({ ...i, source: 'team' as const })),
        ...(lanes.find(l => l.id === 'org_payables')?.items ?? []).map(i => ({ ...i, source: 'org' as const })),
      ].sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
      setSchedule(rows);
    } catch (e: any) {
      setScheduleError(e.message ?? 'Failed to load the payment schedule.');
    } finally {
      if (seq === scheduleSeq.current) setScheduleLoading(false);
    }
  }, [orgSlug, teamId]);

  /* ⚠⚠ THE SCHEDULE HAS TO WATCH THE REVISION TOO (/review, 2026-08-16). This fired only on a
     CHANGE of sub-view, so the one screen a coach reads to answer "what is coming due" could sit
     there stale: Payables now OPENS on the schedule, and the hub's Import ▾ — reachable from any
     tab — brings in a whole season of commitments and bumps the revision. The list beside it
     refreshed; this table did not, until the coach happened to switch sub-views and back. Silent
     stale money on the screen whose entire job is to be current. */
  useEffect(() => { if (tab === 'schedule') loadSchedule(); }, [tab, loadSchedule, moneyRevision]);

  /**
   * WHAT EVERY WRITE ON THIS SCREEN DOES AFTERWARDS. One function, three callers.
   *
   * ⚠⚠ THE ORDER IS THE WHOLE REASON IT EXISTS (money redesign P3). The three shared reads are
   * cached per revision now, so a `load()` run BEFORE the invalidation replays the answers the save
   * has just made wrong — the screen settles back to exactly what it looked like before the coach
   * pressed Save. The bump clears the cache, so it has to come first.
   *
   * ⚠ AND IT IS A WRAPPER RATHER THAN A COMMENT AT EACH CALL SITE, because this file has already
   * learned that lesson once: `goToTab` above says in as many words that the point of failure is
   * "the call site added next." Three copies of a warning is not a guard — the fourth write path
   * would simply not read them.
   */
  const refreshAfterWrite = useCallback(async () => {
    bumpMoneyRevision();
    await load();
    // The schedule is its own fetch and only the tab showing it needs to pay for the re-read.
    if (tab === 'schedule') await loadSchedule();
  }, [bumpMoneyRevision, load, loadSchedule, tab]);

  /**
   * THE BOOK, AS THE FILTER STRIP IS SHOWING IT — derived once per change of its actual inputs.
   *
   * ⚠ MEMOISED BECAUSE THE MONEY FORM LIVES IN THIS COMPONENT. The modal is an overlay: the register
   * beneath it is not unmounted, so every keystroke in a description or an amount re-renders the
   * whole panel. Unmemoised, that re-filtered and re-sorted the entire season's book — five sources
   * merged into one unpaginated table — on every character typed into a form that has nothing to do
   * with it. The old screen paid less for this because each of its two lists was half the size.
   *
   * ⚠ THE FILTER PREDICATE LIVES INSIDE, not beside. Hoisting it out would make it a new function
   * identity on every render and silently defeat the memo it is an input to.
   */
  const {
    showBalance, bookSettled, bookScheduled, bookEmpty, registerItemNames,
  } = useMemo(() => {
    /* ⚠⚠ WHEN A FILTER HIDES ROWS, THE BALANCE COLUMN HIDES WITH IT (plan §4.3). A running balance
       over a subset is a number that looks like cash and isn't — a coach reading "Expenses only"
       would see a column of figures descending from zero and have every reason to read it as the
       team's position. The column is REMOVED rather than blanked, so there is no empty space
       inviting the question. `balanceIsMeaningful` is the one rule, shared with the export. */
    const balanceShown = balanceIsMeaningful(registerFilter, registerItemId, filterTagId);
    const matches = (r: RegisterBookRow) => {
      if (!matchesFilter(r, registerFilter)) return false;
      if (registerItemId && r.itemName !== registerItemId) return false;
      /* Money tags live on expenses, so a tag filter narrows the book to the rows that can carry one
         — every other row simply has no such label, which is a match of zero, not a match of all. */
      if (filterTagId) {
        if (r.open?.kind !== 'expense') return false;
        if (!(tagsByExpenseId[r.open.id] ?? []).includes(filterTagId)) return false;
      }
      return true;
    };
    const settled = (book?.settled ?? []).filter(matches);
    /* The overlay is a coach's switch, so an OFF strip drops the whole block rather than dimming it —
       "include what's scheduled" has to mean the book is only what happened. */
    const scheduled = showScheduled ? (book?.scheduled ?? []).filter(matches) : [];
    return {
      showBalance: balanceShown,
      bookSettled: settled,
      bookScheduled: scheduled,
      bookEmpty: settled.length === 0 && scheduled.length === 0,
      /* The words actually ON the book, not the whole library: a filter offering a category the
         season never spent against is a control that can only ever empty the screen. */
      registerItemNames: [...new Set(
        [...(book?.settled ?? []), ...(book?.scheduled ?? [])]
          .map(r => r.itemName).filter((n): n is string => !!n),
      )].sort((a, b) => a.localeCompare(b)),
    };
  }, [book, registerFilter, registerItemId, filterTagId, showScheduled, tagsByExpenseId]);

  /** The two id lookups a register row needs to find its record. Same reasoning as the memo above:
   *  rebuilding two Maps over every expense and arrival on each keystroke is work the form's text
   *  inputs were making this screen do for nothing. */
  const expenseById = useMemo(() => new Map(expenses.map(e => [e.id, e])), [expenses]);
  const moneyInById = useMemo(() => new Map(moneyIn.map(m => [m.id, m])), [moneyIn]);

  // ?tab=schedule — where a Scheduled cell in the month grid (or the Money hub's
  // "See full schedule" link) lands. Reactive on the search param, not mount-only: under
  // the Money hub this panel can stay mounted across visits, so revisiting with the
  // param freshly set (e.g. clicking "See full schedule" a second time) needs to jump
  // the sub-tab again, not silently do nothing because it already fired once before.
  /* ⚠⚠ EACH FACE ANSWERS ONLY TO ITS OWN VIEW NAMES (Money split P1, 2026-08-16). Transactions and
     Payables are two mounted panels reading the SAME `?tab=` key, so an unfiltered reader would
     have Transactions try to jump to `schedule` — a view it has no button for — leaving it on a
     sub-view the coach cannot see or leave. Gating on the face's own list makes a param meant for
     the other tab a no-op here, which is exactly what it should be. */
  const wantedTab = seasonSearchParams.get('tab');
  useEffect(() => {
    if (wantedTab && (FACE_TABS[face] as string[]).includes(wantedTab)) goToTab(wantedTab as ExpenseTab);
  }, [wantedTab, face]);

  /* ?filter= and ?scheduled= — where the Overview's next-30-days window lands (plan §4.5).
     ⚠ SAME REACTIVITY RULE AS `?tab=` ABOVE, for the same reason: this panel stays mounted across
     visits under the hub, so clicking a second window row must re-narrow the book rather than
     silently do nothing because the effect already fired once.
     ⚠ The face gate matters here too — Payables reads the same query keys and has no register. */
  const wantedFilter = seasonSearchParams.get('filter');
  const wantedScheduled = seasonSearchParams.get('scheduled');
  useEffect(() => {
    if (face !== 'transactions') return;
    if (wantedFilter && REGISTER_FILTERS.some(f => f.id === wantedFilter)) {
      setRegisterFilter(wantedFilter as RegisterFilter);
    }
    if (wantedScheduled === '1') setShowScheduled(true);
  }, [wantedFilter, wantedScheduled, face]);

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
  /**
   * Save an arrival — income, or money back on something (mig 243).
   *
   * ⚠ ITS OWN PATH, ITS OWN ENDPOINT, ITS OWN TABLE. A refund is not a negative expense, so nothing
   * here goes near the expenses route: every existing sum over that table keeps its sign because
   * these rows never enter it. Kept beside `saveRecord` rather than folded into it because the two
   * share only the picker — different fields, different validation, different consequences.
   */
  async function saveMoneyIn() {
    const amount = parseFloat(form.amount);
    if (categories.length > 0 && !form.budgetItemId) {
      throw new Error(entryKind === 'refund'
        ? 'Pick what this is paying you back for — it is what lets the refund reduce the right row.'
        : 'Pick a category and item — they line this up with your budget.');
    }
    if (isNaN(amount) || amount <= 0) throw new Error('Enter a valid amount');
    if (!form.receivedDate) throw new Error('Enter the date the money arrived');

    const payload = {
      amount,
      receivedDate: form.receivedDate,
      budgetItemId: form.budgetItemId || null,
      description: form.description.trim() || null,
      notes: form.notes.trim() || null,
      // Only a refund has a "who paid it back"; an income record has nothing it could mean.
      receivedFrom: entryKind === 'refund' ? (form.receivedFrom || null) : null,
    };

    const res = editingMoneyIn
      ? await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/money-in/${editingMoneyIn.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/money-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // ⚠ The KIND is set at creation and never sent on an edit — income and money back are
          // different events, not two labels on one.
          body: JSON.stringify({ ...payload, kind: entryKind === 'income' ? 'income' : 'money_back' }),
        });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
  }

  async function saveRecord() {
    setSaveError('');
    setFutureDateRefused(false);
    setSaving(true);
    try {
      if (isMoneyInForm) {
        await saveMoneyIn();
        setFormOpen(false);
        resetForm();
        await refreshAfterWrite();
        return;
      }
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
      /* ⚠⚠ A COMMITMENT NEEDS A DUE DATE, and this is the promise the form used to break. The old
         split group said "leave this closed to record one amount due on one date" while offering
         no such date — so a commitment saved that way reached the schedule, the Overview's next-30
         panel and every reminder as nothing at all. An unscheduled commitment is a note to self,
         not a payable. */
      if (isPayable && !formSplit && !form.dueDate) {
        throw new Error(editing
          // A record that never had a date is the very state this field exists to end — say that,
          // rather than repeating the generic prompt at someone who did not create the gap.
          ? 'This commitment has never had a due date, so it has never reached your payment schedule. Add one to save it.'
          : 'When is this due? A commitment without a date never reaches your payment schedule.');
      }
      if (isPayable && formSplit && !form.depositDueDate && !form.balanceDueDate) {
        throw new Error('Give the deposit or the balance a due date — that is what puts them on your payment schedule.');
      }
      /* ⚠⚠ A SETTLED SPLIT CANNOT GO BACK TO ONE AMOUNT (/review, 2026-08-16, Critical — found in
         this release, not inherited).
         Closing the split rewrites the deposit to the TOTAL (see `commitmentSchedule`), which is
         right on a commitment where nothing has moved and catastrophic on one where the deposit has
         posted: a $600 entry with a PAID $200 deposit and a $400 balance would have restated that
         deposit as $600 and `syncExpenseBooksForEdit` would have moved the books by $400 — silently,
         under a banner still promising "nothing moves". The mirror case was already safe only by
         luck: clearing a PAID balance is refused server-side because it arrives as null, while
         CHANGING a paid deposit's figure is an ordinary edit the server has no reason to question.
         So the guard belongs here, on the shape change, not on the figure.
         ⚠ It fires ONLY on collapsing a record that IS split. An un-split commitment whose one
         payment has posted stays fully editable — that is the standing no-read-only ruling, and
         restating its amount is a correction the books are meant to follow. */
      if (isPayable && editing && hasDepositBalanceSplit(editing) && !formSplit
        && (editing.depositPaidAt || editing.balancePaidAt)) {
        throw new Error(
          'Part of this has already been paid, so it can’t go back to one amount on one date. '
          + 'Reopen the split to change the amounts, or delete this and enter it again.',
        );
      }
      /* ⚠ THE ASTERISK ON "What is this?" HAS TO MEAN SOMETHING. It was drawn as required and the
         comment above the field asserted it was, but nothing checked — so a coach could save a cost
         with no category and no item at all, and it landed in the "Not itemized" bucket this whole
         change exists to empty, silently. A label that promises and does not enforce is worse than
         no label: it teaches coaches the field is optional. The server refuses too. */
      if (categories.length > 0 && !form.budgetItemId) {
        throw new Error('Pick a category and item — they line this cost up with your budget.');
      }
      if (isNaN(amount) || amount <= 0) {
        throw new Error(isPayable ? 'Enter a valid total amount' : 'Enter a valid amount');
      }

      /* ⚠⚠ A DATE IN THE FUTURE IS NOT A PAYMENT (plan §3, ruled 2026-08-16). *Add money* records
         what HAPPENED — the whole reason the split exists — so a coach reaching for it to say
         "we've agreed to pay this in March" is on the wrong screen, and the honest answer names
         the right one rather than saving a payment that has not occurred.
         ⚠ The picker's `max` already blocks the calendar, so this catches the TYPED date, which is
         how the field is filled on a desktop. The server refuses it too; this is the courtesy, and
         the only place that can offer the door as a link. */
      if (!isPayable && form.paidDate && form.paidDate > tournamentToday()) {
        setFutureDateRefused(true);
        throw new Error(settling
          ? 'That date is in the future — a payment can only be recorded once the money has left.'
          : 'That hasn’t happened yet.');
      }
      if (settling && !form.paidDate) {
        throw new Error('When did the money leave? That date is what puts this in the right month.');
      }

      const common = {
        description:   form.description.trim(),
        category:      form.category.trim() || null,
        /* mig 240 — what the cost IS. The server derives the text category from the item, so the
           two keys the report reads can never disagree about one row.
           ⚠ SENT ON EVERY SAVE, INCLUDING AN EDIT OF A PAID RECORD. Re-filing a cost against the
           right item moves no money and posts nothing — which is why it was editable even under the
           old figure lock, and is unremarkable now that the figures are too. */
        budgetItemId: form.budgetItemId || null,
        notes:         form.notes.trim() || null,
        paymentMethod: form.paymentMethod.trim() || null,
        payeeId:       formPayee?.payeeId ?? null,
        payeePayer:    formPayee?.displayName ?? null,
        tagIds:        formTags,
      };
      const num = (v: string) => (v ? parseFloat(v) : null);

      /* ⚖ AN EDIT NOW SENDS EVERY FIGURE (owner ruling 2026-08-16). This used to omit anything that
         had posted, because the server refused it — echoing back an unchanged amount would have
         turned "I fixed a typo in the description" into a rejection. Nothing refuses now: the
         server moves the team's books to match whatever it is given, so there is no send-filter
         left to keep in step with a lock rule, which is one fewer copy of a rule that used to live
         in three places and failed silently in this one. */
      /**
       * A commitment's schedule, as the record actually stores it.
       *
       * ⚠⚠ ONE AMOUNT ON ONE DATE IS THE DEPOSIT HALF WITH NO BALANCE — not a special case this
       * form invented, but the convention the bulk importer has always written ("No explicit split
       * → the whole amount is due on the one date, stored as the deposit half"). A hand-typed
       * commitment and an imported one are therefore the same record, which is what lets the
       * payment schedule, the exports, Mark paid and every existing sum keep working with nothing
       * new in the data — the standing "not a new object" constraint, honoured in the one place it
       * could have been broken.
       */
      const commitmentSchedule = formSplit
        ? {
            depositAmount:  num(form.depositAmount),
            depositDueDate: form.depositDueDate || null,
            balanceAmount:  num(form.balanceAmount),
            balanceDueDate: form.balanceDueDate || null,
          }
        : {
            depositAmount:  amount,
            depositDueDate: form.dueDate || null,
            /* Cleared, so closing the split on a commitment that had one really does put it back
               to one amount on one date. The server refuses this when the balance has already been
               PAID, which is the right answer — that money left, and a form cannot un-spend it. */
            balanceAmount:  null,
            balanceDueDate: null,
          };

      const edits: Record<string, unknown> = { ...common };
      if (settling) {
        /* ⚠⚠ SETTLING PATCHES THE COMMITMENT — IT NEVER CREATES A ROW BESIDE IT (plan §8). The
           record transitions to paid and posts to the books exactly as the inline Mark paid does,
           because it IS that action: the coach's edits and the mark-paid ride in one request, a
           pairing the route explicitly handles (it posts the figure being STORED, not the one it
           arrived to find). A POST here would leave a transaction and a commitment each carrying
           the same $600 — the double count the whole split exists to prevent.

           ⚠ THE HALF DECIDES WHICH FIGURE MOVES. Sending `amount` while settling a deposit would
           rewrite the commitment's TOTAL with the deposit's figure — a $600 entry silently
           becoming $200 the moment its deposit was paid. Only the half being settled is sent, and
           the other half is left out entirely rather than echoed back. */
        edits.action = settling.action;
        edits.paidDate = form.paidDate;
        if (settling.half === 'deposit') edits.depositAmount = amount;
        else if (settling.half === 'balance') edits.balanceAmount = amount;
        else edits.amount = amount;
      } else {
        edits.amount = amount;
        if (isPayable) {
          Object.assign(edits, commitmentSchedule);
        } else if (editing?.expensePaidAt && form.paidDate) {
          /* Correcting WHEN it was paid — sent only on a record that HAS posted, because the server
             refuses a date on something that never moved money. */
          edits.expensePaidAt = form.paidDate;
        }
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
                ? commitmentSchedule
                : {
                    paidByPlayerId: form.paidByPlayerId || null,
                    /* ⚠ WHEN IT WAS PAID, and omitted entirely when the coach cleared the field —
                       that is how a cost gets recorded BEFORE it is settled, which is the state
                       every hand-entered cost used to land in whether the coach meant it or not.
                       ⚠ SENT ON AN OUT-OF-POCKET COST TOO, where it dates the family's credit
                       rather than a cash entry: a parent who paid the vendor a fortnight ago is
                       owed from then, and showing a date field that was quietly ignored would be
                       worse than not showing one. */
                    ...(form.paidDate ? { expensePaidAt: form.paidDate } : {}),
                  }),
            }),
          });

      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      setFormOpen(false);
      resetForm();
      await refreshAfterWrite();
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
    if (!editing && !editingMoneyIn) return;
    setDeleting(true);
    setSaveError('');
    try {
      const res = editingMoneyIn
        ? await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/money-in/${editingMoneyIn.id}`, {
            method: 'DELETE',
          })
        : await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expenses/${editing!.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not delete');
      setFormOpen(false);
      resetForm();
      await refreshAfterWrite();
    } catch (e: any) {
      setSaveError(e.message);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  /* ⚠ THE INLINE "WHEN WAS THIS PAID?" PROMPT IS GONE, AND SO IS `doAction` (money redesign P3).
     They served ONE caller: the plain unpaid expense on the old Transactions list, which P1 kept
     deliberately — it was not a commitment, only its date was missing, and a modal for one field
     would have been more ceremony than the decision deserved. P1 said in as many words that "the
     register absorbs this row in P3, and this control goes with it." It has. Every Mark paid on
     the register — a commitment half or a plain cost — now opens the money form pre-filled and
     asks when, which is the one door a transaction is ever born through (plan §3).

     ⚠ The lesson that outlived the control, kept because it will apply again: the server took a
     chosen date on all three actions from the start, but the picker was built inline on the
     lump-sum button alone — so the two halves silently stamped today, on the records where
     back-dating matters MOST. Sharing the control is what made "all three" checkable rather than
     remembered. */

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
   * ⚠⚠ IT MOVED UNDER `More` (owner ruling 2026-08-16), REVERSING Q1's "stays above the
   * disclosure". Q1's reasoning was sound and is the reason the ruling comes as a PAIR: this is the
   * one field that does not describe the record but changes what it MEANS, so it could not be
   * hidden while nothing else announced it. What changed is that something else now does — the
   * consequence line above the buttons names the family and the credit, on every state, and it is
   * not collapsible. **Do not fold this without that line; do not remove that line while this is
   * folded.**
   *
   * ⚠ AND THE FOLD NAMES IT. "Add details (optional)" hid a decision behind a word that promised
   * nothing was inside; the label lists what is, so a coach recording a cost a parent fronted can
   * see where the question lives without opening anything.
   *
   * ⚠ CREATION ONLY. Changing it later would move a debt to a different household without touching
   * the credit, so an edit shows it as a stated fact — and only when there is something to state.
   * A team-paid expense says nothing, because "Paid by: the team" is the absence of news.
   *
   * Extracted from the JSX because as an inline expression it was three nested ternaries deep, which
   * is the point at which a reader counts brackets instead of reading branches.
   */
  function renderPaidBy() {
    /* ⚠ NEVER ON A MONEY-IN FORM, and the reason is the trap this release is most likely to fall
       into. "Paid by · a family, out of pocket" means the team OWES that family a credit; money
       back means the team owes nobody. Offering it here would put the two confusable halves on one
       screen with one meaning between them. */
    if (isPayableForm || isMoneyInForm) return null;

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
        {/* ⚠ THE MONEY SENTENCE MOVED TO THE CONSEQUENCE LINE, and is not repeated here. It said
            the same thing twice, once inside a fold that can be shut — and the whole reason the
            fold is safe is that the surviving copy cannot be. See `consequenceLine`. */}
      </div>
    );
  }

  /**
   * WHAT SAVING WILL DO — one line, above the buttons, on EVERY state (owner ruling 2026-08-16).
   *
   * ⚠⚠ THIS IS THE SENTENCE THAT REPLACED THE READ-ONLY LOCK, so it carries the weight the lock
   * used to. Until 2026-08-15 a posted figure simply refused to be edited; the ruling that nothing
   * on a saved record is read-only removed the refusal, and what a coach needs in its place is to
   * be told, before they press the button, that this edit reaches the team's books. Two branches of
   * it already existed — the commitment's "nothing moves" and the settle's "when you save …" — and
   * everything else said nothing at all, which is why an out-of-pocket cost could be recorded with
   * the family's credit mentioned only inside an optional fold.
   *
   * ⚠ IT NAMES THE FAMILY. "The team owes this family" was true and useless: a coach recording
   * three costs in a row needs to know WHICH household is owed, and the roster is already loaded
   * for the picker two fields up.
   *
   * ⚠ ONE FUNCTION, NOT SIX SCATTERED PARAGRAPHS. The old copies sat under the Amount field, inside
   * `renderPaidBy`, beside the split and under the settle — four places to keep in step, which is
   * exactly the shape that let "nothing moves" survive on a commitment whose deposit had posted
   * (found by /review in P1). A fifth state now has one place to be added.
   */
  function consequenceLine() {
    const amount = Number(form.amount) || 0;
    const money = fmt(amount);
    const line = (body: ReactNode) => (
      <p className={`${styles.formHint} ${styles.formHintConsequence} ${styles.formGridFull}`}>{body}</p>
    );

    // ── A settle: the same record turning paid, never a second one beside it ──
    if (settling) {
      return line(<>
        <strong>When you save:</strong> {money} leaves the team’s books on the date above, and{' '}
        {settling.half
          ? <>this {settling.half} is settled on your payment schedule. The other half stays as it is.</>
          : <>this commitment is settled.</>}
        {' '}Nothing new is added beside it.
      </>);
    }

    // ── A commitment: the one form in the portal that moves no money ──
    if (isPayableForm) {
      /* ⚠⚠ "NOTHING MOVES" IS ONLY TRUE WHILE NOTHING HAS MOVED (/review, 2026-08-16). The line was
         rendered for every commitment, including one whose deposit had already posted — where
         changing a figure DOES move the books. A consequence line that contradicts the screen it
         sits on is worse than none: it is the sentence a coach trusts instead of checking. */
      if (editing?.depositPaidAt || editing?.balancePaidAt) {
        return line(<>
          <strong>Part of this has been paid.</strong> The rest of the schedule is still just a plan —
          but changing a figure that has already been paid updates the team’s books too, and cash on
          hand follows the new number.
        </>);
      }
      const due = formSplit ? (form.depositDueDate || form.balanceDueDate) : form.dueDate;
      return line(<>
        <strong>When you save: nothing moves.</strong> Cash on hand is unchanged and no family is
        affected. This joins your payment schedule{due ? <>, due {fmtDate(due)}</> : null}
        {' '}— mark it paid when the money actually leaves.
      </>);
    }

    // ── An arrival: income, or money back on something ──
    if (isMoneyInForm) {
      const when = form.receivedDate ? <> on {fmtDate(form.receivedDate)}</> : null;
      /* ⚠⚠ A REFUND IS NOT INCOME, and this is the last screen that can say so before it is saved.
         It REDUCES the row it repays rather than adding one — the netting rule the whole money-back
         design rests on — and it leaves nobody owed anything, which is the half a coach confuses
         with "a family paid the vendor directly". */
      if (entryKind === 'refund') {
        const item = chosenItemName(form);
        return line(<>
          <strong>When you save:</strong> {money} comes back in{when}, and{' '}
          {item ? <><strong>{item}</strong> drops by {money}</> : <>the item you chose drops by {money}</>}
          {' '}on Budget vs. Actual — it isn’t counted as income, and <strong>nobody is owed anything</strong>.
        </>);
      }
      return line(<>
        <strong>When you save:</strong> {money} comes in{when}. Cash on hand goes <strong>up</strong>{' '}
        by {money}.
      </>);
    }

    // ── A cost. Four states, and the out-of-pocket one is why this exists ──
    if (form.paidByPlayerId) {
      const player = roster.find(p => p.id === form.paidByPlayerId);
      const named = player
        ? [player.playerFirstName, player.playerLastName].filter(Boolean).join(' ')
        : '';
      /* ⚠ THE FALLBACK IS A WHOLE PHRASE, NOT A NAME (/review, 2026-08-16). It used to substitute
         the string "that family" into "<name>'s family", which read "that family's family" the
         moment the roster had not loaded — the exact state the stale roster gate above used to
         produce. A missing name now costs the possessive, not the grammar. */
      return line(<>
        <strong>When you save: no team cash moves.</strong> {money} counts in the budget as usual,
        and the team owes{' '}
        {named ? <><strong>{named}</strong>’s family</> : <>that family</>} {money} — saved as a
        credit you can put against their dues or pay out any time.
      </>);
    }
    if (form.paidDate) {
      /* An edit of something that HAS posted is the case the lock used to cover — say that the
         books follow, because that is the change the coach cannot see from this screen. */
      return line(editing?.expensePaidAt
        ? <><strong>When you save:</strong> this stays paid, dated {fmtDate(form.paidDate)}. Changing
          the figure or the date updates the team’s books too — cash on hand and the month it lands
          in both follow what you enter here.</>
        : <><strong>When you save:</strong> {money} leaves the team’s books on{' '}
          {fmtDate(form.paidDate)}. Cash on hand goes <strong>down</strong> by {money}.</>);
    }
    return line(<>
      <strong>When you save: nothing moves yet.</strong> This waits as an unpaid cost until you mark
      it paid, and cash on hand is unchanged until then.
    </>);
  }

  /** The warning line both halves of the field use — one shape, so a category warning and a
   *  budget warning can't drift into two different-looking sentences one above the other. */
  function fieldWarning(text: string) {
    return (
      <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: 'var(--warning)', display: 'flex', alignItems: 'flex-start', gap: '0.3rem' }}>
        <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
        <span>{text}</span>
      </p>
    );
  }

  /**
   * WHAT IS THIS COST? — category, then item (owner ruling 2026-08-15).
   *
   * ⚠ THIS REPLACED "WHAT IS THIS AGAINST?", A CONTROL EXACTLY ONE DAY OLD, and the reasoning is
   * worth keeping because it is a rule about the whole report rather than about this field. That
   * control asked the coach to point at a BUDGET LINE, because two lines sharing an item were
   * ambiguous and their actuals could not be split. The ruling that such lines simply SUM into one
   * row dissolved the ambiguity — so the category+item pair became a complete answer on its own,
   * and a line pointer beside it was a second classification that could only agree or drift.
   *
   * ⚠ AND "NOT IN THE BUDGET" WENT WITH IT. Whether something was planned is no longer a thing a
   * coach declares: a budget line exists for this category and item, or it does not, and the report
   * works that out. The coach says what the cost IS. Nothing is hidden by this — spending on
   * something unplanned now gets its own flagged row on Budget vs. Actual, which is more visible
   * than the "Unbudgeted" list it used to fall into, not less.
   *
   * ⚠ THE ITEM IS REQUIRED, and that is what makes both reports line up. A cost recording only a
   * category can be placed under a heading and no further, which is the entire defect this change
   * closes. A team that has never built a plan still picks from the standard library, so its
   * spending is classified from day one and its first budget lines meet it already sorted.
   *
   * ⚠ ONE FIELD, THREE ANSWERS (mig 243). The same control serves a cost, an income entry and money
   * back, because they are the same question asked of the same taxonomy — "what is this?" — and
   * splitting it into three would have been three pickers, three sport rails and three ownership
   * models to keep in step. Only the LABEL changes, and only on the refund branch, where the honest
   * wording is what it is paying you back FOR.
   *
   * ⚠⚠ THE DIRECTION NOW **FILTERS** — this reverses plan §3.6, on the record (owner ruling
   * 2026-08-16): *"the items coaches add need to be tied to income or expense, they cannot be
   * unlinked or untagged to those. So a coach clicking income should not see expense items or vice
   * versa."* §3.6 had it sort and never filter, because a refund legitimately points at either side
   * and because club- and coach-created words carried no direction at all — filtering then would
   * have hidden every word an organization ever invented. Both objections are answered rather than
   * ignored: migration 246 made the column mandatory and backfilled the untagged ones, and the
   * refund tick box keeps a refund on the EXPENSE list, which is where the word it repays lives.
   *
   * ⚠ NO LONGER A HAND-BUILT FIELD. It is `BudgetItemPicker` — the same control the Budget Plan and
   * the Org Budget have used for months, taught to search and to follow a direction. What stays
   * here is everything that is about THIS form rather than about picking: the description pre-fill
   * and the three warnings, which read the plan and the derived-row set this panel already holds.
   */
  function budgetItemField() {
    const category = categories.find(c => c.id === form.budgetCategoryId) ?? null;
    // Through the shared lookup, so the three readers of "which item is chosen?" stay one rule.
    // Through the shared resolver, so a word created inside this form is named here too rather
    // than falling back to a bare "This".
    const chosenName = chosenItemName(form);
    const wantIn = entryKind === 'income';

    /* Does the team's plan actually budget for this? Derived here purely to SAY so at entry time —
       the report derives it again from the same two ids, and neither stores an answer.
       The Sets are memoised above the form: this function runs on every keystroke while the modal
       is open, and the plan they are built from only changes on a reload.
       ⚠ COMPARED AGAINST THE MATCHING DIRECTION. A team that plans Tournaments → Entry fees as a
       cost has NOT planned Tournaments → Registration revenue as income, and saying otherwise
       would make the warning meaningless on exactly the rows it is most useful for.
       ⚠ NOT SHOWN ON MONEY BACK AT ALL: a refund is not a plan item, and "this isn't in your
       budget" would read as an accusation about the wrong thing. */
    // From the memoised Sets, not a fresh scan of the raw lines — this function runs on every
    // keystroke while the modal is open, which is the whole reason those Sets exist.
    const planned = wantIn ? plannedPairs.in : plannedPairs.out;
    const hasPlan = planned.size > 0;
    const unplanned = Boolean(
      entryKind !== 'refund' && hasPlan && form.budgetCategoryId && form.budgetItemId
      && !planned.has(taxonomyKey(form.budgetCategoryId, form.budgetItemId)),
    );

    /* ⚠⚠ ONE ROW, ONE SOURCE (§4.1). Fundraisers and sponsors already report their own actuals and
       PLAYER REBATES ARE COMPUTED FROM THEM, so a typed income record on the same row would count
       the same dollar twice and reach a family's dues, not just a report. Said here, in the moment,
       rather than only at save time. The server refuses it regardless — this is the courtesy.
       Money back is exempt: it reduces such a row rather than being a second source for it. */
    const derived = Boolean(
      entryKind === 'income' && form.budgetItemId
      && derivedKeys.has(taxonomyKey(form.budgetCategoryId || null, form.budgetItemId)),
    );

    return (
      <div className={`${styles.field} ${styles.formGridFull}`}>
        <label className={styles.label}>
          {entryKind === 'refund' ? 'What is it paying you back for? *' : 'What is this? *'}
        </label>
        {/* ⚠⚠ THE SHARED PICKER, NOT TWO SELECTS (Money form P2, 2026-08-16). This was the ONE
            surface still asking the category and the item as two chained dropdowns while the Budget
            Plan and the Org Budget had used the shared control for months — so the same question
            was asked two different ways inside one product, and only here did a coach have to guess
            our filing system before the word they wanted would appear. The picker searches both
            halves at once: four letters of "diamond" finds Facilities · Diamond permits. */}
        <BudgetItemPicker
          categories={categories}
          value={form.budgetItemId ? {
            categoryId:      form.budgetCategoryId,
            categoryName:    category?.name ?? form.category,
            itemId:          form.budgetItemId,
            itemName:        chosenItemName(form),
            suggestedAmount: null,
          } : null}
          /* ⚠ A REFUND CHOOSES FROM THE EXPENSE LIST — see `formSide`. The tick box flips which way
             the money moves; it never changes the words on offer, because what a refund pays back
             is something the team SPENT. */
          direction={formSide}
          teamId={teamId}
          createItemEndpoint={`/api/coaches/${orgSlug}/budget-items`}
          createItemMode="coach"
          allowCreateCategory
          manageHint="Rename or remove it later from Budget Plan → Manage our items — but it stays on this side."
          /* ⚠ THE PRE-FILL NEVER OVERWRITES A COACH'S OWN WORDS. It lands only on a description that
             is empty, or one still holding the name of the item being switched AWAY from — text this
             control put there and nobody has touched. That test is `isItemLabel`, shared with the
             pill switch so the two cannot drift. */
          onChange={v => setForm(f => ({
            ...f,
            budgetCategoryId: v.categoryId,
            budgetItemId:     v.itemId ?? '',
            // ⚠ REMEMBER THE NAME THE PICKER JUST GAVE US — see `budgetItemName` on BLANK_RECORD.
            // An item created inside this form exists in no list this panel can read yet.
            budgetItemName:   v.itemName,
            // The free-text `category` column every legacy reader still uses. The server derives
            // its own from the item, so this can never be the thing they disagree about.
            category:         v.categoryName,
            description:      isItemLabel(f) ? v.itemName : f.description,
          }))}
        />
        {/* Honest at entry time, exactly as the old category warning was — one level finer, and
            now describing a row the coach will actually see rather than a list they might not. */}
        {unplanned && fieldWarning(
          wantIn
            ? `${chosenName || 'This'} isn’t in your budget — it will show on Budget vs. Actual as income you didn’t plan for.`
            : `${chosenName || 'This'} isn’t in your budget — it will show on Budget vs. Actual as spending you didn’t plan for.`,
        )}
        {derived && fieldWarning(
          `${chosenName || 'This row'}’s actual already comes from your fundraisers and sponsors. Record the money there — logging it here as well would count it twice.`,
        )}
        {/* ⚠ "PICK AN ITEM TOO" IS GONE, AND THAT IS THE POINT OF ONE CONTROL. It existed because
            the two chained selects let a coach answer half the question — a category with no item —
            and leave the form looking finished. A single searchable control cannot reach that
            state: a selection is always a category AND an item, or it is nothing. The save's own
            check on `budgetItemId` stays, because the server's does. */}
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

  /* ⚠ ONLY THE COMMITMENTS ARE SPLIT OUT NOW. The plain-expense list was the other half of this
     pair and the register replaced it — the book does not group by expense TYPE, because a coach
     reading their books in date order does not care which of the two shapes a cost was recorded
     as; they care what left the account and when. */
  const allPayables = expenses.filter(e => e.expenseType === 'tournament_payable');
  const tagMatch = (e: RepTeamExpense) => !filterTagId || (tagsByExpenseId[e.id] ?? []).includes(filterTagId);
  const tournamentPayables = allPayables.filter(tagMatch);

  // Filter chip row: tags actually used by the current tab's expenses, with counts (mirrors the
  // game "vs tag" report). Selecting one narrows the list + shows a tag total.
  /* Which records the tag chips are counted over. On the register that is EVERY expense, both
     kinds: the book carries a commitment's settled halves beside an ordinary cost, so counting only
     one type would offer a chip whose number disagreed with the rows it then produced. */
  const activeAll = tab === 'commitments' ? allPayables : expenses;
  /** Which face is this, said once — every branch below reads these rather than re-testing. */
  const onPayables = face === 'payables';
  const tagCounts = new Map<string, number>();
  for (const e of activeAll) for (const id of (tagsByExpenseId[e.id] ?? [])) tagCounts.set(id, (tagCounts.get(id) ?? 0) + 1);
  const usedTagIds = [...tagCounts.keys()]
    .map(id => tagById.get(id))
    .filter((t): t is RepTeamTag => !!t)
    .sort((a, b) => a.name.localeCompare(b.name));
  const filteredActive = tournamentPayables;
  /* ⚠ THE COMMITMENT LIST EXCLUDES NOTHING — a settled commitment stays on Payables, because
     "what did we owe this season, and did we pay it?" is a question the tab has to answer after
     the fact as well as before it. The Schedule view's own Unpaid/Paid/All filter is where that
     narrowing lives, exactly as it did before the split. */

  const scheduleRows = (schedule ?? []).filter(r =>
    scheduleFilter === 'all' ? true : scheduleFilter === 'paid' ? !!r.paid : !r.paid);

  /* ⚠ "from Club" COMES OUT ON A STANDALONE TEAM. A filter that can never match anything is a dead
     control, and on a team with no club it would also imply a relationship the team does not have. */
  const registerFilters = REGISTER_FILTERS.filter(f => f.id !== 'club' || book?.orgLinked !== false);
  /* What the downloaded file is called, and its filename segment.
     ⚠ `expenses` AND `money-in` STAY AS SEGMENTS where the filter reproduces the retired dataset —
     a coach's downloads folder already holds a season of files under those words, and the export
     catalog lists them. The register's own file is `register`. */
  const registerExportLabel = registerFilter === 'all'
    ? 'Register'
    : REGISTER_FILTERS.find(f => f.id === registerFilter)!.label;
  const registerExportDataset = registerFilter === 'expense' ? 'expenses'
    : registerFilter === 'all' ? 'register'
    : registerFilter;

  /**
   * A schedule row's Mark paid — a named helper, not an inline block in the JSX (/simplify).
   *
   * ⚠ THE ROW CARRIES ONLY AN ID; THE SETTLE FORM NEEDS THE RECORD, for its item, its description
   * and the half's own amount. A row whose commitment has not arrived in this panel's list yet
   * shows no button rather than opening a form with blanks in it.
   *
   * ⚠ Marking paid works on this team's OWN commitments. An org allocation is settled through Org
   * Allocations, which owns that conversation.
   */
  const payablesById = new Map(allPayables.map(p => [p.id, p]));
  function scheduleMarkPaidButton(row: ScheduleRow) {
    if (row.paid || !canWriteMoney || row.source !== 'team' || !row.expenseId) return null;
    const record = payablesById.get(row.expenseId);
    if (!record) return null;
    return (
      <button
        className={`${styles.btnSecondary} ${styles.block640} ${styles.compactAction}`}
        onClick={() => openSettle(record, row.half === 'deposit' ? 'deposit' : 'balance')}
      >
        Mark paid
      </button>
    );
  }

  /**
   * ONE ROW OF THE REGISTER.
   *
   * ⚠ THE ROW DECIDES ITS OWN DOOR, and there are three. A RECORDED row (a cost, a commitment
   * half, income, money back) opens the money form and is fully editable. A DERIVED row — dues,
   * fundraising, the club — is edited where it was MADE, so it navigates to that workspace instead:
   * the register is a view, and "one row, one source" holds precisely because it cannot write. A
   * SCHEDULED money-out row additionally offers Mark paid, which opens the money form pre-filled
   * and asks when — the same single door P1 built.
   *
   * ⚠ `movesCash` IS NOT COSMETIC. On an out-of-pocket cost the balance stands still, and the row
   * has to say so in words rather than leaving a coach to notice a column that did not add up.
   */
  function registerRow(r: RegisterBookRow) {
    const record = r.open?.kind === 'expense' ? expenseById.get(r.open.id) : undefined;
    const arrival = r.open?.kind === 'money-in' ? moneyInById.get(r.open.id) : undefined;
    const openRecord = record ? () => openEdit(record) : arrival ? () => openEditMoneyIn(arrival) : null;
    const tappable = canWriteMoney && !!openRecord;
    const workspaceHref = r.open?.kind === 'workspace'
      ? moneySectionHref(base, r.open.section, undefined)
      : null;
    /* A settle needs the RECORD, for its item and its half's own amount. A row whose commitment is
       not in this panel's list shows no button rather than opening a form with blanks in it. */
    const settle = r.markPaid && record && canWriteMoney ? r.markPaid : null;
    return (
      <tr
        key={r.id}
        className={`${styles.tr} ${tappable ? styles.rowTappable : ''} ${r.scheduled ? styles.registerRowScheduled : ''}`}
        onClick={tappable ? () => { if (window.getSelection()?.toString()) return; openRecord!(); } : undefined}
      >
        <td className={styles.td} data-label="Date">
          {/* ⚠ formatStoredDate, never a hand-roll — this column mixes bare dates with paid stamps
              held at org noon, and both hand-rolls have printed the wrong day already. */}
          {r.date ? fmtDate(r.date) : <span className={styles.mutedInline}>No date</span>}
        </td>
        <td className={`${styles.td} ${styles.cardStackCell}`} data-label="What">
          {r.description}
          {r.scheduled && <> <span className={styles.registerChip}>Scheduled</span></>}
          {/* ⚠⚠ INCOME AND A REFUND SHARE THE MONEY-IN COLUMN AND ARE OPPOSITES, so the two of them
              — and only the two of them — carry their kind on the row. A $325 grant and a $325
              vendor credit are otherwise identical here, and telling them apart is the one thing
              only the coach can do. Every other kind is already named: an expense by the column it
              sits in, a derived row by the workspace chip beside it.
              ⚠ This is a LIST labelling its rows, which the report still may not do — a refund nets
              into the row it repaid there, leaving nothing to tag (owner ruling 2026-08-15). */}
          {(r.kind === 'income' || r.kind === 'refund') && (
            <> <span className={styles.registerChip}>{REGISTER_KIND_LABEL[r.kind]}</span></>
          )}
          {r.sourceLabel && <> <span className={styles.registerChip}>{r.sourceLabel}</span></>}
          {!r.movesCash && <> <span className={styles.registerChip}>No team cash</span></>}
          {r.detail && (
            <span className={styles.mutedInline} style={{ display: 'block', fontSize: '0.75rem', fontStyle: 'normal' }}>
              {r.detail}
            </span>
          )}
          {record && tagChips(record.id)}
        </td>
        <td className={styles.td} data-label="Category" style={{ color: 'var(--home-dim, rgba(255,255,255,0.5))' }}>
          {r.categoryName ?? '—'}
        </td>
        <td className={styles.td} data-label="Item" style={{ color: 'var(--home-dim, rgba(255,255,255,0.5))' }}>
          {r.itemName ?? '—'}
        </td>
        <td className={`${styles.td} ${styles.tdNum} ${styles.registerAmt}`} data-label="Money out">
          {r.moneyOut ? fmt(r.moneyOut) : ''}
        </td>
        <td className={`${styles.td} ${styles.tdNum} ${styles.registerAmt} ${r.moneyIn ? styles.registerAmtIn : ''}`} data-label="Money in">
          {r.moneyIn ? fmt(r.moneyIn) : ''}
        </td>
        {showBalance && (
          <td
            className={`${styles.td} ${styles.tdNum} ${styles.registerAmt} ${r.movesCash ? '' : styles.registerBalanceUnmoved}`}
            data-label="Balance"
            /* The chip in the What column says it in words; this says it to a screen reader
               standing on the figure itself, which is where the question actually occurs. */
            title={r.movesCash ? undefined : 'A family paid this directly — the team’s cash did not move'}
          >
            {fmt(r.balance)}
          </td>
        )}
        <td className={`${styles.td} ${styles.cardActionCell}`}>
          {settle && (
            <button
              className={`${styles.btnSecondary} ${styles.block640} ${styles.compactAction}`}
              onClick={ev => { ev.stopPropagation(); openSettle(record!, settle.half === 'expense' ? null : settle.half); }}
            >
              Mark paid
            </button>
          )}
          {canWriteMoney && openRecord && !settle && (
            <RowEditButton label={`Edit ${r.description}`} onClick={openRecord} />
          )}
          {workspaceHref && (
            /* ⚠ A DERIVED ROW NAVIGATES, IT DOES NOT EDIT. The chip beside the description names the
               workspace; this is the way there. */
            /* A real control, not a bare inline link: it sits in the same action cell as Mark paid
               and the row pencil, and a 15px hit target beside two buttons is the row's one
               affordance a finger cannot find. */
            <Link
              href={workspaceHref}
              className={`${styles.btnSecondary} ${styles.block640} ${styles.compactAction}`}
              onClick={ev => ev.stopPropagation()}
            >
              Open
            </Link>
          )}
        </td>
      </tr>
    );
  }

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
      {/* ⚠ ONE ADD BUTTON PER TAB, AND EACH NOW NAMES ITS OUTCOME (Money split P1, 2026-08-16).
          The plain "Add" was right while one screen could produce four different records and the
          form's own switch made the choice; each tab holds one kind of record now, so the button
          can say what pressing it makes — and on Payables it must, because "Add" on a tab full of
          money owed reads as "add money", which is the exact confusion the split removes.
          Transactions keeps the plain word: it still opens the three-answer form. */}
      <button className={styles.btnPrimary} onClick={() => openAdd()}>
        <Plus size={14} aria-hidden /> {onPayables ? 'Add a commitment' : 'Add'}
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
  /* Money tags live on expenses, so the schedule (two sources, by due date) has nothing for the
     filter to narrow. On the register the chips move DOWN into the book's own control row — the
     toolbar's left-hand slot is the type strip now, and two filter bars sharing one line is the
     three-bands-of-chrome problem the toolbar merge removed. */
  const showTagFilter = usedTagIds.length > 0 && tab !== 'schedule';
  const tagFilterInToolbar = showTagFilter && tab === 'commitments';

  const expenseHeaderActions = !embedded && canWriteMoney ? (
    <button className={styles.btnSecondary} onClick={() => setImportOpen(true)} aria-label="Import">
      <Upload size={14} aria-hidden /> <span className={styles.headerBtnLabel}>Import</span>
    </button>
  ) : null;

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      {!embedded && (
        <CoachBackLink href={`${base}/accounting`}>Back to Money</CoachBackLink>
      )}
      {/* Page-header ruling 2026-08-11: one shape, actions right, phone secondaries icon-only.
          ⚠ The write gates stand (Chunk A probe): a read-only money assistant sees no sheet
          door the server would refuse. "Tournament" stays retired from the title (D-H9). */}
      {/* ⚠ THE HELP SUBTOPIC FOLLOWS THE FACE. The one "Expenses & Payables" guide split with the
          screen (Money split P1) — pointing both tabs at one topic would send a coach asking about
          a commitment to a page whose first half is about recording what has already been spent. */}
      <CoachPageHeader
        variant={embedded ? 'embedded' : 'standard'}
        icon={Receipt}
        title={onPayables ? <>Payables</> : <>Transactions</>}
        actions={expenseHeaderActions}
        helpLabel={onPayables ? 'Payables' : 'Transactions'}
        help={{
          module: 'coaches',
          sectionIds: ['premium-money'],
          subtopicId: onPayables ? 'premium-money-payables' : 'premium-money-transactions',
          fullGuideHref: `/${orgSlug}/coaches/help#premium-money`,
        }}
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
        {/* ⚠ FOUR SUB-TABS BECAME TWO AND ONE (Money split P1 then P3). P1 divided the old strip's
            happened-lists from its owed-lists along the tab boundary; P3 collapsed the happened side
            into a single book, so Payables keeps a pair and Transactions has none.

            ⚖ AND THE NAME "MONEY IN" IS RETIRED HERE, which is the rename P1 deliberately deferred
            (owner call, 2026-08-16, against the plan's own §6). That list held income AND money
            back, and this screen's own empty state teaches in bold that a refund is not income — so
            calling it "Income" one phase early would have put two of every four rows under a heading
            the product contradicts. The register's separate **Income** and **Refunds** filters make
            the word true of the rows beneath it, so the compromise has nothing left to protect. */}
        {onPayables ? (
          <div className={`${styles.viewToggle} ${styles.panelToolbarTabs}`}>
            <button className={`${styles.viewToggleBtn} ${tab === 'schedule' ? styles.viewToggleBtnActive : ''}`} onClick={() => goToTab('schedule')}>
              Schedule
            </button>
            <button className={`${styles.viewToggleBtn} ${tab === 'commitments' ? styles.viewToggleBtnActive : ''}`} onClick={() => goToTab('commitments')}>
              Commitments ({allPayables.length})
            </button>
          </div>
        ) : (
          /* ⚠⚠ FILTERS, NOT SUB-TABS (plan §4.3, ruled 2026-08-16). Transactions carried Expenses
             and Money in as a second tab row; the register is ONE book, so the strip narrows what
             is on it instead of choosing between two lists. That is what lets a running balance
             exist at all — neither of the old lists could carry one, because half the money was
             always on the other. */
          <div className={styles.moneyFilterBar} style={{ marginBottom: 0 }} role="group" aria-label="Show">
            {registerFilters.map(f => (
              <button
                key={f.id}
                className={`${styles.moneyFilterChip} ${registerFilter === f.id ? styles.moneyFilterChipActive : ''}`}
                aria-pressed={registerFilter === f.id}
                onClick={() => setRegisterFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        {tagFilterInToolbar && (
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
            label={tab === 'schedule' ? 'Payment schedule'
              : tab === 'register' ? registerExportLabel
              : 'Commitments'}
            formats={['xlsx', 'csv']}
            build={() => (tab === 'register'
              ? {
                  /* ⚠ THE FILE IS WHATEVER THE STRIP IS SHOWING, and that is how the two retired
                     datasets survive: `Expenses` is the register on its Expenses filter, and the old
                     `Money in` file becomes Income and Refunds separately — two files that finally
                     mean what their headings say. The filename segment follows the filter, so a
                     coach's downloads folder keeps `…-expenses-…` where it always had one. */
                  dataset: registerExportDataset,
                  title: registerExportLabel,
                  columns: REGISTER_COLUMNS,
                  /* Scheduled first, then settled — the order on screen. A file that re-sorted the
                     rows would put a projection in the middle of the settled book with a balance
                     that belongs to neither. */
                  rows: registerExportRows([...bookScheduled, ...bookSettled], showBalance),
                  scopeLabel: assignment?.programYearName ?? '',
                  teamName: assignment?.teamName ?? '',
                  emptyMessage: 'Nothing has been recorded on this book yet.',
                }
              : tab === 'schedule'
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
                  /* ⚠ THE DATASET NAME STAYS `payables` even though the view is now called
                     Commitments. It is the filename segment a coach's downloads folder already
                     holds a season of, and the export catalog lists it under that word — renaming
                     the file would break continuity for a screen label, which is exactly the trade
                     plan §6 refused when it kept the tab called Payables. */
                  dataset: tab === 'commitments' ? 'payables' : 'expenses',
                  title: tab === 'commitments' ? 'Commitments' : 'Expenses',
                  columns: EXPENSE_COLUMNS,
                  rows: expenseRows(filteredActive, tagsByExpenseId, tagById),
                  scopeLabel: assignment?.programYearName ?? '',
                  teamName: assignment?.teamName ?? '',
                  emptyMessage: tab === 'commitments'
                    ? 'No commitments have been recorded yet.'
                    : 'No expenses have been logged yet.',
                })}
            // Matches every sibling tab. Without it, an Export with nothing behind it reads as
            // available right up until you press it — the dialog would still explain itself,
            // but the button should not have invited the click.
            disabled={tab === 'schedule' ? scheduleRows.length === 0
              : tab === 'register' ? bookEmpty
              : filteredActive.length === 0}
          />
          {expenseToolbarActions}
        </div>
      </div>
      {tagFilterInToolbar && (
        <div className={styles.tagComboLegend} style={{ margin: '-0.5rem 0 0.7rem' }}>
          <span className={styles.tagComboLegendItem}>
            <span className={styles.tagComboLegendDot} style={{ background: 'rgba(var(--blueprint-blue-rgb),0.55)', border: '1px solid rgba(var(--blueprint-blue-rgb),0.7)' }} /> Org tag
          </span>
          <span className={styles.tagComboLegendItem}>
            <span className={styles.tagComboLegendDot} style={{ background: 'rgba(var(--logic-lime-rgb),0.55)', border: '1px solid rgba(var(--logic-lime-rgb),0.7)' }} /> Team tag
          </span>
        </div>
      )}
      {/* ⚠ GATED ON THE SAME CONDITION AS THE CHIPS. The filter itself hides on the tabs money
          tags cannot narrow, but this caption was gated only on a tag BEING chosen — and nothing
          clears that choice on a tab change. Filter the Payables list, switch to Money in, and the
          payables count and total sat there captioning a list they had nothing to do with
          (/review, regression lens). */}
      {filterTag && tagFilterInToolbar && (
        <div className={styles.moneyTagSummary}>
          vs <strong>{filterTag.name}</strong>: {filteredActive.length} commitment{filteredActive.length !== 1 ? 's' : ''}, <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(filterTotal)}</span> total
        </div>
      )}

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : tab === 'register' ? (
        /* ── THE REGISTER (money redesign P3, plan §4) ──────────────────────────────────────
           One dated book of every dollar the season moved, with the balance beside it. The two
           lists this replaces — Expenses and Money in — could never carry a running balance
           between them, because each held half the money.

           ⚠⚠ THE CLOSING BALANCE IS CASH ON HAND. Not "about the same as"; the same number, from
           the same records, and the reason this screen reaches past what the coach typed here into
           dues, fundraising and the club. If the two ever disagree, the register is wrong by
           construction — see the header on /api/coaches/.../register. */
        <>
          <div className={styles.registerControls}>
            {registerItemNames.length > 0 && (
              <select
                className={styles.registerSelect}
                value={registerItemId}
                onChange={ev => setRegisterItemId(ev.target.value)}
                aria-label="Narrow to one budget item"
              >
                <option value="">Every budget item</option>
                {registerItemNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
            {/* ⚠ THE OVERLAY IS ON BY DEFAULT (plan §4.4). Off, the book is only what has already
                happened; on, it runs past Today into what is scheduled.

                ⚠⚠ THIS COMMENT USED TO END "Nothing pending a DECISION is ever in it — an
                unapproved club request is money the club may still decline." THAT IS NO LONGER
                TRUE (owner ruling 2026-08-17, money redesign P4): a club request awaiting an answer
                DOES appear here, at the foot of the scheduled block, saying *No date* and chipped
                *Awaiting the club*. The argument that overturned it was that this overlay already
                carries a sponsor PLEDGE — money that may never arrive either.

                🔒 What survives: nothing undecided may touch a SETTLED figure. Turn this off and the
                pending row is gone; Cash on hand never saw it either way. The full reasoning lives
                on the loop that emits the row, in the register route. */}
            <button
              type="button"
              className={`${styles.moneyFilterChip} ${showScheduled ? styles.moneyFilterChipActive : ''}`}
              aria-pressed={showScheduled}
              onClick={() => setShowScheduled(s => !s)}
            >
              Include what&apos;s scheduled
            </button>
            {showTagFilter && !tagFilterInToolbar && (
              <>
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
              </>
            )}
          </div>

          {/* What the book closes at, said once above it rather than only at the foot of a long
              table. ⚠ It disappears with the Balance column, for the same reason: a "cash on hand"
              figure printed over a filtered book would be the one number a coach would trust. */}
          {showBalance && book && (
            /* The coach demo's tour stops here (step 5) — it is the one line in Money that says
               what the whole book is FOR, so the anchor belongs on the figure, not the table. */
            <div className={styles.registerClose} data-sandbox-tour="register-balance">
              <span>
                Cash on hand <span className={styles.registerCloseFig}>{fmt(book.cashOnHand)}</span>
              </span>
              {showScheduled && book.projectedBalance !== null && (
                <span className={styles.registerCloseProjected}>
                  {fmt(book.projectedBalance)} once everything scheduled has happened
                </span>
              )}
            </div>
          )}

          {bookEmpty ? (
            <>
              <CoachEmptyState
                icon={<Receipt size={22} aria-hidden />}
                headline={registerFilter === 'all' && !registerItemId && !filterTagId
                  ? 'Nothing on the books yet'
                  : 'Nothing matches that'}
                description={registerFilter === 'all' && !registerItemId && !filterTagId
                  ? 'Every dollar this season moves — what you spend, what arrives, dues, fundraising and anything settled with the club — lands here in date order.'
                  : 'Try a wider filter, or turn on what is scheduled.'}
                primaryAction={canWriteMoney && registerFilter === 'all' && !registerItemId && !filterTagId ? {
                  label: 'Add Expense',
                  icon: <Plus size={15} aria-hidden />,
                  onClick: () => openAdd({ kind: 'expense', timing: 'paid' }),
                } : undefined}
                secondaryAction={canWriteMoney && registerFilter === 'all' && !registerItemId && !filterTagId ? {
                  label: 'Add Income',
                  icon: <Plus size={15} aria-hidden />,
                  onClick: () => openAdd({ kind: 'income', timing: 'paid' }),
                } : undefined}
              />
              {/* ⚠ THE TEACHING LIVES ON THE EMPTY STATE, NOT ON THE FORM (owner ruling 2026-08-16,
                  P2 §5). Both comparisons belong here now that one book holds both directions: which
                  tab a commitment goes on, and the three-way distinction a coach describes with one
                  sentence — income, money back, and a family paying the vendor direct. */}
              {registerFilter === 'all' && !registerItemId && !filterTagId && (
                <>
                  <KindCompare
                    otherHref={moneySectionHref(base, 'payables', undefined)}
                    onPayables={false}
                  />
                  <MoneyInCompare />
                </>
              )}
            </>
          ) : (
            <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Date</th>
                    <th className={styles.th}>What</th>
                    <th className={styles.th}>Category</th>
                    <th className={styles.th}>Item</th>
                    {/* ⚠ TWO COLUMNS, EACH POSITIVE — never one signed column (plan §2, superseded
                        draft 2). The column a figure sits in IS its direction, which is what lets
                        one book mix them without a minus sign or a per-row label. */}
                    <th className={`${styles.th} ${styles.thNum}`}>Money out</th>
                    <th className={`${styles.th} ${styles.thNum}`}>Money in</th>
                    {showBalance && <th className={`${styles.th} ${styles.thNum}`}>Balance</th>}
                    <th className={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {/* Scheduled first, soonest at the top, then the Today rule, then the settled
                      book newest-first. */}
                  {bookScheduled.map(r => registerRow(r))}
                  {bookScheduled.length > 0 && (
                    <tr className={styles.registerToday}>
                      <td colSpan={showBalance ? 8 : 7}>Today — {fmtDate(tournamentToday())}</td>
                    </tr>
                  )}
                  {bookSettled.map(r => registerRow(r))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : tab === 'commitments' ? (
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
              headline="Nothing committed yet"
              description="Record something you've agreed to pay — or bring a whole season's commitments in from a schedule your club already keeps."
              primaryAction={canWriteMoney ? {
                label: 'Add a commitment',
                icon: <Plus size={15} aria-hidden />,
                onClick: () => openAdd({ kind: 'expense', timing: 'payable' }),
              } : undefined}
              secondaryAction={canWriteMoney ? {
                label: 'Import a schedule',
                icon: <Upload size={15} aria-hidden />,
                onClick: () => setImportOpen(true),
              } : undefined}
            />
            <KindCompare
              otherHref={moneySectionHref(base, onPayables ? 'transactions' : 'payables', undefined)}
              onPayables={onPayables}
            />
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
                          ) : canWriteMoney && (
                            /* ⚠ MARK PAID GOES THROUGH THE MONEY DOOR (plan §3, ruled 2026-08-16).
                               This was an inline date prompt; it now opens *Add money* pre-filled
                               from the commitment, because a payment being born anywhere other
                               than that one form is how the portal ended up with two records
                               carrying the same dollars. The inline prompt survives on the plain
                               unpaid EXPENSE one tab over, which is not a commitment. */
                            <button
                              className={`${styles.btnSecondary} ${styles.block640} ${styles.compactAction}`}
                              style={{ marginTop: '0.4rem' }}
                              onClick={ev => { ev.stopPropagation(); openSettle(e, 'deposit'); }}
                            >
                              Mark deposit paid
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
                          ) : canWriteMoney && (
                            <button
                              className={`${styles.btnSecondary} ${styles.block640} ${styles.compactAction}`}
                              style={{ marginTop: '0.4rem' }}
                              onClick={ev => { ev.stopPropagation(); openSettle(e, 'balance'); }}
                            >
                              Mark balance paid
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
                        {/* ⚠ MARK PAID GOES THROUGH THE MONEY DOOR HERE TOO (plan §3) — a schedule
                            half and the same half on its commitment's drawer are the same act, so
                            they must not offer two different ways to record it. The gating and the
                            record lookup live in `scheduleMarkPaidButton`. */}
                        <td className={`${styles.td} ${styles.cardActionCell}`}>
                          {scheduleMarkPaidButton(row)}
                          {row.source === 'org' && !row.paid && (
                            <Link href={moneySectionHref(base, 'club', undefined)} className={styles.linkBtn}>Open Club</Link>
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
              <Link href={moneySectionHref(base, 'dues', undefined)} className={styles.linkBtn}>Player Dues</Link>.
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
            {/* ⚠ A SETTLE NAMES THE COMMITMENT IT IS PAYING. The modal is the money form either
                way, but a coach who tapped Mark paid needs the header to confirm which of three
                similarly-named entries they are about to settle — the record is pre-filled, so
                without this the only difference from an ordinary Add is a figure. */}
            <CoachModalHeader
              title={{ settle: 'Record the payment', edit: copy.editTitle, add: 'Add' }[formMode]}
              subtitle={formMode === 'settle' ? `Settling ${settling!.describes}`
                : formMode === 'add' ? 'Record money the team spent, or money that came in.'
                : undefined}
              onClose={closeForm}
            />
            <div className={styles.formGrid}>
              {/* ── What kind of entry is this? ───────────────────────────────────────────────
                  THREE ANSWERS, BECAUSE ACCOUNTING HAS THREE (plan §3.1, mockup ee76cc79).

                  ⚠ ONLY WHEN ADDING. A saved record never switches kind: converting an expense to
                  a payable would materialise due-date fields on an existing row and converting
                  back would drop a schedule it may already appear on; converting income to money
                  back would move a figure from one section of the report to a reduction somewhere
                  else while one posted ledger entry tried to describe both. With Delete available
                  and stating its own consequence, the wrong kind is cheap to fix honestly. */}
              {/* ⚠⚠ THE COMMITMENT DOOR ASKS NO KIND QUESTION AT ALL (Money split P1, 2026-08-16).
                  Payables holds exactly one kind of record, so the answer is already known by the
                  time the form opens — and a commitment is ALWAYS money out, which is why income
                  never appears here. A scheduled income is a budget line; the plan side models it. */}
              {!editing && !editingMoneyIn && isPayableForm ? (
                <p className={`${styles.formHint} ${styles.formGridFull}`} style={{ marginTop: 0 }}>
                  {copy.statedFact}
                </p>
              ) : !editing && !editingMoneyIn ? (
                /* ── TWO PILLS AND A TICK BOX (owner ruling 2026-08-16, form proposal b618c784) ──
                    This replaced a three-option switch — A cost · Income · Money back on something —
                    which asked a coach to hold three ideas at once when only two of them are
                    directions. A refund is not a third kind of money; it is money that came back on
                    something the team already paid for, which is why it rides on the EXPENSE pill:
                    the tick flips which way the money moves and leaves the list of words alone.
                    ⚠ THE DATA STILL HAS THREE, and that is deliberate, not a leak. `expense`,
                    `income` and `refund` remain three different records with three different
                    effects — one adds a cost, one adds an arrival, one REDUCES the row it repays.
                    Only the control changed. */
                <div className={styles.formGridFull}>
                  <div className={styles.kindSwitch} role="radiogroup" aria-label="Is this money out or money in?">
                    {([
                      { side: 'out' as const, name: 'Expense', sub: 'Money the team spent' },
                      { side: 'in'  as const, name: 'Income',  sub: 'Money the team earned or was given' },
                    ]).map(p => (
                      <button
                        key={p.side}
                        type="button"
                        role="radio"
                        aria-checked={formSide === p.side}
                        className={`${styles.kindSwitchOption} ${formSide === p.side ? styles.kindSwitchOptionOn : ''}`}
                        /* ⚠ SWITCHING KEEPS WHAT HAS BEEN TYPED. Amount and the note are common to
                           both sides and are exactly the fields already filled in when a coach
                           realises they picked wrong — clearing them would make the switch as
                           expensive as cancelling, which is what it exists to replace.
                           ⚠ THE ITEM IS THE ONE THING THAT CANNOT SURVIVE (mig 246). The pill
                           decides which words are choosable, so a word carried across from the
                           other side would sit in the picker as a selection the coach can see and
                           can never re-pick. It clears, and the picker asks again. */
                        onClick={() => setEntrySide(p.side)}
                      >
                        <span className={styles.kindName}>{p.name}</span>
                        <span className={styles.kindSub}>{p.sub}</span>
                      </button>
                    ))}
                  </div>

                  {/* ⛔ "PROMISED, NOT PAID YET" IS GONE FROM THIS FORM (Money split P1, ruled
                      2026-08-16). It was a timing question inside a form that now records only
                      what HAPPENED — and it was the seam the whole redesign turned on: the same
                      modal derived a hidden mode from whichever sub-tab opened it, so a coach
                      recording last night's diamond rental and a coach scheduling March's
                      tournament entry met one screen wearing two meanings. A commitment has its
                      own door on Payables now, and its deposit/balance pair and due dates went
                      with it. What is left here is a single question: what happened, and when. */}
                  <div className={styles.kindTickRow}>
                    {/* ⚠⚠ RENDERED ON BOTH PILLS, LIVE ON ONLY ONE — and that is the fourth cell of
                        the grid nobody had named. A refund of money the team RECEIVED (handing a
                        family back a registration fee) is money going out against an income word,
                        and no such record exists in this product. Hiding the tick under Income
                        would leave a coach who opened the Money in door to log a refund — the
                        obvious door, since a refund IS money arriving — with no control and no
                        clue; disabling it with the reason turns a dead end into a direction. */}
                    <label className={`${styles.formCheck} ${formSide === 'in' ? styles.formCheckOff : ''}`}>
                      <input
                        type="checkbox"
                        checked={entryKind === 'refund'}
                        disabled={formSide === 'in'}
                        onChange={e => setFormKind(e.target.checked ? 'refund' : 'expense')}
                      />
                      This is a refund
                    </label>
                    {formSide === 'in' && (
                      <p className={styles.kindTickWhy}>
                        A refund goes against what the team paid — choose <strong>Expense</strong>.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className={`${styles.formHint} ${styles.formGridFull}`} style={{ marginTop: 0 }}>
                  {copy.statedFact} Wrong kind? Delete this and add it again.
                </p>
              )}

              {/* ⚠ THE BUDGET LINE IS ASKED BEFORE THE DESCRIPTION (owner ruling 2026-08-15), and
                  the order is the feature. Choosing a line NAMES the record — the description
                  arrives pre-filled with the line's own name, ready to be typed over — so the
                  question that used to be the first thing a coach typed is usually already
                  answered by the time they reach it. Asked the other way round, the pre-fill would
                  land on a field they had just finished filling in.

                  ⚠ ONE CALL SITE, BOTH KINDS, ADD AND EDIT. The two Add modals merged into this one
                  form on 2026-08-15, which is why the budget-line field only has to be placed once
                  to reach an expense, a payable, and every edit of either. */}
              {budgetItemField()}

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Description{isMoneyInForm ? '' : ' *'}</label>
                <input
                  className={styles.input}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={isMoneyInForm
                    ? 'Optional note — the item names the row'
                    : isPayableForm ? 'e.g. Spring tournament entry, summer dome block' : 'e.g. Diamond rental'}
                />
                {/* ⚠ OPTIONAL ON AN ARRIVAL, REQUIRED ON A COST, AND THE ASYMMETRY IS REAL. An
                    expense's description IS the record: it is written onto the team's books as the
                    ledger entry, and it is how a delete finds the entry to reverse on anything paid
                    before 2026-08-15. A money-in row stores its ledger link from birth and describes
                    the entry from the ITEM, so nothing depends on these words — making them
                    mandatory would be asking for typing that changes nothing. */}
                {/* ⚠ STILL REQUIRED ON A COST, AND IT IS NOT THE NOTE (that field is optional, under Details).
                    This text IS the record: it is written onto the team's books as the ledger entry
                    when the cost is marked paid, it is how a delete finds the entry to reverse on
                    anything paid before 2026-08-15 (those rows store no entry id and are matched by
                    description), and it is the only thing naming the row in the lists, the Payment
                    schedule, the exports and the delete confirmation. Blank, a record is nameless in
                    five places and a paid one can become impossible to reverse cleanly. Pre-filling
                    it from the budget line is the answer to the typing, not making it optional. */}
              </div>

              {/* ⚖ THE LOCK IS GONE (owner ruling 2026-08-16). A posted figure used to render
                  read-only with "delete this and enter it again", because nothing could carry a
                  correction through to the team's books. The server does that now, so the field is
                  simply a field — and a coach who mistyped an amount fixes it the obvious way
                  instead of reversing real money to correct a typo. What replaced the lock is the
                  sentence below the figure, which says what saving will DO. */}
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
                {/* ⚠ THE "THIS MOVES THE BOOKS" SENTENCE LIVES IN THE CONSEQUENCE LINE NOW (ruling
                    2026-08-16, §3: one line, above the buttons, every state). It sat here as a
                    fourth copy of the same idea, worded differently from the other three — which is
                    how one of them ended up contradicting the screen it was on. */}
              </div>

              {/* ── A cost's own date, the money-OUT twin of "Date received" (2026-08-16) ─────
                  ⚠⚠ THE DEFECT THIS CLOSES. "Already paid" used to record no date at all, so the
                  cost arrived UNPAID: $0 on Budget vs. Actual, absent from every month, no cash
                  moved — until a separate Mark paid stamped TODAY, putting last month's diamond
                  rental in this month's column with no way back. The month grid exists to say when
                  money moved; this is the field that lets a coach say it.

                  ⚖ CORRECTABLE AFTER THE FACT TOO (owner ruling 2026-08-16). It was add-only while
                  a posted figure was frozen; the entry on the books now moves to the day you pick,
                  which is what puts the cost in the right month on the report. A record that has
                  NOT posted has no date to correct — Mark Paid is where that one gets its date, so
                  the field is offered on a new cost and on a settled one, and not in between.

                  ⚠ NOT ON A COMMITMENT'S OWN FORM. Its money moves through the deposit and the
                  balance, each with its own dates — a paid stamp on the commitment itself would
                  claim the whole thing settled while two halves still think they are owed. The
                  server refuses it. A SETTLE is the opposite case and always shows it: that is the
                  one question Mark paid exists to ask. */}
              {!isMoneyInForm && !isPayableForm && (isSettling || !editing || editing.expensePaidAt) && (
                <div className={styles.field}>
                  {/* ⚠ NO ASTERISK when recording a cost (/review, 2026-08-16): clearing it is the
                      documented way to record something not settled yet. On a SETTLE it is required
                      — there is no such thing as a payment with no date — so it takes one. */}
                  <label className={styles.label}>{isSettling ? 'Date paid *' : 'Date paid'}</label>
                  <input
                    className={styles.input}
                    type="date"
                    max={tournamentToday()}
                    value={form.paidDate}
                    onChange={e => setForm(f => ({ ...f, paidDate: e.target.value }))}
                  />
                  {/* ⚠ THE HINT DEPENDS ON WHO PAID (/review, 2026-08-16). "Clear this and it waits
                      as unpaid" is FALSE once Paid by names a family: that cost was settled by them,
                      the server always creates it paid, and no Mark paid button ever appears — so
                      the field dates their credit rather than deciding whether one is owed. */}
                  <p className={styles.formHint}>
                    {isSettling
                      ? 'The day the money actually left — back-date it and the cost lands in that month, not this one.'
                      : form.paidByPlayerId
                      ? 'The day the family paid it. The team owes them from that date.'
                      : 'When the money actually left. Not paid yet? Clear this and it waits as an '
                        + 'unpaid cost until you mark it paid.'}
                  </p>
                  {/* ⚠⚠ THE REFUSAL CARRIES THE DOOR, which is the whole reason it is a rendered
                      element rather than a thrown sentence. Telling a coach "that hasn't happened
                      yet" and leaving them to find Payables themselves is a dead end wearing a
                      polite face — the link takes the amount and the item they already typed
                      straight into the commitment form. */}
                  {futureDateRefused && !settling && (
                    <p className={`${styles.formHint} ${styles.formHintConsequence}`} role="alert">
                      <strong>That hasn’t happened yet</strong> — money can only be recorded once it
                      has moved. Agreed to pay it later?{' '}
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => {
                          /* Carries the work across rather than restarting it: the item, the
                             amount and the description are the same facts either way, and the
                             typed future date becomes the DUE date, which is what it always was.
                             ⚠⚠ THE PAYEE AND THE TAGS TRAVEL TOO (/review, 2026-08-16). They live
                             in their own state, not in `form`, so the spread missed them and
                             `resetForm` then cleared them — the coach watched their description and
                             amount survive the hop while "who we owe" vanished without a word, and
                             the commitment saved with no payee. On a record that exists to say what
                             the team owes and to whom, that is the worst field to drop silently.
                             ⚠ `paidByPlayerId` rides along in the spread but is inert: the commitment
                             branch neither renders it nor sends it. Left alone rather than cleared,
                             so that stays true by the save path rather than by this handler. */
                          const carried = { ...form, dueDate: form.paidDate, paidDate: '' };
                          const carriedPayee = formPayee;
                          const carriedTags = formTags;
                          resetForm();
                          setFormKind('expense');
                          setFormTiming('payable');
                          setForm(carried);
                          setFormPayee(carriedPayee);
                          setFormTags(carriedTags);
                          /* The baseline stays BLANK: everything here is work the coach typed, so
                             walking away from it SHOULD ask before discarding. */
                          setFormOpen(true);
                        }}
                      >
                        Add it as a commitment instead
                      </button>
                      {' '}— it joins your payment schedule, and nothing moves until you mark it paid.
                    </p>
                  )}
                </div>
              )}

              {/* ── Money-in only: when it landed, and (on a refund) who sent it ─────────────
                  ⚠ THE DATE IS THE FACT, not the day it was typed. A refund is dated when it
                  ARRIVED — $600 of permits across July and August with $325 back in September
                  reads 300 / 300 / (325) — because back-dating the credit into July would rewrite
                  a month already reported on and reconciled (money-back plan §4.3). */}
              {isMoneyInForm && (
                <div className={styles.field}>
                  <label className={styles.label}>Date received *</label>
                  <input
                    className={styles.input}
                    type="date"
                    value={form.receivedDate}
                    onChange={e => setForm(f => ({ ...f, receivedDate: e.target.value }))}
                  />
                </div>
              )}
              {entryKind === 'refund' && (
                <div className={styles.field}>
                  <label className={styles.label}>Who paid it back</label>
                  <select
                    className={styles.select}
                    value={form.receivedFrom}
                    onChange={e => setForm(f => ({ ...f, receivedFrom: e.target.value }))}
                  >
                    <option value="">Not saying</option>
                    {MONEY_IN_SOURCES.map(s => (
                      <option key={s} value={s}>{MONEY_IN_SOURCE_LABEL[s]}</option>
                    ))}
                  </select>
                  {/* ⚠ A LABEL, NEVER A BEHAVIOUR (money-back plan §4.1). In particular "A family"
                      does not create, settle or touch any dues credit — that is what the cost
                      form's "Paid by" does, and it is the opposite event. */}
                  <p className={styles.formHint}>
                    Just a note on the record. It changes nothing about anyone&apos;s dues.
                  </p>
                </div>
              )}

              {/* ── Commitment-only: when it is due ─────────────────────────────────────────
                  ⚠⚠ THIS FIELD DID NOT EXIST, AND THE FORM CLAIMED IT DID. The split group used to
                  say "leave this closed to record one amount due on one date" while offering no
                  such date — so the simple case, which is most of them, saved with no due date at
                  all: status "No schedule", absent from the payment schedule and the Overview's
                  next-30 panel, and no Mark paid button anywhere. The coach had recorded what the
                  team owed and would never be reminded of it again.

                  ⚠ It is stored as the deposit half — see `commitmentSchedule` in the save, and
                  the bulk importer, which has always written this row that way. */}
              {isPayableForm && !formSplit && (
                <div className={styles.field}>
                  <label className={styles.label}>Due date *</label>
                  <input
                    className={styles.input}
                    type="date"
                    value={form.dueDate}
                    onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  />
                  <p className={styles.formHint}>
                    This is what puts it on your payment schedule and the Overview’s next 30 days.
                  </p>
                </div>
              )}

              {/* ── Commitment-only: the deposit / balance split ────────────────────────────
                  ⚠ CONTROLLED, NOT A `CoachFormDisclosure` (Money split P1, 2026-08-16). It used
                  to be one, and could not be: opening the split has to REMOVE the single due date
                  above, and a disclosure owning its own state cannot reach a field outside it. The
                  toggle keeps the disclosure's own look and copy so nothing reads as a new control. */}
              {isPayableForm && (
                <div className={styles.formGridFull}>
                  {!formSplit ? (
                    <button type="button" className={styles.discToggle} onClick={() => setFormSplit(true)}>
                      <span className={styles.discToggleIcon}><Plus size={14} aria-hidden /></span>
                      Split into a deposit and a balance
                    </button>
                  ) : (
                    <section className={styles.formSection}>
                      <div className={styles.discHead}>
                        <h4 className={styles.formSectionTitle}>Payment schedule</h4>
                        {/* ⚠ CLOSING IT CLEARS THE BALANCE on save, so the button says so rather
                            than reading as a cosmetic collapse. A half that has already been PAID
                            is refused by the server — that money left, and no form un-spends it. */}
                        <button type="button" className={styles.discHide} onClick={() => setFormSplit(false)}>
                          Use one date instead
                        </button>
                      </div>
                      <p className={styles.discNote}>
                        Big-ticket costs are often billed as a deposit now and a balance later —
                        tournament entries, dome blocks, uniform orders. Each half is due on its own
                        date and is marked paid on its own.
                      </p>
                      {/* ⚖ A PAID HALF IS EDITABLE TOO (owner ruling 2026-08-16). Both halves used to
                          render read-only once settled; now each is an ordinary pair of fields and
                          the server moves that half's own entry on the books to match. The "Paid"
                          state is still SAID — it is what tells a coach the edit will reach the
                          books — it just no longer takes the fields away. */}
                      <div className={styles.formSectionGrid}>
                        <div className={styles.field}>
                          <label className={styles.label}>Deposit Amount</label>
                          <input className={styles.input} type="number" min={0} step="0.01" value={form.depositAmount} onChange={e => setForm(f => ({ ...f, depositAmount: e.target.value }))} placeholder="0.00" />
                          {editing?.depositPaidAt && (
                            <p className={styles.formHint}>Paid {fmtDate(editing.depositPaidAt)} — a change moves the books.</p>
                          )}
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>Deposit Due Date</label>
                          <input className={styles.input} type="date" value={form.depositDueDate} onChange={e => setForm(f => ({ ...f, depositDueDate: e.target.value }))} />
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>Balance Amount</label>
                          <input className={styles.input} type="number" min={0} step="0.01" value={form.balanceAmount} onChange={e => setForm(f => ({ ...f, balanceAmount: e.target.value }))} placeholder="0.00" />
                          {editing?.balancePaidAt && (
                            <p className={styles.formHint}>Paid {fmtDate(editing.balancePaidAt)} — a change moves the books.</p>
                          )}
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>Balance Due Date</label>
                          <input className={styles.input} type="date" value={form.balanceDueDate} onChange={e => setForm(f => ({ ...f, balanceDueDate: e.target.value }))} />
                        </div>
                      </div>
                    </section>
                  )}
                </div>
              )}

              {/* ── An arrival's note, in the open ───────────────────────────────────────────
                  ⚠ NOT BEHIND THE DETAILS DISCLOSURE, because on this branch it would be a
                  disclosure hiding exactly one field. Payment method, payee and money tags are
                  deliberately absent: they describe money going OUT to somebody, and inventing
                  money-in equivalents in this release would be three new fields nothing reads. */}
              {isMoneyInForm && (
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>Notes</label>
                  <textarea
                    className={styles.textarea}
                    rows={2}
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              )}

              {/* ── Shared bookkeeping detail, folded away on both money-out kinds (Q1) ────── */}
              {!isMoneyInForm && (
              <div className={styles.formGridFull}>
                {/* ⚠⚠ THE LABEL LISTS WHAT IS INSIDE, and that is half the ruling that folded
                    `Paid by` in here. "Add details (optional)" promised nothing worth opening for,
                    which is survivable for a payment method and not for the field that decides
                    whether a family is owed money. The other half is the consequence line above the
                    buttons, which states the credit whether this is open or shut. */}
                <CoachFormDisclosure
                  label={isPayableForm ? 'Add details (optional)' : 'More — paid by, payee, tags, notes'}
                  title="More"
                  meta={detailsSet ? 'Set' : undefined}
                  defaultOpen={detailsSet}
                >
                  {/* ── Who actually paid ──────────────────────────────────────────────────
                      ⚠ FIRST INSIDE THE FOLD, above the bookkeeping fields. It is the only one here
                      that changes what the record MEANS rather than describing it, so a coach who
                      opens this for any reason meets it before the payment method. */}
                  {renderPaidBy()}
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
              )}

              {/* ── What saving will DO — one line, every state (ruling 2026-08-16 §3) ────────
                  ⚠ LAST IN THE GRID, DIRECTLY ABOVE THE BUTTONS, and that placement is the ruling
                  rather than a layout preference: it is the sentence a coach reads in the instant
                  before they commit, and it is what makes folding `Paid by` away safe. */}
              {consequenceLine()}
            </div>

            {saveError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{saveError}</p>}

            {/* ── Delete, in front of a confirmation that states the money consequence ────────
                ⚠ THE DIALOG NAMES DOLLARS, never a bare "Are you sure?". Deleting something
                already paid reverses what it posted, and a coach must be told the size of that
                before they can consent to it. `ledgerReversalPreview` is the SAME function the
                server reverses with, so the sentence and the outcome cannot drift apart. */}
            {/* ⚠ MONEY IN REVERSES THE OTHER WAY, so it gets its own sentence rather than the
                expense one with a word flipped: deleting an arrival LOWERS cash on hand. And
                nothing here can change what a family is owed, on either kind — see
                `moneyInReversalPreview`, which deliberately has no `owesFamily`. */}
            {confirmDelete && editingMoneyIn && moneyInDeletePreview && (
              <div className={styles.dangerConfirm} role="alertdialog" aria-label="Confirm delete">
                <p className={styles.dangerConfirmTitle}>
                  Delete this {entryKind === 'income' ? 'income entry' : 'money-back entry'}?
                </p>
                <p className={styles.dangerConfirmBody}>
                  {moneyInDeletePreview.posted ? (
                    <>
                      <strong>{fmt(moneyInDeletePreview.amount)}</strong> is on the team’s books as money
                      that came in. Deleting it takes that back off, so cash on hand goes{' '}
                      <strong>down</strong> by {fmt(moneyInDeletePreview.amount)}.
                      {entryKind === 'refund' && ' The item it was reducing goes back up by the same amount.'}
                    </>
                  ) : (
                    'Nothing was posted for this, so no money moves.'
                  )}
                </p>
                <p className={styles.dangerConfirmBody}>Nobody’s dues change either way.</p>
                <div className={styles.dangerConfirmActions}>
                  <button className={styles.btnGhost} disabled={deleting} onClick={() => setConfirmDelete(false)}>Keep it</button>
                  <button className={styles.btnDanger} disabled={deleting} onClick={deleteRecord}>
                    {deleting ? 'Deleting…' : moneyInDeletePreview.posted ? 'Delete and reverse' : 'Delete'}
                  </button>
                </div>
              </div>
            )}

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
              {/* ⚠ NO DELETE ON A SETTLE. This form is standing over the commitment to record a
                  payment against it; offering to destroy the record from inside that act is a
                  different intent entirely, and it is one tap away on the commitment's own row. */}
              {formMode === 'edit' && canWriteMoney && !confirmDelete && (
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
                {/* ⚠ ONE WORD FOR ADD AND EDIT (owner ruling 2026-08-16). It used to name the
                    outcome — "Add Expense", "Add Money Back", "Save changes" — which was right while
                    the button was the only thing that knew what the form had become. The consequence
                    line above it says that now, in dollars, so the button can go back to being a
                    button.
                    ⚠ A SETTLE KEEPS "Mark Paid", and the ruling says so explicitly: there the
                    outcome IS the point, and it is the one state where naming it beats a generic
                    word. */}
                {saving ? 'Saving…' : formMode === 'settle' ? 'Mark Paid' : 'Save'}
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
