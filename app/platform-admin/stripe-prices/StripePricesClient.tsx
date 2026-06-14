'use client';

import { Fragment, useState } from 'react';
import { Loader, Check, X } from 'lucide-react';
import type { StripePriceRow } from '@/lib/stripe-prices';
import styles from './stripe-prices.module.css';

const PLAN_LABELS: Record<string, string> = {
  team:            'Team',
  tournament_plus: 'Tournament Plus',
  league:          'League Plus',
  club:            'Club',
  org_team_addon:  'Org Team Add-on',
  rep_team:        'Club Extra Rep Team',
};

const PLAN_ORDER = ['team', 'tournament_plus', 'league', 'club', 'org_team_addon', 'rep_team'];

function sortRows(rows: StripePriceRow[]): StripePriceRow[] {
  return [...rows].sort((a, b) => {
    if (a.environment !== b.environment) return a.environment === 'sandbox' ? -1 : 1;
    const pa = PLAN_ORDER.indexOf(a.plan_id);
    const pb = PLAN_ORDER.indexOf(b.plan_id);
    if (pa !== pb) return pa - pb;
    return a.billing_cycle === 'monthly' ? -1 : 1;
  });
}

export default function StripePricesClient({ rows: initial }: { rows: StripePriceRow[] }) {
  const [rows, setRows]         = useState<StripePriceRow[]>(sortRows(initial));
  const [editing, setEditing]   = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState<string | null>(null);
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [saved, setSaved]       = useState<Record<string, boolean>>({});

  function startEdit(row: StripePriceRow) {
    setEditing(e => ({ ...e, [row.id]: e[row.id] ?? (row.price_id ?? '') }));
    setSaved(s => ({ ...s, [row.id]: false }));
    setErrors(e => ({ ...e, [row.id]: '' }));
  }

  function cancelEdit(id: string) {
    setEditing(e => { const next = { ...e }; delete next[id]; return next; });
    setErrors(e => ({ ...e, [id]: '' }));
  }

  async function save(row: StripePriceRow) {
    const price_id = (editing[row.id] ?? '').trim();
    setSaving(row.id);
    setErrors(e => ({ ...e, [row.id]: '' }));

    try {
      const res = await fetch('/api/platform-admin/stripe-prices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, price_id: price_id || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');

      setRows(prev =>
        sortRows(prev.map(r => r.id === row.id ? { ...r, price_id: price_id || null } : r))
      );
      setEditing(e => { const next = { ...e }; delete next[row.id]; return next; });
      setSaved(s => ({ ...s, [row.id]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [row.id]: false })), 2000);
    } catch (err) {
      setErrors(e => ({ ...e, [row.id]: (err as Error).message }));
    } finally {
      setSaving(null);
    }
  }

  const sandboxRows = rows.filter(r => r.environment === 'sandbox');
  const liveRows    = rows.filter(r => r.environment === 'live');

  function renderSection(sectionRows: StripePriceRow[], env: 'sandbox' | 'live') {
    return (
      <>
        <tr className={styles.envHeaderRow}>
          <td colSpan={5}>
            <span className={env === 'sandbox' ? styles.badgeSandbox : styles.badgeLive}>
              {env === 'sandbox' ? 'Sandbox (Test Mode)' : 'Live Mode'}
            </span>
          </td>
        </tr>
        {sectionRows.map(row => {
          const isEditing = row.id in editing;
          const isBusy    = saving === row.id;
          const isSaved   = saved[row.id];
          const val       = editing[row.id] ?? (row.price_id ?? '');

          return (
            <Fragment key={row.id}>
              <tr className={styles.row} onClick={() => !isEditing && startEdit(row)}>
                <td className={styles.planName}>{PLAN_LABELS[row.plan_id] ?? row.plan_id}</td>
                <td className={styles.cycle}>
                  {row.billing_cycle.charAt(0).toUpperCase() + row.billing_cycle.slice(1)}
                </td>
                <td className={styles.productName}>{row.product_name ?? '—'}</td>
                <td className={styles.priceIdCell}>
                  {isEditing ? (
                    <input
                      autoFocus
                      className={styles.priceInput}
                      value={val}
                      placeholder="price_..."
                      onChange={e => setEditing(prev => ({ ...prev, [row.id]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') save(row);
                        if (e.key === 'Escape') cancelEdit(row.id);
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className={row.price_id ? styles.priceIdSet : styles.priceIdEmpty}>
                      {row.price_id ?? 'Not set — click to edit'}
                    </span>
                  )}
                </td>
                <td className={styles.actionCell} onClick={e => e.stopPropagation()}>
                  {isEditing ? (
                    <span className={styles.actionBtns}>
                      <button
                        className={styles.saveBtn}
                        onClick={() => save(row)}
                        disabled={isBusy}
                        title="Save"
                      >
                        {isBusy ? <Loader size={12} className={styles.spin} /> : <Check size={12} />}
                      </button>
                      <button
                        className={styles.cancelBtn}
                        onClick={() => cancelEdit(row.id)}
                        disabled={isBusy}
                        title="Cancel"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ) : isSaved ? (
                    <span className={styles.savedLabel}>Saved</span>
                  ) : (
                    <button className={styles.editBtn} onClick={() => startEdit(row)}>
                      Edit
                    </button>
                  )}
                </td>
              </tr>
              {errors[row.id] && (
                <tr className={styles.errorRow}>
                  <td colSpan={5} className={styles.errorCell}>{errors[row.id]}</td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLabel}>Platform Admin</div>
        <h1 className={styles.title}>Stripe Prices</h1>
      </header>

      <p className={styles.desc}>
        Stripe price IDs for each plan, billing cycle, and environment. Click any row to edit its
        price ID. Changes take effect immediately — no redeploy required.
        Price IDs are created in the Stripe Dashboard (Sandbox for testing, Live for production).
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Plan</th>
              <th>Cycle</th>
              <th>Product Name</th>
              <th>Price ID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {renderSection(sandboxRows, 'sandbox')}
            {renderSection(liveRows, 'live')}
          </tbody>
        </table>
      </div>
    </div>
  );
}
