'use client';
/**
 * components/public/ClubNoticeBanner.tsx — THE CLUB NOTICE families see (Club Tier Stage 4c-1, Ask 16; drawings ~L1802;
 * words CLUB_TIER_STAGE4C1_COPY.md §F).
 *
 * At the top of every club page and team page, under the club's bar: the club's line in bold, its detail, and "Posted
 * 2:40 p.m. by the club · ends tonight". The club's own words, never generated. The server hands in the line already
 * said (`noticeSmallLine`, in the club's zone); this only draws, and takes itself down at `endsAt` — a page left open
 * past midnight, or one a service worker kept, never shows a notice that has ended.
 */
import { useEffect, useState } from 'react';
import { siteEdit } from '@/lib/site-edit-marks';
import styles from './ClubFrame.module.css';

export interface ClubFrameNotice {
  notice: string;
  detail: string | null;
  smallLine: string;
  endsAt: string;
}

export default function ClubNoticeBanner({ notice }: { notice: ClubFrameNotice }) {
  const endsAtMs = Date.parse(notice.endsAt);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    // Already over (a page a service worker kept): the timer fires at once. A timer longer than ~24.8 days overflows;
    // a notice that far out is re-read on the next page load anyway.
    const left = Math.max(0, endsAtMs - Date.now());
    if (left > 2 ** 31 - 1) return;
    const t = window.setTimeout(() => setEnded(true), left);
    return () => window.clearTimeout(t);
  }, [endsAtMs]);

  if (ended) return null;
  return (
    <aside className={styles.notice} aria-label="Club notice" {...siteEdit('notice')}>
      <div className={styles.noticeInner}>
        <p className={styles.noticeLine}>{notice.notice}</p>
        {notice.detail && <p className={styles.noticeDetail}>{notice.detail}</p>}
        <p className={styles.noticeSmall}>{notice.smallLine}</p>
      </div>
    </aside>
  );
}
