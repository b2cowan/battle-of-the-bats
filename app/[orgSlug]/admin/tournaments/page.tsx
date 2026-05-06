'use client';
import { useState, useEffect } from 'react';
import { RefreshCw, Plus, Check, X, Trash2, Pencil, Star, Sparkles } from 'lucide-react';
import {
  getTournamentsByOrg, saveTournament, updateTournament, deleteTournament, setActiveTournament,
  getContacts, getDiamonds, cloneContacts, cloneDiamonds, initializeAgeGroups, saveAnnouncement,
  seedTournamentData, getArchivesByOrg
} from '@/lib/db';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { Tournament, TournamentStatus, Contact } from '@/lib/types';

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
import FeedbackModal from '@/components/FeedbackModal';
import styles from './tournaments-admin.module.css';

type ModalMode = 'add' | 'edit' | null;

export default function AdminTournamentsPage() {
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
  const { refresh: refreshCtx } = useTournament();
  const { currentOrg } = useOrg();

  // Migration / Initialization states
  const [sourceTournamentId, setSourceTournamentId] = useState<string>('');
  const [sourceContacts, setSourceContacts]         = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [migrateDiamonds, setMigrateDiamonds]       = useState(false);
  const [selectedDivisions, setSelectedDivisions]   = useState<Set<string>>(new Set(['U11', 'U13', 'U15', 'U17', 'U19']));
  const [divisionCapacities, setDivisionCapacities] = useState<Record<string, number>>({
    'U11': 8, 'U13': 8, 'U15': 8, 'U17': 8, 'U19': 8
  });
  const [divisionPools, setDivisionPools]           = useState<Record<string, number>>({
    'U11': 0, 'U13': 0, 'U15': 0, 'U17': 0, 'U19': 0
  });
  const [divisionRequiresPool, setDivisionRequiresPool] = useState<Record<string, boolean>>({
    'U11': false, 'U13': false, 'U15': false, 'U17': false, 'U19': false
  });
  const [divisionPoolNames, setDivisionPoolNames] = useState<Record<string, string[]>>({
    'U11': ['Pool A'], 'U13': ['Pool A'], 'U15': ['Pool A'], 'U17': ['Pool A'], 'U19': ['Pool A']
  });
  const [useWelcomeMsg, setUseWelcomeMsg]           = useState(true);
  const [welcomeMsg, setWelcomeMsg]                 = useState('Welcome to the Battle of the Bats tournament! We are excited to have you join us for another great season of competitive youth softball.');
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

  function openAdd() {
    const nextYear = new Date().getFullYear();
    const defaultName = `Battle of the Bats ${nextYear}`;
    setSlugEdited(false);
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
    setSelectedDivisions(new Set(['U11', 'U13', 'U15', 'U17', 'U19']));
    setDivisionCapacities({ 'U11': 8, 'U13': 8, 'U15': 8, 'U17': 8, 'U19': 8 });
    setDivisionPools({ 'U11': 0, 'U13': 0, 'U15': 0, 'U17': 0, 'U19': 0 });
    setDivisionRequiresPool({ 'U11': false, 'U13': false, 'U15': false, 'U17': false, 'U19': false });
    setUseWelcomeMsg(true);
    setWelcomeMsg('Welcome to the Battle of the Bats tournament! We are excited to have you join us for another great season of competitive youth softball.');
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

    try {
      if (modal === 'add') {
        const setupData = {
          tournament: { year: data.year, name: data.name, slug: data.slug, startDate: data.startDate, endDate: data.endDate },
          divisions: Array.from(selectedDivisions).map(name => ({
            name,
            capacity: divisionCapacities[name] || 8,
            poolCount: divisionPools[name] || 1,
            poolNames: (divisionPoolNames[name] || []).join(','),
            requiresPoolSelection: divisionRequiresPool[name] || false
          })),
          announcement: useWelcomeMsg ? { body: welcomeMsg } : null,
          seedData: seedData,
          scheduleParams: seedData.schedule ? {
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

  async function handleSetStatus(id: string, status: TournamentStatus) {
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

      <div className="table-wrap">
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
            {tournaments.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--white-30)', padding: '2rem' }}>
                  No tournaments yet.
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
                  {t.status === 'active'    && <span className="badge badge-success">● Live</span>}
                  {t.status === 'draft'     && <span className="badge badge-neutral">Draft</span>}
                  {t.status === 'completed' && <span className="badge badge-primary">Completed</span>}
                  {t.status === 'archived'  && <span className="badge badge-neutral">Archived</span>}
                </td>
                <td>
                  <div className="flex gap-1 flex-wrap">
                    {t.status === 'draft' && (
                      <button className="btn btn-outline btn-sm" onClick={() => handleSetStatus(t.id, 'active')} id={`activate-${t.id}`}>
                        Activate
                      </button>
                    )}
                    {t.status === 'active' && (
                      <button className="btn btn-outline btn-sm" onClick={() => handleSetStatus(t.id, 'completed')} id={`complete-${t.id}`}>
                        Complete
                      </button>
                    )}
                    {t.status === 'completed' && (
                      <>
                        <button className="btn btn-outline btn-sm" onClick={() => handleSetStatus(t.id, 'active')} id={`activate-${t.id}`}>
                          Activate
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleSetStatus(t.id, 'archived')} id={`archive-${t.id}`}>
                          Archive
                        </button>
                      </>
                    )}
                    {sealedTournamentIds.has(t.id) ? (
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
                        const newName = f.name.includes('Battle') ? `Battle of the Bats ${y}` : f.name;
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
                    placeholder="Battle of the Bats 2026"
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
                  placeholder="battle-of-the-bats-2026"
                  value={form.slug}
                  onChange={e => {
                    setSlugEdited(true);
                    setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }));
                  }}
                  required
                  id="tournament-slug-input"
                />
                <p style={{ fontSize: '0.7rem', color: 'var(--white-30)', marginTop: '0.25rem' }}>
                  Used in the public URL — /{'{orgSlug}'}/{form.slug || '…'}/schedule
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
                    <label className="form-label">Age divisions & capacities:</label>
                    <div className={styles.divisionGrid}>
                      {['U11', 'U13', 'U15', 'U17', 'U19'].map(div => (
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
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" id="tournament-save-btn">
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
