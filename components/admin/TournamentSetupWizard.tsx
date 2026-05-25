'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Copy, Plus, Trash2, X } from 'lucide-react';
import styles from './TournamentSetupWizard.module.css';

const WIZARD_ORDER = ['tournament', 'divisions', 'welcome', 'venues', 'contacts', 'review'] as const;
const CANADIAN_PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];
const DIVISION_PRESETS: Record<Exclude<DivisionPreset, 'custom'>, string[]> = {
  youth: ['U9', 'U11', 'U13', 'U15', 'U17', 'U19'],
  adult: ['Open', 'Competitive', 'Recreational'],
};

type WizardStep = typeof WIZARD_ORDER[number];
type SkippableStep = Exclude<WizardStep, 'review'>;
type DivisionPreset = 'youth' | 'adult' | 'custom';

type TournamentDraft = {
  year: number;
  name: string;
  slug: string;
  startDate: string | null;
  endDate: string | null;
};

type DivisionRow = {
  id: string;
  name: string;
  minAge: string;
  maxAge: string;
  capacity: number;
  poolCount: number;
  requiresPoolSelection: boolean;
  poolNames: string[];
};

type SetupDivision = {
  name: string;
  minAge: number | null;
  maxAge: number | null;
  capacity: number;
  poolCount: number;
  poolNames: string;
  requiresPoolSelection: boolean;
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

type QueuedVenue = {
  key: string;
  name: string;
  address: string;
  notes: string;
};

type ExistingVenue = {
  id: string;
  tournamentId: string;
  tournamentName?: string | null;
  name: string;
  address?: string | null;
  notes?: string | null;
};

type ExistingTournament = {
  id: string;
  name: string;
  status?: string | null;
};

type ContactDraft = {
  name: string;
  email: string;
  phone?: string;
  role?: string;
};

type SkippedState = Record<SkippableStep, boolean>;

type CreatedTournament = {
  id: string;
  name: string;
  slug: string;
};

type PastTournament = {
  id: string;
  name: string;
  year?: number | null;
  status?: string | null;
};

/** Mode before the main wizard steps: pick clone source or start from scratch. */
type PreStepMode = 'choose' | 'clone-name';

type CloneNameForm = {
  name: string;
  slug: string;
  year: string;
  startDate: string;
  endDate: string;
  autoSlug: boolean;
};

type TournamentSetupWizardProps = {
  isOpen: boolean;
  orgSlug?: string;
  orgContactEmail?: string | null;
  /** Pass existing non-archived tournaments to enable the clone pre-step. */
  existingTournaments?: PastTournament[];
  /** Whether the org's plan includes tournament cloning. */
  canClone?: boolean;
  /** Upgrade copy shown if canClone is false. */
  upgradeCopy?: string;
  onClose: () => void;
  onCreated: (tournament: CreatedTournament) => void | Promise<void>;
};

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalizeTournamentName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function getUniqueTournamentName(baseName: string, existingNames: string[]) {
  const usedNames = new Set(existingNames.map(normalizeTournamentName));
  if (!usedNames.has(normalizeTournamentName(baseName))) return baseName;

  let suffix = 2;
  while (usedNames.has(normalizeTournamentName(`${baseName} ${suffix}`))) {
    suffix += 1;
  }
  return `${baseName} ${suffix}`;
}

function getDefaultTournamentForm(existingNames: string[] = [], year = new Date().getFullYear()) {
  const defaultName = getUniqueTournamentName(`${year} Tournament`, existingNames);
  return {
    year: String(year),
    name: defaultName,
    slug: generateSlug(defaultName),
    startDate: '',
    endDate: '',
  };
}

function getDefaultSkipped(): SkippedState {
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

function getDivisionStarterAgeRange(name: string) {
  const normalized = name.trim();
  const youthMatch = normalized.match(/^U\s*(\d{1,2})$/i) || normalized.match(/^(\d{1,2})\s*U$/i);
  if (youthMatch) return { minAge: '', maxAge: youthMatch[1] };
  if (['Open', 'Competitive', 'Recreational'].includes(normalized)) return { minAge: '18', maxAge: '' };
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
  return !!normalizeVenueFields(venue).name;
}

function formatVenueAddress(venue: VenueFields) {
  const normalized = normalizeVenueFields(venue);
  const hasAddressDetails = !!(normalized.street || normalized.city || normalized.province || normalized.postalCode);
  if (!hasAddressDetails) return '';

  const cityLine = [normalized.city, normalized.province, normalized.postalCode].filter(Boolean).join(' ');
  return [normalized.street, cityLine, normalized.country].filter(Boolean).join(', ');
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Something went wrong.');
  return data as T;
}

export default function TournamentSetupWizard({
  isOpen,
  orgSlug,
  orgContactEmail,
  existingTournaments,
  canClone,
  upgradeCopy,
  onClose,
  onCreated,
}: TournamentSetupWizardProps) {
  // ── Pre-step state (choose / clone-name) ─────────────────────────────────
  const hasPastTournaments = Boolean(existingTournaments && existingTournaments.length > 0);
  const [preStep, setPreStep] = useState<PreStepMode | null>(hasPastTournaments ? 'choose' : null);
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const [cloneSource, setCloneSource] = useState<PastTournament | null>(null);
  const [cloneNameForm, setCloneNameForm] = useState<CloneNameForm>({
    name: '', slug: '', year: String(new Date().getFullYear() + 1),
    startDate: '', endDate: '', autoSlug: true,
  });
  const [cloneWorking, setCloneWorking] = useState(false);
  const [cloneError, setCloneError] = useState('');

  // ── Main wizard state ─────────────────────────────────────────────────────
  const [activeStep, setActiveStep] = useState<WizardStep>('tournament');
  const [stepError, setStepError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [slugEdited, setSlugEdited] = useState(false);
  const [skipped, setSkipped] = useState<SkippedState>(getDefaultSkipped);
  const formTouchedRef = useRef(false);

  const [tournamentForm, setTournamentForm] = useState(getDefaultTournamentForm);
  const [divisionPreset, setDivisionPreset] = useState<DivisionPreset>('youth');
  const [divisionRows, setDivisionRows] = useState<DivisionRow[]>(() => buildDivisionRows(DIVISION_PRESETS.youth));
  const [customDivisionName, setCustomDivisionName] = useState('');
  const [useWelcomeMsg, setUseWelcomeMsg] = useState(true);
  const [welcomeMsg, setWelcomeMsg] = useState('Welcome to our tournament! We are excited to host a great event for all participating teams.');

  const [existingVenues, setExistingVenues] = useState<ExistingVenue[]>([]);
  const [existingTournamentNames, setExistingTournamentNames] = useState<string[]>([]);
  const [venueSearch, setVenueSearch] = useState('');
  const [venueSearchSelected, setVenueSearchSelected] = useState<ExistingVenue | null>(null);
  const [venueSearchOpen, setVenueSearchOpen] = useState(false);
  const [showVenueForm, setShowVenueForm] = useState(false);
  const [venueDraft, setVenueDraft] = useState<VenueFields>(buildVenueDraft);
  const [venueQueue, setVenueQueue] = useState<QueuedVenue[]>([]);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: orgContactEmail ?? '',
    phone: '',
    role: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    // Reset pre-step
    const hasPast = Boolean(existingTournaments && existingTournaments.length > 0);
    setPreStep(hasPast ? 'choose' : null);
    setCloneSource(null);
    setCloneNameForm({ name: '', slug: '', year: String(new Date().getFullYear() + 1), startDate: '', endDate: '', autoSlug: true });
    setCloneWorking(false);
    setCloneError('');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveStep('tournament');
    setStepError('');
    setSaving(false);
    setSlugEdited(false);
    formTouchedRef.current = false;
    setSkipped(getDefaultSkipped());
    setTournamentForm(getDefaultTournamentForm());
    setDivisionPreset('youth');
    setDivisionRows(buildDivisionRows(DIVISION_PRESETS.youth));
    setCustomDivisionName('');
    setUseWelcomeMsg(true);
    setWelcomeMsg('Welcome to our tournament! We are excited to host a great event for all participating teams.');
    setVenueSearch('');
    setVenueSearchSelected(null);
    setVenueSearchOpen(false);
    setShowVenueForm(false);
    setVenueDraft(buildVenueDraft());
    setVenueQueue([]);
    setCloseConfirmOpen(false);
    setDataLoading(true);
    setContactForm({ name: '', email: orgContactEmail ?? '', phone: '', role: '' });
    Promise.all([
      requestJson<ExistingVenue[]>(`/api/admin/diamonds?scope=org${orgParam}`).catch(() => []),
      requestJson<ExistingTournament[]>(`/api/admin/tournaments${orgQuery}`).catch(() => []),
    ]).then(([venues, tournaments]) => {
      setExistingVenues(venues);
      const names = tournaments
        .filter(tournament => tournament.status !== 'archived')
        .map(tournament => tournament.name)
        .filter(Boolean);
      setExistingTournamentNames(names);
      if (!formTouchedRef.current) {
        setTournamentForm(getDefaultTournamentForm(names));
      }
      setDataLoading(false);
    }).catch(() => setDataLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, orgContactEmail, existingTournaments?.length]);

  if (!isOpen) return null;

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

  function applyDivisionPreset(preset: DivisionPreset) {
    setDivisionPreset(preset);
    setCustomDivisionName('');
    setDivisionRows(preset === 'custom' ? [] : buildDivisionRows(DIVISION_PRESETS[preset]));
  }

  function addCustomDivision() {
    const name = customDivisionName.trim();
    if (!name) return;
    setDivisionRows(prev => [
      ...prev,
      {
        id: `custom-${prev.length + 1}-${generateSlug(name) || 'division'}`,
        name,
        ...getDivisionStarterAgeRange(name),
        capacity: 8,
        poolCount: 0,
        requiresPoolSelection: false,
        poolNames: ['Pool A'],
      },
    ]);
    setCustomDivisionName('');
  }

  function updateVenueDraft(field: keyof VenueFields, value: string) {
    setVenueDraft(draft => ({ ...draft, [field]: value }));
  }

  function addExistingToQueue() {
    if (!venueSearchSelected) {
      setStepError('Select a venue from the search results first.');
      return;
    }
    const key = `existing-${venueSearchSelected.id}`;
    if (venueQueue.some(q => q.key === key)) {
      setStepError('This venue has already been added.');
      return;
    }
    setVenueQueue(prev => [...prev, {
      key,
      name: venueSearchSelected.name,
      address: venueSearchSelected.address || '',
      notes: venueSearchSelected.notes || '',
    }]);
    setVenueSearch('');
    setVenueSearchSelected(null);
    setVenueSearchOpen(false);
    setStepError('');
  }

  function createNewVenue() {
    if (!isVenueReady(venueDraft)) {
      setStepError('Add a venue name before creating it.');
      return;
    }
    const normalized = normalizeVenueFields(venueDraft);
    setVenueQueue(prev => [...prev, {
      key: `new-${Date.now()}`,
      name: normalized.name,
      address: formatVenueAddress(normalized),
      notes: normalized.notes,
    }]);
    setVenueDraft(buildVenueDraft());
    setShowVenueForm(false);
    setStepError('');
  }

  function getTournamentDraft(): TournamentDraft {
    const slug = tournamentForm.slug || generateSlug(tournamentForm.name);
    const year = Number(tournamentForm.year);
    const name = tournamentForm.name.trim();

    if (!Number.isInteger(year) || year < 1900) throw new Error('Enter a valid tournament year.');
    if (!name) throw new Error('Enter a tournament name before continuing.');
    if (existingTournamentNames.some(existingName => normalizeTournamentName(existingName) === normalizeTournamentName(name))) {
      throw new Error(`A tournament named "${name}" already exists. Use a different name, such as "${getUniqueTournamentName(name, existingTournamentNames)}".`);
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Use a valid public link before continuing.');
    if (tournamentForm.endDate && !tournamentForm.startDate) throw new Error('Choose a start date before setting an end date.');
    if (tournamentForm.startDate && tournamentForm.startDate < getTodayDateValue()) throw new Error('Start date cannot be before today.');
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

  function getDivisionDraftRows(): SetupDivision[] {
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
    if (showVenueForm && hasVenueContent(venueDraft)) {
      throw new Error('Click "Create" before continuing, or clear the venue form.');
    }
    return venueQueue;
  }

  function getContactDraft(): ContactDraft {
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

  function getNextStep(step: WizardStep) {
    const index = WIZARD_ORDER.indexOf(step);
    return WIZARD_ORDER[index + 1] ?? null;
  }

  function getPreviousStep(step: WizardStep) {
    const index = WIZARD_ORDER.indexOf(step);
    return WIZARD_ORDER[index - 1] ?? null;
  }

  function advance(step: WizardStep) {
    const next = getNextStep(step);
    if (next) setActiveStep(next);
  }

  function markFormTouched() {
    formTouchedRef.current = true;
  }

  function requestClose() {
    // 'choose' screen has no data entered yet — close immediately
    if (preStep === 'choose') { onClose(); return; }
    // 'clone-name' screen has a source picked — confirm before leaving
    if (preStep === 'clone-name') { setCloseConfirmOpen(true); return; }
    const setupStarted = formTouchedRef.current || activeStep !== 'tournament';
    if (setupStarted) {
      setCloseConfirmOpen(true);
      return;
    }
    onClose();
  }

  function validateAndAdvance(step: WizardStep) {
    try {
      if (step === 'tournament') {
        const draft = getTournamentDraft();
        setTournamentForm(form => ({ ...form, slug: draft.slug }));
        setSkipped(prev => ({ ...prev, tournament: false }));
      }
      if (step === 'divisions') {
        getDivisionDraftRows();
        setSkipped(prev => ({ ...prev, divisions: false }));
      }
      if (step === 'welcome') {
        if (useWelcomeMsg && !welcomeMsg.trim()) throw new Error('Add welcome message text, or skip this step.');
        setSkipped(prev => ({ ...prev, welcome: !useWelcomeMsg }));
      }
      if (step === 'venues') {
        getVenueDraftRows();
        if (venueQueue.length === 0) throw new Error('Select or add at least one venue, or skip this step.');
        setSkipped(prev => ({ ...prev, venues: false }));
      }
      if (step === 'contacts') {
        getContactDraft();
        setSkipped(prev => ({ ...prev, contacts: false }));
      }
      setStepError('');
      advance(step);
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Unable to continue.');
    }
  }

  function skipStep(step: SkippableStep) {
    if (step === 'tournament') {
      setSkipped({
        tournament: true,
        divisions: true,
        welcome: true,
        venues: true,
        contacts: true,
      });
      setActiveStep('review');
      return;
    }

    setSkipped(prev => ({ ...prev, [step]: true }));
    setStepError('');
    const next = getNextStep(step);
    if (next) setActiveStep(next);
  }

  async function saveSetupDraft() {
    setStepError('');
    setSaving(true);

    try {
      if (skipped.tournament) {
        onClose();
        return;
      }

      const tournament = getTournamentDraft();
      const divisions = skipped.divisions ? [] : getDivisionDraftRows();
      const announcement = !skipped.welcome && useWelcomeMsg ? { body: welcomeMsg.trim() } : null;
      const allVenues = skipped.venues ? [] : venueQueue;
      const contact = skipped.contacts ? null : getContactDraft();

      const created = await requestJson<CreatedTournament & { success: boolean }>(`/api/admin/setup-tournament${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament,
          divisions,
          announcement,
          migration: null,
        }),
      });

      await Promise.all([
        ...allVenues.map(row => requestJson<{ success: boolean }>(`/api/admin/diamonds${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save',
            data: {
              tournamentId: created.id,
              name: row.name,
              address: row.address || '',
              notes: row.notes || undefined,
            },
          }),
        })),
      ]);

      if (contact) {
        await requestJson<{ success: boolean }>(`/api/admin/contacts${orgQuery}`, {
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

        await requestJson<{ success: boolean }>(`/api/admin/tournaments${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'set-contact-email',
            id: created.id,
            data: { contactEmail: contact.email },
          }),
        });
      }

      await onCreated({ id: created.id, name: created.name, slug: created.slug });
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Unable to save setup.');
    } finally {
      setSaving(false);
    }
  }

  function renderFrame(title: string, description: string, children: React.ReactNode, options: {
    step: WizardStep;
    saveLabel: string;
    onSave: () => void;
    allowSkip?: boolean;
    hideBack?: boolean;
  }) {
    const stepNumber = WIZARD_ORDER.indexOf(options.step) + 1;
    const previousStep = getPreviousStep(options.step);
    const progressWidth = `${(stepNumber / WIZARD_ORDER.length) * 100}%`;

    return (
      <div className={styles.modalOverlay} role="presentation">
        {closeConfirmOpen && (
          <div className={styles.modalOverlay} style={{ zIndex: 10 }}>
            <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Leave setup?</h3>
              </div>
              <p style={{ color: 'var(--white-60)', marginBottom: '0.5rem' }}>Your progress will not be saved.</p>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setCloseConfirmOpen(false)}>Keep working</button>
                <button className="btn btn-danger" onClick={() => { setCloseConfirmOpen(false); onClose(); }}>Leave</button>
              </div>
            </div>
          </div>
        )}
        <div className={styles.workflowModal} role="dialog" aria-modal="true" aria-labelledby="tournament-setup-title">
          <div className={styles.wizardChrome}>
            <span>Step {stepNumber}/{WIZARD_ORDER.length}</span>
            <div className={styles.wizardProgressBar} aria-hidden="true">
              <span style={{ width: progressWidth }} />
            </div>
          </div>

          <div className={styles.modalHeader}>
            <div>
              <h2 id="tournament-setup-title" className={styles.modalTitle}>{title}</h2>
              <p className={styles.modalSub}>{description}</p>
            </div>
            <button type="button" className={styles.modalClose} onClick={requestClose} aria-label="Close setup modal">
              <X size={18} />
            </button>
          </div>

          <div key={options.step} className={styles.workflowSlide}>
            <div className={styles.workflowModalBody}>{children}</div>
          </div>

          {stepError && (
            <div className={styles.planError}>
              <AlertCircle size={14} />
              {stepError}
            </div>
          )}

          <div className={styles.workflowModalFooter}>
            <div>
              {!options.hideBack && (
                <button type="button" className="btn btn-ghost" onClick={() => previousStep && setActiveStep(previousStep)} disabled={saving || !previousStep}>
                  Back
                </button>
              )}
            </div>
            <div className={styles.workflowFooterActions}>
              {options.allowSkip && (
                <button type="button" className="btn btn-ghost" onClick={() => skipStep(options.step as SkippableStep)} disabled={saving}>
                  Skip
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={options.onSave} disabled={saving || (options.step === 'tournament' && dataLoading)}>
                {saving ? 'Saving...' : (options.step === 'tournament' && dataLoading) ? 'Loading…' : options.saveLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PRE-STEP: CHOOSE ──────────────────────────────────────────────────────
  if (preStep === 'choose') {
    const sorted = [...(existingTournaments ?? [])].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    return (
      <div className={styles.modalOverlay} role="presentation">
        {closeConfirmOpen && (
          <div className={styles.modalOverlay} style={{ zIndex: 10 }}>
            <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header"><h3>Leave setup?</h3></div>
              <p style={{ color: 'var(--white-60)', marginBottom: '0.5rem' }}>Your progress will not be saved.</p>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setCloseConfirmOpen(false)}>Keep working</button>
                <button className="btn btn-danger" onClick={() => { setCloseConfirmOpen(false); onClose(); }}>Leave</button>
              </div>
            </div>
          </div>
        )}
        <div className={styles.workflowModal} role="dialog" aria-modal="true">
          <div className={styles.modalHeader}>
            <div>
              <h2 className={styles.modalTitle}>New Tournament</h2>
              <p className={styles.modalSub}>How do you want to set up this tournament?</p>
            </div>
            <button type="button" className={styles.modalClose} onClick={requestClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className={styles.workflowModalBody}>
            {/* Clone option */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Copy size={15} style={{ color: 'var(--logic-lime)' }} />
                <strong style={{ fontSize: '0.9rem' }}>Clone a past tournament</strong>
                {!canClone && upgradeCopy && (
                  <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Tournament Plus</span>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--white-50)', marginBottom: '0.85rem', lineHeight: 1.5 }}>
                Copy divisions, venues, contacts, branding, and fees from an existing tournament into this one.
              </p>
              {!canClone && upgradeCopy ? (
                <div className="alert alert-warning" style={{ margin: 0, fontSize: '0.82rem' }}>{upgradeCopy}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {sorted.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        const nextYear = (t.year ?? new Date().getFullYear()) + 1;
                        const defaultName = `${t.name} ${nextYear}`;
                        setCloneSource(t);
                        setCloneNameForm({
                          name: defaultName,
                          slug: generateSlug(defaultName),
                          year: String(nextYear),
                          startDate: '',
                          endDate: '',
                          autoSlug: true,
                        });
                        setCloneError('');
                        setPreStep('clone-name');
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.65rem 0.9rem',
                        border: '1px solid var(--border-2)',
                        borderRadius: '2px',
                        background: 'var(--surface-1, var(--white-03))',
                        cursor: 'pointer', textAlign: 'left', color: 'inherit',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--logic-lime)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-2)')}
                    >
                      <span>
                        <span style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem' }}>{t.name}</span>
                        {t.year && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--white-40)' }}>{t.year} · {t.status ?? 'tournament'}</span>}
                      </span>
                      <ArrowRight size={14} style={{ color: 'var(--logic-lime)', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border-2)' }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--white-30)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border-2)' }} />
            </div>
          </div>

          <div className={styles.workflowModalFooter}>
            <div />
            <div className={styles.workflowFooterActions}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { setPreStep(null); }}
              >
                Start from scratch
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PRE-STEP: CLONE NAME ──────────────────────────────────────────────────
  if (preStep === 'clone-name') {
    async function submitClone() {
      if (!cloneSource) return;
      const name = cloneNameForm.name.trim();
      const slug = cloneNameForm.slug.trim();
      const year = Number(cloneNameForm.year);
      if (!name) { setCloneError('Enter a tournament name.'); return; }
      if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { setCloneError('Enter a valid URL slug (lowercase letters, numbers, hyphens).'); return; }
      if (!Number.isInteger(year) || year < 2000 || year > 2100) { setCloneError('Enter a valid year.'); return; }
      if (cloneNameForm.startDate && cloneNameForm.startDate < getTodayDateValue()) { setCloneError('Start date cannot be before today.'); return; }

      setCloneWorking(true);
      setCloneError('');
      try {
        const res = await fetch(`/api/admin/tournaments/${encodeURIComponent(cloneSource.id)}/clone${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name, slug, year,
            startDate: cloneNameForm.startDate || null,
            endDate: cloneNameForm.endDate || null,
            options: {
              includeDivisions: true, includePools: true, includeSlots: true,
              includeVenues: true, includeBranding: true,
              includePublicPages: true, includeWelcome: true, includeRulesResources: true,
              includeRegistrationFields: true, includeFeeSchedule: true,
            },
          }),
        });
        const data = await res.json() as { tournament?: { id: string; name: string; slug: string }; error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Clone failed.');
        if (!data.tournament) throw new Error('No tournament returned.');
        await onCreated({ id: data.tournament.id, name: data.tournament.name, slug: data.tournament.slug });
      } catch (err) {
        setCloneError(err instanceof Error ? err.message : 'Unable to clone tournament.');
      } finally {
        setCloneWorking(false);
      }
    }

    return (
      <div className={styles.modalOverlay} role="presentation">
        {closeConfirmOpen && (
          <div className={styles.modalOverlay} style={{ zIndex: 10 }}>
            <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header"><h3>Leave setup?</h3></div>
              <p style={{ color: 'var(--white-60)', marginBottom: '0.5rem' }}>Your progress will not be saved.</p>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setCloseConfirmOpen(false)}>Keep working</button>
                <button className="btn btn-danger" onClick={() => { setCloseConfirmOpen(false); onClose(); }}>Leave</button>
              </div>
            </div>
          </div>
        )}
        <div className={styles.workflowModal} role="dialog" aria-modal="true">
          <div className={styles.modalHeader}>
            <div>
              <h2 className={styles.modalTitle}>Clone from {cloneSource?.name}</h2>
              <p className={styles.modalSub}>Name and date your new tournament. Everything else comes from the clone.</p>
            </div>
            <button type="button" className={styles.modalClose} onClick={requestClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className={styles.workflowModalBody}>
            <div className={styles.modalGridTwo}>
              <label className={styles.fieldLabel}>
                Tournament name *
                <input
                  className="form-input"
                  value={cloneNameForm.name}
                  onChange={e => {
                    const name = e.target.value;
                    setCloneNameForm(f => ({
                      ...f, name,
                      ...(f.autoSlug ? { slug: generateSlug(name) } : {}),
                    }));
                  }}
                  placeholder="e.g. Spring Classic 2027"
                />
              </label>
              <label className={styles.fieldLabel}>
                Year *
                <input
                  className="form-input"
                  type="number"
                  min="2000"
                  max="2100"
                  value={cloneNameForm.year}
                  onChange={e => setCloneNameForm(f => ({ ...f, year: e.target.value }))}
                />
              </label>
              <label className={styles.fieldLabel}>
                Public link *
                <input
                  className="form-input"
                  value={cloneNameForm.slug}
                  onChange={e => setCloneNameForm(f => ({
                    ...f,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'),
                    autoSlug: false,
                  }))}
                  placeholder="spring-classic-2027"
                />
              </label>
              <label className={styles.fieldLabel}>
                Start date <span style={{ fontWeight: 400, color: 'var(--white-40)' }}>optional</span>
                <input
                  className="form-input"
                  type="date"
                  value={cloneNameForm.startDate}
                  min={getTodayDateValue()}
                  onChange={e => setCloneNameForm(f => ({
                    ...f,
                    startDate: e.target.value,
                    endDate: e.target.value ? addDaysToDateValue(e.target.value, 2) : '',
                  }))}
                />
              </label>
              <label className={styles.fieldLabel}>
                End date <span style={{ fontWeight: 400, color: 'var(--white-40)' }}>optional</span>
                <input
                  className="form-input"
                  type="date"
                  value={cloneNameForm.endDate}
                  min={cloneNameForm.startDate || getTodayDateValue()}
                  onChange={e => setCloneNameForm(f => ({ ...f, endDate: e.target.value }))}
                />
              </label>
            </div>

            <div className="alert alert-info" style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
              Divisions, venues, contacts, branding, fees, and rules will be copied from <strong>{cloneSource?.name}</strong>. Registrations and scores are never copied.
            </div>

            {cloneError && (
              <div className={styles.planError} style={{ marginTop: '0.75rem' }}>
                <AlertCircle size={14} /> {cloneError}
              </div>
            )}
          </div>

          <div className={styles.workflowModalFooter}>
            <div>
              <button type="button" className="btn btn-ghost" onClick={() => { setPreStep('choose'); setCloneError(''); }} disabled={cloneWorking}>
                Back
              </button>
            </div>
            <div className={styles.workflowFooterActions}>
              <button type="button" className="btn btn-primary" onClick={submitClone} disabled={cloneWorking}>
                {cloneWorking ? 'Creating clone…' : 'Create clone'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeStep === 'tournament') {
    return renderFrame(
      'Create your tournament',
      'Start with core tournament details. The tournament stays private as a draft.',
      (
        <div className={styles.modalGridTwo}>
          <label className={styles.fieldLabel}>
            Tournament year
            <input
              className="form-input"
              type="number"
              min="2000"
              max="2100"
              value={tournamentForm.year}
              onChange={e => {
                markFormTouched();
                const year = e.target.value;
                setTournamentForm(form => {
                  const name = /^\d{4} Tournament(?: \d+)?$/.test(form.name)
                    ? getUniqueTournamentName(`${year} Tournament`, existingTournamentNames)
                    : form.name;
                  return { ...form, year, name, ...(!slugEdited ? { slug: generateSlug(name) } : {}) };
                });
              }}
            />
          </label>
          <label className={styles.fieldLabel}>
            Tournament name
            <input
              className="form-input"
              value={tournamentForm.name}
              onChange={e => {
                markFormTouched();
                const name = e.target.value;
                setTournamentForm(form => ({ ...form, name, ...(!slugEdited ? { slug: generateSlug(name) } : {}) }));
              }}
              placeholder="e.g. Spring Classic 2026"
            />
          </label>
          <label className={styles.fieldLabel}>
            Start date optional
            <input className="form-input" type="date" value={tournamentForm.startDate} min={getTodayDateValue()} onChange={e => { markFormTouched(); updateTournamentStartDate(e.target.value); }} />
          </label>
          <label className={styles.fieldLabel}>
            End date optional
            <input className="form-input" type="date" value={tournamentForm.endDate} min={tournamentForm.startDate || getTodayDateValue()} onChange={e => { markFormTouched(); updateTournamentEndDate(e.target.value); }} />
          </label>
          <label className={styles.fieldLabel}>
            Public link
            <input
              className="form-input"
              value={tournamentForm.slug}
              onChange={e => {
                markFormTouched();
                setSlugEdited(true);
                setTournamentForm(form => ({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') }));
              }}
              placeholder="spring-classic-2026"
            />
          </label>
        </div>
      ),
      { step: 'tournament', saveLabel: 'Next', onSave: () => validateAndAdvance('tournament'), hideBack: true },
    );
  }

  if (activeStep === 'divisions') {
    return renderFrame(
      'Set up divisions',
      'Add the divisions or divisions teams can register for. Pools are optional and can be configured per division.',
      (
        <div className={styles.setupBlock}>
          <div className={styles.setupBlockHeader}>
            <span>Division starter</span>
            <small>Rename or remove anything you do not need.</small>
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
              onChange={e => setCustomDivisionName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomDivision();
                }
              }}
              placeholder="Add a division, e.g. 12U, Open, Varsity"
            />
            <button type="button" className="btn btn-outline btn-sm" onClick={addCustomDivision}>
              <Plus size={14} /> Add
            </button>
          </div>
          {divisionRows.length > 0 && (
            <div className={styles.divisionHeaderRow}>
              <span>Division</span>
              <span>Min age</span>
              <span>Max age</span>
              <span>Max teams</span>
              <span>Pools</span>
              <span />
            </div>
          )}
          <div className={styles.inlineList}>
            {divisionRows.map(row => (
              <div key={row.id} className={styles.divisionInlineShell}>
                <div className={styles.divisionInlineRow}>
                  <input className="form-input" value={row.name} onChange={e => updateDivisionRow(row.id, current => ({ ...current, name: e.target.value }))} placeholder="Division name" />
                  <input className="form-input" type="number" min="0" value={row.minAge} onChange={e => updateDivisionRow(row.id, current => ({ ...current, minAge: e.target.value }))} placeholder="Any" />
                  <input className="form-input" type="number" min="0" value={row.maxAge} onChange={e => updateDivisionRow(row.id, current => ({ ...current, maxAge: e.target.value }))} placeholder="Any" />
                  <input className="form-input" type="number" min="1" value={row.capacity} onChange={e => updateDivisionRow(row.id, current => ({ ...current, capacity: Number(e.target.value) }))} />
                  <label className={styles.compactCheckbox}>
                    <input
                      type="checkbox"
                      checked={row.poolCount >= 2}
                      onChange={e => updateDivisionRow(row.id, current => ({
                        ...current,
                        poolCount: e.target.checked ? 2 : 0,
                        poolNames: e.target.checked ? ['Pool A', 'Pool B'] : ['Pool A'],
                        requiresPoolSelection: e.target.checked ? current.requiresPoolSelection : false,
                      }))}
                    />
                    Use pools
                  </label>
                  <button type="button" className={styles.iconOnlyButton} onClick={() => setDivisionRows(prev => prev.filter(item => item.id !== row.id))} aria-label={`Remove ${row.name || 'division'}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
                {row.poolCount >= 2 && (
                  <div className={styles.poolSetupPanel}>
                    <div className={styles.poolControlsRow}>
                      <label className={styles.poolMiniField}>
                        Pool count
                        <input className="form-input" type="number" min="2" max="4" value={row.poolCount} onChange={e => updateDivisionPools(row.id, Number(e.target.value))} />
                      </label>
                      <label className={styles.compactCheckbox}>
                        <input type="checkbox" checked={row.requiresPoolSelection} onChange={e => updateDivisionRow(row.id, current => ({ ...current, requiresPoolSelection: e.target.checked }))} />
                        Registrant picks pool
                      </label>
                    </div>
                    <div className={styles.poolNameGrid}>
                      {Array.from({ length: row.poolCount }).map((_, i) => (
                        <label key={`${row.id}-pool-${i}`} className={styles.poolNameField}>
                          {String.fromCharCode(65 + i)} Name
                          <input className="form-input" value={row.poolNames[i] || ''} onChange={e => updateDivisionPoolName(row.id, i, e.target.value)} placeholder="e.g. Gold" />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {divisionRows.length === 0 && <div className={styles.emptyModalState}>Add at least one division to continue.</div>}
          </div>
        </div>
      ),
      { step: 'divisions', saveLabel: 'Next', onSave: () => validateAndAdvance('divisions'), allowSkip: true },
    );
  }

  if (activeStep === 'welcome') {
    return renderFrame(
      'Create welcome message',
      'Publish an optional pinned welcome note for teams and coaches on the tournament news page.',
      (
        <div className={styles.inlineList}>
          <label className={styles.checkboxLine}>
            <input type="checkbox" checked={useWelcomeMsg} onChange={e => setUseWelcomeMsg(e.target.checked)} />
            Publish a welcome announcement
          </label>
          {useWelcomeMsg && <textarea className="form-textarea" rows={4} value={welcomeMsg} onChange={e => setWelcomeMsg(e.target.value)} />}
        </div>
      ),
      { step: 'welcome', saveLabel: 'Next', onSave: () => validateAndAdvance('welcome'), allowSkip: true },
    );
  }

  if (activeStep === 'venues') {
    const venueSearchQuery = venueSearch.trim().toLowerCase();
    const filteredVenues = venueSearchQuery
      ? existingVenues.filter(v =>
          v.name.toLowerCase().includes(venueSearchQuery) ||
          (v.address && v.address.toLowerCase().includes(venueSearchQuery))
        )
      : existingVenues;

    return renderFrame(
      'Add venues',
      'Search for a venue you\'ve used before, or create a new one.',
      (
        <div className={styles.inlineList}>
          {existingVenues.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  className="form-input"
                  placeholder="Search by name or address…"
                  value={venueSearch}
                  onChange={e => {
                    setVenueSearch(e.target.value);
                    setVenueSearchSelected(null);
                    setVenueSearchOpen(true);
                    setStepError('');
                  }}
                  onFocus={() => setVenueSearchOpen(true)}
                  onBlur={() => setTimeout(() => setVenueSearchOpen(false), 150)}
                  autoComplete="off"
                />
                {venueSearchOpen && filteredVenues.length > 0 && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                    background: 'var(--surface-2, #1e1e2e)',
                    border: '1px solid var(--border, var(--white-10))',
                    borderRadius: '2px', zIndex: 50,
                    maxHeight: '200px', overflowY: 'auto',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  }}>
                    {filteredVenues.map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setVenueSearchSelected(v);
                          setVenueSearch(v.name);
                          setVenueSearchOpen(false);
                          setStepError('');
                        }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '0.5rem 0.75rem', background: 'none', border: 'none',
                          cursor: 'pointer', borderBottom: '1px solid var(--border, var(--white-8))',
                          color: 'inherit',
                        }}
                      >
                        <span style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem' }}>{v.name}</span>
                        {v.address && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--white-40, var(--white-40))' }}>{v.address}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={addExistingToQueue} style={{ whiteSpace: 'nowrap', marginTop: '1px' }}>
                Add
              </button>
            </div>
          )}

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => { setShowVenueForm(f => !f); setVenueDraft(buildVenueDraft()); setStepError(''); }}
          >
            <Plus size={14} /> {showVenueForm ? 'Cancel' : 'Create venue'}
          </button>

          {showVenueForm && (
            <div className={styles.venueComposer}>
              <div className={styles.venueDraftGrid}>
                <label className={styles.fieldLabel}>Venue name *<input className="form-input" value={venueDraft.name} onChange={e => updateVenueDraft('name', e.target.value)} placeholder="Lions Field" /></label>
                <label className={styles.fieldLabel}>Street address<input className="form-input" value={venueDraft.street} onChange={e => updateVenueDraft('street', e.target.value)} placeholder="123 Main St" /></label>
                <label className={styles.fieldLabel}>City<input className="form-input" value={venueDraft.city} onChange={e => updateVenueDraft('city', e.target.value)} placeholder="Milton" /></label>
                <label className={styles.fieldLabel}>
                  Province
                  <select className="form-select" value={venueDraft.province} onChange={e => updateVenueDraft('province', e.target.value)}>
                    <option value="">Select province</option>
                    {CANADIAN_PROVINCES.map(province => <option key={province} value={province}>{province}</option>)}
                  </select>
                </label>
                <label className={styles.fieldLabel}>Postal code<input className="form-input" value={venueDraft.postalCode} onChange={e => updateVenueDraft('postalCode', e.target.value.toUpperCase())} placeholder="A1A 1A1" /></label>
                <label className={`${styles.fieldLabel} ${styles.venueNotesField}`}>Notes<input className="form-input" value={venueDraft.notes} onChange={e => updateVenueDraft('notes', e.target.value)} placeholder="Parking, entrance, field number" /></label>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={createNewVenue}>
                <Plus size={14} /> Create
              </button>
            </div>
          )}

          {venueQueue.length > 0 && (
            <div className={styles.venueList}>
              {venueQueue.map(item => (
                <div key={item.key} className={styles.venueCard} style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem' }}>{item.name}</span>
                    {item.address && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--white-40, var(--white-40))' }}>{item.address}</span>}
                  </div>
                  <button type="button" className={styles.iconOnlyButton} onClick={() => setVenueQueue(prev => prev.filter(q => q.key !== item.key))} aria-label={`Remove ${item.name}`} style={{ flexShrink: 0 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
      { step: 'venues', saveLabel: 'Next', onSave: () => validateAndAdvance('venues'), allowSkip: true },
    );
  }

  if (activeStep === 'contacts') {
    return renderFrame(
      'Add public contact',
      'This contact is used as the tournament contact email coaches can rely on.',
      (
        <div className={styles.modalGridTwo}>
          <label className={styles.fieldLabel}>Name *<input className="form-input" value={contactForm.name} onChange={e => setContactForm(form => ({ ...form, name: e.target.value }))} placeholder="Jane Doe" /></label>
          <label className={styles.fieldLabel}>Role<input className="form-input" value={contactForm.role} onChange={e => setContactForm(form => ({ ...form, role: e.target.value }))} placeholder="Tournament Director" /></label>
          <label className={styles.fieldLabel}>Email *<input className="form-input" type="email" value={contactForm.email} onChange={e => setContactForm(form => ({ ...form, email: e.target.value }))} placeholder="director@example.com" /></label>
          <label className={styles.fieldLabel}>Phone<input className="form-input" value={contactForm.phone} onChange={e => setContactForm(form => ({ ...form, phone: e.target.value }))} placeholder="Optional" /></label>
        </div>
      ),
      { step: 'contacts', saveLabel: 'Next', onSave: () => validateAndAdvance('contacts'), allowSkip: true },
    );
  }

  const divisionCount = skipped.divisions ? 0 : divisionRows.filter(row => row.name.trim()).length;
  const venueCount = skipped.venues ? 0 : venueQueue.length;
  const welcomeIncluded = !skipped.welcome && useWelcomeMsg && !!welcomeMsg.trim();
  const contactIncluded = !skipped.contacts && !!contactForm.name.trim() && !!contactForm.email.trim();

  return renderFrame(
    skipped.tournament ? 'Finish setup' : 'Review and save',
    skipped.tournament
      ? 'No tournament setup will be created.'
      : 'Saving keeps the tournament hidden from the public. You can activate it later from Manage Tournaments.',
    skipped.tournament ? (
      <div className={styles.reviewPanel}>
        <div className={styles.emptyModalState}>You skipped tournament creation, so no tournament, divisions, venues, or contacts will be created.</div>
      </div>
    ) : (
      <div className={styles.reviewPanel}>
        <div className={styles.reviewItem}><span>Tournament</span><strong>{tournamentForm.name.trim() || 'Not named yet'}</strong></div>
        <div className={styles.reviewItem}><span>Divisions</span><strong>{divisionCount > 0 ? `${divisionCount} included` : 'Skipped'}</strong></div>
        <div className={styles.reviewItem}><span>Welcome message</span><strong>{welcomeIncluded ? 'Included' : 'Skipped'}</strong></div>
        <div className={styles.reviewItem}><span>Venues</span><strong>{venueCount > 0 ? `${venueCount} included` : 'Skipped'}</strong></div>
        <div className={styles.reviewItem}><span>Public contact</span><strong>{contactIncluded ? contactForm.email.trim().toLowerCase() : 'Skipped'}</strong></div>
        <div className={styles.reviewItem}><span>Public visibility</span><strong>Not live yet</strong></div>
        <div className={styles.emptyModalState}>
          After saving, only admins can work on this tournament. Registration stays closed and the public page is not live until you activate it.
        </div>
      </div>
    ),
    { step: 'review', saveLabel: skipped.tournament ? 'Finish for now' : 'Save setup', onSave: saveSetupDraft },
  );
}
