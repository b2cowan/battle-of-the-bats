'use client';

import { Fragment, useMemo, useState, type ReactNode } from 'react';
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
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import kit from '../console.module.css';
import { cap } from '../chips';
import styles from './plans-pricing.module.css';
import { pluralize } from '@/lib/utils';
import { fmtAbsoluteDate, fmtAbsoluteDateTime } from '@/lib/format-date';
import DateInput from '@/components/shared/DateInput';

type Tab = 'plans' | 'catalog';
type PriceEnvironmentTab = 'live' | 'sandbox';
type CatalogView = 'planning' | 'matrix' | 'records';

const TABS: { id: Tab; label: string }[] = [
  { id: 'plans', label: 'Plans' },
  { id: 'catalog', label: 'Product catalog' },
];

const CATALOG_VIEWS: { id: CatalogView; label: string }[] = [
  { id: 'planning', label: 'Planning' },
  { id: 'matrix', label: 'Feature matrix' },
  { id: 'records', label: 'Catalog records' },
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
  /** Rows where the PUBLISHED matrix and the LIVE product disagree — see the banner below. */
  featureMatrixDrift: {
    planId: string;
    moduleKey: string;
    publishedIncluded: boolean;
    liveIncluded: boolean;
  }[];
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

const PLAN_ORDER = ['tournament', 'team', 'tournament_plus', 'league', 'club', 'club_large'];

const PLAN_META: Record<string, { label: string; price: string; summary: string }> = {
  tournament: { label: 'Tournament', price: 'Free', summary: 'Starter event tier: 1 tournament, standard registration, FieldLogicHQ styling.' },
  team: { label: 'Coaches Portal', price: `${formatPriceAmount(PLAN_CONFIG.team.monthlyPrice)}/mo`, summary: 'Standalone coach workspace with one rep team, coaches portal, and one free-tier tournament slot.' },
  tournament_plus: { label: 'Tournament Plus', price: `${formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}/mo`, summary: 'Serious tournament operations: unlimited slots, unlimited seats, registration control, branding, automation.' },
  league: { label: 'League Plus', price: `${formatPriceAmount(PLAN_CONFIG.league.monthlyPrice)}/mo`, summary: 'House league, registration, public organization page, and league workflows.' },
  club: { label: 'Club', price: `${formatPriceAmount(PLAN_CONFIG.club.monthlyPrice)}/mo`, summary: 'Full club operations (accounting, rep teams, whole-staff coaches portals) — up to 15 teams.' },
  club_large: { label: 'Club · Association', price: `${formatPriceAmount(PLAN_CONFIG.club_large.monthlyPrice)}/mo`, summary: 'Full club operations sized for a larger association — up to 30 teams, whole coaching staff included.' },
};

const PRICE_PLAN_LABELS: Record<string, string> = {
  team: 'Coaches Portal',
  tournament_plus: 'Tournament Plus',
  league: 'League Plus',
  club: 'Club',
  club_large: 'Club · Association',
  org_team_addon: 'Org Team Add-on (Retired)',
  rep_team: 'Club Extra Rep Team (Retired)',
};

const PRICE_PLAN_ORDER = ['team', 'tournament_plus', 'league', 'club', 'club_large', 'org_team_addon', 'rep_team'];
const ADDON_CATALOG_KEY_BY_PRICE_PLAN: Record<string, string> = {
  org_team_addon: 'org_team_addon',
  rep_team: 'extra_rep_team',
};

const CHANGE_REQUEST_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'implemented', label: 'Implemented' },
  { value: 'canceled', label: 'Cancelled' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'launch_blocker', label: 'Launch blocker' },
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

const formatDate = (value: string | null | undefined) => fmtAbsoluteDateTime(value, 'Not changed yet');

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
    ['Cancelled', impact.canceled],
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

const formatDateOnly = (value: string | null | undefined) => fmtAbsoluteDate(value, 'Not scheduled');

// Was month+day with no year (PF-5 drift); now includes the year via the
// shared helper for consistency with the rest of the console.
const formatMonthDay = (value: string | null | undefined) => fmtAbsoluteDate(value, 'Not changed');

function optionLabel(options: { value: string; label: string }[], value: string | null | undefined) {
  return options.find(option => option.value === value)?.label ?? value ?? 'Not set';
}

/** The chip colour for a record's state; the caller puts it beside `kit.chip`. */
function statusClass(status: string) {
  if (status === 'published' || status === 'live') return kit.chipOk;
  if (status === 'approved' || status === 'active' || status === 'implemented') return kit.chipOk;
  if (status === 'scheduled' || status === 'planned' || status === 'needs_review') return kit.chipInfo;
  if (status === 'rejected' || status === 'retired' || status === 'archived' || status === 'canceled' || status === 'ended') return kit.chipBad;
  return kit.chipQuiet;
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
  const cycle = cap(row.billing_cycle);
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
  featureMatrixDrift,
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

  // Every change request still awaiting action — review (needs_review) or implementation (approved) —
  // across ALL types, not just Stripe price edits, so the banner can't hide a pending launch approval.
  // Matches the Approval Queue's "Action Needed" count (drafts are the submitter's WIP, excluded).
  const pendingChangeRequests = useMemo(
    () => catalogChangeRequests.filter(request => ['needs_review', 'approved'].includes(request.status)),
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
      // ⚠ Do NOT shorten this back to "Feature matrix published". It was exactly that for a year,
      // and it read as "the packaging change is live" when nothing about customer access had
      // changed (audit 2026-08-06). The second clause is the whole point of the message.
      setCatalogSaved('Feature matrix published — recorded, but NOT yet live for customers. '
        + 'Raise the matching code change to lib/plan-config.ts to apply it.');
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
      <div className={styles.stack}>
        <strong>{impactSummary(impact)}</strong>
        <span className={kit.sub}>{statusBreakdown(impact)}</span>
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
      return { primary: 'No price slots', secondary: 'Not configured in Stripe prices' };
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
      <div className={styles.stack}>
        <strong>{primary}</strong>
        <span className={kit.sub}>{secondary}</span>
      </div>
    );
  }

  function renderCompactChange(updatedAt: string | null | undefined) {
    return (
      <span className={updatedAt ? undefined : styles.noteEmpty}>
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
          className={kit.clickableRow}
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
          <td className="table-cards-title"><span className={kit.nameLink}>{meta.label}</span></td>
          <td data-label="Status">
            <span className={`${kit.chip} ${isLive ? kit.chipOk : gating ? kit.chipWarn : kit.chipQuiet}`}>
              {gating ? (isLive ? 'Live' : 'Early access') : 'Not configured'}
            </span>
          </td>
          <td data-label="Impact">{renderImpact(planId)}</td>
          <td data-label="Pricing">{renderSummaryStack(priceSummary.primary, priceSummary.secondary)}</td>
          <td data-label="Limits & trials">{renderSummaryStack(configSummary.primary, configSummary.secondary)}</td>
          <td data-label="Pending">
            {pending.length > 0 ? (
              <Link
                className={styles.pendingLink}
                href="/platform-admin/change-requests"
                onClick={event => event.stopPropagation()}
              >
                {pending.length} pending
              </Link>
            ) : (
              <span className={styles.noteEmpty}>None</span>
            )}
          </td>
          <td data-label="Updated" className={kit.nowrap}>{renderCompactChange(latest?.updated_at)}</td>
          <td className={kit.rowDoor} aria-hidden="true">›</td>
        </tr>
      );
    });
  }

  function priceCell(row: StripePriceRow | null, group: PriceProductGroup, cycle: 'monthly' | 'annual') {
    const displayPrice = displayPriceForSlot(group.planId, cycle);

    if (!row) {
      return (
        <div className={styles.priceStack}>
          {displayPrice && <strong className={styles.priceAmount}>{displayPrice}</strong>}
          <span className={`${kit.chip} ${kit.chipQuiet}`}>Missing slot</span>
        </div>
      );
    }

    const pendingRequest = pendingStripePriceRequestByRow.get(row.id);
    const pendingProposal = pendingRequest ? getStripePriceProposal(pendingRequest) : null;

    return (
      <div className={styles.priceStack}>
        {displayPrice && <strong className={styles.priceAmount}>{displayPrice}</strong>}
        <span className={`${kit.chip} ${row.price_id ? kit.chipOk : kit.chipQuiet}`}>
          {row.price_id ? 'Configured' : 'Not set'}
        </span>
        {row.price_id && <span className={`${kit.code} ${styles.priceId}`}>{row.price_id}</span>}
        {pendingRequest && (
          <span className={`${kit.sub} ${styles.pendingText}`}>
            {optionLabel(CHANGE_REQUEST_STATUSES, pendingRequest.status)}: {pendingProposal?.proposedPriceId ?? 'clear price ID'}
          </span>
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
            <tr key={group.planId} className={kit.clickableRow} onClick={() => setSelectedPriceProductId(group.planId)}>
              <td className="table-cards-title">
                <span className={kit.nameLink}>{group.label}</span>
                <span className={kit.sub}>{cleanProductName(group.productName)}</span>
              </td>
              <td data-label="Scope">{group.planId === 'rep_team' || group.planId === 'org_team_addon' ? 'Add-on purchases' : impactSummary(planImpact)}</td>
              <td data-label="Monthly">{priceCell(group.monthly, group, 'monthly')}</td>
              <td data-label="Annual">{priceCell(group.annual, group, 'annual')}</td>
              <td data-label="Latest change">{productLastChange(group)}</td>
              <td className={styles.actionCell}>
                {pendingCount > 0 && (
                  <span className={styles.pendingText}>{pendingCount} pending</span>
                )}
                <span className={styles.chev} aria-hidden="true">›</span>
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
                className={isEditing ? undefined : kit.clickableRow}
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
                <td className={kit.muted}>
                  {cap(row.billing_cycle)}
                </td>
                <td className={styles.priceIdCell}>
                  {isEditing ? (
                    <input
                      autoFocus
                      className={`${kit.field} ${kit.code} ${styles.priceInput}`}
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
                      {row.price_id
                        ? <span className={kit.code}>{row.price_id}</span>
                        : <span className={kit.muted}>Not set - click to edit</span>}
                      {pendingRequest && (
                        <span className={`${kit.sub} ${styles.pendingText}`}>
                          {optionLabel(CHANGE_REQUEST_STATUSES, pendingRequest.status)} request: {pendingProposal?.proposedPriceId ?? 'clear price ID'}
                        </span>
                      )}
                    </>
                  )}
                </td>
                <td>{renderLastChange(row.updated_at, row.updated_by_email, row.last_change_note)}</td>
                <td>
                  {pendingRequest ? (
                    <span className={styles.pendingText}>
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
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => savePrice(row)}
                        disabled={isBusy}
                        title="Request approval"
                        aria-label="Request approval"
                      >
                        {isBusy ? <Loader size={14} className={kit.spin} /> : <Check size={14} />}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => cancelPriceEdit(row.id)}
                        disabled={isBusy}
                        title="Cancel"
                        aria-label="Cancel"
                      >
                        <X size={14} />
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
                    <label className={kit.fieldGroup}>
                      <span className={kit.label}>Change note</span>
                      <input
                        className={kit.field}
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

  /** A section inside a window: the heading ABOVE a plain card, its one line under the heading (D1). */
  function renderPanel(title: string, lede: string, body: ReactNode, flush = false) {
    return (
      <section className={kit.section}>
        <div>
          <h3 className={kit.sectionTitle}>{title}</h3>
          <p className={kit.sectionLede}>{lede}</p>
        </div>
        <div className={flush ? kit.card : `${kit.card} ${kit.cardPad}`}>{body}</div>
      </section>
    );
  }

  /** The Stripe mode choice (D5): one of two, so a dropdown. The same state drives every price table on the screen. */
  function renderStripeModeField(extra?: ReactNode) {
    return (
      <label className={`${kit.fieldGroup} ${styles.modeField}`}>
        <span className={kit.label}>Stripe mode{extra}</span>
        <select
          className={kit.select}
          value={priceEnvironmentTab}
          onChange={event => setPriceEnvironmentTab(event.target.value as PriceEnvironmentTab)}
        >
          <option value="live">Production</option>
          <option value="sandbox">Test</option>
        </select>
      </label>
    );
  }

  function renderEnvironmentChip() {
    return (
      <span className={`${kit.chip} ${priceEnvironmentTab === 'live' ? kit.chipOk : kit.chipWarn}`}>
        {priceEnvironmentTab === 'live' ? 'Production / Live Mode' : 'Test / Sandbox Mode'}
      </span>
    );
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
      <div className={styles.backdrop} role="presentation" onClick={closeSelectedPlanModal}>
        <div
          className={`${styles.window} ${styles.windowWide}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="plan-detail-title"
          onClick={event => event.stopPropagation()}
        >
          <div className={styles.windowHead}>
            <div>
              <h2 id="plan-detail-title" className={styles.windowTitle}>{selectedPlanMeta.label}</h2>
              <p className={styles.windowSub}>Plan workspace</p>
            </div>
            <button
              type="button"
              className={styles.close}
              onClick={closeSelectedPlanModal}
              title="Close"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className={kit.band}>
            <div className={kit.bandCell}>
              <span className={kit.bandLabel}>Status</span>
              <strong className={`${kit.bandValue} ${kit.bandValueSm}`}>{isLive ? 'Live' : 'Early access'}</strong>
            </div>
            <div className={kit.bandCell}>
              <span className={kit.bandLabel}>Impact</span>
              <strong className={`${kit.bandValue} ${kit.bandValueSm}`}>{impactSummary(impactsByPlan.get(selectedPlanId))}</strong>
            </div>
            <div className={kit.bandCell}>
              <span className={kit.bandLabel}>Pricing</span>
              <strong className={`${kit.bandValue} ${kit.bandValueSm}`}>{priceSummary.primary}</strong>
            </div>
            <div className={kit.bandCell}>
              <span className={kit.bandLabel}>Features</span>
              <strong className={`${kit.bandValue} ${kit.bandValueSm}`}>{selectedPlanFeatureCount} modules</strong>
            </div>
            <div className={`${kit.bandCell} ${selectedPlanPendingRequests.length > 0 ? kit.bandWarn : ''}`}>
              <span className={kit.bandLabel}>Pending</span>
              <strong className={`${kit.bandValue} ${kit.bandValueSm}`}>{selectedPlanPendingRequests.length}</strong>
            </div>
          </div>

          <div className={styles.stack}>
            <p className={kit.caption}>{selectedPlanMeta.summary}</p>
            {renderLastChange(latest?.updated_at, latest?.updated_by_email, latest?.last_change_note)}
          </div>

          <div className={kit.two}>
            {renderPanel('Availability', 'Availability edits create review requests from this plan.', (
              <div className={styles.panelBody}>
                <span className={`${kit.chip} ${isLive ? kit.chipOk : selectedPlanGating ? kit.chipWarn : kit.chipQuiet}`}>
                  {selectedPlanGating ? (isLive ? 'Live' : 'Early access') : 'Not configured'}
                </span>
                <label className={`${kit.fieldGroup} ${styles.fill}`}>
                  <span className={kit.label}>Change note</span>
                  <input
                    className={kit.field}
                    value={gatingNotes[selectedPlanId] ?? ''}
                    placeholder="Reason for this change"
                    onChange={event => setGatingNotes(prev => ({ ...prev, [selectedPlanId]: event.target.value }))}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => startGatingRequest(selectedPlanId, gatingStatus)}
                  disabled={!canManageProduct}
                >
                  {isLive ? 'Request early access' : 'Request live'}
                </button>
              </div>
            ))}

            {renderPanel('Limits & trials', 'Limit edits create review requests from this plan.', isConfigEditing ? (
              <div className={`${kit.formGrid} ${styles.limitsGrid}`}>
                <label className={kit.fieldGroup}>
                  <span className={kit.label}>Tournament limit</span>
                  <input
                    autoFocus
                    type="number"
                    min={0}
                    className={`${kit.field} ${styles.numInput}`}
                    value={configDraft?.tournament_limit ?? ''}
                    placeholder={selectedPlanDefaults ? String(selectedPlanDefaults.tournamentLimit) : ''}
                    onChange={event => setConfigDraft(draft => draft ? { ...draft, tournament_limit: event.target.value } : draft)}
                  />
                </label>
                <label className={kit.fieldGroup}>
                  <span className={kit.label}>Seat limit</span>
                  <input
                    type="number"
                    min={0}
                    className={`${kit.field} ${styles.numInput}`}
                    value={configDraft?.seat_limit ?? ''}
                    placeholder={selectedPlanDefaults ? String(selectedPlanDefaults.seatLimit) : ''}
                    onChange={event => setConfigDraft(draft => draft ? { ...draft, seat_limit: event.target.value } : draft)}
                  />
                </label>
                <label className={kit.fieldGroup}>
                  <span className={kit.label}>Trial days</span>
                  <input
                    type="number"
                    min={0}
                    className={`${kit.field} ${styles.numInput}`}
                    value={configDraft?.trial_days ?? ''}
                    placeholder={selectedPlanDefaults ? String(selectedPlanDefaults.trialDays) : ''}
                    onChange={event => setConfigDraft(draft => draft ? { ...draft, trial_days: event.target.value } : draft)}
                  />
                </label>
                <label className={`${kit.fieldGroup} ${styles.wide}`}>
                  <span className={kit.label}>Change note</span>
                  <input
                    className={kit.field}
                    value={configChangeNote}
                    placeholder={`Why are ${impactSummary(impactsByPlan.get(selectedPlanId))} being affected?`}
                    onChange={event => setConfigChangeNote(event.target.value)}
                  />
                </label>
                <div className={`${kit.formActions} ${styles.wide}`}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => saveConfig(selectedPlanId)}
                    disabled={!canManageProduct}
                    title="Request review"
                    aria-label="Request review"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={cancelConfigEdit}
                    title="Cancel"
                    aria-label="Cancel"
                  >
                    <X size={14} />
                  </button>
                </div>
                {configError && <div className={`${kit.notice} ${kit.noticeBad} ${styles.wide}`}>{configError}</div>}
              </div>
            ) : (
              <div className={styles.panelBody}>
                {renderSummaryStack(configSummary.primary, configSummary.secondary)}
                <dl className={`${styles.lines} ${styles.fill}`}>
                  <dt>Tournaments</dt>
                  <dd>{selectedPlanConfig?.tournament_limit ?? selectedPlanDefaults?.tournamentLimit ?? 'N/A'}</dd>
                  <dt>Seats</dt>
                  <dd>{selectedPlanConfig?.seat_limit ?? selectedPlanDefaults?.seatLimit ?? 'N/A'}</dd>
                  <dt>Trial days</dt>
                  <dd>{selectedPlanConfig?.trial_days ?? selectedPlanDefaults?.trialDays ?? 'N/A'}</dd>
                </dl>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => startConfigEdit(selectedPlanId)}
                  disabled={!canManageProduct}
                >
                  Edit limits
                </button>
              </div>
            ))}
          </div>

          {renderPanel('Pricing', 'Plan and related add-on price edits create review requests.', (
            <>
              <div className={`${kit.toolbar} ${styles.modeBar}`}>
                {renderStripeModeField()}
                {renderEnvironmentChip()}
                <span className={kit.hint}>Subscription pricing appears first; related add-ons appear below when available.</span>
              </div>
              <div className={`${kit.tableWrap} table-cards`}>
                <table className={kit.comfortable}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Scope</th>
                      <th>Monthly</th>
                      <th>Annual</th>
                      <th>Latest change</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPlanPricingGroups.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={kit.empty}>
                          {selectedPlanId === 'tournament'
                            ? 'The free Tournament plan does not require Stripe price IDs.'
                            : 'No Stripe price slots found for this plan or related add-ons in this environment.'}
                        </td>
                      </tr>
                    ) : renderPriceProductRows(selectedPlanPricingGroups)}
                  </tbody>
                </table>
              </div>
            </>
          ), true)}

          <div className={kit.two}>
            {renderPanel('Feature access', 'Feature edits still use the Product catalog matrix workflow.', (
              <div className={styles.panelBody}>
                {renderSummaryStack(`${selectedPlanFeatureCount} modules enabled`, 'Published matrix')}
                <button
                  type="button"
                  className={kit.door}
                  onClick={() => {
                    closeSelectedPlanModal();
                    setActiveTab('catalog');
                    setCatalogView('matrix');
                  }}
                >
                  Open matrix ›
                </button>
              </div>
            ))}

            {renderPanel('Pending changes', 'Requests needing review or application for this plan.', (
              <div className={styles.panelBody}>
                {selectedPlanPendingRequests.length > 0 ? (
                  <>
                    <strong className={styles.pendingText}>{selectedPlanPendingRequests.length} pending</strong>
                    <Link className={kit.door} href="/platform-admin/change-requests">
                      Open approval queue ›
                    </Link>
                  </>
                ) : (
                  <span className={styles.noteEmpty}>No pending requests for this plan.</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={kit.page}>
      <AdminPageHeader title="Plans & pricing" />

      <section className={kit.band} aria-label="Account snapshot">
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Total accounts</span>
          <strong className={kit.bandValue}>{totalAccounts}</strong>
        </div>
        <div className={kit.bandCell}>
          <span className={kit.bandLabel}>Paid plan accounts</span>
          <strong className={kit.bandValue}>{paidAccounts}</strong>
        </div>
        <div className={`${kit.bandCell} ${riskAccounts > 0 ? kit.bandWarn : ''}`}>
          <span className={kit.bandLabel}>Past due / cancelled</span>
          <strong className={kit.bandValue}>{riskAccounts}</strong>
        </div>
      </section>

      {pendingChangeRequests.length > 0 && (
        <div className={`${kit.callout} ${kit.calloutWarn}`}>
          <span>
            <strong>Approval queue.</strong>{' '}
            {pendingChangeRequests.length} change request{pendingChangeRequests.length === 1 ? '' : 's'} waiting for review or application — including plan availability, pricing, and Stripe price changes.
          </span>
          <span className={kit.calloutEnd}>
            <Link className="btn btn-secondary btn-sm" href="/platform-admin/change-requests">
              Review requests
            </Link>
          </span>
        </div>
      )}

      <nav className={kit.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`${kit.tab} ${activeTab === tab.id ? kit.tabOn : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section className={`${kit.section} ${styles.pane}`} hidden={activeTab !== 'plans'}>
        <div>
          <h2 className={kit.sectionTitle}>Plan workspace</h2>
          <p className={kit.sectionLede}>
            Manage plan availability, checkout limits, trial windows, and Stripe price IDs with
            subscriber impact visible before each change. Scan plan state, customer impact, pricing, limits, pending changes, and latest update.
            Open a plan for details and scoped edits.
          </p>
        </div>
        <div className={kit.card}>
          <div className={`${kit.tableWrap} table-cards`}>
            <table className={kit.comfortable}>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Impact</th>
                  <th>Pricing</th>
                  <th>Limits &amp; trials</th>
                  <th>Pending</th>
                  <th>Updated</th>
                  <th aria-label="Open"></th>
                </tr>
              </thead>
              <tbody>
                {renderPlanOverviewRows()}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={`${kit.section} ${styles.pane} ${styles.stacked}`} hidden={activeTab !== 'catalog'}>
        <p className={kit.caption}>
          Review the current product catalog, module packaging, and planned add-ons before pricing or
          entitlement changes become live customer-facing work.
        </p>

        <div className={kit.band}>
          <div className={kit.bandCell}>
            <span className={kit.bandLabel}>Catalog versions</span>
            <strong className={kit.bandValue}>{catalogVersions.length}</strong>
          </div>
          <div className={kit.bandCell}>
            <span className={kit.bandLabel}>Add-ons</span>
            <strong className={kit.bandValue}>{addonCatalog.length}</strong>
          </div>
          <div className={kit.bandCell}>
            <span className={kit.bandLabel}>Plan modules</span>
            <strong className={kit.bandValue}>{featureMatrixRows.length}</strong>
          </div>
          <div className={kit.bandCell}>
            <span className={kit.bandLabel}>Approval queue</span>
            <strong className={kit.bandValue}>{catalogChangeRequests.length}</strong>
          </div>
          <div className={kit.bandCell}>
            <span className={kit.bandLabel}>Campaigns</span>
            <strong className={kit.bandValue}>{catalogCampaigns.length}</strong>
          </div>
        </div>

        {(catalogError || catalogSaved) && (
          <div className={`${kit.notice} ${catalogError ? kit.noticeBad : kit.noticeGood}`}>
            {catalogError || catalogSaved}
          </div>
        )}

        <div className={styles.viewBar}>
          <select
            className={kit.select}
            aria-label="Product catalog workspace"
            value={catalogView}
            onChange={event => setCatalogView(event.target.value as CatalogView)}
          >
            {CATALOG_VIEWS.map(view => (
              <option key={view.id} value={view.id}>{view.label}</option>
            ))}
          </select>
          <p className={kit.caption}>
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
              <div className={`${kit.callout} ${kit.calloutWarn}`}>
                <span>
                  <strong>{pendingStripePriceRequests.length} pricing request{pendingStripePriceRequests.length === 1 ? '' : 's'} pending.</strong>{' '}
                  Approving a generated Stripe price request applies its proposed price ID and marks it implemented.
                </span>
              </div>
            )}

            <div className={kit.callout}>
              <span>
                <strong>Change approvals moved.</strong>{' '}
                Review, approve, reject, and apply catalog requests from the central approval queue.
              </span>
              <span className={kit.calloutEnd}>
                <Link className={kit.door} href="/platform-admin/change-requests">
                  Open approval queue ›
                </Link>
              </span>
            </div>

            <section className={kit.section}>
              <div>
                <h2 className={kit.sectionTitle}>Campaign tracking</h2>
                <p className={kit.sectionLede}>
                  Track coupon, promo, trial, launch, and retention campaigns separately from live Stripe
                  price IDs.
                </p>
              </div>

              {canManageProduct && (
                <div className={`${kit.card} ${kit.cardPad}`}>
                  <div className={kit.formGrid}>
                    <label className={kit.fieldGroup}>
                      <span className={kit.label}>Title</span>
                      <input
                        className={kit.field}
                        value={campaignDraft.title}
                        placeholder="Example: Club 90-day launch trial"
                        onChange={event => setCampaignDraft(draft => ({ ...draft, title: event.target.value }))}
                      />
                    </label>
                    <label className={kit.fieldGroup}>
                      <span className={kit.label}>Type</span>
                      <select
                        className={kit.select}
                        value={campaignDraft.campaign_type}
                        onChange={event => setCampaignDraft(draft => ({ ...draft, campaign_type: event.target.value }))}
                      >
                        {CAMPAIGN_TYPES.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className={kit.fieldGroup}>
                      <span className={kit.label}>Status</span>
                      <select
                        className={kit.select}
                        value={campaignDraft.status}
                        onChange={event => setCampaignDraft(draft => ({ ...draft, status: event.target.value }))}
                      >
                        {CAMPAIGN_STATUSES.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className={kit.fieldGroup}>
                      <span className={kit.label}>Starts</span>
                      <DateInput
                        className={kit.field}
                        value={campaignDraft.starts_at}
                        onChange={v => setCampaignDraft(draft => ({ ...draft, starts_at: v }))}
                      />
                    </label>
                    <label className={kit.fieldGroup}>
                      <span className={kit.label}>Ends</span>
                      <DateInput
                        className={kit.field}
                        value={campaignDraft.ends_at}
                        onChange={v => setCampaignDraft(draft => ({ ...draft, ends_at: v }))}
                      />
                    </label>
                    <label className={kit.fieldGroup}>
                      <span className={kit.label}>Coupon code</span>
                      <input
                        className={kit.field}
                        value={campaignDraft.coupon_code}
                        placeholder="Optional"
                        onChange={event => setCampaignDraft(draft => ({ ...draft, coupon_code: event.target.value }))}
                      />
                    </label>
                    <label className={kit.fieldGroup}>
                      <span className={kit.label}>Trial days</span>
                      <input
                        className={kit.field}
                        type="number"
                        min={0}
                        value={campaignDraft.trial_days}
                        placeholder="Optional"
                        onChange={event => setCampaignDraft(draft => ({ ...draft, trial_days: event.target.value }))}
                      />
                    </label>
                    <label className={`${kit.fieldGroup} ${styles.wide}`}>
                      <span className={kit.label}>Target plans</span>
                      <span className={styles.checkGroup}>
                        {PLAN_ORDER.map(planId => (
                          <label key={planId} className={kit.check}>
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
                    <label className={`${kit.fieldGroup} ${styles.wide}`}>
                      <span className={kit.label}>Discount summary</span>
                      <input
                        className={kit.field}
                        value={campaignDraft.discount_summary}
                        placeholder="Example: 20% off annual League Plus for first season"
                        onChange={event => setCampaignDraft(draft => ({ ...draft, discount_summary: event.target.value }))}
                      />
                    </label>
                    <label className={`${kit.fieldGroup} ${styles.wide}`}>
                      <span className={kit.label}>Notes</span>
                      <textarea
                        className={kit.textarea}
                        value={campaignDraft.notes}
                        placeholder="Add eligibility, approval, and launch notes."
                        onChange={event => setCampaignDraft(draft => ({ ...draft, notes: event.target.value }))}
                      />
                    </label>
                    <div className={`${kit.formActions} ${styles.wide}`}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={createCampaign}
                        disabled={catalogBusy === 'campaign' || !campaignDraft.title.trim()}
                      >
                        {catalogBusy === 'campaign' ? <Loader size={14} className={kit.spin} /> : 'Add campaign'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className={kit.card}>
                <div className={`${kit.tableWrap} table-cards`}>
                  <table className={kit.comfortable}>
                    <thead>
                      <tr>
                        <th>Campaign</th>
                        <th>Status</th>
                        <th>Type</th>
                        <th>Target plans</th>
                        <th>Window</th>
                        <th>Offer</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalogCampaigns.length === 0 ? (
                        <tr>
                          <td colSpan={7} className={kit.empty}>No product campaigns yet.</td>
                        </tr>
                      ) : catalogCampaigns.map(campaign => (
                        <tr key={campaign.id}>
                          <td className="table-cards-title">
                            <span className={styles.name}>{campaign.title}</span>
                            <span className={`${kit.sub} ${kit.code}`}>{campaign.coupon_code ?? campaign.campaign_key}</span>
                          </td>
                          <td data-label="Status">
                            <span className={`${kit.chip} ${statusClass(campaign.status)}`}>
                              {optionLabel(CAMPAIGN_STATUSES, campaign.status)}
                            </span>
                          </td>
                          <td data-label="Type" className={kit.muted}>{optionLabel(CAMPAIGN_TYPES, campaign.campaign_type)}</td>
                          <td data-label="Target plans" className={kit.muted}>{formatPlanList(campaign.target_plan_ids)}</td>
                          <td data-label="Window" className={kit.muted}>
                            {formatDateOnly(campaign.starts_at)} - {formatDateOnly(campaign.ends_at)}
                          </td>
                          <td data-label="Offer" className={kit.muted}>
                            {campaign.discount_summary ?? (campaign.trial_days != null ? `${campaign.trial_days} trial days` : 'Not set')}
                          </td>
                          <td className={styles.actionCell}>
                            {canManageProduct ? (
                              <select
                                className={kit.select}
                                value={campaign.status}
                                disabled={catalogBusy === campaign.id}
                                onChange={event => updateCampaignStatus(campaign.id, event.target.value)}
                              >
                                {CAMPAIGN_STATUSES.map(option => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            ) : (
                              <span className={kit.muted}>Read only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}

        {catalogView === 'records' && (
          <>
            <section className={kit.section}>
              <div>
                <h2 className={kit.sectionTitle}>Plan versions</h2>
                <p className={kit.sectionLede}>
                  Published and draft catalog records. Future live publishing controls should hang off
                  this history instead of ad hoc edits.
                </p>
              </div>
              <div className={kit.card}>
                <div className={`${kit.tableWrap} table-cards`}>
                  <table className={kit.comfortable}>
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
                          <td colSpan={5} className={kit.empty}>
                            No catalog versions found. Apply migration 058 to seed the baseline catalog.
                          </td>
                        </tr>
                      ) : catalogVersions.map(version => (
                        <tr key={version.id}>
                          <td className="table-cards-title">
                            <span className={styles.name}>{version.title}</span>
                            <span className={kit.sub}>{version.description ?? version.version_key}</span>
                          </td>
                          <td data-label="Status">
                            <span className={`${kit.chip} ${statusClass(version.status)}`}>{version.status.replace('_', ' ')}</span>
                          </td>
                          <td data-label="Effective" className={kit.muted}>{formatDate(version.effective_at)}</td>
                          <td data-label="Published" className={kit.muted}>{formatDate(version.published_at)}</td>
                          <td data-label="Notes" className={styles.notePreview}>{version.notes ?? 'No note'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className={kit.section}>
              <div>
                <h2 className={kit.sectionTitle}>Add-on catalog</h2>
                <p className={kit.sectionLede}>
                  Add-ons and packaged modules that can later support public pricing, coupons, and
                  grandfathering rules.
                </p>
              </div>
              <div className={kit.card}>
                <div className={`${kit.tableWrap} table-cards`}>
                  <table className={kit.comfortable}>
                    <thead>
                      <tr>
                        <th>Add-on</th>
                        <th>Status</th>
                        <th>Included plans</th>
                        <th>Pricing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {addonCatalog.length === 0 ? (
                        <tr>
                          <td colSpan={4} className={kit.empty}>
                            No add-ons found. Apply migration 058 to seed the catalog.
                          </td>
                        </tr>
                      ) : addonCatalog.map(addon => (
                        <tr key={addon.id}>
                          <td className="table-cards-title">
                            <span className={styles.name}>{addon.label}</span>
                            <span className={kit.sub}>{addon.description ?? addon.addon_key}</span>
                          </td>
                          <td data-label="Status">
                            <span className={`${kit.chip} ${statusClass(addon.status)}`}>{addon.status.replace('_', ' ')}</span>
                          </td>
                          <td data-label="Included plans" className={kit.muted}>{formatPlanList(addon.default_included_plans)}</td>
                          <td data-label="Pricing" className={kit.muted}>
                            {addon.pricing_model === 'included'
                              ? 'Included'
                              : `${formatMoney(addon.monthly_price)} monthly / ${formatMoney(addon.annual_price)} annual`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className={kit.section}>
              <div>
                <h2 className={kit.sectionTitle}>Add-on Stripe prices</h2>
                <p className={kit.sectionLede}>
                  Add-on price slots stay with Product catalog because they are not standalone plan rows.
                  Price edits still create review requests in the approval queue.
                </p>
              </div>
              <div className={kit.card}>
                <div className={`${kit.toolbar} ${styles.modeBar}`}>
                  {renderStripeModeField()}
                  {renderEnvironmentChip()}
                </div>
                <div className={`${kit.tableWrap} table-cards`}>
                  <table className={kit.comfortable}>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Impact</th>
                        <th>Monthly</th>
                        <th>Annual</th>
                        <th>Latest change</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {addonPriceProductGroups.length === 0 ? (
                        <tr>
                          <td colSpan={6} className={kit.empty}>No add-on Stripe price slots found.</td>
                        </tr>
                      ) : renderPriceProductRows(addonPriceProductGroups)}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}

        {catalogView === 'matrix' && (
          <>
            <section className={kit.section}>
              <div>
                <h2 className={kit.sectionTitle}>Feature matrix</h2>
                <p className={kit.sectionLede}>
                  Module entitlements from the published product catalog matrix. Draft edits below create
                  Product catalog change requests; approved requests can be published from the review panel.
                </p>
              </div>

              {/* ── The honesty banner (audit 2026-08-06) ────────────────────────────────────────
                  Publishing this matrix used to LOOK like a packaging change taking effect — change
                  request, second-person approval, "Feature matrix published", grid redraws. In fact
                  the published table is read only by this screen: the live gate reads a constant in
                  lib/plan-config.ts. Nobody's access changed. Wiring it up for real is a genuine
                  project (the gate is synchronous and runs in client components), so until then this
                  screen states the limit plainly rather than implying an effect it does not have. */}
              <div className={`${kit.callout} ${kit.calloutWarn}`}>
                <div className={styles.stackText}>
                  <p>
                    <strong>Publishing here does not change what customers can access.</strong> This matrix is
                    the record of intended packaging. Live entitlement is still read from{' '}
                    <code className={kit.code}>lib/plan-config.ts</code>, so a real packaging change needs a code update and a
                    deploy. Publish to record the decision — then raise the code change.
                  </p>
                  {featureMatrixDrift.length > 0 ? (
                    <>
                      <p>
                        ⚠ <strong>{featureMatrixDrift.length} module{featureMatrixDrift.length === 1 ? '' : 's'} published but NOT live</strong>{' '}
                        — these are waiting on that code change:
                      </p>
                      <ul>
                        {featureMatrixDrift.map(row => (
                          <li key={`${row.planId}:${row.moduleKey}`}>
                            <strong>{planLabel(row.planId)}</strong> · {row.moduleKey} —{' '}
                            published as <strong>{row.publishedIncluded ? 'included' : 'not included'}</strong>,
                            live product says <strong>{row.liveIncluded ? 'included' : 'not included'}</strong>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p>
                      ✅ Published matrix and live product currently agree — nothing outstanding.
                    </p>
                  )}
                </div>
              </div>
              <div className={kit.card}>
                <div className={kit.tableWrap}>
                  <table className={`${kit.comfortable} ${styles.matrix}`}>
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
                          <td>
                            <span className={styles.name}>{feature.label}</span>
                            <span className={kit.sub}>{feature.description}</span>
                          </td>
                          {PLAN_ORDER.map(planId => {
                            const included = feature.includedPlans[planId];
                            return (
                              <td key={planId} className={styles.matrixCell}>
                                <span className={`${styles.mark} ${included ? styles.markOn : styles.markOff}`}>
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
              </div>
            </section>

            <section className={kit.section}>
              <div>
                <h2 className={kit.sectionTitle}>Publish approved matrix</h2>
                <p className={kit.sectionLede}>
                  Select an approved feature matrix request, review the exact plan/module changes, then
                  publish it into the live product catalog matrix.
                </p>
              </div>

              {canManageProduct ? (
                <div className={`${kit.card} ${kit.cardPad}`}>
                  <div className={styles.vstack}>
                    <label className={kit.fieldGroup}>
                      <span className={kit.label}>Approved feature matrix request</span>
                      <select
                        className={kit.select}
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
                        <div className={styles.previewGrid}>
                          <div>
                            <span className={kit.eye}>Proposal</span>
                            <strong>{selectedFeaturePublishRequest.title}</strong>
                            <span className={kit.sub}>{selectedFeaturePublishRequest.impact_summary ?? 'No impact summary'}</span>
                          </div>
                          <div>
                            <span className={kit.eye}>Preview</span>
                            <strong>{selectedFeaturePublishChanges.length} change{selectedFeaturePublishChanges.length === 1 ? '' : 's'}</strong>
                            <span className={kit.sub}>{selectedFeaturePublishEntitlements ? 'Validated feature matrix proposal' : 'Invalid proposal payload'}</span>
                          </div>
                        </div>

                        {selectedFeaturePublishChanges.length > 0 ? (
                          <div className={styles.changeList}>
                            {selectedFeaturePublishChanges.map(change => (
                              <div key={`${change.planId}:${change.moduleKey}`} className={styles.changeItem}>
                                <span className={kit.eye}>{planLabel(change.planId)}</span>
                                <strong>{change.moduleKey.replace('module_', '').replace(/_/g, ' ')}</strong>
                                <span className={kit.sub}>
                                  {change.current ? 'Included' : 'Not included'} to {change.proposed ? 'included' : 'not included'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className={kit.empty}>This approved request matches the current live matrix.</div>
                        )}

                        <label className={kit.fieldGroup}>
                          <span className={kit.label}>Publish note</span>
                          <input
                            className={kit.field}
                            value={featurePublishNote}
                            placeholder="Summarize why this approved matrix is being published now."
                            onChange={event => {
                              setFeaturePublishNote(event.target.value);
                              setFeaturePublishConfirming(false);
                            }}
                          />
                        </label>

                        <div className={styles.footRow}>
                          <span>
                            {featurePublishConfirming
                              ? 'Click confirm to publish these entitlement changes.'
                              : 'Review the preview before publishing.'}
                          </span>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={publishFeatureMatrixRequest}
                            disabled={
                              catalogBusy === 'feature-matrix-publish' ||
                              selectedFeaturePublishChanges.length === 0 ||
                              !selectedFeaturePublishEntitlements
                            }
                          >
                            {catalogBusy === 'feature-matrix-publish'
                              ? <Loader size={14} className={kit.spin} />
                              : featurePublishConfirming ? 'Confirm publish' : 'Publish matrix'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className={kit.empty}>
                        {approvedFeatureMatrixRequests.length === 0
                          ? 'No approved feature matrix requests are ready to publish.'
                          : 'Select an approved request to preview its matrix changes.'}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className={kit.card}>
                  <div className={kit.empty}>Read-only roles can review published entitlements but cannot publish matrix changes.</div>
                </div>
              )}
            </section>

            <section className={kit.section}>
              <div>
                <h2 className={kit.sectionTitle}>Draft feature matrix change</h2>
                <p className={kit.sectionLede}>
                  Toggle proposed module access by plan, then save the draft into the approval workflow.
                  Live entitlements stay unchanged until a later approved implementation.
                </p>
              </div>

              {canManageProduct ? (
                <>
                  <div className={`${kit.card} ${kit.cardPad}`}>
                    <div className={kit.formGrid}>
                      <label className={kit.fieldGroup}>
                        <span className={kit.label}>Title</span>
                        <input
                          className={kit.field}
                          value={featureDraftTitle}
                          onChange={event => setFeatureDraftTitle(event.target.value)}
                        />
                      </label>
                      <label className={kit.fieldGroup}>
                        <span className={kit.label}>Effective date</span>
                        <DateInput
                          className={kit.field}
                          value={featureDraftEffectiveAt}
                          onChange={v => setFeatureDraftEffectiveAt(v)}
                        />
                      </label>
                      <label className={`${kit.fieldGroup} ${styles.wide}`}>
                        <span className={kit.label}>Impact summary</span>
                        <input
                          className={kit.field}
                          value={featureDraftImpact}
                          placeholder="Who would be affected if this matrix is later implemented?"
                          onChange={event => setFeatureDraftImpact(event.target.value)}
                        />
                      </label>
                      <label className={`${kit.fieldGroup} ${styles.wide}`}>
                        <span className={kit.label}>Description</span>
                        <textarea
                          className={kit.textarea}
                          value={featureDraftDescription}
                          placeholder="Explain the packaging reason, launch notes, and approval criteria."
                          onChange={event => setFeatureDraftDescription(event.target.value)}
                        />
                      </label>
                    </div>
                  </div>

                  <div className={kit.card}>
                    <div className={kit.tableWrap}>
                      <table className={`${kit.comfortable} ${styles.matrix}`}>
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
                              <td>
                                <span className={styles.name}>{feature.label}</span>
                                <span className={kit.sub}>{feature.description}</span>
                              </td>
                              {PLAN_ORDER.map(planId => {
                                const current = Boolean(feature.includedPlans[planId]);
                                const proposed = Boolean(featureDraft[planId]?.[feature.key]);
                                const changed = current !== proposed;
                                return (
                                  <td key={planId} className={styles.matrixCell}>
                                    <button
                                      type="button"
                                      className={`${styles.toggle} ${proposed ? styles.toggleOn : ''} ${changed ? styles.toggleChanged : ''}`}
                                      onClick={() => toggleFeatureDraft(planId, feature.key)}
                                    >
                                      {proposed ? <Check size={14} /> : <X size={14} />}
                                      {proposed ? 'Included' : 'Not included'}
                                    </button>
                                    {changed && (
                                      <span className={styles.delta}>
                                        was {current ? 'included' : 'not included'}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className={`${kit.cardPad} ${styles.footRow} ${styles.cardFoot}`}>
                      <span>{matrixChanges.length} proposed change{matrixChanges.length === 1 ? '' : 's'}</span>
                      <span className={styles.actionBtns}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={resetFeatureDraft}
                          disabled={catalogBusy === 'feature-matrix'}
                        >
                          Reset draft
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={createFeatureMatrixRequest}
                          disabled={catalogBusy === 'feature-matrix' || matrixChanges.length === 0}
                        >
                          {catalogBusy === 'feature-matrix'
                            ? <Loader size={14} className={kit.spin} />
                            : 'Save draft request'}
                        </button>
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className={kit.card}>
                  <div className={kit.empty}>Read-only roles can review the feature matrix but cannot draft entitlement changes.</div>
                </div>
              )}
            </section>
          </>
        )}
      </section>

      {renderSelectedPlanModal()}

      {selectedPriceProduct && (
        <div className={styles.backdrop} role="presentation" onClick={() => setSelectedPriceProductId(null)}>
          <div
            className={`${styles.window} ${styles.windowMid}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="price-product-title"
            onClick={event => event.stopPropagation()}
          >
            <div className={styles.windowHead}>
              <div>
                <h2 id="price-product-title" className={styles.windowTitle}>{selectedPriceProduct.label}</h2>
                <p className={styles.windowSub}>
                  {priceEnvironmentTab === 'live' ? 'Production prices' : 'Test prices'}
                </p>
              </div>
              <button
                type="button"
                className={styles.close}
                onClick={() => setSelectedPriceProductId(null)}
                title="Close"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.viewBar}>
              <span className={kit.count}>{cleanProductName(selectedPriceProduct.productName)}</span>
              {renderEnvironmentChip()}
            </div>

            <div className={kit.card}>
              <div className={kit.tableWrap}>
                <table className={kit.comfortable}>
                  <thead>
                    <tr>
                      <th>Cycle</th>
                      <th>Price ID</th>
                      <th>Last change</th>
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
        </div>
      )}

      {planRequestDraft && (
        <div className={styles.backdrop} role="presentation">
          <div className={styles.window} role="dialog" aria-modal="true" aria-labelledby="plan-request-title">
            <div className={styles.windowHead}>
              <div>
                <h2 id="plan-request-title" className={styles.windowTitle}>Submit plan change</h2>
                <p className={styles.windowSub}>Approval request</p>
              </div>
              <button
                type="button"
                className={styles.close}
                onClick={() => setPlanRequestDraft(null)}
                disabled={catalogBusy === 'plan-change-request'}
                title="Close"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className={kit.band}>
              <div className={kit.bandCell}>
                <span className={kit.bandLabel}>Plan</span>
                <strong className={kit.bandValueText}>{planLabel(planRequestDraft.target_plan_id)}</strong>
              </div>
              <div className={kit.bandCell}>
                <span className={kit.bandLabel}>Type</span>
                <strong className={kit.bandValueText}>{planRequestDraft.proposal.kind === 'plan_gating_update' ? 'Availability' : 'Limits & trials'}</strong>
              </div>
              <div className={kit.bandCell}>
                <span className={kit.bandLabel}>Priority</span>
                <strong className={kit.bandValueText}>{optionLabel(PRIORITIES, planRequestDraft.priority)}</strong>
              </div>
              <div className={kit.bandCell}>
                <span className={kit.bandLabel}>Status</span>
                <strong className={kit.bandValueText}>Needs review</strong>
              </div>
            </div>

            {planRequestError && <div className={`${kit.notice} ${kit.noticeBad}`}>{planRequestError}</div>}

            <div className={kit.formGrid}>
              <label className={`${kit.fieldGroup} ${styles.wide}`}>
                <span className={kit.label}>Title</span>
                <input
                  className={kit.field}
                  value={planRequestDraft.title}
                  onChange={event => setPlanRequestDraft(draft => draft ? { ...draft, title: event.target.value } : draft)}
                />
              </label>
              <label className={kit.fieldGroup}>
                <span className={kit.label}>Priority</span>
                <select
                  className={kit.select}
                  value={planRequestDraft.priority}
                  onChange={event => setPlanRequestDraft(draft => draft ? { ...draft, priority: event.target.value } : draft)}
                >
                  {PRIORITIES.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className={`${kit.fieldGroup} ${styles.wide}`}>
                <span className={kit.label}>Impact summary</span>
                <input
                  className={kit.field}
                  value={planRequestDraft.impact_summary}
                  onChange={event => setPlanRequestDraft(draft => draft ? { ...draft, impact_summary: event.target.value } : draft)}
                />
              </label>
              <label className={`${kit.fieldGroup} ${styles.wide}`}>
                <span className={kit.label}>Description</span>
                <textarea
                  className={kit.textarea}
                  value={planRequestDraft.description}
                  onChange={event => setPlanRequestDraft(draft => draft ? { ...draft, description: event.target.value } : draft)}
                />
              </label>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPlanRequestDraft(null)}
                disabled={catalogBusy === 'plan-change-request'}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitPlanChangeRequest}
                disabled={catalogBusy === 'plan-change-request' || !planRequestDraft.title.trim()}
              >
                {catalogBusy === 'plan-change-request'
                  ? <Loader size={14} className={kit.spin} />
                  : 'Submit for review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {priceRequestDraft && (
        <div className={styles.backdrop} role="presentation">
          <div className={styles.window} role="dialog" aria-modal="true" aria-labelledby="price-request-title">
            <div className={styles.windowHead}>
              <div>
                <h2 id="price-request-title" className={styles.windowTitle}>Submit price change</h2>
                <p className={styles.windowSub}>Approval request</p>
              </div>
              <button
                type="button"
                className={styles.close}
                onClick={() => setPriceRequestDraft(null)}
                disabled={catalogBusy === 'price-change-request'}
                title="Close"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className={kit.band}>
              <div className={kit.bandCell}>
                <span className={kit.bandLabel}>Plan</span>
                <strong className={kit.bandValueText}>{PRICE_PLAN_LABELS[priceRequestDraft.row.plan_id] ?? priceRequestDraft.row.plan_id}</strong>
              </div>
              <div className={kit.bandCell}>
                <span className={kit.bandLabel}>Cycle</span>
                <strong className={kit.bandValueText}>{priceRequestDraft.row.billing_cycle}</strong>
              </div>
              <div className={kit.bandCell}>
                <span className={kit.bandLabel}>Environment</span>
                <strong className={kit.bandValueText}>{priceRequestDraft.row.environment}</strong>
              </div>
              <div className={kit.bandCell}>
                <span className={kit.bandLabel}>Proposed</span>
                {priceRequestDraft.proposedPriceId
                  ? <strong className={`${kit.bandValueText} ${kit.code}`}>{priceRequestDraft.proposedPriceId}</strong>
                  : <strong className={kit.bandValueText}>Clear price ID</strong>}
              </div>
            </div>

            {priceRequestError && <div className={`${kit.notice} ${kit.noticeBad}`}>{priceRequestError}</div>}

            <div className={kit.formGrid}>
              <label className={`${kit.fieldGroup} ${styles.wide}`}>
                <span className={kit.label}>Title</span>
                <input
                  className={kit.field}
                  value={priceRequestDraft.title}
                  onChange={event => setPriceRequestDraft(draft => draft ? { ...draft, title: event.target.value } : draft)}
                />
              </label>
              <label className={kit.fieldGroup}>
                <span className={kit.label}>Priority</span>
                <select
                  className={kit.select}
                  value={priceRequestDraft.priority}
                  onChange={event => setPriceRequestDraft(draft => draft ? { ...draft, priority: event.target.value } : draft)}
                >
                  {PRIORITIES.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className={`${kit.fieldGroup} ${styles.wide}`}>
                <span className={kit.label}>Impact summary</span>
                <input
                  className={kit.field}
                  value={priceRequestDraft.impact_summary}
                  onChange={event => setPriceRequestDraft(draft => draft ? { ...draft, impact_summary: event.target.value } : draft)}
                />
              </label>
              <label className={`${kit.fieldGroup} ${styles.wide}`}>
                <span className={kit.label}>Change note</span>
                <input
                  className={kit.field}
                  value={priceRequestDraft.changeNote}
                  placeholder="Why is this Stripe price ID changing?"
                  onChange={event => setPriceRequestDraft(draft => draft ? { ...draft, changeNote: event.target.value } : draft)}
                />
              </label>
              <label className={`${kit.fieldGroup} ${styles.wide}`}>
                <span className={kit.label}>Description</span>
                <textarea
                  className={kit.textarea}
                  value={priceRequestDraft.description}
                  onChange={event => setPriceRequestDraft(draft => draft ? { ...draft, description: event.target.value } : draft)}
                />
              </label>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPriceRequestDraft(null)}
                disabled={catalogBusy === 'price-change-request'}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitPriceChangeRequest}
                disabled={catalogBusy === 'price-change-request' || !priceRequestDraft.title.trim()}
              >
                {catalogBusy === 'price-change-request'
                  ? <Loader size={14} className={kit.spin} />
                  : 'Submit for review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
