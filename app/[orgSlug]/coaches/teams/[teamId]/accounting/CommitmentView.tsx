'use client';
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Pencil } from 'lucide-react';
import RoomShell, { type RoomShellProps } from '@/components/coaches/RoomShell';
import GuardedDelete from '@/components/coaches/GuardedDelete';
import { useLatestRef } from '@/components/coaches/useLatestRef';
import BudgetItemPicker from '@/components/accounting/BudgetItemPicker';
import PayeeCombobox, { type PayeeSelection } from '@/components/accounting/PayeeCombobox';
import PaymentMethodCombobox from '@/components/accounting/PaymentMethodCombobox';
import TagSearchCombobox, { MONEY_TAG_MANAGE } from '@/components/coaches/TagSearchCombobox';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import type { BudgetCategoryWithItems, RepTeamExpense, RepTeamTag } from '@/lib/types';
import type { CommitmentStanding } from '@/lib/payable-standing';
import { ledgerReversalPreview } from '@/lib/expense-ledger';
import styles from '../../../coaches.module.css';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **THE TEAM BILL'S ROOM — and the room edits itself** (List · Room · Question Phase C, owner-ruled
 * 2026-09-02 D4; plan `docs/projects/active/COACH_MONEY_LIST_ROOM_QUESTION_PLAN.md` §4; mockup
 * `claude.ai/code/artifact/11607f0a-e0c1-4bb4-bbd5-b6f81d834fbc`, section "the page exception
 * dissolves", rulings R1–R5).
 *
 * ⚖⚖ **IT WAS A `?bill=` SUB-VIEW THAT REPLACED THE LEDGER; IT IS A ROOM OVER IT** (Phase C). The
 * page shape was chosen in August for one reason — a height-capped centred modal overflowed on a
 * long schedule (§64 Part E) — and guard rule G3 solves that structurally: `RoomShell` is
 * full-height with its own scroll. The review that re-ruled D4 confirmed the rest of the
 * justification had no code behind it (no print capability was ever built here, and the styles are
 * still named "drawer"). What the page bought is kept: the address still works, a link is still
 * shareable, the schedule may still grow. What it cost is returned: the Ledger stays mounted
 * behind the room with its filters and scroll intact, and the hardcoded "back to Ledger" label —
 * a fragility the code itself flagged — is gone, replaced by the shell's ✕ and Escape.
 *
 * Part A closed the duplicate doors on this screen. B answered the question underneath them: *if
 * this is a screen, why does it open a window to change what it is already showing?* Six fields —
 * the bill's name, its filing, payee, tags, how it is paid and the note — are rendered as live
 * controls here and save themselves. `Edit details` is gone; so, now, is the page header it used
 * to sit in.
 *
 * ⚠⚠ **THE NAME IS THE ROOM'S TITLE, AND A TITLE TAKES NO LABEL** (owner + `/design`, 2026-09-03:
 * *"the card's lead cell is its TITLE and takes no label"*). That ruling is also this screen's
 * answer to the plan's open "required-but-unmarked Name" item: the title slot is EXEMPT from the
 * required marker, because a record's own name in the title position cannot be mistaken for an
 * optional field, and a `*` floating beside a page heading reads as a footnote. The server still
 * refuses an empty name; autosave still declines to send one; the strip still says why.
 *
 * ⚠⚠ **THE LINE THIS DRAWS: A MODAL IS FOR A QUESTION, NOT FOR A FIELD.** `Change` and `Remove` on
 * an installment ask a real one — *this payment, this and the later ones, or all unpaid?* Recording
 * money keeps its one conversation, because a payment touches the books, the schedule and sometimes
 * a family's credit. Typing a payee asks nothing. Those flows stay with the panel and arrive here
 * as `children`; this component owns the bill's own fields and nothing else.
 *
 * ⚠⚠ **NOTHING HERE MOVES MONEY, AND THAT IS WHY IT MAY SAVE SILENTLY.** The route treats all six
 * as bookkeeping detail: no figure moves, no ledger entry posts, nothing is owed to a family. The
 * form's consequence line ("$X of this has been paid… changing a figure that has already been paid
 * updates the team's books too") is about FIGURES, and no figure is editable on this page — a
 * commitment's total is the sum of its installments and is changed on the schedule. **Do not add an
 * amount field here.** If one ever arrives, this docblock's claim stops being true and the page
 * owes a consequence line of its own.
 *
 * ⚠ **THE NAME IS THE ONE FIELD THE SERVER CAN REFUSE.** A rename has to claim the bill's ledger
 * link before it breaks it, and on a pre-mig-236 payment the match can be AMBIGUOUS — the route
 * refuses rather than orphaning a posted entry, in a sentence written for the coach. So the status
 * strip shows a refusal and stops; it must never swallow one into a silent retry. Everything else
 * about the bill still saves, which is what the refusal itself says.
 *
 * ── The save idiom, and why THIS one ────────────────────────────────────────────────────────────
 * The portal already saves in place two ratified ways: the plan-template editor's debounced
 * autosave with a status pill, and the development session's per-cell quiet ✓. **This takes the
 * template editor's**, for a reason: four of the six fields are compound controls (a payee search,
 * a tag picker), not table cells, and one of them can be refused with a sentence a coach has to
 * read — a per-cell tick has nowhere to put that sentence. ⚠ ONE BEHAVIOUR FOR ALL SIX. Six fields
 * with five save behaviours would be worse than the modal this replaces.
 *
 * Copied verbatim from that precedent, because it is the rule that makes autosave safe:
 * **an explicit submit rejects an empty name; autosave must NOT, because the coach is mid-typing.**
 * A blank name simply does not save yet — nothing is discarded, and the strip says why.
 *
 * ⚠ **THE DRAFT IS SEEDED ONCE PER BILL, AND THE BILL IS THE ONLY THING THAT RESEEDS IT.**
 * Re-seeding from props would let a background refresh — and every write on this screen triggers
 * two — overwrite what the coach is typing.
 *
 * ⚠⚠ **THE CALLER USED TO KEY THIS COMPONENT BY BILL; IT MUST NOT, NOW THAT THIS IS A ROOM**
 * (Phase C). A key remounts the whole subtree — which now includes `RoomShell` — so every step of
 * the room's Prev/Next would tear the overlay down and rebuild it, firing the accessibility
 * floor's focus RESTORE on the way out: focus would land back on the list row behind the room and
 * scroll the Ledger to it, once per step of the walk. So the record changes underneath a mounted
 * draft, and the render-phase change guard below reseeds it — React's sanctioned
 * derive-from-prop pattern, the one the hub page and the money panel already use. It keys on the
 * BILL'S ID and on nothing else, which is what preserves the rule above.
 *
 * ⚠⚠ **AND EVERY WAY OUT FLUSHES A PENDING EDIT** (Phase C). On the page, the only exit was the
 * header's back LINK, and `UnsavedChangesGuard` intercepts links — so a keystroke inside the
 * ~0.9s debounce was safe. A room closes on ✕, on Escape, on the backdrop and on Prev/Next, none
 * of which is a navigation and none of which that guard can see. This component's whole promise is
 * that these fields save themselves, so leaving WRITES rather than asking; `leaveFor` below is the
 * one door every exit goes through.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** ~0.9s after the last keystroke, the same beat as the plan-template editor and the lineup builder. */
const SAVE_DEBOUNCE_MS = 900;
const SAVE_TIMEOUT_MS = 15_000;
/** How long after the last successful save the panel behind this page is re-read — see
 *  `scheduleRefresh`. Deliberately longer than the save debounce: it must land after the last save
 *  of a burst, not between two of them. */
const REFRESH_AFTER_MS = 1_200;

type SaveState = 'clean' | 'dirty' | 'saving' | 'saved';

interface Props {
  orgSlug: string;
  teamId: string;
  /** `/{orgSlug}/coaches/teams/{teamId}` — for the API and the back link. */
  expense: RepTeamExpense;
  standing: CommitmentStanding | undefined;
  canWrite: boolean;
  categories: BudgetCategoryWithItems[];
  /** The team's own + org-shared money tags, already loaded by the panel. */
  tagLibrary: RepTeamTag[];
  initialTagIds: string[];
  onCreateTag: (name: string) => Promise<RepTeamTag | null>;
  /**
   * The shell slots the PANEL owns — the four figures, the status chip, the Record door, the
   * History fold, the named walk, the busy gate and the sweep's `loaded` signal.
   *
   * ⚠ PASSED THROUGH RATHER THAN HOISTED, because the room's TITLE is this component's `name`
   * field and its foot holds this component's Delete and save strip. One of the two had to own the
   * shell; the one holding the draft is the one that cannot be split.
   */
  room: Omit<RoomShellProps, 'open' | 'ariaLabel' | 'title' | 'children' | 'footer' | 'fields' | 'sentinel' | 'recordKey' | 'facts' | 'factsTitle' | 'width'>;
  /**
   * A question raised by a control in the room's BODY — removing a recorded payment.
   *
   * ⚠⚠ IT REPLACES THE FOOT'S DOORS WHILE IT IS OPEN (owner, §134 walk 2026-09-03; plan §10): *a
   * question and the controls it suspends must occupy the same place.* A confirmation appended to
   * a scrolling body renders below the fold on a long schedule, so pressing Remove looks like it
   * did nothing — the exact defect the club request's Withdraw had. The foot is the one band that
   * is always visible.
   */
  footQuestion?: ReactNode;
  /**
   * A save was REFUSED after this room had already gone — raise it somewhere that outlives it.
   *
   * ⚠⚠ THE HOLE THIS CLOSES (`/review`, 2026-09-04). The room is unmounted outright when the coach
   * switches Money tab (the mount condition carries `tabActive`, as every room's does, so a hidden
   * panel cannot leave an Escape floor armed over another tab). The ROUTE guard only intercepts a
   * link while the draft is `dirty`, not while a save is in FLIGHT — correct, because interrupting
   * a coach for the ~200ms of an ordinary save would be worse than the thing it prevents. So a
   * rename the server refuses in that window used to land its sentence on a component that no
   * longer existed, and the coach was never told: the name simply never changed.
   * ⚠ On the page this replaced there was nothing to close — the bill's view was not gated on the
   * visible tab, so the refusal waited there for the coach to come back.
   */
  onRefusedAfterClose?: (message: string) => void;
  /** A save landed — the panel re-reads so the list behind this room agrees with it. */
  onSaved: () => void | Promise<void>;
  /** The bill is gone; the panel decides where the coach lands. */
  onDeleted: () => void;
  /** Is this panel the tab on screen? Only a visible page may hold the navigation guard. */
  tabActive: boolean;
  /**
   * Roster names, by player id — for the delete confirmation's "whose credit goes" sentence
   * (owner ruling 2026-08-27). Optional: without it the sentence degrades to "a family" and still
   * says the figure, which is the same fallback the money form uses when the roster has not loaded.
   * ⚠ A NAME, not a roster: this page renders values and must not gain a picker.
   */
  playerNameById?: Map<string, string>;
  /** The standing figure, the schedule and the payments — the panel's, unchanged by this phase. */
  children: ReactNode;
}

type Filing = { categoryId: string; categoryName: string; itemId: string | null; itemName: string } | null;

/** ⚠ THE ITEM'S NAME COMES FROM THE LIBRARY, because a saved cost stores ids and no item name. A
 *  word the coach creates in the picker is named by the picker's own `onChange` below — the same
 *  order the money form's `chosenItemName` uses, and for the same reason. */
function seedFiling(expense: RepTeamExpense, categories: BudgetCategoryWithItems[]): Filing {
  if (!expense.budgetItemId || !expense.budgetCategoryId) return null;
  const category = categories.find(c => c.id === expense.budgetCategoryId);
  return {
    categoryId: expense.budgetCategoryId,
    categoryName: category?.name ?? expense.category ?? '',
    itemId: expense.budgetItemId,
    itemName: (category?.items ?? []).find(i => i.id === expense.budgetItemId)?.name ?? '',
  };
}

/** "Category · Item" — ONE spelling of a filing's label, read by the room's identity line and by
 *  the value a read-only coach sees in Details. Two hand-rolled joins of the same two fields is
 *  how the separator drifts between the top of a room and the bottom of it (`/simplify`). */
function filingLabel(filing: Filing): string {
  return filing ? [filing.categoryName, filing.itemName].filter(Boolean).join(' · ') : '';
}

function seedPayee(expense: RepTeamExpense): PayeeSelection | null {
  return expense.payeePayer
    ? { payeeId: expense.payeeId, payeePayer: expense.payeePayer, displayName: expense.payeePayer }
    : null;
}

export default function CommitmentView({
  orgSlug, teamId, expense, standing, canWrite, categories, tagLibrary, initialTagIds, onCreateTag,
  room, footQuestion, onRefusedAfterClose, onSaved, onDeleted, tabActive, playerNameById, children,
}: Props) {
  /* ── The draft. Seeded once per BILL — see the docblock and the change guard below. ── */
  const [name, setName] = useState(expense.description);
  const [notes, setNotes] = useState(expense.notes ?? '');
  const [method, setMethod] = useState(expense.paymentMethod ?? '');
  const [payee, setPayee] = useState<PayeeSelection | null>(() => seedPayee(expense));
  const [tagIds, setTagIds] = useState<string[]>(initialTagIds);
  const [filing, setFiling] = useState<Filing>(() => seedFiling(expense, categories));

  const [state, setState] = useState<SaveState>('clean');
  const [saveError, setSaveError] = useState('');
  const [deleting, setDeleting] = useState(false);
  /** The belt to `deleting`'s braces — see `deleteCommitment` (`/review`, 2026-09-04). */
  const deletingRef = useRef(false);

  /**
   * ⚠⚠ THE ROOM STAYS MOUNTED WHILE THE RECORD CHANGES (Phase C) — Prev/Next swaps the bill under
   * this draft rather than remounting the overlay, so the draft has to follow it. Render-phase
   * adjustment on a change guard: React's own derive-from-prop pattern, and the one the hub page
   * and the money panel already use.
   *
   * ⚠ IT KEYS ON THE BILL'S ID AND NOTHING ELSE. Re-seeding from the props' VALUES would let a
   * background refresh overwrite what the coach is typing, and every write on this screen triggers
   * two. The outgoing bill's pending edit is written by `leaveFor`, which every exit goes through
   * — including the walk — so nothing arrives here unsaved.
   */
  const [seededFor, setSeededFor] = useState(expense.id);
  if (seededFor !== expense.id) {
    setSeededFor(expense.id);
    setName(expense.description);
    setNotes(expense.notes ?? '');
    setMethod(expense.paymentMethod ?? '');
    setPayee(seedPayee(expense));
    setTagIds(initialTagIds);
    setFiling(seedFiling(expense, categories));
    setState('clean');
    setSaveError('');
    setDeleting(false);
  }

  /* ⚠ THE SIGNATURE COVERS THE WHOLE EDITABLE SET, not just the text — retagging a bill and then
     closing the tab must be as safe as renaming it and closing the tab. (The plan-template
     editor's own note, and the defect it was written for.) */
  const sig = JSON.stringify({ name, notes, method, payee, tagIds, filing });
  const sigRef = useRef(sig);
  useEffect(() => { sigRef.current = sig; }, [sig]);
  /** The bill on screen RIGHT NOW, for a save that resolves after the walk has moved on. */
  const idRef = useLatestRef(expense.id);

  /**
   * ⚠⚠ **THE LIST BEHIND THIS ROOM IS RE-READ ONCE THE COACH STOPS, NOT ONCE PER FIELD.**
   *
   * `onSaved` is the panel's full refresh: it invalidates the money cache and re-reads the
   * expenses, the taxonomy, the budget plan and (on Payables) the club schedule. Calling it inline
   * after every save meant a coach who corrected a payee, a method and a note fired **three saves
   * and three whole-screen re-reads** in a few seconds — each one several requests — against a page
   * that was already re-rendering under them.
   *
   * It has to happen (the list must agree with the bill), but it does not have to happen per field.
   * One trailing refresh, ~1.2s after the last successful save, collapses a burst of edits into a
   * single re-read. ⚠ Longer than the save debounce on purpose: the point is to land AFTER the last
   * save of a burst, not between two of them.
   *
   * ⚠⚠ ON UNMOUNT IT IS FIRED, NOT DROPPED — and that reversed with the room (Phase C). It used to
   * be cleared, on the sound reasoning that this was a PAGE: the coach had navigated away, and
   * nothing was left on screen waiting for the answer. A room closes over a list that is still
   * mounted and still showing the bill's row, so dropping the re-read leaves that row disagreeing
   * with the save the coach just made — the one thing `onSaved` exists to prevent.
   */
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSavedRef = useRef(onSaved);
  useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);
  const onRefusedRef = useLatestRef(onRefusedAfterClose);
  /** Is this component still on screen? A flush fired on the way out resolves after it is not. */
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
      void onSavedRef.current();
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    /* The room has already closed — the trailing collapse has nothing left to collapse, and the
       list behind it is showing a stale row right now. */
    if (!mounted.current) { void onSavedRef.current(); return; }
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      void onSavedRef.current();
    }, REFRESH_AFTER_MS);
  }, []);

  /** @returns whether the edit is now on the server — `leaveFor` will not leave on a `false`. */
  const save = useCallback(async (): Promise<boolean> => {
    if (!canWrite) return true;
    /* ⚠⚠ AUTOSAVE DOES NOT REJECT AN EMPTY NAME — the coach is mid-word. It simply does not save
       yet; nothing typed is discarded and the strip says why. An explicit submit would refuse. */
    if (!name.trim()) {
      setSaveError('Give this bill a name to save it.');
      return false;
    }
    const sigAtSave = sigRef.current;
    /* ⚠ WHICH BILL THIS SAVE IS FOR. A flush fired by Prev/Next lands after the room has already
       swapped to the next record, and settling then would stamp "Saved ✓" on a draft this write
       never carried. Same rule as `sigAtSave`, one level up: only settle what you actually sent. */
    const idAtSave = expense.id;
    setState('saving');
    setSaveError('');
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), SAVE_TIMEOUT_MS);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        /* ⚠⚠ NO `installments` KEY, EVER. Omitting it is what keeps this save off the schedule:
           the route touches a commitment's plan only when one is sent, so the six fields below
           cannot disturb a single dated piece or a single recorded payment. The shape is otherwise
           the money form's own `common` object — one set of keys for the record's own fields,
           whichever door writes them. */
        body: JSON.stringify({
          description: name.trim(),
          category: filing?.categoryName?.trim() || null,
          budgetItemId: filing?.itemId || null,
          notes: notes.trim() || null,
          paymentMethod: method.trim() || null,
          payeeId: payee?.payeeId ?? null,
          payeePayer: payee?.displayName ?? null,
          tagIds,
        }),
        signal: abort.signal,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save this bill.');
      await res.json().catch(() => ({}));
      /* Only settle if nothing changed while the request was in flight, and only on the bill this
         write was for — otherwise the coach's later keystrokes, or the next bill in the walk,
         would be marked saved by an earlier save that never carried them. */
      if (idRef.current === idAtSave && sigRef.current === sigAtSave) setState('saved');
      scheduleRefresh();
      return true;
    } catch (e: unknown) {
      const message = e instanceof DOMException && e.name === 'AbortError'
        ? 'Saving is taking too long — check your connection.'
        : e instanceof Error ? e.message : 'Could not save this bill.';
      /* ⚠ A REFUSAL BELONGS TO THE BILL THAT EARNED IT. Raising it over the NEXT bill would name a
         field that is no longer on screen and halt an autosave loop that never failed.
         ⚠ THE NARROW LOSS THIS ACCEPTS, STATED RATHER THAN HIDDEN: the walk AWAITS a pending edit
         (`leaveFor`) precisely so a refusal is read before the record changes, so the only way to
         reach this branch is a debounced autosave still in flight when the coach steps to the next
         bill — and only a REFUSED one, which on this route means an ambiguous pre-mig-236 ledger
         match on a rename. That edit is gone. Widening it would mean holding a second bill's
         refusal over the bill on screen, which is worse. */
      if (idRef.current !== idAtSave) return false;
      /* ⚠⚠ AND IF THE ROOM HAS GONE, THE REFUSAL GOES SOMEWHERE THAT HAS NOT (`/review`,
         2026-09-04). Switching Money tab unmounts this room outright, and the route guard does not
         intercept a link while a save is merely IN FLIGHT — so a refused rename used to set state
         on a component that no longer existed and the coach was simply never told. The panel is
         still mounted; it raises the sentence above the book. */
      if (!mounted.current) { onRefusedRef.current?.(`${expense.description}: ${message}`); return false; }
      setSaveError(message);
      setState('dirty');
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }, [canWrite, name, notes, method, payee, tagIds, filing, orgSlug, teamId, expense.id, scheduleRefresh]);

  /* Autosave ~0.9s after the last change, and STOP after a failure rather than retrying for ever —
     the same posture, and the same reasoning, as the plan-template editor and the practice plan.
     ⚠ A REFUSAL IS A SENTENCE THE COACH HAS TO ACT ON (an ambiguous ledger match on a rename), so
     the loop halts on `saveError` and the strip offers Retry. */
  useEffect(() => {
    if (state !== 'dirty' || saveError || !canWrite) return;
    const t = setTimeout(() => { void save(); }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [state, saveError, canWrite, sig, save]);

  /** Every setter goes through this: one place that marks the room dirty and clears a stale refusal. */
  function touch<T>(set: (v: T) => void) {
    return (v: T) => { set(v); setState('dirty'); setSaveError(''); };
  }

  /**
   * ⚖⚖ EVERY WAY OUT OF THIS ROOM WRITES FIRST (Phase C) — the ✕, Escape, the backdrop and both
   * arrows of the walk.
   *
   * On the page this replaced, the only exit was a LINK, and `UnsavedChangesGuard` intercepts
   * links; none of a room's exits is a navigation, so without this a keystroke inside the ~0.9s
   * autosave debounce would simply be discarded by the closing overlay. This component's promise
   * is that its fields save themselves, so leaving SAVES rather than asking — asking would be the
   * wrong question ("discard?" — nothing was ever going to be discarded).
   *
   * ⚠⚠ AND IT WAITS FOR THE VERDICT, WHICH IS THE POINT. The name is the one field the server can
   * refuse (an ambiguous ledger match on a rename), and the refusal is a sentence a coach has to
   * ACT on. Leaving optimistically would close the room over it. Refused, the room stays open with
   * the reason in the strip and the walk does not move.
   */
  const leaving = useRef(false);
  const leaveFor = useCallback(async (go: () => void) => {
    if (leaving.current) return;
    /* Nothing pending, or already in flight (the shell's busy gate holds the door meanwhile) —
       either way there is nothing to wait for.
       ⚠⚠ A STANDING REFUSAL IS RETRIED, NOT WAVED THROUGH (`/review`, 2026-09-04). This read
       `&& !saveError`, which made the promise above true only ONCE: the first exit attempt blocked
       and showed the reason, and the second — the coach pressing ✕ again, which is exactly what
       someone does when a window will not close — sailed past with the edit still unsaved and
       nothing said. The refusal is a reason to try again, not a reason to stop trying: the strip's
       own Retry does the same thing, and if the server refuses a second time the room stays put
       with the sentence still on screen. */
    if (canWrite && state === 'dirty') {
      leaving.current = true;
      try {
        setSaveError('');
        if (!await save()) return;
      } finally {
        leaving.current = false;
      }
    }
    go();
  }, [canWrite, state, save]);

  async function deleteCommitment() {
    /* ⚠ A REF LATCH BESIDE THE STATE FLAG (`/review`, 2026-09-04) — the belt the money panel's own
       writers wear, for the reason they state: a second click lands before React commits
       `disabled`, and a second DELETE 404s, showing a failure after a success. */
    if (deletingRef.current || deleting) return;
    deletingRef.current = true;
    setDeleting(true);
    setSaveError('');
    /* ⚠ THE SAME CEILING `save()` CARRIES, and now for a second reason (`/review`, 2026-09-04):
       `deleting` feeds the room's busy gate, so a request that never resolves would leave every
       exit — Escape, the ✕, the backdrop, the walk — refusing, with no cancel on screen. */
    const abort = new AbortController();
    const ceiling = setTimeout(() => abort.abort(), SAVE_TIMEOUT_MS);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expenses/${expense.id}`, {
        method: 'DELETE', signal: abort.signal,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not delete this bill.');
      onDeleted();
    } catch (e: unknown) {
      setSaveError(
        e instanceof DOMException && e.name === 'AbortError'
          ? 'That took too long — check your connection and try again.'
          : e instanceof Error ? e.message : 'Could not delete this bill.',
      );
      deletingRef.current = false;
      setDeleting(false);
    } finally {
      clearTimeout(ceiling);
    }
  }

  /* ⚰ THE SECOND `fmt` STOOD HERE AND IS DELETED (Phase C). It dressed the "Still owing" band this
     component used to draw; the room's four tiles are the panel's, formatted by the panel's own
     `fmt`, so there is one spelling of a dollar figure in this room again. `money` below is the
     DELETE confirmation's, and it is deliberately a different shape (no thousands separator) —
     word for word what the money form's own Delete says, so one fact reads one way on both doors. */

  /* ⚠ THE SAME PREVIEW THE SERVER REVERSES WITH, so the sentence and the outcome cannot drift —
     the rule the modal's Delete already followed, carried down the page with the control.

     ⚖⚖ THE "no family paid this" NOTE THAT STOOD HERE IS GONE — money centralization P4 (mig 267)
     made its invariant false, and it is worth recording what it said: *"this page only ever shows a
     COMMITMENT, and a commitment can never be paid out of pocket… `owesFamily` is therefore always
     false here, and a branch would be dead code."* True until a family could front ONE PAYMENT of a
     bill the team otherwise pays — which is the whole of P4. Reading `reversal.amount` alone then
     told a coach deleting a bill whose only paid piece was fronted that *"nothing has been paid
     against it, so no money moves"*, while a household's credit was about to vanish by cascade
     unmentioned. Found by `/simplify`'s altitude lens: a hand-copied UI branch left behind when the
     shared function underneath it was generalized. */
  const reversal = ledgerReversalPreview(standing, expense.paidByPlayerId);
  const money = (n: number) => `$${n.toFixed(2)}`;

  /**
   * ⚖⚖ THE BILL'S IDENTITY, ON THE DOORS' ROW (owner, 2026-09-06, ruled with the running order).
   *
   * The shell reserves the left of that row for a record's quiet facts — a sponsor's note, a
   * drive's participation fraction — and a bill was the one room that never filled it, so the band
   * above its schedule held a single right-aligned button and a lot of nothing. It matters more now
   * that `fields` sits at the FOOT of the room: without this line, opening a bill shows its name,
   * four figures and a schedule, and says nothing about what the bill actually is until the coach
   * scrolls past the History fold. A glance is answered here; a change is still made down there.
   *
   * ⚠⚠ BUILT FROM THE DRAFT, NEVER FROM THE PROP. These three facts are live controls forty rows
   * below, and the panel's copy of the bill is only re-read ~1.2s after a save lands — sourcing the
   * summary from `expense` would leave the top of the room stating an old payee while the coach
   * looks at the new one they just typed. The title field is already drawn from the draft for the
   * same reason.
   *
   * ⚠ NOTHING IS INVENTED FOR AN EMPTY BILL. A brand-new bill with no filing, payee or method
   * summarises to nothing and the row keeps its old shape — a summary of nothing is noise, and the
   * "every row is drawn" rule below is about the FIELDS block, which still draws all five.
   */
  const identity = [
    filingLabel(filing),
    payee?.displayName ?? '',
    method,
  ].map(part => part.trim()).filter(Boolean).join(' · ');

  return (
    <>
      {/* ⚠ THE GUARD FOLLOWS THE VISIBLE TAB. A room under a hidden tab must not intercept clicks
          on the tab the coach is actually looking at — the money panel's own rule, and the reason
          `tabActive` exists at all.
          ⚠ IT IS THE RELOAD/LINK BELT ONLY. Every exit the ROOM itself offers goes through
          `leaveFor`, which writes rather than asks; this catches the ways out that leave the app. */}
      <UnsavedChangesGuard active={canWrite && state !== 'clean' && state !== 'saved'} interceptClicks={tabActive && state === 'dirty'} />

      <RoomShell
        {...room}
        open
        sentinel="bill"
        onClose={() => { void leaveFor(room.onClose); }}
        /* Every arrow of the walk writes a pending edit first, exactly as the ✕ does — the walk is
           the other way the record changes under a draft. */
        nav={room.nav ? { ...room.nav, onSelect: id => { void leaveFor(() => room.nav!.onSelect(id)); } } : undefined}
        /* ⚠ THE SAVE JOINS THE BUSY GATE. A refusal on the name is a sentence the coach has to
           read, and a room dismissed mid-request would close over it. */
        busy={room.busy || deleting || state === 'saving'}
        /* ⚠ NOT REMOUNTED BY THE WALK (see the docblock) — so the floor needs telling when the
           record changes, or focus stays on a control that went with the last bill. */
        recordKey={expense.id}
        /* The one-line summary of the fields at the foot of the room — see `identity` above. The
           shell clamps it to a line and owes the full text to whoever wrote it, hence the title. */
        facts={identity || undefined}
        factsTitle={identity || undefined}
        ariaLabel={`${expense.description || 'Untitled bill'} — bill`}
        title={canWrite ? (
          /* ⚠⚠ IT HAS TO LOOK LIKE A FIELD (owner, §114 walk 2026-08-27: *"why can't we edit the
             title?"*). It WAS editable — and invisible, because it was styled to look exactly like
             the heading it replaced with an underline that appeared only on hover. A control a
             coach cannot see is a control they do not have, and on a touch screen there is no hover
             at all, so the affordance never arrived. It now carries its dashed rule at REST and a
             pencil beside it, which is what the mockup drew.
             ⚠ THE WRAPPER IS NOT DECORATION: the shell's title row is a flex row, so a bare
             `width: 100%` input resolved against a shrink-to-fit line and sized itself to roughly
             twenty characters — a long bill name would have scrolled inside a box nobody knew was
             there. */
          <span className={styles.commitTitleField}>
            {/* ⚖⚖ THE TITLE IS THE NAME FIELD (Part B), AND IT TAKES NO REQUIRED MARKER (Phase C —
                the 2026-09-03 title-slot ruling). Rendering the name a second time under a "Name"
                label would print the same words twice in one room; an input in the title slot is
                the same "everything readable is editable" rule applied to the one readable thing
                that is not in the fields block. `title` takes a ReactNode precisely so a consumer
                can do this. Read-only coaches get the plain heading text. */}
            <input
              className={styles.commitTitleInput}
              value={name}
              onChange={e => touch(setName)(e.target.value)}
              aria-label="Bill name"
              placeholder="Name this bill"
              maxLength={200}
            />
            <Pencil size={13} aria-hidden className={styles.commitTitlePencil} />
          </span>
        ) : expense.description}
        footer={
          /* ⚖⚖ THE QUESTION OWNS THE BAND WHILE IT IS OPEN (owner, §134 walk; plan §10). A
              confirmation and the controls it suspends must occupy the same place — so a payment's
              Remove, raised on a row that may be far down a long schedule, replaces these doors
              rather than appearing under them where the coach would have to go looking. Nothing is
              disabled, because nothing competing is rendered. */
          footQuestion ?? (canWrite ? (
            <>
              {/* ⚖ ONE DELETE, GUARDED, AT THE FOOT — the shared control every room's foot carries
                  (Phase B). `refusal` is null: a bill is always deletable, and what deletion COSTS
                  is what the confirmation names. ⚠⚠ IT NAMES DOLLARS, never a bare "Are you sure?":
                  deleting a bill money has landed on reverses what it posted, and a coach must be
                  told the size of that before they can consent. `ledgerReversalPreview` is the SAME
                  function the server reverses with, so the sentence and the outcome cannot drift. */}
              <GuardedDelete
                label="Delete this bill"
                refusal={null}
                confirmTitle={`Delete “${expense.description}”?`}
                /* ⚖ "Delete and reverse" WHEN MONEY MOVES (restored, `/review` 2026-09-04). The
                   distinction was lost when this foot adopted the shared control, which hard-coded
                   "Delete": pressing it on a bill money has landed on reverses cash as well as
                   removing a record, and the button should say the bigger of the two things. */
                confirmLabel={reversal.amount > 0 ? 'Delete and reverse' : 'Delete'}
                confirmBody={<>
                  {/* ⚠ SEPARATE PARAGRAPHS, restored with them (`/review`). The cash sentence and
                      the family's-credit sentence are two different consequences; run together in
                      one block they read as one hedged clause. */}
                  {reversal.amount > 0 && (
                    <p className={styles.dangerConfirmBody}>This has already posted <strong>{money(reversal.amount)}</strong> out of the team’s
                    books{reversal.legs > 1 ? ` across ${reversal.legs} payments` : ''}. Deleting it will
                    reverse that, so cash on hand goes back up by {money(reversal.amount)}.</p>
                  )}
                  {reversal.amount === 0 && !reversal.owesFamily && <p className={styles.dangerConfirmBody}>Nothing has been paid against it, so no money moves.</p>}
                  {/* ⚠⚠ THE HOUSEHOLD IS SAID SEPARATELY, NEVER FOLDED INTO A DOLLAR FIGURE (P4). A
                      fronted payment moved no team cash, so it contributes nothing to the amount
                      coming back — but the credit it created disappears by cascade, and that is a
                      change to what a family is owed. Word for word the sentence the modal's own
                      Delete gives, so one fact has one phrasing on both doors. */}
                  {reversal.owesFamily && (
                    <p className={styles.dangerConfirmBody}>
                      <strong>The credit the team owes will be removed too:</strong>{' '}
                      {reversal.owedByFamily.map((o, at) => {
                        const who = playerNameById?.get(o.playerId) ?? '';
                        return (
                          <Fragment key={o.playerId}>
                            {at > 0 ? ', ' : ''}
                            {who ? <>{who}’s family</> : <>a family</>} <strong>{money(o.amount)}</strong>
                          </Fragment>
                        );
                      })}
                      {reversal.amount === 0 ? '. No team cash moves.' : '.'}
                    </p>
                  )}
                </>}
                deleting={deleting}
                onDelete={() => { void deleteCommitment(); }}
              />
              {/* ── The save strip, ON THE DOORS' ROW ──────────────────────────────────────────
                  ⚖ IT HAD A ROW OF ITS OWN AND DID NOT EARN ONE (owner, §114 walk 2026-08-27).
                  Delete sits left, the status beside it, on the one band that closes the room and
                  never scrolls away — the same pairing the plan-template editor's docked footer
                  uses, and the reason it is here rather than beside a field: the schedule above may
                  grow to a dozen rows, and ONE strip serves all six fields.
                  ⚠ IT STANDS DOWN WHILE ANY QUESTION OWNS THE BAND (`RoomShell.module.css`) — a
                  coach being asked about dollars should not be reading a save status at the same
                  time. `aria-live` only announces what is rendered, so nothing is lost. */}
              <span className={styles.saveStatus} aria-live="polite">
                {saveError
                  ? <button type="button" className={styles.saveRetry} onClick={() => { setSaveError(''); void save(); }}>
                      {saveError} · Retry
                    </button>
                  : state === 'saving' ? 'Saving…'
                    : state === 'dirty' ? 'Unsaved changes'
                      : state === 'saved' ? <><Check size={13} aria-hidden /> Saved</>
                        : null}
              </span>
            </>
          ) : undefined)
        }
        /* ⚖⚖ WHAT THE BILL IS, BELOW WHAT ACTUALLY HAPPENED (the running-order ruling, owner
           2026-09-06). This block used to sit in the room's BODY, between the schedule and the
           History fold — see the note beside `{children}` below, and RoomShell's anatomy. */
        fields={<>
      {/* ── What the bill IS ──────────────────────────────────────────────────────────────────
          ⚠⚠ EVERY ROW IS DRAWN, SET OR NOT, and that is a fix rather than a layout preference. An
          unset field used to be omitted entirely, so a coach could not tell a bill HAS no note from
          the product not offering one. An empty field is an invitation now — "Add a note".
          ⚠ READ-ONLY MONEY COACHES SEE VALUES, NEVER CONTROLS. This block is the only place in the
          product an assistant can read a bill's payee or its tags; the values stay, the editors do
          not appear.
          ⚠ IT WEARS THE SCHEDULE'S OWN SECTION LABEL (Phase C, the mockup's two `seclab`s). On the
          page a header and a standing figure separated these blocks; in the room nothing but a
          section name separates one block from the next, so the block that has a name gets a
          matching one rather than a rule of its own. ⚠ The clause this used to carry — "the
          schedule ends and the fields begin with nothing between them" — stopped being true on
          2026-09-06: the History fold sits between them now (see `fields` on the shell above). */}
      <p className={styles.payDrawerLabel}>Details</p>
      <dl className={styles.commitFields}>
        <dt>Filing</dt>
        <dd>
          {canWrite ? (
            <BudgetItemPicker
              categories={categories}
              value={filing ? { ...filing, suggestedAmount: null } : null}
              /* A commitment is always money out — a scheduled arrival is a budget line, not a
                 bill, so this picker never has a direction to ask about. */
              direction="out"
              teamId={teamId}
              createItemEndpoint={`/api/coaches/${orgSlug}/budget-items`}
              createItemMode="coach"
              allowCreateCategory
              /* ⚖ THE UNIFIED PAPER GROUND (mockup R2, owner-flagged 2026-09-02). The bill's
                 CREATION form unified all its fields on one ground on 2026-08-29 and this control
                 opted in there; the record view was simply never given the same prop, so one
                 picker wore two sets of clothes on two screens for the same bill. */
              paperGround
              manageHint="Rename or remove it later from Budget Plan → Manage our words — but it stays on this side."
              onChange={v => touch(setFiling)({
                categoryId: v.categoryId, categoryName: v.categoryName,
                itemId: v.itemId, itemName: v.itemName,
              })}
            />
          ) : (
            <span>{filingLabel(filing) || <span className={styles.commitEmpty}>Not filed</span>}</span>
          )}
        </dd>

        <dt>Payee</dt>
        <dd>
          {canWrite ? (
            <PayeeCombobox
              payeesApiUrl={`/api/coaches/${orgSlug}/teams/${teamId}/payees`}
              value={payee}
              onChange={touch(setPayee)}
              placeholder="Add who this is paid to"
              saveScope="team"
            />
          ) : (
            <span>{payee?.displayName || <span className={styles.commitEmpty}>No payee</span>}</span>
          )}
        </dd>

        <dt>Tags</dt>
        <dd>
          {canWrite ? (
            <TagSearchCombobox
              library={tagLibrary}
              selectedIds={tagIds}
              onChange={touch(setTagIds)}
              onCreate={onCreateTag}
              placeholder="Add a money tag…"
              manage={{ ...MONEY_TAG_MANAGE, teamId, basePath: `/api/coaches/${orgSlug}/teams/${teamId}/expense-tags` }}
              onManageChanged={() => { void onSaved(); }}
              /* ⚰⚰ THE `＋` REVEAL IS GONE, AND IT IS A NAMED REVERSAL (mockup R1; owner-flagged
                 2026-09-02, reversing the §114 walk tweak of 2026-08-27). That tweak hid the search
                 box behind a `＋` chip to save a row in "a block a coach is mostly READING" — sound
                 when this was a page whose fields sat above everything else. It was also the ONLY
                 use of that shape in the entire product: one field, on one screen, behaving unlike
                 every other tag picker a coach meets. The prop and the chip were deleted outright
                 rather than left unused, so there is nothing for a future surface to opt into. */
            />
          ) : tagIds.length > 0 ? (
            <div className={styles.commitReadTags}>
              {tagIds.map(id => {
                const tag = tagLibrary.find(t => t.id === id);
                if (!tag) return null;
                return (
                  <span key={id} className={`${styles.moneyTagChip} ${tag.teamId === null ? styles.moneyTagChipOrg : ''}`}>
                    {tag.name}
                  </span>
                );
              })}
            </div>
          ) : <span className={styles.commitEmpty}>No tags</span>}
        </dd>

        <dt>How</dt>
        <dd>
          {canWrite ? (
            <PaymentMethodCombobox
              methodsApiUrl={`/api/coaches/${orgSlug}/teams/${teamId}/payment-methods`}
              value={method}
              onChange={touch(setMethod)}
              placeholder="Add how it’s paid"
            />
          ) : (
            <span>{method || <span className={styles.commitEmpty}>Not recorded</span>}</span>
          )}
        </dd>

        <dt>Notes</dt>
        <dd>
          {canWrite ? (
            <textarea
              className={styles.textarea}
              rows={2}
              value={notes}
              placeholder="Add a note"
              onChange={e => touch(setNotes)(e.target.value)}
              aria-label="Notes"
            />
          ) : (
            <span>{notes || <span className={styles.commitEmpty}>No note</span>}</span>
          )}
        </dd>
      </dl>
        </>}
      >
      {/* ⚖⚖ THE SCHEDULE IS THE ROOM'S BODY, AND NOW THE WHOLE OF IT (the running-order ruling,
          owner 2026-09-06 — see `fields` above and RoomShell's anatomy note). Phase C had already
          moved the fields off the top of the page and under the schedule; what it could not do was
          get them past HISTORY, which the shell pins after the body. So the room read plan →
          identity → actual, with the least-visited block in it standing between the two that are
          one conversation: the schedule says "$540.00 still owing" on a $1,000 piece, and the
          payment that explains it was five form rows and a fold away. */}
      {children}
      </RoomShell>
    </>
  );
}
