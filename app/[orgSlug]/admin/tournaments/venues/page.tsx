'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  MapPin, Plus, Pencil, Trash2, X, Check,
  ChevronDown, Navigation, Download,
} from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { getMapsUrl } from '@/components/LocationLink';
import AddVenueModal from '@/components/admin/AddVenueModal';
import ExportMenu from '@/components/admin/ExportMenu';
import { TournamentAdminHeader } from '@/components/admin/tournament';
import s from '../../admin-common.module.css';
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
// useMobile — reactively tracks whether viewport is ≤ 640px
// ---------------------------------------------------------------------------

function useMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

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
  existingFacilities,
  onAdded,
}: {
  orgSlug?: string;
  venueId: string;
  tournamentId: string;
  existingFacilities: VenueFacility[];
  onAdded: () => void;
}) {
  const [name, setName]                 = useState('');
  const [facilityType, setFacilityType] = useState<FacilityType>('other');
  const [saving, setSaving]             = useState(false);
  const nameRef                         = useRef<HTMLInputElement>(null);

  const isDuplicate = name.trim().length > 0 &&
    existingFacilities.some(f => f.name.toLowerCase() === name.trim().toLowerCase());

  async function handleAdd() {
    if (!name.trim() || isDuplicate) return;
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
        <div className={styles.facilityNameWrap}>
          <input
            ref={nameRef}
            className={`form-input ${styles.addFacilityName}`}
            placeholder="Facility name (e.g. Diamond 1, Rink North)"
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
// Inline edit-facility row
// ---------------------------------------------------------------------------

function EditFacilityRow({
  facility,
  orgSlug,
  existingFacilities,
  onSaved,
  onCancel,
}: {
  facility: VenueFacility;
  orgSlug?: string;
  existingFacilities: VenueFacility[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName]                 = useState(facility.name);
  const [facilityType, setFacilityType] = useState<FacilityType>(facility.facilityType);
  const [saving, setSaving]             = useState(false);

  // Duplicate if another facility in the same venue already has this name (excluding self)
  const isDuplicate = name.trim().length > 0 &&
    name.trim().toLowerCase() !== facility.name.toLowerCase() &&
    existingFacilities.some(f => f.name.toLowerCase() === name.trim().toLowerCase());

  async function handleSave() {
    if (!name.trim() || isDuplicate) return;
    setSaving(true);
    const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
    try {
      await requestJson(`/api/admin/venues${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-facility',
          id: facility.id,
          data: { name: name.trim(), facilityType },
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.facilityItemEdit}>
      <div className={styles.facilityNameWrap}>
        <input
          className={`form-input ${styles.facilityEditName}`}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); void handleSave(); }
            if (e.key === 'Escape') onCancel();
          }}
          autoFocus
        />
        {isDuplicate && (
          <p className={styles.addFacilityError}>
            A facility named &ldquo;{name.trim()}&rdquo; already exists in this venue.
          </p>
        )}
      </div>
      <select
        className={`form-select ${styles.facilityEditType}`}
        value={facilityType}
        onChange={e => setFacilityType(e.target.value as FacilityType)}
      >
        {FACILITY_TYPES.map(t => (
          <option key={t} value={t}>{FACILITY_TYPE_LABELS[t]}</option>
        ))}
      </select>
      <div className={styles.facilityActions}>
        <button
          className="btn btn-ghost btn-data"
          title="Cancel"
          onClick={onCancel}
          disabled={saving}
        >
          <X size={12} />
        </button>
        <button
          className="btn btn-lime btn-data"
          title="Save facility"
          onClick={() => void handleSave()}
          disabled={!name.trim() || saving || isDuplicate}
        >
          <Check size={12} /> {saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FacilityModal — modal for add / edit of a facility (used on mobile)
// ---------------------------------------------------------------------------

function FacilityModal({
  mode,
  facility,
  venueId,
  tournamentId,
  orgSlug,
  existingFacilities = [],
  onSaved,
  onClose,
}: {
  mode: 'add' | 'edit';
  facility?: VenueFacility;
  venueId?: string;
  tournamentId?: string;
  orgSlug?: string;
  existingFacilities?: VenueFacility[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [name, setName]                 = useState(facility?.name ?? '');
  const [facilityType, setFacilityType] = useState<FacilityType>(facility?.facilityType ?? 'other');
  const [saving, setSaving]             = useState(false);

  const isDuplicate = name.trim().length > 0 &&
    (mode === 'add' || name.trim().toLowerCase() !== facility?.name.toLowerCase()) &&
    existingFacilities.some(f => f.name.toLowerCase() === name.trim().toLowerCase());

  async function handleSave() {
    if (!name.trim() || isDuplicate) return;
    setSaving(true);
    const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
    try {
      if (mode === 'add') {
        await requestJson(`/api/admin/venues${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add-facility',
            data: { venueId, tournamentId, name: name.trim(), facilityType },
          }),
        });
      } else {
        await requestJson(`/api/admin/venues${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update-facility',
            id: facility!.id,
            data: { name: name.trim(), facilityType },
          }),
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{mode === 'add' ? 'Add Facility' : 'Edit Facility'}</h3>
          <button className="btn btn-ghost btn-data" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label className="form-label">Facility Name *</label>
          <input
            className="form-input"
            placeholder="e.g. Diamond 1, Rink North, Court A"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleSave(); } }}
            autoFocus
          />
          {isDuplicate && (
            <p style={{ color: 'var(--danger)', fontFamily: 'var(--font-data)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              A facility with this name already exists in this venue.
            </p>
          )}
        </div>
        <div className="form-group" style={{ marginBottom: '0.5rem' }}>
          <label className="form-label">Type</label>
          <select
            className="form-select"
            value={facilityType}
            onChange={e => setFacilityType(e.target.value as FacilityType)}
          >
            {FACILITY_TYPES.map(t => (
              <option key={t} value={t}>{FACILITY_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-data" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-lime btn-data"
            onClick={() => void handleSave()}
            disabled={!name.trim() || isDuplicate || saving}
          >
            <Check size={14} />
            {saving ? 'Saving…' : mode === 'add' ? 'Add Facility' : 'Save Changes'}
          </button>
        </div>
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
        <p className={styles.libraryNote}>
          Select venues to copy into this tournament. Each venue and its facilities will be imported as a local copy.
        </p>
        {loading ? (
          <p className={styles.libraryEmpty}>Loading library…</p>
        ) : orgVenues.length === 0 ? (
          <p className={styles.libraryEmpty}>
            Your org venue library is empty. Add venues in Org → Venues first.
          </p>
        ) : (
          <div className={styles.libraryVenueList}>
            {orgVenues.map(v => (
              <label
                key={v.id}
                className={`${styles.libraryVenueItem} ${selected.has(v.id) ? styles.libraryVenueItemSelected : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(v.id)}
                  onChange={() => toggle(v.id)}
                  style={{ marginTop: '0.15rem', flexShrink: 0 }}
                />
                <div>
                  <div className={styles.libraryVenueName}>{v.name}</div>
                  {v.address && (
                    <div className={styles.libraryVenueAddress}>{v.address}</div>
                  )}
                  <div className={styles.libraryVenueFacilities}>
                    {(v.facilities ?? []).length} {(v.facilities ?? []).length === 1 ? 'facility' : 'facilities'}:{' '}
                    {(v.facilities ?? []).map(f => f.name).join(', ') || '—'}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
        <div className="modal-footer">
          <button className="btn btn-ghost btn-data" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-lime btn-data"
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
// Tournament venue row (table format — mirrors GameList row structure)
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
  const [expanded, setExpanded]               = useState(false);
  const [editingFacilityId, setEditingFacilityId] = useState<string | null>(null);
  const [facilityModal, setFacilityModal]     = useState<{ mode: 'add' | 'edit'; facility?: VenueFacility } | null>(null);
  const isMobile                              = useMobile();
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
    <div className={s.row}>
      {/* ── Collapsed row ─────────────────────────────────────────── */}
      <div className={s.rowMain} onClick={() => setExpanded(x => !x)}>
        {/* Venue name */}
        <div className={styles.venueColName}>
          <MapPin size={12} className={styles.venueNameIcon} />
          <span className={s.primaryCell}>{venue.name}</span>
        </div>
        {/* Address */}
        <div className={`${s.secondaryCell} ${styles.venueColAddress}`}>
          {venue.address ?? '—'}
        </div>
        {/* Facility count */}
        <div className={styles.venueColFacilities}>
          <span className={styles.facilityCount}>
            {facilities.length} {facilities.length === 1 ? 'facility' : 'facilities'}
          </span>
        </div>
        {/* Expand chevron */}
        <div className={styles.venueColChevron}>
          <ChevronDown
            size={14}
            className={`${styles.expandChevron} ${expanded ? styles.expandChevronOpen : ''}`}
          />
        </div>
      </div>

      {/* ── Expanded: venue actions + facility list + add facility ─── */}
      {expanded && (
        <div className={`${s.expandedRow} ${styles.facilityExpandedRow}`}>
          {/* Venue-level actions — moved here to keep the collapsed row clean */}
          <div className={styles.venueActionsBar}>
            {venue.address && (
              <a
                href={getMapsUrl(venue.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-data"
              >
                <Navigation size={12} /> Maps
              </a>
            )}
            <button className="btn btn-ghost btn-data" onClick={() => onEdit(venue)}>
              <Pencil size={12} /> Edit Venue
            </button>
            <button
              className="btn btn-ghost btn-data"
              style={{ color: 'rgba(var(--danger-rgb), 0.65)', borderColor: 'transparent' }}
              onClick={() => onDelete(venue.id)}
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
          <div className={styles.facilityList}>
            {facilities.length === 0 ? (
              <p className={styles.facilityEmptyNote}>
                No facilities yet — add one below to use this venue in scheduling.
              </p>
            ) : (
              facilities.map(f =>
                editingFacilityId === f.id && !isMobile ? (
                  /* Desktop: inline edit row */
                  <EditFacilityRow
                    key={f.id}
                    facility={f}
                    orgSlug={orgSlug}
                    existingFacilities={facilities.filter(other => other.id !== f.id)}
                    onSaved={() => { setEditingFacilityId(null); onRefresh(); }}
                    onCancel={() => setEditingFacilityId(null)}
                  />
                ) : (
                  <div key={f.id} className={styles.facilityItem}>
                    <span className={styles.facilityName}>{f.name}</span>
                    <span className={styles.facilityTypeBadge}>{FACILITY_TYPE_LABELS[f.facilityType]}</span>
                    {f.notes && <span className={styles.facilityNotes}>{f.notes}</span>}
                    <div className={styles.facilityActions}>
                      <button
                        className="btn btn-ghost btn-data"
                        title="Edit facility"
                        onClick={() => {
                          if (isMobile) setFacilityModal({ mode: 'edit', facility: f });
                          else setEditingFacilityId(f.id);
                        }}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        className="btn btn-danger btn-data"
                        title="Remove facility"
                        onClick={() => void deleteFacility(f.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )
              )
            )}
          </div>
          {/* Desktop: inline add row / Mobile: button that opens modal */}
          {isMobile ? (
            <button
              className={`btn btn-ghost btn-data ${styles.mobileAddFacilityBtn}`}
              onClick={() => setFacilityModal({ mode: 'add' })}
            >
              <Plus size={13} /> Add Facility
            </button>
          ) : (
            <AddFacilityRow
              orgSlug={orgSlug}
              venueId={venue.id}
              tournamentId={tournamentId}
              existingFacilities={facilities}
              onAdded={onRefresh}
            />
          )}
        </div>
      )}

      {/* Facility modal — add or edit, mobile only */}
      {facilityModal && (
        <FacilityModal
          mode={facilityModal.mode}
          facility={facilityModal.facility}
          venueId={venue.id}
          tournamentId={tournamentId}
          orgSlug={orgSlug}
          existingFacilities={
            facilityModal.mode === 'add'
              ? facilities
              : facilities.filter(f => f.id !== facilityModal.facility?.id)
          }
          onSaved={() => { setFacilityModal(null); onRefresh(); }}
          onClose={() => setFacilityModal(null)}
        />
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
  usePageTitle('Venues & Facilities');
  const orgSlug               = currentOrg?.slug;

  const [venues, setVenues]             = useState<Venue[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editing, setEditing]           = useState<Venue | undefined>(undefined);
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [importOpen, setImportOpen]     = useState(false);

  // Org venue library is only available on League and Club plans.
  // Tournament / Tournament Plus subscribers have no org library — their entire
  // experience is the tournament admin module only.
  const hasOrgLibrary = !!currentOrg && ['league', 'club'].includes(currentOrg.planId);

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
      <TournamentAdminHeader
        icon={<MapPin size={16} />}
        title="Venues & Facilities"
        subtitle="Playing venues and facilities for this tournament"
        mobileActionsInline
        actions={
          <>
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
            <ExportMenu
              formats={['xlsx', 'csv']}
              onExportXLSX={handleExportXLSX}
              onExportCSV={handleExportCSV}
              disabled={venues.length === 0}
            />
            <button
              className="btn btn-lime btn-data"
              onClick={() => { setEditing(undefined); setAddModalOpen(true); }}
              id="venue-add-btn"
              disabled={!currentTournament}
              title="Add venue"
            >
              <Plus size={16} /> <span className={styles.addVenueLabel}>Add Venue</span>
            </button>
          </>
        }
      />

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
        <div className={styles.venueTableWrap}>
          <div className={s.flatList}>
            <div className={s.tableHeader}>
              <div className={styles.venueColName}>Venue</div>
              <div className={styles.venueColAddress}>Address</div>
              <div className={styles.venueColFacilities}>Facilities</div>
              <div className={styles.venueColChevron} />
            </div>
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
        </div>
      )}

      {addModalOpen && currentTournament && (
        <AddVenueModal
          tournamentId={currentTournament.id}
          orgSlug={orgSlug}
          existing={editing}
          onClose={() => { setAddModalOpen(false); setEditing(undefined); }}
          onSaved={() => { setAddModalOpen(false); setEditing(undefined); void refresh(); }}
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
              <button className="btn btn-ghost btn-data" onClick={() => setDeleteId(null)}>Cancel</button>
              <button
                className="btn btn-danger btn-data"
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
