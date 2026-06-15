'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PartyPopper, X, CalendarDays, BookOpen, Home, ListChecks } from 'lucide-react';
import styles from './CoachWelcomeBanner.module.css';

type ResourceLink = { href: string; label: string };

/**
 * First-run onboarding banner shown ONCE on the coach's tournament record, immediately after they
 * register (the register flow redirects here with `?welcome=1`). Most coaches don't know the
 * Coaches Portal exists until this moment, so the banner congratulates them, explains what the
 * portal is and how it relates to the tournament, surfaces the pending status, and points to the
 * tournament's public resources. Dismissing it strips the `welcome` param so a refresh won't show
 * it again — no DB state, no "seen" flag.
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
              ? <><strong>{teamName}</strong> is on the waitlist for {tournamentName ?? 'the tournament'} — the organizer will reach out if a spot opens.</>
              : <><strong>{teamName}</strong> is registered for {tournamentName ?? 'the tournament'} and is now <strong className={styles.pending}>pending the organizer&apos;s review</strong>.</>}
          </p>
        </div>
      </div>

      <p className={styles.body}>
        Welcome to your <strong>Coaches Portal</strong> — your free home base for this team. This is
        where you&apos;ll track your registration status, see your game schedule once the organizer
        publishes it, get their announcements, and manage your team. You don&apos;t have to do
        anything else right now; we&apos;ll keep this page up to date as the organizer reviews your
        entry and shares how to pay.
      </p>

      <div className={styles.whatNext}>
        <ListChecks size={15} aria-hidden className={styles.whatNextIcon} />
        <span>
          <strong>What happens next:</strong> the organizer accepts your team and follows up with
          payment details. Watch this page (and your email) for updates.
        </span>
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
