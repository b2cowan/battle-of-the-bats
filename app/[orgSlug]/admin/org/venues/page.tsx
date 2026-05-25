'use client';
import { useState, useCallback, useEffect } from 'react';
import { MapPin, Plus, Pencil, Trash2, X, ExternalLink } from 'lucide-react'; // X used in delete confirm modal
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { Venue } from '@/lib/types';
import { getMapsUrl } from '@/components/LocationLink';
import AddVenueModal from '@/components/admin/AddVenueModal';
import ExportMenu from '@/components/admin/ExportMenu';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import styles from './venues-admin.module.css';

// -- Export -------------------------------------------------------------------

const VENUES_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Venue Name', key: 'name',    format: 'text' },
  { label: 'Address',    key: 'address', format: 'text' },
  { label: 'Notes',      key: 'notes',   format: 'text' },
];

// -----------------------------------------------------------------------------

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? 'Request failed');
  return data as T;
}

export default function AdminVenuesPage() {
  const { currentTournament } = useTournament();
  const { currentOrg } = useOrg();
  const orgSlug = currentOrg?.slug;
  const [venues, setVenues] = useState<Venue[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<Venue | undefined>(undefined);
  const [deleteId, setDeleteId]   = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!currentTournament) { setVenues([]); return; }
    const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
    const rows = await requestJson<Venue[]>(`/api/admin/venues?tournamentId=${encodeURIComponent(currentTournament.id)}${orgParam}`);
    setVenues(rows);
  }, [currentTournament, orgSlug]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  function openAdd() { setEditing(undefined); setModalOpen(true); }
  function openEdit(d: Venue) { setEditing(d); setModalOpen(true); }

  function handleSaved() { setModalOpen(false); refresh(); }

  // -- Export -----------------------------------------------------------------

  function buildVenueRows() {
    return venues.map(d => ({
      name:    d.name,
      address: d.address ?? '',
      notes:   d.notes ?? '',
    }));
  }

  function handleExportXLSX() {
    const rows     = buildVenueRows();
    const headers  = serializeHeaders(VENUES_EXPORT_COLS);
    const data     = serializeRows(rows, VENUES_EXPORT_COLS);
    const filename = buildFilename(
      { org: currentTournament?.slug ?? 'org', dataset: 'venues' },
      'xlsx',
    );
    downloadXLSX(filename, headers, data, 'Venues');
  }

  function handleExportCSV() {
    const rows     = buildVenueRows();
    const headers  = serializeHeaders(VENUES_EXPORT_COLS);
    const data     = serializeRows(rows, VENUES_EXPORT_COLS);
    const filename = buildFilename(
      { org: currentTournament?.slug ?? 'org', dataset: 'venues' },
      'csv',
    );
    downloadCSVBlob(filename, generateCSV(headers, data));
  }

  // ---------------------------------------------------------------------------

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
        <div className={styles.headerActions}>
          <ExportMenu
            formats={['xlsx', 'csv']}
            onExportXLSX={handleExportXLSX}
            onExportCSV={handleExportCSV}
            disabled={venues.length === 0}
          />
          <button className="btn btn-lime btn-data" onClick={openAdd} id="venue-add-btn" disabled={!currentTournament}>
            <Plus size={16} /> Add Venue
          </button>
        </div>
      </div>

      {venues.length === 0 ? (
        <div className="empty-state">
          <MapPin size={32} />
          <h3>No venues added yet</h3>
          <p>Add your first venue to assign locations to games.</p>
          <button
            className={`btn btn-lime ${styles.emptyCta}`}
            onClick={openAdd}
            disabled={!currentTournament}
          >
            <Plus size={16} /> Add Venue
          </button>
        </div>
      ) : (
        <div className={`table-wrap ${styles.responsiveTable}`}>
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
              {venues.map(d => (
                <tr key={d.id}>
                  <td data-label="Venue">
                    <div className={styles.venueName}>
                      <MapPin size={13} style={{ color: 'var(--logic-lime)', flexShrink: 0 }} />
                      <strong>{d.name}</strong>
                    </div>
                  </td>
                  <td data-label="Address" className={styles.cellMuted}>{d.address}</td>
                  <td data-label="Notes" className={styles.cellMuted}>{d.notes || '-'}</td>
                  <td data-label="Maps">
                    <a
                      href={getMapsUrl(d.address || d.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-data"
                      title="Open in Google Maps"
                      id={`maps-venue-${d.id}`}
                    >
                      <ExternalLink size={13} /> Maps
                    </a>
                  </td>
                  <td data-label="Actions">
                    <div className={styles.rowActions}>
                      <button className="btn btn-ghost btn-data" onClick={() => openEdit(d)} id={`edit-venue-${d.id}`}>
                        <Pencil size={13} />
                      </button>
                      <button className="btn btn-danger btn-data" onClick={() => setDeleteId(d.id)} id={`delete-venue-${d.id}`}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && currentTournament && (
        <AddVenueModal
          tournamentId={currentTournament.id}
          orgSlug={orgSlug}
          existing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete Confirm */}
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
                  try {
                    const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
                    await requestJson<{ success: boolean }>(`/api/admin/venues${orgQuery}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'delete', id: deleteId }),
                    });
                  } finally {
                    setDeleteId(null);
                    refresh();
                  }
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