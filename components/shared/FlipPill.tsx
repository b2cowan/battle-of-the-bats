'use client';

/**
 * FlipPill — the one shared "flip to the other side of this event" control ("The Flip").
 *
 * ONE component, two feed modes, so the role side and the public side can never visually drift:
 *   • server-fed (shells): the caller resolves the twin from client context and passes `resolution`;
 *   • client-fed (public, P2): same prop, resolved from the anonymous tournament-viewer flow.
 *
 * Presentational + same-tab only. A `single` resolution is a plain <Link>; a `multi` resolution
 * (e.g. admin Results → Public Schedule/Standings, or a future multi-hat popover) is a button that
 * opens a compact anchored popover of same-tab rows. Neutral "system control" styling via semantic
 * tokens (never the event brand) so it adapts to the admin HUD now and the warm coach shell later.
 *
 * Return-memory (read): after a flip, if a fresh sessionStorage snapshot exists it overrides the
 * stateless twin with "⇄ Back to {origin}". Writes are wired in Phase 2; the read is inert until then.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { readReturnMemory, writeReturnMemory, clearReturnMemory, flipOriginLabel, type FlipResolution } from '@/lib/flip-twins';
import styles from './FlipPill.module.css';

interface FlipPillProps {
  resolution: FlipResolution;
  /** 'inline' = slim slot inside a bar/header; 'floating' = a docked content-corner control. */
  variant?: 'inline' | 'floating';
  /** Icon-only: shows just the ⇄ glyph (the label stays as the accessible name). Used by the admin
   *  header when it collapses on scroll, to free up the row for the event name. */
  compact?: boolean;
  /** Overrides the accessible name (defaults to the visible destination label). */
  ariaLabel?: string;
  className?: string;
}

export default function FlipPill({ resolution, variant = 'inline', compact = false, ariaLabel, className }: FlipPillProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Return-memory read (post-mount, so SSR/hydration is stateless — no flash, no CLS).
  const [back, setBack] = useState<{ href: string; label: string } | null>(null);
  // The page the flip landed on: the "⇄ Back to {origin}" affordance lives ONLY on this page. Once
  // the user navigates to a different section on this side, the memory is spent and the pill reverts
  // to the stateless page-matched twin (ratified spec: revert on navigate-to-a-different-section — a
  // per-instance ref, so a fresh arrival-side pill starts clean after each hop).
  const arrivalPathRef = useRef<string | null>(null);
  useEffect(() => {
    const mem = readReturnMemory(Date.now());
    if (!mem) { setBack(null); return; }
    const here = `${pathname}`;
    // Never offer a return to the page we're already on.
    if (mem.originUrl === here || mem.originUrl.startsWith(`${here}?`)) { setBack(null); return; }
    if (arrivalPathRef.current === null) arrivalPathRef.current = here; // first page after the hop
    if (arrivalPathRef.current === here) {
      setBack({ href: mem.originUrl, label: `Back to ${mem.label}` });
    } else {
      // Moved on to another section → spend the memory so the pill returns to the page-matched twin.
      clearReturnMemory();
      setBack(null);
    }
  }, [pathname]);

  // Close the popover on outside-click / Escape (mirrors the admin More-menu pattern).
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Stamp the return snapshot the instant a flip is taken — on EVERY hop, both directions — so the
  // arrival side's pill can read "⇄ Back to {this page}". The origin is the exact current URL
  // (search included, so a filtered schedule returns filtered); the label is derived from the path.
  const stampReturn = () => {
    try {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      writeReturnMemory({ originUrl: `${pathname}${search}`, label: flipOriginLabel(pathname) }, Date.now());
    } catch {
      /* non-fatal — stateless resolution still works */
    }
  };

  const rootClass = `${styles.wrap} ${variant === 'floating' ? styles.floating : styles.inline} ${className ?? ''}`;
  const pillClass = `${styles.pill} ${compact ? styles.compact : ''}`;
  // The ⇄ glyph + (unless compact) the destination text. The glyph is decorative; the accessible
  // name comes from aria-label, so icon-only stays labelled for screen readers.
  const inner = (text: string) => (
    <span className={styles.label}>
      <span className={styles.glyph} aria-hidden>⇄</span>
      {!compact && <span className={styles.labelText}>{text}</span>}
    </span>
  );

  // Return-memory (when present) always wins as a direct one-tap return.
  if (back) {
    return (
      <div className={rootClass}>
        <Link href={back.href} className={pillClass} aria-label={ariaLabel ?? back.label} onClick={stampReturn}>
          {inner(back.label)}
        </Link>
      </div>
    );
  }

  if (resolution.kind === 'single') {
    return (
      <div className={rootClass}>
        <Link href={resolution.target.href} className={pillClass} aria-label={ariaLabel ?? resolution.target.label} onClick={stampReturn}>
          {inner(resolution.target.label)}
        </Link>
      </div>
    );
  }

  // multi → button + anchored popover of same-tab rows
  return (
    <div className={rootClass} ref={wrapRef}>
      <button
        type="button"
        className={pillClass}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel ?? `${resolution.label} — choose a page`}
      >
        {inner(resolution.label)}
        <ChevronDown size={13} className={`${styles.caret} ${open ? styles.caretOpen : ''}`} aria-hidden />
      </button>
      {open && (
        <div className={styles.popover} role="menu">
          {resolution.targets.map(target => (
            <Link
              key={target.href}
              href={target.href}
              className={styles.row}
              role="menuitem"
              onClick={() => { stampReturn(); setOpen(false); }}
            >
              <span className={styles.rowLabel}>{target.label}</span>
              {target.sublabel && <span className={styles.rowSub}>{target.sublabel}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
