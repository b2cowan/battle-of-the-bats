'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreditCard, Zap, Shield, CheckCircle } from 'lucide-react';
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

const PLAN_ORDER: OrgPlan[] = ['starter', 'pro', 'elite'];

const PLAN_ICONS: Record<OrgPlan, React.ReactNode> = {
  starter: <Zap size={20} />,
  pro:     <CreditCard size={20} />,
  elite:   <Shield size={20} />,
};

export default function BillingPage() {
  const { currentOrg } = useOrg();
  const { tournaments }  = useTournament();
  const searchParams     = useSearchParams();

  const [loading, setLoading]     = useState<OrgPlan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [successOpen, setSuccessOpen]     = useState(false);
  const [errorOpen, setErrorOpen]         = useState(false);
  const [errorMsg, setErrorMsg]           = useState('');

  useEffect(() => {
    if (searchParams.get('success') === '1') {
      setSuccessOpen(true);
    }
  }, [searchParams]);

  async function handleUpgrade(planKey: 'pro' | 'elite') {
    setLoading(planKey);
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed');
      window.location.href = data.url;
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Something went wrong. Please try again.');
      setErrorOpen(true);
      setLoading(null);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Portal failed');
      window.location.href = data.url;
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Something went wrong. Please try again.');
      setErrorOpen(true);
      setPortalLoading(false);
    }
  }

  if (!currentOrg) {
    return <div className={styles.page}><p style={{ color: 'var(--white-40)' }}>Loading…</p></div>;
  }

  const currentPlanKey  = currentOrg.planId;
  const currentPlan     = PLAN_CONFIG[currentPlanKey];
  const status          = currentOrg.subscriptionStatus;
  const usageCount      = tournaments.length;
  const usageLimit      = currentOrg.tournamentLimit;
  const usagePct        = usageLimit >= 9999 ? 0 : Math.min(100, Math.round((usageCount / usageLimit) * 100));
  const upgradePlans    = PLAN_ORDER.filter(p => PLAN_ORDER.indexOf(p) > PLAN_ORDER.indexOf(currentPlanKey));
  const hasPaidPlan     = currentPlanKey !== 'starter';

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><CreditCard size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Billing</h1>
            <p className={styles.pageSub}>Manage your plan and subscription</p>
          </div>
        </div>
      </div>

      {/* Current plan card */}
      <div className={styles.currentCard}>
        <div className={styles.currentLeft}>
          <div className={styles.planIcon}>{PLAN_ICONS[currentPlanKey]}</div>
          <div>
            <div className={styles.planName}>{currentPlan.label} Plan</div>
            <div className={styles.planPrice}>
              {currentPlan.monthlyPrice === 0
                ? 'Free forever'
                : `$${currentPlan.monthlyPrice} / month`}
            </div>
          </div>
        </div>
        <span className={`badge ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span>
      </div>

      {/* Usage meter */}
      <div className={styles.usageCard}>
        <div className={styles.usageHeader}>
          <span className={styles.usageLabel}>Tournaments used</span>
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
                background: usagePct >= 100 ? 'var(--danger)' : usagePct >= 80 ? 'var(--warning, #f59e0b)' : 'var(--primary-light)',
              }}
            />
          </div>
        )}
      </div>

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
          <h2 className={styles.sectionTitle}>Upgrade your plan</h2>
          <div className={styles.plansGrid}>
            {upgradePlans.map(planKey => {
              const plan = PLAN_CONFIG[planKey];
              return (
                <div key={planKey} className={styles.planCard}>
                  <div className={styles.planCardIcon}>{PLAN_ICONS[planKey]}</div>
                  <div className={styles.planCardName}>{plan.label}</div>
                  <div className={styles.planCardPrice}>
                    <span className={styles.priceAmount}>${plan.monthlyPrice}</span>
                    <span className={styles.priceUnit}>/mo</span>
                  </div>
                  <ul className={styles.featureList}>
                    <li>
                      <CheckCircle size={13} />
                      {plan.tournamentLimit >= 9999 ? 'Unlimited tournaments' : `Up to ${plan.tournamentLimit} tournaments`}
                    </li>
                    <li>
                      <CheckCircle size={13} />
                      14-day free trial
                    </li>
                    <li>
                      <CheckCircle size={13} />
                      All features included
                    </li>
                  </ul>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={() => handleUpgrade(planKey as 'pro' | 'elite')}
                    disabled={loading === planKey}
                    id={`billing-upgrade-${planKey}`}
                  >
                    {loading === planKey ? 'Redirecting…' : `Upgrade to ${plan.label}`}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Success modal */}
      <FeedbackModal
        isOpen={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Subscription activated!"
        message="Your plan has been upgraded. Enjoy your new tournament limit — it's applied immediately."
        type="success"
      />

      {/* Error modal */}
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
