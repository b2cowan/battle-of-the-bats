'use client';
import { useMemo, useRef, useState } from 'react';
import { Settings2, User, X } from 'lucide-react';
import TagManagerDrawer, { type TagManagerPolicy } from '@/components/coaches/TagManagerDrawer';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { claimEscape } from './escapeOwnership';

/**
 * The minimal tag shape the picker (and the drawer) actually read — structural, so both
 * `RepTeamTag` and the pickers' lighter `PickableTag` satisfy it without conversion.
 * `teamId` absent/undefined means "the team's own" (only real library rows carry the org-shared
 * NULL); `count` rides in from the library GET and is read by the MANAGER only (owner ruling).
 */
export interface ComboTag {
  id: string;
  name: string;
  teamId?: string | null;
  count?: number;
  /** Awards only — undefined for every other library (rename edits name + icon together). */
  emoji?: string | null;
  /** Awards only — undefined for every other library. false = retired (TagManagerList's
   *  merge-or-retire policy groups it below the active rows with a Restore control). */
  isActive?: boolean;
  /** Staff only (mig 303) — the person this word IS. A chip wears the person mark when set. */
  userId?: string | null;
}

/** One of the team's staff for the picker's "People on this team" group (mig 303) — `tagId` is this
 *  team's word for them when one exists; picking selects it, else mints one linked (`onPickPerson`). */
export interface ComboPerson {
  userId: string;
  name: string;
  kindWord: string;
  tagId: string | null;
}

/**
 * The door + drawer a picker carries (One Tag Idiom P2, owner-ruled 2026-09-01): "Manage tags…"
 * as the dropdown's LAST row — the one contextual door, findable exactly where a coach is
 * thinking about tags and costing the toolbar nothing. The combobox hosts the drawer itself so a
 * call site adopts the whole behaviour with ONE prop and can never wire the door without the
 * drawer. The host's library refresh rides the SEPARATE `onManageChanged` prop — a DIRECT JSX
 * prop, deliberately: the react-hooks refs lint treats only direct props as event handlers, and
 * a ref-reading loader inside an object member is flagged as a render-time ref access. The
 * drawer re-reads its own counted list, but the HOST's chips render from the host's copy, and a
 * renamed tag must rename on the open form too — pass the refresh, always.
 */
export interface TagManageConfig {
  teamId: string;
  basePath: string;
  /** The library's name — the drawer's title ("Money tags", "Game tags"). */
  title: string;
  /** Singular noun for the drawer's merge sentence. */
  itemNoun: string;
  countNoun?: (n: number) => string;
  /**
   * The door row's label. Default "Manage tags…" — kept wherever the FIELD is labelled Tags
   * (owner amendment 2026-09-02 to the Q6 one-door ruling): the door completes its field's own
   * sentence, so a field labelled Staff or Equipment names its door after itself rather than
   * borrowing "tags". One grammar — "Manage {what the field holds}…" — never free-hand names.
   */
  door?: string;
  /** The drawer's per-library knobs — the staff library declares `people` here (see `TagManagerPolicy`). */
  policy?: TagManagerPolicy;
}

/** The money-tag manage WORDS — six call sites, one spelling (Q6: one door, one title). Spread
 * into an inline literal (never built through a helper CALL — the react-hooks refs lint flags a
 * render-time call that receives a closure over a ref-reading loader):
 * `manage={{ ...MONEY_TAG_MANAGE, teamId, basePath }} onManageChanged={refresh}` */
export const MONEY_TAG_MANAGE = { title: 'Money tags', itemNoun: 'expense' } as const;
export const GAME_TAG_MANAGE = { title: 'Game tags', itemNoun: 'game' } as const;
/** The practice vocabularies' manage WORDS (P3) — same one-spelling home as the money const. */
export const FOCUS_TAG_MANAGE = { title: 'Focus tags', itemNoun: 'drill, template or focus area' } as const;
export const STAFF_TAG_MANAGE = { title: 'Staff', itemNoun: 'plan', door: 'Manage staff…', policy: { people: true } } as const;
export const EQUIPMENT_TAG_MANAGE = { title: 'Equipment', itemNoun: 'plan or drill', door: 'Manage equipment…' } as const;
/** Awards join the idiom (Part B) — not through this combobox (R3: the chip row stays the
 *  picker), but through the same door/drawer words every other library uses. */
export const AWARD_TAG_MANAGE = {
  title: 'Awards', itemNoun: 'award', door: 'Manage awards…',
  countNoun: (n: number) => `given ${n} time${n === 1 ? '' : 's'}`,
} as const;

/**
 * THE tag picker (One Tag Idiom P2–P3 — money, game, focus, staff, equipment: one component, one
 * grammar). A search box + type-ahead dropdown filtered against an already-loaded library (zero
 * per-keystroke API calls); only the SELECTED tags render as chips, so a large library never
 * floods the form. Colour distinguishes an org-shared tag (blue, teamId === null) from the
 * team's own (olive/lime), with a one-line legend.
 *
 * ⚠ **A NEW TAG IS ONLY MINTED ON AN EXPLICIT ACT** (owner ruling 2026-08-01): typing SEARCHES;
 * creating takes a second, deliberate press on the "+ Create" row. `onCreate` performs the
 * request and returns the new tag (or null on failure — the caller surfaces its own error).
 *
 * ⚠ **`single` mode is for a FOCUS AREA, and the asymmetry is deliberate** (2026-08-01): a focus
 * area is free text first and carries ONE grouping tag purely so the rail can match it; drills,
 * templates and plans carry several. Do not "make them consistent".
 *
 * ⚠ **Adopt rows** (`adoptNames`/`onAdopt`): a legacy free-text name from before a field had a
 * real library renders as its own dropdown row — one explicit press mints it, the same
 * deliberateness every other new tag gets, never a silent import.
 */
export default function TagSearchCombobox({
  library,
  selectedIds,
  onChange,
  onCreate,
  countById,
  placeholder = 'Type to find or create a tag…',
  disabled = false,
  showLegend = true,
  single = false,
  adoptNames,
  onAdopt,
  manage,
  onManageChanged,
  autoFocus = false,
  people,
  onPickPerson,
}: {
  library: readonly ComboTag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreate?: (name: string) => Promise<ComboTag | null>;
  countById?: Record<string, number>;
  placeholder?: string;
  disabled?: boolean;
  showLegend?: boolean;
  /** Focus (and bring into view) the search box on mount — a door the coach just opened via a
   *  quiet link elsewhere on the sheet (owner catch, 2026-09-15: opening Staff on a block already
   *  carrying a drill left the newly-shown field off the top of the screen with no signal it had
   *  opened at all). Only ever true on a picker's first render with nothing selected yet. */
  autoFocus?: boolean;
  /* ⚰⚰ `addAsChip` WAS DECLARED HERE AND IS DELETED (List · Room · Question Phase C, 2026-09-04;
     mockup R1, owner-flagged 2026-09-02 — a NAMED REVERSAL of the §114 walk tweak of 2026-08-27).
     It hid this control's search box behind a `＋` chip so the bill's fields block would cost one
     row less: sound while that block sat at the top of a PAGE a coach was mostly reading.
     It had exactly ONE call site in the entire product, which is what makes it a reversal rather
     than a tidy-up — one field on one screen behaved unlike every other tag picker a coach meets,
     and the room's own layout removed the pressure that bought the exception.
     ⚠ DELETED, NOT LEFT UNUSED. An opt-in nobody opts into is an invitation to a second exception;
     the CSS that served it (`.tagComboAdd`) went in the same pass. Do not re-add it without a
     ruling of its own. */
  /** ONE tag, replaced on pick; the input hides while one is chosen (the focus-area shape). */
  single?: boolean;
  /** Legacy free-text names with no library match — each renders a one-press adopt row. */
  adoptNames?: readonly string[];
  onAdopt?: (name: string) => void | Promise<void>;
  /** The manage door + drawer (see `TagManageConfig` above). Omit on a read-only surface. */
  manage?: TagManageConfig;
  /** The host's library refresh after a drawer act — REQUIRED with `manage` (see the doc above). */
  onManageChanged?: () => void;
  /**
   * The staff picker's FIRST group (mig 303; finishes Practice Plans D12, "team coaches offered
   * automatically"): every staff member this season with their word, ahead of the team's other
   * words. Picking a person whose word exists selects it; picking one with none mints it linked
   * (`onPickPerson`) — a word, still, never a grant. A linked word lists ONLY here, as the person,
   * never again under the words below it.
   */
  people?: readonly ComboPerson[];
  onPickPerson?: (person: ComboPerson) => Promise<ComboTag | null>;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [creating, setCreating] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [fresh, setFresh] = useState<ComboTag[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * ⚠⚠ SIX MONEY SURFACES EACH HOLD THEIR OWN COPY OF THIS LIBRARY, and the hub keeps panels
   * mounted — so a tag minted on the Fundraising form was invisible to the Ledger's picker until
   * that panel's next full load (owner-found, 2026-09-02: "after creating a tag I don't see it
   * on the list"). The fix is the drawer's own rule brought to the picker: ON OPEN, re-read the
   * library from `manage.basePath` — no host can starve it, whatever copy it was handed.
   * UNION with the prop (host-only additions survive: a create appends host-side before this
   * fetch could know it; fresh-only rows cover the stale-host direction). The one bias: a tag
   * deleted ELSEWHERE lingers from the stale host copy until that host reloads — offering is
   * harmless, the write routes refuse dead ids. Requires `manage` (its basePath); a picker
   * without a door keeps prop-only behaviour.
   */
  async function refreshLibrary() {
    if (!manage) return;
    try {
      const res = await fetch(manage.basePath);
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.tags)) setFresh(data.tags as ComboTag[]);
    } catch { /* offline — the prop copy keeps the picker usable */ }
  }

  // Open the dropdown, flipping it ABOVE the input when there isn't room below (e.g. the Tags
  // field at the bottom of a scrollable modal, where a downward menu would be clipped by the
  // modal's scroll area / hidden behind the sticky footer).
  // ⚠ "Room below" is measured against the NEAREST CLIPPING BOX, not just the window (owner-found
  // 2026-09-20: the practice sheet's station modal is centred and content-sized, so its last field
  // — Staff — can sit 300px above the window's bottom and 20px above its scroll pane's; the window
  // said "plenty of room" and the menu was stuffed into the pane's scroll). Every ancestor whose
  // overflow-y is not `visible` clips or scrolls, and the tightest of them bounds the menu in both
  // directions. The menu is absolute, so a host that clips is a host the menu cannot leave — a
  // card that must hold one does not `overflow: hidden` (see `.ppTlOpen`).
  function openDropdown() {
    const el = inputRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      let top = 0, bottom = window.innerHeight;
      for (let n = el.parentElement; n; n = n.parentElement) {
        if (getComputedStyle(n).overflowY === 'visible') continue;
        const r = n.getBoundingClientRect();
        top = Math.max(top, r.top);
        bottom = Math.min(bottom, r.bottom);
      }
      setDropUp(bottom - rect.bottom < 250 && rect.top - top > 260);
    }
    setOpen(true);
    void refreshLibrary();
  }

  // The working library: fresh-by-id first (it carries counts), host-only rows kept (see above).
  const lib = useMemo(() => {
    if (!fresh) return library;
    const m = new Map(fresh.map(t => [t.id, t] as const));
    for (const t of library) if (!m.has(t.id)) m.set(t.id, t);
    return [...m.values()];
  }, [fresh, library]);

  const byId = useMemo(() => new Map(lib.map(t => [t.id, t])), [lib]);
  const q = query.trim().toLowerCase();

  // The people group: everyone not already picked (by their word), filtered on their name OR their
  // word — a coach who types "jen" finds Jen Okafor whether her tag says "Jen" or "Coach O".
  const peopleRows = useMemo(() => {
    if (!people?.length) return [];
    const tagName = (id: string | null) => (id ? byId.get(id)?.name.toLowerCase() ?? '' : '');
    return people.filter(p =>
      !(p.tagId && selectedIds.includes(p.tagId))
      && (!q || p.name.toLowerCase().includes(q) || tagName(p.tagId).includes(q)));
  }, [people, byId, selectedIds, q]);
  const personTagIds = useMemo(() => new Set((people ?? []).map(p => p.tagId).filter((id): id is string => !!id)), [people]);

  const matches = useMemo(
    () => lib
      .filter(t => !selectedIds.includes(t.id) && !personTagIds.has(t.id) && t.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8),
    [lib, selectedIds, personTagIds, q],
  );
  const exact = lib.some(t => t.name.toLowerCase() === q);
  const canCreate = !!onCreate && q.length > 0 && !exact;
  const adoptable = useMemo(
    () => (onAdopt && adoptNames?.length
      ? adoptNames.filter(n => !q || n.toLowerCase().includes(q)).slice(0, 6)
      : []),
    [adoptNames, onAdopt, q],
  );
  // Keyboard order mirrors the rendered order: people → matches → create → adopt rows → the door.
  const matchStart = peopleRows.length;
  const createIdx = matchStart + matches.length;
  // The two group labels read only when BOTH groups show — people over one list is not two headings.
  const showGroupLabels = matches.length > 0 || canCreate || adoptable.length > 0;
  const adoptStart = createIdx + (canCreate ? 1 : 0);
  const manageIdx = adoptStart + adoptable.length;
  const optionCount = manageIdx + (manage ? 1 : 0);

  function selectTag(id: string) {
    onChange(single ? [id] : [...selectedIds, id]);
    setQuery('');
    setActiveIdx(-1);
    if (!single) inputRef.current?.focus();
    else setOpen(false);
  }

  /** A person: their word if the team has one, else mint one linked to them and pick that. */
  async function pickPerson(person: ComboPerson) {
    if (person.tagId && byId.has(person.tagId)) { selectTag(person.tagId); return; }
    if (!onPickPerson || creating) return;
    setCreating(true);
    try {
      const tag = await onPickPerson(person);
      if (tag) {
        setFresh(prev => (prev && !prev.some(t => t.id === tag.id) ? [...prev, tag] : prev));
        selectTag(tag.id);
      }
    } finally {
      setCreating(false);
    }
  }

  function removeTag(id: string) {
    onChange(selectedIds.filter(x => x !== id));
  }

  async function createTag() {
    if (!onCreate || !q || creating) return;
    setCreating(true);
    try {
      const tag = await onCreate(query.trim());
      if (tag) {
        // Fold the mint into our fresh copy too — the union must not lose it to a pre-create fetch.
        setFresh(prev => (prev && !prev.some(t => t.id === tag.id) ? [...prev, tag] : prev));
        onChange(single ? [tag.id] : [...selectedIds, tag.id]);
        setQuery('');
        setActiveIdx(-1);
        if (!single) inputRef.current?.focus();
        else setOpen(false);
      }
    } finally {
      setCreating(false);
    }
  }

  function openManager() {
    setOpen(false);
    setActiveIdx(-1);
    setManagerOpen(true);
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
      if (activeIdx >= 0 && activeIdx < matchStart) void pickPerson(peopleRows[activeIdx]);
      else if (activeIdx >= matchStart && activeIdx < matchStart + matches.length) selectTag(matches[activeIdx - matchStart].id);
      else if (activeIdx === createIdx && canCreate) createTag();
      else if (activeIdx >= adoptStart && activeIdx < adoptStart + adoptable.length) void onAdopt?.(adoptable[activeIdx - adoptStart]);
      else if (activeIdx === manageIdx && manage) openManager();
      else {
        // No highlight: pick an exact match if there is one, otherwise create.
        const m = lib.find(t => t.name.toLowerCase() === q);
        if (m && !selectedIds.includes(m.id)) selectTag(m.id);
        else if (canCreate) createTag();
      }
    } else if (e.key === 'Escape' && open) {
      /* Only while the list is open — a closed combobox lets Escape reach the dialog. See
         `escapeOwnership.ts`; this claim is what keeps the drive/sponsor room open around it. */
      claimEscape(e);
      setOpen(false);
    }
  }

  const selected = selectedIds.map(id => byId.get(id)).filter((t): t is ComboTag => !!t);

  /* In `single` mode the input hides while a tag is chosen — one value, one chip (the focus-area
     shape). Everywhere else the search box is always there, which is the shape every other field
     in the portal has. */
  const full = single && selected.length > 0;
  const showInput = !disabled && !full;

  return (
    /* ⚠ SAME CONTRACT AS THE FILES-UNDER PICKER (§134 walk): while the suggestion list is open this
       subtree owns Escape, so `useDialogFloor` stands down and the drive/sponsor room around it
       stays open. This combobox had the defect in a worse form — its Escape branch ran even with
       the list CLOSED, so it swallowed nothing and closed the room every time. */
    <div className={styles.tagCombo} data-escape-owner={open ? '' : undefined}>
      {selected.length > 0 && (
        <div className={styles.tagComboChips}>
          {selected.map(tag => {
            const isOrg = tag.teamId === null;
            return (
              <span key={tag.id} className={styles.tagComboChip}>
                {/* The chip itself is one flat pill regardless of whose tag it is (owner ruling
                    2026-09-15); this dot is what used to be the chip's whole fill colour — the
                    same dot the dropdown's own rows below already wear. */}
                <span className={`${styles.tagComboDot} ${isOrg ? styles.tagComboDotOrg : styles.tagComboDotOwn}`} aria-hidden />
                {/* The person mark (mig 303): this word IS someone on the staff. */}
                {tag.userId && <User size={11} aria-label="Linked to a person" className={styles.tagComboPerson} />}
                {tag.name}
                {!disabled && (
                  <button type="button" className={styles.tagComboChipX} aria-label={`Remove ${tag.name}`} onClick={() => removeTag(tag.id)}>
                    <X size={11} />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {showInput && (
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            placeholder={placeholder}
            autoComplete="off"
            autoFocus={autoFocus}
            onChange={e => { setQuery(e.target.value); openDropdown(); setActiveIdx(-1); }}
            onFocus={openDropdown}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKeyDown}
          />
          {open && (query.length > 0 || peopleRows.length > 0 || matches.length > 0 || adoptable.length > 0 || !!manage) && (
            <div className={`${styles.tagComboDropdown} ${dropUp ? styles.tagComboDropdownUp : ''}`}>
              {peopleRows.length > 0 && (
                /* The people first (mig 303). The group labels read only when both groups show,
                   so a picker with people and no other words is not two headings over one list. */
                <>
                  {showGroupLabels && <div className={styles.tagComboGroup}>People on this team</div>}
                  {peopleRows.map((p, i) => (
                    <button
                      type="button"
                      key={`person-${p.userId}`}
                      className={`${styles.tagComboOpt} ${i === activeIdx ? styles.tagComboOptActive : ''}`}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => void pickPerson(p)}
                      disabled={!p.tagId && !onPickPerson}
                    >
                      <span className={styles.tagComboOptName}>
                        <User size={12} aria-hidden className={styles.tagComboPerson} />
                        {p.name}
                        {p.tagId && byId.get(p.tagId) && byId.get(p.tagId)!.name.toLowerCase() !== p.name.toLowerCase() && (
                          <span className={styles.tagComboWord}>“{byId.get(p.tagId)!.name}”</span>
                        )}
                      </span>
                      <span className={styles.tagComboCount}>{p.kindWord}</span>
                    </button>
                  ))}
                  {showGroupLabels && <div className={styles.tagComboGroup}>Other names</div>}
                </>
              )}
              {matches.map((t, i) => {
                const isOrg = t.teamId === null;
                const n = countById?.[t.id];
                return (
                  <button
                    type="button"
                    key={t.id}
                    className={`${styles.tagComboOpt} ${matchStart + i === activeIdx ? styles.tagComboOptActive : ''}`}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => selectTag(t.id)}
                  >
                    <span className={styles.tagComboOptName}>
                      <span className={`${styles.tagComboDot} ${isOrg ? styles.tagComboDotOrg : styles.tagComboDotOwn}`} />
                      {t.name}
                    </span>
                    {n != null && <span className={styles.tagComboCount}>{n} tagged</span>}
                  </button>
                );
              })}
              {canCreate && (
                <button
                  type="button"
                  className={`${styles.tagComboOpt} ${styles.tagComboCreate} ${activeIdx === createIdx ? styles.tagComboOptActive : ''}`}
                  onMouseDown={e => e.preventDefault()}
                  onClick={createTag}
                >
                  {creating ? 'Creating…' : `+ Create “${query.trim()}”`}
                </button>
              )}
              {adoptable.map((name, i) => (
                /* A word typed before this field had a real library — one press moves it in, the
                   same deliberate act as any other new tag, entered from an old record's door. */
                <button
                  type="button"
                  key={`adopt-${name}`}
                  className={`${styles.tagComboOpt} ${styles.tagComboCreate} ${activeIdx === adoptStart + i ? styles.tagComboOptActive : ''}`}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => void onAdopt?.(name)}
                >
                  + Create “{name}” (from an old record)
                </button>
              ))}
              {peopleRows.length === 0 && matches.length === 0 && !canCreate && adoptable.length === 0 && !manage && (
                <div className={styles.tagComboEmpty}>No matching tags</div>
              )}
              {manage && (
                /* The one contextual door (Q2) — a door out, not a tag: paper ground, support
                   ink, and shown even over an empty library (the drawer's empty state teaches).
                   onMouseDown preventDefault keeps focus on the input, so the drawer's
                   focus-restore hands the coach straight back to where they were typing. */
                <button
                  type="button"
                  className={`${styles.tagComboOpt} ${styles.tagComboManage} ${activeIdx === manageIdx ? styles.tagComboOptActive : ''}`}
                  onMouseDown={e => e.preventDefault()}
                  onClick={openManager}
                >
                  <Settings2 size={13} aria-hidden /> {manage.door ?? 'Manage tags…'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ⚠⚠ THE SWATCHES WEAR THE SHARED DOT CLASSES, NOT INLINE COLOURS (fixed 2026-08-26, owner
          walk). They were hand-written `rgba(var(--blueprint-blue-rgb) …)` / `--logic-lime-rgb`
          styles — and the warm gate remaps BOTH of those tokens to olive, so on cream this legend
          drew two identical olive squares and then labelled one of them shared. Worse than the
          dots beside it: an inline style cannot be reached by a theme override at all, so no
          amount of correcting `.tagComboDot*` would ever have fixed it. Same distinction, same
          classes, one place to change it. */}
      {showLegend && lib.some(t => t.teamId === null) && (
        <div className={styles.tagComboLegend}>
          <span className={styles.tagComboLegendItem}>
            <span className={`${styles.tagComboLegendDot} ${styles.tagComboDotOrg}`} />
            {/* "club", not "organization" — the drawer, the shelf and the coach portal's own Money
                vocabulary all say club; one thing, one word (2026-08-24 ruling; aligned P2). */}
            <span>Shared by your club</span>
          </span>
          <span className={styles.tagComboLegendItem}>
            <span className={`${styles.tagComboLegendDot} ${styles.tagComboDotOwn}`} />
            <span>Your team&rsquo;s own</span>
          </span>
        </div>
      )}

      {manage && managerOpen && (
        <TagManagerDrawer
          teamId={manage.teamId}
          tags={lib}
          basePath={manage.basePath}
          title={manage.title}
          itemNoun={manage.itemNoun}
          countNoun={manage.countNoun}
          policy={manage.policy}
          onClose={() => setManagerOpen(false)}
          onChanged={onManageChanged ?? (() => {})}
        />
      )}
    </div>
  );
}
