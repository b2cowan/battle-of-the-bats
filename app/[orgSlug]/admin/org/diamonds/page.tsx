'use client';
import { useState, useCallback, useEffect } from 'react';
import { MapPin, Plus, Pencil, Trash2, X, Check, ExternalLink } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { Diamond } from '@/lib/types';
import { getMapsUrl } from '@/components/LocationLink';
import styles from './diamonds-admin.module.css';

type ModalMode = 'add' | 'edit' | null;

const CANADIAN_PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];

const emptyForm = { name: '', street: '', city: '', province: '', postalCode: '', notes: '' };

function buildAddress(street: string, city: string, province: string, postalCode: string): string {
  const cityLine = [city, province, postalCode].filter(Boolean).join(' ');
  return [street, cityLine].filter(Boolean).join(', ');
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? 'Request failed');
  return data as T;
}

export default function AdminDiamondsPage() {
  const { currentTournament } = useTournament();
  const [diamonds, setDiamonds] = useState<Diamond[]>([]);
  const [modal, setModal]       = useState<ModalMode>(null);
  const [editing, setEditing]   = useState<Diamond | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm]         = useState(emptyForm);

  const refresh = useCallback(async () => {
    if (!currentTournament) {
      setDiamonds([]);
      return;
    }
    const rows = await requestJson<Diamond[]>(`/api/admin/diamonds?tournamentId=${currentTournament.id}`);
    setDiamonds(rows);
  }, [currentTournament]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  function openAdd() {
    setForm(emptyForm);
    setEditing(null);
    setModal('add');
  }

  function openEdit(d: Diamond) {
    // Pre-populate street with the full existing address string; other fields blank
    setForm({ name: d.name, street: d.address, city: '', province: '', postalCode: '', notes: d.notes ?? '' });
    setEditing(d);
    setModal('edit');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTournament) return;
    const address = buildAddress(form.street.trim(), form.city.trim(), form.province.trim(), form.postalCode.trim());
    const data = { tournamentId: currentTournament.id, name: form.name.trim(), address, notes: form.notes.trim() || undefined };
    if (modal === 'add') {
      await requestJson<{ success: boolean }>('/api/admin/diamonds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', data }),
      });
    } else if (editing) {
      await requestJson<{ success: boolean }>('/api/admin/diamonds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: editing.id, data }),
      });
    }
    setModal(null);
    refresh();
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><MapPin size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Venue Locations</h1>
            <p className={styles.pageSub}>Manage playing fields — names, addresses, and notes</p>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd} id="diamond-add-btn" disabled={!currentTournament}>
          <Plus size={16} /> Add Venue
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Venue Name</th>
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
                  No venues yet. Add one to get started.
                </td>
              </tr>
            ) : diamonds.map(d => (
              <tr key={d.id}>
                <td>
                  <div className={styles.diamondName}>
                    <MapPin size={13} style={{ color: 'var(--logic-lime)', flexShrink: 0 }} />
                    <strong>{d.name}</strong>
                  </div>
                </td>
                <td style={{ color: 'var(--white-60)', fontSize: '0.875rem' }}>{d.address}</td>
                <td style={{ color: 'var(--white-60)', fontSize: '0.875rem' }}>{d.notes || '—'}</td>
                <td>
                  <a
                    href={getMapsUrl(d.address || d.name)}
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
              <h3>{modal === 'add' ? 'Add Venue' : 'Edit Venue'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Venue Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Lions Park — Diamond 1"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  id="diamond-name-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Street Address</label>
                <input
                  className="form-input"
                  placeholder="123 Main St"
                  value={form.street}
                  onChange={e => setForm(f => ({ ...f, street: e.target.value }))}
                  id="diamond-street-input"
                />
              </div>

              <div className="form-row form-row-2" style={{ marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input
                    className="form-input"
                    placeholder="Milton"
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    id="diamond-city-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Province</label>
                  <select
                    className="form-select"
                    value={form.province}
                    onChange={e => setForm(f => ({ ...f, province: e.target.value }))}
                    id="diamond-province-input"
                  >
                    <option value="">Select province</option>
                    {CANADIAN_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Postal Code</label>
                <input
                  className="form-input"
                  placeholder="A1A 1A1"
                  value={form.postalCode}
                  onChange={e => setForm(f => ({ ...f, postalCode: e.target.value.toUpperCase() }))}
                  id="diamond-postal-input"
                  style={{ maxWidth: '160px' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--white-30)', marginTop: '0.25rem', display: 'block' }}>
                  Used to generate a Google Maps link throughout the site.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                <label className="form-label">Notes</label>
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
                  <Check size={14} /> Save Venue
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
              <h3>Delete Venue?</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteId(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--white-60)' }}>
              Games linked to this venue will retain their location name but lose the Maps link.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button
                className="btn btn-danger"
                id="confirm-delete-diamond"
                onClick={async () => {
                  await requestJson<{ success: boolean }>('/api/admin/diamonds', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete', id: deleteId }),
                  });
                  setDeleteId(null);
                  refresh();
                }}
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
