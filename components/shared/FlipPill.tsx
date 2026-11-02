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
 * stateless twin with a direct return to the exact page they came from, labelled by DESTINATION
 * (e.g. "Admin") — never "Back to …" (owner call 2026-07-31).
 *
 * THE ICON NAMES THE DESTINATION TOO (owner 2026-10-20): a globe for the public side, the club office (a building) for
 * the viewer's own side. It replaced a typed ⇄ character, which no product face carries — the phone
 * borrowed it from a system font, thin and off-centre — and which, alone on a phone, said "flip" but
 * never where to.
 */

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronDown, Globe } from 'lucide-react';
import { flipDoorRows, flipLandsOnPublic, type FlipResolution } from '@/lib/flip-twins';
import { useFlipReturn } from '@/lib/hooks/useFlipReturn';
import { useDismissable } from '@/lib/overlay-hooks';
import styles from './FlipPill.module.css';

interface FlipPillProps {
  resolution: FlipResolution;
  /** 'inline' = slim slot inside a bar/header; 'floating' = a docked content-corner control. */
  variant?: 'inline' | 'floating';
  /** Icon-only: a bare icon door showing just the destination icon (the label stays the accessible name, and
   *  the hover tooltip). The public pages' doors wear it at every width (the club's bar, a tournament's header
   *  and the platform strip, owner 2026-10-20); the admin header wears it when it collapses on scroll. */
  compact?: boolean;
  /** Overrides the accessible name (defaults to the visible destination label). */
  ariaLabel?: string;
  className?: string;
}

export default function FlipPill({ resolution, variant = 'inline', compact = false, ariaLabel, className }: FlipPillProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Return-memory read + stamp: shared with the account sheet's Go to block (lib/hooks/useFlipReturn.ts).
  const { back, stampReturn } = useFlipReturn();

  useDismissable(open, wrapRef, () => setOpen(false));

  const rootClass = `${styles.wrap} ${variant === 'floating' ? styles.floating : styles.inline} ${className ?? ''}`;
  const pillClass = `${styles.pill} ${compact ? styles.compact : ''}`;
  // An icon-only door names its destination on hover too: a mouse user can check where it goes before leaving.
  const tip = (label: string) => (compact ? label : undefined);
  // The destination icon + (unless compact) the destination text. The icon is decorative; the
  // accessible name comes from aria-label, so icon-only stays labelled for screen readers. Sized by
  // the stylesheet per container (desk, phone, the club's tile), so no size rides on the element.
  const inner = (text: string, toPublic: boolean) => {
    const Icon = toPublic ? Globe : Building2;
    return (
      <span className={styles.label}>
        <Icon className={styles.glyph} strokeWidth={1.8} aria-hidden />
        {!compact && <span className={styles.labelText}>{text}</span>}
      </span>
    );
  };

  // Not yet known what this control is (the admin shell resolves its event + roles in the browser).
  // Hold the space and show NOTHING rather than paint a stand-in that gets replaced a moment later —
  // an empty corner that fills in reads as loading; a label that rewrites itself reads as a bug.
  // aria-hidden + inert so a screen reader never announces a placeholder.
  if (resolution.pending) {
    // Size from the label the CALLER expects, not a fixed string. Every pending caller used to
    // resolve to "Public site", so a hardcoded stand-in happened to match; the platform strip
    // resolves to "Admin" / "Coaches Portal" / "Roles" instead, and reserving the wrong width makes
    // the control jump on arrival — the very thing this state exists to prevent.
    const pendingLabel = resolution.kind === 'single' ? resolution.target.label : resolution.label;
    return (
      <div className={rootClass} aria-hidden>
        <span className={`${pillClass} ${styles.pendingPlaceholder}`}>
          {inner(pendingLabel, flipLandsOnPublic(resolution))}
          {/* A chooser resolves with a caret, so reserve its width too or the pill grows on arrival. */}
          {resolution.kind === 'multi' && <ChevronDown size={13} className={styles.caret} aria-hidden />}
        </span>
      </div>
    );
  }

  // Return-memory on a SINGLE resolution wins outright as a direct one-tap return (ratified P2).
  // On a MULTI resolution it must NOT take over: doing so strands a multi-hat user in a two-way
  // admin⇄coach toggle with no way back to their other roles or the public site until they navigate
  // away to spend the memory. So there it becomes the first ROW of the chooser instead (P4 fix).
  if (back && resolution.kind === 'single') {
    return (
      <div className={rootClass}>
        <Link href={back.href} className={pillClass} aria-label={ariaLabel ?? back.label} title={tip(back.label)} onClick={stampReturn} data-flip-door="">
          {inner(back.label, flipLandsOnPublic({ kind: 'single', target: back }))}
        </Link>
      </div>
    );
  }

  if (resolution.kind === 'single') {
    return (
      <div className={rootClass}>
        <Link href={resolution.target.href} className={pillClass} aria-label={ariaLabel ?? resolution.target.label} title={tip(resolution.target.label)} onClick={stampReturn} data-flip-door="">
          {inner(resolution.target.label, flipLandsOnPublic(resolution))}
        </Link>
      </div>
    );
  }

  // multi → button + anchored popover of same-tab rows.
  //
  // A CHOOSER SHOWS THE SAME NAMED DESTINATIONS EVERY TIME (owner ruling 2026-07-28). Return-memory
  // is deliberately ignored here: rewriting one row to a return made the list shift under people
  // depending on how they arrived, and the destination is already in the list under its own name —
  // so returning is still one row away, just labelled by WHERE it goes rather than how you got here.
  // (Single-target pills keep the ratified one-tap direct return above — nothing to shift.)
  const rows = flipDoorRows(resolution, back);

  return (
    <div className={rootClass} ref={wrapRef}>
      <button
        type="button"
        className={pillClass}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel ?? `${resolution.label} — choose a page`}
        title={tip(resolution.label)}
        data-flip-door=""
      >
        {inner(resolution.label, flipLandsOnPublic(resolution))}
        <ChevronDown size={13} className={`${styles.caret} ${open ? styles.caretOpen : ''}`} aria-hidden />
      </button>
      {open && (
        <div className={styles.popover} role="menu">
          {rows.map(target => (
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
