'use client';

import { Fragment, useState } from 'react';
import { PLAN_CONFIG, formatPriceAmount } from '@/lib/plan-config';
import { Loader } from 'lucide-react';
// This file is kept for reference only — the page now redirects to /platform-admin/plans-pricing
type PlanGatingRow = {
  plan_key: string;
  gating_status: string;
  updated_at: string | null;
  updated_by_email: string | null;
};
import styles from './plans.module.css';

const PLAN_META: Record<string, { label: string; price: string }> = {
  tournament:      { label: 'Tournament',      price: 'Free' },
  team:            { label: 'Team',            price: `${formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)}/mo` },
  tournament_plus: { label: 'Tournament Plus', price: `${formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}/mo` },
  league:          { label: 'League Plus',     price: `${formatPriceAmount(PLAN_CONFIG.league.monthlyPrice)}/mo` },
  club:            { label: 'Club',            price: `${formatPriceAmount(PLAN_CONFIG.club.monthlyPrice)}/mo` },
};

const ORDER = ['tournament', 'team', 'tournament_plus', 'league', 'club'];

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(value));
}

export default function PlansClient({ rows }: { rows: PlanGatingRow[] }) {
  const [plans, setPlans] = useState<PlanGatingRow[]>(rows);
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function toggle(planKey: string, currentStatus: string) {
    const nextStatus = currentStatus === 'live' ? 'early_access' : 'live';
    setSaving(planKey);
    setErrors(e => ({ ...e, [planKey]: '' }));

    try {
      const res = await fetch('/api/platform-admin/plan-gating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey, gatingStatus: nextStatus }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Request failed');

      setPlans(prev =>
        prev.map(p =>
          p.plan_key === planKey
            ? { ...p, gating_status: nextStatus, updated_at: new Date().toISOString(), updated_by_email: null }
            : p
        )
      );
    } catch (err) {
      setErrors(e => ({ ...e, [planKey]: (err as Error).message }));
    } finally {
      setSaving(null);
    }
  }

  const sorted = [...plans].sort(
    (a, b) => ORDER.indexOf(a.plan_key) - ORDER.indexOf(b.plan_key)
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLabel}>Platform Admin</div>
        <h1 className={styles.title}>Plans</h1>
      </header>

      <p className={styles.desc}>
        Controls whether each plan is available for self-serve checkout or shows an early-access CTA on the pricing page.
        Changes take effect immediately on the next page request — no deploy required.
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Plan</th>
              <th>Price</th>
              <th>Status</th>
              <th>Last changed</th>
              <th>By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => {
              const meta = PLAN_META[row.plan_key] ?? { label: row.plan_key, price: '—' };
              const isLive = row.gating_status === 'live';
              const isBusy = saving === row.plan_key;

              return (
                <Fragment key={row.plan_key}>
                  <tr>
                    <td className={styles.planName}>{meta.label}</td>
                    <td className={styles.price}>{meta.price}</td>
                    <td>
                      <span className={isLive ? styles.badgeLive : styles.badgeGated}>
                        {isLive ? 'Live' : 'Early Access'}
                      </span>
                    </td>
                    <td className={styles.date}>{formatDate(row.updated_at)}</td>
                    <td className={styles.by}>{row.updated_by_email ?? '—'}</td>
                    <td className={styles.actionCell}>
                      <button
                        className={isLive ? styles.deactivateBtn : styles.activateBtn}
                        onClick={() => toggle(row.plan_key, row.gating_status)}
                        disabled={isBusy}
                      >
                        {isBusy
                          ? <Loader size={12} className={styles.spin} />
                          : isLive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                  {errors[row.plan_key] && (
                    <tr className={styles.errorRow}>
                      <td colSpan={6} className={styles.errorCell}>{errors[row.plan_key]}</td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
