'use client';
import { useState } from 'react';
import { useOrg } from '@/lib/org-context';

const PLANS = ['starter', 'pro', 'elite'] as const;

export default function DevPlanSwitcher() {
  const { currentOrg, refresh } = useOrg();
  const [loading, setLoading] = useState(false);

  async function switchPlan(plan: string) {
    if (loading || currentOrg?.planId === plan) return;
    setLoading(true);
    try {
      await fetch('/api/dev/set-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  const current = currentOrg?.planId ?? 'starter';

  return (
    <div style={{
      position: 'fixed',
      bottom: '5rem',
      right: '1rem',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '0.4rem',
      pointerEvents: 'none',
    }}>
      <span style={{
        fontSize: '0.65rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,0,0.7)',
        background: 'rgba(0,0,0,0.7)',
        padding: '0.15rem 0.4rem',
        borderRadius: '4px',
      }}>
        DEV — Plan
      </span>
      <div style={{
        display: 'flex',
        gap: '0.3rem',
        background: 'rgba(0,0,0,0.85)',
        border: '1px solid rgba(255,255,0,0.35)',
        borderRadius: '8px',
        padding: '0.3rem',
        pointerEvents: 'auto',
      }}>
        {PLANS.map(plan => (
          <button
            key={plan}
            onClick={() => switchPlan(plan)}
            disabled={loading}
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.25rem 0.6rem',
              borderRadius: '5px',
              border: 'none',
              cursor: loading ? 'wait' : current === plan ? 'default' : 'pointer',
              textTransform: 'capitalize',
              background: current === plan ? 'rgba(255,255,0,0.85)' : 'rgba(255,255,255,0.08)',
              color: current === plan ? '#000' : 'rgba(255,255,255,0.7)',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {plan}
          </button>
        ))}
      </div>
    </div>
  );
}
