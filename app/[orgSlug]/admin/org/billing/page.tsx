'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreditCard, CheckCircle } from 'lucide-react';
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

const PLAN_ORDER: OrgPlan[] = ['tournament', 'tournament_plus', 'league', 'club'];

const PLAN_TAGLINE: Record<OrgPlan, string> = {
  tournament:      'Everything you need to run a basic tournament.',
  tournament_plus: 'Professional tournament management without the league complexity.',
  league:          'Manage your league, registrations, and public presence — all in one place.',
  club:            'The complete operating system for your sports organization.',
};

const PLAN_FEATURES: Record<OrgPlan, string[]> = {
  tournament: [
    'Manual tournament scheduling',
    'Basic standings and score entry',
    'Field and diamond management',
    '3 staff / admin seats · 1 active tournament',
  ],
  tournament_plus: [
    'Everything in Tournament',
    'Automated schedule generation',
    'Bracket generator',
    'Email announcements and communications',
    'Unlimited simultaneous tournaments',
    '5 staff seats — officials always free',
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
  tournament:      "You're on the free plan. Upgrade anytime — no credit card required until you're ready.",
  tournament_plus: "You're on Tournament Plus. Running a league or registration workflow? League unlocks those tools.",
  league:          "You're on League. Need accounting or rep team tools? Club is the complete platform.",
  club:            "You're on the complete Club platform.",
};

export default function BillingPage() {
  const { currentOrg } = useOrg();
  const { tournaments }  = useTournament();
  const searchParams     = useSearchParams();

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading]           = useState<OrgPlan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [successOpen, setSuccessOpen]     = useState(() => searchParams.get('success') === '1');
  const [errorOpen, setErrorOpen]         = useState(false);
  const [errorMsg, setErrorMsg]           = useState('');
  const [seatUsage, setSeatUsage]         = useState<{
    billed: number; officials: number; limit: number; officialsFree: boolean;
  } | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    fetch('/api/admin/members/count')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSeatUsage(data); })
      .catch(() => {});
  }, [currentOrg]);

  async function handleUpgrade(planKey: 'tournament_plus' | 'league' | 'club') {
    setLoading(planKey);
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed');
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

  if (!currentOrg) {
    return <div className={styles.page}><p style={{ color: 'var(--white-40)' }}>Loading…</p></div>;
  }

  const currentPlanKey = currentOrg.planId;
  const currentPlan    = PLAN_CONFIG[currentPlanKey];
  const status         = currentOrg.subscriptionStatus;
  const usageCount     = tournaments.filter(t => t.status === 'active').length;
  const usageLimit     = currentOrg.tournamentLimit;
  const usagePct       = usageLimit >= 9999 ? 0 : Math.min(100, Math.round((usageCount / usageLimit) * 100));
  const upgradePlans   = PLAN_ORDER.filter(p => PLAN_ORDER.indexOf(p) > PLAN_ORDER.indexOf(currentPlanKey));
  const hasPaidPlan    = currentPlanKey !== 'tournament';

  function getPrice(planKey: OrgPlan): string {
    const plan = PLAN_CONFIG[planKey];
    if (plan.monthlyPrice === 0) return 'Free';
    if (billingCycle === 'annual') return `$${plan.annualPrice} CAD / year`;
    return `$${plan.monthlyPrice} CAD / month`;
  }

  function getSavings(planKey: OrgPlan): string | null {
    if (billingCycle !== 'annual') return null;
    const plan = PLAN_CONFIG[planKey];
    if (plan.monthlyPrice === 0) return null;
    const savings = plan.monthlyPrice * 12 - plan.annualPrice;
    return `Save $${savings} — 2 months free`;
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
          Your subscription has been canceled. You retain access until the end of the current billing period, after which your plan will revert to the Tournament plan.
        </p>
      )}

      {/* Usage meters */}
      <div className={styles.usageCard}>
        <div className={styles.usageHeader}>
          <span className={styles.usageLabel}>Active tournaments</span>
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

      {/* Manage subscription (paid plans) */}
      {hasPaidPlan && (
        <div className={styles.manageRow}>
          <button
            className="btn btn-outline"
            onClick={handlePortal}
            disabled={portalLoading}
            id="billing-manage-btn"
          >
            {portalLoading ? 'Redirecting…' : 'Manage Subscription'}
          </button>
          <p className={styles.manageHint}>Update payment method, view invoices, or cancel.</p>
        </div>
      )}

      {/* Upgrade cards */}
      {upgradePlans.length > 0 && (
        <>
          <div className={styles.upgradeHeader}>
            <h2 className={styles.sectionTitle}>Upgrade your plan</h2>
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
              return (
                <div key={planKey} className={styles.planCard}>
                  <div className={styles.planCardHeader}>
                    <div className={styles.planCardName}>{plan.label}</div>
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
                    disabled={loading === planKey}
                    id={`billing-upgrade-${planKey}`}
                  >
                    {loading === planKey ? 'Redirecting…' : `Upgrade to ${plan.label}`}
                  </button>
                  <p className={styles.trialNote}>14-day free trial · No credit card required</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      <FeedbackModal
        isOpen={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Subscription activated!"
        message="Your plan has been upgraded. Enjoy your new features — they're applied immediately."
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
