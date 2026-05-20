'use client';

import { Fragment, useState } from 'react';
import { Loader, Check, X } from 'lucide-react';
import type { PlanConfigOverrideRow } from '@/lib/plan-config-db';
import type { StripePriceRow } from '@/lib/stripe-prices';
import styles from './plans-pricing.module.css';

type Tab = 'availability' | 'limits' | 'prices';

const TABS: { id: Tab; label: string }[] = [
  { id: 'availability', label: 'Availability'    },
  { id: 'limits',       label: 'Limits & Trials' },
  { id: 'prices',       label: 'Stripe Prices'   },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanGatingRow {
  plan_key: string;
  gating_status: string;
  updated_at: string | null;
  updated_by_email: string | null;
}

interface PlanDefault {
  tournamentLimit: number;
  seatLimit: number;
  trialDays: number;
}

interface Props {
  initialGating: PlanGatingRow[];
  initialConfig: PlanConfigOverrideRow[];
  configDefaults: Record<string, PlanDefault>;
  initialPrices: StripePriceRow[];
}

type ConfigDraft = {
  tournament_limit: string;
  seat_limit: string;
  trial_days: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_ORDER = ['tournament', 'tournament_plus', 'league', 'club'];

const PLAN_META: Record<string, { label: string; price: string }> = {
  tournament:      { label: 'Tournament',      price: 'Free'    },
  tournament_plus: { label: 'Tournament Plus', price: '$39/mo'  },
  league:          { label: 'League',          price: '$89/mo'  },
  club:            { label: 'Club',            price: '$179/mo' },
};

const PRICE_PLAN_LABELS: Record<string, string> = {
  tournament_plus: 'Tournament Plus',
  league:          'League',
  club:            'Club',
  rep_team:        'Additional Rep Team',
};

const PRICE_PLAN_ORDER = ['tournament_plus', 'league', 'club', 'rep_team'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sortPriceRows(rows: StripePriceRow[]): StripePriceRow[] {
  return [...rows].sort((a, b) => {
    if (a.environment !== b.environment) return a.environment === 'sandbox' ? -1 : 1;
    const pa = PRICE_PLAN_ORDER.indexOf(a.plan_id);
    const pb = PRICE_PLAN_ORDER.indexOf(b.plan_id);
    if (pa !== pb) return pa - pb;
    return a.billing_cycle === 'monthly' ? -1 : 1;
  });
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(value));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlansPricingClient({
  initialGating,
  initialConfig,
  configDefaults,
  initialPrices,
}: Props) {

  // ── Tab state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('availability');

  // ── Panel 1: Plan Availability ──────────────────────────────────────────────
  const [gatingRows, setGatingRows] = useState<PlanGatingRow[]>(initialGating);
  const [gatingBusy, setGatingBusy] = useState<string | null>(null);
  const [gatingErrors, setGatingErrors] = useState<Record<string, string>>({});

  async function toggleGating(planKey: string, currentStatus: string) {
    const nextStatus = currentStatus === 'live' ? 'early_access' : 'live';
    setGatingBusy(planKey);
    setGatingErrors(e => ({ ...e, [planKey]: '' }));
    try {
      const res = await fetch('/api/platform-admin/plan-gating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey, gatingStatus: nextStatus }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Request failed');
      setGatingRows(prev => prev.map(r =>
        r.plan_key === planKey
          ? { ...r, gating_status: nextStatus, updated_at: new Date().toISOString(), updated_by_email: null }
          : r
      ));
    } catch (err) {
      setGatingErrors(e => ({ ...e, [planKey]: (err as Error).message }));
    } finally {
      setGatingBusy(null);
    }
  }

  const sortedGating = [...gatingRows].sort(
    (a, b) => PLAN_ORDER.indexOf(a.plan_key) - PLAN_ORDER.indexOf(b.plan_key)
  );

  // ── Panel 2: Plan Limits & Trials ───────────────────────────────────────────
  const [configRows, setConfigRows] = useState<PlanConfigOverrideRow[]>(initialConfig);
  const [configEditPlan, setConfigEditPlan] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState<ConfigDraft | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState('');
  const [configSaved, setConfigSaved] = useState<string | null>(null);

  function getConfigRow(planId: string) {
    return configRows.find(r => r.plan_id === planId);
  }

  function startConfigEdit(planId: string) {
    const row = getConfigRow(planId);
    setConfigEditPlan(planId);
    setConfigDraft({
      tournament_limit: row?.tournament_limit != null ? String(row.tournament_limit) : '',
      seat_limit:       row?.seat_limit       != null ? String(row.seat_limit)       : '',
      trial_days:       row?.trial_days       != null ? String(row.trial_days)       : '',
    });
    setConfigError('');
    setConfigSaved(null);
  }

  function cancelConfigEdit() {
    setConfigEditPlan(null);
    setConfigDraft(null);
    setConfigError('');
  }

  async function saveConfig(planId: string) {
    if (!configDraft) return;
    setConfigSaving(true);
    setConfigError('');

    const parsedTournamentLimit = configDraft.tournament_limit.trim() === ''
      ? null : parseInt(configDraft.tournament_limit, 10);
    const parsedSeatLimit = configDraft.seat_limit.trim() === ''
      ? null : parseInt(configDraft.seat_limit, 10);
    const parsedTrialDays = configDraft.trial_days.trim() === ''
      ? null : parseInt(configDraft.trial_days, 10);

    try {
      const res = await fetch('/api/platform-admin/plan-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id:          planId,
          tournament_limit: parsedTournamentLimit,
          seat_limit:       parsedSeatLimit,
          trial_days:       parsedTrialDays,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');

      const now = new Date().toISOString();
      setConfigRows(prev => {
        const exists = prev.some(r => r.plan_id === planId);
        if (exists) {
          return prev.map(r => r.plan_id === planId
            ? { ...r, tournament_limit: parsedTournamentLimit, seat_limit: parsedSeatLimit, trial_days: parsedTrialDays, updated_at: now }
            : r
          );
        }
        return [...prev, {
          id:               '',
          plan_id:          planId,
          tournament_limit: parsedTournamentLimit,
          seat_limit:       parsedSeatLimit,
          trial_days:       parsedTrialDays,
          updated_at:       now,
          updated_by_email: null,
        }];
      });

      setConfigEditPlan(null);
      setConfigDraft(null);
      setConfigSaved(planId);
      setTimeout(() => setConfigSaved(s => s === planId ? null : s), 2000);
    } catch (err) {
      setConfigError((err as Error).message);
    } finally {
      setConfigSaving(false);
    }
  }

  // ── Panel 3: Stripe Price IDs ───────────────────────────────────────────────
  const [priceRows, setPriceRows] = useState<StripePriceRow[]>(() => sortPriceRows(initialPrices));
  const [priceEditing, setPriceEditing] = useState<Record<string, string>>({});
  const [priceSaving, setPriceSaving] = useState<string | null>(null);
  const [priceErrors, setPriceErrors] = useState<Record<string, string>>({});
  const [priceSaved, setPriceSaved] = useState<Record<string, boolean>>({});

  function startPriceEdit(row: StripePriceRow) {
    setPriceEditing(e => ({ ...e, [row.id]: e[row.id] ?? (row.price_id ?? '') }));
    setPriceSaved(s => ({ ...s, [row.id]: false }));
    setPriceErrors(e => ({ ...e, [row.id]: '' }));
  }

  function cancelPriceEdit(id: string) {
    setPriceEditing(e => { const next = { ...e }; delete next[id]; return next; });
    setPriceErrors(e => ({ ...e, [id]: '' }));
  }

  async function savePrice(row: StripePriceRow) {
    const price_id = (priceEditing[row.id] ?? '').trim();
    setPriceSaving(row.id);
    setPriceErrors(e => ({ ...e, [row.id]: '' }));
    try {
      const res = await fetch('/api/platform-admin/stripe-prices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, price_id: price_id || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed');
      setPriceRows(prev => sortPriceRows(prev.map(r =>
        r.id === row.id ? { ...r, price_id: price_id || null } : r
      )));
      setPriceEditing(e => { const next = { ...e }; delete next[row.id]; return next; });
      setPriceSaved(s => ({ ...s, [row.id]: true }));
      setTimeout(() => setPriceSaved(s => ({ ...s, [row.id]: false })), 2000);
    } catch (err) {
      setPriceErrors(e => ({ ...e, [row.id]: (err as Error).message }));
    } finally {
      setPriceSaving(null);
    }
  }

  const sandboxPriceRows = priceRows.filter(r => r.environment === 'sandbox');
  const livePriceRows    = priceRows.filter(r => r.environment === 'live');

  function renderPriceEnvSection(sectionRows: StripePriceRow[], env: 'sandbox' | 'live') {
    return (
      <>
        <tr className={styles.envHeaderRow}>
          <td colSpan={5}>
            <span className={env === 'sandbox' ? styles.badgeSandbox : styles.badgeLiveEnv}>
              {env === 'sandbox' ? 'Sandbox (Test Mode)' : 'Live Mode'}
            </span>
          </td>
        </tr>
        {sectionRows.map(row => {
          const isEditing = row.id in priceEditing;
          const isBusy    = priceSaving === row.id;
          const isSaved   = priceSaved[row.id];
          const val       = priceEditing[row.id] ?? (row.price_id ?? '');

          return (
            <Fragment key={row.id}>
              <tr className={styles.row} onClick={() => !isEditing && startPriceEdit(row)}>
                <td className={styles.planName}>{PRICE_PLAN_LABELS[row.plan_id] ?? row.plan_id}</td>
                <td className={styles.muted}>
                  {row.billing_cycle.charAt(0).toUpperCase() + row.billing_cycle.slice(1)}
                </td>
                <td className={styles.muted}>{row.product_name ?? '—'}</td>
                <td className={styles.priceIdCell}>
                  {isEditing ? (
                    <input
                      autoFocus
                      className={styles.priceInput}
                      value={val}
                      placeholder="price_..."
                      onChange={e => setPriceEditing(prev => ({ ...prev, [row.id]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter')  savePrice(row);
                        if (e.key === 'Escape') cancelPriceEdit(row.id);
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
                      <button className={styles.saveBtn} onClick={() => savePrice(row)} disabled={isBusy} title="Save">
                        {isBusy ? <Loader size={12} className={styles.spin} /> : <Check size={12} />}
                      </button>
                      <button className={styles.cancelBtn} onClick={() => cancelPriceEdit(row.id)} disabled={isBusy} title="Cancel">
                        <X size={12} />
                      </button>
                    </span>
                  ) : isSaved ? (
                    <span className={styles.savedLabel}>Saved</span>
                  ) : (
                    <button className={styles.editBtn} onClick={() => startPriceEdit(row)}>Edit</button>
                  )}
                </td>
              </tr>
              {priceErrors[row.id] && (
                <tr className={styles.errorRow}>
                  <td colSpan={5} className={styles.errorCell}>{priceErrors[row.id]}</td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.headerLabel}>Platform Admin</div>
        <h1 className={styles.title}>Plans &amp; Pricing</h1>
      </header>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <nav className={styles.tabBar}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Section 1: Plan Availability ──────────────────────────────────── */}
      <section className={styles.section} hidden={activeTab !== 'availability'}>
        <p className={styles.sectionDesc}>
          Controls whether each plan is available for self-serve checkout or shows an early-access CTA.
          Changes take effect immediately — no redeploy required.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Price</th>
                <th>Status</th>
                <th>Last Changed</th>
                <th>By</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedGating.map(row => {
                const meta   = PLAN_META[row.plan_key] ?? { label: row.plan_key, price: '—' };
                const isLive = row.gating_status === 'live';
                const isBusy = gatingBusy === row.plan_key;
                return (
                  <Fragment key={row.plan_key}>
                    <tr>
                      <td className={styles.planName}>{meta.label}</td>
                      <td className={styles.muted}>{meta.price}</td>
                      <td>
                        <span className={isLive ? styles.badgeLive : styles.badgeGated}>
                          {isLive ? 'Live' : 'Early Access'}
                        </span>
                      </td>
                      <td className={styles.muted}>{formatDate(row.updated_at)}</td>
                      <td className={styles.muted}>{row.updated_by_email ?? '—'}</td>
                      <td className={styles.actionCell}>
                        <button
                          className={isLive ? styles.deactivateBtn : styles.activateBtn}
                          onClick={() => toggleGating(row.plan_key, row.gating_status)}
                          disabled={isBusy}
                        >
                          {isBusy
                            ? <Loader size={12} className={styles.spin} />
                            : isLive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                    {gatingErrors[row.plan_key] && (
                      <tr className={styles.errorRow}>
                        <td colSpan={6} className={styles.errorCell}>{gatingErrors[row.plan_key]}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 2: Plan Limits & Trials ───────────────────────────────── */}
      <section className={styles.section} hidden={activeTab !== 'limits'}>
        <p className={styles.sectionDesc}>
          Override per-plan tournament slots, seat caps, and free trial lengths. Leave a field blank
          to use the code default (shown as placeholder text). Changes take effect on the next
          checkout or limit check — no redeploy required.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Tournament Limit</th>
                <th>Seat Limit</th>
                <th>Trial Days</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {PLAN_ORDER.map(planId => {
                const row       = getConfigRow(planId);
                const defaults  = configDefaults[planId];
                const meta      = PLAN_META[planId];
                const isEditing = configEditPlan === planId;
                const isBusy    = isEditing && configSaving;
                const isSaved   = configSaved === planId;

                return (
                  <Fragment key={planId}>
                    <tr
                      className={isEditing ? undefined : styles.row}
                      onClick={() => !isEditing && startConfigEdit(planId)}
                    >
                      <td className={styles.planName}>{meta?.label ?? planId}</td>

                      {/* Tournament Limit */}
                      <td>
                        {isEditing ? (
                          <input
                            autoFocus
                            type="number"
                            min={0}
                            className={styles.numInput}
                            value={configDraft?.tournament_limit ?? ''}
                            placeholder={defaults ? String(defaults.tournamentLimit) : ''}
                            onChange={e => setConfigDraft(d => d ? { ...d, tournament_limit: e.target.value } : d)}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <span className={row?.tournament_limit != null ? styles.numValue : styles.numEmpty}>
                            {row?.tournament_limit != null ? row.tournament_limit : '—'}
                          </span>
                        )}
                      </td>

                      {/* Seat Limit */}
                      <td>
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            className={styles.numInput}
                            value={configDraft?.seat_limit ?? ''}
                            placeholder={defaults ? String(defaults.seatLimit) : ''}
                            onChange={e => setConfigDraft(d => d ? { ...d, seat_limit: e.target.value } : d)}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <span className={row?.seat_limit != null ? styles.numValue : styles.numEmpty}>
                            {row?.seat_limit != null ? row.seat_limit : '—'}
                          </span>
                        )}
                      </td>

                      {/* Trial Days */}
                      <td>
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            className={styles.numInput}
                            value={configDraft?.trial_days ?? ''}
                            placeholder={defaults ? String(defaults.trialDays) : ''}
                            onChange={e => setConfigDraft(d => d ? { ...d, trial_days: e.target.value } : d)}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <span className={row?.trial_days != null ? styles.numValue : styles.numEmpty}>
                            {row?.trial_days != null ? row.trial_days : '—'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className={styles.actionCell} onClick={e => e.stopPropagation()}>
                        {isEditing ? (
                          <span className={styles.actionBtns}>
                            <button
                              className={styles.saveBtn}
                              onClick={() => saveConfig(planId)}
                              disabled={isBusy}
                              title="Save"
                            >
                              {isBusy ? <Loader size={12} className={styles.spin} /> : <Check size={12} />}
                            </button>
                            <button
                              className={styles.cancelBtn}
                              onClick={cancelConfigEdit}
                              disabled={isBusy}
                              title="Cancel"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ) : isSaved ? (
                          <span className={styles.savedLabel}>Saved</span>
                        ) : (
                          <button className={styles.editBtn} onClick={() => startConfigEdit(planId)}>
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Inline error for config panel */}
                    {isEditing && configError && (
                      <tr className={styles.errorRow}>
                        <td colSpan={5} className={styles.errorCell}>{configError}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 3: Stripe Price IDs ───────────────────────────────────── */}
      <section className={styles.section} hidden={activeTab !== 'prices'}>
        <p className={styles.sectionDesc}>
          Stripe price IDs for each plan, billing cycle, and environment. Click any row to edit its
          price ID. Changes take effect immediately — no redeploy required. Price IDs are created in
          the Stripe Dashboard (Sandbox for testing, Live for production).
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
              {renderPriceEnvSection(sandboxPriceRows, 'sandbox')}
              {renderPriceEnvSection(livePriceRows,    'live')}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}