'use client';
import { useState, useEffect, useCallback, useMemo, useRef, use, type ReactNode } from 'react';
import { newMoneyInWordNote } from '@/lib/coach-budget-totals';
import {
  Building2, ArrowUpRight, ArrowDownLeft, Plus, Trash2, Clock,
  ChevronRight, AlertTriangle, CheckCircle2, Undo2,
} from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import CoachNotOnTeam from '@/components/coaches/CoachNotOnTeam';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import RoomShell, { type RoomTile } from '@/components/coaches/RoomShell';
import { useRoomAddress } from '@/components/coaches/useRoomAddress';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import { roomNeighbours } from '@/lib/room-neighbours';
import MoneyExportButton from '@/components/coaches/MoneyExportButton';
import BudgetItemPicker, { type BudgetItemSelection } from '@/components/accounting/BudgetItemPicker';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import SublinedChoice from '@/components/coaches/SublinedChoice';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import { useSharedMoneyRead, useBumpMoneyRevision, useOnMoneyRevisionBump } from '@/lib/coach-money-refresh';
import {
  CLUB_MONEY_ITEM_DIRECTION, CLUB_MONEY_IN_ASK, clubMoneyInWord, clubRequestItemDirection,
  type ClubMoneyInMeaning, type ClubRequest, type ClubRequestType,
} from '@/lib/coach-club-money';
import { tournamentToday, formatStoredDate } from '@/lib/timezone';
import { isInstallmentOverdue } from '@/lib/dues-status';
import type { RepAllocationInstallment, BudgetCategoryWithItems } from '@/lib/types';
import { CLUB_MONEY_COLUMNS, clubMoneyRows } from '@/lib/coach-money-exports';
import CoachLoadError from '@/components/coaches/CoachLoadError';
import { sandboxRefusal } from '@/lib/coach-sandbox-refusal';
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
 *
 * ⚖⚖ LIST · ROOM · QUESTION (owner-ruled 2026-09-02, superseding the 2026-09-01 fold). The table is
 * a LIST again — fixed rows that never grow a form. A club BILL opens its ROOM (`RoomShell`: tiles,
 * the fieldless one-tap installments, the live filing control at a control's width, a named
 * Prev/Next across the bills as the list shows them), addressed by `?clubBill=`. A club REQUEST is a
 * QUESTION: the form it was made in is its one editor — "Edit" while the club has not answered,
 * "Details" once it has — with the team's own filing live inside it either way, because the ask
 * locks and the filing never does (D3). What the in-row fold did for month-end (several bills open
 * at once) is answered by a declined request's reason previewed on its row, and by named Prev/Next
 * inside the room — walk the bills without returning to the list. The fold, its multi-open map and
 * its live controls in table rows are gone.
 *
 * ⚖ EVERY ROW OF THIS TABLE ENDS IN THE SAME GLYPH, AND ONLY THAT (owner, §134 walk, 2026-09-03).
 * Two exceptions were removed on the same pass: the requests band's "Edit"/"Details" button, and
 * the bills band's one-tap "Record as paid · $x" pill (D5, reversed). Each was defensible alone and
 * together they made one five-row table end in three different shapes — while the pill, which
 * applies to a minority of bills, sized the action column for ALL of them. Recording a payment
 * lives on the installment inside the room, which is where Player Dues has always put it.
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

/** A bill's figures before its installments have been walked — one pass fills all three. */
const EMPTY_FIGURES = {
  paid: 0,
  outstanding: 0,
  overdue: 0,
};

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

/* `sandboxRefusal` lived here (it was born on this screen) and moved to `lib/coach-sandbox-refusal.ts`
   when the fundraising rooms gained the same write paths — one sentence, every money door. */

/**
 * ONE RECORD'S FILING, AS A LIVE CONTROL — the money-in question where the record carries one, the
 * item picker, the sentence that says what it means for the report, and its own saving/error
 * state. Rendered inside the bill's ROOM, or inside a decided request's window.
 *
 * ⚠⚠ MODULE SCOPE, NOT DECLARED INSIDE THE PANEL. A component declared inside `ClubPanel` is a new
 * type on every render of the panel, so React unmounts and remounts this one whenever anything else
 * on the screen changes — closing the picker's open menu and losing a half-typed new budget word.
 * The first build dodged that by making it a plain function returning JSX; hoisting it is the same
 * cure with the dependencies stated, and it is the shape `DriveBand` already uses one tab over.
 *
 * ⚠ IT OWNS THE WRITE, which is what deleted the panel's three per-row `Record<string, …>` maps.
 * They tracked busy, error and an in-flight draft for a concurrency the screen cannot produce: only
 * one record is ever open, so only one of these is ever mounted, and a coach answers one control
 * at a time.
 *
 * ⚠ `pending` IS AN OBJECT OR NULL, NEVER A BARE SELECTION — and that is load-bearing. The chosen
 * word is legitimately `null` when a coach clears the filing, so "nothing in flight" and "null in
 * flight" have to be different states or a clear would flash the old word back while it saved.
 */
function ClubFilingControl({
  stored, ask, selectId, categories, direction, orgSlug, teamId, save, consequence, onFailure, onBusyChange,
}: {
  /** What the row carries today — the picker falls back to this whenever nothing is in flight. */
  stored: BudgetItemSelection | null;
  /** Money coming IN carries the one question only the coach can answer; a cost never does. */
  ask?: { value: ClubMoneyInMeaning | null; id: string };
  selectId: string;
  categories: BudgetCategoryWithItems[];
  direction: (meaning: ClubMoneyInMeaning | null) => 'in' | 'out';
  orgSlug: string;
  teamId: string;
  /** Throws on failure; the message it throws is what the coach reads under the control. */
  save: (sel: BudgetItemSelection | null, meaning: ClubMoneyInMeaning | null) => Promise<void>;
  consequence: (value: BudgetItemSelection | null) => ReactNode;
  /** Raises a real failure to the panel's banner, so it outlives this control being collapsed. */
  onFailure?: (message: string) => void;
  /** Tells the surface holding this control that a write is in flight, so its busy gate can refuse
   *  a dismissal that would tear the control down under its own request (`/review`, 2026-09-02). */
  onBusyChange?: (busy: boolean) => void;
}) {
  const [pending, setPending] = useState<{ sel: BudgetItemSelection | null; meaning: ClubMoneyInMeaning | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** The demo's "nothing is saved here" — its own voice, never the red of a real failure. */
  const [note, setNote] = useState('');

  /**
   * ⚠⚠ PENDING STOPS APPLYING BY VALUE, AND IT IS DERIVED RATHER THAN CLEARED (`/review`,
   * 2026-09-02, two lenses independently, then tightened once more).
   *
   * It used to be dropped in `commit`'s `finally` — when the write's OWN reload resolved — and that
   * is the wrong event to listen to. `refreshAfterWrite` bumps the shared money revision BEFORE it
   * reloads, and the bump re-fires this panel's own subscription (`useOnMoneyRevisionBump` does NOT
   * skip the panel that bumped — verified, not assumed). So every write starts TWO loads. The write
   * awaits the FIRST; the SECOND takes a higher sequence number, so the first is DISCARDED by the
   * staleness guard without setting any state. Clearing on it dropped the coach's answer back to the
   * pre-write value for a beat — and PERMANENTLY when the second load failed, because a quiet load
   * swallows its error by design. The screen then insisted nothing was filed while the server had
   * already filed it, with no error anywhere: the worst shape a money screen can take.
   *
   * ⚖ Comparing VALUES rather than latching on an event is the same cure `useOnMoneyRevisionBump`
   * documents for its own version of this bug — an event can be the wrong event, a value cannot.
   * ⚠ And it is computed DURING RENDER, not written back in an effect. The effect version worked but
   * set state from inside an effect to undo state, which is a cascading render and a lint warning
   * standing where a plain derivation belongs. `pending` is simply ignored once the row agrees with
   * it; the next write replaces it and a failure clears it.
   */
  const settled = !!pending
    && (stored?.itemId ?? null) === (pending.sel?.itemId ?? null)
    && (!ask || (ask.value ?? null) === pending.meaning);
  const applied = settled ? null : pending;

  const value = applied ? applied.sel : stored;
  const meaning = applied ? applied.meaning : ask?.value ?? null;
  /* ⚠ THE ASK GATES THE PICKER, and this is where the dialog's disabled Save went. A legacy row
     (raised before mig 271) carries NO answer, and filing it while the answer is still empty would
     write the same NULL back — which the report reads as "a repayment" — while the coach believed
     they had just classified it. Refusing at the control refuses BEFORE the tap, not after it.
     ⚠ It reads the LIVE answer, so answering unlocks the picker immediately rather than after the
     reload lands. The server enforces this independently; this only spares a certain refusal. */
  const askUnanswered = !!ask && !meaning;

  async function commit(sel: BudgetItemSelection | null, nextMeaning: ClubMoneyInMeaning | null) {
    setPending({ sel, meaning: nextMeaning });
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    setNote('');
    try {
      await save(sel, nextMeaning);
    } catch (e: any) {
      if (e?.sandbox) setNote(e.message);
      else {
        setError(e?.message ?? 'Failed to file this.');
        /* ⚠ AND ONCE MORE WHERE IT SURVIVES THIS COMPONENT. A coach can collapse the row while the
           write is in flight; this control then unmounts and its error has nowhere to render, so a
           failed filing would pass in complete silence. The banner is deliberately a SECOND home
           for the same sentence rather than a replacement — the fold is where the coach is looking
           while it is open, and the banner is what is left when it is not. */
        onFailure?.(e?.message ?? 'Failed to file this.');
      }
      /* The write did NOT land, so the screen goes back to what is actually stored. On the success
         path the effect above drops this instead, once the row itself carries the answer. */
      setPending(null);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return (
    <>
      {ask && (
        <div className={`${styles.field} ${styles.clubLiveField}`}>
          <label className={styles.label} htmlFor={ask.id}>{CLUB_MONEY_IN_ASK.label}</label>
          <SublinedChoice
            id={ask.id}
            label={CLUB_MONEY_IN_ASK.label}
            options={CLUB_MONEY_IN_ASK.options}
            value={meaning}
            /* ⚠⚠ CHANGING THE ANSWER CLEARS THE WORD, AND SAVES THAT — the honest outcome, not a
               shortcut. The two answers read from OPPOSITE SIDES of the item library (income words
               for new money, spending words for a repayment), so a word chosen under one answer
               would file real money on the wrong side of the report if it survived the other. */
            onChange={next => { void commit(null, next); }}
            disabled={busy}
          />
          <p className={styles.formHint}>
            Changing this answer clears the word below — the two answers read from opposite sides of
            your item list, so a word chosen under one would file this money on the wrong side of
            the report.
          </p>
        </div>
      )}
      <div className={`${styles.field} ${styles.clubLiveField}`}>
        <label className={styles.label} htmlFor={selectId}>Files under</label>
        <BudgetItemPicker
          categories={categories}
          value={value}
          onChange={sel => { void commit(sel, meaning); }}
          direction={direction(meaning)}
          createItemEndpoint={`/api/coaches/${orgSlug}/budget-items`}
          createItemMode="coach"
          teamId={teamId}
          allowCreateCategory
          /* Where a word invented here will report, when the coach has pointed this picker at the
             money-in side. The money module owns the sentence. */
          newItemNote={newMoneyInWordNote}
          selectId={selectId}
          disabled={busy || askUnanswered}
        />
        <p className={styles.formHint}>
          {busy
            ? 'Saving…'
            : askUnanswered
              ? <>Answer the question above first — it decides which side of your item list this can be filed under.</>
              : consequence(value)}
        </p>
        {error && <p className={styles.errorText}>{error}</p>}
        {note && <p className={styles.formHint}>{note}</p>}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const chip = STATUS_CHIP[status] ?? { cls: 'badgeDraft', label: status };
  return (
    <span className={`${styles.badge} ${styles[chip.cls]}`}>
      {status === 'pending' && <Clock size={11} aria-hidden />} {chip.label}
    </span>
  );
}

/** A bill's state chip — the same on its row and in its room's header, so the two can never disagree. */
function BillStatusBadge({ overdue, outstanding }: { overdue: number; outstanding: number }) {
  if (overdue > 0) {
    return (
      <span className={`${styles.badge} ${styles.badgeOverdue}`}>
        <AlertTriangle size={11} aria-hidden /> {overdue} overdue
      </span>
    );
  }
  if (outstanding > 0.005) return <span className={`${styles.badge} ${styles.badgeDraft}`}>On track</span>;
  return (
    <span className={`${styles.badge} ${styles.badgeApproved}`}>
      <CheckCircle2 size={11} aria-hidden /> Paid
    </span>
  );
}

/** The first line of a club's written reason, for the row — the whole text lives in Details. */
function preview(text: string, max = 110) {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
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

/**
 * Answering the meaning CLEARS the word already picked — one rule, both places that ask it.
 *
 * ⚠⚠ NOT TIDINESS. The two answers read from OPPOSITE SIDES of the item library (income words for
 * new money, spending words for a repayment), and `BudgetItemPicker` deliberately keeps a saved
 * record's own word offered whichever way it points — so a word chosen under one answer SURVIVES
 * the switch to the other and files real money on the wrong side of the report. Nothing would
 * fail; the figure would simply be in the wrong band.
 *
 * ⚠ It exists as one function because it shipped as two copies, in the record window and the
 * filing dialog (`/simplify`, 2026-08-30). Two hand-kept copies of a rule this quiet is how one of
 * them gets a fix and the other does not.
 */
function onMeaningAnswered(
  current: ClubMoneyInMeaning | null,
  setMeaning: (v: ClubMoneyInMeaning) => void,
  clearItem: (v: null) => void,
) {
  return (next: ClubMoneyInMeaning) => {
    if (next === current) return;
    setMeaning(next);
    clearItem(null);
  };
}

/**
 * THE FILTER ROW'S FOUR ANSWERS — every one a STATE, never a kind.
 *
 * ⚠⚠ "Bills" and "Requests" are deliberately absent. The group bands inside the table already
 * answer *which kind*, and a row that mixes a noun ("Bills") with adjectives ("Not filed") makes a
 * coach guess whether they combine. One row, one question: which of these do I want to see?
 *
 * ⚠ WHY THESE FOUR. **Needs attention** is the only one that cuts ACROSS the two kinds — an overdue
 * instalment and an undecided request are the same problem to a coach, and no arrangement by kind
 * can put them together. **Not filed** is the work that makes club money report under the team's own
 * words instead of "Not itemized". **Settled** is what a coach wants out of the way by October.
 * **All** is the default and is never not offered.
 *
 * ⚠ ONE ROW REACHES NONE OF THEM, ON PURPOSE: a DECLINED request is not attention, not settled and
 * not money. It lives in All and nowhere else, because it is a closed conversation rather than work.
 */
const CLUB_FILTERS = [
  { id: 'all',       label: 'All' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'unfiled',   label: 'Not filed' },
  { id: 'settled',   label: 'Settled' },
] as const;
type ClubFilter = (typeof CLUB_FILTERS)[number]['id'];

/** How many records a team needs before a filter row is worth its own height. */
const CLUB_FILTER_FLOOR = 12;

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
        outside the club is a <strong>bill</strong> on the Ledger.
      </p>
    </>
  );
}

export function ClubPanel({
  params: paramsPromise,
  tabActive = true,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
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

  /* Which bill's ROOM is open rides the URL (`?clubBill=`), so a link can open straight to one and
     the layout sweep can reach the room. ⚠ The key is listed in the hub's ONE_SHOT_KEYS; the guard
     test fails the build if a room key ever is not. */
  const [openBillId, setOpenBillId] = useRoomAddress('clubBill');
  /* ⚠ A MARK IS VALUE-SETTLED, NEVER EVENT-CLEARED (`/review`, 2026-09-02). Every write here starts
     TWO reloads (the revision bump re-fires this panel's own subscription) and the write awaits the
     FIRST, which the sequence guard DISCARDS — so clearing a mark when the write "finished" re-enabled
     "Record as paid" while the row still read Unpaid, and a second tap earned a 409 beside a screen
     that then agreed the payment had gone through. A mark now stays until the installment READS paid
     (`isMarking` below) and is only cleared by hand on failure. Same cure as `ClubFilingControl`. */
  const [marking, setMarking] = useState<Record<string, boolean>>({});
  /** The room's filing control is mid-write — part of the room's busy gate, not the control's alone. */
  const [filingBusy, setFilingBusy] = useState(false);
  /* ⚠ COMPONENT STATE, NEVER PERSISTED — and that is the rule, not an omission. A filter a coach
     does not remember setting is money that has gone missing, found weeks later. It resets on every
     visit to this tab. */
  const [filter, setFilter] = useState<ClubFilter>('all');

  // ── The request record window ────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ClubRequest | null>(null);
  const [formType, setFormType] = useState<ClubRequestType>('payment_to_org');
  const [formAmount, setFormAmount] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formMethod, setFormMethod] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formItem, setFormItem] = useState<BudgetItemSelection | null>(null);
  /* The ask (mig 271). Null is "not answered yet", which the field says rather than defaulting —
     the standing rule is never to guess a reversal, and a default IS a guess. */
  const [formMeaning, setFormMeaning] = useState<ClubMoneyInMeaning | null>(null);
  /**
   * The description WE last wrote into the box, so a stale pre-fill can be told from a coach's own
   * sentence.
   *
   * ⚠⚠ IT CANNOT BE DERIVED FROM `formItem`, and that was the bug (owner-found 2026-09-01). The
   * first version compared the description against the currently-chosen item's name — which works
   * until something CLEARS the item. Answering "new money" after "money back" clears it (the two
   * read from opposite sides of the library), and from then on the box still said "Grant" with no
   * item to recognise it by: picking a different word left "Grant" sitting there, and the coach had
   * to delete it by hand. Remembering what we typed survives the item being cleared.
   */
  const [prefilledDesc, setPrefilledDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  /* ── Filing, IN THE RECORD'S OWN SURFACE ──────────────────────────────────
     ⚖ D3 STILL HOLDS: THE RECORD LOCKS, THE TEAM'S LABEL DOES NOT (owner, 2026-08-30). An answered
     request reads read-only — it records what the club acted on — but what the team FILES it under,
     and what the team reads the arrival as, are the team's own layer on top. Re-filing moves no
     money.

     ⚠ WHERE IT LIVES (List · Room · Question, 2026-09-02): a bill's filing is a live control inside
     the bill's ROOM; a request's is inside the request's one window — a field of the form while the
     club has not answered, and the ONE live control in that window once it has. The 2026-09-01
     fold put both in the table row, and a pending request's ask ended up with TWO editors (the
     fold's control and the window's field) — the exact "a record has ONE editor" defect the
     2026-08-26 ruling names. One window per request closes it; nothing on this screen edits a
     record in two places any more.

     ⚠ NO DISCARD GUARD ON THE LIVE CONTROL, deliberately — it writes on the answer, so there is
     nothing unsaved to lose except the picker's own inline "add a word" text, which a deliberate
     Close (never a stray backdrop tap: the room's shell refuses those while a write is in flight)
     throws away, and one press reopens the room. ⚠ WHAT WOULD CHANGE THIS: if the inline create
     ever grows past a single field, revisit it.

     ⚠ THE PANEL HOLDS NO PER-ROW WRITE STATE (`/simplify`, 2026-09-02): `ClubFilingControl` owns
     busy, error and its in-flight draft as ordinary local state, and only one is ever mounted. */

  const assignment = assignments.find(a => a.teamId === teamId);
  const closed = closedAssignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const today = tournamentToday();

  useOverlayOpen(showForm);

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
  /* The window's THIRD mode, named once: a WRITER reading a decided request. Every field is a fact,
     and the one thing still live is the team's own filing (with the money-in answer) — D3. */
  const filingIsLive = readOnly && canWriteMoney;

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
        meaning: editing.moneyInMeaning,
      }
    : { type: 'payment_to_org', amount: '', desc: '', method: '', notes: '', itemId: '', meaning: null as ClubMoneyInMeaning | null };

  const formDirty = !readOnly && (
    formType !== original.type ||
    formAmount !== original.amount ||
    formDesc !== original.desc ||
    formMethod !== original.method ||
    formNotes !== original.notes ||
    formMeaning !== original.meaning ||
    (formItem?.itemId ?? '') !== original.itemId
  );

  const closeForm = useDiscardGuard({
    dirty: formDirty,
    close: () => { setShowForm(false); setConfirmWithdraw(false); },
    noun: 'club request',
  });
  /* The request window stands on the same accessibility floor as a room (D7): Escape closes
     (through the discard guard, never past it), Tab stays inside, focus returns to the row. */
  const formPanelRef = useRef<HTMLDivElement>(null);
  /* ⚠ Gated on `tabActive` (`/review`, 2026-09-02): the hub keeps this panel mounted, hidden, when a
     coach leaves the tab with the window open, and a floor left armed on a hidden panel answered a
     bare Escape on whatever tab they were on — closing an invisible window, or raising its discard
     question over an unrelated screen. The window's filing write counts as busy too. */
  useDialogFloor(showForm && tabActive, formPanelRef, { onClose: () => { void closeForm(); }, busy: busy || filingBusy });


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
      /* ⚰ THE FIRST BILL USED TO AUTO-OPEN HERE, and it is deliberately gone (owner, 2026-09-01).
         It opened a filing row and a four-row instalment table on load, which is what pushed the
         requests band a screen and a half down — *"if I didn't already know of its presence I would
         have no idea the section even exists"*. Nothing opens itself now: a bill is a closed row
         carrying its own paid/due figures and its overdue mark, and the coach opens the one they
         came for. */
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
  const refreshAfterWrite = useCallback(async (quiet = false) => {
    bumpMoneyRevision();
    await load(quiet);
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
    const byId = new Map<string, typeof EMPTY_FIGURES>();
    for (const s of splits) {
      let paid = 0, outstanding = 0, overdue = 0;
      // One pass per bill, not three — the figures partition the same list.
      for (const i of s.installments) {
        if (i.paidAt) { paid += i.amount; continue; }
        outstanding += i.amount;
        if (i.dueDate < today) overdue += 1;
      }
      byId.set(s.id, { paid, outstanding, overdue });
    }
    return byId;
  }, [splits, today]);

  /** Every installment the loaded list says is paid — what settles a mark (see `marking`). */
  const paidIds = useMemo(
    () => new Set(splits.flatMap(s => s.installments.filter(i => i.paidAt).map(i => i.id))),
    [splits],
  );
  /** A write on this installment is in flight AND the list has not yet read it back as paid. */
  const isMarking = useCallback(
    (inst: RepAllocationInstallment) => !!marking[inst.id] && !inst.paidAt,
    [marking],
  );

  /**
   * WHICH STATES EACH ROW IS IN — one pass, shared by the chip counts and the filtered lists.
   *
   * ⚠⚠ THE STATES ARE NOT MUTUALLY EXCLUSIVE and must not be modelled as if they were. A bill can be
   * overdue AND unfiled; a request can be settled AND unfiled. The chips pick one lens at a time;
   * a row can answer to several. Modelling this as a single `state` field per row is the mistake
   * waiting to be made here — it would force a precedence order nobody has ruled on.
   *
   * ⚠ A DECLINED request is in NONE of them, deliberately: not attention (nothing to do), not
   * settled (no money moved), not money. It appears only under All.
   */
  const rowStates = useMemo(() => {
    const billIs = new Map<string, { attention: boolean; unfiled: boolean; settled: boolean; amount: number }>();
    for (const s of splits) {
      const f = splitFigures.get(s.id) ?? { paid: 0, outstanding: 0, overdue: 0 };
      billIs.set(s.id, {
        attention: f.overdue > 0,
        unfiled: !s.budgetItemId,
        // A bill is settled when nothing is left to pay on it — not when it has been touched.
        settled: f.outstanding <= 0.005,
        // The row's own displayed figure, which is what the "hidden" total must add up.
        amount: f.outstanding,
      });
    }
    const reqIs = new Map<string, { attention: boolean; unfiled: boolean; settled: boolean; amount: number }>();
    for (const r of requests) {
      reqIs.set(r.id, {
        attention: r.status === 'pending',
        unfiled: !r.budgetItemId,
        settled: r.status === 'approved',
        amount: r.amount,
      });
    }
    return { billIs, reqIs };
  }, [splits, requests, splitFigures]);

  /** Does this row survive the chip that is on? `all` never hides anything. */
  const passes = useCallback(
    (st: { attention: boolean; unfiled: boolean; settled: boolean } | undefined) =>
      filter === 'all' || !!st?.[filter],
    [filter],
  );

  const shownSplits = useMemo(
    () => splits.filter(s => passes(rowStates.billIs.get(s.id))),
    [splits, rowStates, passes]);
  const shownRequests = useMemo(
    () => orderedRequests.filter(r => passes(rowStates.reqIs.get(r.id))),
    [orderedRequests, rowStates, passes]);

  /**
   * The chip counts, in ROWS — never dollars.
   *
   * ⚠⚠ THIS IS WHY THE SUMMARY BAND IS NOT THE FILTER, and it is worth stating where the two meet.
   * The band counts INSTALMENTS and money ("6 instalments · 1 overdue"); this table lists BILLS. A
   * band cell used as a filter would be labelled 6 and produce 3 rows — and a part-paid bill would
   * belong to "Still to pay" and "Settled" at the same time, which is coherent as a dollar figure
   * and incoherent as a row filter. The band reports; the chips filter.
   */
  const filterCounts = useMemo(() => {
    const count = (key: 'attention' | 'unfiled' | 'settled') =>
      [...rowStates.billIs.values()].filter(v => v[key]).length
      + [...rowStates.reqIs.values()].filter(v => v[key]).length;
    return {
      all: splits.length + requests.length,
      attention: count('attention'),
      unfiled: count('unfiled'),
      settled: count('settled'),
    } as Record<ClubFilter, number>;
  }, [rowStates, splits.length, requests.length]);

  const recordCount = splits.length + requests.length;
  const shownCount = shownSplits.length + shownRequests.length;
  const showFilters = recordCount >= CLUB_FILTER_FLOOR;

  /**
   * What the filter is keeping off the screen, in dollars.
   *
   * ⚠ A money screen states this. "2 of 7" is not enough for a coach reconciling against a bank
   * statement — they need to know the screen is not the whole story and by how much.
   */
  const hiddenTotal = useMemo(() => {
    if (filter === 'all') return 0;
    const hidden = (
      splits.filter(s => !passes(rowStates.billIs.get(s.id))).map(s => rowStates.billIs.get(s.id)?.amount ?? 0)
    ).concat(
      requests.filter(r => !passes(rowStates.reqIs.get(r.id))).map(r => rowStates.reqIs.get(r.id)?.amount ?? 0),
    );
    return Math.round(hidden.reduce((a, b) => a + b, 0) * 100) / 100;
  }, [filter, splits, requests, rowStates, passes]);

  /* ⚠ A FILTER MUST NOT SURVIVE THE LIST SHRINKING BELOW ITS OWN DOOR. If records are withdrawn or a
     season changes and the chip row stops rendering, a filter left on would hide rows with nothing
     on screen to explain why — the "money missing" failure this whole row is designed against. */
  useEffect(() => {
    if (!showFilters && filter !== 'all') setFilter('all');
  }, [showFilters, filter]);

  const hasAnything = splits.length > 0 || requests.length > 0;

  /** The bill whose room is open, from the loaded list — the address alone opens nothing. */
  const openSplit = useMemo(() => splits.find(s => s.id === openBillId) ?? null, [splits, openBillId]);
  /* A stale address — a bill from another season, one the club withdrew — must not leave a room
     "open" on nothing. Once the list has loaded without it, the key is dropped, quietly. */
  useEffect(() => {
    if (openBillId && !loading && !error && !openSplit) setOpenBillId(null);
  }, [openBillId, loading, error, openSplit, setOpenBillId]);
  /* The request the window shows, kept LIVE: the window's filing control writes and reloads the
     list, and `editing` is the snapshot the window opened with — reading the row back from the list
     is what lets the control settle on the value the server now holds. */
  const liveEditing = useMemo(
    () => (editing ? requests.find(r => r.id === editing.id) ?? editing : null),
    [editing, requests],
  );
  /** The open bill's room — its figures, tiles and walk — derived when the bill or the list it
   *  walks changes, never per keystroke of the request form this panel also holds. */
  const billRoom = useMemo(() => {
    if (!openSplit) return null;
    const figures = splitFigures.get(openSplit.id) ?? EMPTY_FIGURES;
    const nextDue = [...openSplit.installments]
      .filter(i => !i.paidAt)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null;
    const tiles: RoomTile[] = [
      { label: 'Billed', value: fmt(openSplit.amount) },
      { label: 'Paid', value: fmt(figures.paid), tone: figures.paid > 0.005 ? 'good' : undefined },
      {
        label: 'Left',
        value: fmt(figures.outstanding),
        tone: figures.overdue > 0 ? 'danger' : figures.outstanding > 0.005 ? 'warn' : undefined,
      },
      { label: 'Next due', value: nextDue ? `${fmtDate(nextDue.dueDate)} · ${fmt(nextDue.amount)}` : 'Paid off' },
    ];
    /* The walk is the list as the coach sees it — unless an action taken IN the room (paying the
       last overdue piece under "Needs attention", filing under "Not filed") has just moved this
       bill out of the active filter. Then the walk falls back to every bill, so Prev/Next keep
       working instead of collapsing to "0 of N" on the very record on screen (`/review`). */
    const walkList = shownSplits.some(s => s.id === openSplit.id) ? shownSplits : splits;
    const walk = roomNeighbours(walkList, openSplit.id, s => s.id, s => s.allocationDescription);
    return { figures, tiles, walk };
  }, [openSplit, splitFigures, shownSplits, splits]);

  // ── Writes ───────────────────────────────────────────────────────────────
  async function markPaid(split: AllocationSplit, inst: RepAllocationInstallment) {
    // Marks that have since read back as paid are dropped on the way in, so the map never grows.
    setMarking(prev => ({
      ...Object.fromEntries(Object.entries(prev).filter(([id, on]) => on && !paidIds.has(id))),
      [inst.id]: true,
    }));
    setActionError('');
    const release = () => setMarking(prev => ({ ...prev, [inst.id]: false }));
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/allocations/${split.id}/installments/${inst.id}`,
        { method: 'PATCH' },
      );
      const data = await res.json().catch(() => ({}));
      /* Same reason as `sandboxRefusal`'s own note — "Record as paid" is the other control a
         prospect presses inside a bill's fold, and it sat one line from showing them the code
         name too. ⚠ The request form's own submit is NOT covered here: it is the pre-existing
         window, outside the fold this pass rebuilt, and still shows the raw string. */
      const refused = sandboxRefusal(res, data);
      if (refused) { setActionError(refused); release(); return; }
      if (!res.ok) throw new Error(data?.error ?? 'Failed to mark this installment paid.');
      /* ⚠⚠ QUIET FOR THE SAME REASON `writeFiling` IS (`/review`, 2026-09-02, two lenses). This
         button lives INSIDE a bill's room, beside the filing control (or on the row as the one-tap
         pill) — a loud reload sets `loading`, the whole table goes behind that flag, and recording
         a payment tore down the open record and the picker next to it, half-typed new budget word
         and all. Fixing the flash for one control and not the other beside it was the wrong half
         of a fix.
         ⚠ NOT changed: the request form's own submit and withdraw. Those close a modal — a context
         switch the coach asked for — and a visible reload behind it is not the same defect. */
      /* ⚠ The mark is NOT released on success — the reload this awaits is the one the sequence
         guard discards, so "finished" here is not "read back". The mark settles by value when the
         list reads the installment as paid (`isMarking`). */
      await refreshAfterWrite(true);
    } catch (e: any) {
      setActionError(e.message ?? 'Failed to mark this installment paid.');
      release();
    }
  }

  /**
   * TAKE A CLUB PAYMENT BACK — the mirror of `markPaid` (owner, §134 walk 2026-09-03).
   *
   * ⚖ ONE TAP, NO CONFIRM, and that is deliberate: the act it reverses costs one tap, so guarding
   * the reversal harder than the act would be backwards — and this is the tap a coach reaches for
   * precisely when they have just made a mistake. It is reversible in its own right (recording it
   * paid again is one tap), so it is not the one-way door a delete is and does not wear one's
   * clothes.
   *
   * ⚠ THE SERVER OWNS THE REFUSALS — a payment recorded before the books could be reversed
   * together, a race with another coach, a read-only money coach, the sandbox. Everything here is
   * the sentence the coach reads.
   *
   * ⚠ QUIET RELOAD, same as `markPaid` and `writeFiling`: this button lives INSIDE the bill's
   * room beside the filing control, and a loud reload sets `loading`, taking the open room and a
   * half-typed budget word down with it.
   */
  async function undoPaid(split: AllocationSplit, inst: RepAllocationInstallment) {
    setMarking(prev => ({ ...prev, [inst.id]: true }));
    setActionError('');
    const release = () => setMarking(prev => ({ ...prev, [inst.id]: false }));
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/allocations/${split.id}/installments/${inst.id}`,
        { method: 'DELETE' },
      );
      const data = await res.json().catch(() => ({}));
      const refused = sandboxRefusal(res, data);
      if (refused) { setActionError(refused); release(); return; }
      if (!res.ok) throw new Error(data?.error ?? 'Failed to take this payment back.');
      await refreshAfterWrite(true);
      /* ⚠ RELEASED HERE, unlike `markPaid`. That one settles BY VALUE — the mark clears itself when
         the list reads the installment as paid. This write moves the row the other way, so there is
         no incoming truth to settle against and holding the flag would leave the row busy forever. */
      release();
    } catch (e: any) {
      setActionError(e.message ?? 'Failed to take this payment back.');
      release();
    }
  }

  /**
   * One filing write, wherever it came from.
   *
   * ⚠ TWO OBJECTS, TWO ROUTES, AND THE CALLER PICKS — a bill files through the allocations door, a
   * request through its own filing-only door, which is deliberately NOT the correction PATCH: that
   * one refuses anything the club has answered, and the whole point of D3 is that this does not.
   */
  async function writeFiling(target: { url: string; body: unknown; failure: string }) {
    const res = await fetch(target.url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(target.body),
    });
    const data = await res.json().catch(() => ({}));
    const refused = sandboxRefusal(res, data);
    if (refused) { const e: any = new Error(refused); e.sandbox = true; throw e; }
    if (!res.ok) throw new Error(data?.error ?? target.failure);
    /* ⚠⚠ QUIET, AND THAT IS NOT A TIDY-UP (`/simplify`, 2026-09-02). A loud reload sets `loading`,
       and the whole table is behind that flag — so every category a coach picked blanked the
       screen to the loading skeleton and rebuilt it, taking the open fold and its picker down with
       it. The dialog got away with it because it was closing anyway; a LIVE control cannot. The
       row's own control already says it is saving, which is the affordance the skeleton was
       standing in for. ⚠ The bump stays LOUDLY first — the shared read is cached per revision, so
       a load before the invalidation replays answers the save has just made wrong. */
    await refreshAfterWrite(true);
  }

  function openForm() {
    setEditing(null);
    setFormType('payment_to_org');
    setFormAmount('');
    setFormDesc('');
    setFormMethod('');
    setFormNotes('');
    setFormItem(null);
    setFormMeaning(null);
    setPrefilledDesc('');
    setFormError('');
    setConfirmWithdraw(false);
    setShowForm(true);
  }

  /**
   * The direction the item picker offers, on the record window and in the filing dialog.
   *
   * ⚠⚠ CHANGING THE ANSWER CLEARS THE CHOSEN WORD, and that is deliberate rather than tidy. The two
   * answers read from OPPOSITE SIDES of the item library — income words for new money, spending
   * words for a repayment — and the picker always keeps a saved record's own word offered, so a
   * word chosen under one answer would survive under the other and file real money on the wrong
   * side of the report. Losing one tap is the cheap half of that trade.
   */
  /**
   * Choosing a budget word NAMES the record — the description arrives pre-filled with it.
   *
   * ⚠⚠ THIS IS THE BEHAVIOUR THE FIELD ORDER EXISTS FOR (owner ruling 2026-08-15). The Record form
   * has done it since that ruling; this form could not, because it asked for the word LAST — so
   * moving the field up is what made this possible, and the two changes are one change.
   *
   * ⚠ IT NEVER OVERWRITES WHAT A COACH TYPED. The pre-fill lands only on an EMPTY description, or
   * on one still holding the previous word untouched — so changing your mind about the word
   * re-names the row, while a sentence a coach wrote survives being re-filed. Anything else turns a
   * convenience into a hazard on a form that records money.
   */
  function chooseFormItem(next: BudgetItemSelection | null) {
    setFormItem(next);
    const typed = formDesc.trim();
    /* The box is OURS to rewrite while it is empty or still holds the word we put there. The moment
       a coach types their own sentence it is theirs, and re-filing never touches it again. */
    if (next?.itemName && (typed === '' || typed === prefilledDesc)) {
      setFormDesc(next.itemName);
      setPrefilledDesc(next.itemName);
    }
  }

  /** The word was cleared — take our pre-fill with it, but never a coach's own words. */
  function clearFormItem() {
    setFormItem(null);
    if (prefilledDesc && formDesc.trim() === prefilledDesc) {
      setFormDesc('');
      setPrefilledDesc('');
    }
  }

  const answerMeaning = onMeaningAnswered(formMeaning, setFormMeaning, clearFormItem);

  /**
   * Open a request's window — "Edit" on a pending one the coach can write, "Details" otherwise.
   *
   * ⚠ ONE WINDOW, TWO MODES (D3). `readOnly` below decides which: a request the club has answered,
   * or any request for a coach without money-write, opens as facts with the decline reason first —
   * and, for a writer, the team's own filing still live inside it.
   */
  function openRecord(r: ClubRequest) {
    setEditing(r);
    setFormMeaning(r.moneyInMeaning);
    setFormType(r.requestType);
    setFormAmount(r.amount.toFixed(2));
    setFormDesc(r.description);
    setFormMethod(r.paymentMethod ?? '');
    setFormNotes(r.notes ?? '');
    setFormItem(toSelection(r));
    /* ⚠ A SAVED RECORD'S DESCRIPTION IS THE COACH'S, whatever it happens to say — even if it matches
       its item's name exactly. Opening one never marks it as ours to overwrite. */
    setPrefilledDesc('');
    setFormError('');
    setConfirmWithdraw(false);
    setShowForm(true);
  }

  async function handleSubmit() {
    setFormError('');
    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) { setFormError('Enter an amount greater than 0.'); return; }
    if (!formDesc.trim()) { setFormError('Say what this request is for.'); return; }
    /* ⚠ THE SERVER ENFORCES THIS TOO (mig 271) — this is the sentence a coach reads, not the rule.
       The rule is that a new arrival never gets a guessed meaning. */
    if (formType === 'charge_to_org' && !formMeaning) {
      setFormError('Say whether this is new money or the club paying you back.');
      return;
    }

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
            moneyInMeaning: formType === 'charge_to_org' ? formMeaning : null,
            amount,
            description:   formDesc.trim(),
            paymentMethod: formMethod || null,
            notes:         formNotes.trim() || null,
            budgetItemId:  formItem?.itemId ?? null,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      /* ⚠ AND HERE TOO (`/review`, 2026-09-02, reversing this pass's own "out of scope" note).
         Make a request and Withdraw are the two buttons a prospect is most likely to press on this
         tab in the public coach demo — leaving them showing "SandboxReadOnly" while the fold beside
         them was fixed is the wrong half of a fix, whatever the diff's boundary was. */
      const refusedHere = sandboxRefusal(res, data);
      if (refusedHere) { setFormError(refusedHere); return; }
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
      const refusedHere = sandboxRefusal(res, data);
      if (refusedHere) { setFormError(refusedHere); return; }
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
    if (formType === 'payment_to_org') {
      return <>The club sees a request to send them <strong>{money}</strong>{filed}. Nothing leaves your books until they approve it{editing ? ', and you can change or withdraw it until then' : ''}.</>;
    }
    /* ⚠ THE LINE SAYS WHAT THE ANSWER DOES TO THE REPORT, because that is the only difference
       between the two answers a coach can see anywhere. Both are cash the moment the club approves;
       one becomes a revenue row and the other shrinks a cost. */
    const lands = formMeaning === 'funding'
      ? <> and report as <strong>new money</strong> on Budget vs. Actual</>
      : formMeaning === 'reimbursement'
        ? <> and <strong>net into the cost it repaid</strong> on Budget vs. Actual</>
        : null;
    return <>The club sees a request for <strong>{money}</strong>{filed}{lands}. Nothing arrives on your books until they approve it{editing ? ', and you can change or withdraw it until then' : ''}.</>;
  }

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      {/* ⚰ The "Back to Money" row that stood here is GONE (back-in-header ruling, 2026-08-26).
          It rendered only on the legacy standalone route, and every legacy money route is a
          permanent redirect into the hub — so no coach has seen it since that sweep. Deleted as
          dead code rather than migrated to the header arrow, which is for live drill-ins. */}
      {/* ⚰ And so is this panel's own CoachPageHeader (cleanup tranche 6, 2026-09-01). Its title,
          icon and help topic only ever rendered on the standalone route; inside the hub the header
          collapsed to an actions row this panel had none of, so it rendered nothing at all. The
          live "?" for this tab is the hub's own, which is tab-aware. Reasoning at the hub's mount
          in accounting/page.tsx. */}
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
          {/* ⚠ THE SHARED BAND (owner D1, 2026-09-03). This tab's own three-cell band WAS the
              reference the standard was written from — its geometry, its all-or-nothing stack at
              760 and its note-line-beneath are what `MoneySummaryBand` now gives every money tab.
              What changed here is only what the standard settles: the trailing direction word
              leaves the figure (the caption already says "out · in"), and the label step aligns.

              ⚠ THE COLOURS SURVIVE BECAUSE THEY ARE VERDICTS, not decoration — money owed reads
              danger, a request nobody has answered reads warning. A plain total would not. */}
          <MoneySummaryBand
            ariaLabel="Club money summary"
            tiles={[
              {
                key: 'owed',
                label: 'Still to pay the club',
                figure: fmt(standing.owed),
                tone: 'danger',
                caption: (
                  <>
                    {standing.owedCount === 0
                      ? 'nothing outstanding'
                      : `${standing.owedCount} installment${standing.owedCount === 1 ? '' : 's'}`}
                    {standing.overdueCount > 0 && (
                      <> · <span className={styles.clubBandOverdue}>
                        <AlertTriangle size={11} aria-hidden /> {standing.overdueCount} overdue
                      </span></>
                    )}
                  </>
                ),
              },
              {
                key: 'waiting',
                label: 'Waiting on the club',
                figure: fmt(standing.waiting),
                tone: 'warn',
                caption: standing.waitingCount === 0
                  ? 'nothing awaiting a decision'
                  : `${standing.waitingCount} request${standing.waitingCount === 1 ? '' : 's'}, not yet decided`,
              },
              {
                key: 'settled',
                label: 'Settled this season',
                /* ⚠ THE DIRECTION IS IN THE CAPTION, NOT STAPLED TO THE FIGURE (standard, 2026-09-03).
                   `settledNet` is signed and the caption states both sides, so the absolute figure
                   is not hiding anything a reader cannot see one line down. */
                figure: fmt(Math.abs(standing.settledNet)),
                caption: `${fmt(standing.settledOut)} out · ${fmt(standing.settledIn)} in`,
              },
            ]}
          />
          {/* ⚠⚠ THE ONE SENTENCE THIS SCREEN CANNOT DO WITHOUT. A pending request sits inches from
              money that has genuinely moved, and the two are not the same kind of thing. It is out
              of Cash on hand and out of the Budget Plan — but it DOES appear in the register's
              forward view (owner ruling 2026-08-17), so "it appears nowhere" would be a lie. The
              line says what it is not, and where it is.

              ⚠⚠ IT NAMED A TAB THAT NO LONGER EXISTS (owner-found 2026-09-01). It read "It shows in
              **Transactions** under *include what's scheduled*" — but Transactions became the
              **Ledger** in the One-Ledger fold (§119), and that control is a **Scheduled** option in
              the Ledger's Status filter. A standing note pointing at a tab a coach cannot find is
              worse than no note: it teaches them the product is describing a different version of
              itself.

              ⚠ AND IT ONLY RENDERS WHEN SOMETHING IS ACTUALLY WAITING. A permanent warning about a
              state the team is not in is noise on the screen a treasurer reads most carefully — the
              band's own cell already says "nothing awaiting a decision" when that is the case. */}
          {/* ⚠ TRIMMED AGAIN (owner, 2026-09-01): "it's out of your cash on hand and out of your
              plan" went. It explained the mechanics of a figure the coach can simply read above,
              and the note only has to do two things — say the money is not theirs yet, and say
              where to find it. */}
          {standing.waiting > 0.005 && (
            <p className={styles.moneyBandNote}>
              <strong>Waiting on the club isn&apos;t yours yet.</strong> You&apos;ll find it on the
              {' '}<strong>Ledger</strong> under <strong>Scheduled</strong>.
            </p>
          )}

          {actionError && <p className={styles.errorText} style={{ marginBottom: '1rem' }}>{actionError}</p>}

          {/* ══ CLUB MONEY — ONE TABLE, TWO GROUP BANDS (owner-approved 2026-09-01, mockup
              `claude.ai/code/artifact/8948648d-958d-44b4-8502-7abe9d82dd9f` §06 B) ══════════════

              ⚠⚠ WHY THIS IS ONE TABLE AND NOT TWO SECTIONS. It was two: a list of bill CARDS with
              the first one auto-opened, then a table of requests. The owner could not find the
              second one — *"if I didn't already know of its presence I would have no idea the
              section even exists"* — because one opened card and three collapsed ones pushed it a
              screen and a half down. Collapsing the cards fixes three bills and hides the problem
              again at nine.

              The rule that came out of it, and it is the owner's: **a whole section must never be
              invisible below another whole section.** A group band INSIDE one table is not a second
              section — it is a heading three rows down — so the rule holds at every width, phone
              included, which is the one thing a two-column layout cannot do.

              ⚠ IT ONLY WORKS BECAUSE THE TWO KINDS SHARE A SHAPE once you stop describing each in
              its own jargon: a name, what it is filed under, an amount, and a state. A bill's
              amount is what is still to pay; a request's is what was asked. ⚠⚠ THIS DOES NOT
              TRANSFER TO FUNDRAISING — a drive has Amount/Team keeps/Credits and a sponsor has
              Pledged/In/To come/Credits, so one table there would blank half its columns on every
              row. That tab keeps two tables. **Consistency between the two screens is the
              vocabulary and the components, never the arrangement.**

              ⚠⚠ THE GROUP BANDS ARE LOAD-BEARING AND NEVER COLLAPSE. One table implies one kind of
              thing, and a bill is not a request: one is an obligation with due dates, the other a
              conversation that can be declined. The bands are the only thing carrying that
              distinction now, which is why each states its own count and its own money.

              ⚠ EACH GROUP'S ACTIONS SIT IN ITS OWN BAND ROW, not in the toolbar — the Fundraising
              bands' rule, and here it is forced: `CoachExportButton` always renders the word
              "Export", so two of them in one toolbar would be the exact defect its own header
              records an owner ruling against ("two buttons both labelled Export producing different
              files"). ══════════════════════════════════════════════════════════════════════════ */}
          <section className={styles.clubBlock}>
            {/* ⚠⚠ ONE EXPORT AND ONE CREATE, ABOVE THE TABLE (owner, 2026-09-01). They briefly sat
                on the group bands — the Fundraising bands' rule, and forced at the time because two
                Export triggers in one toolbar would both read "Export" and produce different files.
                The tab is ONE table, so the answer was not to move the buttons but to make the
                export match the screen: `clubMoneyRows` exports the whole table, both bands, and
                there is nothing left to disambiguate.
                ⚠ The per-instalment reading is not lost with it — the Ledger carries every club
                instalment as a dated row and its export ships them. See `CLUB_MONEY_COLUMNS`. */}
            {/* ⚰ A "Club money · 7 records" HEADING STOOD HERE and is deleted (owner, 2026-09-01).
                It restated its own container three ways: the tab bar above already reads **Club**,
                the hub header above that reads **Money**, and the record count was the sum of two
                figures printed on the group bands six inches below ("3 bills" + "4 requests"). The
                standing rule from the dues walk applies — a heading has to earn its line by saying
                what the frame around it does not — and Fundraising's toolbar, the sibling with the
                same two-band shape, carries no title either.
                ⚠ THE COUNT IS NOT LOST WHERE IT MATTERS: the filter row prints "All 7" when it
                renders, and the hidden-by-filter note prints "Showing 2 of 7" whenever a chip is on
                — which is the only moment a coach needs the total to check nothing has gone astray.
                ⚠ THE TABLE KEEPS THE NAME FOR SCREEN READERS (aria-label below) — dropping a visible
                heading must not leave the table anonymous to someone who cannot see the tab bar. */}
            <div className={styles.panelToolbar}>
              <div className={styles.panelToolbarActions}>
                <MoneyExportButton
                  label="Club money"
                  formats={['xlsx', 'csv']}
                  build={() => ({
                    dataset: 'club-money',
                    title: 'Club Money',
                    columns: CLUB_MONEY_COLUMNS,
                    rows: clubMoneyRows(splits, requests, today),
                    scopeLabel: seasonName,
                    teamName,
                    emptyMessage: 'Nothing has moved between this team and the club this season.',
                  })}
                  disabled={recordCount === 0}
                />
                {/* ⚠ RENDERS AT EVERY STATE INCLUDING THE EMPTY ONE: a team with no requests must
                    still have a way to make a first one. */}
                {canWriteMoney && (
                  <button type="button" className={`${styles.btnPrimary} ${styles.clubToolbarAction}`} onClick={openForm}>
                    <Plus size={15} aria-hidden /> Make a request
                  </button>
                )}
              </div>
            </div>

            {/* ⚠⚠ THE FILTER ROW EARNS ITS SPACE OR IT IS NOT THERE (owner-approved). Seven records
                need no filter — the chips would be chrome taller than the thing they organise — so
                the row appears only once the list is long enough to hunt in, which a club-run team
                billing monthly reaches by mid-season.
                ⚠ EVERY CHIP IS A **STATE**, never a kind. "Bills" and "Requests" chips are
                deliberately absent: the group bands already answer that, and mixing a noun with
                adjectives in one row makes a coach guess whether they combine.
                ⚠ THE COUNTS ARE ROWS, not dollars — filtering to "Needs attention 2" leaves two
                rows. The band above counts instalments and money, which is why the band is NOT the
                filter: it would say 6 and show 3. */}
            {showFilters && (
              <div className={styles.clubFilterRow} role="group" aria-label="Filter club money">
                {CLUB_FILTERS.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    className={`${styles.clubChip} ${filter === f.id ? styles.clubChipOn : ''}`}
                    aria-pressed={filter === f.id}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label} {filterCounts[f.id]}
                  </button>
                ))}
              </div>
            )}

            {/* ⚠⚠ A FILTER ON A MONEY SCREEN SAYS WHAT IT IS HIDING, IN DOLLARS. "2 of 7" is not
                enough for a coach reconciling against a bank statement — they need to know the
                screen is not the whole story and by how much. ⚠ The filter also RESETS every visit
                (it is component state, never persisted): a remembered filter is money that goes
                missing and turns up weeks later. */}
            {filter !== 'all' && (
              <p className={styles.clubHiddenNote}>
                <AlertTriangle size={13} aria-hidden />
                <span>
                  Showing <strong>{shownCount} of {recordCount}</strong>
                  {hiddenTotal > 0.005 && <> — <strong>{fmt(hiddenTotal)}</strong> of club money is hidden by this filter</>}.
                  {' '}
                  <button type="button" className={styles.clubShowAll} onClick={() => setFilter('all')}>Show all</button>
                </span>
              </p>
            )}

            {recordCount === 0 ? (
              /* ⚠ THE QUIET VARIANT while there is nothing at all — a coach cannot create a bill,
                 and the one thing they CAN do is offered on the requests band below. */
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
            ) : (
              <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
                <table className={styles.table} aria-label="Club money">
                  <thead>
                    <tr>
                      <th className={`${styles.th} ${styles.clubTableWhat}`}>What</th>
                      <th className={`${styles.th} ${styles.clubTableFiling}`}>Files under</th>
                      <th className={`${styles.th} ${styles.thNum} ${styles.clubTableAmount}`}>Amount</th>
                      <th className={`${styles.th} ${styles.clubTableStatus}`}>Status</th>
                      <th className={`${styles.th} ${styles.clubTableAction}`} aria-label="Row actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {/* ── BAND ONE: what the club has billed us ─────────────────────────────── */}
                    <tr className={styles.clubGroupRow}>
                      <td className={styles.clubGroupCell} colSpan={5}>
                        <div className={styles.clubGroupInner}>
                        <span className={styles.clubGroupName}>What the club has billed us</span>
                        <span className={styles.clubGroupMeta}>
                          {/* ⚠ THE BAND'S OWN TOTALS ARE THE REAL ONES, never the filtered sum — a
                              group heading reporting a filtered figure would be a wrong number on a
                              money screen. When a filter is on it says how many of how many. */}
                          {splits.length} {splits.length === 1 ? 'bill' : 'bills'}
                          {standing.owed > 0.005 && <> · {fmt(standing.owed)} still to pay</>}
                          {filter !== 'all' && <> · {shownSplits.length} of {splits.length} shown</>}
                        </span>
                        </div>
                      </td>
                    </tr>

                    {splits.length === 0 ? (
                      <tr className={styles.tr}>
                        <td className={styles.td} colSpan={5}>
                          <span className={styles.mutedInline}>
                            Your club hasn&apos;t billed this team this season. When it splits a shared
                            cost across its teams, this team&apos;s share appears here with its own
                            payment schedule.
                          </span>
                        </td>
                      </tr>
                    ) : shownSplits.length === 0 ? (
                      <tr className={styles.tr}>
                        <td className={styles.td} colSpan={5}>
                          <span className={styles.mutedInline}>No bills match this filter.</span>
                        </td>
                      </tr>
                    ) : shownSplits.map(split => {
                      const { paid, outstanding, overdue: splitOverdue } =
                        splitFigures.get(split.id) ?? EMPTY_FIGURES;
                      return (
                        <tr
                          key={split.id}
                          className={`${styles.tr} ${styles.rowTappable}`}
                          onClick={() => { if (window.getSelection()?.toString()) return; setOpenBillId(split.id); }}
                        >
                          {/* ⚠ NO `data-label` — DELIBERATE, AND THE RULE IS GENERAL (owner + /design,
                              §134 walk): the lead cell of a card is the card's TITLE, and a title
                              takes no caption. "What" earns its place as a column header, where it
                              tells you what a column of names is; printed above a single name on a
                              phone it is a whole line of chrome saying nothing the name doesn't.
                              The other three labels stay, because "$450.00", "Not filed" and a bare
                              badge genuinely cannot say what they are. The test is that sentence. */}
                          <td className={`${styles.td} ${styles.cardStackCell}`}>
                            {split.allocationDescription}
                            <span className={styles.listRowSub}>{fmt(paid)} paid of {fmt(split.amount)}</span>
                          </td>
                          {/* ⚠ THE CELL READS, IT DOES NOT ACT. The picker that changes this lives in
                              the bill's room, one tap away — see the filing note at the top of this
                              component. */}
                          <td className={styles.td} data-label="Files under">
                            <Filing category={split.budgetCategoryName} item={split.budgetItemName} />
                          </td>
                          <td className={`${styles.td} ${styles.tdNum}`} data-label="Amount" style={{ fontWeight: 700 }}>
                            {outstanding > 0.005 ? fmt(outstanding) : <span className={styles.mutedInline}>—</span>}
                          </td>
                          <td className={`${styles.td} ${styles.clubStatusCell}`} data-label="Status">
                            <BillStatusBadge overdue={splitOverdue} outstanding={outstanding} />
                          </td>
                          <td className={`${styles.td} ${styles.cardActionCell} ${styles.cardActionCorner}`}>
                            <span className={styles.listRowActions}>
                              {/* ⚰ THE ONE-TAP "RECORD AS PAID · $x" PILL STOOD HERE AND IS DELETED
                                  (owner, §134 walk — reversing D5 of the 2026-09-02 ruling).
                                  It fired on a bill with exactly one unpaid installment, which is a
                                  MINORITY of rows, and the cost was paid by all of them: the widest
                                  cell sizes the column, so one exceptional row was holding ~260px of
                                  table width hostage from "What", "Files under" and "Status" — every
                                  row, every render. Against that it saved one tap, on a journey a
                                  coach already knows (open the bill, record the piece), and it made
                                  the action column say two different things on adjacent rows.
                                  ⚠ RECORDING A PAYMENT DID NOT MOVE — it is where it always was, on
                                  the installment itself inside the bill's room, and every installment
                                  offers it rather than only the last one. That also puts this screen
                                  in step with Player Dues, where the one-tap has always lived on the
                                  installment and never on the family's list row.
                                  ⚠ Do not reintroduce a conditional control in this cell. If a bill
                                  ever needs a second action, it belongs in the room beside the first.

                                  ⚠⚠ A REAL BUTTON — the row's accessible door to its room. A bare
                                  clickable <tr> is mouse-only (the 2026-09-02 lesson), and now the
                                  room holds the filing control, the door has to be reachable. One
                                  glyph on every bill: they all open the same thing. */}
                              <button
                                type="button"
                                className={`${styles.linkBtn} ${styles.listRowToggle}`}
                                onClick={e => { e.stopPropagation(); setOpenBillId(split.id); }}
                                aria-label={`Open ${split.allocationDescription}`}
                              >
                                <ChevronRight size={16} className={styles.listRowChevron} aria-hidden />
                              </button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {/* ── BAND TWO: what we've asked the club ───────────────────────────────── */}
                    <tr className={styles.clubGroupRow}>
                      <td className={styles.clubGroupCell} colSpan={5}>
                        <div className={styles.clubGroupInner}>
                        <span className={styles.clubGroupName}>What we&apos;ve asked the club</span>
                        <span className={styles.clubGroupMeta}>
                          {requests.length} {requests.length === 1 ? 'request' : 'requests'}
                          {standing.waiting > 0.005 && <> · {fmt(standing.waiting)} waiting on a decision</>}
                          {filter !== 'all' && <> · {shownRequests.length} of {requests.length} shown</>}
                        </span>
                        </div>
                      </td>
                    </tr>

                    {requests.length === 0 ? (
                      <tr className={styles.tr}>
                        <td className={styles.td} colSpan={5}>
                          <span className={styles.mutedInline}>
                            You haven&apos;t asked the club for anything this season. Ask them to cover
                            or pay back a cost, or send money back to them — every request goes to the
                            club office for a decision.
                          </span>
                        </td>
                      </tr>
                    ) : shownRequests.length === 0 ? (
                      <tr className={styles.tr}>
                        <td className={styles.td} colSpan={5}>
                          <span className={styles.mutedInline}>No requests match this filter.</span>
                        </td>
                      </tr>
                    ) : shownRequests.map(r => {
                      const pending = r.status === 'pending';
                      const canEdit = pending && canWriteMoney;
                      return (
                        <tr
                          key={r.id}
                          className={`${styles.tr} ${styles.rowTappable} ${pending ? styles.clubRowPending : ''}`}
                          onClick={() => { if (window.getSelection()?.toString()) return; openRecord(r); }}
                        >
                          {/* ⚠ THE DIRECTION SITS BESIDE THE NAME, NOT UNDER IT. On its own line it
                              cost every request row a second line for one badge, so requests stood
                              taller than bills for no information — and a bill's sub-line is doing
                              real work (its total and what has been paid). Inline, the two kinds of
                              row are the same height and the column reads down cleanly. */}
                          {/* No `data-label` — the card's title takes no caption; see the bills row. */}
                          <td className={`${styles.td} ${styles.cardStackCell}`}>
                            <span className={styles.listRowName}>
                              {r.description}
                              <DirectionBadge type={r.requestType} />
                            </span>
                            {/* ⚠ A DECLINED REQUEST'S REASON IS READ ON THE ROW (D3): skimming five
                                of them needs no opens. The whole text stands at the top of Details. */}
                            {r.status === 'denied' && r.denialReason && (
                              <span className={styles.listRowSub}>&ldquo;{preview(r.denialReason)}&rdquo;</span>
                            )}
                          </td>
                          {/* ⚠ THE CELL READS, IT DOES NOT ACT — both controls that change this are
                              live inside the request's window. */}
                          <td className={styles.td} data-label="Files under">
                            <span className={styles.clubFilingStack}>
                              {/* ⚠ WHAT A LEGACY ROW READS AS IS DECIDED IN `coach-club-money`, not
                                  here — the same rule the report applies, so the label and the figure
                                  can never disagree about one record. */}
                              {clubMoneyInWord(r) && (
                                <span className={styles.clubMeaningWord}>{clubMoneyInWord(r)}</span>
                              )}
                              <Filing category={r.budgetCategoryName} item={r.budgetItemName} />
                            </span>
                          </td>
                          <td className={`${styles.td} ${styles.tdNum}`} data-label="Amount" style={{ fontWeight: 700 }}>{fmt(r.amount)}</td>
                          <td className={`${styles.td} ${styles.clubStatusCell}`} data-label="Status">
                            <StatusBadge status={r.status} />
                            {r.reviewedAt && <span className={styles.clubReviewedOn}> {fmtDate(r.reviewedAt)}</span>}
                          </td>
                          <td className={`${styles.td} ${styles.cardActionCell} ${styles.cardActionCorner}`}>
                            {/* ⚠⚠ ONE DOOR GLYPH ON EVERY ROW OF THIS SCREEN (owner, §134 walk). This
                                cell held a `btnSecondary` reading "Edit" or "Details", and the band
                                above it held a chevron — so one table ended in two different shapes
                                and the Fundraising lists (chevron on every row) disagreed with both.
                                The note that stood here argued a chevron "would promise a room a
                                request does not have"; that distinction is REAL in the grammar
                                (rooms vs Questions) and INVISIBLE to a coach, who reads the glyph as
                                "this opens" and is right — it opens the same window the row's own tap
                                opens. The plan's list anatomy says so outright: name · status chip ·
                                one figure · chevron.
                                ⚠ What the words were carrying is not lost: a pending request already
                                declares itself three times over — the amber left edge
                                (`clubRowPending`), the "Awaiting the club" badge, and the absence of
                                a decision date. And the accessible name below KEEPS the honest verb,
                                so a screen-reader coach is not traded down for a tidier column. */}
                            <span className={styles.listRowActions}>
                              <button
                                type="button"
                                className={`${styles.linkBtn} ${styles.listRowToggle}`}
                                onClick={e => { e.stopPropagation(); openRecord(r); }}
                                aria-label={`${canEdit ? 'Edit' : 'Open'} ${r.description}`}
                              >
                                <ChevronRight size={16} className={styles.listRowChevron} aria-hidden />
                              </button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* ══ THE BILL'S ROOM (List · Room · Question, 2026-09-02) ═══════════════════════════════
          Tiles, then the fieldless one-tap installments (ruling R-D unchanged), then the live filing
          control at a control's width, then the club's own note read-only — and a named walk across
          the bills as the list shows them. Nothing to delete: a club bill is the club's record. */}
      {openSplit && billRoom && tabActive && (
          <RoomShell
            open
            onClose={() => setOpenBillId(null)}
            ariaLabel={`${openSplit.allocationDescription} — club bill`}
            title={openSplit.allocationDescription}
            status={<BillStatusBadge overdue={billRoom.figures.overdue} outstanding={billRoom.figures.outstanding} />}
            tiles={billRoom.tiles}
            busy={filingBusy || openSplit.installments.some(isMarking)}
            recordKey={openSplit.id}
            sentinel="club-bill"
            nav={{ ...billRoom.walk, noun: 'bills', onSelect: setOpenBillId }}
          >
            {/* ⚠ The panel's banner sits BEHIND this overlay (`/review`, 2026-09-02) — a refused
                "Record as paid" (the sandbox's sentence included) has to be read in the room too. */}
            {actionError && <p className={styles.errorText}>{actionError}</p>}
            <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
              <table className={styles.table} aria-label="Installments">
                <thead>
                  <tr>
                    <th className={styles.th}>#</th>
                    <th className={`${styles.th} ${styles.thNum}`}>Amount</th>
                    <th className={styles.th}>Due date</th>
                    <th className={styles.th}>Status</th>
                    <th className={styles.th} aria-label="Row actions" />
                  </tr>
                </thead>
                <tbody>
                  {openSplit.installments.map(inst => {
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
                            /* ⚠ `badgeOverdue`, NOT `badgeCompleted` — this row said "Overdue" in the
                               AMBER of a completed season while every other overdue mark in the
                               portal says it in red. */
                            <span className={`${styles.badge} ${overdue ? styles.badgeOverdue : styles.badgeDraft}`}>
                              {overdue ? 'Overdue' : 'Unpaid'}
                            </span>
                          )}
                        </td>
                        <td className={`${styles.td} ${styles.cardActionCell}`}>
                          {/* ⚖ A PAYMENT CAN BE TAKEN BACK (owner, §134 walk). This was the only
                              money a coach records with no way home — a dues payment, a payout and
                              a credit all have a remove — and it is also the fastest write in the
                              portal, so the wrong row was one tap away and permanent.
                              ⚠ IT IS A QUIET GHOST BUTTON, NOT A DANGER ONE. Undoing is a
                              correction, not a destruction: it voids the transfer on BOTH ledgers
                              and leaves it visible in the audit trail, and recording it paid again
                              is one tap. Dressing it in red would tell a coach they were about to
                              do something they cannot take back, which is the opposite of true. */}
                          {inst.paidAt && canWriteMoney && (
                            <button
                              type="button"
                              className={`${styles.linkBtn} ${styles.undoPaidBtn}`}
                              disabled={isMarking(inst)}
                              onClick={() => undoPaid(openSplit, inst)}
                              aria-label={`Undo the ${fmt(inst.amount)} payment on installment ${inst.installmentNumber}`}
                            >
                              <Undo2 size={13} aria-hidden /> {isMarking(inst) ? 'Undoing…' : 'Undo'}
                            </button>
                          )}
                          {!inst.paidAt && canWriteMoney && (
                            <button
                              type="button"
                              className={`${styles.btnSecondary} ${styles.compactAction}`}
                              disabled={isMarking(inst)}
                              onClick={() => markPaid(openSplit, inst)}
                            >
                              {/* ⚖ "Record as paid", not "Mark paid" — it RECORDS a payment; the
                                  server derives amount, date and description. ⚠⚠ AND IT STAYS ONE
                                  TAP (ruling R-D): a club instalment is fieldless by design, so a
                                  form would add a step and ask nothing. */}
                              {isMarking(inst) ? '…' : 'Record as paid'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* ⚠ A BILL IS ALWAYS THE MONEY-OUT SIDE — there is no direction question on one. A
                club cannot grant a team money by billing it. */}
            {canWriteMoney ? (
              /* ⚠ KEYED BY THE BILL (`/review`, 2026-09-02): the room's Prev/Next swaps the record
                 while this stays mounted, and an unkeyed control carried its last pick — its
                 `pending` — onto the next bill and showed it as that bill's filing. */
              <ClubFilingControl
                key={openSplit.id}
                stored={toSelection(openSplit)}
                selectId={`club-bill-item-${openSplit.id}`}
                onBusyChange={setFilingBusy}
                categories={categories}
                direction={() => CLUB_MONEY_ITEM_DIRECTION}
                orgSlug={orgSlug}
                teamId={teamId}
                save={sel => writeFiling({
                  url: `/api/coaches/${orgSlug}/teams/${teamId}/allocations`,
                  body: { splitId: openSplit.id, budgetItemId: sel?.itemId ?? null },
                  failure: 'Failed to file this bill.',
                })}
                onFailure={setActionError}
                consequence={val => val?.itemId
                  ? <>Every installment of this bill reports under <strong>{val.categoryName} · {val.itemName}</strong> on Budget vs. Actual. Filing it moves no money.</>
                  /* ⚠ THIS SENTENCE USED TO BE FALSE, and it was found by the planning session that
                     led here: it read "it won't appear on Budget vs. Actual at all", while the report
                     deliberately counts unfiled club money under "Not itemized" and its own route
                     says so in a comment. */
                  : <>Until this bill is filed, it reports under <strong>Not itemized</strong> on Budget vs. Actual — it still counts, it just has no name.</>}
              />
            ) : !openSplit.budgetItemId && (
              <p className={styles.clubFilingHint}>
                Until it&apos;s filed, this bill reports under <strong>Not itemized</strong>.
              </p>
            )}
            {openSplit.notes && <p className={styles.clubRecordNote}>{openSplit.notes}</p>}
          </RoomShell>
      )}

      {/* ── The request window: ONE window, two modes (List · Room · Question D3, 2026-09-02) ──
          Opened blank by "Make a request", by "Edit" on a pending request the coach can write, or by
          "Details" on any other. It is a form — several fields and a submit — so it is a Question,
          never a room. In read-only mode the fields are facts and the decline reason comes first;
          what stays live for a writer is the part that was always the team's own: the money-in
          answer and what it files under, through the same live control the bill's room uses. The
          2026-09-01 fold had made this window unreachable for a decided request and given a pending
          one two editors of the same field; both are closed here. `readOnly` is a BELT as well as a
          mode — money access is refreshed state, so it can fall away between the render that drew
          the door and the tap that opens it. */}
      {showForm && (
        <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (busy ? undefined : closeForm)?.(); }}>
          {/* ⚠ `modalFlushFooter` IS REQUIRED ON ANY MODAL TALL ENOUGH TO SCROLL, and this one is —
              the direction picker, the item picker, four fields and a notes box clear 90vh on a
              laptop. Without it the footer's bottom bleed sits inside the panel's own bottom padding
              (a band of dead space under the buttons) AND shortens the scroll extent, so the last
              field can never quite be scrolled into view. */}
          <div
            ref={formPanelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={editing ? (readOnly ? 'Club request details' : 'Edit club request') : 'New club request'}
            className={`${styles.modal} ${styles.modalFlushFooter}`}
            onClick={e => e.stopPropagation()}
          >
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
                  {/* ⚠⚠ A DROPDOWN, NOT TWO CARDS (owner ruling 2026-09-04). This was a pair of
                      radio-cards on a form that ALREADY used SublinedChoice a few rows down, so one
                      screen was showing both patterns at once — and the direction stays correctable
                      (a request can be turned round), so it never met the exemption the 2026-08-22
                      ruling reserves for a choice that cannot be changed afterwards.
                      ⚠ THE TWO DIRECTION ARROWS WENT WITH THE CARDS, and that was the owner's call
                      made on the mockup rather than discovered afterwards: SublinedChoice has no
                      icon slot, and growing it one to serve a single caller is exactly what its own
                      design note warns against. The words carry the direction twice — "From the
                      club" / "To the club", then the sub-line — which is what makes the loss
                      affordable. Do not re-add an icon prop here without re-opening that call. */}
                  {/* ⚠ The visible label is the caller's — `label` below is the accessible name
                      only and renders nothing. */}
                  <label className={styles.label} htmlFor="club-money-direction">Which way is the money going? *</label>
                  <SublinedChoice
                    id="club-money-direction"
                    label="Which way is the money going? *"
                    options={[
                      { value: 'charge_to_org' as const, name: 'From the club', sub: 'They cover or pay back a cost' },
                      { value: 'payment_to_org' as const, name: 'To the club', sub: 'We send them money' },
                    ]}
                    value={formType === 'charge_to_org' || formType === 'payment_to_org' ? formType : null}
                    /* ⚠ TURNING THE REQUEST ROUND DROPS THE ANSWER. Money the team SENDS the club
                       is a cost, which has no second reading — the server refuses a meaning on
                       this direction and the column's own CHECK agrees, so a stale answer left
                       in state would be a 400 the coach cannot see the cause of. The clear is
                       ASYMMETRIC on purpose; do not "tidy" it into one shared handler. */
                    onChange={side => {
                      setFormType(side);
                      if (side === 'payment_to_org') setFormMeaning(null);
                      clearFormItem();
                    }}
                  />
                </div>
              )}

              {/* ⚠⚠ THE ASK — the one decision about club money that belongs to the coach (mig 271,
                  owner ruling 2026-08-15, ratified D1 2026-08-30). A grant and a repayment arrive as
                  the SAME transaction: same direction, same amount, same club, same approval. The
                  product read every one of them as a repayment, so a genuine grant vanished into a
                  cost line it was never about and the club's contribution appeared nowhere.
                  ⚠ ONLY ON THE INCOMING BRANCH. Money the team SENDS the club is a cost; there is
                  no second reading of it, and asking would be a question with one answer.
                  ⚠ IT SITS ABOVE THE PICKER because the answer decides which SIDE of the item
                  library the picker offers — asking it after would show a list built on a guess. */}
              {/* ⚠ For a WRITER reading a decided request the ask is not a fact here — it is the
                  live half of the filing control below, where answering it can still re-file the
                  money. A read-only coach sees the value. */}
              {formType === 'charge_to_org' && !filingIsLive && (
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label} htmlFor="club-meaning">
                    {CLUB_MONEY_IN_ASK.label} {!readOnly && '*'}
                  </label>
                  {readOnly ? (
                    <p className={styles.recordValue}>
                      {formMeaning
                        ? CLUB_MONEY_IN_ASK.options.find(o => o.value === formMeaning)?.name
                        /* ⚠ A LEGACY ROW SAYS WHAT IT REPORTS AS, not "—". These were approved
                           before the question existed and they report as repayments; a dash would
                           read as "nobody knows", which is worse than the truth and unactionable.
                           The row's own "Change" is where a coach fixes one. */
                        : 'Paying us back for a cost'}
                    </p>
                  ) : (
                    <SublinedChoice
                      id="club-meaning"
                      label={CLUB_MONEY_IN_ASK.label}
                      options={CLUB_MONEY_IN_ASK.options}
                      value={formMeaning}
                      onChange={answerMeaning}
                      disabled={saving}
                    />
                  )}
                  {/* ⚰ A THREE-LINE EXPLANATION STOOD HERE and is deleted (owner, 2026-09-01). It
                      said the answer "decides which row of Budget vs. Actual tells the truth" and
                      that "neither answer changes anyone's dues" — but the two options in the
                      dropdown already carry their own consequence on their own sub-lines ("adds to
                      what the season has" / "nets into the cost it repaid"), and the form's
                      consequence line above the buttons says what saving will do. Three tellings of
                      one thing.
                      ⚠ The dues reassurance went with it deliberately. Nothing on this form suggests
                      a request could touch a family's bill; saying so unprompted invites the doubt
                      it was meant to settle. The rule is still absolute in the code and is stated
                      where it belongs — the migration, the plan and the help guide. */}
                </div>
              )}

              {/* ⚠⚠ THE ORDER IS THE FEATURE, AND IT IS THE RECORD FORM'S (owner ruling 2026-08-15,
                  applied here 2026-09-01). This form asked Amount → Description → What is it for?,
                  which broke that ruling twice over: the budget word comes BEFORE the description
                  *because choosing it NAMES the record* — the description arrives pre-filled with
                  that word, ready to type over. Asked last, the pre-fill would land on a field the
                  coach had just finished filling in, so this form never pre-filled at all and the
                  convenience the ruling exists to create was simply absent.
                  ⚠ The two branch questions stay ABOVE it: they read as one decision, and the
                  second decides which SIDE of the item library this picker offers. */}
              {/* ⚠⚠ THE FIELD THIS WHOLE PHASE TURNS ON (mig 250, owner's question at the P4 mockup
                  review). Without it an approved request reached NO part of Budget vs. Actual — the
                  report reads neither this table nor the allocations — so on a club-run team the
                  season's largest money was missing from the screen that compares spending to plan.

                  ⚠⚠ THE SIDE IS THE ANSWER ABOVE, NOT THE DIRECTION (mig 271). Until 2026-08-30
                  this was the money-OUT list on both directions, on the reasoning that a "From the
                  club" request brings money in but what it is FOR is a cost — true of a
                  REIMBURSEMENT, and the refund rule that the direction flips the money and never the
                  list still holds for one. It was never true of a GRANT, which is new money and
                  files against the income words. `clubRequestItemDirection` owns the choice, so
                  the same rule reaches this picker and the filing dialog below without either
                  spelling it out.
                  ⚠ One search box either way, and its create door stays the picker's own inline
                  add — one door by construction, never one per kind. */}
              {/* ⚖ THE ASK LOCKS, THE FILING NEVER DOES (D3): once the club has answered, a writer's
                  window keeps exactly one live thing — the team's own reading of the money and the
                  word it files under, written on the answer through the same control the bill's
                  room uses. The row behind the window updates as it saves. */}
              {filingIsLive && liveEditing ? (
                <div className={styles.formGridFull}>
                  <ClubFilingControl
                    key={liveEditing.id}
                    onBusyChange={setFilingBusy}
                    stored={toSelection(liveEditing)}
                    ask={liveEditing.requestType === 'charge_to_org'
                      ? { value: liveEditing.moneyInMeaning, id: 'club-meaning' }
                      : undefined}
                    selectId="club-item"
                    categories={categories}
                    direction={meaning => clubRequestItemDirection({ requestType: liveEditing.requestType, moneyInMeaning: meaning })}
                    orgSlug={orgSlug}
                    teamId={teamId}
                    save={(sel, meaning) => writeFiling({
                      url: `/api/coaches/${orgSlug}/teams/${teamId}/payment-requests/${liveEditing.id}/filing`,
                      body: { budgetItemId: sel?.itemId ?? null, moneyInMeaning: meaning },
                      failure: 'Failed to file this request.',
                    })}
                    onFailure={setFormError}
                    consequence={val => val?.itemId
                      ? <>This reports under <strong>{val.categoryName} · {val.itemName}</strong> on Budget vs. Actual. Re-filing moves no money.</>
                      : <>Until this is filed, it reports under <strong>Not itemized</strong> on Budget vs. Actual — it still counts, it just has no name.</>}
                  />
                </div>
              ) : (
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
                    onChange={chooseFormItem}
                    direction={clubRequestItemDirection({ requestType: formType, moneyInMeaning: formMeaning })}
                    createItemEndpoint={`/api/coaches/${orgSlug}/budget-items`}
                    createItemMode="coach"
                    teamId={teamId}
                    allowCreateCategory
                    /* Where a word invented here will report, when the coach has pointed this picker at the
                       money-in side. The money module owns the sentence. */
                    newItemNote={newMoneyInWordNote}
                    selectId="club-item"
                    disabled={saving}
                  />
                )}
              </div>
              )}

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

              <div className={styles.field}>
                {/* "Amount", not "Amount ($)" (owner 2026-09-04) — the currency marker was one of only
                    two left in the portal and the field itself already says it. The other was the
                    budget line form, changed in the same pass. */}
                <label className={styles.label} htmlFor="club-amount">Amount {!readOnly && '*'}</label>
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

            {/* ⚠⚠ THE CONFIRMATION IS THE FOOTER'S OTHER STATE — it stood in the scrolling body
                above this band and the owner could not find it (§134 walk): on a long request the
                block appeared BELOW THE FOLD, so pressing Withdraw looked like it did nothing while
                the only control still on screen (Cancel) had gone dead to stop a coach saving the
                edit they were abandoning. A dead button and an invisible explanation is how someone
                gets stranded in a modal.
                Now the question REPLACES the buttons it suspends, in the one band that is always
                visible — the same contract RoomShell gives its doors slot. Nothing is disabled any
                more because nothing competing is rendered, and there are three ways out: Keep it,
                the header X, and Escape.
                ⚠ IT NAMES THE REQUEST AND SAYS WHAT SURVIVES, never a bare "Are you sure?".
                Withdrawing removes the request outright — the club never sees it and there is
                nothing to restore — so that has to be said before a coach can agree to it. */}
            <div className={styles.modalFooter}>
              {confirmWithdraw && editing ? (
                <div className={styles.dangerConfirm} role="alertdialog" aria-label="Confirm withdraw">
                  <p className={styles.dangerConfirmTitle}>Withdraw “{editing.description}”?</p>
                  <p className={styles.dangerConfirmBody}>
                    This takes the request off the club&apos;s list for good — there&apos;s no record
                    kept and no way to bring it back. You can always make a new one.
                  </p>
                  <div className={styles.dangerConfirmActions}>
                    <button type="button" className={styles.btnGhost} disabled={withdrawing} onClick={() => setConfirmWithdraw(false)}>Keep it</button>
                    <button type="button" className={styles.btnDanger} disabled={withdrawing} onClick={handleWithdraw}>
                      {withdrawing ? 'Withdrawing…' : 'Withdraw request'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
              {/* Withdraw sits in the FORM's footer, never on the row — the rule Budget Plan set and
                  the money screens follow, and the reason a row needs only one control. */}
              {editing && canWriteMoney && !readOnly && (
                <button type="button" className={styles.deleteRecordBtn} onClick={() => setConfirmWithdraw(true)} disabled={busy}>
                  <Trash2 size={13} aria-hidden /> Withdraw request
                </button>
              )}
              {/* ⚠ THE LONE ACTION IS NEVER THE BORDERLESS ONE. On a locked record "Close" is not the
                  quiet alternative to Save — it is the only thing in the footer, and a ghost control
                  with no edge reads as unfinished text floating in the band. It takes a shape when it
                  stands alone and steps back to the ghost beside Save.
                  ⚰ `disabled={… || confirmWithdraw}` STOOD ON THIS BUTTON AND ON SAVE, and is gone
                  (§134 walk). The reasoning was sound — a live "Save changes" under an unanswered
                  question let a coach save the very edit they were abandoning — but disabling was the
                  wrong instrument: the question that explained the dead buttons was in the scrolling
                  body, often off screen, so the coach saw only a Cancel that no longer worked. The
                  confirmation now REPLACES this whole row, so there is nothing to disable. */}
              <button
                type="button"
                className={readOnly ? styles.btnSecondary : styles.btnGhost}
                onClick={closeForm}
                disabled={busy}
              >
                {readOnly ? 'Close' : 'Cancel'}
              </button>
              {canEditRecord && canWriteMoney && (
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={handleSubmit}
                  /* ⚠⚠ EVERY REQUIRED FIELD GATES THIS BUTTON THE SAME WAY (owner-found
                     2026-09-01). The ask was checked inside the submit handler instead, so a missing
                     amount left the button visibly disabled while a missing ANSWER left it looking
                     live and doing nothing — two behaviours for one situation, and the dead one
                     teaches a coach the product is broken. The house rule is the foreseeable-refusal
                     ruling (§118): a control that cannot work says so before it is pressed. The
                     server still enforces the answer; this is what a coach is offered. */
                  disabled={busy || !formAmount || !formDesc.trim()
                    || (formType === 'charge_to_org' && !formMeaning)}
                >
                  {saving ? 'Saving…' : (editing ? 'Save changes' : 'Submit request')}
                </button>
              )}
                </>
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
