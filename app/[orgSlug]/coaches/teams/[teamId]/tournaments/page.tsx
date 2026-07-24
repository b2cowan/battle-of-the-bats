'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { deriveCoachLifecycleChip } from '@/lib/coach-tournament-lifecycle';
import FanViewLink from '@/components/shared/FanViewLink';
import styles from '../../../coaches.module.css';

interface TournamentHistoryEntry {
  registration: { id: string; name: string; status: string; registeredAt: string };
  tournament: { id: string; name: string; slug: string | null; year: number | null; startDate: string | null; endDate: string | null; status: string } | null;
  org: { id: string; slug: string; name: string } | null;
}

const REG_STATUS_LABEL: Record<string, string> = {
  accepted: 'Accepted', pending: 'Pending', waitlist: 'Waitlisted', rejected: 'Not accepted',
};
const REG_STATUS_CSS: Record<string, string> = {
  accepted: styles.badgeActive, pending: styles.badgeUpcoming, waitlist: styles.badgeManual, rejected: styles.badgeOverdue,
};

function formatRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const s = new Date(start).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  if (!end || end === start) return new Date(start).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
  return `${s} - ${new Date(end).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export default function PremiumTeamTournamentsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const [entries, setEntries] = useState<TournamentHistoryEntry[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/tournament-history`);
      if (!res.ok) throw new Error('Tournaments could not be loaded');
      const data: { history?: TournamentHistoryEntry[] } = await res.json();
      setEntries(data.history ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tournaments could not be loaded');
    }
  }, [orgSlug, teamId]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div>
            <h1 className={styles.pageTitle}>Tournaments</h1>
            <p className={styles.pageSub}>Every tournament your team is entered in — live status, schedule, and results.</p>
          </div>
        </div>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      {entries === null ? (
        <div className={styles.loadingState}>Loading tournaments…</div>
      ) : entries.length === 0 ? (
        <div className={styles.emptyState}>
          <Trophy size={32} style={{ opacity: 0.25, marginBottom: '0.75rem' }} />
          <p className={styles.emptyStateTitle}>No tournaments yet</p>
          <p className={styles.emptyStateSub}>
            When your team registers for a tournament, it shows up here with its live schedule and scores.
          </p>
        </div>
      ) : (
        <div className={styles.tournamentHistoryList}>
          {entries.map(entry => {
            const chip = deriveCoachLifecycleChip(entry.tournament?.startDate ?? null, entry.tournament?.endDate ?? null, today);
            // Live/game-day → loud lifecycle chip; otherwise the registration standing
            // (Accepted / Pending …) is the more useful at-a-glance label for the list.
            const isLive = chip.state === 'live' || chip.state === 'game_day';
            const statusLabel = REG_STATUS_LABEL[entry.registration.status] ?? entry.registration.status;
            const statusClass = REG_STATUS_CSS[entry.registration.status] ?? styles.badgeManual;
            const range = formatRange(entry.tournament?.startDate ?? null, entry.tournament?.endDate ?? null);
            // ⇄ Fan view ("The Flip" P3): per-row flip door for publicly-visible lifecycles
            // (the shared FanViewLink resolves the target so it can't drift from the pill).
            const canFanView = Boolean(entry.org?.slug && entry.tournament?.slug &&
              (entry.tournament.status === 'active' || entry.tournament.status === 'completed'));

            return (
              <div key={entry.registration.id} className={styles.tournamentHistoryEntry}>
                <Link
                  href={`${base}/tournaments/${entry.registration.id}`}
                  className={styles.tournamentHistoryItem}
                >
                  <span className={styles.tournamentHistoryMain}>
                    <span className={styles.tournamentHistoryName}>
                      {entry.tournament?.name ?? entry.registration.name}
                    </span>
                    <span className={styles.tournamentHistoryMeta}>
                      {entry.org?.name && <span>{entry.org.name}</span>}
                      {range && <span>{range}</span>}
                      <span>{entry.registration.name}</span>
                    </span>
                  </span>
                  {isLive ? (
                    <span className={`${styles.badge} ${styles.badgeActive}`}>{chip.label}</span>
                  ) : (
                    <span className={`${styles.badge} ${statusClass}`}>{statusLabel}</span>
                  )}
                </Link>
                {canFanView && (
                  <FanViewLink orgSlug={entry.org!.slug} tournamentSlug={entry.tournament!.slug!} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
