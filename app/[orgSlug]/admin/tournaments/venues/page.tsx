'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  MapPin, Plus, Pencil, Trash2, X, Check,
  ChevronRight, ExternalLink, Download,
} from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { getMapsUrl } from '@/components/LocationLink';
import AddVenueModal from '@/components/admin/AddVenueModal';
import ExportMenu from '@/components/admin/ExportMenu';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import type { Venue, VenueFacility, OrgVenue, FacilityType } from '@/lib/types';
import { FACILITY_TYPE_LABELS, FACILITY_TYPES } from '@/lib/types';
import styles from '../../org/venues/venues-admin.module.css';

// ---------------------------------------------------------------------------
// Export columns
// ---------------------------------------------------------------------------

const VENUES_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Venue Name',     key: 'name',         format: 'text' },
  { label: 'Facility',       key: 'facilityName', format: 'text' },
  { label: 'Facility Type',  key: 'facilityType', format: 'text' },
  { label: 'Address',        key: 'address',      format: 'text' },
  { label: 'Notes',          key: 'notes',        format: 'text' },
];

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
// Inline add-facility row (tournament-scoped)
// ---------------------------------------------------------------------------

function AddFacilityRow({
  orgSlug,
  venueId,
  tournamentId,
  onAdded,
}: {
  orgSlug?: string;
  venueId: string;
  tournamentId: string;
  onAdded: () => void;
}) {
  const [name, setName]                 = useState('');
  const [facilityType, setFacilityType] = useState<FacilityType>('other');
  const [saving, setSaving]             = useState(false);
  const nameRef                         = useRef<HTMLInputElement>(null);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
    try {
      await requestJson(`/api/admin/venues${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-facility',
          data: { venueId, tournamentId, name: name.trim(), facilityType },
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
        <input
          ref={nameRef}
          className={`form-input ${styles.addFacilityName}`}
          placeholder="Facility name (e.g. Diamond 1, Rink North, Court A)"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleAdd(); } }}
        />
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
          disabled={!name.trim() || saving}
        >
          <Plus size={13} /> {saving ? 'Adding…' : 'Add Facility'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import from Org Library modal
// ---------------------------------------------------------------------------

function ImportFromLibraryModal({
  orgSlug,
  tournamentId,
  onClose,
  onImported,
}: {
  orgSlug: string;
  tournamentId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [orgVenues, setOrgVenues] = useState<OrgVenue[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    requestJson<OrgVenue[]>(`/api/admin/org/venues?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then(data => setOrgVenues(data))
      .finally(() => setLoading(false));
  }, [orgSlug]);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setImporting(true);
    const orgQuery = `?orgSlug=${encodeURIComponent(orgSlug)}`;
    try {
      for (const orgVenueId of selected) {
        await requestJson(`/api/admin/venues${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'import-from-org',
            data: { orgVenueId, tournamentId },
          }),
        });
      }
      onImported();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Import from Venue Library</h3>
          <button className="btn btn-ghost btn-data" onClick={onClose}><X size={16} /></button>
        </div>
        <p style={{ color: 'var(--white-60)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Select venues to copy into this tournament. Each venue and its facilities will be imported as a local copy.
        </p>
        {loading ? (
          <p style={{ color: 'var(--white-40)', textAlign: 'center', padding: '1.5rem 0' }}>Loading library…</p>
        ) : orgVenues.length === 0 ? (
          <p style={{ color: 'var(--white-40)', textAlign: 'center', padding: '1.5rem 0' }}>
            Your org venue library is empty. Add venues in Org → Venues first.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '320px', overflowY: 'auto' }}>
            {orgVenues.map(v => (
              <label
                key={v.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '6px',
                  border: `1px solid ${selected.has(v.id) ? 'rgba(var(--blueprint-blue-rgb), 0.5)' : 'rgba(var(--blueprint-blue-rgb), 0.18)'}`,
                  background: selected.has(v.id) ? 'rgba(var(--blueprint-blue-rgb), 0.08)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(v.id)}
                  onChange={() => toggle(v.id)}
                  style={{ marginTop: '0.15rem', flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--white)', fontSize: '0.9rem' }}>{v.name}</div>
                  {v.address && (
                    <div style={{ color: 'var(--white-50)', fontSize: '0.78rem' }}>{v.address}</div>
                  )}
                  <div style={{ color: 'var(--white-40)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                    {(v.facilities ?? []).length} {(v.facilities ?? []).length === 1 ? 'facility' : 'facilities'}:{' '}
                    {(v.facilities ?? []).map(f => f.name).join(', ') || '—'}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={selected.size === 0 || importing}
            onClick={() => void handleImport()}
          >
            <Download size={14} />
            {importing ? 'Importing…' : `Import ${selected.size > 0 ? `${selected.size} ` : ''}Venue${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tournament venue card (expandable)
// ---------------------------------------------------------------------------

function TournamentVenueCard({
  venue,
  orgSlug,
  tournamentId,
  onEdit,
  onDelete,
  onRefresh,
}: {
  venue: Venue;
  orgSlug?: string;
  tournamentId: string;
  onEdit: (v: Venue) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const facilities: VenueFacility[] = venue.facilities ?? [];

  async function deleteFacility(facilityId: string) {
    const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
    await requestJson(`/api/admin/venues${orgQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-facility', id: facilityId }),
    });
    onRefresh();
  }

  return (
    <div className={`${styles.venueCard} ${expanded ? styles.expanded : ''}`}>
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
          <button className="btn btn-ghost btn-data" title="Edit venue" onClick={() => onEdit(venue)}>
            <Pencil size={13} />
          </button>
          <button className="btn btn-danger btn-data" title="Delete venue" onClick={() => onDelete(venue.id)}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className={styles.facilitySection}>
          <div className={styles.facilityList}>
            {facilities.length === 0 ? (
              <p className={styles.facilityEmptyNote}>
                No facilities yet — add one below to use this venue in scheduling.
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
          <AddFacilityRow
            orgSlug={orgSlug}
            venueId={venue.id}
            tournamentId={tournamentId}
            onAdded={onRefresh}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page — Tournament Venues
// ---------------------------------------------------------------------------

export default function TournamentVenuesPage() {
  const { currentTournament } = useTournament();
  const { currentOrg }        = useOrg();
  const orgSlug               = currentOrg?.slug;

  const [venues, setVenues]           = useState<Venue[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editing, setEditing]         = useState<Venue | undefined>(undefined);
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [importOpen, setImportOpen]   = useState(false);

  // Determines if org library import is available (org users only)
  const hasOrgLibrary = !!currentOrg;

  const refresh = useCallback(async () => {
    if (!currentTournament) { setVenues([]); return; }
    const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
    const data = await requestJson<Venue[]>(
      `/api/admin/venues?tournamentId=${encodeURIComponent(currentTournament.id)}${orgParam}`
    );
    setVenues(data);
  }, [currentTournament, orgSlug]);

  useEffect(() => {
    const t = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(t);
  }, [refresh]);

  // -- Export ----------------------------------------------------------------

  function buildExportRows() {
    return venues.flatMap(v =>
      (v.facilities ?? []).length > 0
        ? (v.facilities ?? []).map(f => ({
            name:         v.name,
            facilityName: f.name,
            facilityType: FACILITY_TYPE_LABELS[f.facilityType],
            address:      v.address ?? '',
            notes:        v.notes   ?? '',
          }))
        : [{ name: v.name, facilityName: '', facilityType: '', address: v.address ?? '', notes: v.notes ?? '' }]
    );
  }

  function handleExportXLSX() {
    const rows     = buildExportRows();
    const headers  = serializeHeaders(VENUES_EXPORT_COLS);
    const data     = serializeRows(rows, VENUES_EXPORT_COLS);
    const filename = buildFilename({ org: currentTournament?.slug ?? 'org', dataset: 'venues' }, 'xlsx');
    downloadXLSX(filename, headers, data, 'Venues');
  }

  function handleExportCSV() {
    const rows     = buildExportRows();
    const headers  = serializeHeaders(VENUES_EXPORT_COLS);
    const data     = serializeRows(rows, VENUES_EXPORT_COLS);
    const filename = buildFilename({ org: currentTournament?.slug ?? 'org', dataset: 'venues' }, 'csv');
    downloadCSVBlob(filename, generateCSV(headers, data));
  }

  // -------------------------------------------------------------------------

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><MapPin size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Venue Locations</h1>
            <p className={styles.pageSub}>Playing venues and facilities for this tournament</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <ExportMenu
            formats={['xlsx', 'csv']}
            onExportXLSX={handleExportXLSX}
            onExportCSV={handleExportCSV}
            disabled={venues.length === 0}
          />
          {hasOrgLibrary && (
            <button
              className="btn btn-ghost btn-data"
              onClick={() => setImportOpen(true)}
              disabled={!currentTournament}
              title="Import from org venue library"
            >
              <Download size={14} /> Import from Library
            </button>
          )}
          <button
            className="btn btn-lime btn-data"
            onClick={() => { setEditing(undefined); setAddModalOpen(true); }}
            id="venue-add-btn"
            disabled={!currentTournament}
          >
            <Plus size={16} /> Add Venue
          </button>
        </div>
      </div>

      {venues.length === 0 ? (
        <div className="empty-state">
          <MapPin size={32} />
          <h3>No venues added yet</h3>
          <p>
            {hasOrgLibrary
              ? 'Add a new venue or import from your org venue library.'
              : 'Add your first venue to assign locations to games.'}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            <button
              className="btn btn-lime"
              onClick={() => { setEditing(undefined); setAddModalOpen(true); }}
              disabled={!currentTournament}
            >
              <Plus size={16} /> Add Venue
            </button>
            {hasOrgLibrary && (
              <button
                className="btn btn-ghost"
                onClick={() => setImportOpen(true)}
                disabled={!currentTournament}
              >
                <Download size={14} /> Import from Library
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.venueList}>
          {venues.map(v => (
            <TournamentVenueCard
              key={v.id}
              venue={v}
              orgSlug={orgSlug}
              tournamentId={currentTournament!.id}
              onEdit={venue => { setEditing(venue); setAddModalOpen(true); }}
              onDelete={id => setDeleteId(id)}
              onRefresh={refresh}
            />
          ))}
        </div>
      )}

      {/* Add / edit venue modal (uses legacy AddVenueModal — backward compat) */}
      {addModalOpen && currentTournament && (
        <AddVenueModal
          tournamentId={currentTournament.id}
          orgSlug={orgSlug}
          existing={editing}
          onClose={() => setAddModalOpen(false)}
          onSaved={() => { setAddModalOpen(false); void refresh(); }}
        />
      )}

      {/* Import from org library */}
      {importOpen && currentTournament && orgSlug && (
        <ImportFromLibraryModal
          orgSlug={orgSlug}
          tournamentId={currentTournament.id}
          onClose={() => setImportOpen(false)}
          onImported={() => { setImportOpen(false); void refresh(); }}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Venue?</h3>
              <button className="btn btn-ghost btn-data" onClick={() => setDeleteId(null)}><X size={16} /></button>
            </div>
            <p style={{ color: 'var(--white-60)' }}>
              Games linked to this venue will retain their location name but lose the Maps link.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button
                className="btn btn-danger"
                id="confirm-delete-venue"
                onClick={async () => {
                  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
                  await requestJson(`/api/admin/venues${orgQuery}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete-venue', id: deleteId }),
                  });
                  setDeleteId(null);
                  void refresh();
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
