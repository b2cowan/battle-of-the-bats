import Link from 'next/link';
import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { isFoundingSeasonPromoActive } from '@/lib/plan-config';
import { safeNextPath } from '@/lib/safe-redirect';
import styles from './welcome.module.css';

export const metadata: Metadata = {
  title: "You're in — Premium Coaches Portal — FieldLogicHQ",
  robots: { index: false },
};

/**
 * Warm success screen (Founding Season Coaches launch — S1-2). Reached only from the sign-up
 * flow's client-side redirect after a $0 comp workspace is provisioned. It names the free period,
 * then "Open your season workspace →" hands off into the operating portal in its own theme — the
 * same deliberate "walking into the venue" seam as entering a tournament (R1-2). `next` is the
 * portal URL the provision returned; `team` is the just-created team name.
 */
export default async function CoachesWelcomePage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; team?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const team = (sp.team ?? '').trim().slice(0, 80);
  // Open-redirect guard (CWE-601): resolve `next` with real URL semantics and require same-origin.
  // A hand-rolled startsWith('/') check is bypassable via backslash/tab smuggling (/\evil.com); the
  // signup redirect passes `next` as a RELATIVE path, so a valid destination survives and anything
  // else (absolute, protocol-relative, smuggled) falls back to the coaches hub.
  const next = safeNextPath((sp.next ?? '').trim(), '/coaches');
  const founding = isFoundingSeasonPromoActive('team');

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.ring} aria-hidden>
          <Check size={26} strokeWidth={2.6} />
        </div>
        <h1 className={styles.title}>Premium is on{team ? ` for ${team}` : ''}</h1>
        <p className={styles.sub}>
          {founding
            ? 'Free through the founding season — no credit card required until January 1, 2027.'
            : 'Your Premium Coaches Portal is ready.'}
        </p>
        {founding && (
          <span className={styles.promoPill}>⬡ Founding Season · free until Jan 1, 2027</span>
        )}
        <Link href={next} className={styles.cta}>Open your season workspace →</Link>
        <p className={styles.fine}>Opens your portal — the toolkit you&apos;ll run the season from.</p>
      </div>
    </div>
  );
}
