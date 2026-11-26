'use client';
/**
 * components/public/ClubClosureStrip.tsx — THE CLOSED PLACES families see (Club Website Stage 2, Session 2C; K3, K4,
 * K16; drawing tab 4, https://claude.ai/artifact/N332KzJg8NgFJb4oZvJhwM).
 *
 * At the top of every club, team and house league page, ABOVE the club's own notice and in its own box (K4: a closure
 * never ends or replaces the notice): a line per closed place in the order closed, then the notice's own small line
 * ("Posted 7:10 a.m. by the club · ends tonight"). Fixed words only (K16): the admin's line goes in the families' email,
 * never here. The server hands in the lines already said (`closureStrip`, in the club's zone); this only draws, and
 * takes each line down at its end — a page left open past midnight, or one a service worker kept, never says a place
 * is closed after its Until. No motion, and no control beyond what the notice carries.
 */
import { useEffect, useState } from 'react';
import type { ClosureStrip } from '@/lib/club-notice';
import styles from './ClubFrame.module.css';

export default function ClubClosureStrip({ strip }: { strip: ClosureStrip }) {
  const [nowMs, setNowMs] = useState<number | null>(null);
  const showing = nowMs === null ? strip.lines : strip.lines.filter(l => Date.parse(l.endsAt) > nowMs);

  useEffect(() => {
    // One timer per run: first read the clock (a kept page drops an ended line at once), then wake at the next line's end.
    // A timer longer than ~24.8 days overflows; a closure that far out is re-read on the next page load anyway.
    const now = Date.now();
    const ends = strip.lines.map(l => Date.parse(l.endsAt)).filter(at => at > now);
    const wait = nowMs === null ? 0 : ends.length ? Math.min(...ends) - now : null;
    if (wait === null || wait > 2 ** 31 - 1) return;
    const t = window.setTimeout(() => setNowMs(Date.now()), wait);
    return () => window.clearTimeout(t);
  }, [strip, nowMs]);

  if (!showing.length) return null;
  return (
    <aside className={styles.notice} aria-label="Closed places">
      <div className={styles.noticeInner}>
        {showing.map(l => <p key={l.sentence} className={styles.noticeLine}>{l.sentence}</p>)}
        <p className={styles.noticeSmall}>{strip.smallLine}</p>
      </div>
    </aside>
  );
}
