'use client';
import { useState, useEffect } from 'react';
import { Tag, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { getAgeGroups, saveAgeGroup, updateAgeGroup, deleteAgeGroup } from '@/lib/storage';
import { AgeGroup } from '@/lib/types';
import styles from './admin-page.module.css';

type ModalMode = 'add' | 'edit' | null;

export default function AgeGroupsPage() {
  const [groups, setGroups] = useState<AgeGroup[]>([]);
  const [modal, setModal] = useState<ModalMode>(null);
  const [editing, setEditing] = useState<AgeGroup | null>(null);
  const [form, setForm] = useState({ name: '', minAge: '', maxAge: '', order: '', contactEmail: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function refresh() { setGroups(getAgeGroups()); }
  useEffect(refresh, []);

  function openAdd() {
    setForm({ name: '', minAge: '', maxAge: '', order: String(groups.length + 1), contactEmail: '' });
    setEditing(null);
    setModal('add');
  }

  function openEdit(g: AgeGroup) {
    setForm({ name: g.name, minAge: String(g.minAge), maxAge: String(g.maxAge), order: String(g.order), contactEmail: g.contactEmail || '' });
    setEditing(g);
    setModal('edit');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = { 
      name: form.name.trim(), 
      minAge: Number(form.minAge), 
      maxAge: Number(form.maxAge), 
      order: Number(form.order),
      contactEmail: form.contactEmail.trim() || undefined
    };
    if (modal === 'add') saveAgeGroup(data);
    else if (editing) updateAgeGroup(editing.id, data);
    setModal(null);
    refresh();
  }

  function handleDelete() {
    if (deleteId) { deleteAgeGroup(deleteId); setDeleteId(null); refresh(); }
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
        <button className="btn btn-primary" onClick={openAdd} id="age-group-add-btn">
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
              <th>Contact Email</th>
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
                <td><span style={{ fontSize: '0.85rem', color: 'var(--white-60)' }}>{g.contactEmail || '—'}</span></td>
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
                <label className="form-label">Contact Email (Optional)</label>
                <input className="form-input" type="email" placeholder="e.g. division@miltonbats.com" value={form.contactEmail}
                  onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
                <p className="form-help" style={{ fontSize: '0.75rem', color: 'var(--white-30)', marginTop: '0.25rem' }}>
                  If provided, new team registration notifications for this division will be sent here instead of the default admin email.
                </p>
              </div>
              <div className="form-row form-row-2" style={{ marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Min Age *</label>
                  <input className="form-input" type="number" min="0" value={form.minAge}
                    onChange={e => setForm(f => ({ ...f, minAge: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Age *</label>
                  <input className="form-input" type="number" min="0" value={form.maxAge}
                    onChange={e => setForm(f => ({ ...f, maxAge: e.target.value }))} required />
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
