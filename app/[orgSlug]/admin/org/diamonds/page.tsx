'use client';
import { useState, useCallback, useEffect } from 'react';
import { MapPin, Plus, Pencil, Trash2, X, ExternalLink } from 'lucide-react'; // X used in delete confirm modal
import { useTournament } from '@/lib/tournament-context';
import { Diamond } from '@/lib/types';
import { getMapsUrl } from '@/components/LocationLink';
import AddVenueModal from '@/components/admin/AddVenueModal';
import ExportMenu from '@/components/admin/ExportMenu';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import styles from './diamonds-admin.module.css';

// ── Export ────────────────────────────────────────────────────────────────────

const VENUES_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Venue Name', key: 'name',    format: 'text' },
  { label: 'Address',    key: 'address', format: 'text' },
  { label: 'Notes',      key: 'notes',   format: 'text' },
];

// ─────────────────────────────────────────────────────────────────────────────

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? 'Request failed');
  return data as T;
}

export default function AdminDiamondsPage() {
  const { currentTournament } = useTournament();
  const [diamonds, setDiamonds] = useState<Diamond[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<Diamond | undefined>(undefined);
  const [deleteId, setDeleteId]   = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!currentTournament) { setDiamonds([]); return; }
    const rows = await requestJson<Diamond[]>(`/api/admin/diamonds?tournamentId=${currentTournament.id}`);
    setDiamonds(rows);
  }, [currentTournament]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  function openAdd() { setEditing(undefined); setModalOpen(true); }
  function openEdit(d: Diamond) { setEditing(d); setModalOpen(true); }

  function handleSaved() { setModalOpen(false); refresh(); }

  // ── Export ──────────────────────────────────────────────────────────────────

  function buildVenueRows() {
    return diamonds.map(d => ({
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

  // ────────────────────────────────────────────────────────────────────────────

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ExportMenu
            formats={['xlsx', 'csv']}
            onExportXLSX={handleExportXLSX}
            onExportCSV={handleExportCSV}
            disabled={diamonds.length === 0}
          />
          <button className="btn btn-primary btn-sm" onClick={openAdd} id="diamond-add-btn" disabled={!currentTournament}>
            <Plus size={16} /> Add Venue
          </button>
        </div>
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

      {modalOpen && currentTournament && (
        <AddVenueModal
          tournamentId={currentTournament.id}
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
