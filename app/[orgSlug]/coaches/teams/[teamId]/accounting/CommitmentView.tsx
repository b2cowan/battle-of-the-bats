'use client';
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Pencil, Receipt, Trash2 } from 'lucide-react';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import BudgetItemPicker from '@/components/accounting/BudgetItemPicker';
import PayeeCombobox, { type PayeeSelection } from '@/components/accounting/PayeeCombobox';
import PaymentMethodCombobox from '@/components/accounting/PaymentMethodCombobox';
import TagSearchCombobox from '@/components/coaches/TagSearchCombobox';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import type { BudgetCategoryWithItems, RepTeamExpense, RepTeamTag } from '@/lib/types';
import type { CommitmentStanding } from '@/lib/payable-standing';
import { ledgerReversalPreview } from '@/lib/expense-ledger';
import styles from '../../../coaches.module.css';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **ONE COMMITMENT, AND THE PAGE EDITS ITSELF** (Payables Rebuild — Part B, owner approval
 * 2026-08-26, from the drawn options at `claude.ai/code/artifact/9c42dd82-39f1-4b12-8957-a5f43b2594de`).
 *
 * Part A closed the duplicate doors on this screen. B answers the question underneath them: *if
 * this is a screen, why does it open a window to change what it is already showing?* Six fields —
 * the bill's name, its filing, payee, tags, how it is paid and the note — are rendered as live
 * controls here and save themselves. `Edit details` is gone from the header, which now carries
 * only the way back.
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
 * ⚠ **THE DRAFT IS SEEDED ONCE, AND THE CALLER KEYS THIS COMPONENT BY BILL.** Re-seeding from props
 * would let a background refresh — and every write on this screen triggers two — overwrite what the
 * coach is typing. `key={expense.id}` at the call site is what moves the page between bills.
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
  /** Where the in-header arrow goes, and what it is called. See the panel's `backTo` note. */
  backTo: { href: string; label: string };
  /** A save landed — the panel re-reads so the list behind this page agrees with it. */
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

export default function CommitmentView({
  orgSlug, teamId, expense, standing, canWrite, categories,
  tagLibrary, initialTagIds, onCreateTag, backTo, onSaved, onDeleted, tabActive, playerNameById, children,
}: Props) {
  /* ── The draft. Seeded ONCE — see the docblock; the caller keys this component by bill. ── */
  const [name, setName] = useState(expense.description);
  const [notes, setNotes] = useState(expense.notes ?? '');
  const [method, setMethod] = useState(expense.paymentMethod ?? '');
  const [payee, setPayee] = useState<PayeeSelection | null>(
    expense.payeePayer
      ? { payeeId: expense.payeeId, payeePayer: expense.payeePayer, displayName: expense.payeePayer }
      : null,
  );
  const [tagIds, setTagIds] = useState<string[]>(initialTagIds);
  const [filing, setFiling] = useState<{ categoryId: string; categoryName: string; itemId: string | null; itemName: string } | null>(
    /* ⚠ THE NAME COMES FROM THE LIBRARY, because a saved cost stores ids and no item name. A word
       the coach creates in the picker is named by the picker's own `onChange` below — the same
       order the money form's `chosenItemName` uses, and for the same reason. */
    expense.budgetItemId && expense.budgetCategoryId
      ? {
          categoryId: expense.budgetCategoryId,
          categoryName: categories.find(c => c.id === expense.budgetCategoryId)?.name ?? expense.category ?? '',
          itemId: expense.budgetItemId,
          itemName: (categories.find(c => c.id === expense.budgetCategoryId)?.items ?? [])
            .find(i => i.id === expense.budgetItemId)?.name ?? '',
        }
      : null,
  );

  const [state, setState] = useState<SaveState>('clean');
  const [saveError, setSaveError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* ⚠ THE SIGNATURE COVERS THE WHOLE EDITABLE SET, not just the text — retagging a bill and then
     closing the tab must be as safe as renaming it and closing the tab. (The plan-template
     editor's own note, and the defect it was written for.) */
  const sig = JSON.stringify({ name, notes, method, payee, tagIds, filing });
  const sigRef = useRef(sig);
  useEffect(() => { sigRef.current = sig; }, [sig]);

  /**
   * ⚠⚠ **THE LIST BEHIND THIS PAGE IS RE-READ ONCE THE COACH STOPS, NOT ONCE PER FIELD.**
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
   * ⚠ CLEARED ON UNMOUNT — a refresh firing into a page the coach has left is a request nobody is
   * waiting for, and on this screen it would land on a panel that has moved to another bill.
   */
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSavedRef = useRef(onSaved);
  useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);
  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      void onSavedRef.current();
    }, REFRESH_AFTER_MS);
  }, []);

  const save = useCallback(async () => {
    if (!canWrite) return;
    /* ⚠⚠ AUTOSAVE DOES NOT REJECT AN EMPTY NAME — the coach is mid-word. It simply does not save
       yet; nothing typed is discarded and the strip says why. An explicit submit would refuse. */
    if (!name.trim()) {
      setSaveError('Give this bill a name to save it.');
      return;
    }
    const sigAtSave = sigRef.current;
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
      /* Only settle if nothing changed while the request was in flight — otherwise the coach's
         later keystrokes would be marked saved by an earlier save that never carried them. */
      if (sigRef.current === sigAtSave) setState('saved');
      scheduleRefresh();
    } catch (e: unknown) {
      setSaveError(
        e instanceof DOMException && e.name === 'AbortError'
          ? 'Saving is taking too long — check your connection.'
          : e instanceof Error ? e.message : 'Could not save this bill.',
      );
      setState('dirty');
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

  /** Every setter goes through this: one place that marks the page dirty and clears a stale refusal. */
  function touch<T>(set: (v: T) => void) {
    return (v: T) => { set(v); setState('dirty'); setSaveError(''); };
  }

  async function deleteCommitment() {
    if (deleting) return;
    setDeleting(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/expenses/${expense.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not delete this bill.');
      onDeleted();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Could not delete this bill.');
      setConfirmDelete(false);
      setDeleting(false);
    }
  }

  /* ⚠ ONE FORMATTER, and it is the panel's — a second spelling of a dollar figure on the same page
     is how "$1,550.00" and "$1550.00" end up one above the other. */
  const fmt = (n: number) =>
    `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

  return (
    <>
      {/* ⚠ THE GUARD FOLLOWS THE VISIBLE TAB. A page under a hidden tab must not intercept clicks
          on the tab the coach is actually looking at — the money panel's own rule, and the reason
          `tabActive` exists at all. */}
      <UnsavedChangesGuard active={canWrite && state !== 'clean' && state !== 'saved'} interceptClicks={tabActive && state === 'dirty'} />

      <CoachPageHeader
        /* ⚠ NESTED — this sits under the Money hub's own header, exactly as one fundraiser does.
           A second `standard` header would print two page names and two "?"s. */
        variant="nested"
        icon={Receipt}
        title={canWrite ? (
          /* ⚠⚠ IT HAS TO LOOK LIKE A FIELD (owner, §114 walk 2026-08-27: *"why can't we edit the
             title?"*). It WAS editable — and invisible, because it was styled to look exactly like
             the heading it replaced with an underline that appeared only on hover. A control a
             coach cannot see is a control they do not have, and on a touch screen there is no hover
             at all, so the affordance never arrived. It now carries its dashed rule at REST and a
             pencil beside it, which is what the mockup drew.
             ⚠ THE WRAPPER IS NOT DECORATION: `.pageTitle` is a flex row, so a bare `width: 100%`
             input resolved against a shrink-to-fit line and sized itself to roughly twenty
             characters — a long bill name would have scrolled inside a box nobody knew was there. */
          <span className={styles.commitTitleField}>
            {/* ⚖⚖ THE TITLE IS THE NAME FIELD (Part B). Rendering the name a second time under a
                "Name" label would print the same words twice on one screen; an input in the title
                slot is the same "everything readable is editable" rule applied to the one readable
                thing that is not in the fields block. `title` takes a ReactNode precisely so a page
                can do this. Read-only coaches get the plain h2 text below. */}
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
        /* The in-header back affordance. ⚠ IT NAMES WHERE IT RETURNS TO, AND RETURNS THERE (owner
           ruling 2026-08-26, Part B call 3): once the Transactions register can send a coach here,
           a link that always said "Payables" would quietly move them to a tab they were not on. */
        backTo={backTo}
        /* ⚖⚖ NO ACTIONS AT ALL, and that is the phase (owner ruling 2026-08-26). `Edit details` was
           the last one: it opened a window onto the six fields this page now renders in place. The
           other two moved in Part A — Record to the rows that name a payment, `Add an installment`
           under the schedule it adds to. The header carries the way back and nothing else. */
      />

      {/* ⚖⚖ THE ANSWER FIRST, ABOVE THE FIELDS — and this is a CORRECTION of Part B's first build
          (caught 2026-08-27 comparing the built page against its own mockup).

          B put the six editable fields between the title and this figure, which quietly reversed the
          owner's correction of 2026-08-26: the read-only facts block had been LAST, was moved up,
          and the ruling was that it must not push `Still owing` and the schedule — *what the page is
          FOR* — down the screen. B made that worse rather than repeating it: the block grew from
          three optional rows into five permanent ones carrying two comboboxes and a textarea, so the
          one figure a coach opens a bill to read had a whole form stacked on top of it.

          ⚠ IT LIVES HERE, NOT IN THE PANEL'S `children`, because that is the only way it can sit
          above fields this component owns. The schedule and the payments stay the panel's.

          ⚠ RENDERED ONLY WITH A STANDING. Without one the figure would read $0.00 while the real
          one is still loading — a wrong number is worse than a missing one on the line that says
          what the team owes. */}
      {standing && (
        <div className={`${styles.payDrawerTotal} ${styles.commitStanding}`}>
          <span>{standing.over > 0 ? 'Paid over the total' : 'Still owing'}</span>
          <strong>{fmt(standing.over > 0 ? standing.over : standing.remaining)}</strong>
        </div>
      )}

      {/* ── What the bill IS ──────────────────────────────────────────────────────────────────
          ⚠⚠ EVERY ROW IS DRAWN, SET OR NOT, and that is a fix rather than a layout preference. An
          unset field used to be omitted entirely, so a coach could not tell a bill HAS no note from
          the product not offering one. An empty field is an invitation now — "Add a note".
          ⚠ READ-ONLY MONEY COACHES SEE VALUES, NEVER CONTROLS. This block is the only place in the
          product an assistant can read a bill's payee or its tags; the values stay, the editors do
          not appear. */}
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
              manageHint="Rename or remove it later from Budget Plan → Manage our items — but it stays on this side."
              onChange={v => touch(setFiling)({
                categoryId: v.categoryId, categoryName: v.categoryName,
                itemId: v.itemId, itemName: v.itemName,
              })}
            />
          ) : (
            <span>{[filing?.categoryName, filing?.itemName].filter(Boolean).join(' · ') || <span className={styles.commitEmpty}>Not filed</span>}</span>
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
              /* ⚖ THE `＋` SHAPE (owner, §114 walk 2026-08-27). Every other field here is one row;
                 the tag picker was two — chips, then a permanent empty search box under them —
                 which is right in a form and wrong in a block a coach is mostly READING. The box
                 comes back from the chip the moment it is wanted. */
              addAsChip
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

      {/* The standing figure, the schedule and the payments — the panel's own, unchanged. */}
      {children}

      {/* ── Delete, at the foot of the page ───────────────────────────────────────────────────
          ⚖ IT MOVED OUT OF THE FORM'S FOOTER (owner ruling 2026-08-26) and lost nothing on the way
          down. ⚠⚠ THE DIALOG NAMES DOLLARS, never a bare "Are you sure?": deleting a bill money has
          landed on reverses what it posted, and a coach must be told the size of that before they
          can consent. `ledgerReversalPreview` is the SAME function the server reverses with, so the
          sentence and the outcome cannot drift. One delete path — not a quieter second one that
          happens to be easier to reach. */}
      {canWrite && (
        <div className={styles.commitFoot}>
          {confirmDelete ? (
            <div className={styles.dangerConfirm} role="alertdialog" aria-label="Confirm delete">
              <p className={styles.dangerConfirmTitle}>Delete “{expense.description}”?</p>
              {reversal.amount > 0 && (
                <p className={styles.dangerConfirmBody}>
                  This has already posted <strong>{money(reversal.amount)}</strong> out of the team’s
                  books{reversal.legs > 1 ? ` across ${reversal.legs} payments` : ''}. Deleting it will
                  reverse that, so cash on hand goes back up by {money(reversal.amount)}.
                </p>
              )}
              {reversal.amount === 0 && !reversal.owesFamily && (
                <p className={styles.dangerConfirmBody}>Nothing has been paid against it, so no money moves.</p>
              )}
              {/* ⚠⚠ THE HOUSEHOLD IS SAID SEPARATELY, NEVER FOLDED INTO A DOLLAR FIGURE (P4). A
                  fronted payment moved no team cash, so it contributes nothing to the amount coming
                  back — but the credit it created disappears by cascade, and that is a change to
                  what a family is owed. Word for word the sentence the modal's own Delete gives, so
                  one fact has one phrasing on both doors. */}
              {/* ⚠ NAMES THE HOUSEHOLD AND THE FIGURE — owner ruling 2026-08-27, same sentence
                  shape as the modal's Delete so one fact reads one way on both doors. */}
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
              <div className={styles.dangerConfirmActions}>
                <button className={styles.btnGhost} disabled={deleting} onClick={() => setConfirmDelete(false)}>Keep it</button>
                <button className={styles.btnDanger} disabled={deleting} onClick={deleteCommitment}>
                  {deleting ? 'Deleting…' : reversal.amount > 0 ? 'Delete and reverse' : 'Delete'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button className={styles.deleteRecordBtn} onClick={() => setConfirmDelete(true)} disabled={deleting}>
                <Trash2 size={13} aria-hidden /> Delete this bill
              </button>
              {/* ── The save strip, ON THE DELETE ROW ──────────────────────────────────────────
                  ⚖ IT HAD A ROW OF ITS OWN AND DID NOT EARN ONE (owner, §114 walk 2026-08-27).
                  Delete sits left, the status right, on the one line that closes the page — the
                  same pairing the plan-template editor's docked footer uses.
                  ⚠ AT THE FOOT, NOT BESIDE A FIELD: the schedule above may grow to a dozen rows,
                  and one strip serves all six fields, which is the point — six fields with five
                  save behaviours would be worse than the modal this replaces.
                  ⚠ IT STANDS DOWN WHILE THE DELETE QUESTION IS OPEN — the branch above takes the
                  whole row, because a coach being asked about dollars should not be reading a
                  save status at the same time. `aria-live` only announces what is rendered, so
                  nothing is lost. */}
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
          )}
        </div>
      )}
    </>
  );
}
