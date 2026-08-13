'use client';
import { useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAnchoredMenu, useDismissable } from '@/lib/overlay-hooks';
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
 */
export function CoachToolbarMenu({
  label,
  icon,
  disabled = false,
  children,
}: {
  /** The button's words — a plain string, so it is also the accessible name. */
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useDismissable(open, rootRef, () => setOpen(false));
  // Always right-aligned: these triggers sit at the right end of a right-pinned group, so a
  // left-aligned panel would hang off the page. A left-aligned variant can add the option back
  // when a caller actually needs one.
  const panelStyle = useAnchoredMenu(open, rootRef, panelRef, {
    minWidth: 260,
    narrowMinWidth: 200,
    align: 'end',
  });

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={`${styles.trigger}${open ? ` ${styles.triggerOpen}` : ''}`}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        {icon}
        {label}
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div
          ref={panelRef}
          className={styles.panel}
          style={panelStyle}
          role="menu"
          // One place decides that picking something closes the menu, so no item has to remember
          // to — including an item that goes on to open a dialog, which wants this menu gone
          // before it appears.
          onClick={event => { if ((event.target as HTMLElement).closest('button')) setOpen(false); }}
        >
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

/** A plain do-this-now row. */
export function CoachToolbarMenuItem({
  icon,
  label,
  hint,
  disabled = false,
  onSelect,
}: {
  icon?: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" className={styles.item} role="menuitem" disabled={disabled} onClick={onSelect}>
      {icon && <span className={styles.itemIcon}>{icon}</span>}
      <span className={styles.itemText}>
        <span className={styles.itemLabel}>{label}</span>
        {hint && <span className={styles.itemHint}>{hint}</span>}
      </span>
    </button>
  );
}

export function CoachToolbarMenuSeparator() {
  return <div className={styles.separator} role="separator" />;
}
