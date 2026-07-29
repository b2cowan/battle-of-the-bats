'use client';
import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * "Start simple, add detail if you need it" — the premium portal's shared progressive-disclosure
 * group (Batch 2, P0 #8). The free portal solved field-overwhelm on the identical forms with a
 * `+ Add … (optional)` toggle over a small titled panel; this is that pattern as one control every
 * heavy sheet uses, so the two tiers can't drift apart again.
 *
 * Contract:
 * - **Children stay mounted when collapsed** (hidden, not unmounted). Form state, validation, and
 *   unsaved-changes tracking keep working, and a field that fails validation while collapsed still
 *   holds its value when the coach opens the group.
 * - **`defaultOpen` is a mount-only hint** — same rule as `CollapsibleCard`. Callers pass
 *   `defaultOpen` when the record being edited already has data in this group, so nothing a coach
 *   typed is ever hidden from them; after mount the coach's own toggle always wins and no parent
 *   re-render can re-collapse the group under them.
 * - **`meta`** shows a live summary on the collapsed toggle (e.g. "2 set"), so a collapsed group
 *   never conceals a value that is actually in effect.
 */
export default function CoachFormDisclosure({
  label,
  title,
  note,
  meta,
  defaultOpen = false,
  children,
}: {
  /** Collapsed-state call to action, e.g. "Add parent / guardian contact". */
  label: string;
  /** Open-state group heading. Defaults to `label`. */
  title?: string;
  /** One line explaining why this group exists — shown only while open. */
  note?: ReactNode;
  /** Short live summary shown on the collapsed toggle when the group holds data. */
  meta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (!open) {
    return (
      <>
        <button type="button" className={styles.discToggle} onClick={() => setOpen(true)}>
          <span className={styles.discToggleIcon}><Plus size={14} aria-hidden /></span>
          {label}
          {meta ? <span className={styles.discToggleMeta}>{meta}</span> : null}
        </button>
        {/* Mounted but hidden — see the contract note above. */}
        <div className={styles.discHidden} aria-hidden>{children}</div>
      </>
    );
  }

  return (
    <section className={styles.formSection}>
      <div className={styles.discHead}>
        <h4 className={styles.formSectionTitle}>{title ?? label}</h4>
        <button type="button" className={styles.discHide} onClick={() => setOpen(false)}>Hide</button>
      </div>
      {note ? <p className={styles.discNote}>{note}</p> : null}
      {children}
    </section>
  );
}
