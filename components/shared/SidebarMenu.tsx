'use client';
/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ⚖ ONE SIDEBAR MENU (navigation Phase 4, Step 0 — the first step all four Phase 2 reviewers asked for, 2026-11-10).
 * Every list a sidebar opens is this one window, so its keyboard contract and its placement are written once:
 *
 *   · the event's cell (`EventSwitchMenu`, the tournament admin),
 *   · the coach team cell (`CoachTeamCell`, the Premium Coaches Portal),
 *   · the folded strip's tile menu (`SidebarStripMenu`, today the free coach portal's "Your teams").
 *
 * ⚖ THE HOUSE'S KEYBOARD CONTRACT (`rovingMenuKey`, shared with `CoachToolbarMenu`): focus lands on the current row
 * (`aria-current`), else the first; the arrows rove, Home/End jump; Enter or Space picks; Escape closes and puts focus back
 * on the opener; Tab closes and hands focus to the opener WITHOUT stopping the browser's own Tab (never a trap); a press
 * outside closes (`useDismissable`); a row that acts closes the window and focus goes back to the opener unless the row
 * took it elsewhere (`rescueFocusTo`).
 *
 * ⚖ TWO PLACEMENTS, one per kind of opener:
 *   · `cell` — a sidebar's pinned top cell: under the cell (its left edge 2px in) while the sidebar is open, beside the
 *     40px tile while it is folded; `width` wide, 8px clear of the window's edges. The cell is pinned (outside the
 *     scrolling list), so the window never follows a scroll; a resize closes it and hands focus back.
 *   · `beside` — an icon in the folded strip's list: beside it, lifted to fit above the window's foot and never above the
 *     sidebar's own top; it follows its icon while the sidebar scrolls and closes once the icon leaves the sidebar's view.
 *
 * ⚠ `position: fixed` INSIDE THE SIDEBAR, NOT PORTALED: it stays in the sidebar's warm / dark palette scope, and `fixed`
 * escapes the sidebar's scroll clip. A `cell` window is wider than the sidebar and hangs over the page, so the sidebar
 * raises its own layer while one is open (`.stripLayer:has(.cellMenu)`, SidebarStrip.module.css — the one rule, once the
 * admin rail's own `.rail:has(.switchMenu)`).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { rescueFocusTo, rovingMenuKey, scrollingAncestor, useDismissable } from '@/lib/overlay-hooks';
import { isSidebarStrip } from '@/lib/sidebar-strip';
import strip from './SidebarStrip.module.css';

/** A menu's rows, every user's alike (a disabled row is skipped by the arrows and never picks). */
export const MENU_ITEMS = '[role="menuitem"]:not([aria-disabled="true"])';

/** Focus the row you are on, else the first row — where every list opens (the phone's sheets too). */
export function focusCurrentItem(panel: HTMLElement | null) {
  (panel?.querySelector<HTMLElement>(`${MENU_ITEMS}[aria-current]`) ?? panel?.querySelector<HTMLElement>(MENU_ITEMS))
    ?.focus({ preventScroll: true });
}

/** The drawings' keep-out from the window's edges, and the gap beside a folded tile or icon. */
const MARGIN = 8;
const GAP = 8;

export type SidebarMenuPlacement = 'cell' | 'beside';

export default function SidebarMenu({
  open, anchorRef, label, placement, width, className, onClose, children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  /** The window's accessible name ("Tournaments", "Your teams"). */
  label: string;
  placement: SidebarMenuPlacement;
  /** `cell` only: the window's width (the drawings' 320). A `beside` window takes its width from its class. */
  width?: number;
  /** The window's own skin (the event list's two-line dropdown, the strip menu's box). */
  className: string;
  onClose: () => void;
  children: ReactNode;
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

    if (placement === 'cell') {
      const r = anchor.getBoundingClientRect();
      const viewW = document.documentElement.clientWidth;
      const viewH = document.documentElement.clientHeight;
      const w = Math.min(width ?? 320, viewW - MARGIN * 2);
      // Folded: beside the tile, its top with the cell's. Open: under the cell, its left edge with the sidebar's.
      const folded = isSidebarStrip();
      const left = Math.max(2, Math.min(folded ? r.right + MARGIN : r.left + 2, viewW - w - MARGIN));
      const top = folded ? r.top + 2 : r.bottom + 2;
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.width = `${w}px`;
      panel.style.maxHeight = `${viewH - top - MARGIN}px`;
      focusCurrentItem(panel);
      // The window was placed for this size of screen: a resize closes it, and the next press opens it in the right place.
      // Focus was on a row: hand it back to the opener, or a keyboard user is left on <body>.
      const close = () => { onCloseRef.current(); rescueFocusTo(anchorRef); };
      window.addEventListener('resize', close);
      return () => window.removeEventListener('resize', close);
    }

    // `beside`: the box the icon scrolls in — the sidebar itself, or its list.
    const box = scrollingAncestor(anchor);
    let frame = 0;
    const place = () => {
      frame = 0;
      const r = anchor.getBoundingClientRect();
      const b = box?.getBoundingClientRect();
      if (b && (r.bottom <= b.top || r.top >= b.bottom)) { onCloseRef.current(); return; }
      const floor = b ? Math.max(MARGIN, b.top) : MARGIN;
      const foot = document.documentElement.clientHeight - MARGIN;
      const height = panel.scrollHeight;
      // Beside the icon, lifted to fit above the foot — and never above the sidebar's own top, even for an icon
      // half scrolled out of view (the top bar stays clear).
      const top = Math.max(floor, Math.min(r.top - 4, foot - height));
      panel.style.left = `${r.right + GAP}px`;
      panel.style.top = `${top}px`;
      panel.style.maxHeight = `${foot - top}px`;
    };
    const schedule = (e?: Event) => {
      if (e?.target instanceof Node && panel.contains(e.target)) return;
      if (!frame) frame = window.requestAnimationFrame(place);
    };
    place();
    focusCurrentItem(panel);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [open, anchorRef, placement, width]);

  if (!open) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Tab: close and hand focus to the opener WITHOUT preventing the key — the browser's own Tab then moves on from it.
    if (e.key === 'Tab') { closeToAnchor(); return; }
    rovingMenuKey(e, Array.from(panelRef.current?.querySelectorAll<HTMLElement>(MENU_ITEMS) ?? []));
  };
  // A row that acts closes the window (its navigation or switch carries on); focus, which was on that row, goes back to
  // the opener unless what the row opened took it.
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const row = (e.target as Element).closest('[role="menuitem"]');
    if (!row || row.getAttribute('aria-disabled') === 'true') return;
    onClose();
    rescueFocusTo(anchorRef);
  };

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label={label}
      className={`${className}${placement === 'cell' ? ` ${strip.cellMenu}` : ''}`}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
