'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader } from 'lucide-react';
import type { BulkOperationRow, BulkOrgRow } from './page';
import { fmtAbsoluteDate } from '@/lib/format-date';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import kit from '../console.module.css';
import { SUBSCRIPTION_STATUS_LABELS, humanize } from '../chips';
import styles from './bulk-operations.module.css';
import DateInput from '@/components/shared/DateInput';
import { formatLongDay, lastDayRefusal } from '@/lib/free-time';

type BulkActionType = 'subscription_status_override' | 'plan_change' | 'module_addon_enablement';
type ModuleOperation = 'enable' | 'disable';

type ApplyResult = {
  orgId: string;
  name: string;
  slug: string;
  ok: boolean;
  skipped?: boolean;
  message: string;
};

/** The days a billing status override may run through, for this role (free time's caps, owner Q7). */
type FreeThroughBounds = { earliest: string; latest: string; role: string };

const PLAN_LABELS: Record<string, string> = {
  tournament: 'Tournament',
  team: 'Coaches Portal',
  tournament_plus: 'Tournament Plus',
  league: 'League Plus',
  club: 'Club',
  club_large: 'Club · Association',
};

const ACTION_LABELS: Record<BulkActionType, string> = {
  subscription_status_override: 'Billing status override',
  plan_change: 'Plan change',
  module_addon_enablement: 'Extra feature',
};

const PLANS = ['tournament', 'team', 'tournament_plus', 'league', 'club', 'club_large'];
const STATUSES = ['active', 'trialing', 'past_due', 'canceled'];
const MODULE_OPTIONS = [
  { value: 'module_public_site', label: 'Public site' },
  { value: 'module_house_league', label: 'House league' },
  { value: 'module_accounting', label: 'Accounting' },
  { value: 'module_rep_teams', label: 'Rep teams' },
];
const MODULE_OPERATION_LABELS: Record<ModuleOperation, string> = {
  enable: 'Enable',
  disable: 'Remove',
};

const formatDate = (value: string | null | undefined) => fmtAbsoluteDate(value, 'Not set');

function statusChip(status: string) {
  if (status === 'completed' || status === 'active') return kit.chipOk;
  if (status === 'partial_failed' || status === 'past_due' || status === 'trialing') return kit.chipWarn;
  return kit.chipQuiet;
}

export default function BulkOperationsClient({
  orgs,
  recentOperations,
  canManageBilling,
  canManageProduct,
  freeThrough,
}: {
  orgs: BulkOrgRow[];
  recentOperations: BulkOperationRow[];
  canManageBilling: boolean;
  canManageProduct: boolean;
  freeThrough: FreeThroughBounds;
}) {
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionType, setActionType] = useState<BulkActionType>('subscription_status_override');
  const [targetStatus, setTargetStatus] = useState('active');
  const [targetPlan, setTargetPlan] = useState('tournament_plus');
  const [targetModule, setTargetModule] = useState(MODULE_OPTIONS[0].value);
  const [moduleOperation, setModuleOperation] = useState<ModuleOperation>('enable');
  const [lastDay, setLastDay] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [results, setResults] = useState<ApplyResult[]>([]);
  const [operations, setOperations] = useState(recentOperations);

  const filteredOrgs = useMemo(() => orgs.filter(org => {
    if (search) {
      const q = search.toLowerCase();
      if (!org.name.toLowerCase().includes(q) && !org.slug.toLowerCase().includes(q)) return false;
    }
    if (planFilter && org.planId !== planFilter) return false;
    if (statusFilter && org.subscriptionStatus !== statusFilter) return false;
    return true;
  }), [orgs, planFilter, search, statusFilter]);

  const selectedOrgs = useMemo(
    () => orgs.filter(org => selectedIds.includes(org.id)),
    [orgs, selectedIds],
  );

  const selectedFilteredIds = filteredOrgs
    .filter(org => selectedIds.includes(org.id))
    .map(org => org.id);
  const allFilteredSelected = filteredOrgs.length > 0 && selectedFilteredIds.length === filteredOrgs.length;
  const canApplySelectedAction = actionType === 'module_addon_enablement' ? canManageProduct : canManageBilling;
  const moduleLabel = MODULE_OPTIONS.find(module => module.value === targetModule)?.label ?? targetModule;

  const previewCopy = actionType === 'subscription_status_override'
    ? `Billing status reads ${SUBSCRIPTION_STATUS_LABELS[targetStatus] ?? targetStatus}${lastDay ? ` through ${formatLongDay(lastDay)}` : ''}. The club's real billing is unchanged.`
    : actionType === 'module_addon_enablement'
      ? `${MODULE_OPERATION_LABELS[moduleOperation]} ${moduleLabel} as an extra feature for these organizations only.`
      : `Change base plan to ${PLAN_LABELS[targetPlan] ?? targetPlan}.`;

  function toggleOrg(id: string) {
    setSelectedIds(ids => ids.includes(id)
      ? ids.filter(item => item !== id)
      : [...ids, id]);
    setConfirming(false);
  }

  function toggleFilteredSelection() {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredOrgs.map(org => org.id));
      setSelectedIds(ids => ids.filter(id => !filteredIds.has(id)));
    } else {
      setSelectedIds(ids => Array.from(new Set([...ids, ...filteredOrgs.map(org => org.id)])));
    }
    setConfirming(false);
  }

  function resetAfterApply() {
    setSelectedIds([]);
    setReason('');
    setConfirming(false);
  }

  async function applyBulkOperation() {
    setError('');
    setSaved('');
    setResults([]);

    if (!canApplySelectedAction) {
      setError(actionType === 'module_addon_enablement'
        ? 'Your role cannot run bulk product operations.'
        : 'Your role cannot run bulk billing operations.');
      return;
    }
    if (selectedIds.length === 0) {
      setError('Select at least one organization.');
      return;
    }
    if (!reason.trim()) {
      setError('Reason is required.');
      return;
    }
    if (actionType === 'module_addon_enablement' && !targetModule) {
      setError('Choose an extra feature.');
      return;
    }
    if (actionType === 'subscription_status_override' && !lastDay) {
      setError('Choose the last free day.');
      return;
    }
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/platform-admin/bulk-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: actionType,
          org_ids: selectedIds,
          target_status: targetStatus,
          target_plan: targetPlan,
          target_module: targetModule,
          module_operation: moduleOperation,
          last_day: actionType === 'subscription_status_override' ? lastDay : null,
          reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Bulk operation failed');

      setResults(json.results ?? []);
      setOperations(prev => [json.operation, ...prev].slice(0, 8));
      const applied: ApplyResult[] = json.results ?? [];
      const skipped = applied.filter(r => r.skipped).length;
      setSaved(`${json.operation.success_count} succeeded / ${json.operation.failure_count - skipped} failed${skipped ? ` / ${skipped} skipped` : ''}`);
      resetAfterApply();
    } catch (err) {
      setError((err as Error).message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={kit.page}>
      <AdminPageHeader title="Bulk changes" />

      <p className={kit.caption}>
        Select organizations, preview the impact, add a reason, then confirm the guarded operation.
      </p>

      <section className={kit.band} aria-label="Bulk operations snapshot">
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Total accounts</span>
          <strong className={kit.bandValue}>{orgs.length}</strong>
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Filtered</span>
          <strong className={kit.bandValue}>{filteredOrgs.length}</strong>
        </div>
        <div className={`${kit.bandCell} ${selectedIds.length > 0 ? kit.bandGood : ''}`}>
          <span className={kit.bandLabel}>Selected</span>
          <strong className={kit.bandValue}>{selectedIds.length}</strong>
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Recent batches</span>
          <strong className={kit.bandValue}>{operations.length}</strong>
        </div>
      </section>

      {(!canManageBilling || !canManageProduct) && (
        <div className={kit.callout}>
          Bulk billing actions require billing access. Extra feature actions require product access.
        </div>
      )}

      {(error || saved) && (
        <div className={`${kit.notice} ${error ? kit.noticeBad : kit.noticeGood}`}>
          {error || saved}
        </div>
      )}

      <div className={styles.workspace}>
        <div className={styles.column}>
          <section className={kit.section}>
            <h2 className={kit.sectionTitle}><span className={styles.step}>1</span>Choose accounts</h2>
            <div className={kit.card}>
              <div className={kit.toolbar}>
                <input
                  className={`${kit.search} ${styles.toolSearch}`}
                  type="search"
                  placeholder="Search account or slug..."
                  aria-label="Search accounts"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                />
                <select className={kit.select} aria-label="Plan" value={planFilter} onChange={event => setPlanFilter(event.target.value)}>
                  <option value="">All plans</option>
                  {PLANS.map(plan => <option key={plan} value={plan}>{PLAN_LABELS[plan]}</option>)}
                </select>
                <select className={kit.select} aria-label="Status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                  <option value="">All statuses</option>
                  {STATUSES.map(status => <option key={status} value={status}>{SUBSCRIPTION_STATUS_LABELS[status]}</option>)}
                </select>
                <span className={kit.toolbarEnd}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={toggleFilteredSelection}>
                    {allFilteredSelected ? 'Clear filtered' : 'Select filtered'}
                  </button>
                </span>
              </div>

              <div className={`${kit.tableWrap} table-cards`}>
                <table className={kit.comfortable}>
                  <thead>
                    <tr>
                      <th aria-label="Select"></th>
                      <th>Account</th>
                      <th>Plan</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrgs.length === 0 ? (
                      <tr><td colSpan={4} className={kit.empty}>No accounts match this filter.</td></tr>
                    ) : filteredOrgs.map(org => (
                      <tr key={org.id}>
                        <td data-label="Select">
                          <input
                            type="checkbox"
                            className={styles.rowCheck}
                            checked={selectedIds.includes(org.id)}
                            onChange={() => toggleOrg(org.id)}
                            aria-label={`Select ${org.name}`}
                          />
                        </td>
                        <td className="table-cards-title">
                          <Link href={`/platform-admin/orgs/${org.id}`} className={kit.nameLink}>{org.name}</Link>
                          <span className={`${kit.sub} ${kit.code}`}>{org.slug}</span>
                        </td>
                        <td data-label="Plan" className={kit.nowrap}>{PLAN_LABELS[org.planId] ?? org.planId}</td>
                        <td data-label="Status"><span className={`${kit.chip} ${statusChip(org.subscriptionStatus)}`}>{SUBSCRIPTION_STATUS_LABELS[org.subscriptionStatus] ?? org.subscriptionStatus}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        <div className={styles.column}>
          <section className={kit.section}>
            <h2 className={kit.sectionTitle}><span className={styles.step}>2</span>Configure action</h2>
            <div className={`${kit.card} ${kit.cardPad} ${styles.form}`}>
            <label className={kit.fieldGroup}>
              <span className={kit.label}>Bulk action</span>
              <select
                className={`${kit.select} ${kit.wide}`}
                value={actionType}
                onChange={event => {
                  setActionType(event.target.value as BulkActionType);
                  setConfirming(false);
                }}
              >
                <option value="subscription_status_override">Billing status override</option>
                <option value="plan_change">Plan change</option>
                <option value="module_addon_enablement" disabled={!canManageProduct}>
                  Extra feature access{canManageProduct ? '' : ' (requires product access)'}
                </option>
              </select>
            </label>

            {actionType === 'subscription_status_override' && (
              <label className={kit.fieldGroup}>
                <span className={kit.label}>Billing status</span>
                <select className={`${kit.select} ${kit.wide}`} value={targetStatus} onChange={event => setTargetStatus(event.target.value)}>
                  {STATUSES.map(status => <option key={status} value={status}>{SUBSCRIPTION_STATUS_LABELS[status]}</option>)}
                </select>
              </label>
            )}

            {actionType === 'plan_change' && (
              <>
                <label className={kit.fieldGroup}>
                  <span className={kit.label}>Target plan</span>
                  <select className={`${kit.select} ${kit.wide}`} value={targetPlan} onChange={event => setTargetPlan(event.target.value)}>
                    {PLANS.map(plan => <option key={plan} value={plan}>{PLAN_LABELS[plan]}</option>)}
                  </select>
                </label>
                <div className={styles.note}>
                  <p>
                    <strong>This changes access only — not billing.</strong> A plan change here updates each
                    org&rsquo;s plan and resets its tournament limit to the new plan&rsquo;s default. It does{' '}
                    <strong>not</strong> touch Stripe — no charge, refund, proration, or cancellation. Any paid
                    org keeps billing at its old price and goes out of sync. Re-price each org from its own
                    Billing &amp; Access screen (downgrades, prorated) or the Stripe Dashboard (upgrades).
                  </p>
                  <p>
                    Each org gets exactly what its own plan change would do: moving onto Club starts its Club
                    trial (unless it is already paying or has had one) and ends a Founding Season comp; a custom
                    team limit set for the old plan is cleared; a cancelled org brought back is restored; and
                    tournaments over the new limit are archived. Each org&rsquo;s result line says which of
                    these happened.
                  </p>
                  {targetPlan === 'tournament' && (
                    <p>
                      🛑 For orgs with a live subscription, setting them to free will <strong>not</strong> stop
                      Stripe billing — it unlinks the subscription from our records while the real one keeps
                      charging, and it can no longer be cancelled from here afterward. Cancel each subscription
                      first (per-org <strong>Cancel Subscription</strong>) or in the Stripe Dashboard.
                    </p>
                  )}
                </div>
              </>
            )}

            {actionType === 'module_addon_enablement' && (
              <>
                <label className={kit.fieldGroup}>
                  <span className={kit.label}>Extra feature</span>
                  <select
                    className={`${kit.select} ${kit.wide}`}
                    value={targetModule}
                    onChange={event => {
                      setTargetModule(event.target.value);
                      setConfirming(false);
                    }}
                  >
                    {MODULE_OPTIONS.map(module => <option key={module.value} value={module.value}>{module.label}</option>)}
                  </select>
                </label>
                <label className={kit.fieldGroup}>
                  <span className={kit.label}>Operation</span>
                  <select
                    className={`${kit.select} ${kit.wide}`}
                    value={moduleOperation}
                    onChange={event => {
                      setModuleOperation(event.target.value as ModuleOperation);
                      setConfirming(false);
                    }}
                  >
                    <option value="enable">Turn on extra feature</option>
                    <option value="disable">Remove extra feature</option>
                  </select>
                </label>
              </>
            )}

            {actionType === 'subscription_status_override' && (
              <label className={kit.fieldGroup}>
                <span className={kit.label}>Free through<span className={kit.req} aria-hidden="true"> *</span></span>
                <DateInput
                  className={`${kit.field} ${kit.wide}`}
                  value={lastDay}
                  onChange={v => { setLastDay(v); setConfirming(false); }}
                  min={freeThrough.earliest}
                  max={freeThrough.latest}
                  aria-label="Free through"
                  required
                />
                {lastDay && lastDayRefusal(lastDay, freeThrough.role)
                  ? <span className={kit.fieldError}>{lastDayRefusal(lastDay, freeThrough.role)}</span>
                  : <span className={kit.hint}>The last day it applies; it ends that midnight, Eastern. A club you belong to is skipped.</span>}
              </label>
            )}

            <label className={kit.fieldGroup}>
              <span className={kit.label}>Reason<span className={kit.req} aria-hidden="true"> *</span></span>
              <textarea
                className={kit.textarea}
                value={reason}
                aria-required="true"
                placeholder="Required: explain why this bulk operation is being applied."
                onChange={event => {
                  setReason(event.target.value);
                  setConfirming(false);
                }}
              />
            </label>
            </div>
          </section>

          <section className={kit.section}>
            <h2 className={kit.sectionTitle}><span className={styles.step}>3</span>Preview and confirm</h2>
            <div className={`${kit.card} ${kit.cardPad} ${styles.form}`}>
            <div className={styles.preview}>
              <span className={kit.eye}>{ACTION_LABELS[actionType]}</span>
              <strong className={styles.previewCount}>{selectedOrgs.length} account{selectedOrgs.length === 1 ? '' : 's'}</strong>
              <p className={kit.caption}>{previewCopy}</p>
            </div>

            {selectedOrgs.length > 0 && (
              <div className={styles.selectedList}>
                {selectedOrgs.slice(0, 8).map(org => (
                  <div key={org.id}>
                    <span>{org.name}</span>
                    <small>
                      {actionType === 'module_addon_enablement'
                        ? `${moduleLabel}: ${org.enabledAddons.includes(targetModule) ? 'Currently enabled' : 'Not enabled'}`
                        : `${PLAN_LABELS[org.planId] ?? org.planId} / ${SUBSCRIPTION_STATUS_LABELS[org.subscriptionStatus] ?? org.subscriptionStatus}`}
                    </small>
                  </div>
                ))}
                {selectedOrgs.length > 8 && <div><span>{selectedOrgs.length - 8} more</span><small>Included in this operation</small></div>}
              </div>
            )}

            <button
              type="button"
              className={`btn btn-primary ${kit.wide}`}
              onClick={applyBulkOperation}
              disabled={busy || !canApplySelectedAction || selectedIds.length === 0}
            >
              {busy ? <Loader size={13} className={kit.spin} /> : confirming ? 'Confirm bulk operation' : 'Review bulk operation'}
            </button>
            </div>
          </section>
        </div>
      </div>

      {results.length > 0 && (
        <section className={kit.section}>
          <h2 className={kit.sectionTitle}>Latest operation</h2>
          <div className={`${kit.card} ${kit.cardPad} ${styles.resultGrid}`}>
            {results.map(result => (
              <div key={result.orgId} className={result.ok ? styles.resultOk : result.skipped ? styles.resultSkip : styles.resultFail}>
                <strong>{result.name}</strong>
                <span>{result.message}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={kit.section}>
        <h2 className={kit.sectionTitle}>Recent bulk operations</h2>
        <div className={kit.card}>
          <div className={`${kit.tableWrap} table-cards`}>
            <table className={kit.comfortable}>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Targets</th>
                  <th>Actor</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {operations.length === 0 ? (
                  <tr><td colSpan={5} className={kit.empty}>No bulk operations recorded yet.</td></tr>
                ) : operations.map(operation => (
                  <tr key={operation.id}>
                    <td className="table-cards-title">
                      {ACTION_LABELS[operation.action_type as BulkActionType] ?? operation.action_type}
                      <span className={kit.sub}>{operation.reason}</span>
                    </td>
                    <td data-label="Status"><span className={`${kit.chip} ${statusChip(operation.status)}`}>{humanize(operation.status)}</span></td>
                    <td data-label="Targets" className={kit.nowrap}>{operation.success_count} / {operation.target_count}</td>
                    <td data-label="Actor">{operation.created_by_email}</td>
                    <td data-label="Date" className={kit.nowrap}>{formatDate(operation.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.cardFoot}>
            <Link href="/platform-admin/audit?action=run_bulk_operation" className={kit.door}>View all bulk operations in Audit Log →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
