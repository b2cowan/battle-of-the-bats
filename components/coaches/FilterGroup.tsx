'use client';
import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
  type FocusEvent, type ReactNode,
} from 'react';
import { ChevronDown, X } from 'lucide-react';
import { rescueFocusTo, useDismissable } from '@/lib/overlay-hooks';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import LineupSheetScrim from './LineupSheetScrim';
import pill from '../shared/FilterPill.module.css';
import menu from './CoachToolbarMenu.module.css';
import styles from './FilterGroup.module.css';

/**
 * A strip's NARROWING pills — as pills on a desk, behind ONE Filter button and a sheet on a phone
 * (Ledger Phone Filter, owner rulings D1–D7, 2026-10-02 — hub https://claude.ai/artifact/9MkS5tTMA7RvytnUXCsVdx,
 * plan docs/projects/active/LEDGER_PHONE_FILTER_PLAN.md).
 *
 * The coach's Ledger toolbar is sticky at every width, so on a 390px phone its five pills (two lines, plus
 * Cash on hand on a third) were 207px of every screen the coach scrolled. A single Filters button was
 * declined for this Ledger at DESKTOP size (2026-09-02, Option C): it puts a tap between the coach and
 * every filter and hides their state behind a count. Both costs still hold on a desk, which is why the
 * pills stay there (D1); on a phone, three pinned lines cost more than the tap.
 *
 * ⚠ BOTH FORMS RENDER AND THE STYLESHEET DECIDES (`useIsPhone`'s own rule for anything server-rendered):
 * the pills in a `display: contents` box hidden at ≤640, the Filter trigger in a root hidden above it. No
 * first-paint flash of the wrong form, no hydration branch. The desk pills stay MOUNTED on a phone — they
 * are what tells the button how many filters are on.
 *
 * ⚠ ONE PILL, TWO FORMS, THROUGH CONTEXT. A pill inside the desk box REGISTERS with the group (is it off
 * its rest, and how to put it back — D3's count and D6's Reset). The SAME pill element rendered inside the
 * sheet reads `mode: 'row'` and draws itself as a `FilterSheetRow` instead. A pill outside any group is
 * exactly what it always was: Budget, BvA, Dues, Awards and the practice library never see this.
 *
 * Only NARROWINGS go in a group. View (the arrangement) stays in the deck, and Open all / Fold all is a
 * verb beside the button, not a filter.
 */

type Mode = 'pill' | 'row';
interface FilterGroupApi {
  mode: Mode;
  /** Pill mode only: report whether this filter is off its rest, and how to put it back. Returns the unregister. */
  register: (key: string, narrowed: boolean, reset: () => void) => () => void;
  /** Row mode only: which row of the sheet is open (one at a time, D2). */
  openKey: string | null;
  setOpenKey: (key: string | null) => void;
}
const FilterGroupContext = createContext<FilterGroupApi | null>(null);
const noopRegister = () => () => {};
/** The button's word, the sheet's title and its accessible name — one spelling. */
const FILTER = 'Filter';

/**
 * A pill's membership: registers it (pill mode) and tells it which form to draw. Null outside a group.
 * `narrowed` = off the filter's RESTING state, not merely non-empty — the Status filter rests on a
 * deliberate subset, and a Ledger opened fresh must read a quiet "Filter" (D3).
 */
export function useFilterGroupMember(key: string, narrowed: boolean, reset: () => void): FilterGroupApi | null {
  const group = useContext(FilterGroupContext);
  // The latest reset, without re-registering on every render of the host.
  const resetRef = useRef(reset);
  useEffect(() => { resetRef.current = reset; });
  const register = group?.mode === 'pill' ? group.register : null;
  useEffect(() => {
    if (!register) return;
    return register(key, narrowed, () => resetRef.current());
  }, [register, key, narrowed]);
  return group;
}

/** One filter as a row of the phone sheet: its name, what it is set to, and — open — its own choices. */
export function FilterSheetRow({ name, value, lit, children }: {
  name: string;
  value: ReactNode;
  /** Off its rest: the value wears the lit ink, the same one the pill's tint uses. */
  lit: boolean;
  /** The pill's own panel content. */
  children: ReactNode;
}) {
  const group = useContext(FilterGroupContext);
  const choicesId = useId();
  const open = group?.openKey === name;
  return (
    <div className={styles.row}>
      <button
        type="button"
        className={menu.item}
        aria-expanded={open}
        aria-controls={open ? choicesId : undefined}
        onClick={() => group?.setOpenKey(open ? null : name)}
      >
        <span className={`${menu.itemText} ${styles.rowText}`}>
          <span className={menu.itemLabel}>{name}</span>
          <span className={`${menu.itemHint}${lit ? ` ${styles.lit}` : ''}`}>{value}</span>
        </span>
        <ChevronDown size={16} aria-hidden className={`${styles.chevron}${open ? ` ${styles.chevronOpen}` : ''}`} />
      </button>
      {open && <div id={choicesId} role="group" aria-label={name} className={styles.choices}>{children}</div>}
    </div>
  );
}

export default function FilterGroup({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [narrowed, setNarrowed] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const resets = useRef(new Map<string, () => void>());
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const register = useCallback((key: string, isNarrowed: boolean, reset: () => void) => {
    resets.current.set(key, reset);
    setNarrowed(prev => (prev.get(key) === isNarrowed ? prev : new Map(prev).set(key, isNarrowed)));
    return () => {
      resets.current.delete(key);
      setNarrowed(prev => {
        if (!prev.has(key)) return prev;
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    };
  }, []);
  const count = [...narrowed.values()].filter(Boolean).length;

  /* The sheet belongs to the phone band. A width that leaves it (a phone turned on its side) closes the
     sheet rather than leaving it open, unseen, to reappear on the way back. */
  const isPhone = useIsPhone();
  const [wasPhone, setWasPhone] = useState(isPhone);
  if (wasPhone !== isPhone) {
    setWasPhone(isPhone);
    if (!isPhone) { setOpen(false); setOpenKey(null); }
  }
  const sheetOpen = open && isPhone;

  const close = useCallback(() => { setOpen(false); setOpenKey(null); }, []);
  // Click-away closes; Escape closes AND hands focus back to the button — the hook's own default, since the
  // button is what held focus when the sheet opened (this hook's effect runs before the first-row focus below).
  useDismissable(sheetOpen, rootRef, close);

  // Focus lands on the first row, so the keyboard starts inside the sheet it opened.
  useEffect(() => {
    if (sheetOpen) sheetRef.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }, [sheetOpen]);

  /* Tab past the sheet's last control closes it — a sheet left open behind the focus covers what the
     keyboard is now on. Only a REAL destination outside counts: a tap on the sheet's own blank space moves
     focus to nothing (relatedTarget null), and must not close it. */
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const to = event.relatedTarget as Node | null;
    if (sheetOpen && to && !rootRef.current?.contains(to)) close();
  };

  const pillApi = useMemo<FilterGroupApi>(() => ({ mode: 'pill', register, openKey: null, setOpenKey: () => {} }), [register]);
  const rowApi = useMemo<FilterGroupApi>(() => ({ mode: 'row', register: noopRegister, openKey, setOpenKey }), [openKey]);

  return (
    <>
      <div className={styles.pills}>
        <FilterGroupContext.Provider value={pillApi}>{children}</FilterGroupContext.Provider>
      </div>
      {/* ⚠ The scrim renders INSIDE `rootRef`, the element `useDismissable` watches — a sibling scrim let a
          touch dismissal fall through to the control underneath (CoachToolbarMenu's `drawerOnPhone`). */}
      <div ref={rootRef} className={styles.phone} onBlur={onBlur} data-escape-owner={sheetOpen ? '' : undefined}>
        <button
          ref={triggerRef}
          type="button"
          className={`${pill.multiSelectSummary} ${styles.trigger}${count ? ` ${pill.multiSelectActive}` : ''}`}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          aria-label={count ? `${FILTER}, ${count} on` : FILTER}
          onClick={() => (open ? close() : setOpen(true))}
        >
          <span className={pill.multiSelectLabel}>{FILTER}</span>
          {count > 0 && <span className={`${pill.multiSelectValue} ${styles.count}`} aria-hidden>{count}</span>}
          <ChevronDown size={14} aria-hidden />
        </button>
        {sheetOpen && <LineupSheetScrim onClose={close} />}
        {sheetOpen && (
          /* The Tools sheet's own drawer (E1) — not a menu: it holds checkboxes and date fields, so it is a
             dialog, and picking a choice does not close it (D7: the list updates behind it). Modal, as every
             scrim-backed dialog in the portal is: the page behind is dimmed AND out of a screen reader's reach;
             Tab leaving the sheet closes it (onBlur above), so focus never sits behind it. */
          <div ref={sheetRef} className={`${menu.panel} ${menu.drawer}`} role="dialog" aria-modal="true" aria-label={FILTER}>
            <div className={menu.drawerTitle}>{FILTER}</div>
            <FilterGroupContext.Provider value={rowApi}>{children}</FilterGroupContext.Provider>
            {/* D6: only while something is on, and back to REST — Status to its resting pair, the date to its
                resting window — never to "All". */}
            {count > 0 && (
              <div className={styles.foot}>
                <button
                  type="button"
                  className={`${menu.item} ${styles.reset}`}
                  onClick={() => { resets.current.forEach(reset => reset()); close(); rescueFocusTo(triggerRef); }}
                >
                  <X size={15} aria-hidden />
                  <span className={menu.itemLabel}>Reset filters</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
