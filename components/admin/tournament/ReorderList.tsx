'use client';
/**
 * THE PORTAL'S REORDER STANDARD, IN THE ADMIN — one part (Tournament admin redesign, Stage 3 addendum; owner 2026-10-12:
 * "on mobile for this screen we can also use the hold and drag to reorder rather than the up/down arrows. more
 * consistent with our portal standard", then "lets just update those 3 lists during this change"). The lineup builder's
 * D8 handle (2026-09-21) and Best positions' D3 (2026-09-29), whole:
 *
 *   the handle  one control per row, BEFORE the row's own control (a sibling, never nested in it): the row's NUMBER
 *               where the list has one (the playoff seeds), else a grip. 44px at touch widths.
 *   drag it     a mouse after 6px, a finger after a 250 ms hold (hold and scroll are told apart by time, so a handle
 *               lives in a list that scrolls), the keyboard with Space and the arrows — `useReorderSensors`, the ONE
 *               copy of the gesture. A drag that did activate swallows the click after it.
 *   tap it      Move up · Move down · Cancel — a popover at a desk, the portal's sheet on a phone (`SheetFrame`, the
 *               MENU layer; over a full-screen window, `overWindow`). The path for anyone who can't or won't drag. One
 *               move per open: the menu closes on a move, and the list behind it shows where the row went.
 *
 * No Reorder mode, no Done, no arrow pair on every row, no hint line (the grip says it). Each move is the caller's
 * `onMove(from, to)`, which saves as before. Retires Stage 5's OrderParts (Tools → Reorder, A54 — superseded).
 *
 * ⚠ The popover renders INSIDE the list's own DOM (a window's focus floor holds Tab inside its panel, and a popover in
 * the page's body would be outside it) but `position: fixed` against the handle, so a list card's `overflow: hidden`
 * never clips it. A scroll or a resize closes it rather than leave it adrift.
 */
import {
  createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactNode, type Ref,
} from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import SheetFrame from '@/components/coaches/SheetFrame';
import { useBackStep } from '@/components/coaches/useBackStep';
import { useDismissable } from '@/lib/overlay-hooks';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { useReorderSensors } from '@/lib/hooks/useReorderSensors';
import { ORDER_WORDS as W } from '@/lib/tournament-settings-words';
import styles from './ReorderList.module.css';

type ListCtx = {
  open: (id: string, opener: HTMLElement) => void;
  ids: readonly string[];
  names: readonly string[];
  position: (index: number, count: number) => string;
  disabled: boolean;
  menuFor: string | null;
};
const Ctx = createContext<ListCtx | null>(null);

/** "2 of 5" — a row's place, in the handle's name and the menu's head. */
const ofCount = (index: number, count: number) => W.position(index + 1, count);

export function ReorderList({
  ids, names, onMove, disabled = false, overWindow = false, position = ofCount, children,
}: {
  ids: readonly string[];
  /** Each row's name, in the same order: the handle's name and the menu's head. */
  names: readonly string[];
  /** A row moved from one place to another: the caller saves the new order. */
  onMove: (from: number, to: number) => void;
  /** A save in flight: the handles wait. */
  disabled?: boolean;
  /** The list sits in a full-screen window (a phone's form window): the menu sheet goes over it. */
  overWindow?: boolean;
  /** How a row's place reads: "2 of 5" (the default), or "Seed 2". */
  position?: (index: number, count: number) => string;
  children: ReactNode;
}) {
  const sensors = useReorderSensors();
  const dndId = useId();
  const isPhone = useIsPhone();
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setMenu(null), []);
  // Escape returns focus to the handle (the keyboard is still driving); a click elsewhere does not.
  const escape = useCallback(() => { setMenu(null); openerRef.current?.focus(); }, []);
  // A row gone from the list while its menu was open (another save re-read it) takes its menu with it.
  const idx = menu ? ids.indexOf(menu.id) : -1;
  const menuOpen = menu !== null && idx >= 0;
  const popoverOpen = menuOpen && !isPhone;
  // The popover's keys and back step; on a phone the frame stands them (Sheet Frame step 5).
  useDismissable(popoverOpen, [popRef, openerRef], close, escape);
  useBackStep(popoverOpen, close);

  const open = useCallback((id: string, opener: HTMLElement) => {
    openerRef.current = opener;
    const r = opener.getBoundingClientRect();
    setMenu(m => (m?.id === id ? null : { id, top: r.bottom + 4, left: r.left }));
  }, []);

  // The menu takes focus on its first live item (a keyboard or screen-reader user lands IN it).
  useEffect(() => {
    if (!menu) return;
    const host = isPhone ? document.querySelector<HTMLElement>(`[data-reorder-menu="${CSS_ID(dndId)}"]`) : popRef.current;
    host?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [menu, isPhone, dndId]);

  // Fixed against the handle; flipped above it when the screen's foot is too close; corrected for a containing block
  // (a fixed element inside a transformed ancestor is placed against that ancestor, not the screen).
  useLayoutEffect(() => {
    const el = popRef.current;
    if (!menu || isPhone || !el) return;
    const rect = el.getBoundingClientRect();
    const handle = openerRef.current?.getBoundingClientRect();
    let wantTop = menu.top;
    if (handle && wantTop + rect.height > window.innerHeight - 8) wantTop = Math.max(8, handle.top - rect.height - 4);
    const wantLeft = Math.min(menu.left, Math.max(8, window.innerWidth - rect.width - 8));
    const dx = rect.left - parseFloat(el.style.left || '0');
    const dy = rect.top - parseFloat(el.style.top || '0');
    el.style.left = `${wantLeft - dx}px`;
    el.style.top = `${wantTop - dy}px`;
    el.style.visibility = 'visible';
  }, [menu, isPhone]);

  useEffect(() => {
    if (!popoverOpen) return;
    const off = (e: Event) => { if (!(e.target instanceof Node && popRef.current?.contains(e.target))) close(); };
    window.addEventListener('scroll', off, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', off, true); window.removeEventListener('resize', close); };
  }, [popoverOpen, close]);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onMove(from, to);
  };

  const moveBy = (dir: -1 | 1) => {
    const to = idx + dir;
    if (idx >= 0 && to >= 0 && to < ids.length) onMove(idx, to);
    // The sheet's frame (or the popover's Escape) hands focus home; a press on Move does it here.
    setMenu(null);
    openerRef.current?.focus({ preventScroll: true });
  };
  const name = idx >= 0 ? names[idx] : '';
  const body = (
    <>
      <p className={styles.menuHead}>
        <strong>{name}</strong>
        <span>{idx >= 0 ? position(idx, ids.length) : ''}</span>
      </p>
      <button type="button" className={styles.menuItem} disabled={idx <= 0 || disabled} onClick={() => moveBy(-1)}>
        <ChevronUp size={18} aria-hidden /> {W.moveUp}
      </button>
      <button type="button" className={styles.menuItem} disabled={idx < 0 || idx >= ids.length - 1 || disabled} onClick={() => moveBy(1)}>
        <ChevronDown size={18} aria-hidden /> {W.moveDown}
      </button>
      <button type="button" className={styles.menuCancel} onClick={escape}>{W.cancel}</button>
    </>
  );

  return (
    <Ctx.Provider value={{ open, ids, names, position, disabled, menuFor: menuOpen ? menu.id : null }}>
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}
        // The two screen-reader nodes go in the page's body: rendered in place they would land inside a <ul>.
        accessibility={{ container: typeof document === 'undefined' ? undefined : document.body }}>
        <SortableContext items={[...ids]} strategy={verticalListSortingStrategy}>{children}</SortableContext>
      </DndContext>
      {menuOpen && (isPhone ? (
        <SheetFrame onClose={close} opener={openerRef} overWindow={overWindow} role="dialog" aria-label={W.options(name)}
          data-reorder-menu={CSS_ID(dndId)}>
          <div className={styles.sheetBody}>{body}</div>
        </SheetFrame>
      ) : (
        <div ref={popRef} className={styles.popover} role="dialog" aria-label={W.options(name)}
          style={{ top: menu.top, left: menu.left, visibility: 'hidden' }}>
          {body}
        </div>
      ))}
    </Ctx.Provider>
  );
}

/** An id fit for an attribute selector (`useId` gives ":r1:"). */
const CSS_ID = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '');

type ReorderBits = {
  /** The row's handle: render it BEFORE the row's own control (the kit row's `grip`). Null on a one-row list: there is
   *  nothing to move it past. */
  handle: ReactNode;
  itemRef: Ref<HTMLLIElement>;
  itemStyle: CSSProperties;
};

/** One row of a `ReorderList`: hands the row its handle, its ref and its moving style. */
export function ReorderRow({ id, number, children }: {
  id: string;
  /** Show the row's place as the handle (the seeds); else the handle is a grip. */
  number?: boolean;
  children: (bits: ReorderBits) => ReactNode;
}) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('ReorderRow outside a ReorderList');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: ctx.disabled });
  const index = ctx.ids.indexOf(id);
  const name = ctx.names[index] ?? '';
  const handle = (
    <button
      type="button"
      className={`${styles.handle}${number ? ` ${styles.handleNumber}` : ''}`}
      {...attributes}
      {...listeners}
      aria-label={W.handle(name, ctx.position(index, ctx.ids.length))}
      aria-haspopup="dialog"
      aria-expanded={ctx.menuFor === id}
      disabled={ctx.disabled}
      onClick={e => ctx.open(id, e.currentTarget)}
    >
      <GripVertical className={styles.gripMark} size={number ? 12 : 16} aria-hidden />
      {number && <span className={styles.handleN} aria-hidden>{index + 1}</span>}
    </button>
  );
  return children({
    handle: ctx.ids.length > 1 ? handle : null,
    itemRef: setNodeRef,
    itemStyle: {
      transform: CSS.Transform.toString(transform),
      transition,
      position: 'relative',
      zIndex: isDragging ? 2 : undefined,
      boxShadow: isDragging ? 'var(--shadow-lg)' : undefined,
      background: isDragging ? 'var(--card-bg)' : undefined,
    },
  });
}

