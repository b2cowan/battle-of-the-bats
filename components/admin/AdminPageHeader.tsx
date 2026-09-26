'use client';
/**
 * AdminPageHeader — the admin's ONE page header (Admin Design Continuity slice 1, ruling F3).
 *
 *   [← way up | ] [eyebrow]
 *                 [h1 title] [titleChips] … [actions]
 *
 * The coaches portal's `CoachPageHeader`, as the ratified admin drawings show it (ADC specimen 2,
 * club Stage 1 specimens 1, 5, 7, 11): the same slots and phone behaviour, with an EYEBROW above the
 * title naming the program or tournament a page sits in, and no icon tile (none of the drawings
 * carries one).
 *
 * ⚠ NO SUBTITLE SLOT EXISTS, by construction (F3; `CoachPageHeader`'s 2026-08-11 ruling). A live fact
 * that sat under a title moves to the body it describes; a required framing line moves into the card
 * it frames. Every move is listed in the slice's handoff — a fact is re-homed, never dropped.
 *
 * ⚠ BEHIND THE SWITCH. `legacy` is the page's own header exactly as it renders today, and it is
 * what renders while the switch is off (`useAdminKit()`), byte for byte — the identity check holds
 * that. The release slice deletes the prop and every page's legacy markup with it. Pages convert
 * as their area is restyled, not all at once (build prompt, slice 1).
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAdminKit } from '@/components/admin/AdminKitProvider';
import styles from './AdminPageHeader.module.css';

export default function AdminPageHeader({
  legacy,
  eyebrow,
  title,
  titleChips,
  actions,
  backTo,
}: {
  /** Today's header, rendered unchanged while the switch is off. */
  legacy: ReactNode;
  /** The program or tournament the page sits in. Never a count — that is a subtitle wearing a hat. */
  eyebrow?: ReactNode;
  /** The page's name, or the record's name on a drill-in. */
  title: ReactNode;
  /** Identity/state chips beside the title. Never quantities. */
  titleChips?: ReactNode;
  /** The page's actions: primary + secondaries. */
  actions?: ReactNode;
  /** The way up, in the leading corner (the coach header's `backTo`, owner ruling 2026-08-26). */
  backTo?: { href: string; label: string };
}) {
  const kit = useAdminKit();
  if (!kit) return <>{legacy}</>;
  return (
    <div className={styles.header}>
      <div className={styles.left}>
        {backTo && (
          <>
            <Link href={backTo.href} className={styles.back} aria-label={`Back to ${backTo.label}`}>
              <ArrowLeft size={15} aria-hidden />
              <span className={styles.backLabel}>{backTo.label}</span>
            </Link>
            <span className={styles.backRule} aria-hidden />
          </>
        )}
        <div className={styles.titleBlock}>
          {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{title}</h1>
            {titleChips}
          </div>
        </div>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
