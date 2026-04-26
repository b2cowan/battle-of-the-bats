'use client';
import { useState, useEffect } from 'react';
import { Users, Plus, Pencil, Trash2, X, Check, UserPlus, UserMinus, Download } from 'lucide-react';
import { getTeams, saveTeam, updateTeam, deleteTeam, getAgeGroups } from '@/lib/db';
import { downloadCSV } from '@/lib/utils';
import { useTournament } from '@/lib/tournament-context';
import { Team, AgeGroup } from '@/lib/types';
import styles from './teams-admin.module.css';

type ModalMode = 'add' | 'edit' | null;



export default function AdminTeamsPage() {
  const { currentTournament } = useTournament();
  const [teams, setTeams]       = useState<Team[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [modal, setModal]       = useState<ModalMode>(null);
  const [editing, setEditing]   = useState<Team | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [form, setForm] = useState({ name: '', coach: '', email: '', ageGroupId: '', pool: '' });

  async function refresh() {
    setTeams(await getTeams(currentTournament?.id));
    const gs = await getAgeGroups(currentTournament?.id);
    setAgeGroups(gs);
    if (gs.length && !form.ageGroupId) setForm(f => ({ ...f, ageGroupId: gs[0].id }));
  }
  useEffect(() => { refresh(); }, [currentTournament?.id]); // eslint-disable-line

  function openAdd() {
    setForm({ name: '', coach: '', email: '', ageGroupId: ageGroups[0]?.id ?? '', pool: '' });
    setEditing(null);
    setModal('add');
  }

  function openEdit(t: Team) {
    setForm({ name: t.name, coach: t.coach, email: t.email || '', ageGroupId: t.ageGroupId, pool: t.pool || '' });
    setEditing(t);
    setModal('edit');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name: form.name.trim(), 
      coach: form.coach.trim(), 
      email: form.email.trim() || undefined,
      ageGroupId: form.ageGroupId, 
      pool: form.pool || undefined,
      players: [], 
      tournamentId: currentTournament?.id ?? '',
    };
    if (modal === 'add') await saveTeam(data);
    else if (editing) await updateTeam(editing.id, data);
    setModal(null);
    refresh();
  }



  const filtered = filterGroup === 'all' ? teams : teams.filter(t => t.ageGroupId === filterGroup);
  const getGroupName = (id: string) => ageGroups.find(g => g.id === id)?.name ?? '—';

  function exportToCSV() {
    const headers = ['Team Name', 'Division', 'Coach', 'Email'];
    const rows = filtered.map(t => [
      t.name,
      getGroupName(t.ageGroupId),
      t.coach,
      t.email
    ]);
    const filename = `teams-${currentTournament?.year || 'all'}-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(filename, headers, rows);
  }

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
        <div className="flex gap-1">
          <button className="btn btn-outline btn-sm" onClick={exportToCSV} id="teams-export-btn" disabled={filtered.length === 0}>
            <Download size={14} /> Export CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={openAdd} id="team-add-btn" disabled={!currentTournament}>
            <Plus size={16} /> Add Team
          </button>
        </div>
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
            <tr><th>Team Name</th><th>Division</th><th>Pool</th><th>Coach</th><th>Email</th><th>Actions</th></tr>
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
                <td>{t.pool || '—'}</td>
                <td>{t.coach || '—'}</td>
                <td><span style={{ fontSize: '0.85rem', color: 'var(--white-60)' }}>{t.email || '—'}</span></td>
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
                <div className="form-group">
                  <label className="form-label">Age Group *</label>
                  <select className="form-select" value={form.ageGroupId} onChange={e => setForm(f => ({ ...f, ageGroupId: e.target.value }))} required>
                    <option value="">Select...</option>
                    {ageGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Pool</label>
                  <select className="form-select" value={form.pool} onChange={e => setForm(f => ({ ...f, pool: e.target.value }))}>
                    <option value="">No Pool</option>
                    {(() => {
                      const group = ageGroups.find(g => g.id === form.ageGroupId);
                      if (!group || !group.poolCount || group.poolCount <= 1) return null;
                      
                      const names = group.poolNames ? group.poolNames.split(',').map(n => n.trim()) : [];
                      return Array.from({ length: group.poolCount }).map((_, i) => {
                        const val = names[i] || String.fromCharCode(65 + i);
                        return <option key={val} value={val}>{val}</option>;
                      });
                    })()}
                  </select>
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
              <button className="btn btn-danger" onClick={async () => { await deleteTeam(deleteId); setDeleteId(null); refresh(); }}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
