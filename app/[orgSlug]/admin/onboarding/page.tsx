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
import { PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';
import styles from './onboarding.module.css';

const PLAN_ORDER: OrgPlan[] = ['tournament', 'tournament_plus', 'league', 'club'];
const STARTUP_ORDER = ['tournament', 'divisions', 'welcome', 'venues', 'contacts'] as const;
const WIZARD_ORDER = ['plan', ...STARTUP_ORDER, 'review'] as const;

type StartupActionTaskId = typeof STARTUP_ORDER[number];
type StartupProgressTaskId = 'plan' | StartupActionTaskId;
type StartupTaskId = typeof WIZARD_ORDER[number];
type StartupTaskStatus = 'pending' | 'complete' | 'skipped';
type ActiveModal = StartupTaskId | null;
type DivisionPreset = 'youth' | 'adult' | 'custom';

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
};

type VenueRow = VenueFields & {
  id: string;
};

type DraftSkippedState = Record<StartupActionTaskId, boolean>;

const PLAN_TAGLINE: Record<OrgPlan, string> = {
  tournament:      'Start free with one active tournament and the core tools to get registration moving.',
  tournament_plus: 'Run multiple tournaments with automation and more staff flexibility.',
  league:          'Manage a house league season, registration, standings, and a public organization page.',
  club:            'Run the full club operation with league, rep teams, accounting, and coaches tools.',
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

const PLAN_FEATURES: Record<OrgPlan, string[]> = {
  tournament: [
    'Tournament scheduling',
    'Score entry and results',
    'Standings',
    'Field and diamond management',
    '3 staff / admin seats',
    '1 active tournament',
  ],
  tournament_plus: [
    'Everything in Tournament',
    'Automated schedule generation',
    'Bracket generator',
    'Email announcements and communications',
    'Tournament archives and history',
    'Unlimited simultaneous tournaments',
    '5 staff / admin seats',
    'Unlimited officials seats',
  ],
  league: [
    'Everything in Tournament Plus',
    'Public organization page',
    'House league registration and seasons',
    'Registration workflows',
    'Division and season management',
    'League-scoped communications',
    'Advanced member roles and permissions',
    '10 staff / admin seats',
  ],
  club: [
    'Everything in League',
    'Accounting module - org ledger, team invoicing, payment reconciliation, expense tracking',
    'Rep Teams module - tryouts, rosters, player documents, coaches portal, team finances',
    'Unlimited staff / admin seats',
  ],
};

const DIVISION_PRESETS: Record<Exclude<DivisionPreset, 'custom'>, string[]> = {
  youth: ['U9', 'U11', 'U13', 'U15', 'U17', 'U19'],
  adult: ['Open', 'Competitive', 'Recreational'],
};

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getDefaultTournamentForm() {
  const nextYear = new Date().getFullYear();
  const defaultName = `${nextYear} Tournament`;
  return {
    year: String(nextYear),
    name: defaultName,
    slug: generateSlug(defaultName),
    startDate: '',
    endDate: '',
  };
}

function getDefaultDraftSkipped(): DraftSkippedState {
  return {
    tournament: false,
    divisions: false,
    welcome: false,
    venues: false,
    contacts: false,
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

function buildDivisionRows(names: string[]): DivisionRow[] {
  return names.map((name, index) => ({
    id: `${generateSlug(name) || 'division'}-${index + 1}`,
    name,
    capacity: 8,
    poolCount: 0,
    requiresPoolSelection: false,
    poolNames: ['Pool A'],
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
  };
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

function hasNonTournamentWorkspace(planId: string, enabledAddons: string[] = []) {
  const entitledModules = new Set([
    ...PLAN_CONFIG[normalizePlanId(planId)].moduleEntitlements,
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
  org: { slug: string; planId: string; enabledAddons?: string[] },
  options: { hasTournament?: boolean } = {},
) {
  if (hasNonTournamentWorkspace(org.planId, org.enabledAddons)) return `/${org.slug}/admin`;
  if (options.hasTournament === false) return `/${org.slug}/admin/onboarding?continueSetup=1`;
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

async function markStartupTask(taskId: StartupActionTaskId, status: 'complete' | 'skipped') {
  return requestJson<StartupProgress>('/api/admin/org/startup-tasks', {
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
  const [stepSaving, setStepSaving] = useState(false);
  const [stepError, setStepError] = useState('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [planLoading, setPlanLoading] = useState<OrgPlan | null>(null);
  const [planError, setPlanError] = useState('');
  const [draftSkipped, setDraftSkipped] = useState<DraftSkippedState>(getDefaultDraftSkipped);

  const [tournamentForm, setTournamentForm] = useState(getDefaultTournamentForm);
  const [slugEdited, setSlugEdited] = useState(false);
  const [divisionPreset, setDivisionPreset] = useState<DivisionPreset>('youth');
  const [divisionRows, setDivisionRows] = useState<DivisionRow[]>(() => buildDivisionRows(DIVISION_PRESETS.youth));
  const [customDivisionName, setCustomDivisionName] = useState('');
  const [useWelcomeMsg, setUseWelcomeMsg] = useState(true);
  const [welcomeMsg, setWelcomeMsg] = useState('Welcome to our tournament! We are excited to host a great event for all participating teams.');

  const [venueDraft, setVenueDraft] = useState<VenueFields>(buildVenueDraft);
  const [venueRows, setVenueRows] = useState<VenueRow[]>([]);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', role: 'Tournament Director' });

  const planChoiceRequired = searchParams.get('choosePlan') === '1';
  const continueSetup = searchParams.get('continueSetup') === '1';
  const planSelectionSucceeded = searchParams.get('success') === '1';

  function isFirstRunPlanEditable(progress: StartupProgress | null = startupProgress) {
    if (!currentOrg || currentOrg.onboardingCompletedAt) return false;
    if (!progress) return planChoiceRequired;
    if (progress.firstTournament) return false;
    return STARTUP_ORDER.every(taskId => progress.tasks[taskId] !== 'complete');
  }

  function getWizardResumeStep(progress: StartupProgress | null, resumeIncomplete: boolean): StartupTaskId {
    if (!progress || !resumeIncomplete) return 'plan';
    return 'tournament';
  }

  const refreshStartup = useCallback(async () => {
    const progress = await requestJson<StartupProgress>('/api/admin/org/startup-tasks');
    setStartupProgress(progress);
    return progress;
  }, []);

  useEffect(() => {
    if (loading || !currentOrg) return;

    if (currentOrg.onboardingCompletedAt && !continueSetup) {
      router.replace(`/${currentOrg.slug}/admin`);
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshStartup().catch(() => {
      setStartupProgress(null);
    });

    const entitlements = PLAN_CONFIG[normalizePlanId(currentOrg.planId)].moduleEntitlements;

    const seasonsRequest = entitlements.includes('module_house_league')
      ? fetch('/api/admin/house-league/seasons')
        .then(r => r.ok ? r.json() : [])
        .then(d => Array.isArray(d) && d.length > 0)
        .catch(() => false)
      : Promise.resolve(null);
    seasonsRequest.then(setSeasonsDone);

    const repTeamsRequest = entitlements.includes('module_rep_teams')
      ? fetch('/api/admin/rep-teams/teams')
        .then(r => r.ok ? r.json() : { teams: [] })
        .then(d => Array.isArray(d?.teams) && d.teams.length > 0)
        .catch(() => false)
      : Promise.resolve(null);
    repTeamsRequest.then(setRepTeamsDone);

    const publicSiteRequest = entitlements.includes('module_public_site')
      ? fetch('/api/admin/public-site')
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
    if (loading || !currentOrg || !startupProgress) return;
    const activePlan = normalizePlanId(currentOrg.planId);
    const isGuidedTournamentPlan = activePlan === 'tournament' || activePlan === 'tournament_plus';
    if (isGuidedTournamentPlan && !startupProgress.wizardAvailable) {
      router.replace(`/${currentOrg.slug}/admin`);
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
      wizardDismissed
    ) {
      return;
    }

    const activePlan = normalizePlanId(currentOrg.planId);
    if (activePlan !== 'tournament' && activePlan !== 'tournament_plus') return;

    const shouldResumeAfterPlan = continueSetup || planSelectionSucceeded;
    void showWizardStep(getWizardResumeStep(startupProgress, shouldResumeAfterPlan));
  }, [loading, currentOrg, userRole, planChoiceRequired, continueSetup, planSelectionSucceeded, startupProgress, activeModal, planChooserOpen, wizardDismissed]);

  async function complete() {
    if (!currentOrg || completing) return;
    setCompleting(true);
    await fetch('/api/admin/org/complete-onboarding', { method: 'POST' });
    router.push(getPostOnboardingHref(currentOrg, { hasTournament: false }));
  }

  async function choosePlan(planKey: OrgPlan) {
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
        router.replace(`/${currentOrg.slug}/admin/onboarding?success=1`);
      } else if (activeModal === 'plan') {
        await advanceWizard('plan');
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
          router.replace(`/${currentOrg.slug}/admin/onboarding?success=1`);
        } else if (activeModal === 'plan') {
          await advanceWizard('plan');
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
          router.replace(`/${currentOrg.slug}/admin/onboarding?success=1`);
        } else if (activeModal === 'plan') {
          await advanceWizard('plan');
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
    setVenueDraft(buildVenueDraft());
    setVenueRows([]);
    setContactForm({ name: '', email: currentOrg?.contactEmail ?? '', phone: '', role: 'Tournament Director' });
    setStepError('');
  }

  async function showWizardStep(stepId: StartupTaskId) {
    setStepError('');
    setActiveModal(stepId);
  }

  function closeWorkflowModal() {
    setActiveModal(null);
    setStepError('');
    setWizardDismissed(true);
  }

  function getNextWizardStep(stepId: StartupTaskId): StartupTaskId | null {
    const currentIndex = WIZARD_ORDER.indexOf(stepId);
    return WIZARD_ORDER[currentIndex + 1] ?? null;
  }

  function getPreviousWizardStep(stepId: StartupTaskId): StartupTaskId | null {
    if (stepId === 'review' && draftSkipped.tournament) return 'tournament';
    const currentIndex = WIZARD_ORDER.indexOf(stepId);
    return currentIndex > 0 ? WIZARD_ORDER[currentIndex - 1] : null;
  }

  async function advanceWizard(stepId: StartupTaskId) {
    const nextStep = getNextWizardStep(stepId);
    if (!nextStep) {
      setActiveModal(null);
      setWizardDismissed(true);
      return;
    }

    await showWizardStep(nextStep);
  }

  async function goBackWizard(stepId: StartupTaskId) {
    const previousStep = getPreviousWizardStep(stepId);
    if (!previousStep) return;
    await showWizardStep(previousStep);
  }

  async function startWizard() {
    setWizardDismissed(false);
    resetWorkflowDraftState();
    await showWizardStep(getWizardResumeStep(startupProgress, true));
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
    setTournamentForm(form => ({
      ...form,
      startDate,
      endDate: startDate ? addDaysToDateValue(startDate, 2) : '',
    }));
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
    const year = Number(tournamentForm.year);
    const name = tournamentForm.name.trim();

    if (!Number.isInteger(year) || year < 1900) {
      throw new Error('Enter a valid tournament year.');
    }
    if (!name) {
      throw new Error('Enter a tournament name before continuing.');
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error('Use a valid URL slug before continuing.');
    }
    if (tournamentForm.endDate && !tournamentForm.startDate) {
      throw new Error('Choose a start date before setting an end date.');
    }
    if (tournamentForm.startDate && tournamentForm.startDate < getTodayDateValue()) {
      throw new Error('Start date cannot be before today.');
    }
    if (tournamentForm.startDate && tournamentForm.endDate && tournamentForm.endDate < tournamentForm.startDate) {
      throw new Error('End date cannot be before the start date.');
    }

    return {
      year,
      name,
      slug,
      startDate: tournamentForm.startDate || null,
      endDate: tournamentForm.endDate || null,
    };
  }

  function getDivisionDraftRows() {
    const rows = divisionRows
      .map(row => ({ ...row, name: row.name.trim() }))
      .filter(row => row.name);
    if (rows.length === 0) throw new Error('Add at least one division, or skip this step.');

    const duplicateDivision = rows.find((row, index) =>
      rows.findIndex(other => other.name.toLowerCase() === row.name.toLowerCase()) !== index
    );
    if (duplicateDivision) throw new Error(`Division names must be unique. "${duplicateDivision.name}" is listed more than once.`);

    const invalidCapacity = rows.find(row => !Number.isFinite(row.capacity) || row.capacity < 1);
    if (invalidCapacity) throw new Error(`Add a valid capacity for ${invalidCapacity.name}.`);

    return rows.map(row => ({
      name: row.name,
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

  function getContactDraft() {
    const email = contactForm.email.trim().toLowerCase();
    if (!contactForm.name.trim() || !email) throw new Error('Add a contact name and email, or skip this step.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid public contact email.');
    return {
      name: contactForm.name.trim(),
      email,
      phone: contactForm.phone.trim() || undefined,
      role: contactForm.role.trim() || undefined,
    };
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

  async function saveContactsStep() {
    try {
      getContactDraft();
      setDraftSkipped(prev => ({ ...prev, contacts: false }));
      setStepError('');
      await advanceWizard('contacts');
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Unable to continue.');
    }
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
    if (taskId === 'contacts') {
      setContactForm({ name: '', email: '', phone: '', role: 'Tournament Director' });
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

  async function saveSetupDraft() {
    if (!currentOrg) return;
    setStepError('');
    setStepSaving(true);

    try {
      if (draftSkipped.tournament) {
        for (const taskId of STARTUP_ORDER) {
          await markStartupTask(taskId, 'skipped');
        }
        await requestJson<{ ok: boolean }>('/api/admin/org/complete-onboarding', { method: 'POST' });
        await refreshOrgContext();
        setActiveModal(null);
        setWizardDismissed(true);
        router.push(getPostOnboardingHref(currentOrg, { hasTournament: false }));
        return;
      }

      const tournament = getTournamentDraft();
      const divisions = draftSkipped.divisions ? [] : getDivisionDraftRows();
      const announcement = !draftSkipped.welcome && useWelcomeMsg ? { body: welcomeMsg.trim() } : null;
      const venues = draftSkipped.venues ? [] : getVenueDraftRows();
      const contact = draftSkipped.contacts ? null : getContactDraft();

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

      await Promise.all(venues.map(row => requestJson<{ success: boolean }>('/api/admin/diamonds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          data: {
            tournamentId: created.id,
            name: row.name,
            address: formatVenueAddress(row),
            notes: row.notes || undefined,
          },
        }),
      })));

      if (contact) {
        await requestJson<{ success: boolean }>('/api/admin/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            data: {
              tournamentId: created.id,
              ...contact,
            },
          }),
        });

        await requestJson<{ success: boolean }>('/api/admin/tournaments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'set-contact-email',
            id: created.id,
            data: { contactEmail: contact.email },
          }),
        });
      }

      await requestJson<{ ok: boolean }>('/api/admin/org/complete-onboarding', { method: 'POST' });
      await refreshTournamentContext();
      await refreshOrgContext();
      await refreshStartup();
      setActiveModal(null);
      setWizardDismissed(true);
      router.push(getPostOnboardingHref(currentOrg, { hasTournament: true }));
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Unable to save setup.');
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
  const todayDate = getTodayDateValue();
  const allTournamentStepsFinished = isTournamentPlan ? startupProgress?.allFinished === true : false;
  const allDone = isTournamentPlan
    ? allTournamentStepsFinished
    : isLeaguePlan
      ? seasonsDone === true
      : isClubPlan
        ? seasonsDone === true || repTeamsDone === true || publicSiteDone === true
        : false;

  function getPlanPrice(planKey: OrgPlan) {
    const plan = PLAN_CONFIG[planKey];
    if (plan.monthlyPrice === 0) return 'Free';
    if (billingCycle === 'annual') return `$${plan.annualPrice} CAD / year`;
    return `$${plan.monthlyPrice} CAD / month`;
  }

  function getPlanAction(planKey: OrgPlan) {
    const planSelectionEditable = !planChoiceRequired && isFirstRunPlanEditable();
    if (planSelectionEditable) return `Select ${PLAN_CONFIG[planKey].label}`;
    if (planChoiceRequired && planKey === 'tournament') return 'Start with Tournament';
    if (!planChoiceRequired && planKey === activePlanId) return 'Current plan';
    if (!planChoiceRequired && PLAN_ORDER.indexOf(planKey) < PLAN_ORDER.indexOf(activePlanId)) return 'Included in current plan';
    if (planKey === 'tournament') return 'Continue free';
    return `Choose ${PLAN_CONFIG[planKey].label}`;
  }

  function renderPlanChooser(required: boolean, embedded = false) {
    return (
      <div className={embedded ? styles.planChooserEmbedded : required ? styles.planStage : styles.planModal} role={required || embedded ? undefined : 'dialog'} aria-modal={required || embedded ? undefined : 'true'} aria-labelledby="onboarding-plan-title">
        {!embedded && (
          <div className={styles.modalHeader}>
            <div>
              <h2 id="onboarding-plan-title" className={styles.modalTitle}>Choose your starting plan</h2>
              <p className={styles.modalSub}>
                Select the plan that matches what you want to set up first. Monthly pricing is shown by default.
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

        <div className={styles.billingToggle}>
          <button
            type="button"
            className={`${styles.toggleOption} ${billingCycle === 'monthly' ? styles.toggleActive : ''}`}
            onClick={() => setBillingCycle('monthly')}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`${styles.toggleOption} ${billingCycle === 'annual' ? styles.toggleActive : ''}`}
            onClick={() => setBillingCycle('annual')}
          >
            Annual
          </button>
        </div>

        <div className={styles.planGrid}>
          {PLAN_ORDER.map(planKey => {
            const plan = PLAN_CONFIG[planKey];
            const isCurrent = !required && planKey === activePlanId;
            const isLowerTier = !required && !isFirstRunPlanEditable() && PLAN_ORDER.indexOf(planKey) < PLAN_ORDER.indexOf(activePlanId);
            return (
              <div key={planKey} className={`${styles.planCard} ${isCurrent ? styles.planCardCurrent : ''}`}>
                <div className={styles.planCardHeader}>
                  <h3>{plan.label}</h3>
                  {isCurrent && <span>Current</span>}
                </div>
                <div className={styles.planCardPrice}>{getPlanPrice(planKey)}</div>
                <p className={styles.planCardTagline}>{PLAN_TAGLINE[planKey]}</p>
                <ul className={styles.planFeatureList}>
                  {PLAN_FEATURES[planKey].map(feature => (
                    <li key={feature}>
                      <CheckCircle2 size={13} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`btn btn-primary ${styles.planButton}`}
                  onClick={() => choosePlan(planKey)}
                  disabled={planLoading !== null || isLowerTier}
                >
                  {planLoading === planKey ? 'Loading...' : getPlanAction(planKey)}
                </button>
              </div>
            );
          })}
        </div>

        {planError && <div className={styles.planError}>{planError}</div>}
      </div>
    );
  }

  function renderModalFrame(title: string, description: string, children: React.ReactNode, options: {
    stepId: StartupTaskId;
    saveLabel: string;
    onSave: () => void;
    taskId?: StartupActionTaskId;
    allowSkip?: boolean;
    saveDisabled?: boolean;
    hidePrimaryAction?: boolean;
  }) {
    const stepNumber = WIZARD_ORDER.indexOf(options.stepId) + 1;
    const progressWidth = `${(stepNumber / WIZARD_ORDER.length) * 100}%`;
    const previousStep = getPreviousWizardStep(options.stepId);

    return (
      <div className={styles.modalOverlay} role="presentation">
        <div className={styles.workflowModal} role="dialog" aria-modal="true" aria-labelledby="workflow-modal-title">
          <div className={styles.wizardChrome}>
            <span>Step {stepNumber}/{WIZARD_ORDER.length}</span>
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
                <button type="button" className="btn btn-ghost" onClick={() => void skipStep(options.taskId!)} disabled={stepSaving}>
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
    if (activeModal === 'plan') {
      return renderModalFrame(
        'Choose your starting plan',
        'Select the plan that matches what you want to set up first. You can come back before saving setup work.',
        renderPlanChooser(false, true),
        { stepId: 'plan', saveLabel: 'Continue', onSave: () => advanceWizard('plan'), hidePrimaryAction: true }
      );
    }

    if (activeModal === 'tournament') {
      return renderModalFrame(
        'Create your tournament',
        'Start with core tournament details. The tournament stays private as a draft.',
        (
          <>
            <div className={styles.modalGridTwo}>
              <label className={styles.fieldLabel}>
                Year
                <input className="form-input" value={tournamentForm.year} onChange={e => setTournamentForm(form => ({ ...form, year: e.target.value }))} />
              </label>
              <label className={styles.fieldLabel}>
                Tournament name
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
              <label className={styles.fieldLabel}>
                Start date
                <input
                  className="form-input"
                  type="date"
                  min={todayDate}
                  value={tournamentForm.startDate}
                  onChange={e => updateTournamentStartDate(e.target.value)}
                />
              </label>
              <label className={styles.fieldLabel}>
                End date
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

            <label className={styles.fieldLabel}>
              URL slug
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
        { stepId: 'tournament', saveLabel: 'Next', onSave: saveTournamentStep, taskId: 'tournament', allowSkip: true }
      );
    }

    if (activeModal === 'divisions') {
      return renderModalFrame(
        'Set up divisions',
        'Add the divisions teams can register for. Pools are optional and can be configured per division.',
        (
          <div className={styles.setupBlock}>
            <div className={styles.setupBlockHeader}>
              <span>Division setup</span>
              <small>Starter rows are editable.</small>
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
                <span>Capacity</span>
                <span>Pools</span>
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
                      min="1"
                      value={row.capacity}
                      onChange={e => updateDivisionRow(row.id, current => ({ ...current, capacity: Number(e.target.value) }))}
                      aria-label={`${row.name || 'Division'} capacity`}
                    />
                    <label className={styles.compactCheckbox}>
                      <input
                        type="checkbox"
                        checked={row.poolCount >= 2}
                        onChange={e => e.target.checked ? updateDivisionPools(row.id, 2) : updateDivisionPools(row.id, 0)}
                      />
                      Pools
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
                          <span>Pool count</span>
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
                          Registrant picks pool
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
                  Venue name
                  <input className="form-input" value={venueDraft.name} onChange={e => updateVenueDraft('name', e.target.value)} placeholder="Lions Field" />
                </label>
                <label className={styles.fieldLabel}>
                  Street address optional
                  <input className="form-input" value={venueDraft.street} onChange={e => updateVenueDraft('street', e.target.value)} placeholder="123 Main St" />
                </label>
                <label className={styles.fieldLabel}>
                  City optional
                  <input className="form-input" value={venueDraft.city} onChange={e => updateVenueDraft('city', e.target.value)} placeholder="Milton" />
                </label>
                <label className={styles.fieldLabel}>
                  Province optional
                  <select className="form-select" value={venueDraft.province} onChange={e => updateVenueDraft('province', e.target.value)}>
                    <option value="">Select province</option>
                    {CANADIAN_PROVINCES.map(province => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.fieldLabel}>
                  Postal code optional
                  <input className="form-input" value={venueDraft.postalCode} onChange={e => updateVenueDraft('postalCode', e.target.value.toUpperCase())} placeholder="A1A 1A1" />
                </label>
                <label className={styles.fieldLabel}>
                  Country optional
                  <input className="form-input" value={venueDraft.country} onChange={e => updateVenueDraft('country', e.target.value)} />
                </label>
                <label className={`${styles.fieldLabel} ${styles.venueNotesField}`}>
                  Notes
                  <input className="form-input" value={venueDraft.notes} onChange={e => updateVenueDraft('notes', e.target.value)} placeholder="Parking, entrance, field number" />
                </label>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={addVenueDraft}>
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
                          Venue name
                          <input className="form-input" value={row.name} onChange={e => updateVenueRow(row.id, 'name', e.target.value)} />
                        </label>
                        <label className={styles.fieldLabel}>
                          Street address optional
                          <input className="form-input" value={row.street} onChange={e => updateVenueRow(row.id, 'street', e.target.value)} />
                        </label>
                        <label className={styles.fieldLabel}>
                          City optional
                          <input className="form-input" value={row.city} onChange={e => updateVenueRow(row.id, 'city', e.target.value)} />
                        </label>
                        <label className={styles.fieldLabel}>
                          Province optional
                          <select className="form-select" value={row.province} onChange={e => updateVenueRow(row.id, 'province', e.target.value)}>
                            <option value="">Select province</option>
                            {CANADIAN_PROVINCES.map(province => (
                              <option key={province} value={province}>{province}</option>
                            ))}
                          </select>
                        </label>
                        <label className={styles.fieldLabel}>
                          Postal code optional
                          <input className="form-input" value={row.postalCode} onChange={e => updateVenueRow(row.id, 'postalCode', e.target.value.toUpperCase())} />
                        </label>
                        <label className={styles.fieldLabel}>
                          Country optional
                          <input className="form-input" value={row.country} onChange={e => updateVenueRow(row.id, 'country', e.target.value)} />
                        </label>
                        <label className={`${styles.fieldLabel} ${styles.venueNotesField}`}>
                          Notes
                          <input className="form-input" value={row.notes} onChange={e => updateVenueRow(row.id, 'notes', e.target.value)} />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ),
        { stepId: 'venues', saveLabel: 'Next', onSave: saveVenuesStep, taskId: 'venues', allowSkip: true }
      );
    }

    if (activeModal === 'contacts') {
      return renderModalFrame(
        'Add public contact',
        'This contact is used as the tournament contact email coaches can rely on.',
        (
          <div className={styles.modalGridTwo}>
            <label className={styles.fieldLabel}>
              Name
              <input className="form-input" value={contactForm.name} onChange={e => setContactForm(form => ({ ...form, name: e.target.value }))} placeholder="Jane Doe" />
            </label>
            <label className={styles.fieldLabel}>
              Role
              <input className="form-input" value={contactForm.role} onChange={e => setContactForm(form => ({ ...form, role: e.target.value }))} placeholder="Tournament Director" />
            </label>
            <label className={styles.fieldLabel}>
              Email
              <input className="form-input" type="email" value={contactForm.email} onChange={e => setContactForm(form => ({ ...form, email: e.target.value }))} placeholder="director@example.com" />
            </label>
            <label className={styles.fieldLabel}>
              Phone
              <input className="form-input" value={contactForm.phone} onChange={e => setContactForm(form => ({ ...form, phone: e.target.value }))} placeholder="Optional" />
            </label>
          </div>
        ),
        { stepId: 'contacts', saveLabel: 'Next', onSave: saveContactsStep, taskId: 'contacts', allowSkip: true }
      );
    }

    if (activeModal === 'review') {
      const divisionCount = draftSkipped.divisions ? 0 : divisionRows.filter(row => row.name.trim()).length;
      const venueCount = draftSkipped.venues ? 0 : venueRows.filter(row => hasVenueContent(row)).length;
      const welcomeIncluded = !draftSkipped.welcome && useWelcomeMsg && !!welcomeMsg.trim();
      const contactIncluded = !draftSkipped.contacts && !!contactForm.name.trim() && !!contactForm.email.trim();

      return renderModalFrame(
        draftSkipped.tournament ? 'Finish setup' : 'Review and save',
        draftSkipped.tournament
          ? 'No tournament setup will be created. You can return to this wizard from the dashboard later.'
          : 'Saving keeps the tournament hidden from the public. You can activate it later from Tournament Management.',
        draftSkipped.tournament ? (
          <div className={styles.reviewPanel}>
            <div className={styles.emptyModalState}>
              You skipped tournament creation, so no tournament, divisions, venues, or contacts will be created.
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
              <strong>{contactIncluded ? contactForm.email.trim().toLowerCase() : 'Skipped'}</strong>
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
          <h1 className={styles.title}>Choose your FieldLogicHQ plan</h1>
          <p className={styles.sub}>Pick the setup path that best matches {currentOrg.name}.</p>
        </div>

        {renderPlanChooser(true)}
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

      {isTournamentPlan && startupProgress && (
        <div className={styles.progressSummary}>
          <strong>Draft setup</strong>
          <span>saved at final review</span>
        </div>
      )}

      {isTournamentPlan && startupProgress && (
        <div className={styles.wizardLaunchCard}>
          <div className={styles.wizardLaunchIcon}>
            <Rocket size={22} />
          </div>
          <div className={styles.wizardLaunchCopy}>
            <div className={styles.stepTitle}>Startup workflow</div>
            <div className={styles.stepDesc}>
              Work through one setup step at a time. Use Next, Back, or Skip, then save everything at the final review.
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={startWizard}>
            Start setup
            <ArrowRight size={15} />
          </button>
        </div>
      )}

      {!isTournamentPlan && (
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
      )}

      <div className={styles.footer}>
        <button className="btn btn-primary" onClick={complete} disabled={completing || (isTournamentPlan && !startupProgress)}>
          {completing ? 'Loading...' : allDone ? 'Go to Dashboard' : 'Leave setup for now'}
          {!completing && <ArrowRight size={15} />}
        </button>
        {isTournamentPlan && startupProgress && !startupProgress.allFinished && (
          <p className={styles.footerHint}>
            If you leave before saving a tournament, the dashboard can offer this setup wizard again.
          </p>
        )}
      </div>

      {renderActiveModal()}
      {planChooserOpen && <div className={styles.modalOverlay} role="presentation">{renderPlanChooser(false)}</div>}
    </div>
  );
}
