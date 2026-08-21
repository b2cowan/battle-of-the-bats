'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import { budgetItemTier, ITEM_TIER_LABEL } from '@/lib/coach-budget-item-tiers';
/* ⚠⚠ FROM THE PURE MODULE, NEVER FROM `lib/coach-budget-items.ts`. That one imports
   `supabase-admin`, which builds the service-role client at module load — so this single import
   line, taken from the wrong door, would put an admin client in the browser bundle of every screen
   that shows an item picker. It would not throw and nothing would report it. */
import {
  describeBudgetItemUsage, sumBudgetItemUsage, NO_BUDGET_ITEM_USAGE, type BudgetItemUsage,
} from '@/lib/coach-budget-item-usage';
import type { BudgetCategoryWithItems, BudgetItem } from '@/lib/types';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';

/**
 * OUR OWN WORDS — rename one, or remove it (Money form P2; scope narrowed by the ruling 2026-08-17).
 *
 * ⚠⚠ THIS SCREEN IS WHAT MAKES THE PICKER'S FILTER SAFE TO SHIP. Migration 246 made an item's
 * direction part of what it is, and the picker offers only the side you are working on — so a word
 * filed wrongly is a word a coach cannot reach from the form that needs it. Until this existed, a
 * coach's own item could not be corrected from anywhere in the product: the club-admin editor
 * refuses team-owned rows outright ("only that team can rename it") against a team surface that did
 * not exist. The ruling's "editable afterwards" had no editor.
 *
 * ⚠ THE TEAM'S OWN WORDS ONLY, and the read-only rest is SHOWN rather than hidden. A coach hunting
 * for "Diamond permits" needs to learn that it is a standard word and that is why there is no pencil
 * beside it — an editor that simply omitted everything it could not change would read as a list
 * missing half its contents, and the coach would go looking for a second screen that does not exist.
 * ⚠ That read-only section is the one place the two shared tiers MIX, which is why its rows carry a
 * tier chip and the team's own rows above do not: their heading already said it.
 *
 * ⚠ RENAMING IS RETROACTIVE, AND THAT IS WHY IT IS THE REMEDY EVERY REFUSAL OFFERS. The item NAMES
 * the row (mig 240), so a rename reaches every budget line, cost and money-in record pointing at it
 * — it changes everything and loses nothing.
 *
 * ⚠⚠ MOVING A WORD BETWEEN INCOME AND EXPENSES IS GONE. It shipped here on 2026-08-16 and was
 * retracted the next day: a category can belong to one side of the books, so a moved word can land
 * under a heading that makes no sense for it. Removing and re-adding is the honest fix, and a word
 * with history behind it cannot be removed at all — which is what makes a wrong-side word a
 * five-second problem rather than a data one.
 *
 * ⚠⚠ AND SINCE P3 THERE IS A THIRD DOOR: **use a shared word instead**. It is the only way a word
 * with history behind it ever disappears, and the thing that makes that safe is the re-point rather
 * than a refusal — the records are carried onto the surviving word before anything is removed. It
 * lives behind its own screen inside this modal rather than beside the pencil and the bin, because
 * it is many-onto-one: the unit is a SELECTION of words, not the row a coach happens to be on.
 *
 * ⚠⚠ NOTHING HERE KEEPS ITS OWN COPY OF THE WORD LIST, and that is deliberate. `BudgetItemPicker`
 * holds a local `localCategories` and the money form's P2 review found the Critical that follows
 * from it: the parent re-derived an item's name from its own stale copy and put the wrong word on a
 * record. A fold removes several words and moves records onto another, so a local copy would offer
 * words that no longer exist. Every list below is derived from the `categories` PROP on each render,
 * and a fold asks the parent to re-read (`onChanged`) rather than patching anything locally.
 */
/** One word with its category beside it — what both lists in this modal are made of. */
interface Row { item: BudgetItem; categoryName: string }

export default function BudgetItemManagerModal({
  orgSlug,
  teamId,
  categories,
  onClose,
  onChanged,
}: {
  orgSlug: string;
  teamId: string;
  categories: BudgetCategoryWithItems[];
  onClose: () => void;
  onChanged: () => void;
}) {
  // Parent conditionally mounts this only while open — one unit for the whole mount.
  useOverlayOpen(true);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  /**
   * How many records are filed against each of this team's own words.
   *
   * ⚠ FETCHED HERE RATHER THAN PASSED IN, because the panel behind this modal reads the taxonomy on
   * every money form and every budget line and has no business counting usage for all of them. The
   * count is opt-in on the list route (`usage=1`) and only this screen asks for it.
   *
   * ⚠ IT DISABLES THE BUTTON; THE SERVER IS WHAT REFUSES. This can go stale — a coach in another tab
   * can file a cost against a word between this fetch and the click — so the delete route counts
   * again and returns the real sentence. The button state is a courtesy, never the guard.
   */
  /**
   * How many records are filed against each of this team's own words — WITH the word list those
   * counts were read against.
   *
   * ⚠⚠ HAVE THE COUNTS ACTUALLY ARRIVED, AND ARE THEY STILL THE RIGHT ONES? An absent count and a
   * count of zero are the same value and mean opposite things. On the manage list that only ever
   * makes the bin briefly available and the server refuses; on the FOLD it would put a false
   * sentence in front of the coach — "nothing is filed against those words" over six records — and
   * that sentence is the whole of what they are agreeing to.
   *
   * ⚠⚠ SO THE ANSWER IS CARRIED WITH THE QUESTION IT ANSWERED (/review, concurrency lens,
   * 2026-08-17), rather than a separate "loaded" flag. `categories` changes whenever ANY mounted
   * money tab writes — the hub keeps them all alive and bumps a shared revision — so a coach filing
   * a cost in another tab against one of the very words being folded refreshes this list underneath
   * the open confirmation. A boolean set once could not tell that the counts had gone stale; an
   * identity comparison cannot fail to.
   *
   * ⚠ FETCHED HERE RATHER THAN PASSED IN, because the panel behind this modal reads the taxonomy on
   * every money form and every budget line and has no business counting usage for all of them. The
   * count is opt-in on the list route (`usage=1`) and only this screen asks for it.
   *
   * ⚠ IT DISABLES THE BUTTON; THE SERVER IS WHAT REFUSES. A coach in another tab can file a cost
   * between this fetch and the click, so every write path counts again and returns the real
   * sentence. The button state is a courtesy, never the guard.
   */
  const [counted, setCounted] = useState<
    { of: BudgetCategoryWithItems[]; usage: Record<string, BudgetItemUsage> } | null>(null);
  const usage = counted?.of === categories ? counted.usage : null;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/budget-items?teamId=${teamId}&usage=1`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.usage) setCounted({ of: categories, usage: d.usage }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [orgSlug, teamId, categories]);

  /* ── Use a shared word instead ────────────────────────────────────────────────────────────────
     ⚠ A SEPARATE SCREEN INSIDE THE MODAL, not a row action. The fold is many-onto-one, so its unit
     is a selection rather than the row a coach is standing on — and mixing tick boxes into a list
     whose other two affordances act on a single row would make "which of these does Remove apply
     to?" a real question. */
  const [folding, setFolding] = useState(false);
  const [foldSources, setFoldSources] = useState<string[]>([]);
  const [foldTargetId, setFoldTargetId] = useState('');
  const [foldBusy, setFoldBusy] = useState(false);
  /** What the last fold did, in the coach's words — kept on the manage list they return to. */
  const [notice, setNotice] = useState('');

  /** Flattened and split, with each word's category beside it — the same shape the picker searches.
   *  ⚠ MEMOISED, and sorted here rather than at render: the rename `<input>`'s state lives in this
   *  component, so without this every keystroke while renaming re-flattens and re-sorts the whole
   *  library twice. `BudgetItemPicker`, built in the same release, already does exactly this. */
  const byCategoryThenName = (a: Row, b: Row) =>
    a.categoryName.localeCompare(b.categoryName) || a.item.name.localeCompare(b.item.name);

  const { ours, theirs } = useMemo(() => {
    const rows: Row[] = categories.flatMap(c => c.items.map(item => ({ item, categoryName: c.name })));
    return {
      ours:   rows.filter(r => r.item.teamId === teamId).sort(byCategoryThenName),
      theirs: rows.filter(r => r.item.teamId !== teamId).sort(byCategoryThenName),
    };
  }, [categories, teamId]);

  /**
   * The fold, derived fresh on every render from the `categories` PROP.
   *
   * ⚠⚠ THE SELECTION IS FILTERED AGAINST THE LIVE LIST, never trusted as remembered. After a fold
   * the parent re-reads and several of these words no longer exist; a selection held as ids alone
   * would keep naming them, and the confirmation would count records against words that are gone.
   * Same class of defect as the money form's Critical — a control reading its own stale copy.
   */
  const fold = useMemo(() => {
    const selected = ours.filter(r => foldSources.includes(r.item.id));
    /* ⚠ THE SIDE COMES FROM WHAT IS ALREADY TICKED, and it locks the rest of the screen: the target
       must be on the same side, so the second tick can only be a word pointing the same way. A
       cross-side fold is impossible by construction here, which is what keeps "no money changes"
       true — the report reads a row's direction from what was filed, so a row landing on a word
       that points the other way would be unchanged money reading as its own opposite. */
    const side = selected[0]?.item.direction ?? null;
    const targets = side
      ? theirs.filter(r => r.item.direction === side)
      : [];
    const target = targets.find(r => r.item.id === foldTargetId) ?? null;
    const moving = sumBudgetItemUsage(selected.map(r => usage?.[r.item.id]));
    /* The words whose records change HEADING as well as name — the fold's one real surprise, and
       the reason the confirmation carries a heads-up rather than a single tidy sentence. */
    const reFiled = target
      ? selected.filter(r => r.categoryName !== target.categoryName)
      : [];
    return { selected, side, targets, target, moving, reFiled };
  }, [ours, theirs, foldSources, foldTargetId, usage]);

  async function patch(item: BudgetItem, body: Record<string, unknown>) {
    setError('');
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/budget-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, ...body }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not save that change');
      }
      setRenamingId(null);
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save that change');
    } finally {
      setBusyId(null);
    }
  }

  /** Remove one of this team's own words. The server refuses if anything is filed against it and
   *  says what — shown as-is, because that sentence is written for the coach. */
  async function remove(item: BudgetItem) {
    setError('');
    setBusyId(item.id);
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/budget-items/${item.id}?teamId=${teamId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Could not remove that word');
      }
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not remove that word');
    } finally {
      setBusyId(null);
    }
  }

  function leaveFold() {
    setFolding(false);
    setFoldSources([]);
    setFoldTargetId('');
    setError('');
  }

  /** Fold the ticked words into the chosen shared one. The server re-points every record before it
   *  removes anything and refuses in one sentence if it cannot; that sentence is shown as-is. */
  async function runFold() {
    const target = fold.target;
    if (!target || fold.selected.length === 0) return;
    setError('');
    setFoldBusy(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/budget-items/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          sourceIds: fold.selected.map(r => r.item.id),
          targetId: target.item.id,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? 'Those words could not be folded together');
      const moved = (d.moved ?? NO_BUDGET_ITEM_USAGE) as BudgetItemUsage;
      setNotice(moved.total > 0
        ? `Done — ${describeBudgetItemUsage(moved)} now use “${target.item.name}”.`
        : `Done — ${fold.selected.length === 1 ? 'that word was' : 'those words were'} removed. `
          + 'Nothing was filed against them.');
      leaveFold();
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Those words could not be folded together');
      /* ⚠⚠ A FAILED FOLD RE-READS TOO (/review, concurrency lens, 2026-08-17). The server has one
         refusal that leaves the world CHANGED: the records re-pointed and the words not removed.
         Without this the screen kept its pre-fold counts, so pressing the button again offered to
         move records that had already moved — a promise that got wronger with every retry. Re-read
         and the confirmation describes what is actually left to do. */
      onChanged();
    } finally {
      setFoldBusy(false);
    }
  }

  function sideChip(item: BudgetItem) {
    const isIn = item.direction === 'in';
    return (
      <span className={`${styles.badge} ${isIn ? styles.badgeActive : styles.badgeDraft}`}>
        {isIn ? 'Money in' : 'Expense'}
      </span>
    );
  }

  /**
   * The one modal shell both screens sit in (/simplify, simplification lens, 2026-08-17).
   *
   * The fold screen and the manage list had each repeated the overlay, the frame's three-class list,
   * the stop-propagation wiring, the header, the scrolling body and the footer — a copy-paste that
   * would make any future change (a dialog role, a different sheet behaviour on mobile) something to
   * remember to do twice.
   *
   * ⚠⚠ A FUNCTION RETURNING MARKUP, DELIBERATELY NOT A NESTED COMPONENT. A component declared inside
   * this one gets a fresh identity on every render, so React would unmount and remount its whole
   * subtree on each keystroke — the rename input would lose focus mid-word and the fold's tick boxes
   * would flicker. Composing markup has no such identity, and reconciliation sees exactly the tree
   * the inline version produced.
   */
  function frame(title: string, subtitle: string, body: ReactNode, footer: ReactNode) {
    /* ⚠ THE BACKDROP AND THE X ARE DEAD WHILE A FOLD IS IN FLIGHT (/review, concurrency lens,
       2026-08-17). Cancel and every control were already disabled by `foldBusy`, but these two were
       not — so a coach could click outside the dialog mid-fold, the parent would unmount it, and the
       fold would complete for real with the "Done — …" sentence never shown. Somebody who thought
       they had backed out would have no way to know their words had gone. */
    const close = () => { if (!foldBusy) onClose(); };
    return (
      <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (close)?.(); }}>
        <div className={`${styles.modal} ${styles.modalScrollBody} ${styles.sheetOnMobile}`} onClick={e => e.stopPropagation()}>
          <CoachModalHeader title={title} subtitle={subtitle} onClose={close} />
          <div className={styles.formBody}>{body}</div>
          <div className={styles.modalFooter}>{footer}</div>
        </div>
      </div>
    );
  }

  /** Standard or Club, never colour alone — the same chip the read-only section and the picker use. */
  function tierChip(item: BudgetItem) {
    return (
      <span className={`${styles.badge} ${item.orgId ? styles.badgeDraft : styles.badgeArchived}`}>
        {ITEM_TIER_LABEL[budgetItemTier({ org_id: item.orgId, team_id: item.teamId })]}
      </span>
    );
  }

  /* ══ Use a shared word instead ═════════════════════════════════════════════════════════════════
     Three moves on one screen, in the order the mockup puts them: tick your words, choose what
     replaces them, read what happens. The confirmation appears only once both halves are chosen —
     it is an account of a specific fold, and there is nothing truthful to say before that. */
  if (folding) {
    const { selected, side, targets, target, moving, reFiled } = fold;
    const sideWord = side === 'in' ? 'money in' : side === 'out' ? 'expense' : '';
    return frame(
      'Use a shared word instead',
      'Fold your team’s words into one your club or FieldLogicHQ already shares',
      (
          <>
            {error && <p className={styles.errorText}>{error}</p>}

            <h4 className={styles.formSectionTitle}>Which of our words?</h4>
            <p className={styles.formHint}>
              Pick as many as you like — they all move onto the same shared word. Once you&rsquo;ve
              picked one, the rest of the list narrows to words on the <strong>same side</strong> of
              the books, because a word can only be folded into another that points the same way.
            </p>
            {ours.map(({ item, categoryName }) => {
              const checked  = foldSources.includes(item.id);
              /* ⚠ DISABLED RATHER THAN HIDDEN. A coach who ticks an expense and then cannot find
                 their income word would go looking for a second screen; greyed out with a reason is
                 the answer to the question they are actually asking. */
              const wrongSide = side != null && item.direction !== side && !checked;
              const count = usage?.[item.id]?.total ?? 0;
              return (
                <label
                  key={item.id}
                  className={`${styles.tagManagerRow} ${styles.foldPick}`}
                  data-disabled={wrongSide ? 'true' : undefined}
                  title={wrongSide
                    ? `“${item.name}” is on the other side of the books — fold those separately`
                    : undefined}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={wrongSide || foldBusy}
                    onChange={e => {
                      setError('');
                      setFoldSources(prev => e.target.checked
                        ? [...prev, item.id]
                        : prev.filter(id => id !== item.id));
                      /* ⚠ THE TARGET IS DROPPED WHEN THE SIDE COULD HAVE CHANGED. Un-ticking the
                         last word re-opens both sides, and a target chosen under the old one would
                         sit in the confirmation as a word the new selection may not be allowed to
                         reach — the server would refuse, after the coach had read a sentence
                         promising otherwise. */
                      if (!e.target.checked) setFoldTargetId('');
                    }}
                  />
                  <span className={styles.tagManagerName}>
                    <span className={styles.mutedInline}>{categoryName} · </span>{item.name}
                  </span>
                  <span className={styles.foldCount}>
                    {count === 0 ? 'nothing filed' : `${count} record${count === 1 ? '' : 's'}`}
                  </span>
                  {sideChip(item)}
                </label>
              );
            })}

            <h4 className={styles.formSectionTitle} style={{ marginTop: '1.25rem' }}>
              Replace them with
            </h4>
            {selected.length === 0 ? (
              <p className={styles.formHint}>Pick at least one of your words above first.</p>
            ) : targets.length === 0 ? (
              <p className={styles.formHint}>
                There are no standard or club <strong>{sideWord}</strong> words to fold these into
                yet. Your club can share one from its own budget items, and it will appear here.
              </p>
            ) : (
              <div className={styles.tagManagerRow}>
                <select
                  className={`${styles.select} ${styles.tagManagerName}`}
                  value={foldTargetId}
                  disabled={foldBusy}
                  onChange={e => { setError(''); setFoldTargetId(e.target.value); }}
                >
                  <option value="">Choose a shared word…</option>
                  {targets.map(({ item, categoryName }) => (
                    <option key={item.id} value={item.id}>{categoryName} · {item.name}</option>
                  ))}
                </select>
                {/* ⚠ THE TIER IS A CHIP BESIDE THE BOX, NOT TEXT INSIDE EVERY OPTION. Appending
                    "(Standard)" to each row would put it on almost all of them — noise that teaches
                    a coach to stop reading the end of the line, which is where the signal is. The
                    same call P2 made for the picker's own input. */}
                {target && tierChip(target.item)}
              </div>
            )}

            {target && selected.length > 0 && !usage && (
              <p className={styles.formHint}>Counting what&rsquo;s filed against those words…</p>
            )}
            {target && selected.length > 0 && usage && (
              <div className={styles.foldConfirm}>
                {moving.total > 0 ? (
                  <p>
                    <strong>{moving.total} record{moving.total === 1 ? '' : 's'}</strong> move onto{' '}
                    <strong>{target.item.name}</strong> — {describeBudgetItemUsage(moving)}.
                  </p>
                ) : (
                  <p>
                    Nothing is filed against {selected.length === 1 ? 'that word' : 'those words'} yet,
                    so no records move.
                  </p>
                )}
                <p className={styles.formHint}>
                  Your {selected.length === 1 ? 'word is' : `${selected.length} words are`} removed
                  afterwards. <strong>No money changes</strong> — only what it&rsquo;s filed under.
                </p>
                {reFiled.length > 0 && (
                  /* ⚠⚠ THE ONE CONSEQUENCE A COACH CANNOT SEE COMING (owner ruling 2026-08-17).
                     Folding across categories is allowed, and it re-files those records under a
                     different heading on Budget vs. Actual — a real change to a report they may
                     have just reconciled. It is said before the button, in the words of the actual
                     words involved, not as a general warning. */
                  <div className={styles.foldHeadsUp}>
                    {reFiled.map(({ item, categoryName }) => (
                      <p key={item.id}>
                        <strong>Heads up:</strong> “{item.name}” sits under {categoryName}. Its
                        records will move to {target.categoryName}, where “{target.item.name}” lives.
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
      ),
      (
        <>
          <button className={styles.btnGhost} disabled={foldBusy} onClick={leaveFold}>Cancel</button>
          <button
            className={styles.btnPrimary}
            disabled={foldBusy || !target || selected.length === 0 || !usage}
            onClick={runFold}
          >
            {/* ⚠ THE BUTTON SAYS WHAT IT DOES TO THE RECORDS, because that is what a coach is
                deciding about. With nothing filed against the words there are no records to move
                and the fold IS a removal — so the label says removal rather than claiming a
                movement of nothing. */}
            {foldBusy ? 'Moving…'
              : moving.total > 0
                ? `Move ${moving.total} record${moving.total === 1 ? '' : 's'}`
                : `Remove ${selected.length} word${selected.length === 1 ? '' : 's'}`}
          </button>
        </>
      ),
    );
  }

  return frame(
    'Manage our items',
    'The words your team invented. Everything else is read-only.',
    (
        <>
          {error && <p className={styles.errorText}>{error}</p>}
          {notice && <p className={styles.formHint}>{notice}</p>}

          {ours.length === 0 ? (
            <p className={styles.formHint}>
              Your team hasn&rsquo;t added any words of its own yet. Add one while building a budget
              line or recording money — it&rsquo;ll show up here to rename or remove.
            </p>
          ) : (
            <>
              <p className={styles.formHint}>
                Renaming one changes what it&rsquo;s called <strong>everywhere</strong> — on your plan,
                on Budget vs. Actual and on everything already recorded against it. A word can only be
                removed while <strong>nothing is filed against it</strong>; once something is, rename it
                or fold it into a shared word instead. A word stays on the side it was made on — put
                one in the wrong place and the fix is to remove it and add it again.
              </p>
              {/* ⚠ THE FOLD IS THE ONLY WAY A USED WORD EVER DISAPPEARS, so its door sits with the
                  list rather than in the footer beside Done — a coach reading "once something is
                  filed against it, rename it or fold it" needs the second remedy within reach of
                  the sentence offering it. Hidden with nothing to fold ONTO: an empty picker that
                  explains itself is still a dead end. */}
              {theirs.length > 0 && (
                <p>
                  <button className={styles.btnSecondary} onClick={() => { setError(''); setNotice(''); setFolding(true); }}>
                    Use a shared word instead
                  </button>
                </p>
              )}
              {ours.map(({ item, categoryName }) => (
                <div key={item.id} className={styles.tagManagerRow}>
                  {renamingId === item.id ? (
                    <>
                      <input
                        className={`${styles.input} ${styles.tagManagerName}`}
                        value={renameDraft}
                        maxLength={80}
                        autoFocus
                        onChange={e => setRenameDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && renameDraft.trim()) patch(item, { name: renameDraft.trim() });
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                      />
                      <div className={styles.tagManagerActions}>
                        <button
                          className={styles.btnSecondary}
                          disabled={busyId === item.id || !renameDraft.trim()}
                          onClick={() => patch(item, { name: renameDraft.trim() })}
                        >
                          Save
                        </button>
                        <button className={styles.btnGhost} disabled={busyId === item.id} onClick={() => setRenamingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className={styles.tagManagerName}>
                        <span className={styles.mutedInline}>{categoryName} · </span>{item.name}
                      </span>
                      {sideChip(item)}
                      <div className={styles.tagManagerActions}>
                        <button
                          title={`Rename ${item.name}`}
                          disabled={!!busyId}
                          onClick={() => { setError(''); setRenamingId(item.id); setRenameDraft(item.name); }}
                        >
                          <Pencil size={14} aria-hidden />
                        </button>
                        {/* ⚠⚠ THE "MOVE TO THE OTHER SIDE" BUTTON IS RETRACTED (owner ruling
                            2026-08-17). It shipped here on 2026-08-16 and lasted one day: a category
                            can belong to one side of the books, so a moved word can land under a
                            heading that makes no sense for it. Removing the word and adding it on the
                            other side is the honest answer, and a word with history cannot be removed
                            anyway — which makes a wrong-side word a five-second problem rather than a
                            data one. The server refuses a `direction` outright now, so a stale client
                            is told rather than silently ignored. */}
                        {/* ⚠ THE TOOLTIP NAMES THE KINDS now that the count arrives per kind —
                            "9 records" and "2 budget lines, 6 recorded costs and 1 money in" are the
                            same number, and only the second tells a coach where to go and look. */}
                        <button
                          title={usage?.[item.id]?.total
                            ? `${item.name} can’t be removed — ${describeBudgetItemUsage(usage[item.id])} are filed against it`
                            : `Remove ${item.name}`}
                          disabled={!!busyId || !!usage?.[item.id]?.total}
                          onClick={() => remove(item)}
                        >
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </>
          )}

          {theirs.length > 0 && (
            <>
              <h4 className={styles.formSectionTitle} style={{ marginTop: '1.25rem' }}>
                Standard and club words
              </h4>
              <p className={styles.formHint}>
                These belong to everybody, so they&rsquo;re read-only here. <strong>Standard</strong>
                words come with FieldLogicHQ; <strong>Club</strong> words are the ones your club shares
                with every team, and your club can change those.
              </p>
              {/* ⚠ THE TIER CHIP EARNS ITS PLACE HERE AND NOWHERE ELSE ON THIS SCREEN. This one
                  section MIXES the two shared tiers under a single heading, so "read-only" is all a
                  coach can tell without it — and "ask your club to change one" is wrong advice for a
                  standard word, which the club cannot change either. Above, the team's own words sit
                  under their own heading, so a chip on every row there would repeat what the heading
                  already said. The picker tags every row because it mixes all three. */}
              {theirs.map(({ item, categoryName }) => (
                <div key={item.id} className={styles.tagManagerRow}>
                  <span className={`${styles.tagManagerName} ${styles.mutedInline}`}>
                    {categoryName} · {item.name}
                  </span>
                  {tierChip(item)}
                  {sideChip(item)}
                </div>
              ))}
            </>
          )}
        </>
    ),
    <button className={styles.btnGhost} onClick={onClose}>Done</button>,
  );
}
