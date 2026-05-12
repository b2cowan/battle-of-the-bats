'use client';
import { useState, useRef, useEffect } from 'react';
import styles from './help.module.css';

interface HelpTooltipProps {
  title: string;
  body: string;
  size?: 'sm' | 'md';
}

const SIZE_CLASS = { sm: styles.tooltipSm, md: styles.tooltipMd };

export default function HelpTooltip({ title, body, size = 'sm' }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  // Close on outside click (handles mobile tap-outside)
  useEffect(() => {
    if (!open) return;
    function onOutsideClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className={`${styles.tooltip} ${SIZE_CLASS[size]}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={styles.tooltipTrigger}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        aria-expanded={open}
        aria-label={title}
      >
        ?
      </button>
      {open && (
        <div className={styles.tooltipPopover} role="tooltip" aria-label={title}>
          <p className={styles.tooltipTitle}>{title}</p>
          <p className={styles.tooltipBody}>{body}</p>
        </div>
      )}
    </span>
  );
}
