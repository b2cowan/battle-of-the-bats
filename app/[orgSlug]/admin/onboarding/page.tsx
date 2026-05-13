'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Circle, ArrowRight, Rocket, X } from 'lucide-react';
import Link from 'next/link';
import { useOrg } from '@/lib/org-context';
import { PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';
import styles from './onboarding.module.css';

const PLAN_ORDER: OrgPlan[] = ['tournament', 'tournament_plus', 'league', 'club'];

const PLAN_TAGLINE: Record<OrgPlan, string> = {
  tournament:      'Start free with one active tournament and the core tools to get registration moving.',
  tournament_plus: 'Run multiple tournaments with automation and more staff flexibility.',
  league:          'Manage a house league season, registration, standings, and a public organization page.',
  club:            'Run the full club operation with league, rep teams, accounting, and coaches tools.',
};

const PLAN_FEATURES: Record<OrgPlan, string[]> = {
  tournament: [
    'Tournament scheduling',
    'Score entry and results',
    'Standings',
    'Field and diamond management',
    '3 staff / admin seats',
    '1 active tournament',
  ],
  tournament_plus: [
    'Everything in Tournament',
    'Automated schedule generation',
    'Bracket generator',
    'Email announcements and communications',
    'Tournament archives and history',
    'Unlimited simultaneous tournaments',
    '5 staff / admin seats',
    'Unlimited officials seats',
  ],
  league: [
    'Everything in Tournament Plus',
    'Public organization page',
    'House league registration and seasons',
    'Registration workflows',
    'Division and season management',
    'League-scoped communications',
    'Advanced member roles and permissions',
    '10 staff / admin seats',
  ],
  club: [
    'Everything in League',
    'Accounting module - org ledger, team invoicing, payment reconciliation, expense tracking',
    'Rep Teams module - tryouts, rosters, player documents, coaches portal, team finances',
    'Unlimited staff / admin seats',
  ],
};

export default function OnboardingPage() {
  const { currentOrg, userRole, loading } = useOrg();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tournamentCount, setTournamentCount] = useState<number | null>(null);
  const [seasonsDone, setSeasonsDone] = useState<boolean | null>(null);
  const [repTeamsDone, setRepTeamsDone] = useState<boolean | null>(null);
  const [publicSiteDone, setPublicSiteDone] = useState<boolean | null>(null);
  const [completing, setCompleting] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [planLoading, setPlanLoading] = useState<OrgPlan | null>(null);
  const [planError, setPlanError] = useState('');

  useEffect(() => {
    if (loading || !currentOrg) return;

    if (currentOrg.onboardingCompletedAt) {
      router.replace(`/${currentOrg.slug}/admin`);
      return;
    }

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
    } else {
      setSeasonsDone(null);
    }

    if (entitlements.includes('module_rep_teams')) {
      fetch('/api/admin/rep-teams/teams')
        .then(r => r.ok ? r.json() : { teams: [] })
        .then(d => setRepTeamsDone(Array.isArray(d?.teams) && d.teams.length > 0))
        .catch(() => setRepTeamsDone(false));
    } else {
      setRepTeamsDone(null);
    }

    if (entitlements.includes('module_public_site')) {
      fetch('/api/admin/public-site')
        .then(r => r.ok ? r.json() : {})
        .then((d: Record<string, unknown>) => setPublicSiteDone(!!(d?.tagline || d?.description)))
        .catch(() => setPublicSiteDone(false));
    } else {
      setPublicSiteDone(null);
    }
  }, [loading, currentOrg, router]);

  async function complete() {
    if (!currentOrg || completing) return;
    setCompleting(true);
    await fetch('/api/admin/org/complete-onboarding', { method: 'POST' });
    router.push(`/${currentOrg.slug}/admin`);
  }

  async function choosePlan(planKey: OrgPlan) {
    if (!currentOrg || planLoading) return;
    setPlanError('');

    const planChoiceRequired = searchParams.get('choosePlan') === '1';

    if (!planChoiceRequired && PLAN_ORDER.indexOf(planKey) < PLAN_ORDER.indexOf(currentOrg.planId)) {
      return;
    }

    if (planKey === 'tournament' || planKey === currentOrg.planId) {
      setPlanModalOpen(false);
      if (planChoiceRequired) {
        router.replace(`/${currentOrg.slug}/admin/onboarding`);
      }
      return;
    }

    setPlanLoading(planKey);
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planKey,
          returnTo: `/${currentOrg.slug}/admin/onboarding`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Plan selection failed');
      window.location.assign(data.url);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setPlanLoading(null);
    }
  }

  if (loading || !currentOrg) return null;

  if (userRole !== 'owner') {
    router.replace(`/${currentOrg.slug}/admin`);
    return null;
  }

  const activePlanId = currentOrg.planId;
  const planChoiceRequired = searchParams.get('choosePlan') === '1';
  const entitlements = PLAN_CONFIG[activePlanId].moduleEntitlements;
  const planLabel = PLAN_CONFIG[activePlanId].label;

  const tournamentDone = (tournamentCount ?? 0) > 0;
  const isTournamentPlan = activePlanId === 'tournament' || activePlanId === 'tournament_plus';
  const isLeaguePlan = activePlanId === 'league';
  const isClubPlan = activePlanId === 'club';
  const allDone = isTournamentPlan
    ? tournamentDone
    : isLeaguePlan
      ? seasonsDone === true
      : isClubPlan
        ? seasonsDone === true || repTeamsDone === true || publicSiteDone === true
        : false;

  function getPlanPrice(planKey: OrgPlan) {
    const plan = PLAN_CONFIG[planKey];
    if (plan.monthlyPrice === 0) return 'Free';
    if (billingCycle === 'annual') return `$${plan.annualPrice} CAD / year`;
    return `$${plan.monthlyPrice} CAD / month`;
  }

  function getPlanAction(planKey: OrgPlan) {
    if (planChoiceRequired && planKey === 'tournament') return 'Start with Tournament';
    if (!planChoiceRequired && planKey === activePlanId) return 'Current plan';
    if (!planChoiceRequired && PLAN_ORDER.indexOf(planKey) < PLAN_ORDER.indexOf(activePlanId)) return 'Included in current plan';
    if (planKey === 'tournament') return 'Continue free';
    return `Choose ${PLAN_CONFIG[planKey].label}`;
  }

  function renderPlanChooser(required: boolean) {
    return (
      <div className={required ? styles.planStage : styles.planModal} role={required ? undefined : 'dialog'} aria-modal={required ? undefined : 'true'} aria-labelledby="onboarding-plan-title">
        <div className={styles.modalHeader}>
          <div>
            <h2 id="onboarding-plan-title" className={styles.modalTitle}>Choose your starting plan</h2>
            <p className={styles.modalSub}>
              Select the plan that matches what you want to set up first. Monthly pricing is shown by default.
            </p>
          </div>
          {!required && (
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setPlanModalOpen(false)}
              aria-label="Close plan chooser"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className={styles.billingToggle}>
          <button
            type="button"
            className={`${styles.toggleOption} ${billingCycle === 'monthly' ? styles.toggleActive : ''}`}
            onClick={() => setBillingCycle('monthly')}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`${styles.toggleOption} ${billingCycle === 'annual' ? styles.toggleActive : ''}`}
            onClick={() => setBillingCycle('annual')}
          >
            Annual
          </button>
        </div>

        <div className={styles.planGrid}>
          {PLAN_ORDER.map(planKey => {
            const plan = PLAN_CONFIG[planKey];
            const isCurrent = !required && planKey === activePlanId;
            const isLowerTier = !required && PLAN_ORDER.indexOf(planKey) < PLAN_ORDER.indexOf(activePlanId);
            return (
              <div key={planKey} className={`${styles.planCard} ${isCurrent ? styles.planCardCurrent : ''}`}>
                <div className={styles.planCardHeader}>
                  <h3>{plan.label}</h3>
                  {isCurrent && <span>Current</span>}
                </div>
                <div className={styles.planCardPrice}>{getPlanPrice(planKey)}</div>
                <p className={styles.planCardTagline}>{PLAN_TAGLINE[planKey]}</p>
                <ul className={styles.planFeatureList}>
                  {PLAN_FEATURES[planKey].map(feature => (
                    <li key={feature}>
                      <CheckCircle2 size={13} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`btn ${isCurrent || planKey === 'tournament' ? 'btn-outline' : 'btn-primary'} ${styles.planButton}`}
                  onClick={() => choosePlan(planKey)}
                  disabled={planLoading !== null || isLowerTier}
                >
                  {planLoading === planKey ? 'Loading...' : getPlanAction(planKey)}
                </button>
              </div>
            );
          })}
        </div>

        {planError && <div className={styles.planError}>{planError}</div>}
      </div>
    );
  }

  if (planChoiceRequired) {
    return (
      <div className={`${styles.page} ${styles.pageWide}`}>
        <div className={styles.header}>
          <div className={styles.headerIcon}><Rocket size={22} /></div>
          <h1 className={styles.title}>Choose your FieldLogicHQ plan</h1>
          <p className={styles.sub}>Pick the setup path that best matches {currentOrg.name}.</p>
        </div>

        {renderPlanChooser(true)}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerIcon}><Rocket size={22} /></div>
        <h1 className={styles.title}>Welcome to FieldLogicHQ</h1>
        <p className={styles.sub}>Let&apos;s get {currentOrg.name} set up in a few quick steps.</p>
      </div>

      <div className={styles.steps}>
        <div className={`${styles.step} ${styles.stepDone}`}>
          <div className={styles.stepIcon}><CheckCircle2 size={20} /></div>
          <div className={styles.stepBody}>
            <div className={styles.stepTitle}>{planLabel} plan selected</div>
            <div className={styles.stepDesc}>
              Start here, then follow the setup steps that match how your organization runs.
            </div>
          </div>
          <button
            type="button"
            className={`${styles.stepCta} ${styles.stepCtaSecondary}`}
            onClick={() => setPlanModalOpen(true)}
          >
            View plans <ArrowRight size={13} />
          </button>
        </div>

        {isTournamentPlan && (
          <div className={`${styles.step} ${tournamentDone ? styles.stepDone : ''}`}>
            <div className={styles.stepIcon}>
              {tournamentDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
            </div>
            <div className={styles.stepBody}>
              <div className={styles.stepTitle}>Create your first tournament</div>
              <div className={styles.stepDesc}>
                Set up a tournament, choose divisions, and prepare registration.
              </div>
            </div>
            {!tournamentDone && (
              <Link href={`/${currentOrg.slug}/admin/org/tournaments`} className={styles.stepCta}>
                Create a tournament <ArrowRight size={13} />
              </Link>
            )}
          </div>
        )}

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

      <div className={styles.footer}>
        {allDone ? (
          <button className="btn btn-primary" onClick={complete} disabled={completing}>
            {completing ? 'Loading...' : 'Go to Dashboard'}
            {!completing && <ArrowRight size={15} />}
          </button>
        ) : (
          <button
            type="button"
            className={`btn btn-ghost btn-sm ${styles.skipBtn}`}
            onClick={complete}
            disabled={completing}
          >
            {completing ? 'Skipping...' : 'Skip setup for now'}
          </button>
        )}
      </div>

      {planModalOpen && (
        <div className={styles.modalOverlay} role="presentation">
          {renderPlanChooser(false)}
        </div>
      )}
    </div>
  );
}
