'use client';

import { Fragment, useMemo, useState } from 'react';
import { Loader, Check, X } from 'lucide-react';
import type { PlanConfigOverrideRow } from '@/lib/plan-config-db';
import type { FeatureMatrixRow } from '@/lib/plan-module-entitlements';
import type { StripePriceRow } from '@/lib/stripe-prices';
import type {
  CatalogCampaignRow,
  CatalogChangeRequestRow,
  ProductCatalogAddonRow,
  ProductCatalogVersionRow,
} from './page';
import styles from './plans-pricing.module.css';

type Tab = 'availability' | 'limits' | 'catalog' | 'prices';
type PriceEnvironmentTab = 'live' | 'sandbox';
type CatalogView = 'planning' | 'matrix' | 'records';

const TABS: { id: Tab; label: string }[] = [
  { id: 'availability', label: 'Availability' },
  { id: 'limits', label: 'Limits & Trials' },
  { id: 'catalog', label: 'Product Catalog' },
  { id: 'prices', label: 'Stripe Prices' },
];

const CATALOG_VIEWS: { id: CatalogView; label: string }[] = [
  { id: 'planning', label: 'Planning' },
  { id: 'matrix', label: 'Feature Matrix' },
  { id: 'records', label: 'Catalog Records' },
];

interface PlanGatingRow {
  plan_key: string;
  gating_status: string;
  updated_at: string | null;
  updated_by_email: string | null;
  last_change_note: string | null;
}

interface PlanDefault {
  tournamentLimit: number;
  seatLimit: number;
  trialDays: number;
}

type PlanImpact = {
  planId: string;
  total: number;
  active: number;
  trialing: number;
  past_due: number;
  canceled: number;
  other: number;
};

interface Props {
  initialGating: PlanGatingRow[];
  initialConfig: PlanConfigOverrideRow[];
  configDefaults: Record<string, PlanDefault>;
  initialPrices: StripePriceRow[];
  planImpacts: PlanImpact[];
  catalogVersions: ProductCatalogVersionRow[];
  addonCatalog: ProductCatalogAddonRow[];
  featureMatrix: FeatureMatrixRow[];
  changeRequests: CatalogChangeRequestRow[];
  campaigns: CatalogCampaignRow[];
  canManageProduct: boolean;
}

type ConfigDraft = {
  tournament_limit: string;
  seat_limit: string;
  trial_days: string;
};

type ChangeRequestDraft = {
  title: string;
  request_type: string;
  priority: string;
  target_plan_id: string;
  target_addon_key: string;
  effective_at: string;
  impact_summary: string;
  description: string;
};

type CampaignDraft = {
  title: string;
  campaign_type: string;
  status: string;
  target_plan_ids: string[];
  starts_at: string;
  ends_at: string;
  coupon_code: string;
  discount_summary: string;
  trial_days: string;
  notes: string;
};

type FeatureMatrixDraft = Record<string, Record<string, boolean>>;
type FeatureMatrixEntitlements = Record<string, string[]>;
type FeatureMatrixChange = {
  planId: string;
  moduleKey: string;
  current: boolean;
  proposed: boolean;
};

const PLAN_ORDER = ['tournament', 'tournament_plus', 'league', 'club'];

const PLAN_META: Record<string, { label: string; price: string; summary: string }> = {
  tournament: { label: 'Tournament', price: 'Free', summary: 'Starter event tier: 1 tournament, standard registration, FieldLogicHQ styling.' },
  tournament_plus: { label: 'Tournament Plus', price: '$39/mo', summary: 'Serious tournament operations: unlimited slots, 10 seats, registration control, branding, automation.' },
  league: { label: 'League', price: '$89/mo', summary: 'House league, registration, public organization page, and league workflows.' },
  club: { label: 'Club', price: '$179/mo', summary: 'Full club operations with accounting, rep teams, and coaches portal.' },
};

const PRICE_PLAN_LABELS: Record<string, string> = {
  tournament_plus: 'Tournament Plus',
  league: 'League',
  club: 'Club',
  rep_team: 'Additional Rep Team',
};

const PRICE_PLAN_ORDER = ['tournament_plus', 'league', 'club', 'rep_team'];

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

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'launch_blocker', label: 'Launch Blocker' },
];

const CAMPAIGN_TYPES = [
  { value: 'coupon', label: 'Coupon' },
  { value: 'promo', label: 'Promo' },
  { value: 'trial', label: 'Trial' },
  { value: 'launch', label: 'Launch' },
  { value: 'retention', label: 'Retention' },
];

const CAMPAIGN_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'ended', label: 'Ended' },
];

function sortPriceRows(rows: StripePriceRow[]): StripePriceRow[] {
  return [...rows].sort((a, b) => {
    if (a.environment !== b.environment) return a.environment === 'sandbox' ? -1 : 1;
    const pa = PRICE_PLAN_ORDER.indexOf(a.plan_id);
    const pb = PRICE_PLAN_ORDER.indexOf(b.plan_id);
    if (pa !== pb) return pa - pb;
    return a.billing_cycle === 'monthly' ? -1 : 1;
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not changed yet';
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function impactSummary(impact: PlanImpact | undefined) {
  if (!impact) return '0 accounts';
  return pluralize(impact.total, 'account');
}

function statusBreakdown(impact: PlanImpact | undefined) {
  if (!impact || impact.total === 0) return 'No current customers';
  const parts = [
    ['Active', impact.active],
    ['Trial', impact.trialing],
    ['Past due', impact.past_due],
    ['Canceled', impact.canceled],
  ].filter(([, count]) => Number(count) > 0);

  if (impact.other > 0) parts.push(['Other', impact.other]);
  return parts.map(([label, count]) => `${label} ${count}`).join(' / ');
}

function lastChangeText(updatedAt: string | null | undefined, by: string | null | undefined) {
  return `${formatDate(updatedAt)}${by ? ` by ${by}` : ''}`;
}

function planLabel(planId: string) {
  return PLAN_META[planId]?.label ?? planId;
}

function formatMoney(value: number | string | null | undefined) {
  if (value == null) return 'Not priced';
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(parsed)) return 'Not priced';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(parsed);
}

function formatPlanList(planIds: string[] | null | undefined) {
  if (!planIds || planIds.length === 0) return 'None by default';
  return planIds.map(planLabel).join(', ');
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function optionLabel(options: { value: string; label: string }[], value: string | null | undefined) {
  return options.find(option => option.value === value)?.label ?? value ?? 'Not set';
}

function statusClass(status: string) {
  if (status === 'published' || status === 'live') return styles.badgeLive;
  if (status === 'approved' || status === 'active' || status === 'implemented') return styles.badgeLive;
  if (status === 'scheduled' || status === 'planned' || status === 'needs_review') return styles.badgePlanned;
  if (status === 'rejected' || status === 'retired' || status === 'archived' || status === 'canceled' || status === 'ended') return styles.badgeRetired;
  return styles.badgeGated;
}

function buildFeatureMatrixDraft(featureMatrix: FeatureMatrixRow[]): FeatureMatrixDraft {
  return Object.fromEntries(
    PLAN_ORDER.map(planId => [
      planId,
      Object.fromEntries(featureMatrix.map(feature => [
        feature.key,
        Boolean(feature.includedPlans[planId]),
      ])),
    ]),
  );
}

function featureMatrixEntitlementsFromRequest(request: CatalogChangeRequestRow): FeatureMatrixEntitlements | null {
  if (!request.proposal || typeof request.proposal !== 'object') return null;
  const proposal = request.proposal as Record<string, unknown>;
  if (proposal.kind !== 'feature_matrix' || !proposal.moduleEntitlements || typeof proposal.moduleEntitlements !== 'object') {
    return null;
  }

  const entitlements = proposal.moduleEntitlements as Record<string, unknown>;
  if (!PLAN_ORDER.every(planId => Array.isArray(entitlements[planId]))) return null;

  return Object.fromEntries(
    PLAN_ORDER.map(planId => [
      planId,
      (entitlements[planId] as unknown[]).filter((item): item is string => typeof item === 'string'),
    ]),
  );
}

function featureMatrixProposalChanges(
  featureMatrix: FeatureMatrixRow[],
  entitlements: FeatureMatrixEntitlements | null,
): FeatureMatrixChange[] {
  if (!entitlements) return [];

  return PLAN_ORDER.flatMap(planId =>
    featureMatrix
      .map(feature => {
        const current = Boolean(feature.includedPlans[planId]);
        const proposed = entitlements[planId]?.includes(feature.key) ?? false;
        return { planId, moduleKey: feature.key, current, proposed };
      })
      .filter(change => change.current !== change.proposed),
  );
}

export default function PlansPricingClient({
  initialGating,
  initialConfig,
  configDefaults,
  initialPrices,
  planImpacts,
  catalogVersions,
  addonCatalog,
  featureMatrix,
  changeRequests,
  campaigns,
  canManageProduct,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('availability');
  const [priceEnvironmentTab, setPriceEnvironmentTab] = useState<PriceEnvironmentTab>('live');
  const [catalogView, setCatalogView] = useState<CatalogView>('planning');
  const [catalogChangeRequests, setCatalogChangeRequests] = useState<CatalogChangeRequestRow[]>(changeRequests);
  const [catalogCampaigns, setCatalogCampaigns] = useState<CatalogCampaignRow[]>(campaigns);
  const [featureMatrixRows, setFeatureMatrixRows] = useState<FeatureMatrixRow[]>(featureMatrix);
  const [selectedApprovalId, setSelectedApprovalId] = useState('');
  const [selectedFeaturePublishId, setSelectedFeaturePublishId] = useState('');
  const [featurePublishNote, setFeaturePublishNote] = useState('');
  const [featurePublishConfirming, setFeaturePublishConfirming] = useState(false);

  const impactsByPlan = useMemo(
    () => new Map(planImpacts.map(impact => [impact.planId, impact])),
    [planImpacts],
  );
  const approvedLiveChangeRequests = useMemo(
    () => catalogChangeRequests.filter(request => request.status === 'approved' && request.request_type !== 'feature_matrix'),
    [catalogChangeRequests],
  );
  const approvedFeatureMatrixRequests = useMemo(
    () => catalogChangeRequests.filter(request => request.status === 'approved' && request.request_type === 'feature_matrix'),
    [catalogChangeRequests],
  );
  const selectedApproval = approvedLiveChangeRequests.find(request => request.id === selectedApprovalId);
  const selectedFeaturePublishRequest = approvedFeatureMatrixRequests.find(request => request.id === selectedFeaturePublishId) ?? null;
  const selectedFeaturePublishEntitlements = selectedFeaturePublishRequest
    ? featureMatrixEntitlementsFromRequest(selectedFeaturePublishRequest)
    : null;
  const selectedFeaturePublishChanges = featureMatrixProposalChanges(featureMatrixRows, selectedFeaturePublishEntitlements);
  const approvalRequired = activeTab === 'availability' || activeTab === 'limits' || activeTab === 'prices';
  const hasSelectedApproval = !approvalRequired || Boolean(selectedApproval);
  const totalAccounts = planImpacts.reduce((sum, impact) => sum + impact.total, 0);
  const paidAccounts = planImpacts
    .filter(impact => impact.planId !== 'tournament')
    .reduce((sum, impact) => sum + impact.total, 0);
  const riskAccounts = planImpacts.reduce(
    (sum, impact) => sum + impact.past_due + impact.canceled,
    0,
  );

  const [gatingRows, setGatingRows] = useState<PlanGatingRow[]>(initialGating);
  const [gatingBusy, setGatingBusy] = useState<string | null>(null);
  const [gatingErrors, setGatingErrors] = useState<Record<string, string>>({});
  const [gatingNotes, setGatingNotes] = useState<Record<string, string>>({});

  async function toggleGating(planKey: string, currentStatus: string) {
    const nextStatus = currentStatus === 'live' ? 'early_access' : 'live';
    const changeNote = (gatingNotes[planKey] ?? '').trim();

    setGatingBusy(planKey);
    setGatingErrors(e => ({ ...e, [planKey]: '' }));
    try {
      const res = await fetch('/api/platform-admin/plan-gating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planKey,
          gatingStatus: nextStatus,
          changeNote,
          approvedChangeRequestId: selectedApprovalId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Request failed');

      setGatingRows(prev => prev.map(row =>
        row.plan_key === planKey
          ? {
              ...row,
              gating_status: nextStatus,
              updated_at: json.updated_at ?? new Date().toISOString(),
              updated_by_email: json.updated_by_email ?? null,
              last_change_note: json.last_change_note ?? null,
            }
          : row,
      ));
      setGatingNotes(prev => ({ ...prev, [planKey]: '' }));
    } catch (err) {
      setGatingErrors(e => ({ ...e, [planKey]: (err as Error).message }));
    } finally {
      setGatingBusy(null);
    }
  }

  const sortedGating = [...gatingRows].sort(
    (a, b) => PLAN_ORDER.indexOf(a.plan_key) - PLAN_ORDER.indexOf(b.plan_key),
  );

  const [configRows, setConfigRows] = useState<PlanConfigOverrideRow[]>(initialConfig);
  const [configEditPlan, setConfigEditPlan] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState<ConfigDraft | null>(null);
  const [configChangeNote, setConfigChangeNote] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState('');
  const [configSaved, setConfigSaved] = useState<string | null>(null);

  function getConfigRow(planId: string) {
    return configRows.find(row => row.plan_id === planId);
  }

  function startConfigEdit(planId: string) {
    const row = getConfigRow(planId);
    setConfigEditPlan(planId);
    setConfigDraft({
      tournament_limit: row?.tournament_limit != null ? String(row.tournament_limit) : '',
      seat_limit: row?.seat_limit != null ? String(row.seat_limit) : '',
      trial_days: row?.trial_days != null ? String(row.trial_days) : '',
    });
    setConfigChangeNote('');
    setConfigError('');
    setConfigSaved(null);
  }

  function cancelConfigEdit() {
    setConfigEditPlan(null);
    setConfigDraft(null);
    setConfigChangeNote('');
    setConfigError('');
  }

  async function saveConfig(planId: string) {
    if (!configDraft) return;
    setConfigSaving(true);
    setConfigError('');

    const parsedTournamentLimit = configDraft.tournament_limit.trim() === ''
      ? null
      : parseInt(configDraft.tournament_limit, 10);
    const parsedSeatLimit = configDraft.seat_limit.trim() === ''
      ? null
      : parseInt(configDraft.seat_limit, 10);
    const parsedTrialDays = configDraft.trial_days.trim() === ''
      ? null
      : parseInt(configDraft.trial_days, 10);

    try {
      const res = await fetch('/api/platform-admin/plan-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: planId,
          tournament_limit: parsedTournamentLimit,
          seat_limit: parsedSeatLimit,
          trial_days: parsedTrialDays,
          change_note: configChangeNote,
          approved_change_request_id: selectedApprovalId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');

      const updatedAt = json.updated_at ?? new Date().toISOString();
      const updatedBy = json.updated_by_email ?? null;
      const lastChangeNote = json.last_change_note ?? null;
      setConfigRows(prev => {
        const exists = prev.some(row => row.plan_id === planId);
        if (exists) {
          return prev.map(row => row.plan_id === planId
            ? {
                ...row,
                tournament_limit: parsedTournamentLimit,
                seat_limit: parsedSeatLimit,
                trial_days: parsedTrialDays,
                updated_at: updatedAt,
                updated_by_email: updatedBy,
                last_change_note: lastChangeNote,
              }
            : row,
          );
        }
        return [...prev, {
          id: '',
          plan_id: planId,
          tournament_limit: parsedTournamentLimit,
          seat_limit: parsedSeatLimit,
          trial_days: parsedTrialDays,
          updated_at: updatedAt,
          updated_by_email: updatedBy,
          last_change_note: lastChangeNote,
        }];
      });

      setConfigEditPlan(null);
      setConfigDraft(null);
      setConfigChangeNote('');
      setConfigSaved(planId);
      setTimeout(() => setConfigSaved(saved => saved === planId ? null : saved), 2000);
    } catch (err) {
      setConfigError((err as Error).message);
    } finally {
      setConfigSaving(false);
    }
  }

  const [priceRows, setPriceRows] = useState<StripePriceRow[]>(() => sortPriceRows(initialPrices));
  const [priceEditing, setPriceEditing] = useState<Record<string, string>>({});
  const [priceNotes, setPriceNotes] = useState<Record<string, string>>({});
  const [priceSaving, setPriceSaving] = useState<string | null>(null);
  const [priceErrors, setPriceErrors] = useState<Record<string, string>>({});
  const [priceSaved, setPriceSaved] = useState<Record<string, boolean>>({});

  const [changeDraft, setChangeDraft] = useState<ChangeRequestDraft>({
    title: '',
    request_type: 'pricing',
    priority: 'medium',
    target_plan_id: '',
    target_addon_key: '',
    effective_at: '',
    impact_summary: '',
    description: '',
  });
  const [campaignDraft, setCampaignDraft] = useState<CampaignDraft>({
    title: '',
    campaign_type: 'promo',
    status: 'draft',
    target_plan_ids: [],
    starts_at: '',
    ends_at: '',
    coupon_code: '',
    discount_summary: '',
    trial_days: '',
    notes: '',
  });
  const [catalogBusy, setCatalogBusy] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogSaved, setCatalogSaved] = useState('');
  const [featureDraft, setFeatureDraft] = useState<FeatureMatrixDraft>(() => buildFeatureMatrixDraft(featureMatrixRows));
  const [featureDraftTitle, setFeatureDraftTitle] = useState('Feature matrix update');
  const [featureDraftEffectiveAt, setFeatureDraftEffectiveAt] = useState('');
  const [featureDraftImpact, setFeatureDraftImpact] = useState('');
  const [featureDraftDescription, setFeatureDraftDescription] = useState('');

  function startPriceEdit(row: StripePriceRow) {
    setPriceEditing(editing => ({
      ...editing,
      [row.id]: editing[row.id] ?? (row.price_id ?? ''),
    }));
    setPriceNotes(notes => ({ ...notes, [row.id]: notes[row.id] ?? '' }));
    setPriceSaved(saved => ({ ...saved, [row.id]: false }));
    setPriceErrors(errors => ({ ...errors, [row.id]: '' }));
  }

  function cancelPriceEdit(id: string) {
    setPriceEditing(editing => {
      const next = { ...editing };
      delete next[id];
      return next;
    });
    setPriceNotes(notes => {
      const next = { ...notes };
      delete next[id];
      return next;
    });
    setPriceErrors(errors => ({ ...errors, [id]: '' }));
  }

  async function savePrice(row: StripePriceRow) {
    const priceId = (priceEditing[row.id] ?? '').trim();
    const changeNote = (priceNotes[row.id] ?? '').trim();
    setPriceSaving(row.id);
    setPriceErrors(errors => ({ ...errors, [row.id]: '' }));
    try {
      const res = await fetch('/api/platform-admin/stripe-prices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          price_id: priceId || null,
          change_note: changeNote,
          approved_change_request_id: selectedApprovalId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Save failed');

      setPriceRows(prev => sortPriceRows(prev.map(item =>
        item.id === row.id
          ? {
              ...item,
              price_id: priceId || null,
              updated_at: json.updated_at ?? new Date().toISOString(),
              updated_by_email: json.updated_by_email ?? null,
              last_change_note: json.last_change_note ?? null,
            }
          : item,
      )));
      setPriceEditing(editing => {
        const next = { ...editing };
        delete next[row.id];
        return next;
      });
      setPriceNotes(notes => {
        const next = { ...notes };
        delete next[row.id];
        return next;
      });
      setPriceSaved(saved => ({ ...saved, [row.id]: true }));
      setTimeout(() => setPriceSaved(saved => ({ ...saved, [row.id]: false })), 2000);
    } catch (err) {
      setPriceErrors(errors => ({ ...errors, [row.id]: (err as Error).message }));
    } finally {
      setPriceSaving(null);
    }
  }

  async function createChangeRequest() {
    setCatalogBusy('change-request');
    setCatalogError('');
    setCatalogSaved('');
    try {
      const res = await fetch('/api/platform-admin/product-catalog/change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...changeDraft,
          target_plan_id: changeDraft.target_plan_id || null,
          target_addon_key: changeDraft.target_addon_key || null,
          effective_at: changeDraft.effective_at || null,
          proposal: {},
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unable to create change request');

      setCatalogChangeRequests(prev => [json.changeRequest, ...prev]);
      setChangeDraft({
        title: '',
        request_type: 'pricing',
        priority: 'medium',
        target_plan_id: '',
        target_addon_key: '',
        effective_at: '',
        impact_summary: '',
        description: '',
      });
      setCatalogSaved('Change request created');
    } catch (err) {
      setCatalogError((err as Error).message);
    } finally {
      setCatalogBusy(null);
    }
  }

  async function updateChangeRequestStatus(id: string, status: string) {
    setCatalogBusy(id);
    setCatalogError('');
    setCatalogSaved('');
    try {
      const res = await fetch('/api/platform-admin/product-catalog/change-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unable to update change request');

      setCatalogChangeRequests(prev => prev.map(item =>
        item.id === id ? json.changeRequest : item,
      ));
      setCatalogSaved('Change request updated');
    } catch (err) {
      setCatalogError((err as Error).message);
    } finally {
      setCatalogBusy(null);
    }
  }

  async function createCampaign() {
    setCatalogBusy('campaign');
    setCatalogError('');
    setCatalogSaved('');
    try {
      const res = await fetch('/api/platform-admin/product-catalog/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...campaignDraft,
          starts_at: campaignDraft.starts_at || null,
          ends_at: campaignDraft.ends_at || null,
          trial_days: campaignDraft.trial_days.trim() ? Number(campaignDraft.trial_days) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unable to create campaign');

      setCatalogCampaigns(prev => [json.campaign, ...prev]);
      setCampaignDraft({
        title: '',
        campaign_type: 'promo',
        status: 'draft',
        target_plan_ids: [],
        starts_at: '',
        ends_at: '',
        coupon_code: '',
        discount_summary: '',
        trial_days: '',
        notes: '',
      });
      setCatalogSaved('Campaign created');
    } catch (err) {
      setCatalogError((err as Error).message);
    } finally {
      setCatalogBusy(null);
    }
  }

  async function updateCampaignStatus(id: string, status: string) {
    setCatalogBusy(id);
    setCatalogError('');
    setCatalogSaved('');
    try {
      const res = await fetch('/api/platform-admin/product-catalog/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unable to update campaign');

      setCatalogCampaigns(prev => prev.map(item =>
        item.id === id ? json.campaign : item,
      ));
      setCatalogSaved('Campaign updated');
    } catch (err) {
      setCatalogError((err as Error).message);
    } finally {
      setCatalogBusy(null);
    }
  }

  function toggleCampaignPlan(planId: string) {
    setCampaignDraft(draft => ({
      ...draft,
      target_plan_ids: draft.target_plan_ids.includes(planId)
        ? draft.target_plan_ids.filter(id => id !== planId)
        : [...draft.target_plan_ids, planId],
    }));
  }

  function toggleFeatureDraft(planId: string, moduleKey: string) {
    setFeatureDraft(draft => ({
      ...draft,
      [planId]: {
        ...(draft[planId] ?? {}),
        [moduleKey]: !draft[planId]?.[moduleKey],
      },
    }));
  }

  function resetFeatureDraft() {
    setFeatureDraft(buildFeatureMatrixDraft(featureMatrixRows));
    setFeatureDraftTitle('Feature matrix update');
    setFeatureDraftEffectiveAt('');
    setFeatureDraftImpact('');
    setFeatureDraftDescription('');
  }

  function featureDraftChanges() {
    const changes: {
      planId: string;
      moduleKey: string;
      current: boolean;
      proposed: boolean;
    }[] = [];

    for (const planId of PLAN_ORDER) {
      for (const feature of featureMatrixRows) {
        const current = Boolean(feature.includedPlans[planId]);
        const proposed = Boolean(featureDraft[planId]?.[feature.key]);
        if (current !== proposed) {
          changes.push({ planId, moduleKey: feature.key, current, proposed });
        }
      }
    }

    return changes;
  }

  async function createFeatureMatrixRequest() {
    const changes = featureDraftChanges();
    if (changes.length === 0) {
      setCatalogError('Make at least one feature matrix change before saving a draft.');
      setCatalogSaved('');
      return;
    }

    setCatalogBusy('feature-matrix');
    setCatalogError('');
    setCatalogSaved('');
    try {
      const moduleEntitlements = Object.fromEntries(
        PLAN_ORDER.map(planId => [
          planId,
          featureMatrixRows
            .filter(feature => Boolean(featureDraft[planId]?.[feature.key]))
            .map(feature => feature.key),
        ]),
      );

      const res = await fetch('/api/platform-admin/product-catalog/change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_type: 'feature_matrix',
          title: featureDraftTitle.trim() || 'Feature matrix update',
          priority: 'medium',
          effective_at: featureDraftEffectiveAt || null,
          impact_summary: featureDraftImpact,
          description: featureDraftDescription || 'Draft feature matrix entitlement proposal.',
          proposal: {
            kind: 'feature_matrix',
            moduleEntitlements,
            changes,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unable to create feature matrix request');

      setCatalogChangeRequests(prev => [json.changeRequest, ...prev]);
      resetFeatureDraft();
      setCatalogSaved('Feature matrix change request created');
    } catch (err) {
      setCatalogError((err as Error).message);
    } finally {
      setCatalogBusy(null);
    }
  }

  async function publishFeatureMatrixRequest() {
    if (!selectedFeaturePublishRequest) {
      setCatalogError('Select an approved feature matrix request before publishing.');
      setCatalogSaved('');
      return;
    }
    if (selectedFeaturePublishChanges.length === 0) {
      setCatalogError('The selected feature matrix request has no changes from the live matrix.');
      setCatalogSaved('');
      return;
    }
    if (!featurePublishNote.trim()) {
      setCatalogError('Add a publish note before applying the feature matrix.');
      setCatalogSaved('');
      return;
    }
    if (!featurePublishConfirming) {
      setFeaturePublishConfirming(true);
      return;
    }

    setCatalogBusy('feature-matrix-publish');
    setCatalogError('');
    setCatalogSaved('');
    try {
      const res = await fetch('/api/platform-admin/product-catalog/feature-matrix/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          change_request_id: selectedFeaturePublishRequest.id,
          change_note: featurePublishNote,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unable to publish feature matrix');

      setFeatureMatrixRows(json.featureMatrix);
      setFeatureDraft(buildFeatureMatrixDraft(json.featureMatrix));
      setCatalogChangeRequests(prev => prev.map(request =>
        request.id === json.changeRequest.id ? json.changeRequest : request,
      ));
      setSelectedFeaturePublishId('');
      setFeaturePublishNote('');
      setFeaturePublishConfirming(false);
      setCatalogSaved('Feature matrix published');
    } catch (err) {
      setCatalogError((err as Error).message);
    } finally {
      setCatalogBusy(null);
    }
  }

  const sandboxPriceRows = priceRows.filter(row => row.environment === 'sandbox');
  const livePriceRows = priceRows.filter(row => row.environment === 'live');
  const matrixChanges = featureDraftChanges();

  function renderLastChange(
    updatedAt: string | null | undefined,
    updatedBy: string | null | undefined,
    note: string | null | undefined,
  ) {
    return (
      <div className={styles.changeMeta}>
        <span>{lastChangeText(updatedAt, updatedBy)}</span>
        <span className={note ? styles.notePreview : styles.noteEmpty}>
          {note || 'No note'}
        </span>
      </div>
    );
  }

  function renderImpact(planId: string) {
    const impact = impactsByPlan.get(planId);
    return (
      <div className={styles.impactCell}>
        <strong>{impactSummary(impact)}</strong>
        <span>{statusBreakdown(impact)}</span>
      </div>
    );
  }

  function renderPriceRows(sectionRows: StripePriceRow[]) {
    return (
      <>
        {sectionRows.map(row => {
          const isEditing = row.id in priceEditing;
          const isBusy = priceSaving === row.id;
          const isSaved = priceSaved[row.id];
          const val = priceEditing[row.id] ?? (row.price_id ?? '');
          const planImpact = row.plan_id === 'rep_team' ? undefined : impactsByPlan.get(row.plan_id);

          return (
            <Fragment key={row.id}>
              <tr className={styles.row} onClick={() => !isEditing && startPriceEdit(row)}>
                <td className={styles.planName}>{PRICE_PLAN_LABELS[row.plan_id] ?? row.plan_id}</td>
                <td className={styles.muted}>
                  {row.billing_cycle.charAt(0).toUpperCase() + row.billing_cycle.slice(1)}
                </td>
                <td className={styles.muted}>{row.product_name ?? 'Not set'}</td>
                <td>{row.plan_id === 'rep_team' ? 'Per-team add-on' : impactSummary(planImpact)}</td>
                <td className={styles.priceIdCell}>
                  {isEditing ? (
                    <input
                      autoFocus
                      className={styles.priceInput}
                      value={val}
                      placeholder="price_..."
                      onChange={event => setPriceEditing(prev => ({ ...prev, [row.id]: event.target.value }))}
                      onKeyDown={event => {
                        if (event.key === 'Enter' && hasSelectedApproval) savePrice(row);
                        if (event.key === 'Escape') cancelPriceEdit(row.id);
                      }}
                      onClick={event => event.stopPropagation()}
                    />
                  ) : (
                    <span className={row.price_id ? styles.priceIdSet : styles.priceIdEmpty}>
                      {row.price_id ?? 'Not set - click to edit'}
                    </span>
                  )}
                </td>
                <td>{renderLastChange(row.updated_at, row.updated_by_email, row.last_change_note)}</td>
                <td className={styles.actionCell} onClick={event => event.stopPropagation()}>
                  {isEditing ? (
                    <span className={styles.actionBtns}>
                      <button className={styles.saveBtn} onClick={() => savePrice(row)} disabled={isBusy || !hasSelectedApproval} title="Save">
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
              {isEditing && (
                <tr className={styles.noteRow}>
                  <td colSpan={7}>
                    <label>
                      <span>Change note</span>
                      <input
                        className={styles.noteInput}
                        value={priceNotes[row.id] ?? ''}
                        placeholder="Why is this Stripe price ID changing?"
                        onChange={event => setPriceNotes(prev => ({ ...prev, [row.id]: event.target.value }))}
                      />
                    </label>
                  </td>
                </tr>
              )}
              {priceErrors[row.id] && (
                <tr className={styles.errorRow}>
                  <td colSpan={7} className={styles.errorCell}>{priceErrors[row.id]}</td>
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
      <header className={styles.pageHeader}>
        <div>
          <div className={styles.headerLabel}>Platform Admin</div>
          <h1 className={styles.title}>Plans &amp; Pricing</h1>
        </div>
        <p className={styles.pageIntro}>
          Manage plan availability, checkout limits, trial windows, and Stripe price IDs with
          subscriber impact visible before each change.
        </p>
      </header>

      <section className={styles.snapshotPanel}>
        <div className={styles.snapshotItem}>
          <span>Total Accounts</span>
          <strong>{totalAccounts}</strong>
        </div>
        <div className={styles.snapshotItem}>
          <span>Paid Plan Accounts</span>
          <strong>{paidAccounts}</strong>
        </div>
        <div className={styles.snapshotItem}>
          <span>Past Due / Canceled</span>
          <strong>{riskAccounts}</strong>
        </div>
      </section>

      <section className={styles.impactPanel}>
        {PLAN_ORDER.map(planId => {
          const impact = impactsByPlan.get(planId);
          const meta = PLAN_META[planId];
          return (
            <div key={planId} className={styles.impactCard}>
              <span>{meta.label}</span>
              <strong>{impactSummary(impact)}</strong>
              <small>{statusBreakdown(impact)}</small>
            </div>
          );
        })}
      </section>

      <section className={styles.approvalPanel}>
        <div>
          <div className={styles.sectionTitle}>Live Change Approval</div>
          <p className={styles.sectionDesc}>
            Availability, limits/trials, and Stripe price ID changes require an approved Product
            Catalog change request before they can be applied. Feature Matrix requests publish from
            the Product Catalog tab.
          </p>
        </div>
        <label className={styles.approvalSelect}>
          <span>Approved Request</span>
          <select
            className={styles.selectInput}
            value={selectedApprovalId}
            onChange={event => setSelectedApprovalId(event.target.value)}
          >
            <option value="">Select approved request</option>
            {approvedLiveChangeRequests.map(request => (
              <option key={request.id} value={request.id}>
                {request.title}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.approvalMeta}>
          {selectedApproval ? (
            <>
              <span className={styles.badgeLive}>Approved</span>
              <span>{optionLabel(CHANGE_REQUEST_TYPES, selectedApproval.request_type)}</span>
              <span>{selectedApproval.impact_summary ?? 'No impact summary'}</span>
            </>
          ) : (
            <>
              <span className={styles.badgeGated}>Required</span>
              <span>{approvedLiveChangeRequests.length} approved request{approvedLiveChangeRequests.length === 1 ? '' : 's'} available</span>
            </>
          )}
        </div>
      </section>

      <nav className={styles.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className={styles.section} hidden={activeTab !== 'availability'}>
        <p className={styles.sectionDesc}>
          Controls whether each plan is available for self-serve checkout or shows an early-access CTA.
          Subscriber impact is based on current customer accounts.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Price</th>
                <th>Subscriber Impact</th>
                <th>Status</th>
                <th>Last Change</th>
                <th>Change Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedGating.map(row => {
                const meta = PLAN_META[row.plan_key] ?? { label: row.plan_key, price: 'Not set', summary: 'No summary configured.' };
                const isLive = row.gating_status === 'live';
                const isBusy = gatingBusy === row.plan_key;
                return (
                  <Fragment key={row.plan_key}>
                    <tr>
                      <td className={styles.planName}>
                        {meta.label}
                        <small className={styles.muted}>{meta.summary}</small>
                      </td>
                      <td className={styles.muted}>{meta.price}</td>
                      <td>{renderImpact(row.plan_key)}</td>
                      <td>
                        <span className={isLive ? styles.badgeLive : styles.badgeGated}>
                          {isLive ? 'Live' : 'Early Access'}
                        </span>
                      </td>
                      <td>{renderLastChange(row.updated_at, row.updated_by_email, row.last_change_note)}</td>
                      <td>
                        <input
                          className={styles.noteInput}
                          value={gatingNotes[row.plan_key] ?? ''}
                          placeholder="Reason for this change"
                          onChange={event => setGatingNotes(prev => ({ ...prev, [row.plan_key]: event.target.value }))}
                        />
                      </td>
                      <td className={styles.actionCell}>
                        <button
                          className={isLive ? styles.deactivateBtn : styles.activateBtn}
                          onClick={() => toggleGating(row.plan_key, row.gating_status)}
                          disabled={isBusy || !hasSelectedApproval}
                        >
                          {isBusy
                            ? <Loader size={12} className={styles.spin} />
                            : isLive ? 'Set Early Access' : 'Set Live'}
                        </button>
                      </td>
                    </tr>
                    {gatingErrors[row.plan_key] && (
                      <tr className={styles.errorRow}>
                        <td colSpan={7} className={styles.errorCell}>{gatingErrors[row.plan_key]}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section} hidden={activeTab !== 'limits'}>
        <p className={styles.sectionDesc}>
          Override per-plan tournament slots, seat caps, and free trial lengths. Blank fields use the
          code default shown as placeholder text.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Subscriber Impact</th>
                <th>Tournament Limit</th>
                <th>Seat Limit</th>
                <th>Trial Days</th>
                <th>Last Change</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {PLAN_ORDER.map(planId => {
                const row = getConfigRow(planId);
                const defaults = configDefaults[planId];
                const meta = PLAN_META[planId];
                const isEditing = configEditPlan === planId;
                const isBusy = isEditing && configSaving;
                const isSaved = configSaved === planId;

                return (
                  <Fragment key={planId}>
                    <tr className={isEditing ? undefined : styles.row} onClick={() => !isEditing && startConfigEdit(planId)}>
                      <td className={styles.planName}>
                        {meta?.label ?? planId}
                        {meta?.summary && <small className={styles.muted}>{meta.summary}</small>}
                      </td>
                      <td>{renderImpact(planId)}</td>
                      <td>
                        {isEditing ? (
                          <input
                            autoFocus
                            type="number"
                            min={0}
                            className={styles.numInput}
                            value={configDraft?.tournament_limit ?? ''}
                            placeholder={defaults ? String(defaults.tournamentLimit) : ''}
                            onChange={event => setConfigDraft(draft => draft ? { ...draft, tournament_limit: event.target.value } : draft)}
                            onClick={event => event.stopPropagation()}
                          />
                        ) : (
                          <span className={row?.tournament_limit != null ? styles.numValue : styles.numEmpty}>
                            {row?.tournament_limit != null ? row.tournament_limit : 'Default'}
                          </span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            className={styles.numInput}
                            value={configDraft?.seat_limit ?? ''}
                            placeholder={defaults ? String(defaults.seatLimit) : ''}
                            onChange={event => setConfigDraft(draft => draft ? { ...draft, seat_limit: event.target.value } : draft)}
                            onClick={event => event.stopPropagation()}
                          />
                        ) : (
                          <span className={row?.seat_limit != null ? styles.numValue : styles.numEmpty}>
                            {row?.seat_limit != null ? row.seat_limit : 'Default'}
                          </span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            className={styles.numInput}
                            value={configDraft?.trial_days ?? ''}
                            placeholder={defaults ? String(defaults.trialDays) : ''}
                            onChange={event => setConfigDraft(draft => draft ? { ...draft, trial_days: event.target.value } : draft)}
                            onClick={event => event.stopPropagation()}
                          />
                        ) : (
                          <span className={row?.trial_days != null ? styles.numValue : styles.numEmpty}>
                            {row?.trial_days != null ? row.trial_days : 'Default'}
                          </span>
                        )}
                      </td>
                      <td>{renderLastChange(row?.updated_at, row?.updated_by_email, row?.last_change_note)}</td>
                      <td className={styles.actionCell} onClick={event => event.stopPropagation()}>
                        {isEditing ? (
                          <span className={styles.actionBtns}>
                            <button className={styles.saveBtn} onClick={() => saveConfig(planId)} disabled={isBusy || !hasSelectedApproval} title="Save">
                              {isBusy ? <Loader size={12} className={styles.spin} /> : <Check size={12} />}
                            </button>
                            <button className={styles.cancelBtn} onClick={cancelConfigEdit} disabled={isBusy} title="Cancel">
                              <X size={12} />
                            </button>
                          </span>
                        ) : isSaved ? (
                          <span className={styles.savedLabel}>Saved</span>
                        ) : (
                          <button className={styles.editBtn} onClick={() => startConfigEdit(planId)}>Edit</button>
                        )}
                      </td>
                    </tr>
                    {isEditing && (
                      <tr className={styles.noteRow}>
                        <td colSpan={7}>
                          <label>
                            <span>Change note</span>
                            <input
                              className={styles.noteInput}
                              value={configChangeNote}
                              placeholder={`Why are ${impactSummary(impactsByPlan.get(planId))} being affected?`}
                              onChange={event => setConfigChangeNote(event.target.value)}
                            />
                          </label>
                        </td>
                      </tr>
                    )}
                    {isEditing && configError && (
                      <tr className={styles.errorRow}>
                        <td colSpan={7} className={styles.errorCell}>{configError}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section} hidden={activeTab !== 'catalog'}>
        <p className={styles.sectionDesc}>
          Review the current product catalog, module packaging, and planned add-ons before pricing or
          entitlement changes become live customer-facing work.
        </p>

        <div className={styles.catalogSummary}>
          <div>
            <span>Catalog Versions</span>
            <strong>{catalogVersions.length}</strong>
          </div>
          <div>
            <span>Add-ons</span>
            <strong>{addonCatalog.length}</strong>
          </div>
          <div>
            <span>Plan Modules</span>
            <strong>{featureMatrixRows.length}</strong>
          </div>
          <div>
            <span>Change Requests</span>
            <strong>{catalogChangeRequests.length}</strong>
          </div>
          <div>
            <span>Campaigns</span>
            <strong>{catalogCampaigns.length}</strong>
          </div>
        </div>

        {(catalogError || catalogSaved) && (
          <div className={catalogError ? styles.errorBanner : styles.successBanner}>
            {catalogError || catalogSaved}
          </div>
        )}

        <div className={styles.catalogModeBar}>
          <div className={styles.inlineTabs} role="tablist" aria-label="Product catalog workspace">
            {CATALOG_VIEWS.map(view => (
              <button
                key={view.id}
                type="button"
                className={`${styles.inlineTab} ${catalogView === view.id ? styles.inlineTabActive : ''}`}
                onClick={() => setCatalogView(view.id)}
                role="tab"
                aria-selected={catalogView === view.id}
              >
                {view.label}
              </button>
            ))}
          </div>
          <p className={styles.catalogModeNote}>
            {catalogView === 'planning'
              ? 'Track proposed changes and campaigns before anything becomes live.'
              : catalogView === 'matrix'
                ? 'Review, draft, and publish plan/module entitlement changes.'
                : 'Review baseline plan versions and add-on catalog records.'}
          </p>
        </div>

        {catalogView === 'planning' && (
          <>
        <section className={styles.governancePanel}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Planned Changes</h2>
            <p className={styles.sectionDesc}>
              Track proposed pricing, entitlement, add-on, campaign, and grandfathering work before
              anything changes for customers.
            </p>
          </div>

          {canManageProduct && (
            <div className={styles.formPanel}>
              <label className={styles.fieldLabel}>
                <span>Title</span>
                <input
                  className={styles.noteInput}
                  value={changeDraft.title}
                  placeholder="Example: League launch pricing update"
                  onChange={event => setChangeDraft(draft => ({ ...draft, title: event.target.value }))}
                />
              </label>
              <label className={styles.fieldLabel}>
                <span>Type</span>
                <select
                  className={styles.selectInput}
                  value={changeDraft.request_type}
                  onChange={event => setChangeDraft(draft => ({ ...draft, request_type: event.target.value }))}
                >
                  {CHANGE_REQUEST_TYPES.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className={styles.fieldLabel}>
                <span>Priority</span>
                <select
                  className={styles.selectInput}
                  value={changeDraft.priority}
                  onChange={event => setChangeDraft(draft => ({ ...draft, priority: event.target.value }))}
                >
                  {PRIORITIES.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className={styles.fieldLabel}>
                <span>Target Plan</span>
                <select
                  className={styles.selectInput}
                  value={changeDraft.target_plan_id}
                  onChange={event => setChangeDraft(draft => ({ ...draft, target_plan_id: event.target.value }))}
                >
                  <option value="">No specific plan</option>
                  {PLAN_ORDER.map(planId => (
                    <option key={planId} value={planId}>{planLabel(planId)}</option>
                  ))}
                </select>
              </label>
              <label className={styles.fieldLabel}>
                <span>Effective Date</span>
                <input
                  className={styles.noteInput}
                  type="date"
                  value={changeDraft.effective_at}
                  onChange={event => setChangeDraft(draft => ({ ...draft, effective_at: event.target.value }))}
                />
              </label>
              <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
                <span>Impact Summary</span>
                <input
                  className={styles.noteInput}
                  value={changeDraft.impact_summary}
                  placeholder="Who is affected, and what needs review before approval?"
                  onChange={event => setChangeDraft(draft => ({ ...draft, impact_summary: event.target.value }))}
                />
              </label>
              <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
                <span>Description</span>
                <textarea
                  className={styles.textArea}
                  value={changeDraft.description}
                  placeholder="Describe the proposed change, approval criteria, and launch notes."
                  onChange={event => setChangeDraft(draft => ({ ...draft, description: event.target.value }))}
                />
              </label>
              <div className={styles.formActions}>
                <button
                  className={styles.activateBtn}
                  onClick={createChangeRequest}
                  disabled={catalogBusy === 'change-request' || !changeDraft.title.trim()}
                >
                  {catalogBusy === 'change-request' ? <Loader size={12} className={styles.spin} /> : 'Add Request'}
                </button>
              </div>
            </div>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Target</th>
                  <th>Effective</th>
                  <th>Owner</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {catalogChangeRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.emptyCell}>No product catalog change requests yet.</td>
                  </tr>
                ) : catalogChangeRequests.map(request => (
                  <tr key={request.id}>
                    <td className={styles.planName}>
                      {request.title}
                      <small className={styles.muted}>
                        {optionLabel(CHANGE_REQUEST_TYPES, request.request_type)}
                        {request.impact_summary ? ` / ${request.impact_summary}` : ''}
                      </small>
                    </td>
                    <td>
                      <span className={statusClass(request.status)}>
                        {optionLabel(CHANGE_REQUEST_STATUSES, request.status)}
                      </span>
                    </td>
                    <td className={styles.muted}>{optionLabel(PRIORITIES, request.priority)}</td>
                    <td className={styles.muted}>
                      {request.target_plan_id ? planLabel(request.target_plan_id) : request.target_addon_key ?? 'General'}
                    </td>
                    <td className={styles.muted}>{formatDateOnly(request.effective_at)}</td>
                    <td className={styles.muted}>{request.created_by_email}</td>
                    <td className={styles.actionCell}>
                      {canManageProduct ? (
                        <select
                          className={styles.selectInput}
                          value={request.status}
                          disabled={catalogBusy === request.id}
                          onChange={event => updateChangeRequestStatus(request.id, event.target.value)}
                        >
                          {CHANGE_REQUEST_STATUSES.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={styles.muted}>Read only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.governancePanel}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Campaign Tracking</h2>
            <p className={styles.sectionDesc}>
              Track coupon, promo, trial, launch, and retention campaigns separately from live Stripe
              price IDs.
            </p>
          </div>

          {canManageProduct && (
            <div className={styles.formPanel}>
              <label className={styles.fieldLabel}>
                <span>Title</span>
                <input
                  className={styles.noteInput}
                  value={campaignDraft.title}
                  placeholder="Example: Club 90-day launch trial"
                  onChange={event => setCampaignDraft(draft => ({ ...draft, title: event.target.value }))}
                />
              </label>
              <label className={styles.fieldLabel}>
                <span>Type</span>
                <select
                  className={styles.selectInput}
                  value={campaignDraft.campaign_type}
                  onChange={event => setCampaignDraft(draft => ({ ...draft, campaign_type: event.target.value }))}
                >
                  {CAMPAIGN_TYPES.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className={styles.fieldLabel}>
                <span>Status</span>
                <select
                  className={styles.selectInput}
                  value={campaignDraft.status}
                  onChange={event => setCampaignDraft(draft => ({ ...draft, status: event.target.value }))}
                >
                  {CAMPAIGN_STATUSES.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className={styles.fieldLabel}>
                <span>Starts</span>
                <input
                  className={styles.noteInput}
                  type="date"
                  value={campaignDraft.starts_at}
                  onChange={event => setCampaignDraft(draft => ({ ...draft, starts_at: event.target.value }))}
                />
              </label>
              <label className={styles.fieldLabel}>
                <span>Ends</span>
                <input
                  className={styles.noteInput}
                  type="date"
                  value={campaignDraft.ends_at}
                  onChange={event => setCampaignDraft(draft => ({ ...draft, ends_at: event.target.value }))}
                />
              </label>
              <label className={styles.fieldLabel}>
                <span>Coupon Code</span>
                <input
                  className={styles.noteInput}
                  value={campaignDraft.coupon_code}
                  placeholder="Optional"
                  onChange={event => setCampaignDraft(draft => ({ ...draft, coupon_code: event.target.value }))}
                />
              </label>
              <label className={styles.fieldLabel}>
                <span>Trial Days</span>
                <input
                  className={styles.noteInput}
                  type="number"
                  min={0}
                  value={campaignDraft.trial_days}
                  placeholder="Optional"
                  onChange={event => setCampaignDraft(draft => ({ ...draft, trial_days: event.target.value }))}
                />
              </label>
              <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
                <span>Target Plans</span>
                <span className={styles.checkboxGroup}>
                  {PLAN_ORDER.map(planId => (
                    <label key={planId}>
                      <input
                        type="checkbox"
                        checked={campaignDraft.target_plan_ids.includes(planId)}
                        onChange={() => toggleCampaignPlan(planId)}
                      />
                      {planLabel(planId)}
                    </label>
                  ))}
                </span>
              </label>
              <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
                <span>Discount Summary</span>
                <input
                  className={styles.noteInput}
                  value={campaignDraft.discount_summary}
                  placeholder="Example: 20% off annual League for first season"
                  onChange={event => setCampaignDraft(draft => ({ ...draft, discount_summary: event.target.value }))}
                />
              </label>
              <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
                <span>Notes</span>
                <textarea
                  className={styles.textArea}
                  value={campaignDraft.notes}
                  placeholder="Add eligibility, approval, and launch notes."
                  onChange={event => setCampaignDraft(draft => ({ ...draft, notes: event.target.value }))}
                />
              </label>
              <div className={styles.formActions}>
                <button
                  className={styles.activateBtn}
                  onClick={createCampaign}
                  disabled={catalogBusy === 'campaign' || !campaignDraft.title.trim()}
                >
                  {catalogBusy === 'campaign' ? <Loader size={12} className={styles.spin} /> : 'Add Campaign'}
                </button>
              </div>
            </div>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Target Plans</th>
                  <th>Window</th>
                  <th>Offer</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {catalogCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.emptyCell}>No product campaigns yet.</td>
                  </tr>
                ) : catalogCampaigns.map(campaign => (
                  <tr key={campaign.id}>
                    <td className={styles.planName}>
                      {campaign.title}
                      <small className={styles.muted}>{campaign.coupon_code ?? campaign.campaign_key}</small>
                    </td>
                    <td>
                      <span className={statusClass(campaign.status)}>
                        {optionLabel(CAMPAIGN_STATUSES, campaign.status)}
                      </span>
                    </td>
                    <td className={styles.muted}>{optionLabel(CAMPAIGN_TYPES, campaign.campaign_type)}</td>
                    <td className={styles.muted}>{formatPlanList(campaign.target_plan_ids)}</td>
                    <td className={styles.muted}>
                      {formatDateOnly(campaign.starts_at)} - {formatDateOnly(campaign.ends_at)}
                    </td>
                    <td className={styles.muted}>
                      {campaign.discount_summary ?? (campaign.trial_days != null ? `${campaign.trial_days} trial days` : 'Not set')}
                    </td>
                    <td className={styles.actionCell}>
                      {canManageProduct ? (
                        <select
                          className={styles.selectInput}
                          value={campaign.status}
                          disabled={catalogBusy === campaign.id}
                          onChange={event => updateCampaignStatus(campaign.id, event.target.value)}
                        >
                          {CAMPAIGN_STATUSES.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={styles.muted}>Read only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
          </>
        )}

        {catalogView === 'records' && (
        <div className={styles.catalogGrid}>
          <section className={styles.catalogPanel}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Plan Versions</h2>
              <p className={styles.sectionDesc}>
                Published and draft catalog records. Future live publishing controls should hang off
                this history instead of ad hoc edits.
              </p>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Status</th>
                    <th>Effective</th>
                    <th>Published</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogVersions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={styles.emptyCell}>
                        No catalog versions found. Apply migration 058 to seed the baseline catalog.
                      </td>
                    </tr>
                  ) : catalogVersions.map(version => (
                    <tr key={version.id}>
                      <td className={styles.planName}>
                        {version.title}
                        <small className={styles.muted}>{version.description ?? version.version_key}</small>
                      </td>
                      <td>
                        <span className={statusClass(version.status)}>{version.status.replace('_', ' ')}</span>
                      </td>
                      <td className={styles.muted}>{formatDate(version.effective_at)}</td>
                      <td className={styles.muted}>{formatDate(version.published_at)}</td>
                      <td className={styles.notePreview}>{version.notes ?? 'No note'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.catalogPanel}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Add-on Catalog</h2>
              <p className={styles.sectionDesc}>
                Add-ons and packaged modules that can later support public pricing, coupons, and
                grandfathering rules.
              </p>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Add-on</th>
                    <th>Status</th>
                    <th>Included Plans</th>
                    <th>Pricing</th>
                  </tr>
                </thead>
                <tbody>
                  {addonCatalog.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={styles.emptyCell}>
                        No add-ons found. Apply migration 058 to seed the catalog.
                      </td>
                    </tr>
                  ) : addonCatalog.map(addon => (
                    <tr key={addon.id}>
                      <td className={styles.planName}>
                        {addon.label}
                        <small className={styles.muted}>{addon.description ?? addon.addon_key}</small>
                      </td>
                      <td>
                        <span className={statusClass(addon.status)}>{addon.status.replace('_', ' ')}</span>
                      </td>
                      <td className={styles.muted}>{formatPlanList(addon.default_included_plans)}</td>
                      <td className={styles.muted}>
                        {addon.pricing_model === 'included'
                          ? 'Included'
                          : `${formatMoney(addon.monthly_price)} monthly / ${formatMoney(addon.annual_price)} annual`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        )}

        {catalogView === 'matrix' && (
          <>
        <section className={styles.featureMatrixSection}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Feature Matrix</h2>
            <p className={styles.sectionDesc}>
              Module entitlements from the published product catalog matrix. Draft edits below create
              Product Catalog change requests; approved requests can be published from the review panel.
            </p>
          </div>
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.matrixTable}`}>
              <thead>
                <tr>
                  <th>Module</th>
                  {PLAN_ORDER.map(planId => (
                    <th key={planId}>{planLabel(planId)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureMatrixRows.map(feature => (
                  <tr key={feature.key}>
                    <td className={styles.planName}>
                      {feature.label}
                      <small className={styles.muted}>{feature.description}</small>
                    </td>
                    {PLAN_ORDER.map(planId => {
                      const included = feature.includedPlans[planId];
                      return (
                        <td key={planId} className={styles.matrixCell}>
                          <span className={included ? styles.includedMark : styles.excludedMark}>
                            {included ? <Check size={14} /> : <X size={14} />}
                            {included ? 'Included' : 'Not included'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.featureMatrixSection}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Publish Approved Matrix</h2>
            <p className={styles.sectionDesc}>
              Select an approved Feature Matrix request, review the exact plan/module changes, then
              publish it into the live product catalog matrix.
            </p>
          </div>

          {canManageProduct ? (
            <div className={styles.publishPanel}>
              <label className={styles.fieldLabel}>
                <span>Approved Feature Matrix Request</span>
                <select
                  className={styles.selectInput}
                  value={selectedFeaturePublishId}
                  onChange={event => {
                    setSelectedFeaturePublishId(event.target.value);
                    setFeaturePublishConfirming(false);
                  }}
                >
                  <option value="">Select approved matrix request</option>
                  {approvedFeatureMatrixRequests.map(request => (
                    <option key={request.id} value={request.id}>{request.title}</option>
                  ))}
                </select>
              </label>

              {selectedFeaturePublishRequest ? (
                <>
                  <div className={styles.proposalPreview}>
                    <div>
                      <span className={styles.headerLabel}>Proposal</span>
                      <strong>{selectedFeaturePublishRequest.title}</strong>
                      <small>{selectedFeaturePublishRequest.impact_summary ?? 'No impact summary'}</small>
                    </div>
                    <div>
                      <span className={styles.headerLabel}>Preview</span>
                      <strong>{selectedFeaturePublishChanges.length} change{selectedFeaturePublishChanges.length === 1 ? '' : 's'}</strong>
                      <small>{selectedFeaturePublishEntitlements ? 'Validated feature matrix proposal' : 'Invalid proposal payload'}</small>
                    </div>
                  </div>

                  {selectedFeaturePublishChanges.length > 0 ? (
                    <div className={styles.changeList}>
                      {selectedFeaturePublishChanges.map(change => (
                        <div key={`${change.planId}:${change.moduleKey}`} className={styles.changeItem}>
                          <span>{planLabel(change.planId)}</span>
                          <strong>{change.moduleKey.replace('module_', '').replace(/_/g, ' ')}</strong>
                          <small>
                            {change.current ? 'Included' : 'Not included'} to {change.proposed ? 'included' : 'not included'}
                          </small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyCell}>This approved request matches the current live matrix.</div>
                  )}

                  <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
                    <span>Publish Note</span>
                    <input
                      className={styles.noteInput}
                      value={featurePublishNote}
                      placeholder="Summarize why this approved matrix is being published now."
                      onChange={event => {
                        setFeaturePublishNote(event.target.value);
                        setFeaturePublishConfirming(false);
                      }}
                    />
                  </label>

                  <div className={styles.featureDraftFooter}>
                    <span>
                      {featurePublishConfirming
                        ? 'Click confirm to publish these entitlement changes.'
                        : 'Review the preview before publishing.'}
                    </span>
                    <button
                      type="button"
                      className={styles.activateBtn}
                      onClick={publishFeatureMatrixRequest}
                      disabled={
                        catalogBusy === 'feature-matrix-publish' ||
                        selectedFeaturePublishChanges.length === 0 ||
                        !selectedFeaturePublishEntitlements
                      }
                    >
                      {catalogBusy === 'feature-matrix-publish'
                        ? <Loader size={12} className={styles.spin} />
                        : featurePublishConfirming ? 'Confirm Publish' : 'Publish Matrix'}
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.emptyCell}>
                  {approvedFeatureMatrixRequests.length === 0
                    ? 'No approved Feature Matrix requests are ready to publish.'
                    : 'Select an approved request to preview its matrix changes.'}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.emptyCell}>Read-only roles can review published entitlements but cannot publish matrix changes.</div>
          )}
        </section>

        <section className={styles.featureMatrixSection}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Draft Feature Matrix Change</h2>
            <p className={styles.sectionDesc}>
              Toggle proposed module access by plan, then save the draft into the approval workflow.
              Live entitlements stay unchanged until a later approved implementation.
            </p>
          </div>

          {canManageProduct ? (
            <>
              <div className={styles.formPanel}>
                <label className={styles.fieldLabel}>
                  <span>Title</span>
                  <input
                    className={styles.noteInput}
                    value={featureDraftTitle}
                    onChange={event => setFeatureDraftTitle(event.target.value)}
                  />
                </label>
                <label className={styles.fieldLabel}>
                  <span>Effective Date</span>
                  <input
                    className={styles.noteInput}
                    type="date"
                    value={featureDraftEffectiveAt}
                    onChange={event => setFeatureDraftEffectiveAt(event.target.value)}
                  />
                </label>
                <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
                  <span>Impact Summary</span>
                  <input
                    className={styles.noteInput}
                    value={featureDraftImpact}
                    placeholder="Who would be affected if this matrix is later implemented?"
                    onChange={event => setFeatureDraftImpact(event.target.value)}
                  />
                </label>
                <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
                  <span>Description</span>
                  <textarea
                    className={styles.textArea}
                    value={featureDraftDescription}
                    placeholder="Explain the packaging reason, launch notes, and approval criteria."
                    onChange={event => setFeatureDraftDescription(event.target.value)}
                  />
                </label>
              </div>

              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${styles.matrixTable}`}>
                  <thead>
                    <tr>
                      <th>Module</th>
                      {PLAN_ORDER.map(planId => (
                        <th key={planId}>{planLabel(planId)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {featureMatrixRows.map(feature => (
                      <tr key={feature.key}>
                        <td className={styles.planName}>
                          {feature.label}
                          <small className={styles.muted}>{feature.description}</small>
                        </td>
                        {PLAN_ORDER.map(planId => {
                          const current = Boolean(feature.includedPlans[planId]);
                          const proposed = Boolean(featureDraft[planId]?.[feature.key]);
                          const changed = current !== proposed;
                          return (
                            <td key={planId} className={styles.matrixCell}>
                              <button
                                type="button"
                                className={`${styles.matrixToggle} ${proposed ? styles.matrixToggleOn : ''} ${changed ? styles.matrixToggleChanged : ''}`}
                                onClick={() => toggleFeatureDraft(planId, feature.key)}
                              >
                                {proposed ? <Check size={14} /> : <X size={14} />}
                                {proposed ? 'Included' : 'Not included'}
                              </button>
                              {changed && (
                                <small className={styles.matrixDelta}>
                                  was {current ? 'included' : 'not included'}
                                </small>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.featureDraftFooter}>
                <span>{matrixChanges.length} proposed change{matrixChanges.length === 1 ? '' : 's'}</span>
                <span className={styles.actionBtns}>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={resetFeatureDraft}
                    disabled={catalogBusy === 'feature-matrix'}
                  >
                    Reset Draft
                  </button>
                  <button
                    type="button"
                    className={styles.activateBtn}
                    onClick={createFeatureMatrixRequest}
                    disabled={catalogBusy === 'feature-matrix' || matrixChanges.length === 0}
                  >
                    {catalogBusy === 'feature-matrix'
                      ? <Loader size={12} className={styles.spin} />
                      : 'Save Draft Request'}
                  </button>
                </span>
              </div>
            </>
          ) : (
            <div className={styles.emptyCell}>Read-only roles can review the feature matrix but cannot draft entitlement changes.</div>
          )}
        </section>
          </>
        )}
      </section>

      <section className={styles.section} hidden={activeTab !== 'prices'}>
        <p className={styles.sectionDesc}>
          Stripe price IDs for each plan and billing cycle. Production IDs are shown first for launch
          review; test IDs remain one tab away for checkout testing.
        </p>

        <div className={styles.inlineTabs} role="tablist" aria-label="Stripe price environment">
          <button
            type="button"
            className={`${styles.inlineTab} ${priceEnvironmentTab === 'live' ? styles.inlineTabActive : ''}`}
            onClick={() => setPriceEnvironmentTab('live')}
            role="tab"
            aria-selected={priceEnvironmentTab === 'live'}
          >
            Production
          </button>
          <button
            type="button"
            className={`${styles.inlineTab} ${priceEnvironmentTab === 'sandbox' ? styles.inlineTabActive : ''}`}
            onClick={() => setPriceEnvironmentTab('sandbox')}
            role="tab"
            aria-selected={priceEnvironmentTab === 'sandbox'}
          >
            Test
          </button>
        </div>

        <div className={styles.environmentNote}>
          <span className={priceEnvironmentTab === 'live' ? styles.badgeLiveEnv : styles.badgeSandbox}>
            {priceEnvironmentTab === 'live' ? 'Production / Live Mode' : 'Test / Sandbox Mode'}
          </span>
          <span>
            {priceEnvironmentTab === 'live'
              ? 'These are the price IDs used with live Stripe keys.'
              : 'These are the price IDs used with test Stripe keys.'}
          </span>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Cycle</th>
                <th>Product Name</th>
                <th>Customer Impact</th>
                <th>Price ID</th>
                <th>Last Change</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {renderPriceRows(priceEnvironmentTab === 'live' ? livePriceRows : sandboxPriceRows)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
