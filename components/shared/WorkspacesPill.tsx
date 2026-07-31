'use client';

/**
 * WorkspacesPill — the ENTER-side chooser (Nav Unification Stage D.2, owner-ratified
 * 2026-07-31). Renders ONLY when an account holds 2+ places: a "Workspaces ▾" trigger
 * (styled by the host row via `className`, so it wears each bar's existing pill skin)
 * opening a compact popover with one door per place, fed by the same shared resolver as
 * Home's Workspaces cards — the two can never disagree. Single-place accounts never see
 * this component: their pill stays a direct labelled door (zero change for the majority).
 *
 * Deliberately NOT FlipPill: the ⇄ glyph is reserved for SIDE (flip views of one place);
 * a plain pill means ENTER (go to a workspace) — one corner, one vocabulary (grammar Zone 3).
 * Mirrors FlipPill's chooser ruling (2026-07-28): the list shows the same named
 * destinations every time, in Home's order.
 */

import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useDismissable } from '@/lib/overlay-hooks';
import { WORKSPACES_POPOVER_THRESHOLD } from '@/lib/use-role-summary';
import type { WorkspaceDoor } from '@/lib/user-contexts';
import styles from './WorkspacesPill.module.css';

export default function WorkspacesPill({
  workspaces,
  className,
  warm = false,
}: {
  workspaces: WorkspaceDoor[];
  /** The host bar's pill class — the trigger inherits that row's exact skin. */
  className?: string;
  /** Warm consumer bar: swaps the popover onto the paper/ink token set (the --home-* vars
   *  the warm bar already defines) instead of the dark HUD tokens. */
  warm?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useDismissable(open, wrapRef, () => setOpen(false));

  // Close on ANY route change, not just row clicks — this control lives in persistent layout
  // chrome, so browser Back/Forward (no pointerdown, no click) would otherwise leave a stale
  // open popover over the new page. Render-time adjustment (the repo's established lastPath
  // pattern — mirrors StartMenu), never setState-in-effect.
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Belt-and-braces with resolveOperatorDoor (the callers' gate), reading the SAME shared
  // threshold: one place → the caller's direct pill is the right control, never a chooser of one.
  if (workspaces.length < WORKSPACES_POPOVER_THRESHOLD) return null;

  return (
    <div className={`${styles.wrap} ${warm ? styles.warm : ''}`} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.trigger} ${className ?? ''}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Workspaces — choose a place"
      >
        Workspaces
        <ChevronDown size={13} className={`${styles.caret} ${open ? styles.caretOpen : ''}`} aria-hidden />
      </button>
      {open && (
        <div className={styles.popover} role="menu">
          {workspaces.map(w => (
            <Link
              key={`${w.kind}:${w.href}`}
              href={w.href}
              className={styles.row}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <span className={styles.rowCap}>{w.label}</span>
              <span className={styles.rowTitle}>{w.title}</span>
            </Link>
          ))}
          {/* The canonical list stays on Home — the popover is doors, never a second list. */}
          <Link href="/discover" className={styles.footerRow} role="menuitem" onClick={() => setOpen(false)}>
            All workspaces
          </Link>
        </div>
      )}
    </div>
  );
}
