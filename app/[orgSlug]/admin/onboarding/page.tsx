'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
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
import { useSetupWizard } from '@/components/admin/tournament/SetupWizardOpener';
import { PLAN_CONFIG, isFoundingSeasonSignupOpen, FOUNDING_SEASON_END_LABEL, FOUNDING_SEASON_DECISION_MONTH_LABEL, FOUNDING_SEASON_NEXT_YEAR_LABEL } from '@/lib/plan-config';
import { hasModuleEntitlement, isClubPlan } from '@/lib/module-entitlements';
import { isFreeFloorLeague, houseLeagueDivisionCap, freeFloorModules } from '@/lib/free-floor';
import type { FreeFloor, OrgPlan } from '@/lib/types';
import { OFFERED_SPORT_OPTIONS, DEFAULT_SPORT } from '@/lib/sports';
import PricingSection from '@/components/PricingSection';
import { parseStartBilling, parseStartPricing } from '@/lib/start-door';
import PlanStep from './PlanStep';
import styles from './onboarding.module.css';
import { tournamentToday } from '@/lib/timezone';
import DateInput from '@/components/shared/DateInput';
import DateTimeInput from '@/components/shared/DateTimeInput';

/*
 * THE FIRST RUN (Tournament admin redesign Stage 5, E1 and A47 — ruled 2026-10-10). Plan selection is a standalone gate
 * (?choosePlan=1). On the Tournament plans the first run then opens the ONE New tournament window every later
 * tournament uses (SetupWizardOpener's `first_run` door) — its own six steps are gone, and with them the "how many
 * tournaments a year" question nothing read (F91), the Plus offer shown to an organizer who had just chosen free
 * (J1-019) and the park's lanes named "Lions Park — Diamond 1" (F77). The house-league steps below are unchanged.
 */
const PLAN_ORDER: OrgPlan[] = ['tournament', 'team', 'tournament_plus', 'league', 'club', 'club_large'];
/** The startup tasks the tournament path records (the progress read still names them). */
const STARTUP_ORDER = ['tournament', 'divisions', 'welcome', 'venues'] as const;
const LEAGUE_STARTUP_ORDER = ['league_season', 'league_divisions', 'league_registration', 'league_tournament'] as const;
const LEAGUE_WIZARD_ORDER = ['league-season', 'league-divisions', 'league-registration', 'league-tournament', 'league-review'] as const;

type StartupActionTaskId = typeof STARTUP_ORDER[number];
type LeagueStartupActionTaskId = typeof LEAGUE_STARTUP_ORDER[number];
type StartupProgressTaskId = 'plan' | StartupActionTaskId | LeagueStartupActionTaskId;
type LeagueWizardTaskId = typeof LEAGUE_WIZARD_ORDER[number];
type StartupTaskStatus = 'pending' | 'complete' | 'skipped';
// 'plan' is a gate, not a wizard step, but it stays in the union so the plan chooser's guards
// (activeModal === 'plan') still type-check.
type ActiveModal = 'plan' | LeagueWizardTaskId | null;
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
  description: string;
  seasonStartDate: string;
  seasonEndDate: string;
  registrationFee: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  waiverText: string;
  autoApproveUnderCapacity: boolean;
  autoPromoteWaitlist: boolean;
};


const LEAGUE_DIVISION_PRESETS: Record<Exclude<LeagueDivisionPreset, 'custom'>, string[]> = {
  youth: ['U9', 'U11', 'U13', 'U15', 'U17'],
  adult: ['Recreational', 'Competitive'],
};

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}


function getDefaultLeagueSeasonForm(): LeagueSeasonForm {
  const nextYear = new Date().getFullYear();
  const defaultName = `${nextYear} House League`; // spelling-ok: a season's own NAME the club keeps or edits, not the program's
  return {
    name: defaultName,
    slug: generateSlug(defaultName),
    sport: DEFAULT_SPORT,
    description: '',
    seasonStartDate: '',
    seasonEndDate: '',
    registrationFee: '',
    registrationOpenAt: '',
    registrationCloseAt: '',
    waiverText: '',
    autoApproveUnderCapacity: true,
    autoPromoteWaitlist: true,
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
  return year && month && day ? `${year}-${month}-${day}` : tournamentToday();
}



function buildLeagueDivisionRows(names: string[]): LeagueDivisionRow[] {
  return names.map((name, index) => ({
    id: `${generateSlug(name) || 'division'}-${index + 1}`,
    name,
    capacity: '',
  }));
}




/** Clamp the field/diamond count to a sane 1–30 and default to '1'. */




/** Concise "3 Diamonds" style count for an added-venue summary row. */

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

// A Club's owner gets the club's setup checklist (Club Tier Stage 1, specimen 10); every other plan this page. (The
// admin is always on the kit, so the switch this wrapper read is gone — Tournament admin redesign Stage 5.)
const ClubSetupKit = dynamic(() => import('@/components/admin/kit/club/ClubSetupKit'));

export default function OnboardingPage() {
  const { currentOrg, userRole } = useOrg();
  return userRole === 'owner' && isClubPlan(currentOrg?.planId) ? <ClubSetupKit /> : <OnboardingPageLegacy />;
}

function OnboardingPageLegacy() {
  const { currentOrg, userRole, loading, refresh: refreshOrgContext } = useOrg();
  const { refresh: refreshTournamentContext } = useTournament();
  const { openNew } = useSetupWizard();
  const router = useRouter();
  // The New tournament window opens once per visit (the effect below re-runs on every state change).
  const firstRunOpened = useRef(false);
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
    club_large: PLAN_CONFIG.club_large.gatingStatus === 'early_access',
  }));
  const [planLoading, setPlanLoading] = useState<OrgPlan | null>(null);
  const [planError, setPlanError] = useState('');
  const [leagueDraftSkipped, setLeagueDraftSkipped] = useState<LeagueDraftSkippedState>(getDefaultLeagueDraftSkipped);
  const [leagueSeasonForm, setLeagueSeasonForm] = useState<LeagueSeasonForm>(getDefaultLeagueSeasonForm);
  const [leagueDivisionPreset, setLeagueDivisionPreset] = useState<LeagueDivisionPreset>('youth');
  const [leagueDivisionRows, setLeagueDivisionRows] = useState<LeagueDivisionRow[]>(() => buildLeagueDivisionRows(LEAGUE_DIVISION_PRESETS.youth));
  const [leagueCustomDivisionName, setLeagueCustomDivisionName] = useState('');
  const [leagueWantsTournamentSetup, setLeagueWantsTournamentSetup] = useState(false);

  const planChoiceRequired = searchParams.get('choosePlan') === '1';
  const continueSetup = searchParams.get('continueSetup') === '1';
  const planSelectionSucceeded = searchParams.get('success') === '1';
  // The plan picked on the pricing page rides here from Run a tournament's step 2 and is the one the plan step
  // preselects and names (Account-First Sign-up A6, 2026-10-18; The first look G4, 2026-10-20 — the free pick too).
  // A preselection the person can change, never a price.
  const pricing = parseStartPricing(searchParams.get('plan'), searchParams.get('billing'));
  // After the sign-up window closes, an organization that holds the Founding comp still picks Tournament Plus at $0 on
  // its FIRST plan choice (owner 2026-10-19). The server answers, the same rule the checkout applies, so the card never
  // shows a price the checkout won't charge. Before the close the window itself shows the offer.
  // Only a free organization can be offered it, so no other plan asks. It is asked again each time the chooser appears
  // (the answer ends once setup starts), and an answer is only ever shown for the state it was asked in (/review).
  const offerSlug = currentOrg?.planId === 'tournament' && !isFoundingSeasonSignupOpen() ? currentOrg.slug : null;
  const offerKey = offerSlug ? [offerSlug, planChoiceRequired, planChooserOpen, activeModal].join(':') : null;
  const [offerAnswer, setOfferAnswer] = useState<{ key: string; held: boolean } | null>(null);
  useEffect(() => {
    if (!offerKey || !offerSlug) return;
    let live = true;
    fetch(`/api/admin/org/founding-season-status?orgSlug=${encodeURIComponent(offerSlug)}&planChoice=1`)
      .then(res => (res.ok ? res.json() : null))
      .then((data: { offerOnPlanChoice?: boolean } | null) => {
        if (live) setOfferAnswer({ key: offerKey, held: data?.offerOnPlanChoice === true });
      })
      .catch(() => {});
    return () => { live = false; };
  }, [offerKey, offerSlug]);
  const foundingOfferHeld = !!offerKey && offerAnswer?.key === offerKey && offerAnswer.held;

  function isFirstRunPlanEditable(progress: StartupProgress | null = startupProgress) {
    if (!currentOrg || currentOrg.onboardingCompletedAt) return false;
    if (!progress) return planChoiceRequired;
    if (progress.firstTournament) return false;
    return [...STARTUP_ORDER, ...LEAGUE_STARTUP_ORDER].every(taskId => progress.tasks[taskId] !== 'complete');
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
        .then(r => r.ok ? r.json() : { seasons: [] })
        // The route answers `{ seasons }`, never a bare array — reading it as an array made this
        // "no season yet" for every org, so the season step never showed done (found 2026-09-25).
        .then(d => Array.isArray(d?.seasons) && d.seasons.length > 0)
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

    // The one New tournament window (Stage 5, E1), opened once; creating lands on the new draft's board.
    if (firstRunOpened.current) return;
    firstRunOpened.current = true;
    openNew('first_run', { onCreated: finishFirstRun, onClose: closeWorkflowModal });
    // The window's own handlers are read when it opens; `firstRunOpened` keeps it to one opening per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // …but never for a CLUB. A club's plan carries house league without the club running one, and a
    // rep club opening its setup was dropped straight into "create your first season" (A11). Since
    // Club Tier Stage 1 a Club owner lands on this page at first sign-in, so this matters now.
    const planForWizard = normalizePlanId(currentOrg.planId);
    if (isClubPlan(planForWizard)) return;

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
    if (newPlan === 'league' || newPlan === 'club' || newPlan === 'club_large') {
      await showWizardStep('league-season');
    } else {
      await advanceWizard('plan');
    }
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
      // The plan step's free choice lands here (a new organization is already on Tournament): it shows "Starting…" and
      // holds both buttons like the other two actions, and a failure says so (/review, The first look Stage 3).
      setPlanLoading(planKey);
      try {
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

    if (planKey === 'tournament') {
      setPlanLoading(planKey);
      try {
        await requestJson<{ success: boolean }>(`/api/admin/org/onboarding-plan?orgSlug=${encodeURIComponent(currentOrg.slug)}`, {
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


  function resetWorkflowDraftState() {
    resetLeagueSetupDraft();
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

  function clearStepError() {
    setStepError('');
  }

  /** The first run's New tournament was created: setup is done, and the new draft's board opens. */
  async function finishFirstRun(created: { id: string }) {
    if (!currentOrg) return;
    const orgParam = `?orgSlug=${encodeURIComponent(currentOrg.slug)}`;
    setWorkflowRedirecting(true);
    await requestJson<{ ok: boolean }>(`/api/admin/org/complete-onboarding${orgParam}`, { method: 'POST' }).catch(() => null);
    await refreshTournamentContext(created.id);
    await refreshOrgContext();
    router.replace(getPostOnboardingHref(currentOrg, { hasTournament: true }));
  }

  async function showWizardStep(stepId: Exclude<ActiveModal, null>) {
    clearStepError();
    setActiveModal(stepId);
  }

  function closeWorkflowModal() {
    if (currentOrg) {
      const activePlan = normalizePlanId(currentOrg.planId);
      const isGuidedTournamentPlan = activePlan === 'tournament' || activePlan === 'tournament_plus';
      if (isGuidedTournamentPlan) {
        clearStepError();
        setWorkflowRedirecting(true);
        router.replace(getPostOnboardingHref(currentOrg, { hasTournament: Boolean(startupProgress?.firstTournament) }));
        return;
      }
    }

    setActiveModal(null);
    clearStepError();
    setWizardDismissed(true);
  }

  function getWizardOrder() {
    return LEAGUE_WIZARD_ORDER;
  }

  function getNextWizardStep(stepId: Exclude<ActiveModal, null>): Exclude<ActiveModal, null> | null {
    const order = getWizardOrder();
    const currentIndex = (order as readonly string[]).indexOf(stepId);
    return (order[currentIndex + 1] as Exclude<ActiveModal, null> | undefined) ?? null;
  }

  function getPreviousWizardStep(stepId: Exclude<ActiveModal, null>): Exclude<ActiveModal, null> | null {
    if (stepId === 'league-season') return null;
    const order = getWizardOrder();
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








  /** Commit the composer draft (add new or save edit). Returns false if invalid. */









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
      sport: leagueSeasonForm.sport || DEFAULT_SPORT,
      description: leagueSeasonForm.description.trim() || null,
      seasonStartDate: leagueSeasonForm.seasonStartDate || null,
      seasonEndDate: leagueSeasonForm.seasonEndDate || null,
      registrationFee,
      registrationOpenAt: leagueSeasonForm.registrationOpenAt ? `${leagueSeasonForm.registrationOpenAt}:00Z` : null,
      registrationCloseAt: leagueSeasonForm.registrationCloseAt ? `${leagueSeasonForm.registrationCloseAt}:00Z` : null,
      waiverText: leagueSeasonForm.waiverText.trim() || null,
      autoApproveUnderCapacity: leagueSeasonForm.autoApproveUnderCapacity,
      autoPromoteWaitlist: leagueSeasonForm.autoPromoteWaitlist,
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
      const capacity = Number(row.capacity);
      return !row.capacity || !Number.isInteger(capacity) || capacity < 1;
    });
    if (invalidCapacity) throw new Error(`Give ${invalidCapacity.name} its number of spots.`);

    return rows.map((row, index) => ({
      name: row.name,
      capacity: Number(row.capacity),
      sortOrder: index,
    }));
  }






  // Specialized dirty-banner for the Next action with a valid draft: Add-it path
  // must carry the just-built row forward (React state not yet flushed).

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


  async function saveLeagueSetupDraft() {
    if (!currentOrg) return;
    setStepError('');
    setStepSaving(true);

    // Org-context fail-closed routes (requireOrgSlug) — pass the active org slug.
    const orgParam = `?orgSlug=${encodeURIComponent(currentOrg.slug)}`;

    try {
      if (leagueDraftSkipped.league_season) {
        for (const taskId of LEAGUE_STARTUP_ORDER) {
          await markStartupTask(taskId, 'skipped', currentOrg?.slug);
        }
        await requestJson<{ ok: boolean }>(`/api/admin/org/complete-onboarding${orgParam}`, { method: 'POST' });
        await refreshOrgContext();
        setWorkflowRedirecting(true);
        router.replace(`/${currentOrg.slug}/admin`);
        return;
      }

      const season = getLeagueSeasonDraft();
      const divisions = leagueDraftSkipped.league_divisions ? [] : getLeagueDivisionDraftRows();

      const createdSeason = await requestJson<{ id: string }>(`/api/admin/house-league/seasons${orgParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(season),
      });

      await Promise.all(divisions.map(row => requestJson<{ id: string }>(`/api/admin/house-league/seasons/${createdSeason.id}/divisions${orgParam}`, {
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
      await requestJson<{ ok: boolean }>(`/api/admin/org/complete-onboarding${orgParam}`, { method: 'POST' });
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
  const onClubPlan = isClubPlan(activePlanId);
  const shouldRedirectFromTournamentOnboarding = isTournamentPlan && startupProgress?.wizardAvailable === false;
  const todayDate = getTodayDateValue();
  const allDone = isLeaguePlan
    ? seasonsDone === true
    : onClubPlan
      ? seasonsDone === true || repTeamsDone === true || publicSiteDone === true
      : false;

  // The change-plan window ("View plans", from the league / other-plan setup page): the full pricing cards, its close
  // and "Continue free". The required plan step is `PlanStep` (The first look, Stage 3a), never this.
  function renderPlanChooser() {
    const disabledPlans: OrgPlan[] = !isFirstRunPlanEditable()
      ? PLAN_ORDER.filter(k => PLAN_ORDER.indexOf(k) < PLAN_ORDER.indexOf(activePlanId))
      : [];

    return (
      <div className={styles.planModal} role="dialog" aria-modal="true" aria-labelledby="onboarding-plan-title">
        <div className={styles.modalHeader}>
          <div>
            <h2 id="onboarding-plan-title" className={styles.modalTitle}>Start free or choose an upgrade</h2>
            <p className={styles.modalSub}>
              Start free with an invite-only event, where you add the teams, or choose Tournament Plus for public registration, payment tracking, automation, branding, and repeat-event tools.
            </p>
          </div>
          <button
            type="button"
            className={styles.modalClose}
            onClick={() => setPlanChooserOpen(false)}
            aria-label="Close plan chooser"
          >
            <X size={18} />
          </button>
        </div>

        <PricingSection
          gatingMap={gatingMap}
          onChoosePlan={choosePlan}
          currentPlan={activePlanId}
          planLoading={planLoading}
          disabledPlans={disabledPlans}
          initialBilling={parseStartBilling(searchParams.get('billing')) ?? undefined}
          order={['tournament_plus', 'tournament', 'league', 'club']}
          featuredPlan={pricing?.plan ?? 'tournament_plus'}
          foundingOfferHeld={foundingOfferHeld}
          ctaLabel={(planKey) => planKey === 'tournament' && planKey !== activePlanId ? 'Continue free' : undefined}
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
    const wizardOrder = getWizardOrder();
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
              <span className={styles.planErrorText}>{stepError}</span>
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
                  onClick={() => void skipLeagueStep(options.taskId as LeagueStartupActionTaskId)}
                  disabled={stepSaving}
                >
                  Skip
                </button>
              )}
              {!options.hidePrimaryAction && (
                <button type="button" className="btn btn-primary" onClick={options.onSave} disabled={stepSaving || options.saveDisabled}>
                  {stepSaving ? 'Saving…' : options.saveLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderActiveModal() {
    // Plan selection is a standalone gate (?choosePlan=1), not a wizard step. The tournament path's steps are the one
    // New tournament window (Stage 5); what is left here is the house-league path.
    if (activeModal === 'league-season') {
      return renderModalFrame(
        'Create your first season',
        'Start with the core details parents and staff will recognize. The season stays in draft until you open registration.',
        (
          <div className={styles.inlineList}>
            <div className={styles.modalGridTwo}>
              <label className={`${styles.fieldLabel} ${styles.fullWidthField}`}>
                Season name *{' '}
                <input
                  className="form-input"
                  value={leagueSeasonForm.name}
                  onChange={e => handleLeagueSeasonNameChange(e.target.value)}
                  placeholder="2026 House League" // spelling-ok: an example season name, like the default above
                  autoFocus
                />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                  Public link: <span style={{ fontFamily: 'var(--font-data)' /* type-ok: an address */ }}>/league/{leagueSeasonForm.slug || 'your-season'}</span> — auto-generated; editable later in season settings.
                </span>
              </label>
              <label className={styles.fieldLabel}>
                Sport{' '}
                <select
                  className="form-select"
                  value={leagueSeasonForm.sport}
                  onChange={e => setLeagueSeasonForm(form => ({ ...form, sport: e.target.value }))}
                >
                  {OFFERED_SPORT_OPTIONS.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </label>
              <label className={styles.fieldLabel}>
                Season starts{' '}
                <DateInput
                  className="form-input"
                  min={todayDate}
                  value={leagueSeasonForm.seasonStartDate}
                  onChange={v => setLeagueSeasonForm(form => ({ ...form, seasonStartDate: v }))}
                />
              </label>
              <label className={styles.fieldLabel}>
                Season ends{' '}
                <DateInput
                  className="form-input"
                  min={leagueSeasonForm.seasonStartDate || todayDate}
                  rangeStart={leagueSeasonForm.seasonStartDate || undefined}
                  value={leagueSeasonForm.seasonEndDate}
                  onChange={v => setLeagueSeasonForm(form => ({ ...form, seasonEndDate: v }))}
                />
              </label>
              <label className={`${styles.fieldLabel} ${styles.fullWidthField}`}>
                Public description{' '}
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
          : 'Create the registration groups parents will choose from, and give each one its number of spots.',
        (
          <div className={styles.inlineList}>
            <p style={{ fontSize: '0.72rem', color: 'var(--data-gray)', margin: 0, lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--white-55)' }}>Max players</strong> caps how many players can register in a division — it&apos;s
              not the number of teams{leagueDivisionLimited ? ' (your free plan includes up to 8 teams, added after setup)' : ''}.
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
      return renderModalFrame(
        'Configure registration',
        'Set the defaults that control how public submissions are handled when registration opens.',
        (
          <div className={styles.inlineList}>
            <div className={styles.modalGridTwo}>
              <label className={styles.fieldLabel}>
                Registration opens{' '}
                <DateTimeInput
                  className="form-input"
                  value={leagueSeasonForm.registrationOpenAt}
                  onChange={v => setLeagueSeasonForm(form => ({ ...form, registrationOpenAt: v }))}
                />
              </label>
              <label className={styles.fieldLabel}>
                Registration closes{' '}
                <DateTimeInput
                  className="form-input"
                  value={leagueSeasonForm.registrationCloseAt}
                  onChange={v => setLeagueSeasonForm(form => ({ ...form, registrationCloseAt: v }))}
                />
              </label>
              <label className={`${styles.fieldLabel} ${styles.fullWidthField}`}>
                Registration fee{' '}
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
                Waiver text{' '}
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
                  // ⚰ "Auto-generate accounting fee entries" retired (Club Tier Stage 9a, S1·b): stored, read by nothing — a fee
                  // reaches the season's book only when it is marked received (lib/league-fee-paid.ts).
                ].map(({ key, label, help }) => (
                  <label key={key} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      style={{ width: 16, height: 16, marginTop: '0.15rem', flexShrink: 0 }}
                      checked={Boolean(leagueSeasonForm[key as keyof LeagueSeasonForm])}
                      onChange={e => setLeagueSeasonForm(form => ({ ...form, [key]: e.target.checked }))}
                    />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--white-70)' }}>{label}</span>
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
              />{' '}
              Set up a tournament after this league season is saved
            </label>
            <div className={styles.emptyModalState}>
              Leaving this unchecked keeps the league workflow focused. You can create tournaments later from the Tournaments page.
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
          ? 'No house league season will be created. You can create one later from House league.'
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

    return null;
  }

  if (planChoiceRequired) {
    return (
      <PlanStep
        orgName={currentOrg.name}
        pricing={pricing}
        foundingOfferHeld={foundingOfferHeld}
        loading={planLoading}
        error={planError}
        onChoose={choosePlan}
      />
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
        {planChooserOpen && <div className={styles.modalOverlay} role="presentation">{renderPlanChooser()}</div>}
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

      {isFoundingSeasonSignupOpen() && (
        <div className={styles.foundingSeasonBanner}>
          <p className={styles.foundingSeasonBannerEyebrow}>Founding Season</p>
          <p className={styles.foundingSeasonBannerTitle}>Welcome to your Founding Season.</p>
          <p className={styles.foundingSeasonBannerCopy}>
            Your plan is free through {FOUNDING_SEASON_END_LABEL}. No credit card.
            We&apos;ll remind you during the summer, and in {FOUNDING_SEASON_DECISION_MONTH_LABEL} you&apos;ll choose a plan for your {FOUNDING_SEASON_NEXT_YEAR_LABEL} season.
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
          {completing ? 'Finishing…' : allDone ? 'Go to Overview' : 'Leave setup for now'}
          {!completing && <ArrowRight size={15} />}
        </button>
      </div>

      {renderActiveModal()}
      {planChooserOpen && <div className={styles.modalOverlay} role="presentation">{renderPlanChooser()}</div>}
    </div>
  );
}
