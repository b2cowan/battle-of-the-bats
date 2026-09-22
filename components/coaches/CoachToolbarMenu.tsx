'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useAnchoredMenu, useDismissable } from '@/lib/overlay-hooks';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import LineupSheetScrim from './LineupSheetScrim';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './CoachToolbarMenu.module.css';

/**
 * The coach portal's action menu — a button that opens a one-level list of things to do.
 *
 * This is the tournament admin's `ToolbarMenu` pattern brought across (page-level action ruling
 * 2026-08-13, plan §5.1), NOT a second menu invented beside it: same shared placement hooks
 * (`useAnchoredMenu` measures against the trigger, `useDismissable` closes on outside-click and
 * Escape), same one-level structure, same "click an item, the menu closes" behaviour.
 *
 * ⚠ IT IS A SEPARATE COMPONENT ON PURPOSE, and the reason is a hard conflict rather than taste:
 * the admin module pins its trigger to a 32px box with `!important` at ≤760px, which loses to
 * the coach portal's 44px phone tap floor that the rendered-layout sweep enforces. The ruling
 * resolves that FOR THE COACH PORTAL ONLY — the admin's convention is deliberately untouched, so
 * the two cannot share one stylesheet until that portal-wide control-height decision is taken.
 *
 * Geometry lives in classes here, never in inline styles on the callers — inline sizing on
 * header buttons is the exact drift vector the ruling's inventory named (plan §2.6).
 *
 * ⚠⚠ **IT DECLARES `role="menu"`, SO IT OWES THE KEYBOARD PATTERN THAT WORD PROMISES** (Phase 4a,
 * 2026-08-25 — recorded as a pre-existing Medium by the Phase 3 `/review` and fixed here because
 * it is portal-wide, not one screen's). A screen reader announces this as a menu the moment the
 * role is set; before this it answered to Escape and an outside click and to nothing else, so the
 * announcement was a promise the widget did not keep. Now:
 *
 *   · **Arrow keys rove**, wrapping top to bottom, over ENABLED items only — a disabled item is
 *     skipped rather than focused, which is what stops "Start from blank" trapping the roving
 *     cursor while a template is being created.
 *   · **Home / End** jump to the ends.
 *   · **Down / Up on a closed trigger** open it onto the first / last item.
 *   · **Tab closes the menu and hands focus back to the trigger**, so the browser's own Tab
 *     continues from there. Before this, Tab walked into the page BEHIND an open panel that
 *     stayed on screen — the gap that makes a `role="menu"` a trap rather than a menu.
 *   · **Escape** was already right and is untouched: `useDismissable` closes and returns focus to
 *     whatever had it when the menu opened, guarding IME composition on the way.
 *
 * ⚠ Focus moves INTO the panel on open, mouse or keyboard alike. That is what makes the arrows
 * work without a first keystroke to "enter" the list, and it is why every item carries
 * `tabIndex={-1}` — a roving menu has ONE tab stop, the trigger.
 *
 * ⚠ `preventScroll` on every focus call here, because `useAnchoredMenu` places the panel one
 * `requestAnimationFrame` LATER, not in the mounting commit (corrected /review 2026-08-25 — the
 * first version of this comment said "the same commit", which is not what that hook does). The
 * panel has a sane CSS default so it is never unplaced, but a trigger low enough to need the
 * flip-above renders below the fold for one frame; letting focus scroll to it there would fight
 * the placement that is about to happen.
 */
export function CoachToolbarMenu({
  label,
  icon,
  disabled = false,
  variant = 'secondary',
  collapseOnPhone = false,
  bareOnPhone = false,
  drawerOnPhone = false,
  drawerTitle,
  open: openProp,
  onOpenChange,
  children,
}: {
  /** The button's words — a plain string, so it is also the accessible name. */
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  /**
   * `primary` wears the header's lime create geometry — for the ONE create a page offers when
   * that create has a choice inside it (house rule 6: two ways to make the same thing is one
   * button with a choice, not two buttons competing). Everything else stays `secondary`.
   *
   * `chip` is the trigger as a NAME PILL — the practice plan's groups room (stage 3 revision,
   * owner ruling D10, 2026-09-16), where a player's chip opens "Move to Group B · Not in a group".
   * The pill is the portal's `.ppChip` recipe with the tap floor on the touch widths; it drops
   * the chevron because a row of pills wearing chevrons reads as a row of selects. The keyboard
   * pattern above is the whole reason the chip is THIS component and not a second menu: Enter on
   * the chip is the phone-and-keyboard path to everything drag does.
   *
   * `glyph` is the trigger as ONE SYMBOL in a 44px box — no word, no chevron; `label` becomes its
   * accessible name and `icon` is what a coach sees (the Schedule's view menu beside "+" at ≤640,
   * phone re-evaluation stage 2 · C1, owner ruling 2026-09-21: "some calendar symbol … no chevron,
   * save the space"). Pass the CURRENT choice's glyph as `icon` so the one symbol says where you
   * are and that it switches. The rows are `checked` radio items.
   */
  variant?: 'secondary' | 'primary' | 'chip' | 'glyph';
  /**
   * House rule 3 — on a phone the words go and the symbol stays, with the label surviving as the
   * accessible name. Only for a trigger sitting in a page header, where the title one line above
   * says what is being created; a toolbar trigger has no such anchor and keeps its word.
   */
  collapseOnPhone?: boolean;
  /**
   * ⚠ Phone only: the symbol ALONE — the chevron goes with the word at ≤640, so the trigger is the
   * bare lime square the portal's every list uses as its add door (the Schedule's "+", owner
   * ruling 2026-09-21; its six-type menu is unchanged behind it). The desktop keeps the worded
   * trigger with its chevron. Meaningless without `collapseOnPhone`.
   */
  bareOnPhone?: boolean;
  /**
   * ⚠ **AT ≤640 THE PANEL IS A DRAWER, NOT A POPOVER** (phone re-evaluation stage 4 · E1, owner
   * 2026-09-22). It rises from the bottom nav's top with a grab line and dims the page behind it —
   * the form stage 3 · D13 settled for every phone panel in the portal the same morning. Pass this
   * wherever the trigger is a phone control whose menu is a list of things to DO; leave it off for a
   * desktop-shaped toolbar, and off for the `chip` variant, whose panel belongs beside its pill.
   *
   * ⚠⚠ **THE SCRIM RENDERS INSIDE `rootRef` — THE ELEMENT `useDismissable` WATCHES — AND THAT IS A
   * FIX, NOT A TIDY-UP.** A scrim rendered as a SIBLING of the watched element makes the dismiss
   * hook's `pointerdown` listener fire first, unmount the overlay, and let the following `click`
   * land on whatever the scrim was covering. Reproduced next door on 2026-09-22 under touch
   * emulation: dismissing the lineup builder's row menu pressed the button underneath and marked
   * the lineup READY — a state with no product path back, repaired in the database by hand. **A
   * mouse passed that test every single time; only touch showed it.** Inside the watched element
   * the hook reads the tap as "inside", never fires, and the scrim's own `onClick` closes cleanly.
   *
   * ⚠ And when you test a dismissal, assert on the STATE the control underneath would change — not
   * on whether an overlay appeared. The first probe next door reported "no fall-through" and was
   * wrong, because the fall-through pressed a button, and a button opens nothing.
   *
   * The band is ≤640 in JS as well as in CSS (`useIsPhone`), so the 641–900 popover — and the
   * sibling ≤900 drawer recipe the builder's own panels use — are both left exactly as they are.
   */
  drawerOnPhone?: boolean;
  /**
   * What the drawer calls itself — drawn only in drawer mode, and only because the scrim hides the
   * row that opened it (D12 gave the builder's drawers a title for the same reason). A desktop
   * popover hanging off a visible "⋯" needs none, which is why this is not a `heading` child.
   */
  drawerTitle?: string;
  /**
   * ⚠ **CONTROLLED MODE, AND IT EXISTS FOR EXACTLY ONE SHAPE: A DOOR ELSEWHERE ON THE PAGE THAT
   * OPENS THIS MENU** (Schedule's empty state, Phase 4b). Leave both undefined and the menu owns
   * its own state, which is what every other caller wants.
   *
   * Schedule's "No events scheduled yet" card carries an *Add Event* button that opens the page
   * header's menu — the coach presses a button mid-page and the choices appear in the header. That
   * is pre-existing behaviour and not this phase's to re-decide, but it is why the shared component
   * needed a way to be opened from outside. **Do not reach for this to drive a menu from a sibling
   * toolbar** — a menu that opens somewhere other than the control that was pressed is a thing to
   * justify, not a pattern to spread.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [openSelf, setOpenSelf] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openSelf;
  /* One setter for both modes, so nothing below has to know which one it is in. An uncontrolled
     menu keeps its own state AND still reports out, so a caller may watch without taking over. */
  const setOpen = useCallback((next: boolean | ((was: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(open) : next;
    if (!controlled) setOpenSelf(value);
    onOpenChange?.(value);
  }, [controlled, onOpenChange, open]);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  /** Which end the next open lands on — set by Up on a closed trigger, reset after every open. */
  const openOnRef = useRef<'first' | 'last'>('first');

  /**
   * ⚠⚠ **ONCE THE PANEL HOLDS FOCUS, EVERY WAY OF CLOSING IT OWES AN ANSWER TO "AND THEN WHERE?"**
   * (/review, 2026-08-25 — the finding two lenses reached from opposite directions.)
   *
   * The panel unmounts with focus inside it, so the browser drops focus to `<body>` and the next Tab
   * restarts from the top of the document. `useDismissable` already answers this for **Escape**, and
   * deliberately does NOT for **click-away** — its comment says why: *"a user who clicked elsewhere
   * has already chosen where they are going, and yanking focus back would fight them."* **That was
   * written for a panel that never held focus.** Two more exits appeared with the keyboard pattern:
   * picking an item, and Tab.
   *
   * ⚠ **THIS IS A SAFETY NET, NOT A GRAB, AND THE DIFFERENCE IS THE WHOLE DESIGN.** Two earlier
   * attempts were written and thrown away because each fought the browser instead of yielding to it:
   *   1. Restoring focus during `pointerdown` **loses to the browser's own blur** — a mousedown on
   *      non-focusable background clears focus AFTER our handler, so the "fix" was a no-op that a
   *      confident comment would have hidden. Caught by driving a real browser, not by reading.
   *   2. Restoring focus unconditionally on select **breaks the Money hub**: `MoneyImportMenu` puts
   *      its busy guard on the TRIGGER (`disabled={importLoading}`), so the button we just focused is
   *      disabled on the very next commit, the browser blurs it, and focus is gone for the whole
   *      fetch with no self-focusing sheet to reclaim it. (Plan templates keeps that guard on the
   *      ITEM for a related reason — see its own `/review` note.)
   *
   * So: wait a frame, and act **only if nobody else claimed focus.** A dialog that focuses itself
   * wins. A control the coach clicked wins. A trigger that has since become disabled is skipped
   * rather than focused-then-blurred. What is left is the case that was actually broken — nothing
   * took focus at all — and only there does the trigger take it back.
   */
  const rescueFocus = useCallback(() => {
    window.requestAnimationFrame(() => {
      // `<body>` is the browser's "nowhere left" fallback; anything else is a real destination.
      if (document.activeElement && document.activeElement !== document.body) return;
      const trigger = triggerRef.current;
      if (trigger && !trigger.disabled) trigger.focus({ preventScroll: true });
    });
  }, []);

  useDismissable(open, rootRef, () => { setOpen(false); rescueFocus(); });

  /** The items a keyboard may land on. Disabled rows are not focus stops. */
  const items = useCallback(
    () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []),
    [],
  );

  const focusAt = useCallback((index: number) => {
    const list = items();
    if (!list.length) return;
    const wrapped = ((index % list.length) + list.length) % list.length;
    list[wrapped].focus({ preventScroll: true });
  }, [items]);

  useEffect(() => {
    if (!open) return;
    const list = items();
    (openOnRef.current === 'last' ? list[list.length - 1] : list[0])?.focus({ preventScroll: true });
    openOnRef.current = 'first';
  }, [open, items]);

  /* One handler on the ROOT, so it hears the trigger and the panel alike — the panel is a child of
     this element, which is also what lets `useDismissable` take a single boundary ref. */
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Tab') {
      // Close and hand focus back BEFORE the default runs, so the browser's Tab continues from the
      // trigger rather than from an item that is about to unmount.
      if (open) { setOpen(false); triggerRef.current?.focus({ preventScroll: true }); }
      return;
    }
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        openOnRef.current = event.key === 'ArrowUp' ? 'last' : 'first';
        setOpen(true);
      }
      return;
    }
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); focusAt(at + 1); break;
      case 'ArrowUp': event.preventDefault(); focusAt(at - 1); break;
      case 'Home': event.preventDefault(); focusAt(0); break;
      case 'End': event.preventDefault(); focusAt(list.length - 1); break;
      default: break;
    }
  };
  // Always right-aligned: these triggers sit at the right end of a right-pinned group, so a
  // left-aligned panel would hang off the page. A left-aligned variant can add the option back
  // when a caller actually needs one.
  // A glyph trigger's menu is a short list of one-word choices (List · Week · Month) — 160 wide,
  // the drawing's number; the worded triggers keep the room their hints need.
  const panelStyle = useAnchoredMenu(open, rootRef, panelRef, {
    minWidth: variant === 'glyph' ? 160 : 260,
    narrowMinWidth: variant === 'glyph' ? 160 : 200,
    align: 'end',
  });
  /* The drawer is a phone presentation of the SAME panel (E1). `useAnchoredMenu` still runs — a
     hook cannot be conditional, and the popover must be placed the instant the width crosses back —
     but its measured `top`/`left` are INLINE styles and would beat the drawer's own `position:
     fixed` from the stylesheet, so drawer mode simply does not wear them. */
  /* ⚠ Asked only when this menu can actually USE the answer. This component is rendered once per
     CHIP on the practice-plan editor and the groups room, so an unconditional subscription opened a
     matchMedia listener per player for a drawer those callers never request (/review, 2026-09-22). */
  const isPhone = useIsPhone(drawerOnPhone);
  const asDrawer = drawerOnPhone && isPhone;

  return (
    <div ref={rootRef} className={styles.root} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={
          `${styles.trigger}${variant === 'primary' ? ` ${styles.triggerPrimary}` : variant === 'chip' ? ` ${styles.triggerChip}` : variant === 'glyph' ? ` ${styles.triggerGlyph}` : ''}` +
          `${bareOnPhone ? ` ${styles.triggerBare}` : ''}` +
          `${open ? ` ${styles.triggerOpen}` : ''}`
        }
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        /* The label is the accessible name while it is visible; once it can hide at ≤640 the
           name has to be stated, or the phone gets a button announced as "chevron". */
        aria-label={collapseOnPhone || variant === 'glyph' ? label : undefined}
        onClick={() => setOpen(v => !v)}
      >
        {icon}
        {variant === 'glyph' ? null : collapseOnPhone ? <span className={shared.headerBtnLabel}>{label}</span> : label}
        {variant !== 'chip' && variant !== 'glyph' && <ChevronDown size={14} aria-hidden />}
      </button>
      {/* ⚠ INSIDE `rootRef`, which is the element `useDismissable` watches — see `drawerOnPhone`
          above for the defect a sibling scrim caused next door, and why a mouse never shows it. */}
      {open && asDrawer && <LineupSheetScrim onClose={() => { setOpen(false); rescueFocus(); }} />}
      {open && (
        <div
          ref={panelRef}
          className={`${styles.panel}${asDrawer ? ` ${styles.drawer}` : ''}`}
          style={asDrawer ? undefined : panelStyle}
          role="menu"
          // One place decides that picking something closes the menu, so no item has to remember
          // to — including an item that goes on to open a dialog, which wants this menu gone
          // before it appears.
          //
          // ⚠ Picking an item unmounts the item, so focus fell to `<body>` — a keyboard user landed
          // OUTSIDE the dialog they had just opened, and these dialogs carry no focus trap, so the
          // next Tab walked the page BEHIND them. `rescueFocus` is the answer, and it yields to a
          // dialog that focuses itself rather than competing with it (see its own note above).
          onClick={event => {
            if (!(event.target as HTMLElement).closest('button')) return;
            setOpen(false);
            rescueFocus();
          }}
        >
          {asDrawer && drawerTitle && <div className={styles.drawerTitle}>{drawerTitle}</div>}
          {children}
        </div>
      )}
    </div>
  );
}

/** A heading over a group of items — the menu's own "Bring into Money" / "Take out of Money". */
export function CoachToolbarMenuHeading({ children }: { children: ReactNode }) {
  return <div className={styles.heading}>{children}</div>;
}

/** A plain do-this-now row — or, with `checked` given, one of a set the menu chooses between. */
export function CoachToolbarMenuItem({
  icon,
  label,
  hint,
  disabled = false,
  nested = false,
  checked,
  onSelect,
}: {
  icon?: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  /**
   * The row is ONE OF A SET the menu chooses between — the practice library's phone Sort menu
   * ("Name · Usually · Plans · Last planned", one ticked; columns follow-up, owner ruling T4,
   * 2026-09-17). Given at all, the row is announced as a radio item with its state, and the
   * ticked one wears a check at its end. Left undefined, the row is the plain do-this-now item.
   */
  checked?: boolean;
  /**
   * This choice makes a CHILD of the one above it — indented, with a turn-down mark.
   * Schedule's *Tournament game* sits under *Tournament* this way, because a game slot belongs to a
   * tournament and a coach should see that where they create one.
   *
   * ⚠ Structure, not decoration: indent a row only where the thing it makes genuinely belongs to
   * the thing above. It stays an ordinary `menuitem` — arrow keys treat it like any other row,
   * because a screen reader user should not have to learn a second navigation model to reach it.
   */
  nested?: boolean;
  onSelect: () => void;
}) {
  return (
    // `tabIndex={-1}`: a roving menu has ONE tab stop, the trigger. Arrow keys move between items
    // (see the component doc above); Tab leaves the menu entirely.
    <button
      type="button"
      className={`${styles.item}${nested ? ` ${styles.itemNested}` : ''}`}
      role={checked === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={checked === undefined ? undefined : checked}
      tabIndex={-1}
      disabled={disabled}
      onClick={onSelect}
    >
      {icon && <span className={styles.itemIcon}>{icon}</span>}
      <span className={styles.itemText}>
        <span className={styles.itemLabel}>{label}</span>
        {hint && <span className={styles.itemHint}>{hint}</span>}
      </span>
      {checked && <Check size={15} className={styles.itemCheck} aria-hidden />}
    </button>
  );
}

export function CoachToolbarMenuSeparator() {
  return <div className={styles.separator} role="separator" />;
}
