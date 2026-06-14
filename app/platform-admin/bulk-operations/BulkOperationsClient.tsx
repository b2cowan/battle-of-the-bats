'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader } from 'lucide-react';
import type { BulkOperationRow, BulkOrgRow } from './page';
import styles from './bulk-operations.module.css';

type BulkActionType = 'subscription_status_override' | 'comp_period' | 'plan_change' | 'module_addon_enablement';
type ModuleOperation = 'enable' | 'disable';

type ApplyResult = {
  orgId: string;
  name: string;
  slug: string;
  ok: boolean;
  message: string;
};

const PLAN_LABELS: Record<string, string> = {
  tournament: 'Tournament',
  team: 'Team',
  tournament_plus: 'Tournament Plus',
  league: 'League Plus',
  club: 'Club',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  trialing: 'Trialing',
  past_due: 'Past Due',
  canceled: 'Canceled',
};

const ACTION_LABELS: Record<BulkActionType, string> = {
  subscription_status_override: 'Subscription Status Override',
  comp_period: 'Comp Period Grant',
  plan_change: 'Plan Change',
  module_addon_enablement: 'Module Add-On',
};

const PLANS = ['tournament', 'team', 'tournament_plus', 'league', 'club'];
const STATUSES = ['active', 'trialing', 'past_due', 'canceled'];
const MODULE_OPTIONS = [
  { value: 'module_public_site', label: 'Public Site' },
  { value: 'module_house_league', label: 'House League' },
  { value: 'module_accounting', label: 'Accounting' },
  { value: 'module_rep_teams', label: 'Rep Teams' },
];
const MODULE_OPERATION_LABELS: Record<ModuleOperation, string> = {
  enable: 'Enable',
  disable: 'Remove',
};

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === 'completed' || status === 'active') return styles.badgeGood;
  if (status === 'partial_failed' || status === 'past_due' || status === 'trialing') return styles.badgeWarn;
  return styles.badgeMuted;
}

export default function BulkOperationsClient({
  orgs,
  recentOperations,
  canManageBilling,
  canManageProduct,
}: {
  orgs: BulkOrgRow[];
  recentOperations: BulkOperationRow[];
  canManageBilling: boolean;
  canManageProduct: boolean;
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
  const [expiresAt, setExpiresAt] = useState('');
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
    ? `Create a subscription status override set to ${STATUS_LABELS[targetStatus] ?? targetStatus}.`
    : actionType === 'comp_period'
      ? `Grant a comp period through ${expiresAt || 'the selected expiry date'}.`
      : actionType === 'module_addon_enablement'
        ? `${MODULE_OPERATION_LABELS[moduleOperation]} ${moduleLabel} as an organization-specific module override.`
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
    if (actionType === 'comp_period' && !expiresAt) {
      setError('Comp period grants require an expiration date.');
      return;
    }
    if (actionType === 'module_addon_enablement' && !targetModule) {
      setError('Choose a module add-on.');
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
          expires_at: expiresAt || null,
          reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Bulk operation failed');

      setResults(json.results ?? []);
      setOperations(prev => [json.operation, ...prev].slice(0, 8));
      setSaved(`${json.operation.success_count} succeeded / ${json.operation.failure_count} failed`);
      resetAfterApply();
    } catch (err) {
      setError((err as Error).message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.headerLabel}>Billing & Product</div>
          <h1 className={styles.title}>Bulk Operations</h1>
          <p className={styles.intro}>
            Select organizations, preview the impact, add a reason, then confirm the guarded operation.
          </p>
        </div>
        <div className={styles.count}>{selectedIds.length} selected</div>
      </header>

      <section className={styles.snapshotGrid}>
        <div className={styles.snapshotItem}>
          <span>Total Accounts</span>
          <strong>{orgs.length}</strong>
        </div>
        <div className={styles.snapshotItem}>
          <span>Filtered</span>
          <strong>{filteredOrgs.length}</strong>
        </div>
        <div className={styles.snapshotItem}>
          <span>Selected</span>
          <strong>{selectedIds.length}</strong>
        </div>
        <div className={styles.snapshotItem}>
          <span>Recent Batches</span>
          <strong>{operations.length}</strong>
        </div>
      </section>

      {(!canManageBilling || !canManageProduct) && (
        <section className={styles.notice}>
          Bulk billing actions require billing access. Module add-on actions require product access.
        </section>
      )}

      {(error || saved) && (
        <section className={error ? styles.errorBanner : styles.successBanner}>
          {error || saved}
        </section>
      )}

      <section className={styles.workspace}>
        <div className={styles.leftColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <div className={styles.sectionKicker}>Step 1</div>
                <h2>Choose Accounts</h2>
              </div>
              <button type="button" className={styles.secondaryBtn} onClick={toggleFilteredSelection}>
                {allFilteredSelected ? 'Clear Filtered' : 'Select Filtered'}
              </button>
            </div>

            <div className={styles.filterBar}>
              <input
                className={styles.input}
                type="search"
                placeholder="Search account or slug..."
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select className={styles.select} value={planFilter} onChange={event => setPlanFilter(event.target.value)}>
                <option value="">All plans</option>
                {PLANS.map(plan => <option key={plan} value={plan}>{PLAN_LABELS[plan]}</option>)}
              </select>
              <select className={styles.select} value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                {STATUSES.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
              </select>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th></th>
                    <th>Account</th>
                    <th>Plan</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrgs.length === 0 ? (
                    <tr><td colSpan={4} className={styles.emptyCell}>No accounts match this filter.</td></tr>
                  ) : filteredOrgs.map(org => (
                    <tr key={org.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(org.id)}
                          onChange={() => toggleOrg(org.id)}
                          aria-label={`Select ${org.name}`}
                        />
                      </td>
                      <td>
                        <Link href={`/platform-admin/orgs/${org.id}`} className={styles.accountLink}>{org.name}</Link>
                        <small>{org.slug}</small>
                      </td>
                      <td>{PLAN_LABELS[org.planId] ?? org.planId}</td>
                      <td><span className={statusClass(org.subscriptionStatus)}>{STATUS_LABELS[org.subscriptionStatus] ?? org.subscriptionStatus}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className={styles.rightColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <div className={styles.sectionKicker}>Step 2</div>
                <h2>Configure Action</h2>
              </div>
            </div>

            <label className={styles.field}>
              <span>Bulk Action</span>
              <select
                className={styles.select}
                value={actionType}
                onChange={event => {
                  setActionType(event.target.value as BulkActionType);
                  setConfirming(false);
                }}
              >
                <option value="subscription_status_override">Subscription Status Override</option>
                <option value="comp_period">Comp Period Grant</option>
                <option value="plan_change">Plan Change</option>
                <option value="module_addon_enablement">Module Add-On Enablement</option>
              </select>
            </label>

            {actionType === 'subscription_status_override' && (
              <label className={styles.field}>
                <span>Target Status</span>
                <select className={styles.select} value={targetStatus} onChange={event => setTargetStatus(event.target.value)}>
                  {STATUSES.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                </select>
              </label>
            )}

            {actionType === 'plan_change' && (
              <label className={styles.field}>
                <span>Target Plan</span>
                <select className={styles.select} value={targetPlan} onChange={event => setTargetPlan(event.target.value)}>
                  {PLANS.map(plan => <option key={plan} value={plan}>{PLAN_LABELS[plan]}</option>)}
                </select>
              </label>
            )}

            {actionType === 'module_addon_enablement' && (
              <>
                <label className={styles.field}>
                  <span>Module Add-On</span>
                  <select
                    className={styles.select}
                    value={targetModule}
                    onChange={event => {
                      setTargetModule(event.target.value);
                      setConfirming(false);
                    }}
                  >
                    {MODULE_OPTIONS.map(module => <option key={module.value} value={module.value}>{module.label}</option>)}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Operation</span>
                  <select
                    className={styles.select}
                    value={moduleOperation}
                    onChange={event => {
                      setModuleOperation(event.target.value as ModuleOperation);
                      setConfirming(false);
                    }}
                  >
                    <option value="enable">Enable module override</option>
                    <option value="disable">Remove module override</option>
                  </select>
                </label>
              </>
            )}

            {(actionType === 'subscription_status_override' || actionType === 'comp_period') && (
              <label className={styles.field}>
                <span>{actionType === 'comp_period' ? 'Expires At' : 'Optional Expiry'}</span>
                <input
                  className={styles.input}
                  type="date"
                  value={expiresAt}
                  onChange={event => setExpiresAt(event.target.value)}
                />
              </label>
            )}

            <label className={styles.field}>
              <span>Reason</span>
              <textarea
                className={styles.textarea}
                value={reason}
                placeholder="Required: explain why this bulk operation is being applied."
                onChange={event => {
                  setReason(event.target.value);
                  setConfirming(false);
                }}
              />
            </label>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <div className={styles.sectionKicker}>Step 3</div>
                <h2>Preview & Confirm</h2>
              </div>
            </div>

            <div className={styles.previewBox}>
              <span>{ACTION_LABELS[actionType]}</span>
              <strong>{selectedOrgs.length} account{selectedOrgs.length === 1 ? '' : 's'}</strong>
              <p>{previewCopy}</p>
            </div>

            {selectedOrgs.length > 0 && (
              <div className={styles.selectedList}>
                {selectedOrgs.slice(0, 8).map(org => (
                  <div key={org.id}>
                    <span>{org.name}</span>
                    <small>
                      {actionType === 'module_addon_enablement'
                        ? `${moduleLabel}: ${org.enabledAddons.includes(targetModule) ? 'Currently enabled' : 'Not enabled'}`
                        : `${PLAN_LABELS[org.planId] ?? org.planId} / ${STATUS_LABELS[org.subscriptionStatus] ?? org.subscriptionStatus}`}
                    </small>
                  </div>
                ))}
                {selectedOrgs.length > 8 && <div><span>{selectedOrgs.length - 8} more</span><small>Included in this operation</small></div>}
              </div>
            )}

            <button
              type="button"
              className={styles.primaryBtn}
              onClick={applyBulkOperation}
              disabled={busy || !canApplySelectedAction || selectedIds.length === 0}
            >
              {busy ? <Loader size={13} className={styles.spin} /> : confirming ? 'Confirm Bulk Operation' : 'Review Bulk Operation'}
            </button>
          </section>
        </div>
      </section>

      {results.length > 0 && (
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <div className={styles.sectionKicker}>Result</div>
              <h2>Latest Operation</h2>
            </div>
          </div>
          <div className={styles.resultGrid}>
            {results.map(result => (
              <div key={result.orgId} className={result.ok ? styles.resultOk : styles.resultFail}>
                <strong>{result.name}</strong>
                <span>{result.message}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <div className={styles.sectionKicker}>Audit Trail</div>
            <h2>Recent Bulk Operations</h2>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
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
                <tr><td colSpan={5} className={styles.emptyCell}>No bulk operations recorded yet.</td></tr>
              ) : operations.map(operation => (
                <tr key={operation.id}>
                  <td>
                    {ACTION_LABELS[operation.action_type as BulkActionType] ?? operation.action_type}
                    <small>{operation.reason}</small>
                  </td>
                  <td><span className={statusClass(operation.status)}>{operation.status.replace('_', ' ')}</span></td>
                  <td>{operation.success_count} / {operation.target_count}</td>
                  <td>{operation.created_by_email}</td>
                  <td>{formatDate(operation.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
