'use client';
import { useState, useEffect } from 'react';
import { Users, Plus, Pencil, Trash2, X, Check, UserPlus, UserMinus } from 'lucide-react';
import { getTeams, saveTeam, updateTeam, deleteTeam, getAgeGroups } from '@/lib/storage';
import { useTournament } from '@/lib/tournament-context';
import { Team, AgeGroup, Player } from '@/lib/types';
import styles from './teams-admin.module.css';

type ModalMode = 'add' | 'edit' | null;

function makePlayer(): Player {
  return { id: `p-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, name: '', number: '', position: '' };
}

export default function AdminTeamsPage() {
  const { currentTournament } = useTournament();
  const [teams, setTeams]       = useState<Team[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [modal, setModal]       = useState<ModalMode>(null);
  const [editing, setEditing]   = useState<Team | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [form, setForm] = useState({ name: '', coach: '', email: '', ageGroupId: '', players: [makePlayer()] });

  function refresh() {
    setTeams(getTeams(currentTournament?.id));
    const gs = getAgeGroups();
    setAgeGroups(gs);
    if (gs.length && !form.ageGroupId) setForm(f => ({ ...f, ageGroupId: gs[0].id }));
  }
  useEffect(() => { refresh(); }, [currentTournament?.id]); // eslint-disable-line

  function openAdd() {
    setForm({ name: '', coach: '', email: '', ageGroupId: ageGroups[0]?.id ?? '', players: [makePlayer()] });
    setEditing(null);
    setModal('add');
  }

  function openEdit(t: Team) {
    setForm({ name: t.name, coach: t.coach, email: t.email || '', ageGroupId: t.ageGroupId, players: t.players.length ? t.players : [makePlayer()] });
    setEditing(t);
    setModal('edit');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanPlayers = form.players.filter(p => p.name.trim());
    const data = {
      name: form.name.trim(), coach: form.coach.trim(), email: form.email.trim() || undefined,
      ageGroupId: form.ageGroupId, players: cleanPlayers,
      tournamentId: currentTournament?.id ?? '',
    };
    if (modal === 'add') saveTeam(data);
    else if (editing) updateTeam(editing.id, data);
    setModal(null);
    refresh();
  }

  function updatePlayer(idx: number, field: keyof Player, val: string) {
    setForm(f => {
      const players = [...f.players];
      players[idx] = { ...players[idx], [field]: val };
      return { ...f, players };
    });
  }

  const filtered = filterGroup === 'all' ? teams : teams.filter(t => t.ageGroupId === filterGroup);
  const getGroupName = (id: string) => ageGroups.find(g => g.id === id)?.name ?? '—';

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><Users size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Teams</h1>
            <p className={styles.pageSub}>
              {currentTournament
                ? <>Rosters for <strong style={{ color: 'var(--purple-light)' }}>{currentTournament.name}</strong></>
                : 'Manage team registrations and rosters'}
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openAdd} id="team-add-btn" disabled={!currentTournament}>
          <Plus size={16} /> Add Team
        </button>
      </div>

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`tab-btn ${filterGroup === 'all' ? 'active' : ''}`} onClick={() => setFilterGroup('all')}>All</button>
        {ageGroups.map(g => (
          <button key={g.id} className={`tab-btn ${filterGroup === g.id ? 'active' : ''}`}
            onClick={() => setFilterGroup(g.id)}>{g.name}</button>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Team Name</th><th>Division</th><th>Coach</th><th>Email</th><th>Players</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--white-30)', padding: '2rem' }}>
                {currentTournament ? 'No teams for this tournament.' : 'No tournament selected.'}
              </td></tr>
            ) : filtered.map(t => (
              <tr key={t.id}>
                <td><strong>{t.name}</strong></td>
                <td><span className="badge badge-purple">{getGroupName(t.ageGroupId)}</span></td>
                <td>{t.coach || '—'}</td>
                <td><span style={{ fontSize: '0.85rem', color: 'var(--white-60)' }}>{t.email || '—'}</span></td>
                <td>{t.players.length}</td>
                <td>
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)} id={`edit-team-${t.id}`}><Pencil size={13} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(t.id)} id={`delete-team-${t.id}`}><Trash2 size={13} /></button>
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
              <h3>{modal === 'add' ? 'Add Team' : 'Edit Team'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row form-row-3" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Team Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Coach</label>
                  <input className="form-input" value={form.coach} onChange={e => setForm(f => ({ ...f, coach: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Email</label>
                  <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Age Group *</label>
                  <select className="form-select" value={form.ageGroupId} onChange={e => setForm(f => ({ ...f, ageGroupId: e.target.value }))} required>
                    <option value="">Select...</option>
                    {ageGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.rosterSection}>
                <div className={styles.rosterHeader}>
                  <label className="form-label" style={{ margin: 0 }}>Player Roster</label>
                  <button type="button" className="btn btn-ghost btn-sm"
                    onClick={() => setForm(f => ({ ...f, players: [...f.players, makePlayer()] }))}>
                    <UserPlus size={13} /> Add Player
                  </button>
                </div>
                <div className={styles.playerList}>
                  {form.players.map((p, i) => (
                    <div key={p.id} className={styles.playerRow}>
                      <input className="form-input" placeholder="Name" value={p.name} onChange={e => updatePlayer(i, 'name', e.target.value)} />
                      <input className="form-input" placeholder="#" value={p.number} onChange={e => updatePlayer(i, 'number', e.target.value)} style={{ width: 70 }} />
                      <input className="form-input" placeholder="Position" value={p.position} onChange={e => updatePlayer(i, 'position', e.target.value)} style={{ width: 120 }} />
                      <button type="button" className="btn btn-danger btn-sm"
                        onClick={() => setForm(f => ({ ...f, players: f.players.filter((_, j) => j !== i) }))}>
                        <UserMinus size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" id="team-save-btn"><Check size={14} /> Save Team</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Team?</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteId(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--white-60)' }}>This action cannot be undone.</p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { deleteTeam(deleteId); setDeleteId(null); refresh(); }}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
