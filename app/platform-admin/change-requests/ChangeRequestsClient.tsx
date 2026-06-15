'use client';

import { useMemo, useState } from 'react';
import { Check, Loader, X } from 'lucide-react';
import HelpCallout from '@/components/help/HelpCallout';
import { fmtAbsoluteDateTime } from '@/lib/format-date';
import type { PlatformChangeApplicationRow, PlatformChangeRequestRow } from './types';
import styles from './change-requests.module.css';

type StripePriceUpdateProposal = {
  kind: 'stripe_price_update';
  stripePriceId: string;
  planId: string;
  billingCycle: string;
  environment: string;
  currentPriceId: string | null;
  proposedPriceId: string | null;
  changeNote: string | null;
};

type PlanGatingUpdateProposal = {
  kind: 'plan_gating_update';
  planId: string;
  currentStatus: string;
  proposedStatus: string;
  changeNote: string | null;
};

type PlanConfigUpdateProposal = {
  kind: 'plan_config_update';
  planId: string;
  current: {
    tournamentLimit: number | null;
    seatLimit: number | null;
    trialDays: number | null;
  };
  proposed: {
    tournamentLimit: number | null;
    seatLimit: number | null;
    trialDays: number | null;
  };
  changeNote: string | null;
};

const CHANGE_REQUEST_TYPES = [
  { value: 'plan_version', label: 'Plan Version' },
  { value: 'feature_matrix', label: 'Feature Matrix' },
  { value: 'addon', label: 'Add-on' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'grandfathering', label: 'Grandfathering' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'trial', label: 'Trial' },
];

const CHANGE_REQUEST_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'implemented', label: 'Implemented' },
  { value: 'canceled', label: 'Canceled' },
];

const STATUS_VIEW_OPTIONS = [
  {
    value: 'action_needed',
    label: 'Action Needed',
    statuses: ['needs_review', 'approved'],
  },
  {
    value: 'open',
    label: 'All Open',
    statuses: ['draft', 'needs_review', 'approved'],
  },
  {
    value: 'closed',
    label: 'Closed / History',
    statuses: ['implemented', 'rejected', 'canceled'],
  },
  {
    value: 'all',
    label: 'All Requests',
    statuses: null,
  },
];

const SEVERITY_FILTERS = [
  { value: 'all', label: 'All Severities' },
  { value: 'launch_blocker', label: 'Launch Blocker' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const SEVERITY_RANK: Record<string, number> = {
  launch_blocker: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const ATTENTION_FILTERS = [
  { value: 'all', label: 'All Attention' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'submitter', label: 'Submitter' },
  { value: 'implementer', label: 'Implementer' },
  { value: 'complete', label: 'Complete' },
];

const PLAN_LABELS: Record<string, string> = {
  tournament: 'Tournament',
  team: 'Team',
  tournament_plus: 'Tournament Plus',
  league: 'League Plus',
  club: 'Club',
  org_team_addon: 'Org Team Add-on',
  rep_team: 'Club Extra Rep Team',
};

type Props = {
  initialRequests: PlatformChangeRequestRow[];
  applications: PlatformChangeApplicationRow[];
  canManageProduct: boolean;
  currentUserEmail: string;
};

function optionLabel(options: { value: string; label: string }[], value: string | null | undefined) {
  return options.find(option => option.value === value)?.label ?? value ?? 'Not set';
}

function statusViewStatuses(value: string): string[] | null {
  const preset = STATUS_VIEW_OPTIONS.find(option => option.value === value);
  if (preset) return preset.statuses;
  return CHANGE_REQUEST_STATUSES.some(option => option.value === value) ? [value] : null;
}

const formatDate = (value: string | null | undefined) => fmtAbsoluteDateTime(value, 'Not set');

function getStripePriceProposal(request: PlatformChangeRequestRow): StripePriceUpdateProposal | null {
  if (!request.proposal || typeof request.proposal !== 'object') return null;
  const proposal = request.proposal as Record<string, unknown>;

  if (proposal.kind !== 'stripe_price_update') return null;
  if (typeof proposal.stripePriceId !== 'string' || !proposal.stripePriceId.trim()) return null;
  if (typeof proposal.planId !== 'string' || !proposal.planId.trim()) return null;
  if (typeof proposal.billingCycle !== 'string' || !proposal.billingCycle.trim()) return null;
  if (typeof proposal.environment !== 'string' || !proposal.environment.trim()) return null;

  return {
    kind: 'stripe_price_update',
    stripePriceId: proposal.stripePriceId.trim(),
    planId: proposal.planId.trim(),
    billingCycle: proposal.billingCycle.trim(),
    environment: proposal.environment.trim(),
    currentPriceId: typeof proposal.currentPriceId === 'string' && proposal.currentPriceId.trim()
      ? proposal.currentPriceId.trim()
      : null,
    proposedPriceId: typeof proposal.proposedPriceId === 'string' && proposal.proposedPriceId.trim()
      ? proposal.proposedPriceId.trim()
      : null,
    changeNote: typeof proposal.changeNote === 'string' && proposal.changeNote.trim()
      ? proposal.changeNote.trim()
      : null,
  };
}

function getPlanGatingProposal(request: PlatformChangeRequestRow): PlanGatingUpdateProposal | null {
  if (!request.proposal || typeof request.proposal !== 'object') return null;
  const proposal = request.proposal as Record<string, unknown>;
  if (proposal.kind !== 'plan_gating_update') return null;
  if (typeof proposal.planId !== 'string' || !proposal.planId.trim()) return null;
  if (typeof proposal.currentStatus !== 'string' || !proposal.currentStatus.trim()) return null;
  if (typeof proposal.proposedStatus !== 'string' || !proposal.proposedStatus.trim()) return null;

  return {
    kind: 'plan_gating_update',
    planId: proposal.planId.trim(),
    currentStatus: proposal.currentStatus.trim(),
    proposedStatus: proposal.proposedStatus.trim(),
    changeNote: typeof proposal.changeNote === 'string' && proposal.changeNote.trim()
      ? proposal.changeNote.trim()
      : null,
  };
}

function getPlanConfigShape(value: unknown): PlanConfigUpdateProposal['current'] | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const tournamentLimit = record.tournamentLimit === null || typeof record.tournamentLimit === 'number'
    ? record.tournamentLimit
    : undefined;
  const seatLimit = record.seatLimit === null || typeof record.seatLimit === 'number'
    ? record.seatLimit
    : undefined;
  const trialDays = record.trialDays === null || typeof record.trialDays === 'number'
    ? record.trialDays
    : undefined;
  if (tournamentLimit === undefined || seatLimit === undefined || trialDays === undefined) return null;
  return { tournamentLimit, seatLimit, trialDays };
}

function getPlanConfigProposal(request: PlatformChangeRequestRow): PlanConfigUpdateProposal | null {
  if (!request.proposal || typeof request.proposal !== 'object') return null;
  const proposal = request.proposal as Record<string, unknown>;
  if (proposal.kind !== 'plan_config_update') return null;
  if (typeof proposal.planId !== 'string' || !proposal.planId.trim()) return null;

  const current = getPlanConfigShape(proposal.current);
  const proposed = getPlanConfigShape(proposal.proposed);
  if (!current || !proposed) return null;

  return {
    kind: 'plan_config_update',
    planId: proposal.planId.trim(),
    current,
    proposed,
    changeNote: typeof proposal.changeNote === 'string' && proposal.changeNote.trim()
      ? proposal.changeNote.trim()
      : null,
  };
}

function generatedApplyLabel(request: PlatformChangeRequestRow) {
  if (getStripePriceProposal(request)) return 'Price';
  if (getPlanGatingProposal(request)) return 'Availability';
  if (getPlanConfigProposal(request)) return 'Limits';
  return null;
}

function statusClass(status: string) {
  if (status === 'implemented' || status === 'approved') return styles.badgeLive;
  if (status === 'needs_review') return styles.badgePlanned;
  if (status === 'rejected' || status === 'canceled') return styles.badgeRetired;
  return styles.badgeDraft;
}

function severityClass(priority: string) {
  if (priority === 'launch_blocker') return styles.severityLaunchBlocker;
  if (priority === 'high') return styles.severityHigh;
  if (priority === 'medium') return styles.severityMedium;
  return styles.severityLow;
}

function attentionKey(request: PlatformChangeRequestRow) {
  if (request.status === 'draft') return 'submitter';
  if (request.status === 'needs_review') return 'reviewer';
  if (request.status === 'approved') return 'implementer';
  return 'complete';
}

function attentionLabel(request: PlatformChangeRequestRow) {
  const key = attentionKey(request);
  if (key === 'submitter') return 'Submitter';
  if (key === 'reviewer') return 'Product approver';
  if (key === 'implementer') return 'Implementer';
  return 'No action';
}

function targetLabel(request: PlatformChangeRequestRow) {
  if (request.target_plan_id) return PLAN_LABELS[request.target_plan_id] ?? request.target_plan_id;
  if (request.target_addon_key) return PLAN_LABELS[request.target_addon_key] ?? request.target_addon_key;
  return 'General';
}

function priceProposalSummary(priceProposal: StripePriceUpdateProposal) {
  const plan = PLAN_LABELS[priceProposal.planId] ?? priceProposal.planId;
  const scope = `${priceProposal.environment} ${priceProposal.billingCycle} ${plan}`;

  if (!priceProposal.currentPriceId && priceProposal.proposedPriceId) {
    return `Set ${scope} Stripe price to ${priceProposal.proposedPriceId}.`;
  }

  if (priceProposal.currentPriceId && priceProposal.proposedPriceId) {
    return `Update ${scope} Stripe price from ${priceProposal.currentPriceId} to ${priceProposal.proposedPriceId}.`;
  }

  if (priceProposal.currentPriceId && !priceProposal.proposedPriceId) {
    return `Clear ${scope} Stripe price ${priceProposal.currentPriceId}.`;
  }

  return `Keep ${scope} Stripe price unset.`;
}

function requestDisplaySummary(request: PlatformChangeRequestRow) {
  const priceProposal = getStripePriceProposal(request);
  if (priceProposal) return priceProposalSummary(priceProposal);
  return request.impact_summary ?? proposalSummary(request);
}

function proposalSummary(request: PlatformChangeRequestRow) {
  const priceProposal = getStripePriceProposal(request);
  if (priceProposal) return priceProposalSummary(priceProposal);

  const gatingProposal = getPlanGatingProposal(request);
  if (gatingProposal) {
    const plan = PLAN_LABELS[gatingProposal.planId] ?? gatingProposal.planId;
    return `Availability: ${plan} from ${gatingProposal.currentStatus.replace('_', ' ')} to ${gatingProposal.proposedStatus.replace('_', ' ')}.`;
  }

  const configProposal = getPlanConfigProposal(request);
  if (configProposal) {
    const plan = PLAN_LABELS[configProposal.planId] ?? configProposal.planId;
    return `Limits/trials: ${plan} from ${configProposal.current.tournamentLimit ?? 'default'} tournaments, ${configProposal.current.seatLimit ?? 'default'} seats, ${configProposal.current.trialDays ?? 'default'} trial days to ${configProposal.proposed.tournamentLimit ?? 'default'} tournaments, ${configProposal.proposed.seatLimit ?? 'default'} seats, ${configProposal.proposed.trialDays ?? 'default'} trial days.`;
  }

  if (request.request_type === 'feature_matrix') {
    return 'Feature matrix proposal. Approved requests publish from Plans & Pricing until a dedicated publisher is moved here.';
  }

  return request.description ?? request.impact_summary ?? 'No proposal summary provided.';
}

function proposalPayload(request: PlatformChangeRequestRow) {
  if (!request.proposal || typeof request.proposal !== 'object') return null;
  if (Object.keys(request.proposal as Record<string, unknown>).length === 0) return null;
  return JSON.stringify(request.proposal, null, 2);
}

export default function ChangeRequestsClient({
  initialRequests,
  applications,
  canManageProduct,
  currentUserEmail,
}: Props) {
  const [requests, setRequests] = useState<PlatformChangeRequestRow[]>(initialRequests);
  const [applicationRows, setApplicationRows] = useState<PlatformChangeApplicationRow[]>(applications);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusView, setStatusView] = useState('action_needed');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [attentionFilter, setAttentionFilter] = useState('all');
  const [submitterFilter, setSubmitterFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const applicationsByRequest = useMemo(() => {
    const grouped = new Map<string, PlatformChangeApplicationRow[]>();
    for (const application of applicationRows) {
      const existing = grouped.get(application.change_request_id) ?? [];
      grouped.set(application.change_request_id, [...existing, application]);
    }
    return grouped;
  }, [applicationRows]);

  const submitters = useMemo(() => {
    const values = new Set<string>();
    for (const request of requests) {
      values.add(request.submitted_by_email ?? request.created_by_email);
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const visibleStatuses = statusViewStatuses(statusView);
    return requests.filter(request => {
      const submitter = request.submitted_by_email ?? request.created_by_email;
      if (typeFilter !== 'all' && request.request_type !== typeFilter) return false;
      if (visibleStatuses && !visibleStatuses.includes(request.status)) return false;
      if (severityFilter !== 'all' && request.priority !== severityFilter) return false;
      if (attentionFilter !== 'all' && attentionKey(request) !== attentionFilter) return false;
      if (submitterFilter !== 'all' && submitter !== submitterFilter) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        request.title,
        requestDisplaySummary(request),
        request.description ?? '',
        submitter,
        targetLabel(request),
        proposalSummary(request),
        optionLabel(SEVERITY_FILTERS, request.priority),
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    }).sort((a, b) => {
      const severityDiff = (SEVERITY_RANK[b.priority] ?? 0) - (SEVERITY_RANK[a.priority] ?? 0);
      if (severityDiff !== 0) return severityDiff;

      const bUpdated = new Date(b.updated_at ?? b.created_at).getTime();
      const aUpdated = new Date(a.updated_at ?? a.created_at).getTime();
      return bUpdated - aUpdated;
    });
  }, [attentionFilter, requests, search, severityFilter, statusView, submitterFilter, typeFilter]);

  const actionNeededCount = requests.filter(request => ['needs_review', 'approved'].includes(request.status)).length;
  const reviewCount = requests.filter(request => request.status === 'needs_review').length;
  const implementedCount = requests.filter(request => request.status === 'implemented').length;
  const priceCount = requests.filter(request => getStripePriceProposal(request)).length;
  const selectedRequest = useMemo(
    () => requests.find(request => request.id === selectedRequestId) ?? null,
    [requests, selectedRequestId],
  );
  const selectedApplications = selectedRequest ? applicationsByRequest.get(selectedRequest.id) ?? [] : [];

  async function updateStatus(request: PlatformChangeRequestRow, status: string) {
    setBusy(`${request.id}:${status}`);
    setNotice('');
    setError('');

    try {
      const res = await fetch('/api/platform-admin/product-catalog/change-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: request.id, status }),
      });
      const json = await res.json() as {
        error?: string;
        changeRequest?: PlatformChangeRequestRow;
        appliedStripePrice?: { id?: string; price_id?: string | null; already_current?: boolean } | null;
        appliedPlanGating?: { plan_key?: string; gating_status?: string; already_current?: boolean } | null;
        appliedPlanConfig?: { plan_id?: string; already_current?: boolean } | null;
      };
      if (!res.ok || !json.changeRequest) throw new Error(json.error ?? 'Unable to update change request');

      setRequests(prev => prev.map(item => item.id === request.id ? json.changeRequest! : item));

      if (json.appliedStripePrice?.id) {
        setApplicationRows(prev => [{
          id: `local-${request.id}-${Date.now()}`,
          change_request_id: request.id,
          surface: 'stripe_price',
          target_key: json.appliedStripePrice?.id ?? request.id,
          actor_email: currentUserEmail,
          applied_payload: json.appliedStripePrice,
          applied_at: new Date().toISOString(),
        }, ...prev]);
        setNotice(json.appliedStripePrice.already_current
          ? 'Marked implemented; the Stripe price slot already matched this approved request.'
          : 'Approved, applied, and marked implemented.');
        setSelectedRequestId(null);
      } else if (json.appliedPlanGating?.plan_key) {
        setApplicationRows(prev => [{
          id: `local-${request.id}-${Date.now()}`,
          change_request_id: request.id,
          surface: 'plan_gating',
          target_key: json.appliedPlanGating?.plan_key ?? request.id,
          actor_email: currentUserEmail,
          applied_payload: json.appliedPlanGating,
          applied_at: new Date().toISOString(),
        }, ...prev]);
        setNotice(json.appliedPlanGating.already_current
          ? 'Marked implemented; plan availability already matched this approved request.'
          : 'Approved, applied, and marked implemented.');
        setSelectedRequestId(null);
      } else if (json.appliedPlanConfig?.plan_id) {
        setApplicationRows(prev => [{
          id: `local-${request.id}-${Date.now()}`,
          change_request_id: request.id,
          surface: 'plan_config',
          target_key: json.appliedPlanConfig?.plan_id ?? request.id,
          actor_email: currentUserEmail,
          applied_payload: json.appliedPlanConfig,
          applied_at: new Date().toISOString(),
        }, ...prev]);
        setNotice(json.appliedPlanConfig.already_current
          ? 'Marked implemented; plan limits already matched this approved request.'
          : 'Approved, applied, and marked implemented.');
        setSelectedRequestId(null);
      } else if (status === 'approved') {
        setNotice('Change request approved.');
      } else if (status === 'implemented') {
        setNotice('Change request marked implemented.');
        setSelectedRequestId(null);
      } else {
        setNotice('Change request updated.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function renderActions(request: PlatformChangeRequestRow) {
    if (!canManageProduct) return <span className={styles.muted}>Read only</span>;

    const generatedLabel = generatedApplyLabel(request);
    const isBusy = busy?.startsWith(`${request.id}:`);
    if (isBusy) return <Loader size={14} className={styles.spin} />;

    if (request.status === 'draft') {
      return (
        <button className={styles.secondaryBtn} onClick={() => updateStatus(request, 'needs_review')}>
          Submit for Review
        </button>
      );
    }

    if (request.status === 'needs_review') {
      return (
        <span className={styles.actionStack}>
          <button className={styles.primaryBtn} onClick={() => updateStatus(request, 'approved')}>
            <Check size={13} />
            {generatedLabel ? 'Approve & Apply' : 'Approve'}
          </button>
          <button className={styles.dangerBtn} onClick={() => updateStatus(request, 'rejected')}>
            <X size={13} />
            Reject
          </button>
        </span>
      );
    }

    if (request.status === 'approved') {
      return (
        <button className={styles.primaryBtn} onClick={() => updateStatus(request, generatedLabel ? 'approved' : 'implemented')}>
          <Check size={13} />
          {generatedLabel ? `Apply ${generatedLabel}` : 'Mark Implemented'}
        </button>
      );
    }

    return <span className={styles.muted}>Closed</span>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <div className={styles.headerLabel}>Billing &amp; Product</div>
          <h1 className={styles.title}>Approval Queue</h1>
        </div>
        <p className={styles.pageIntro}>
          Review product, pricing, entitlement, campaign, and approval requests from one queue.
          The default view shows action-needed requests only; generated plan and price approvals apply immediately.
        </p>
      </header>

      <HelpCallout
        variant="info"
        title="How the Approval Queue relates to Plans & Pricing"
        body="Most requests here are created automatically by the Plans & Pricing catalog flow (and billing-initiated catalog actions) — this queue is where you review and move them forward. Approving a generated price, gating, or config change applies it immediately to the catalog; every transition is audit-logged."
        cta={{ label: 'Open Plans & Pricing', href: '/platform-admin/plans-pricing' }}
      />

      <section className={styles.summaryGrid} aria-label="Change request summary">
        <div>
          <span>Action Needed</span>
          <strong>{actionNeededCount}</strong>
        </div>
        <div>
          <span>Needs Review</span>
          <strong>{reviewCount}</strong>
        </div>
        <div>
          <span>Price Changes</span>
          <strong>{priceCount}</strong>
        </div>
        <div>
          <span>Implemented</span>
          <strong>{implementedCount}</strong>
        </div>
      </section>

      {(notice || error) && (
        <div className={error ? styles.errorBanner : styles.successBanner}>
          {error || notice}
        </div>
      )}

      <section className={styles.filterBar} aria-label="Change request filters">
        <label>
          <span>Type</span>
          <select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}>
            <option value="all">All Types</option>
            {CHANGE_REQUEST_TYPES.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Status View</span>
          <select value={statusView} onChange={event => setStatusView(event.target.value)}>
            {STATUS_VIEW_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
            <optgroup label="Exact Status">
              {CHANGE_REQUEST_STATUSES.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </optgroup>
          </select>
        </label>
        <label>
          <span>Severity</span>
          <select value={severityFilter} onChange={event => setSeverityFilter(event.target.value)}>
            {SEVERITY_FILTERS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Attention</span>
          <select value={attentionFilter} onChange={event => setAttentionFilter(event.target.value)}>
            {ATTENTION_FILTERS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Submitted By</span>
          <select value={submitterFilter} onChange={event => setSubmitterFilter(event.target.value)}>
            <option value="all">All Submitters</option>
            {submitters.map(email => (
              <option key={email} value={email}>{email}</option>
            ))}
          </select>
        </label>
        <label className={styles.searchField}>
          <span>Search</span>
          <input
            value={search}
            placeholder="Title, user, target, or proposal"
            onChange={event => setSearch(event.target.value)}
          />
        </label>
      </section>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.requestColumn}>Request</th>
              <th className={styles.statusColumn}>Status</th>
              <th className={styles.severityColumn}>Severity</th>
              <th className={styles.ownerColumn}>Owner</th>
              <th className={styles.targetColumn}>Target</th>
              <th className={styles.updatedColumn}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>No change requests match this view.</td>
              </tr>
            ) : filteredRequests.map(request => {
              const submitter = request.submitted_by_email ?? request.created_by_email;

              return (
                <tr
                  key={request.id}
                  className={styles.clickableRow}
                  onClick={() => setSelectedRequestId(request.id)}
                >
                  <td className={styles.requestCell} data-label="Request">
                    <button
                      type="button"
                      className={styles.requestButton}
                      onClick={() => setSelectedRequestId(request.id)}
                    >
                      {request.title}
                    </button>
                    <span>{requestDisplaySummary(request)}</span>
                  </td>
                  <td data-label="Status">
                    <span className={statusClass(request.status)}>
                      {optionLabel(CHANGE_REQUEST_STATUSES, request.status)}
                    </span>
                  </td>
                  <td data-label="Severity">
                    <span className={severityClass(request.priority)}>
                      {optionLabel(SEVERITY_FILTERS, request.priority)}
                    </span>
                  </td>
                  <td className={styles.ownerCell} data-label="Owner">
                    <strong>{attentionLabel(request)}</strong>
                    <span>{submitter}</span>
                  </td>
                  <td className={styles.targetCell} data-label="Target">
                    <strong>{targetLabel(request)}</strong>
                    <span>{optionLabel(CHANGE_REQUEST_TYPES, request.request_type)}</span>
                  </td>
                  <td className={styles.dateCell} data-label="Updated">{formatDate(request.updated_at ?? request.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedRequest && (
        <div className={styles.modalOverlay} onClick={() => setSelectedRequestId(null)}>
          <div
            className={styles.detailModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-request-detail-title"
            onClick={event => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.headerLabel}>Approval Detail</div>
                <h2 id="change-request-detail-title" className={styles.modalTitle}>{selectedRequest.title}</h2>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setSelectedRequestId(null)}
                aria-label="Close request detail"
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalBadgeRow}>
                <span className={statusClass(selectedRequest.status)}>
                  {optionLabel(CHANGE_REQUEST_STATUSES, selectedRequest.status)}
                </span>
                <span className={severityClass(selectedRequest.priority)}>
                  {optionLabel(SEVERITY_FILTERS, selectedRequest.priority)}
                </span>
                <span className={styles.attentionPill}>{attentionLabel(selectedRequest)}</span>
              </div>

              <dl className={styles.detailGrid}>
                <div>
                  <dt>Type</dt>
                  <dd>{optionLabel(CHANGE_REQUEST_TYPES, selectedRequest.request_type)}</dd>
                </div>
                <div>
                  <dt>Target</dt>
                  <dd>{targetLabel(selectedRequest)}</dd>
                </div>
                <div>
                  <dt>Submitted By</dt>
                  <dd>{selectedRequest.submitted_by_email ?? selectedRequest.created_by_email}</dd>
                </div>
                <div>
                  <dt>Last Updated</dt>
                  <dd>{formatDate(selectedRequest.updated_at ?? selectedRequest.created_at)}</dd>
                </div>
              </dl>

              <section className={styles.detailSection}>
                <h3>Summary</h3>
                <p>{requestDisplaySummary(selectedRequest)}</p>
                {selectedRequest.description && <p>{selectedRequest.description}</p>}
              </section>

              <section className={styles.detailSection}>
                <h3>Proposal</h3>
                <p>{proposalSummary(selectedRequest)}</p>
                {proposalPayload(selectedRequest) && (
                  <pre className={styles.proposalBlock}>{proposalPayload(selectedRequest)}</pre>
                )}
              </section>

              <section className={styles.detailSection}>
                <h3>Stage History</h3>
                <div className={styles.historyList}>
                  <span>Created {formatDate(selectedRequest.created_at)} by {selectedRequest.created_by_email}</span>
                  <span>{selectedRequest.submitted_at ? `Submitted ${formatDate(selectedRequest.submitted_at)} by ${selectedRequest.submitted_by_email ?? selectedRequest.created_by_email}` : 'Not submitted yet'}</span>
                  <span>{selectedRequest.reviewed_at ? `Reviewed ${formatDate(selectedRequest.reviewed_at)} by ${selectedRequest.reviewed_by_email ?? 'unknown'}` : 'Not reviewed yet'}</span>
                  {selectedApplications.length === 0 ? (
                    <span>No live application yet</span>
                  ) : selectedApplications.map(application => (
                    <span key={application.id}>
                      Applied {formatDate(application.applied_at)} by {application.actor_email}
                    </span>
                  ))}
                  {selectedRequest.implementation_notes && <span>Notes: {selectedRequest.implementation_notes}</span>}
                </div>
              </section>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setSelectedRequestId(null)}>
                Close
              </button>
              <div className={styles.modalActions}>{renderActions(selectedRequest)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
