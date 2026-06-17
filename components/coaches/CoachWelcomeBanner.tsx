'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PartyPopper, X, CalendarDays, BookOpen, Home } from 'lucide-react';
import styles from './CoachWelcomeBanner.module.css';

type ResourceLink = { href: string; label: string };

/**
 * First-run greeting shown ONCE on the coach's tournament record, immediately after they
 * register (the register flow redirects here with `?welcome=1`). It's a thin, celebratory
 * one-liner + the tournament's public resource links — orientation ("what is this portal,
 * what happens next") lives in the persistent CoachNextSteps strip below, so it survives
 * dismissal. Dismissing this banner strips the `welcome` param so a refresh won't re-show
 * it — no DB state, no "seen" flag.
 */
export default function CoachWelcomeBanner({
  teamName,
  tournamentName,
  status,
  resources,
}: {
  teamName: string;
  tournamentName: string | null;
  status: 'pending' | 'waitlist';
  resources: ResourceLink[];
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
  const iconFor = (label: string) => {
    if (/schedule/i.test(label)) return <CalendarDays size={15} aria-hidden />;
    if (/rule/i.test(label)) return <BookOpen size={15} aria-hidden />;
    return <Home size={15} aria-hidden />;
  };

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

      {resources.length > 0 && (
        <div className={styles.resources}>
          <span className={styles.resourcesLabel}>Tournament resources</span>
          <div className={styles.resourceLinks}>
            {resources.map(r => (
              <Link key={r.href} href={r.href} className={styles.resourceLink}>
                {iconFor(r.label)} {r.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
