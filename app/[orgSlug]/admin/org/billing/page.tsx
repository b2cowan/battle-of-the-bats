'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { CreditCard, CheckCircle, Archive, ShieldOff, Link2, Star, ArrowRight, Users, CalendarRange, Building2 } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useTournament } from '@/lib/tournament-context';
import { getBillingHref } from '@/lib/billing-urls';
import { PLAN_CONFIG, isEffectivelyGated, isFoundingSeasonActive, formatPriceAmount, formatAnnualSavings } from '@/lib/plan-config';
import { PLAN_ARTICLE_CONTENT } from '@/lib/plan-article-content';
import FeedbackModal from '@/components/FeedbackModal';
import PlanArticlePanel from '@/components/billing/PlanArticlePanel';
import type { OrgPlan, SubscriptionStatus } from '@/lib/types';
import styles from './billing.module.css';

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active:   'Active',
  trialing: 'Trialing',
  past_due: 'Past Due',
  canceled: 'Canceled',
};

const STATUS_BADGE: Record<SubscriptionStatus, string> = {
  active:   'badge-success',
  trialing: 'badge-primary',
  past_due: 'badge-warning',
  canceled: 'badge-neutral',
};

type BillingTournamentSummary = {
  id: string;
  name: string;
  status: string;
  year: number | null;
  startDate: string | null;
  endDate: string | null;
};

type DowngradePreflight = {
  currentPlan: OrgPlan;
  targetPlan: OrgPlan;
  targetPlanLabel: string;
  targetTournamentLimit: number;
  activeTournamentCount: number;
  allowedKeepCount: number;
  requiresTournamentChoice: boolean;
  tournaments: BillingTournamentSummary[];
  overLimitTournamentCount: number;
  retentionDays: number;
};

type CancellationPreflight = {
  currentPlan: OrgPlan;
  activeTournamentCount: number;
  tournaments: BillingTournamentSummary[];
  retentionDays: number;
  shutsDown: string[];
};

const PLAN_TAGLINE: Record<OrgPlan, string> = {
  tournament:      'A free starter plan for one small tournament or a first test run.',
  team:            'Built for rep team coaches who also run local tournaments — roster, schedule, dues, and documents for your team, plus a free tournament slot.',
  tournament_plus: 'Serious tournament operations: registration control, branding, automation, and reporting.',
  league:          'Manage your league, registrations, and public presence — all in one place.',
  club:            'The complete operating system for your sports organization.',
  // club_large copy is interim — final customer wording owned by Phase 4 (/marketing).
  club_large:      'The complete operating system, sized for a larger club or association — every team and coach included.',
};

const PLAN_FEATURES: Record<OrgPlan, string[]> = {
  tournament: [
    'Manual tournament scheduling',
    'Standard team registration fields',
    'Selected-row registration updates and waitlist collection',
    'Basic standings and score entry',
    'Venue management',
    'Default FieldLogicHQ public styling',
    'Public news posts and basic team email',
    '3 staff / admin seats · 1 tournament slot',
  ],
  team: [
    'One rep team Coaches Portal',
    'Premium tools for roster, schedule, dues, and documents',
    'Team budget and payment reminder tools',
    'One free-tier tournament slot for scrimmages or local events',
    '3 staff / coach seats',
  ],
  tournament_plus: [
    'Everything in Tournament',
    'Unlimited tournament slots',
    'Custom registration — questions, file uploads, waitlists, and exports',
    'Automated schedule generation and playoff brackets',
    'Full branding control',
    'Tournament cloning, announcements, and post-event archives',
    'Unlimited staff seats — scorekeepers always free',
  ],
  league: [
    'Everything in Tournament Plus',
    'Public organization page (branded)',
    'House League — registration, divisions, seasons, standings',
    'Advanced member roles and permissions',
    'Unlimited staff / admin seats',
  ],
  club: [
    'Everything in League Plus',
    'Accounting — ledger, invoicing, payment reconciliation',
    'Rep Teams — tryouts, rosters, player documents',
    'Whole coaching staff included — Premium portals for up to 15 teams',
    'Unlimited staff / admin seats',
  ],
  club_large: [
    'Everything in Club',
    'Sized for a larger association — up to 30 teams',
    'Whole coaching staff included — no per-team fees',
    'Accounting, Rep Teams, and Premium Coaches Portals',
    'Unlimited staff / admin seats',
  ],
};

const PLAN_META_COPY: Record<OrgPlan, string> = {
  tournament:      "You're on the free starter plan. Upgrade when you need custom registration, exports, payment reminders, waitlist promotion, branding, or repeat-event tools.",
  team:            "You're on Premium Coaches Portal. Your team tools and one free-tier tournament slot are active.",
  tournament_plus: "You're on Tournament Plus. Your tournament operations tools are active; League Plus and Club are coming soon while those broader workflows are refined.",
  league:          "You're on League Plus. Need accounting or rep team tools? Club is the complete platform.",
  club:            "You're on the complete Club platform. Your whole coaching staff is included, up to 15 teams.",
  club_large:      "You're on Club · Association — the complete platform, sized for a larger association of up to 30 teams.",
};

type ProductShelfPlan = 'team' | 'league' | 'club';
const PRODUCT_SHELF_PLANS: ProductShelfPlan[] = ['team', 'league', 'club'];

const PRODUCT_SHELF_META: Record<ProductShelfPlan, { eyebrow: string; detailLabel: string }> = {
  team:   { eyebrow: 'For rep teams',       detailLabel: 'Preview Coaches Portal' },
  league: { eyebrow: 'For league programs', detailLabel: 'Preview League Plus' },
  club:   { eyebrow: 'For full clubs',      detailLabel: 'Preview Club' },
};

const PRODUCT_SHELF_ICON: Partial<Record<OrgPlan, React.ReactElement>> = {
  team:   <Users size={18} />,
  league: <CalendarRange size={18} />,
  club:   <Building2 size={18} />,
};

export default function BillingPage() {
  const { currentOrg, refresh: refreshOrg, userRole } = useOrg();
  usePageTitle('Plan & Billing');
  const { tournaments, refresh: refreshTournaments }  = useTournament();
  const searchParams     = useSearchParams();
  const router           = useRouter();

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [panelPlan, setPanelPlan]       = useState<'tournament_plus' | 'league' | 'club' | 'team' | null>(null);
  const [loading, setLoading]           = useState<OrgPlan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [successOpen, setSuccessOpen]     = useState(() => searchParams.get('success') === '1');
  const [successTitle, setSuccessTitle]   = useState('Subscription activated!');
  const [successMsg, setSuccessMsg]       = useState("Your plan has been upgraded. Enjoy your new features — they're applied immediately.");
  const [errorOpen, setErrorOpen]         = useState(false);
  const [errorMsg, setErrorMsg]           = useState('');
  const [downgradePreflight, setDowngradePreflight] = useState<DowngradePreflight | null>(null);
  const [downgradeReason, setDowngradeReason] = useState('');
  const [selectedKeepIds, setSelectedKeepIds] = useState<string[]>([]);
  const [downgradeSaving, setDowngradeSaving] = useState(false);
  const [cancelPreflight, setCancelPreflight] = useState<CancellationPreflight | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSaving, setCancelSaving] = useState(false);
  const [seatUsage, setSeatUsage]         = useState<{
    billed: number; officials: number; limit: number; officialsFree: boolean;
  } | null>(null);
  const [foundingSeasonStatus, setFoundingSeasonStatus] = useState<{
    isFoundingSeason: boolean; compUntil: string | null;
  } | null>(null);

  async function refreshBillingState() {
    await Promise.all([refreshOrg(), refreshTournaments()]);
  }

  useEffect(() => {
    if (!currentOrg) return;
    fetch(`/api/admin/members/count?orgSlug=${encodeURIComponent(currentOrg.slug)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSeatUsage(data); })
      .catch(() => {});
  }, [currentOrg]);

  useEffect(() => {
    if (!currentOrg) return;
    fetch(`/api/admin/org/founding-season-status?orgSlug=${encodeURIComponent(currentOrg.slug)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setFoundingSeasonStatus(data); })
      .catch(() => {});
  }, [currentOrg]);

  // Club Repackaging (2026-06-22): the per-team "$19/team beyond 3" add-on usage fetch and
  // the "upgrade to Club to save" nudge are retired — Club includes the whole coaching staff
  // up to the plan's team cap. The customer-facing team-capacity readout is added in Phase 3.

  async function handleUpgrade(planKey: 'tournament_plus' | 'league' | 'club') {
    if (!currentOrg) return;
    setLoading(planKey);
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planKey,
          billingCycle,
          orgSlug: currentOrg.slug,
          returnTo: getBillingHref(currentOrg.slug, currentOrg.planId),
        }),
      });
      const data = await res.json() as {
        url?: string;
        error?: string;
        applied?: boolean;
        foundingSeason?: boolean;
        compUntil?: string;
        restoredCount?: number;
        remainingRetainedCount?: number;
      };
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed');
      if (data.applied) {
        await refreshBillingState();
        if (data.foundingSeason) {
          setFoundingSeasonStatus({ isFoundingSeason: true, compUntil: data.compUntil ?? null });
        }
        setSuccessTitle('Plan updated');
        const remainingCopy = data.remainingRetainedCount
          ? ` ${data.remainingRetainedCount} retained tournament${data.remainingRetainedCount === 1 ? '' : 's'} still exceed this plan limit and remain in retention.`
          : '';
        setSuccessMsg(
          data.restoredCount
            ? `Your plan has been updated to ${PLAN_CONFIG[planKey].label}. ${data.restoredCount} retained tournament${data.restoredCount === 1 ? '' : 's'} restored.${remainingCopy}`
            : `Your plan has been updated to ${PLAN_CONFIG[planKey].label}.${remainingCopy}`
        );
        setSuccessOpen(true);
        setLoading(null);
        return;
      }
      if (!data.url) throw new Error('Checkout did not return a destination.');
      window.location.assign(data.url);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setErrorOpen(true);
      setLoading(null);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Portal failed');
      if (!data.url) throw new Error('Portal did not return a destination.');
      window.location.assign(data.url);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setErrorOpen(true);
      setPortalLoading(false);
    }
  }

  async function openDowngradeReview(planKey: OrgPlan) {
    setDowngradePreflight(null);
    setCancelPreflight(null);
    setDowngradeReason('');
    setSelectedKeepIds([]);
    try {
      const res = await fetch('/api/billing/downgrade/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPlan: planKey }),
      });
      const data = await res.json() as DowngradePreflight | { error?: string };
      if (!res.ok) throw new Error('error' in data ? data.error ?? 'Downgrade review failed' : 'Downgrade review failed');
      const preflight = data as DowngradePreflight;
      setDowngradePreflight(preflight);
      if (!preflight.requiresTournamentChoice) {
        setSelectedKeepIds(preflight.tournaments.map(t => t.id));
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Downgrade review failed.');
      setErrorOpen(true);
    }
  }

  async function confirmDowngrade() {
    if (!downgradePreflight) return;
    setDowngradeSaving(true);
    try {
      const res = await fetch('/api/billing/downgrade/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetPlan: downgradePreflight.targetPlan,
          keepTournamentIds: selectedKeepIds,
          reason: downgradeReason,
        }),
      });
      const data = await res.json() as { error?: string; retainedCount?: number };
      if (!res.ok) throw new Error(data.error ?? 'Downgrade failed');
      await refreshBillingState();
      setDowngradePreflight(null);
      setSuccessTitle('Plan updated');
      setSuccessMsg(
        data.retainedCount
          ? `${data.retainedCount} tournament${data.retainedCount === 1 ? '' : 's'} moved to retention for 90 days.`
          : 'Your plan was updated.'
      );
      setSuccessOpen(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Downgrade failed.');
      setErrorOpen(true);
    } finally {
      setDowngradeSaving(false);
    }
  }

  async function openCancelReview() {
    setDowngradePreflight(null);
    setCancelPreflight(null);
    setCancelReason('');
    try {
      const res = await fetch('/api/billing/cancel/preflight');
      const data = await res.json() as CancellationPreflight | { error?: string };
      if (!res.ok) throw new Error('error' in data ? data.error ?? 'Cancellation review failed' : 'Cancellation review failed');
      setCancelPreflight(data as CancellationPreflight);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Cancellation review failed.');
      setErrorOpen(true);
    }
  }

  async function confirmCancellation() {
    if (!cancelPreflight) return;
    setCancelSaving(true);
    try {
      const res = await fetch('/api/billing/cancel/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Cancellation failed');
      await refreshBillingState();
      setCancelPreflight(null);
      setSuccessTitle('Account suspended');
      setSuccessMsg(
        currentOrg?.accountKind === 'team_workspace' || currentOrg?.planId === 'team'
          ? 'Premium Coaches Portal is inactive. Basic tournament records remain available and premium team data is retained for 90 days.'
          : 'Public pages and modules have been shut down. Data is retained for 90 days.'
      );
      setSuccessOpen(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Cancellation failed.');
      setErrorOpen(true);
    } finally {
      setCancelSaving(false);
    }
  }

  if (!currentOrg) {
    return <div className={styles.page}><p style={{ color: 'var(--white-40)' }}>Loading…</p></div>;
  }

  // Tournament and Tournament Plus orgs have no org-level modules beyond core.
  // After a successful subscription action, redirect them back to their tournament
  // workspace rather than leaving them stranded in the org admin shell.
  const isTournamentOnlyOrg =
    (currentOrg.planId === 'tournament' || currentOrg.planId === 'tournament_plus') &&
    currentOrg.accountKind !== 'team_workspace';

  function handleSuccessClose() {
    setSuccessOpen(false);
    if (isTournamentOnlyOrg && currentOrg) {
      router.push(`/${currentOrg.slug}/admin/tournaments`);
    }
  }

  const currentPlanKey = currentOrg.planId;
  const currentPlan    = PLAN_CONFIG[currentPlanKey];
  const status         = currentOrg.subscriptionStatus;

  // Founding season banner: show pre-October "no payment ask yet" state
  const isTeamWorkspaceBilling = currentOrg.accountKind === 'team_workspace' || currentPlanKey === 'team';
  const isFoundingSeason = foundingSeasonStatus?.isFoundingSeason ?? false;
  const isBeforeOctober  = new Date() < new Date('2026-10-01T00:00:00.000Z');
  const showFoundingSeasonBanner = isFoundingSeason && !isTeamWorkspaceBilling;
  const usageCount     = tournaments.filter(t => t.status !== 'archived').length;
  const usageLimit     = currentOrg.tournamentLimit;
  const usagePct       = usageLimit >= 9999 ? 0 : Math.min(100, Math.round((usageCount / usageLimit) * 100));
  const primaryUpgradePlans: OrgPlan[] = currentPlanKey === 'tournament' ? ['tournament_plus'] : [];
  const productShelfPlans = isTeamWorkspaceBilling
    ? []
    : PRODUCT_SHELF_PLANS.filter(planKey => planKey !== currentPlanKey);
  const downgradePlans: OrgPlan[] = currentPlanKey === 'tournament_plus' ? ['tournament'] : [];
  const showSubscriptionOptions = primaryUpgradePlans.length > 0 || productShelfPlans.length > 0;
  const hasPaidPlan    = currentPlanKey !== 'tournament';
  const canManageBilling = userRole === 'owner';
  const subscriptionTitle = isTeamWorkspaceBilling ? 'Coaches Portal billing' : 'Subscription';
  const subscriptionSub = isTeamWorkspaceBilling
    ? 'Manage Premium Coaches Portal billing and reactivation'
    : 'Manage your plan and payment method';
  const cancelReviewTitle = isTeamWorkspaceBilling ? 'Cancel Premium Coaches Portal' : 'Cancel account';
  const cancelWarningCopy = isTeamWorkspaceBilling
    ? `Premium tools will become inactive and premium team data is retained for ${cancelPreflight?.retentionDays ?? 90} days. Basic tournament records stay available in Coaches Portal.`
    : `Cancellation suspends the full account. Public pages and modules shut down, and data is retained for ${cancelPreflight?.retentionDays ?? 90} days.`;
  function getPrice(planKey: OrgPlan): string {
    if (isEffectivelyGated(planKey)) return 'Coming soon';
    if (planKey === 'tournament_plus' && isFoundingSeasonActive()) return 'Free through Dec 31, 2026';
    const plan = PLAN_CONFIG[planKey];
    if (plan.monthlyPrice === 0) return 'Free';
    if (billingCycle === 'annual') return `${formatPriceAmount(plan.annualPrice)} CAD / year`;
    return `${formatPriceAmount(plan.monthlyPrice)} CAD / month`;
  }

  function getShelfPrice(planKey: OrgPlan): string {
    const plan = PLAN_CONFIG[planKey];
    if (plan.monthlyPrice === 0) return 'Free';
    return `from ${formatPriceAmount(plan.monthlyPrice)} CAD / month`;
  }

  function getSavings(planKey: OrgPlan): string | null {
    if (isEffectivelyGated(planKey)) return null;
    if (planKey === 'tournament_plus' && isFoundingSeasonActive()) return null;
    if (billingCycle !== 'annual') return null;
    return formatAnnualSavings(planKey);
  }

  function getTrialNote(planKey: OrgPlan): string {
    if (isEffectivelyGated(planKey)) return 'Early access only. Self-serve checkout is not open yet.';
    if (planKey === 'tournament_plus' && isFoundingSeasonActive()) return 'No credit card required until Jan 1, 2027';
    const days = PLAN_CONFIG[planKey].trialDays;
    if (days === 90) return 'Early-access trial details collected in Stripe';
    return `${days}-day trial · Payment details collected in Stripe`;
  }

  function getUpgradeLoadingLabel(planKey: OrgPlan): string {
    return currentPlanKey === 'tournament' && planKey === 'tournament_plus' && isFoundingSeasonActive()
      ? 'Applying...'
      : 'Redirecting...';
  }

  // ── Cancelled-state view: stripped page with reactivate CTA ──────────────
  if (status === 'canceled') {
    const isComingSoon = isEffectivelyGated(currentPlanKey);
    const canSelfServeReactivate =
      !isTeamWorkspaceBilling && !isComingSoon && currentPlanKey !== 'tournament';

    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}><CreditCard size={20} /></div>
            <div>
              <h1 className={styles.pageTitle}>{subscriptionTitle}</h1>
              <p className={styles.pageSub}>{subscriptionSub}</p>
            </div>
          </div>
        </div>

        {/* Cancelled plan card */}
        <div className={styles.currentCard}>
          <div className={styles.currentLeft}>
            <div>
              <div className={styles.planName}>{currentPlan.label} Plan</div>
              <div className={styles.planTagline}>{PLAN_TAGLINE[currentPlanKey]}</div>
              <div className={styles.planPrice}>
                {currentPlan.monthlyPrice === 0
                  ? 'Free forever'
                  : `${formatPriceAmount(currentPlan.monthlyPrice)} CAD / month`}
              </div>
            </div>
          </div>
          <span className={`badge ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span>
        </div>

        <p className={`${styles.statusNote} ${styles.statusNoteDanger}`}>
          {isTeamWorkspaceBilling
            ? 'Your Premium Coaches Portal subscription has been canceled. Premium tools are inactive, premium team data remains in retention, and Basic tournament records stay available.'
            : 'Your subscription has been canceled. Public pages and modules are suspended while retained data remains restorable during the retention window.'}
        </p>

        {isTeamWorkspaceBilling && (
          <div className={styles.billingNudgeCard}>
            <div className={styles.billingNudgeIcon}><Archive size={18} /></div>
            <div className={styles.billingNudgeBody}>
              <h2 className={styles.billingNudgeTitle}>Basic records are still available</h2>
              <p className={styles.billingNudgeCopy}>
                Tournament registrations linked to your Basic coach team profile remain in Coaches Portal while Premium tools are inactive.
              </p>
            </div>
            <Link className="btn btn-outline btn-data" href="/coaches/tournaments">
              Open Tournament Records
            </Link>
          </div>
        )}

        {/* Self-serve reactivation (tournament_plus) */}
        {canSelfServeReactivate && (
          <div className={styles.reactivateCard}>
            <div className={styles.reactivateHeader}>
              <div>
                <h2 className={`${styles.sectionTitle} ${styles.sectionTitleLime}`}>
                  Reactivate your account
                </h2>
                <p className={styles.reactivateCopy}>
                  Pick up where you left off — everything below comes back on day one:
                </p>
              </div>
              <div className={styles.billingToggle}>
                <button
                  className={`${styles.toggleOption} ${billingCycle === 'monthly' ? styles.toggleActive : ''}`}
                  onClick={() => setBillingCycle('monthly')}
                >
                  Monthly
                </button>
                <button
                  className={`${styles.toggleOption} ${billingCycle === 'annual' ? styles.toggleActive : ''}`}
                  onClick={() => setBillingCycle('annual')}
                >
                  Annual
                </button>
              </div>
            </div>

            <ul className={styles.featureList}>
              {PLAN_FEATURES[currentPlanKey].map(f => (
                <li key={f}>
                  <CheckCircle size={13} />
                  {f}
                </li>
              ))}
            </ul>

            <div className={styles.reactivatePricing}>
              <span className={styles.priceAmount}>{getPrice(currentPlanKey)}</span>
              {getSavings(currentPlanKey) && (
                <span className={styles.savingsBadge}>{getSavings(currentPlanKey)}</span>
              )}
            </div>

            <button
              className={`btn btn-lime btn-data ${styles.planButton}`}
              onClick={() => handleUpgrade(currentPlanKey as 'tournament_plus' | 'league' | 'club')}
              disabled={loading === currentPlanKey}
              id="billing-reactivate-btn"
            >
              {loading === currentPlanKey ? 'Redirecting…' : `Reactivate ${currentPlan.label}`}
              {loading !== currentPlanKey && <ArrowRight size={14} />}
            </button>
          </div>
        )}

        {/* Coaches Portal reactivation */}
        {isTeamWorkspaceBilling && (
          <div className={styles.reactivateCard}>
            <h2 className={`${styles.sectionTitle} ${styles.sectionTitleLime}`}>
              Reactivate Coaches Portal
            </h2>
            <p className={styles.reactivateCopy}>
              Start a new Premium subscription to restore team operations during the retention window.
            </p>
            <Link
              className="btn btn-lime btn-data"
              href={`/coaches/start?reactivateOrgSlug=${encodeURIComponent(currentOrg.slug)}&teamName=${encodeURIComponent(currentOrg.name.replace(/\s+Coaches Portal$/i, ''))}`}
            >
              Reactivate Premium
              <ArrowRight size={14} />
            </Link>
          </div>
        )}

        <FeedbackModal
          isOpen={successOpen}
          onClose={handleSuccessClose}
          title={successTitle}
          message={successMsg}
          type="success"
        />
        <FeedbackModal
          isOpen={errorOpen}
          onClose={() => setErrorOpen(false)}
          title="Something went wrong"
          message={errorMsg}
          type="danger"
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><CreditCard size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>{subscriptionTitle}</h1>
            <p className={styles.pageSub}>{subscriptionSub}</p>
          </div>
        </div>
      </div>

      {/* Current plan card */}
      <div className={styles.currentCard}>
        <div className={styles.currentLeft}>
          <div>
            <div className={styles.planName}>{currentPlan.label} Plan</div>
            <div className={styles.planTagline}>{PLAN_TAGLINE[currentPlanKey]}</div>
            <div className={styles.planPrice}>
              {currentPlan.monthlyPrice === 0
                ? 'Free forever'
                : currentOrg.subscriptionPeriod === 'annual'
                  ? `${formatPriceAmount(currentPlan.annualPrice)} CAD / year`
                  : `${formatPriceAmount(currentPlan.monthlyPrice)} CAD / month`}
            </div>
            {currentOrg.subscriptionPeriod && currentPlan.monthlyPrice > 0 && (
              <div className={styles.planBillingCycle}>
                Billed {currentOrg.subscriptionPeriod === 'annual' ? 'annually' : 'monthly'}
              </div>
            )}
            {currentOrg.currentPeriodEnd && (
              <div className={styles.planRenewalDate}>
                {status === 'trialing' ? 'Trial ends ' : 'Renews '}
                {new Date(currentOrg.currentPeriodEnd).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            )}
            <div className={styles.planMetaCopy}>{PLAN_META_COPY[currentPlanKey]}</div>
          </div>
        </div>
        <span className={`badge ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span>
      </div>

      {showFoundingSeasonBanner && (
        <div className={styles.foundingSeasonBanner}>
          <div className={styles.foundingSeasonIcon}><Star size={16} /></div>
          <div className={styles.foundingSeasonBody}>
            <p className={styles.foundingSeasonEyebrow}>
              {isBeforeOctober ? 'Founding Season Active' : 'Founding Season Active · Ends December 31'}
            </p>
            <h2 className={styles.foundingSeasonTitle}>
              {isBeforeOctober
                ? 'Tournament Plus is free through December 31, 2026.'
                : 'Your founding season ends December 31.'}
            </h2>
            <p className={styles.foundingSeasonCopy}>
              {isBeforeOctober
                ? `You're running Tournament Plus free through December 31, 2026 as a founding organization. Tournament Plus is normally ${formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}/month — your plan renews on January 1, 2027. No credit card required until then.`
                : 'Your founding season includes Tournament Plus free through December 31, 2026. Add a payment method now to continue without interruption on January 1.'}
            </p>
          </div>
        </div>
      )}

      {isTeamWorkspaceBilling && (
        <div className={styles.billingNudgeCard}>
          <div className={styles.billingNudgeIcon}><Link2 size={18} /></div>
          <div className={styles.billingNudgeBody}>
            <h2 className={styles.billingNudgeTitle}>Part of a club or association?</h2>
            <p className={styles.billingNudgeCopy}>
              Add a Basic visibility link so the organization can see your team — your Coaches Portal stays coach-operated, and roster, document, accounting, and ownership access stay with you. If the organization is on Club, transferring the team into it includes the Premium portal for the whole coaching staff.
            </p>
          </div>
          <Link className="btn btn-lime btn-data" href={`/${currentOrg.slug}/coaches/link-org`}>
            Link Parent Org
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {status === 'past_due' && (
        <p className={`${styles.statusNote} ${styles.statusNoteWarning}`}>
          Your last payment failed. Your access remains active during the grace period — please update your payment method via <strong>Manage Subscription</strong> below to avoid service interruption.
        </p>
      )}

      {/* Usage meters */}
      <div className={styles.usageCard}>
        <div className={styles.usageHeader}>
          <span className={styles.usageLabel}>Non-archived tournament slots used</span>
          <span className={styles.usageCount}>
            {usageCount} / {usageLimit >= 9999 ? 'Unlimited' : usageLimit}
          </span>
        </div>
        {usageLimit < 9999 && (
          <div className={styles.usageBar}>
            <div
              className={styles.usageFill}
              style={{
                width: `${usagePct}%`,
                background: usagePct >= 100 ? 'var(--danger)' : usagePct >= 80 ? 'var(--warning)' : 'var(--logic-lime)',
              }}
            />
          </div>
        )}
      </div>

      {seatUsage && (
        <div className={styles.usageCard}>
          <div className={styles.usageHeader}>
            <span className={styles.usageLabel}>
              Staff seats
              {seatUsage.officialsFree && seatUsage.officials > 0 && (
                <span style={{ marginLeft: '0.5rem', fontWeight: 400, color: 'var(--white-30)' }}>
                  · {seatUsage.officials} scorekeeper{seatUsage.officials === 1 ? '' : 's'} free
                </span>
              )}
            </span>
            <span className={styles.usageCount}>
              {seatUsage.billed} / {seatUsage.limit >= 9999 ? 'Unlimited' : seatUsage.limit}
            </span>
          </div>
          {seatUsage.limit < 9999 && (
            <div className={styles.usageBar}>
              {(() => {
                const pct = Math.min(100, Math.round((seatUsage.billed / seatUsage.limit) * 100));
                return (
                  <div
                    className={styles.usageFill}
                    style={{
                      width: `${pct}%`,
                      background: pct >= 100 ? 'var(--danger)' : pct >= 80 ? 'var(--warning, #f59e0b)' : 'var(--logic-lime)',
                    }}
                  />
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Upgrade cards */}
      {showSubscriptionOptions && (
        <>
          {primaryUpgradePlans.length > 0 && (
            <>
              <div className={styles.upgradeHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>Get more from your tournaments</h2>
                  <p className={styles.upgradeIntro}>Tournament Plus adds registration control, custom branding, exports, and scheduling automation — everything you need to run repeat events without the spreadsheet.</p>
                </div>
                {!isFoundingSeasonActive() && (
                  <div className={styles.billingToggle}>
                    <button
                      className={`${styles.toggleOption} ${billingCycle === 'monthly' ? styles.toggleActive : ''}`}
                      onClick={() => setBillingCycle('monthly')}
                    >
                      Monthly
                    </button>
                    <button
                      className={`${styles.toggleOption} ${billingCycle === 'annual' ? styles.toggleActive : ''}`}
                      onClick={() => setBillingCycle('annual')}
                    >
                      Annual
                    </button>
                  </div>
                )}
              </div>
              <div className={`${styles.plansGrid} ${styles.primaryPlansGrid}`}>
                {primaryUpgradePlans.map(planKey => {
                  const plan = PLAN_CONFIG[planKey];
                  const savings = getSavings(planKey);
                  const isComingSoon = isEffectivelyGated(planKey);
                  const article = planKey in PLAN_ARTICLE_CONTENT
                    ? PLAN_ARTICLE_CONTENT[planKey as keyof typeof PLAN_ARTICLE_CONTENT]
                    : null;
                  return (
                    <div key={planKey} className={`${styles.planCard} ${styles.featuredPlanCard} ${isComingSoon ? styles.planCardComingSoon : ''}`}>
                      <div className={styles.planCardHeader}>
                        <div className={styles.planCardName}>{plan.label}</div>
                        {isComingSoon && <span className={styles.comingSoonBadge}>Coming soon</span>}
                      </div>
                      <div className={styles.planCardPrice}>
                        <span className={styles.priceAmount}>{getPrice(planKey)}</span>
                      </div>
                      {savings && <div className={styles.savingsBadge}>{savings}</div>}
                      {article && (
                        <div className={styles.planQuestion}>
                          <p className={styles.planQuestionText}>{article.billingQuestion}</p>
                          <p className={styles.planQuestionSub}>{article.billingSub}</p>
                          <button
                            className={`btn btn-ghost btn-data ${styles.articleButton}`}
                            onClick={() => setPanelPlan(planKey as 'tournament_plus' | 'league' | 'club' | 'team')}
                          >
                            See what {plan.label} includes
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      )}
                      <button
                        className={`btn btn-lime btn-data ${styles.planButton}`}
                        onClick={() => handleUpgrade(planKey as 'tournament_plus' | 'league' | 'club')}
                        disabled={isComingSoon || loading === planKey}
                        id={`billing-upgrade-${planKey}`}
                      >
                        {isComingSoon ? 'Early access only' : loading === planKey ? getUpgradeLoadingLabel(planKey) : `Upgrade to ${plan.label}`}
                        {!isComingSoon && loading !== planKey && <ArrowRight size={14} />}
                      </button>
                      <p className={styles.trialNote}>{getTrialNote(planKey)}</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {productShelfPlans.length > 0 && (
            <>
              <div className={styles.upgradeHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>Managing more than tournaments?</h2>
                  <p className={styles.upgradeIntro}>
                    {productShelfPlans.includes('team')
                      ? 'If you also manage a team, a league program, or a full club outside your tournament, these are the next FieldLogicHQ workspaces to watch.'
                      : 'For organizations running more than tournament weekends, these plans bring year-round programs, teams, and finances into the same operating system.'}
                  </p>
                </div>
              </div>
              <div className={`${styles.plansGrid} ${styles.productShelfGrid}`}>
                {productShelfPlans.map(planKey => {
                  const plan = PLAN_CONFIG[planKey];
                  const productMeta = PRODUCT_SHELF_META[planKey as ProductShelfPlan];
                  const isComingSoon = isEffectivelyGated(planKey);
                  const article = planKey in PLAN_ARTICLE_CONTENT
                    ? PLAN_ARTICLE_CONTENT[planKey as keyof typeof PLAN_ARTICLE_CONTENT]
                    : null;
                  const icon = PRODUCT_SHELF_ICON[planKey];

                  if (isComingSoon) {
                    return (
                      <div key={planKey} className={`${styles.planCard} ${styles.productCard} ${styles.planCardComingSoon}`}>
                        <div className={styles.planCardHeader}>
                          <div className={styles.productHeaderLeft}>
                            {icon && <div className={styles.planCardIcon}>{icon}</div>}
                            <div>
                              {productMeta && <p className={styles.productEyebrow}>{productMeta.eyebrow}</p>}
                              <div className={styles.planCardName}>{plan.label}</div>
                            </div>
                          </div>
                          <span className={styles.comingSoonBadge}>Coming soon</span>
                        </div>
                        <div className={styles.planCardPrice}>
                          <span className={styles.priceAmount}>{getShelfPrice(planKey)}</span>
                        </div>
                        {article && (
                          <p className={styles.productValueProp}>{article.billingSub}</p>
                        )}
                        <button
                          className={`btn btn-lime btn-data ${styles.planButton}`}
                          onClick={() => setPanelPlan(planKey as 'tournament_plus' | 'league' | 'club' | 'team')}
                          id={`billing-upgrade-${planKey}`}
                        >
                          See what {plan.label} includes
                          <ArrowRight size={14} />
                        </button>
                        <p className={styles.trialNote}>{getTrialNote(planKey)}</p>
                      </div>
                    );
                  }

                  const savings = getSavings(planKey);
                  return (
                    <div key={planKey} className={`${styles.planCard} ${styles.productCard}`}>
                      <div className={styles.planCardHeader}>
                        <div className={styles.productHeaderLeft}>
                          {icon && <div className={styles.planCardIcon}>{icon}</div>}
                          <div>
                            {productMeta && <p className={styles.productEyebrow}>{productMeta.eyebrow}</p>}
                            <div className={styles.planCardName}>{plan.label}</div>
                          </div>
                        </div>
                      </div>
                      <div className={styles.planCardPrice}>
                        <span className={styles.priceAmount}>{getPrice(planKey)}</span>
                      </div>
                      {savings && <div className={styles.savingsBadge}>{savings}</div>}
                      {article && (
                        <div className={`${styles.planQuestion} ${styles.productPitch}`}>
                          <p className={styles.planQuestionText}>{article.billingQuestion}</p>
                          <p className={styles.planQuestionSub}>{article.billingSub}</p>
                          <button
                            className={`btn btn-ghost btn-data ${styles.articleButton}`}
                            onClick={() => setPanelPlan(planKey as 'tournament_plus' | 'league' | 'club' | 'team')}
                          >
                            See what {plan.label} includes
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      )}
                      <button
                        className={`btn btn-lime btn-data ${styles.planButton}`}
                        onClick={() => setPanelPlan(planKey as 'tournament_plus' | 'league' | 'club' | 'team')}
                        id={`billing-upgrade-${planKey}`}
                      >
                        See what {plan.label} includes
                        <ArrowRight size={14} />
                      </button>
                      <p className={styles.trialNote}>{getTrialNote(planKey)}</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Billing portal (paid plans, non-founding-season) */}
      {hasPaidPlan && !showFoundingSeasonBanner && (
        <div className={styles.billingTools}>
          <div>
            <h2 className={styles.sectionTitle}>Billing tools</h2>
            <p className={styles.manageHint}>
              {canManageBilling
                ? 'Open the secure billing portal for payment methods, invoices, and billing details.'
                : 'Only organization owners can manage payment methods, invoices, billing details, and downgrade or cancel the plan.'}
            </p>
          </div>
          <button
            className="btn btn-outline"
            onClick={handlePortal}
            disabled={portalLoading || !canManageBilling}
            id="billing-manage-btn"
          >
            {portalLoading ? 'Redirecting…' : 'Payment method & invoices'}
          </button>
        </div>
      )}

      {/* Founding season billing — no Stripe subscription exists yet */}
      {showFoundingSeasonBanner && (
        <div className={styles.billingTools}>
          <div>
            <h2 className={styles.sectionTitle}>Billing</h2>
            <p className={styles.manageHint}>
              {isBeforeOctober
                ? "No billing action needed — your founding season runs free through December 31, 2026. We'll remind you when it's time to add a payment method."
                : 'Your founding season ends December 31. Add a payment method now to keep Tournament Plus running without interruption from January 1, 2027.'}
            </p>
          </div>
          {!isBeforeOctober && canManageBilling && (
            <button
              className="btn btn-outline"
              onClick={() => handleUpgrade('tournament_plus')}
              disabled={loading === 'tournament_plus'}
            >
              {loading === 'tournament_plus' ? 'Redirecting…' : 'Add payment method'}
              {loading !== 'tournament_plus' && <ArrowRight size={14} />}
            </button>
          )}
        </div>
      )}

      {hasPaidPlan && canManageBilling && !showFoundingSeasonBanner && (
        <div className={styles.retentionCard}>
          <h2 className={styles.sectionTitle}>{isTeamWorkspaceBilling ? 'Cancel Premium access' : 'Reduce or cancel plan'}</h2>
          <p className={styles.retentionCopy}>
            {isTeamWorkspaceBilling
              ? 'Cancellation turns off Premium tools and keeps Basic tournament records available. Premium team data is retained for the restore window.'
              : 'Downgrades and cancellations run through a short review first so tournament data and retention choices are clear.'}
          </p>

          {!isTeamWorkspaceBilling && downgradePlans.length > 0 && (
            <div className={styles.changeGrid}>
              {downgradePlans.map(planKey => (
                <button
                  key={planKey}
                  className={styles.changeButton}
                  onClick={() => openDowngradeReview(planKey)}
                >
                  <Archive size={13} />
                  <span>Downgrade to {PLAN_CONFIG[planKey].label}</span>
                </button>
              ))}
            </div>
          )}

          <button className={`${styles.changeButton} ${styles.dangerButton}`} onClick={openCancelReview}>
            <ShieldOff size={13} />
            <span>{isTeamWorkspaceBilling ? 'Cancel Premium' : 'Cancel and suspend account'}</span>
          </button>
        </div>
      )}

      {downgradePreflight && (
        <div className={styles.reviewCard}>
          <div className={styles.reviewHeader}>
            <h2 className={styles.sectionTitle}>Downgrade to {downgradePreflight.targetPlanLabel}</h2>
            <button className="btn btn-ghost" onClick={() => setDowngradePreflight(null)}>Close</button>
          </div>
          <p className={styles.retentionCopy}>
            New limit: {downgradePreflight.targetTournamentLimit >= 9999 ? 'Unlimited' : downgradePreflight.targetTournamentLimit} non-archived tournament slots.
            {' '}Current usage: {downgradePreflight.activeTournamentCount}.
          </p>
          {downgradePreflight.targetPlan === 'tournament' && (
            <p className={styles.statusNote}>
              Tournament Plus features become inactive on the free plan: custom tournament branding, custom registration controls, exports, payment reminders, waitlist promotion, cloning, targeted announcements, and post-event summaries. Saved branding remains stored but public tournament pages use FieldLogicHQ defaults until you upgrade again.
            </p>
          )}
          {downgradePreflight.requiresTournamentChoice ? (
            <>
              <p className={styles.statusNote}>
                Choose {downgradePreflight.allowedKeepCount} tournament{downgradePreflight.allowedKeepCount === 1 ? '' : 's'} to keep active.
                The rest move to archive retention for {downgradePreflight.retentionDays} days.
              </p>
              <div className={styles.tournamentChoiceList}>
                {downgradePreflight.tournaments.map(t => {
                  const checked = selectedKeepIds.includes(t.id);
                  return (
                    <label key={t.id} className={`${styles.tournamentChoice} ${checked ? styles.tournamentChoiceSelected : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedKeepIds(prev => {
                            if (prev.includes(t.id)) return prev.filter(id => id !== t.id);
                            if (prev.length >= downgradePreflight.allowedKeepCount) return prev;
                            return [...prev, t.id];
                          });
                        }}
                      />
                      <span>
                        <strong>{t.name}</strong>
                        <small>{t.status} {t.year ? `· ${t.year}` : ''}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          ) : (
            <p className={styles.statusNote}>Your current tournament usage fits this plan. No tournaments need to move into retention.</p>
          )}
          <textarea
            className={styles.reasonInput}
            value={downgradeReason}
            onChange={e => setDowngradeReason(e.target.value)}
            placeholder="Optional note for your records"
            rows={3}
          />
          <button className="btn btn-lime btn-data" onClick={confirmDowngrade} disabled={downgradeSaving}>
            {downgradeSaving ? 'Applying…' : 'Confirm downgrade'}
          </button>
        </div>
      )}

      {cancelPreflight && (
        <div className={styles.reviewCard}>
          <div className={styles.reviewHeader}>
            <h2 className={styles.sectionTitle}>{cancelReviewTitle}</h2>
            <button className="btn btn-ghost" onClick={() => setCancelPreflight(null)}>Close</button>
          </div>
          <p className={`${styles.statusNote} ${styles.statusNoteDanger}`}>
            {cancelWarningCopy}
          </p>
          <div className={styles.cancelImpactGrid}>
            <section className={styles.cancelImpactSection}>
              <h3>{isTeamWorkspaceBilling ? 'Premium data retained' : 'Archived during retention'}</h3>
              <p>
                {isTeamWorkspaceBilling
                  ? 'Roster, documents, accounting setup, schedule data, and local Premium tournament data stay restorable during the retention window.'
                  : cancelPreflight.tournaments.length > 0
                    ? `${cancelPreflight.tournaments.length} tournament${cancelPreflight.tournaments.length === 1 ? '' : 's'} will move into archive retention.`
                    : 'No active tournament records need to be archived.'}
              </p>
            </section>
            <section className={styles.cancelImpactSection}>
              <h3>{isTeamWorkspaceBilling ? 'Premium tools inactive' : 'Access suspended'}</h3>
              <p>
                {isTeamWorkspaceBilling
                  ? 'Basic tournament records remain available, but these Premium areas stop being active.'
                  : 'Based on your current plan, these areas will be unavailable while the account is canceled.'}
              </p>
              <ul className={styles.impactList}>
                {cancelPreflight.shutsDown.map(item => <li key={item}>{item}</li>)}
              </ul>
            </section>
          </div>
          <textarea
            className={styles.reasonInput}
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
            placeholder="Optional cancellation reason"
            rows={3}
          />
          <button className="btn btn-danger" onClick={confirmCancellation} disabled={cancelSaving}>
            {cancelSaving ? 'Suspending…' : 'Confirm cancellation'}
          </button>
        </div>
      )}

      <FeedbackModal
        isOpen={successOpen}
        onClose={handleSuccessClose}
        title={successTitle}
        message={successMsg}
        type="success"
      />
      <FeedbackModal
        isOpen={errorOpen}
        onClose={() => setErrorOpen(false)}
        title="Something went wrong"
        message={errorMsg}
        type="danger"
      />

      <PlanArticlePanel
        planKey={panelPlan}
        billingCycle={billingCycle}
        onClose={() => setPanelPlan(null)}
        onUpgrade={(key) => { setPanelPlan(null); if (key !== 'team') handleUpgrade(key); }}
        upgradeLoading={loading as 'tournament_plus' | 'league' | 'club' | 'team' | null}
        isComingSoon={panelPlan ? isEffectivelyGated(panelPlan as OrgPlan) : false}
        canUpgrade={panelPlan === 'tournament_plus' && primaryUpgradePlans.includes('tournament_plus')}
      />
    </div>
  );
}
