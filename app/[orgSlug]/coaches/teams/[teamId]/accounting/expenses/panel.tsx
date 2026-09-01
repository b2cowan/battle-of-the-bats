'use client';
import { useState, useEffect, useCallback, useMemo, useRef, use, Fragment, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Receipt, Plus, AlertTriangle, Settings2, Upload, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import BudgetItemPicker from '@/components/accounting/BudgetItemPicker';
import PayeeCombobox from '@/components/accounting/PayeeCombobox';
import PaymentMethodCombobox from '@/components/accounting/PaymentMethodCombobox';
import type { PayeeSelection } from '@/components/accounting/PayeeCombobox';
import type { PayableItem } from '@/components/accounting/UpcomingPayablesPanel';
import TagSearchCombobox from '@/components/coaches/TagSearchCombobox';
import SponsorCreditPlanEditor from '@/components/coaches/SponsorCreditPlanEditor';
import TagManagerModal from '@/components/coaches/TagManagerModal';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import CoachFormDisclosure from '@/components/coaches/CoachFormDisclosure';
import BudgetImportSheet from '@/components/coaches/BudgetImportSheet';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import { useDiscardGuard, touched, snapshotEqual } from '@/components/coaches/useDiscardGuard';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import RowEditButton from '@/components/coaches/RowEditButton';
import { ledgerReversalPreview } from '@/lib/expense-ledger';
import {
  installmentStatus, installmentStatuses, installmentLabel, PAYABLE_STATUS_LABEL, PAYABLE_STATUS_ORDER,
  PAYABLE_STATUS_DEFAULT, effectivePayerId,
  type CommitmentStanding, type AppliedPayment, type PayableRowStatus,
} from '@/lib/payable-standing';
import { whyPlanStrandsPaidMoney } from '@/lib/payable-scope-edit';
import { parseInstallmentPlan } from '@/lib/expense-ledger';
import InstallmentPlanEditor, { BLANK_PLAN_ROW, type PlanRow } from '../InstallmentPlanEditor';
import InstallmentScopeSheet from '../InstallmentScopeSheet';
import DateField from '../DateField';
import CommitmentView from '../CommitmentView';
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
import CoachLoadError from '@/components/coaches/CoachLoadError';
import CoachLoading from '@/components/coaches/CoachLoading';
import styles from '../../../../coaches.module.css';
import type {
  RepTeamExpense, RepTeamTag, BudgetCategoryWithItems, RepBudgetPlan, RepRosterPlayer,
  RepTeamMoneyIn, DuesPaymentMethod,
} from '@/lib/types';
import { DUES_PAYMENT_METHODS, DUES_PAYMENT_METHOD_LABEL } from '@/lib/types';
import {
  useRecordMoneySignal, type ConversationBranch, type RecordMoneyIntent,
} from '@/lib/coach-record-money';
import { formatPlayerLastFirst, formatPlayerFirstLast } from '@/lib/player-name';
import DuesMethodSelect from '@/components/coaches/DuesMethodSelect';
import { fetchAccountingSettings } from '@/lib/coach-accounting-settings';
import { type CreditUnit } from '@/lib/coach-fundraising';
import { accrueArrival, deriveAllArrivalCredits, creditPlanProblem, stillToCome } from '@/lib/sponsor-arrivals';
import { isFundingKind } from '@/lib/coach-budget-totals';
import { formatMonthLong, monthKeyOf } from '@/lib/coach-budget-months';
import { toggleKey } from '@/lib/toggle-key';
import { useMoneyRevision, useBumpMoneyRevision, useOnMoneyRevisionBump, useSharedMoneyRead } from '@/lib/coach-money-refresh';
import {
  formatStoredDate, tournamentToday, addCalendarDays, daysBetweenDateStrings,
} from '@/lib/timezone';
import { taxonomyKey } from '@/lib/coach-money-derived';
/* The one "what lands beyond what is owed" rule — shared with the dues receipt book, cents-safe. */
import { overpaymentExcess } from '@/lib/dues-payments';
import { futureReceivedDateRefusal, moneyMovedMaxDate } from '@/lib/money-date-guards';
/* ⚰ The "Where it lands" preview imports left with the preview (owner ruling 2026-08-31 —
   see the note where it used to render, in the drive branch). */
/* ⚠ `MONEY_IN_SOURCES` / `MONEY_IN_SOURCE_LABEL` ARE NO LONGER IMPORTED — the "Who paid it back"
   select they rendered is gone (P2 §2.4). The constants stay in the module: the route still
   validates against them, so a saved label survives an edit and an export. */
import { moneyInReversalPreview } from '@/lib/coach-money-in';

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * How a re-read of this screen ended, and **`superseded` is not a failure**.
 *
 * A boolean used to carry this, and the two falsy meanings — *it broke* and *something newer
 * overtook it* — got the same treatment: the "could not be refreshed" banner. Part B's autosave
 * made overlapping re-reads ordinary and the lie became visible. See `load`'s sequence bail.
 */
type LoadOutcome = 'ok' | 'superseded' | 'failed';

/** Cent-round for a consequence SENTENCE — display arithmetic only, never a stored figure. */
function r2c(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * "Summer Classic" / "Summer Classic or Fall Cup" / "A, B or C" — the tag filter's sentence.
 *
 * ⚠ OR, NOT AND, and that is the semantics rather than the prose: ticking two tags WIDENS the
 * answer to both occasions (see `filterTagIds`), so "and" would describe a narrowing the pill does
 * not do.
 *
 * ⚠ KNOWN DUPLICATION, LEFT DELIBERATELY (`/simplify` reuse lens, 2026-08-25). This exact
 * `slice(0,-1).join(', ') + conjunction + last` shape now exists NINE times in this repo — private
 * `joinNames` helpers in `lib/coach-dues-statement.ts` and `lib/coach-family-dues.ts`, plus inline
 * copies in `lib/walkthrough-derive.ts`, `lib/rep-practice-plan.ts`, `lib/payable-scope-edit.ts`,
 * `lib/coach-budget-item-usage.ts`, `lib/export/pdf.ts` and `components/notifications/
 * FanAlertsCard.tsx`. None is exported and every one is "and"-only. The fix that actually pays is
 * ONE exported `joinList(items, conjunction)` and a migration of all nine — which is a job of its
 * own, not something to smuggle into a tags phase, and a new shared module used by a single caller
 * would relocate three lines while reducing nothing. Recorded here so the tenth author finds the
 * count instead of rediscovering it.
 */
function joinWithOr(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
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
 * Expense or bill? — under both empty states.
 *
 * ⚠ THE TWO NOW LIVE ON DIFFERENT VIEWS OF ONE LEDGER (fold, 2026-08-28 — they were different
 * TABS from the 2026-08-16 split until then). The quick test still names where the other one
 * reads, because a coach on the wrong view needs to be told where to look, not merely what a
 * thing is called. This block is also the two-doors teaching moment the fold mockup drew: it is
 * the one place both doors face a coach with room for a sentence each.
 */
function KindCompare({ otherHref, onPayables }: { otherHref: string; onPayables: boolean }) {
  return (
    <KindComparePanel
      cards={[
        {
          title: 'Record — money that moved',
          body: <>Money that has <strong>already left</strong> the team (or arrived) — you&apos;re writing down what happened.</>,
          examples: 'Pizza night · a diamond you rented last week · dues a family e-transferred',
        },
        {
          title: 'A bill — money you’ll owe',
          body: <>Money you&apos;ve <strong>agreed to pay but haven&apos;t</strong> — nothing moves today; it joins your payment schedule.</>,
          examples: 'A tournament entry due in March · a dome block · an umpire invoice',
        },
      ]}
      test={<>
        <strong>The quick test:</strong> if it has a due date and nothing has been paid, it&apos;s a bill — read those in{' '}
        {onPayables
          ? <>this view. Money that has already moved is on the <Link href={otherHref} className={styles.linkBtn}>Timeline</Link>.</>
          : <>the <Link href={otherHref} className={styles.linkBtn}>Bills</Link> view, with your payment schedule.</>}
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
 * ⚖⚖ THE TWO TABS BECAME ONE LEDGER WITH THREE VIEWS (Payables→Ledger fold, owner-approved
 * 2026-08-28 — COACH_PAYABLES_LEDGER_FOLD_PLAN.md). The `face` prop is GONE: Transactions and
 * Payables were already one component reading one set of records, and the tab boundary was the
 * last thing making them feel like two products. What replaces it is a page-level **View**
 * arrangement — `timeline` (the dated register), `bills` (grouped by bill), `due` (the payment
 * schedule) — promoted from the owed list's own `Group by`. One mounted instance now serves all
 * three, which also retires the double-mount hazards this file used to guard against by face.
 */
type LedgerView = 'timeline' | 'bills' | 'due';
/* ⚖ PLACE-NAMES, NOT SORT ORDERS (owner, fold round 3, 2026-08-28 — "I kind of like A and C").
   "By bill" read like an arrangement; "Bills" reads like the home it actually is — where owed
   money is added, imported, chased and opened. "Payment schedule" is the phrase the product has
   taught everywhere since the rebuild, and it matches that view's own export title. */
const LEDGER_VIEW_LABEL: Record<LedgerView, string> = {
  timeline: 'Timeline',
  bills: 'Bills',
  due: 'Payment schedule',
};
/** The view is REMEMBERED per team on this device (fold decision 3, owner 2026-08-28) — exactly
 *  the Date preset's storage pattern: a treasurer-ish coach who lives in By bill lands there next
 *  visit, which is most of the answer to retiring the dedicated Payables tab. */
const ledgerViewStorageKey = (teamId: string) => `flhq-coach-ledger-view:${teamId}`;
function isLedgerView(v: string | null): v is LedgerView {
  return v === 'timeline' || v === 'bills' || v === 'due';
}

/**
 * ⚖ A SHORT HISTORY OF THIS FILE'S GEOGRAPHY, because three generations of names survive in its
 * comments: the 2026-08-16 split made ONE screen into TWO tabs (Transactions / Payables) sharing
 * this component behind a `face` prop; the Payables Rebuild deleted the sub-view concept
 * (`ExpenseTab`/`goToTab`) as a dead abstraction; and the 2026-08-28 fold made the two tabs ONE
 * Ledger again — `view` is the page's arrangement, `groupBy` derives from it for the owed list's
 * machinery, and there is no third thing. Where an older comment says "face" or "the Payables
 * tab", read "the owed views"; where it says "Transactions", read "the Timeline".
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

/** The retired sub-view names, as VIEWS of the one ledger. ⚠ `?tab=schedule` was a LIVE URL
 *  CONTRACT for years (the Money hub's "See full schedule", Budget vs. Actual's Scheduled
 *  drill-in, the legacy-address mapper, the UAT smoke spec) — `?view=` is the fold's replacement,
 *  and every legacy `?tab=` value still lands honestly on the view it always meant. */
const TAB_AS_VIEW: Record<string, LedgerView> = {
  schedule: 'due',
  commitments: 'bills',
  payables: 'bills',
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
  /* ⚖ THE RECORD IS A BILL (fold decision 6A, owner 2026-08-28). "Commitment" and "bill" were two
     names for one object — the Record picker already said "Bills you owe" — and the fold's word
     sweep converged on the one a treasurer actually says. The internal identifiers (`payable`,
     `tournament_payable`, the export dataset) are identifiers, not prose, and stay. */
  payable: {
    editTitle: 'Edit bill',
    noun: 'bill',
    statedFact: 'A bill — money the team owes but has not paid.',
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

/* ═══════════════════════════════════════════════════════════════════════════════════════════
   THE ONE RECORDING CONVERSATION (money centralization P1 — owner-approved spec 2026-08-22:
   mockups 01/02 + supplementary frames A–D; COACH_MONEY_CENTRALIZATION_BUILD_PROMPT.md).

   The form's first question is now a FIELD ON THE FORM — "What happened?", a dropdown whose open
   state carries the eight coach sentences in two groups with live hints. It replaced the
   Expense/Income pills and the refund tick: refund is a first-class answer now, and the
   paid/owed fork ("Has it been paid?") moved INSIDE the cost branch, so Transactions-vs-Payables
   stops being a question the coach answers by picking a tab.

   ⚠ THE FIVE NEW BRANCHES ADD NO WRITE PATHS. Dues receipts, drive amounts, club settlements and
   payouts each POST/PATCH the exact route their home tab has always used, so the register derives
   each record exactly as if it were logged from that tab; the sponsor answer HANDS OFF to the
   Fundraising tab's own sponsor form (a sponsor's money is recorded at the sponsor's creation —
   there is no second sponsor writer).

   ⚠ SWITCHING THE ANSWER MID-ENTRY KEEPS amount/date/how/note AND RESETS the branch's own
   question (frame C, binding) — pre-filling "which player" into "which item" would file money
   against the wrong thing.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
/* ⚠ THE UNION MOVED TO `lib/coach-record-money` (P2): the doors that name a branch live on other
   panels now, and a door importing a type from a 5,000-line sibling panel is how a shared vocabulary
   ends up copied. The TABLE below — the copy, the groups, the writers — stays here.
   ⚠ The money-out ledger answer is `spend`, NOT `cost` — `cost`, `funding` and `sponsorship` are
   budget-LINE kinds, and the budget-line-kind guard test bans comparing them to literals in any
   file that touches the kind (this one does). The guard caught exactly that on first build. */

/**
 * THE ONE BRANCH TABLE — everything an answer is, in the exact order mockup 01 draws them.
 * The chooser's two groups, the direct-writer set, the ledger side and the guard noun are all
 * DERIVED below: five parallel lists keyed by the same union is how a ninth answer would reach
 * four of them and silently miss the fifth (/simplify, 2026-08-23). A missing key here is a
 * compile error, which is the same lesson FORM_COPY already encodes two screens up.
 */
const CONV_BRANCH: Record<ConversationBranch, {
  /** The chosen sentence, exactly as mockup 01 words it — doubles as the modal subtitle. */
  name: string;
  /** Which chooser group it draws under. */
  group: 'in' | 'out';
  /** The drawn sub-line under the sentence. Live hints attach in render from the hub summary. */
  sub: string;
  /** LEDGER answers file on a side of the books — the mig 246 item-clearing rule reads this;
   *  answers with no item to clear carry none. */
  side?: 'in' | 'out';
  /** Submits through its HOME TAB's writer instead of this form's ledger save. */
  direct?: true;
  /** What the discard guard calls a half-entered record. Ledger answers use FORM_COPY. */
  noun?: string;
}> = {
  dues:       { name: 'A family paid their dues',        group: 'in',  sub: "Lands on that player's bill",            direct: true, noun: 'payment' },
  drive:      { name: 'Fundraiser money came in',        group: 'in',  sub: 'Logged to a drive, counts for a player', direct: true, noun: 'fundraiser amount' },
  sponsor:    { name: 'A sponsor came through',          group: 'in',  sub: 'A business or grant gave directly',      direct: true, noun: 'sponsor' },
  refund:     { name: 'Money back on something we paid', group: 'in',  sub: 'A refund against a cost on the books',   side: 'out' },
  'other-in': { name: 'Other money in',                  group: 'in',  sub: 'Interest, a grant, anything else',       side: 'in' },
  spend:      { name: 'We paid for something',           group: 'out', sub: 'Paid already — or owed on a schedule',   side: 'out' },
  club:       { name: 'We settled up with the club',     group: 'out', sub: 'Pay down what the club has billed',      direct: true, noun: 'settlement' },
  payout:     { name: 'We paid a family back',           group: 'out', sub: 'Return credit a family has built up',    direct: true, noun: 'payout' },
};
const CONV_IDS = Object.keys(CONV_BRANCH) as ConversationBranch[];
/** The chooser's two groups (mockup 01) — derived; the table's order is the drawn order.
 *  The club answer only exists on an org-linked team (filtered in render). */
const CONV_GROUPS = [
  { label: 'Money came in',  options: CONV_IDS.filter(id => CONV_BRANCH[id].group === 'in') },
  { label: 'Money went out', options: CONV_IDS.filter(id => CONV_BRANCH[id].group === 'out') },
];
/** The hand-off row's words — an ANSWER to "What happened?", not an instruction (owner,
 *  2026-08-29, replacing "We'll owe this later — set up a bill"): what happened is the team took
 *  on the obligation, which is a real event even though no money moved — the same grammar the
 *  refusal already speaks ("Money you've agreed to pay later is a bill"). Named here because two
 *  renders read it: the dropdown's row, and the field's standing answer on a handed-off bill
 *  form. */
const BILL_HAND_OFF_ROW = {
  name: 'We agreed to pay something later',
  sub: 'Nothing moves today — set up a bill on your payment schedule.',
};
/** The answers that submit through their own home-tab writer instead of this form's ledger save. */
const CONV_DIRECT = new Set<ConversationBranch>(CONV_IDS.filter(id => CONV_BRANCH[id].direct));
/** Which side of the books a LEDGER answer files under, or null for the rest. */
function ledgerSideOf(b: ConversationBranch | null): 'in' | 'out' | null {
  return (b && CONV_BRANCH[b].side) || null;
}

/** Branch questions — one flat object so `touched()` can compare it for the discard guard.
 *  ⚠ Methods live here (stored enum tokens), not in `form.paymentMethod` (free text). */
const BLANK_CONV = {
  duesPlayerId: '',
  duesMethod: 'etransfer' as DuesPaymentMethod,
  driveId: '',
  drivePlayerId: '',
  clubInstallmentId: '',   // `${splitId}:${installmentId}`
  payoutPlayerId: '',
  payoutMethod: 'etransfer' as DuesPaymentMethod,
  /* The sponsor branch records the sponsor INLINE through the same creation POST the Fundraising
     door uses (owner UX ruling 2026-08-23, §80 walk — the original hand-off navigated tabs and
     opened a second modal that re-asked the already-answered question). Received-only: a PLEDGE
     is an expectation and stays on Fundraising. The credit is a PLAN of family rows (Q16,
     2026-08-28) held in its OWN array state beside this object — `touched()` compares flat. */
  sponsorName: '',
  sponsorMethod: '' as DuesPaymentMethod | '',
  /** An EXISTING sponsor (mig 268): set by the band row's locked door OR by the cold picker
   *  below, turning this branch from *create a sponsor* into *record an ARRIVAL against it* —
   *  same fields, the stored credit plan earning as the money lands, POSTed to the arrivals
   *  route. */
  sponsorId: '',
  /** The cold branch's own answer to "which sponsor?" (Direction A, 2026-08-29): '' =
   *  unanswered, 'new' = a sponsor this cheque creates, otherwise an existing sponsor's id
   *  (kept in step with sponsorId). A door's lock never sets this — a locked door has already
   *  answered. */
  sponsorPicked: '',
  /* ── Paying down a bill the team already owes (money centralization P2, owner ruling C2) ─────
     Set when the "we paid for something" picker's FIRST group — "Bills you owe" — is what the
     coach chose. It turns the branch from *create a cost* into *record a payment against this
     commitment*, submitting through the payments route the bill's own door has always used.
     ⚠ MUTUALLY EXCLUSIVE WITH `form.budgetItemId`: one field asks the question, so choosing from
     either group clears the other. A record filed against both would be a cost and a payment at
     once, which is not a thing the books have a shape for.
     ⚠ `spendInstallmentId` is ALLOCATION, not identity — it is the coach's override for where the
     money lands (R3), and it stays editable even at a door that locks everything else (owner
     ruling A, 2026-08-23). '' = wherever it is owed, oldest first. */
  spendExpenseId: '',
  spendInstallmentId: '',
};

interface ConvDuesPlayer { id: string; name: string; outstanding: number; payableNow: number }
interface ConvDrive { id: string; name: string }
interface ConvDriveDetail {
  rebatePercent: number;
  players: {
    playerId: string;
    playerName: string;
    logged: number | null;
  }[];
}
interface ConvClubBill {
  splitId: string; installmentId: string; description: string; amount: number; dueDate: string;
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

/** The one Ledger tab — the whole money book (Payables→Ledger fold, 2026-08-28). Three views of
 *  one set of records: the dated register, the bills grouped, the payment schedule. The two
 *  wrapper exports this replaced (`TransactionsPanel` / `PayablesPanel`) are gone with the tab. */
export function LedgerPanel(props: MoneyPanelProps) {
  return <MoneyRecordsPanel {...props} />;
}

function MoneyRecordsPanel({
  params: paramsPromise,
  embedded = false,
  tabActive = true,
}: MoneyPanelProps) {
  const params = use(paramsPromise);
  const { orgSlug, teamId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();
  /** Which VIEW of the book is on screen. Seeded from this device's memory for the team (decision
   *  3); `?view=` / legacy `?tab=` deep links override it reactively below. */
  const [view, setView] = useState<LedgerView>(() => {
    try {
      const saved = typeof window !== 'undefined'
        ? window.localStorage.getItem(ledgerViewStorageKey(teamId)) : null;
      return isLedgerView(saved) ? saved : 'timeline';
    } catch { return 'timeline'; }
  });
  // Remember where the coach reads their book — same per-team pattern as the Date preset.
  useEffect(() => {
    try { window.localStorage.setItem(ledgerViewStorageKey(teamId), view); } catch { /* fine */ }
  }, [view, teamId]);
  /** ⚠ Is an OWED view on screen (bills / due)? Said ONCE and said EARLY — this was the two-tab
   *  era's `onPayables` face flag, and every branch below still reads it: the owed views render
   *  the bills list, the timeline renders the register. The NAME survives the fold on purpose —
   *  renaming 35 sites while folding them is how a subtle miss ships. */
  const onPayables = view !== 'timeline';

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

  /* ── The one owed-money list (Rebuild P3; arrangement folded into `view` 2026-08-28) ──────────
     ⚠ `expandedPayable` IS GONE. It held ONE open row at a time, because the deposit/balance pair
     it revealed was tall enough that a list with every row open was the card list it replaced. The
     detail it showed is the DRAWER now (`drawerFor`), so what folds here is the opposite thing: a
     bill's own installments, several at a time, as a way of clearing what you have dealt with. */
  /** The owed list's arrangement, DERIVED from the page view — `Group by` stopped being its own
   *  control when it became two of the View pill's three options. `PayGroupBy` survives because
   *  the fold/export/band machinery below is written in its vocabulary. */
  const groupBy: PayGroupBy = view === 'due' ? 'due' : 'commitment';
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
  /**
   * ⚖⚖ WHICH COMMITMENT THIS PANEL IS SHOWING — and it comes from the ROUTE now, not from state
   * (owner ruling 2026-08-26; a commitment is a page).
   *
   * ⚠ THE `returnToDrawerRef` BOOKKEEPING THAT USED TO LIVE HERE IS DELETED, and its deletion is
   * the point. It existed because every footer action closed the drawer to make room for its own
   * modal, so cancelling out of Edit dropped the coach on the list — and the fix was to remember
   * where they had been and put it back. That is navigation history, rebuilt by hand, because the
   * container had none. A page has it for free, browser Back included. The workaround outlived its
   * cause by four days.
   */


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
    /** What the season was HANDED on day one (mig 262) — money carried forward at Start next
     *  season. Not a row and never a row: it is where the running balance starts. */
    opening?: number;
    openingFrom?: string | null;
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
   * Did the bill form open via the conversation's hand-off (the "What happened?" row or the
   * future-date refusal), rather than through one of the bill's own doors?
   *
   * ⚖ WHAT IT GATES (owner, 2026-08-29): a handed-off coach keeps the "What happened?" control,
   * with the bill row as its standing answer — every OTHER answer in that dropdown is revisable
   * in place, and the hand-off was the one choice a coach could not take back without Cancel
   * discarding their typing. Ruling B2 is untouched where it actually rules: the toolbar's Add a
   * bill asked no question, so it still shows none — this flag is false there.
   */
  const [billHandOff, setBillHandOff] = useState(false);
  /**
   * Which scheduled piece the coach is changing or removing, and which of the two they asked for.
   *
   * ⚠ THE SCOPED DOOR IS THE DRAWER'S, NOT THE FORM'S, and the split is deliberate. The form states
   * the WHOLE plan — every row visible — so there is no question about reach and no scope to ask
   * for. This one changes ONE row and therefore has to ask how far that goes (S1–S7).
   */
  const [scopeEdit, setScopeEdit] = useState<
    { expense: RepTeamExpense; installmentId: string; mode: 'edit' | 'remove' } | null>(null);
  /* ⚖ THE `paying` STATE IS GONE WITH ITS MODAL (money centralization P2, 2026-08-23). A payment
     against a commitment is recorded in the ONE conversation now, so the fields live in `form` and
     `conv` like every other answer, and the door only has to say which bill — see
     `openRecordPayment`. What has NOT changed is the model the Payables Rebuild set: a payment is
     still its own record, POSTed to the payments sub-route, never a PATCH stamping the commitment;
     the register renders one row per payment and the commitment's standing re-reads. */
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
  /**
   * WHAT THE FORM LOOKED LIKE when the last refusal was raised (owner, §80 walk 2026-08-23:
   * "Pick which player" kept glowing over a form where the player WAS picked). A refusal
   * describes one save ATTEMPT; the moment any input changes, it is stale and clears — the
   * render-phase change-guard adjustment below, the same sanctioned pattern the hub page uses.
   * Save again for a fresh verdict. Identities, not deep compares: every setter replaces.
   */
  const [saveErrorSnapshot, setSaveErrorSnapshot] = useState<{
    form: unknown; conv: unknown; plan: unknown; payee: unknown; tags: unknown; timing: unknown;
  } | null>(null);
  /** Was the last save refused for a future date? Its own flag rather than a longer sentence,
   *  because the answer needs a LINK to the commitment door and a thrown message cannot carry one. */
  const [futureDateRefused, setFutureDateRefused] = useState(false);
  /* ⚠ `marking` AND `paidPrompt` ARE GONE with the inline date prompt they served (money redesign
     P3) — see the note where `doAction` used to be. Every Mark paid opens the money form now, and
     the form has its own busy state, so a second per-row one would have been a spinner nothing
     could turn off. */

  /* Money tags — the team + org-shared expense-tag library, which tags each expense carries,
     per-form selections, the filter pill, inline re-tag, and the manager modal.

     ⚠ A TAG IS THE OCCASION A BUDGET ITEM CANNOT EXPRESS (owner ruling, money centralization
     plan §5.3): the item says WHAT KIND of cost, the tag says WHICH OCCASION — and the question
     tags exist to answer is "what did the Summer Classic actually cost us?" That sentence is the
     whole spec, and it is why the filter must always state a TOTAL: a narrowed list that makes a
     coach add the rows up themselves has not answered it. */
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
  /**
   * ⚖ SEVERAL TAGS AT ONCE, EMPTY = ALL (owner call, money centralization P3, 2026-08-25). This
   * was a single `filterTagId` behind a row of one-at-a-time chips; it is now the same
   * multi-select contract every other control on this toolbar speaks, because the pill it became
   * is `MultiSelectDropdown` — and a checkbox list that only lets you tick one is a radio button
   * wearing the wrong clothes.
   *
   * ⚠ THE TAGS ARE OR-ed, NOT AND-ed. Tick Summer Classic and Fall Cup and you get the costs of
   * BOTH occasions, which is the reading the total then states. A cost carrying both tags is
   * still one row and is counted once — the match is per row, so nothing double-counts.
   *
   * ⚠ NOT PERSISTED, deliberately. Show/Status/Item and the date preset are remembered per team;
   * an occasion filter is a question a coach asks once, and a remembered one would greet them
   * with a book that silently omits most of the season. (It also keeps the deep-link debt the
   * date pill created from spreading — memory: persisted filters create deep-link debt.)
   */
  const [filterTagIds, setFilterTagIds] = useState<Set<string>>(() => new Set());
  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  /* ── The conversation's own state (P1 — see the block comment above CONV_BRANCH) ──────────────
     `convBranch` is the answer to "What happened?" in ADD mode; null = not answered yet, which is
     the cold open (frame A: the dropdown starts open). An EDIT never reads it — a saved record's
     kind is stated, not switchable, exactly as before. */
  const [convBranch, setConvBranch] = useState<ConversationBranch | null>(null);
  /**
   * ⚠⚠ WHAT A CONTEXT DOOR ANSWERED, STATED RATHER THAN OFFERED (owner ruling A, 2026-08-23 —
   * this SUPERSEDES frame D's "changeable like any field", which was written for the cold open).
   *
   * A door that names one RECORD locks; a door that names a SCREEN only suggests. Standing on
   * Jenny's row, switching the question to "we paid for something" and saving filed money against
   * dome rentals while nothing on the page behind the modal changed — a ghost save, and the coach's
   * only clue was that Jenny's figures had not moved.
   *
   * Rendered as ONE stated band at the top of the form — the owner's treatment ii, taken against
   * his own dropdown convention with the reason recorded: *"the items are read only anyway"*, and a
   * dropdown that cannot be opened is a control lying about itself. This is mockup 02's who-line
   * returning in the one place it makes sense, WITHOUT its "Change" hatch: the escape from a wrong
   * door is Cancel and reopen.
   */
  const [convLock, setConvLock] = useState<{ subject: string; detail?: string } | null>(null);
  const [whatOpen, setWhatOpen] = useState(false);
  /** The "What happened?" field + its open list — outside-press closes the list. */
  const whatWrapRef = useRef<HTMLDivElement>(null);
  /** Where the FIXED list anchors — the field's rect, measured at the moment of opening. Fixed
   *  positioning is what lets a real dropdown float over the form without the modal's scroll
   *  region clipping it OR the modal changing size (owner, §80 walk — both were tried, both
   *  rejected on sight). */
  const [whatRect, setWhatRect] = useState<{ top: number; left: number; width: number } | null>(null);
  /* ⚠ A LISTENER, NOT A BACKDROP (/review, 2026-08-23 — Medium). The first cut rendered a fixed
     full-viewport click-catcher under the list, and it swallowed the coach's actual click: aiming
     at Cancel while the list was open closed the list and did nothing else — a first-click-does-
     nothing bug on a form's own buttons. A capture-phase pointerdown that merely CLOSES (never
     preventDefault) lets that same press also reach whatever it was aimed at.
     ⚠ Scroll closes it too (capture phase; the list's own internal scroll excepted): a fixed
     list can't follow a scrolling anchor, and closing is what every dropdown in the product
     does rather than drifting detached. */
  useEffect(() => {
    if (!whatOpen) return;
    const close = (e: Event) => {
      if (!whatWrapRef.current?.contains(e.target as Node)) setWhatOpen(false);
    };
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('scroll', close, true);
    window.addEventListener('resize', close as EventListener);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close as EventListener);
    };
  }, [whatOpen]);
  const [conv, setConv] = useState(BLANK_CONV);
  const [convOpenedWith, setConvOpenedWith] = useState(BLANK_CONV);
  /* Branch working data — fetched fresh each time its branch is chosen (user-triggered, so a
     write on another surface can never leave a stale picker), never on mount. ⚠ These are the
     branch's OWN reads, the same ones its home tab does; the CHOOSER's hints deliberately come
     from the hub summary instead (build prompt §2.8 — no per-open probe fan-out). */
  const [duesBook, setDuesBook] = useState<ConvDuesPlayer[] | null>(null);
  const [duesBookError, setDuesBookError] = useState('');
  const [drives, setDrives] = useState<ConvDrive[] | null>(null);
  const [drivesError, setDrivesError] = useState('');
  const [driveDetail, setDriveDetail] = useState<Record<string, ConvDriveDetail>>({});
  /** ⚠ The LEADERBOARD's own failure slot (/review, 2026-08-23 — Medium): written into
   *  `drivesError` it replaced the working drive picker with an error, and the player section
   *  sat on "Loading…" forever with no retry. Its message renders beside a Try-again link. */
  const [driveDetailError, setDriveDetailError] = useState('');
  const [clubBills, setClubBills] = useState<ConvClubBill[] | null>(null);
  const [clubBillsError, setClubBillsError] = useState('');
  /** The team's standard player-credit share, for the sponsor branch — fetched once per open so
   *  a conversation-recorded sponsor credits EXACTLY what the Fundraising door would have. */
  const [sponsorDefaultPct, setSponsorDefaultPct] = useState<number | null>(null);
  /** The sponsor branch's credit-family rows (Q16) — an ARRAY, so its own state + snapshot
   *  baseline, the formPlan idiom exactly. */
  const [convSponsorPlan, setConvSponsorPlan] = useState<{ playerId: string; value: string; unit: CreditUnit }[]>([]);
  const [convSponsorPlanOpenedWith, setConvSponsorPlanOpenedWith] = useState<{ playerId: string; value: string; unit: CreditUnit }[]>([]);
  /** The cold picker's choices (Direction A): every sponsor this season, promises first — so
   *  "which sponsor came through?" is answered from a list, and a NEW name is one option, not a
   *  separate form. Null until the branch is first opened. */
  const [convSponsors, setConvSponsors] = useState<{ id: string; name: string; stillToCome: number }[] | null>(null);
  /** The locked door's target (mig 268): the sponsor's plan, pledge and arrivals, fetched once
   *  per open so the consequence line can do the accrual arithmetic the save will do. */
  const [convSponsorTarget, setConvSponsorTarget] = useState<{
    id: string; name: string; pledged: number | null; arrived: number;
    arrivalAmounts: number[]; plan: { playerId: string; value: number; unit: 'amount' | 'percent' }[];
  } | null>(null);
  /**
   * ⚠⚠ THE GENERATION LATCH the four branch loaders bail on (/review, 2026-08-23 — High).
   * `resetForm` bumps it; a response from a PREVIOUS form session that lands after the reset (or
   * after a reopen) is dropped instead of repopulating state the reset just cleared — without
   * this, the `=== null` fetch guards then see "already loaded" and the picker silently shows a
   * dead session's figures, defeating the fetch-fresh-per-open design outright. Same disease,
   * same cure as `loadSeq`/`scheduleSeq` a screen up; a ref, because bumping must never render.
   */
  const convLoadGen = useRef(0);
  /* The bump lives HERE, not in resetForm (which the render phase can reach — see its note):
     every close path flips formOpen false, and an effect may write a ref. In-flight responses
     from the closed session bail on the stale generation. */
  useEffect(() => {
    if (!formOpen) convLoadGen.current += 1;
  }, [formOpen]);

  /* ⚖ `openCommitmentsRef` IS GONE (2026-08-27), and its headstone is the lesson. It existed for
     ONE caller — an amount suggestion applied during render — and it shipped a crash:
     *"Cannot access 'openCommitmentsRef' before initialization"*, because the ref was declared
     beside the list it mirrored, hundreds of lines BELOW the render-phase handler that read it.
     **A ref's VALUE is safe to read at any time; its BINDING is not** — moving state into a ref
     buys nothing against ordering. The suggestion it served was removed on its own merits (see
     `openConversationFrom`), which is why nothing replaced it: the fix for a value that is not
     available yet is usually not to reach harder for it. */

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
  /* ⚖ `setEntrySide` IS GONE (money centralization P1, 2026-08-22) — the Expense/Income pills it
     served became answers of the "What happened?" dropdown, and its one real rule (the item
     clears on a side switch, the description follows only while it is still the item's name)
     lives on verbatim inside `selectBranch`. */
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
    /* ⚠ The EMPTY shape, matching the function's, not a subset of it — a fallback missing a key
       makes `deletePreview` a union and every reader of the new key a type error. Nothing is being
       deleted in this state, so every field is its zero. */
    : { amount: 0, legs: 0, owesFamily: false, owedByFamily: [] as Array<{ playerId: string; amount: number }> };
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
  /**
   * ⚠⚠ A REFRESH AFTER THE COACH'S OWN WRITE MAY NOT FAIL SILENTLY (/review, 2026-08-26).
   *
   * `quiet` exists so someone ELSE's write can't blank the book a coach is reading — for that,
   * keeping the last good screen is exactly right. It is the WRONG answer after the coach's own
   * save, because the screen they are keeping is the one the save just made wrong: the register
   * states outright that its closing balance IS cash on hand, and a swallowed refresh failure
   * leaves it quietly disagreeing with the money. The realistic cost is a coach who believes the
   * payment did not go through and records it a second time.
   *
   * So a post-write refresh is quiet about its SPINNER and loud about its FAILURE — this line,
   * above the book, with a way to try again. It never takes the screen: the figures below are
   * stale, not absent, and hiding them helps nobody.
   */
  const [staleAfterWrite, setStaleAfterWrite] = useState(false);
  const [seasonYear, setSeasonYear] = useState<number>(() => new Date().getFullYear());

  /* Nav-hide + body-scroll-lock registration for the record modal and the scope editor — one
     registration, any door.
     ⚠⚠ THE COMMITMENT IS NO LONGER ONE OF THEM (2026-08-26). It was a modal and registered here;
     it is a sub-view of the Payables tab now, so it must NOT hide the nav or lock the body — it is
     a screen a coach scrolls, and the whole reason it stopped being a modal is that its schedule
     can run longer than a viewport. Leaving it registered would have locked the page it needs to
     scroll. */
  useOverlayOpen(formOpen || scopeEdit !== null);

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
    || formTags.some(id => !baselineTags.includes(id))
    // A branch's own answers (which player, which drive, which installment) are work too.
    || touched(conv, convOpenedWith)
    // The sponsor branch's credit-family rows are an array — the formPlan idiom.
    || !snapshotEqual(convSponsorPlan, convSponsorPlanOpenedWith);
  const closeForm = useDiscardGuard({
    dirty: formDirty,
    close: () => dismissForm(),
    // A branch record has its own noun — "Discard this expense?" over a half-entered dues
    // payment would be the guard naming the wrong thing.
    noun: (convBranch && CONV_BRANCH[convBranch].noun) || copy.noun,
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
    setBillHandOff(false);
    setFormTags([]);
    setFormPayee(null);
    setConfirmDelete(false);
    setFutureDateRefused(false);
    // The conversation's own state clears with the form — a player picked for one record must
    // not persist into the next (this function's standing rule, restated below).
    setConvBranch(null);
    setConvLock(null);
    setWhatOpen(false);
    setConv(BLANK_CONV);
    setConvOpenedWith(BLANK_CONV);
    setConvSponsorPlan([]);
    setConvSponsorPlanOpenedWith([]);
    setConvSponsorTarget(null);
    setConvSponsors(null);
    /* Branch working data dies with the form: fetched once per OPEN (so a dues↔payout toggle —
       both read the same book — never refetches) and never carried ACROSS opens, because the
       figures move under it. ⚠ `driveDetail` especially: cached across opens, a player whose
       amount was just logged still read as unlogged on the next open (/simplify, 2026-08-23). */
    /* ⚠ The generation BUMP does not live here: resetForm is reachable from the render phase
       (the hub-press adjustment → openConversation → openAdd → here), and writing a ref from a
       render-reachable function trips the compiler's ref rule — the same reason `savingRef` is
       released in a `finally` rather than in this function. The bump is an effect on form close. */
    setDuesBook(null);
    setDuesBookError('');
    setDrives(null);
    setDrivesError('');
    setDriveDetail({});
    setDriveDetailError('');
    setClubBills(null);
    setClubBillsError('');
    setSponsorDefaultPct(null);
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
    /* A door that knows what it is adding opens the conversation PRE-ANSWERED (frame D): the
       "What happened?" field arrives filled, and stays editable — unless the door named one
       RECORD rather than one screen, in which case it locks (owner ruling A, 2026-08-23; see
       `convLocked`).
       ⚠ A COMMITMENT IS NOT A CONVERSATION ANSWER (owner ruling B2, 2026-08-23). Payables' Add
       is a setup form for a PLAN, and every sentence in that list describes money that moved —
       so it carries no answer at all and states its kind instead. */
    setConvBranch(opening.timing === 'payable' ? null
      : opening.kind === 'income' ? 'other-in'
      : opening.kind === 'refund' ? 'refund'
      : 'spend');
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

  /* ⚖⚖ `openAddInstallment` IS GONE (§114 walk, 2026-08-27), AND WITH IT THE LAST WAY THIS FORM
     OPENED ON A SAVED COMMITMENT.

     What it did: opened the record's own form with a blank plan row appended. That was the right
     answer while the form was a commitment's only editor — one door to the plan. Part B moved the
     bill's six fields onto the page and re-pointed the register at it, which left this button
     opening a window over six fields the page already edits so a coach could type a date and an
     amount. Adding a row is now the row itself (`addInstallmentInline`).

     ⚠⚠ THE CONSEQUENCE, STATED BECAUSE IT IS EASY TO MISS: **the shared money form is now
     CREATE-ONLY for commitments.** `openEdit` is reached only by a plain cost or an arrival on the
     register; nothing else opens this form on a saved payable. Every act on a commitment has its
     own door — the six fields on the page, `Change` / `Remove` / `Record` on a row, `Add an
     installment` under the schedule, `Delete` at the foot. If a future change needs the form to
     edit a saved commitment again, that is a decision to take deliberately, not a helper to
     reinstate: it would put a second editor back on the same six fields.
     ⚠ `Add a commitment` is untouched — a setup form of the same standing as New Fundraiser
     (standing owner ruling, P2). */

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
    setUndoAsk(null);
    /* ⚖⚖ THIS OPENS THE ONE CONVERSATION NOW (money centralization P2, 2026-08-23). It used to
       raise its own small modal — date, amount, method, note, which installment — one of the five
       money forms the project exists to merge. Every field it asked for is a field the conversation
       already asks, in the same order and the same words, and the act is the same act: "we paid for
       something", against a bill the team already owes.
       ⚠ LOCKED (owner ruling A): this door named ONE record, so the answers it arrives with are
       stated rather than offered. What stays editable is WHICH INSTALLMENT the money lands on —
       that is allocation, not identity, and a coach who clicked one piece may be paying another. */
    openConversationFrom({
      branch: 'spend',
      lock: {
        subject: e.description,
        detail: standing && standing.remaining > 0.005
          ? `${fmt(standing.remaining)} still owing · opened from the bill`
          : 'Opened from the bill',
      },
      ids: { spendExpenseId: e.id, spendInstallmentId: target?.installmentId ?? '' },
      amount: String(suggested),
    });
  }

  /* ⚖ `submitPayment` IS GONE — `saveBillPayment` is its successor, on the form's own save path
     with the form's own error channel, refusal clearing and double-submit latch. Same route, same
     body, same R6 behaviour: an over-payment saves and the sentence says so; the server does not
     compare. */

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
  /** One bill, one route. ⚠ Club allocations have no page — their door is the Club tab. */
  function openBill(bill: PayBill) {
    if (bill.kind === 'org') return;
    openBillById(bill.key);
  }

  /**
   * Open one bill's page, from wherever the coach is standing.
   *
   * ⚖ THE `?from=` ORIGIN PARAM RETIRED WITH THE SECOND TAB (fold, 2026-08-28). Part B added it
   * because two tabs could open this page and an arrow that always said "Payables" quietly moved
   * a coach to a tab they were not on. One tab remains, and the arrow returns to the Ledger on
   * whatever view this device REMEMBERS — which is the view the coach was just reading, because
   * landing on a view is what writes the memory. The origin bookkeeping's job is done by the
   * memory now; do not re-add the param without a second tab to need it.
   */
  function openBillById(expenseId: string) {
    router.push(moneySectionHref(
      base, 'ledger',
      { bill: expenseId },
      seasonSearchParams.toString(),
    ));
  }

  /**
   * Leave a commitment's page for the list behind it.
   *
   * ⚠ THE BILL IS GONE BY THE TIME THIS RUNS — a page addressing a record that no longer exists is
   * an empty screen with a back arrow, reached by the coach's own successful action. Go where they
   * were going anyway, which is wherever the arrow was already pointing.
   */
  function leaveBillPage() {
    router.push(billBackTo.href);
  }

  /**
   * Close the record form.
   *
   * ⚠ ONE HELPER, SIX CALLERS. `setFormOpen(false); resetForm();` was written out at the discard
   * guard, at four save paths and at the delete — so a seventh close path added later would have
   * drifted. The pair had already come apart once in this file's history.
   *
   * ⚠ IT NO LONGER RESTORES ANYTHING. It used to put the commitment drawer back, because these
   * modals had replaced it; over a PAGE there is nothing to restore — closing the modal reveals the
   * page that was there all along.
   */
  function dismissForm() {
    setFormOpen(false);
    resetForm();
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
      /* ⚠ NOT `setError` (/review, 2026-08-26). This is the one WRITE on the screen that reported
         itself through the panel-wide LOAD error, which had two consequences: it replaced the whole
         register with "Failed to load…" over a failed undo, and — now that a winning load clears
         that state — any background re-read could wipe the message before the coach read it. The
         import line is the honest home for it: it says its piece above the book without taking it. */
      setImportMessage(err.message);
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

  /* ── The conversation's doors and branches (P1) ─────────────────────────────────────────── */

  /** The hub's Record button — nothing answered, the "What happened?" field showing "Choose…".
   *  ⚠ The list does NOT start open (owner ruling 2026-08-23, §80 walk — superseding frame A's
   *  "the dropdown starts open"): seen live, the wall of eight options bursting open read as
   *  heavier than the drawing; the sentences are one tap away behind the field.
   *  ⚠ COMPOSES `openAdd` rather than re-writing its opening sequence — `openSavedRecord`'s own
   *  warning is the reason: a second hand-rolled opener is where the next seeded field quietly
   *  goes stale (/simplify altitude, 2026-08-23). What this layers on top: the question starts
   *  UNANSWERED, and BOTH dates seed (into the baseline too — a seed the guard doesn't know
   *  about is a wolf-cry) because no branch has said which date matters yet. */
  function openConversation() {
    openAdd({ kind: 'expense', timing: 'paid' });   // seeds paidDate=today into form + baseline
    const today = tournamentToday();
    setForm(f => ({ ...f, receivedDate: today }));
    setFormOpenedWith(b => ({ ...b, receivedDate: today }));
    setConvBranch(null);
  }

  /**
   * Pre-answer part of the branch — into the form AND into the discard guard's baseline.
   *
   * ⚠⚠ BOTH STORES, ALWAYS, AND THAT IS WHY THIS IS A FUNCTION (/simplify, altitude lens
   * 2026-08-23). A pre-answer is not the coach's typing: written only to `conv`, it reads as an
   * unsaved change and the discard guard asks "discard this?" over a form nobody has touched —
   * the wolf-cry `formOpenedWith` carries its own warning about. Three call sites were each
   * doing the pair by hand and each re-explaining why; a fourth that set only `conv` would look
   * exactly like the other three and be wrong.
   */
  function prefillConv(patch: (c: typeof BLANK_CONV) => typeof BLANK_CONV) {
    setConv(patch);
    setConvOpenedWith(patch);
  }

  /**
   * Open the conversation the way a DOOR asked for it (money centralization P2).
   *
   * ⚠ COMPOSES `openConversation` + `selectBranch` rather than re-implementing either. Every door
   * in the product now lands here, so the branch's own loaders, the date seeding and the frame-C
   * carry-across cannot diverge between "pressed Record" and "pressed Record on Jenny's row".
   *
   * ⚠ THE PRE-ANSWERS GO IN AFTER `selectBranch`, WHICH RESETS THEM. That ordering is the whole
   * function: `selectBranch` clears the branch's questions by design (frame C — a player picked for
   * a dues receipt must never pre-answer which item a cost files under), so a door's own answers
   * are written on top of the reset, never before it.
   *
   * ⚠ AND INTO THE BASELINE TOO. A pre-answer is not the coach's typing — leaving it out of
   * `convOpenedWith` makes the discard guard cry wolf on a form nobody has touched, which is the
   * exact trap `formOpenedWith` carries its own warning about.
   */
  function openConversationFrom(intent: RecordMoneyIntent | null) {
    openConversation();
    if (!intent) return;
    selectBranch(intent.branch);
    if (intent.lock) setConvLock(intent.lock);
    if (intent.ids) {
      /* ⚠ `sponsorNewName` is NOT a conv key — it maps onto the picker's own two ("new" +
         the typed name) rather than riding the spread, or a stray property lands in conv. */
      const { sponsorNewName, ...ids } = intent.ids;
      prefillConv(c => ({
        ...c,
        ...ids,
        ...(sponsorNewName !== undefined ? { sponsorPicked: 'new', sponsorName: sponsorNewName } : {}),
      }));
      // The drive branch's leaderboard is fetched when a drive is CHOSEN; a door that already
      // chose one has to ask for it, or the player list never arrives.
      if (ids.driveId && !driveDetail[ids.driveId]) void loadDriveDetail(ids.driveId);
      // The sponsor record page's locked door (mig 268): fetch the target's plan + pledge +
      // arrivals so the consequence line can run the same accrual the save will.
      if (ids.sponsorId) void loadSponsorTarget(ids.sponsorId);
    }
    if (intent.amount !== undefined) {
      setForm(f => ({ ...f, amount: intent.amount! }));
      setFormOpenedWith(f => ({ ...f, amount: intent.amount! }));
    }
    /* ⚖⚖ A DOOR THAT NAMES A BILL DOES **NOT** SUGGEST AN AMOUNT, and this was built the other way
       first and taken back out (2026-08-27). The idea was to mirror `spendLeadGroup.onPick`, which
       fills the bill's whole remaining when a coach picks it by hand. Two things killed it:

       · **It could not work reliably.** This runs during RENDER, on the FIRST render of the
         Transactions panel — which pressing Record may itself be what mounts — so the commitments
         list is usually still empty at that instant and there is no remaining to read. Reaching for
         it through a ref to dodge the ordering is what put *"Cannot access 'openCommitmentsRef'
         before initialization"* on a coach's screen. The BILL pre-fills fine without any of that:
         `prefillConv` stores the id, and the picker resolves the name the moment its list lands.

       · **It was the wrong figure anyway.** `onPick`'s suggestion is the whole bill's remainder. A
         coach standing on a bill and pressing Record is usually paying ONE installment — so the
         helpful-looking default is the one most likely to be wrong, and a pre-filled figure invites
         confirmation. The per-row `Record` is the door that knows which piece, and it suggests that
         piece's remainder; this one is deliberately the row's minus the precision, so it names the
         bill and asks for the figure. */
  }

  /** Fetch the branch's working data — the same reads its home tab does, on demand.
   *  ⚠ Every loader captures the generation FIRST and bails before ANY setState if the form has
   *  since been reset — see `convLoadGen`. */
  async function loadDuesBook() {
    const gen = convLoadGen.current;
    setDuesBookError('');
    setDuesBook(null);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/dues`);
      const data = await res.json().catch(() => ({}));
      if (gen !== convLoadGen.current) return;
      if (!res.ok) throw new Error(data.error ?? 'Could not load the dues book');
      setDuesBook(((data.players ?? []) as Array<{
        player: RepRosterPlayer; outstanding: number; payableNow: number;
      }>).map(row => ({
        id: row.player.id,
        name: formatPlayerLastFirst(row.player),
        outstanding: row.outstanding,
        payableNow: row.payableNow,
      })));
    } catch (e: any) {
      if (gen === convLoadGen.current) setDuesBookError(e.message);
    }
  }

  async function loadDrives() {
    const gen = convLoadGen.current;
    setDrivesError('');
    setDrives(null);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers`);
      const data = await res.json().catch(() => ({}));
      if (gen !== convLoadGen.current) return;
      if (!res.ok) throw new Error(data.error ?? 'Could not load the drives');
      // Running drives only: a sponsor is not a drive, and the entries writer refuses a
      // finished one — offering it would be a refusal wearing a picker.
      setDrives(((data.fundraisers ?? []) as Array<{
        id: string; name: string; kind?: string; isActive?: boolean;
      }>).filter(f => (f.kind ?? 'fundraiser') !== 'sponsor' && f.isActive !== false)
        .map(f => ({ id: f.id, name: f.name })));
    } catch (e: any) {
      if (gen === convLoadGen.current) setDrivesError(e.message);
    }
  }

  async function loadDriveDetail(driveId: string) {
    const gen = convLoadGen.current;
    setDriveDetailError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${driveId}/entries`);
      const data = await res.json().catch(() => ({}));
      if (gen !== convLoadGen.current) return;
      if (!res.ok) throw new Error(data.error ?? 'Could not load the drive');
      setDriveDetail(prev => ({
        ...prev,
        [driveId]: {
          rebatePercent: Number(data.fundraiser?.playerRebatePercent ?? 0),
          players: ((data.players ?? []) as Array<{
            playerId: string; playerName: string; entry: { amountRaised?: number } | null;
          }>).map(p => ({
            playerId: p.playerId,
            playerName: p.playerName,
            logged: p.entry ? Number(p.entry.amountRaised ?? 0) : null,
          })),
        },
      }));
    } catch (e: any) {
      if (gen === convLoadGen.current) setDriveDetailError(e.message);
    }
  }

  async function loadClubBills() {
    const gen = convLoadGen.current;
    setClubBillsError('');
    setClubBills(null);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/allocations`);
      const data = await res.json().catch(() => ({}));
      if (gen !== convLoadGen.current) return;
      if (!res.ok) throw new Error(data.error ?? "Could not load the club's bills");
      const owed: ConvClubBill[] = [];
      for (const s of (data.splits ?? []) as Array<{
        id: string; allocationDescription: string;
        installments: Array<{ id: string; amount: number; dueDate: string; paidAt: string | null }>;
      }>) {
        for (const inst of s.installments ?? []) {
          if (!inst.paidAt) {
            owed.push({
              splitId: s.id, installmentId: inst.id,
              description: s.allocationDescription, amount: inst.amount, dueDate: inst.dueDate,
            });
          }
        }
      }
      owed.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      setClubBills(owed);
      /* ⚠ The one-owed PRE-SELECT does not live here any more (/review, 2026-08-23): written from
         a resolve callback it could land after the coach had switched branches, merging a club key
         into another branch's working state — inert only because nothing else read it, which is an
         invariant nothing enforced. It is a render-phase adjustment in the club body now, which
         also re-preselects when the coach leaves the branch and comes back. */
    } catch (e: any) {
      if (gen === convLoadGen.current) setClubBillsError(e.message);
    }
  }

  async function loadSponsorDefaults() {
    const gen = convLoadGen.current;
    const settings = await fetchAccountingSettings(orgSlug, teamId);
    if (gen !== convLoadGen.current) return;
    // A failed read falls back to 0% — the server forces 0 without a player anyway, and the
    // consequence line states the credit before saving, so nothing is silently invented.
    const pct = settings?.defaultPlayerCreditPercent ?? 0;
    setSponsorDefaultPct(pct);
    // PRE-FILLED, NOT GOVERNED — the same seeding the Fundraising door does, mirrored into the
    // baseline so a prefill never counts as the coach's typing. Only into an untouched plan.
    const seeded = [{ playerId: '', value: String(pct), unit: 'percent' as CreditUnit }];
    setConvSponsorPlan(p => (p.length === 0 ? seeded : p));
    setConvSponsorPlanOpenedWith(p => (p.length === 0 ? seeded : p));
  }

  /** The cold picker's list: name + what each promise still has to come, promises first. */
  async function loadConvSponsors() {
    const gen = convLoadGen.current;
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers`);
      if (!res.ok) return;
      const data = await res.json();
      if (gen !== convLoadGen.current) return;
      const rows = ((data.fundraisers ?? []) as { id: string; kind?: string; name: string; stillToCome?: number }[])
        .filter(f => f.kind === 'sponsor')
        .map(f => ({ id: f.id, name: f.name, stillToCome: Number(f.stillToCome) || 0 }))
        .sort((a, b) => (b.stillToCome > 0.005 ? 1 : 0) - (a.stillToCome > 0.005 ? 1 : 0) || a.name.localeCompare(b.name));
      setConvSponsors(rows);
    } catch { /* the picker shows its loading line until a retry lands */ }
  }

  /** The locked door's target (mig 268): plan + pledge + arrivals, for the accrual consequence. */
  async function loadSponsorTarget(sponsorId: string) {
    const gen = convLoadGen.current;
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${sponsorId}/entries`);
      if (!res.ok) return;
      const data = await res.json();
      if (gen !== convLoadGen.current) return;
      const arrivalAmounts: number[] = (data.sponsorArrivals ?? []).map((a: { amount: number }) => Number(a.amount));
      setConvSponsorTarget({
        id: sponsorId,
        name: data.fundraiser?.name ?? '',
        pledged: data.pledgedAmount != null ? Number(data.pledgedAmount) : null,
        arrived: arrivalAmounts.reduce((s, a) => s + a, 0),
        arrivalAmounts,
        plan: (data.sponsorCreditPlan ?? []).map((p: { playerId: string; value: number; unit: string }) => ({
          playerId: p.playerId, value: Number(p.value), unit: p.unit === 'amount' ? 'amount' as const : 'percent' as const,
        })),
      });
    } catch { /* the consequence degrades to the generic sentence; the save still lands */ }
  }

  /**
   * Answer (or re-answer) "What happened?" — the field is the change control (frame B).
   *
   * What survives a switch and what resets is the spec's own rule (frame C, binding): amount,
   * date, how and note stay; the branch's OWN question resets — a player picked for a dues
   * payment must never pre-answer which item a cost files under. The mig 246 item rule carries
   * over from the pills it replaced: an item cannot survive a SIDE switch.
   */
  function selectBranch(next: ConversationBranch) {
    setWhatOpen(false);
    /* ⚠⚠ THIS EARLY RETURN READS THE RENDER CLOSURE, NOT THE QUEUED VALUE, and a door's reopen
       depends on an invariant nothing enforces (/review, 2026-08-23 — Low, no live trigger).
       `openConversationFrom` calls `openConversation()` (which QUEUES `setConvBranch`) and then
       calls this synchronously, so `convBranch` here is whatever the last COMMIT held. The reopen
       only fires when `!formOpen`, and every path in this file that clears `formOpen` pairs it
       with `resetForm()`, which nulls `convBranch` in the same batch — so "form closed ⇒ branch
       null" holds and `next === convBranch` can never be true at a door.
       ⚠ IF A FUTURE CLOSE PATH SKIPS `resetForm()`, this returns early at a door whose branch
       happens to match: `convLock` would be set while `convBranch` stayed stale, the lock band
       would not render, and Save would refuse with "Choose what happened first" over a form the
       coach believes the row already answered. Keep every close going through `resetForm`. */
    if (next === convBranch) return;
    /* ⚖ THE SPONSOR HAND-OFF IS GONE (owner UX ruling 2026-08-23, §80 walk). It closed the
       conversation, navigated the tab underneath, and opened a different modal that re-asked
       "what is this?" — the question the coach had just answered. The sponsor records INLINE now,
       through the SAME creation POST the Fundraising door uses (the plan's "no second sponsor
       writer" rule was about writers, not about which form calls the one that exists). */
    const prev = convBranch;
    setConvBranch(next);
    /* A refusal about the unanswered question ("Choose what happened first.") must not outlive
       the answer — it read as a live error over a fully-filled form (owner, §80 walk). Any save
       refusal clears here: the form under it has materially changed either way. */
    setSaveError('');
    if (next === 'spend') setFormKind('expense');
    else if (next === 'refund') setFormKind('refund');
    else if (next === 'other-in') setFormKind('income');
    // mig 246 — the pill rule, restated for the dropdown: a side switch clears the item, and the
    // description follows only while it is still the item's own name.
    const prevSide = ledgerSideOf(prev);
    const nextSide = ledgerSideOf(next);
    if (prevSide && nextSide && prevSide !== nextSide) {
      setForm(f => ({
        ...f,
        budgetCategoryId: '', budgetItemId: '', budgetItemName: '', category: '',
        description: isItemLabel(f) ? '' : f.description,
      }));
    }
    // Frame C: the target's date field inherits the one already typed (or today), into the
    // BASELINE too when the baseline had none — a carried date is not the coach's typing.
    // One transform, both stores: the inheritance rule must not exist twice.
    const today = tournamentToday();
    const seedDates = <T extends { receivedDate: string; paidDate: string }>(o: T): T => ({
      ...o,
      receivedDate: o.receivedDate || o.paidDate || today,
      paidDate: o.paidDate || o.receivedDate || today,
    });
    setForm(seedDates);
    setFormOpenedWith(seedDates);
    // The branch's own question resets — and "how" carries INTO an enum branch when the typed
    // method is one of the five (a coach who wrote "cheque" on the cost keeps it on the dues
    // receipt; anything unmatched stays behind rather than being silently coerced).
    const typedMethod = form.paymentMethod.trim().toLowerCase();
    const matched = (DUES_PAYMENT_METHODS as readonly DuesPaymentMethod[])
      .find(t => DUES_PAYMENT_METHOD_LABEL[t].toLowerCase() === typedMethod);
    setConv(c => ({
      ...BLANK_CONV,
      duesMethod: (next === 'dues' && matched) || c.duesMethod,
      payoutMethod: (next === 'payout' && matched) || c.payoutMethod,
    }));
    // Fetched once per OPEN (resetForm clears these on close) — a dues↔payout toggle reads the
    // same book and costs nothing; a failed load stays null, so re-picking the branch retries.
    // `loadDriveDetail` guards itself the same way at its call site.
    if ((next === 'dues' || next === 'payout') && duesBook === null) void loadDuesBook();
    if (next === 'drive' && drives === null) void loadDrives();
    if (next === 'club' && clubBills === null) void loadClubBills();
    if (next === 'sponsor' && sponsorDefaultPct === null) void loadSponsorDefaults();
    if (next === 'sponsor' && convSponsors === null) void loadConvSponsors();
  }

  /**
   * Hand the coach out of the conversation and into the BILL form, keeping their typing.
   *
   * ⚖⚖ TWO CALLERS, ONE PATH (owner, fold round 3, 2026-08-28 — option C): the future-date
   * REFUSAL (where this code was born, money centralization P2) and the picker's "Not paid yet"
   * row, which is the same hand-off promoted to a front door. ⚠ THE GUARDRAIL IS RULING B
   * (2026-08-23) AND IT STANDS AMENDED, NOT REVERSED: the conversation itself still never creates
   * unpaid money — no fork, no in-modal schedule editor riding a "has it been paid?" question.
   * What it may do is HAND OFF, visibly: the modal retitles to "Add a bill", states "nothing
   * moves today", and the coach is told they have changed acts. The old fork failed because a
   * record could BECOME unpaid mid-entry without the coach noticing; a hand-off cannot fail that
   * way because the whole window announces the change.
   *
   * Carries the work across rather than restarting it: the item, the amount and the description
   * are the same facts either way, and a typed date becomes the DUE date (from the refusal it was
   * always a future date; from the picker it is whatever the coach meant, editable on the row).
   * ⚠⚠ THE AMOUNT AND DATE LAND ON THE SCHEDULE'S FIRST ROW, because that is the only home a
   * bill has for either since Payables Rebuild P4 — this function used to write them into a
   * `dueDate` field P4 had deleted, so the carry it promised was silently false: the bill form
   * opened with a blank schedule and the typed figures nowhere (found 2026-08-29 building the
   * way back; the refusal's "your amount... come(s) with you" sentence was wrong the whole time).
   * ⚠⚠ THE PAYEE AND THE TAGS TRAVEL TOO (/review, 2026-08-16) — they live in their own state,
   * not in `form`, and the original hop dropped them: the commitment saved with no payee, on a
   * record that exists to say what the team owes and to whom.
   * ⚠ `paidByPlayerId` rides along in the spread but is inert: the bill branch neither renders
   * nor sends it. ⚖ `convBranch` still does not travel (ruling B) — but the hand-off is
   * REVERSIBLE now (owner, 2026-08-29): `billHandOff` keeps the "What happened?" control on the
   * bill form with the bill row as its standing answer, and picking any other answer goes back
   * through `handBackFromBillForm`, the mirror of this function.
   * ⚠ The dirty-check baseline stays BLANK: everything here is work the coach typed, so walking
   * away SHOULD ask before discarding.
   */
  function handOffToBillForm() {
    const carried = { ...form, amount: '', paidDate: '' };
    const seedRow: PlanRow = (form.paidDate || form.amount)
      ? { date: form.paidDate, amount: form.amount, auto: false }
      : { ...BLANK_PLAN_ROW };
    const carriedPayee = formPayee;
    const carriedTags = formTags;
    resetForm();
    setFormKind('expense');
    setFormTiming('payable');
    setForm(carried);
    setFormPlan([seedRow]);
    setFormPayee(carriedPayee);
    setFormTags(carriedTags);
    setBillHandOff(true);
    setFormOpen(true);
  }

  /**
   * The way BACK out of a handed-off bill form, into the conversation (owner, 2026-08-29): the
   * exact mirror of `handOffToBillForm`. Every other "What happened?" answer is revisable in
   * place; this makes the bill answer revisable too, instead of Cancel-and-retype.
   *
   * What travels: the schedule's first meaningful row returns as the payment's amount and date —
   * ⚠ a FUTURE date stays behind, because money that moved cannot have moved tomorrow (carrying
   * it would trip the refusal that offers the bill form back: a loop). `selectBranch` then owns
   * everything it always owns — kind, date seeding, the side-switch item rule, branch loads.
   * The item, description, payee, tags and notes never left `form`, so they simply stay.
   */
  function handBackFromBillForm(target: ConversationBranch) {
    const row = formPlan.find(r => r.date || r.amount) ?? formPlan[0];
    const rowDate = row?.date ?? '';
    setFormTiming('paid');
    setBillHandOff(false);
    setForm(f => ({
      ...f,
      amount: row?.amount || f.amount,
      paidDate: rowDate && rowDate <= tournamentToday() ? rowDate : '',
    }));
    setFormPlan([{ ...BLANK_PLAN_ROW }]);
    selectBranch(target);
  }

  /**
   * Submit a branch that writes through its HOME TAB's route (dues receipt, drive amount, club
   * settlement, payout). Called from `saveRecord`'s try block, so a thrown refusal lands on the
   * same error channel as every other save. ⚠ NO new arithmetic here: amounts go to the writer
   * exactly as typed, and every derived figure on screen afterwards comes from the re-read.
   */
  /**
   * Pay down a bill the team already owes (money centralization P2, owner ruling C2).
   *
   * ⚠ THE SAME WRITER THE BILL'S OWN DOOR USES — the payments sub-route, one POST, identical body.
   * That is what makes this a different DOOR onto one act rather than a second way to record a
   * payment: the server applies the money oldest-piece-first unless the override names one, an
   * over-payment saves and is stated (R6), and the register derives the row exactly as it would
   * have from the Payables face. No new arithmetic lives here.
   *
   * ⚠ THE METHOD IS THE FREE-TEXT ONE. A commitment payment has always stored typed methods and
   * the shared combobox seeds it with the same five words the enum branches offer — the one-method
   * -list ruling was about what is OFFERED, not about converting a column.
   */
  async function saveBillPayment() {
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) throw new Error('Enter a valid amount');
    if (!form.paidDate) throw new Error('Enter the day the money left.');
    const res = await fetch(
      `/api/coaches/${orgSlug}/teams/${teamId}/expenses/${conv.spendExpenseId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          paidDate: form.paidDate,
          method: form.paymentMethod.trim() || null,
          note: form.notes.trim() || null,
          installmentId: conv.spendInstallmentId || null,
          /* ⚠⚠ THE ANSWER THE FORM HAD ALREADY BEEN COLLECTING AND THROWING AWAY (money
             centralization P4). `renderPaidBy()` has drawn an editable roster picker on this branch
             since P1 — inside the fold whose own label reads "More — paid by, payee, tags, notes" —
             and this body did not carry it, so a coach could name a family, press Save, and be told
             by the consequence line that the team's cash left. A ghost save of exactly the shape
             owner ruling A (2026-08-23) condemned.
             ⚠ NULL WHEN THE BILL ITSELF NAMES A PAYER: the cost's own answer already claims every
             payment against it, the field renders as a stated fact rather than a question, and the
             server refuses a second answer that disagrees. */
          paidByPlayerId: payingBill?.expense.paidByPlayerId ? null : (form.paidByPlayerId || null),
        }),
      });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not record the payment');
    dismissForm();
    await refreshAfterWrite();
  }

  async function saveConversationBranch() {
    const amount = parseFloat(form.amount);
    if (convBranch === 'dues') {
      if (!conv.duesPlayerId) throw new Error('Pick which player the payment is for.');
      if (isNaN(amount) || amount <= 0) throw new Error('Enter a valid amount');
      if (!form.receivedDate) throw new Error('Enter the day the money arrived.');
      /* ⚠ Record is for money that has already moved (QA §123 Phase C). The spend branch's
         refusal reads `form.paidDate`; this branch runs on `form.receivedDate`, which is why it
         was never covered. The server refuses too — one sentence, lib/money-date-guards.ts. */
      const duesFutureRefusal = futureReceivedDateRefusal(form.receivedDate, 'payment');
      if (duesFutureRefusal) throw new Error(duesFutureRefusal);
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/players/${conv.duesPlayerId}/dues-payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            receivedDate: form.receivedDate,
            method: conv.duesMethod,
            note: form.notes.trim() || null,
          }),
        });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not record the payment');
    } else if (convBranch === 'drive') {
      if (!conv.driveId) throw new Error('Pick which drive the money came from.');
      if (!conv.drivePlayerId) throw new Error('Pick which player it counts for.');
      if (isNaN(amount) || amount <= 0) throw new Error('Enter a valid amount');
      if (!form.receivedDate) throw new Error('Enter the day the money arrived.');
      // The same grammar as the dues branch above (Phase C) — the third money-in door, kept in
      // step in the same pass rather than left behind for a third release.
      const driveFutureRefusal = futureReceivedDateRefusal(form.receivedDate, 'drive entry');
      if (driveFutureRefusal) throw new Error(driveFutureRefusal);
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${conv.driveId}/entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId: conv.drivePlayerId,
            amountRaised: amount,
            receivedDate: form.receivedDate,
            notes: form.notes.trim() || null,
          }),
        });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not log the amount');
    } else if (convBranch === 'club') {
      const bill = (clubBills ?? []).find(b => `${b.splitId}:${b.installmentId}` === conv.clubInstallmentId);
      if (!bill) throw new Error('Pick which installment to settle.');
      /* The one-tap settle, exactly as the Club tab's "Mark paid" sends it: NO body — the server
         derives amount and date, and there is nowhere to store a method or note on an allocation
         installment. Fieldless is the design, not a shortcut (build prompt §2.2). */
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/allocations/${bill.splitId}/installments/${bill.installmentId}`,
        { method: 'PATCH' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not settle the installment');
    } else if (convBranch === 'sponsor') {
      if (isNaN(amount) || amount <= 0) throw new Error('Enter a valid amount');
      if (!form.receivedDate) throw new Error('Enter the day the money arrived.');
      /* ⚠ THE FOURTH MONEY-IN DOOR (owner-raised 2026-08-30, walking §122). Phase C wired the dues
         and drive branches and its own header called the drive "the third money-in door" — there
         are four, and this was the one left open: the arrivals route refused a future date while
         this form still offered one, so a coach filled the whole thing in and learned on save. A
         foreseeable refusal must be shown, not discovered (§118). The picker now caps too; this is
         the belt, because a typed date can still get past a `max`. */
      const sponsorFutureRefusal = futureReceivedDateRefusal(form.receivedDate, 'sponsor cheque');
      if (sponsorFutureRefusal) throw new Error(sponsorFutureRefusal);
      if (conv.sponsorId) {
        /* An ARRIVAL against an existing sponsor (mig 268) — the record page's locked door. The
           stored credit plan earns as the money lands; this branch only says what came and when. */
        const res = await fetch(
          `/api/coaches/${orgSlug}/teams/${teamId}/fundraisers/${conv.sponsorId}/arrivals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount,
              receivedDate: form.receivedDate,
              method: conv.sponsorMethod || null,
              notes: form.notes.trim() || null,
            }),
          });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not record the arrival');
      } else {
        if (conv.sponsorPicked !== 'new') throw new Error('Pick which sponsor came through.');
        if (!conv.sponsorName.trim()) throw new Error('The sponsor needs a name.');
        const plan = convSponsorPlan
          .filter(r => r.playerId && Number(r.value) > 0)
          .map(r => ({ playerId: r.playerId, value: Number(r.value), unit: r.unit }));
        const problem = creditPlanProblem(plan, amount);
        if (problem) throw new Error(problem);
        /* The SAME creation POST the Fundraising door submits — status received (this branch is
           "came through"; a pledge stays on Fundraising), dated and methodized (mig 268), with
           the credit PLAN exactly as that door takes it. */
        const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/fundraisers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'sponsor',
            name: conv.sponsorName.trim(),
            description: form.notes.trim() || null,
            sponsorStatus: 'received',
            sponsorAmount: amount,
            receivedDate: form.receivedDate,
            method: conv.sponsorMethod || null,
            creditPlan: plan,
            tagIds: formTags,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not record the sponsor');
      }
    } else if (convBranch === 'payout') {
      if (!conv.payoutPlayerId) throw new Error('Pick which family to pay back.');
      if (isNaN(amount) || amount <= 0) throw new Error('Enter a valid amount');
      if (!form.paidDate) throw new Error('Enter the day the money left.');
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/players/${conv.payoutPlayerId}/dues-payouts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            paidDate: form.paidDate,
            method: conv.payoutMethod,
            note: form.notes.trim() || null,
          }),
        });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not record the payout');
    }
    dismissForm();
    await refreshAfterWrite();
  }

  // Which SEASON is on screen — the team's LIVE one, always. `page.capabilities` are that
  // season's. ⚠ `page.canWrite()` is GONE (2026-08-18): it folded read-only into every write
  // flag, and a closed season no longer renders this screen at all, so a capability check is
  // just a capability check.
  const seasonSearchParams = useSearchParams();
  /* Navigation, not state: a commitment is a route now (owner ruling 2026-08-26). */
  const router = useRouter();
  /**
   * ⚠⚠ ADDRESSED BY `?bill=`, A SUB-VIEW OF THE PAYABLES TAB — not a page beside the hub, and
   * that correction matters (2026-08-26).
   *
   * The first build of this gave a commitment its own ROUTE, on the reasoning that every other
   * coach record with children has one — a game, a practice, a player, a lineup. **That read the
   * wrong neighbours.** Money went deliberately the OTHER way on 2026-08-14: one fundraiser used to
   * be a standalone page and was pulled back INTO the hub as `?fundraiser=`, because leaving the
   * hub "took the tab row, the archive chip and the Import door with it — the last such exception
   * in Money". A commitment page would have re-created precisely what that sweep removed.
   *
   * Everything the page shape was chosen FOR survives: it is still a URL, so Back works, a link is
   * shareable, and the schedule may grow as long as it likes. What it keeps that a page threw away
   * is the Money hub around it.
   */
  const focusBillId = seasonSearchParams.get('bill');
  /**
   * Which bill's page this panel is showing.
   *
   * ⚠ THE TWO-EDITORS HAZARD THIS LINE USED TO GUARD IS STRUCTURALLY GONE (fold, 2026-08-28).
   * Before the fold, Transactions and Payables were two mounted instances of this component
   * reading one `?bill=` URL — so an invisible second copy of the bill page ran its own autosave
   * timers against the same record (Part B's defect fix gated it to one face). One tab, one
   * instance: the guard's cause retired with the second mount. If a second instance of this panel
   * is ever mounted again, that hazard comes straight back — re-read Part B (2026-08-26) first.
   */
  const drawerFor = focusBillId;
  const page = useCoachSeasonPage(orgSlug, teamId);
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const canWriteMoney = (page.capabilities?.money === 'write');
  // The team's OWN money tags (org-shared ones are managed by the org admin, not here).
  const ownMoneyTags = expenseTags.filter(t => t.teamId !== null);

  /* ── The hub's Record button reaches this form here (P1) ────────────────────────────────────
     ⚠ THE TRANSACTIONS FACE ALONE listens — both faces are instances of this one component, and
     two listeners would open two modals over each other. Render-phase adjustment on a change
     guard (the React-sanctioned derive-from-prop pattern the hub page itself uses) rather than an
     effect: the open must not lag a paint behind the press. A press while the form is ALREADY
     open is swallowed deliberately — resetting under the coach would discard their half-entered
     record with no guard. */
  /* A stale refusal clears the moment the form under it changes — render-phase adjustment on a
     change guard. Every field setter replaces its object, so identity inequality IS "the coach
     edited something since the refusal". */
  if (saveError && saveErrorSnapshot && (
    saveErrorSnapshot.form !== form || saveErrorSnapshot.conv !== conv
    || saveErrorSnapshot.plan !== formPlan || saveErrorSnapshot.payee !== formPayee
    || saveErrorSnapshot.tags !== formTags || saveErrorSnapshot.timing !== formTiming
  )) {
    setSaveError('');
    setSaveErrorSnapshot(null);
  }

  const recordSignal = useRecordMoneySignal();
  const [handledRecordNonce, setHandledRecordNonce] = useState(0);
  // `canWriteMoney` is defense-in-depth (/review 2026-08-23): today the nonce's only producer is
  // the hub's write-gated button, but this component shouldn't stay correct only by that fact.
  /* ⚠ A PRESS ARRIVING WHILE A FORM IS ALREADY OPEN IS DELIBERATELY DROPPED (/review, 2026-08-23).
     The nonce is marked handled either way, so the request does not fire later, out of the context
     it was made in. What it protects is bigger than what it costs: reopening would reset a form the
     coach has half filled, and because this modal PORTALS out of the (possibly hidden) panel, an
     open form is on screen in front of them — so a press that does nothing is a press aimed past a
     window they can see and close. Do not "fix" this into a queue. */
  /* ⚠ The `face === 'transactions'` gate is gone with the second instance (fold, 2026-08-28):
     there is exactly one listener now, so the two-modals-over-each-other hazard it prevented
     cannot occur. The conversation opens from any view — the modal portals out regardless. */
  if (recordSignal && recordSignal.openNonce > handledRecordNonce) {
    setHandledRecordNonce(recordSignal.openNonce);
    // The intent is read at the SAME nonce it was raised with — one object, so a door's branch and
    // its ids can never arrive on different renders and half-answer the form.
    if (!formOpen && canWriteMoney) openConversationFrom(recordSignal.intent);
  }
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

  /* ⚠ `quiet` RE-READS KEEP THE LAST GOOD SCREEN (UX review 2026-08-26) — the same rule the Dues
     panel already documents, and this face needed it more. Everything below the toolbar sits inside
     one `{loading ? …}` ternary, so a loud reload flashes the WHOLE register — every row, the
     running balance, the filters — back to "Loading…" and in again. Every write here reloads TWICE
     (see `refreshAfterWrite`), so recording one expense did that to the coach twice in a row.
     Quiet swallows its own failure too: stale-but-good beats blanking the book a coach is reading
     because someone else's write bumped the revision. */
  /** Resolves TRUE only if this call is the one that wrote the screen. A quiet load swallows its
   *  own failure, so its caller is the only thing left that can notice one — see `staleAfterWrite`.
   *  A superseded load resolves false too: it did not write the screen either. */
  const load = useCallback(async (quiet = false): Promise<LoadOutcome> => {
    const seq = ++loadSeq.current;
    if (!quiet) { setLoading(true); setError(''); }
    try {
      /* ⚠⚠ THE THREE SHARED READS GO THROUGH `sharedRead`, WHICH IS THE OTHER HALF OF P1'S
         `/simplify` FINDING (money plan §10 P1, deferred to here). Transactions and Payables are two
         mounted instances of this component, so `/expenses`, `/budget-items` and `/budget-plan` ran
         TWICE for a coach who opened both — and thereafter every save re-ran all six, for the rest
         of the session. The provider now collapses them to one request per URL per revision, and a
         bump is what clears it, so the cache can never be staler than the screen already was.

         ⚠ THE OTHER TWO STAY ON A PLAIN FETCH, deliberately. The arrivals and the register have
         exactly ONE caller — this panel, whose Timeline view renders both — so there is nothing to
         share with, and putting them in a shared cache would only make them harder to re-read on
         their own. The register is also the heaviest read on the screen: it touches every money
         table the season has. (Since the fold they load unconditionally: one instance serves all
         three views, and the Timeline is the default landing for a first visit anyway.) */
      const [res, catRes, planRes, inRes, bookRes] = await Promise.all([
        sharedRead(`/api/coaches/${orgSlug}/teams/${teamId}/expenses`),
        sharedRead(`/api/coaches/${orgSlug}/budget-items?teamId=${teamId}`),
        sharedRead(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/money-in`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/register`),
      ]);
      /* ⚠ EVERY BODY IS READ BEFORE ANYTHING IS WRITTEN, so the staleness check below has exactly
         one place to sit. Reading a body is another await, and a guard with awaits after it guards
         only the statements it happens to precede. */
      const inData = inRes?.ok ? await inRes.json() : null;
      const bookData = bookRes ? await bookRes.json().catch(() => ({})) : null;

      /* ⚠⚠ FROM HERE DOWN IS THE WRITING, AND ONLY THE NEWEST LOAD MAY DO IT. A slower earlier
         response landing last is how a payment a coach just made reverts to Scheduled in front of
         them. Bailing here also skips the `finally`'s spinner reset — correct, because the newer
         load owns the spinner now — see the `finally`, which a `return` here still runs.

         ⚠⚠ IT SAYS `superseded`, NOT `false`, AND THE DIFFERENCE IS A FALSE ALARM A COACH READ
         (found in the §114 walk, 2026-08-27). `refreshAfterWrite` turns a falsy answer into
         "Your change was saved, but these figures could not be refreshed" — a real and useful
         warning when a re-read FAILS, and a lie when it was merely overtaken. Two writes close
         together are enough: the second load bumps the sequence, the first returns here, and its
         `setStaleAfterWrite(true)` can land AFTER the winner's `setStaleAfterWrite(false)` — so the
         banner sticks over figures that are perfectly current.
         It was survivable while every write went through a modal, because two saves a second apart
         were rare. **Part B's autosave made overlapping re-reads the normal case**, and the banner
         appeared on a page where nothing had gone wrong. A superseded load is not a failure: it is
         a load that correctly declined to write, and something newer is already doing the job. */
      if (seq !== loadSeq.current) return 'superseded';

      if (!res.ok) throw new Error((res.data.error as string) ?? 'Failed to load');
      const data = res.data as {
        expenses?: RepTeamExpense[]; expenseTags?: RepTeamTag[];
        tagsByExpenseId?: Record<string, string[]>;
        standings?: Record<string, CommitmentStanding>;
      };
      setError(''); // a winning load that succeeded means there is no error any more — see the convention
      setStaleAfterWrite(false);
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
      return 'ok';
    } catch (e: any) {
      if (!quiet && seq === loadSeq.current) setError(e.message ?? 'Failed to load expenses.');
      return 'failed';
    } finally {
      /* ⚠⚠ ONLY THE WINNING LOAD MAY CLEAR THE SPINNER, and the note above the `seq` bail used to
         claim this block was skipped by it. It is not — a `return` inside `try` still runs
         `finally`. So a superseded load switched the screen from "Loading…" to "done" having
         written NOTHING, and the coach got the full "Nothing on the books yet" empty state —
         headline, teaching copy, Add Expense and Add Income — for a beat before the real register
         replaced it (owner, UX review 2026-08-26). Two loads race on every mount under StrictMode
         and after every write, so this fired constantly. Same guard the Dues, Club and Roster
         loaders already carry. `quiet` means "don't SHOW a spinner", never "leave one hanging". */
      if (seq === loadSeq.current) setLoading(false);
    }
    // `sharedRead` is stable from the provider. (The `face` dep left with the prop — every fetch
    // runs unconditionally now that one instance serves all three views.)
  }, [orgSlug, teamId, sharedRead]);

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
  useEffect(() => { load(); }, [load]);
  /* ⚠ THE SHARED HOOK, NOT `moneyRevision` IN THE DEPS (UX review 2026-08-26). Listing the
     revision beside `load` fired a SECOND full load on mount — which is what made the empty-state
     flash above reachable — and turned every outside write into a loud reload.
     `useOnMoneyRevisionBump` skips the mount revision by VALUE (StrictMode-safe; its own header
     explains why a boolean latch is not), and a bump is by definition someone else's write, so it
     re-reads quietly. */
  const quietReload = useCallback(() => { void load(true); }, [load]);
  useOnMoneyRevisionBump(quietReload);


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
      // Same rule as the register loader beside it: a superseded read must not post its error
      // over a table a newer read has already filled.
      if (seq === scheduleSeq.current) setScheduleError(e.message ?? 'Could not load what your club has billed this team.');
    }
  }, [orgSlug, teamId]);

  /* ⚠⚠ THE SCHEDULE HAS TO WATCH THE REVISION TOO (/review, 2026-08-16). This fired only on a
     CHANGE of sub-view, so the one screen a coach reads to answer "what is coming due" could sit
     there stale: Payables now OPENS on the schedule, and the hub's Import ▾ — reachable from any
     tab — brings in a whole season of commitments and bumps the revision. The list beside it
     refreshed; this table did not, until the coach happened to switch sub-views and back. Silent
     stale money on the screen whose entire job is to be current. */
  useEffect(() => { loadSchedule(); }, [loadSchedule, moneyRevision]);

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
    /* Quiet about the SPINNER — the rows a coach just changed should change under them rather than
       the whole register blanking and coming back. Loud about FAILURE — see `staleAfterWrite`. */
    const outcome = await load(true);
    /* ⚠⚠ ONLY A REAL FAILURE RAISES THE BANNER. A `superseded` load did not fail — a newer one
       overtook it and is writing the figures right now — and treating the two the same put
       "these figures could not be refreshed" on a page whose figures were current (§114 walk,
       2026-08-27). See the bail inside `load` for why Part B made that common. */
    if (outcome !== 'superseded') setStaleAfterWrite(outcome === 'failed');
    // The club-bill feed is its own fetch; the one instance re-reads it with everything else.
    await loadSchedule();
  }, [bumpMoneyRevision, load, loadSchedule]);

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
    showBalance, bookRows, bookStartingBalance, bookOpensSeason, bookEmpty, registerItemNames, statusCounts,
    registerTagCounts,
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
      selectedKinds.size === 0 ? 'all' : 'expense', selectedItems.size > 0 ? 'x' : '',
      filterTagIds.size > 0 ? 'x' : '',
    );
    const matchesKindItem = (r: RegisterBookRow) => {
      if (selectedKinds.size > 0 && !selectedKinds.has(r.kind)) return false;
      if (selectedItems.size > 0 && (!r.itemName || !selectedItems.has(r.itemName))) return false;
      return true;
    };
    /* Money tags live on expenses, so a tag filter narrows the book to the rows that can carry one
       — every other row simply has no such label, which is a match of zero, not a match of all. */
    const matchesTag = (r: RegisterBookRow) => {
      if (filterTagIds.size === 0) return true;
      if (r.open?.kind !== 'expense') return false;
      return (tagsByExpenseId[r.open.id] ?? []).some(id => filterTagIds.has(id));
    };
    /**
     * Status, then the date window — everything the pipeline does AFTER kind/item/tag.
     *
     * ⚠ EXTRACTED SO IT CAN RUN TWICE, and that is the whole reason it exists: once for the book on
     * screen, and once over the same rows with the tag filter LIFTED, which is how the Tags
     * dropdown counts what ticking an option would actually put in front of the coach. One
     * pipeline, two callers — a second arithmetic over the same rows is precisely how a list and
     * the figure captioning it drift apart (`check:register` exists because that already happened).
     */
    const windowRows = (rows: RegisterBookRow[]) => {
      const statusFiltered = selectedStatus.size === 0 ? rows
        : rows.filter(r => selectedStatus.has(registerStatusOf(r)));
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
      /* ⚠⚠ THE WINDOW STARTS FROM THE CARRY (mig 262). "Starting balance" has always meant the real
         cash immediately before the first visible row — with nothing before the window that used to
         be zero, and on a season that carried money forward it is the carry. Left at zero, the
         whole-season view would open on $0.00 while every row below it carried a higher balance. */
      const { rows: ranged, startingBalance, isSeasonOpening } = auditOnly
        ? { rows: rangeableRows, startingBalance: null as number | null, isSeasonOpening: false }
        : applyDateRange(rangeableRows, dateRange.from, dateRange.to, book?.opening ?? 0);
      /* Recombine in the book's own chronological order rather than concatenating the two groups —
         `statusFiltered` is already ordered, so filtering IT by membership is simpler than merging
         two separately-ordered arrays back together. */
      const visibleIds = new Set([...ranged.map(r => r.id), ...overdueRows.map(r => r.id)]);
      return { rows: statusFiltered.filter(r => visibleIds.has(r.id)), startingBalance, isSeasonOpening };
    };

    const kindItemRows = (book?.book ?? []).filter(matchesKindItem);
    const beforeStatus = kindItemRows.filter(matchesTag);
    /* Counted BEFORE the Status selection narrows further — otherwise the dropdown's own counts
       would just report themselves back once picked, the same rule the old Overdue chip's count
       followed. */
    const counts: Record<RegisterStatus, number> = { actual: 0, overdue: 0, scheduled: 0 };
    for (const r of beforeStatus) counts[registerStatusOf(r)]++;
    const { rows: finalRows, startingBalance, isSeasonOpening } = windowRows(beforeStatus);
    /**
     * ⚖⚖ WHAT TICKING THAT TAG WOULD PUT ON SCREEN (owner ruling 2026-08-26). The number on a
     * filter option is a promise about the list underneath it, so it counts ROWS — over the rows
     * every OTHER control already admits, the same "count before THIS filter narrows" rule Status
     * follows one block up.
     *
     * ⚠ IT COUNTS THE SAME UNIT THE BAND TOTALS, and that is the point: the register's unit is a
     * LINE, so a commitment paid in three installments is one tagged record but three rows, and
     * the option used to say "(1)" six inches above a band saying "across 3 costs".
     *
     * ⚠ WITH NO TAG TICKED THE TAG-FREE SET *IS* THE BOOK ON SCREEN, so the common case — reading
     * the counts before picking anything — costs nothing. Only a live tag filter pays for the
     * second pass, which is the case where the two sets genuinely differ.
     */
    const tagCountRows = filterTagIds.size === 0 ? finalRows : windowRows(kindItemRows).rows;
    const registerTagCounts = new Map<string, number>();
    for (const r of tagCountRows) {
      if (r.open?.kind !== 'expense') continue;
      for (const id of (tagsByExpenseId[r.open.id] ?? [])) {
        registerTagCounts.set(id, (registerTagCounts.get(id) ?? 0) + 1);
      }
    }
    return {
      registerTagCounts,
      showBalance: balanceShown,
      bookRows: finalRows,
      bookStartingBalance: startingBalance,
      /* Nothing before the window ⇒ the figure a coach is reading IS the season's opening balance,
         and the line says so in those words with a link to the one place it can be corrected.
         Narrow the window and it goes back to being an ordinary starting balance, because it is. */
      bookOpensSeason: isSeasonOpening && (book?.opening ?? 0) !== 0,
      bookEmpty: finalRows.length === 0,
      statusCounts: counts,
      /* The words actually ON the book, not the whole library: a filter offering a category the
         season never spent against is a control that can only ever empty the screen. */
      registerItemNames: [...new Set(
        (book?.book ?? []).map(r => r.itemName).filter((n): n is string => !!n),
      )].sort((a, b) => a.localeCompare(b)),
    };
  }, [book, selectedKinds, selectedItems, filterTagIds, selectedStatus, dateRange, tagsByExpenseId]);


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
   * ⚠⚠ THE BILLS A COACH CAN PAY DOWN — the "Bills you owe" group in the record form's one picker
   * (money centralization P2, owner ruling C2, 2026-08-23).
   *
   * ⚠ DELIBERATELY NOT `payBills`. That list is the PAYABLES FACE's — narrowed by its Status, Item
   * and tag filters and by whichever arrangement is showing. A coach who has filtered that screen
   * down to overdue rows has not told the record form to forget the rest of their bills, and this
   * field renders on the Transactions face too, where those filters do not exist at all.
   *
   * ⚠ SETTLED BILLS ARE NOT OFFERED. Nothing is owed on them, so a payment against one has no
   * honest landing place; the drawn frame says "Bills you owe" and this is what makes that true.
   *
   * ⚠ THE CLUB'S OWN BILLS ARE NOT HERE EITHER. A club allocation is not a `rep_team_expenses`
   * record and is settled through the Club tab, which owns that conversation — the conversation's
   * own "we settled up with the club" answer is its door, and offering it twice under two different
   * sentences is how one act grows two vocabularies again.
   *
   * Soonest due first, the order the Payables list itself sorts by, so the bill a coach is most
   * likely reaching for is the first row under the heading.
   */
  const commitmentsAll = useMemo(() => {
    const rows = allPayablesRaw.flatMap(e => {
      const standing = standings[e.id];
      if (!standing) return [];
      const next = [...standing.installments]
        .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0))
        .find(i => i.state !== 'settled');
      return [{
        id: e.id,
        name: e.description,
        remaining: standing.remaining,
        nextDue: next?.dueDate ?? null,
        expense: e,
        standing,
      }];
    });
    rows.sort((a, b) => {
      if (a.nextDue && b.nextDue) return a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0;
      if (a.nextDue) return -1;
      if (b.nextDue) return 1;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [allPayablesRaw, standings]);

  /** What the picker OFFERS: only bills with something still owing — "Bills you owe" is the
   *  heading, and a payment against a settled bill has no honest landing place. */
  const openCommitments = useMemo(
    () => commitmentsAll.filter(c => c.remaining > 0.005),
    [commitmentsAll],
  );

  /** The bill this record is paying down, or null when the branch is creating a new cost.
   *  ⚠ LOOKED UP IN THE FULL LIST, NOT THE OFFERED ONE. A door on the Payables face can name a
   *  bill the picker would not offer — an over-paid one, or one settled in another tab a moment
   *  ago — and resolving that to `null` would silently turn a payment into a brand-new cost.
   *  ⚠ ADD MODE ONLY. A SAVED payment is not this form's record at all — it belongs to its
   *  commitment and is corrected from the bill's own payment details, exactly as before. */
  /* ⚠ MEMOISED LIKE THE TWO LISTS ABOVE IT (/simplify, efficiency lens 2026-08-23): the money form
     lives inside this component, so a bare `.find` here re-scans every commitment on every
     keystroke in the open form — exactly the cost those lists' own headers exist to explain. */
  const payingBill = useMemo(
    () => ((formMode === 'add' && convBranch === 'spend' && conv.spendExpenseId)
      ? commitmentsAll.find(c => c.id === conv.spendExpenseId) ?? null
      : null),
    [formMode, convBranch, conv.spendExpenseId, commitmentsAll],
  );

  /**
   * ⚠⚠ THE PICKER'S "Bills you owe" GROUP, BUILT ONCE — NOT PER KEYSTROKE (/simplify, efficiency
   * lens 2026-08-23). Built inline in the JSX it was a fresh object with a fresh `options` array on
   * every render of this panel — which is every keystroke anywhere in the open form — and the
   * picker memoises its filtered lead rows on this very value, so the memo was defeated by the
   * prop that feeds it. The same defect `allPayablesRaw`'s own header records, one field over.
   *
   * ⚠ ADD MODE ONLY, AND NEVER ON A COMMITMENT'S OWN FORM: editing a saved record must not offer to
   * turn it into a payment against something else, and Payables' Add is a SETUP door for a plan —
   * the one thing this conversation deliberately does not do.
   */
  /**
   * Roster names by id — what the bill page's delete confirmation needs to say WHOSE credit goes
   * (owner ruling 2026-08-27).
   *
   * ⚠ MEMOISED, like the two lists above it: the money form lives inside this component, so a bare
   * `.map` here would rebuild the object on every keystroke in the open form and defeat the prop's
   * own identity — the same defect `spendLeadGroup`'s header records one field down.
   */
  const playerNameById = useMemo(
    () => new Map(roster.map(p => [p.id, formatPlayerFirstLast(p)])),
    [roster],
  );

  const spendLeadGroup = useMemo(() => {
    const offer = formMode === 'add' && convBranch === 'spend' && !isPayableForm
      && (openCommitments.length > 0 || Boolean(conv.spendExpenseId));
    if (!offer) return undefined;
    /* ⚠⚠ A DOOR CAN NAME A SETTLED BILL — the bill-aware Record button (owner, §114 walk
       2026-08-27) pre-fills whichever bill the coach is standing on, and that bill may already be
       fully paid, so it will not be among `openCommitments` (nothing left to pay down there is the
       whole reason that list excludes it). Same fact `payingBill` already reads from the FULL list
       for the identical reason — this is that fix reaching the visible field: without it, the
       field read back blank the moment the pre-filled bill happened to be a paid one. */
    const selectedSettled = conv.spendExpenseId && !openCommitments.some(c => c.id === conv.spendExpenseId)
      ? commitmentsAll.find(c => c.id === conv.spendExpenseId)
      : undefined;
    return {
      label: 'Bills you owe',
      /* These trailing figures ARE debts, so they read as the portal's owing colour — the shared
         control is quiet unless a caller says otherwise. */
      metaTone: 'owing' as const,
      options: openCommitments.map(c => ({
        id: c.id,
        name: c.name,
        meta: `${fmt(c.remaining)} owing`,
      })),
      selectedId: conv.spendExpenseId || null,
      selectedName: selectedSettled?.name,
      /* ⚠ THE OTHER HALF OF THE FIELD CLEARS. One question, one answer: a record carrying both a
         bill and a budget item would be a payment and a new cost at once. The description goes too
         when it is still the item's own name — the same `isItemLabel` rule the picker's own
         pre-fill uses, so a coach's typing is never thrown away. */
      onPick: (id: string) => {
        const bill = openCommitments.find(c => c.id === id);
        setConv(c => ({ ...c, spendExpenseId: id, spendInstallmentId: '' }));
        setForm(f => ({
          ...f,
          budgetCategoryId: '', budgetItemId: '', budgetItemName: '', category: '',
          description: isItemLabel(f) ? '' : f.description,
          /* The remainder, never the face value — the same rule the bill's own payment door
             follows: pre-filling more invites a coach to confirm a figure larger than the payment
             they actually made. Editable, like any suggestion. */
          amount: f.amount || (bill ? String(bill.remaining) : ''),
        }));
      },
    };
  }, [formMode, convBranch, isPayableForm, openCommitments, conv.spendExpenseId, commitmentsAll]);

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
  const {
    payBills, payStatusCounts, payItemNames, payTagBillCounts, payTagPieceCounts,
  } = useMemo(() => {
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
    /**
     * ⚠ THE TAG FILTER IS RECORDED HERE AND APPLIED IN PASS TWO, not applied here. The Tags
     * dropdown has to count what ticking an option WOULD show, which means walking the bills the
     * tag filter currently excludes — impossible once they have been `continue`d past. `tagIds`
     * carries what each bill is labelled with; `passesTag` is the answer this render needs.
     */
    const admitted: Array<{
      bill: PayBillDraft; pieces: PayPiece[]; tagIds: readonly string[]; passesTag: boolean;
    }> = [];
    const itemNames = new Set<string>();

    for (const e of allPayablesRaw) {
      const name = itemName(e);
      if (name) itemNames.add(name);
      const standing = standings[e.id];
      if (!standing) continue;
      if (payItems.size > 0 && (!name || !payItems.has(name))) continue;
      /* The tag pill, inlined rather than called through a helper: a predicate rebuilt on every
         render is a dependency this memo could never satisfy, and its two real inputs
         (`filterTagIds`, `tagsByExpenseId`) are already in the list below. */
      const tagIds = tagsByExpenseId[e.id] ?? [];
      const passesTag = filterTagIds.size === 0 || tagIds.some(id => filterTagIds.has(id));

      const count = standing.installments.length;
      const pieces: PayPiece[] = standing.installments.map(inst => {
        const statuses = installmentStatuses(inst, today);
        /* Status counts stay narrowed by the tag pill exactly as before — a bill the tag filter is
           hiding must not add to the number beside a status a coach can tick. */
        if (passesTag) for (const s of statuses) counts[s]++;
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
        tagIds,
        passesTag,
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
      /* ⚠⚠ A CLUB BILL CARRIES NO TAG, SO A TAG FILTER DROPS IT (fixed 2026-08-26). This is the
         register's own rule — "every other row simply has no such label, which is a match of zero,
         not a match of all" — finally applied to the other face. Until now these were pushed onto
         the list AFTER the tag filter and so bypassed it entirely: filtering Payables by an
         occasion left every club bill sitting among the results, while the band beneath counted
         only the tagged team bills and therefore disagreed with the rows on screen. */
      const passesTag = filterTagIds.size === 0;
      const pieces: PayPiece[] = rows.map(r => {
        const settled = !!r.paid;
        const status: PayableRowStatus = settled ? 'paid'
          : (r.dueDate ?? '') < today ? 'overdue' : 'outstanding';
        if (passesTag) counts[status]++;
        return {
          key: r.id,
          dueDate: r.dueDate ?? today,
          label: r.label ?? 'Installment',
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
        tagIds: [],
        passesTag,
      });
    }

    /* Pass two — Status narrows, and a bill whose every piece was filtered out drops off the list.
       The header's OWN figures (paid of total, still owing) are deliberately taken from the whole
       bill above, never from the visible slice: "$1,550 still owing" must not change because the
       coach ticked a filter. */
    const bills: PayBill[] = [];
    /**
     * ⚖⚖ WHAT TICKING THAT TAG WOULD PUT ON SCREEN (owner ruling 2026-08-26) — counted over the
     * bills every OTHER control already admits, so the number on the option is a promise about the
     * list underneath it rather than a census of the label.
     *
     * ⚠ BOTH UNITS ARE TALLIED HERE, and the arrangement picks one later. Payables shows bills
     * under `Group by: commitment` and dated payments under `Group by: due date` — the band already
     * switches nouns between them, so the count has to switch with it. Tallying both keeps `groupBy`
     * OUT of this memo's dependencies: flipping the arrangement must not rebuild every bill.
     */
    const tagBillCounts = new Map<string, number>();
    const tagPieceCounts = new Map<string, number>();
    for (const { bill, pieces, tagIds, passesTag } of admitted) {
      const visible = payStatus.size === 0
        ? pieces
        : pieces.filter(p => p.statuses.some(s => payStatus.has(s)));
      /* A bill Status has emptied is off the list, so it counts towards no tag either — the rows
         and the number leave through the same `continue`. */
      if (visible.length === 0) continue;
      for (const id of tagIds) {
        tagBillCounts.set(id, (tagBillCounts.get(id) ?? 0) + 1);
        tagPieceCounts.set(id, (tagPieceCounts.get(id) ?? 0) + visible.length);
      }
      if (!passesTag) continue;
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
      payTagBillCounts: tagBillCounts,
      payTagPieceCounts: tagPieceCounts,
      /* The words actually on THIS list, not the whole library — a filter offering an item the team
         has never committed against is a control that can only ever empty the screen. */
      payItemNames: [...itemNames].sort((a, b) => a.localeCompare(b)),
    };
  }, [allPayablesRaw, standings, schedule, payStatus, payItems, categories, tagsByExpenseId, filterTagIds]);

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

  /**
   * ⚠⚠ EVERYTHING THE TAG FILTER NEEDS, MEMOISED AND HOISTED ABOVE THE ACCESS GUARD — and both
   * halves of that are load-bearing.
   *
   * **Hoisted**, because `if (ctxLoading) return …` sits below this and a `useMemo` after an early
   * return is a conditional hook. This is the same move (and the same reason) as the note on
   * `allPayablesRaw` further up: *fine for JSX, illegal for a hook's dependency list.*
   *
   * **Memoised**, because this panel hosts the money-entry FORM as well as both money screens, so
   * it re-renders on every keystroke a coach types into it — and this block walks every expense on
   * the season to count tags. It was in the render body until `/simplify`'s efficiency lens
   * measured it (2026-08-25).
   *
   * ⚠ It depends on `expenseTags`, NOT on the render-body `tagById` Map — that Map is rebuilt on
   * every render, so depending on it would have defeated the memo silently while looking correct.
   *
   * ⚠⚠ A TAG THAT IS SELECTED IS ALWAYS AN OPTION, even when this face uses it on nothing, and that
   * is not tidiness — it is the difference between a control and a trap. The selection SURVIVES A
   * TAB CHANGE (nothing clears it, deliberately: a coach comparing the two faces of one occasion
   * should not have to re-pick). Offering only the tags this face uses meant filtering Payables by
   * a bills-only label and switching to Transactions could hide the pill entirely — while the
   * filter it had set was still narrowing the book to nothing. An empty screen, no explanation, and
   * no control left to undo it. So a selected-but-unused tag stays, honestly counted `(0)`, and the
   * band says which label produced nothing — which "Nothing matches that" cannot.
   */
  const tagFacts = useMemo(() => {
    const byId = new Map(expenseTags.map(t => [t.id, t]));
    /**
     * ⚖⚖ THE COUNT IS A PROMISE ABOUT THE LIST (owner ruling 2026-08-26): "how many rows am I going
     * to see when I filter". Each face hands over a tally already taken in the unit that face
     * renders, over the rows its OTHER controls admit —
     *
     *   Transactions           register lines
     *   Payables · commitment  bills
     *   Payables · due date    dated payments
     *
     * ⚠ IT USED TO BE A CENSUS OF THE LABEL — one count of tagged RECORDS, shown on both faces and
     * in both arrangements. A commitment paid in three installments is one record and three
     * register lines, so the option read "(1)" directly above a band reading "across 3 costs": the
     * same question, two units, six inches apart.
     */
    const counts = onPayables
      ? (groupBy === 'due' ? payTagPieceCounts : payTagBillCounts)
      : registerTagCounts;
    /* ⚠⚠ WHICH TAGS ARE OFFERED IS *NOT* DERIVED FROM THOSE COUNTS, and that separation is
       load-bearing. A count is now the row count, so it legitimately reads (0) when the Date or
       Status pill excludes every row a tag is on — and a list built from the counts would make the
       option VANISH as a coach moved the date pill, which is the trap the block above this memo
       exists to prevent. The offer stays what it always was: every tag this face's records carry,
       plus anything selected. Only the number changed. */
    const activeAll = onPayables ? allPayablesRaw : expenses;
    const present = new Set<string>();
    for (const e of activeAll) for (const id of (tagsByExpenseId[e.id] ?? [])) present.add(id);
    const used = [...new Set([...present, ...filterTagIds])]
      .map(id => byId.get(id))
      .filter((t): t is RepTeamTag => !!t)
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      used,
      /* ⚠ COUNTS RIDE THE OPTION LABEL, the convention Status already uses ("Overdue (2)") — one
         family, one look. `?? 0` is load-bearing rather than defensive, and more so since the count
         became a row count: a tag selected on the other face, or one every visible row has been
         filtered away from, is deliberately still offered and must read "(0)", never
         "(undefined)".
         ⚠ `swatch` is the org/team distinction the row chips already draw; it is a NAMED ROLE, not
         a colour, so the dropdown's own stylesheet owns which token paints it. */
      options: used.map(t => ({
        id: t.id,
        label: `${t.name} (${counts.get(t.id) ?? 0})`,
        swatch: t.teamId === null ? ('org' as const) : ('own' as const),
      })),
      /* "Summer Classic" · "Summer Classic or Fall Cup" · "A, B or C". OR, not AND — the pill
         widens the answer rather than narrowing it twice (see `filterTagIds`). */
      phrase: joinWithOr(used.filter(t => filterTagIds.has(t.id)).map(t => t.name)),
      /** The commitments this face is showing, for the total and for the export. */
      filteredActive: payBills.map(b => b.expense).filter((e): e is RepTeamExpense => !!e),
    };
  }, [expenseTags, onPayables, allPayablesRaw, expenses, tagsByExpenseId, filterTagIds, payBills,
      groupBy, payTagBillCounts, payTagPieceCounts, registerTagCounts]);

  /**
   * ⚖⚖ WHAT THE TAGGED LIST COMES TO — the answer tags exist to give (owner ruling, plan §5.3):
   * "what did the Summer Classic actually cost us?" A filtered view that shows rows but no total
   * has not answered it, and until P3 Transactions showed no total at all while Payables showed one
   * written back-to-front ("vs {tag}: 3 commitments, $900.00 total").
   *
   * ⚠⚠ IT TOTALS WHATEVER THE LIST IN FRONT OF YOU IS SHOWING, and that is the whole rule. It is
   * NOT a second arithmetic over the same records (`check:register` / `check:money-report` exist
   * because two places computing one figure is how they drift): each face reduces the rows its own
   * filters ALREADY produced, in that face's own unit —
   *
   *   Transactions        the book's money-out, over `bookRows`      "$1,240.00 across 3 costs"
   *   Payables · bills    each commitment's amount                   "$900.00 across 3 commitments"
   *   Payables · due date each dated piece's face amount             "$900.00 across 5 payments"
   *
   * ⚠⚠ THE DUE-DATE FACE READS `faceAmount`, AND READING `owing` THERE WAS A BUG (`/simplify`,
   * 2026-08-25). `PayPiece.owing` is dual-purpose: on an UNSETTLED piece it is the remaining
   * balance, but on a SETTLED one it is the full face amount. Summing it across every visible piece
   * and calling the result "still owing" therefore counted every paid installment at full value the
   * moment a coach ticked Paid. The face amount has one meaning in both states, so the sentence
   * stays true whatever Status is showing — and the two Payables arrangements then agree on the
   * same money, which is the point of their being two views of one list.
   *
   * ⚠ SCHEDULED AND OUT-OF-POCKET ROWS COUNT. A cost a parent fronted still cost the occasion (the
   * team owes them for it), and a scheduled piece is on screen wearing its own badge. Excluding
   * either would make the total disagree with rows a coach can see and add up themselves — which is
   * the complaint this band closes.
   */
  const tagFilterSummary = useMemo(() => {
    if (filterTagIds.size === 0) return null;
    if (!onPayables) {
      return { total: bookRows.reduce((s, r) => s + r.moneyOut, 0), count: bookRows.length, noun: 'cost' };
    }
    if (groupBy === 'due') {
      const pieces = payPeriods.flatMap(b => b.rows);
      return { total: pieces.reduce((s, { piece }) => s + piece.faceAmount, 0), count: pieces.length, noun: 'payment' };
    }
    const bills = tagFacts.filteredActive;
    return { total: bills.reduce((s, e) => s + e.amount, 0), count: bills.length, noun: 'bill' };
  }, [filterTagIds, onPayables, bookRows, groupBy, payPeriods, tagFacts]);

  /**
   * The bill whose page is open, and its standing.
   *
   * ⚠ LOOKED UP, NEVER HELD IN STATE: after a payment lands the data rebuilds, and a held copy
   * would go on showing the figures from before the write until the coach left and came back.
   *
   * ⚠⚠ **AND LOOKED UP UNFILTERED — `allPayablesRaw`, DELIBERATELY NOT `payBills`** (Part B,
   * 2026-08-26). `payBills` is the PAYABLES FACE's list: narrowed by its Status, Item and tag
   * filters, and **Status hides settled bills by default**. So the old lookup could not find a
   * fully-paid commitment at all, and a link to one showed the LIST instead of the bill — with
   * nothing on screen to say why. That was survivable while the only way here was tapping a visible
   * row; the register re-point makes following a link to a bill you already paid an ordinary
   * journey, which is exactly the case the filtered lookup got wrong.
   *
   * This is the same rule `spendLeadGroup` states three hundred lines up, in as many words: a coach
   * who has filtered a screen has not told the product to forget the rest of their bills.
   *
   * ⚠ AN EXPENSE, NOT A `PayBill`. The header, the filing line and the payee moved into
   * `CommitmentView` with the phase, so the two things left to hand it are the record and its
   * standing — and neither of those has ever been filtered.
   */
  const drawerExpense = drawerFor ? allPayablesRaw.find(e => e.id === drawerFor) ?? null : null;
  const drawerStanding = drawerExpense ? standings[drawerExpense.id] : undefined;

  /* ── Adding one dated payment, in place under the schedule (§114 walk, 2026-08-27) ───────────
     ⚠ THE FIELDS LIVE HERE RATHER THAN IN A CHILD COMPONENT because the row belongs to the
     schedule, and the schedule is this panel's — the whole split of Part B is that the fields on
     the page are `CommitmentView`'s and everything that touches the plan or the money stays here. */
  const [addingRow, setAddingRow] = useState(false);
  const [addRowDate, setAddRowDate] = useState('');
  const [addRowAmount, setAddRowAmount] = useState('');
  const [addRowBusy, setAddRowBusy] = useState(false);
  const [addRowError, setAddRowError] = useState('');

  function closeAddRow() {
    setAddingRow(false);
    setAddRowDate('');
    setAddRowAmount('');
    setAddRowError('');
  }

  /**
   * Append one payment to a bill's schedule.
   *
   * ⚠⚠ THE PLAN IS REBUILT FROM THE LIVE STANDING AT SUBMIT, and every existing row carries its
   * STORED ID. The server matches rows by id and treats anything it does not recognise as brand
   * new, so a plan sent without them reads as "delete all of these and create these" — the exact
   * shape in which a positional row key once re-pointed a recorded payment at the wrong piece.
   * Reading the standing here rather than at open time also means a payment recorded in another
   * tab while this row sat open cannot be written back out of existence.
   *
   * ⚠ NO CLIENT-SIDE COPY OF THE PLAN RULES. The route runs `parseInstallmentPlan`, which owns the
   * ceiling, the per-row sentences and the id carry-through; its refusal is written for a coach and
   * is shown here as-is. A second validator on this side is how the schedule editor's two copies
   * drifted apart before.
   */
  async function addInstallmentInline(e: RepTeamExpense) {
    if (addRowBusy) return;
    const standing = standings[e.id];
    setAddRowBusy(true);
    setAddRowError('');
    try {
      const existing = piecesByNumber(standing).map(p => ({
        id: p.id, dueDate: p.dueDate, amount: p.amount,
      }));
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expenses/${e.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installments: [...existing, { dueDate: addRowDate, amount: addRowAmount }],
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not add the installment.');
      closeAddRow();
      await refreshAfterWrite();
    } catch (err: any) {
      setAddRowError(err?.message ?? 'Could not add the installment.');
    } finally {
      setAddRowBusy(false);
    }
  }

  /** Where the commitment page's arrow goes, and what it is called — see `openBillById`. */
  /** One tab to return to now — the address carries no view, so the panel lands on whatever this
   *  device remembers, which is the view the coach opened the bill from (see `openBillById`). */
  const billBackTo = { href: moneySectionHref(base, 'ledger', undefined), label: 'Ledger' };

  const foldKeys = groupBy === 'due' ? payPeriods.map(p => p.key) : payBills.map(b => b.key);
  /**
   * Bills open shut, periods open open — see `flippedFolds`.
   *
   * ⚠⚠ THIS MAY ONLY DEPEND ON `groupBy`, NEVER ON HOW MANY GROUPS ARE CURRENTLY VISIBLE.
   * Two reasons, and the second one is a bug that actually shipped into this working copy:
   *
   * 1. **A filter narrows content; it does not restyle the screen** (owner ruling 2026-08-26,
   *    choosing this over a "one group opens itself" variant). Ticking a tag must not change the
   *    resting shape of the list it filters.
   * 2. **`flippedFolds` is a DELTA, not a state.** It records the keys that differ from this
   *    default, so the moment the default moves, every entry in it reverses meaning. A version of
   *    this line reading `groupBy === 'commitment' && foldKeys.length > 1` did exactly that: open a
   *    bill among several, then filter down to that one bill, and it re-folded itself — hiding the
   *    very thing the coach had just narrowed to, with the bulk toggle gone too. Three independent
   *    review lenses found it. If a future default needs to vary with anything else on screen,
   *    `flippedFolds` has to stop being a delta first.
   */
  const foldDefaultShut = groupBy === 'commitment';
  /** Is this group shut right now? The default, flipped by anything the coach has toggled. */
  const isShut = (key: string) => foldDefaultShut !== flippedFolds.has(key);
  /** Is everything shut? Decides whether the one control says "Fold all" or "Open all" — two
   *  buttons for one toggle would be the click tax this strip is trying to avoid. */
  const allFolded = foldKeys.length > 0 && foldKeys.every(isShut);

  /** The two id lookups a register row needs to find its record. Same reasoning as the memo above:
   *  rebuilding two Maps over every expense and arrival on each keystroke is work the form's text
   *  inputs were making this screen do for nothing. */
  const expenseById = useMemo(() => new Map(expenses.map(e => [e.id, e])), [expenses]);
  const moneyInById = useMemo(() => new Map(moneyIn.map(m => [m.id, m])), [moneyIn]);

  // ?view= — the fold's address for a view of the one book (?view=timeline|bills|due), with the
  // legacy ?tab= names still honoured (schedule/commitments/payables — years of bookmarks, the
  // BvA drill-in, the legacy-address mapper and the UAT smoke spec all sent them). Reactive on
  // the search params, not mount-only: under the Money hub this panel stays mounted across
  // visits, so following "See the full payment schedule" a second time must jump the view again
  // rather than silently doing nothing because it already fired once.
  /* ⚠ THE URL OUTRANKS THE REMEMBERED VIEW, and then BECOMES it: landing on ?view=due switches
     the book to the schedule AND updates this device's memory (the persist effect watches
     `view`), so the commitment page's back arrow — which carries no view — returns to what the
     coach was last reading. */
  const wantedView = seasonSearchParams.get('view');
  const wantedTab = seasonSearchParams.get('tab');
  useEffect(() => {
    if (wantedView && isLedgerView(wantedView)) { setView(wantedView); return; }
    if (wantedTab && TAB_AS_VIEW[wantedTab]) setView(TAB_AS_VIEW[wantedTab]);
  }, [wantedView, wantedTab]);

  /* ?filter= and ?scheduled= — where the Overview's next-30-days window lands (plan §4.5).
     ⚠ SAME REACTIVITY RULE AS `?view=` ABOVE, for the same reason: this panel stays mounted across
     visits under the hub, so clicking a second window row must re-narrow the book rather than
     silently do nothing because the effect already fired once.
     ⚠ THESE PARAMS NAME REGISTER CONTROLS, SO THEY FORCE THE TIMELINE (fold, 2026-08-28). A coach
     whose remembered view is By bill would otherwise follow "show me the scheduled dues" and land
     on a list whose narrowing they cannot see — the filter applied to an invisible register. */
  const wantedFilter = seasonSearchParams.get('filter');
  const wantedScheduled = seasonSearchParams.get('scheduled');
  useEffect(() => {
    if (!wantedFilter && wantedScheduled !== '1') return;
    setView('timeline');
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
  }, [wantedFilter, wantedScheduled]);

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
      /* The conversation's branch records go through their HOME TAB's writer — never this form's
         ledger save (P1: the conversation adds no write paths). Add mode only: an edit derives
         its kind from the record and `convBranch` is never set for one. */
      if (!editing && !editingMoneyIn) {
        /* ⚠ A COMMITMENT'S OWN DOOR ASKS NO SUCH QUESTION. Payables' "Add a commitment" opens this
           form in its setup mode — one kind of record, stated rather than chosen — so there is no
           conversation answer to be missing (owner ruling B2, 2026-08-23). */
        if (convBranch === null && !isPayableForm) throw new Error('Choose what happened first.');
        if (convBranch !== null && CONV_DIRECT.has(convBranch)) {
          await saveConversationBranch();
          return;
        }
        /* Paying down a bill is the SAME first answer — "we paid for something" — with the picker's
           "Bills you owe" group chosen instead of a budget item (C2). It writes through the bill's
           own payments route, so it leaves this form's ledger save entirely. */
        if (convBranch === 'spend' && conv.spendExpenseId) {
          await saveBillPayment();
          return;
        }
      }
      if (isMoneyInForm) {
        await saveMoneyIn();
        dismissForm();
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

      /* ⚠⚠ A COST RECORDED HERE HAS A DATE (owner ruling B2, 2026-08-23). Leaving it blank used to
         be the documented way to say "not paid yet" — a second, invisible door to a commitment,
         beside the paid/owed fork that has now been deleted and the future-date refusal that hands
         a coach to Payables. Record is for money that MOVED, so it has a day. An EDIT is exempt:
         records created under the old rule exist and must stay editable without being forced into
         a date the coach cannot know. */
      if (!isPayable && !editing && !form.paidDate) {
        throw new Error('Enter the day the money left — or make it a bill if it hasn’t been paid yet.');
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
      dismissForm();
      await refreshAfterWrite();
    } catch (e: any) {
      setSaveError(e.message);
      // The refusal is ABOUT this exact state — editing anything makes it stale (see snapshot).
      setSaveErrorSnapshot({
        form, conv, plan: formPlan, payee: formPayee, tags: formTags, timing: formTiming,
      });
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
      dismissForm();
      /* ⚠⚠ DELETING THE BILL YOU ARE STANDING ON MUST LEAVE ITS PAGE. On the list this is an
         ordinary refresh, but a commitment has a route of its own now — and a page addressing a
         record that no longer exists is an empty screen with a back arrow, reached by the coach's
         own successful action. Go where they were going anyway. */
      if (focusBillId) { router.push(moneySectionHref(base, 'ledger', undefined, seasonSearchParams.toString())); return; }
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

    /* ⚠⚠ THE COLLISION, PREVENTED RATHER THAN RESOLVED (money centralization P4, owner-approved
       2026-08-27). A bill that already says a family fronted it OWNS every payment against it, so
       the question is not asked a second time a few inches from its own answer — it is STATED, and
       the payment inherits it. Two answers to one question on one screen is the defect the filter-
       count ruling (2026-08-26) named; the server refuses a disagreeing pair for the same reason.
       ⚠ A cost genuinely split between two fronting households is a THIRD thing and is recorded as
       two costs. Do not reopen this as an override. */
    if (payingBill?.expense.paidByPlayerId) {
      const fronted = roster.find(p => p.id === payingBill.expense.paidByPlayerId);
      return (
        <div className={`${styles.field} ${styles.formGridFull}`}>
          <label className={styles.label}>Paid by</label>
          <div className={styles.lockedField}>
            <span>
              A family, out of pocket
              {fronted ? <> — {formatPlayerLastFirst(fronted)}</> : null}
            </span>
            <span className={styles.lockedTag}>Set on the cost</span>
          </div>
          {/* The chip says WHAT; this says WHY — and this is the one screen where a coach could
              reasonably expect to be asked, so the silence needs a sentence. */}
          <p className={styles.formHint}>
            This cost says a family paid it. Every payment against it is theirs.
          </p>
        </div>
      );
    }

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
              A family, out of pocket — {formatPlayerLastFirst(p)}
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
   * "What happened?" — the conversation's first question, as a FIELD on the form (frames A/B).
   *
   * The open list IS approved mockup 01: eight sentences, two groups, live hints where the hub's
   * summary already knows something useful. ⚠ The hints read the summary riding the hub context —
   * never a fresh fetch on open (build prompt §2.8). Without a hub around (no provider), the
   * options simply carry no hints; the club answer needs to know org linkage and falls back to
   * the register's own flag.
   */
  function renderWhatField() {
    /* ⚠ LOCKED — the door named one record (owner ruling A). Both answers collapse into one stated
       band: the branch's own sentence, the subject the door supplied, and a quiet second line. No
       control at all, so there is nothing to switch and no ghost save to make. */
    if (convLock && convBranch) {
      return (
        <div className={`${styles.formGridFull} ${styles.convLockBand}`}>
          <span className={styles.convLockLine}>
            {CONV_BRANCH[convBranch].name} — {convLock.subject}
          </span>
          {convLock.detail && <span className={styles.convLockDetail}>{convLock.detail}</span>}
        </div>
      );
    }
    const s = recordSignal?.summary ?? null;
    const live: Partial<Record<ConversationBranch, string>> = {};
    if (s) {
      if (s.dues.overdueCount > 0) {
        live.dues = `${s.dues.overdueCount} overdue · ${fmt(s.dues.overdueAmount)}`;
      } else if (s.dues.outstanding > 0.005) {
        live.dues = `${fmt(s.dues.outstanding)} still to come`;
      }
      if (s.fundraisers.activeCount > 0) {
        live.drive = s.fundraisers.activeCount === 1 ? '1 drive running'
          : `${s.fundraisers.activeCount} drives running`;
      }
      if (s.allocations.outstanding > 0.005) live.club = `${fmt(s.allocations.outstanding)} owed`;
      if (s.dues.familiesInCreditCount > 0) {
        // Dollars ride along like every other hint — and this is the summary's held-total's
        // one consumer, so the figure is not shipped speculatively (/simplify, 2026-08-23).
        live.payout = `${s.dues.familiesInCreditCount === 1 ? '1 family' : `${s.dues.familiesInCreditCount} families`} in credit · ${fmt(s.dues.familyCreditHeld)}`;
      }
    }
    const orgLinked = s ? s.orgLinked : (book?.orgLinked ?? false);
    return (
      <div ref={whatWrapRef} className={`${styles.field} ${styles.formGridFull} ${styles.convWhatWrap}`}>
        <label className={styles.label}>What happened? *</label>
        <button
          type="button"
          className={`${styles.convWhatField} ${convBranch === null && !isPayableForm ? styles.convWhatFieldEmpty : ''}`}
          aria-haspopup="listbox"
          aria-expanded={whatOpen}
          onClick={() => {
            if (!whatOpen) {
              // Anchor the fixed list to the field as it stands at this moment.
              const r = whatWrapRef.current?.getBoundingClientRect();
              setWhatRect(r ? { top: r.bottom + 4, left: r.left, width: r.width } : null);
            }
            setWhatOpen(o => !o);
          }}
        >
          {/* On a handed-off bill form the field's standing answer is the bill row — the whole
              reason it renders there (see `billHandOff`). */}
          <span>{convBranch ? CONV_BRANCH[convBranch].name : isPayableForm ? BILL_HAND_OFF_ROW.name : 'Choose…'}</span>
          <ChevronDown size={15} className={styles.convWhatCaret} aria-hidden />
        </button>
        {whatOpen && whatRect && (
          <>
            <div
              className={styles.convWhatList}
              style={{ top: whatRect.top, left: whatRect.left, width: whatRect.width }}
              role="listbox"
              aria-label="What happened?"
            >
              {CONV_GROUPS.map(group => (
                <Fragment key={group.label}>
                  <div className={styles.convWhatGroup}>{group.label}</div>
                  {group.options
                    .filter(id => id !== 'club' || orgLinked)
                    .map(id => (
                      <button
                        key={id}
                        type="button"
                        role="option"
                        aria-selected={convBranch === id}
                        className={styles.convWhatOpt}
                        /* The compiler flags selectBranch because the branch LOADERS it calls
                           read `convLoadGen.current` — but only inside their async bodies, after
                           the click, never during render (the same read pattern `loadSeq` has
                           always used one screen up). False positive, documented not obeyed. */
                        /* From a handed-off bill form, choosing a real answer is the way BACK —
                           the mirror of the hand-off, typing carried (owner, 2026-08-29). */
                        // eslint-disable-next-line react-hooks/refs
                        onClick={() => (isPayableForm ? handBackFromBillForm(id) : selectBranch(id))}
                      >
                        <span>
                          <span className={styles.convWhatOptName}>{CONV_BRANCH[id].name}</span>
                          <span className={styles.convWhatOptSub}>{CONV_BRANCH[id].sub}</span>
                        </span>
                        {live[id] && <span className={styles.convWhatOptLive}>{live[id]}</span>}
                      </button>
                    ))}
                </Fragment>
              ))}
              {/* ⚖⚖ THE THIRD GROUP IS A HAND-OFF, NOT A BRANCH (owner, fold round 3, 2026-08-28
                  — option C). It is deliberately NOT in `CONV_GROUPS` and NOT a
                  `ConversationBranch`: picking it walks the coach out of the conversation into
                  the BILL form with their typing kept — the same act as the future-date refusal,
                  promoted to a front door. The modal retitles to "Add a bill" and its "nothing
                  moves" consequence pins by Save, so the change of acts is announced. See
                  `handOffToBillForm`'s header for why ruling B allows a hand-off and forbids a
                  fork. ⚖ Its words became an ANSWER and the hand-off became REVERSIBLE
                  (owner, 2026-08-29): what happened is the team AGREED to pay — a real event even
                  though no money moved — so the field can stand on this row on the bill form and
                  every choice in this list stays revisable, this one included. */}
              <div className={styles.convWhatGroup}>Not paid yet</div>
              <button
                type="button"
                role="option"
                aria-selected={isPayableForm}
                className={styles.convWhatOpt}
                /* Already on the bill form: re-picking the standing answer is a no-op close, the
                   same shape as `selectBranch`'s own same-answer early return. */
                onClick={() => { setWhatOpen(false); if (!isPayableForm) handOffToBillForm(); }}
              >
                <span>
                  <span className={styles.convWhatOptName}>{BILL_HAND_OFF_ROW.name}</span>
                  <span className={styles.convWhatOptSub}>{BILL_HAND_OFF_ROW.sub}</span>
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  /**
   * The four home-tab branches' bodies (dues receipt · drive amount · club settlement · payout).
   * Same grammar as the ledger branches: the branch's one real question, the shared fields, and a
   * consequence line stating dollars before anything saves. ⚠ Consequences RESTATE the writer's
   * own behaviour (overpayment becomes a credit; a payout is capped) — they never compute a
   * figure the register would then have to agree with.
   */
  function renderConvBody() {
    const amount = Number(form.amount) || 0;
    const consequence = (body: ReactNode) => (
      <p className={`${styles.formHint} ${styles.formHintConsequence} ${styles.formGridFull}`}>
        <strong>When you save:</strong> {body}
      </p>
    );

    if (convBranch === 'dues') {
      const sel = (duesBook ?? []).find(p => p.id === conv.duesPlayerId) ?? null;
      /* ⚠ THE SHARED RULE, IN CENTS (/simplify reuse pass, 2026-08-23). This was a local float
         ternary for the same question the dues panel two files over already asks through
         `overpaymentExcess` — the one place the "anything beyond what is owed becomes a credit"
         rule lives, and the one with tests behind it. Two implementations of one money rule is how
         the form and the receipt book start disagreeing about a family's credit by a cent. */
      const over = sel ? overpaymentExcess(sel.outstanding, 0, amount) : 0;
      return (
        <>
          {convPickerField({
            label: 'Which player *',
            error: duesBookError,
            items: duesBook,
            loading: 'Loading the dues book…',
            empty: <>No dues schedules yet — set them up on <strong>Player Dues</strong> first.</>,
            select: (
              <select
                className={styles.select}
                value={conv.duesPlayerId}
                onChange={e => setConv(c => ({ ...c, duesPlayerId: e.target.value }))}
              >
                <option value="">Choose…</option>
                {(duesBook ?? []).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.outstanding > 0.005 ? `owes ${fmt(p.outstanding)}` : 'paid up'}
                  </option>
                ))}
              </select>
            ),
          })}
          {convAmountField('Amount *')}
          <div className={styles.field}>
            <label className={styles.label}>Date received *</label>
            <input
              className={styles.input} type="date" max={moneyMovedMaxDate()}
              value={form.receivedDate}
              onChange={e => setForm(f => ({ ...f, receivedDate: e.target.value }))}
            />
          </div>
          {convMethodField('duesMethod')}
          {convNoteField('e.g. paid at practice')}
          {sel && amount > 0 && consequence(<>
            <strong>{sel.name.split(', ').reverse().join(' ')}&apos;s bill drops to{' '}
            {fmt(Math.max(0, r2c(sel.outstanding - amount)))}</strong>.
            {over > 0 && <> The {fmt(over)} beyond their bill becomes a credit the family can use.</>}
            {' '}Shows on the ledger right away.
          </>)}
        </>
      );
    }

    if (convBranch === 'drive') {
      const detail = conv.driveId ? driveDetail[conv.driveId] : undefined;
      const openPlayers = detail?.players.filter(p => p.logged === null) ?? [];
      const loggedCount = (detail?.players.length ?? 0) - openPlayers.length;
      const selPlayer = detail?.players.find(p => p.playerId === conv.drivePlayerId) ?? null;
      const credit = detail ? r2c(amount * detail.rebatePercent / 100) : 0;
      return (
        <>
          {convPickerField({
            label: 'Which drive *',
            error: drivesError,
            items: drives,
            loading: 'Loading the drives…',
            empty: <>No drive is running — start one on <strong>Fundraising</strong> first.</>,
            select: (
              <select
                className={styles.select}
                value={conv.driveId}
                onChange={e => {
                  const id = e.target.value;
                  setConv(c => ({ ...c, driveId: id, drivePlayerId: '' }));
                  if (id && !driveDetail[id]) void loadDriveDetail(id);
                }}
              >
                <option value="">Choose…</option>
                {(drives ?? []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            ),
          })}
          {/* Hand-built rather than `convPickerField` (it has a retry link and a footnote), but it
              goes through the SAME lock gate — see `identityField`. Opened from a leaderboard row,
              the drive AND the player are stated in the band above. */}
          {conv.driveId && identityField(
            <div className={`${styles.field} ${styles.formGridFull}`}>
              <label className={styles.label}>Which player *</label>
              {driveDetailError ? (
                /* Its own slot + a retry — re-picking the same drive can't refire onChange, so
                   without this link a failed leaderboard read wedged the branch on "Loading…"
                   until the whole conversation was reopened (/review, 2026-08-23). */
                <p className={styles.errorText}>
                  {driveDetailError}{' '}
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => void loadDriveDetail(conv.driveId)}
                  >
                    Try again
                  </button>
                </p>
              ) : !detail ? <p className={styles.formHint}>Loading the leaderboard…</p> : (
                <>
                  <select
                    className={styles.select}
                    value={conv.drivePlayerId}
                    onChange={e => setConv(c => ({ ...c, drivePlayerId: e.target.value }))}
                  >
                    <option value="">Choose…</option>
                    {openPlayers.map(p => (
                      <option key={p.playerId} value={p.playerId}>{p.playerName}</option>
                    ))}
                  </select>
                  {loggedCount > 0 && (
                    <p className={styles.formHint}>
                      {loggedCount === 1 ? '1 player already has' : `${loggedCount} players already have`}{' '}
                      an amount logged — change those from the drive&apos;s own row on Fundraising.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          {convAmountField('Amount raised *')}
          {/* Ruled IN (owner, §80 walk 2026-08-23 — was deviation ①): treasurers log drive money
              after the fact and need it in the PERIOD it arrived. Shares form.receivedDate, so it
              survives a branch switch like every date. ⚠ The drive's own Log-amount door still
              stamps today — it converges in P2 with the rest of the doors. */}
          <div className={styles.field}>
            <label className={styles.label}>Date received *</label>
            <input
              className={styles.input} type="date" max={moneyMovedMaxDate()}
              value={form.receivedDate}
              onChange={e => setForm(f => ({ ...f, receivedDate: e.target.value }))}
            />
          </div>
          {convNoteField('Optional')}
          {/* ⚰ THE "WHERE IT LANDS" PREVIEW IS RETIRED (owner ruling 2026-08-31 — "keep it
              simple", superseding binding mockup §2's preview with eyes open). It computed which
              of the family's dues installments the credit would lower — and its two prose branches
              could BOTH render on a family with nothing owing, saying the same fact twice in
              words the owner himself couldn't parse ("open bills" — a word the Ledger fold had
              meanwhile claimed for money the TEAM owes). What a coach needs before saving is one
              sentence, and the consequence line below is it: the family is CREDITED — true in
              every application mode, whether the credit lowers what they still send or becomes
              money owed back. The landing arithmetic still runs where it always really lived:
              in the save itself, and on the family's own dues screen. */}
          {detail && selPlayer && amount > 0 && consequence(<>
            <strong>the drive&apos;s total rises by {fmt(amount)}</strong>
            {credit > 0.005 && <> · <strong>{fmt(credit)}</strong> is credited to{' '}
              {selPlayer.playerName}&apos;s family ({detail.rebatePercent}%)</>}.
            {' '}Shows on the ledger as fundraising income.
          </>)}
        </>
      );
    }

    if (convBranch === 'club') {
      /* One thing owed = no real question — pre-answer it. A render-phase adjustment on a change
         guard (the hub page's own idiom), mirrored into the baseline so the pre-answer never
         counts as the coach's typing. Running at render rather than at fetch-resolve means it
         can't land on a branch the coach has since left, and it re-preselects on re-entry. */
      if (clubBills?.length === 1 && conv.clubInstallmentId === '') {
        const key = `${clubBills[0].splitId}:${clubBills[0].installmentId}`;
        prefillConv(c => ({ ...c, clubInstallmentId: key }));
      }
      const sel = (clubBills ?? []).find(b => `${b.splitId}:${b.installmentId}` === conv.clubInstallmentId) ?? null;
      return (
        <>
          {convPickerField({
            label: 'Which installment *',
            error: clubBillsError,
            items: clubBills,
            loading: "Loading the club's bills…",
            empty: <>Nothing is owed — the club&apos;s bills are settled.</>,
            select: (
              <select
                className={styles.select}
                value={conv.clubInstallmentId}
                onChange={e => setConv(c => ({ ...c, clubInstallmentId: e.target.value }))}
              >
                <option value="">Choose…</option>
                {(clubBills ?? []).map(b => (
                  <option key={`${b.splitId}:${b.installmentId}`} value={`${b.splitId}:${b.installmentId}`}>
                    {b.description} — {fmt(b.amount)} due {fmtDate(b.dueDate)}
                  </option>
                ))}
              </select>
            ),
            /* Fieldless ON PURPOSE (§2.2): today's settle is one tap — the server derives the
               amount and the date, and an allocation installment has nowhere to keep a method
               or note. A form here would make settling SLOWER, which the plan forbids. */
          })}
          {sel && consequence(<>
            <strong>{fmt(sel.amount)} moves from the team to the club</strong> —{' '}
            {sel.description}&apos;s installment shows settled, and the register gets the row.
          </>)}
        </>
      );
    }

    if (convBranch === 'sponsor') {
      const nameOf = (id: string) => {
        const p = roster.find(pl => pl.id === id);
        return p ? formatPlayerLastFirst(p).split(', ').reverse().join(' ') : 'a family';
      };

      /** The cold branch's first question (Direction A, 2026-08-29): WHICH sponsor — promises
       *  first with what they still owe, past sponsors after, and "a new sponsor" as one option
       *  rather than a separate form. A locked door never draws this: it has already answered. */
      const sponsorPicker = () => (
        <div className={`${styles.field} ${styles.formGridFull}`}>
          <label className={styles.label}>Which sponsor? *</label>
          {convSponsors === null ? (
            <p className={styles.formHint} style={{ margin: 0 }}>Loading your sponsors…</p>
          ) : (
            <select
              className={styles.select}
              value={conv.sponsorPicked}
              onChange={e => {
                const v = e.target.value;
                setConv(c => ({ ...c, sponsorPicked: v, sponsorId: v && v !== 'new' ? v : '', sponsorName: '' }));
                if (v && v !== 'new') void loadSponsorTarget(v);
              }}
            >
              <option value="">Choose…</option>
              <option value="new">A new sponsor…</option>
              {convSponsors.map(sp => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}{sp.stillToCome > 0.005 ? ` — ${fmt(sp.stillToCome)} still to come` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      );

      // ── LOCKED to an existing sponsor: record an ARRIVAL (mig 268, the record page's door).
      //    The identity is stated, not offered; the stored credit plan earns as the money lands,
      //    and the consequence runs the exact accrual the save will. ──
      if (conv.sponsorId) {
        const t = convSponsorTarget;
        const prior = new Map<string, number>();
        if (t) {
          for (const round of deriveAllArrivalCredits({ plan: t.plan, pledged: t.pledged, arrivalAmounts: t.arrivalAmounts })) {
            for (const s of round) prior.set(s.playerId, (prior.get(s.playerId) ?? 0) + s.credit);
          }
        }
        const shares = t && amount > 0
          ? accrueArrival({ plan: t.plan, pledged: t.pledged, arrivalAmount: amount, priorArrivalsTotal: t.arrived, priorAccrued: prior })
          : [];
        const remainingAfter = t ? stillToCome(t.pledged, t.arrived + Math.max(0, amount || 0)) : 0;
        const arrivalBody = (
          <>
            {convAmountField('Amount *')}
            <div className={styles.field}>
              <label className={styles.label}>Date received *</label>
              <input
                className={styles.input} type="date"
                max={moneyMovedMaxDate()}
                value={form.receivedDate}
                onChange={e => setForm(f => ({ ...f, receivedDate: e.target.value }))}
              />
            </div>
            {convSponsorMethodField()}
            {convNoteField('Optional details…')}
            {amount > 0 && consequence(<>
              <strong>{fmt(amount)} arrives</strong> — shows on the ledger as sponsorship income.
              {shares.length > 0 && <>
                {' '}
                {shares.map((s, i) => (
                  <Fragment key={s.playerId}>
                    {i > 0 && ', '}{nameOf(s.playerId)}&apos;s family earns <strong>{fmt(s.credit)}</strong>
                  </Fragment>
                ))}
                {' '}off dues.
              </>}
              {t && (remainingAfter > 0.005
                ? <> <strong>{fmt(remainingAfter)}</strong> of the pledge is still to come.</>
                : (t.pledged ?? 0) > 0 ? <> The pledge is fully kept.</> : null)}
            </>)}
          </>
        );
        // A locked door already answered "which sponsor"; the cold picker's choice keeps the
        // question on screen so it can be changed.
        return convLock ? arrivalBody : <>{sponsorPicker()}{arrivalBody}</>;
      }

      // The question comes first, and nothing else renders until it is answered — a form that
      // showed amount fields before knowing the sponsor would be the fused modal reborn.
      if (conv.sponsorPicked !== 'new') {
        return <>{sponsorPicker()}</>;
      }

      // ── COLD: a sponsor came through — create the record with its first arrival. ──
      const coldPlan = convSponsorPlan
        .filter(r => r.playerId && Number(r.value) > 0)
        .map(r => ({ playerId: r.playerId, value: Number(r.value), unit: r.unit }));
      const coldPlanProblem = amount > 0 ? creditPlanProblem(coldPlan, amount) : null;
      const coldShares = amount > 0 && !coldPlanProblem
        ? accrueArrival({ plan: coldPlan, pledged: amount, arrivalAmount: amount, priorArrivalsTotal: 0, priorAccrued: new Map() })
        : [];
      return (
        <>
          {sponsorPicker()}
          <div className={`${styles.field} ${styles.formGridFull}`}>
            <label className={styles.label}>Sponsor *</label>
            <input
              className={styles.input}
              value={conv.sponsorName}
              onChange={e => setConv(c => ({ ...c, sponsorName: e.target.value }))}
              placeholder="e.g. Riverdale Dental"
            />
          </div>
          {convAmountField('Amount *')}
          <div className={styles.field}>
            {/* ⚠ THE DAY THE MONEY ARRIVED (SP-2, 2026-08-28) — this branch posted income dated
                by keyboard time for two releases; a backdated cheque now lands in its month. */}
            <label className={styles.label}>Date received *</label>
            <input
              className={styles.input} type="date"
              max={moneyMovedMaxDate()}
              value={form.receivedDate}
              onChange={e => setForm(f => ({ ...f, receivedDate: e.target.value }))}
            />
          </div>
          {convSponsorMethodField()}
          {/* CREDIT FAMILIES — the shared plan editor (Q16; one component for all three doors
              after the §120 walk met the inline row squished). */}
          <div className={`${styles.field} ${styles.formGridFull}`}>
            <label className={styles.label}>Credit families</label>
            <SponsorCreditPlanEditor
              rows={convSponsorPlan}
              onChange={setConvSponsorPlan}
              families={roster.map(p => ({ id: p.id, name: formatPlayerLastFirst(p) }))}
              defaultShare={sponsorDefaultPct !== null ? String(sponsorDefaultPct) : '0'}
              problem={coldPlanProblem}
            />
          </div>
          {/* Tags reach money coming IN (mig 239) — the modal door has carried this field since
              08-15; the conversation door lacking it was the forms review's SP-9. */}
          <div className={`${styles.field} ${styles.formGridFull}`}>
            <label className={styles.label}>Tags</label>
            <TagSearchCombobox library={expenseTags} selectedIds={formTags} onChange={setFormTags} onCreate={createMoneyTag} placeholder="Type to find or create a money tag…" />
          </div>
          {convNoteField('Optional details…')}
          <p className={`${styles.formHint} ${styles.formGridFull}`}>
            A promised sponsorship isn&apos;t money yet — record a <strong>pledge</strong> on
            Fundraising, where its status lives.
          </p>
          {amount > 0 && conv.sponsorName.trim() && consequence(<>
            <strong>{fmt(amount)} arrives</strong> — shows on the ledger as sponsorship income.
            {/* The credit outcome is ALWAYS stated once families are picked — including "none"
                (owner, §80 walk 2026-08-23: a silent clause read as the credit being forgotten
                rather than being zero). */}
            {coldShares.length > 0
              ? <>
                  {' '}
                  {coldShares.map((s, i) => (
                    <Fragment key={s.playerId}>
                      {i > 0 && ', '}{nameOf(s.playerId)}&apos;s family earns <strong>{fmt(s.credit)}</strong>
                    </Fragment>
                  ))}
                  {' '}off dues.
                </>
              : coldPlan.length === 0 && convSponsorPlan.some(r => r.playerId)
                ? <> <strong>No dues credit</strong> — the credit above is zero, so it all stays with the team.</>
                : null}
          </>)}
        </>
      );
    }

    if (convBranch === 'payout') {
      const inCredit = (duesBook ?? []).filter(p => p.payableNow > 0.005);
      const sel = inCredit.find(p => p.id === conv.payoutPlayerId) ?? null;
      const overCeiling = sel && amount > sel.payableNow + 0.005;
      return (
        <>
          {convPickerField({
            label: 'Which family *',
            error: duesBookError,
            items: duesBook === null ? null : inCredit,
            loading: 'Loading the dues book…',
            empty: <>No family is in credit right now.</>,
            select: (
              <select
                className={styles.select}
                value={conv.payoutPlayerId}
                onChange={e => {
                  const id = e.target.value;
                  setConv(c => ({ ...c, payoutPlayerId: id }));
                  // The common case is handing back everything held — pre-fill it, editable.
                  const picked = inCredit.find(p => p.id === id);
                  if (picked) setForm(f => ({ ...f, amount: String(picked.payableNow) }));
                }}
              >
                <option value="">Choose…</option>
                {inCredit.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {fmt(p.payableNow)} in credit</option>
                ))}
              </select>
            ),
          })}
          {convAmountField('Amount *', overCeiling && (
            <p className={styles.formHint}>
              That&apos;s more than the {fmt(sel!.payableNow)} the team is holding for them —
              the save will be refused.
            </p>
          ))}
          <div className={styles.field}>
            <label className={styles.label}>Date paid *</label>
            <input
              className={styles.input} type="date" max={moneyMovedMaxDate()}
              value={form.paidDate}
              onChange={e => setForm(f => ({ ...f, paidDate: e.target.value }))}
            />
          </div>
          {convMethodField('payoutMethod')}
          {convNoteField('Optional')}
          {sel && amount > 0 && !overCeiling && consequence(<>
            <strong>{fmt(amount)} leaves cash on hand</strong> · the credit the team holds for{' '}
            {sel.name.split(', ').reverse().join(' ')}&apos;s family drops to{' '}
            {fmt(Math.max(0, r2c(sel.payableNow - amount)))}.
          </>)}
        </>
      );
    }

    return null;
  }

  /**
   * One shape for the branches' "Which X" pickers: error → loading → empty → the select.
   * Three copies of the same four-way ternary is a fix applied three times (/simplify, 2026-08-23).
   */
  /**
   * ⚠⚠ THE ONE GATE RULING A'S LOCK PASSES THROUGH (/simplify, altitude lens 2026-08-23).
   *
   * A door that names one RECORD states its answers instead of offering them, so every control
   * that asks *which one?* must disappear under a lock. That rule was enforced in THREE textually
   * distant places — this helper, the drive branch's hand-built player block, and the budget-item
   * picker — each with its own condition and its own comment admitting the next branch would have
   * to remember. Now every identity control is wrapped in this one call, so "what did the lock
   * hide?" is a single grep, and a new branch that forgets is visible as the one picker not routed
   * through it.
   *
   * ⚠ IDENTITY ONLY. Allocation — which installment a payment lands on — stays editable under a
   * lock by the same ruling, so it is deliberately NOT wrapped.
   */
  function identityField(node: ReactNode): ReactNode {
    return convLock ? null : node;
  }

  function convPickerField(opts: {
    label: string;
    error: string;
    /** null = still loading. The EMPTY test runs on this list, so pass the filtered one. */
    items: ReadonlyArray<unknown> | null;
    loading: string;
    empty: ReactNode;
    select: ReactNode;
    after?: ReactNode;
  }) {
    /* ⚠⚠ ONE RULE, EVERY BRANCH (owner ruling A, 2026-08-23). Under a lock the door already named
       the player / the drive / the installment / the family, and the stated band at the top of the
       form says so — a picker underneath repeating the question would be the second control the
       ruling exists to remove, and re-answering it is the ghost save. Every branch's identity
       question goes through this helper, so locking here locks all of them; a future branch that
       hand-builds its own picker has to remember, which is what the drive's player block's own
       guard is a note about. */
    return identityField(
      <div className={`${styles.field} ${styles.formGridFull}`}>
        <label className={styles.label}>{opts.label}</label>
        {opts.error ? <p className={styles.errorText}>{opts.error}</p>
          : opts.items === null ? <p className={styles.formHint}>{opts.loading}</p>
          : opts.items.length === 0 ? <p className={styles.formHint}>{opts.empty}</p>
          : opts.select}
        {opts.after}
      </div>,
    );
  }

  /** The shared amount field — writes `form.amount` so it SURVIVES a branch switch (frame C). */
  function convAmountField(label: string, hint?: ReactNode) {
    return (
      <div className={styles.field}>
        <label className={styles.label}>{label}</label>
        <input
          className={styles.input} type="number" min={0} step="0.01" placeholder="0.00"
          value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
        />
        {hint}
      </div>
    );
  }

  /** The shared "How" — a dropdown, per the owner's form-field convention (2026-08-22), storing
   *  the dues enum token. The options themselves are `DuesMethodSelect`, the ONE renderer of the
   *  one method list (also the payout sheet's and the dues panel's). */
  function convMethodField(key: 'duesMethod' | 'payoutMethod') {
    return (
      <div className={styles.field}>
        <label className={styles.label}>How</label>
        <DuesMethodSelect
          className={styles.select}
          value={conv[key]}
          onChange={m => setConv(c => ({ ...c, [key]: m }))}
        />
      </div>
    );
  }

  /**
   * The SPONSOR branch's method is OPTIONAL, unlike dues/payouts above (owner question, §120
   * walk 2026-08-29): a family payment is recorded at receipt and "e-transfer unless said
   * otherwise" is a fair default, but a sponsor cheque is often recorded from a statement — a
   * silently-defaulted method there records a GUESS as fact. Blank means "not recorded", and
   * both sponsor doors (this branch and the Fundraising modal) say it the same way.
   */
  function convSponsorMethodField() {
    return (
      <div className={styles.field}>
        <label className={styles.label}>How</label>
        <select
          className={styles.select}
          value={conv.sponsorMethod}
          onChange={e => setConv(c => ({ ...c, sponsorMethod: e.target.value as DuesPaymentMethod | '' }))}
        >
          <option value="">—</option>
          {DUES_PAYMENT_METHODS.map(m => (
            <option key={m} value={m}>{DUES_PAYMENT_METHOD_LABEL[m]}</option>
          ))}
        </select>
      </div>
    );
  }

  /** The shared note field — writes `form.notes` so a note SURVIVES a branch switch (frame C). */
  function convNoteField(placeholder: string) {
    return (
      <div className={`${styles.field} ${styles.formGridFull}`}>
        <label className={styles.label}>Note</label>
        <input
          className={styles.input}
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder={placeholder}
        />
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

    /* ── Paying down a bill the team already owes (P2, owner ruling C2) ──────────────────────
       ⚠ THE THIRD OF THE THREE SIGNALS that the coach picked the other kind of answer in the one
       picker — the description field left, the installment row arrived, and this sentence changed
       from "a new cost" to naming the bill and what it drops to. The owner accepted one field with
       two outcomes on the strength of these three saying so before anything saves.
       ⚠ THE FIGURES ARE THE STANDING'S, not a re-derivation: what is left is `remaining` minus what
       is being paid, floored at zero, and the over-payment case is stated under the Amount field by
       the same rule the bill's own door uses. */
    if (payingBill) {
      const left = Math.max(0, Math.round((payingBill.remaining - amount) * 100) / 100);
      const balance = left > 0.005
        ? <>drops to <strong>{fmt(left)} still owing</strong></>
        : <>is <strong>fully paid</strong></>;

      /* ⚠⚠ WHO PAID IT IS THIS PAYMENT'S ANSWER FIRST, THE COST'S SECOND (money centralization P4).
         The cost-level sentence was here from P2 and was the ONLY place the product correctly said
         a family's credit grows — but nothing could reach it from a bill the team otherwise pays,
         which is exactly the $200-deposit case.
         ⚠ THROUGH `effectivePayerId`, NOT A HAND-ROLLED `||`. This comment used to say "same rule
         as the server's" while writing its own copy of it — one more place to drift the day the
         form's mutual-exclusivity changes (`/simplify`, altitude lens). */
      const payerId = effectivePayerId(
        { paidByPlayerId: form.paidByPlayerId || null }, payingBill.expense.paidByPlayerId);
      if (payerId) {
        const player = roster.find(p => p.id === payerId);
        /* ⚠ THE WHOLE PHRASE FALLS BACK, NOT THE NAME — the possessive is what goes, never the
           grammar. Same fix, same reason, as the cost branch below (`/review`, 2026-08-16). */
        const named = formatPlayerFirstLast(player);
        return line(<>
          <strong>When you save: no team cash moves.</strong> {payingBill.name} {balance}, and the
          team owes{' '}{named ? <><strong>{named}</strong>’s family</> : <>that family</>} {money}{' '}
          — saved as a credit you can put against their dues or pay out any time.
        </>);
      }
      return line(<>
        <strong>When you save: {money} leaves the team’s books</strong>
        {form.paidDate ? <> on {fmtDate(form.paidDate)}</> : null}. {payingBill.name} {balance}.
        {' '}You can undo it from the bill’s payment details.
      </>);
    }

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
      const named = formatPlayerFirstLast(player);
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

    /* ⚠⚠ ONE FIELD, TWO KINDS OF ANSWER (owner ruling C2, 2026-08-23). On the "we paid for
       something" branch this picker also offers the bills the team already owes, as its FIRST
       group — so a coach never has to decide whether their payment is "a cost" or "a payable"
       before the product will show them anything. Picking a bill turns the record into a payment
       against it; picking an item creates a new cost, exactly as before. The group itself is built
       once, in `spendLeadGroup` — see its header for why it is not built here. */
    const offerBills = spendLeadGroup !== undefined;

    /* Locked to a bill (a door on the Payables face or the register): the band above states which
       one, so this field has nothing left to ask. Through the SAME gate as every other branch's
       identity question — see `identityField`. */
    if (payingBill) return identityField(field());

    return field();

    function field() {
    return (
      <div className={`${styles.field} ${styles.formGridFull}`}>
        <label className={styles.label}>
          {entryKind === 'refund' ? 'What is it paying you back for? *'
            : offerBills ? 'What did this pay for? *'
            /* ⚠ "Filed under", NOT "What is this?", on the bill form (fold form redesign,
               finding 2). The old label asked a question its own placeholder repeated — and the
               SAME phrase heads the conversation's picker one view away meaning something else
               (a collision the forms review carried). "Filed under" is the word the bill's own
               page uses for this exact field ("Filing"), so the two screens finally agree. */
            : isPayableForm ? 'Filed under *'
            : 'What is this? *'}
        </label>
        {/* ⚠⚠ THE SHARED PICKER, NOT TWO SELECTS (Money form P2, 2026-08-16). This was the ONE
            surface still asking the category and the item as two chained dropdowns while the Budget
            Plan and the Org Budget had used the shared control for months — so the same question
            was asked two different ways inside one product, and only here did a coach have to guess
            our filing system before the word they wanted would appear. The picker searches both
            halves at once: four letters of "diamond" finds Facilities · Diamond permits. */}
        <BudgetItemPicker
          categories={categories}
          /* ⚠ The bill form's label is "Filed under", so the picker's default "Search what this
             is…" hint went back to being circular — the override states the act instead (fold form
             redesign, finding 2, caught live in the §119 walk). */
          placeholder={isPayableForm ? 'Choose a budget item — e.g. Tournaments · Entry fees' : undefined}
          /* ⚠ The bill form's ONE grounds story (design pass D3, owner-approved 2026-08-29): its
             picker wears the portal's standard field ground like every input beside it. Only the
             bill branch — the conversation's branches keep the picker's own clothes until the
             money forms review rules portal-wide. */
          paperGround={isPayableForm}
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
          /* The bills group (C2). What is still owing rides each row — it is the fact that makes
             one worth choosing, and the reason a coach recognises their bill in a list of words. */
          /* The bills group (C2), built once above — a fresh object here would be a new identity
             on every keystroke and would defeat the picker's own memo. */
          leadGroup={spendLeadGroup}
          /* ⚠ THE PRE-FILL NEVER OVERWRITES A COACH'S OWN WORDS. It lands only on a description that
             is empty, or one still holding the name of the item being switched AWAY from — text this
             control put there and nobody has touched. That test is `isItemLabel`, shared with the
             pill switch so the two cannot drift. */
          onChange={v => {
            /* The mirror of `leadGroup.onPick`: choosing a WORD abandons the bill. Without this a
               coach who picked a bill, changed their mind and picked an item would save a payment
               against the bill with an item stapled to it. */
            if (conv.spendExpenseId) setConv(c => ({ ...c, spendExpenseId: '', spendInstallmentId: '' }));
            setForm(f => ({
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
            }));
          }}
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
  }

  if (ctxLoading) return <CoachLoading label={onPayables ? 'Loading the bills…' : 'Loading the register…'} />;
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
  /* ⚠ MEMOISED ABOVE THE ACCESS GUARD (`tagFacts`'s sibling) — it is an input to the tag total,
     which is a hook, and a bare `.filter()` here would hand it a new array every render. */
  const filteredActive = tagFacts.filteredActive;
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
  const noNarrowing = selectedKinds.size === 0 && selectedItems.size === 0 && filterTagIds.size === 0;
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
   *
   * ⚠ `remaining` IS THE SAME RULE ON A WIDER SURFACE (owner-approved mockup 2026-08-28,
   * `claude.ai/code/artifact/ca583ce4-1dbc-47e1-b7c4-e2f8e1887a37`). The bill LIST says "· partly
   * paid" because its Status cell is one narrow column; the commitment page's schedule gives the
   * whole left half of the row to this sentence, so it can afford the FIGURE instead of the label —
   * same structure, same separator, more use. Omitted, the wording is byte-identical to before, so
   * the list is untouched by construction rather than by promise.
   */
  function payStatusText(
    badge: PayableRowStatus, days: number, partly: boolean, remaining?: number,
  ): ReactNode {
    const tone = badge === 'paid' ? styles.payStatePaid
      : badge === 'overdue' ? styles.payStateOverdue
      : partly ? styles.payStatePartly : styles.payStateAhead;
    const words = badge === 'paid' ? 'Paid'
      : badge === 'overdue' ? `${Math.abs(days)} days overdue`
      : days === 0 ? 'Due today' : `In ${days} days`;
    const aside = !partly || badge === 'paid' ? ''
      : remaining === undefined ? ' · partly paid'
      : ` · ${fmt(remaining)} still owing`;
    return (
      <span className={`${styles.payState} ${tone}`}>
        <span className={styles.payStateDot} aria-hidden />
        {words}{aside}
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
          openBill(bill);
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
              Record
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
          openBill(bill);
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
              Record
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
    /**
     * ⚖⚖ **A COMMITMENT'S ROW OPENS THE COMMITMENT, NOT THE FORM** (Part B call 1, owner ruling
     * 2026-08-26 — the blocking question of the phase).
     *
     * Part B moves six fields — name, filing, payee, tags, how, notes — onto the commitment's own
     * page. This row edited the very same fields through the shared form, so shipping B without
     * this line would give one record **two editors**, which is exactly the disease money
     * centralization exists to cure arriving through the back door.
     *
     * ⚠⚠ AND IT IS NEVER ONE ROW. A commitment appears on this book as one row per PAYMENT plus one
     * per installment still OWING (see `coach-register-book`), so a five-piece bill with two
     * payments recorded is five rows here — five doors onto the same six fields, not one. That is
     * why (b) "keep both, deliberately" was refused rather than written down.
     *
     * ⚠ A PLAIN COST AND AN ARRIVAL KEEP THE FORM, and must: neither has a page of its own, and the
     * form remains the only editor they have ever had. The test is the record's own type, never the
     * row's `open.kind` — both kinds of money-out row carry `kind: 'expense'`.
     *
     * ⚠ THE CREATE DOOR IS UNTOUCHED. `Add a commitment` is a setup form of the same standing as
     * New Fundraiser (standing owner ruling, P2) and still opens the full form with every field.
     */
    const commitment = record?.expenseType === 'tournament_payable' ? record : undefined;
    const openRecord = commitment ? () => openBillById(commitment.id)
      : record ? () => openEdit(record)
        : arrival ? () => openEditMoneyIn(arrival) : null;
    /**
     * ⚖ **A COMMITMENT ROW IS TAPPABLE FOR EVERYONE** (Part B call 2, owner ruling 2026-08-26).
     *
     * Every other row here opens an EDITOR, so the write gate is the right gate for them. A
     * commitment row now opens a PAGE that is deliberately readable without a write door — it is
     * the only place in the product a read-only money assistant can see a bill's payee or its tags
     * at all. Gating the way in on a capability the destination does not require would leave them
     * reading a figure on the book with no way to reach the bill behind it.
     *
     * ⚠ NOTHING ON THAT PAGE BECOMES A CONTROL FOR THEM — `CommitmentView` renders values, not
     * editors, on exactly this capability. The row is a door, not a permission.
     */
    const tappable = !!openRecord && (canWriteMoney || !!commitment);
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
              Record
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
  function registerBalanceRow(
    key: string, label: string, balance: number,
    /**
     * The one balance line that has somewhere to go: the season's carried opening balance, whose
     * only correction path is Team settings → Money.
     *
     * ⚠ THE WORDS AND THE CONTROL ARE SEPARATE, and that is a lesson this table already learned.
     * The action cell holds real buttons beside "Mark paid" and the row pencil — a sentence in it
     * wraps and drags every register row back to two lines tall, which is exactly the height the
     * compact-row pass was built to remove. The explanation goes in the label cell, which spans six
     * columns and has room for one; the cell at the end gets a short control.
     */
    door?: { href: string; note?: string },
  ) {
    return (
      // `.tr .registerRowCompact` too — the same compound selector every data row uses for its
      // font-size/line-height/padding, so this line sits at the identical row height rather than
      // reverting to the shared (taller) `.td` default.
      <tr key={key} className={`${styles.tr} ${styles.registerRowCompact} ${styles.registerBalanceRow}`}>
        <td colSpan={6} className={styles.registerBalanceLabel}>
          {label}{door?.note ? ` · ${door.note}` : ''}
        </td>
        <td className={`${styles.td} ${styles.tdNum} ${styles.registerAmt}`}>{fmt(balance)}</td>
        <td className={styles.td}>
          {door && (
            <Link
              href={door.href}
              className={`${styles.btnSecondary} ${styles.block640} ${styles.compactAction}`}
              style={{ whiteSpace: 'nowrap' }}
              aria-label="Change the season opening balance in Team settings"
            >
              Change →
            </Link>
          )}
        </td>
      </tr>
    );
  }

  const summaryHasOrgRows = (schedule ?? []).some(r => r.source === 'org');

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
      {/* ⚖⚖ "Add a bill" RENDERS IN ALL THREE VIEWS (fold decision 2, owner 2026-08-28) — it is
          the ONLY door to a payment schedule in the product, and a door that appears only in some
          arrangements is a door a coach can't find.

          It is NOT a duplicate of Record, and the asymmetry is a ruling rather than an oversight
          (B2, 2026-08-23): Record is for money that MOVED; a bill is a PLAN — nothing moves when
          one is saved. This button's standing is New Fundraiser's and Set dues for all players': a
          setup form for an expectation, on the screen that expectation lives on. ⚠ Do not "finish
          the job" by retiring it; there would then be no door to a payment schedule anywhere.

          ⚠ DELIBERATE DEVIATION FROM THE FOLD MOCKUP, with the reason: the mockup drew this in
          the PAGE TITLE row beside Import/Record, but the 2026-08-13 page-actions ruling says a
          hub header carries only hub-wide doors and a tab-scoped action lives in its tab's own
          toolbar — and a header placement would also render it on Dues/Fundraising/BvA, which is
          wrong. A standing ruling outranks a mockup detail (the Insights precedent). One row
          lower than drawn, visible in every view, exactly as decision 2 asks.

          ⚠ Named "bill", not "commitment" (fold decision 6A): the object carries the future-ness
          the verb can't, and it heals the bill/commitment split the Record picker already
          straddled ("Bills you owe").
          ⚠ Empty states keep their own doors — standing rule, untouched. */}
      <button className={styles.btnPrimary} onClick={() => openAdd({ kind: 'expense', timing: 'payable' })}>
        <Plus size={14} aria-hidden /> Add a bill
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
  /**
   * ⚖⚖ ONE TAG PILL, DRAWN ONCE, USED ON BOTH FACES (money centralization P3, 2026-08-25). This
   * used to be two hand-written copies of a chip row — one in the Payables toolbar, one down in
   * the register's control row — and "seen twice" is the defect this screen keeps producing
   * (the Manage-tags button did the same thing). It is now the same `MultiSelectDropdown` as
   * Show / Status / Item, built here and rendered in each face's own filter row.
   *
   * ⚠ MONEY TAGS NARROW THE PAYABLES LIST TOO. They were once hidden on the by-due-date view,
   * because it mixed two sources and a tag could only ever describe one. The one list still mixes
   * them — but narrowing it to the team's own tagged bills is a real answer, and a club allocation
   * simply carries no tag, which is a match of zero rather than a match of all (the same rule the
   * register applies to its own derived rows).
   *
   * ⚠ BLUE STILL MEANS ORG-SHARED. The chips carried that in their border and needed a colour
   * legend underneath to say so — a legend that only ever rendered on Payables, so half the
   * product explained itself and half didn't. The swatch in each option says it in place, on both
   * faces, and the legend is gone. ⚠ It is the SAME swatch the tag picker draws
   * (`.tagComboDot*`), reached through a named role rather than a colour — the first build passed
   * fresh `rgba()` literals in and gave the org/team distinction a second, drifting encoding
   * (`/simplify`, reuse + altitude lenses, 2026-08-25).
   *
   * ⚠ The options themselves are built in `tagFacts` — they walk every expense to count tags, and
   * this panel re-renders on every keystroke in the money form it also hosts.
   */
  const showTagFilter = tagFacts.used.length > 0;
  const tagFilterPill = showTagFilter ? (
    <MultiSelectDropdown
      label="Tags"
      options={tagFacts.options}
      selected={filterTagIds}
      onChange={setFilterTagIds}
      allLabel="Every tag"
    />
  ) : null;

  const expenseHeaderActions = !embedded && canWriteMoney ? (
    <button className={styles.btnSecondary} onClick={() => setImportOpen(true)} aria-label="Import">
      <Upload size={14} aria-hidden /> <span className={styles.headerBtnLabel}>Import</span>
    </button>
  ) : null;

  /* ⚖⚖ THE VIEW PILL — the fold's one new control (owner-approved mockups, 2026-08-28). It is
     Payables' old `Group by` widened by one option and promoted to the page: Timeline (the dated
     register), By bill (grouped), By due date (the payment schedule). FIRST in the strip on every
     view, labelled as an arrangement — the same slot and reasoning `Group by` held (plan §7: an
     arrangement is not a filter, and it never reads as one). The other controls SWAP with the
     view rather than stacking, so the phone toolbar's row count never grows. */
  const viewPill = (
    <SingleSelectDropdown
      label="View"
      lead
      value={view}
      options={(['timeline', 'bills', 'due'] as const).map(id => ({ id, label: LEDGER_VIEW_LABEL[id] }))}
      onChange={next => setView(next as LedgerView)}
    />
  );

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      {/* ⚰ The "Back to Money" row that stood here is GONE (back-in-header ruling, 2026-08-26).
          It rendered only on the legacy standalone route, and every legacy money route is a
          permanent redirect into the hub — so no coach has seen it since that sweep. Deleted as
          dead code rather than migrated to the header arrow, which is for live drill-ins. */}
      {/* Page-header ruling 2026-08-11: one shape, actions right, phone secondaries icon-only.
          ⚠ The write gates stand (Chunk A probe): a read-only money assistant sees no sheet
          door the server would refuse. "Tournament" stays retired from the title (D-H9). */}
      {/* ⚠ ONE HELP SUBTOPIC FOR THE ONE BOOK (fold, 2026-08-28) — the split-era pair merged with
          the tabs they described. ⚠⚠ INSIDE THE HUB THIS PROP IS INERT: the `embedded` header
          shape renders no "?" (only actions), so the live door is the HUB page's "?", which is
          TAB-AWARE since the §119 walk found it pinned to the Money intro on every tab
          (`HELP_SUBTOPIC_BY_SECTION` in accounting/page.tsx). This prop matters only if this
          panel ever mounts standalone again. */}
      {/* ⚠ THE LIST'S OWN HEADER — not drawn on a bill's page, which carries its own
          (title = the bill, back arrow = Ledger). Two page headers would be two page names. */}
      {!focusBillId && <CoachPageHeader
        variant={embedded ? 'embedded' : 'standard'}
        icon={Receipt}
        title={<>Ledger</>}
        actions={expenseHeaderActions}
        helpLabel="Ledger"
        help={{
          module: 'coaches',
          sectionIds: ['premium-money'],
          subtopicId: 'premium-money-ledger',
          fullGuideHref: `/${orgSlug}/coaches/help#premium-money`,
        }}
      />}

      {importMessage && (
        <p className={styles.moneyTagSummary} role="status" style={{ marginBottom: '1rem' }}>{importMessage}</p>
      )}

      {/* Saved, but the re-read that follows it didn't land. The figures below are the ones from
          BEFORE the save — say so, and offer the way out. */}
      {staleAfterWrite && (
        <CoachLoadError
          message="Your change was saved, but these figures could not be refreshed — what you see below may be out of date."
          onRetry={() => { void load(); }}
          label="Refresh"
        />
      )}

      {/* ⚠⚠ THE LIST AND ITS CHROME DO NOT EXIST ON A COMMITMENT'S OWN PAGE (owner ruling
          2026-08-26). `focusBillId` is set from the route, and this panel then renders that ONE
          bill — so the toolbar, the filters, the tables and every empty state below are the
          Payables LIST's, and none of them belong on a page about a single record. The write
          modals further down stay mounted for both: they are the same doors either way. */}
      {!focusBillId && (<>
      {/* ⚠ SUB-TABS AND ACTIONS SHARE ONE ROW (owner review 2026-08-15, Q2). They used to be two
          stacked bands, so a coach crossed THREE strips of chrome — hub tabs, sub-tabs, then a
          full-width toolbar — before the first row of money. That third strip carried nothing on
          its left whenever the team had no money tags, spending a whole band on three right-aligned
          buttons. Merging them is the whole fix: `.panelToolbarActions` already pins itself right
          with `margin-left: auto`, so the sub-tabs simply become the row's left-hand content.

          The tag filter joins the SAME row rather than reclaiming its own — `.panelToolbar` wraps,
          so it shares the line when it fits and drops below when it doesn't. It self-hides when the
          current tab has no tagged rows; the row itself always renders, because the ACTIONS are
          what must survive every empty state (rule 7), not the filter.
          ⚠ IT NO LONGER RECLAIMS A BAND EVEN WHEN IT IS SHOWN (money centralization P3): it is a
          pill in each face's own filter row now, not a chip row that needed one. */}
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
            {/* ⚠ `Group by` became two of the View pill's three options (fold, 2026-08-28) — same
                first slot, same arrangement framing, one option wider. */}
            {viewPill}
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
            {/* ⚠ A NARROWING, so it sits with Status and Item — never before `Group by`, which is
                the arrangement (plan §7) and keeps the first slot on both faces. */}
            {tagFilterPill}
            {/* ⚠ ONE TOGGLE, TWO LABELS — it reads "Open all" only because bills arrive folded, and
                the identical button reads "Fold all" the moment anything is open (and always, on
                the due-date arrangement, whose periods arrive open). Removing the one you happen to
                be looking at removes the other.
                ⚠⚠ IT MAY NOT HIDE ITSELF ON THE *FILTERED* GROUP COUNT (owner ruling 2026-08-26).
                A `foldKeys.length > 1` gate was built here and taken back out: a control that
                vanishes because a coach ticked a tag is the screen changing shape in response to a
                filter, which is the same objection that settled the fold default above. If this
                button is ever to hide on a one-bill team, the test has to be the TEAM's list, not
                the narrowed view — an open question, not a thing to re-derive here. */}
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
            {viewPill}
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
        {/* ⚠ THE PAYABLES TAG CONTROL NO LONGER OWNS A ROW OF ITS OWN — it is `tagFilterPill`,
            standing with Group by / Status / Item in the row above. It was a second `.moneyFilterBar`
            here purely because a chip row could not fit beside them. */}
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
            {/* ⚠ THE FIFTH PILL, and the last of the chip rows this strip used to carry. Show,
                Status, Item, Date and now Tags: five controls of one shape, which is the whole
                reason the chips went — a tag row beside four dropdowns read as a different KIND
                of control for what is the same act of narrowing. */}
            {tagFilterPill}
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
              ? (groupBy === 'due' ? 'Payment schedule' : 'Bills')
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
                     word any more (fold, 2026-08-28 — the tab retired and the export TITLE became
                     "Bills" with it). The dataset is the filename segment a coach's downloads
                     folder already holds a season of, and the export catalog lists it under that
                     word — a renamed file segment breaks a folder's continuity for the sake of a
                     label, the trade this comment has refused once already. One deliberate break
                     per surface: the title moved with the word sweep, the filename did not. */
                  dataset: 'payables',
                  title: 'Bills',
                  columns: EXPENSE_COLUMNS,
                  rows: expenseRows(filteredActive, tagsByExpenseId, tagById, standings),
                  scopeLabel: assignment?.programYearName ?? '',
                  teamName: assignment?.teamName ?? '',
                  emptyMessage: 'No bills have been recorded yet.',
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
      {/* ⚠ THE ORG/TEAM COLOUR LEGEND IS GONE, and nothing was lost with it: the swatch now sits in
          each option of the tag pill, where the distinction is actually being used. The legend
          rendered on Payables only, so the register showed blue-bordered chips and never said
          why. */}
      {/* ⚖⚖ THE ANSWER, ON BOTH FACES (owner ruling, plan §5.3 — "a filtered view must always show
          its TOTAL"). Transactions had NO total at all until now; a coach could narrow the book to
          one occasion and still had to add the column up by hand, which is the exact complaint
          tags were kept to answer.

          ⚠ GATED ON THE FILTER, NOT ON THE FACE. The old caption was gated on a tag merely being
          CHOSEN, and nothing clears that choice on a tab change — so filtering Payables and
          switching to Transactions left a payables count captioning a list it had nothing to do
          with (/review, regression lens). It cannot happen now: `tagFilterSummary` is derived from
          whichever face is rendering, so switching tabs restates the figure rather than stranding
          it. `showTagFilter` still hides the whole thing where no tag is in use.

          ⚠ THE MONEY LEADS. This read "vs {tag}: 3 commitments, $900.00 total" — figure last,
          and "vs" was left over from the game-tag report it was copied from. The dollars are the
          answer to the question a coach came here with. */}
      {tagFilterSummary && showTagFilter && (
        <div className={styles.moneyTagSummary}>
          <span className={styles.moneyTagSummaryFigure}>{fmt(tagFilterSummary.total)}</span>
          {' '}across {tagFilterSummary.count}{' '}
          {tagFilterSummary.noun}{tagFilterSummary.count !== 1 ? 's' : ''} tagged{' '}
          <strong>{tagFacts.phrase}</strong>
        </div>
      )}

      {loading ? (
        <CoachLoading label={onPayables ? 'Loading the bills…' : 'Loading the register…'} />
      ) : error ? (
        <CoachLoadError message={error} onRetry={() => { void load(); }} />
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
                  ? 'Money shows up here two ways — as it moves, and as it comes due. Every dollar this season lands in date order: what you spend, what arrives, dues, fundraising and anything settled with the club.'
                  : 'Try a wider filter, or turn on what is scheduled.'}
                /* ⚖ THE TWO DOORS, WITH A SENTENCE EACH (fold mockup, 2026-08-28): the empty book
                   is the one moment both doors face a coach with room to explain themselves —
                   Record for money that moved (the conversation, opened cold), Add a bill for
                   money they'll owe. The old Add Expense / Add Income pair collapsed into Record
                   the day the conversation became the one recording door. */
                primaryAction={canWriteMoney && noNarrowing ? {
                  label: 'Record',
                  icon: <Plus size={15} aria-hidden />,
                  onClick: () => openConversationFrom(null),
                } : undefined}
                secondaryAction={canWriteMoney && noNarrowing ? {
                  label: 'Add a bill',
                  icon: <Plus size={15} aria-hidden />,
                  onClick: () => openAdd({ kind: 'expense', timing: 'payable' }),
                } : undefined}
              />
              {/* ⚠ THE TEACHING LIVES ON THE EMPTY STATE, NOT ON THE FORM (owner ruling 2026-08-16,
                  P2 §5). Both comparisons belong here now that one book holds both directions: which
                  tab a commitment goes on, and the three-way distinction a coach describes with one
                  sentence — income, money back, and a family paying the vendor direct. */}
              {noNarrowing && (
                <>
                  <KindCompare
                    otherHref={moneySectionHref(base, 'ledger', { view: 'bills' })}
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
                  {/* ⚠ THE SEASON'S CARRY IS THE BOOK'S FIRST LINE, NOT A SECOND LINE ABOVE ONE
                      (mig 262). This row already meant "the real cash before the first row you can
                      see"; on a season that carried money forward that IS the opening balance, so
                      it takes those words and a link to where it is corrected rather than growing a
                      twin that says nearly the same thing one row higher. */}
                  {showBalance && bookStartingBalance !== null
                    && registerBalanceRow(
                      'starting',
                      bookOpensSeason ? 'Opening balance' : 'Starting balance',
                      bookStartingBalance,
                      bookOpensSeason
                        ? {
                          href: `${base}/settings#money`,
                          note: book?.openingFrom
                            ? `carried from ${book.openingFrom}`
                            : 'money the team was already holding',
                        }
                        : undefined,
                    )}
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
              headline={payNarrowed ? 'Nothing matches that' : 'Nothing owed yet'}
              description={payNarrowed
                ? 'Try a wider Status — the list opens on what is still owed, so anything already paid is hidden until you ask for it.'
                : "Add a bill for something you've agreed to pay — or bring a whole season's bills in from a schedule your club already keeps."}
              primaryAction={canWriteMoney && !payNarrowed ? {
                label: 'Add a bill',
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
                otherHref={moneySectionHref(base, 'ledger', { view: 'timeline' })}
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
              Money going out only — each bill’s installments{summaryHasOrgRows ? ', plus what your club has allocated to this team' : ''}.
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
      </>)}
      {/* ⚖⚖ ONE COMMITMENT, AS A PAGE (owner ruling 2026-08-26, from the drawn options
          `claude.ai/code/artifact/0c44d290-8a76-4235-aeab-79c8f4f8c366`). This was a MODAL, and the
          modal was the problem: a bill can carry a dozen or more installments, and a fixed 90vh box
          made the schedule push everything else — the standing figure, the payee, the tags — off the
          bottom. It had already overflowed once (§64 Part E, 2026-08-21) where the content past the
          fold was not merely below the line but UNREACHABLE.

          ⚠⚠ THE RULE THAT DECIDES THE ORDER (owner, 2026-07-09, binding): *reaching a different
          domain must never require scrolling past other domains*, and page scroll is reserved for
          ONE long homogeneous list, *which may grow freely*. So the short fixed things — what the
          bill comes to, and what it is — sit above, and the SCHEDULE takes the page scroll, because
          it is exactly the list that rule allows to grow.

          ⚠ THAT REVERSES THE ORDER RULED FOR THE MODAL FOUR DAYS EARLIER, and deliberately: in a
          fixed box, Details on top pushed the schedule out of view, so it went last. On a page
          nothing is pushed out — the page simply scrolls — so the unbounded list goes last instead.
          The constant across both is the same sentence: **the thing that can grow without limit
          never sits above the things that cannot.**

          ⚠ EVERY WRITE FLOW IS UNCHANGED. Edit, Add an installment, Record, the per-row Change /
          Remove / Record and the undo confirmation all still open the panel's own modals — which is
          ordinary over a page, and was modal-over-modal before. The `returnToDrawerRef` bookkeeping
          that put the drawer back after each of them is GONE: it existed only to rebuild navigation
          history the container did not have, which is the clearest evidence the container was
          wrong. A page has that history for free, including the browser's own back.

          ⚠ ORG ALLOCATIONS NEVER REACH HERE. A club bill is not the team's record to edit — its
          door is the Club tab (see `PayBill.kind`), and its key is not an expense id, so the route
          below cannot address one. */}
      {drawerExpense && (
        /* ⚖⚖ THE PAGE EDITS ITSELF (Part B, owner approval 2026-08-26, from the drawn options at
           `claude.ai/code/artifact/9c42dd82-39f1-4b12-8957-a5f43b2594de`).
           `CommitmentView` owns the header and the bill's own six fields — name, filing, payee,
           tags, how, notes — each a live control that saves itself. What stays HERE is everything
           that asks a question or moves money: the standing figure, the schedule with its scoped
           Change/Remove, Record, Add an installment, and the payments with their undo. That split
           IS the phase's principle: **a modal is for a question, not for a field.**

           ⚠ `key` IS LOAD-BEARING. The view seeds its draft ONCE, so a background refresh cannot
           overwrite what the coach is typing; the key is what moves it between bills.

           ⚖ `Edit details` IS GONE, and with it the last action in this header. It opened a window
           onto the fields now rendered in place — a screen that displayed them and then asked you
           to open a form to change them. The other two moved in Part A rather than vanishing:
           Record to the rows that name a payment, `Add an installment` under the schedule it adds
           to. The header carries the way back and nothing else. */
        <CommitmentView
          key={drawerExpense.id}
          orgSlug={orgSlug}
          teamId={teamId}
          expense={drawerExpense}
          standing={drawerStanding}
          canWrite={canWriteMoney}
          categories={categories}
          tagLibrary={expenseTags}
          initialTagIds={tagsByExpenseId[drawerExpense.id] ?? []}
          onCreateTag={createMoneyTag}
          backTo={billBackTo}
          onSaved={refreshAfterWrite}
          onDeleted={leaveBillPage}
          tabActive={tabActive}
          playerNameById={playerNameById}
        >
          <>
          {drawerStanding ? (
            /* ⚠ THE SWEEP'S READY SIGNAL, and it is deliberately on the branch that needs the
               STANDING rather than on the page's header. The header draws as soon as the bill's
               record is in hand; the schedule waits on a second read, and a sweep that unblocked on
               the header would measure "Loading payment details…" and report the page green — the
               green-check-over-an-empty-state trap this repo has hit more than once. A module class
               cannot serve: it is hashed. See `coach-commitment` in `scripts/layout-screens.mjs`. */
            <div className={styles.payDrawer} data-commitment="loaded">
              {/* ⚖ THE STANDING FIGURE MOVED INTO `CommitmentView` (Part B correction, 2026-08-27).
                  "The answer first, and it never scrolls away" is unchanged as a rule — what changed
                  is that the fields above it are now this page's, so the figure has to be drawn by
                  the component that owns them or it lands underneath the lot. It reads the same
                  standing this block does. */}

              {/* ⚖⚖ THE READ-ONLY FACTS BLOCK IS GONE, REPLACED BY LIVE FIELDS ABOVE (Part B).
                  It shipped one day earlier for a good reason that survives — before it, a bill's
                  payee and tags were readable only through Edit, the one door a read-only money
                  assistant is refused, so they could not see them anywhere in the product. That
                  reason is honoured, not dropped: `CommitmentView` renders VALUES for a read-only
                  coach and CONTROLS for a writing one, from the same rows.
                  ⚠ ITS ONE RULE IS DELIBERATELY REVERSED. This block omitted an unset row ("a stack
                  of — would be chrome"), which meant a coach could not tell a bill HAS no note from
                  the product not offering one. Every row is drawn now, and an empty one is an
                  invitation: "Add a note". */}

                {/* ── The plan, piece by piece ─────────────────────────────────────────────── */}
                <p className={styles.payDrawerLabel}>
                  Scheduled{drawerStanding.installments.length > 1 ? ` — ${drawerStanding.installments.length} installments` : ''}
                </p>
                {/* ⚠⚠ ONE GRID FOR THE WHOLE SCHEDULE, NOT ONE PER ROW (owner-approved mockup
                    2026-08-28, `claude.ai/code/artifact/ca583ce4-1dbc-47e1-b7c4-e2f8e1887a37`).
                    Each row used to be its own flex line with the trailing group packed right, so a
                    SETTLED piece — which carries no Record button — sized its own columns
                    differently and pushed its figure out of line with the rows above it. The one
                    row with nothing left to pay was the one row that did not line up, on a screen
                    whose figures already ask for tabular numerals.
                    ⚠ THE ROWS ARE `display:contents`, SO EVERY CELL MUST BE RENDERED. A row that
                    omits a cell shifts every later cell into the wrong column — which is why the
                    absent Record is an EMPTY SLOT rather than a missing element. That slot is doing
                    work: it reads as "nothing owed on this piece" and holds Change and Remove where
                    the eye already found them.
                    ⚠ The write cells are row-INVARIANT (`canWriteMoney`, `drawerExpense` and the
                    piece count are the same for every row of one bill), so the column count cannot
                    differ between rows; only the Record BUTTON varies, and it keeps its slot. */}
                <div className={`${styles.paySched} ${canWriteMoney && drawerExpense ? styles.paySchedWrite : ''}`}>
                {drawerStanding.installments.map(inst => {
                  const today = tournamentToday();
                  const st = installmentStatus(inst, today);
                  return (
                    <div key={inst.id} className={styles.paySchedRow}>
                      <span className={styles.payDrawerDate}>{fmtDate(inst.dueDate)}</span>
                      {/* ⚠ THE VARIABLE-LENGTH HALF, KEPT TOGETHER ON THE LEFT. A status phrase
                          wedged between the figure and the buttons pushed both around; beside the
                          piece it describes it pushes nothing, and the two dollar values on a
                          part-paid row (its face amount and what is left) end up at opposite ends
                          of the row instead of side by side with a dot between them. */}
                      <span className={styles.paySchedMain}>
                        <span className={styles.paySchedLabel}>
                          {drawerStanding.installments.length > 1
                            ? `Installment ${inst.installmentNumber}`
                            : 'One payment'}
                        </span>
                        {/* ⚠⚠ THE LIST'S OWN RENDERER, NOT A SECOND VOCABULARY. This row used to
                            hand-write "Settled" / "Scheduled" / "$X still owing" with its own icons,
                            while the bill list one click away said "Paid" / "In 5 days" and the
                            Status filter that found the bill said "Paid" / "Outstanding". A coach
                            filtered to Paid, opened a result, and read "Settled". Three vocabularies
                            for four states is now one. */}
                        {payStatusText(
                          st,
                          daysBetweenDateStrings(today, inst.dueDate),
                          inst.state === 'partly_paid',
                          inst.remaining,
                        )}
                      </span>
                      <span className={styles.payDrawerAmt}>{fmt(inst.amount)}</span>
                      {canWriteMoney && drawerExpense && (
                        <span className={styles.paySchedCell}>
                          {st !== 'paid' && (
                            <button
                              className={`${styles.btnSecondary} ${styles.compactAction}`}
                              onClick={() => openRecordPayment(drawerExpense, {
                                installmentId: inst.id, amount: inst.remaining,
                              })}
                            >
                              Record
                            </button>
                          )}
                        </span>
                      )}
                      {/* ⚠⚠ THE SCOPED DOOR (P4, S1–S7). Changing or removing ONE payment in a
                          series is where the three-way question belongs — the form states the whole
                          plan and has nothing to ask.

                          ⚠⚠ OFFERED ON A SETTLED PIECE TOO, and nothing here is greyed out. "This
                          payment only" still edits one and the books follow — the standing owner
                          ruling of 2026-08-16, tested by QA §27 Part C. A disabled control on a
                          paid row would reverse it silently. */}
                      {canWriteMoney && drawerExpense && (
                        <>
                          <span className={styles.paySchedCell}>
                            <button
                              className={`${styles.btnGhost} ${styles.compactAction}`}
                              aria-label={`Change installment ${inst.installmentNumber}`}
                              onClick={() => setScopeEdit({
                                expense: drawerExpense, installmentId: inst.id, mode: 'edit',
                              })}
                            >
                              Change
                            </button>
                          </span>
                          {/* R1 — a bill always has a schedule, so the last row cannot be removed.
                              Deleting the whole bill is the other action, and it gives money back.
                              ⚠ The CELL is always rendered so the grid keeps its column count; on a
                              one-piece bill the column collapses to nothing, and there is exactly
                              one row for it to collapse on. */}
                          <span className={styles.paySchedCell}>
                            {drawerStanding.installments.length > 1 && (
                              <button
                                className={`${styles.btnGhost} ${styles.compactAction}`}
                                aria-label={`Remove installment ${inst.installmentNumber}`}
                                onClick={() => setScopeEdit({
                                  expense: drawerExpense, installmentId: inst.id, mode: 'remove',
                                })}
                              >
                                Remove
                              </button>
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
                </div>

                {/* ⚖ THE SCHEDULE'S OWN ACTION, under the schedule (owner ruling 2026-08-26). It sat
                    in the page header until the door count showed why that felt wrong: the
                    page-level action ruling's test is "a button belongs to the nearest chrome that
                    NAMES what it acts on", and this one adds a row to the list directly above it.
                    ⚠ OFFERED ON ANY BILL (P4) — it used to appear only on a one-piece one, because
                    the plan was capped at two and the editor behind it could hold no more; a button
                    that gets refused is worse than one that is not there. */}
                {/* ⚖⚖ AND IT ADDS THE ROW IN PLACE NOW — the last modal on this page that was not
                    asking a question (owner, §114 walk 2026-08-27).

                    It used to open the whole record form with a blank plan row appended: a window
                    over six fields the page already edits, so a coach could type a date and an
                    amount. That is Part B's own objection arriving one section lower down.

                    ⚠⚠ THE LINE HOLDS, AND THIS IS WHICH SIDE OF IT ADDING FALLS ON. `Change` and
                    `Remove` keep their sheet because they ask a real question — *this payment, this
                    and the later ones, or all unpaid?* — and a new row has no such question: there
                    is nothing before it to reach backwards to and nothing already paid against it.
                    Adding asks nothing, so it gets no window.

                    ⚠ IT SENDS THE WHOLE PLAN, EACH ROW CARRYING ITS STORED ID, and that is not
                    optional: the server matches rows by id and treats an unrecognised one as new,
                    so a plan sent without ids would be read as "delete all six and create six
                    fresh" — which is exactly how a POSITIONAL row key once re-pointed a recorded
                    payment at the wrong piece. The plan is rebuilt from the LIVE standing at the
                    moment of submit, never from a copy held while the coach was typing. */}
                {canWriteMoney && drawerExpense && (
                  addingRow ? (
                    <div className={styles.payAddRow}>
                      {/* ⚠ THE WRAPPER IS DOING REAL WORK. `DateField` is `width: 100%` of its
                          parent — right in the Budget Plan form where it fills a column, wrong in a
                          flex row, where it took the whole line, pushed the amount and the buttons
                          onto a second one and left its calendar button stranded at the far right of
                          the page. Constraining the PARENT is what brings the button back beside the
                          date; the control itself is shared with two other screens and is not this
                          row's to re-shape. */}
                      <span className={styles.payAddDate}>
                        <DateField
                          value={addRowDate}
                          onChange={setAddRowDate}
                          ariaLabel="Due date for the new installment"
                        />
                      </span>
                      <input
                        className={styles.input}
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="Amount"
                        aria-label="Amount for the new installment"
                        value={addRowAmount}
                        onChange={e => { setAddRowAmount(e.target.value); setAddRowError(''); }}
                      />
                      <button
                        className={styles.btnPrimary}
                        disabled={addRowBusy}
                        onClick={() => void addInstallmentInline(drawerExpense)}
                      >
                        {addRowBusy ? 'Adding…' : 'Add'}
                      </button>
                      <button className={styles.btnGhost} disabled={addRowBusy} onClick={closeAddRow}>
                        Cancel
                      </button>
                      {addRowError && <p className={styles.errorText}>{addRowError}</p>}
                    </div>
                  ) : (
                    <div className={styles.payDrawerAdd}>
                      <button className={styles.btnGhost} onClick={() => setAddingRow(true)}>
                        <Plus size={13} aria-hidden /> Add an installment
                      </button>
                    </div>
                  )
                )}

                {/* ── What actually happened ───────────────────────────────────────────────── */}
                {drawerStanding.payments.length > 0 && (
                  <>
                    <p className={styles.payDrawerLabel}>Payments recorded</p>
                    {drawerStanding.payments.map(p => {
                      /* ⚠⚠ WHO PAID IT, ON THE LIST ITSELF (money centralization P4). It is here
                         rather than behind an Edit because a read-only money assistant never gets
                         one — the §104 walk found details that existed only behind a button that
                         account cannot press, and "who is the team out of pocket to?" is not a
                         detail to hide from whoever is reading the books. */
                      const payer = drawerExpense
                        ? effectivePayerId(p, drawerExpense.paidByPlayerId)
                        : (p.paidByPlayerId ?? null);
                      const payerPlayer = payer ? roster.find(r => r.id === payer) : undefined;
                      /* ⚠ A WHOLE PHRASE, never a bare name substituted into a possessive — the
                         same fallback rule the consequence line follows. A payer whose roster row
                         has gone (the column is ON DELETE SET NULL) still reads honestly. */
                      const payerName = formatPlayerFirstLast(payerPlayer);
                      return (
                      <Fragment key={p.id}>
                        <div className={styles.payDrawerLine}>
                          <span className={styles.payDrawerDate}>{fmtDate(p.paidDate)}</span>
                          <span className={styles.payDrawerWhat}>
                            {p.method || 'Payment'}
                            {p.note ? <span className={styles.mutedInline}> · {p.note}</span> : null}
                            {payer && (
                              <span className={styles.mutedInline}>
                                {' '}· {payerName ? `${payerName}’s family` : 'A family'} paid direct
                                {' '}— no team cash moved
                              </span>
                            )}
                          </span>
                          <span className={styles.payDrawerAmt}>{fmt(p.amount)}</span>
                          {/* ⚠ R5 — Undo deletes THIS payment, and the books go back by exactly its
                              amount, read from its own recorded entry. It ASKS first (below), in the
                              same named-consequence shape the Delete flow uses. */}
                          {canWriteMoney && drawerExpense && undoAsk !== p.id && (
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
                            {/* ⚖ THE BRANCH THIS COMMENT PREDICTED HAS ARRIVED (money
                                centralization P4). It used to read: "a commitment can never be paid
                                out of pocket… if a family is ever allowed to front a commitment,
                                this sentence is one of the places that has to learn about it." A
                                family can now front one PAYMENT of a bill the team otherwise pays,
                                so the two outcomes are opposites and the coach is told which. */}
                            {payer ? (
                              <p className={styles.dangerConfirmBody}>
                                <strong>No team cash moves</strong> — a family paid this direct. This
                                bill returns to {fmt(drawerStanding.remaining + p.amount)} still owing,
                                and what the team owes {payerName ? `${payerName}’s family` : 'that family'}
                                {' '}drops by <strong>{fmt(p.amount)}</strong>.
                              </p>
                            ) : (
                              <p className={styles.dangerConfirmBody}>
                                Cash on hand goes back <strong>up by {fmt(p.amount)}</strong>, and this
                                bill returns to {fmt(drawerStanding.remaining + p.amount)} still owing.
                              </p>
                            )}
                            <div className={styles.dangerConfirmActions}>
                              <button className={styles.btnGhost} disabled={undoBusy === p.id}
                                onClick={() => setUndoAsk(null)}>
                                Keep it
                              </button>
                              <button className={styles.btnDanger} disabled={undoBusy === p.id}
                                onClick={() => undoPayment(drawerExpense, p)}>
                                {undoBusy === p.id ? 'Undoing…' : `Undo ${fmt(p.amount)}`}
                              </button>
                            </div>
                          </div>
                        )}
                      </Fragment>
                      );
                    })}
                  </>
                )}

              </div>
            ) : (
              <CoachLoading label="Loading payment details…" inline />
            )}
          </>
        </CommitmentView>
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
      {/* ⚠ PORTALED — because the hub's Record button opens this form while the panel itself may
          be mounted display:none under another tab; rendered inline, the modal would exist and be
          invisible. ⚠⚠ INTO THE WARM MARKER, NEVER <body> (/review, 2026-08-23 — Critical): the
          coach palette's custom properties hang off `[data-coach-warm-enabled]` (CoachPortalShell's
          root) and inherit through the DOM, not the React tree — a body portal exits that scope
          and the whole money form renders in the WRONG THEME inside a warm portal. globals.css's
          own note about the help drawer documents exactly this trap. Body is only the fallback for
          a mount with no shell around it. */}
      {formOpen && createPortal(
        <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (closeForm)?.(); }}>
          <div className={`${styles.modal} ${styles.modalScrollBody}`} onClick={e => e.stopPropagation()}>
            <CoachModalHeader
              /* Three doors, three names. "Record money" is the conversation; "Add a bill" is the
                 Ledger's setup form, which this modal also is (B2); an edit says what it is
                 editing. A bill door titled "Record money" would be the product contradicting the
                 ruling in its own header. ⚠ The bill subtitle carries the whole teaching now —
                 the intro paragraph that restated it a third time is gone (fold form redesign,
                 finding 1: three tellings before the first field). */
              title={formMode === 'edit' ? copy.editTitle
                : isPayableForm ? 'Add a bill'
                : 'Record money'}
              subtitle={formMode !== 'add' ? undefined
                : isPayableForm ? 'Money the team owes but hasn’t paid — nothing moves today'
                : convBranch ? CONV_BRANCH[convBranch].name
                : 'Write down money that moved — it gets filed for you.'}
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
              {/* ⚖ THE PILLS AND THE REFUND TICK ARE GONE (money centralization P1, 2026-08-22).
                  The Expense/Income pills + "This is a refund" tick asked the coach to hold a
                  direction and a flag; the conversation asks the ONE question in coach words —
                  "What happened?" — and refund is a first-class answer ("Money back on something
                  we paid"). What the tick's design protected survives in `selectBranch`: the data
                  still has three ledger kinds, an item still cannot survive a side switch
                  (mig 246), and typed work still carries across a switch (frame C).
                  ⚠ EDIT MODE IS UNTOUCHED: a saved record never switches kind. */}
              {/* ⚠⚠ THE COMMITMENT DOOR ASKS NO "WHAT HAPPENED?" EITHER (owner ruling B2,
                  2026-08-23). Payables' "Add a commitment" is a SETUP form for a plan — the same
                  standing as New Fundraiser or Set dues for all players — and the conversation is for
                  money that MOVED. Offering the eight sentences here would put the seven answers
                  that record real money on a door that records none of them, and would re-open the
                  paid/owed fork through the back way. So it states its kind, exactly as an edit
                  does, and the modal titles itself accordingly. */}
              {formMode === 'edit' ? (
                <p className={`${styles.formHint} ${styles.formGridFull}`} style={{ marginTop: 0 }}>
                  {copy.statedFact} Wrong kind? Delete this and add it again.
                </p>
              ) : isPayableForm ? (
                /* ⚠ NO INTRO PARAGRAPH ON A NEW BILL (fold form redesign, 2026-08-28 — finding 1).
                   The subtitle says what a bill is; the consequence line pinned by the footer says
                   what saving does and where the payments get recorded. A third telling here stood
                   between the coach and the first field.
                   ⚖ A HANDED-OFF bill keeps the question (owner, 2026-08-29): the coach reached
                   here by ANSWERING "What happened?", and that answer must stay as revisable as
                   every other — the field stands on the bill row and any other choice hands back.
                   The bill's own doors (the toolbar's Add a bill) still show no question: none
                   was asked (ruling B2, which this deliberately does not reopen). */
                billHandOff ? renderWhatField() : null
              ) : (
                renderWhatField()
              )}

              {/* ⚠ `!isPayableForm` — the commitment door has no unanswered question to promise an
                  answer to, and "choose above" over a form with no chooser above it would be the
                  screen describing a control that is not there (B2). */}
              {formMode === 'add' && convBranch === null && !isPayableForm ? (
                /* Frame A's quiet promise — the cold open shows the question, not a form. */
                <p className={`${styles.formGridFull} ${styles.convGhostNote}`}>
                  Choose above — the rest of the form fills in from your answer.
                </p>
              ) : formMode === 'add' && convBranch !== null && CONV_DIRECT.has(convBranch) ? (
                renderConvBody()
              ) : (
              <>

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

              {/* ⚠ A BILL ALREADY HAS A DESCRIPTION, so paying one down does not ask for another
                  (owner ruling C2, 2026-08-23). This is the second of the three signals that the
                  coach picked the other kind of answer — the field they were about to type into
                  disappears, the installment row below arrives, and the consequence line names the
                  bill's new balance. Anything they had typed is kept in state, so changing their
                  mind back to an item restores it rather than starting them over. */}
              {!payingBill && (
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
              )}

              {/* ⚖⚖ THE PAID / OWED FORK IS GONE, AND SO IS THE SCHEDULE EDITOR BEHIND IT (owner
                  ruling B2, 2026-08-23 — money centralization P2). It stood here as mockup 02 drew
                  it: "Has it been paid?", with "Not yet — we owe it" opening the plan editor inside
                  this modal. **RECORD IS FOR MONEY THAT MOVED.** A commitment is a PLAN, and this
                  plan's own §2 puts "commitment schedules" on its list of expectations that stay on
                  their own screens — beside budgets, dues schedules and drive definitions, none of
                  which the conversation ever absorbed. The fork was the single exception, and
                  exceptions are how one vocabulary becomes two again.

                  ⚠ THREE DOORS TO ONE OUTCOME BECAME ONE. This form could produce an unpaid thing
                  three ways — this fork, clearing Date paid, and typing a future date (refused,
                  with a hop). Date paid is REQUIRED now and the hint that invited the blank is
                  gone, so the only door to a commitment is Payables' own "Add a commitment", which
                  KEEPS ITS BUTTON for exactly that reason. Only Transactions' plain "Add" retired.

                  ⚠ WHAT REPLACED IT is not a smaller fork but no fork at all: the picker above
                  offers the bills the team owes as its first group (C2), so "we paid for something"
                  covers paying one down — which this modal could not do at all before.

                  ⚠ THE FORM STILL HAS A COMMITMENT MODE. Payables' Add opens it, and the
                  future-date refusal hands a coach into it with their typing intact. What was
                  deleted is the CONVERSATION's route into a plan, not the plan's own form. */}

              {/* Which piece the money lands on — the coach's override for where the pour STARTS
                  (R3), offered exactly as the bill's own payment door offers it. Most payments
                  leave it alone and the money fills the earliest unpaid piece, spilling forward.
                  ⚠ ALLOCATION, NOT IDENTITY: this stays editable even at a door that locks the
                  answers around it (owner ruling A, 2026-08-23) — the coach may have clicked one
                  installment and be paying a different one. */}
              {payingBill && payingBill.standing.installments.length > 1 && (
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>For installment</label>
                  <select
                    className={styles.select}
                    value={conv.spendInstallmentId}
                    onChange={e => setConv(c => ({ ...c, spendInstallmentId: e.target.value }))}
                  >
                    <option value="">Wherever it&rsquo;s owed (oldest first)</option>
                    {payingBill.standing.installments.map(inst => (
                      <option key={inst.id} value={inst.id}>
                        Installment {inst.installmentNumber} — {fmt(inst.amount)} due {fmtDate(inst.dueDate)}
                        {inst.state === 'settled' ? ' (settled)' : inst.applied > 0 ? ` (${fmt(inst.remaining)} left)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                {/* ⚠ R6 — MORE THAN WHAT IS OWED SAVES, and says so instead of refusing: the money
                    genuinely left, and a book that refuses reality stops matching the bank
                    statement. Word for word the sentence the bill's own payment door gives, because
                    it is now the same act through a different door. */}
                {(() => {
                  if (!payingBill) return null;
                  const typed = parseFloat(form.amount);
                  if (isNaN(typed)) return null;
                  const overBy = Math.round((payingBill.standing.paid + typed - payingBill.standing.total) * 100) / 100;
                  return overBy > 0 ? (
                    <p className={styles.formHint}>
                      That&rsquo;s {fmt(overBy)} more than what&rsquo;s owed. It still saves — the record will read &ldquo;{fmt(overBy)} over&rdquo;.
                    </p>
                  ) : null;
                })()}
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
                  {/* ⚖ THE ASTERISK IS BACK, AND IT MEANS IT (owner ruling B2, 2026-08-23). It was
                      dropped on 2026-08-16 because clearing the field was "the documented way to
                      record something not settled yet" — a second, invisible door to a commitment,
                      which is exactly what this ruling closes. Record is for money that moved, so
                      it has a date; anything not paid is a commitment, and commitments are made on
                      Payables. An EDIT of a saved record is unchanged. */}
                  {/* ⚠ A PLAIN LITERAL ASTERISK, in the label's own ink — and that is now the
                      PORTAL-WIDE rule, not this form's local habit (owner ruling 2026-08-25,
                      `memory/design_decisions.md`). The dedicated red marker this comment used to
                      weigh itself against is RETIRED: red in this portal means something has gone
                      wrong — money owed, overdue, a refused save — and a field is not in error for
                      being required, so the colour was only spending a signal real failures need.
                      The question this comment left open ("a question for the money-forms review")
                      was taken in P3's sweep; there is no marker left to reach for. */}
                  <label className={styles.label}>Date paid{formMode === 'add' ? ' *' : ''}</label>
                  <input
                    className={styles.input}
                    type="date"
                    max={moneyMovedMaxDate()}
                    value={form.paidDate}
                    onChange={e => setForm(f => ({ ...f, paidDate: e.target.value }))}
                  />
                  {/* ⚠ THE HINT DEPENDS ON WHO PAID (/review, 2026-08-16). "The day the family paid
                      it" is the out-of-pocket case: the server always creates such a cost paid, so
                      the field dates their credit rather than deciding whether one is owed.
                      ⚖ THE "clear this and it waits as an unpaid cost" HALF IS DELETED (owner
                      ruling B2, 2026-08-23) — it was the invisible third door to a commitment, and
                      the field is required now. */}
                  {/* ⚠ P4: the bill's OWN payer counts too, so paying down a commitment a family
                      fronted reads the same sentence as fronting a whole cost. `effectivePayerId`
                      is the server's name for this same either-or. */}
                  <p className={styles.formHint}>
                    {effectivePayerId({ paidByPlayerId: form.paidByPlayerId || null }, payingBill?.expense.paidByPlayerId)
                      ? 'The day the family paid it. The team owes them from that date.'
                      : 'The day the money actually left.'}
                  </p>
                  {/* ⚠⚠ THE REFUSAL CARRIES THE DOOR, which is the whole reason it is a rendered
                      element rather than a thrown sentence. Telling a coach "that hasn't happened
                      yet" and leaving them to find Payables themselves is a dead end wearing a
                      polite face — the link takes the amount and the item they already typed
                      straight into the commitment form.
                      ⚠ AND IT IS THE ONLY WAY INTO A PLAN FROM HERE (owner ruling B2, 2026-08-23).
                      With the paid/owed fork deleted this is not a shortcut past a question the
                      form asks — it is the form telling a coach they are at the wrong door and
                      opening the right one without making them retype anything. The record still
                      lands on Payables, which is the whole point; what it no longer does is let a
                      coach reach a schedule editor without being told they have changed act. */}
                  {futureDateRefused && (
                    /* ⚠ The sentence is fold decision 5's, approved 2026-08-28 with decision 6A:
                       the wrong-door moment names the right door by its new name. */
                    <p className={`${styles.formHint} ${styles.formHintConsequence}`} role="alert">
                      <strong>That hasn’t happened yet</strong> — Record is for money that has
                      already moved. Money you’ve agreed to pay later is a bill.{' '}
                      <button
                        type="button"
                        className={styles.linkBtn}
                        /* The shared hand-off — see `handOffToBillForm`, whose header carries the
                           full account (what travels, and why this is a hand-off, never a fork). */
                        onClick={handOffToBillForm}
                      >
                        Make it a bill instead
                      </button>
                      {' '}— your amount, item and description come with you. It joins your payment
                      schedule, and nothing moves until you record a payment against it.
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
                    max={moneyMovedMaxDate()}
                    value={form.receivedDate}
                    onChange={e => setForm(f => ({ ...f, receivedDate: e.target.value }))}
                  />
                </div>
              )}
              {/* ⚖⚖ "WHO PAID IT BACK" IS GONE (money centralization P2 §2.4, built 2026-08-23).
                  A dropdown offering club / vendor / sponsor / a family, whose own hint had to say
                  "just a note on the record — it changes nothing about anyone's dues". Two fields
                  wore one sentence and only the other one moved money: "A family" here created,
                  settled and touched nothing, while the cost form's "Paid by" a fold away mints a
                  real reimbursement credit. A coach reading them as the same question filed money
                  against a family that never learned of it.

                  ⚠ THE COLUMN AND THE ROUTE ARE UNTOUCHED. Existing values still load, still save
                  on an edit and still export — this removes a way to SET the label, not the label.
                  Nothing else in the product renders it. */}

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
                    buttons, which states the credit whether this is open or shut.
                    ⚠ THE BILL FORM'S "(optional)" IS GONE TOO (fold form redesign, finding 3 —
                    the 08-26 marker ruling: required wears the plain asterisk, nothing is ever
                    labelled optional). Its fold now names its contents like its sibling's does;
                    no "paid by" listed because the bill form deliberately never asks it. */}
                <CoachFormDisclosure
                  label={isPayableForm ? 'More — payee, tags, notes' : 'More — paid by, payee, tags, notes'}
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
                  before they commit, and it is what makes folding `Paid by` away safe.
                  (The conversation's four home-tab branches state their own consequence inside
                  `renderConvBody`, same class, same position — one grammar, two renderers.)
                  ⚠ EXCEPT THE BILL FORM, whose consequence PINS WITH THE STICKY FOOTER (fold form
                  redesign, finding 7): its body is the one long enough to scroll the sentence out
                  of reach at the moment of saving — the 08-16 ruling's own intent, held harder. */}
              {!isPayableForm && consequenceLine()}
              </>
              )}
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
                {/* ⚠⚠ IT NAMES THE HOUSEHOLD AND THE FIGURE (owner ruling 2026-08-27). "A family
                    paid this out of pocket" was true and unactionable: a coach deleting a mistyped
                    cost could not tell WHO was about to lose WHAT, and the credit goes by cascade
                    the instant they confirm. The ruling settles an asymmetry — removing a PLAYER
                    who carries credits is refused outright, while deleting the COST they are owed
                    against went through in silence. The delete still goes through; it just stops
                    being silent. */}
                {deletePreview.owesFamily && (
                  <p className={styles.dangerConfirmBody}>
                    {deletePreview.owedByFamily.length > 0 ? (
                      <>
                        <strong>The credit the team owes will be removed too:</strong>{' '}
                        {deletePreview.owedByFamily.map((o, at) => {
                          const who = formatPlayerFirstLast(roster.find(r => r.id === o.playerId));
                          return (
                            <Fragment key={o.playerId}>
                              {at > 0 ? ', ' : ''}
                              {who ? <>{who}’s family</> : <>a family</>} <strong>{fmt(o.amount)}</strong>
                            </Fragment>
                          );
                        })}
                        . No team cash moves either way.
                      </>
                    ) : (
                      <>A family paid this out of pocket. <strong>The credit the team owes them will
                      be removed too</strong> — no team cash moves either way.</>
                    )}
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

            <div className={styles.modalFooter} style={isPayableForm ? { flexWrap: 'wrap' } : undefined}>
              {/* The bill form's consequence rides INSIDE the sticky footer (full-width first row)
                  so it is readable at the moment of saving however long the schedule grows — see
                  the in-grid site's note. `flexBasis: 100%` puts the buttons on their own row. */}
              {isPayableForm && (
                <div style={{ flexBasis: '100%' }}>{consequenceLine()}</div>
              )}
              {/* Delete lives in the FORM's footer, not on the row — the pattern Budget Plan set,
                  and the reason a row needs only one control (owner ruling 2026-08-15).
                  ⚠⚠ EXCEPT ON A COMMITMENT, WHOSE DELETE MOVED TO THE FOOT OF ITS PAGE (Part B).
                  After the register re-point the only way this form opens on a saved commitment is
                  `Add an installment`, launched FROM that page — so a Delete here would be a second,
                  quieter door to the same destructive act, sitting inside a schedule editor and one
                  scroll from the real one. The phase's rule is one delete path, not a softer
                  spare. ⚠ The test is the RECORD's type, not the form's door: `isPayableForm` is
                  also true while ADDING, where there is nothing to delete and this branch is
                  already shut by `formMode`. */}
              {formMode === 'edit' && canWriteMoney && !confirmDelete
                && editing?.expenseType !== 'tournament_payable' && (
                <button
                  className={styles.deleteRecordBtn}
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving || deleting}
                >
                  <Trash2 size={13} aria-hidden /> Delete
                </button>
              )}
              {/* ⚠ DISABLED WHILE SAVING (/review, 2026-08-23). The Record-a-payment modal P2
                  deleted guarded its own Cancel this way, and routing bill payments through this
                  shared footer would have quietly dropped that: click Save, then Cancel while the
                  POST is in flight, and the form closes as though nothing happened while the
                  payment lands a moment later. Every save path through this footer moves money. */}
              <button className={styles.btnGhost} disabled={saving || deleting} onClick={closeForm}>Cancel</button>
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
        </div>,
        document.querySelector('[data-coach-warm-enabled]') ?? document.body,
      )}

      {/* ⚖⚖ THE RECORD-A-PAYMENT MODAL IS GONE (money centralization P2, 2026-08-23). It stood
          here from the Payables Rebuild as its own small window — date, amount, method, note, which
          installment — and it was the last of the five money forms this project set out to merge.
          Every one of those fields is a field the ONE conversation already asks, in the same order
          and the same words, and the act is the same act: "we paid for something", against a bill
          the team already owes (owner ruling C2). Its doors open that form now, locked to the bill
          (ruling A) with the installment override still editable, and it writes through the very
          same payments route this modal did — see `openRecordPayment` and `saveBillPayment`.
          ⚠ NOTHING ABOUT UNDO CHANGED: a recorded payment is still reversed from the bill's own
          payment details, which is where a coach reads what has been paid. */}

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
            void load(true);
            void loadSchedule();
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
