'use client';
/**
 * components/public/ClubClosureStrip.tsx — THE CLOSED PLACES families see (Club Website Stage 2, Session 2C; K3, K4,
 * K16; summarized by S1–S3, owner 2026-11-26, drawing CLUB_WEBSITE_STAGE2_SUMMARY_DRAWINGS.html tabs 1–2).
 *
 * At the top of every club, team and house league page, ABOVE the club's own notice and in its own box (K4: a closure
 * never ends or replaces the notice): a day's one place as one sentence, a day's several as a heading and a row per park,
 * then the notice's own small line ("Posted 7:10 a.m. by the club · ends tonight"). Fixed words only (K16): the admin's
 * line goes in the families' email, never here. The server hands in the box already said (`closureStrip`, in the club's
 * zone); this only draws, and takes each day down at its end — a page left open past midnight, or one a service worker
 * kept, never says a place is closed after its Until.
 *
 * S3: past five rows, four show and ONE button opens the rest in place ("Show 4 more places" · "Show fewer"). It is the
 * strip's only control: no link, no motion.
 *
 * `ClosureStripBox` is the box alone, for the Close a place window's preview (it wears the club's tokens there).
 */
import { useEffect, useState } from 'react';
import { closureShowMore, stripShown, type ClosureStrip, type ClosureStripGroup } from '@/lib/club-notice';
import { SHOW_FEWER, useShowMore } from './ClubMoreRow';
import styles from './ClubFrame.module.css';

export function ClosureStripBox({ groups, smallLine }: { groups: readonly ClosureStripGroup[]; smallLine: string }) {
  const { open, ref, toggle } = useShowMore<HTMLDivElement>();
  const shown = stripShown(groups, open);
  return (
    <div className={styles.noticeInner} ref={ref}>
      {shown.groups.map(g => ('sentence' in g
        ? <p key={g.sentence} className={styles.noticeLine}>{g.sentence}</p>
        : (
          <div key={g.heading} className={styles.noticeGroup}>
            <p className={styles.noticeLine}>{g.heading}</p>
            {g.rows.map((r, i) => (
              <p key={`${i}:${r.park}`} className={styles.noticeRow}><b>{r.park}</b>{r.what ? `: ${r.what}` : ''}</p>
            ))}
          </div>
        )))}
      {shown.fold !== null && (
        <button type="button" className={styles.noticeMore} aria-expanded={open} onClick={toggle}>
          {open ? SHOW_FEWER : closureShowMore(shown.fold)}
        </button>
      )}
      <p className={styles.noticeSmall}>{smallLine}</p>
    </div>
  );
}

export default function ClubClosureStrip({ strip }: { strip: ClosureStrip }) {
  const [nowMs, setNowMs] = useState<number | null>(null);
  const showing = nowMs === null ? strip.groups : strip.groups.filter(g => Date.parse(g.endsAt) > nowMs);

  useEffect(() => {
    // One timer per run: first read the clock (a kept page drops an ended day at once), then wake at the next day's end.
    // A timer longer than ~24.8 days overflows; a closure that far out is re-read on the next page load anyway.
    const now = Date.now();
    const ends = strip.groups.map(g => Date.parse(g.endsAt)).filter(at => at > now);
    const wait = nowMs === null ? 0 : ends.length ? Math.min(...ends) - now : null;
    if (wait === null || wait > 2 ** 31 - 1) return;
    const t = window.setTimeout(() => setNowMs(Date.now()), wait);
    return () => window.clearTimeout(t);
  }, [strip, nowMs]);

  if (!showing.length) return null;
  return (
    <aside className={styles.notice} aria-label="Closed places">
      <ClosureStripBox groups={showing} smallLine={strip.smallLine} />
    </aside>
  );
}
