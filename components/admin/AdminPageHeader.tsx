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
 * ⚠ `legacy` IS READ BY NOTHING (Admin Design Continuity Part B, 2026-09-29). It held each page's old
 * header for the dev-only switch; since the release this header is the only one that renders. The prop
 * stays accepted while the cleanup runs area by area — each area deletes its pages' old header markup
 * in its own pass — and the last area deletes the prop. Never pass it on a new page.
 */
import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import styles from './AdminPageHeader.module.css';

/** One step of the eyebrow's path: a way back when it has an `href`, plain words when it does not. */
export type AdminCrumb = { href?: string; label: string };

export default function AdminPageHeader({
  eyebrow,
  crumbs,
  title,
  titleChips,
  actions,
  backTo,
}: {
  /** @deprecated Read by nothing — the page's old header, deleted by its area's Part B pass (above). */
  legacy?: ReactNode;
  /** The program or tournament the page sits in. Never a count — that is a subtitle wearing a hat. */
  eyebrow?: ReactNode;
  /** The eyebrow as a PATH — "Rep Teams · Northfield Minor Ball", each step with an `href` a link back —
   *  joined by " · ". A falsy step, or one with no words (`{ label: currentOrg?.name ?? '' }` before the
   *  organization has loaded), is skipped. Takes
   *  the place of `eyebrow` when given (Admin Design Continuity slice 3: one path idiom, one crumb style). */
  crumbs?: ReadonlyArray<AdminCrumb | false | null | undefined>;
  /** The page's name, or the record's name on a drill-in. */
  title: ReactNode;
  /** Identity/state chips beside the title. Never quantities. */
  titleChips?: ReactNode;
  /** The page's actions: primary + secondaries. */
  actions?: ReactNode;
  /** The way up, in the leading corner (the coach header's `backTo`, owner ruling 2026-08-26). */
  backTo?: { href: string; label: string };
}) {
  const path = crumbs?.filter((c): c is AdminCrumb => !!c && !!c.label);
  const eyebrowContent = path?.length
    ? path.map((c, i) => (
        <Fragment key={i}>
          {i > 0 && ' · '}
          {c.href ? <Link href={c.href} className={styles.crumb}>{c.label}</Link> : c.label}
        </Fragment>
      ))
    : eyebrow;
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
          {eyebrowContent && <div className={styles.eyebrow}>{eyebrowContent}</div>}
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
