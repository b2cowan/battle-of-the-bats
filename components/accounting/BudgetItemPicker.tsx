'use client';
import { useState, useEffect, useMemo, useRef, useId } from 'react';
import type { BudgetCategoryWithItems, BudgetItem } from '@/lib/types';
import { budgetItemTier, ITEM_TIER_LABEL } from '@/lib/coach-budget-item-tiers';
import styles from './BudgetItemPicker.module.css';

export interface BudgetItemSelection {
  categoryId: string;
  categoryName: string;
  itemId: string | null;    // null when "Misc" or a free-text custom description is used
  itemName: string;
  suggestedAmount: number | null;
}

/**
 * ONE SEARCHABLE CONTROL, THREE SURFACES (Money form P2, owner ruling 2026-08-16).
 *
 * This was two chained `<select>`s: choose a category, then choose an item under it. That shape
 * asked the coach to remember our filing system before it would show them a word — "Dome block" is
 * unreachable until you have guessed it lives under Facilities — and it made a twelve-category
 * library a two-step hunt for something they could have typed four letters of.
 *
 * ⚠⚠ THE LIST FOLLOWS THE DIRECTION, AND THAT IS A FILTER NOW, NOT A SORT (owner ruling
 * 2026-08-16, migration 246). The Expense pill offers money-out words and Income offers money-in
 * ones — full stop. This REVERSES migration 243's rule, which grouped by direction and deliberately
 * kept everything reachable both ways, and the reversal only holds because 246 made the column
 * mandatory: while club- and coach-created words were untagged, filtering would have hidden every
 * word an organization ever invented.
 *
 * ⚠⚠ THE CHOSEN ITEM IS ALWAYS OFFERED, WHICHEVER WAY IT POINTS. A saved record's own word must
 * never fall out of the list it is displayed in — a word can be moved to the other side after money
 * was filed against it, and a picker that answered "nothing selected" would let an ordinary edit
 * silently strip the item off a row and drop it into the unitemized bucket. The filter decides what
 * a coach may CHOOSE; it never decides what they have already chosen.
 *
 * ⚠ CATEGORIES ARE NEVER FILTERED, only grouped. "Tournaments" holding both its entry fees and its
 * registration revenue is the whole point of the by-activity report.
 */
interface Props {
  categories: BudgetCategoryWithItems[];
  value: BudgetItemSelection | null;
  onChange: (v: BudgetItemSelection) => void;
  /**
   * Which side of the books this control is choosing for (mig 246).
   * `out` = money the team spends · `in` = money it receives. Required: every surface knows the
   * answer — the money form from its pill, the Budget Plan from the line's kind, the Org Budget
   * because it is a spending plan — and defaulting it would put the wrong words on one of them.
   */
  direction: 'in' | 'out';
  // API path for creating new items. Differs between admin and coach contexts:
  //   admin:  /api/admin/accounting/budget-categories
  //   coach:  /api/coaches/[orgSlug]/budget-items
  createItemEndpoint: string;
  // For admin route the endpoint needs [catId] in the path; for coach it's a body field.
  // Specify which pattern to use.
  createItemMode: 'admin' | 'coach';
  /** Coach mode: which team owns an item created here (mig 240). An item belongs to ONE team and
   *  appears in no other team's picker, so the server requires this and refuses without it. */
  teamId?: string;
  // Coach mode only: allow creating a new top-level category inline (posts
  // { newCategoryName } to createItemEndpoint). Owner decision 2026-07-09.
  allowCreateCategory?: boolean;
  /** Lets a caller point its "you must pick one" message at the search box. */
  selectId?: string;
  /** Draw the control as at fault — the picker is a required field since mig 240. */
  invalid?: boolean;
  disabled?: boolean;
  /** Where a coach goes to rename or remove a word afterwards. Named in the create panel, so the
   *  answer to "what if I get this wrong?" is on screen at the moment the choice is made — and
   *  since 2026-08-17 that answer includes the fact that the SIDE is not one of the things that can
   *  be changed later, which is exactly when a coach needs to know it. */
  manageHint?: string;
  /**
   * ⚠⚠ A GROUP THAT IS NOT MADE OF BUDGET ITEMS, RENDERED FIRST (money centralization P2, owner
   * ruling C2, 2026-08-23).
   *
   * The recording conversation's "we paid for something" branch has to let a coach say *this pays
   * off a bill we already have*. Three shapes were drawn; the owner took the one that asks the
   * coach NOTHING: the bills they owe are simply the first group in the list this control already
   * opens, above Tournaments and Facilities, and the same typing filters both halves. That is R2
   * applied to the branch body — "is this a payable?" is a question about OUR filing system, and
   * making the coach answer it first is the habit the whole project exists to break.
   *
   * ⚠ THE CONTROL LEARNS A GROUP, NOT A DOMAIN. It knows nothing about commitments, payments or
   * money: a caller hands it labelled options and gets told which one was picked. Teaching this
   * control what a payable is would put money logic inside a control the Budget Plan and the Org
   * Budget also render.
   *
   * ⚠ EXACTLY ONE OF `value` / `leadGroup.selectedId` IS EVER SET. Picking from either group is
   * how the caller learns the other was abandoned — see `choose` and `chooseLead`.
   */
  leadGroup?: {
    /** The group heading, e.g. "Bills you owe". */
    label: string;
    options: {
      id: string;
      name: string;
      /** The fact that makes the row worth choosing — rendered at the row's end, e.g. "$400 owing". */
      meta?: string;
    }[];
    /**
     * How `meta` should READ. Quiet by default, because this control is also the Budget Plan's and
     * the Org Budget's and their trailing facts are not debts.
     *
     * ⚠ THE DEFAULT IS THE HONEST ONE (/simplify, altitude lens 2026-08-23). The first cut hard-
     * coded the portal's owing colour into the shared stylesheet, so every future lead group —
     * "recently used", "from last season" — would have rendered its fact in alarm red with no way
     * out, in a prop whose own documentation promises it is domain-agnostic. A caller that means
     * "this is money owed" now says so.
     */
    metaTone?: 'quiet' | 'owing';
    selectedId: string | null;
    onPick: (id: string) => void;
  };
}

/** An item with its category carried along — what the flat, searchable list is made of. */
interface Row { item: BudgetItem; categoryId: string; categoryName: string }

const SIDE_WORD = { out: 'an expense', in: 'money coming in' } as const;

export default function BudgetItemPicker({
  categories,
  value,
  onChange,
  direction,
  createItemEndpoint,
  createItemMode,
  teamId,
  allowCreateCategory = false,
  selectId,
  invalid = false,
  disabled = false,
  manageHint,
  leadGroup,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  /* `aria-controls` has to name the menu, and this control renders three times on one screen in the
     Budget Plan's own sheets — a hardcoded id would point every box at the first one's list. */
  const listboxId = useId();

  const [addingItem, setAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [newItemCatId, setNewItemCatId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState('');

  // Local categories list that can be extended after a custom item is created
  const [localCategories, setLocalCategories] = useState<BudgetCategoryWithItems[]>(categories);
  useEffect(() => { setLocalCategories(categories); }, [categories]);

  /* The flat, searchable universe: every item this team may pick, with its category beside it so
     one string search can match either half of "Facilities · Dome block". */
  const allRows = useMemo<Row[]>(() => localCategories.flatMap(c =>
    c.items.map(item => ({ item, categoryId: c.id, categoryName: c.name })),
  ), [localCategories]);

  /* ⚠ THE SELECTED ITEM SURVIVES THE FILTER — see the header note. Everything else must match the
     side this control is choosing for. */
  const offered = useMemo(
    () => allRows.filter(r => r.item.direction === direction || r.item.id === value?.itemId),
    [allRows, direction, value?.itemId],
  );

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    const hit = q
      ? offered.filter(r => `${r.categoryName} ${r.item.name}`.toLowerCase().includes(q))
      : offered;
    // Grouped by category in the library's own order, which is the order the categories arrive in.
    const order = new Map(localCategories.map((c, i) => [c.id, i]));
    return [...hit].sort((a, b) => {
      const ca = order.get(a.categoryId) ?? 0;
      const cb = order.get(b.categoryId) ?? 0;
      return ca !== cb ? ca - cb : a.item.name.localeCompare(b.item.name);
    });
  }, [offered, q, localCategories]);

  /* The lead group's own matches, filtered by the SAME typing (C2's promise: one search, both
     halves). Kept separate from `matches` because these are not rows — they carry no category,
     no direction and no tier, and merging them would mean teaching every consumer of `matches`
     that some of its members are not items. */
  const leadMatches = useMemo(
    () => (leadGroup?.options ?? []).filter(o => !q || o.name.toLowerCase().includes(q)),
    [leadGroup, q],
  );

  const exact = offered.some(r => r.item.name.toLowerCase() === q);
  const canCreate = q.length > 0 && !exact && !disabled;
  /* ⚠ KEYBOARD ORDER IS RENDER ORDER: lead options, then items, then "+ Add". A cursor index that
     did not account for the lead group would move the highlight and select a DIFFERENT row. */
  const optionCount = leadMatches.length + matches.length + (canCreate ? 1 : 0);

  /**
   * ⚠⚠ WHICH NAMES APPEAR MORE THAN ONCE ON THIS SIDE — the whole reason the tier tags exist.
   *
   * Since the item-integrity ruling a club's *Grant* and a team's own *Grant* are two legitimate
   * rows rather than something to be merged away. That is only safe if a coach can tell them apart,
   * which is what the chips in the list do. The INPUT is the harder half: at rest it shows
   * "Fundraising · Grant" and a coach re-opening a saved record cannot see which one they picked.
   *
   * ⚠ SO THE INPUT NAMES THE TIER ONLY WHEN IT IS ACTUALLY AMBIGUOUS. Appending it always would put
   * "(Standard)" on the ninety per cent of rows where nothing is in doubt — noise that teaches a
   * coach to stop reading the end of the field, which is exactly where the signal would be.
   */
  const ambiguousNames = useMemo(() => {
    const seen = new Map<string, number>();
    offered.forEach(r => {
      const key = r.item.name.trim().toLowerCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    });
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k));
  }, [offered]);

  /** A chosen lead option displays as itself — it has no "Category · Item" shape to borrow. */
  const selectedLead = leadGroup?.selectedId
    ? leadGroup.options.find(o => o.id === leadGroup.selectedId) ?? null
    : null;

  const selectedLabel = (() => {
    if (selectedLead) return selectedLead.name;
    if (!value?.itemId) return '';
    const base = `${value.categoryName} · ${value.itemName}`;
    if (!ambiguousNames.has(value.itemName.trim().toLowerCase())) return base;
    const chosen = offered.find(r => r.item.id === value.itemId);
    return chosen
      ? `${base} (${ITEM_TIER_LABEL[budgetItemTier({ org_id: chosen.item.orgId, team_id: chosen.item.teamId })]})`
      : base;
  })();

  function openDropdown() {
    const el = inputRef.current;
    if (el) {
      // Flip above the box when there is no room below — this control sits inside scrollable
      // modals, where a downward menu is clipped by the scroll area or hidden behind the footer.
      const rect = el.getBoundingClientRect();
      setDropUp(window.innerHeight - rect.bottom < 260 && rect.top > 280);
    }
    setOpen(true);
  }

  /** Picking from the lead group. The caller is responsible for clearing whatever `value` held —
   *  this control never invents an item selection, so it cannot clear one either. */
  function chooseLead(id: string) {
    leadGroup?.onPick(id);
    setQuery('');
    setActiveIdx(-1);
    setOpen(false);
  }

  function choose(row: Row) {
    onChange({
      categoryId:      row.categoryId,
      categoryName:    row.categoryName,
      itemId:          row.item.id,
      itemName:        row.item.name,
      suggestedAmount: row.item.suggestedAmount,
    });
    setQuery('');
    setActiveIdx(-1);
    /* ⚠ NO `inputRef.current?.blur()` HERE. It read a ref from a function handed straight to JSX,
       which React's own lint rule refuses — and it bought nothing: closing the menu is what a coach
       sees, and the input already renders the chosen "Category · Item" the moment `open` is false. */
    setOpen(false);
  }

  function startCreate() {
    setAddingItem(true);
    setNewItemName(query.trim());
    setNewItemAmount('');
    /* Pre-pick the category when the search names one — typing "travel bus" already answered half
       the question, and asking it again reads as the form not having listened. */
    const named = localCategories.find(c => q.includes(c.name.toLowerCase()));
    setNewItemCatId(named?.id ?? value?.categoryId ?? '');
    setSaveError('');
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) openDropdown();
      setActiveIdx(i => Math.min(i + 1, optionCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Same order as `renderOptions` and `optionCount`: lead group, then items, then create.
      const lead = leadMatches.length;
      if (activeIdx >= 0 && activeIdx < lead) chooseLead(leadMatches[activeIdx].id);
      else if (activeIdx >= lead && activeIdx < lead + matches.length) choose(matches[activeIdx - lead]);
      else if (activeIdx === lead + matches.length && canCreate) startCreate();
      else {
        const m = offered.find(r => r.item.name.toLowerCase() === q);
        if (m) choose(m);
        else if (canCreate) startCreate();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  async function handleSaveCustomItem() {
    const name = newItemName.trim();
    if (!name || !newItemCatId) return;
    setSaving(true);
    setSaveError('');

    try {
      let url: string;
      let body: Record<string, unknown>;

      if (createItemMode === 'admin') {
        url  = `${createItemEndpoint}/${newItemCatId}/items`;
        body = { name, suggestedAmount: newItemAmount ? Number(newItemAmount) : null, direction };
      } else {
        url  = createItemEndpoint;
        // ⚠ `teamId` IS REQUIRED BY THE SERVER (mig 240) — a coach's item belongs to their team and
        // appears in no other team's picker. Omitting it used to mean "org-wide", which is the
        // behaviour this replaced, so the server refuses rather than assuming.
        // ⚠ `direction` IS REQUIRED TOO (mig 246) — a word with no side appears under neither pill.
        body = {
          categoryId: newItemCatId, teamId, name, direction,
          suggestedAmount: newItemAmount ? Number(newItemAmount) : null,
        };
      }

      const res  = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create item');

      const newItem: BudgetItem = data.item;
      const cat = localCategories.find(c => c.id === newItemCatId);

      setLocalCategories(prev => prev.map(c =>
        c.id !== newItemCatId ? c : { ...c, items: [...c.items, newItem] }
      ));
      setAddingItem(false);
      setQuery('');

      onChange({
        categoryId:      newItemCatId,
        categoryName:    cat?.name ?? '',
        itemId:          newItem.id,
        itemName:        newItem.name,
        suggestedAmount: newItem.suggestedAmount,
      });
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to create item');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCustomCategory() {
    const name = newCatName.trim();
    if (!name) return;
    setCatSaving(true);
    setCatError('');

    try {
      const res = await fetch(createItemEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newCategoryName: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create category');

      const newCat: BudgetCategoryWithItems = data.category;
      setLocalCategories(prev => [...prev, newCat]);
      setAddingCategory(false);
      /* A brand-new category has no items yet, so the coach lands back in the item form with it
         chosen — the half they came here for is done, and the other half is one field away. */
      setNewItemCatId(newCat.id);
      setAddingItem(true);
    } catch (e: unknown) {
      setCatError(e instanceof Error ? e.message : 'Failed to create category');
    } finally {
      setCatSaving(false);
    }
  }

  /** The lead group — its own heading, its own rows, above everything (C2). */
  function renderLeadOptions() {
    if (leadMatches.length === 0) return null;
    return (
      <>
        <div className={`${styles.optGroup} ${styles.optGroupLead}`}>{leadGroup!.label}</div>
        {leadMatches.map((o, i) => (
          <button
            type="button"
            key={o.id}
            className={`${styles.opt} ${i === activeIdx ? styles.optActive : ''}`}
            onMouseDown={e => e.preventDefault()}
            onClick={() => chooseLead(o.id)}
          >
            <span>{o.name}</span>
            {o.meta && (
              <span className={`${styles.optMeta} ${leadGroup!.metaTone === 'owing' ? styles.optMetaOwing : ''}`}>
                {o.meta}
              </span>
            )}
          </button>
        ))}
      </>
    );
  }

  // ── The dropdown's rows, with a category heading whenever the group changes ──
  function renderOptions() {
    const out: React.ReactNode[] = [];
    let lastCat: string | null = null;
    // The lead group occupies the first indices — see `optionCount`.
    const lead = leadMatches.length;

    matches.forEach((row, i) => {
      if (row.categoryId !== lastCat) {
        out.push(<div key={`c-${row.categoryId}`} className={styles.optGroup}>{row.categoryName}</div>);
        lastCat = row.categoryId;
      }
      out.push(
        <button
          type="button"
          key={row.item.id}
          className={`${styles.opt} ${i + lead === activeIdx ? styles.optActive : ''}`}
          onMouseDown={e => e.preventDefault()}
          onClick={() => choose(row)}
        >
          <span>{row.item.name}</span>
          {/* The one word that can be off-side is the one already chosen — say so rather than
              letting it look like the filter is leaking. */}
          {row.item.direction !== direction && (
            <span className={styles.optOffside}>on the other side</span>
          )}
          {/* ⚠⚠ WHERE THE WORD CAME FROM, ON EVERY ROW (owner mockup 484b5971). Two words with one
              name are legitimate now — a club's *Grant* beside a team's own — so publishing stopped
              deleting the duplicate, and this chip is what pays for that: without it a coach meets
              two identical rows and picks at random, splitting a season's history across both.
              ⚠ NEVER COLOUR ALONE. Each chip carries its word, because this list renders in a warm
              theme and a dark one and the three tiers must survive both. */}
          {(() => {
            const tier = budgetItemTier({ org_id: row.item.orgId, team_id: row.item.teamId });
            return (
              <span className={`${styles.optTier} ${styles[`tier_${tier}`]}`}>
                {ITEM_TIER_LABEL[tier]}
              </span>
            );
          })()}
        </button>,
      );
    });
    return out;
  }

  return (
    <div className={styles.picker}>
      {!addingItem && !addingCategory && (
        <div className={styles.comboWrap}>
          <input
            ref={inputRef}
            id={selectId}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-label="Category and item"
            autoComplete="off"
            disabled={disabled}
            className={`${styles.input} ${invalid ? styles.inputBad : ''} ${(value?.itemId || selectedLead) && !open ? styles.inputChosen : ''}`}
            placeholder={leadGroup && leadGroup.options.length > 0
              ? 'Search a bill you owe, or what the cost was for'
              : direction === 'in'
                ? 'Search what this is — e.g. “sponsorship”, “grant”'
                : 'Search what this is — e.g. “diamond”, “entry”'}
            value={open ? query : (selectedLabel || query)}
            onChange={e => { setQuery(e.target.value); openDropdown(); setActiveIdx(-1); }}
            onFocus={() => { setQuery(''); openDropdown(); }}
            /* ⚠ THE QUERY CLEARS ON THE WAY OUT. Typing "dom" and then clicking away left the box
               reading "dom" with nothing actually selected — a control that looks answered and
               isn't, which is the exact failure the old two-select version could not have. The
               delay lets a click on an option land first (`choose` clears it anyway), and the
               create flow copies the query into its own field synchronously before this fires. */
            onBlur={() => setTimeout(() => { setOpen(false); setQuery(''); }, 150)}
            onKeyDown={onKeyDown}
          />
          {open && (
            <div id={listboxId} className={`${styles.dropdown} ${dropUp ? styles.dropdownUp : ''}`} role="listbox">
              {renderLeadOptions()}
              {matches.length > 0 && renderOptions()}
              {/* ⚠ "Nothing matches" must not appear while the lead group HAS a match — typing a
                  bill's name legitimately empties the item half, and saying the search found
                  nothing above a row it plainly found is the control calling itself a liar. */}
              {matches.length === 0 && leadMatches.length === 0 && (
                <div className={styles.dropEmpty}>
                  {q
                    ? <>Nothing on this side matches “{query.trim()}”.</>
                    : <>Your list has no words for {SIDE_WORD[direction]} yet.</>}
                </div>
              )}
              {canCreate && (
                <button
                  type="button"
                  className={`${styles.opt} ${styles.optCreate} ${activeIdx === leadMatches.length + matches.length ? styles.optActive : ''}`}
                  onMouseDown={e => e.preventDefault()}
                  onClick={startCreate}
                >
                  + Add “{query.trim()}” to your list
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Inline custom-category form */}
      {addingCategory && (
        <div className={styles.addForm}>
          <div className={styles.addFormRow}>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label}>Category name</label>
              <input
                className={styles.input}
                type="text"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value.slice(0, 80))}
                placeholder="e.g. Sponsorships"
                maxLength={80}
                autoFocus
                disabled={catSaving}
              />
            </div>
          </div>
          {catError && <p className={styles.error}>{catError}</p>}
          <div className={styles.addFormActions}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setAddingCategory(false); setAddingItem(true); setCatError(''); }}
              disabled={catSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-lime"
              onClick={handleSaveCustomCategory}
              disabled={catSaving || !newCatName.trim()}
            >
              {catSaving ? 'Saving…' : 'Add Category'}
            </button>
          </div>
          <p className={styles.hint}>
            This category will be saved to your org&apos;s library and become selectable for all coaches.
          </p>
        </div>
      )}

      {/* Inline custom-item form.
          ⚠ IT CARRIES ITS OWN CATEGORY SELECT NOW. With one search box above, there is no longer a
          category control for it to inherit from — and an item belongs to exactly one category, so
          the question has to be asked somewhere. */}
      {addingItem && (
        <div className={styles.addForm}>
          <div className={styles.addFormRow}>
            <div className={styles.field} style={{ flex: 2 }}>
              <label className={styles.label}>Item name</label>
              <input
                className={styles.input}
                type="text"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value.slice(0, 80))}
                placeholder="e.g. Batting Cage Rental"
                maxLength={80}
                autoFocus
                disabled={saving}
              />
            </div>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label}>Suggested $ <span className={styles.optional}>(optional)</span></label>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="0.01"
                value={newItemAmount}
                onChange={e => setNewItemAmount(e.target.value)}
                placeholder="0.00"
                disabled={saving}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Category</label>
            <select
              className={styles.select}
              value={newItemCatId}
              onChange={e => {
                if (e.target.value === '__addcat__') {
                  setAddingItem(false);
                  setAddingCategory(true);
                  setNewCatName('');
                  setCatError('');
                  return;
                }
                setNewItemCatId(e.target.value);
              }}
              disabled={saving}
            >
              <option value="">— select category —</option>
              {localCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              {allowCreateCategory && <option value="__addcat__">+ Add custom category…</option>}
            </select>
          </div>
          {/* ⚠⚠ THE SIDE IS STATED, NOT ASKED (mig 246). It comes from the control this was opened
              from — the coach was already recording an expense, or already on an income line — so
              asking again would be asking them to answer a question they have just answered, and
              getting a different answer is how a word ends up somewhere they cannot find it. */}
          <p className={styles.sideNote}>
            Saved as <strong>{SIDE_WORD[direction]}</strong> — because that is what you are recording.
            {manageHint ? ` ${manageHint}` : ''}
          </p>
          {saveError && <p className={styles.error}>{saveError}</p>}
          <div className={styles.addFormActions}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setAddingItem(false); setSaveError(''); }}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-lime"
              onClick={handleSaveCustomItem}
              disabled={saving || !newItemName.trim() || !newItemCatId}
            >
              {saving ? 'Saving…' : 'Add Item'}
            </button>
          </div>
          <p className={styles.hint}>
            {/* ⚠ THIS SENTENCE WAS A LIE FROM THE MOMENT mig 240 SHIPPED, and it is the exact copy
                two separate code comments predicted would be missed. A coach's item belongs to
                THEIR TEAM now and appears in no other team's list until a club admin publishes it;
                an admin's belongs to the club from the start. */}
            {createItemMode === 'coach'
              ? 'This item is saved to this team’s list — no other team will see it unless your club chooses to share it.'
              : 'This item will be saved to your org’s library and become selectable for all coaches.'}
          </p>
        </div>
      )}
    </div>
  );
}
