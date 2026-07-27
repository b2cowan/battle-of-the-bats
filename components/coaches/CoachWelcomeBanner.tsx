'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PartyPopper, X } from 'lucide-react';
import SharePageButton from '@/components/public/SharePageButton';
import styles from './CoachWelcomeBanner.module.css';

/**
 * First-run greeting shown ONCE on the coach's tournament record, immediately after they
 * register (the register flow redirects here with `?welcome=1`). A3 slimmed it to the
 * celebration line only — the tournament resource links now live permanently in the
 * record's "From the Organizer" zone, and orientation ("what happens next") lives in the
 * Status & Payment zone, so nothing of value dies with the dismissal. Dismissing strips
 * the `welcome` param so a refresh won't re-show it — no DB state, no "seen" flag.
 */
export default function CoachWelcomeBanner({
  teamName,
  tournamentName,
  status,
  shareHref,
}: {
  teamName: string;
  tournamentName: string | null;
  status: 'pending' | 'waitlist';
  /**
   * B1.3 (◆J1): the celebration half of the share — "we're in!" is at its most
   * shareable in the seconds after registering. Null when the tournament isn't
   * public yet (a just-registered team can precede the event going live), and the
   * permanent copy in the record's "From the Organizer" zone carries it from then on,
   * so dismissing this banner never costs the coach the ability to share.
   */
  shareHref?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  function dismiss() {
    setDismissed(true);
    // Drop ?welcome=1 (and any siblings) so a refresh / back-nav doesn't re-show the banner.
    const params = new URLSearchParams(searchParams.toString());
    params.delete('welcome');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  if (dismissed) return null;

  const isWaitlist = status === 'waitlist';

  return (
    <div className={styles.banner} role="status">
      <button type="button" className={styles.close} onClick={dismiss} aria-label="Dismiss welcome message">
        <X size={16} />
      </button>

      <div className={styles.head}>
        <div className={styles.iconWrap}>
          <PartyPopper size={20} aria-hidden />
        </div>
        <div>
          <h2 className={styles.title}>
            {isWaitlist ? "You're on the waitlist!" : "You're registered!"}
          </h2>
          <p className={styles.sub}>
            {isWaitlist
              ? <><strong>{teamName}</strong> is on the waitlist for {tournamentName ?? 'the tournament'}.</>
              : <><strong>{teamName}</strong> is in for review at {tournamentName ?? 'the tournament'}.</>}
            {' '}This is your free <strong>Coaches Portal</strong> for this team.
          </p>
        </div>
      </div>

      {shareHref && (
        <div className={styles.shareRow}>
          <SharePageButton
            url={shareHref}
            title={tournamentName ?? 'Tournament'}
            text={`${teamName} is ${isWaitlist ? 'on the waitlist for' : 'registered for'} ${tournamentName ?? 'the tournament'}!`}
            label="We're in! Share it"
            className={styles.shareBtn}
          />
        </div>
      )}
    </div>
  );
}
