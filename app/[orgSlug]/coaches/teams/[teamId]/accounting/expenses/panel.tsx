'use client';
import { useState, useEffect, useCallback, useMemo, useRef, use, Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Receipt, Plus, CheckCircle2, AlertTriangle, Tag, Settings2, Upload, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
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
import { useDiscardGuard, touched, snapshotEqual } from '@/components/coaches/useDiscardGuard';
import CoachBackLink from '@/components/coaches/CoachBackLink';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import RowEditButton from '@/components/coaches/RowEditButton';
import { ledgerReversalPreview } from '@/lib/expense-ledger';
import {
  installmentStatus, installmentStatuses, installmentLabel, PAYABLE_STATUS_LABEL, PAYABLE_STATUS_ORDER,
  PAYABLE_STATUS_DEFAULT,
  type CommitmentStanding, type AppliedPayment, type PayableRowStatus,
} from '@/lib/payable-standing';
import { whyPlanStrandsPaidMoney } from '@/lib/payable-scope-edit';
import { parseInstallmentPlan } from '@/lib/expense-ledger';
import InstallmentPlanEditor, { BLANK_PLAN_ROW, type PlanRow } from '../InstallmentPlanEditor';
import InstallmentScopeSheet from '../InstallmentScopeSheet';
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
  REGISTER_FILTERS, REGISTER_KIND_LABEL, balanceIsMeaningful, applyDateRange,
  type RegisterBookRow, type RegisterKind,
} from '@/lib/coach-register';
import MultiSelectDropdown from '@/components/coaches/MultiSelectDropdown';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import DateRangeDropdown from '@/components/coaches/DateRangeDropdown';
import {
  AROUND_WINDOW_DAYS, computeSeasonBounds, isDateRangePresetId, resolveDateRangePreset,
  type DateRangePresetId, type DateRangeSelection,
} from '@/lib/coach-date-range';
import styles from '../../../../coaches.module.css';
import type {
  RepTeamExpense, RepTeamTag, BudgetCategoryWithItems, RepBudgetPlan, RepRosterPlayer,
  RepTeamMoneyIn,
} from '@/lib/types';
import { isFundingKind } from '@/lib/coach-budget-totals';
import { formatMonthLong, monthKeyOf } from '@/lib/coach-budget-months';
import { toggleKey } from '@/lib/toggle-key';
import { useMoneyRevision, useBumpMoneyRevision, useSharedMoneyRead } from '@/lib/coach-money-refresh';
import {
  formatStoredDate, tournamentToday, addCalendarDays, daysBetweenDateStrings,
} from '@/lib/timezone';
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

/* ⚠ The Date pill's memory is keyed by TEAM ONLY, no `programYearId` — deliberate, unlike the
   sibling money panels' per-season prefs: a date-viewing habit is not season-shaped data, and a
   preset re-resolves against whatever season is live. */
const datePresetStorageKey = (teamId: string) => `flhq-coach-money-date-preset:${teamId}`;

/** The remembered preset for this team, or the default. Storage can be absent, refused, or hold
 *  a stale id from a future rename — every failure lands on 'around'. Safe to call from a state
 *  initializer only because this panel never server-renders; the `window` guard keeps it honest
 *  if that ever changes. */
function readSavedDatePreset(teamId: string): DateRangeSelection {
  if (typeof window === 'undefined') return 'around';
  try {
    const saved = window.localStorage.getItem(datePresetStorageKey(teamId));
    if (saved && isDateRangePresetId(saved)) return saved;
  } catch { /* private mode / storage off */ }
  return 'around';
}

/* ⛖ `payableStatus()` IS GONE (Payables Rebuild P3). It reduced a whole commitment to ONE word
   for the Commitments row’s Status cell, and the list it served no longer exists: rows are dated
   PIECES now, each carrying its own state, and a bill’s header states what is still owed rather
   than a single adjective for the lot. The four-word vocabulary it approximated is
   `installmentStatus` / `installmentStatuses` in lib/payable-standing.ts, which is also what the
   Status dropdown filters on — one rule, not a screen-local second opinion. */

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
 * ⚖ AND THE SUB-VIEW CONCEPT IS GONE ENTIRELY (Payables Rebuild P3, /simplify altitude lens).
 * `ExpenseTab`, `FACE_TABS`, the `tab` state and `goToTab` survived the rebuild for one release
 * as a union each face mapped to exactly ONE member of — so `tab` could not diverge from `face`,
 * and the file was testing the same boolean in two vocabularies (`!onPayables` beside
 * `onPayables`). That is a dead abstraction that LOOKS load-bearing, which is the worst kind. The
 * face is the screen; `groupBy` is how the one Payables list is arranged; there is no third thing.
 */

/**
 * HOW THE ONE LIST IS ARRANGED — not a filter, and the control says so (plan §7).
 *
 * ⚠ THE SAME ROWS UNDER BOTH. Nothing is added or hidden between the two arrangements; that is the
 * whole claim the control makes, and §64 Part C walks exactly it. `Commitment` gathers a bill's
 * installments under the bill; `Due date` runs them all in one dated sequence under Overdue and
 * month headings.
 */
type PayGroupBy = 'commitment' | 'due';

const PAY_GROUP_BY_LABEL: Record<PayGroupBy, string> = {
  commitment: 'Commitment',
  due: 'Due date',
};

/** The retired sub-view names, as arrangements. ⚠ `?tab=schedule` is a LIVE URL CONTRACT — the
 *  Money hub's "See full schedule", Budget vs. Actual's Scheduled drill-in, the legacy-address
 *  mapper and the UAT smoke spec all address it. It must land somewhere honest, and the dated
 *  arrangement is what it always meant. */
const TAB_AS_GROUP_BY: Record<string, PayGroupBy> = {
  schedule: 'due',
  commitments: 'commitment',
  payables: 'commitment',
};

/** ⚠⚠ EVERY REGISTER ROW IS EXACTLY ONE OF THESE (owner call, 2026-08-19 — folds the old "Overdue"
 *  chip and "Include scheduled" toggle into one Status dropdown). Actual = settled (`!scheduled`).
 *  Overdue = unsettled with a due date in the past (`scheduled && overdueDays != null`). Scheduled
 *  = unsettled with a due date still ahead, or no due date at all (`scheduled && overdueDays ==
 *  null`). Derived from a row's own fields, never stored — same discipline `overdueDays` itself
 *  already follows. */
type RegisterStatus = 'actual' | 'overdue' | 'scheduled';
const REGISTER_STATUS_ORDER: RegisterStatus[] = ['actual', 'overdue', 'scheduled'];
const REGISTER_STATUS_LABEL: Record<RegisterStatus, string> = {
  actual: 'Actual', overdue: 'Overdue', scheduled: 'Scheduled',
};
function registerStatusOf(r: { scheduled: boolean; overdueDays: number | null }): RegisterStatus {
  return !r.scheduled ? 'actual' : r.overdueDays != null ? 'overdue' : 'scheduled';
}

/* ⚖ `MarkPaidAction` IS GONE (Payables Rebuild P2). Money-out turns paid one way now: a payment
   recorded against the commitment, which can say "part of it" and can be undone — the two things
   the three named actions structurally could not.

   ⚖ AND `ScheduleFilter` (Unpaid | Paid | All) IS GONE WITH P3. Three pills could not express
   "partly paid" at all — the middle state this whole rebuild exists to make representable — so they
   are replaced by the four-option Status dropdown that Transactions already teaches. */

/** A commitment on the schedule feed: exactly what the payables API returns, plus which lane it
 *  came from. Reuses `PayableItem` so the hub panel and this screen can't drift apart. */
type ScheduleRow = PayableItem & { source: 'team' | 'org' };

/**
 * ONE ROW OF THE PAYABLES LIST — a dated piece of something the team owes.
 *
 * ⚠ `owing` IS WHAT IS STILL OWED, not the piece's face value (owner ruling 2026-08-20: *"budget is
 * the overall plan, actual is what was already paid, scheduled is what we are currently obligated to
 * pay"*). A $450 piece with $250 against it reads $200 and says so underneath. A SETTLED piece keeps
 * its face value, because nothing is owed and the face figure is the only honest one left to show —
 * the same rule the payment schedule has always applied.
 */
interface PayPiece {
  key: string;
  dueDate: string;
  /** "Installment 3 of 6", or "One payment" for a lone piece — never "installment 1 of 1". */
  label: string;
  /** 1-based, for the shared  the exports and the register also name pieces by. */
  installmentNumber: number;
  owing: number;
  /** The piece's face amount, and what has landed on it — for the "$250.00 of $450.00 paid" line. */
  faceAmount: number;
  applied: number;
  settled: boolean;
  partlyPaid: boolean;
  daysUntilDue: number;
  /** ⚠ EVERY word true of it — what Status filters and counts on (`installmentStatuses`). */
  statuses: readonly PayableRowStatus[];
  /** The ONE word its badge shows; the screen writes "· partly paid" beside it where both apply. */
  badge: PayableRowStatus;
  installmentId: string | null;
}

/**
 * ONE BILL — a commitment and its dated pieces, or one club allocation and its instalments.
 *
 * ⚠⚠ EVERY BILL IS A FOLDING HEADER, INCLUDING A BILL WITH ONE PAYMENT IN IT (owner ruling
 * 2026-08-20). An earlier pass gave a one-piece bill no chevron on the grounds that it had nothing
 * to hide. That rule cannot survive a real list: a two-installment bill with one left to pay looks
 * exactly like the single case, and any rule keyed on what is LEFT changes a bill's shape as it is
 * paid down — chevrons vanishing from rows a coach has just paid. The cost is knowingly paid: a
 * one-piece bill states itself twice, once as a header and once as its only row.
 */
interface PayBill {
  key: string;
  /** A club allocation is not the team's record to edit — its door is the Club tab, not the drawer. */
  kind: 'team' | 'org';
  description: string;
  category: string | null;
  itemName: string | null;
  total: number;
  paid: number;
  owing: number;
  over: number;
  /** Every piece, before Status narrows — for the header's own figures. */
  pieceCount: number;
  unpaidCount: number;
  /** The pieces the filters admit. A bill with none of these drops off the list entirely. */
  pieces: PayPiece[];
  /** The earliest unsettled due date — what the header shows and what the list sorts on. */
  nextDue: string | null;
  nextBadge: PayableRowStatus | null;
  nextDays: number | null;
  nextPartly: boolean;
  /** Aimed at by the header's Record a payment when the bill is folded. */
  nextInstallmentId: string | null;
  nextOwing: number;
  expense?: RepTeamExpense;
  standing?: CommitmentStanding;
}

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
  /* ⚖ `dueDate` AND THE FOUR DEPOSIT/BALANCE FIELDS ARE GONE (Payables Rebuild P4). A commitment's
     schedule is 1..n dated pieces now and lives in `formPlan`, edited by `InstallmentPlanEditor` —
     the same numbered list Player Dues has used since 2026-08-13. The two-piece vocabulary was
     never a data shape; it was the shape of the editor, which is why the plan was capped at two
     until this phase could replace it. A one-payment commitment is simply a one-row plan, so the
     "one due date" field it used to need has nothing left to do. */
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

/** Which record the Add door opens on. Payables holds exactly one kind, which is the point of it.
 *  ⚠ The register opens on a paid EXPENSE, not on income: the book holds both directions, and the
 *  form's two pills are one click apart, so the door opens on the far commoner of the two. */
function kindForFace(onPayables: boolean): { kind: EntryKind; timing: CostTiming } {
  return onPayables
    ? { kind: 'expense', timing: 'payable' }
    : { kind: 'expense', timing: 'paid' };
}

/**
 * The commitment's pieces in INSTALLMENT-NUMBER order — the order the plan is written in.
 *
 * ⚠ NOT the standing's own order, which is by DUE DATE because that is the order money applies in.
 * A coach who moves piece 3 to a date before piece 2 has re-ordered the schedule, not renumbered
 * it, and the positional writer would renumber the whole series if handed the date order.
 */
function piecesByNumber(standing: CommitmentStanding | undefined) {
  return [...(standing?.installments ?? [])].sort((a, b) => a.installmentNumber - b.installmentNumber);
}

/** A saved commitment's schedule, as the plan editor's rows. */
function planFromStanding(standing: CommitmentStanding | undefined): PlanRow[] {
  const pieces = piecesByNumber(standing);
  if (pieces.length === 0) return [{ ...BLANK_PLAN_ROW }];
  // ⚠ `auto: false` on every saved row — the badge says "this came from the repeat rule just now",
  // and a figure that has been stored is a figure somebody accepted, whatever produced it.
  // ⚠ EACH ROW NAMES THE STORED PIECE IT IS. Without that the save matches rows by position
  // and removing a non-trailing one re-points a recorded payment at the wrong piece — see PlanRow.id.
  return pieces.map(p => ({ id: p.id, date: p.dueDate, amount: String(p.amount), auto: false }));
}

/**
 * Turn a saved record back into form strings, for Edit.
 *
 * ⚠ THE SCHEDULE AND THE PAID DATE COME FROM THE STANDING — the installments and payments are the
 * record now; the deposit/balance columns stopped being written when the bridge died (P2). The
 * schedule itself is no longer part of this object: it is 1..n rows and lives in `formPlan`, built
 * by `planFromStanding` beside this.
 */
function formFromExpense(e: RepTeamExpense, standing: CommitmentStanding | undefined): typeof BLANK_RECORD {
  /* A single payment's own day, for the plain cost's "Date paid" — already a bare `YYYY-MM-DD`
     (`paid_date` is a `date` column), so no org-noon conversion is left to get wrong. A record
     paid in several payments shows no single date; each payment carries its own. */
  const singlePayment = (standing?.payments.length ?? 0) === 1 ? standing!.payments[0] : null;
  return {
    ...BLANK_RECORD,
    description: e.description,
    category: e.category ?? '',
    budgetCategoryId: e.budgetCategoryId ?? '',
    budgetItemId: e.budgetItemId ?? '',
    amount: String(standing?.total ?? e.amount),
    notes: e.notes ?? '',
    paymentMethod: e.paymentMethod ?? '',
    paidByPlayerId: e.paidByPlayerId ?? '',
    paidDate: e.expenseType === 'tournament_payable' ? '' : (singlePayment?.paidDate ?? ''),
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
  /** ⚠ Which face is this, said ONCE and said EARLY — every branch below reads this rather than
   *  re-testing, and the sticky-toolbar effect near the top needs it too. */
  const onPayables = face === 'payables';

  const [expenses, setExpenses] = useState<RepTeamExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  /* ── The one Payables list (Rebuild P3) ────────────────────────────────────────────────────
     ⚠ `expandedPayable` IS GONE. It held ONE open row at a time, because the deposit/balance pair
     it revealed was tall enough that a list with every row open was the card list it replaced. The
     detail it showed is the DRAWER now (`drawerFor`), so what folds here is the opposite thing: a
     bill's own installments, several at a time, as a way of clearing what you have dealt with. */
  const [groupBy, setGroupBy] = useState<PayGroupBy>('commitment');
  /* ⚠⚠ SEEDED WITH TWO OF FOUR, NEVER EMPTY — `MultiSelectDropdown`'s own rule is "empty means all",
     which here would open the screen on a season of settled history rather than on what is owed.
     `PAYABLE_STATUS_DEFAULT` is the shared call (same reasoning as the register's Status default),
     and it makes the control read "2 selected" rather than "All" over a list that is not all. */
  const [payStatus, setPayStatus] = useState<Set<PayableRowStatus>>(
    () => new Set(PAYABLE_STATUS_DEFAULT));
  const [payItems, setPayItems] = useState<Set<string>>(new Set());
  /**
   * ⚠⚠ WHICH GROUPS ARE FLIPPED OUT OF THEIR ARRANGEMENT'S DEFAULT — not "which are shut".
   *
   * **Bills start SHUT; periods start OPEN** (owner ruling 2026-08-20, revising this same day's
   * earlier call). The first version defaulted everything open, on the argument that "a list that
   * opens folded hides the very numbers it exists to show". ⚠ That argument died with the header
   * rebuild and the note is kept so it is not re-made: a bill's header now carries its next due
   * date, what is still owing and how late it is, so folding it hides NOTHING — the coach sees one
   * clean line per bill and opens the one they came for. A PERIOD band carries only a month name
   * and a total, so folding it by default hides everything, and it would hide *which bills are
   * late* behind an Overdue heading — the most urgent thing on the screen.
   *
   * ⚠ STORED AS A FLIP, NOT AS A STATE, so a bill that arrives after a write (or after a filter
   * change) takes the arrangement's default instead of inheriting whatever the last set happened to
   * hold. No effect has to reconcile it.
   *
   * ⚠ FOR THE VISIT, NOT FOREVER. Nothing writes this to storage — a remembered fold is how a coach
   * loses a bill and blames the product. Bill keys and period keys cannot collide, so a flip made
   * in one arrangement is simply inert in the other.
   */
  const [flippedFolds, setFlippedFolds] = useState<Set<string>>(new Set());
  /** Which bill's drawer is open — the whole commitment in one panel. Every row opens it, settled
   *  or not, which is defect 3 closing. */
  const [drawerFor, setDrawerFor] = useState<string | null>(null);

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
    book: RegisterBookRow[]; todayIndex: number;
    cashOnHand: number; projectedBalance: number | null; orgLinked: boolean;
  } | null>(null);
  /* ⚠ MULTI-SELECT, EMPTY = ALL (owner call — "fit like QuickBooks/Excel" needed the seven pills
     to fold into one dropdown). `RegisterKind` only — 'all' isn't a kind, it's what an empty set
     already means, so there's no separate state to fall out of sync with it. */
  const [selectedKinds, setSelectedKinds] = useState<Set<RegisterKind>>(new Set());
  /** Narrowing by budget word(s), multi-select, empty = every item. Shares the balance rule with
   *  the type filter — any narrowing at all takes the Balance column away. */
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  /* ⚠⚠ ONE STATUS DROPDOWN, NOT TWO SEPARATE CONTROLS (owner call, 2026-08-19 — folded "Overdue"
     and "Include scheduled" together, matching the multi-select shape of Show/Item). Every row is
     exactly one of the three: Actual (settled), Overdue (unsettled, due date in the past),
     Scheduled (unsettled, due date still ahead). ⚠⚠ DEFAULTS TO Actual + Overdue, NOT EMPTY —
     `MultiSelectDropdown`'s own rule is "empty means all," which would silently turn Scheduled
     back on by default (a call this project already made deliberately, twice now: the date range
     keeps the everyday view a manageable size, so defaulting every unpaid row into view on top of
     that read as too much at once). See the JSX for how the dropdown reads with a non-empty
     default. */
  const [selectedStatus, setSelectedStatus] = useState<Set<RegisterStatus>>(new Set(['actual', 'overdue']));
  /* ⚠⚠ THE RANGE IS A PRESET FIRST AND DATES SECOND (the Date pill — owner-approved mockup,
     2026-08-19, replacing the two bare date pickers). `datePreset` names the window; the actual
     from/to pair is DERIVED from it (`dateRange` below), so "Last 30 days" re-anchors to today
     the way its name promises and "Whole season" widens itself as rows land — while a CUSTOM
     range stays exactly the pinned dates a coach typed (`customRange`, touched only by the
     panel's own fields). The 'around' default keeps the old behaviour to the day: 30 back /
     30 ahead, the forward half being what shows next month's scheduled commitments when the
     Scheduled status is on. Overdue rows ignore the window regardless (the memo's own rule) —
     it narrows routine history, never an open obligation.
     ⚠ THE PRESET IS REMEMBERED PER TEAM, THE DATES NEVER ARE (open call #2, decided with the
     mockup approval): a remembered preset re-anchors to today and cannot go stale; a remembered
     pinned window quietly emptying a later visit would read as "the book is broken". */
  /* The window's anchor day, FROZEN for the life of the mount — restoring the guarantee the old
     two-picker comment made ("computed once on mount — never recomputed... or the window would
     silently drift under a coach's feet"). Without it, the memo below re-sampled the clock every
     time the book reloaded, and a midnight-adjacent write on ANY money tab (they share one
     refresh signal) shifted this screen's window a day with no touch of the Date pill (/review).
     A preset therefore re-anchors per VISIT, exactly as described when the design was approved. */
  const [rangeToday] = useState(() => tournamentToday());
  /* ⚠ The saved preset is read in the INITIALIZER, not an effect — this panel never
     server-renders (`dynamic(..., { ssr: false })` in the hub page), so there is no hydration
     pass to mismatch, and seeding synchronously kills the one-frame "Around today" flash a saved
     preset painted before the restore effect could run (/review). */
  const [datePreset, setDatePreset] = useState<DateRangeSelection>(() => readSavedDatePreset(teamId));
  const [customRange, setCustomRange] = useState(() => ({
    from: addCalendarDays(rangeToday, -AROUND_WINDOW_DAYS),
    to: addCalendarDays(rangeToday, AROUND_WINDOW_DAYS),
  }));
  /* Re-seed if `teamId` ever changes WITHOUT a remount. No navigation does that today (the
     sidebar's team switcher routes through the team root, which remounts this panel) — but these
     panels carry no `key={teamId}`, the fresh-instance pattern the development pages use, so this
     effect is the fence: team B must never inherit team A's selection, least of all a 'custom'
     one that storage never holds (/review). On mount it re-sets the seeded value — a no-op. */
  useEffect(() => { setDatePreset(readSavedDatePreset(teamId)); }, [teamId]);
  /* ONE memo owns all the derived range arithmetic — the season's bounds and the effective
     window — recomputed only when the book, the selection, or the custom dates change (this
     panel re-renders per keystroke; the big filter memo below exists for the same reason).
     Bounds come from `computeSeasonBounds` (the book's own extent, so 'Whole season' can never
     crop a real row and widens itself as rows land). */
  const dateRange = useMemo(() => {
    const seasonBounds = computeSeasonBounds(book?.book ?? [], rangeToday);
    const win = datePreset === 'custom'
      ? customRange
      : resolveDateRangePreset(datePreset, rangeToday, seasonBounds);
    return { ...win, today: rangeToday, seasonBounds };
  }, [book, datePreset, customRange, rangeToday]);
  const onDateRangeChange = (
    next: { selection: DateRangePresetId } | { selection: 'custom'; from: string; to: string },
  ) => {
    setDatePreset(next.selection);
    if (next.selection === 'custom') {
      setCustomRange({ from: next.from, to: next.to });
    } else {
      try { window.localStorage.setItem(datePresetStorageKey(teamId), next.selection); } catch { /* fine */ }
    }
  };
  /* ⚠⚠ THE REAL BASE — found 2026-08-19 after the sticky column headers shipped broken AND the
     team masthead was reported overlapping this panel's own sticky rows. Every offset here used
     to start from `var(--coach-top-strip, 48px)`, a variable that belongs to a DIFFERENT shell
     (CoachPortalShell, the tournament-record route tree) and is never defined on a team page — it
     was silently falling back to a guessed 48px on every scroll. This shell (CoachesChrome) is
     `--coach-topstrip-top` (the fixed top bar) stacked under `--coach-header-h` (the team masthead,
     already measured live by CoachTeamHeader itself and published onto this panel's `<main>`
     ancestor — no new measurement needed, just the right variable name). Both default to 0px so a
     page with no masthead (or before it mounts) doesn't lose the offset entirely. */
  const registerStickyBase = 'calc(var(--coach-topstrip-top, 0px) + var(--coach-header-h, 0px))';
  /* ⚠⚠ ONE STICKY ROW, NOT THREE (reversed 2026-08-19, reading-order ruling follow-up). This used
     to stack the Money tab row, this toolbar, and a second controls row as three independent
     sticky layers, each measured and added to the next — three seams, three places for the
     offset math to drift, which is exactly what kept happening. The tab row no longer pins on
     any tab (a shared nav bar behaving differently on one tab was a bigger inconsistency than
     this page earning its own toolbar), and the former second row's filters merged into this one
     — see the toolbar's own JSX below. What's left is ONE measured height for the column headers
     to dock under, not three summed together. */
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [toolbarH, setToolbarH] = useState(96);
  useEffect(() => {
    if (onPayables) return;
    const el = toolbarRef.current;
    if (!el) return;
    /* ⚠ THE BREATHING ROOM BELOW THE TOOLBAR IS PADDING, NOT MARGIN, WHEN PINNED — see
       `.panelToolbar.panelToolbarSticky` in the CSS for why (margin is never painted, so an
       offset that accounted for it as extra space left a see-through gap a scrolled row showed
       through). Padding is part of the border box, so a plain measurement already includes it —
       no manual math needed here. */
    const measure = () => setToolbarH(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onPayables]);

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
   * A COMMITMENT'S SCHEDULE, 1..n dated rows (Payables Rebuild P4) — what the two-piece
   * deposit/balance editor became.
   *
   * ⚠ ITS OWN STATE, NOT A FIELD ON `form`, because it is an array and `touched()` compares flat.
   * The baseline beside it is what the discard guard measures against, through `snapshotEqual` —
   * the shared idiom for exactly this, so a structured form guards the same way as every other.
   */
  const [formPlan, setFormPlan] = useState<PlanRow[]>([{ ...BLANK_PLAN_ROW }]);
  const [formPlanOpenedWith, setFormPlanOpenedWith] = useState<PlanRow[]>([{ ...BLANK_PLAN_ROW }]);
  /**
   * Which scheduled piece the coach is changing or removing, and which of the two they asked for.
   *
   * ⚠ THE SCOPED DOOR IS THE DRAWER'S, NOT THE FORM'S, and the split is deliberate. The form states
   * the WHOLE plan — every row visible — so there is no question about reach and no scope to ask
   * for. This one changes ONE row and therefore has to ask how far that goes (S1–S7).
   */
  const [scopeEdit, setScopeEdit] = useState<
    { expense: RepTeamExpense; installmentId: string; mode: 'edit' | 'remove' } | null>(null);
  /**
   * The Record-a-payment door (Payables Rebuild P2) — its own small modal, standing over a
   * commitment. It replaced the money form's settle mode: a payment is date + amount + method +
   * note + (optionally) which installment, and dragging the record's whole form along asked a
   * coach to re-confirm five fields that are not part of the question.
   *
   * ⚠ A PAYMENT IS ITS OWN RECORD, POSTed to the payments sub-route — never a PATCH stamping the
   * commitment. The register renders one row per payment, and the commitment's standing re-reads.
   */
  const [paying, setPaying] = useState<{
    expense: RepTeamExpense;
    /** The coach's override — where the pour STARTS (R3). Null records against the commitment. */
    installmentId: string | null;
    amount: string;
    paidDate: string;
    method: string;
    note: string;
  } | null>(null);
  const [payingBusy, setPayingBusy] = useState(false);
  const [payingError, setPayingError] = useState('');
  /**
   * Which payment is waiting on a confirmation before it is undone.
   *
   * ⚖ WAS A TWO-TAP ARM, AND THE ARM WAS THE PROBLEM (owner, 2026-08-20). The first tap used to
   * re-label the button to "Undo $200.00?" and the second executed — which reads as a LABEL, not as
   * a question, so nothing on screen told a coach that their previous click had armed anything.
   * A control that changes its own text is not a confirmation; it is a control that has silently
   * changed meaning. Undo reverses real money, so it gets the same named-consequence confirmation
   * the Delete flow already uses, and for the same reason: the coach reads the figure before the
   * money moves, not after.
   */
  const [undoAsk, setUndoAsk] = useState<string | null>(null);
  const [undoBusy, setUndoBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  /* ⚠⚠ THE SAME BELT `savingRef` WEARS, for the same reason (`/review`, concurrency lens,
     2026-08-21). `undoBusy` is STATE: a second click lands before React commits the disabled
     attribute, and both DELETEs go. The server correctly refuses the second (409), but that
     error is raised on this screen's PAGE-WIDE channel — which replaces the whole list — so a
     double-tap on a SUCCESSFUL undo blanked the payables list behind "already been undone".
     A latch, not a nicer message, is the fix: the second call must never leave the browser. */
  const undoRef = useRef(false);
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
  /* Where each commitment stands — its plan, its payments and what that adds up to (Payables
     Rebuild P1). ⚠ THE EXPORT IS ITS ONLY READER FOR NOW: this screen is rebuilt in P3 and nothing
     rendered here reads it, but a spreadsheet that disagreed with every other money surface about
     what a part-paid bill has paid would be the one copy of the figures that leaves the product. */
  const [standings, setStandings] = useState<Record<string, CommitmentStanding>>({});
  const [formTags, setFormTags] = useState<string[]>([]);
  /** The roster, for the "Paid by" choice. Fetched once — the picker is the only reader, and an
   *  expense form on a team with no players simply offers nothing but "The team". */
  const [roster, setRoster] = useState<Pick<RepRosterPlayer, 'id' | 'playerFirstName' | 'playerLastName'>[]>([]);
  const [filterTagId, setFilterTagId] = useState<string | null>(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  // Drives the form's Details disclosure (Batch 2, P0 #8). Read on mount, so a form pre-filled
  // with a bookkeeping detail — an EDIT, most often — opens it by itself rather than hiding what
  // the coach came to change. (The deposit/balance split used to be one of these; a commitment's
  // schedule is `InstallmentPlanEditor` now and is never folded away — see the note beside it.)
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
  /* ⚖ THE SETTLE MODE IS GONE (Payables Rebuild P2): recording money against a commitment is the
     Record-a-payment modal (`paying`, above), which is its own door and never this form. The mode
     union shrank back to the two things this form actually does. */
  const formMode: 'edit' | 'add' = (editing || editingMoneyIn) ? 'edit' : 'add';
  const isPayableForm = editing
    ? editing.expenseType === 'tournament_payable'
    : entryKind === 'expense' && formTiming === 'payable';
  /** The one place the four-way fork is resolved; every label below reads from `copy`. */
  const formTag: FormKindTag = entryKind !== 'expense' ? entryKind : isPayableForm ? 'payable' : 'expense';
  const copy = FORM_COPY[formTag];
  /** The standing behind the record being edited — the plan and the payments the form now reads
   *  instead of the legacy columns. Undefined until the list load lands, like the list itself. */
  const editingStanding = editing ? standings[editing.id] : undefined;
  /* What the coach is told before confirming a delete. Reads the same payments the server reverses
     (lib/expense-ledger.ts), so the sentence and the outcome cannot drift apart — and on a
     part-paid commitment it quotes what was ACTUALLY paid, never the total (§27 Part D).
     ⚠ Money IN reverses the other way — deleting it LOWERS cash on hand — so it gets its own
     sentence rather than sharing the expense one with a flipped word. */
  const deletePreview = editing
    ? ledgerReversalPreview(editingStanding, editing.paidByPlayerId)
    : { amount: 0, legs: 0, owesFamily: false };
  const moneyInDeletePreview = editingMoneyIn ? moneyInReversalPreview(editingMoneyIn) : null;

  // Chunk H — the payment schedule: every money-OUT commitment in one list, by due date.
  // Player dues stay on the Dues page, where the reminders that chase them live.
  /* ⚠ THE FEED IS NOW READ FOR ITS CLUB LANE ALONE (Payables Rebuild P3). The team's own
     commitments are built here from `expenses` + `standings` — the same records the drawer reads —
     so the list and the drawer cannot disagree about what a bill has paid. What this endpoint still
     uniquely knows is what the CLUB has allocated to the team, which is not a `rep_team_expenses`
     record and has no standing. */
  const [schedule, setSchedule] = useState<ScheduleRow[] | null>(null);
  /** ⚠ SURFACED, NOT SWALLOWED. If this feed fails on a club-run team, the club's own bills are
   *  simply absent from a list that claims to hold everything the team owes — so the list says so
   *  above itself rather than quietly showing a shorter season. There is no spinner beside it: the
   *  team's own bills render from data already in hand, and a second skeleton for a lane that is
   *  empty on most teams would be chrome. */
  const [scheduleError, setScheduleError] = useState('');

  // Chunk H2 — a season of commitments arrives as a schedule far more often than one at a time.
  const [importOpen, setImportOpen] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [seasonYear, setSeasonYear] = useState<number>(() => new Date().getFullYear());

  // Nav-hide + body-scroll-lock registration for the record modal, the payment modal AND the
  // commitment drawer (mobile sheet default) — one registration, any door.
  useOverlayOpen(formOpen || paying !== null || drawerFor !== null || scopeEdit !== null);

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
    // The schedule is an array, which `touched`'s flat compare cannot reach — see `snapshotEqual`.
    || !snapshotEqual(formPlan, formPlanOpenedWith)
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
    setFormPlan([{ ...BLANK_PLAN_ROW }]);
    setFormPlanOpenedWith([{ ...BLANK_PLAN_ROW }]);
    setFormTags([]);
    setFormPayee(null);
    setConfirmDelete(false);
    setFutureDateRefused(false);
    /* ⚠ THE RULE THIS FUNCTION IS FOR, restated because its most recent example has just been
       deleted: state added for one row must clear here, or it persists into the NEXT record. The
       inline "when was this paid?" prompt was left out when it was added, and a coach who opened it
       on one row, added a different cost and saved found it reopened on the first row afterwards,
       holding a date they had typed before doing something else entirely (/review, 2026-08-16).
       The prompt went with the register (P3); the trap is still here for whatever is added next. */
  }

  /** Open the form to ADD, opening on whatever the current sub-tab is about (Q8). */
  function openAdd(opening: { kind: EntryKind; timing: CostTiming } = kindForFace(onPayables)) {
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
  function openSavedRecord(e: RepTeamExpense, values: typeof BLANK_RECORD, plan?: PlanRow[]) {
    resetForm();
    setEditing(e);
    /* ⚠ THE VALUES COME IN so the form and the guard's baseline are set from ONE object. Letting
       the caller `setForm` afterwards is how a settle's pre-filled amount ended up counting as an
       unsaved change: two writes, one of them forgotten. */
    setForm(values);
    setFormOpenedWith(values);
    /* ⚠ THE SCHEDULE GOES IN THROUGH THE SAME DOOR, AND ITS BASELINE WITH IT. Setting the form and
       its guard baseline from one object is the rule this function exists for; the plan is a second
       object only because it is an array. A caller that pre-fills a row (Add an installment) passes
       it here rather than calling `setFormPlan` afterwards — two writes, one of them forgotten, is
       exactly how a pre-filled amount once counted as an unsaved change. */
    const opening = plan ?? planFromStanding(standings[e.id]);
    setFormPlan(opening);
    setFormPlanOpenedWith(opening);
    setFormTags(tagsByExpenseId[e.id] ?? []);
    setFormPayee(e.payeePayer ? { payeeId: e.payeeId, payeePayer: e.payeePayer, displayName: e.payeePayer } : null);
    setSaveError('');
    setFormOpen(true);
  }

  /** Open the form to EDIT a saved record. Type is stated, never switchable (owner ruling) — which
   *  is why `formKind` is not set here: `entryKind` derives it from the record itself. */
  function openEdit(e: RepTeamExpense) {
    openSavedRecord(e, formFromExpense(e, standings[e.id]));
  }

  /**
   * Add another dated piece to a bill (drawer action).
   *
   * ⚠ IT OPENS THE RECORD'S OWN FORM WITH A BLANK ROW APPENDED, rather than inventing a second
   * editor: one door to a commitment's plan, which is the rule the whole screen is built on.
   *
   * ⚖ OFFERED ON ANY BILL NOW, not only a one-piece one (P4). It was restricted because the editor
   * behind it could only hold two pieces, and a button that gets refused is worse than one that is
   * not there — the cap and the restriction lift together, in the same change, because a raised cap
   * with the old editor still in place would silently truncate a longer plan on the next save.
   *
   * ⚠ NO TOTAL IS PRE-RAISED, AND THERE IS NOTHING LEFT TO RAISE. R2 — a commitment's total IS the
   * sum of its pieces, derived by the server and typed nowhere — so the form no longer shows one.
   * That was the two-piece editor's own wart and it went with it.
   */
  function openAddInstallment(e: RepTeamExpense) {
    openSavedRecord(e, formFromExpense(e, standings[e.id]),
      [...planFromStanding(standings[e.id]), { ...BLANK_PLAN_ROW }]);
  }

  /**
   * Record a payment (Payables Rebuild P2) — the door that replaced Mark paid.
   *
   * ⚠ THE PIECE DECIDES THE SUGGESTED AMOUNT, and it is the piece's REMAINDER, never its face
   * value: a $450 piece with $200 already on it opens asking about the $250 — pre-filling more
   * would invite a coach to confirm a figure larger than the payment they made. Opened from the
   * commitment itself (no piece), it suggests everything still owing.
   *
   * ⚠ OPENING FROM A PIECE PRE-AIMS THE OVERRIDE (R3): the coach clicked THAT installment, so the
   * pour starts there. The picker in the modal can still put it back to "wherever it's owed".
   */
  function openRecordPayment(e: RepTeamExpense, target?: { installmentId?: string | null; amount?: number }) {
    const standing = standings[e.id];
    const suggested = target?.amount ?? standing?.remaining ?? e.amount;
    setPayingError('');
    setUndoAsk(null);
    setPaying({
      expense: e,
      installmentId: target?.installmentId ?? null,
      amount: String(suggested),
      paidDate: tournamentToday(),
      method: '',
      note: '',
    });
  }

  /** Submit the Record-a-payment modal. Over-payment saves (R6) — the server does not compare. */
  async function submitPayment() {
    if (!paying) return;
    setPayingBusy(true);
    setPayingError('');
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/expenses/${paying.expense.id}/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: parseFloat(paying.amount),
            paidDate: paying.paidDate,
            method: paying.method.trim() || null,
            note: paying.note.trim() || null,
            installmentId: paying.installmentId,
          }),
        });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not record the payment');
      setPaying(null);
      await refreshAfterWrite();
    } catch (e: any) {
      setPayingError(e.message);
    } finally {
      setPayingBusy(false);
    }
  }

  /**
   * Undo a recorded payment — the books go back by exactly that payment's amount (R5).
   * Two taps: the first arms the button with the figure, the second sends the DELETE.
   */
  /**
   * Shut the bill panel, and take the unanswered Undo question with it.
   *
   * ⚠ THE SECOND HALF IS THE POINT. A coach who opens "Undo the $200 payment?" and then closes the
   * panel has answered nothing — leaving the flag set means the question is still hanging there the
   * next time any bill is opened, on a row they never touched. Same rule the form's reset carries:
   * state raised for one action clears when that action's surface goes away.
   */
  function closeDrawer() {
    setDrawerFor(null);
    setUndoAsk(null);
  }

  /** Confirmed — actually reverse it. The question is asked in the panel; this only does the work. */
  async function undoPayment(e: RepTeamExpense, payment: AppliedPayment) {
    if (undoRef.current) return;          // see `undoRef` — a second tap must not reach the server
    undoRef.current = true;
    setUndoBusy(payment.id);
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/expenses/${e.id}/payments/${payment.id}`,
        { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not undo the payment');
      setUndoAsk(null);
      await refreshAfterWrite();
    } catch (err: any) {
      // Surfaced beside the list rather than a toast nothing owns — same channel as every other
      // load error on this screen.
      setError(err.message);
      setUndoAsk(null);
    } finally {
      undoRef.current = false;
      setUndoBusy(null);
    }
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

  // Which SEASON is on screen — the team's LIVE one, always. `page.capabilities` are that
  // season's. ⚠ `page.canWrite()` is GONE (2026-08-18): it folded read-only into every write
  // flag, and a closed season no longer renders this screen at all, so a capability check is
  // just a capability check.
  const seasonSearchParams = useSearchParams();
  const page = useCoachSeasonPage(orgSlug, teamId);
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const canWriteMoney = (page.capabilities?.money === 'write');
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
        standings?: Record<string, CommitmentStanding>;
      };
      setExpenses(data.expenses ?? []);
      setExpenseTags(data.expenseTags ?? []);
      setTagsByExpenseId(data.tagsByExpenseId ?? {});
      setStandings(data.standings ?? {});
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
    setScheduleError('');
    try {
      /* ⚠ `lanes=org_payables` — ASK FOR THE ONE LANE WE READ (/simplify, altitude lens). The dues
         lane was never parsed here, and the team lane is `getCommitmentStandings` run a second time
         for an answer this panel already holds. P3 made that waste recurring by fetching on every
         visit to the face and after every write; narrowing the REQUEST is the honest fix. */
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/upcoming-payables?days=0&includePaid=1&lanes=org_payables`);
      const data = await res.json().catch(() => ({}));
      if (seq !== scheduleSeq.current) return;
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      const lanes = (data.lanes ?? []) as Array<{ id: string; items: Omit<ScheduleRow, 'source'>[] }>;
      /* ⚠ THE CLUB LANE ONLY, and the request now says so. The team's own bills are built from
         `standings`, so the list and the drawer read ONE object and cannot disagree about what a
         bill has paid; asking for the team lane as well would be that same answer computed twice.
         The array keeps its `source` tag because the grouping still distinguishes a club bill from
         a team one — a club bill's door is the Club tab, not the drawer. */
      const rows: ScheduleRow[] = (lanes.find(l => l.id === 'org_payables')?.items ?? [])
        .map(i => ({ ...i, source: 'org' as const }))
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
      setSchedule(rows);
    } catch (e: any) {
      setScheduleError(e.message ?? 'Could not load what your club has billed this team.');
    }
  }, [orgSlug, teamId]);

  /* ⚠⚠ THE SCHEDULE HAS TO WATCH THE REVISION TOO (/review, 2026-08-16). This fired only on a
     CHANGE of sub-view, so the one screen a coach reads to answer "what is coming due" could sit
     there stale: Payables now OPENS on the schedule, and the hub's Import ▾ — reachable from any
     tab — brings in a whole season of commitments and bumps the revision. The list beside it
     refreshed; this table did not, until the coach happened to switch sub-views and back. Silent
     stale money on the screen whose entire job is to be current. */
  useEffect(() => { if (face === 'payables') loadSchedule(); }, [face, loadSchedule, moneyRevision]);

  /**
   * WHAT EVERY WRITE ON THIS SCREEN DOES AFTERWARDS. One function, three callers.
   *
   * ⚠⚠ THE ORDER IS THE WHOLE REASON IT EXISTS (money redesign P3). The three shared reads are
   * cached per revision now, so a `load()` run BEFORE the invalidation replays the answers the save
   * has just made wrong — the screen settles back to exactly what it looked like before the coach
   * pressed Save. The bump clears the cache, so it has to come first.
   *
   * ⚠ AND IT IS A WRAPPER RATHER THAN A COMMENT AT EACH CALL SITE. Three copies of a warning is
   * not a guard — the fourth write path would simply not read them. (This file used to cite
   * `goToTab` as the precedent for that; `goToTab` was deleted with the sub-view concept in P3,
   * and the rule it stood for is the reason this wrapper survives it.)
   */
  const refreshAfterWrite = useCallback(async () => {
    bumpMoneyRevision();
    await load();
    // The club-bill feed is its own fetch, and only the face that renders it pays for the re-read.
    if (face === 'payables') await loadSchedule();
  }, [bumpMoneyRevision, load, loadSchedule, face]);

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
    showBalance, bookRows, bookStartingBalance, bookEmpty, registerItemNames, statusCounts,
  } = useMemo(() => {
    /* ⚠⚠ WHEN A FILTER HIDES ROWS, THE BALANCE COLUMN HIDES WITH IT (plan §4.3). A running balance
       over a subset is a number that looks like cash and isn't — a coach reading "Expenses only"
       would see a column of figures descending from zero and have every reason to read it as the
       team's position. The column is REMOVED rather than blanked, so there is no empty space
       inviting the question. `balanceIsMeaningful` is the one rule, shared with the export.
       ⚠ THE DATE RANGE IS DELIBERATELY NOT ONE OF ITS INPUTS — narrowing by date hides rows from
       one continuous timeline rather than excluding a category from a sum, so every visible
       balance stays honest. See `applyDateRange`'s own header for the full argument. */
    const balanceShown = balanceIsMeaningful(
      selectedKinds.size === 0 ? 'all' : 'expense', selectedItems.size > 0 ? 'x' : '', filterTagId,
    );
    const matchesKindItemTag = (r: RegisterBookRow) => {
      if (selectedKinds.size > 0 && !selectedKinds.has(r.kind)) return false;
      if (selectedItems.size > 0 && (!r.itemName || !selectedItems.has(r.itemName))) return false;
      /* Money tags live on expenses, so a tag filter narrows the book to the rows that can carry one
         — every other row simply has no such label, which is a match of zero, not a match of all. */
      if (filterTagId) {
        if (r.open?.kind !== 'expense') return false;
        if (!(tagsByExpenseId[r.open.id] ?? []).includes(filterTagId)) return false;
      }
      return true;
    };
    const beforeStatus = (book?.book ?? []).filter(matchesKindItemTag);
    /* Counted BEFORE the Status selection narrows further — otherwise the dropdown's own counts
       would just report themselves back once picked, the same rule the old Overdue chip's count
       followed. */
    const counts: Record<RegisterStatus, number> = { actual: 0, overdue: 0, scheduled: 0 };
    for (const r of beforeStatus) counts[registerStatusOf(r)]++;
    const statusFiltered = selectedStatus.size === 0 ? beforeStatus
      : beforeStatus.filter(r => selectedStatus.has(registerStatusOf(r)));
    /* ⚠⚠ OVERDUE ALWAYS IGNORES THE DATE RANGE, REGARDLESS OF WHAT ELSE IS SELECTED (owner call,
       2026-08-19). It must never be the reason a coach doesn't see an open obligation — whether
       they've narrowed to Overdue alone (an audit) or are browsing Actual + Overdue together (the
       default). Actual and Scheduled rows are windowed normally. */
    const overdueRows = statusFiltered.filter(r => r.overdueDays != null);
    const rangeableRows = statusFiltered.filter(r => r.overdueDays == null);
    /* An Overdue-only selection (neither Actual nor Scheduled chosen) isn't a slice of the
       timeline, it's a cross-section of it — same as the old audit toggle. No starting balance to
       state there; `rangeableRows` is empty by construction whenever this is true. */
    const auditOnly = selectedStatus.size > 0 && !selectedStatus.has('actual') && !selectedStatus.has('scheduled');
    const { rows: ranged, startingBalance } = auditOnly
      ? { rows: rangeableRows, startingBalance: null as number | null }
      : applyDateRange(rangeableRows, dateRange.from, dateRange.to);
    /* Recombine in the book's own chronological order rather than concatenating the two groups —
       `statusFiltered` is already ordered, so filtering IT by membership is simpler than merging
       two separately-ordered arrays back together. */
    const visibleIds = new Set([...ranged.map(r => r.id), ...overdueRows.map(r => r.id)]);
    const finalRows = statusFiltered.filter(r => visibleIds.has(r.id));
    return {
      showBalance: balanceShown,
      bookRows: finalRows,
      bookStartingBalance: startingBalance,
      bookEmpty: finalRows.length === 0,
      statusCounts: counts,
      /* The words actually ON the book, not the whole library: a filter offering a category the
         season never spent against is a control that can only ever empty the screen. */
      registerItemNames: [...new Set(
        (book?.book ?? []).map(r => r.itemName).filter((n): n is string => !!n),
      )].sort((a, b) => a.localeCompare(b)),
    };
  }, [book, selectedKinds, selectedItems, filterTagId, selectedStatus, dateRange, tagsByExpenseId]);


  /* ⚠ HOISTED ABOVE THE MEMO THAT READS THEM. These used to sit below the access guard with the
     rest of the render-time derivations — fine for JSX, illegal for a hook's dependency list. */
  /**
   * ⚠⚠ MEMOISED, AND THAT IS NOT A MICRO-OPTIMISATION (/simplify, efficiency lens). A bare
   * `.filter()` in the render body returns a NEW ARRAY EVERY RENDER, and this is a dependency of
   * the `payBills` memo below — so React compared references, saw a change every time, and
   * recomputed the entire list on every keystroke in the money form that shares this component.
   * That is precisely the cost `payBills`'s own header says it exists to avoid: the memo was there,
   * and this one line was quietly defeating it.
   */
  const allPayablesRaw = useMemo(
    () => expenses.filter(e => e.expenseType === 'tournament_payable'),
    [expenses],
  );

  /**
   * ⚠⚠ THE ONE PAYABLES LIST, DERIVED ONCE (Rebuild P3) — the bills, their pieces, and what the
   * Status dropdown counts. Memoised for the reason the register's memo already gives: the money
   * form lives in this component, so every keystroke in it re-renders the whole panel, and this
   * walks every commitment's plan.
   *
   * ⚠ COUNTS ARE TAKEN BEFORE STATUS NARROWS (plan §3.3) — over the rows the OTHER filters admit,
   * never after Status itself has cut them down. Get it wrong and the numbers chase their own tail:
   * tick Overdue and every other option reads zero.
   *
   * ⚠ THE TWO ARRANGEMENTS SHARE THIS EXACTLY. `payBills` is built once; `Group by` only decides
   * how it is laid out below. That is what makes "nothing appears, nothing disappears" true by
   * construction rather than by two code paths agreeing — the check §64 Part C walks.
   */
  const { payBills, payStatusCounts, payItemNames } = useMemo(() => {
    const today = tournamentToday();
    const counts: Record<PayableRowStatus, number> = {
      outstanding: 0, overdue: 0, partly_paid: 0, paid: 0,
    };

    /** What a budget item is CALLED, for the Item filter and the drawer's subtitle.
     *  ⚠ ONE MAP, NOT A NESTED SCAN PER BILL (/simplify, efficiency lens). Looking the name up by
     *  walking every category's items for every commitment is O(bills × categories × items) inside
     *  the heaviest memo on the screen; built once it is O(1) per bill. */
    const itemNameById = new Map<string, string>();
    for (const c of categories) for (const i of c.items) itemNameById.set(i.id, i.name);
    const itemName = (e: RepTeamExpense): string | null =>
      (e.budgetItemId && itemNameById.get(e.budgetItemId)) || null;

    /* Everything the OTHER controls admit — the tag chip and the Item dropdown. Status is applied
       after the counts are taken, which is the whole point of doing it in two passes. */
    /* ⚠ A DRAFT IS NOT A BILL (/simplify). The seven fields below describe a bill's NEXT unpaid
       payment, and nothing knows them until Status has narrowed the pieces in the second pass — so
       the draft type omits them rather than seeding placeholders that are always overwritten. It is
       now structurally impossible to read a bill's `next*` figures before they are real. */
    type PayBillDraft = Omit<PayBill,
      'pieces' | 'nextDue' | 'nextBadge' | 'nextDays' | 'nextPartly' | 'nextInstallmentId' | 'nextOwing'>;
    const admitted: Array<{ bill: PayBillDraft; pieces: PayPiece[] }> = [];
    const itemNames = new Set<string>();

    for (const e of allPayablesRaw) {
      const name = itemName(e);
      if (name) itemNames.add(name);
      const standing = standings[e.id];
      if (!standing) continue;
      /* The tag chip, inlined rather than called through a helper: a predicate rebuilt on every
         render is a dependency this memo could never satisfy, and its two real inputs
         (`filterTagId`, `tagsByExpenseId`) are already in the list below. */
      if (filterTagId && !(tagsByExpenseId[e.id] ?? []).includes(filterTagId)) continue;
      if (payItems.size > 0 && (!name || !payItems.has(name))) continue;

      const count = standing.installments.length;
      const pieces: PayPiece[] = standing.installments.map(inst => {
        const statuses = installmentStatuses(inst, today);
        for (const s of statuses) counts[s]++;
        return {
          key: inst.id,
          dueDate: inst.dueDate,
          /* The shared naming rule: a lone piece takes NO number — "installment 1 of 1" is noise,
             and "One payment" is the word P2's drawer already uses for exactly this. */
          label: count > 1 ? `Installment ${inst.installmentNumber} of ${count}` : 'One payment',
          installmentNumber: inst.installmentNumber,
          owing: inst.state === 'settled' ? inst.amount : inst.remaining,
          faceAmount: inst.amount,
          applied: inst.applied,
          settled: inst.state === 'settled',
          partlyPaid: inst.state === 'partly_paid',
          daysUntilDue: daysBetweenDateStrings(today, inst.dueDate),
          statuses,
          badge: installmentStatus(inst, today),
          installmentId: inst.id,
        };
      });

      admitted.push({
        bill: {
          key: e.id,
          kind: 'team',
          description: e.description,
          category: e.category ?? null,
          itemName: name,
          total: standing.total,
          paid: standing.paid,
          owing: standing.remaining,
          over: standing.over,
          pieceCount: count,
          unpaidCount: pieces.filter(p => !p.settled).length,
          expense: e,
          standing,
        },
        pieces,
      });
    }

    /* ⚠ THE CLUB'S OWN BILLS STAY ON THIS LIST, in both arrangements, exactly as they appeared on
       the schedule before the rebuild. They are not the team's records to edit — a club allocation
       is settled through Club, which owns that conversation — so the bill's door is the Club tab
       rather than the drawer. Dropping them would silently lose a club-run team's other half. */
    const orgRows = (schedule ?? []).filter(r => r.source === 'org');
    const byAllocation = new Map<string, ScheduleRow[]>();
    for (const r of orgRows) {
      // Append in place — spreading the bucket into a fresh array per row makes grouping O(n²)
      // in the instalments sharing one allocation (/simplify, efficiency lens).
      const bucket = byAllocation.get(r.description);
      if (bucket) bucket.push(r); else byAllocation.set(r.description, [r]);
    }
    for (const [description, rows] of byAllocation) {
      const pieces: PayPiece[] = rows.map(r => {
        const settled = !!r.paid;
        const status: PayableRowStatus = settled ? 'paid'
          : (r.dueDate ?? '') < today ? 'overdue' : 'outstanding';
        counts[status]++;
        return {
          key: r.id,
          dueDate: r.dueDate ?? today,
          label: r.label ?? 'Instalment',
          installmentNumber: 1,
          owing: r.amount,
          faceAmount: r.amount,
          applied: 0,
          settled,
          partlyPaid: false,
          daysUntilDue: r.daysUntilDue ?? 0,
          statuses: [status],
          badge: status,
          installmentId: null,
        };
      });
      const owing = pieces.filter(p => !p.settled).reduce((s, p) => s + p.owing, 0);
      const total = pieces.reduce((s, p) => s + p.faceAmount, 0);
      admitted.push({
        bill: {
          key: `org:${description}`,
          kind: 'org',
          description,
          category: 'From your club',
          itemName: null,
          total, paid: total - owing, owing, over: 0,
          pieceCount: pieces.length,
          unpaidCount: pieces.filter(p => !p.settled).length,
        },
        pieces,
      });
    }

    /* Pass two — Status narrows, and a bill whose every piece was filtered out drops off the list.
       The header's OWN figures (paid of total, still owing) are deliberately taken from the whole
       bill above, never from the visible slice: "$1,550 still owing" must not change because the
       coach ticked a filter. */
    const bills: PayBill[] = [];
    for (const { bill, pieces } of admitted) {
      const visible = payStatus.size === 0
        ? pieces
        : pieces.filter(p => p.statuses.some(s => payStatus.has(s)));
      if (visible.length === 0) continue;
      const next = pieces.find(p => !p.settled) ?? null;
      bills.push({
        ...bill,
        pieces: visible,
        nextDue: next?.dueDate ?? null,
        nextBadge: next?.badge ?? null,
        nextDays: next?.daysUntilDue ?? null,
        nextPartly: next?.partlyPaid ?? false,
        nextInstallmentId: next?.installmentId ?? null,
        nextOwing: next?.owing ?? 0,
      });
    }

    /* ⚠ SOONEST NEXT PAYMENT FIRST (owner ruling 2026-08-20) — so the longest-overdue bill sits at
       the top and the furthest-off sinks. A fully settled bill has no next payment and therefore
       nothing to sort by: it goes to the bottom, most recently due first, and only appears at all
       once Paid is ticked. */
    bills.sort((a, b) => {
      if (a.nextDue && b.nextDue) return a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0;
      if (a.nextDue) return -1;
      if (b.nextDue) return 1;
      const al = a.pieces[a.pieces.length - 1]?.dueDate ?? '';
      const bl = b.pieces[b.pieces.length - 1]?.dueDate ?? '';
      return al < bl ? 1 : al > bl ? -1 : 0;
    });

    return {
      payBills: bills,
      payStatusCounts: counts,
      /* The words actually on THIS list, not the whole library — a filter offering an item the team
         has never committed against is a control that can only ever empty the screen. */
      payItemNames: [...itemNames].sort((a, b) => a.localeCompare(b)),
    };
  }, [allPayablesRaw, standings, schedule, payStatus, payItems, categories, tagsByExpenseId, filterTagId]);

  /**
   * The list as the chosen arrangement lays it out.
   *
   * ⚠ ONE INPUT, TWO SHAPES. Both read `payBills` — the arrangement never re-filters, which is what
   * makes the row count identical between them by construction.
   */
  const payPeriods = useMemo(() => {
    if (groupBy !== 'due') return [];
    const today = tournamentToday();
    /** One dated band — Overdue, or a month — and the pieces filed under it. Named rather than
     *  inlined so the `?? { … rows: [] }` fallback below infers its row type instead of `never[]`. */
    interface PayBand {
      key: string;
      label: string;
      owing: number;
      rows: Array<{ bill: PayBill; piece: PayPiece }>;
    }
    const bands = new Map<string, PayBand>();
    for (const bill of payBills) {
      for (const piece of bill.pieces) {
        /* ⚠ OVERDUE IS ITS OWN BAND, ahead of every month — an open obligation is not a point on
           the calendar, it is the thing that needs doing. Settled pieces file by their due month
           like anything else. */
        const overdue = !piece.settled && piece.dueDate < today;
        /* ⚠ `monthKeyOf`, not a hand-rolled `.slice(0, 7)` (/simplify, reuse lens) — the same module
           this band's label already comes from, and it validates the date the slice would not. A
           due date is always well-formed here, so the fallback is unreachable rather than lenient. */
        const month = monthKeyOf(piece.dueDate) ?? piece.dueDate.slice(0, 7);
        const key = overdue ? '!overdue' : month;
        const label = overdue ? 'Overdue' : formatMonthLong(month);
        const band: PayBand = bands.get(key) ?? { key, label, owing: 0, rows: [] };
        band.rows.push({ bill, piece });
        if (!piece.settled) band.owing += piece.owing;
        bands.set(key, band);
      }
    }
    const ordered = [...bands.values()].sort((a, b) =>
      a.key === '!overdue' ? -1 : b.key === '!overdue' ? 1 : a.key.localeCompare(b.key));
    for (const band of ordered) {
      band.rows.sort((x, y) => x.piece.dueDate.localeCompare(y.piece.dueDate));
    }
    return ordered;
  }, [payBills, groupBy]);

  /** The bill whose drawer is open, and its standing. ⚠ Looked up in `payBills` rather than held in
   *  state: after a payment lands the list rebuilds, and a held copy would go on showing the figures
   *  from before the write until the coach closed and reopened it. */
  const drawerBill = drawerFor ? payBills.find(b => b.key === drawerFor) ?? null : null;
  const drawerStanding = drawerBill?.standing;

  /** Bills open shut, periods open open — see `flippedFolds`. */
  const foldDefaultShut = groupBy === 'commitment';
  /** Is this group shut right now? The default, flipped by anything the coach has toggled. */
  const isShut = (key: string) => foldDefaultShut !== flippedFolds.has(key);
  const foldKeys = groupBy === 'due' ? payPeriods.map(p => p.key) : payBills.map(b => b.key);
  /** Is everything shut? Decides whether the one control says "Fold all" or "Open all" — two
   *  buttons for one toggle would be the click tax this strip is trying to avoid. */
  const allFolded = foldKeys.length > 0 && foldKeys.every(isShut);

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
  /* ⚠⚠ `?tab=schedule` AND `?tab=commitments` ARE LIVE URL CONTRACTS, AND THEY SURVIVED THE REBUILD
     AS ARRANGEMENTS (Payables Rebuild P3). Payables no longer HAS sub-views for them to name — but
     the Money hub's "See full schedule", Budget vs. Actual's Scheduled drill-in, the legacy-address
     mapper for the retired `expenses` screen and the UAT smoke spec all still send them, and a
     bookmark that 404s or lands on a blank tab is the same bug wearing a politer face. Each now
     chooses how the ONE list is arranged, which is what each always meant: "the schedule" was the
     dated run, "commitments" was the grouped one. */
  const wantedTab = seasonSearchParams.get('tab');
  useEffect(() => {
    if (!wantedTab || !onPayables) return;
    const arrangement = TAB_AS_GROUP_BY[wantedTab];
    if (arrangement) setGroupBy(arrangement);
  }, [wantedTab, onPayables]);

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
      // 'all' means "clear the filter" — an empty set, never a set containing the literal string
      // 'all', which isn't a real kind.
      setSelectedKinds(wantedFilter === 'all' ? new Set() : new Set([wantedFilter as RegisterKind]));
    }
    /* Adds Scheduled to whatever's already selected rather than replacing it — the deep link means
       "also show what's coming," not "show only what's coming." */
    if (wantedScheduled === '1') {
      setSelectedStatus(s => new Set([...s, 'scheduled']));
      /* ⚠ AND the date window must be able to SEE forward (/review). A remembered backward preset
         ("Last 30 days" ends today) — or a pinned custom range — would window out the exact row
         this link promised to show, a miss the old always-fresh ±30 default made impossible. The
         same reasoning as the line above: the link's intent outranks the sitting narrowing.
         Widens the VIEW only — the coach's saved habit is deliberately not overwritten. */
      setDatePreset(p => (p === 'around' || p === 'season') ? p : 'around');
    }
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
    /* ⚠⚠ BELT TO `saving`'s BRACES (`/review`, concurrency lens, 2026-08-20). A second click can
       land before React commits the disabled attribute, and on the ADD path there is no server-side
       idempotency to catch it — two clicks make two costs. `GenerateInstallmentsModal` carries this
       same ref for the same reason; this form did not. */
    if (savingRef.current) return;
    savingRef.current = true;
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

      /* ── The commitment's plan, as the editor states it (Payables Rebuild P4) ──────────────
         ⚠⚠ VALIDATED BY THE SERVER'S OWN VALIDATOR, NOT BY A COPY OF ITS RULES (`/simplify`,
         altitude lens, 2026-08-20). `parseInstallmentPlan` is the one door every writer of a plan
         goes through — the cent floor, the real-calendar-date check, the row-naming refusals and
         the series ceiling all live there. This screen had hand-copied the first two so it could
         name the offending row, and the two copies had already drifted apart in wording; the row
         naming moved INTO the shared function instead, so a stale tab that reaches the route is
         told exactly what the form would have told it. */
      let commitmentInstallments: Array<{ amount: number; dueDate: string }> = [];
      if (isPayable) {
        const parsed = parseInstallmentPlan(formPlan.map(r => ({
          amount: parseFloat(r.amount),
          dueDate: r.date,
          // Carried so the server can match this row to the piece it already is (PlanRow.id).
          ...(r.id ? { id: r.id } : {}),
        })));
        if ('error' in parsed) throw new Error(parsed.error);
        commitmentInstallments = parsed.plan;
        /* ⚠⚠ MONEY ALREADY PAID MUST NOT BE STRANDED (S6) — the successor of "a settled split
           cannot go back to one amount". Removing rows makes the payments re-apply, and if there is
           no longer room for them the bill silently starts reading as over-paid. The SERVER's check
           is the real one; this is the same decision, run on the same module, so the refusal a
           coach reads here and the one that would come back are one sentence. */
        if (editingStanding) {
          const strands = whyPlanStrandsPaidMoney(editingStanding, commitmentInstallments);
          if (strands) throw new Error(strands);
        }
      }
      /* ⚠ THE ASTERISK ON "What is this?" HAS TO MEAN SOMETHING. It was drawn as required and the
         comment above the field asserted it was, but nothing checked — so a coach could save a cost
         with no category and no item at all, and it landed in the "Not itemized" bucket this whole
         change exists to empty, silently. A label that promises and does not enforce is worse than
         no label: it teaches coaches the field is optional. The server refuses too. */
      if (categories.length > 0 && !form.budgetItemId) {
        throw new Error('Pick a category and item — they line this cost up with your budget.');
      }
      /* ⚠ R2 — A COMMITMENT HAS NO TYPED TOTAL to validate: its total is the sum of its pieces,
         checked row by row above and derived by the server. The form does not show the field. */
      if (!isPayable && (isNaN(amount) || amount <= 0)) {
        throw new Error('Enter a valid amount');
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
        throw new Error('That hasn’t happened yet.');
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

      /* ⚖ AN EDIT NOW SENDS EVERY FIGURE (owner ruling 2026-08-16). This used to omit anything that
         had posted, because the server refused it — echoing back an unchanged amount would have
         turned "I fixed a typo in the description" into a rejection. Nothing refuses now: the
         server moves the team's books to match whatever it is given, so there is no send-filter
         left to keep in step with a lock rule, which is one fewer copy of a rule that used to live
         in three places and failed silently in this one. */
      const edits: Record<string, unknown> = { ...common };
      if (isPayable) {
        /* R2 — no `amount` is sent for a commitment: its total IS the sum of its installments,
           and the server derives it. Sending one would be a second way of typing the same fact. */
        edits.installments = commitmentInstallments;
      } else {
        edits.amount = amount;
        if ((editingStanding?.payments.length ?? 0) === 1 && form.paidDate) {
          /* Correcting WHEN it was paid — sent only on a record with exactly ONE payment, because
             that is the only shape with a single date to correct. A record paid in pieces corrects
             a date by undoing the wrong payment and recording it again. */
          edits.paidDate = form.paidDate;
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
              /* ⚠ R2 — NO `amount` ON A COMMITMENT. Its total is the sum of its installments,
                 derived by the server, and the form no longer has a box for one. Sending the
                 unparsed field would put a `null` on the wire for a key the route reads only on
                 the other branch — harmless today, and exactly the kind of dead field a later
                 reader mistakes for a fact. */
              ...(isPayable ? {} : { amount }),
              ...(isPayable
                ? { installments: commitmentInstallments }
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
      /* ⚠ RELEASED WHEN THE REQUEST ENDS, which is the whole window that matters: the defect is a
         second click landing while the first save is IN FLIGHT, before React has committed the
         disabled attribute. Once it has returned, the form has either closed or is showing a
         refusal the coach must act on. ⚠ Released here rather than in `resetForm` — writing a ref
         from a function the render path can reach trips the compiler's ref rule. */
      savingRef.current = false;
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

    // ── A commitment: the one form in the portal that moves no money ──
    if (isPayableForm) {
      /* ⚠⚠ "NOTHING MOVES" IS ONLY TRUE WHILE NOTHING HAS MOVED (/review, 2026-08-16). The line was
         rendered for every commitment, including one money had already landed on — where changing a
         settled figure DOES move the books. A consequence line that contradicts the screen it sits
         on is worse than none: it is the sentence a coach trusts instead of checking. */
      if ((editingStanding?.paid ?? 0) > 0) {
        return line(<>
          <strong>{fmt(editingStanding!.paid)} of this has been paid.</strong> The rest of the
          schedule is still just a plan — but changing a figure that has already been paid updates
          the team’s books too, and cash on hand follows the new number.
        </>);
      }
      /* ⚠ THE FIRST DATE ON THE SCHEDULE, not "the due date" — a repeating cost has six of them,
         and naming the earliest is what a coach is actually going to be reminded about next. */
      const due = formPlan.map(r => r.date).filter(Boolean).sort()[0] ?? '';
      const many = formPlan.length > 1;
      return line(<>
        <strong>When you save: nothing moves.</strong> Cash on hand is unchanged and no family is
        affected. {many
          ? <>All {formPlan.length} payments join your payment schedule</>
          : <>This joins your payment schedule</>}
        {due ? <>, {many ? 'the first' : 'due'} {fmtDate(due)}</> : null}
        {' '}— record payments against {many ? 'them' : 'it'} as the money actually leaves.
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
      return line((editingStanding?.paid ?? 0) > 0
        ? <><strong>When you save:</strong> this stays paid, dated {fmtDate(form.paidDate)}. Changing
          the figure or the date updates the team’s books too — cash on hand and the month it lands
          in both follow what you enter here.</>
        : <><strong>When you save:</strong> {money} leaves the team’s books on{' '}
          {fmtDate(form.paidDate)}. Cash on hand goes <strong>down</strong> by {money}.</>);
    }
    return line(<>
      <strong>When you save: nothing moves yet.</strong> This waits as an unpaid cost until you
      record its payment, and cash on hand is unchanged until then.
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
  const allPayables = allPayablesRaw;

  // Filter chip row: tags actually used by the current tab's expenses, with counts (mirrors the
  // game "vs tag" report). Selecting one narrows the list + shows a tag total.
  /* Which records the tag chips are counted over. On the register that is EVERY expense, both
     kinds: the book carries a commitment's settled halves beside an ordinary cost, so counting only
     one type would offer a chip whose number disagreed with the rows it then produced. */
  const activeAll = onPayables ? allPayables : expenses;
  const tagCounts = new Map<string, number>();
  for (const e of activeAll) for (const id of (tagsByExpenseId[e.id] ?? [])) tagCounts.set(id, (tagCounts.get(id) ?? 0) + 1);
  const usedTagIds = [...tagCounts.keys()]
    .map(id => tagById.get(id))
    .filter((t): t is RepTeamTag => !!t)
    .sort((a, b) => a.name.localeCompare(b.name));
  /**
   * ⚠⚠ THE EXPORT IS WHAT THE ARRANGEMENT IS SHOWING (Payables Rebuild P3), which keeps BOTH files
   * a coach's downloads folder already holds. Grouped by commitment it is the `payables` file;
   * grouped by due date it is the `payment-schedule` file — exactly the two the retired sub-tabs
   * each owned, now chosen by the arrangement rather than by a tab.
   *
   * ⚠ AND IT FOLLOWS THE FILTERS, which is the rule every other Export on this toolbar obeys and
   * the reason Export lives down here rather than in a hub-wide menu. The schedule half already
   * behaved this way (its Unpaid/Paid/All pills narrowed the file). The COMMITMENTS half changes:
   * it used to carry every bill regardless, and now respects Status — so the default view exports
   * what is still owed, and a coach wanting the settled history ticks Paid first. Called out in
   * §64 Part C so the walk does not read it as a lost record.
   */
  const filteredActive = payBills
    .map(b => b.expense)
    .filter((e): e is RepTeamExpense => !!e);
  /** The dated pieces, in the order the due-date arrangement shows them, for that file. */
  const payScheduleExport = payPeriods.flatMap(band => band.rows.map(({ bill, piece }) => ({
    description: bill.kind === 'org'
      ? `${bill.description} — ${piece.label}`
      : installmentLabel(bill.description, piece.installmentNumber, bill.pieceCount),
    amount: piece.owing,
    dueDate: piece.dueDate,
    paid: piece.settled,
    overdue: !piece.settled && piece.badge === 'overdue',
    source: bill.kind === 'org' ? ('org' as const) : ('team' as const),
  })));

  /** Is the list empty because the SEASON is, or because the FILTERS are? Two different sentences,
   *  and offering "Add a commitment" to a coach who has merely ticked Paid-only answers a question
   *  they did not ask. ⚠ The default Status hides settled bills, so a season of fully-paid history
   *  legitimately lands on the narrowed message — which is right: the money is there, it is just
   *  one tick away. */
  const payBillsEmpty = payBills.length === 0;
  const payNarrowed = payBillsEmpty
    && (allPayablesRaw.length > 0 || (schedule ?? []).some(r => r.source === 'org'));

  /* ⚠ "from Club" COMES OUT ON A STANDALONE TEAM. A filter that can never match anything is a dead
     control, and on a team with no club it would also imply a relationship the team does not have. */
  const registerFilters = REGISTER_FILTERS.filter(f => f.id !== 'club' || book?.orgLinked !== false);
  /* What the downloaded file is called, and its filename segment.
     ⚠ `expenses` AND `money-in` STAY AS SEGMENTS where the filter reproduces the retired dataset —
     a coach's downloads folder already holds a season of files under those words, and the export
     catalog lists them. The register's own file is `register`.
     ⚠ MULTI-SELECT ONLY PRESERVES THAT CONTINUITY FOR A SINGLE SELECTED KIND — the old single-kind
     file names have nothing to fall back to once two kinds are combined, so a combined selection
     exports as the general `register` file, still narrowed to exactly the rows on screen. */
  const singleSelectedKind = selectedKinds.size === 1 ? [...selectedKinds][0] : null;
  /** Nothing narrowing the register at all — the season genuinely has no rows yet, as opposed to
   *  a filter combination that happens to match none. */
  const noNarrowing = selectedKinds.size === 0 && selectedItems.size === 0 && !filterTagId;
  const registerExportLabel = selectedKinds.size === 0 ? 'Register'
    : singleSelectedKind ? REGISTER_FILTERS.find(f => f.id === singleSelectedKind)!.label
    : `Register (${selectedKinds.size} kinds)`;
  const registerExportDataset = singleSelectedKind === 'expense' ? 'expenses'
    : singleSelectedKind ?? 'register';

  /* ⚠ THE SHARED TOGGLE, not a seventh hand-rolled copy (/simplify, reuse lens). `lib/toggle-key.ts`
     exists because six call sites had already drifted into two spellings of this same three-line
     Set flip before anyone noticed — and the sibling money screen imports it in this very diff. */
  const toggleFold = (key: string) => setFlippedFolds(prev => toggleKey(prev, key));

  /**
   * How late, or how soon — the same sentence on a header and on a row, so a folded bill and the
   * piece inside it never word the same fact differently.
   *
   * ⚠ "· partly paid" IS APPENDED, NOT SUBSTITUTED. A late part-paid piece is BOTH things
   * (`installmentStatuses`), and the badge has room for one word — so the date word wins the badge
   * and the middle state is said beside it. This is the wording the payment schedule already used
   * before the rebuild; nothing new is being invented for a coach to learn.
   */
  function payStatusText(badge: PayableRowStatus, days: number, partly: boolean): ReactNode {
    const tone = badge === 'paid' ? styles.payStatePaid
      : badge === 'overdue' ? styles.payStateOverdue
      : partly ? styles.payStatePartly : styles.payStateAhead;
    const words = badge === 'paid' ? 'Paid'
      : badge === 'overdue' ? `${Math.abs(days)} days overdue`
      : days === 0 ? 'Due today' : `In ${days} days`;
    return (
      <span className={`${styles.payState} ${tone}`}>
        <span className={styles.payStateDot} aria-hidden />
        {words}{partly && badge !== 'paid' ? ' · partly paid' : ''}
      </span>
    );
  }

  /**
   * A BILL'S HEADER — the summary line the list is really made of.
   *
   * ⚠⚠ IT LINES UP WITH THE COLUMNS BENEATH IT rather than spanning them (owner-directed rebuild,
   * 2026-08-20). The mockup's original header was a run of text — "$1,150.00 paid of $2,700.00 ·
   * $1,550.00 still owing" — with three figures where two would do and, critically, NO DUE DATE. It
   * now puts the next payment's date under Due, the bill under What, what is left under Owing and
   * its urgency under Status, so a FOLDED bill reads exactly like an ordinary row. That is what
   * makes folding lossless, which was the whole objection to giving every bill a header.
   *
   * ⚠ "$X paid of" CAME OUT (owner call): it is the subtraction of the two figures already present.
   * The total sits small beneath the owing figure, and ONLY where something has been paid — an
   * untouched one-off bill would otherwise print $450 twice, one line apart.
   *
   * ⚠ EVERY BILL FOLDS, INCLUDING A ONE-PAYMENT BILL. See `PayBill`'s own header for why the "no
   * chevron when there is nothing to hide" rule was abandoned: a two-piece bill with one left to
   * pay is indistinguishable from the single case, and any rule keyed on what is LEFT changes a
   * bill's shape as it is paid down.
   */
  function payBillHeader(bill: PayBill) {
    const shut = isShut(bill.key);
    const isOrg = bill.kind === 'org';
    /* ⚠ THE HEADER'S FIGURES ARE THE WHOLE BILL'S, never the filtered slice: "$1,550 still owing"
       must not change because the coach ticked Overdue. */
    const owing = bill.over > 0 ? bill.over : bill.owing;
    /* ⚠ ONE VARIABLE DECIDES BOTH THE CURSOR AND THE HANDLER (/review, 2026-08-20). They were two
       different conditions — the class said `canWriteMoney || !isOrg`, the handler bailed on
       `isOrg` — so a coach WITH write access got a pointer cursor and hover styling on a club bill
       that did nothing at all when clicked. A club bill has no drawer to open (it is not the team's
       record); its door is the `Club →` button in the action cell. The sibling piece row already
       derived both from one value, which is why only this row wore the false affordance.
       ⚠ Reading a bill is never gated on write — the drawer is legible to a read-only money coach,
       and it is the write CONTROLS inside it that are gated. */
    const tappable = !isOrg;
    return (
      <tr
        className={`${styles.tr} ${styles.payBillRow} ${tappable ? styles.rowTappable : ''}`}
        onClick={() => {
          if (!tappable) return;
          if (window.getSelection()?.toString()) return;
          setDrawerFor(bill.key);
        }}
      >
        <td className={`${styles.td} ${styles.payDueCell}`} data-label="Due">
          <button
            type="button"
            className={styles.payFoldBtn}
            aria-expanded={!shut}
            aria-label={`${shut ? 'Show' : 'Hide'} the payments on ${bill.description}`}
            onClick={ev => { ev.stopPropagation(); toggleFold(bill.key); }}
          >
            {shut ? <ChevronRight size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />}
          </button>
          <span className={styles.payBillDue}>
            {bill.nextDue ? fmtDate(bill.nextDue) : <span className={styles.mutedInline}>—</span>}
          </span>
        </td>
        <td className={`${styles.td} ${styles.cardStackCell}`} data-label="What">
          <span className={styles.payBillName}>{bill.description}</span>
          <span className={styles.payBillMeta}>
            {isOrg ? 'From your club' : (bill.itemName ?? bill.category ?? 'Uncategorised')}
            {/* ⚠ "4 of 6 left" ONLY WHERE THERE IS MORE THAN ONE PAYMENT. "1 of 1 left" is a phrase
                nobody would write. This is the one place a one-payment bill reads differently, and
                it is prose rather than behaviour — it still folds, opens and pays identically. */}
            {bill.pieceCount > 1 && ` · ${bill.unpaidCount} of ${bill.pieceCount} left`}
          </span>
          {bill.expense && tagChips(bill.expense.id)}
        </td>
        <td className={`${styles.td} ${styles.tdNum} ${styles.payOwingCell}`} data-label="Owing">
          <span className={`${styles.payOwing} ${bill.over > 0 ? styles.payOwingOver : ''}`}>
            {fmt(owing)}
          </span>
          {bill.over > 0
            ? <span className={styles.payTotalUnder}>over the total</span>
            : bill.paid > 0 && <span className={styles.payTotalUnder}>{fmt(bill.total)} total</span>}
        </td>
        <td className={styles.td} data-label="Status">
          {bill.nextBadge
            ? payStatusText(bill.nextBadge, bill.nextDays ?? 0, bill.nextPartly)
            : payStatusText('paid', 0, false)}
        </td>
        <td className={`${styles.td} ${styles.cardActionCell}`}>
          {/* ⚠⚠ THE PAYMENT DOOR IS ON THE HEADER ONLY WHILE THE BILL IS FOLDED, aimed at the next
              unpaid piece. Unfolded, the row directly beneath it IS that piece and carries its own
              button — two identical buttons one line apart read as a bug, not as generosity. */}
          {shut && !isOrg && canWriteMoney && bill.expense && bill.nextInstallmentId && (
            <button
              className={`${styles.btnSecondary} ${styles.block640} ${styles.compactAction}`}
              onClick={ev => {
                ev.stopPropagation();
                openRecordPayment(bill.expense!, {
                  installmentId: bill.nextInstallmentId, amount: bill.nextOwing,
                });
              }}
            >
              Record a payment
            </button>
          )}
          {isOrg && (
            /* ⚠ A CLUB BILL NAVIGATES, IT DOES NOT OPEN A DRAWER. It is not the team's record —
               it is settled through Club, which owns that conversation — so a drawer here could
               only show figures the coach cannot change. Same rule the register's derived rows
               already follow. */
            <Link
              href={moneySectionHref(base, 'club', undefined)}
              className={`${styles.btnSecondary} ${styles.block640} ${styles.compactAction}`}
              style={{ whiteSpace: 'nowrap' }}
              onClick={ev => ev.stopPropagation()}
            >
              Club →
            </Link>
          )}
        </td>
      </tr>
    );
  }

  /**
   * ONE DATED PIECE.
   *
   * ⚠ `withBill` IS THE ARRANGEMENT SPEAKING, not a different row. Grouped by commitment the bill's
   * name is on the header above, so the row leads with the piece; grouped by due date there is no
   * such header, so the row carries the bill's name and files the piece underneath it. Same record,
   * same figures, same count — which is the claim `Group by` makes.
   */
  function payPieceRow(bill: PayBill, piece: PayPiece, withBill: boolean) {
    const isOrg = bill.kind === 'org';
    const tappable = !isOrg;
    return (
      <tr
        key={piece.key}
        className={`${styles.tr} ${styles.payPieceRow} ${tappable ? styles.rowTappable : ''} ${piece.settled ? styles.payPieceSettled : ''}`}
        onClick={() => {
          if (window.getSelection()?.toString()) return;
          if (!tappable) return;
          setDrawerFor(bill.key);
        }}
      >
        <td className={`${styles.td} ${styles.payDueCell}`} data-label="Due">{fmtDate(piece.dueDate)}</td>
        <td className={`${styles.td} ${styles.cardStackCell}`} data-label="What">
          <span className={styles.payPieceName}>{withBill ? bill.description : piece.label}</span>
          <span className={styles.payPieceMeta}>
            {withBill && `${piece.label} · `}
            {isOrg ? 'From your club' : (bill.itemName ?? bill.category ?? 'Uncategorised')}
            {/* What has landed on this piece — without it, a $200 row under a $450 plan reads as a
                typo rather than as progress. */}
            {piece.applied > 0 && !piece.settled && ` · ${fmt(piece.applied)} of ${fmt(piece.faceAmount)} paid`}
          </span>
        </td>
        <td className={`${styles.td} ${styles.tdNum}`} data-label="Owing">{fmt(piece.owing)}</td>
        <td className={styles.td} data-label="Status">
          {payStatusText(piece.badge, piece.daysUntilDue, piece.partlyPaid)}
        </td>
        <td className={`${styles.td} ${styles.cardActionCell}`}>
          {/* ⚠ OFFERED ON EVERY UNSETTLED PIECE, part-paid included, with the piece's REMAINDER as
              the suggested figure — which the retired full-half door structurally could not do. */}
          {!piece.settled && !isOrg && canWriteMoney && bill.expense && (
            <button
              className={`${styles.btnSecondary} ${styles.block640} ${styles.compactAction}`}
              onClick={ev => {
                ev.stopPropagation();
                openRecordPayment(bill.expense!, {
                  installmentId: piece.installmentId, amount: piece.owing,
                });
              }}
            >
              Record a payment
            </button>
          )}
        </td>
      </tr>
    );
  }

  /**
   * ONE ROW OF THE REGISTER.
   *
   * ⚠ THE ROW DECIDES ITS OWN DOOR, and there are three. A RECORDED row (a cost, a commitment
   * piece, income, money back) opens the money form and is fully editable. A DERIVED row — dues,
   * fundraising, the club — is edited where it was MADE, so it navigates to that workspace instead:
   * the register is a view, and "one row, one source" holds precisely because it cannot write. A
   * SCHEDULED money-out row additionally offers Record a payment, pre-aimed at its own piece with
   * the remainder suggested (P2's door — Mark paid retired with the one-boolean model).
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
    /* The payment door needs the RECORD, for its description and standing. A row whose commitment
       is not in this panel's list shows no button rather than opening a modal with blanks in it. */
    const settle = r.recordPayment && record && canWriteMoney ? r.recordPayment : null;
    const overdue = r.overdueDays != null;
    /* ⚠ ONE OF THREE, ALWAYS — the same taxonomy the Status dropdown filters by
       (`registerStatusOf`), reused here rather than re-deriving the same three mutually
       exclusive states by hand a second time. */
    const rowStatus = registerStatusOf(r);
    return (
      <tr
        key={r.id}
        className={[
          styles.tr, styles.registerRowCompact,
          tappable ? styles.rowTappable : '',
          r.scheduled ? styles.registerRowScheduled : '',
          rowStatus === 'actual' ? styles.registerRowActual : '',
          rowStatus === 'overdue' ? styles.registerRowOverdue : '',
        ].filter(Boolean).join(' ')}
        onClick={tappable ? () => { if (window.getSelection()?.toString()) return; openRecord!(); } : undefined}
      >
        <td className={`${styles.td} ${styles.registerDateCell}`} data-label="Date">
          {/* ⚠ formatStoredDate, never a hand-roll — this column mixes bare dates with paid stamps
              held at org noon, and both hand-rolls have printed the wrong day already. */}
          {r.date ? fmtDate(r.date) : <span className={styles.mutedInline}>No date</span>}
        </td>
        <td className={`${styles.td} ${styles.cardStackCell}`} data-label="What">
          {r.description}
          {/* ⚠⚠ OVERDUE IS A FACT, NOT A LOCATION (reading-order ruling, follow-up to P3). This row
              sits at its own true date rather than being bucketed next to Today, so the chip is what
              tells a coach how stale it is — never "Scheduled", which reads as merely upcoming. */}
          {overdue && <> <span className={`${styles.registerChip} ${styles.registerChipOverdue}`}>Overdue · {r.overdueDays}d</span></>}
          {r.scheduled && !overdue && <> <span className={styles.registerChip}>Scheduled</span></>}
          {/* ⚠⚠ INCOME AND A REFUND SHARE THE MONEY-IN COLUMN AND ARE OPPOSITES, so the two of them
              — and only the two of them — carry their kind on the row. A $325 grant and a $325
              vendor credit are otherwise identical here, and telling them apart is the one thing
              only the coach can do. Every other kind is already named: an expense by the column it
              sits in, a derived row by the destination link beside it.
              ⚠ This is a LIST labelling its rows, which the report still may not do — a refund nets
              into the row it repaid there, leaving nothing to tag (owner ruling 2026-08-15). */}
          {(r.kind === 'income' || r.kind === 'refund') && (
            <> <span className={styles.registerChip}>{REGISTER_KIND_LABEL[r.kind]}</span></>
          )}
          {!r.movesCash && <> <span className={styles.registerChip}>No team cash</span></>}
          {/* ⚠ THE SOURCE BADGE IS GONE (reading-order ruling) — the destination link in the action
              cell already names where a derived row is from; repeating it here was the row's second
              wasted line. `detail` folds inline instead of its own line, for the same reason —
              "Recorded on this date" cost a whole row of height to say almost nothing, but a few of
              these ("Awaiting the club — they may still decline it") are real information, so the
              text survives, just compacted onto the one line the row now has. */}
          {r.detail && <span className={styles.mutedInline}> · {r.detail}</span>}
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
            className={`${styles.td} ${styles.tdNum} ${styles.registerAmt} ${r.movesCash && !overdue ? '' : styles.registerBalanceUnmoved}`}
            data-label="Balance"
            /* The chip in the What column says it in words; this says it to a screen reader
               standing on the figure itself, which is where the question actually occurs. */
            title={overdue ? 'Not yet paid — the balance is carried forward, unchanged'
              : r.movesCash ? undefined : 'A family paid this directly — the team’s cash did not move'}
          >
            {fmt(r.balance)}
          </td>
        )}
        <td className={`${styles.td} ${styles.cardActionCell}`}>
          {settle && (
            <button
              className={`${styles.btnSecondary} ${styles.block640} ${styles.compactAction}`}
              onClick={ev => { ev.stopPropagation(); openRecordPayment(record!, { installmentId: settle.installmentId, amount: settle.amount }); }}
            >
              Record a payment
            </button>
          )}
          {canWriteMoney && openRecord && !settle && (
            <RowEditButton label={`Edit ${r.description}`} onClick={openRecord} />
          )}
          {workspaceHref && (
            /* ⚠ A DERIVED ROW NAVIGATES, IT DOES NOT EDIT — and now says WHERE (reading-order
               ruling): the link names its destination instead of a generic "Open", which is also
               what lets the redundant source badge above come out. */
            /* A real control, not a bare inline link: it sits in the same action cell as Mark paid
               and the row pencil, and a 15px hit target beside two buttons is the row's one
               affordance a finger cannot find. */
            <Link
              href={workspaceHref}
              className={`${styles.btnSecondary} ${styles.block640} ${styles.compactAction}`}
              /* ⚠ NOWRAP, SCOPED TO THIS LINK ONLY. "Fundraising →" is wider than the old plain
                 "Open" ever was — without this, the arrow wraps onto its own line and drags the
                 whole (otherwise-compact) row back up to two lines tall, exactly the height this
                 pass was built to remove. */
              style={{ whiteSpace: 'nowrap' }}
              onClick={ev => ev.stopPropagation()}
            >
              {r.sourceLabel ?? 'Open'} →
            </Link>
          )}
        </td>
      </tr>
    );
  }

  /** A statement-style "Starting balance" / "Ending balance" line — the true cumulative figure,
   *  not a row of data. Replaces both the old "N rows not shown" gap message (owner call: read
   *  the balance directly, don't make a coach do the arithmetic from a count and a net) and the
   *  Today divider (owner call: unnecessary now that overdue/scheduled rows already carry their
   *  own status tag — a coach doesn't need a second cue for what day it is). */
  function registerBalanceRow(key: string, label: string, balance: number) {
    return (
      // `.tr .registerRowCompact` too — the same compound selector every data row uses for its
      // font-size/line-height/padding, so this line sits at the identical row height rather than
      // reverting to the shared (taller) `.td` default.
      <tr key={key} className={`${styles.tr} ${styles.registerRowCompact} ${styles.registerBalanceRow}`}>
        <td colSpan={6} className={styles.registerBalanceLabel}>{label}</td>
        <td className={`${styles.td} ${styles.tdNum} ${styles.registerAmt}`}>{fmt(balance)}</td>
        <td className={styles.td}></td>
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
  /* ⚠ MONEY TAGS NARROW THE PAYABLES LIST NOW. They used to be hidden on the Schedule view, because
     that view mixed two sources by due date and a tag could only ever describe one of them. The one
     list still mixes them — but a tag chip narrowing it to the team's own tagged bills is a real
     answer, and a club allocation simply carries no tag, which is a match of zero rather than a
     match of all (the same rule the register applies to its own derived rows). */
  const showTagFilter = usedTagIds.length > 0;
  const tagFilterInToolbar = showTagFilter && onPayables;

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
      {/* ⚠ STICKY ON THE REGISTER ONLY (reading-order ruling, follow-up to P3) — the one tab whose
          list can run to a season's worth of rows. Docks directly under the top strip + team
          masthead (`registerStickyBase`) — nothing else pins above it any more. */}
      <div
        ref={toolbarRef}
        className={`${styles.panelToolbar} ${!onPayables ? styles.panelToolbarSticky : ''}`}
        style={!onPayables ? { top: registerStickyBase } : undefined}
      >
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
          /* ⚠⚠ THE `Schedule | Commitments` TOGGLE IS GONE (Payables Rebuild P3, plan §3.1). It
             presented a parent and its children as two reports — the framing defect underneath all
             four of the rebuild's findings — and what replaces it is not a third tab but an
             ARRANGEMENT of one list.

             ⚠ `Group by` SITS FIRST AND IS LABELLED AS AN ARRANGEMENT (plan §7), so it can never
             read as another narrowing. Status and Item are the narrowings, and they wear the same
             pill as their Transactions siblings — one control shape across the reports. */
          <div className={styles.moneyFilterBar} style={{ marginBottom: 0 }}>
            <SingleSelectDropdown
              label="Group by"
              lead
              value={groupBy}
              options={(['commitment', 'due'] as const).map(id => ({ id, label: PAY_GROUP_BY_LABEL[id] }))}
              onChange={next => setGroupBy(next as PayGroupBy)}
            />
            {/* ⚠⚠ COUNTS ARE OF WHAT IS THERE, taken BEFORE this selection narrows further — the
                rule the old Overdue chip followed. Otherwise the numbers report themselves back
                once picked and every unticked option reads zero.
                ⚠ THEY OVERLAP, and that is correct: a late part-paid piece is counted under both
                Overdue and Partly paid (`installmentStatuses`, owner ruling 2026-08-20), so the
                four numbers sum to more than the rows on screen. */}
            <MultiSelectDropdown
              label="Status"
              options={PAYABLE_STATUS_ORDER.map(id => ({
                id, label: `${PAYABLE_STATUS_LABEL[id]} (${payStatusCounts[id]})`,
              }))}
              selected={payStatus}
              onChange={next => setPayStatus(next as Set<PayableRowStatus>)}
            />
            {payItemNames.length > 0 && (
              <MultiSelectDropdown
                label="Item"
                options={payItemNames.map(n => ({ id: n, label: n }))}
                selected={payItems}
                onChange={setPayItems}
                allLabel="Every budget item"
              />
            )}
            {payBills.length > 0 && (
              <button
                type="button"
                className={styles.moneyFilterChip}
                /* Wants-shut is the opposite of what we have; flip exactly the keys that need it,
                   which is "none" or "all" depending on the arrangement's own default. */
                onClick={() => setFlippedFolds(
                  (allFolded ? !foldDefaultShut : foldDefaultShut)
                    ? new Set()
                    : new Set(foldKeys))}
              >
                {allFolded ? 'Open all' : 'Fold all'}
              </button>
            )}
          </div>
        ) : (
          /* ⚠⚠ FILTERS, NOT SUB-TABS (plan §4.3, ruled 2026-08-16). Transactions carried Expenses
             and Money in as a second tab row; the register is ONE book, so the strip narrows what
             is on it instead of choosing between two lists. That is what lets a running balance
             exist at all — neither of the old lists could carry one, because half the money was
             always on the other. */
          <div className={styles.moneyFilterBar} style={{ marginBottom: 0, flexWrap: 'nowrap' }}>
            {/* ⚠ A DROPDOWN, NOT SEVEN PILLS (owner call — "fit like QuickBooks/Excel"; seven type
                chips plus Overdue plus the item picker plus a date range no longer fit one line as
                pills). Multi-select: pick more than one kind at once (Expenses + Refunds, say). */}
            <MultiSelectDropdown
              label="Show"
              options={registerFilters.filter(f => f.id !== 'all').map(f => ({ id: f.id, label: f.label }))}
              selected={selectedKinds}
              onChange={next => setSelectedKinds(next as Set<RegisterKind>)}
            />
            {/* ⚠⚠ A STATUS DROPDOWN, NOT TWO SEPARATE PILLS (owner call, 2026-08-19 — folds the old
                "Overdue" chip and "Include scheduled" toggle into one control, matching the same
                multi-select shape as Show and Item: three dropdowns, one date range). Counts are
                of what's THERE, computed before this selection narrows further — same rule the
                old Overdue chip's count followed, so the numbers never chase their own tail.
                ⚠⚠ DEFAULTS TO Actual + Overdue, NOT EMPTY (owner call, reversing plan §4.4's
                "on by default" for Scheduled a second time). `MultiSelectDropdown`'s own rule is
                "empty means all," but that would flip Scheduled back on by default — a call this
                project already made deliberately once. Seeding two of three keeps that default
                intact; the dropdown reads "2 selected" rather than "All" until a coach changes it,
                which is an honest description of a real, considered starting narrowing. */}
            <MultiSelectDropdown
              label="Status"
              options={REGISTER_STATUS_ORDER.map(id => ({
                id, label: `${REGISTER_STATUS_LABEL[id]} (${statusCounts[id]})`,
              }))}
              selected={selectedStatus}
              onChange={next => setSelectedStatus(next as Set<RegisterStatus>)}
            />
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
        {/* ⚠ MERGED IN (reversed 2026-08-19, reading-order ruling follow-up) — this used to be a
            second sticky row of its own, stacked below this toolbar. Two rows of filters never
            needed to be two ROWS OF STICKY CHROME; they share this one now, wrapping onto a
            second line on a narrow screen exactly like `.moneyFilterBar` above already does,
            instead of needing its own measured sticky boundary. */}
        {!onPayables && (
          <div className={styles.registerControls}>
            {/* ⚠ MULTI-SELECT, DEFAULT "ALL" (owner call, matching the type filter). Narrow to
                one or several budget words at once rather than one at a time. */}
            {registerItemNames.length > 0 && (
              <MultiSelectDropdown
                label="Item"
                options={registerItemNames.map(n => ({ id: n, label: n }))}
                selected={selectedItems}
                onChange={setSelectedItems}
                allLabel="Every budget item"
              />
            )}
            {/* ⚠⚠ THE FOURTH PILL (owner-approved mockup, 2026-08-19) — the date range wearing the
                same pill shape as Show/Status/Item, replacing the two bare date pickers that sat
                here. Presets and the custom from/to fields share ONE panel; the pill names the
                window in words. An OVERDUE row ignores the window whatever it is (the memo's own
                rule — the window trims routine history, never an open obligation); Actual and
                Scheduled rows are windowed normally. Preset choice is remembered per team, custom
                dates never are — the state block's comment carries the full argument. */}
            <DateRangeDropdown
              selection={datePreset}
              from={dateRange.from}
              to={dateRange.to}
              todayKey={dateRange.today}
              seasonBounds={dateRange.seasonBounds}
              onChange={onDateRangeChange}
            />
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
        )}
        <div className={styles.panelToolbarActions}>
          {/* ⚖ CASH ON HAND, NOW INLINE (reading-order ruling — flagged for a second look once
              real: a plain figure beside the controls may read as too easy to miss compared to
              the dedicated banner it replaced). Same disappearing rule as the Balance column —
              a narrowed TYPE filter takes it away; the date range never does. Placed beside Add,
              per the original ruling's own words — "next to Add" — rather than earning its own
              auto-margin lane, now that it's sharing a row with the actions instead of a
              standalone controls strip.
              ⚠ THE PROJECTED-BALANCE SENTENCE IS GONE (owner call, 2026-08-19) — it pushed this
              one-row toolbar onto two lines the moment "Include scheduled" was on, and staying
              one row mattered more than surfacing that number here. `book.projectedBalance`
              stays computed and used elsewhere (the Ending balance row still reflects it); only
              this inline callout was cut. */}
          {!onPayables && showBalance && book && (
            <span className={styles.registerInlineCash} data-sandbox-tour="register-balance">
              Cash on hand <b>{fmt(book.cashOnHand)}</b>
            </span>
          )}
          {/* ⚠ EXPORTS THE SUB-TAB YOU ARE ON, honouring the tag filter beside it — which is
              the whole argument for Export living down here. A hub-wide menu could only ever
              have offered "expenses and payables" as one undifferentiated lump. */}
          <MoneyExportButton
            label={onPayables
              ? (groupBy === 'due' ? 'Payment schedule' : 'Commitments')
              : registerExportLabel}
            formats={['xlsx', 'csv']}
            build={() => (!onPayables
              ? {
                  /* ⚠ THE FILE IS WHATEVER THE STRIP IS SHOWING, and that is how the two retired
                     datasets survive: `Expenses` is the register on its Expenses filter, and the old
                     `Money in` file becomes Income and Refunds separately — two files that finally
                     mean what their headings say. The filename segment follows the filter, so a
                     coach's downloads folder keeps `…-expenses-…` where it always had one. */
                  dataset: registerExportDataset,
                  title: registerExportLabel,
                  columns: REGISTER_COLUMNS,
                  /* Oldest to newest, exactly the order on screen — a file that re-sorted the rows
                     would put a projection in the middle of the settled book with a balance that
                     belongs to neither. */
                  rows: registerExportRows(bookRows, showBalance),
                  scopeLabel: assignment?.programYearName ?? '',
                  teamName: assignment?.teamName ?? '',
                  emptyMessage: 'Nothing has been recorded on this book yet.',
                }
              : groupBy === 'due'
              ? {
                  dataset: 'payment-schedule',
                  title: 'Payment Schedule',
                  columns: SCHEDULE_COLUMNS,
                  rows: scheduleExportRows(payScheduleExport),
                  scopeLabel: assignment?.programYearName ?? '',
                  teamName: assignment?.teamName ?? '',
                  emptyMessage: 'There is nothing on the payment schedule yet.',
                }
              : {
                  /* ⚠ THE DATASET NAME STAYS `payables` even though nothing on screen says the
                     word. It is the filename segment a coach's downloads folder already holds a
                     season of, and the export catalog lists it under that word — renaming the file
                     would break continuity for a screen label, which is exactly the trade plan §6
                     refused when it kept the tab called Payables.
                     ⚠ ITS COLUMNS ARE UNCHANGED THIS PHASE, Deposit/Balance included. They still
                     describe the first two installments truthfully, and coaches' own spreadsheets
                     address our columns by POSITION. They retire in P4, when six-installment bills
                     make those four headings genuinely wrong — one deliberate break, not two. */
                  dataset: 'payables',
                  title: 'Commitments',
                  columns: EXPENSE_COLUMNS,
                  rows: expenseRows(filteredActive, tagsByExpenseId, tagById, standings),
                  scopeLabel: assignment?.programYearName ?? '',
                  teamName: assignment?.teamName ?? '',
                  emptyMessage: 'No commitments have been recorded yet.',
                })}
            // Matches every sibling tab. Without it, an Export with nothing behind it reads as
            // available right up until you press it — the dialog would still explain itself,
            // but the button should not have invited the click.
            disabled={onPayables
              ? (groupBy === 'due' ? payScheduleExport.length === 0 : filteredActive.length === 0)
              : bookEmpty}
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
      ) : !onPayables ? (
        /* ── THE REGISTER (money redesign P3, plan §4) ──────────────────────────────────────
           One dated book of every dollar the season moved, with the balance beside it. The two
           lists this replaces — Expenses and Money in — could never carry a running balance
           between them, because each held half the money.

           ⚠⚠ THE CLOSING BALANCE IS CASH ON HAND. Not "about the same as"; the same number, from
           the same records, and the reason this screen reaches past what the coach typed here into
           dues, fundraising and the club. If the two ever disagree, the register is wrong by
           construction — see the header on /api/coaches/.../register. */
        <>
          {bookEmpty ? (
            <>
              <CoachEmptyState
                icon={<Receipt size={22} aria-hidden />}
                headline={noNarrowing
                  ? 'Nothing on the books yet'
                  : 'Nothing matches that'}
                description={noNarrowing
                  ? 'Every dollar this season moves — what you spend, what arrives, dues, fundraising and anything settled with the club — lands here in date order.'
                  : 'Try a wider filter, or turn on what is scheduled.'}
                primaryAction={canWriteMoney && noNarrowing ? {
                  label: 'Add Expense',
                  icon: <Plus size={15} aria-hidden />,
                  onClick: () => openAdd({ kind: 'expense', timing: 'paid' }),
                } : undefined}
                secondaryAction={canWriteMoney && noNarrowing ? {
                  label: 'Add Income',
                  icon: <Plus size={15} aria-hidden />,
                  onClick: () => openAdd({ kind: 'income', timing: 'paid' }),
                } : undefined}
              />
              {/* ⚠ THE TEACHING LIVES ON THE EMPTY STATE, NOT ON THE FORM (owner ruling 2026-08-16,
                  P2 §5). Both comparisons belong here now that one book holds both directions: which
                  tab a commitment goes on, and the three-way distinction a coach describes with one
                  sentence — income, money back, and a family paying the vendor direct. */}
              {noNarrowing && (
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
            <div className={`${styles.tableWrap} ${styles.tableAsCards} ${styles.registerTableWrap}`}>
              <table className={`${styles.table} ${styles.registerTable}`}>
                {/* ⚠ STICKY, DESKTOP ONLY (see the CSS rule's own note on why phone is excluded) —
                    each `<th>` carries its own `position: sticky`, not the `<thead>`, since a
                    `<thead>`'s default `display: table-header-group` doesn't reliably honour
                    sticky in every engine (the standard workaround, not a first guess). Docks
                    directly under the one merged toolbar above (`registerStickyBase + toolbarH`)
                    — two sticky layers total now, not the four this stack once stood on. */}
                <thead
                  className={styles.registerTheadSticky}
                  style={{ ['--register-thead-top' as string]: `calc(${registerStickyBase} + ${toolbarH}px)` }}
                >
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
                  {/* ⚠⚠ ONE CHRONOLOGICAL BOOK, OLDEST AT THE TOP (reading-order ruling, follow-up
                      to P3). `bookRows` is already in that order. A statement-style opening/closing
                      balance brackets it when a real date window is in effect (`bookStartingBalance`
                      is null during the Overdue audit view, which isn't a slice of the timeline).
                      No Today divider — a scheduled/overdue row already carries its own tag. */}
                  {showBalance && bookStartingBalance !== null
                    && registerBalanceRow('starting', 'Starting balance', bookStartingBalance)}
                  {bookRows.map(r => registerRow(r))}
                  {showBalance && bookStartingBalance !== null && bookRows.length > 0
                    && registerBalanceRow('ending', 'Ending balance', bookRows[bookRows.length - 1].balance)}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* ══ THE ONE PAYABLES LIST (Payables Rebuild P3, plan §3.1 — mockup Option B) ═══════════
           `Schedule | Commitments` is gone. One set of rows — every dated piece of everything the
           team owes — laid out either under the bill it belongs to or in one dated run. Same rows,
           same filters, both ways: that is the claim `Group by` makes out loud, and §64 Part C
           walks exactly it by counting rows across the switch.

           ⚠⚠ EVERY ROW OPENS THE DRAWER, SETTLED OR NOT. Defect 3 was that a paid row on the old
           Schedule did nothing at all while the very same record stayed fully editable one tab over
           — the screen communicating a lock the server does not enforce. There is no dead end here.

           ⚠ A BILL AND A CLUB ALLOCATION ARE BOTH BILLS, and only one of them is the team's record
           to edit. A club allocation is settled through Club, so its door is that tab rather than a
           drawer that could only show figures the coach cannot change. */
        payBillsEmpty ? (
          <>
            {scheduleError && <p className={styles.errorText}>{scheduleError}</p>}
            {/* ⚠ THE SECONDARY ACTION IS THE MANDATORY PHONE MITIGATION (ruling 2026-08-13,
                decision 4), carried across the rebuild unchanged. Import left the page header on
                phones, and the importer's paste-a-block mode exists precisely because phones have
                no file picker — so an empty state that can accept an import must keep offering one
                AT EVERY WIDTH. Do not remove it without reopening the rule. */}
            <CoachEmptyState
              icon={<Receipt size={22} aria-hidden />}
              headline={payNarrowed ? 'Nothing matches that' : 'Nothing committed yet'}
              description={payNarrowed
                ? 'Try a wider Status — the list opens on what is still owed, so anything already paid is hidden until you ask for it.'
                : "Record something you've agreed to pay — or bring a whole season's commitments in from a schedule your club already keeps."}
              primaryAction={canWriteMoney && !payNarrowed ? {
                label: 'Add a commitment',
                icon: <Plus size={15} aria-hidden />,
                onClick: () => openAdd({ kind: 'expense', timing: 'payable' }),
              } : undefined}
              secondaryAction={canWriteMoney && !payNarrowed ? {
                label: 'Import a schedule',
                icon: <Upload size={15} aria-hidden />,
                onClick: () => setImportOpen(true),
              } : undefined}
            />
            {!payNarrowed && (
              <KindCompare
                otherHref={moneySectionHref(base, 'transactions', undefined)}
                onPayables
              />
            )}
          </>
        ) : (
          <>
            {scheduleError && <p className={styles.errorText}>{scheduleError}</p>}
            <div className={`${styles.tableWrap} ${styles.tableAsCards} ${styles.payTableWrap}`}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Due</th>
                    <th className={styles.th}>What</th>
                    {/* ⚠ "Owing", NOT "Amount" (owner ruling 2026-08-20). The column carries what is
                        STILL OWED on a piece, not its face value — a $450 installment with $250
                        against it reads $200 — so a heading saying "Amount" would be describing a
                        different number from the one underneath it. A SETTLED piece keeps its face
                        value, because nothing is owed and that is the only honest figure left. */}
                    <th className={`${styles.th} ${styles.thNum}`}>Owing</th>
                    <th className={styles.th}>Status</th>
                    <th className={styles.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {groupBy === 'commitment'
                    ? payBills.map(bill => (
                        <Fragment key={bill.key}>
                          {payBillHeader(bill)}
                          {!isShut(bill.key) && bill.pieces.map(piece => payPieceRow(bill, piece, false))}
                        </Fragment>
                      ))
                    : payPeriods.map(band => (
                        <Fragment key={band.key}>
                          {/* A period band, not a bill — it carries what that period still owes and
                              nothing else, because a month is not a record you can open. */}
                          <tr className={`${styles.tr} ${styles.payBandRow}`}>
                            {/* ⚠ THE FLEX LIVES ON AN INNER DIV, NOT ON THE `<td>`. `display: flex`
                                on a table cell takes it out of the table box model, and this one
                                spans every column — the row would lose its cell and collapse. */}
                            <td className={styles.payBandCell} colSpan={5}>
                              <div className={styles.payBandInner}>
                                <button
                                  type="button"
                                  className={styles.payFoldBtn}
                                  aria-expanded={!isShut(band.key)}
                                  aria-label={`${isShut(band.key) ? 'Show' : 'Hide'} ${band.label}`}
                                  onClick={() => toggleFold(band.key)}
                                >
                                  {isShut(band.key) ? <ChevronRight size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />}
                                </button>
                                <span className={styles.payBandLabel}>{band.label}</span>
                                {band.owing > 0 && (
                                  <span className={`${styles.payBandOwing} ${band.key === '!overdue' ? styles.payOwingHot : ''}`}>
                                    {fmt(band.owing)}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                          {!isShut(band.key) && band.rows.map(({ bill, piece }) =>
                            payPieceRow(bill, piece, true))}
                        </Fragment>
                      ))}
                </tbody>
              </table>
            </div>
            <p className={styles.mutedInline} style={{ fontSize: '0.78rem', marginTop: '0.75rem' }}>
              Money going out only — each commitment’s installments{summaryHasOrgRows ? ', plus what your club has allocated to this team' : ''}.
              Player dues are money coming in and live on{' '}
              <Link href={moneySectionHref(base, 'dues', undefined)} className={styles.linkBtn}>Player Dues</Link>.
            </p>
          </>
        )
      )}

      {/* ══ THE DRAWER — the whole commitment in one panel (Payables Rebuild P3, mockup Option C) ══
          ⚠⚠ EVERY ROW OPENS IT, SETTLED OR NOT. That is defect 3 closing: on the old Schedule a paid
          row had no pencil and did not open, so the screen communicated a lock the server does not
          enforce — the record was fully editable the whole time, just only from the other tab. Edit
          and Delete are live here on a fully-paid bill, which is the no-read-only ruling of
          2026-08-16 being honoured rather than quietly re-broken.

          ⚠ ITS CONTENTS ARE P2's, MOVED. The Scheduled pieces, the Payments recorded with their
          two-tap Undo, and the Still owing figure were built as the Commitments row's "Payment
          details" expansion; nothing about the money changed in this phase, only where a coach
          finds it. */}
      {drawerBill && (
        <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (closeDrawer)?.(); }}>
          <div className={`${styles.modal} ${styles.modalScrollBody}`} onClick={e => e.stopPropagation()}>
            <CoachModalHeader
              title={drawerBill.description}
              subtitle={[drawerBill.category, drawerBill.itemName].filter(Boolean).join(' · ') || undefined}
              onClose={closeDrawer}
            />

            {drawerStanding ? (
              <div className={styles.payDrawer}>
                {/* ── The plan, piece by piece ─────────────────────────────────────────────── */}
                <p className={styles.payDrawerLabel}>
                  Scheduled{drawerStanding.installments.length > 1 ? ` — ${drawerStanding.installments.length} installments` : ''}
                </p>
                {drawerStanding.installments.map(inst => {
                  const st = installmentStatus(inst, tournamentToday());
                  return (
                    <div key={inst.id} className={styles.payDrawerLine}>
                      <span className={styles.payDrawerDate}>{fmtDate(inst.dueDate)}</span>
                      <span className={styles.payDrawerWhat}>
                        {drawerStanding.installments.length > 1
                          ? `Installment ${inst.installmentNumber}`
                          : 'One payment'}
                      </span>
                      <span className={styles.payDrawerAmt}>{fmt(inst.amount)}</span>
                      {st === 'paid' ? (
                        <span className={`${styles.payState} ${styles.payStatePaid}`}>
                          <CheckCircle2 size={11} aria-hidden /> Settled
                        </span>
                      ) : (
                        <span className={`${styles.payState} ${st === 'overdue' ? styles.payStateOverdue : styles.payStateAhead}`}>
                          {st === 'overdue' && <AlertTriangle size={11} aria-hidden />}
                          {inst.state === 'partly_paid'
                            ? `${fmt(inst.remaining)} still owing`
                            : st === 'overdue' ? 'Overdue' : 'Scheduled'}
                        </span>
                      )}
                      {st !== 'paid' && canWriteMoney && drawerBill.expense && (
                        <button
                          className={`${styles.btnSecondary} ${styles.compactAction}`}
                          onClick={() => openRecordPayment(drawerBill.expense!, {
                            installmentId: inst.id, amount: inst.remaining,
                          })}
                        >
                          Record a payment
                        </button>
                      )}
                      {/* ⚠⚠ THE SCOPED DOOR (P4, S1–S7). Changing or removing ONE payment in a
                          series is where the three-way question belongs — the form states the whole
                          plan and has nothing to ask.

                          ⚠⚠ OFFERED ON A SETTLED PIECE TOO, and nothing here is greyed out. "This
                          payment only" still edits one and the books follow — the standing owner
                          ruling of 2026-08-16, tested by QA §27 Part C. A disabled control on a
                          paid row would reverse it silently. */}
                      {canWriteMoney && drawerBill.expense && (
                        <>
                          <button
                            className={`${styles.btnGhost} ${styles.compactAction}`}
                            aria-label={`Change installment ${inst.installmentNumber}`}
                            onClick={() => setScopeEdit({
                              expense: drawerBill.expense!, installmentId: inst.id, mode: 'edit',
                            })}
                          >
                            Change
                          </button>
                          {/* R1 — a bill always has a schedule, so the last row cannot be removed.
                              Deleting the whole bill is the other action, and it gives money back. */}
                          {drawerStanding.installments.length > 1 && (
                            <button
                              className={`${styles.btnGhost} ${styles.compactAction}`}
                              aria-label={`Remove installment ${inst.installmentNumber}`}
                              onClick={() => setScopeEdit({
                                expense: drawerBill.expense!, installmentId: inst.id, mode: 'remove',
                              })}
                            >
                              Remove
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}

                {/* ── What actually happened ───────────────────────────────────────────────── */}
                {drawerStanding.payments.length > 0 && (
                  <>
                    <p className={styles.payDrawerLabel}>Payments recorded</p>
                    {drawerStanding.payments.map(p => (
                      <Fragment key={p.id}>
                        <div className={styles.payDrawerLine}>
                          <span className={styles.payDrawerDate}>{fmtDate(p.paidDate)}</span>
                          <span className={styles.payDrawerWhat}>
                            {p.method || 'Payment'}
                            {p.note ? <span className={styles.mutedInline}> · {p.note}</span> : null}
                          </span>
                          <span className={styles.payDrawerAmt}>{fmt(p.amount)}</span>
                          {/* ⚠ R5 — Undo deletes THIS payment, and the books go back by exactly its
                              amount, read from its own recorded entry. It ASKS first (below), in the
                              same named-consequence shape the Delete flow uses. */}
                          {canWriteMoney && drawerBill.expense && undoAsk !== p.id && (
                            <button
                              className={`${styles.btnSecondary} ${styles.compactAction}`}
                              aria-label={`Undo the ${fmt(p.amount)} payment`}
                              disabled={undoBusy === p.id}
                              onClick={() => setUndoAsk(p.id)}
                            >
                              {undoBusy === p.id ? 'Undoing…' : 'Undo'}
                            </button>
                          )}
                        </div>
                        {/* ⚠⚠ THE QUESTION, WITH THE FIGURE IN IT (owner, 2026-08-20). This replaced a
                            two-tap arm that re-labelled the button to "Undo $200.00?" — which reads
                            as a label rather than a question, so nothing told a coach their previous
                            click had armed anything. Same block, same wording shape and the same two
                            explicit answers as Delete, so there is ONE confirmation pattern on this
                            screen rather than two. Inline rather than a second modal: the bill panel
                            IS a modal, and stacking one on another hides the row being undone. */}
                        {undoAsk === p.id && (
                          <div className={styles.dangerConfirm} role="alertdialog"
                            aria-label={`Undo the ${fmt(p.amount)} payment?`}>
                            <p className={styles.dangerConfirmTitle}>
                              Undo the {fmt(p.amount)} payment from {fmtDate(p.paidDate)}?
                            </p>
                            {/* ⚠ NO "a family paid this" BRANCH, and its absence is a fact about the
                                product rather than an omission. This panel only ever opens a
                                COMMITMENT, and a commitment can never be paid out of pocket — the
                                form does not offer `Paid by` on one and the create route refuses it
                                ("a payable is billed to the team"). A branch here would be dead
                                code that quietly told the next reader the opposite. ⚠ If a family
                                is ever allowed to front a commitment, this sentence is one of the
                                places that has to learn about it. */}
                            <p className={styles.dangerConfirmBody}>
                              Cash on hand goes back <strong>up by {fmt(p.amount)}</strong>, and this
                              bill returns to {fmt(drawerStanding.remaining + p.amount)} still owing.
                            </p>
                            <div className={styles.dangerConfirmActions}>
                              <button className={styles.btnGhost} disabled={undoBusy === p.id}
                                onClick={() => setUndoAsk(null)}>
                                Keep it
                              </button>
                              <button className={styles.btnDanger} disabled={undoBusy === p.id}
                                onClick={() => undoPayment(drawerBill.expense!, p)}>
                                {undoBusy === p.id ? 'Undoing…' : `Undo ${fmt(p.amount)}`}
                              </button>
                            </div>
                          </div>
                        )}
                      </Fragment>
                    ))}
                  </>
                )}

                <div className={styles.payDrawerTotal}>
                  <span>{drawerStanding.over > 0 ? 'Paid over the total' : 'Still owing'}</span>
                  <strong>{fmt(drawerStanding.over > 0 ? drawerStanding.over : drawerStanding.remaining)}</strong>
                </div>

                {drawerBill.expense?.notes && (
                  <p className={styles.payDrawerNote}>{drawerBill.expense.notes}</p>
                )}
              </div>
            ) : (
              <p className={styles.mutedInline} style={{ padding: '1rem 0' }}>Loading payment details…</p>
            )}

            {canWriteMoney && drawerBill.expense && (
              <div className={styles.modalFooter}>
                {/* ⚠ EDIT AND DELETE ARE LIVE ON A SETTLED BILL. Deleting one reverses what it
                    posted and says so in dollars first — the money form's own confirmation, reached
                    through the same door, so there is one delete path rather than two. */}
                <button
                  className={styles.btnGhost}
                  onClick={() => { const e = drawerBill.expense!; closeDrawer(); openEdit(e); }}
                >
                  Edit
                </button>
                {/* ⚖ OFFERED ON ANY BILL NOW (P4). It used to appear only on a one-piece one,
                    because the plan was capped at two and the editor behind it could hold no more —
                    a button that gets refused is worse than one that is not there. The cap, the
                    two-field editor and this restriction lifted in the SAME change, deliberately:
                    a raised cap with the old editor still in place would have re-created the silent
                    truncation the cap was added to prevent. */}
                <button
                  className={styles.btnGhost}
                  onClick={() => { const e = drawerBill.expense!; closeDrawer(); openAddInstallment(e); }}
                >
                  Add an installment
                </button>
                {drawerStanding && drawerStanding.remaining > 0 && (
                  <button
                    className={styles.btnPrimary}
                    onClick={() => { const e = drawerBill.expense!; closeDrawer(); openRecordPayment(e); }}
                  >
                    Record a payment
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Changing or removing ONE scheduled payment, with a scope (P4, S1–S7) ──────────────
          ⚠ It stands OVER the drawer rather than replacing it: the coach came from a specific row
          and goes back to the same bill, with the drawer's own figures re-read behind it. The
          standing is looked up live so the sheet cannot reason about a plan a write has moved on
          from — the same rule the drawer itself follows. */}
      {scopeEdit && (() => {
        const standing = standings[scopeEdit.expense.id];
        const inst = standing?.installments.find(i => i.id === scopeEdit.installmentId);
        if (!standing || !inst) return null;
        return (
          <InstallmentScopeSheet
            orgSlug={orgSlug}
            teamId={teamId}
            expenseId={scopeEdit.expense.id}
            description={scopeEdit.expense.description}
            standing={standing}
            installment={inst}
            mode={scopeEdit.mode}
            onClose={() => setScopeEdit(null)}
            onSaved={refreshAfterWrite}
          />
        );
      })()}

      {/* ── The record form — one modal for both kinds, add and edit (Q4 + Q8) ─────────────────
          Replaces the two "Add Expense" / "Add Payable" modals that used to sit here. The type is
          a control at the top when ADDING, and a stated fact when EDITING (owner ruling: type is
          set at creation — see the note beside the switch). */}
      {formOpen && (
        <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (closeForm)?.(); }}>
          <div className={`${styles.modal} ${styles.modalScrollBody}`} onClick={e => e.stopPropagation()}>
            <CoachModalHeader
              title={{ edit: copy.editTitle, add: 'Add' }[formMode]}
              subtitle={formMode === 'add' ? 'Record money the team spent, or money that came in.' : undefined}
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
              {/* ⚠⚠ A COMMITMENT HAS NO TOTAL FIELD (R2, Payables Rebuild P4). Its total IS the sum
                  of its scheduled pieces — derived by the server, typed nowhere — and while the plan
                  could only be two pieces this box was a second way of stating the same fact that
                  the two halves already stated, drifting out of step with them the moment either
                  was typed. The schedule editor's reconcile line says what the bill comes to. */}
              {!isPayableForm && (
              <div className={styles.field}>
                <label className={styles.label}>Amount *</label>
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
              )}

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

                  ⚠ NOT ON A COMMITMENT'S OWN FORM. Its money moves payment by payment, each with
                  its own date — a paid date on the commitment itself would claim the whole thing
                  settled while pieces still think they are owed. The server refuses it.

                  ⚠ AND NOT ON A COST PAID IN PIECES (P2): several payments have no single date to
                  correct, so the field shows only on a new cost or one settled by exactly one
                  payment — the route refuses the rest, and each payment's own date is corrected by
                  undoing it and recording it again. */}
              {!isMoneyInForm && !isPayableForm
                && (!editing || (editingStanding?.payments.length ?? 0) === 1) && (
                <div className={styles.field}>
                  {/* ⚠ NO ASTERISK when recording a cost (/review, 2026-08-16): clearing it is the
                      documented way to record something not settled yet. */}
                  <label className={styles.label}>Date paid</label>
                  <input
                    className={styles.input}
                    type="date"
                    max={tournamentToday()}
                    value={form.paidDate}
                    onChange={e => setForm(f => ({ ...f, paidDate: e.target.value }))}
                  />
                  {/* ⚠ THE HINT DEPENDS ON WHO PAID (/review, 2026-08-16). "Clear this and it waits
                      as unpaid" is FALSE once Paid by names a family: that cost was settled by them,
                      the server always creates it paid — so the field dates their credit rather
                      than deciding whether one is owed. */}
                  <p className={styles.formHint}>
                    {form.paidByPlayerId
                      ? 'The day the family paid it. The team owes them from that date.'
                      : 'When the money actually left. Not paid yet? Clear this and it waits as an '
                        + 'unpaid cost until you record its payment.'}
                  </p>
                  {/* ⚠⚠ THE REFUSAL CARRIES THE DOOR, which is the whole reason it is a rendered
                      element rather than a thrown sentence. Telling a coach "that hasn't happened
                      yet" and leaving them to find Payables themselves is a dead end wearing a
                      polite face — the link takes the amount and the item they already typed
                      straight into the commitment form. */}
                  {futureDateRefused && (
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
                      {' '}— it joins your payment schedule, and nothing moves until you record a payment against it.
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

              {/* ── A commitment's schedule — 1..n dated pieces (Payables Rebuild P4) ─────────
                  ⚠⚠ THIS REPLACED THE DEPOSIT/BALANCE PAIR AND THE LONE "Due date" BESIDE IT, and
                  the three had to go together. The two-field editor was the ONLY reason a plan was
                  capped at two pieces — a longer one created through the API would be silently
                  truncated the first time a coach saved an unrelated rename — so lifting the cap
                  while leaving this editor in place would have re-created exactly the defect the cap
                  was added to prevent.

                  ⚠ NO 'Split into a deposit and a balance' TOGGLE, and none is needed: a one-payment
                  bill is a one-row schedule and "+ Add" makes it a two-row one. The disclosure
                  existed to hide four fields a simple bill did not want; a single row hides nothing.

                  ⚠ THE TOTAL FIELD IS GONE FOR A COMMITMENT (R2) — its total is the sum of its
                  pieces, derived by the server and typed nowhere. The reconcile line inside the
                  editor states it. */}
              {isPayableForm && (
                <div className={styles.formGridFull}>
                  <InstallmentPlanEditor
                    rows={formPlan}
                    onChange={setFormPlan}
                    /* ⚠ BY POSITION, from the record's own pieces in installment-number order — the
                       order the plan is WRITTEN in. Row 1 of this list becomes the piece currently
                       numbered 1, so 'position 1 is settled' is a true statement about what saving
                       will do, where 'this row is the settled one' stops being true the moment a
                       row above it is removed. */
                    positionStates={piecesByNumber(editingStanding).map(p => p.state)}
                  />
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
                    books{deletePreview.legs > 1 ? ` across ${deletePreview.legs} payments` : ''}. Deleting it will
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
                    button. (The settle mode that kept "Mark Paid" is gone — recording money is the
                    Record-a-payment modal below, whose button names its own outcome.) */}
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Record a payment (Payables Rebuild P2) — the door that replaced Mark paid ─────────
          Its own small modal: date, amount, method, note, and (optionally) which installment. A
          part payment is the ordinary case now, an over-payment saves and is stated (R6), and the
          server applies the money oldest-piece-first unless the picker says otherwise (R3). */}
      {paying && (
        <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (() => !payingBusy && setPaying(null))?.(); }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <CoachModalHeader
              title="Record a payment"
              subtitle={paying.expense.description}
              onClose={() => !payingBusy && setPaying(null)}
            />
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Date paid *</label>
                <input
                  className={styles.input}
                  type="date"
                  max={tournamentToday()}
                  value={paying.paidDate}
                  onChange={e => setPaying(p => p && ({ ...p, paidDate: e.target.value }))}
                />
                <p className={styles.formHint}>
                  The day the money actually left — back-date it and the cost lands in that month.
                </p>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Amount *</label>
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  step="0.01"
                  value={paying.amount}
                  onChange={e => setPaying(p => p && ({ ...p, amount: e.target.value }))}
                  placeholder="0.00"
                />
                {/* ⚠ R6 — MORE THAN WHAT IS OWED SAVES. The sentence states it instead of a
                    refusal: the money genuinely left, and a book that refuses reality stops
                    matching the bank statement. */}
                {(() => {
                  const standing = standings[paying.expense.id];
                  const typed = parseFloat(paying.amount);
                  if (!standing || isNaN(typed)) return null;
                  const overBy = Math.round((standing.paid + typed - standing.total) * 100) / 100;
                  return overBy > 0 ? (
                    <p className={styles.formHint}>
                      That’s {fmt(overBy)} more than what’s owed. It still saves — the record will read “{fmt(overBy)} over”.
                    </p>
                  ) : null;
                })()}
              </div>
              {/* The override (R3): where the pour STARTS. Most payments leave it on the default —
                  money fills the earliest unpaid piece and spills forward on its own. */}
              {(standings[paying.expense.id]?.installments.length ?? 0) > 1 && (
                <div className={styles.field}>
                  <label className={styles.label}>For installment</label>
                  <select
                    className={styles.select}
                    value={paying.installmentId ?? ''}
                    onChange={e => setPaying(p => p && ({ ...p, installmentId: e.target.value || null }))}
                  >
                    <option value="">Wherever it’s owed (oldest first)</option>
                    {standings[paying.expense.id]!.installments.map(inst => (
                      <option key={inst.id} value={inst.id}>
                        Installment {inst.installmentNumber} — {fmt(inst.amount)} due {fmtDate(inst.dueDate)}
                        {inst.state === 'settled' ? ' (settled)' : inst.applied > 0 ? ` (${fmt(inst.remaining)} left)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className={styles.field}>
                <label className={styles.label}>Payment Method</label>
                <PaymentMethodCombobox
                  methodsApiUrl={`/api/coaches/${orgSlug}/teams/${teamId}/payment-methods`}
                  value={paying.method}
                  onChange={v => setPaying(p => p && ({ ...p, method: v }))}
                />
              </div>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Note</label>
                <input
                  className={styles.input}
                  value={paying.note}
                  onChange={e => setPaying(p => p && ({ ...p, note: e.target.value }))}
                  placeholder="e.g. Cheque no. 114"
                />
              </div>
              {/* One line, above the buttons, saying what saving DOES — the same rule the money
                  form follows, with the out-of-pocket case telling the truth about whose money. */}
              <p className={`${styles.formHint} ${styles.formHintConsequence} ${styles.formGridFull}`}>
                {paying.expense.paidByPlayerId
                  ? <><strong>When you save:</strong> no team cash moves — a family paid this direct, and what the team owes them grows by this amount on Player Dues.</>
                  : <><strong>When you save:</strong> {fmt(parseFloat(paying.amount) || 0)} leaves the team’s books on the date above. You can undo it from the commitment’s payment details.</>}
              </p>
              {payingError && <p className={`${styles.errorText} ${styles.formGridFull}`} role="alert">{payingError}</p>}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} disabled={payingBusy} onClick={() => setPaying(null)}>Cancel</button>
              <button className={styles.btnPrimary} disabled={payingBusy} onClick={submitPayment}>
                {payingBusy ? 'Recording…' : 'Record payment'}
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
            if (face === 'payables') void loadSchedule();
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
