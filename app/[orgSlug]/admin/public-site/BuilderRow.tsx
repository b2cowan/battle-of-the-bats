'use client';
/**
 * ONE ROW OF THE PUBLIC SITE BUILDER (ruled 2026-10-21, A1): a settings card that opens IN PLACE at every width (the
 * 2026-10-12 rule) and says what is in it in one line while closed. One row is open at a time — the page decides, so a
 * click in the preview can open the row that sets the part clicked (A9).
 *
 * The body STAYS MOUNTED while closed (hidden, not removed), so a field being typed in keeps its words and its waiting
 * save when the club opens another row.
 *
 * `mark` — the first-run marks (A8): a filled tick for a part that is ready, a dashed ring for one that is not; absent
 * once the site is online and every part is ready.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import styles from './public-site.module.css';

export default function BuilderRow({ id, title, summary, mark, open, onToggle, children }: {
  id: string;
  title: string;
  summary: ReactNode;
  mark?: { ready: boolean; label: string } | null;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  // Opened from elsewhere (the preview, the checklist): bring it into view, gently, unless it already is.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) {
      const r = ref.current?.getBoundingClientRect();
      if (r && (r.top < 0 || r.top > window.innerHeight - 80)) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <section ref={ref} id={id} className={`${styles.row}${open ? ` ${styles.rowOpen}` : ''}`} aria-labelledby={`${id}-title`}>
      <h2 className={styles.rowHeading}>
        <button type="button" className={styles.rowHead} aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}>
          {mark && (
            <span className={mark.ready ? styles.markDone : styles.markToDo} role="img" aria-label={mark.label}>
              {mark.ready && <Check size={13} strokeWidth={3} aria-hidden />}
            </span>
          )}
          <span className={styles.rowText}>
            <span id={`${id}-title`} className={styles.rowTitle}>{title}</span>
            <span className={styles.rowSummary}>{summary}</span>
          </span>
          <ChevronDown size={18} className={styles.rowChevron} aria-hidden />
        </button>
      </h2>
      <div id={`${id}-body`} className={styles.rowBody} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
