'use client';

/**
 * ONE PRINTED PAGE for the tournament admin's paper — Summary's (Stage 4, J1-110) and the Staff kit's
 * (Stage 6, F65). A copy portalled onto <body>, hidden on screen; in print every other child of <body>
 * leaves the paper (the coaches portal's certificate form), so no strip, rail, header, button, bar or
 * demo bar prints around it. Letter, one page, its inks fixed whatever the admin's theme.
 *
 * The frame draws the paper, its eyebrow, the title, the dates and the foot; the caller draws what sits
 * between them. `name` marks the copy (`data-print-page`) for a probe or a test to find.
 */

import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './PrintedPage.module.css';

const noSubscribe = () => () => {};

export default function PrintedPage({ name, eyebrow, title, dates, foot, children }: {
  name: string;
  eyebrow: string;
  title: string;
  dates?: string | null;
  foot: ReactNode;
  children: ReactNode;
}) {
  // A portal onto <body>: only in the browser.
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  if (!inBrowser) return null;
  return createPortal(
    <div className={styles.printCopy} data-print-page={name}>
      {/* Letter, no @page margin: the browser's own header and footer print IN the margin, so a page
          with none has nowhere to put them; the sheet carries its own padding. */}
      <style>{'@page { size: 8.5in 11in; margin: 0; }'}</style>
      <div className={styles.paper}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        {dates && <p className={styles.dates}>{dates}</p>}
        {children}
        <div className={styles.foot}>{foot}</div>
      </div>
    </div>,
    document.body,
  );
}

