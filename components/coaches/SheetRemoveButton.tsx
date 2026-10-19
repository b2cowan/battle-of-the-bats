'use client';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * Remove, at a sheet's footer LEFT (re-evaluation stage 3, 2026-09-15 — "delete is never a row
 * action; it lives in the record's editor", the table standard §3.6). The goal, the observation and
 * the bench-side result sheets all carry one in edit mode; the host confirms and deletes. Rendered
 * in the window's `footerStart` (One Window Stage 2b), at the foot's left, apart from Cancel and Save.
 */
export default function SheetRemoveButton({ label, busy, onRemove }: { label: string; busy: boolean; onRemove: () => void }) {
  return (
    <button type="button" className={styles.btnGhost} disabled={busy} onClick={onRemove}>{label}</button>
  );
}
