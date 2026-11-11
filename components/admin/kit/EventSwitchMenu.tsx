'use client';
/**
 * EventSwitchMenu — the list the event's cell opens (navigation Phase 2 Part A; drawings tab 14, owner rulings T3 and T6,
 * 2026-11-10). ONE window, under the cell while the sidebar is open and beside the 40px tile while it is folded (where the
 * strip's menu opened before); it replaced the native `<select id="admin-tournament-select">` and the strip's tile menu.
 *
 * ⚖ ITS ROWS ARE THE PORTAL'S STANDARD TWO-LINE DROPDOWN ROW (owner's change to T3): `SublinedChoice`'s list — the same
 * classes (`convWhat*`, coaches.module.css), so it cannot drift from it — the event's name 14px semibold, its dates and phase
 * word on a 12px tertiary line ("Nov 1–3, 2026 · Game day", `eventSwitchLine`), 44px rows with a hairline between them, the
 * olive tint under a pointer and on keyboard focus. The current event's name is olive with an olive check on the right. The
 * head is that list's group band ("Tournaments"); "All tournaments" at the foot opens the Tournaments list. ⚖ Since navigation
 * Phase 3 (owner 2026-11-11) the event's 24px logo tile leads every row, here and in the phone's sheet (`EventSwitchItems`).
 *
 * ⚖ IT IS A MENU BY THE HOUSE'S KEYBOARD CONTRACT (`SidebarStripMenu`, `rovingMenuKey`): focus lands on the current event;
 * the arrows rove, Home/End jump; Enter or Space picks; Escape closes and puts focus back on the cell; Tab closes and hands
 * focus to the cell without stopping the browser's own Tab; a press outside closes (`useDismissable`).
 *
 * ⚠ `position: fixed` INSIDE THE SIDEBAR, NOT PORTALED (the strip menu's reason): it stays in the sidebar's warm / dark palette
 * scope. Being 320 wide it hangs over the page, so the sidebar raises its own layer while it is open (`.rail:has(...)`,
 * AdminKitFrame.module.css). The cell it hangs from is pinned (outside the scrolling list), so it never needs to follow a scroll.
 */
import Link from 'next/link';
import { useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent, type RefObject } from 'react';
import { Check, Trophy } from 'lucide-react';
import { rescueFocusTo, rovingMenuKey, useDismissable } from '@/lib/overlay-hooks';
import { isSidebarStrip } from '@/lib/sidebar-strip';
import type { EventSwitchRow } from '@/lib/admin-event-cell';
import SidebarLogoTile from '@/components/shared/SidebarLogoTile';
import coachKit from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './AdminKitFrame.module.css';

/** The drawing's window: 320 wide (T3), 2px below the open cell, 8px beside the folded tile, 8px clear of the window's edges. */
const WIDTH = 320;
const MARGIN = 8;
/** The list's items, the menu's and the phone sheet's alike. */
export const SWITCH_ITEMS = '[role="menuitem"]';
const ITEMS = SWITCH_ITEMS;

/** Focus the event you are in, else the first row — where both lists open. */
export function focusCurrentItem(panel: HTMLElement | null) {
  (panel?.querySelector<HTMLElement>(`${ITEMS}[aria-current]`) ?? panel?.querySelector<HTMLElement>(ITEMS))?.focus({ preventScroll: true });
}

export default function EventSwitchMenu({ open, anchorRef, rows, allHref, onPick, onClose }: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  rows: readonly EventSwitchRow[];
  /** The Tournaments list (E3): the foot row. */
  allHref: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeToAnchor = () => {
    onClose();
    anchorRef.current?.focus({ preventScroll: true });
  };
  useDismissable(open, [anchorRef, panelRef], onClose, closeToAnchor);

  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const r = anchor.getBoundingClientRect();
    const viewW = document.documentElement.clientWidth;
    const viewH = document.documentElement.clientHeight;
    const width = Math.min(WIDTH, viewW - MARGIN * 2);
    // Folded: beside the tile, its top with the cell's. Open: under the cell, its left edge with the sidebar's.
    const folded = isSidebarStrip();
    const left = Math.max(2, Math.min(folded ? r.right + MARGIN : r.left + 2, viewW - width - MARGIN));
    const top = folded ? r.top + 2 : r.bottom + 2;
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.width = `${width}px`;
    panel.style.maxHeight = `${viewH - top - MARGIN}px`;
    // Focus lands on the event you are in, else the first row.
    focusCurrentItem(panel);
    // The window was placed for this size of screen: a resize closes it, and the next press opens it in the right place.
    // Focus was on a row: hand it back to the cell, or a keyboard user is left on <body>.
    const close = () => { onCloseRef.current(); rescueFocusTo(anchorRef); };
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, [open, anchorRef]);

  if (!open) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') { closeToAnchor(); return; }
    rovingMenuKey(e, Array.from(panelRef.current?.querySelectorAll<HTMLElement>(ITEMS) ?? []));
  };
  // A row that acts closes the window; focus, which was on that row, goes back to the cell unless the row took it elsewhere.
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!(e.target as Element).closest(ITEMS)) return;
    onClose();
    rescueFocusTo(anchorRef);
  };

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label="Tournaments"
      className={`${coachKit.convWhatList} ${styles.switchMenu}`}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      <div className={coachKit.convWhatGroup} aria-hidden>Tournaments</div>
      <EventSwitchItems rows={rows} allHref={allHref} onPick={onPick} roving />
    </div>
  );
}

/**
 * ⚖ THE LIST'S ROWS, ONCE (navigation Phase 3, owner 2026-11-11): worn by this menu on a computer and by the bar's sheet on a
 * phone (`AdminEventSwitchSheet`), so the two lists are one. Each row leads with the event's tile (R2, widened to both widths),
 * then its name and "dates · phase", the current one olive with a check; "All tournaments" at the foot, its trophy in a box the
 * tile's width so the words line up. `roving`: the menu's arrows own the keys (every item `tabIndex={-1}`); the sheet leaves
 * the rows in the Tab order, and Tab past the last closes it (the frame's menu layer).
 */
export function EventSwitchItems({ rows, allHref, onPick, roving = false }: {
  rows: readonly EventSwitchRow[];
  allHref: string;
  onPick: (id: string) => void;
  roving?: boolean;
}) {
  const tabIndex = roving ? -1 : undefined;
  return (
    <>
      {rows.map(row => (
        <button
          key={row.id}
          type="button"
          role="menuitem"
          tabIndex={tabIndex}
          className={`${coachKit.convWhatOpt} ${styles.switchRow}`}
          aria-current={row.current ? 'true' : undefined}
          onClick={() => { if (!row.current) onPick(row.id); }}
        >
          <SidebarLogoTile source={row.source} aspect={row.aspect} name={row.name} size={24} />
          <span className={styles.switchText}>
            <span className={`${coachKit.convWhatOptName}${row.current ? ` ${styles.switchCurrent}` : ''}`}>{row.name}</span>
            <span className={coachKit.convWhatOptSub}>{row.line}</span>
          </span>
          {row.current && <Check size={16} aria-hidden className={styles.switchIcon} />}
        </button>
      ))}
      <Link href={allHref} role="menuitem" tabIndex={tabIndex} className={`${coachKit.convWhatOpt} ${styles.switchRow} ${styles.switchAll}`}>
        <span className={styles.switchAllIcon} aria-hidden><Trophy size={15} className={styles.switchIcon} /></span>
        <span className={styles.switchAllText}>All tournaments</span>
      </Link>
    </>
  );
}
