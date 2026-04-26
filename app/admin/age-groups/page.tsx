'use client';
import { useState, useEffect } from 'react';
import { Tag, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { getAgeGroups, saveAgeGroup, updateAgeGroup, deleteAgeGroup, getContacts } from '@/lib/db';
import { useTournament } from '@/lib/tournament-context';
import { AgeGroup, Contact } from '@/lib/types';
import styles from './admin-page.module.css';

type ModalMode = 'add' | 'edit' | null;

export default function AgeGroupsPage() {
  const { currentTournament } = useTournament();
  const [groups, setGroups] = useState<AgeGroup[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [modal, setModal] = useState<ModalMode>(null);
  const [editing, setEditing] = useState<AgeGroup | null>(null);
  const [form, setForm] = useState({ 
    name: '', minAge: '', maxAge: '', order: '', contactId: '', 
    capacity: '', isClosed: false, poolCount: '1', poolNames: '' 
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function refresh() { 
    setGroups(await getAgeGroups(currentTournament?.id)); 
    setContacts(await getContacts(currentTournament?.id));
  }
  useEffect(() => { refresh(); }, [currentTournament?.id]);

  function openAdd() {
    setForm({ 
      name: '', minAge: '', maxAge: '', order: String(groups.length + 1), 
      contactId: '', capacity: '', isClosed: false, poolCount: '1', poolNames: '' 
    });
    setEditing(null);
    setModal('add');
  }

  function openEdit(g: AgeGroup) {
    setForm({ 
      name: g.name, minAge: String(g.minAge), maxAge: String(g.maxAge), 
      order: String(g.order), contactId: g.contactId || '',
      capacity: g.capacity ? String(g.capacity) : '', isClosed: !!g.isClosed,
      poolCount: String(g.poolCount || 1), poolNames: g.poolNames || ''
    });
    setEditing(g);
    setModal('edit');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTournament) return;
    const data: Omit<AgeGroup, 'id'> = { 
      tournamentId: currentTournament.id,
      name: form.name.trim(), 
      minAge: Number(form.minAge), 
      maxAge: Number(form.maxAge), 
      order: Number(form.order),
      contactId: form.contactId || undefined,
      capacity: form.capacity ? Number(form.capacity) : undefined,
      isClosed: form.isClosed,
      poolCount: Number(form.poolCount),
      poolNames: form.poolNames.trim() || undefined
    };
    if (modal === 'add') await saveAgeGroup(data);
    else if (editing) await updateAgeGroup(editing.id, data);
    setModal(null);
    refresh();
  }

  async function handleDelete() {
    if (deleteId) { await deleteAgeGroup(deleteId); setDeleteId(null); refresh(); }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><Tag size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Age Groups</h1>
            <p className={styles.pageSub}>Manage tournament age divisions</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openAdd} id="age-group-add-btn" disabled={!currentTournament}>
          <Plus size={16} /> Add Age Group
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Division</th>
              <th>Min Age</th>
              <th>Max Age</th>
              <th>Display Order</th>
              <th>Capacity</th>
              <th>Status</th>
              <th>Contact</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--white-30)', padding: '2rem' }}>No age groups yet. Add one to get started.</td></tr>
            ) : groups.map(g => (
              <tr key={g.id}>
                <td><span className="badge badge-purple" style={{ fontSize: '0.875rem' }}>{g.name}</span></td>
                <td>{g.minAge}</td>
                <td>{g.maxAge}</td>
                <td>{g.order}</td>
                <td>{g.capacity || '—'}</td>
                <td>
                  {g.isClosed ? <span className="badge badge-danger">Closed</span> : <span className="badge badge-success">Open</span>}
                </td>
                <td>
                  <span style={{ fontSize: '0.85rem', color: 'var(--white-60)' }}>
                    {contacts.find(c => c.id === g.contactId)?.name || '—'}
                  </span>
                </td>
                <td>
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(g)} id={`edit-age-group-${g.id}`}><Pencil size={13} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(g.id)} id={`delete-age-group-${g.id}`}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal === 'add' ? 'Add Age Group' : 'Edit Age Group'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row form-row-2" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Division Name *</label>
                  <input className="form-input" placeholder="e.g. U13" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Display Order *</label>
                  <input className="form-input" type="number" min="1" value={form.order}
                    onChange={e => setForm(f => ({ ...f, order: e.target.value }))} required />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Division Contact (Optional)</label>
                <select className="form-select" value={form.contactId} onChange={e => setForm(f => ({ ...f, contactId: e.target.value }))}>
                  <option value="">Default Admin Email</option>
                  {contacts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
                </select>
                <p className="form-help" style={{ fontSize: '0.75rem', color: 'var(--white-30)', marginTop: '0.25rem' }}>
                  If selected, new team registration notifications for this division will be sent to this contact instead of the default admin email.
                </p>
              </div>
              <div className="form-row form-row-2" style={{ marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Min Age *</label>
                  <input className="form-input" type="number" value={form.minAge}
                    onChange={e => setForm(f => ({ ...f, minAge: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Age *</label>
                  <input className="form-input" type="number" value={form.maxAge}
                    onChange={e => setForm(f => ({ ...f, maxAge: e.target.value }))} required />
                </div>
              </div>
              <div className="form-row form-row-2" style={{ marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Number of Pools</label>
                  <input className="form-input" type="number" min="1" value={form.poolCount}
                    onChange={e => setForm(f => ({ ...f, poolCount: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Custom Pool Names (Optional)</label>
                  <input className="form-input" placeholder="e.g. Gold, Silver, Bronze" value={form.poolNames}
                    onChange={e => setForm(f => ({ ...f, poolNames: e.target.value }))} />
                  <p className="form-help" style={{ fontSize: '0.75rem', color: 'var(--white-30)', marginTop: '0.25rem' }}>
                    Separate names with commas. Defaults to A, B, C...
                  </p>
                </div>
              </div>

              <div className="form-row form-row-2" style={{ marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Capacity (Max Teams)</label>
                  <input className="form-input" type="number" placeholder="e.g. 8" value={form.capacity}
                    onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1rem' }}>
                    <input type="checkbox" checked={form.isClosed} onChange={e => setForm(f => ({ ...f, isClosed: e.target.checked }))} style={{ width: 16, height: 16 }} />
                    <span style={{ fontWeight: 500 }}>Close Registration</span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" id="age-group-save-btn"><Check size={14} /> Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Age Group?</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteId(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--white-60)', marginBottom: '0.5rem' }}>
              This will permanently delete this age group. Teams, games, and results in this group will remain but lose their division link.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} id="confirm-delete-age-group"><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
