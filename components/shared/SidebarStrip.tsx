'use client';

import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
  type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject,
} from 'react';
import Link from 'next/link';
import { Check, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { rescueFocusTo, rovingMenuKey, scrollingAncestor, useDismissable } from '@/lib/overlay-hooks';
import { isSidebarStrip, setSidebarStrip } from '@/lib/sidebar-strip';
import { stripTileText } from '@/lib/team-color';
import styles from './SidebarStrip.module.css';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE SIDEBAR STRIP'S SHARED PARTS — every portal's sidebar folds to a 64-wide strip of icons
 * (Sidebar Strip & Grid Width, Stage 2; ratified hub 5s1QP7HHsctVso78u5tUjC, screens 2, 8 and 9).
 * Three sidebars wear them: the club and tournament sidebar (`AdminKitRail`), the Premium coach
 * sidebar (`CoachesSidebar`) and the free coach sidebar (`CoachPortalShell`). Each keeps its own skin;
 * what is the SAME in all three lives here, so a fix lands once:
 *
 *   · `CollapseSidebarRow` — the sidebar's last row (Ask 2): "Collapse sidebar", and in the strip the
 *     expand icon. Both words are in the button and CSS shows one, so its accessible name is right
 *     from the first paint, before any JavaScript has run. Its hairline is the module's `collapseRow`.
 *   · `SidebarStripTip` — an icon's name on hover AND keyboard focus (plan §3), read from the row's
 *     own accessible name, so a row needs nothing beyond the label it already carries.
 *   · `SidebarStripMenu` — a program with 2+ pages opens a menu beside its icon, on click (Ask 3).
 *   · `SidebarStripTile` — the tournament and team pickers as initials tiles that open their lists.
 *   · `styles.rowLabel` / `fullOnly` / `stripRule` / `foldedGroup` / `cornerCount` / `cornerDot` /
 *     `stripLayer` — the class recipe a sidebar puts on its labels, its full-only furniture, its group
 *     hairlines, a group folded shut, its counts and its own element.
 *
 * ⚠ THE BUBBLE AND THE MENU ARE `position: fixed` INSIDE THE SIDEBAR, NOT PORTALED. A tall strip
 * scrolls (the tournament's ~1,000, the coach's 945 — Ask 6, accepted), and a scroll box clips anything
 * that hangs outside it; `fixed` escapes the clip while staying inside the sidebar's warm/dark palette
 * scope, which a portal to <body> would leave. The sidebar raises its own layer in the strip
 * (`stripLayer`) so both sit over the page beside it, and under every window and form (the ruled
 * menu-on-top, form-covers-nav order, `decision_drawer_layers_form_vs_menu`).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The sidebar's last row (Ask 2, ruled). `className` is the host row's own class — the skin is the
 *  sidebar's; this part swaps the icon and the words between the two states and draws the row's hairline. */
export function CollapseSidebarRow({ className, iconSize = 14 }: { className: string; iconSize?: number }) {
  return (
    <button
      type="button"
      className={`${className} ${styles.collapseRow}`}
      onClick={() => setSidebarStrip(!isSidebarStrip())}
    >
      <PanelLeftClose size={iconSize} aria-hidden className={styles.whenFull} />
      <PanelLeftOpen size={iconSize} aria-hidden className={styles.whenStrip} />
      <span className={styles.whenFull}>Collapse sidebar</span>
      <span className={`${styles.whenStrip} ${styles.rowLabel}`}>Expand sidebar</span>
    </button>
  );
}

/** A row's name, as a screen reader reads it: its own `aria-label`, else its visually hidden label. Never its
 *  whole text — a count beside the label would ride along ("Teams 2"). */
function rowName(row: HTMLElement): string {
  return row.getAttribute('aria-label') ?? row.querySelector(`.${styles.rowLabel}`)?.textContent ?? '';
}

/**
 * The name bubble: one per sidebar, beside whichever row (a link or button of the sidebar, not of an open
 * menu) the pointer is over or the keyboard is on. Shown only in the strip; `aria-hidden`, because a screen
 * reader already reads the row's own name.
 */
export function SidebarStripTip({ scopeRef }: { scopeRef: RefObject<HTMLElement | null> }) {
  const [tip, setTip] = useState<{ text: string; top: number; left: number } | null>(null);
  const rowRef = useRef<HTMLElement | null>(null);
  const hide = useCallback(() => { rowRef.current = null; setTip(null); }, []);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    const show = (el: Element | null) => {
      const row = el?.closest<HTMLElement>('a, button');
      // No bubble while one of the sidebar's menus is open: the menu is what the person is reading.
      if (!row || !scope.contains(row) || !isSidebarStrip() || scope.querySelector('[role="menu"]')) { hide(); return; }
      // The pointer crossing a row's icon, label and count fires once for each — measure the row once.
      if (row === rowRef.current) return;
      const text = rowName(row);
      if (!text) { hide(); return; }
      rowRef.current = row;
      const r = row.getBoundingClientRect();
      setTip({ text, top: r.top + r.height / 2, left: r.right + 10 });
    };
    const onOver = (e: PointerEvent) => show(e.target as Element);
    const onOut = (e: PointerEvent) => {
      const next = e.relatedTarget as Element | null;
      if (!next || !scope.contains(next)) hide();
    };
    // Keyboard focus only (`:focus-visible`): a mouse click that focuses a row already has the pointer's bubble.
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (el.matches(':focus-visible')) show(el); else hide();
    };
    // A press may open a menu over the bubble.
    scope.addEventListener('pointerover', onOver);
    scope.addEventListener('pointerout', onOut);
    scope.addEventListener('focusin', onFocusIn);
    scope.addEventListener('focusout', hide);
    scope.addEventListener('pointerdown', hide);
    return () => {
      scope.removeEventListener('pointerover', onOver);
      scope.removeEventListener('pointerout', onOut);
      scope.removeEventListener('focusin', onFocusIn);
      scope.removeEventListener('focusout', hide);
      scope.removeEventListener('pointerdown', hide);
    };
  }, [scopeRef, hide]);

  // Anything that moves the rows puts the bubble away, and so does Escape (a tooltip must be dismissible —
  // WCAG 1.4.13; the key is not claimed, so whatever else answers Escape still does). Listened for only while
  // one is showing.
  const showing = tip !== null;
  useEffect(() => {
    if (!showing) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      document.removeEventListener('keydown', onKey);
    };
  }, [showing, hide]);

  if (!tip) return null;
  return (
    <span className={styles.tip} style={{ top: tip.top, left: tip.left }} aria-hidden>
      {tip.text}
    </span>
  );
}

/** The menu's keep-out from the window's foot, and its gap from the icon (the drawing's 8). */
const MENU_MARGIN = 8;
const MENU_GAP = 8;
const ENABLED_ITEMS = '[role="menuitem"]:not([aria-disabled="true"])';

/**
 * A program's menu, beside its icon (Ask 3, ruled: a click menu, never hover-only — a touch laptop or a
 * tablet held sideways gets the desktop layout). It is a MENU by the house's keyboard contract, shared
 * with `CoachToolbarMenu` (`rovingMenuKey`): focus moves in on open, the arrows rove, Home/End jump, Space
 * activates a link row, Tab closes and hands focus back to the icon so the browser's Tab carries on from
 * there, Escape closes and returns focus, a press outside closes (`useDismissable`). Its rows are
 * `StripMenuLink` / `StripMenuButton`.
 *
 * Placement: its top beside the icon's, clamped so it never runs off the window's foot or rises above the
 * sidebar's own top (the strip under the top bar), and it scrolls inside when even that is short. It
 * follows its icon while the sidebar scrolls, and closes once the icon leaves the sidebar's view.
 */
export function SidebarStripMenu({
  open, anchorRef, title, onClose, children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  /** The menu's small-capitals label (the program, "Tournaments", "Your teams") and its accessible name. */
  title: string;
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
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    // The box the icon scrolls in — the sidebar itself, or its list.
    const box = scrollingAncestor(anchor);
    let frame = 0;
    const place = () => {
      frame = 0;
      const r = anchor.getBoundingClientRect();
      const b = box?.getBoundingClientRect();
      if (b && (r.bottom <= b.top || r.top >= b.bottom)) { onCloseRef.current(); return; }
      const floor = b ? Math.max(MENU_MARGIN, b.top) : MENU_MARGIN;
      const foot = document.documentElement.clientHeight - MENU_MARGIN;
      const height = panel.scrollHeight;
      // Beside the icon, lifted to fit above the foot — and never above the sidebar's own top, even for an icon
      // half scrolled out of view (the top bar stays clear).
      const top = Math.max(floor, Math.min(r.top - 4, foot - height));
      panel.style.left = `${r.right + MENU_GAP}px`;
      panel.style.top = `${top}px`;
      panel.style.maxHeight = `${foot - top}px`;
    };
    const schedule = (e?: Event) => {
      if (e?.target instanceof Node && panel.contains(e.target)) return;
      if (!frame) frame = window.requestAnimationFrame(place);
    };
    place();
    // Focus lands on the page you are on (or the picker's current choice), else the first row.
    (panel.querySelector<HTMLElement>(`${ENABLED_ITEMS}[aria-current]`) ?? panel.querySelector<HTMLElement>(ENABLED_ITEMS))
      ?.focus({ preventScroll: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [open, anchorRef]);

  if (!open) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Tab: close and hand focus to the icon WITHOUT preventing the key — the browser's own Tab then moves
    // on from the icon, so the menu is never a trap and the page behind it is never reached by accident.
    if (e.key === 'Tab') { closeToAnchor(); return; }
    rovingMenuKey(e, Array.from(panelRef.current?.querySelectorAll<HTMLElement>(ENABLED_ITEMS) ?? []));
  };
  // A row that acts closes the menu (its navigation or switch carries on) — and focus, which was on that row,
  // goes back to the icon unless what the row opened took it (the house safety net, `rescueFocusTo`).
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
      aria-label={title}
      className={styles.menu}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      <div className={styles.menuHead} aria-hidden>{title}</div>
      {children}
    </div>
  );
}

/** A labelled block inside a menu — the team you are in, the season you are in, "No live season". */
export function StripMenuGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <div className={styles.menuSub} aria-hidden>{label}</div>
      {children}
    </div>
  );
}

/** A menu row that goes somewhere. `meta` is a quiet word at its end; `trailing` is the sidebar's own count
 *  for that page (the full sidebar's page row carries it, so its menu row does too); `current` wears the
 *  check a picker's current choice wears. */
export function StripMenuLink({
  href, active = false, current = false, meta, trailing, children,
}: {
  href: string; active?: boolean; current?: boolean; meta?: string; trailing?: ReactNode; children: ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      tabIndex={-1}
      className={`${styles.menuItem}${active || current ? ` ${styles.menuItemOn}` : ''}`}
      aria-current={active ? 'page' : current ? 'true' : undefined}
    >
      <span className={styles.menuItemText}>{children}</span>
      {meta && <small className={styles.menuItemMeta}>{meta}</small>}
      {trailing}
      {current && !meta && <Check size={14} aria-hidden className={styles.menuItemCheck} />}
    </Link>
  );
}

/** A menu row that acts in place (switch tournament, New tournament). `add` draws the picker's
 *  "+ New …" foot row, under a hairline. */
export function StripMenuButton({
  onSelect, current = false, meta, disabled = false, title, add = false, children,
}: {
  onSelect: () => void; current?: boolean; meta?: string; disabled?: boolean; title?: string; add?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={`${styles.menuItem}${current ? ` ${styles.menuItemOn}` : ''}${add ? ` ${styles.menuItemAdd}` : ''}`}
      aria-current={current ? 'true' : undefined}
      aria-disabled={disabled || undefined}
      title={title}
      onClick={() => { if (!disabled) onSelect(); }}
    >
      {add && <Plus size={14} aria-hidden className={styles.menuItemPlus} />}
      <span className={styles.menuItemText}>{children}</span>
      {meta && <small className={styles.menuItemMeta}>{meta}</small>}
      {current && !meta && <Check size={14} aria-hidden className={styles.menuItemCheck} />}
    </button>
  );
}

/**
 * A picker as a strip tile (plan §3: "the tournament picker and the coach team picker become initials
 * tiles that open their lists"). Rendered beside the full picker in both states — CSS shows the tile
 * only in the strip — so the markup never depends on the setting. `label` is its name ("Spring Classic
 * 2027 · switch tournament"), read aloud and shown in the bubble.
 */
export function SidebarStripTile({
  name, label, open, onToggle,
}: {
  name: string; label: string; open: boolean; onToggle: (tile: HTMLElement) => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.tile}${open ? ` ${styles.tileOpen}` : ''}`}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={label}
      onClick={e => onToggle(e.currentTarget)}
    >
      <span aria-hidden>{stripTileText(name)}</span>
    </button>
  );
}

/** What a row needs to open its menu in the strip: its key, the setting as rendered, the open menu, the toggle. */
export type StripMenuRow = { key: string; strip: boolean; openKey: string | null; toggle: (key: string, el: HTMLElement) => void };

/**
 * One open menu per sidebar, and the icon it hangs from. `toggle(key, el)` from a row's click opens that
 * row's menu (or closes it when it is already the open one); the menu closes on any route change, since
 * the shell survives client navigation. The host mounts ONE `SidebarStripMenu` keyed by `openKey`, so a
 * second menu is a fresh mount placed beside its own icon.
 */
export function useStripMenu(pathname: string) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (openKey) setOpenKey(null);
  }
  const toggle = (key: string, el: HTMLElement) => {
    anchorRef.current = el;
    setOpenKey(k => (k === key ? null : key));
  };
  const close = () => setOpenKey(null);
  return { openKey, anchorRef, toggle, close };
}

/**
 * The props a row adds when, IN THE STRIP, it opens a menu instead of going to its page: a plain click or
 * Space opens the menu (a modified click still opens the page in a new tab, as a link does); the row
 * announces the menu it opens. In the full sidebar the row is the link it always was — `menu.strip` is the
 * setting as rendered (`useSidebarStrip`), and the click handler re-reads it live.
 */
export function stripMenuRowProps({ key, strip, openKey, toggle }: StripMenuRow) {
  const plain = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
  return {
    ...(strip ? { role: 'button' as const, 'aria-haspopup': 'menu' as const, 'aria-expanded': openKey === key } : {}),
    onClick: (e: MouseEvent<HTMLElement>) => {
      if (!isSidebarStrip() || !plain(e)) return;
      e.preventDefault();
      toggle(key, e.currentTarget);
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      // A held key repeats, and a modified Space belongs to something else.
      if (e.key !== ' ' || e.repeat || e.ctrlKey || e.altKey || e.metaKey || !isSidebarStrip()) return;
      e.preventDefault();
      toggle(key, e.currentTarget);
    },
  };
}
