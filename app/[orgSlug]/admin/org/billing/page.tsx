'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreditCard, CheckCircle, Archive, ShieldOff } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { PLAN_CONFIG } from '@/lib/plan-config';
import FeedbackModal from '@/components/FeedbackModal';
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

const PLAN_ORDER: OrgPlan[] = ['tournament', 'team', 'tournament_plus', 'league', 'club'];

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
  team:            'A coach workspace for one rep team with roster, schedule, dues, documents, and one free-tier tournament slot.',
  tournament_plus: 'Serious tournament operations: registration control, branding, automation, and reporting.',
  league:          'Manage your league, registrations, and public presence — all in one place.',
  club:            'The complete operating system for your sports organization.',
};

const PLAN_FEATURES: Record<OrgPlan, string[]> = {
  tournament: [
    'Manual tournament scheduling',
    'Standard team registration fields',
    'Selected-row registration updates and waitlist collection',
    'Basic standings and score entry',
    'Field and diamond management',
    'Default FieldLogicHQ public styling',
    'Public news posts and basic team email',
    '3 staff / admin seats · 1 tournament slot',
  ],
  team: [
    'One rep team workspace',
    'Coaches portal for roster, schedule, dues, and documents',
    'Team budget and payment reminder tools',
    'One free-tier tournament slot for scrimmages or local events',
    '3 staff / coach seats',
  ],
  tournament_plus: [
    'Everything in Tournament',
    'Unlimited tournament slots',
    '10 staff seats - officials always free',
    'Custom registration questions and file uploads',
    'Excel/PDF registration exports and payment reminders',
    'Waitlist promotion and queue management',
    'Full branding control',
    'Automated schedule generation',
    'Playoff bracket generator',
    'Permanent sealed archives',
    'Tournament cloning, targeted announcements, and summary reporting',
  ],
  league: [
    'Everything in Tournament Plus',
    'Public organization page (branded)',
    'House League — registration, divisions, seasons, standings',
    'Advanced member roles and permissions',
    '10 staff / admin seats',
  ],
  club: [
    'Everything in League',
    'Accounting — ledger, invoicing, payment reconciliation',
    'Rep Teams — tryouts, rosters, player documents',
    'Coaches portal',
    'Unlimited staff / admin seats',
  ],
};

const PLAN_META_COPY: Record<OrgPlan, string> = {
  tournament:      "You're on the free starter plan. Upgrade when you need custom registration, exports, payment reminders, waitlist promotion, branding, or repeat-event tools.",
  team:            "You're on Team. Your coach workspace and one free-tier tournament slot are active.",
  tournament_plus: "You're on Tournament Plus. Your tournament operations tools are active; League and Club are coming soon while those broader workflows are refined.",
  league:          "You're on League. Need accounting or rep team tools? Club is the complete platform.",
  club:            "You're on the complete Club platform.",
};

const COMING_SOON_PLANS = new Set<OrgPlan>(['league', 'club']);

export default function BillingPage() {
  const { currentOrg, refresh: refreshOrg, userRole } = useOrg();
  const { tournaments, refresh: refreshTournaments }  = useTournament();
  const searchParams     = useSearchParams();

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
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
  const [repTeamAddon, setRepTeamAddon]   = useState<{
    activeCount: number; billableCount: number;
  } | null>(null);

  async function refreshBillingState() {
    await Promise.all([refreshOrg(), refreshTournaments()]);
  }

  useEffect(() => {
    if (!currentOrg) return;
    fetch('/api/admin/members/count')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSeatUsage(data); })
      .catch(() => {});
  }, [currentOrg]);

  // E6 — fetch rep-team add-on usage for Club orgs
  useEffect(() => {
    if (!currentOrg || currentOrg.planId !== 'club') return;
    fetch('/api/admin/rep-teams/billing-preview?proposedCount=0')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && typeof data.currentCount === 'number') {
          setRepTeamAddon({
            activeCount: data.currentCount,
            billableCount: Math.max(0, data.currentCount - 3),
          });
        }
      })
      .catch(() => {});
  }, [currentOrg]);

  async function handleUpgrade(planKey: 'tournament_plus' | 'league' | 'club') {
    setLoading(planKey);
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey, billingCycle }),
      });
      const data = await res.json() as {
        url?: string;
        error?: string;
        applied?: boolean;
        restoredCount?: number;
        remainingRetainedCount?: number;
      };
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed');
      if (data.applied) {
        await refreshBillingState();
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
      setSuccessMsg('Public pages and modules have been shut down. Data is retained for 90 days.');
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

  const currentPlanKey = currentOrg.planId;
  const currentPlan    = PLAN_CONFIG[currentPlanKey];
  const status         = currentOrg.subscriptionStatus;
  const usageCount     = tournaments.filter(t => t.status !== 'archived').length;
  const usageLimit     = currentOrg.tournamentLimit;
  const usagePct       = usageLimit >= 9999 ? 0 : Math.min(100, Math.round((usageCount / usageLimit) * 100));
  const upgradePlans   = PLAN_ORDER.filter(p => PLAN_ORDER.indexOf(p) > PLAN_ORDER.indexOf(currentPlanKey));
  const downgradePlans = PLAN_ORDER.filter(p => PLAN_ORDER.indexOf(p) < PLAN_ORDER.indexOf(currentPlanKey));
  const hasPaidPlan    = currentPlanKey !== 'tournament';
  const canManageBilling = userRole === 'owner';

  function getPrice(planKey: OrgPlan): string {
    if (COMING_SOON_PLANS.has(planKey)) return 'Coming soon';
    const plan = PLAN_CONFIG[planKey];
    if (plan.monthlyPrice === 0) return 'Free';
    if (billingCycle === 'annual') return `$${plan.annualPrice} CAD / year`;
    return `$${plan.monthlyPrice} CAD / month`;
  }

  function getSavings(planKey: OrgPlan): string | null {
    if (COMING_SOON_PLANS.has(planKey)) return null;
    if (billingCycle !== 'annual') return null;
    const plan = PLAN_CONFIG[planKey];
    if (plan.monthlyPrice === 0) return null;
    const savings = plan.monthlyPrice * 12 - plan.annualPrice;
    return `Save $${savings} — 2 months free`;
  }

  function getTrialNote(planKey: OrgPlan): string {
    if (COMING_SOON_PLANS.has(planKey)) return 'Early access only. Self-serve checkout is not open yet.';
    const days = PLAN_CONFIG[planKey].trialDays;
    if (days === 90) return 'Early-access trial details collected in Stripe';
    return `${days}-day trial · Payment details collected in Stripe`;
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><CreditCard size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Subscription</h1>
            <p className={styles.pageSub}>Manage your plan and payment method</p>
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
                : `$${currentPlan.monthlyPrice} CAD / month`}
            </div>
            <div className={styles.planMetaCopy}>{PLAN_META_COPY[currentPlanKey]}</div>
          </div>
        </div>
        <span className={`badge ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span>
      </div>

      {status === 'past_due' && (
        <p className={`${styles.statusNote} ${styles.statusNoteWarning}`}>
          Your last payment failed. Your access remains active during the grace period — please update your payment method via <strong>Manage Subscription</strong> below to avoid service interruption.
        </p>
      )}
      {status === 'canceled' && (
        <p className={`${styles.statusNote} ${styles.statusNoteDanger}`}>
          Your subscription has been canceled. Public pages and modules are suspended while retained data remains restorable during the retention window.
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
                background: usagePct >= 100 ? 'var(--danger)' : usagePct >= 80 ? 'var(--warning, #f59e0b)' : 'var(--logic-lime)',
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
                  · {seatUsage.officials} official{seatUsage.officials === 1 ? '' : 's'} free
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

      {/* E6 — Rep team add-on usage (Club plan only) */}
      {currentPlanKey === 'club' && repTeamAddon !== null && (
        <div className={styles.usageCard}>
          <div className={styles.usageHeader}>
            <span className={styles.usageLabel}>
              Rep team add-on
              <span style={{ marginLeft: '0.5rem', fontWeight: 400, color: 'var(--white-30)' }}>
                · first 3 active teams included
              </span>
            </span>
            <span className={styles.usageCount}>
              {repTeamAddon.billableCount > 0
                ? `${repTeamAddon.billableCount} billed — ${currentOrg.subscriptionPeriod === 'annual' ? '$200 CAD / year' : '$20 CAD / month'} each`
                : `${repTeamAddon.activeCount} active · within free threshold`}
            </span>
          </div>
        </div>
      )}

      {/* Upgrade cards */}
      {upgradePlans.length > 0 && (
        <>
          <div className={styles.upgradeHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Compare upgrade options</h2>
              <p className={styles.upgradeIntro}>Review the plans that unlock registration control, organizer productivity, and broader organization tools.</p>
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

          <div className={styles.plansGrid}>
            {upgradePlans.map(planKey => {
              const plan = PLAN_CONFIG[planKey];
              const savings = getSavings(planKey);
              const isComingSoon = COMING_SOON_PLANS.has(planKey);
              return (
                <div key={planKey} className={`${styles.planCard} ${isComingSoon ? styles.planCardComingSoon : ''}`}>
                  <div className={styles.planCardHeader}>
                    <div className={styles.planCardName}>{plan.label}</div>
                    {isComingSoon && <span className={styles.comingSoonBadge}>Coming soon</span>}
                  </div>
                  <div className={styles.planTaglineCard}>{PLAN_TAGLINE[planKey]}</div>
                  <div className={styles.planCardPrice}>
                    <span className={styles.priceAmount}>{getPrice(planKey)}</span>
                  </div>
                  {savings && <div className={styles.savingsBadge}>{savings}</div>}
                  <ul className={styles.featureList}>
                    {PLAN_FEATURES[planKey].map(f => (
                      <li key={f}>
                        <CheckCircle size={13} />
                        {f}
                      </li>
                  ))}
                  </ul>
                  <button
                    className={`btn btn-primary ${styles.planButton}`}
                    onClick={() => handleUpgrade(planKey as 'tournament_plus' | 'league' | 'club')}
                    disabled={isComingSoon || loading === planKey}
                    id={`billing-upgrade-${planKey}`}
                  >
                    {isComingSoon ? 'Early access only' : loading === planKey ? 'Redirecting…' : `Upgrade to ${plan.label}`}
                  </button>
                  <p className={styles.trialNote}>{getTrialNote(planKey)}</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Billing portal (paid plans) */}
      {hasPaidPlan && (
        <div className={styles.billingTools}>
          <div>
            <h2 className={styles.sectionTitle}>Billing tools</h2>
            <p className={styles.manageHint}>
              {canManageBilling
                ? 'Open the secure billing portal for payment methods, invoices, and billing details.'
                : 'Only organization owners can open payment methods, invoices, and billing details.'}
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

      {hasPaidPlan && canManageBilling && (
        <div className={styles.retentionCard}>
          <h2 className={styles.sectionTitle}>Reduce or cancel plan</h2>
          <p className={styles.retentionCopy}>
            Downgrades and cancellations run through a short review first so tournament data and retention choices are clear.
          </p>

          {downgradePlans.length > 0 && (
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
            <span>Cancel and suspend account</span>
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
          <button className="btn btn-primary" onClick={confirmDowngrade} disabled={downgradeSaving}>
            {downgradeSaving ? 'Applying…' : 'Confirm downgrade'}
          </button>
        </div>
      )}

      {cancelPreflight && (
        <div className={styles.reviewCard}>
          <div className={styles.reviewHeader}>
            <h2 className={styles.sectionTitle}>Cancel account</h2>
            <button className="btn btn-ghost" onClick={() => setCancelPreflight(null)}>Close</button>
          </div>
          <p className={`${styles.statusNote} ${styles.statusNoteDanger}`}>
            Cancellation suspends the full account. Public pages and modules shut down, and data is retained for {cancelPreflight.retentionDays} days.
          </p>
          <div className={styles.cancelImpactGrid}>
            <section className={styles.cancelImpactSection}>
              <h3>Archived during retention</h3>
              <p>
                {cancelPreflight.tournaments.length > 0
                  ? `${cancelPreflight.tournaments.length} tournament${cancelPreflight.tournaments.length === 1 ? '' : 's'} will move into archive retention.`
                  : 'No active tournament records need to be archived.'}
              </p>
            </section>
            <section className={styles.cancelImpactSection}>
              <h3>Access suspended</h3>
              <p>Based on your current plan, these areas will be unavailable while the account is canceled.</p>
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
        onClose={() => setSuccessOpen(false)}
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
