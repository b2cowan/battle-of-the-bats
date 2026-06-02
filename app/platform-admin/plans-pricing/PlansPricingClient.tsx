'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader, Check, X } from 'lucide-react';
import { PLAN_CONFIG, formatPriceAmount } from '@/lib/plan-config';
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
import { pluralize } from '@/lib/utils';

type Tab = 'plans' | 'catalog';
type PriceEnvironmentTab = 'live' | 'sandbox';
type CatalogView = 'planning' | 'matrix' | 'records';

const TABS: { id: Tab; label: string }[] = [
  { id: 'plans', label: 'Plans' },
  { id: 'catalog', label: 'Product Catalog' },
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

type PriceChangeRequestDraft = {
  row: StripePriceRow;
  proposedPriceId: string;
  changeNote: string;
  title: string;
  priority: string;
  impact_summary: string;
  description: string;
  target_plan_id: string | null;
  target_addon_key: string | null;
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

type PlanChangeRequestDraft = {
  request_type: string;
  title: string;
  priority: string;
  impact_summary: string;
  description: string;
  target_plan_id: string;
  proposal: PlanGatingUpdateProposal | PlanConfigUpdateProposal;
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
type PriceProductGroup = {
  planId: string;
  label: string;
  productName: string;
  rows: StripePriceRow[];
  monthly: StripePriceRow | null;
  annual: StripePriceRow | null;
};

const PLAN_ORDER = ['tournament', 'team', 'tournament_plus', 'league', 'club'];

const PLAN_META: Record<string, { label: string; price: string; summary: string }> = {
  tournament: { label: 'Tournament', price: 'Free', summary: 'Starter event tier: 1 tournament, standard registration, FieldLogicHQ styling.' },
  team: { label: 'Team', price: `${formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)}/mo`, summary: 'Standalone coach workspace with one rep team, coaches portal, and one free-tier tournament slot.' },
  tournament_plus: { label: 'Tournament Plus', price: `${formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}/mo`, summary: 'Serious tournament operations: unlimited slots, unlimited seats, registration control, branding, automation.' },
  league: { label: 'League', price: `${formatPriceAmount(PLAN_CONFIG.league.monthlyPrice)}/mo`, summary: 'House league, registration, public organization page, and league workflows.' },
  club: { label: 'Club', price: `${formatPriceAmount(PLAN_CONFIG.club.monthlyPrice)}/mo`, summary: 'Full club operations with accounting, rep teams, and coaches portal.' },
};

const PRICE_PLAN_LABELS: Record<string, string> = {
  team: 'Team',
  tournament_plus: 'Tournament Plus',
  league: 'League',
  club: 'Club',
  org_team_addon: 'Org Team Add-on',
  rep_team: 'Club Extra Rep Team',
};

const PRICE_PLAN_ORDER = ['team', 'tournament_plus', 'league', 'club', 'org_team_addon', 'rep_team'];
const ADDON_CATALOG_KEY_BY_PRICE_PLAN: Record<string, string> = {
  org_team_addon: 'org_team_addon',
  rep_team: 'extra_rep_team',
};

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

function gatingStatusLabel(status: string | null | undefined) {
  return status === 'live' ? 'Live' : 'Early Access';
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

function cleanProductName(value: string | null | undefined) {
  if (!value) return 'Not set';
  return value
    .replace(/\s*(?:-|\u2013|\u2014)\s*\$[\d,.]+(?:\s*[A-Z]{3})?/g, '')
    .replace(/\(\s*\$[\d,.]+(?:\s*[A-Z]{3})?\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
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

function formatMonthDay(value: string | null | undefined) {
  if (!value) return 'Not changed';
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
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

function getStripePriceProposal(request: CatalogChangeRequestRow): StripePriceUpdateProposal | null {
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

function priceRequestTargets(row: StripePriceRow) {
  if (PLAN_ORDER.includes(row.plan_id)) {
    return { target_plan_id: row.plan_id, target_addon_key: null };
  }

  return { target_plan_id: null, target_addon_key: row.plan_id };
}

function buildPriceChangeRequestDraft(
  row: StripePriceRow,
  proposedPriceId: string,
  changeNote: string,
  planImpact: PlanImpact | undefined,
): PriceChangeRequestDraft {
  const planName = PRICE_PLAN_LABELS[row.plan_id] ?? row.plan_id;
  const cycle = row.billing_cycle.charAt(0).toUpperCase() + row.billing_cycle.slice(1);
  const environment = row.environment === 'live' ? 'Production' : 'Test';
  const targets = priceRequestTargets(row);
  const currentPrice = row.price_id ?? 'not set';
  const nextPrice = proposedPriceId || 'clear current price ID';
  const affected = row.plan_id === 'rep_team' || row.plan_id === 'org_team_addon'
    ? 'new add-on purchases'
    : impactSummary(planImpact);
  const impactSummaryText = row.price_id
    ? proposedPriceId
      ? `${environment} ${cycle} ${planName}: update Stripe price from ${currentPrice} to ${nextPrice}; affects ${affected}.`
      : `${environment} ${cycle} ${planName}: clear Stripe price ${currentPrice}; affects ${affected}.`
    : proposedPriceId
      ? `${environment} ${cycle} ${planName}: set Stripe price to ${nextPrice}; affects ${affected}.`
      : `${environment} ${cycle} ${planName}: keep Stripe price unset; affects ${affected}.`;

  return {
    row,
    proposedPriceId,
    changeNote,
    title: `${row.price_id ? 'Update' : 'Set'} ${environment} ${planName} ${cycle} Stripe price`,
    priority: row.environment === 'live' ? 'high' : 'medium',
    impact_summary: impactSummaryText,
    description: [
      `Current price ID: ${currentPrice}.`,
      `Proposed price ID: ${nextPrice}.`,
      `Scope: ${environment} ${cycle} row for ${planName}.`,
      changeNote ? `Operator note: ${changeNote}` : 'Operator note: not provided.',
    ].join('\n'),
    ...targets,
  };
}

function buildPriceProductGroups(rows: StripePriceRow[]): PriceProductGroup[] {
  return PRICE_PLAN_ORDER
    .map(planId => {
      const groupRows = rows.filter(row => row.plan_id === planId);
      if (groupRows.length === 0) return null;

      return {
        planId,
        label: PRICE_PLAN_LABELS[planId] ?? planId,
        productName: groupRows.find(row => row.product_name)?.product_name ?? 'Not set',
        rows: groupRows,
        monthly: groupRows.find(row => row.billing_cycle === 'monthly') ?? null,
        annual: groupRows.find(row => row.billing_cycle === 'annual') ?? null,
      };
    })
    .filter((group): group is PriceProductGroup => group !== null);
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
  const [activeTab, setActiveTab] = useState<Tab>('plans');
  const [priceEnvironmentTab, setPriceEnvironmentTab] = useState<PriceEnvironmentTab>('live');
  const [catalogView, setCatalogView] = useState<CatalogView>('planning');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [catalogChangeRequests, setCatalogChangeRequests] = useState<CatalogChangeRequestRow[]>(changeRequests);
  const [catalogCampaigns, setCatalogCampaigns] = useState<CatalogCampaignRow[]>(campaigns);
  const [featureMatrixRows, setFeatureMatrixRows] = useState<FeatureMatrixRow[]>(featureMatrix);
  const [selectedFeaturePublishId, setSelectedFeaturePublishId] = useState('');
  const [featurePublishNote, setFeaturePublishNote] = useState('');
  const [featurePublishConfirming, setFeaturePublishConfirming] = useState(false);

  const impactsByPlan = useMemo(
    () => new Map(planImpacts.map(impact => [impact.planId, impact])),
    [planImpacts],
  );
  const approvedFeatureMatrixRequests = useMemo(
    () => catalogChangeRequests.filter(request => request.status === 'approved' && request.request_type === 'feature_matrix'),
    [catalogChangeRequests],
  );
  const selectedFeaturePublishRequest = approvedFeatureMatrixRequests.find(request => request.id === selectedFeaturePublishId) ?? null;
  const selectedFeaturePublishEntitlements = selectedFeaturePublishRequest
    ? featureMatrixEntitlementsFromRequest(selectedFeaturePublishRequest)
    : null;
  const selectedFeaturePublishChanges = featureMatrixProposalChanges(featureMatrixRows, selectedFeaturePublishEntitlements);
  const totalAccounts = planImpacts.reduce((sum, impact) => sum + impact.total, 0);
  const paidAccounts = planImpacts
    .filter(impact => impact.planId !== 'tournament')
    .reduce((sum, impact) => sum + impact.total, 0);
  const riskAccounts = planImpacts.reduce(
    (sum, impact) => sum + impact.past_due + impact.canceled,
    0,
  );

  const [gatingRows] = useState<PlanGatingRow[]>(initialGating);
  const [gatingNotes, setGatingNotes] = useState<Record<string, string>>({});

  function getGatingRow(planId: string) {
    return gatingRows.find(row => row.plan_key === planId);
  }

  const [configRows] = useState<PlanConfigOverrideRow[]>(initialConfig);
  const [configEditPlan, setConfigEditPlan] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState<ConfigDraft | null>(null);
  const [configChangeNote, setConfigChangeNote] = useState('');
  const [configError, setConfigError] = useState('');
  const [planRequestDraft, setPlanRequestDraft] = useState<PlanChangeRequestDraft | null>(null);
  const [planRequestError, setPlanRequestError] = useState('');

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
  }

  function cancelConfigEdit() {
    setConfigEditPlan(null);
    setConfigDraft(null);
    setConfigChangeNote('');
    setConfigError('');
  }

  function saveConfig(planId: string) {
    if (!configDraft) return;
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

    const parsedValues = [parsedTournamentLimit, parsedSeatLimit, parsedTrialDays];
    if (parsedValues.some(value => value !== null && (!Number.isInteger(value) || value < 0))) {
      setConfigError('Limits and trial days must be blank or non-negative whole numbers.');
      return;
    }

    const row = getConfigRow(planId);
    const current = {
      tournamentLimit: row?.tournament_limit ?? null,
      seatLimit: row?.seat_limit ?? null,
      trialDays: row?.trial_days ?? null,
    };
    const proposed = {
      tournamentLimit: parsedTournamentLimit,
      seatLimit: parsedSeatLimit,
      trialDays: parsedTrialDays,
    };

    if (
      current.tournamentLimit === proposed.tournamentLimit &&
      current.seatLimit === proposed.seatLimit &&
      current.trialDays === proposed.trialDays
    ) {
      setConfigError('Make at least one limit or trial change before requesting review.');
      return;
    }

    const planName = planLabel(planId);
    const affected = impactSummary(impactsByPlan.get(planId));
    const changeNote = configChangeNote.trim();
    const trialOnly =
      current.tournamentLimit === proposed.tournamentLimit &&
      current.seatLimit === proposed.seatLimit &&
      current.trialDays !== proposed.trialDays;

    setPlanRequestDraft({
      request_type: trialOnly ? 'trial' : 'plan_version',
      title: `Update ${planName} limits and trials`,
      priority: 'medium',
      target_plan_id: planId,
      impact_summary: `${planName}: limits/trials update affects ${affected}.`,
      description: [
        `Current limits: ${current.tournamentLimit ?? 'default'} tournaments, ${current.seatLimit ?? 'default'} seats, ${current.trialDays ?? 'default'} trial days.`,
        `Proposed limits: ${proposed.tournamentLimit ?? 'default'} tournaments, ${proposed.seatLimit ?? 'default'} seats, ${proposed.trialDays ?? 'default'} trial days.`,
        changeNote ? `Operator note: ${changeNote}` : 'Operator note: not provided.',
      ].join('\n'),
      proposal: {
        kind: 'plan_config_update',
        planId,
        current,
        proposed,
        changeNote: changeNote || null,
      },
    });
    setPlanRequestError('');
  }

  function startGatingRequest(planId: string, currentStatus: string) {
    const proposedStatus = currentStatus === 'live' ? 'early_access' : 'live';
    const planName = planLabel(planId);
    const affected = impactSummary(impactsByPlan.get(planId));
    const changeNote = (gatingNotes[planId] ?? '').trim();

    setPlanRequestDraft({
      request_type: 'plan_version',
      title: `Update ${planName} availability to ${gatingStatusLabel(proposedStatus)}`,
      priority: proposedStatus === 'live' ? 'medium' : 'low',
      target_plan_id: planId,
      impact_summary: `${planName}: ${gatingStatusLabel(currentStatus)} to ${gatingStatusLabel(proposedStatus)}; affects ${affected}.`,
      description: [
        `Current availability: ${gatingStatusLabel(currentStatus)}.`,
        `Proposed availability: ${gatingStatusLabel(proposedStatus)}.`,
        changeNote ? `Operator note: ${changeNote}` : 'Operator note: not provided.',
      ].join('\n'),
      proposal: {
        kind: 'plan_gating_update',
        planId,
        currentStatus,
        proposedStatus,
        changeNote: changeNote || null,
      },
    });
    setPlanRequestError('');
  }

  async function submitPlanChangeRequest() {
    if (!planRequestDraft) return;

    setCatalogBusy('plan-change-request');
    setPlanRequestError('');
    setCatalogSaved('');
    try {
      const res = await fetch('/api/platform-admin/product-catalog/change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_type: planRequestDraft.request_type,
          title: planRequestDraft.title,
          priority: planRequestDraft.priority,
          target_plan_id: planRequestDraft.target_plan_id,
          target_addon_key: null,
          effective_at: null,
          impact_summary: planRequestDraft.impact_summary,
          description: planRequestDraft.description,
          submit_for_review: true,
          proposal: planRequestDraft.proposal,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unable to create plan change request');

      setCatalogChangeRequests(prev => [json.changeRequest, ...prev]);
      if (planRequestDraft.proposal.kind === 'plan_gating_update') {
        setGatingNotes(prev => ({ ...prev, [planRequestDraft.target_plan_id]: '' }));
      } else {
        cancelConfigEdit();
      }
      setPlanRequestDraft(null);
      setCatalogSaved('Plan change request submitted for review');
    } catch (err) {
      setPlanRequestError((err as Error).message);
    } finally {
      setCatalogBusy(null);
    }
  }

  const [priceRows] = useState<StripePriceRow[]>(() => sortPriceRows(initialPrices));
  const [priceEditing, setPriceEditing] = useState<Record<string, string>>({});
  const [priceNotes, setPriceNotes] = useState<Record<string, string>>({});
  const [priceErrors, setPriceErrors] = useState<Record<string, string>>({});
  const [priceSaved, setPriceSaved] = useState<Record<string, boolean>>({});
  const [priceRequestDraft, setPriceRequestDraft] = useState<PriceChangeRequestDraft | null>(null);
  const [priceRequestError, setPriceRequestError] = useState('');
  const [selectedPriceProductId, setSelectedPriceProductId] = useState<string | null>(null);

  const pendingStripePriceRequests = useMemo(
    () => catalogChangeRequests.filter(request => {
      const proposal = getStripePriceProposal(request);
      return Boolean(proposal && ['draft', 'needs_review', 'approved'].includes(request.status));
    }),
    [catalogChangeRequests],
  );

  const pendingStripePriceRequestByRow = useMemo(() => {
    const pending = new Map<string, CatalogChangeRequestRow>();
    for (const request of pendingStripePriceRequests) {
      const proposal = getStripePriceProposal(request);
      if (proposal && !pending.has(proposal.stripePriceId)) {
        pending.set(proposal.stripePriceId, request);
      }
    }
    return pending;
  }, [pendingStripePriceRequests]);

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

  function savePrice(row: StripePriceRow) {
    const priceId = (priceEditing[row.id] ?? '').trim();
    const changeNote = (priceNotes[row.id] ?? '').trim();
    const planImpact = row.plan_id === 'rep_team' ? undefined : impactsByPlan.get(row.plan_id);

    if (priceId && !priceId.startsWith('price_')) {
      setPriceErrors(errors => ({ ...errors, [row.id]: 'price_id must start with price_' }));
      return;
    }

    setPriceRequestDraft(buildPriceChangeRequestDraft(row, priceId, changeNote, planImpact));
    setPriceRequestError('');
    setPriceErrors(errors => ({ ...errors, [row.id]: '' }));
  }

  async function submitPriceChangeRequest() {
    if (!priceRequestDraft) return;

    setCatalogBusy('price-change-request');
    setPriceRequestError('');
    setCatalogSaved('');
    try {
      const res = await fetch('/api/platform-admin/product-catalog/change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_type: 'pricing',
          title: priceRequestDraft.title,
          priority: priceRequestDraft.priority,
          target_plan_id: priceRequestDraft.target_plan_id,
          target_addon_key: priceRequestDraft.target_addon_key,
          effective_at: null,
          impact_summary: priceRequestDraft.impact_summary,
          description: priceRequestDraft.description,
          submit_for_review: true,
          proposal: {
            kind: 'stripe_price_update',
            stripePriceId: priceRequestDraft.row.id,
            planId: priceRequestDraft.row.plan_id,
            billingCycle: priceRequestDraft.row.billing_cycle,
            environment: priceRequestDraft.row.environment,
            currentPriceId: priceRequestDraft.row.price_id,
            proposedPriceId: priceRequestDraft.proposedPriceId || null,
            changeNote: priceRequestDraft.changeNote || null,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Unable to create price change request');

      setCatalogChangeRequests(prev => [json.changeRequest, ...prev]);
      cancelPriceEdit(priceRequestDraft.row.id);
      setPriceRequestDraft(null);
      setCatalogSaved('Price change request submitted for review');
    } catch (err) {
      setPriceRequestError((err as Error).message);
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
  const currentPriceRows = priceEnvironmentTab === 'live' ? livePriceRows : sandboxPriceRows;
  const priceProductGroups = buildPriceProductGroups(currentPriceRows);
  const addonPriceProductGroups = priceProductGroups.filter(group => !PLAN_ORDER.includes(group.planId));
  const selectedPriceProduct = selectedPriceProductId
    ? priceProductGroups.find(group => group.planId === selectedPriceProductId) ?? null
    : null;
  const matrixChanges = featureDraftChanges();
  const selectedPlanMeta = selectedPlanId ? PLAN_META[selectedPlanId] ?? null : null;
  const selectedPlanGating = selectedPlanId ? getGatingRow(selectedPlanId) ?? null : null;
  const selectedPlanConfig = selectedPlanId ? getConfigRow(selectedPlanId) ?? null : null;
  const selectedPlanDefaults = selectedPlanId ? configDefaults[selectedPlanId] : undefined;
  const selectedPlanPendingRequests = selectedPlanId ? pendingRequestsForPlan(selectedPlanId) : [];
  const selectedPlanFeatureCount = selectedPlanId ? featureCountForPlan(selectedPlanId) : 0;
  const selectedPlanPricingGroups = selectedPlanId
    ? [
        ...priceProductGroups.filter(group => group.planId === selectedPlanId),
        ...(selectedPlanId === 'club' ? addonPriceProductGroups : []),
      ]
    : [];

  function displayPriceForSlot(planId: string, cycle: 'monthly' | 'annual') {
    if (planId in PLAN_CONFIG) {
      const planConfig = PLAN_CONFIG[planId as keyof typeof PLAN_CONFIG];
      return formatMoney(cycle === 'monthly' ? planConfig.monthlyPrice : planConfig.annualPrice);
    }

    const addonKey = ADDON_CATALOG_KEY_BY_PRICE_PLAN[planId];
    const addon = addonKey ? addonCatalog.find(item => item.addon_key === addonKey) : null;
    const amount = cycle === 'monthly' ? addon?.monthly_price : addon?.annual_price;
    return amount == null ? null : formatMoney(amount);
  }

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

  function isActionableRequest(request: CatalogChangeRequestRow) {
    return ['draft', 'needs_review', 'approved'].includes(request.status);
  }

  function requestTouchesPlan(request: CatalogChangeRequestRow, planId: string) {
    const visiblePricePlanIds = new Set([
      planId,
      ...(planId === 'club' ? addonPriceProductGroups.map(group => group.planId) : []),
    ]);
    const priceProposal = getStripePriceProposal(request);
    if (priceProposal) return visiblePricePlanIds.has(priceProposal.planId);
    if (request.target_plan_id === planId) return true;
    if (request.target_addon_key && visiblePricePlanIds.has(request.target_addon_key)) return true;

    if (request.request_type === 'feature_matrix' && request.proposal && typeof request.proposal === 'object') {
      const proposal = request.proposal as Record<string, unknown>;
      const changes = Array.isArray(proposal.changes) ? proposal.changes : [];
      return changes.some(change =>
        Boolean(change) &&
        typeof change === 'object' &&
        (change as Record<string, unknown>).planId === planId,
      );
    }

    return false;
  }

  function pendingRequestsForPlan(planId: string) {
    return catalogChangeRequests.filter(request => isActionableRequest(request) && requestTouchesPlan(request, planId));
  }

  function featureCountForPlan(planId: string) {
    return featureMatrixRows.filter(feature => Boolean(feature.includedPlans[planId])).length;
  }

  function configSummaryForPlan(planId: string) {
    const row = getConfigRow(planId);
    const defaults = configDefaults[planId];
    const tournamentLimit = row?.tournament_limit ?? defaults?.tournamentLimit ?? 'N/A';
    const seatLimit = row?.seat_limit ?? defaults?.seatLimit ?? 'N/A';
    const trialDays = row?.trial_days ?? defaults?.trialDays ?? 'N/A';
    const hasOverride = Boolean(row && (
      row.tournament_limit != null ||
      row.seat_limit != null ||
      row.trial_days != null
    ));
    const tournamentLabel = tournamentLimit === 1 ? 'slot' : 'slots';

    return {
      primary: `${tournamentLimit} ${tournamentLabel} / ${seatLimit} seats`,
      secondary: `${trialDays} trial${hasOverride ? ' / override' : ' / defaults'}`,
    };
  }

  function priceSummaryForPlan(planId: string) {
    if (planId === 'tournament') {
      return { primary: 'Free', secondary: 'No Stripe price' };
    }

    const rows = priceRows.filter(row => row.plan_id === planId);
    if (rows.length === 0) {
      return { primary: 'No price slots', secondary: 'Not configured in Stripe Prices' };
    }

    const live = rows.filter(row => row.environment === 'live');
    const sandbox = rows.filter(row => row.environment === 'sandbox');
    const liveConfigured = live.filter(row => row.price_id).length;
    const sandboxConfigured = sandbox.filter(row => row.price_id).length;
    const pending = rows.filter(row => pendingStripePriceRequestByRow.has(row.id)).length;

    return {
      primary: `Live ${liveConfigured}/${live.length || 0}`,
      secondary: `Test ${sandboxConfigured}/${sandbox.length || 0}${pending ? ` / ${pending} pending` : ''}`,
    };
  }

  function latestRecordForPlan(planId: string) {
    const candidates = [
      getGatingRow(planId),
      getConfigRow(planId),
      ...priceRows.filter(row => row.plan_id === planId),
    ].flatMap(item => item?.updated_at
      ? [{
          updated_at: item.updated_at,
          updated_by_email: item.updated_by_email,
          last_change_note: item.last_change_note,
        }]
      : [],
    );

    return candidates.sort((a, b) =>
      new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime(),
    )[0] ?? null;
  }

  function renderSummaryStack(primary: string, secondary: string) {
    return (
      <div className={styles.planSummaryStack}>
        <strong>{primary}</strong>
        <span>{secondary}</span>
      </div>
    );
  }

  function renderCompactChange(updatedAt: string | null | undefined) {
    return (
      <span className={updatedAt ? styles.compactChange : styles.noteEmpty}>
        {updatedAt ? formatMonthDay(updatedAt) : 'Not changed'}
      </span>
    );
  }

  function renderPlanOverviewRows() {
    return PLAN_ORDER.map(planId => {
      const meta = PLAN_META[planId] ?? { label: planId, price: 'Not set', summary: 'No summary configured.' };
      const gating = getGatingRow(planId);
      const isLive = gating?.gating_status === 'live';
      const configSummary = configSummaryForPlan(planId);
      const priceSummary = priceSummaryForPlan(planId);
      const latest = latestRecordForPlan(planId);
      const pending = pendingRequestsForPlan(planId);

      return (
        <tr
          key={planId}
          className={styles.row}
          onClick={() => setSelectedPlanId(planId)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setSelectedPlanId(planId);
            }
          }}
          tabIndex={0}
          title="Open plan details"
        >
          <td className={styles.planName}>{meta.label}</td>
          <td>
            <span className={isLive ? styles.badgeLive : styles.badgeGated}>
              {gating ? (isLive ? 'Live' : 'Early Access') : 'Not configured'}
            </span>
          </td>
          <td>{renderImpact(planId)}</td>
          <td>{renderSummaryStack(priceSummary.primary, priceSummary.secondary)}</td>
          <td>{renderSummaryStack(configSummary.primary, configSummary.secondary)}</td>
          <td>
            {pending.length > 0 ? (
              <Link
                className={styles.pendingPlanLink}
                href="/platform-admin/change-requests"
                onClick={event => event.stopPropagation()}
              >
                {pending.length} pending
              </Link>
            ) : (
              <span className={styles.noteEmpty}>None</span>
            )}
          </td>
          <td>{renderCompactChange(latest?.updated_at)}</td>
        </tr>
      );
    });
  }

  function priceCell(row: StripePriceRow | null, group: PriceProductGroup, cycle: 'monthly' | 'annual') {
    const displayPrice = displayPriceForSlot(group.planId, cycle);

    if (!row) {
      return (
        <div className={styles.priceStatusStack}>
          {displayPrice && <strong className={styles.priceAmount}>{displayPrice}</strong>}
          <span className={styles.priceStatusEmpty}>Missing slot</span>
        </div>
      );
    }

    const pendingRequest = pendingStripePriceRequestByRow.get(row.id);
    const pendingProposal = pendingRequest ? getStripePriceProposal(pendingRequest) : null;

    return (
      <div className={styles.priceStatusStack}>
        {displayPrice && <strong className={styles.priceAmount}>{displayPrice}</strong>}
        <span className={row.price_id ? styles.priceStatusSet : styles.priceStatusEmpty}>
          {row.price_id ? 'Configured' : 'Not set'}
        </span>
        {row.price_id && <small>{row.price_id}</small>}
        {pendingRequest && (
          <small className={styles.pendingPriceBadge}>
            {optionLabel(CHANGE_REQUEST_STATUSES, pendingRequest.status)}: {pendingProposal?.proposedPriceId ?? 'clear price ID'}
          </small>
        )}
      </div>
    );
  }

  function productLastChange(group: PriceProductGroup) {
    const latest = group.rows
      .filter(row => row.updated_at)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];

    if (!latest) return renderLastChange(null, null, null);
    return renderLastChange(latest.updated_at, latest.updated_by_email, latest.last_change_note);
  }

  function renderPriceProductRows(groups: PriceProductGroup[]) {
    return (
      <>
        {groups.map(group => {
          const planImpact = group.planId === 'rep_team' || group.planId === 'org_team_addon'
            ? undefined
            : impactsByPlan.get(group.planId);
          const pendingCount = group.rows.filter(row => pendingStripePriceRequestByRow.has(row.id)).length;

          return (
            <tr key={group.planId} className={styles.row} onClick={() => setSelectedPriceProductId(group.planId)}>
              <td className={styles.planName}>
                {group.label}
                <small className={styles.muted}>{cleanProductName(group.productName)}</small>
              </td>
              <td>{group.planId === 'rep_team' || group.planId === 'org_team_addon' ? 'Add-on purchases' : impactSummary(planImpact)}</td>
              <td>{priceCell(group.monthly, group, 'monthly')}</td>
              <td>{priceCell(group.annual, group, 'annual')}</td>
              <td>{productLastChange(group)}</td>
              <td className={styles.actionCell}>
                {pendingCount > 0 && (
                  <span className={styles.pendingCount}>{pendingCount} pending</span>
                )}
              </td>
            </tr>
          );
        })}
      </>
    );
  }

  function renderPriceSlotRows(sectionRows: StripePriceRow[]) {
    return (
      <>
        {sectionRows.map(row => {
          const isEditing = row.id in priceEditing;
          const isBusy = false;
          const isSaved = priceSaved[row.id];
          const val = priceEditing[row.id] ?? (row.price_id ?? '');
          const pendingRequest = pendingStripePriceRequestByRow.get(row.id);
          const pendingProposal = pendingRequest ? getStripePriceProposal(pendingRequest) : null;

          return (
            <Fragment key={row.id}>
              <tr
                className={styles.priceSlotRow}
                onClick={() => !isEditing && startPriceEdit(row)}
                onKeyDown={event => {
                  if (isEditing) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    startPriceEdit(row);
                  }
                }}
                tabIndex={isEditing ? undefined : 0}
                title={isEditing ? undefined : 'Click to edit'}
              >
                <td className={styles.muted}>
                  {row.billing_cycle.charAt(0).toUpperCase() + row.billing_cycle.slice(1)}
                </td>
                <td className={styles.priceIdCell}>
                  {isEditing ? (
                    <input
                      autoFocus
                      className={styles.priceInput}
                      value={val}
                      placeholder="price_..."
                      onChange={event => setPriceEditing(prev => ({ ...prev, [row.id]: event.target.value }))}
                      onKeyDown={event => {
                        if (event.key === 'Enter') savePrice(row);
                        if (event.key === 'Escape') cancelPriceEdit(row.id);
                      }}
                      onClick={event => event.stopPropagation()}
                    />
                  ) : (
                    <>
                      <span className={row.price_id ? styles.priceIdSet : styles.priceIdEmpty}>
                        {row.price_id ?? 'Not set - click to edit'}
                      </span>
                      {pendingRequest && (
                        <span className={styles.pendingPriceBadge}>
                          {optionLabel(CHANGE_REQUEST_STATUSES, pendingRequest.status)} request: {pendingProposal?.proposedPriceId ?? 'clear price ID'}
                        </span>
                      )}
                    </>
                  )}
                </td>
                <td>{renderLastChange(row.updated_at, row.updated_by_email, row.last_change_note)}</td>
                <td>
                  {pendingRequest ? (
                    <span className={styles.pendingPriceBadge}>
                      {optionLabel(CHANGE_REQUEST_STATUSES, pendingRequest.status)} request
                    </span>
                  ) : (
                    <span className={styles.noteEmpty}>None</span>
                  )}
                </td>
                <td className={styles.actionCell} onClick={event => event.stopPropagation()}>
                  {isEditing ? (
                    <span className={styles.actionBtns}>
                      <button
                        className={styles.saveBtn}
                        onClick={() => savePrice(row)}
                        disabled={isBusy}
                        title="Request approval"
                      >
                        {isBusy ? <Loader size={12} className={styles.spin} /> : <Check size={12} />}
                      </button>
                      <button className={styles.cancelBtn} onClick={() => cancelPriceEdit(row.id)} disabled={isBusy} title="Cancel">
                        <X size={12} />
                      </button>
                    </span>
                  ) : isSaved ? (
                    <span className={styles.savedLabel}>Saved</span>
                  ) : null}
                </td>
              </tr>
              {isEditing && (
                <tr className={styles.noteRow}>
                  <td colSpan={5}>
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
                  <td colSpan={5} className={styles.errorCell}>{priceErrors[row.id]}</td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </>
    );
  }

  function closeSelectedPlanModal() {
    setSelectedPlanId(null);
    if (configEditPlan) cancelConfigEdit();
  }

  function renderSelectedPlanModal() {
    if (!selectedPlanId || !selectedPlanMeta) return null;

    const isLive = selectedPlanGating?.gating_status === 'live';
    const gatingStatus = selectedPlanGating?.gating_status ?? 'early_access';
    const isConfigEditing = configEditPlan === selectedPlanId;
    const latest = latestRecordForPlan(selectedPlanId);
    const configSummary = configSummaryForPlan(selectedPlanId);
    const priceSummary = priceSummaryForPlan(selectedPlanId);

    return (
      <div className={styles.modalBackdrop} role="presentation" onClick={closeSelectedPlanModal}>
        <div
          className={styles.planDetailModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="plan-detail-title"
          onClick={event => event.stopPropagation()}
        >
          <div className={styles.modalHeader}>
            <div>
              <div className={styles.headerLabel}>Plan Workspace</div>
              <h2 id="plan-detail-title" className={styles.modalTitle}>{selectedPlanMeta.label}</h2>
            </div>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={closeSelectedPlanModal}
              title="Close"
            >
              <X size={12} />
            </button>
          </div>

          <div className={styles.planDetailSummary}>
            <div>
              <span>Status</span>
              <strong>{isLive ? 'Live' : 'Early Access'}</strong>
            </div>
            <div>
              <span>Impact</span>
              <strong>{impactSummary(impactsByPlan.get(selectedPlanId))}</strong>
            </div>
            <div>
              <span>Pricing</span>
              <strong>{priceSummary.primary}</strong>
            </div>
            <div>
              <span>Features</span>
              <strong>{selectedPlanFeatureCount} modules</strong>
            </div>
            <div>
              <span>Pending</span>
              <strong>{selectedPlanPendingRequests.length}</strong>
            </div>
          </div>

          <div className={styles.planDetailIntro}>
            <p>{selectedPlanMeta.summary}</p>
            {renderLastChange(latest?.updated_at, latest?.updated_by_email, latest?.last_change_note)}
          </div>

          <div className={styles.planDetailGrid}>
            <section className={styles.planDetailPanel}>
              <div className={styles.sectionHead}>
                <h3 className={styles.sectionTitle}>Availability</h3>
                <p className={styles.sectionDesc}>Availability edits create review requests from this plan.</p>
              </div>
              <div className={styles.planPanelBody}>
                <span className={isLive ? styles.badgeLive : styles.badgeGated}>
                  {selectedPlanGating ? (isLive ? 'Live' : 'Early Access') : 'Not configured'}
                </span>
                <label className={styles.fieldLabel}>
                  <span>Change Note</span>
                  <input
                    className={styles.noteInput}
                    value={gatingNotes[selectedPlanId] ?? ''}
                    placeholder="Reason for this change"
                    onChange={event => setGatingNotes(prev => ({ ...prev, [selectedPlanId]: event.target.value }))}
                  />
                </label>
                <button
                  className={isLive ? styles.deactivateBtn : styles.activateBtn}
                  onClick={() => startGatingRequest(selectedPlanId, gatingStatus)}
                  disabled={!canManageProduct}
                >
                  {isLive ? 'Request Early Access' : 'Request Live'}
                </button>
              </div>
            </section>

            <section className={styles.planDetailPanel}>
              <div className={styles.sectionHead}>
                <h3 className={styles.sectionTitle}>Limits &amp; Trials</h3>
                <p className={styles.sectionDesc}>Limit edits create review requests from this plan.</p>
              </div>
              {isConfigEditing ? (
                <div className={styles.planConfigForm}>
                  <label className={styles.fieldLabel}>
                    <span>Tournament Limit</span>
                    <input
                      autoFocus
                      type="number"
                      min={0}
                      className={styles.numInput}
                      value={configDraft?.tournament_limit ?? ''}
                      placeholder={selectedPlanDefaults ? String(selectedPlanDefaults.tournamentLimit) : ''}
                      onChange={event => setConfigDraft(draft => draft ? { ...draft, tournament_limit: event.target.value } : draft)}
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    <span>Seat Limit</span>
                    <input
                      type="number"
                      min={0}
                      className={styles.numInput}
                      value={configDraft?.seat_limit ?? ''}
                      placeholder={selectedPlanDefaults ? String(selectedPlanDefaults.seatLimit) : ''}
                      onChange={event => setConfigDraft(draft => draft ? { ...draft, seat_limit: event.target.value } : draft)}
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    <span>Trial Days</span>
                    <input
                      type="number"
                      min={0}
                      className={styles.numInput}
                      value={configDraft?.trial_days ?? ''}
                      placeholder={selectedPlanDefaults ? String(selectedPlanDefaults.trialDays) : ''}
                      onChange={event => setConfigDraft(draft => draft ? { ...draft, trial_days: event.target.value } : draft)}
                    />
                  </label>
                  <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
                    <span>Change Note</span>
                    <input
                      className={styles.noteInput}
                      value={configChangeNote}
                      placeholder={`Why are ${impactSummary(impactsByPlan.get(selectedPlanId))} being affected?`}
                      onChange={event => setConfigChangeNote(event.target.value)}
                    />
                  </label>
                  <div className={styles.formActions}>
                    <span className={styles.actionBtns}>
                      <button
                        className={styles.saveBtn}
                        onClick={() => saveConfig(selectedPlanId)}
                        disabled={!canManageProduct}
                        title="Request review"
                      >
                        <Check size={12} />
                      </button>
                      <button className={styles.cancelBtn} onClick={cancelConfigEdit} title="Cancel">
                        <X size={12} />
                      </button>
                    </span>
                  </div>
                  {configError && <div className={`${styles.errorBanner} ${styles.fullWidth}`}>{configError}</div>}
                </div>
              ) : (
                <div className={styles.planPanelBody}>
                  {renderSummaryStack(configSummary.primary, configSummary.secondary)}
                  <div className={styles.planMetricGrid}>
                    <div>
                      <span>Tournaments</span>
                      <strong>{selectedPlanConfig?.tournament_limit ?? selectedPlanDefaults?.tournamentLimit ?? 'N/A'}</strong>
                    </div>
                    <div>
                      <span>Seats</span>
                      <strong>{selectedPlanConfig?.seat_limit ?? selectedPlanDefaults?.seatLimit ?? 'N/A'}</strong>
                    </div>
                    <div>
                      <span>Trial Days</span>
                      <strong>{selectedPlanConfig?.trial_days ?? selectedPlanDefaults?.trialDays ?? 'N/A'}</strong>
                    </div>
                  </div>
                  <button className={styles.editBtn} onClick={() => startConfigEdit(selectedPlanId)} disabled={!canManageProduct}>
                    Edit Limits
                  </button>
                </div>
              )}
            </section>

            <section className={`${styles.planDetailPanel} ${styles.planDetailPanelWide}`}>
              <div className={styles.sectionHead}>
                <h3 className={styles.sectionTitle}>Pricing</h3>
                <p className={styles.sectionDesc}>
                  Plan and related add-on price edits create review requests.
                </p>
              </div>
              <div className={styles.inlineTabs} role="tablist" aria-label="Plan price environment">
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
                <span>Subscription pricing appears first; related add-ons appear below when available.</span>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Scope</th>
                      <th>Monthly</th>
                      <th>Annual</th>
                      <th>Latest Change</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPlanPricingGroups.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={styles.emptyCell}>
                          {selectedPlanId === 'tournament'
                            ? 'The free Tournament plan does not require Stripe price IDs.'
                            : 'No Stripe price slots found for this plan or related add-ons in this environment.'}
                        </td>
                      </tr>
                    ) : renderPriceProductRows(selectedPlanPricingGroups)}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={styles.planDetailPanel}>
              <div className={styles.sectionHead}>
                <h3 className={styles.sectionTitle}>Feature Access</h3>
                <p className={styles.sectionDesc}>Feature edits still use the Product Catalog matrix workflow.</p>
              </div>
              <div className={styles.planPanelBody}>
                {renderSummaryStack(`${selectedPlanFeatureCount} modules enabled`, 'Published matrix')}
                <button
                  type="button"
                  className={styles.editBtn}
                  onClick={() => {
                    closeSelectedPlanModal();
                    setActiveTab('catalog');
                    setCatalogView('matrix');
                  }}
                >
                  Open Matrix
                </button>
              </div>
            </section>

            <section className={styles.planDetailPanel}>
              <div className={styles.sectionHead}>
                <h3 className={styles.sectionTitle}>Pending Changes</h3>
                <p className={styles.sectionDesc}>Requests needing review or application for this plan.</p>
              </div>
              <div className={styles.planPanelBody}>
                {selectedPlanPendingRequests.length > 0 ? (
                  <>
                    <strong className={styles.pendingPlanCount}>{selectedPlanPendingRequests.length} pending</strong>
                    <Link className={styles.secondaryLink} href="/platform-admin/change-requests">
                      Open Change Requests
                    </Link>
                  </>
                ) : (
                  <span className={styles.noteEmpty}>No pending requests for this plan.</span>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
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

      {pendingStripePriceRequests.length > 0 && (
        <section className={styles.pendingApprovalBanner}>
          <div>
            <div className={styles.sectionTitle}>Pricing Approval Queue</div>
            <p className={styles.sectionDesc}>
              {pendingStripePriceRequests.length} Stripe price change request{pendingStripePriceRequests.length === 1 ? '' : 's'} waiting for review or application.
            </p>
          </div>
          <Link className={styles.activateBtn} href="/platform-admin/change-requests">
            Review Requests
          </Link>
        </section>
      )}

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

      <section className={styles.section} hidden={activeTab !== 'plans'}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Plan Workspace</h2>
          <p className={styles.sectionDesc}>
            Scan plan state, customer impact, pricing, limits, pending changes, and latest update.
            Open a plan for details and scoped edits.
          </p>
        </div>
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.planOverviewTable}`}>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Status</th>
                <th>Impact</th>
                <th>Pricing</th>
                <th>Limits &amp; Trials</th>
                <th>Pending</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {renderPlanOverviewRows()}
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
              ? 'Campaign work stays here; request approvals and status changes live in the central queue.'
              : catalogView === 'matrix'
                ? 'Review, draft, and publish plan/module entitlement changes.'
                : 'Review baseline plan versions and add-on catalog records.'}
          </p>
        </div>

        {catalogView === 'planning' && (
          <>
            {pendingStripePriceRequests.length > 0 && (
              <div className={styles.inlineNotice}>
                <strong>{pendingStripePriceRequests.length} pricing request{pendingStripePriceRequests.length === 1 ? '' : 's'} pending</strong>
                <span>Approving a generated Stripe price request applies its proposed price ID and marks it implemented.</span>
              </div>
            )}

            <div className={styles.inlineNotice}>
              <strong>Change approvals moved</strong>
              <span>Review, approve, reject, and apply catalog requests from the central Change Requests queue.</span>
              <Link className={styles.secondaryLink} href="/platform-admin/change-requests">
                Open Change Requests
              </Link>
            </div>

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

          <section className={styles.catalogPanel}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Add-on Stripe Prices</h2>
              <p className={styles.sectionDesc}>
                Add-on price slots stay with Product Catalog because they are not standalone plan rows.
                Price edits still create review requests in Change Requests.
              </p>
            </div>
            <div className={styles.inlineTabs} role="tablist" aria-label="Add-on price environment">
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
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Impact</th>
                    <th>Monthly</th>
                    <th>Annual</th>
                    <th>Latest Change</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {addonPriceProductGroups.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={styles.emptyCell}>No add-on Stripe price slots found.</td>
                    </tr>
                  ) : renderPriceProductRows(addonPriceProductGroups)}
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

      {renderSelectedPlanModal()}

      {selectedPriceProduct && (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setSelectedPriceProductId(null)}>
          <div
            className={styles.priceProductModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="price-product-title"
            onClick={event => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.headerLabel}>
                  {priceEnvironmentTab === 'live' ? 'Production Prices' : 'Test Prices'}
                </div>
                <h2 id="price-product-title" className={styles.modalTitle}>{selectedPriceProduct.label}</h2>
              </div>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setSelectedPriceProductId(null)}
                title="Close"
              >
                <X size={12} />
              </button>
            </div>

            <div className={styles.productModalSummary}>
              <span>{cleanProductName(selectedPriceProduct.productName)}</span>
              <span className={priceEnvironmentTab === 'live' ? styles.badgeLiveEnv : styles.badgeSandbox}>
                {priceEnvironmentTab === 'live' ? 'Production / Live Mode' : 'Test / Sandbox Mode'}
              </span>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Cycle</th>
                    <th>Price ID</th>
                    <th>Last Change</th>
                    <th>Pending</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {renderPriceSlotRows(selectedPriceProduct.rows)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {planRequestDraft && (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={styles.requestModal} role="dialog" aria-modal="true" aria-labelledby="plan-request-title">
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.headerLabel}>Approval Request</div>
                <h2 id="plan-request-title" className={styles.modalTitle}>Submit Plan Change</h2>
              </div>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setPlanRequestDraft(null)}
                disabled={catalogBusy === 'plan-change-request'}
                title="Close"
              >
                <X size={12} />
              </button>
            </div>

            <div className={styles.requestSummary}>
              <div>
                <span>Plan</span>
                <strong>{planLabel(planRequestDraft.target_plan_id)}</strong>
              </div>
              <div>
                <span>Type</span>
                <strong>{planRequestDraft.proposal.kind === 'plan_gating_update' ? 'Availability' : 'Limits & Trials'}</strong>
              </div>
              <div>
                <span>Priority</span>
                <strong>{optionLabel(PRIORITIES, planRequestDraft.priority)}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>Needs Review</strong>
              </div>
            </div>

            {planRequestError && <div className={styles.errorBanner}>{planRequestError}</div>}

            <div className={styles.modalForm}>
              <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
                <span>Title</span>
                <input
                  className={styles.noteInput}
                  value={planRequestDraft.title}
                  onChange={event => setPlanRequestDraft(draft => draft ? { ...draft, title: event.target.value } : draft)}
                />
              </label>
              <label className={styles.fieldLabel}>
                <span>Priority</span>
                <select
                  className={styles.selectInput}
                  value={planRequestDraft.priority}
                  onChange={event => setPlanRequestDraft(draft => draft ? { ...draft, priority: event.target.value } : draft)}
                >
                  {PRIORITIES.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
                <span>Impact Summary</span>
                <input
                  className={styles.noteInput}
                  value={planRequestDraft.impact_summary}
                  onChange={event => setPlanRequestDraft(draft => draft ? { ...draft, impact_summary: event.target.value } : draft)}
                />
              </label>
              <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
                <span>Description</span>
                <textarea
                  className={styles.textArea}
                  value={planRequestDraft.description}
                  onChange={event => setPlanRequestDraft(draft => draft ? { ...draft, description: event.target.value } : draft)}
                />
              </label>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setPlanRequestDraft(null)}
                disabled={catalogBusy === 'plan-change-request'}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.activateBtn}
                onClick={submitPlanChangeRequest}
                disabled={catalogBusy === 'plan-change-request' || !planRequestDraft.title.trim()}
              >
                {catalogBusy === 'plan-change-request'
                  ? <Loader size={12} className={styles.spin} />
                  : 'Submit for Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {priceRequestDraft && (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={styles.requestModal} role="dialog" aria-modal="true" aria-labelledby="price-request-title">
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.headerLabel}>Approval Request</div>
                <h2 id="price-request-title" className={styles.modalTitle}>Submit Price Change</h2>
              </div>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setPriceRequestDraft(null)}
                disabled={catalogBusy === 'price-change-request'}
                title="Close"
              >
                <X size={12} />
              </button>
            </div>

            <div className={styles.requestSummary}>
              <div>
                <span>Plan</span>
                <strong>{PRICE_PLAN_LABELS[priceRequestDraft.row.plan_id] ?? priceRequestDraft.row.plan_id}</strong>
              </div>
              <div>
                <span>Cycle</span>
                <strong>{priceRequestDraft.row.billing_cycle}</strong>
              </div>
              <div>
                <span>Environment</span>
                <strong>{priceRequestDraft.row.environment}</strong>
              </div>
              <div>
                <span>Proposed</span>
                <strong>{priceRequestDraft.proposedPriceId || 'Clear price ID'}</strong>
              </div>
            </div>

            {priceRequestError && <div className={styles.errorBanner}>{priceRequestError}</div>}

            <div className={styles.modalForm}>
              <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
                <span>Title</span>
                <input
                  className={styles.noteInput}
                  value={priceRequestDraft.title}
                  onChange={event => setPriceRequestDraft(draft => draft ? { ...draft, title: event.target.value } : draft)}
                />
              </label>
              <label className={styles.fieldLabel}>
                <span>Priority</span>
                <select
                  className={styles.selectInput}
                  value={priceRequestDraft.priority}
                  onChange={event => setPriceRequestDraft(draft => draft ? { ...draft, priority: event.target.value } : draft)}
                >
                  {PRIORITIES.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
                <span>Impact Summary</span>
                <input
                  className={styles.noteInput}
                  value={priceRequestDraft.impact_summary}
                  onChange={event => setPriceRequestDraft(draft => draft ? { ...draft, impact_summary: event.target.value } : draft)}
                />
              </label>
              <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
                <span>Change Note</span>
                <input
                  className={styles.noteInput}
                  value={priceRequestDraft.changeNote}
                  placeholder="Why is this Stripe price ID changing?"
                  onChange={event => setPriceRequestDraft(draft => draft ? { ...draft, changeNote: event.target.value } : draft)}
                />
              </label>
              <label className={`${styles.fieldLabel} ${styles.fullWidth}`}>
                <span>Description</span>
                <textarea
                  className={styles.textArea}
                  value={priceRequestDraft.description}
                  onChange={event => setPriceRequestDraft(draft => draft ? { ...draft, description: event.target.value } : draft)}
                />
              </label>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setPriceRequestDraft(null)}
                disabled={catalogBusy === 'price-change-request'}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.activateBtn}
                onClick={submitPriceChangeRequest}
                disabled={catalogBusy === 'price-change-request' || !priceRequestDraft.title.trim()}
              >
                {catalogBusy === 'price-change-request'
                  ? <Loader size={12} className={styles.spin} />
                  : 'Submit for Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
