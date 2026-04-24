'use client';
import { useState, useEffect } from 'react';
import { Calendar, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { getGames, saveGame, updateGame, deleteGame, getTeams, getAgeGroups, getDiamonds } from '@/lib/db';
import { useTournament } from '@/lib/tournament-context';
import { Game, Team, AgeGroup, Diamond } from '@/lib/types';
import styles from './schedule-admin.module.css';

type ModalMode = 'add' | 'edit' | null;

const emptyForm = {
  ageGroupId: '', homeTeamId: '', awayTeamId: '',
  date: '', time: '09:00', location: '', diamondId: '', notes: '',
};

export default function AdminSchedulePage() {
  const { currentTournament } = useTournament();
  const [games, setGames]       = useState<Game[]>([]);
  const [teams, setTeams]       = useState<Team[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [diamonds, setDiamonds] = useState<Diamond[]>([]);
  const [modal, setModal]       = useState<ModalMode>(null);
  const [editing, setEditing]   = useState<Game | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm]         = useState(emptyForm);
  const [filterGroup, setFilterGroup] = useState('all');

  async function refresh() {
    setGames(await getGames(currentTournament?.id));
    setTeams(await getTeams(currentTournament?.id));
    setAgeGroups(await getAgeGroups());
    setDiamonds(await getDiamonds());
  }
  useEffect(() => { refresh(); }, [currentTournament?.id]);

  const groupTeams   = (id: string) => teams.filter(t => t.ageGroupId === id);
  const getTeamName  = (id: string) => teams.find(t => t.id === id)?.name ?? 'TBD';
  const getGroupName = (id: string) => ageGroups.find(g => g.id === id)?.name ?? '—';
  const getDiamondName = (id?: string) => id ? (diamonds.find(d => d.id === id)?.name ?? '') : '';

  function handleDiamondChange(diamondId: string) {
    const diamond = diamonds.find(d => d.id === diamondId);
    setForm(f => ({ ...f, diamondId, location: diamond ? diamond.name : f.location }));
  }

  function openAdd() {
    setForm({ ...emptyForm, ageGroupId: ageGroups[0]?.id ?? '' });
    setEditing(null);
    setModal('add');
  }

  function openEdit(g: Game) {
    setForm({
      ageGroupId: g.ageGroupId, homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId,
      date: g.date, time: g.time, location: g.location,
      diamondId: g.diamondId ?? '', notes: g.notes ?? '',
    });
    setEditing(g);
    setModal('edit');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data: Omit<Game, 'id'> = {
      tournamentId: currentTournament?.id ?? '',
      ageGroupId:  form.ageGroupId,
      homeTeamId:  form.homeTeamId,
      awayTeamId:  form.awayTeamId,
      date:        form.date,
      time:        form.time,
      location:    form.location,
      diamondId:   form.diamondId || undefined,
      notes:       form.notes || undefined,
      status:      'scheduled',
    };
    if (modal === 'add') await saveGame(data);
    else if (editing) await updateGame(editing.id, data);
    setModal(null);
    refresh();
  }

  const scheduled = games.filter(g => g.status === 'scheduled');
  const filtered  = filterGroup === 'all' ? scheduled : scheduled.filter(g => g.ageGroupId === filterGroup);

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><Calendar size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Schedule</h1>
            <p className={styles.pageSub}>
              {currentTournament
                ? <>Games for <strong style={{ color: 'var(--purple-light)' }}>{currentTournament.name}</strong></>
                : 'Create and manage the game schedule'}
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openAdd} id="schedule-add-btn" disabled={!currentTournament}>
          <Plus size={16} /> Add Game
        </button>
      </div>

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`tab-btn ${filterGroup === 'all' ? 'active' : ''}`} onClick={() => setFilterGroup('all')}>All</button>
        {ageGroups.map(g => (
          <button key={g.id} className={`tab-btn ${filterGroup === g.id ? 'active' : ''}`} onClick={() => setFilterGroup(g.id)}>{g.name}</button>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Date</th><th>Time</th><th>Division</th><th>Home</th><th>Away</th><th>Diamond / Location</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--white-30)', padding: '2rem' }}>
                {currentTournament ? 'No games scheduled yet.' : 'No tournament selected.'}
              </td></tr>
            ) : filtered.map(g => (
              <tr key={g.id}>
                <td>{formatDate(g.date)}</td>
                <td>{g.time}</td>
                <td><span className="badge badge-purple">{getGroupName(g.ageGroupId)}</span></td>
                <td>{getTeamName(g.homeTeamId)}</td>
                <td>{getTeamName(g.awayTeamId)}</td>
                <td style={{ fontSize: '0.875rem', color: 'var(--white-60)' }}>
                  {g.diamondId ? getDiamondName(g.diamondId) : g.location}
                </td>
                <td>
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(g)}><Pencil size={13} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(g.id)}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'add' ? 'Add Game' : 'Edit Game'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row form-row-3" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Division *</label>
                  <select className="form-select" value={form.ageGroupId}
                    onChange={e => setForm(f => ({ ...f, ageGroupId: e.target.value, homeTeamId: '', awayTeamId: '' }))} required>
                    <option value="">Select...</option>
                    {ageGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input className="form-input" type="date" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Time *</label>
                  <input className="form-input" type="time" value={form.time}
                    onChange={e => setForm(f => ({ ...f, time: e.target.value }))} required />
                </div>
              </div>
              <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Home Team *</label>
                  <select className="form-select" value={form.homeTeamId}
                    onChange={e => setForm(f => ({ ...f, homeTeamId: e.target.value }))} required>
                    <option value="">Select...</option>
                    {groupTeams(form.ageGroupId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Away Team *</label>
                  <select className="form-select" value={form.awayTeamId}
                    onChange={e => setForm(f => ({ ...f, awayTeamId: e.target.value }))} required>
                    <option value="">Select...</option>
                    {groupTeams(form.ageGroupId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Diamond</label>
                  <select className="form-select" value={form.diamondId} onChange={e => handleDiamondChange(e.target.value)}>
                    <option value="">— Custom location —</option>
                    {diamonds.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Location Name *</label>
                  <input className="form-input" placeholder="Field name / address" value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))} required />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                <label className="form-label">Notes (optional)</label>
                <input className="form-input" placeholder="Any additional info" value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" id="schedule-save-btn"><Check size={14} /> Save Game</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Remove Game?</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteId(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--white-60)' }}>This will permanently remove the game from the schedule.</p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={async () => { await deleteGame(deleteId); setDeleteId(null); refresh(); }}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
