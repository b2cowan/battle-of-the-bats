'use client';
import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { Diamond } from '@/lib/types';

const CANADIAN_PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];

function buildAddress(street: string, city: string, province: string, postalCode: string): string {
  const cityLine = [city, province, postalCode].filter(Boolean).join(' ');
  return [street, cityLine].filter(Boolean).join(', ');
}

interface Props {
  tournamentId: string;
  onClose: () => void;
  /** Called with the saved Diamond after a successful save. */
  onSaved: (venue: Diamond) => void;
  /** Supply an existing Diamond to switch into edit mode. */
  existing?: Diamond;
  zIndex?: number;
}

export default function AddVenueModal({ tournamentId, onClose, onSaved, existing, zIndex = 1100 }: Props) {
  const isEdit = !!existing;
  const [form, setForm] = useState({
    name:       existing?.name       ?? '',
    street:     existing?.address    ?? '',
    city:       '',
    province:   '',
    postalCode: '',
    notes:      existing?.notes      ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);

    const address = buildAddress(
      form.street.trim(), form.city.trim(), form.province.trim(), form.postalCode.trim()
    );
    const payload = {
      action: isEdit ? 'update' : 'save',
      ...(isEdit ? { id: existing!.id } : {}),
      data: {
        tournamentId,
        name:    form.name.trim(),
        address: address || null,
        notes:   form.notes.trim() || null,
      },
    };

    await fetch('/api/admin/diamonds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Re-fetch the list and hand the saved record back to the caller.
    const listRes = await fetch(`/api/admin/diamonds?tournamentId=${encodeURIComponent(tournamentId)}`);
    const updated: Diamond[] = listRes.ok ? await listRes.json() : [];
    const saved = isEdit
      ? updated.find(d => d.id === existing!.id)
      : updated.find(d => d.name === form.name.trim());

    setSaving(false);
    if (saved) onSaved(saved);
    else onClose();
  }

  return (
    <div className="modal-overlay" style={{ zIndex }} onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Venue' : 'Add Venue'}</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
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
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label className="form-label">Street Address</label>
            <input
              className="form-input"
              placeholder="123 Main St"
              value={form.street}
              onChange={e => setForm(f => ({ ...f, street: e.target.value }))}
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
              />
            </div>
            <div className="form-group">
              <label className="form-label">Province</label>
              <select
                className="form-select"
                value={form.province}
                onChange={e => setForm(f => ({ ...f, province: e.target.value }))}
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
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!form.name.trim() || saving}>
              <Check size={14} /> {saving ? 'Saving…' : 'Save Venue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
