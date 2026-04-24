'use client';
import { useState, useEffect } from 'react';
import { MapPin, Plus, Pencil, Trash2, X, Check, ExternalLink } from 'lucide-react';
import { getDiamonds, saveDiamond, updateDiamond, deleteDiamond } from '@/lib/db';
import { Diamond } from '@/lib/types';
import { getMapsUrl } from '@/components/LocationLink';
import styles from './diamonds-admin.module.css';

type ModalMode = 'add' | 'edit' | null;

const emptyForm = { name: '', address: '', notes: '' };

export default function AdminDiamondsPage() {
  const [diamonds, setDiamonds] = useState<Diamond[]>([]);
  const [modal, setModal]       = useState<ModalMode>(null);
  const [editing, setEditing]   = useState<Diamond | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm]         = useState(emptyForm);

  async function refresh() { setDiamonds(await getDiamonds()); }
  useEffect(() => { refresh(); }, []);

  function openAdd() {
    setForm(emptyForm);
    setEditing(null);
    setModal('add');
  }

  function openEdit(d: Diamond) {
    setForm({ name: d.name, address: d.address, notes: d.notes ?? '' });
    setEditing(d);
    setModal('edit');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = { name: form.name.trim(), address: form.address.trim(), notes: form.notes.trim() || undefined };
    if (modal === 'add') await saveDiamond(data);
    else if (editing) await updateDiamond(editing.id, data);
    setModal(null);
    refresh();
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><MapPin size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Diamond Locations</h1>
            <p className={styles.pageSub}>Manage playing fields — names, addresses, and notes</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openAdd} id="diamond-add-btn">
          <Plus size={16} /> Add Diamond
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Diamond Name</th>
              <th>Address</th>
              <th>Notes</th>
              <th>Maps</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {diamonds.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--white-30)', padding: '2rem' }}>
                  No diamonds yet. Add one to get started.
                </td>
              </tr>
            ) : diamonds.map(d => (
              <tr key={d.id}>
                <td>
                  <div className={styles.diamondName}>
                    <MapPin size={13} style={{ color: 'var(--purple-light)', flexShrink: 0 }} />
                    <strong>{d.name}</strong>
                  </div>
                </td>
                <td style={{ color: 'var(--white-60)', fontSize: '0.875rem' }}>{d.address}</td>
                <td style={{ color: 'var(--white-60)', fontSize: '0.875rem' }}>{d.notes || '—'}</td>
                <td>
                  <a
                    href={getMapsUrl(d.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                    title="Open in Google Maps"
                    id={`maps-diamond-${d.id}`}
                  >
                    <ExternalLink size={13} /> Maps
                  </a>
                </td>
                <td>
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(d)} id={`edit-diamond-${d.id}`}>
                      <Pencil size={13} />
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(d.id)} id={`delete-diamond-${d.id}`}>
                      <Trash2 size={13} />
                    </button>
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
              <h3>{modal === 'add' ? 'Add Diamond' : 'Edit Diamond'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Diamond Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Diamond 1 — Lions Park"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  id="diamond-name-input"
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Full Address *</label>
                <input
                  className="form-input"
                  placeholder="e.g. 123 Main St, Milton, ON L9T 2M3"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  required
                  id="diamond-address-input"
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--white-30)', marginTop: '0.25rem' }}>
                  Used to generate a Google Maps link throughout the site.
                </span>
              </div>
              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                <label className="form-label">Notes (optional)</label>
                <textarea
                  className="form-textarea"
                  placeholder="Parking info, directions, field-specific rules…"
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  id="diamond-notes-input"
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" id="diamond-save-btn">
                  <Check size={14} /> Save Diamond
                </button>
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
              <h3>Delete Diamond?</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteId(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--white-60)' }}>
              Games linked to this diamond will retain their location name but lose the Maps link.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button
                className="btn btn-danger"
                id="confirm-delete-diamond"
                onClick={async () => { await deleteDiamond(deleteId); setDeleteId(null); refresh(); }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
