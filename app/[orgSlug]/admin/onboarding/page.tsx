'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Plus,
  Rocket,
  Trash2,
  X,
} from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { PLAN_CONFIG, formatPriceAmount } from '@/lib/plan-config';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { isFreeFloorLeague, houseLeagueDivisionCap, freeFloorModules } from '@/lib/free-floor';
import type { FreeFloor, OrgPlan, TournamentFormat, FacilityType } from '@/lib/types';
import { FACILITY_TYPE_LABELS } from '@/lib/types';
import PricingSection from '@/components/PricingSection';
import styles from './onboarding.module.css';

const PLAN_ORDER: OrgPlan[] = ['tournament', 'team', 'tournament_plus', 'league', 'club'];
const STARTUP_ORDER = ['tournament', 'divisions', 'welcome', 'venues'] as const;
// Plan selection is a standalone gate (reached via ?choosePlan=1), NOT a numbered
// wizard step. The wizard is the 6-step tournament setup flow.
const WIZARD_ORDER = ['qualifying', ...STARTUP_ORDER, 'review'] as const;
const LEAGUE_STARTUP_ORDER = ['league_season', 'league_divisions', 'league_registration', 'league_tournament'] as const;
const LEAGUE_WIZARD_ORDER = ['league-season', 'league-divisions', 'league-registration', 'league-tournament', 'league-review'] as const;

type StartupActionTaskId = typeof STARTUP_ORDER[number];
type LeagueStartupActionTaskId = typeof LEAGUE_STARTUP_ORDER[number];
type StartupProgressTaskId = 'plan' | StartupActionTaskId | LeagueStartupActionTaskId;
// 'plan' is a gate, not part of WIZARD_ORDER, but it stays in the union so legacy
// guards (activeModal === 'plan', markStartupTask('plan', …)) still type-check.
type StartupTaskId = 'plan' | typeof WIZARD_ORDER[number];
type LeagueWizardTaskId = typeof LEAGUE_WIZARD_ORDER[number];
type StartupTaskStatus = 'pending' | 'complete' | 'skipped';
type ActiveModal = StartupTaskId | LeagueWizardTaskId | null;
type DivisionPreset = 'youth' | 'adult' | 'custom';
type LeagueDivisionPreset = 'youth' | 'adult' | 'custom';

type TournamentSummary = {
  id: string;
  name: string;
  slug: string;
  year: number;
  status: 'draft' | 'active' | 'completed' | 'archived';
  startDate?: string | null;
  endDate?: string | null;
  contactEmail?: string | null;
};

type StartupProgress = {
  tasks: Record<StartupProgressTaskId, StartupTaskStatus>;
  totalCount: number;
  completeCount: number;
  finishedCount: number;
  allFinished: boolean;
  wizardAvailable: boolean;
  firstTournament: TournamentSummary | null;
};

type DivisionRow = {
  id: string;
  sourceId?: string;
  name: string;
  minAge: string;
  maxAge: string;
  capacity: number;
  poolCount: number;
  requiresPoolSelection: boolean;
  poolNames: string[];
};

type VenueFields = {
  name: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  notes: string;
  /** How many fields/diamonds this venue has — drives auto-created scheduling lanes (J1-028). */
  fieldCount: string;
  /** The kind of playing surface — sets the facility type + auto-names (Diamond 1…N). */
  facilityType: FacilityType;
};

/** Surface types offered in the wizard (the in-app editor also has "other"; the
 *  wizard keeps it to the concrete surfaces and defaults to diamond). */
const WIZARD_FACILITY_TYPES: FacilityType[] = ['diamond', 'field', 'court', 'rink', 'gym'];

type VenueRow = VenueFields & {
  id: string;
};

type DraftSkippedState = Record<StartupActionTaskId, boolean>;
type LeagueDraftSkippedState = Record<LeagueStartupActionTaskId, boolean>;

type LeagueDivisionRow = {
  id: string;
  name: string;
  capacity: string;
};

type LeagueSeasonForm = {
  name: string;
  slug: string;
  sport: string;
  division: string;
  description: string;
  seasonStartDate: string;
  seasonEndDate: string;
  registrationFee: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  waiverText: string;
  autoApproveUnderCapacity: boolean;
  autoPromoteWaitlist: boolean;
  autoGenerateFees: boolean;
};


const CANADIAN_PROVINCES = [
  'AB',
  'BC',
  'MB',
  'NB',
  'NL',
  'NS',
  'NT',
  'NU',
  'ON',
  'PE',
  'QC',
  'SK',
  'YT',
];


const DIVISION_PRESETS: Record<Exclude<DivisionPreset, 'custom'>, string[]> = {
  youth: ['U9', 'U11', 'U13', 'U15', 'U17', 'U19'],
  adult: ['Open', 'Competitive', 'Recreational'],
};

const LEAGUE_DIVISION_PRESETS: Record<Exclude<LeagueDivisionPreset, 'custom'>, string[]> = {
  youth: ['U9', 'U11', 'U13', 'U15', 'U17'],
  adult: ['Recreational', 'Competitive'],
};

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getDefaultTournamentForm() {
  const defaultName = `${new Date().getFullYear()} Tournament`;
  return {
    name: defaultName,
    slug: generateSlug(defaultName),
    startDate: '',
    endDate: '',
    format: 'round_robin_playoffs' as TournamentFormat,
  };
}

function getDefaultLeagueSeasonForm(): LeagueSeasonForm {
  const nextYear = new Date().getFullYear();
  const defaultName = `${nextYear} House League`;
  return {
    name: defaultName,
    slug: generateSlug(defaultName),
    sport: 'softball',
    division: '',
    description: '',
    seasonStartDate: '',
    seasonEndDate: '',
    registrationFee: '',
    registrationOpenAt: '',
    registrationCloseAt: '',
    waiverText: '',
    autoApproveUnderCapacity: true,
    autoPromoteWaitlist: true,
    autoGenerateFees: false,
  };
}

function getDefaultDraftSkipped(): DraftSkippedState {
  return {
    tournament: false,
    divisions: false,
    welcome: false,
    venues: false,
  };
}

function getDefaultLeagueDraftSkipped(): LeagueDraftSkippedState {
  return {
    league_season: false,
    league_divisions: false,
    league_registration: false,
    league_tournament: false,
  };
}

function isDateValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getTodayDateValue() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : new Date().toISOString().slice(0, 10);
}

function addDaysToDateValue(value: string, days: number) {
  if (!isDateValue(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getDivisionStarterAgeRange(name: string) {
  const normalized = name.trim();
  const youthMatch = normalized.match(/^U\s*(\d{1,2})$/i) || normalized.match(/^(\d{1,2})\s*U$/i);
  if (youthMatch) {
    return { minAge: '', maxAge: youthMatch[1] };
  }
  if (['Open', 'Competitive', 'Recreational'].includes(normalized)) {
    return { minAge: '18', maxAge: '' };
  }
  return { minAge: '', maxAge: '' };
}

function buildDivisionRows(names: string[]): DivisionRow[] {
  return names.map((name, index) => ({
    id: `${generateSlug(name) || 'division'}-${index + 1}`,
    name,
    ...getDivisionStarterAgeRange(name),
    capacity: 8,
    poolCount: 0,
    requiresPoolSelection: false,
    poolNames: ['Pool A'],
  }));
}

function buildLeagueDivisionRows(names: string[]): LeagueDivisionRow[] {
  return names.map((name, index) => ({
    id: `${generateSlug(name) || 'division'}-${index + 1}`,
    name,
    capacity: '',
  }));
}

function buildVenueDraft(): VenueFields {
  return {
    name: '',
    street: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'Canada',
    notes: '',
    fieldCount: '1',
    facilityType: 'diamond',
  };
}

function buildVenueRow(index: number, draft: VenueFields = buildVenueDraft()): VenueRow {
  return { ...draft, id: `venue-${index}` };
}

function normalizeVenueFields(venue: VenueFields): VenueFields {
  return {
    name: venue.name.trim(),
    street: venue.street.trim(),
    city: venue.city.trim(),
    province: venue.province.trim(),
    postalCode: venue.postalCode.trim(),
    country: venue.country.trim() || 'Canada',
    notes: venue.notes.trim(),
    fieldCount: normalizeFieldCount(venue.fieldCount),
    facilityType: venue.facilityType,
  };
}

/** Clamp the field/diamond count to a sane 1–30 and default to '1'. */
function normalizeFieldCount(raw: string): string {
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 1) return '1';
  return String(Math.min(n, 30));
}

function hasVenueContent(venue: VenueFields) {
  const normalized = normalizeVenueFields(venue);
  return !!(normalized.name || normalized.street || normalized.city || normalized.province || normalized.postalCode || normalized.notes);
}

function isVenueReady(venue: VenueFields) {
  const normalized = normalizeVenueFields(venue);
  return !!normalized.name;
}

function formatVenueAddress(venue: VenueFields) {
  const normalized = normalizeVenueFields(venue);
  const hasAddressDetails = !!(normalized.street || normalized.city || normalized.province || normalized.postalCode);
  if (!hasAddressDetails) return '';

  const cityLine = [normalized.city, normalized.province, normalized.postalCode].filter(Boolean).join(' ');
  return [normalized.street, cityLine, normalized.country].filter(Boolean).join(', ');
}

function normalizePlanId(planId: string): OrgPlan {
  return PLAN_ORDER.includes(planId as OrgPlan) ? planId as OrgPlan : 'tournament';
}

function hasNonTournamentWorkspace(planId: string, enabledAddons: string[] = [], freeFloor?: FreeFloor) {
  const entitledModules = new Set([
    ...PLAN_CONFIG[normalizePlanId(planId)].moduleEntitlements,
    // A League Starter free-floor org keeps plan_id='tournament' but DOES run house-league —
    // union the free-floor modules so it lands on /admin, not the tournament dashboard.
    ...freeFloorModules(freeFloor),
    ...enabledAddons,
  ]);
  return (
    entitledModules.has('module_public_site') ||
    entitledModules.has('module_accounting') ||
    entitledModules.has('module_house_league') ||
    entitledModules.has('module_rep_teams')
  );
}

function getPostOnboardingHref(
  org: { slug: string; planId: string; enabledAddons?: string[]; freeFloor?: FreeFloor },
  options: { hasTournament?: boolean } = {},
) {
  // Free League Starter floor → land on the league dashboard (their job), not the generic hub.
  if (org.freeFloor === 'league_starter') return `/${org.slug}/admin/house-league`;
  if (hasNonTournamentWorkspace(org.planId, org.enabledAddons, org.freeFloor)) return `/${org.slug}/admin`;
  if (options.hasTournament === false) return `/${org.slug}/admin/tournaments`;
  return `/${org.slug}/admin/tournaments/dashboard`;
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Something went wrong.');
  }
  return data as T;
}

async function markStartupTask(taskId: StartupActionTaskId | LeagueStartupActionTaskId | 'plan', status: 'complete' | 'skipped', orgSlug?: string) {
  const orgParam = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
  return requestJson<StartupProgress>(`/api/admin/org/startup-tasks${orgParam}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, status }),
  });
}

export default function OnboardingPage() {
  const { currentOrg, userRole, loading, refresh: refreshOrgContext } = useOrg();
  const { refresh: refreshTournamentContext } = useTournament();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [startupProgress, setStartupProgress] = useState<StartupProgress | null>(null);
  const [seasonsDone, setSeasonsDone] = useState<boolean | null>(null);
  const [repTeamsDone, setRepTeamsDone] = useState<boolean | null>(null);
  const [publicSiteDone, setPublicSiteDone] = useState<boolean | null>(null);
  const [completing, setCompleting] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [planChooserOpen, setPlanChooserOpen] = useState(false);
  const [wizardDismissed, setWizardDismissed] = useState(false);
  const [workflowRedirecting, setWorkflowRedirecting] = useState(false);
  const [stepSaving, setStepSaving] = useState(false);
  const [stepError, setStepError] = useState('');
  const [gatingMap, setGatingMap] = useState<Record<OrgPlan, boolean>>(() => ({
    tournament: PLAN_CONFIG.tournament.gatingStatus === 'early_access',
    team: PLAN_CONFIG.team.gatingStatus === 'early_access',
    tournament_plus: PLAN_CONFIG.tournament_plus.gatingStatus === 'early_access',
    league: PLAN_CONFIG.league.gatingStatus === 'early_access',
    club: PLAN_CONFIG.club.gatingStatus === 'early_access',
  }));
  const [planLoading, setPlanLoading] = useState<OrgPlan | null>(null);
  const [planError, setPlanError] = useState('');
  const [draftSkipped, setDraftSkipped] = useState<DraftSkippedState>(getDefaultDraftSkipped);
  const [leagueDraftSkipped, setLeagueDraftSkipped] = useState<LeagueDraftSkippedState>(getDefaultLeagueDraftSkipped);
  const [qualifyingAnswer, setQualifyingAnswer] = useState<string>('');

  const [tournamentForm, setTournamentForm] = useState(getDefaultTournamentForm);
  const [slugEdited, setSlugEdited] = useState(false);
  const [divisionPreset, setDivisionPreset] = useState<DivisionPreset>('youth');
  const [divisionRows, setDivisionRows] = useState<DivisionRow[]>(() => buildDivisionRows(DIVISION_PRESETS.youth));
  const [customDivisionName, setCustomDivisionName] = useState('');
  const [useWelcomeMsg, setUseWelcomeMsg] = useState(true);
  const [welcomeMsg, setWelcomeMsg] = useState('Welcome to our tournament! We are excited to host a great event for all participating teams.');

  const [venueDraft, setVenueDraft] = useState<VenueFields>(buildVenueDraft);
  const [venueRows, setVenueRows] = useState<VenueRow[]>([]);
  const [leagueSeasonForm, setLeagueSeasonForm] = useState<LeagueSeasonForm>(getDefaultLeagueSeasonForm);
  const [leagueDivisionPreset, setLeagueDivisionPreset] = useState<LeagueDivisionPreset>('youth');
  const [leagueDivisionRows, setLeagueDivisionRows] = useState<LeagueDivisionRow[]>(() => buildLeagueDivisionRows(LEAGUE_DIVISION_PRESETS.youth));
  const [leagueCustomDivisionName, setLeagueCustomDivisionName] = useState('');
  const [leagueWantsTournamentSetup, setLeagueWantsTournamentSetup] = useState(false);

  const planChoiceRequired = searchParams.get('choosePlan') === '1';
  const continueSetup = searchParams.get('continueSetup') === '1';
  const planSelectionSucceeded = searchParams.get('success') === '1';

  function isFirstRunPlanEditable(progress: StartupProgress | null = startupProgress) {
    if (!currentOrg || currentOrg.onboardingCompletedAt) return false;
    if (!progress) return planChoiceRequired;
    if (progress.firstTournament) return false;
    return [...STARTUP_ORDER, ...LEAGUE_STARTUP_ORDER].every(taskId => progress.tasks[taskId] !== 'complete');
  }

  function getWizardResumeStep(): StartupTaskId {
    // Plan selection is handled by a standalone gate (?choosePlan=1) before the wizard,
    // so the wizard always resumes at its first setup step.
    return 'qualifying';
  }

  const refreshStartup = useCallback(async () => {
    const orgParam = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
    const progress = await requestJson<StartupProgress>(`/api/admin/org/startup-tasks${orgParam}`);
    setStartupProgress(progress);
    return progress;
  }, [currentOrg?.slug]);

  useEffect(() => {
    if (loading || !currentOrg) return;

    const activePlan = normalizePlanId(currentOrg.planId);
    const isGuidedTournamentPlan = activePlan === 'tournament' || activePlan === 'tournament_plus';

    if (currentOrg.onboardingCompletedAt && !continueSetup && !isGuidedTournamentPlan) {
      router.replace(`/${currentOrg.slug}/admin`);
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshStartup().catch(() => {
      setStartupProgress(null);
    });

    const entitlements = PLAN_CONFIG[activePlan].moduleEntitlements;

    // House-league can be unlocked by the paid plan OR the League Starter free-floor profile —
    // use the effective entitlement, not the plan config alone, so free-floor orgs run the wizard.
    const onboardOrgQuery = currentOrg.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
    const seasonsRequest = hasModuleEntitlement(currentOrg, 'module_house_league')
      ? fetch(`/api/admin/house-league/seasons${onboardOrgQuery}`)
        .then(r => r.ok ? r.json() : [])
        .then(d => Array.isArray(d) && d.length > 0)
        .catch(() => false)
      : Promise.resolve(null);
    seasonsRequest.then(setSeasonsDone);

    const repTeamsRequest = entitlements.includes('module_rep_teams')
      ? fetch(`/api/admin/rep-teams/teams${onboardOrgQuery}`)
        .then(r => r.ok ? r.json() : { teams: [] })
        .then(d => Array.isArray(d?.teams) && d.teams.length > 0)
        .catch(() => false)
      : Promise.resolve(null);
    repTeamsRequest.then(setRepTeamsDone);

    const publicSiteRequest = entitlements.includes('module_public_site')
      ? fetch(`/api/admin/public-site${onboardOrgQuery}`)
        .then(r => r.ok ? r.json() : {})
        .then((d: Record<string, unknown>) => !!(d?.tagline || d?.description))
        .catch(() => false)
      : Promise.resolve(null);
    publicSiteRequest.then(setPublicSiteDone);
  }, [loading, currentOrg, continueSetup, router, refreshStartup]);

  useEffect(() => {
    if (loading || !currentOrg || !userRole || userRole === 'owner') return;
    router.replace(`/${currentOrg.slug}/admin`);
  }, [loading, currentOrg, userRole, router]);

  useEffect(() => {
    fetch('/api/plan-gating')
      .then(r => r.json())
      .then(setGatingMap)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (loading || !currentOrg || !startupProgress) return;
    const activePlan = normalizePlanId(currentOrg.planId);
    const isGuidedTournamentPlan = activePlan === 'tournament' || activePlan === 'tournament_plus';
    if (isGuidedTournamentPlan && !startupProgress.wizardAvailable) {
      router.replace(getPostOnboardingHref(currentOrg, { hasTournament: Boolean(startupProgress.firstTournament) }));
    }
  }, [loading, currentOrg, startupProgress, router]);

  useEffect(() => {
    if (
      loading ||
      !currentOrg ||
      userRole !== 'owner' ||
      startupProgress?.wizardAvailable === false ||
      planChoiceRequired ||
      !startupProgress ||
      activeModal ||
      planChooserOpen ||
      wizardDismissed ||
      workflowRedirecting
    ) {
      return;
    }

    const activePlan = normalizePlanId(currentOrg.planId);
    if (activePlan !== 'tournament' && activePlan !== 'tournament_plus') return;

    // Plan selection is a standalone gate. If a plan-less org reaches the wizard without
    // going through it (no ?choosePlan=1 / ?continueSetup=1 / ?success=1), send them to the
    // gate first rather than letting the wizard open with no plan chosen.
    const planChosen = startupProgress.tasks.plan === 'complete';
    if (!planChosen && !planSelectionSucceeded && !continueSetup) {
      router.replace(`/${currentOrg.slug}/admin/onboarding?choosePlan=1`);
      return;
    }

    void showWizardStep(getWizardResumeStep());
  }, [loading, currentOrg, userRole, planChoiceRequired, continueSetup, planSelectionSucceeded, startupProgress, activeModal, planChooserOpen, wizardDismissed, workflowRedirecting, router]);

  useEffect(() => {
    if (
      loading ||
      !currentOrg ||
      userRole !== 'owner' ||
      currentOrg.onboardingCompletedAt ||
      planChoiceRequired ||
      activeModal ||
      planChooserOpen ||
      wizardDismissed ||
      workflowRedirecting ||
      seasonsDone !== false
    ) {
      return;
    }

    // Trigger the house-league setup wizard whenever the org has the module — via the paid
    // League/Club plan OR the League Starter free-floor profile (plan_id stays 'tournament').
    if (!hasModuleEntitlement(currentOrg, 'module_house_league')) return;

    void showWizardStep('league-season');
  }, [loading, currentOrg, userRole, planChoiceRequired, seasonsDone, activeModal, planChooserOpen, wizardDismissed, workflowRedirecting]);

  // League Starter free-floor caps at one division — trim the multi-division preset default so the
  // wizard can't author (and then self-trip the server cap on) a second division mid-flow.
  useEffect(() => {
    if (currentOrg && isFreeFloorLeague(currentOrg)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeagueDivisionRows(prev => (prev.length > 1 ? prev.slice(0, 1) : prev));
    }
  }, [currentOrg]);

  async function complete() {
    if (!currentOrg || completing) return;
    setCompleting(true);
    const completeOrgQuery = currentOrg.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
    await fetch(`/api/admin/org/complete-onboarding${completeOrgQuery}`, { method: 'POST' });
    setWorkflowRedirecting(true);
    router.replace(getPostOnboardingHref(currentOrg, { hasTournament: false }));
  }

  async function advancePlanStep(selectedPlan: OrgPlan) {
    const newPlan = normalizePlanId(selectedPlan);
    if (newPlan === 'league' || newPlan === 'club') {
      await showWizardStep('league-season');
    } else {
      await advanceWizard('plan');
    }
  }

  async function saveQualifyingStep() {
    // Fire-and-forget — non-blocking segmentation data only
    if (qualifyingAnswer && currentOrg) {
      const orgParam = `?orgSlug=${encodeURIComponent(currentOrg.slug)}`;
      fetch(`/api/admin/org/onboarding-survey${orgParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentsPerYear: qualifyingAnswer }),
      }).catch(() => {});
    }
    await advanceWizard('qualifying');
  }

  async function choosePlan(planKey: OrgPlan, selectedBillingCycle: 'monthly' | 'annual' = 'monthly') {
    if (!currentOrg || planLoading) return;
    setPlanError('');

    const activePlan = normalizePlanId(currentOrg.planId);
    const planSelectionEditable = isFirstRunPlanEditable();

    if (!planChoiceRequired && !planSelectionEditable && PLAN_ORDER.indexOf(planKey) < PLAN_ORDER.indexOf(activePlan)) {
      return;
    }

    if (planKey === activePlan) {
      setPlanChooserOpen(false);
      if (planChoiceRequired) {
        await markStartupTask('plan', 'complete', currentOrg.slug);
        router.replace(`/${currentOrg.slug}/admin/onboarding?success=1`);
      } else if (activeModal === 'plan') {
        await advancePlanStep(planKey);
      }
      return;
    }

    if (planKey === 'tournament') {
      setPlanLoading(planKey);
      try {
        await requestJson<{ success: boolean }>('/api/admin/org/onboarding-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planKey }),
        });
        await refreshOrgContext();
        await refreshStartup();
        resetWorkflowDraftState();
        setPlanChooserOpen(false);
        if (planChoiceRequired) {
          await markStartupTask('plan', 'complete', currentOrg.slug);
          router.replace(`/${currentOrg.slug}/admin/onboarding?success=1`);
        } else if (activeModal === 'plan') {
          await advancePlanStep(planKey);
        }
      } catch (err) {
        setPlanError(err instanceof Error ? err.message : 'Plan selection failed');
      } finally {
        setPlanLoading(null);
      }
      return;
    }

    setPlanLoading(planKey);
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planKey,
          billingCycle: selectedBillingCycle,
          orgSlug: currentOrg.slug,
          returnTo: `/${currentOrg.slug}/admin/onboarding`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Plan selection failed');
      if (data.applied === true) {
        await refreshOrgContext();
        await refreshStartup();
        resetWorkflowDraftState();
        setPlanChooserOpen(false);
        if (planChoiceRequired) {
          await markStartupTask('plan', 'complete', currentOrg.slug);
          router.replace(`/${currentOrg.slug}/admin/onboarding?success=1`);
        } else if (activeModal === 'plan') {
          await advancePlanStep(planKey);
        }
        return;
      }
      window.location.assign(data.url);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setPlanLoading(null);
    }
  }

  function resetTournamentModal() {
    setTournamentForm(getDefaultTournamentForm());
    setSlugEdited(false);
    setDivisionPreset('youth');
    setCustomDivisionName('');
    setDivisionRows(buildDivisionRows(DIVISION_PRESETS.youth));
    setUseWelcomeMsg(true);
    setWelcomeMsg('Welcome to our tournament! We are excited to host a great event for all participating teams.');
  }

  function resetWorkflowDraftState() {
    resetTournamentModal();
    setDraftSkipped(getDefaultDraftSkipped());
    resetLeagueSetupDraft();
    setVenueDraft(buildVenueDraft());
    setVenueRows([]);
    setStepError('');
  }

  function resetLeagueSetupDraft() {
    setLeagueSeasonForm(getDefaultLeagueSeasonForm());
    setLeagueDivisionPreset('youth');
    setLeagueDivisionRows(buildLeagueDivisionRows(LEAGUE_DIVISION_PRESETS.youth));
    setLeagueCustomDivisionName('');
    setLeagueWantsTournamentSetup(false);
    setLeagueDraftSkipped(getDefaultLeagueDraftSkipped());
  }

  async function showWizardStep(stepId: Exclude<ActiveModal, null>) {
    setStepError('');
    setActiveModal(stepId);
  }

  function closeWorkflowModal() {
    if (currentOrg) {
      const activePlan = normalizePlanId(currentOrg.planId);
      const isGuidedTournamentPlan = activePlan === 'tournament' || activePlan === 'tournament_plus';
      if (isGuidedTournamentPlan) {
        setStepError('');
        setWorkflowRedirecting(true);
        router.replace(getPostOnboardingHref(currentOrg, { hasTournament: Boolean(startupProgress?.firstTournament) }));
        return;
      }
    }

    setActiveModal(null);
    setStepError('');
    setWizardDismissed(true);
  }

  function isLeagueWizardStep(stepId: Exclude<ActiveModal, null>): stepId is LeagueWizardTaskId {
    return (LEAGUE_WIZARD_ORDER as readonly string[]).includes(stepId);
  }

  function getWizardOrder(stepId: Exclude<ActiveModal, null>) {
    return isLeagueWizardStep(stepId) ? LEAGUE_WIZARD_ORDER : WIZARD_ORDER;
  }

  function getNextWizardStep(stepId: Exclude<ActiveModal, null>): Exclude<ActiveModal, null> | null {
    const order = getWizardOrder(stepId);
    const currentIndex = (order as readonly string[]).indexOf(stepId);
    return (order[currentIndex + 1] as Exclude<ActiveModal, null> | undefined) ?? null;
  }

  function getPreviousWizardStep(stepId: Exclude<ActiveModal, null>): Exclude<ActiveModal, null> | null {
    if (stepId === 'league-season') return null;
    if (stepId === 'review' && draftSkipped.tournament) return 'tournament';
    const order = getWizardOrder(stepId);
    const currentIndex = (order as readonly string[]).indexOf(stepId);
    return currentIndex > 0 ? (order[currentIndex - 1] as Exclude<ActiveModal, null>) : null;
  }

  async function advanceWizard(stepId: Exclude<ActiveModal, null>) {
    const nextStep = getNextWizardStep(stepId);
    if (!nextStep) {
      setActiveModal(null);
      setWizardDismissed(true);
      return;
    }

    await showWizardStep(nextStep);
  }

  async function goBackWizard(stepId: Exclude<ActiveModal, null>) {
    const previousStep = getPreviousWizardStep(stepId);
    if (!previousStep) return;
    await showWizardStep(previousStep);
  }

  function applyDivisionPreset(preset: DivisionPreset) {
    setDivisionPreset(preset);
    setCustomDivisionName('');
    const names = preset === 'custom' ? [] : DIVISION_PRESETS[preset];
    setDivisionRows(buildDivisionRows(names));
  }

  function addDivisionRow() {
    const name = customDivisionName.trim();
    if (!name) return;
    setDivisionRows(prev => [
      ...prev,
      {
        id: `custom-${prev.length + 1}-${generateSlug(name) || 'division'}`,
        name,
        minAge: '',
        maxAge: '',
        capacity: 8,
        poolCount: 0,
        requiresPoolSelection: false,
        poolNames: ['Pool A'],
      },
    ]);
    setCustomDivisionName('');
  }

  function updateDivisionRow(id: string, updater: (row: DivisionRow) => DivisionRow) {
    setDivisionRows(prev => prev.map(row => row.id === id ? updater(row) : row));
  }

  function handleLeagueSeasonNameChange(name: string) {
    // The public link is auto-generated from the season name (the URL field was removed from the
    // wizard, mirroring tournament onboarding). The slug is still editable later in season settings.
    setLeagueSeasonForm(form => ({ ...form, name, slug: generateSlug(name) }));
  }

  function applyLeagueDivisionPreset(preset: LeagueDivisionPreset) {
    setLeagueDivisionPreset(preset);
    setLeagueCustomDivisionName('');
    const names = preset === 'custom' ? [] : LEAGUE_DIVISION_PRESETS[preset];
    setLeagueDivisionRows(buildLeagueDivisionRows(names));
  }

  function addLeagueDivisionRow() {
    const name = leagueCustomDivisionName.trim();
    if (!name) return;
    // Free-floor (League Starter) caps at one division — don't let the UI exceed it.
    if (currentOrg && leagueDivisionRows.length >= houseLeagueDivisionCap(currentOrg)) return;
    setLeagueDivisionRows(prev => [
      ...prev,
      {
        id: `league-custom-${prev.length + 1}-${generateSlug(name) || 'division'}`,
        name,
        capacity: '',
      },
    ]);
    setLeagueCustomDivisionName('');
  }

  function updateLeagueDivisionRow(id: string, updater: (row: LeagueDivisionRow) => LeagueDivisionRow) {
    setLeagueDivisionRows(prev => prev.map(row => row.id === id ? updater(row) : row));
  }

  function updateDivisionPools(id: string, count: number) {
    updateDivisionRow(id, row => {
      const poolNames = Array.from({ length: count }).map((_, i) => row.poolNames[i] || `Pool ${String.fromCharCode(65 + i)}`);
      return { ...row, poolCount: count, poolNames };
    });
  }

  function updateDivisionPoolName(id: string, poolIndex: number, name: string) {
    updateDivisionRow(id, row => {
      const poolNames = [...row.poolNames];
      poolNames[poolIndex] = name;
      return { ...row, poolNames };
    });
  }

  function updateTournamentStartDate(startDate: string) {
    setTournamentForm(form => {
      const endDate = startDate ? addDaysToDateValue(startDate, 2) : '';
      // The tournament year is derived from the start date. If the name is still the
      // auto-generated "<year> Tournament", re-sync it (and the slug) to the new year.
      const autoNamed = /^\d{4} Tournament$/.test(form.name);
      if (!startDate || !autoNamed) return { ...form, startDate, endDate };
      const name = `${startDate.slice(0, 4)} Tournament`;
      return {
        ...form,
        startDate,
        endDate,
        name,
        ...(slugEdited ? {} : { slug: generateSlug(name) }),
      };
    });
  }

  function updateTournamentEndDate(endDate: string) {
    setTournamentForm(form => {
      if (!form.startDate) return { ...form, endDate: '' };
      if (endDate && endDate < form.startDate) return { ...form, endDate: form.startDate };
      return { ...form, endDate };
    });
  }

  function updateVenueDraft(field: keyof VenueFields, value: string) {
    setVenueDraft(draft => ({ ...draft, [field]: value }));
  }

  function updateVenueDraftType(value: FacilityType) {
    setVenueDraft(draft => ({ ...draft, facilityType: value }));
  }

  function updateVenueRowType(id: string, value: FacilityType) {
    setVenueRows(prev => prev.map(row => row.id === id ? { ...row, facilityType: value } : row));
  }

  function updateVenueRow(id: string, field: keyof VenueFields, value: string) {
    setVenueRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
  }

  function addVenueDraft() {
    if (!isVenueReady(venueDraft)) {
      setStepError('Add a venue name before adding it to the list. Address details are optional.');
      return;
    }

    const nextIndex = Date.now();
    setVenueRows(prev => [...prev, buildVenueRow(nextIndex, normalizeVenueFields(venueDraft))]);
    setVenueDraft(buildVenueDraft());
    setStepError('');
  }

  function getTournamentDraft() {
    const slug = tournamentForm.slug || generateSlug(tournamentForm.name);
    const name = tournamentForm.name.trim();

    if (!name) {
      throw new Error('Enter a tournament name before continuing.');
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error('Use a valid public link before continuing.');
    }
    if (!tournamentForm.startDate || !tournamentForm.endDate) {
      throw new Error('Add start and end dates. You can change them later if they are still being finalized.');
    }
    if (tournamentForm.startDate < getTodayDateValue()) {
      throw new Error('Start date cannot be before today.');
    }
    if (tournamentForm.endDate < tournamentForm.startDate) {
      throw new Error('End date cannot be before the start date.');
    }

    // Year is derived from the start date — the wizard no longer asks for it separately.
    return {
      year: Number(tournamentForm.startDate.slice(0, 4)),
      name,
      slug,
      startDate: tournamentForm.startDate,
      endDate: tournamentForm.endDate,
    };
  }

  function getDivisionDraftRows() {
    const rows = divisionRows
      .map(row => ({
        ...row,
        name: row.name.trim(),
        minAge: row.minAge.trim(),
        maxAge: row.maxAge.trim(),
      }))
      .filter(row => row.name);
    if (rows.length === 0) throw new Error('Add at least one division, or skip this step.');

    const duplicateDivision = rows.find((row, index) =>
      rows.findIndex(other => other.name.toLowerCase() === row.name.toLowerCase()) !== index
    );
    if (duplicateDivision) throw new Error(`Division names must be unique. "${duplicateDivision.name}" is listed more than once.`);

    const invalidCapacity = rows.find(row => !Number.isFinite(row.capacity) || row.capacity < 1);
    if (invalidCapacity) throw new Error(`Add a valid max team count for ${invalidCapacity.name}.`);

    const invalidAge = rows.find(row => {
      const min = row.minAge === '' ? null : Number(row.minAge);
      const max = row.maxAge === '' ? null : Number(row.maxAge);
      if (min !== null && (!Number.isFinite(min) || min < 0)) return true;
      if (max !== null && (!Number.isFinite(max) || max < 0)) return true;
      return min !== null && max !== null && min > max;
    });
    if (invalidAge) throw new Error(`Review the age limits for ${invalidAge.name}. Leave either side blank for open-ended ranges.`);

    return rows.map(row => ({
      name: row.name,
      minAge: row.minAge ? Number(row.minAge) : null,
      maxAge: row.maxAge ? Number(row.maxAge) : null,
      capacity: row.capacity || 8,
      poolCount: row.poolCount,
      poolNames: row.poolCount >= 2 ? row.poolNames.slice(0, row.poolCount).join(',') : '',
      requiresPoolSelection: row.requiresPoolSelection,
    }));
  }

  function getVenueDraftRows() {
    if (hasVenueContent(venueDraft)) {
      if (!isVenueReady(venueDraft)) {
        throw new Error('Add a venue name before continuing, or clear the venue form.');
      }
      throw new Error('Click Add venue before continuing, or clear the venue form.');
    }

    const rows = venueRows
      .map(row => normalizeVenueFields(row))
      .filter(hasVenueContent);
    if (rows.length === 0) {
      throw new Error('Add at least one venue name, or skip this step.');
    }
    if (rows.some(row => !isVenueReady(row))) {
      throw new Error('Each added venue needs a venue name. Address details are optional.');
    }
    return rows;
  }

  function getLeagueSeasonDraft() {
    const name = leagueSeasonForm.name.trim().replace(/\s+/g, ' ');
    const slug = leagueSeasonForm.slug || generateSlug(name);
    const registrationFee = leagueSeasonForm.registrationFee ? Number(leagueSeasonForm.registrationFee) : null;

    if (!name) throw new Error('Enter a season name before continuing.');
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error('Use a valid public link before continuing.');
    }
    if (leagueSeasonForm.seasonStartDate && leagueSeasonForm.seasonStartDate < getTodayDateValue()) {
      throw new Error('Season start date cannot be before today.');
    }
    if (leagueSeasonForm.seasonStartDate && leagueSeasonForm.seasonEndDate && leagueSeasonForm.seasonEndDate < leagueSeasonForm.seasonStartDate) {
      throw new Error('Season end date cannot be before the start date.');
    }
    if (registrationFee !== null && (!Number.isFinite(registrationFee) || registrationFee < 0)) {
      throw new Error('Enter a valid registration fee, or leave it blank.');
    }

    return {
      name,
      slug,
      sport: leagueSeasonForm.sport || 'softball',
      division: leagueSeasonForm.division.trim() || null,
      description: leagueSeasonForm.description.trim() || null,
      seasonStartDate: leagueSeasonForm.seasonStartDate || null,
      seasonEndDate: leagueSeasonForm.seasonEndDate || null,
      registrationFee,
      registrationOpenAt: leagueSeasonForm.registrationOpenAt ? `${leagueSeasonForm.registrationOpenAt}:00Z` : null,
      registrationCloseAt: leagueSeasonForm.registrationCloseAt ? `${leagueSeasonForm.registrationCloseAt}:00Z` : null,
      waiverText: leagueSeasonForm.waiverText.trim() || null,
      autoApproveUnderCapacity: leagueSeasonForm.autoApproveUnderCapacity,
      autoPromoteWaitlist: leagueSeasonForm.autoPromoteWaitlist,
      autoGenerateFees: leagueSeasonForm.autoGenerateFees,
    };
  }

  function getLeagueDivisionDraftRows() {
    const rows = leagueDivisionRows
      .map(row => ({
        name: row.name.trim(),
        capacity: row.capacity.trim(),
      }))
      .filter(row => row.name);

    if (rows.length === 0) throw new Error('Add at least one division, or skip this step.');

    // Free-floor (League Starter) division cap — authoritative client guard so a multi-division
    // draft can't reach the API and 403 mid-flow. Mirrors the server cap.
    const divisionCap = currentOrg ? houseLeagueDivisionCap(currentOrg) : Infinity;
    if (rows.length > divisionCap) {
      throw new Error('Your free League plan includes one division. Multiple divisions are part of League Plus — upgrade to add more.');
    }

    const duplicateDivision = rows.find((row, index) =>
      rows.findIndex(other => other.name.toLowerCase() === row.name.toLowerCase()) !== index
    );
    if (duplicateDivision) throw new Error(`Division names must be unique. "${duplicateDivision.name}" is listed more than once.`);

    const invalidCapacity = rows.find(row => {
      if (!row.capacity) return false;
      const capacity = Number(row.capacity);
      return !Number.isInteger(capacity) || capacity < 1;
    });
    if (invalidCapacity) throw new Error(`Add a valid capacity for ${invalidCapacity.name}, or leave it blank.`);

    return rows.map((row, index) => ({
      name: row.name,
      capacity: row.capacity ? Number(row.capacity) : null,
      sortOrder: index,
    }));
  }

  async function saveTournamentStep() {
    try {
      const draft = getTournamentDraft();
      setTournamentForm(form => ({ ...form, slug: draft.slug }));
      setDraftSkipped(prev => ({ ...prev, tournament: false }));
      setStepError('');
      await advanceWizard('tournament');
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Unable to continue.');
    }
  }

  async function saveDivisionsStep() {
    try {
      getDivisionDraftRows();
      setDraftSkipped(prev => ({ ...prev, divisions: false }));
      setStepError('');
      await advanceWizard('divisions');
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Unable to continue.');
    }
  }

  async function saveWelcomeStep() {
    try {
      if (useWelcomeMsg && !welcomeMsg.trim()) throw new Error('Add welcome message text, or skip this step.');
      setDraftSkipped(prev => ({ ...prev, welcome: !useWelcomeMsg }));
      setStepError('');
      await advanceWizard('welcome');
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Unable to continue.');
    }
  }

  async function saveVenuesStep() {
    try {
      getVenueDraftRows();
      setDraftSkipped(prev => ({ ...prev, venues: false }));
      setStepError('');
      await advanceWizard('venues');
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Unable to continue.');
    }
  }

  async function saveLeagueSeasonStep() {
    try {
      const draft = getLeagueSeasonDraft();
      setLeagueSeasonForm(form => ({ ...form, slug: draft.slug }));
      setLeagueDraftSkipped(prev => ({ ...prev, league_season: false }));
      setStepError('');
      await advanceWizard('league-season');
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Unable to continue.');
    }
  }

  async function saveLeagueDivisionsStep() {
    try {
      getLeagueDivisionDraftRows();
      setLeagueDraftSkipped(prev => ({ ...prev, league_divisions: false }));
      setStepError('');
      await advanceWizard('league-divisions');
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Unable to continue.');
    }
  }

  async function saveLeagueRegistrationStep() {
    try {
      getLeagueSeasonDraft();
      setLeagueDraftSkipped(prev => ({ ...prev, league_registration: false }));
      setStepError('');
      await advanceWizard('league-registration');
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Unable to continue.');
    }
  }

  async function saveLeagueTournamentChoiceStep() {
    setLeagueDraftSkipped(prev => ({ ...prev, league_tournament: !leagueWantsTournamentSetup }));
    setStepError('');
    await advanceWizard('league-tournament');
  }

  function clearDraftForStep(taskId: StartupActionTaskId) {
    if (taskId === 'tournament') {
      resetTournamentModal();
      setDraftSkipped(getDefaultDraftSkipped());
    }
    if (taskId === 'divisions') {
      setDivisionPreset('custom');
      setCustomDivisionName('');
      setDivisionRows([]);
    }
    if (taskId === 'welcome') {
      setUseWelcomeMsg(false);
      setWelcomeMsg('');
    }
    if (taskId === 'venues') {
      setVenueDraft(buildVenueDraft());
      setVenueRows([]);
    }
  }

  async function skipStep(taskId: StartupActionTaskId) {
    clearDraftForStep(taskId);
    setDraftSkipped(prev => {
      if (taskId === 'tournament') {
        return STARTUP_ORDER.reduce<DraftSkippedState>((acc, step) => ({ ...acc, [step]: true }), getDefaultDraftSkipped());
      }
      return { ...prev, [taskId]: true };
    });
    setStepError('');
    await showWizardStep(taskId === 'tournament' ? 'review' : getNextWizardStep(taskId) ?? 'review');
  }

  function clearLeagueDraftForStep(taskId: LeagueStartupActionTaskId) {
    if (taskId === 'league_season') {
      resetLeagueSetupDraft();
    }
    if (taskId === 'league_divisions') {
      setLeagueDivisionPreset('custom');
      setLeagueCustomDivisionName('');
      setLeagueDivisionRows([]);
    }
    if (taskId === 'league_registration') {
      setLeagueSeasonForm(form => ({
        ...form,
        registrationFee: '',
        registrationOpenAt: '',
        registrationCloseAt: '',
        waiverText: '',
        autoApproveUnderCapacity: false,
        autoPromoteWaitlist: false,
        autoGenerateFees: false,
      }));
    }
    if (taskId === 'league_tournament') {
      setLeagueWantsTournamentSetup(false);
    }
  }

  async function skipLeagueStep(taskId: LeagueStartupActionTaskId) {
    clearLeagueDraftForStep(taskId);
    setLeagueDraftSkipped(prev => {
      if (taskId === 'league_season') {
        return LEAGUE_STARTUP_ORDER.reduce<LeagueDraftSkippedState>((acc, step) => ({ ...acc, [step]: true }), getDefaultLeagueDraftSkipped());
      }
      return { ...prev, [taskId]: true };
    });
    setStepError('');
    const stepName = taskId.replace('league_', 'league-') as LeagueWizardTaskId;
    await showWizardStep(taskId === 'league_season' ? 'league-review' : getNextWizardStep(stepName) ?? 'league-review');
  }

  async function saveSetupDraft() {
    if (!currentOrg) return;
    setStepError('');
    setStepSaving(true);

    try {
      if (draftSkipped.tournament) {
        for (const taskId of STARTUP_ORDER) {
          await markStartupTask(taskId, 'skipped', currentOrg?.slug);
        }
        await requestJson<{ ok: boolean }>('/api/admin/org/complete-onboarding', { method: 'POST' });
        await refreshOrgContext();
        setWorkflowRedirecting(true);
        router.replace(getPostOnboardingHref(currentOrg, { hasTournament: false }));
        return;
      }

      const tournament = getTournamentDraft();
      const divisions = draftSkipped.divisions ? [] : getDivisionDraftRows();
      const announcement = !draftSkipped.welcome && useWelcomeMsg ? { body: welcomeMsg.trim() } : null;
      const venues = draftSkipped.venues ? [] : getVenueDraftRows();

      const created = await requestJson<{ success: boolean; id: string; slug: string; name: string }>('/api/admin/setup-tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament,
          divisions,
          announcement,
          migration: null,
        }),
      });

      await Promise.all(venues.map(row => requestJson<{ success: boolean }>('/api/admin/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          data: {
            tournamentId: created.id,
            name: row.name,
            address: formatVenueAddress(row),
            notes: row.notes || undefined,
            fieldCount: Number(normalizeFieldCount(row.fieldCount)),
            facilityType: row.facilityType,
          },
        }),
      })));

      // Bracket-only is stored as a tournament setting (default round-robin needs no write).
      if (tournamentForm.format === 'playoff_only') {
        await requestJson<{ success: boolean }>('/api/admin/tournaments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'patch-settings', id: created.id, data: { settings: { format: 'playoff_only' } } }),
        }).catch(() => { /* non-fatal: format can still be set in Event Settings */ });
      }

      await requestJson<{ ok: boolean }>('/api/admin/org/complete-onboarding', { method: 'POST' });
      await refreshTournamentContext();
      await refreshOrgContext();
      await refreshStartup();
      setWorkflowRedirecting(true);
      router.replace(getPostOnboardingHref(currentOrg, { hasTournament: true }));
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Unable to save setup.');
    } finally {
      setStepSaving(false);
    }
  }

  async function saveLeagueSetupDraft() {
    if (!currentOrg) return;
    setStepError('');
    setStepSaving(true);

    try {
      if (leagueDraftSkipped.league_season) {
        for (const taskId of LEAGUE_STARTUP_ORDER) {
          await markStartupTask(taskId, 'skipped', currentOrg?.slug);
        }
        await requestJson<{ ok: boolean }>('/api/admin/org/complete-onboarding', { method: 'POST' });
        await refreshOrgContext();
        setWorkflowRedirecting(true);
        router.replace(`/${currentOrg.slug}/admin`);
        return;
      }

      const season = getLeagueSeasonDraft();
      const divisions = leagueDraftSkipped.league_divisions ? [] : getLeagueDivisionDraftRows();

      const createdSeason = await requestJson<{ id: string }>('/api/admin/house-league/seasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(season),
      });

      await Promise.all(divisions.map(row => requestJson<{ id: string }>(`/api/admin/house-league/seasons/${createdSeason.id}/divisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: row.name,
          capacity: row.capacity,
        }),
      })));

      await markStartupTask('league_season', 'complete', currentOrg?.slug);
      await markStartupTask('league_divisions', divisions.length > 0 ? 'complete' : 'skipped', currentOrg?.slug);
      await markStartupTask('league_registration', leagueDraftSkipped.league_registration ? 'skipped' : 'complete', currentOrg?.slug);
      await markStartupTask('league_tournament', 'skipped', currentOrg?.slug);
      await requestJson<{ ok: boolean }>('/api/admin/org/complete-onboarding', { method: 'POST' });
      await refreshStartup();
      await refreshOrgContext();

      if (leagueWantsTournamentSetup) {
        setWorkflowRedirecting(true);
        router.replace(`/${currentOrg.slug}/admin/tournaments/manage?create=1`);
        return;
      }

      setWorkflowRedirecting(true);
      router.replace(`/${currentOrg.slug}/admin`);
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Unable to save league setup.');
    } finally {
      setStepSaving(false);
    }
  }

  if (loading || !currentOrg || !userRole) return null;

  if (userRole !== 'owner') {
    return null;
  }

  const activePlanId = normalizePlanId(currentOrg.planId);
  const entitlements = PLAN_CONFIG[activePlanId].moduleEntitlements;
  const planLabel = PLAN_CONFIG[activePlanId].label;
  const isTournamentPlan = activePlanId === 'tournament' || activePlanId === 'tournament_plus';
  const isLeaguePlan = activePlanId === 'league';
  const isClubPlan = activePlanId === 'club';
  const shouldRedirectFromTournamentOnboarding = isTournamentPlan && startupProgress?.wizardAvailable === false;
  const todayDate = getTodayDateValue();
  const allDone = isLeaguePlan
    ? seasonsDone === true
    : isClubPlan
      ? seasonsDone === true || repTeamsDone === true || publicSiteDone === true
      : false;

  function renderPlanChooser(required: boolean, embedded = false) {
    const planSelectionEditable = !required && isFirstRunPlanEditable();
    const disabledPlans: OrgPlan[] = (!required && !planSelectionEditable)
      ? PLAN_ORDER.filter(k => PLAN_ORDER.indexOf(k) < PLAN_ORDER.indexOf(activePlanId))
      : [];

    return (
      <div className={embedded ? styles.planChooserEmbedded : required ? styles.planStage : styles.planModal} role={required || embedded ? undefined : 'dialog'} aria-modal={required || embedded ? undefined : 'true'} aria-labelledby="onboarding-plan-title">
        {!embedded && (
          <div className={styles.modalHeader}>
            <div>
              <h2 id="onboarding-plan-title" className={styles.modalTitle}>Start free or choose an upgrade</h2>
              <p className={styles.modalSub}>
                Start free for one small tournament, or choose Tournament Plus if you need registration control, branding, automation, and repeat-event tools.
              </p>
            </div>
            {!required && (
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setPlanChooserOpen(false)}
                aria-label="Close plan chooser"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        <PricingSection
          gatingMap={gatingMap}
          onChoosePlan={choosePlan}
          currentPlan={required ? undefined : activePlanId}
          planLoading={planLoading}
          disabledPlans={disabledPlans}
          initialBilling={searchParams.get('billing') === 'annual' ? 'annual' : 'monthly'}
          compact={embedded}
          order={['tournament_plus', 'tournament', 'league', 'club']}
          featuredPlan="tournament_plus"
          ctaLabel={(planKey) => {
            if (required && planKey === 'tournament') return 'Start with Tournament';
            if (!required && planKey === 'tournament' && planKey !== activePlanId) return 'Continue free';
            return undefined;
          }}
        />

        {planError && <div className={styles.planError}>{planError}</div>}
      </div>
    );
  }

  function renderModalFrame(title: string, description: string, children: React.ReactNode, options: {
    stepId: Exclude<ActiveModal, null>;
    saveLabel: string;
    onSave: () => void;
    taskId?: StartupActionTaskId | LeagueStartupActionTaskId;
    allowSkip?: boolean;
    saveDisabled?: boolean;
    hidePrimaryAction?: boolean;
    wide?: boolean;
    /** Show a "* required" legend when the step has required fields. */
    requiredHint?: boolean;
  }) {
    const wizardOrder = getWizardOrder(options.stepId);
    const stepNumber = (wizardOrder as readonly string[]).indexOf(options.stepId) + 1;
    const progressWidth = `${(stepNumber / wizardOrder.length) * 100}%`;
    const previousStep = getPreviousWizardStep(options.stepId);

    return (
      <div className={styles.modalOverlay} role="presentation">
        <div className={`${styles.workflowModal} ${options.wide ? styles.workflowModalWide : ''}`} role="dialog" aria-modal="true" aria-labelledby="workflow-modal-title">
          <div className={styles.wizardChrome}>
            <span>Step {stepNumber}/{wizardOrder.length}</span>
            <div className={styles.wizardProgressBar} aria-hidden="true">
              <span style={{ width: progressWidth }} />
            </div>
          </div>

          <div className={styles.modalHeader}>
            <div>
              <h2 id="workflow-modal-title" className={styles.modalTitle}>{title}</h2>
              <p className={styles.modalSub}>{description}</p>
            </div>
            <button
              type="button"
              className={styles.modalClose}
              onClick={closeWorkflowModal}
              aria-label="Close setup modal"
            >
              <X size={18} />
            </button>
          </div>

          <div key={options.stepId} className={styles.workflowSlide}>
            <div className={styles.workflowModalBody}>{children}</div>
            {options.requiredHint && (
              <p className={styles.requiredLegend}><span aria-hidden="true">*</span> required</p>
            )}
          </div>

          {stepError && (
            <div className={styles.planError}>
              <AlertCircle size={14} />
              {stepError}
            </div>
          )}

          <div className={styles.workflowModalFooter}>
            <button type="button" className="btn btn-ghost" onClick={() => goBackWizard(options.stepId)} disabled={stepSaving || !previousStep}>
              Back
            </button>
            <div className={styles.workflowFooterActions}>
              {options.allowSkip && options.taskId && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void ((LEAGUE_STARTUP_ORDER as readonly string[]).includes(options.taskId!)
                    ? skipLeagueStep(options.taskId as LeagueStartupActionTaskId)
                    : skipStep(options.taskId as StartupActionTaskId))}
                  disabled={stepSaving}
                >
                  Skip
                </button>
              )}
              {!options.hidePrimaryAction && (
                <button type="button" className="btn btn-primary" onClick={options.onSave} disabled={stepSaving || options.saveDisabled}>
                  {stepSaving ? 'Saving...' : options.saveLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderActiveModal() {
    // Plan selection is a standalone gate (?choosePlan=1), not a wizard step — the wizard
    // starts at 'qualifying'. (The old in-wizard 'plan' step was removed in the decouple.)
    if (activeModal === 'qualifying') {
      const QUALIFYING_OPTIONS = [
        { value: '1', label: '1', sub: 'Just getting started' },
        { value: '2-3', label: '2–3', sub: 'A few each season' },
        { value: '4+', label: '4 or more', sub: 'Running a full tournament program' },
      ];
      const isFoundingSeasonWindow = new Date() < new Date('2027-01-01T00:00:00.000Z');
      return renderModalFrame(
        'One quick question',
        'How many tournaments does your organization run per year? This helps us tailor the setup for you.',
        (
          <>
            {isFoundingSeasonWindow && (
              <div className={styles.foundingSeasonWelcome}>
                <p className={styles.foundingSeasonWelcomeEyebrow}>Founding Season</p>
                <p className={styles.foundingSeasonWelcomeTitle}>Welcome to your founding season.</p>
                <p className={styles.foundingSeasonWelcomeCopy}>
                  Tournament Plus is free through December 31, 2026. No credit card required.
                  You&apos;ll receive a reminder before the standard {formatPriceAmount(PLAN_CONFIG.tournament_plus.monthlyPrice)}/month rate applies in January 2027.
                </p>
              </div>
            )}
            <div className={styles.qualifyingOptions}>
              {QUALIFYING_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.qualifyingOption} ${qualifyingAnswer === opt.value ? styles.qualifyingOptionActive : ''}`}
                  onClick={() => setQualifyingAnswer(opt.value)}
                >
                  <span className={styles.qualifyingOptionLabel}>{opt.label}</span>
                  <span className={styles.qualifyingOptionSub}>{opt.sub}</span>
                </button>
              ))}
            </div>
          </>
        ),
        {
          stepId: 'qualifying',
          saveLabel: 'Continue',
          onSave: saveQualifyingStep,
          allowSkip: false,
        }
      );
    }

    if (activeModal === 'league-season') {
      return renderModalFrame(
        'Create your first season',
        'Start with the core details parents and staff will recognize. The season stays in draft until you open registration.',
        (
          <div className={styles.inlineList}>
            <div className={styles.modalGridTwo}>
              <label className={`${styles.fieldLabel} ${styles.fullWidthField}`}>
                Season name *
                <input
                  className="form-input"
                  value={leagueSeasonForm.name}
                  onChange={e => handleLeagueSeasonNameChange(e.target.value)}
                  placeholder="2026 House League"
                  autoFocus
                />
                <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.65rem', letterSpacing: '0.06em', color: 'var(--data-gray)', marginTop: '0.3rem' }}>
                  Public link: <span style={{ color: 'var(--logic-lime)' }}>/league/{leagueSeasonForm.slug || 'your-season'}</span> — auto-generated; editable later in season settings.
                </span>
              </label>
              <label className={styles.fieldLabel}>
                Sport
                <select
                  className="form-select"
                  value={leagueSeasonForm.sport}
                  onChange={e => setLeagueSeasonForm(form => ({ ...form, sport: e.target.value }))}
                >
                  <option value="softball">Softball</option>
                  <option value="baseball">Baseball</option>
                  <option value="hockey">Hockey</option>
                  <option value="soccer">Soccer</option>
                  <option value="basketball">Basketball</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className={styles.fieldLabel}>
                Division
                <input
                  className="form-input"
                  value={leagueSeasonForm.division}
                  onChange={e => setLeagueSeasonForm(form => ({ ...form, division: e.target.value }))}
                  placeholder="U11, Adult, All ages"
                />
              </label>
              <label className={styles.fieldLabel}>
                Season starts
                <input
                  className="form-input"
                  type="date"
                  min={todayDate}
                  value={leagueSeasonForm.seasonStartDate}
                  onChange={e => setLeagueSeasonForm(form => ({ ...form, seasonStartDate: e.target.value }))}
                />
              </label>
              <label className={styles.fieldLabel}>
                Season ends
                <input
                  className="form-input"
                  type="date"
                  min={leagueSeasonForm.seasonStartDate || todayDate}
                  value={leagueSeasonForm.seasonEndDate}
                  onChange={e => setLeagueSeasonForm(form => ({ ...form, seasonEndDate: e.target.value }))}
                />
              </label>
              <label className={`${styles.fieldLabel} ${styles.fullWidthField}`}>
                Public description
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={leagueSeasonForm.description}
                  onChange={e => setLeagueSeasonForm(form => ({ ...form, description: e.target.value }))}
                  placeholder="A short description for the public registration page."
                />
              </label>
            </div>
          </div>
        ),
        { stepId: 'league-season', saveLabel: 'Next', onSave: saveLeagueSeasonStep, taskId: 'league_season', allowSkip: true, requiredHint: true }
      );
    }

    if (activeModal === 'league-divisions') {
      const leagueDivisionLimited = Boolean(currentOrg && isFreeFloorLeague(currentOrg));
      return renderModalFrame(
        'Set up divisions',
        leagueDivisionLimited
          ? 'Free League includes one division and up to 8 teams (you add teams after setup). Add more divisions by upgrading to League Plus.'
          : 'Create the registration groups parents will choose from. Capacities can be blank if you do not need hard limits yet.',
        (
          <div className={styles.inlineList}>
            <p style={{ fontSize: '0.72rem', color: 'var(--data-gray)', margin: 0, lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--white-55, rgba(255,255,255,0.55))' }}>Max players</strong> caps how many players can register in a division — it&apos;s
              not the number of teams{leagueDivisionLimited ? ' (your free plan includes up to 8 teams, added after setup)' : ''}. Leave it blank for no limit.
            </p>
            {!leagueDivisionLimited && (
              <>
                <div className={styles.divisionPresetGrid}>
                  {(['youth', 'adult', 'custom'] as LeagueDivisionPreset[]).map(preset => (
                    <button
                      key={preset}
                      type="button"
                      className={`${styles.presetCard} ${leagueDivisionPreset === preset ? styles.presetCardActive : ''}`}
                      onClick={() => applyLeagueDivisionPreset(preset)}
                    >
                      <strong>{preset === 'youth' ? 'Youth starter' : preset === 'adult' ? 'Adult starter' : 'Custom'}</strong>
                      <span>{preset === 'custom' ? 'Start with a blank list.' : `Adds ${LEAGUE_DIVISION_PRESETS[preset].join(', ')}.`}</span>
                    </button>
                  ))}
                </div>

                <div className={styles.inlineActions}>
                  <input
                    className="form-input"
                    value={leagueCustomDivisionName}
                    onChange={e => setLeagueCustomDivisionName(e.target.value)}
                    placeholder="Add division name"
                  />
                  <button type="button" className="btn btn-outline btn-sm" onClick={addLeagueDivisionRow}>
                    <Plus size={14} /> Add
                  </button>
                </div>
              </>
            )}

            <div className={styles.divisionList}>
              {leagueDivisionRows.map(row => (
                <div key={row.id} className={styles.divisionRow}>
                  <input
                    className="form-input"
                    value={row.name}
                    onChange={e => updateLeagueDivisionRow(row.id, current => ({ ...current, name: e.target.value }))}
                    placeholder="Division name"
                  />
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    value={row.capacity}
                    onChange={e => updateLeagueDivisionRow(row.id, current => ({ ...current, capacity: e.target.value }))}
                    placeholder="Max players"
                    aria-label={`${row.name || 'Division'} max players`}
                  />
                  {!leagueDivisionLimited && (
                    <button type="button" className={styles.iconOnlyButton} onClick={() => setLeagueDivisionRows(prev => prev.filter(item => item.id !== row.id))} aria-label={`Remove ${row.name || 'division'}`}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {leagueDivisionRows.length === 0 && (
                <div className={styles.emptyModalState}>Add at least one division to continue.</div>
              )}
            </div>
          </div>
        ),
        { stepId: 'league-divisions', saveLabel: 'Next', onSave: saveLeagueDivisionsStep, taskId: 'league_divisions', allowSkip: true }
      );
    }

    if (activeModal === 'league-registration') {
      const leagueStarterFloor = Boolean(currentOrg && isFreeFloorLeague(currentOrg));
      return renderModalFrame(
        'Configure registration',
        'Set the defaults that control how public submissions are handled when registration opens.',
        (
          <div className={styles.inlineList}>
            <div className={styles.modalGridTwo}>
              <label className={styles.fieldLabel}>
                Registration opens
                <input
                  className="form-input"
                  type="datetime-local"
                  value={leagueSeasonForm.registrationOpenAt}
                  onChange={e => setLeagueSeasonForm(form => ({ ...form, registrationOpenAt: e.target.value }))}
                />
              </label>
              <label className={styles.fieldLabel}>
                Registration closes
                <input
                  className="form-input"
                  type="datetime-local"
                  value={leagueSeasonForm.registrationCloseAt}
                  onChange={e => setLeagueSeasonForm(form => ({ ...form, registrationCloseAt: e.target.value }))}
                />
              </label>
              <label className={`${styles.fieldLabel} ${styles.fullWidthField}`}>
                Registration fee
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={leagueSeasonForm.registrationFee}
                  onChange={e => setLeagueSeasonForm(form => ({ ...form, registrationFee: e.target.value }))}
                  placeholder="Display-only fee, e.g. 150.00"
                />
              </label>
              <label className={`${styles.fieldLabel} ${styles.fullWidthField}`}>
                Waiver text
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={leagueSeasonForm.waiverText}
                  onChange={e => setLeagueSeasonForm(form => ({ ...form, waiverText: e.target.value }))}
                  placeholder="Shown on the public registration form."
                />
              </label>
            </div>

            <div className={styles.setupBlock}>
              <div className={styles.setupBlockHeader}>
                <span>Automation</span>
                <small>These can be changed later.</small>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
                {[
                  { key: 'autoApproveUnderCapacity', label: 'Auto-approve while spots are open', help: 'New registrations are confirmed automatically until a division reaches its max players. After that they go to the waitlist for you to review.' },
                  { key: 'autoPromoteWaitlist', label: 'Auto-promote from waitlist', help: 'When a confirmed spot opens up, the next person on the waitlist is moved in automatically.' },
                  // The accounting fee-entry toggle is hidden on the free League Starter floor — it
                  // requires the paid accounting module and is force-disabled server-side.
                  ...(leagueStarterFloor ? [] : [{ key: 'autoGenerateFees', label: 'Auto-generate accounting fee entries', help: 'Creates a pending fee entry in the accounting ledger for each approved registration. Part of paid League/Club.' }]),
                ].map(({ key, label, help }) => (
                  <label key={key} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      style={{ width: 16, height: 16, marginTop: '0.15rem', flexShrink: 0 }}
                      checked={Boolean(leagueSeasonForm[key as keyof LeagueSeasonForm])}
                      onChange={e => setLeagueSeasonForm(form => ({ ...form, [key]: e.target.checked }))}
                    />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--white-70, rgba(255,255,255,0.7))' }}>{label}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--data-gray)', lineHeight: 1.4 }}>{help}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ),
        { stepId: 'league-registration', saveLabel: 'Next', onSave: saveLeagueRegistrationStep, taskId: 'league_registration', allowSkip: true }
      );
    }

    if (activeModal === 'league-tournament') {
      return renderModalFrame(
        'Add a tournament?',
        'Tournament setup is optional for house league onboarding. If you want it now, the existing tournament wizard opens after league setup is saved.',
        (
          <div className={styles.setupBlock}>
            <label className={styles.checkboxLine}>
              <input
                type="checkbox"
                checked={leagueWantsTournamentSetup}
                onChange={e => setLeagueWantsTournamentSetup(e.target.checked)}
              />
              Set up a tournament after this league season is saved
            </label>
            <div className={styles.emptyModalState}>
              Leaving this unchecked keeps the league workflow focused. You can create tournaments later from Tournament Management.
            </div>
          </div>
        ),
        { stepId: 'league-tournament', saveLabel: 'Next', onSave: saveLeagueTournamentChoiceStep, taskId: 'league_tournament', allowSkip: true }
      );
    }

    if (activeModal === 'league-review') {
      const leagueDivisions = leagueDraftSkipped.league_divisions ? [] : leagueDivisionRows.filter(row => row.name.trim());

      return renderModalFrame(
        leagueDraftSkipped.league_season ? 'Finish setup' : 'Review and save',
        leagueDraftSkipped.league_season
          ? 'No house league season will be created. You can create one later from House League.'
          : 'Saving creates a draft season. Registration is not public until you open it.',
        leagueDraftSkipped.league_season ? (
          <div className={styles.reviewPanel}>
            <div className={styles.emptyModalState}>
              You skipped league season creation, so no season, divisions, or registration settings will be created.
            </div>
          </div>
        ) : (
          <div className={styles.reviewPanel}>
            <div className={styles.reviewItem}>
              <span>Season</span>
              <strong>{leagueSeasonForm.name.trim() || 'Not named yet'}</strong>
            </div>
            <div className={styles.reviewItem}>
              <span>Divisions</span>
              <strong>{leagueDivisions.length > 0 ? `${leagueDivisions.length} included` : 'Skipped'}</strong>
            </div>
            <div className={styles.reviewItem}>
              <span>Registration</span>
              <strong>{leagueDraftSkipped.league_registration ? 'Skipped for now' : 'Draft settings included'}</strong>
            </div>
            <div className={styles.reviewItem}>
              <span>Public visibility</span>
              <strong>Not live yet</strong>
            </div>
            <div className={styles.reviewItem}>
              <span>Tournament setup</span>
              <strong>{leagueWantsTournamentSetup ? 'Open next' : 'Later'}</strong>
            </div>
            <div className={styles.emptyModalState}>
              After saving, only admins can work on this season. Parents will not see registration until you open registration from the season page.
            </div>
          </div>
        ),
        {
          stepId: 'league-review',
          saveLabel: leagueDraftSkipped.league_season ? 'Finish for now' : 'Save setup',
          onSave: saveLeagueSetupDraft,
        }
      );
    }

    if (activeModal === 'tournament') {
      return renderModalFrame(
        'Create your tournament',
        'Start with core tournament details. The tournament stays private as a draft.',
        (
          <>
            <label className={styles.fieldLabel}>
              Tournament name *
              <input
                className="form-input"
                value={tournamentForm.name}
                onChange={e => {
                  const name = e.target.value;
                  setTournamentForm(form => ({
                    ...form,
                    name,
                    slug: slugEdited ? form.slug : generateSlug(name),
                  }));
                }}
              />
            </label>

            <div className={styles.modalGridTwo}>
              <label className={styles.fieldLabel}>
                Start date *
                <input
                  className="form-input"
                  type="date"
                  min={todayDate}
                  value={tournamentForm.startDate}
                  onChange={e => updateTournamentStartDate(e.target.value)}
                />
              </label>
              <label className={styles.fieldLabel}>
                End date *
                <input
                  className="form-input"
                  type="date"
                  value={tournamentForm.endDate}
                  min={tournamentForm.startDate || undefined}
                  disabled={!tournamentForm.startDate}
                  onChange={e => updateTournamentEndDate(e.target.value)}
                />
              </label>
            </div>
            <p className={styles.fieldHint}>
              Start and end dates are required. You can change them later if they are still being finalized.
            </p>

            <div className={styles.fieldLabel}>
              Tournament style
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.35rem' }}>
                {([
                  { value: 'round_robin_playoffs', title: 'Round robin + playoffs', desc: 'Teams play a round robin, then a bracket seeded from the standings.' },
                  { value: 'playoff_only', title: 'Bracket only', desc: 'No round robin — seed teams straight into a playoff bracket.' },
                ] as const).map(opt => {
                  const selected = (tournamentForm.format ?? 'round_robin_playoffs') === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTournamentForm(form => ({ ...form, format: opt.value }))}
                      style={{
                        textAlign: 'left', padding: '0.7rem 0.8rem', borderRadius: 6, cursor: 'pointer',
                        background: selected ? 'rgba(var(--logic-lime-rgb), 0.1)' : 'var(--surface)',
                        border: `1px solid ${selected ? 'var(--logic-lime)' : 'var(--border)'}`,
                        color: 'var(--white)',
                      }}
                    >
                      <span style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem' }}>{opt.title}</span>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--white-60)', marginTop: '0.2rem', lineHeight: 1.35 }}>{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className={styles.fieldLabel}>
              Public link
              <input
                className="form-input"
                value={tournamentForm.slug}
                onChange={e => {
                  setSlugEdited(true);
                  setTournamentForm(form => ({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') }));
                }}
              />
            </label>
          </>
        ),
        { stepId: 'tournament', saveLabel: 'Next', onSave: saveTournamentStep, taskId: 'tournament', allowSkip: true, requiredHint: true }
      );
    }

    if (activeModal === 'divisions') {
      return renderModalFrame(
        'Set up divisions',
        'Add the divisions or divisions teams can register for. Pools or groups are optional when you need to split teams inside a division.',
        (
          <div className={styles.setupBlock}>
            <div className={styles.setupBlockHeader}>
              <span>Divisions</span>
              <small>Max teams is the registration cap for that division.</small>
            </div>
            <div className={styles.presetGridCompact}>
              {(['youth', 'adult', 'custom'] as DivisionPreset[]).map(preset => (
                <button
                  key={preset}
                  type="button"
                  className={`${styles.presetButtonCompact} ${divisionPreset === preset ? styles.presetButtonCompactActive : ''}`}
                  onClick={() => applyDivisionPreset(preset)}
                >
                  {preset === 'youth' ? 'Youth' : preset === 'adult' ? 'Adult' : 'Custom'}
                </button>
              ))}
            </div>
            <div className={styles.addInlineRow}>
              <input
                className="form-input"
                value={customDivisionName}
                placeholder="Add a division, e.g. 12U, Open, Varsity"
                onChange={e => setCustomDivisionName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addDivisionRow();
                  }
                }}
              />
              <button type="button" className="btn btn-outline btn-sm" onClick={addDivisionRow}>
                <Plus size={14} /> Add
              </button>
            </div>
            <div className={styles.inlineList}>
              <div className={styles.divisionHeaderRow} aria-hidden="true">
                <span>Division</span>
                <span>From age</span>
                <span>To age</span>
                <span>Max teams</span>
                <span>Pools/groups</span>
                <span></span>
              </div>
              {divisionRows.map(row => (
                <div key={row.id} className={styles.divisionInlineShell}>
                  <div className={styles.divisionInlineRow}>
                    <input
                      className="form-input"
                      value={row.name}
                      placeholder="Division"
                      onChange={e => updateDivisionRow(row.id, current => ({ ...current, name: e.target.value }))}
                    />
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      value={row.minAge}
                      placeholder="Any"
                      onChange={e => updateDivisionRow(row.id, current => ({ ...current, minAge: e.target.value }))}
                      aria-label={`${row.name || 'Division'} minimum age`}
                    />
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      value={row.maxAge}
                      placeholder="Any"
                      onChange={e => updateDivisionRow(row.id, current => ({ ...current, maxAge: e.target.value }))}
                      aria-label={`${row.name || 'Division'} maximum age`}
                    />
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      value={row.capacity}
                      onChange={e => updateDivisionRow(row.id, current => ({ ...current, capacity: Number(e.target.value) }))}
                      aria-label={`${row.name || 'Division'} max teams`}
                    />
                    <label className={styles.compactCheckbox}>
                      <input
                        type="checkbox"
                        checked={row.poolCount >= 2}
                        onChange={e => e.target.checked ? updateDivisionPools(row.id, 2) : updateDivisionPools(row.id, 0)}
                      />
                      Pools/groups
                    </label>
                    <button
                      type="button"
                      className={styles.iconOnlyButton}
                      onClick={() => setDivisionRows(prev => prev.filter(item => item.id !== row.id))}
                      aria-label={`Remove ${row.name || 'division'}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {row.poolCount >= 2 && (
                    <div className={styles.poolSetupPanel}>
                      <div className={styles.poolControlsRow}>
                        <label className={styles.poolMiniField}>
                          <span>Pool/group count</span>
                          <input
                            className="form-input"
                            type="number"
                            min="2"
                            max="4"
                            value={row.poolCount}
                            onChange={e => updateDivisionPools(row.id, Number(e.target.value))}
                          />
                        </label>
                        <label className={styles.compactCheckbox}>
                          <input
                            type="checkbox"
                            checked={row.requiresPoolSelection}
                            onChange={e => updateDivisionRow(row.id, current => ({ ...current, requiresPoolSelection: e.target.checked }))}
                          />
                          Team chooses pool/group
                        </label>
                      </div>
                      <div className={styles.poolNameGrid}>
                        {Array.from({ length: row.poolCount }).map((_, i) => (
                          <label key={`${row.id}-pool-${i}`} className={styles.poolNameField}>
                            <span>{String.fromCharCode(65 + i)} Name</span>
                            <input
                              className="form-input"
                              value={row.poolNames[i] || ''}
                              onChange={e => updateDivisionPoolName(row.id, i, e.target.value)}
                              placeholder="e.g. Gold"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {divisionRows.length === 0 && (
                <div className={styles.emptyModalState}>Add at least one division to continue.</div>
              )}
            </div>
          </div>
        ),
        { stepId: 'divisions', saveLabel: 'Next', onSave: saveDivisionsStep, taskId: 'divisions', allowSkip: true }
      );
    }

    if (activeModal === 'welcome') {
      return renderModalFrame(
        'Create welcome message',
        'Publish an optional pinned welcome note for teams and coaches on the tournament news page.',
        (
          <div className={styles.inlineList}>
            <label className={styles.checkboxLine}>
              <input type="checkbox" checked={useWelcomeMsg} onChange={e => setUseWelcomeMsg(e.target.checked)} />
              Publish a welcome announcement
            </label>
            {useWelcomeMsg && (
              <textarea
                className="form-textarea"
                rows={4}
                value={welcomeMsg}
                onChange={e => setWelcomeMsg(e.target.value)}
              />
            )}
          </div>
        ),
        { stepId: 'welcome', saveLabel: 'Next', onSave: saveWelcomeStep, taskId: 'welcome', allowSkip: true }
      );
    }

    if (activeModal === 'venues') {
      return renderModalFrame(
        'Add venues',
        'Add the locations you expect to schedule games on. You can add more later.',
        (
          <div className={styles.inlineList}>
            <div className={styles.venueComposer}>
              <div className={styles.setupBlockHeader}>
                <span>Add one venue</span>
                <small>Country defaults to Canada.</small>
              </div>
              <div className={styles.venueDraftGrid}>
                <label className={styles.fieldLabel}>
                  Venue name *
                  <input className="form-input" value={venueDraft.name} onChange={e => updateVenueDraft('name', e.target.value)} placeholder="Lions Field" />
                </label>
                <label className={styles.fieldLabel}>
                  Street address
                  <input className="form-input" value={venueDraft.street} onChange={e => updateVenueDraft('street', e.target.value)} placeholder="123 Main St" />
                </label>
                <label className={styles.fieldLabel}>
                  City
                  <input className="form-input" value={venueDraft.city} onChange={e => updateVenueDraft('city', e.target.value)} placeholder="Milton" />
                </label>
                <label className={styles.fieldLabel}>
                  Province
                  <select className="form-select" value={venueDraft.province} onChange={e => updateVenueDraft('province', e.target.value)}>
                    <option value="">Select province</option>
                    {CANADIAN_PROVINCES.map(province => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.fieldLabel}>
                  Postal code
                  <input className="form-input" value={venueDraft.postalCode} onChange={e => updateVenueDraft('postalCode', e.target.value.toUpperCase())} placeholder="A1A 1A1" />
                </label>
                <label className={styles.fieldLabel}>
                  Country
                  <input className="form-input" value={venueDraft.country} onChange={e => updateVenueDraft('country', e.target.value)} />
                </label>
              </div>

              {/* Surface block — the scheduling model: how many playable surfaces and of what kind. */}
              <div className={styles.venueSurfaceBlock}>
                <div className={styles.venueSurfaceRow}>
                  <label className={styles.fieldLabel}>
                    How many *
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      max={30}
                      step={1}
                      value={venueDraft.fieldCount}
                      onChange={e => updateVenueDraft('fieldCount', e.target.value)}
                      placeholder="1"
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    Surface type *
                    <select
                      className="form-select"
                      value={venueDraft.facilityType}
                      onChange={e => updateVenueDraftType(e.target.value as FacilityType)}
                    >
                      {WIZARD_FACILITY_TYPES.map(t => (
                        <option key={t} value={t}>{FACILITY_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className={styles.venueSurfaceExplain}>
                  A <strong>facility</strong> is one playable surface — a diamond, field, court, rink, or gym.
                  The scheduler books one game per facility at a time, so entering{' '}
                  <strong>{normalizeFieldCount(venueDraft.fieldCount)}</strong>{' '}lets that many games run in
                  parallel here. We&apos;ll create {FACILITY_TYPE_LABELS[venueDraft.facilityType]}&nbsp;1…N
                  automatically — you can rename them or add more on the Venues page anytime.
                </p>
              </div>

              <label className={`${styles.fieldLabel} ${styles.venueNotesField}`} style={{ display: 'block' }}>
                Notes
                <input className="form-input" value={venueDraft.notes} onChange={e => updateVenueDraft('notes', e.target.value)} placeholder="Parking, entrance, field number" style={{ marginTop: '0.35rem' }} />
              </label>
              <button type="button" className={`btn btn-outline btn-sm ${styles.venueComposerAction}`} onClick={addVenueDraft}>
                <Plus size={14} /> Add venue
              </button>
            </div>

            <div className={styles.setupBlock}>
              <div className={styles.setupBlockHeader}>
                <span>Added venues</span>
                <small>{venueRows.length} added</small>
              </div>

              {venueRows.length === 0 ? (
                <div className={styles.emptyModalState}>
                  No venues added yet. Complete the form above, then click Add venue.
                </div>
              ) : (
                <div className={styles.venueList}>
                  {venueRows.map((row, index) => (
                    <div key={row.id} className={styles.venueCard}>
                      <div className={styles.venueCardHeader}>
                        <strong>Venue {index + 1}</strong>
                        <button type="button" className={styles.iconOnlyButton} onClick={() => setVenueRows(prev => prev.filter(item => item.id !== row.id))} aria-label={`Remove venue ${index + 1}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className={styles.venueCardGrid}>
                        <label className={styles.fieldLabel}>
                          Venue name *
                          <input className="form-input" value={row.name} onChange={e => updateVenueRow(row.id, 'name', e.target.value)} />
                        </label>
                        <label className={styles.fieldLabel}>
                          Street address
                          <input className="form-input" value={row.street} onChange={e => updateVenueRow(row.id, 'street', e.target.value)} />
                        </label>
                        <label className={styles.fieldLabel}>
                          City
                          <input className="form-input" value={row.city} onChange={e => updateVenueRow(row.id, 'city', e.target.value)} />
                        </label>
                        <label className={styles.fieldLabel}>
                          Province
                          <select className="form-select" value={row.province} onChange={e => updateVenueRow(row.id, 'province', e.target.value)}>
                            <option value="">Select province</option>
                            {CANADIAN_PROVINCES.map(province => (
                              <option key={province} value={province}>{province}</option>
                            ))}
                          </select>
                        </label>
                        <label className={styles.fieldLabel}>
                          Postal code
                          <input className="form-input" value={row.postalCode} onChange={e => updateVenueRow(row.id, 'postalCode', e.target.value.toUpperCase())} />
                        </label>
                        <label className={styles.fieldLabel}>
                          Country
                          <input className="form-input" value={row.country} onChange={e => updateVenueRow(row.id, 'country', e.target.value)} />
                        </label>
                      </div>

                      <div className={styles.venueSurfaceRow} style={{ marginTop: '0.65rem' }}>
                        <label className={styles.fieldLabel}>
                          How many *
                          <input
                            className="form-input"
                            type="number"
                            min={1}
                            max={30}
                            step={1}
                            value={row.fieldCount}
                            onChange={e => updateVenueRow(row.id, 'fieldCount', e.target.value)}
                          />
                        </label>
                        <label className={styles.fieldLabel}>
                          Surface type *
                          <select
                            className="form-select"
                            value={row.facilityType}
                            onChange={e => updateVenueRowType(row.id, e.target.value as FacilityType)}
                          >
                            {WIZARD_FACILITY_TYPES.map(t => (
                              <option key={t} value={t}>{FACILITY_TYPE_LABELS[t]}</option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <label className={`${styles.fieldLabel} ${styles.venueNotesField}`} style={{ display: 'block', marginTop: '0.65rem' }}>
                        Notes
                        <input className="form-input" value={row.notes} onChange={e => updateVenueRow(row.id, 'notes', e.target.value)} style={{ marginTop: '0.35rem' }} />
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ),
        { stepId: 'venues', saveLabel: 'Next', onSave: saveVenuesStep, taskId: 'venues', allowSkip: true, requiredHint: true }
      );
    }

    if (activeModal === 'review') {
      const divisionCount = draftSkipped.divisions ? 0 : divisionRows.filter(row => row.name.trim()).length;
      const venueCount = draftSkipped.venues ? 0 : venueRows.filter(row => hasVenueContent(row)).length;
      const welcomeIncluded = !draftSkipped.welcome && useWelcomeMsg && !!welcomeMsg.trim();

      return renderModalFrame(
        draftSkipped.tournament ? 'Finish setup' : 'Review and save',
        draftSkipped.tournament
          ? 'No tournament setup will be created. You can return to this wizard from the dashboard later.'
          : 'Saving keeps the tournament hidden from the public. You can activate it later from Tournament Management.',
        draftSkipped.tournament ? (
          <div className={styles.reviewPanel}>
            <div className={styles.emptyModalState}>
              You skipped tournament creation, so no tournament, divisions, or venues will be created.
            </div>
          </div>
        ) : (
          <div className={styles.reviewPanel}>
            <div className={styles.reviewItem}>
              <span>Tournament</span>
              <strong>{tournamentForm.name.trim() || 'Not named yet'}</strong>
            </div>
            <div className={styles.reviewItem}>
              <span>Divisions</span>
              <strong>{divisionCount > 0 ? `${divisionCount} included` : 'Skipped'}</strong>
            </div>
            <div className={styles.reviewItem}>
              <span>Welcome message</span>
              <strong>{welcomeIncluded ? 'Included' : 'Skipped'}</strong>
            </div>
            <div className={styles.reviewItem}>
              <span>Venues</span>
              <strong>{venueCount > 0 ? `${venueCount} included` : 'Skipped'}</strong>
            </div>
            <div className={styles.reviewItem}>
              <span>Public contact</span>
              <strong>You (editable in Event Settings)</strong>
            </div>
            <div className={styles.reviewItem}>
              <span>Public visibility</span>
              <strong>Not live yet</strong>
            </div>
            <div className={styles.emptyModalState}>
              After saving, only admins can work on this tournament. Registration stays closed and the public page is not live until you activate it. Review the public page format, schedule, divisions, and registration details before going live.
            </div>
          </div>
        ),
        {
          stepId: 'review',
          saveLabel: draftSkipped.tournament ? 'Finish for now' : 'Save setup',
          onSave: saveSetupDraft,
        }
      );
    }

    return null;
  }

  if (planChoiceRequired) {
    return (
      <div className={`${styles.page} ${styles.pageWide}`}>
        <div className={styles.header}>
          <div className={styles.headerIcon}><Rocket size={22} /></div>
          <h1 className={styles.title}>Start free or choose an upgrade</h1>
          <p className={styles.sub}>Begin with the free starter plan, or upgrade if {currentOrg.name} needs registration control, branding, automation, and repeat-event tools.</p>
        </div>

        {renderPlanChooser(true)}
      </div>
    );
  }

  if (workflowRedirecting || shouldRedirectFromTournamentOnboarding) {
    return (
      <div className={styles.workflowOnlyPage} aria-busy="true">
        <div className={styles.redirectPanel}>
          <div className={styles.headerIcon}><Rocket size={22} /></div>
          <div>
            <h1 className={styles.title}>Opening admin</h1>
            <p className={styles.sub}>Your setup is saved. Taking you to the right workspace now.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isTournamentPlan) {
    return (
      <div className={styles.workflowOnlyPage}>
        {renderActiveModal()}
        {planChooserOpen && <div className={styles.modalOverlay} role="presentation">{renderPlanChooser(false)}</div>}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerIcon}><Rocket size={22} /></div>
        <h1 className={styles.title}>Welcome to FieldLogicHQ</h1>
        <p className={styles.sub}>Let&apos;s get {currentOrg.name} set up in a few quick steps.</p>
      </div>

      {new Date() < new Date('2027-01-01T00:00:00.000Z') && (
        <div className={styles.foundingSeasonBanner}>
          <p className={styles.foundingSeasonBannerEyebrow}>Founding Season</p>
          <p className={styles.foundingSeasonBannerTitle}>Welcome to your founding season.</p>
          <p className={styles.foundingSeasonBannerCopy}>
            Your plan is free through December 31, 2026. No credit card required.
            You&apos;ll receive a reminder before standard rates apply in January 2027.
          </p>
        </div>
      )}

      <div className={styles.steps}>
          <div className={`${styles.step} ${styles.stepDone}`}>
            <div className={styles.stepIcon}><CheckCircle2 size={20} /></div>
            <div className={styles.stepBody}>
              <div className={styles.stepTitle}>{planLabel} plan selected</div>
              <div className={styles.stepDesc}>
                Start here, then follow the setup steps that match how your organization runs.
              </div>
            </div>
            <button
              type="button"
              className={`${styles.stepCta} ${styles.stepCtaSecondary}`}
              onClick={() => setPlanChooserOpen(true)}
            >
              View plans <ArrowRight size={13} />
            </button>
          </div>

          {entitlements.includes('module_public_site') && (
            <div className={`${styles.step} ${publicSiteDone ? styles.stepDone : ''}`}>
              <div className={styles.stepIcon}>
                {publicSiteDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </div>
              <div className={styles.stepBody}>
                <div className={styles.stepTitle}>Set up your public page</div>
                <div className={styles.stepDesc}>
                  Add a tagline and description so members can find your organization online.
                </div>
              </div>
            </div>
          )}

          {entitlements.includes('module_house_league') && (
            <div className={`${styles.step} ${seasonsDone ? styles.stepDone : ''}`}>
              <div className={styles.stepIcon}>
                {seasonsDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </div>
              <div className={styles.stepBody}>
                <div className={styles.stepTitle}>Create your first season</div>
                <div className={styles.stepDesc}>
                  Set up a house league season with divisions, registration, and scheduling.
                </div>
              </div>
              <button
                type="button"
                className={`${styles.stepCta} ${seasonsDone ? styles.stepCtaSecondary : ''}`}
                onClick={() => seasonsDone ? router.push(`/${currentOrg.slug}/admin/house-league`) : showWizardStep('league-season')}
              >
                {seasonsDone ? 'View seasons' : 'Start setup'} <ArrowRight size={13} />
              </button>
            </div>
          )}

          {entitlements.includes('module_tournaments') && (
            <div className={`${styles.step} ${startupProgress?.firstTournament ? styles.stepDone : ''}`}>
              <div className={styles.stepIcon}>
                {startupProgress?.firstTournament ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </div>
              <div className={styles.stepBody}>
                <div className={styles.stepTitle}>Optional: set up a tournament</div>
                <div className={styles.stepDesc}>
                  Create a tournament only if your league also runs events or weekend showcases.
                </div>
              </div>
              <button
                type="button"
                className={`${styles.stepCta} ${styles.stepCtaSecondary}`}
                onClick={() => router.push(`/${currentOrg.slug}/admin/tournaments/manage?create=1`)}
              >
                {startupProgress?.firstTournament ? 'View tournaments' : 'Open wizard'} <ArrowRight size={13} />
              </button>
            </div>
          )}

          {entitlements.includes('module_accounting') && (
            <div className={styles.step}>
              <div className={styles.stepIcon}><Circle size={20} /></div>
              <div className={styles.stepBody}>
                <div className={styles.stepTitle}>Review your accounting setup</div>
                <div className={styles.stepDesc}>
                  Your org ledger is ready. Set up team ledgers, add entries, and track invoices.
                </div>
              </div>
            </div>
          )}

          {entitlements.includes('module_rep_teams') && (
            <div className={`${styles.step} ${repTeamsDone ? styles.stepDone : ''}`}>
              <div className={styles.stepIcon}>
                {repTeamsDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </div>
              <div className={styles.stepBody}>
                <div className={styles.stepTitle}>Set up your first rep team</div>
                <div className={styles.stepDesc}>
                  Create a rep team, open a program year, and start managing tryouts and rosters.
                </div>
              </div>
            </div>
          )}
      </div>

      <div className={styles.footer}>
        <button className="btn btn-primary" onClick={complete} disabled={completing}>
          {completing ? 'Loading...' : allDone ? 'Go to Dashboard' : 'Leave setup for now'}
          {!completing && <ArrowRight size={15} />}
        </button>
      </div>

      {renderActiveModal()}
      {planChooserOpen && <div className={styles.modalOverlay} role="presentation">{renderPlanChooser(false)}</div>}
    </div>
  );
}
