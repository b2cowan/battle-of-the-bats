'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, ArrowRight, Rocket } from 'lucide-react';
import Link from 'next/link';
import { useOrg } from '@/lib/org-context';
import { PLAN_CONFIG } from '@/lib/plan-config';
import HelpCallout from '@/components/help/HelpCallout';
import styles from './onboarding.module.css';

export default function OnboardingPage() {
  const { currentOrg, userRole, loading } = useOrg();
  const router = useRouter();

  const [memberCount, setMemberCount]       = useState<number | null>(null);
  const [tournamentCount, setTournamentCount] = useState<number | null>(null);
  const [seasonsDone, setSeasonsDone]       = useState<boolean | null>(null);
  const [repTeamsDone, setRepTeamsDone]     = useState<boolean | null>(null);
  const [publicSiteDone, setPublicSiteDone] = useState<boolean | null>(null);
  const [completing, setCompleting]         = useState(false);

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

    const entitlements = PLAN_CONFIG[currentOrg.planId].moduleEntitlements;

    if (entitlements.includes('module_house_league')) {
      fetch('/api/admin/house-league/seasons')
        .then(r => r.ok ? r.json() : [])
        .then(d => setSeasonsDone(Array.isArray(d) && d.length > 0))
        .catch(() => setSeasonsDone(false));
    }

    if (entitlements.includes('module_rep_teams')) {
      fetch('/api/admin/rep-teams/teams')
        .then(r => r.ok ? r.json() : { teams: [] })
        .then(d => setRepTeamsDone(Array.isArray(d?.teams) && d.teams.length > 0))
        .catch(() => setRepTeamsDone(false));
    }

    if (entitlements.includes('module_public_site')) {
      fetch('/api/admin/public-site')
        .then(r => r.ok ? r.json() : {})
        .then((d: Record<string, unknown>) => setPublicSiteDone(!!(d?.tagline || d?.description)))
        .catch(() => setPublicSiteDone(false));
    }
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

  const entitlements  = PLAN_CONFIG[currentOrg.planId].moduleEntitlements;
  const planLabel     = PLAN_CONFIG[currentOrg.planId].label;

  const memberDone     = (memberCount ?? 0) > 1;
  const tournamentDone = (tournamentCount ?? 0) > 0;
  const allDone        = memberDone && tournamentDone;

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
            <div className={styles.stepTitle}>You&apos;re on the {planLabel} plan</div>
            <div className={styles.stepDesc}>
              Get started for free. Upgrade when you&apos;re ready for more seats and advanced features.
            </div>
          </div>
          <Link href={`/${currentOrg.slug}/admin/org/billing`} className={`${styles.stepCta} ${styles.stepCtaSecondary}`}>
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
            <Link href={`/${currentOrg.slug}/admin/org/members`} className={styles.stepCta}>
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
            <Link href={`/${currentOrg.slug}/admin/org/tournaments`} className={styles.stepCta}>
              Create a tournament <ArrowRight size={13} />
            </Link>
          )}
        </div>

        {/* Step 4 — Public site (League and above) */}
        {entitlements.includes('module_public_site') && (
          <div className={`${styles.step} ${publicSiteDone ? styles.stepDone : ''}`}>
            <div className={styles.stepIcon}>
              {publicSiteDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
            </div>
            <div className={styles.stepBody}>
              <div className={styles.stepTitle}>Set up your public page</div>
              <div className={styles.stepDesc}>
                Add a tagline and description so members can find your organization online.
              </div>
            </div>
            {!publicSiteDone && (
              <Link href={`/${currentOrg.slug}/admin/public-site`} className={styles.stepCta}>
                Set up public page <ArrowRight size={13} />
              </Link>
            )}
          </div>
        )}

        {/* Step 5 — House League season (League and above) */}
        {entitlements.includes('module_house_league') && (
          <div className={`${styles.step} ${seasonsDone ? styles.stepDone : ''}`}>
            <div className={styles.stepIcon}>
              {seasonsDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
            </div>
            <div className={styles.stepBody}>
              <div className={styles.stepTitle}>Create your first season</div>
              <div className={styles.stepDesc}>
                Set up a house league season with divisions, registration, and scheduling.
              </div>
            </div>
            {!seasonsDone && (
              <Link href={`/${currentOrg.slug}/admin/house-league`} className={styles.stepCta}>
                Create a season <ArrowRight size={13} />
              </Link>
            )}
          </div>
        )}

        {/* Step 6 — Accounting (Club only) */}
        {entitlements.includes('module_accounting') && (
          <div className={styles.step}>
            <div className={styles.stepIcon}><Circle size={20} /></div>
            <div className={styles.stepBody}>
              <div className={styles.stepTitle}>Review your accounting setup</div>
              <div className={styles.stepDesc}>
                Your org ledger is ready. Set up team ledgers, add entries, and track invoices.
              </div>
            </div>
            <Link href={`/${currentOrg.slug}/admin/accounting`} className={styles.stepCta}>
              Go to Accounting <ArrowRight size={13} />
            </Link>
          </div>
        )}

        {/* Step 7 — Rep Teams (Club only) */}
        {entitlements.includes('module_rep_teams') && (
          <div className={`${styles.step} ${repTeamsDone ? styles.stepDone : ''}`}>
            <div className={styles.stepIcon}>
              {repTeamsDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
            </div>
            <div className={styles.stepBody}>
              <div className={styles.stepTitle}>Set up your first rep team</div>
              <div className={styles.stepDesc}>
                Create a rep team, open a program year, and start managing tryouts and rosters.
              </div>
            </div>
            {!repTeamsDone && (
              <Link href={`/${currentOrg.slug}/admin/rep-teams`} className={styles.stepCta}>
                Set up a rep team <ArrowRight size={13} />
              </Link>
            )}
          </div>
        )}
      </div>

      <HelpCallout
        variant="tip"
        title="Unlock more with modules"
        body="Modules extend FieldLogicHQ beyond the tournament core. Complete the steps above, then enable your first module from the Billing page to unlock house league, rep teams, and more."
        cta={{ label: 'Go to Billing', href: `/${currentOrg.slug}/admin/org/billing` }}
      />

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
