'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, ArrowRight, Rocket } from 'lucide-react';
import Link from 'next/link';
import { useOrg } from '@/lib/org-context';
import styles from './onboarding.module.css';

export default function OnboardingPage() {
  const { currentOrg, userRole, loading } = useOrg();
  const router = useRouter();

  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [tournamentCount, setTournamentCount] = useState<number | null>(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (loading || !currentOrg) return;

    if (currentOrg.onboardingCompletedAt) {
      router.replace(`/${currentOrg.slug}/admin`);
      return;
    }

    fetch('/api/admin/members')
      .then(r => r.json())
      .then(d => setMemberCount(Array.isArray(d) ? d.length : 0))
      .catch(() => setMemberCount(0));

    fetch('/api/admin/tournaments')
      .then(r => r.json())
      .then(d => setTournamentCount(Array.isArray(d) ? d.length : 0))
      .catch(() => setTournamentCount(0));
  }, [loading, currentOrg, router]);

  async function complete() {
    if (!currentOrg || completing) return;
    setCompleting(true);
    await fetch('/api/admin/org/complete-onboarding', { method: 'POST' });
    router.push(`/${currentOrg.slug}/admin`);
  }

  if (loading || !currentOrg) return null;

  if (userRole !== 'owner') {
    router.replace(`/${currentOrg.slug}/admin`);
    return null;
  }

  const memberDone = (memberCount ?? 0) > 1;
  const tournamentDone = (tournamentCount ?? 0) > 0;
  const allDone = memberDone && tournamentDone;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerIcon}><Rocket size={22} /></div>
        <h1 className={styles.title}>Welcome to FieldLogicHQ</h1>
        <p className={styles.sub}>Let&apos;s get {currentOrg.name} set up in a few quick steps.</p>
      </div>

      <div className={styles.steps}>
        {/* Step 1 — Plan (always complete, informational) */}
        <div className={`${styles.step} ${styles.stepDone}`}>
          <div className={styles.stepIcon}><CheckCircle2 size={20} /></div>
          <div className={styles.stepBody}>
            <div className={styles.stepTitle}>You&apos;re on the Starter plan</div>
            <div className={styles.stepDesc}>
              Get started for free. Upgrade when you&apos;re ready for more seats and advanced features.
            </div>
          </div>
          <Link href={`/${currentOrg.slug}/admin/billing`} className={`${styles.stepCta} ${styles.stepCtaSecondary}`}>
            View plans <ArrowRight size={13} />
          </Link>
        </div>

        {/* Step 2 — Invite */}
        <div className={`${styles.step} ${memberDone ? styles.stepDone : ''}`}>
          <div className={styles.stepIcon}>
            {memberDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
          </div>
          <div className={styles.stepBody}>
            <div className={styles.stepTitle}>Invite a team member</div>
            <div className={styles.stepDesc}>
              Add your co-organizers, staff, or field officials to start collaborating.
            </div>
          </div>
          {!memberDone && (
            <Link href={`/${currentOrg.slug}/admin/members`} className={styles.stepCta}>
              Invite a member <ArrowRight size={13} />
            </Link>
          )}
        </div>

        {/* Step 3 — Tournament */}
        <div className={`${styles.step} ${tournamentDone ? styles.stepDone : ''}`}>
          <div className={styles.stepIcon}>
            {tournamentDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
          </div>
          <div className={styles.stepBody}>
            <div className={styles.stepTitle}>Create your first tournament</div>
            <div className={styles.stepDesc}>
              Set up a tournament, define age groups, and open registration.
            </div>
          </div>
          {!tournamentDone && (
            <Link href={`/${currentOrg.slug}/admin/tournaments`} className={styles.stepCta}>
              Create a tournament <ArrowRight size={13} />
            </Link>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        {allDone ? (
          <button className="btn btn-primary" onClick={complete} disabled={completing}>
            {completing ? 'Loading…' : 'Go to Dashboard'}
            {!completing && <ArrowRight size={15} />}
          </button>
        ) : (
          <button
            type="button"
            className={`btn btn-ghost btn-sm ${styles.skipBtn}`}
            onClick={complete}
            disabled={completing}
          >
            {completing ? 'Skipping…' : 'Skip setup for now'}
          </button>
        )}
      </div>
    </div>
  );
}
