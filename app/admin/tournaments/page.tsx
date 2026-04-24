'use client';
import { useState, useEffect } from 'react';
import { RefreshCw, Plus, Check, X, Trash2, Pencil, Star } from 'lucide-react';
import { getTournaments, saveTournament, updateTournament, deleteTournament, setActiveTournament } from '@/lib/db';
import { useTournament } from '@/lib/tournament-context';
import { Tournament } from '@/lib/types';
import styles from './tournaments-admin.module.css';

type ModalMode = 'add' | 'edit' | null;

export default function AdminTournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [modal, setModal]       = useState<ModalMode>(null);
  const [editing, setEditing]   = useState<Tournament | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm]         = useState({ year: String(new Date().getFullYear()), name: '', isActive: false });
  const { refresh: refreshCtx } = useTournament();

  async function refresh() {
    setTournaments(await getTournaments());
    await refreshCtx();
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line

  function openAdd() {
    const nextYear = new Date().getFullYear();
    setForm({ year: String(nextYear), name: `Battle of the Bats ${nextYear}`, isActive: false });
    setEditing(null);
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
    if (modal === 'add') await saveTournament(data);
    else if (editing) await updateTournament(editing.id, data);
    setModal(null);
    refresh();
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
