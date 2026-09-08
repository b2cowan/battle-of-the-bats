'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { CreditCard, CheckCircle, Archive, ShieldOff, Link2, Star, ArrowRight, Users, CalendarRange, Building2 } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useTournament } from '@/lib/tournament-context';
import { getBillingHref } from '@/lib/billing-urls';
import {
  PLAN_CONFIG, isEffectivelyGated, isFoundingSeasonActive, isFoundingSeasonPromoActive, isFoundingSeasonCardWindowOpen,
  formatPriceAmount, formatAnnualSavings,
  FOUNDING_SEASON_END_LABEL, FOUNDING_SEASON_FIRST_CHARGE_LABEL, FOUNDING_SEASON_DECISION_MONTH_LABEL, FOUNDING_SEASON_NEXT_YEAR_LABEL,
} from '@/lib/plan-config';
import { formatCardOnFile } from '@/lib/billing-format';
import { nextSeasonPlanOptions } from '@/lib/next-season-choice';
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
  const [addCardLoading, setAddCardLoading] = useState(false);
  // Success modal state — one object so title/message/open can't drift apart.
  // Seeded from the redirect-return query params the billing endpoints append:
  // ?card_saved=1 = returning from the mode='setup' card-on-file session (no
  // subscription started, nothing charged); ?success=1 = returning from checkout.
  const [success, setSuccess] = useState<{ title: string; msg: string } | null>(() => {
    if (searchParams.get('card_saved') === '1') {
      return {
        title: 'Card saved',
        // The Founding Season promise only while the comp is still RUNNING — the same
        // card-save flow keeps working after the free season ends, with generic copy.
        msg: isFoundingSeasonActive()
          ? `Your payment method is on file. Nothing will be charged before ${FOUNDING_SEASON_FIRST_CHARGE_LABEL} — your Founding Season stays free through ${FOUNDING_SEASON_END_LABEL}.`
          : 'Your payment method is on file for future invoices.',
      };
    }
    if (searchParams.get('next_season') === '1') {
      return {
        title: 'Your next season is set',
        // The one promise this whole flow exists to keep, restated at the moment of purchase.
        msg: `Nothing is charged before ${FOUNDING_SEASON_FIRST_CHARGE_LABEL}. Your Founding Season stays free through ${FOUNDING_SEASON_END_LABEL}, and you can change your choice until then.`,
      };
    }
    if (searchParams.get('success') === '1') {
      return {
        title: 'Subscription activated!',
        msg: "Your plan has been upgraded. Enjoy your new features — they're applied immediately.",
      };
    }
    return null;
  });

  // Strip the one-shot return flags so a refresh doesn't re-open the modal forever
  // (pre-existing quirk with ?success=1; fixed for both now).
  useEffect(() => {
    if (
      searchParams.get('card_saved') === '1' ||
      searchParams.get('success') === '1' ||
      searchParams.get('next_season') === '1'
    ) {
      router.replace(window.location.pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
    isFoundingSeason: boolean;
    compUntil: string | null;
    card?: { savedAt: string; brand: string | null; last4: string | null } | null;
    nextSeason?: { planKey: string; billingCycle: string; chosenAt: string | null } | null;
  } | null>(null);
  // The summer ask: which cycle the chooser has selected. Annual leads (owner decision D3,
  // 2026-09-07) — a seasonal buyer charged monthly from October has nothing to use until spring.
  const [nextSeasonCycle, setNextSeasonCycle] = useState<'annual' | 'monthly'>('annual');
  const [nextSeasonLoading, setNextSeasonLoading] = useState(false);

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
          // Merge: replacing the object would drop `card`/`nextSeason` already loaded.
          setFoundingSeasonStatus(prev => ({ ...prev, isFoundingSeason: true, compUntil: data.compUntil ?? null }));
        }
        const remainingCopy = data.remainingRetainedCount
          ? ` ${data.remainingRetainedCount} retained tournament${data.remainingRetainedCount === 1 ? '' : 's'} still exceed this plan limit and remain in retention.`
          : '';
        setSuccess({
          title: 'Plan updated',
          msg: data.restoredCount
            ? `Your plan has been updated to ${PLAN_CONFIG[planKey].label}. ${data.restoredCount} retained tournament${data.restoredCount === 1 ? '' : 's'} restored.${remainingCopy}`
            : `Your plan has been updated to ${PLAN_CONFIG[planKey].label}.${remainingCopy}`,
        });
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

  /** Shared POST-then-redirect skeleton for the billing endpoints that answer with a
   *  Stripe destination URL. (The portal endpoint itself falls back to the card-setup
   *  session server-side when no billing account exists yet, so every response here
   *  is just a URL.) */
  async function redirectToBillingUrl(endpoint: string, setBusy: (b: boolean) => void, failMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Explicit org scoping — multi-org members must act on THIS page's org.
        body: JSON.stringify({ orgSlug: currentOrg?.slug }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? failMsg);
      if (!data.url) throw new Error(failMsg);
      window.location.assign(data.url);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setErrorOpen(true);
      setBusy(false);
    }
  }

  const handlePortal = () =>
    redirectToBillingUrl('/api/billing/portal', setPortalLoading, 'Portal did not return a destination.');
  const handleAddCard = () =>
    redirectToBillingUrl('/api/billing/setup-payment-method', setAddCardLoading, 'Card setup did not return a destination.');

  /** The summer ask: choose the plan for the season after the Founding Season. */
  async function handleChooseNextSeason(planKey: string) {
    if (!currentOrg) return;
    setNextSeasonLoading(true);
    try {
      const res = await fetch('/api/billing/choose-next-season', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgSlug: currentOrg.slug, planKey, billingCycle: nextSeasonCycle }),
      });
      const data = await res.json() as { url?: string; error?: string; applied?: boolean };
      if (!res.ok) throw new Error(data.error ?? 'The plan choice did not go through.');
      // Dev-mock path applies the choice directly (the sandbox Stripe environment has no prices),
      // so re-read the status rather than bouncing through a checkout that does not exist.
      if (data.applied) {
        const refreshed = await fetch(`/api/admin/org/founding-season-status?orgSlug=${encodeURIComponent(currentOrg.slug)}`)
          .then(r => r.ok ? r.json() : null).catch(() => null);
        if (refreshed) setFoundingSeasonStatus(refreshed);
        setSuccess({
          title: 'Your next season is set',
          msg: `Nothing is charged before ${FOUNDING_SEASON_FIRST_CHARGE_LABEL}. Your Founding Season stays free through ${FOUNDING_SEASON_END_LABEL}.`,
        });
        setNextSeasonLoading(false);
        return;
      }
      if (!data.url) throw new Error('The plan choice did not return a destination.');
      window.location.assign(data.url);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setErrorOpen(true);
      setNextSeasonLoading(false);
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
        // Explicit org scoping — multi-org owners must act on THIS page's org, not their home org.
        body: JSON.stringify({ targetPlan: planKey, orgSlug: currentOrg?.slug }),
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
          orgSlug: currentOrg?.slug,
        }),
      });
      const data = await res.json() as { error?: string; retainedCount?: number };
      if (!res.ok) throw new Error(data.error ?? 'Downgrade failed');
      await refreshBillingState();
      setDowngradePreflight(null);
      setSuccess({
        title: 'Plan updated',
        msg: data.retainedCount
          ? `${data.retainedCount} tournament${data.retainedCount === 1 ? '' : 's'} moved to retention for 90 days.`
          : 'Your plan was updated.',
      });
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
      const res = await fetch(`/api/billing/cancel/preflight?orgSlug=${encodeURIComponent(currentOrg?.slug ?? '')}`);
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
        // Explicit org scoping — multi-org owners must act on THIS page's org, not their home org.
        body: JSON.stringify({ reason: cancelReason, orgSlug: currentOrg?.slug }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Cancellation failed');
      await refreshBillingState();
      setCancelPreflight(null);
      setSuccess({
        title: 'Account suspended',
        msg: currentOrg?.accountKind === 'team_workspace' || currentOrg?.planId === 'team'
          ? 'Premium Coaches Portal is inactive. Basic tournament records remain available and premium team data is retained for 90 days.'
          : 'Public pages and modules have been shut down. Data is retained for 90 days.',
      });
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
    setSuccess(null);
    if (isTournamentOnlyOrg && currentOrg) {
      router.push(`/${currentOrg.slug}/admin/tournaments`);
    }
  }

  const currentPlanKey = currentOrg.planId;
  const currentPlan    = PLAN_CONFIG[currentPlanKey];
  const status         = currentOrg.subscriptionStatus;

  // Founding Season banner: before the summer card window it states that no payment action is
  // needed; inside the window it carries the "add a payment method" ask. The window's dates live
  // in lib/plan-config.ts beside the two Founding Season dates — never a literal here again (the
  // old hardcoded 2026-10-01 would have asked for a card eleven months early once the free season
  // was extended).
  const isTeamWorkspaceBilling = currentOrg.accountKind === 'team_workspace' || currentPlanKey === 'team';
  const isFoundingSeason = foundingSeasonStatus?.isFoundingSeason ?? false;
  const cardWindowOpen   = isFoundingSeasonCardWindowOpen();
  // Whether THIS account's current plan is a running Founding Season comp — the per-account
  // status, never the signup window: after the window closes, an account that joined in time is
  // still free through the end of the season, and its own price card must keep saying so
  // (/review 2026-09-07). Until the status answers, fall back to the window (the only state a
  // brand-new account can be in).
  const currentPlanComped = foundingSeasonStatus === null
    ? isFoundingSeasonPromoActive(currentPlanKey)
    : isFoundingSeason && (currentPlanKey === 'tournament_plus' || currentPlanKey === 'team');
  // ⚠ THE BANNER SPEAKS FOR WHICHEVER PRODUCT THE ACCOUNT IS ON (2026-09-07, Phase 2).
  // It used to be suppressed entirely for coach workspaces because its copy was
  // Tournament-Plus-specific — which left a comped Coaches Portal with NO Founding Season message at
  // all, while still rendering the ordinary "Billing tools" block whose "Payment method & invoices"
  // button opens a card-save session in January, unlabelled and ungated. Every plan-specific word
  // now derives from the account's own plan, so one block serves both kinds and the coach's card
  // door is gated to the same summer window the organization's is.
  const foundingProductLabel = currentPlan?.label ?? 'your plan';
  // Which plans this account may choose for next season — its own plan, in either cycle. An account
  // comped onto a FREE plan has nothing to renew and gets no chooser (it simply stays free).
  const nextSeasonOptions = nextSeasonPlanOptions(currentPlanKey);
  const nextSeasonPlanKey = nextSeasonOptions[0] ?? null;
  const nextSeasonChoice = foundingSeasonStatus?.nextSeason ?? null;
  const cardOnFile = foundingSeasonStatus?.card ?? null;
  const cardLabel = formatCardOnFile(cardOnFile);
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
  // ⚠ `?next_season=1` means the customer has just come back from Checkout. The webhook that
  // records the choice is asynchronous and routinely loses the race with that redirect, so the
  // status endpoint still says "no choice" for a second or two. Showing the chooser on top of the
  // success message invites the customer to choose AGAIN — which is how you get two live
  // subscriptions and two charges on the same day.
  const justChose = searchParams.get('next_season') === '1';
  const showNextSeasonChooser =
    isFoundingSeason && cardWindowOpen && canManageBilling && !!nextSeasonPlanKey
    && !nextSeasonChoice && !justChose;
  const showNextSeasonChosen = isFoundingSeason && !!nextSeasonChoice;
  // Resolved once. Read three times inside the confirmation card, the three lookups had drifted to
  // three different fallbacks (the label fell back to the raw key, the prices to zero) — which is
  // how a confirmation ends up naming a plan and quoting $0 for it.
  const chosenPlan = nextSeasonChoice ? PLAN_CONFIG[nextSeasonChoice.planKey as OrgPlan] : null;
  const chosenIsAnnual = nextSeasonChoice?.billingCycle === 'annual';
  const chosenPrice = chosenPlan ? (chosenIsAnnual ? chosenPlan.annualPrice : chosenPlan.monthlyPrice) : null;
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
    if (isFoundingSeasonPromoActive(planKey)) return `Free through ${FOUNDING_SEASON_END_LABEL}`;
    const plan = PLAN_CONFIG[planKey];
    if (plan.monthlyPrice === 0) return 'Free';
    if (billingCycle === 'annual') return `${formatPriceAmount(plan.annualPrice)} CAD / year`;
    return `${formatPriceAmount(plan.monthlyPrice)} CAD / month`;
  }

  function getShelfPrice(planKey: OrgPlan): string {
    if (isFoundingSeasonPromoActive(planKey)) return `Free through ${FOUNDING_SEASON_END_LABEL}`;
    const plan = PLAN_CONFIG[planKey];
    if (plan.monthlyPrice === 0) return 'Free';
    return `from ${formatPriceAmount(plan.monthlyPrice)} CAD / month`;
  }

  function getSavings(planKey: OrgPlan): string | null {
    if (isEffectivelyGated(planKey)) return null;
    if (isFoundingSeasonPromoActive(planKey)) return null;
    if (billingCycle !== 'annual') return null;
    return formatAnnualSavings(planKey);
  }

  function getTrialNote(planKey: OrgPlan): string {
    if (isEffectivelyGated(planKey)) return 'Early access only. Self-serve checkout is not open yet.';
    if (isFoundingSeasonPromoActive(planKey)) return `No credit card — nothing is charged before ${FOUNDING_SEASON_FIRST_CHARGE_LABEL}`;
    const days = PLAN_CONFIG[planKey].trialDays;
    if (days === 90) return 'Early-access trial details collected in Stripe';
    return `${days}-day trial · Payment details collected in Stripe`;
  }

  function getUpgradeLoadingLabel(planKey: OrgPlan): string {
    return isFoundingSeasonPromoActive(planKey) ? 'Applying...' : 'Redirecting...';
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
          isOpen={success !== null}
          onClose={handleSuccessClose}
          title={success?.title ?? ''}
          message={success?.msg ?? ''}
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
              {currentPlanComped
                ? `Free through ${FOUNDING_SEASON_END_LABEL}`
                : currentPlan.monthlyPrice === 0
                  ? 'Free forever'
                  : currentOrg.subscriptionPeriod === 'annual'
                    ? `${formatPriceAmount(currentPlan.annualPrice)} CAD / year`
                    : `${formatPriceAmount(currentPlan.monthlyPrice)} CAD / month`}
            </div>
            {currentPlanComped && (
              <div className={styles.planBillingCycle}>normally {formatPriceAmount(currentPlan.monthlyPrice)}/month · in {FOUNDING_SEASON_DECISION_MONTH_LABEL} you&apos;ll choose a plan for {FOUNDING_SEASON_NEXT_YEAR_LABEL}</div>
            )}
            {currentOrg.subscriptionPeriod && currentPlan.monthlyPrice > 0 && !currentPlanComped && (
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

      {isFoundingSeason && (
        <div className={styles.foundingSeasonBanner}>
          <div className={styles.foundingSeasonIcon}><Star size={16} /></div>
          <div className={styles.foundingSeasonBody}>
            <p className={styles.foundingSeasonEyebrow}>
              {cardWindowOpen ? `Founding Season · ends ${FOUNDING_SEASON_END_LABEL}` : 'Founding Season'}
            </p>
            <h2 className={styles.foundingSeasonTitle}>
              {cardWindowOpen
                ? `Your Founding Season ends ${FOUNDING_SEASON_END_LABEL}.`
                : `${foundingProductLabel} is free through ${FOUNDING_SEASON_END_LABEL}.`}
            </h2>
            <p className={styles.foundingSeasonCopy}>
              {cardWindowOpen
                ? `Choose a plan for your ${FOUNDING_SEASON_NEXT_YEAR_LABEL} season below. Nothing is charged before ${FOUNDING_SEASON_FIRST_CHARGE_LABEL}, and you can change your mind until then.`
                : `You're running ${foundingProductLabel} free through ${FOUNDING_SEASON_END_LABEL} as a founding ${isTeamWorkspaceBilling ? 'coach' : 'organization'} — normally ${formatPriceAmount(currentPlan?.monthlyPrice ?? 0)}/month. No credit card. In ${FOUNDING_SEASON_DECISION_MONTH_LABEL} you'll choose a plan for your ${FOUNDING_SEASON_NEXT_YEAR_LABEL} season.`}
            </p>
          </div>
        </div>
      )}

      {/* ── The summer ask: choose next season's plan ──────────────────────────────────────────
          Replaces "add a payment method" as the thing a Founding Season account is asked to do.
          Annual leads (a seasonal buyer charged monthly from October has nothing to use until
          spring); monthly is one tap away. Every product name and price derives from the account's
          own plan, so this markup serves an organization and a coach workspace identically. */}
      {showNextSeasonChooser && nextSeasonPlanKey && (
        <div className={styles.nextSeasonCard}>
          <h2 className={styles.foundingSeasonTitle}>
            Choose your {FOUNDING_SEASON_NEXT_YEAR_LABEL} plan
          </h2>
          <p className={styles.foundingSeasonCopy}>
            You&rsquo;re on {foundingProductLabel} today. Keep it for {FOUNDING_SEASON_NEXT_YEAR_LABEL},
            or {isTeamWorkspaceBilling
              ? `let it end on ${FOUNDING_SEASON_END_LABEL} and keep your free Basic team records.`
              : `move to the free ${PLAN_CONFIG.tournament.label} plan when the season ends.`}
          </p>

          <div className={styles.nextSeasonPlans}>
            {(['annual', 'monthly'] as const).map(cycle => {
              const plan = PLAN_CONFIG[nextSeasonPlanKey];
              const amount = cycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
              const savings = cycle === 'annual' ? formatAnnualSavings(nextSeasonPlanKey) : null;
              const selected = nextSeasonCycle === cycle;
              return (
                <label
                  key={cycle}
                  className={`${styles.nextSeasonPlan} ${selected ? styles.nextSeasonPlanActive : ''}`}
                >
                  <span className={styles.nextSeasonPlanLabel}>
                    <input
                      type="radio"
                      name="next-season-cycle"
                      value={cycle}
                      checked={selected}
                      onChange={() => setNextSeasonCycle(cycle)}
                    />
                    {plan.label} · {cycle === 'annual' ? 'annual' : 'monthly'}
                  </span>
                  <span className={styles.nextSeasonPrice}>
                    {formatPriceAmount(amount)}
                    <span className={styles.nextSeasonPriceUnit}>
                      {cycle === 'annual' ? ' / year' : ' / month'}
                    </span>
                  </span>
                  {savings && <span className={styles.nextSeasonSave}>{savings}</span>}
                </label>
              );
            })}
          </div>

          <div className={styles.nextSeasonActions}>
            <p className={styles.nextSeasonGuarantee}>
              First charge {FOUNDING_SEASON_FIRST_CHARGE_LABEL} · nothing before then
            </p>
            <button
              className="btn btn-lime btn-data"
              onClick={() => handleChooseNextSeason(nextSeasonPlanKey)}
              disabled={nextSeasonLoading}
              id="billing-choose-next-season"
            >
              {nextSeasonLoading
                ? 'Redirecting…'
                : `Choose ${PLAN_CONFIG[nextSeasonPlanKey].label} · ${nextSeasonCycle}`}
              {!nextSeasonLoading && <ArrowRight size={14} />}
            </button>
          </div>

          <p className={styles.nextSeasonFootnote}>
            Prefer to decide later?{' '}
            <button className={styles.nextSeasonSecondary} onClick={handleAddCard} disabled={addCardLoading}>
              {addCardLoading ? 'Redirecting…' : 'Save a card without choosing'}
            </button>
          </p>
        </div>
      )}

      {showNextSeasonChosen && nextSeasonChoice && (
        <div className={styles.nextSeasonChosen}>
          <p className={styles.nextSeasonChosenEyebrow}>
            Your {FOUNDING_SEASON_NEXT_YEAR_LABEL} season is set
          </p>
          <h2 className={styles.foundingSeasonTitle}>
            {chosenPlan?.label ?? nextSeasonChoice.planKey}, billed{' '}
            {chosenIsAnnual ? 'annually' : 'monthly'} from {FOUNDING_SEASON_FIRST_CHARGE_LABEL}.
          </h2>
          <p className={styles.foundingSeasonCopy}>
            {chosenPrice === null ? 'Your plan' : formatPriceAmount(chosenPrice)}{' '}
            will be charged{cardLabel ? ` to ${cardLabel}` : ''} on {FOUNDING_SEASON_FIRST_CHARGE_LABEL} — your first
            charge, and nothing before it. Your Founding Season runs free until then.
          </p>
          {cardWindowOpen && canManageBilling && (
            <p className={styles.nextSeasonFootnote}>
              You can change this until {FOUNDING_SEASON_END_LABEL}.{' '}
              <button className={styles.nextSeasonSecondary} onClick={handlePortal} disabled={portalLoading}>
                {portalLoading ? 'Redirecting…' : 'Change plan or card'}
              </button>
            </p>
          )}
        </div>
      )}

      {/* ⚠ WHAT HAPPENS IF THEY CHOOSE NOTHING — and for a coach this may promise ONLY what the
          product already does (owner ruling D1, 2026-09-07). The read-only window for a lapsed
          Coaches Portal is ratified in principle and NOT built; until it exists this line stays on
          the honest fallback and describes no read-only season. */}
      {isFoundingSeason && cardWindowOpen && !nextSeasonChoice && !justChose && (
        <div className={styles.nextSeasonConsequence}>
          <h2 className={styles.nextSeasonConsequenceTitle}>If you choose nothing</h2>
          <p className={styles.foundingSeasonCopy}>
            {isTeamWorkspaceBilling
              ? `Your Premium portal ends on ${FOUNDING_SEASON_END_LABEL}. Your team's Basic tournament records stay available, and your season's work is kept.`
              : `Your organization moves to the free ${PLAN_CONFIG.tournament.label} plan on ${FOUNDING_SEASON_FIRST_CHARGE_LABEL}. Your tournaments and records stay.`}
          </p>
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
                      background: pct >= 100 ? 'var(--danger)' : pct >= 80 ? 'var(--warning)' : 'var(--logic-lime)',
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
                {!isFoundingSeasonPromoActive('tournament_plus') && (
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
      {hasPaidPlan && !isFoundingSeason && (
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

      {/* Founding season billing — no Stripe subscription exists yet.
          ⚠ THE ASK MOVED. Inside the summer window the plan chooser above IS the ask; this block
          drops back to stating the card on file, so the page never asks for the same thing twice.
          Outside the window it says the one true thing: no action is needed yet.
          ⚠ It is also GATED to the window for coach workspaces now — a comped Coaches Portal used
          to fall through to the generic "Payment method & invoices" block, whose button opens a
          card-save session in January, unlabelled and with no Founding Season copy anywhere. */}
      {isFoundingSeason && (
        <div className={styles.billingTools}>
          <div>
            <h2 className={styles.sectionTitle}>Billing</h2>
            <p className={styles.manageHint}>
              {!cardWindowOpen
                ? `No billing action needed — your Founding Season runs free through ${FOUNDING_SEASON_END_LABEL}. We'll remind you during the summer when it's time to choose a plan for ${FOUNDING_SEASON_NEXT_YEAR_LABEL}.`
                : cardLabel
                  ? `${cardLabel} is on file. Nothing is charged before ${FOUNDING_SEASON_FIRST_CHARGE_LABEL}.`
                  : `No payment method on file yet. Nothing is charged before ${FOUNDING_SEASON_FIRST_CHARGE_LABEL}.`}
            </p>
          </div>
          {cardWindowOpen && canManageBilling && (
            /* mode='setup' card-on-file save — NOT the subscription checkout (which
               starts a trial and would bill before the free season ends). */
            <button
              className="btn btn-outline"
              onClick={handleAddCard}
              disabled={addCardLoading}
            >
              {addCardLoading ? 'Redirecting…' : cardLabel ? 'Update payment method' : 'Add payment method'}
              {!addCardLoading && <ArrowRight size={14} />}
            </button>
          )}
        </div>
      )}

      {hasPaidPlan && canManageBilling && !isFoundingSeason && (
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
        isOpen={success !== null}
        onClose={handleSuccessClose}
        title={success?.title ?? ''}
        message={success?.msg ?? ''}
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
