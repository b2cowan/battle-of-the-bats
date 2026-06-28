'use client';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X } from 'lucide-react';
import {
  RELEASE_ENTRIES,
  CATEGORY_LABELS,
  type ReleaseCategory,
} from '@/lib/release-notes';
import styles from './whats-new.module.css';

interface Props {
  triggerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

const PANEL_WIDTH = 340;
const GAP = 8;
const MARGIN = 8;
/** How many recent releases to show in the popover (full history lives on /changelog). */
const MAX_ENTRIES = 4;

const TAG_CLASS: Record<ReleaseCategory, string> = {
  new: styles.tagNew,
  improved: styles.tagImproved,
  fixed: styles.tagFixed,
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export default function WhatsNewPanel({ triggerRef, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Position the panel relative to the trigger, escaping any sidebar clipping by
  // portaling to <body> with fixed coords. Prefer to the right of the trigger
  // (sidebar case); if that overflows, drop below and right-align (mobile top bar).
  useLayoutEffect(() => {
    function place() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const r = trigger.getBoundingClientRect();
      let left = r.right + GAP;
      let top = r.top;
      if (left + PANEL_WIDTH > window.innerWidth - MARGIN) {
        // Not enough room to the right — drop below, right-aligned to the trigger.
        left = r.right - PANEL_WIDTH;
        top = r.bottom + GAP;
      }
      left = Math.max(MARGIN, Math.min(left, window.innerWidth - PANEL_WIDTH - MARGIN));
      top = Math.max(MARGIN, top);
      setPos({ top, left });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [triggerRef]);

  // Esc to close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const entries = RELEASE_ENTRIES.slice(0, MAX_ENTRIES);

  return createPortal(
    <div
      ref={panelRef}
      className={styles.panel}
      data-whats-new-panel
      role="dialog"
      aria-label="What's new"
      style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
    >
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>What’s new</span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close" title="Close">
          <X size={15} aria-hidden />
        </button>
      </div>

      <ul className={styles.list}>
        {entries.map(entry => (
          <li key={entry.date} className={styles.entry}>
            <time className={styles.entryDate} dateTime={entry.date}>{formatDate(entry.date)}</time>
            <p className={styles.entryTitle}>{entry.title}</p>
            {entry.highlights.map((h, i) => (
              <div key={i} className={styles.highlight}>
                <span className={`${styles.tag} ${TAG_CLASS[h.category]}`}>
                  {CATEGORY_LABELS[h.category]}
                </span>
                <span className={styles.highlightText}>{h.text}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>

      <div className={styles.footer}>
        <Link
          href="/changelog"
          className={styles.seeAll}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
        >
          See all updates →
        </Link>
      </div>
    </div>,
    document.body,
  );
}
