'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, CheckCircle } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { PLAN_CONFIG } from '@/lib/plan-config';
import FeedbackModal from '@/components/FeedbackModal';
import type { OrgPlan, SubscriptionStatus } from '@/lib/types';
import styles from './mock-portal.module.css';

const PLANS: OrgPlan[]    = ['starter', 'pro', 'elite'];
const STATUSES: SubscriptionStatus[] = ['active', 'trialing', 'past_due', 'canceled'];

export default function MockPortalPage() {
  const { currentOrg, refresh } = useOrg();
  const router = useRouter();

  const [plan,   setPlan]   = useState<OrgPlan>(currentOrg?.planId ?? 'starter');
  const [status, setStatus] = useState<SubscriptionStatus>(currentOrg?.subscriptionStatus ?? 'active');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');

  async function handleApply() {
    setSaving(true);
    try {
      const res = await fetch('/api/billing/mock-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, status }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to apply');
      }
      await refresh();
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleReturn() {
    if (!currentOrg) return;
    router.push(`/${currentOrg.slug}/admin/billing`);
  }

  if (!currentOrg) return null;

  return (
    <div className={styles.page}>
      <div className={styles.banner}>
        <FlaskConical size={16} />
        <span>Dev mock — simulates the Stripe Customer Portal. This page does not exist in production.</span>
      </div>

      <div className={styles.card}>
        <h1 className={styles.title}>Manage Subscription</h1>
        <p className={styles.sub}>Org: <strong>{currentOrg.name}</strong></p>

        <div className={styles.field}>
          <label className={styles.label}>Plan</label>
          <div className={styles.pills}>
            {PLANS.map(p => (
              <button
                key={p}
                className={`${styles.pill} ${plan === p ? styles.pillActive : ''}`}
                onClick={() => setPlan(p)}
              >
                {PLAN_CONFIG[p].label}
                {plan === p && <CheckCircle size={13} />}
              </button>
            ))}
          </div>
          <p className={styles.hint}>
            Limit: {PLAN_CONFIG[plan].tournamentLimit >= 9999 ? 'Unlimited' : PLAN_CONFIG[plan].tournamentLimit} tournaments
            &nbsp;·&nbsp;
            {PLAN_CONFIG[plan].monthlyPrice === 0 ? 'Free' : `$${PLAN_CONFIG[plan].monthlyPrice}/mo`}
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Subscription status</label>
          <div className={styles.pills}>
            {STATUSES.map(s => (
              <button
                key={s}
                className={`${styles.pill} ${status === s ? styles.pillActive : ''}`}
                onClick={() => setStatus(s)}
              >
                {s}
                {status === s && <CheckCircle size={13} />}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <button className="btn btn-ghost" onClick={handleReturn}>
            ← Back to Billing
          </button>
          <button
            className="btn btn-primary"
            onClick={handleApply}
            disabled={saving}
            id="mock-portal-apply"
          >
            {saving ? 'Applying…' : 'Apply changes'}
          </button>
        </div>
      </div>

      <FeedbackModal
        isOpen={saved}
        onClose={() => { setSaved(false); handleReturn(); }}
        title="Changes applied"
        message={`Plan set to ${PLAN_CONFIG[plan].label}, status set to ${status}. Returning to billing page.`}
        type="success"
      />

      <FeedbackModal
        isOpen={!!error}
        onClose={() => setError('')}
        title="Error"
        message={error}
        type="danger"
      />
    </div>
  );
}
