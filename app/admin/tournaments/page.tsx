'use client';
import { useState, useEffect } from 'react';
import { RefreshCw, Plus, Check, X, Trash2, Pencil, Star } from 'lucide-react';
import { 
  getTournaments, saveTournament, updateTournament, deleteTournament, setActiveTournament,
  getContacts, getDiamonds, cloneContacts, cloneDiamonds, initializeAgeGroups, saveAnnouncement
} from '@/lib/db';
import { useTournament } from '@/lib/tournament-context';
import { Tournament, Contact } from '@/lib/types';
import styles from './tournaments-admin.module.css';

type ModalMode = 'add' | 'edit' | null;

export default function AdminTournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [modal, setModal]       = useState<ModalMode>(null);
  const [editing, setEditing]   = useState<Tournament | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm]         = useState({ year: String(new Date().getFullYear()), name: '', isActive: false });
  const { refresh: refreshCtx } = useTournament();

  // Migration / Initialization states
  const [sourceTournamentId, setSourceTournamentId] = useState<string>('');
  const [sourceContacts, setSourceContacts]         = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [migrateDiamonds, setMigrateDiamonds]       = useState(false);
  const [selectedDivisions, setSelectedDivisions]   = useState<Set<string>>(new Set(['U11', 'U13', 'U15', 'U17', 'U19']));
  const [useWelcomeMsg, setUseWelcomeMsg]           = useState(true);
  const [welcomeMsg, setWelcomeMsg]                 = useState('Welcome to the Battle of the Bats tournament! We are excited to have you join us for another great season of competitive youth softball.');

  async function refresh() {
    setTournaments(await getTournaments());
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
    setForm({ year: String(nextYear), name: `Battle of the Bats ${nextYear}`, isActive: false });
    setEditing(null);
    setSourceTournamentId('');
    setMigrateDiamonds(false);
    setSelectedDivisions(new Set(['U11', 'U13', 'U15', 'U17', 'U19']));
    setUseWelcomeMsg(true);
    setWelcomeMsg('Welcome to the Battle of the Bats tournament! We are excited to have you join us for another great season of competitive youth softball.');
    setModal('add');
  }

  function openEdit(t: Tournament) {
    setForm({ year: String(t.year), name: t.name, isActive: t.isActive });
    setEditing(t);
    setModal('edit');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = { year: Number(form.year), name: form.name.trim(), isActive: form.isActive };
    
    if (modal === 'add') {
      const newTournament = await saveTournament(data);
      if (newTournament) {
        const tid = newTournament.id;
        
        // 1. Migration
        if (sourceTournamentId) {
          if (selectedContactIds.size > 0) {
            const contactsToClone = sourceContacts.filter(c => selectedContactIds.has(c.id));
            await cloneContacts(tid, contactsToClone);
          }
          if (migrateDiamonds) {
            const sourceDiamonds = await getDiamonds(sourceTournamentId);
            await cloneDiamonds(tid, sourceDiamonds);
          }
        }
        
        // 2. Age Groups
        if (selectedDivisions.size > 0) {
          await initializeAgeGroups(tid, Array.from(selectedDivisions));
        }
        
        // 3. Welcome Announcement
        if (useWelcomeMsg && welcomeMsg.trim()) {
          await saveAnnouncement({
            tournamentId: tid,
            title: 'Welcome!',
            body: welcomeMsg.trim(),
            date: new Date().toISOString(),
            pinned: true
          });
        }
      }
    } else if (editing) {
      await updateTournament(editing.id, data);
    }
    
    setModal(null);
    refresh();
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
    else next.add(name);
    setSelectedDivisions(next);
  }

  async function handleSetActive(id: string) {
    await setActiveTournament(id);
    refresh();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const t = tournaments.find(x => x.id === deleteId);
    if (t?.isActive) return; // safety: can't delete the active tournament
    await deleteTournament(deleteId);
    setDeleteId(null);
    refresh();
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
        <button className="btn btn-primary" onClick={openAdd} id="tournament-add-btn">
          <Plus size={16} /> New Tournament
        </button>
      </div>

      {/* Info card */}
      <div className={styles.infoCard}>
        <Star size={14} style={{ color: 'var(--purple-light)', flexShrink: 0, marginTop: 2 }} />
        <p>
          The <strong>Live</strong> tournament is shown on the public site. Switch between tournaments in the sidebar
          to manage teams, schedules, and results for a specific year without affecting other seasons.
          Age groups and diamond locations are shared across all tournaments.
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
                  <span className="badge badge-purple">{t.year}</span>
                </td>
                <td>
                  {t.isActive
                    ? <span className="badge badge-success">● Live</span>
                    : <span className="badge badge-neutral">Archived</span>}
                </td>
                <td>
                  <div className="flex gap-1">
                    {!t.isActive && (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleSetActive(t.id)}
                        id={`set-live-${t.id}`}
                      >
                        Set Live
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)} id={`edit-tournament-${t.id}`}>
                      <Pencil size={13} />
                    </button>
                    {!t.isActive && (
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
                      setForm(f => ({ ...f, year: y, name: f.name.includes('Battle') ? `Battle of the Bats ${y}` : f.name }));
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
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                    id="tournament-name-input"
                  />
                </div>
              </div>
              <div className={styles.activeToggle}>
                <input
                  type="checkbox"
                  id="tournament-active"
                  checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                />
                <label htmlFor="tournament-active">
                  <Star size={13} /> Set as the live (public) tournament
                </label>
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
                    <label className="form-label">Initialize age divisions:</label>
                    <div className={styles.divisionCheckboxes}>
                      {['U11', 'U13', 'U15', 'U17', 'U19'].map(div => (
                        <label key={div} className={styles.checkboxLabel}>
                          <input 
                            type="checkbox" 
                            checked={selectedDivisions.has(div)}
                            onChange={() => toggleDivision(div)}
                          />
                          {div}
                        </label>
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
