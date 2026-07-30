'use client';
import { useState, useRef, useId, type ReactNode } from 'react';
import { useDismissable } from '@/lib/overlay-hooks';
import styles from './help.module.css';

interface HelpTooltipProps {
  title: string;
  /** Plain-text body (default). Ignored when `content` is provided. */
  body?: string;
  /** Optional rich body — pass structured JSX (lists, labelled rows) for content that
   *  doesn't read well as a single paragraph. Falls back to `body` when omitted. */
  content?: ReactNode;
  size?: 'sm' | 'md';
}

const SIZE_CLASS = { sm: styles.tooltipSm, md: styles.tooltipMd };

export default function HelpTooltip({ title, body, content, size = 'sm' }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');
  const wrapRef = useRef<HTMLSpanElement>(null);
  const popoverId = useId();

  // Open below the trigger when there isn't room above it (trigger near the top of
  // the viewport), so the popover never gets clipped by the window's top edge.
  function show() {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) setPlacement(rect.top < 240 ? 'bottom' : 'top');
    setOpen(true);
  }
  // True while a pointer (mouse/touch) is driving the interaction, so the
  // tap-to-toggle (onClick) and keyboard-focus-to-open (onFocus) paths don't
  // fight: a tap fires focus AND click, which would otherwise open-then-close.
  const pointerDriven = useRef(false);

  // Outside tap/click + Escape. The shared hook now listens on `pointerdown` for the reason this
  // component discovered first and carried alone: mousedown does not fire for taps on iOS Safari,
  // which left this popover stuck. Escape also becomes document-level, so a popover opened by HOVER
  // is now dismissable from the keyboard — it previously only responded while the trigger had focus.
  useDismissable(open, wrapRef, () => setOpen(false));

  return (
    <span
      ref={wrapRef}
      className={`${styles.tooltip} ${SIZE_CLASS[size]} ${placement === 'bottom' ? styles.tooltipBottom : ''}`}
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={styles.tooltipTrigger}
        onPointerDown={() => { pointerDriven.current = true; }}
        // Clear the guard once the pointer gesture ends (focus has already fired
        // by now), so a later keyboard focus still opens — even if the gesture
        // was cancelled mid-way (e.g. a tap that turned into a scroll).
        onPointerUp={() => { pointerDriven.current = false; }}
        onPointerCancel={() => { pointerDriven.current = false; }}
        onClick={e => { e.stopPropagation(); if (open) setOpen(false); else show(); }}
        onFocus={() => { if (!pointerDriven.current) show(); }}
        onBlur={() => { setOpen(false); pointerDriven.current = false; }}
        aria-label={title}
        aria-describedby={open ? popoverId : undefined}
      >
        ?
      </button>
      {open && (
        <div id={popoverId} className={styles.tooltipPopover} role="tooltip">
          <p className={styles.tooltipTitle}>{title}</p>
          {content ?? <p className={styles.tooltipBody}>{body}</p>}
        </div>
      )}
    </span>
  );
}
