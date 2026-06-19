'use client';
import { useState, useEffect, use, useCallback, type CSSProperties } from 'react';
import { RefreshCw, Plus, Check, X, Trash2, Pencil, ExternalLink, ChevronDown, ChevronUp, HelpCircle, Copy } from 'lucide-react';
import Link from 'next/link';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { Tournament, TournamentStatus, TournamentArchive, CloneCopiedCounts } from '@/lib/types';
import { DEFAULT_SPORT } from '@/lib/sports';
import { copiedSummary } from '@/lib/utils';

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

async function getAdminArchives(orgSlug?: string): Promise<TournamentArchive[]> {
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const res = await fetch(`/api/admin/tournament-archives${orgQuery}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function getErrorMessage(error: unknown, fallback = 'Something went wrong.') {
  return error instanceof Error ? error.message : fallback;
}
import FeedbackModal from '@/components/FeedbackModal';
import HelpCallout from '@/components/help/HelpCallout';
import TournamentSetupWizard from '@/components/admin/TournamentSetupWizard';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import styles from './tournaments-admin.module.css';

type ModalMode = 'add' | 'edit' | null;
type DivisionPreset = 'youth' | 'adult' | 'custom';
type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

type CreatedTournamentNotice = {
  name: string;
  slug: string;
  creationMethod?: 'blank' | 'reused_setup';
  sourceName?: string;
  copied?: CloneCopiedCounts;
};

type DivisionRow = {
  id: string;
  name: string;
  enabled: boolean;
  capacity: number;
  poolCount: number;
  requiresPoolSelection: boolean;
  poolNames: string[];
};

type AdminTournamentRow = {
  id: string;
  org_id?: string | null;
  year: number;
  name: string;
  slug?: string | null;
  status?: TournamentStatus | null;
  is_active?: boolean | null;
  start_date?: string | null;
  end_date?: string | null;
  sport?: string | null;
  contact_email?: string | null;
  fee_schedule_mode?: string | null;
  deposit_amount?: number | null;
  deposit_due_date?: string | null;
  total_fee_amount?: number | null;
  total_fee_due_date?: string | null;
};

const DIVISION_PRESETS: Record<Exclude<DivisionPreset, 'custom'>, string[]> = {
  youth: ['U9', 'U11', 'U13', 'U15', 'U17', 'U19'],
  adult: ['Open', 'Competitive', 'Recreational'],
};

function mapAdminTournament(row: AdminTournamentRow): Tournament {
  const status: TournamentStatus = row.status ?? (row.is_active ? 'active' : 'draft');
  return {
    id: row.id,
    organizationId: row.org_id ?? undefined,
    year: row.year,
    name: row.name,
    slug: row.slug ?? '',
    sport: row.sport ?? DEFAULT_SPORT,
    status,
    isActive: status === 'active',
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    feeScheduleMode: (row.fee_schedule_mode as 'tournament' | 'division') ?? 'tournament',
    depositAmount: row.deposit_amount ?? null,
    depositDueDate: row.deposit_due_date ?? null,
    totalFeeAmount: row.total_fee_amount ?? null,
    totalFeeDueDate: row.total_fee_due_date ?? null,
  };
}

async function getAdminTournaments(orgSlug?: string): Promise<Tournament[]> {
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const res = await fetch(`/api/admin/tournaments${orgQuery}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map(row => mapAdminTournament(row as AdminTournamentRow));
}

function buildDivisionRows(names: string[]): DivisionRow[] {
  return names.map((name, index) => ({
    id: `${generateSlug(name) || 'division'}-${index + 1}`,
    name,
    enabled: true,
    capacity: 8,
    poolCount: 0,
    requiresPoolSelection: false,
    poolNames: ['Pool A'],
  }));
}

export default function AdminTournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string | string[] }>;
}) {
  const resolvedSearchParams = use(searchParams);
  const createValue = resolvedSearchParams.create;
  const createOnLoad = createValue === '1' || (Array.isArray(createValue) && createValue.includes('1'));
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [modal, setModal]       = useState<ModalMode>(null);
  const [setupWizardOpen, setSetupWizardOpen] = useState(createOnLoad);
  const [selectedReuseSourceId, setSelectedReuseSourceId] = useState<string | null>(null);
  const [setupWizardSurface, setSetupWizardSurface] = useState<'manage_tournaments_new_button' | 'manage_tournaments_row'>('manage_tournaments_new_button');
  const [editing, setEditing]   = useState<Tournament | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sealedTournamentIds, setSealedTournamentIds] = useState<Set<string>>(new Set());
  const [showLifecycle, setShowLifecycle] = useState(false);
  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'primary' | 'danger' | 'warning' | 'success' | 'info';
    confirmText?: string;
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'warning' });
  const [form, setForm]         = useState(() => createOnLoad ? getDefaultTournamentForm() : {
    year: String(new Date().getFullYear()),
    name: '',
    slug: '',
    startDate: '',
    endDate: '',
  });
  const [feeForm, setFeeForm] = useState({
    feeScheduleMode: 'tournament' as 'tournament' | 'division',
    depositAmount: '',
    depositDueDate: '',
    totalFeeAmount: '',
    totalFeeDueDate: '',
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [slugMessage, setSlugMessage] = useState('');
  const [createdTournament, setCreatedTournament] = useState<CreatedTournamentNotice | null>(null);
  const { refresh: refreshCtx } = useTournament();
  const { currentOrg } = useOrg();

  const [divisionPreset, setDivisionPreset] = useState<DivisionPreset>('youth');
  const [customDivisionName, setCustomDivisionName] = useState('');
  const [divisionRows, setDivisionRows] = useState<DivisionRow[]>(() => buildDivisionRows(DIVISION_PRESETS.youth));
  const [useWelcomeMsg, setUseWelcomeMsg]           = useState(true);
  const [welcomeMsg, setWelcomeMsg]                 = useState('Welcome to our tournament! We are excited to host a great event for all participating teams.');
  const refresh = useCallback(async () => {
    if (currentOrg) {
      const [ts, archives] = await Promise.all([
        getAdminTournaments(currentOrg.slug),
        getAdminArchives(currentOrg.slug),
      ]);
      setTournaments(ts);
      setSealedTournamentIds(new Set(archives.map(a => a.tournamentId).filter(Boolean) as string[]));
    }
    await refreshCtx();
    setLoadingData(false);
  }, [currentOrg, refreshCtx]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (!modal || !form.slug) {
        setSlugStatus('idle');
        setSlugMessage('');
        return;
      }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
        setSlugStatus('invalid');
        setSlugMessage('Use lowercase letters, numbers, and single hyphens only.');
        return;
      }
      setSlugStatus('checking');
      setSlugMessage('Checking URL availability...');
      try {
        const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
        const res = await fetch(`/api/admin/tournaments${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'check-slug',
            data: { slug: form.slug, excludeId: editing?.id },
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Unable to check URL.');
        setSlugStatus(result.available ? 'available' : 'taken');
        setSlugMessage(result.available ? 'URL available.' : 'This URL is already in use.');
      } catch {
        setSlugStatus('idle');
        setSlugMessage('URL availability could not be checked.');
      }
    }, !modal || !form.slug ? 0 : 350);

    return () => window.clearTimeout(timer);
  }, [modal, form.slug, editing?.id, currentOrg?.slug]);

  function openAdd() {
    const limit = currentOrg?.tournamentLimit ?? 9999;
    const occupiedSlotCount = tournaments.filter(t => t.status !== 'archived').length;
    if (limit < 9999 && occupiedSlotCount >= limit) {
      setFeedback({
        isOpen: true,
        title: 'Tournament Limit Reached',
        message: `Your plan includes ${limit} tournament slot${limit === 1 ? '' : 's'}. Archive an existing tournament before creating another, or upgrade for more tournaments.`,
        type: 'warning',
      });
      return;
    }

    setSlugEdited(false);
    setSlugStatus('idle');
    setSlugMessage('');
    setCreatedTournament(null);
    setSelectedReuseSourceId(null);
    setSetupWizardSurface('manage_tournaments_new_button');
    setForm(getDefaultTournamentForm());
    setEditing(null);
    setDivisionPreset('youth');
    setCustomDivisionName('');
    setDivisionRows(buildDivisionRows(DIVISION_PRESETS.youth));
    setUseWelcomeMsg(true);
    setWelcomeMsg('Welcome to our tournament! We are excited to host a great event for all participating teams.');
    setSetupWizardOpen(true);
  }

  function openReuseSetup(tournament: Tournament) {
    if (tournamentLimitReached) {
      setFeedback({
        isOpen: true,
        title: 'Tournament Limit Reached',
        message: `Archive an existing tournament before creating another draft, or upgrade for more tournament slots.`,
        type: 'warning',
      });
      return;
    }
    setCreatedTournament(null);
    setSelectedReuseSourceId(tournament.id);
    setSetupWizardSurface('manage_tournaments_row');
    setSetupWizardOpen(true);
  }

  function openEdit(t: Tournament) {
    setSlugEdited(true);
    setSlugStatus('idle');
    setSlugMessage('');
    setForm({
      year: String(t.year),
      name: t.name,
      slug: t.slug,
      startDate: t.startDate || '',
      endDate: t.endDate || '',
    });
    setFeeForm({
      feeScheduleMode: t.feeScheduleMode ?? 'tournament',
      depositAmount: t.depositAmount != null ? String(t.depositAmount) : '',
      depositDueDate: t.depositDueDate ?? '',
      totalFeeAmount: t.totalFeeAmount != null ? String(t.totalFeeAmount) : '',
      totalFeeDueDate: t.totalFeeDueDate ?? '',
    });
    setEditing(t);
    setModal('edit');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      year:      Number(form.year),
      name:      form.name.trim(),
      slug:      form.slug || generateSlug(form.name.trim()),
      startDate: form.startDate || undefined,
      endDate:   form.endDate || undefined,
    };
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) {
      alert('Please use a valid URL slug before saving.');
      return;
    }
    if (slugStatus === 'taken' || slugStatus === 'checking') {
      alert(slugStatus === 'taken' ? 'This tournament URL is already in use.' : 'Please wait for the URL availability check to finish.');
      return;
    }
    if (modal === 'add' && data.startDate && data.startDate < getTodayDateValue()) {
      alert('Start date cannot be before today.');
      return;
    }
    const enabledDivisionRows = divisionRows
      .map(row => ({ ...row, name: row.name.trim() }))
      .filter(row => row.enabled && row.name);
    const duplicateDivision = enabledDivisionRows.find((row, index) =>
      enabledDivisionRows.findIndex(other => other.name.toLowerCase() === row.name.toLowerCase()) !== index
    );
    if (modal === 'add') {
      if (enabledDivisionRows.length === 0) {
        alert('Add at least one division before creating the tournament.');
        return;
      }
      if (duplicateDivision) {
        alert(`Division names must be unique. "${duplicateDivision.name}" is listed more than once.`);
        return;
      }
    }

    try {
      if (modal === 'add') {
        const setupData = {
          tournament: { year: data.year, name: data.name, slug: data.slug, startDate: data.startDate, endDate: data.endDate },
          divisions: enabledDivisionRows.map(row => ({
            name: row.name,
            capacity: row.capacity || 8,
            poolCount: row.poolCount,
            poolNames: row.poolNames.join(','),
            requiresPoolSelection: row.requiresPoolSelection
          })),
          announcement: useWelcomeMsg ? { body: welcomeMsg } : null,
          migration: null
        };

        const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
        const res = await fetch(`/api/admin/setup-tournament${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(setupData)
        });

        const result = await res.json();
        if (result.debug) {
          console.log('Setup API Debug Logs:', result.debug);
        }
        if (!res.ok) throw new Error(result.error || 'Setup failed');
        setCreatedTournament({ name: data.name, slug: data.slug });
      } else if (editing) {
        const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
        const res = await fetch(`/api/admin/tournaments${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            id: editing.id,
            data: { year: data.year, name: data.name, slug: data.slug },
          }),
        });
        if (!res.ok) throw new Error('Update failed');
      }
      
      setModal(null);
      refresh();
    } catch (err: unknown) {
      console.error('Tournament operation failed:', err);
      alert(`There was an error saving the tournament: ${getErrorMessage(err)}`);
    }
  }

  function applyDivisionPreset(preset: DivisionPreset) {
    setDivisionPreset(preset);
    setCustomDivisionName('');
    const names = preset === 'custom' ? [] : DIVISION_PRESETS[preset];
    setDivisionRows(buildDivisionRows(names));
  }

  function addCustomDivision() {
    const name = customDivisionName.trim();
    if (!name) return;
    setDivisionRows(prev => [
      ...prev,
      {
        id: `custom-${prev.length + 1}-${generateSlug(name) || 'division'}`,
        name,
        enabled: true,
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

  function removeDivisionRow(id: string) {
    setDivisionRows(prev => prev.filter(row => row.id !== id));
  }

  function updateDivisionName(id: string, name: string) {
    updateDivisionRow(id, row => ({ ...row, name }));
  }

  function toggleDivision(id: string) {
    updateDivisionRow(id, row => ({ ...row, enabled: !row.enabled }));
  }

  function updateCapacity(id: string, cap: number) {
    updateDivisionRow(id, row => ({ ...row, capacity: cap }));
  }

  function updatePools(id: string, count: number) {
    updateDivisionRow(id, row => {
      const poolNames = Array.from({ length: count }).map((_, i) => row.poolNames[i] || `Pool ${String.fromCharCode(65 + i)}`);
      return { ...row, poolCount: count, poolNames };
    });
  }

  function togglePoolsForDiv(id: string, enabled: boolean) {
    if (enabled) {
      updatePools(id, 2);
    } else {
      updateDivisionRow(id, row => ({
        ...row,
        poolCount: 0,
        poolNames: ['Pool A'],
        requiresPoolSelection: false,
      }));
    }
  }

  function updatePoolName(id: string, poolIdx: number, newName: string) {
    updateDivisionRow(id, row => {
      const poolNames = [...row.poolNames];
      poolNames[poolIdx] = newName;
      return { ...row, poolNames };
    });
  }

  function updateRequiresPool(id: string, req: boolean) {
    updateDivisionRow(id, row => ({ ...row, requiresPoolSelection: req }));
  }

  async function applyTournamentStatus(id: string, status: TournamentStatus) {
    try {
      const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
      const res = await fetch(`/api/admin/tournaments${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-status', id, data: { status } }),
      });
      const result = await res.json();
      if (!res.ok) {
        setFeedback({
          isOpen: true,
          title: 'Status Change Failed',
          message: result.error ?? 'Something went wrong.',
          type: 'danger',
        });
        return;
      }
      refresh();
    } catch (err: unknown) {
      alert('Error: ' + getErrorMessage(err));
    }
  }

  async function handleSetStatus(tournament: Tournament, status: TournamentStatus) {
    if (status === 'active') {
      const orgParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
      const agRes = await fetch(`/api/admin/divisions?tournamentId=${encodeURIComponent(tournament.id)}${orgParam}`);
      const divisions: any[] = agRes.ok ? await agRes.json() : [];
      const blockers: string[] = [];
      const reminders: string[] = [];

      if (!tournament.startDate || !tournament.endDate) blockers.push('Add tournament start and end dates.');
      if (divisions.length === 0) blockers.push('Add at least one division.');
      // Contact is intentionally NOT pre-checked here: a contact can also come from
      // a selected contact member (default_contact_member_id), which this client row
      // doesn't carry. The server activation gate is authoritative and returns a
      // precise blocker if no contact resolves — don't duplicate (and disagree with) it.
      if (divisions.length > 0 && divisions.every(g => g.isClosed)) blockers.push('Open at least one division for registration.');
      if (divisions.some(g => !g.capacity)) reminders.push('Review division capacities.');

      if (blockers.length > 0) {
        setFeedback({
          isOpen: true,
          title: 'Tournament Not Ready',
          message: `Before activating, please: ${blockers.join(' ')}`,
          type: 'warning',
        });
        return;
      }

      setFeedback({
        isOpen: true,
        title: 'Activate Tournament?',
        message: `This will publish the tournament page and open registration. ${reminders.length ? `Recommended before launch: ${reminders.join(' ')}` : 'Your launch checklist looks ready.'}`,
        type: 'primary',
        confirmText: 'Activate Tournament',
        onConfirm: () => applyTournamentStatus(tournament.id, status),
      });
      return;
    }

    if (status === 'completed') {
      setFeedback({
        isOpen: true,
        title: 'Mark as Completed?',
        message: 'Registration closes and all event data — scores, standings, schedule, divisions, and registrations — becomes read-only and final. If you have "Notify teams on complete" turned on, a results summary email is sent to every team coach now. You can reopen it by setting the status back to Live.',
        type: 'warning',
        confirmText: 'Mark Completed',
        onConfirm: () => applyTournamentStatus(tournament.id, status),
      });
      return;
    }

    if (status === 'archived') {
      setFeedback({
        isOpen: true,
        title: 'Archive this tournament?',
        message: 'It is removed from public view immediately — all public links and coach-portal access for this event go offline — and its tournament slot is freed. You can set the status back later to bring it back.',
        type: 'warning',
        confirmText: 'Archive',
        onConfirm: () => applyTournamentStatus(tournament.id, status),
      });
      return;
    }

    applyTournamentStatus(tournament.id, status);
  }

  function openSealConfirm(t: Tournament) {
    setFeedback({
      isOpen: true,
      title: 'Seal Tournament?',
      message: `This will create a permanent, immutable archive record for "${t.name}". The snapshot cannot be modified after sealing. This action cannot be undone.`,
      type: 'warning',
      confirmText: 'Seal Tournament',
      onConfirm: () => handleSeal(t.id),
    });
  }

  async function handleSeal(id: string) {
    try {
      const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
      const res = await fetch(`/api/admin/seal-tournament${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Seal failed');
      }
      refresh();
    } catch (err: unknown) {
      setFeedback({
        isOpen: true,
        title: 'Seal Failed',
        message: getErrorMessage(err),
        type: 'danger',
      });
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
      const res = await fetch(`/api/admin/tournaments${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: deleteId })
      });
      if (!res.ok) throw new Error('Delete failed');
      setDeleteId(null);
      refresh();
    } catch (err: unknown) {
      alert('Error: ' + getErrorMessage(err));
    }
  }

  const slugHintColor = slugStatus === 'available'
    ? 'var(--success, #22c55e)'
    : slugStatus === 'taken' || slugStatus === 'invalid'
      ? 'var(--danger, #ef4444)'
      : 'var(--white-30)';
  const saveDisabled = slugStatus === 'checking' || slugStatus === 'taken' || slugStatus === 'invalid';
  const tournamentLimit = currentOrg?.tournamentLimit ?? 9999;
  const occupiedTournamentSlotCount = tournaments.filter(t => t.status !== 'archived').length;
  const tournamentLimitReached = tournamentLimit < 9999 && occupiedTournamentSlotCount >= tournamentLimit;
  const tournamentLimitLabel = tournamentLimit >= 9999 ? 'Unlimited' : tournamentLimit;
  const canReuseSetup = Boolean(currentOrg && hasPlanFeature(currentOrg.planId, 'tournament_cloning'));
  const subscriptionHref = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments/settings/subscription`;
  const createdFromReuse = createdTournament?.creationMethod === 'reused_setup';
  const createdChecklist = createdFromReuse
    ? [
        'Review copied divisions, pools, and schedule structure',
        'Confirm dates, fees, and public contact details',
        'Check venues, public page settings, rules, and registration questions',
        'Activate when you are ready to publish and accept registrations',
      ]
    : [
        'Review and adjust your divisions',
        'Add venue locations',
        'Add a public contact',
        'Activate when you are ready to publish and accept registrations',
      ];
  const copiedSetupItems = createdFromReuse ? copiedSummary(createdTournament?.copied) : [];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><RefreshCw size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Tournaments</h1>
            <p className={styles.pageSub}>Manage tournament years — create a new season and set which one is live</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          {tournamentLimit < 9999 && (
            <span className={`${styles.slotCount} ${tournamentLimitReached ? styles.slotCountLimit : ''}`}>
              {occupiedTournamentSlotCount} / {tournamentLimitLabel} slots
            </span>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={openAdd}
            disabled={loadingData}
            id="tournament-add-btn"
          >
            <Plus size={16} /> New Tournament
          </button>
        </div>
      </div>

      <div className={styles.lifecycleToggleRow}>
        <button
          type="button"
          onClick={() => setShowLifecycle(open => !open)}
          className={styles.lifecycleToggle}
        >
          <HelpCircle size={12} />
          How statuses work
          {showLifecycle ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {showLifecycle && (
        <div className={styles.lifecycleGrid}>
          {[
            { label: 'Draft',     desc: 'Private — admins only',              color: 'rgba(148,163,184,0.55)' },
            { label: 'Active',    desc: 'Registration open to public',        color: 'var(--logic-lime)'       },
            { label: 'Completed', desc: 'Event over — archive to free a slot', color: '#f6c453'               },
            { label: 'Archived',  desc: 'Hidden — slot freed',                color: 'rgba(148,163,184,0.3)'  },
          ].map(({ label, desc, color }) => (
            <div key={label} className={styles.lifecycleCard} style={{ '--lifecycle-color': color } as CSSProperties}>
              <strong>{label}</strong>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      )}

      {/* F3 — soft upsell when tournament slot limit is reached */}
      {tournamentLimitReached && currentOrg && currentOrg.planId === 'tournament' && (
        <HelpCallout
          variant="info"
          title="Tournament slot limit reached"
          body={
            <>
              Your free Tournament plan includes 1 active tournament slot. Archive a completed tournament to free a slot, or{' '}
              <Link
                href={`/${currentOrg.slug}/admin/org/billing`}
                style={{ color: 'inherit', textDecoration: 'underline' }}
              >
                upgrade to Tournament Plus
              </Link>
              {' '}for unlimited tournament slots, registration control, branding, and automation.
            </>
          }
        />
      )}
      {tournamentLimitReached && currentOrg && currentOrg.planId === 'tournament_plus' && (
        <HelpCallout
          variant="info"
          title="Tournament slots full"
          body="Tournament Plus includes unlimited tournament slots. If this message appears, review the plan override for this organization in Platform Admin."
        />
      )}

      {!loadingData && tournaments.length === 0 && (
        <div className={styles.emptyPrompt}>
          <div>
            <strong>No tournaments yet</strong>
            <span>Create one draft tournament, then add venues, contacts, registration settings, and activate when ready.</span>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={openAdd}
          >
            <Plus size={14} /> Create Tournament
          </button>
        </div>
      )}

      {(() => {
        const hasUnsealedCompleted = tournaments.some(
          t => t.status === 'completed' && !sealedTournamentIds.has(t.id)
        );
        return hasUnsealedCompleted ? (
          <HelpCallout
            variant="warning"
            title="Sealing is permanent"
            body="Sealing permanently locks the results and moves the tournament to your digital archive. This cannot be undone — only seal once all scores are verified."
          />
        ) : null;
      })()}

      <div className={`table-wrap ${styles.responsiveTable}`}>
        <table>
          <thead>
            <tr>
              <th>Tournament Name</th>
              <th>Year</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadingData ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--white-30)', padding: '2rem' }}>
                  Loading…
                </td>
              </tr>
            ) : tournaments.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--white-30)', padding: '2rem' }}>
                  No tournaments yet — use the button above to create your first one.
                </td>
              </tr>
            ) : tournaments.map(t => (
              <tr key={t.id}>
                <td data-label="Tournament">
                  <strong>{t.name}</strong>
                </td>
                <td data-label="Year">
                  <span className="badge badge-primary">{t.year}</span>
                </td>
                <td data-label="Status">
                  <select
                    className={`form-input ${styles.statusSelect}`}
                    value={t.status}
                    disabled={sealedTournamentIds.has(t.id)}
                    onChange={e => handleSetStatus(t, e.target.value as TournamentStatus)}
                    id={`status-select-${t.id}`}
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Live</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </td>
                <td data-label="Actions">
                  <div className={styles.rowActions}>
                    {t.status === 'completed' && (
                      sealedTournamentIds.has(t.id) ? (
                        <span className="badge badge-neutral" title="This tournament has been sealed to the Digital Ledger">
                          SEALED
                        </span>
                      ) : (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => openSealConfirm(t)}
                          id={`seal-tournament-${t.id}`}
                          title="Create an immutable archive record for this tournament"
                        >
                          Seal
                        </button>
                      )
                    )}
                    {t.status !== 'archived' && (
                      canReuseSetup ? (
                        <button
                          type="button"
                          className={`btn btn-outline btn-sm ${styles.reuseAction}`}
                          onClick={() => openReuseSetup(t)}
                          id={`reuse-tournament-${t.id}`}
                          title="Create a new draft using this tournament setup"
                        >
                          <Copy size={13} />
                          <span>Reuse setup</span>
                        </button>
                      ) : (
                        <Link
                          className={`btn btn-outline btn-sm ${styles.reuseAction}`}
                          href={subscriptionHref}
                          id={`reuse-upgrade-tournament-${t.id}`}
                          title="Reuse setup with Tournament Plus"
                        >
                          <Copy size={13} />
                          <span>Reuse with Plus</span>
                        </Link>
                      )
                    )}
                    {currentOrg && (
                      <Link
                        className="btn btn-outline btn-sm"
                        href={`/${currentOrg.slug}/admin/tournaments/preview/${t.slug}`}
                        id={`preview-tournament-${t.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Preview the public tournament site"
                      >
                        <ExternalLink size={13} />
                      </Link>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)} id={`edit-tournament-${t.id}`} title="Edit tournament details">
                      <Pencil size={13} />
                    </button>
                    {t.status !== 'active' && (
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(t.id)} id={`delete-tournament-${t.id}`} title="Delete this tournament">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'add' ? 'New Tournament' : 'Edit Tournament'}</h3>
              <button className="btn btn-ghost btn-data" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Year *</label>
                  <input
                    className="form-input"
                    type="number"
                    min="2000"
                    max="2100"
                    value={form.year}
                    onChange={e => {
                      const y = e.target.value;
                      setForm(f => {
                        const newName = /^\d{4} Tournament$/.test(f.name) ? `${y} Tournament` : f.name;
                        return { ...f, year: y, name: newName, ...(!slugEdited && { slug: generateSlug(newName) }) };
                      });
                    }}
                    required
                    id="tournament-year-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tournament Name *</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Spring Classic 2026"
                    value={form.name}
                    onChange={e => {
                      const name = e.target.value;
                      setForm(f => ({ ...f, name, ...(!slugEdited && { slug: generateSlug(name) }) }));
                    }}
                    required
                    id="tournament-name-input"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">URL Slug *</label>
                <input
                  className="form-input"
                  placeholder="spring-classic-2026"
                  value={form.slug}
                  onChange={e => {
                    setSlugEdited(true);
                    setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') }));
                  }}
                  required
                  id="tournament-slug-input"
                />
                <p style={{ fontSize: '0.7rem', color: 'var(--white-30)', marginTop: '0.25rem' }}>
                  Used in the public URL — /{'{orgSlug}'}/{form.slug || '…'}/schedule
                  {slugMessage && (
                    <span style={{ color: slugHintColor, marginLeft: '0.5rem' }}>
                      {slugMessage}
                    </span>
                  )}
                  {modal === 'edit' && (
                    <span style={{ color: 'var(--warning, #f59e0b)', marginLeft: '0.5rem' }}>
                      Changing this will break existing links to this tournament.
                    </span>
                  )}
                </p>
              </div>

              {modal === 'add' && (
                <>
                  <div className={styles.setupGroup}>
                    <label className="form-label">Division setup</label>
                    <p className={styles.setupHint}>
                      Choose a starter set, then rename, remove, or add divisions. Pools are optional and only needed when a division is split into smaller groups.
                    </p>
                    <div className={styles.presetGrid}>
                      <button
                        type="button"
                        className={`${styles.presetButton} ${divisionPreset === 'youth' ? styles.presetButtonActive : ''}`}
                        onClick={() => applyDivisionPreset('youth')}
                      >
                        <strong>Youth</strong>
                        <span>Starts with common U-style divisions</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.presetButton} ${divisionPreset === 'adult' ? styles.presetButtonActive : ''}`}
                        onClick={() => applyDivisionPreset('adult')}
                      >
                        <strong>Adult</strong>
                        <span>Starts with common adult brackets</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.presetButton} ${divisionPreset === 'custom' ? styles.presetButtonActive : ''}`}
                        onClick={() => applyDivisionPreset('custom')}
                      >
                        <strong>Custom</strong>
                        <span>Start blank and add your own</span>
                      </button>
                    </div>

                    <div className={styles.customDivisionRow}>
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

                    <div className={styles.divisionGrid}>
                      {divisionRows.length === 0 && (
                        <div className={styles.emptyDivisions}>
                          Add at least one division to create the tournament.
                        </div>
                      )}
                      {divisionRows.map(row => (
                        <div key={row.id} className={styles.divisionRow}>
                          <div className={styles.divisionNameCell}>
                            <input
                              type="checkbox"
                              checked={row.enabled}
                              onChange={() => toggleDivision(row.id)}
                              aria-label={`Include ${row.name || 'division'}`}
                            />
                            <input
                              className={`form-input ${styles.divisionNameInput}`}
                              value={row.name}
                              onChange={e => updateDivisionName(row.id, e.target.value)}
                              placeholder="Division name"
                            />
                            <button
                              type="button"
                              className={styles.removeDivisionButton}
                              onClick={() => removeDivisionRow(row.id)}
                              aria-label={`Remove ${row.name || 'division'}`}
                            >
                              <X size={14} />
                            </button>
                          </div>
                          {row.enabled && (
                            <div className={styles.divisionControls}>
                              <div className={styles.capInputWrap}>
                                <div className={styles.subInput}>
                                  <label>Capacity:</label>
                                  <input 
                                    type="number" 
                                    min="1" 
                                    value={row.capacity || 8}
                                    onChange={e => updateCapacity(row.id, Number(e.target.value))}
                                    className="form-input"
                                  />
                                </div>
                                <div className={styles.subCheck} style={{ marginLeft: '1rem', borderLeft: '1px solid var(--white-10)', paddingLeft: '1rem' }}>
                                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={row.poolCount >= 2}
                                      onChange={e => togglePoolsForDiv(row.id, e.target.checked)}
                                    />
                                    Use Pools
                                  </label>
                                </div>
                                {row.poolCount >= 2 && (
                                  <div className={styles.subInput} style={{ marginLeft: '1rem' }}>
                                    <label>Count:</label>
                                    <input 
                                      type="number" 
                                      min="2" 
                                      max="4"
                                      value={row.poolCount}
                                      onChange={e => updatePools(row.id, Number(e.target.value))}
                                      className="form-input"
                                      style={{ width: '60px' }}
                                    />
                                  </div>
                                )}
                              </div>
                              {row.poolCount >= 2 && (
                                <>
                                  <div className={styles.subCheck}>
                                    <label>User Selects Pool:</label>
                                    <input 
                                      type="checkbox" 
                                      checked={row.requiresPoolSelection}
                                      onChange={e => updateRequiresPool(row.id, e.target.checked)}
                                    />
                                  </div>
                                  <div className={styles.poolNamesList}>
                                    {Array.from({ length: row.poolCount }).map((_, i) => (
                                      <div key={i} className={styles.poolNameItem}>
                                        <label>{String.fromCharCode(65 + i)} Name:</label>
                                        <input 
                                          className="form-input" 
                                          value={row.poolNames[i] || ''} 
                                          onChange={e => updatePoolName(row.id, i, e.target.value)}
                                          placeholder={`e.g. Gold`}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.setupGroup}>
                    <div className={styles.checkboxGroup}>
                      <label className={styles.checkboxLabel}>
                        <input 
                          type="checkbox" 
                          checked={useWelcomeMsg} 
                          onChange={e => setUseWelcomeMsg(e.target.checked)} 
                        />
                        Create default welcome announcement
                      </label>
                    </div>
                    {useWelcomeMsg && (
                      <textarea 
                        className="form-textarea"
                        rows={3}
                        value={welcomeMsg}
                        onChange={e => setWelcomeMsg(e.target.value)}
                        placeholder="Enter welcome message..."
                      />
                    )}
                  </div>

                </>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost btn-data" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-data" id="tournament-save-btn" disabled={saveDisabled}>
                  <Check size={14} /> Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <FeedbackModal
        {...feedback}
        onClose={() => setFeedback(f => ({ ...f, isOpen: false, onConfirm: undefined }))}
      />

      <TournamentSetupWizard
        isOpen={setupWizardOpen}
        orgSlug={currentOrg?.slug}
        orgContactEmail={currentOrg?.contactEmail}
        existingTournaments={tournaments
          .filter(t => t.status !== 'archived')
          .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))}
        initialSourceTournamentId={selectedReuseSourceId}
        sourceSurface={setupWizardSurface}
        canClone={canReuseSetup}
        upgradeCopy={requiresTournamentPlusCopy('tournament_cloning')}
        onClose={() => {
          setSetupWizardOpen(false);
          setSelectedReuseSourceId(null);
        }}
        onCreated={async tournament => {
          setSetupWizardOpen(false);
          setSelectedReuseSourceId(null);
          setCreatedTournament({
            name: tournament.name,
            slug: tournament.slug,
            creationMethod: tournament.creationMethod,
            sourceName: tournament.sourceName,
            copied: tournament.copied,
          });
          await refresh();
        }}
      />

      {createdTournament && currentOrg && (
        <div className="modal-overlay" onClick={() => setCreatedTournament(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Check size={20} style={{ color: 'var(--success, #22c55e)' }} />
                <h3>{createdFromReuse ? 'Tournament Draft Created' : 'Tournament Created'}</h3>
              </div>
              <button className="btn btn-ghost btn-data" onClick={() => setCreatedTournament(null)}><X size={16} /></button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem' }}>
              <p style={{ color: 'var(--white-70)', marginBottom: '1.25rem' }}>
                <strong>{createdTournament.name}</strong>{' '}
                {createdFromReuse && createdTournament.sourceName
                  ? <>is saved as a draft from <strong>{createdTournament.sourceName}</strong>. Review the copied setup before going live:</>
                  : <>is saved as a draft. Here is what to finish before going live:</>}
              </p>
              {createdFromReuse && copiedSetupItems.length > 0 && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px solid rgba(var(--logic-lime-rgb), 0.24)', background: 'rgba(var(--logic-lime-rgb), 0.055)' }}>
                  <div style={{ marginBottom: '0.45rem', color: 'var(--logic-lime)', fontSize: '0.74rem', fontWeight: 900, textTransform: 'uppercase' }}>
                    Copied forward
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {copiedSetupItems.map(item => (
                      <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <Check size={13} style={{ color: 'var(--logic-lime)', flexShrink: 0, marginTop: '0.12rem' }} />
                        <span style={{ fontSize: '0.82rem', color: 'var(--white-65)' }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {createdChecklist.map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                    <Check size={14} style={{ color: 'var(--success, #22c55e)', flexShrink: 0, marginTop: '0.15rem' }} />
                    <span style={{ fontSize: '0.9rem', color: 'var(--white-70)' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-lime btn-data" onClick={() => setCreatedTournament(null)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Tournament?</h3>
              <button className="btn btn-ghost btn-data" onClick={() => setDeleteId(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--white-60)', marginBottom: '0.5rem' }}>
              This permanently deletes the tournament and all of its data — every team registration, game result,
              schedule, division, and rule is erased and cannot be recovered. To keep a copy of the results, seal
              the tournament first.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost btn-data" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger btn-data" onClick={handleDelete} id="confirm-delete-tournament">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
