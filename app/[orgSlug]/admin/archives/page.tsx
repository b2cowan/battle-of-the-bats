'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Archive, ExternalLink, Sparkles } from 'lucide-react';
import { getTournamentsByOrg, getArchivesByOrg } from '@/lib/db';
import { useOrg } from '@/lib/org-context';
import { Tournament, TournamentArchive } from '@/lib/types';
import FeedbackModal from '@/components/FeedbackModal';
import styles from './archives-admin.module.css';

export default function AdminArchivesPage() {
  const { currentOrg } = useOrg();
  const [archives, setArchives] = useState<TournamentArchive[]>([]);
  const [archivedUnsealed, setArchivedUnsealed] = useState<Tournament[]>([]);
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
      getTournamentsByOrg(currentOrg.id),
      getArchivesByOrg(currentOrg.id),
    ]);
    const sealedIds = new Set(arcs.map(a => a.tournamentId).filter(Boolean) as string[]);
    setArchives(arcs);
    setArchivedUnsealed(ts.filter(t => t.status === 'archived' && !sealedIds.has(t.id)));
  }

  useEffect(() => { refresh(); }, [currentOrg?.id]); // eslint-disable-line

  function openSealConfirm(t: Tournament) {
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
      const res = await fetch('/api/admin/seal-tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Seal failed');
      }
      refresh();
    } catch (err: any) {
      setFeedback({
        isOpen: true,
        title: 'Seal Failed',
        message: err.message,
        type: 'danger',
      });
    }
  }

  const orgSlug = currentOrg?.slug ?? '';

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><Archive size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Archives</h1>
            <p className={styles.pageSub}>Sealed records and archived tournaments pending a snapshot</p>
          </div>
        </div>
        <Link
          href={`/${orgSlug}/archives`}
          className="btn btn-ghost btn-sm"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={14} /> Public Ledger
        </Link>
      </div>

      {/* Sealed Records */}
      <div className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          Sealed Records
          <span className={styles.sectionCount}>{archives.length}</span>
        </div>
        {archives.length === 0 ? (
          <div className={styles.emptyState}>
            No sealed records yet. Seal a completed or archived tournament to create a permanent snapshot.
          </div>
        ) : (
          <div className="table-wrap">
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
                    <td>
                      <span className="badge badge-primary">{a.season}</span>
                    </td>
                    <td><strong>{a.tournamentName}</strong></td>
                    <td style={{ color: 'var(--white-40)' }}>{a.division ?? '—'}</td>
                    <td style={{ color: 'var(--logic-lime)', fontWeight: 700 }}>{a.winnerTeamName ?? '—'}</td>
                    <td style={{ textAlign: 'right', color: 'var(--white-40)' }}>{a.totalTeams ?? '—'}</td>
                    <td style={{ textAlign: 'right', color: 'var(--white-40)' }}>{a.totalGames ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {a.integrityHash
                        ? <span className="badge badge-success">VERIFIED</span>
                        : <span style={{ color: 'var(--white-20)' }}>—</span>
                      }
                    </td>
                    <td>
                      <Link
                        href={`/${orgSlug}/archives/${a.id}`}
                        className="btn btn-ghost btn-sm"
                        title="View public archive record"
                      >
                        <ExternalLink size={13} />
                      </Link>
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
          Archived — Pending Seal
          <span className={styles.sectionCount}>{archivedUnsealed.length}</span>
        </div>
        {archivedUnsealed.length === 0 ? (
          <div className={styles.emptyState}>
            No archived tournaments are waiting to be sealed.
          </div>
        ) : (
          <div className="table-wrap">
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
                    <td><strong>{t.name}</strong></td>
                    <td><span className="badge badge-neutral">{t.year}</span></td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => openSealConfirm(t)}
                        title="Create an immutable archive record for this tournament"
                      >
                        <Sparkles size={13} /> Seal Now
                      </button>
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
