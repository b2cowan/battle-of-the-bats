'use client';
import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { LATEST_RELEASE_DATE } from '@/lib/release-notes';
import WhatsNewPanel from './WhatsNewPanel';
import styles from './whats-new.module.css';

const SEEN_KEY = 'fl_whats_new_seen';

/**
 * In-app "What's New" control for the logged-in admin & coach shells. Shows a
 * sparkle icon with a lime dot when there's a release newer than the one this
 * device last viewed, and opens a compact in-context popover of recent updates
 * (full history on /changelog). "Seen" is tracked per device in localStorage —
 * no DB, no migration (Phase 2 of the release-notes plan).
 */
export default function WhatsNewButton() {
  // `undefined` = localStorage not read yet (SSR + first client render); a string
  // or null once read. Gating the dot on "read yet" keeps SSR/first-client render
  // identical, so there's no hydration mismatch.
  const [seen, setSeen] = useState<string | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(SEEN_KEY);
    } catch {
      /* localStorage unavailable — treat as nothing seen */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read from an external store (localStorage) after mount
    setSeen(stored);
  }, []);

  // Click outside closes the panel (the panel is portaled to <body>).
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!target) return;
      if (wrapRef.current?.contains(target)) return;
      if (target.closest('[data-whats-new-panel]')) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const hasNew =
    seen !== undefined && LATEST_RELEASE_DATE !== '' && (seen ?? '') < LATEST_RELEASE_DATE;

  function handleOpen() {
    setOpen(o => !o);
    // Opening = the user has now seen the latest; clear the dot.
    if (!open && LATEST_RELEASE_DATE) {
      try {
        localStorage.setItem(SEEN_KEY, LATEST_RELEASE_DATE);
      } catch {
        /* ignore */
      }
      setSeen(LATEST_RELEASE_DATE);
    }
  }

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        ref={btnRef}
        className={`${styles.btn} ${hasNew ? styles.hasNew : ''}`}
        onClick={handleOpen}
        aria-label={hasNew ? 'What’s new — updates available' : 'What’s new'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="What’s new"
      >
        <Sparkles size={16} aria-hidden />
        {hasNew && <span className={styles.dot} aria-hidden />}
      </button>

      {open && <WhatsNewPanel triggerRef={btnRef} onClose={() => setOpen(false)} />}
    </div>
  );
}
