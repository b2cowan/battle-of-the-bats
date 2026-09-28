'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Archive, ExternalLink, Lock, Sparkles } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { Tournament, TournamentArchive } from '@/lib/types';
import FeedbackModal from '@/components/FeedbackModal';
import { useAdminKit, useKitStyle } from '@/components/admin/AdminKitProvider';
import { KIT_INK } from '@/components/admin/kit/kit-inline';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import styles from './archives-admin.module.css';

async function getAdminArchives(orgSlug?: string): Promise<TournamentArchive[]> {
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const res = await fetch(`/api/admin/tournament-archives${orgQuery}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

type ArchivableTournament = Pick<Tournament, 'id' | 'name' | 'year' | 'status'>;

// The org's tournaments INCLUDING archived ones, through the scoped admin endpoint (org and
// assignment filters enforced server-side). Not getTournamentsByOrg: in the browser that reads
// `tournaments` with the signed-in session, which holds no privilege on it (migration 310), so the
// "archived, not yet sealed" list silently came back empty.
async function getAdminTournaments(orgSlug?: string): Promise<ArchivableTournament[]> {
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const res = await fetch(`/api/admin/tournaments${orgQuery}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return (data as ArchivableTournament[]).map(r => ({ id: r.id, name: r.name, year: r.year, status: r.status }));
}

function getErrorMessage(error: unknown, fallback = 'Something went wrong.') {
  return error instanceof Error ? error.message : fallback;
}

export default function AdminArchivesPage() {
  const { currentOrg } = useOrg();
  const kit = useAdminKit();
  const kx = useKitStyle();
  // The sealed-records rows' cell inks — row-invariant, so built once per render, not once per row.
  const mutedCellStyle = kx({ color: 'var(--white-40)' }, KIT_INK.tertiary);
  const championCellStyle = kx({ color: 'var(--logic-lime)', fontWeight: 700 }, KIT_INK.accent);
  const countCellStyle = kx({ textAlign: 'right', color: 'var(--white-40)' }, KIT_INK.tertiary);
  const dashStyle = kx({ color: 'var(--white-20)' }, KIT_INK.tertiary);
  const canSealArchives = currentOrg ? hasPlanFeature(currentOrg.planId, 'sealed_archives') : false;
  const [archives, setArchives] = useState<TournamentArchive[]>([]);
  const [archivedUnsealed, setArchivedUnsealed] = useState<ArchivableTournament[]>([]);
  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'primary' | 'danger' | 'warning' | 'success' | 'info';
    confirmText?: string;
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'warning' });

  async function refresh() {
    if (!currentOrg) return;
    const [ts, arcs] = await Promise.all([
      getAdminTournaments(currentOrg.slug),
      getAdminArchives(currentOrg.slug),
    ]);
    const sealedIds = new Set(arcs.map(a => a.tournamentId).filter(Boolean) as string[]);
    setArchives(arcs);
    setArchivedUnsealed(ts.filter(t => t.status === 'archived' && !sealedIds.has(t.id)));
  }

  useEffect(() => { refresh(); }, [currentOrg?.id]); // eslint-disable-line

  function openSealConfirm(t: ArchivableTournament) {
    if (!canSealArchives) {
      setFeedback({
        isOpen: true,
        title: 'Upgrade for Sealed Archives',
        message: `${requiresTournamentPlusCopy('sealed_archives')} You can still archive tournaments on the free plan to free your tournament slot.`,
        type: 'info',
        confirmText: 'View Upgrade Options',
        onConfirm: currentOrg?.slug ? () => { window.location.href = `/${currentOrg.slug}/admin/tournaments/settings/subscription`; } : undefined,
      });
      return;
    }

    setFeedback({
      isOpen: true,
      title: 'Seal Tournament?',
      message: `This will create a permanent, immutable archive record for "${t.name}". The snapshot cannot be modified after sealing. This action cannot be undone.`,
      type: 'warning',
      confirmText: 'Seal Tournament',
      onConfirm: () => handleSeal(t.id),
    });
  }

  async function handleSeal(id: string) {
    try {
      const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
      const res = await fetch(`/api/admin/seal-tournament${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Seal failed');
      }
      refresh();
    } catch (err: unknown) {
      setFeedback({
        isOpen: true,
        title: 'Seal Failed',
        message: getErrorMessage(err),
        type: 'danger',
      });
    }
  }

  const orgSlug = currentOrg?.slug ?? '';

  // Same element, lifted so both the legacy header and the kit header's `actions` render it.
  const publicLedgerLink = (
    <Link
      href={`/${orgSlug}/archives`}
      className="btn btn-ghost btn-sm"
      target="_blank"
      rel="noopener noreferrer"
    >
      <ExternalLink size={14} /> Public Ledger
    </Link>
  );

  return (
    <div className={styles.page}>
      <AdminPageHeader
        crumbs={[{ label: currentOrg?.name ?? '' }]}
        title="Archives"
        actions={publicLedgerLink}
        legacy={
          <div className={styles.pageHeader}>
            <div className={styles.headerLeft}>
              <div className={styles.headerIcon}><Archive size={20} /></div>
              <div>
                <h1 className={styles.pageTitle}>Archives</h1>
                <p className={styles.pageSub}>
                  {canSealArchives
                    ? 'Sealed records and archived tournaments pending a snapshot'
                    : 'Archived tournaments are available on free; permanent sealed records require Tournament Plus or higher'}
                </p>
              </div>
            </div>
            {publicLedgerLink}
          </div>
        }
      />

      {/* The free-plan subtitle is a PLAN FACT (not a description of this page), so it is re-homed
          here rather than dropped — kit-only, word for word. */}
      {kit && !canSealArchives && (
        <p className={styles.kitLede}>
          Archived tournaments are available on free; permanent sealed records require Tournament Plus or higher
        </p>
      )}

      {/* Sealed Records */}
      <div className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          Sealed Records{' '}
          <span className={styles.sectionCount}>{archives.length}</span>
        </div>
        {archives.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>
              {canSealArchives ? <Sparkles size={18} /> : <Lock size={18} />}
            </span>
            <div>
              <strong className={styles.emptyTitle}>No sealed records yet</strong>
              <p className={styles.emptyCopy}>
                {canSealArchives
                  ? 'Seal a completed or archived tournament to create a permanent public snapshot.'
                  : 'Archived tournaments are still available. Tournament Plus unlocks permanent public archive snapshots.'}
              </p>
            </div>
          </div>
        ) : (
          <div className={`table-wrap ${styles.responsiveTable}`}>
            <table>
              <thead>
                <tr>
                  <th>Season</th>
                  <th>Tournament</th>
                  <th>Division</th>
                  <th>Champion</th>
                  <th style={{ textAlign: 'right' }}>Teams</th>
                  <th style={{ textAlign: 'right' }}>Games</th>
                  <th style={{ textAlign: 'center' }}>Integrity</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {archives.map(a => (
                  <tr key={a.id}>
                    <td data-label="Season">
                      <span className="badge badge-primary">{a.season}</span>
                    </td>
                    <td data-label="Tournament"><strong>{a.tournamentName}</strong></td>
                    <td data-label="Division" style={mutedCellStyle}>{a.division ?? '—'}</td>
                    <td data-label="Champion" style={championCellStyle}>{a.winnerTeamName ?? '—'}</td>
                    <td data-label="Teams" style={countCellStyle}>{a.totalTeams ?? '—'}</td>
                    <td data-label="Games" style={countCellStyle}>{a.totalGames ?? '—'}</td>
                    <td data-label="Integrity" style={{ textAlign: 'center' }}>
                      {a.integrityHash
                        ? <span className="badge badge-success">VERIFIED</span>
                        : <span style={dashStyle}>—</span>
                      }
                    </td>
                    <td data-label="Actions">
                      <div className={styles.rowActions}>
                        <Link
                          href={`/${orgSlug}/archives/${a.id}`}
                          className="btn btn-ghost btn-sm"
                          title="View public archive record"
                        >
                          <ExternalLink size={13} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Archived — Pending Seal */}
      <div className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          Archived — Pending Seal{' '}
          <span className={styles.sectionCount}>{archivedUnsealed.length}</span>
        </div>
        {archivedUnsealed.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}><Archive size={18} /></span>
            <div>
              <strong className={styles.emptyTitle}>Nothing waiting to seal</strong>
              <p className={styles.emptyCopy}>Archived tournaments that still need a permanent snapshot will appear here.</p>
            </div>
          </div>
        ) : (
          <div className={`table-wrap ${styles.responsiveTable}`}>
            <table>
              <thead>
                <tr>
                  <th>Tournament</th>
                  <th>Year</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedUnsealed.map(t => (
                  <tr key={t.id}>
                    <td data-label="Tournament"><strong>{t.name}</strong></td>
                    <td data-label="Year"><span className="badge badge-neutral">{t.year}</span></td>
                    <td data-label="Actions">
                      <div className={styles.rowActions}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => openSealConfirm(t)}
                          title={canSealArchives ? 'Create an immutable archive record for this tournament' : 'Tournament Plus and above'}
                        >
                          {canSealArchives ? <Sparkles size={13} /> : <Lock size={13} />} Seal Now
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FeedbackModal
        {...feedback}
        onClose={() => setFeedback(f => ({ ...f, isOpen: false, onConfirm: undefined }))}
      />
    </div>
  );
}
