'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  MapPin, Plus, Pencil, Trash2, X, Check,
  ChevronRight, ExternalLink,
} from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { getMapsUrl } from '@/components/LocationLink';
import type { OrgVenue, OrgVenueFacility, FacilityType } from '@/lib/types';
import { FACILITY_TYPE_LABELS, FACILITY_TYPES } from '@/lib/types';
import styles from './venues-admin.module.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? 'Request failed');
  return data as T;
}

// ---------------------------------------------------------------------------
// Add / Edit Venue Modal
// ---------------------------------------------------------------------------

function VenueModal({
  orgSlug,
  existing,
  onClose,
  onSaved,
}: {
  orgSlug?: string;
  existing?: OrgVenue;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!existing;
  const [name, setName]       = useState(existing?.name    ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [notes, setNotes]     = useState(existing?.notes   ?? '');
  const [saving, setSaving]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
    try {
      await requestJson(`/api/admin/org/venues${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isEdit ? 'update-venue' : 'save-venue',
          ...(isEdit ? { id: existing!.id } : {}),
          data: {
            name:    name.trim(),
            address: address.trim() || null,
            notes:   notes.trim()   || null,
          },
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Venue' : 'Add Venue'}</h3>
          <button type="button" className="btn btn-ghost btn-data" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Venue Name *</label>
            <input
              className="form-input"
              placeholder="e.g. Lions Park, Canlan Ice Sports"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Address</label>
            <input
              className="form-input"
              placeholder="123 Main St, Milton ON L9T 2P7"
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--white-30)', marginTop: '0.25rem', display: 'block' }}>
              Used for Google Maps links on schedules.
            </span>
          </div>
          <div className="form-group" style={{ marginBottom: '0.5rem' }}>
            <label className="form-label">Notes</label>
            <textarea
              className="form-textarea"
              placeholder="Parking info, gate access, directions…"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost btn-data" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-data" disabled={!name.trim() || saving}>
              <Check size={14} /> {saving ? 'Saving…' : 'Save Venue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline Add-Facility row
// ---------------------------------------------------------------------------

function AddFacilityRow({
  orgSlug,
  orgVenueId,
  existingFacilities,
  onAdded,
}: {
  orgSlug?: string;
  orgVenueId: string;
  existingFacilities: OrgVenueFacility[];
  onAdded: () => void;
}) {
  const [name, setName]               = useState('');
  const [facilityType, setFacilityType] = useState<FacilityType>('other');
  const [saving, setSaving]           = useState(false);
  const nameRef                       = useRef<HTMLInputElement>(null);

  const isDuplicate = name.trim().length > 0 &&
    existingFacilities.some(f => f.name.toLowerCase() === name.trim().toLowerCase());

  async function handleAdd() {
    if (!name.trim() || isDuplicate) return;
    setSaving(true);
    const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
    try {
      await requestJson(`/api/admin/org/venues${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-facility',
          data: { orgVenueId, name: name.trim(), facilityType },
        }),
      });
      setName('');
      setFacilityType('other');
      onAdded();
      nameRef.current?.focus();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.addFacilityRow}>
      <div className={styles.addFacilityInputs}>
        <div className={styles.facilityNameWrap}>
          <input
            ref={nameRef}
            className={`form-input ${styles.addFacilityName}`}
            placeholder="Facility name (e.g. Diamond 1, Rink North, Court A)"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleAdd(); } }}
          />
          {isDuplicate && (
            <p className={styles.addFacilityError}>
              A facility named &ldquo;{name.trim()}&rdquo; already exists in this venue.
            </p>
          )}
        </div>
        <select
          className={`form-select ${styles.addFacilityType}`}
          value={facilityType}
          onChange={e => setFacilityType(e.target.value as FacilityType)}
        >
          {FACILITY_TYPES.map(t => (
            <option key={t} value={t}>{FACILITY_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>
      <div className={styles.addFacilityActions}>
        <button
          className="btn btn-lime btn-data"
          onClick={() => void handleAdd()}
          disabled={!name.trim() || saving || isDuplicate}
        >
          <Plus size={13} /> {saving ? 'Adding…' : 'Add Facility'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Venue card (expandable)
// ---------------------------------------------------------------------------

function VenueCard({
  venue,
  orgSlug,
  onEdit,
  onDelete,
  onRefresh,
}: {
  venue: OrgVenue;
  orgSlug?: string;
  onEdit: (v: OrgVenue) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const facilities = venue.facilities ?? [];

  async function deleteFacility(facilityId: string) {
    const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
    await requestJson(`/api/admin/org/venues${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-facility', id: facilityId }),
    });
    onRefresh();
  }

  return (
    <div className={`${styles.venueCard} ${expanded ? styles.expanded : ''}`}>
      {/* Header row — click anywhere to expand */}
      <div className={styles.venueHeader} onClick={() => setExpanded(x => !x)}>
        <ChevronRight size={14} className={styles.expandIcon} />
        <div className={styles.venueMeta}>
          <div className={styles.venueName}>
            <MapPin size={13} />
            {venue.name}
          </div>
          {venue.address && (
            <div className={styles.venueAddress}>{venue.address}</div>
          )}
        </div>
        <span className={styles.facilityCount}>
          {facilities.length} {facilities.length === 1 ? 'facility' : 'facilities'}
        </span>
        {/* Stop propagation so action buttons don't toggle expand */}
        <div className={styles.venueActions} onClick={e => e.stopPropagation()}>
          {venue.address && (
            <a
              href={getMapsUrl(venue.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-data"
              title="Open in Google Maps"
            >
              <ExternalLink size={13} />
            </a>
          )}
          <button
            className="btn btn-ghost btn-data"
            title="Edit venue"
            onClick={() => onEdit(venue)}
          >
            <Pencil size={13} />
          </button>
          <button
            className="btn btn-danger btn-data"
            title="Delete venue"
            onClick={() => onDelete(venue.id)}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Expanded: facility list + add-facility row */}
      {expanded && (
        <div className={styles.facilitySection}>
          <div className={styles.facilityList}>
            {facilities.length === 0 ? (
              <p className={styles.facilityEmptyNote}>
                No facilities yet — add one below. This venue won&apos;t appear in tournament scheduling until it has at least one facility.
              </p>
            ) : (
              facilities.map(f => (
                <div key={f.id} className={styles.facilityItem}>
                  <span className={styles.facilityName}>{f.name}</span>
                  <span className={styles.facilityTypeBadge}>{FACILITY_TYPE_LABELS[f.facilityType]}</span>
                  {f.notes && <span className={styles.facilityNotes}>{f.notes}</span>}
                  <div className={styles.facilityActions}>
                    <button
                      className="btn btn-danger btn-data"
                      title="Remove facility"
                      onClick={() => void deleteFacility(f.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <AddFacilityRow orgSlug={orgSlug} orgVenueId={venue.id} existingFacilities={facilities} onAdded={onRefresh} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page — Org Venue Library
// ---------------------------------------------------------------------------

export default function OrgVenueLibraryPage() {
  const { currentOrg } = useOrg();
  usePageTitle('Venue Library');
  const orgSlug = currentOrg?.slug;

  // Venue Library is a League/Club feature only
  const planAllowed = !!currentOrg && ['league', 'club'].includes(currentOrg.planId);

  const [venues, setVenues]     = useState<OrgVenue[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]   = useState<OrgVenue | undefined>(undefined);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!orgSlug) return;
    setLoading(true);
    try {
      const data = await requestJson<OrgVenue[]>(
        `/api/admin/org/venues?orgSlug=${encodeURIComponent(orgSlug)}`
      );
      setVenues(data);
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => { void refresh(); }, [refresh]);

  function openAdd()          { setEditing(undefined); setModalOpen(true); }
  function openEdit(v: OrgVenue) { setEditing(v);      setModalOpen(true); }

  async function confirmDelete() {
    if (!deleteId || !orgSlug) return;
    await requestJson(`/api/admin/org/venues?orgSlug=${encodeURIComponent(orgSlug)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-venue', id: deleteId }),
    });
    setDeleteId(null);
    void refresh();
  }

  if (!planAllowed) {
    return (
      <div className="empty-state">
        <MapPin size={32} />
        <h3>Venue Library not available</h3>
        <p>The Venue Library is included in League and Club plans. Upgrade your subscription to manage a shared venue library across tournaments.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><MapPin size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Venue Library</h1>
            <p className={styles.pageSub}>Define your org&apos;s playing locations once — import into any tournament</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-lime btn-data" onClick={openAdd} id="org-venue-add-btn">
            <Plus size={16} /> Add Venue
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? null : venues.length === 0 ? (
        <div className="empty-state">
          <MapPin size={32} />
          <h3>No venues in your library yet</h3>
          <p>Add your playing locations here. You can import them into any tournament instead of re-entering addresses each season.</p>
          <button className={`btn btn-lime ${styles.emptyCta}`} onClick={openAdd}>
            <Plus size={16} /> Add First Venue
          </button>
        </div>
      ) : (
        <div className={styles.venueList}>
          {venues.map(v => (
            <VenueCard
              key={v.id}
              venue={v}
              orgSlug={orgSlug}
              onEdit={openEdit}
              onDelete={id => setDeleteId(id)}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}

      {/* Add / Edit venue modal */}
      {modalOpen && (
        <VenueModal
          orgSlug={orgSlug}
          existing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); void refresh(); }}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Venue?</h3>
              <button className="btn btn-ghost btn-data" onClick={() => setDeleteId(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--white-60)' }}>
              This venue and all its facilities will be removed from the library.
              Tournaments that already imported this venue are not affected.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost btn-data" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger btn-data" id="confirm-delete-org-venue" onClick={() => void confirmDelete()}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
