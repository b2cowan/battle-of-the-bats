'use client';

/**
 * Gate / team check-in (admin). Thin wrapper around the shared CheckInBoard —
 * supplies org + the currently-edited tournament from the admin contexts. The
 * board itself (and the gate-volunteer surface) live in components/admin/CheckInBoard.
 */

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { TournamentAdminHeader } from '@/components/admin/tournament';
import CheckInBoard from '@/components/admin/CheckInBoard';
import s from '../../admin-common.module.css';
import page from './check-in.module.css';
import LoadingState from '@/components/shared/LoadingState';

export default function CheckInPage() {
  usePageTitle('Check-in');
  const { currentTournament, isLocked, loading } = useTournament();
  const { currentOrg } = useOrg();

  return (
    <div className={s.page}>
      <TournamentAdminHeader
        eyebrow="Game Day"
        title="Check-in"
        subtitle={currentTournament ? currentTournament.name : loading ? undefined : 'Select a tournament'}
        locked={isLocked}
        mobileActionsInline
        actions={currentOrg && (
          <Link
            href={`/${currentOrg.slug}/check-in`}
            className={`btn btn-ghost btn-data ${page.gateView}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open gate volunteer view"
          >
            <ExternalLink size={13} />
            <span className={page.gateViewLabel}>Gate view</span>
          </Link>
        )}
      />

      {/* The tournament itself still loading is a wait, not "no tournament" (the board's own words). */}
      {loading && !currentTournament && <LoadingState label="Loading check-in…" />}

      {!loading && !currentTournament && (
        <div className={page.empty}>Select a tournament to run check-in.</div>
      )}

      {currentTournament && currentOrg && (
        <CheckInBoard orgSlug={currentOrg.slug} tournamentId={currentTournament.id} locked={isLocked} />
      )}
    </div>
  );
}
