'use client';
import { useState, useEffect } from 'react';
import { RefreshCw, Plus, Check, X, Trash2, Pencil, Star, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import {
  getTournamentsByOrg, getContacts, getArchivesByOrg, getAgeGroups
} from '@/lib/db';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { Tournament, TournamentStatus, Contact } from '@/lib/types';

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
import FeedbackModal from '@/components/FeedbackModal';
import HelpCallout from '@/components/help/HelpCallout';
import HelpTooltip from '@/components/help/HelpTooltip';
import styles from './tournaments-admin.module.css';

type ModalMode = 'add' | 'edit' | null;
type DivisionPreset = 'youth' | 'adult' | 'custom';
type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const DIVISION_PRESETS: Record<Exclude<DivisionPreset, 'custom'>, string[]> = {
  youth: ['U9', 'U11', 'U13', 'U15', 'U17', 'U19'],
  adult: ['Open', 'Competitive', 'Recreational'],
};

function buildDivisionDefaults(names: string[]) {
  return {
    selected: new Set(names),
    capacities: Object.fromEntries(names.map(name => [name, 8])),
    pools: Object.fromEntries(names.map(name => [name, 0])),
    requiresPool: Object.fromEntries(names.map(name => [name, false])),
    poolNames: Object.fromEntries(names.map(name => [name, ['Pool A']])),
  };
}

export default function AdminTournamentsPage() {
  const showDevSeedTools = process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true';
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [modal, setModal]       = useState<ModalMode>(null);
  const [editing, setEditing]   = useState<Tournament | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sealedTournamentIds, setSealedTournamentIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'primary' | 'danger' | 'warning' | 'success' | 'info';
    confirmText?: string;
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'warning' });
  const [form, setForm]         = useState({
    year: String(new Date().getFullYear()),
    name: '',
    slug: '',
    startDate: '',
    endDate: '',
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [slugMessage, setSlugMessage] = useState('');
  const [createdTournament, setCreatedTournament] = useState<{ name: string; slug: string } | null>(null);
  const { refresh: refreshCtx } = useTournament();
  const { currentOrg } = useOrg();

  // Migration / Initialization states
  const [sourceTournamentId, setSourceTournamentId] = useState<string>('');
  const [sourceContacts, setSourceContacts]         = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [migrateDiamonds, setMigrateDiamonds]       = useState(false);
  const [divisionPreset, setDivisionPreset] = useState<DivisionPreset>('youth');
  const [customDivisionName, setCustomDivisionName] = useState('');
  const initialDivisions = buildDivisionDefaults(DIVISION_PRESETS.youth);
  const [selectedDivisions, setSelectedDivisions]   = useState<Set<string>>(initialDivisions.selected);
  const [divisionCapacities, setDivisionCapacities] = useState<Record<string, number>>(initialDivisions.capacities);
  const [divisionPools, setDivisionPools]           = useState<Record<string, number>>(initialDivisions.pools);
  const [divisionRequiresPool, setDivisionRequiresPool] = useState<Record<string, boolean>>(initialDivisions.requiresPool);
  const [divisionPoolNames, setDivisionPoolNames] = useState<Record<string, string[]>>(initialDivisions.poolNames);
  const [useWelcomeMsg, setUseWelcomeMsg]           = useState(true);
  const [welcomeMsg, setWelcomeMsg]                 = useState('Welcome to our tournament! We are excited to host a great event for all participating teams.');
  const [seedData, setSeedData]                     = useState({
    contacts: false,
    diamonds: false,
    registrations: false,
    schedule: false,
    results: false
  });
  const [scheduleParams, setScheduleParams] = useState({
    gameDuration: 90,
    turnoverTime: 15,
    gamesPerTeam: 3,
    startDate: '',
    endDate: '',
    startTime: '08:00',
    endTime: '20:30'
  });

  async function refresh() {
    if (currentOrg) {
      const [ts, archives] = await Promise.all([
        getTournamentsByOrg(currentOrg.id),
        getArchivesByOrg(currentOrg.id),
      ]);
      setTournaments(ts);
      setSealedTournamentIds(new Set(archives.map(a => a.tournamentId).filter(Boolean) as string[]));
    }
    await refreshCtx();
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line

  useEffect(() => {
    async function fetchSourceContacts() {
      if (sourceTournamentId && modal === 'add') {
        const contacts = await getContacts(sourceTournamentId);
        setSourceContacts(contacts);
        setSelectedContactIds(new Set(contacts.map(c => c.id)));
      } else {
        setSourceContacts([]);
        setSelectedContactIds(new Set());
      }
    }
    fetchSourceContacts();
  }, [sourceTournamentId, modal]);

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
        const res = await fetch('/api/admin/tournaments', {
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
  }, [modal, form.slug, editing?.id]);

  function openAdd() {
    const nextYear = new Date().getFullYear();
    const defaultName = `${nextYear} Tournament`;
    const defaults = buildDivisionDefaults(DIVISION_PRESETS.youth);
    setSlugEdited(false);
    setSlugStatus('idle');
    setSlugMessage('');
    setCreatedTournament(null);
    setForm({
      year: String(nextYear),
      name: defaultName,
      slug: generateSlug(defaultName),
      startDate: '',
      endDate: '',
    });
    setEditing(null);
    setSourceTournamentId('');
    setMigrateDiamonds(false);
    setDivisionPreset('youth');
    setCustomDivisionName('');
    setSelectedDivisions(defaults.selected);
    setDivisionCapacities(defaults.capacities);
    setDivisionPools(defaults.pools);
    setDivisionRequiresPool(defaults.requiresPool);
    setDivisionPoolNames(defaults.poolNames);
    setUseWelcomeMsg(true);
    setWelcomeMsg('Welcome to our tournament! We are excited to host a great event for all participating teams.');
    setSeedData({
      contacts: false,
      diamonds: false,
      registrations: false,
      schedule: false,
      results: false
    });
    setScheduleParams({
      gameDuration: 90,
      turnoverTime: 15,
      gamesPerTeam: 3,
      startDate: '',
      endDate: '',
      startTime: '08:00',
      endTime: '20:30'
    });
    setModal('add');
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
    if (modal === 'add' && selectedDivisions.size === 0) {
      alert('Add at least one division before creating the tournament.');
      return;
    }

    try {
      if (modal === 'add') {
        const setupData = {
          tournament: { year: data.year, name: data.name, slug: data.slug, startDate: data.startDate, endDate: data.endDate },
          divisions: Array.from(selectedDivisions).map(name => ({
            name,
            capacity: divisionCapacities[name] || 8,
            poolCount: divisionPools[name] ?? 0,
            poolNames: (divisionPoolNames[name] || []).join(','),
            requiresPoolSelection: divisionRequiresPool[name] || false
          })),
          announcement: useWelcomeMsg ? { body: welcomeMsg } : null,
          seedData: showDevSeedTools ? seedData : {
            contacts: false,
            diamonds: false,
            registrations: false,
            schedule: false,
            results: false,
          },
          scheduleParams: showDevSeedTools && seedData.schedule ? {
            ...scheduleParams,
            startDate: scheduleParams.startDate || data.startDate,
            endDate: scheduleParams.endDate || data.endDate
          } : null,
          migration: sourceTournamentId ? {
            sourceTournamentId,
            migrateDiamonds,
            contactIds: Array.from(selectedContactIds)
          } : null
        };

        const res = await fetch('/api/admin/setup-tournament', {
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
        const res = await fetch('/api/admin/tournaments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update', id: editing.id, data })
        });
        if (!res.ok) throw new Error('Update failed');
      }
      
      setModal(null);
      refresh();
    } catch (err: any) {
      console.error('Tournament operation failed:', err);
      alert(`There was an error saving the tournament: ${err.message}`);
    }
  }

  function toggleContact(id: string) {
    const next = new Set(selectedContactIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedContactIds(next);
  }

  function toggleDivision(name: string) {
    const next = new Set(selectedDivisions);
    if (next.has(name)) next.delete(name);
    else {
      next.add(name);
      if (!(name in divisionCapacities)) {
        setDivisionCapacities(prev => ({ ...prev, [name]: 8 }));
      }
      if (!(name in divisionPools)) {
        setDivisionPools(prev => ({ ...prev, [name]: 0 }));
      }
      if (!(name in divisionRequiresPool)) {
        setDivisionRequiresPool(prev => ({ ...prev, [name]: false }));
      }
    }
    setSelectedDivisions(next);
  }

  function applyDivisionPreset(preset: DivisionPreset) {
    setDivisionPreset(preset);
    setCustomDivisionName('');
    const names = preset === 'custom' ? [] : DIVISION_PRESETS[preset];
    const defaults = buildDivisionDefaults(names);
    setSelectedDivisions(defaults.selected);
    setDivisionCapacities(defaults.capacities);
    setDivisionPools(defaults.pools);
    setDivisionRequiresPool(defaults.requiresPool);
    setDivisionPoolNames(defaults.poolNames);
  }

  function addCustomDivision() {
    const name = customDivisionName.trim();
    if (!name || selectedDivisions.has(name)) return;
    setSelectedDivisions(prev => new Set([...prev, name]));
    setDivisionCapacities(prev => ({ ...prev, [name]: 8 }));
    setDivisionPools(prev => ({ ...prev, [name]: 0 }));
    setDivisionRequiresPool(prev => ({ ...prev, [name]: false }));
    setDivisionPoolNames(prev => ({ ...prev, [name]: ['Pool A'] }));
    setCustomDivisionName('');
  }

  function updateCapacity(name: string, cap: number) {
    setDivisionCapacities(prev => ({ ...prev, [name]: cap }));
  }

  function updatePools(name: string, count: number) {
    setDivisionPools(prev => ({ ...prev, [name]: count }));
    setDivisionPoolNames(prev => {
      const existing = prev[name] || [];
      const next = Array.from({ length: count }).map((_, i) => existing[i] || `Pool ${String.fromCharCode(65 + i)}`);
      return { ...prev, [name]: next };
    });
  }

  function togglePoolsForDiv(name: string, enabled: boolean) {
    if (enabled) {
      updatePools(name, 2);
    } else {
      updatePools(name, 0);
      updateRequiresPool(name, false);
    }
  }

  function updatePoolName(divName: string, poolIdx: number, newName: string) {
    setDivisionPoolNames(prev => {
      const next = [...(prev[divName] || [])];
      next[poolIdx] = newName;
      return { ...prev, [divName]: next };
    });
  }

  function updateRequiresPool(name: string, req: boolean) {
    setDivisionRequiresPool(prev => ({ ...prev, [name]: req }));
  }

  async function applyTournamentStatus(id: string, status: TournamentStatus) {
    try {
      const res = await fetch('/api/admin/tournaments', {
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
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }

  async function handleSetStatus(tournament: Tournament, status: TournamentStatus) {
    if (status === 'active') {
      const ageGroups = await getAgeGroups(tournament.id);
      const blockers: string[] = [];
      const reminders: string[] = [];

      if (!tournament.startDate || !tournament.endDate) blockers.push('Add tournament start and end dates.');
      if (ageGroups.length === 0) blockers.push('Add at least one division.');
      if (!tournament.contactEmail && !currentOrg?.contactEmail) blockers.push('Add a public contact email.');
      if (ageGroups.length > 0 && ageGroups.every(g => g.isClosed)) blockers.push('Open at least one division for registration.');
      if (ageGroups.some(g => !g.capacity)) reminders.push('Review division capacities.');

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
      const res = await fetch('/api/admin/seal-tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Seal failed');
      }
      refresh();
    } catch (err: any) {
      setFeedback({
        isOpen: true,
        title: 'Seal Failed',
        message: err.message,
        type: 'danger',
      });
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch('/api/admin/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: deleteId })
      });
      if (!res.ok) throw new Error('Delete failed');
      setDeleteId(null);
      refresh();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  }

  const visibleDivisionNames = divisionPreset === 'custom'
    ? Array.from(selectedDivisions)
    : DIVISION_PRESETS[divisionPreset];
  const slugHintColor = slugStatus === 'available'
    ? 'var(--success, #22c55e)'
    : slugStatus === 'taken' || slugStatus === 'invalid'
      ? 'var(--danger, #ef4444)'
      : 'var(--white-30)';
  const saveDisabled = slugStatus === 'checking' || slugStatus === 'taken' || slugStatus === 'invalid';

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
        <button className="btn btn-primary btn-sm" onClick={openAdd} id="tournament-add-btn">
          <Plus size={16} /> New Tournament
        </button>
      </div>

      {/* Info card */}
      <div className={styles.infoCard}>
        <Star size={14} style={{ color: 'var(--logic-lime)', flexShrink: 0, marginTop: 2 }} />
        <p>
          <strong>Draft</strong> tournaments are invisible to the public — set up age groups and schedule before going live.
          <strong> Activate</strong> to publish and open registration.
          <strong> Complete</strong> when the season ends to free your active slot.
          <strong> Archive</strong> to retire a tournament while keeping its history accessible.
          <strong> Seal</strong> to create a permanent, tamper-proof snapshot of the final results — this cannot be undone.
        </p>
      </div>

      {tournaments.length === 0 && (
        <HelpCallout
          variant="info"
          title="Tournaments are the core of FieldLogicHQ"
          body="Create your first tournament to get started — you can configure age groups, teams, schedule, and scoring all from here."
          cta={{ label: 'New Tournament', href: '#' }}
        />
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

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tournament Name</th>
              <th>Year</th>
              <th style={{ whiteSpace: 'nowrap' }}>
                Status
                <HelpTooltip
                  title="Tournament statuses"
                  body="Draft: visible only to admins. Active: accepting registrations and score submissions. Completed: season is over. Archived: hidden from most views."
                />
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tournaments.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--white-30)', padding: '2rem' }}>
                  No tournaments yet — use the button above to create your first one.
                </td>
              </tr>
            ) : tournaments.map(t => (
              <tr key={t.id}>
                <td>
                  <strong>{t.name}</strong>
                </td>
                <td>
                  <span className="badge badge-primary">{t.year}</span>
                </td>
                <td>
                  <select
                    className="form-input"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', minWidth: '120px' }}
                    value={t.status}
                    disabled={sealedTournamentIds.has(t.id)}
                    onChange={e => handleSetStatus(t, e.target.value as TournamentStatus)}
                    id={`status-select-${t.id}`}
                  >
                    <option value="draft">Draft</option>
                    <option value="active">● Live</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </td>
                <td>
                  <div className="flex gap-1 flex-wrap">
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
                    {currentOrg && (
                      <Link
                        className="btn btn-outline btn-sm"
                        href={t.status === 'draft'
                          ? `/${currentOrg.slug}/admin/tournaments/preview/${t.slug}`
                          : `/${currentOrg.slug}/${t.slug}`}
                        id={`preview-tournament-${t.id}`}
                      >
                        Preview
                      </Link>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)} id={`edit-tournament-${t.id}`}>
                      <Pencil size={13} />
                    </button>
                    {t.status !== 'active' && (
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(t.id)} id={`delete-tournament-${t.id}`}>
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
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
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

              <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Start Date (Optional)</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.startDate}
                    onChange={e => {
                      const start = e.target.value;
                      setForm(f => {
                        const updates: any = { startDate: start };
                        if (start) {
                          const date = new Date(start + 'T12:00:00');
                          date.setDate(date.getDate() + 2);
                          updates.endDate = date.toISOString().split('T')[0];
                        }
                        return { ...f, ...updates };
                      });
                    }}
                    id="tournament-start-date"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date (Optional)</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    id="tournament-end-date"
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
                <div className={styles.migrationSection}>
                  <div className={styles.migrationHeader}>
                    <RefreshCw size={16} />
                    <h4>Migration & Setup</h4>
                  </div>

                  <div className="form-group" style={{ marginTop: '0.5rem' }}>
                    <label className="form-label">Migrate data from past tournament (optional)</label>
                    <select 
                      className="form-input" 
                      value={sourceTournamentId}
                      onChange={e => setSourceTournamentId(e.target.value)}
                    >
                      <option value="">-- No Migration --</option>
                      {tournaments.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.year})</option>
                      ))}
                    </select>
                  </div>

                  {sourceTournamentId && (
                    <div className={styles.migrationOptions}>
                      <div className={styles.checkboxGroup}>
                        <label className={styles.checkboxLabel}>
                          <input 
                            type="checkbox" 
                            checked={migrateDiamonds} 
                            onChange={e => setMigrateDiamonds(e.target.checked)} 
                          />
                          Migrate all diamond locations
                        </label>
                      </div>

                      {sourceContacts.length > 0 && (
                        <div className={styles.contactPicker}>
                          <label className="form-label">Select contacts to migrate:</label>
                          <div className={styles.contactList}>
                            {sourceContacts.map(c => (
                              <label key={c.id} className={styles.checkboxLabel}>
                                <input 
                                  type="checkbox" 
                                  checked={selectedContactIds.has(c.id)}
                                  onChange={() => toggleContact(c.id)}
                                />
                                {c.name} ({c.role})
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className={styles.setupGroup}>
                    <label className="form-label">Division setup</label>
                    <p className={styles.setupHint}>
                      Choose a starting structure, then adjust capacities. Pools are optional and only needed when a division is split into smaller groups.
                    </p>
                    <div className={styles.presetGrid}>
                      <button
                        type="button"
                        className={`${styles.presetButton} ${divisionPreset === 'youth' ? styles.presetButtonActive : ''}`}
                        onClick={() => applyDivisionPreset('youth')}
                      >
                        <strong>Youth</strong>
                        <span>U9, U11, U13, U15, U17, U19</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.presetButton} ${divisionPreset === 'adult' ? styles.presetButtonActive : ''}`}
                        onClick={() => applyDivisionPreset('adult')}
                      >
                        <strong>Adult</strong>
                        <span>Open, Competitive, Recreational</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.presetButton} ${divisionPreset === 'custom' ? styles.presetButtonActive : ''}`}
                        onClick={() => applyDivisionPreset('custom')}
                      >
                        <strong>Custom</strong>
                        <span>Add your own division names</span>
                      </button>
                    </div>

                    {divisionPreset === 'custom' && (
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
                          placeholder="e.g. 12U, Open, Varsity"
                        />
                        <button type="button" className="btn btn-outline btn-sm" onClick={addCustomDivision}>
                          <Plus size={14} /> Add
                        </button>
                      </div>
                    )}

                    <div className={styles.divisionGrid}>
                      {visibleDivisionNames.length === 0 && (
                        <div className={styles.emptyDivisions}>
                          Add at least one division to create the tournament.
                        </div>
                      )}
                      {visibleDivisionNames.map(div => (
                        <div key={div} className={styles.divisionRow}>
                          <label className={styles.checkboxLabel}>
                            <input 
                              type="checkbox" 
                              checked={selectedDivisions.has(div)}
                              onChange={() => toggleDivision(div)}
                            />
                            {div}
                          </label>
                          {selectedDivisions.has(div) && (
                            <div className={styles.divisionControls}>
                              <div className={styles.capInputWrap}>
                                <div className={styles.subInput}>
                                  <label>Capacity:</label>
                                  <input 
                                    type="number" 
                                    min="1" 
                                    value={divisionCapacities[div] || 8}
                                    onChange={e => updateCapacity(div, Number(e.target.value))}
                                    className="form-input"
                                  />
                                </div>
                                <div className={styles.subCheck} style={{ marginLeft: '1rem', borderLeft: '1px solid var(--white-10)', paddingLeft: '1rem' }}>
                                  <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={(divisionPools[div] || 0) >= 2}
                                      onChange={e => togglePoolsForDiv(div, e.target.checked)}
                                    />
                                    Use Pools
                                  </label>
                                </div>
                                {(divisionPools[div] || 0) >= 2 && (
                                  <div className={styles.subInput} style={{ marginLeft: '1rem' }}>
                                    <label>Count:</label>
                                    <input 
                                      type="number" 
                                      min="2" 
                                      max="4"
                                      value={divisionPools[div]}
                                      onChange={e => updatePools(div, Number(e.target.value))}
                                      className="form-input"
                                      style={{ width: '60px' }}
                                    />
                                  </div>
                                )}
                              </div>
                              {(divisionPools[div] || 0) >= 2 && (
                                <>
                                  <div className={styles.subCheck}>
                                    <label>User Selects Pool:</label>
                                    <input 
                                      type="checkbox" 
                                      checked={divisionRequiresPool[div] || false}
                                      onChange={e => updateRequiresPool(div, e.target.checked)}
                                    />
                                  </div>
                                  <div className={styles.poolNamesList}>
                                    {Array.from({ length: divisionPools[div] }).map((_, i) => (
                                      <div key={i} className={styles.poolNameItem}>
                                        <label>{String.fromCharCode(65 + i)} Name:</label>
                                        <input 
                                          className="form-input" 
                                          value={divisionPoolNames[div]?.[i] || ''} 
                                          onChange={e => updatePoolName(div, i, e.target.value)}
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

                  {showDevSeedTools && (
                  <div className={styles.setupGroup}>
                    <div className={styles.migrationHeader}>
                      <Sparkles size={16} />
                      <h4>Seed Random Data (Testing)</h4>
                    </div>
                    <div className={styles.seedGrid}>
                      <label className={styles.checkboxLabel}>
                        <input type="checkbox" checked={seedData.contacts} onChange={e => setSeedData(s => ({ ...s, contacts: e.target.checked }))} />
                        Contacts
                      </label>
                      <label className={styles.checkboxLabel}>
                        <input type="checkbox" checked={seedData.diamonds} onChange={e => setSeedData(s => ({ ...s, diamonds: e.target.checked }))} />
                        Diamonds
                      </label>
                      <label className={styles.checkboxLabel}>
                        <input type="checkbox" checked={seedData.registrations} onChange={e => setSeedData(s => ({ ...s, registrations: e.target.checked }))} />
                        Registrations
                      </label>
                      <label className={styles.checkboxLabel}>
                        <input type="checkbox" checked={seedData.schedule} onChange={e => setSeedData(s => ({ ...s, schedule: e.target.checked }))} />
                        Schedule
                      </label>
                      <label className={styles.checkboxLabel}>
                        <input type="checkbox" checked={seedData.results} onChange={e => setSeedData(s => ({ ...s, results: e.target.checked }))} />
                        Results
                      </label>
                    </div>

                    {seedData.schedule && (
                      <div className={styles.scheduleParamsPanel}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--white-30)', marginBottom: '0.75rem' }}>
                          Parameters for generated schedule:
                        </p>
                        
                        <div className="form-row form-row-2" style={{ marginBottom: '0.75rem' }}>
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.7rem' }}>Scheduling Start Date</label>
                            <input 
                              type="date" 
                              className="form-input" 
                              value={scheduleParams.startDate || form.startDate} 
                              onChange={e => setScheduleParams(p => ({ ...p, startDate: e.target.value }))}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.7rem' }}>Scheduling End Date</label>
                            <input 
                              type="date" 
                              className="form-input" 
                              value={scheduleParams.endDate || form.endDate} 
                              onChange={e => setScheduleParams(p => ({ ...p, endDate: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div className="form-row form-row-2" style={{ marginBottom: '0.75rem' }}>
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.7rem' }}>Daily Start Time</label>
                            <input 
                              type="time" 
                              className="form-input" 
                              value={scheduleParams.startTime} 
                              onChange={e => setScheduleParams(p => ({ ...p, startTime: e.target.value }))}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.7rem' }}>Daily End Time</label>
                            <input 
                              type="time" 
                              className="form-input" 
                              value={scheduleParams.endTime} 
                              onChange={e => setScheduleParams(p => ({ ...p, endTime: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div className="form-row form-row-3">
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.7rem' }}>Game Length (min)</label>
                            <input 
                              type="number" 
                              className="form-input" 
                              value={scheduleParams.gameDuration} 
                              onChange={e => setScheduleParams(p => ({ ...p, gameDuration: Number(e.target.value) }))}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.7rem' }}>Turnover (min)</label>
                            <input 
                              type="number" 
                              className="form-input" 
                              value={scheduleParams.turnoverTime} 
                              onChange={e => setScheduleParams(p => ({ ...p, turnoverTime: Number(e.target.value) }))}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: '0.7rem' }}>Games / Team</label>
                            <input 
                              type="number" 
                              className="form-input" 
                              value={scheduleParams.gamesPerTeam} 
                              onChange={e => setScheduleParams(p => ({ ...p, gamesPerTeam: Number(e.target.value) }))}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" id="tournament-save-btn" disabled={saveDisabled}>
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

      {createdTournament && currentOrg && (
        <div className="modal-overlay" onClick={() => setCreatedTournament(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Check size={20} style={{ color: 'var(--success, #22c55e)' }} />
                <h3>Tournament Created</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setCreatedTournament(null)}><X size={16} /></button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem' }}>
              <p style={{ color: 'var(--white-70)', marginBottom: '1rem' }}>
                {createdTournament.name} is saved as a draft. Finish setup, then activate it when you are ready to publish the public page and accept registrations.
              </p>
              <div className={styles.nextStepsGrid}>
                <Link href={`/${currentOrg.slug}/admin/tournaments/age-groups`} className={styles.nextStepLink}>Review divisions</Link>
                <Link href={`/${currentOrg.slug}/admin/tournaments/diamonds`} className={styles.nextStepLink}>Add venues</Link>
                <Link href={`/${currentOrg.slug}/admin/tournaments/contacts`} className={styles.nextStepLink}>Add contacts</Link>
                <Link href={`/${currentOrg.slug}/admin/org/tournaments`} className={styles.nextStepLink}>Activate when ready</Link>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setCreatedTournament(null)}>Stay Here</button>
              <Link href={`/${currentOrg.slug}/admin/tournaments/dashboard`} className="btn btn-primary">
                Go to Dashboard <ArrowRight size={15} />
              </Link>
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
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteId(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--white-60)', marginBottom: '0.5rem' }}>
              Deleting this tournament will remove its record. Teams and games tagged to it will remain in storage
              but will no longer appear on any page.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} id="confirm-delete-tournament">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
