'use client';
import { use } from 'react';
import { ClipboardList } from 'lucide-react';
import { useTryoutAccess } from '@/components/coaches/useTryoutAccess';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import TryoutScorerSurface from '@/components/rep-teams/TryoutScorerSurface';
import styles from '../../../../coaches.module.css';

/**
 * "Score as yourself" (Chunk E, WI-1): the coach's signed-in door into the shared field scorer.
 * Same client gate as the hub and the check-in sub-page — the server route is the real gate;
 * this is the direct-URL case. Once assignments have loaded, a missing assignment or a missing
 * tryouts grant means the honest empty state, not a scorer that would 403 on every tap.
 */
export default function CoachTryoutSelfScorePage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const { ctxLoading, canTryouts } = useTryoutAccess(teamId);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;

  if (!canTryouts) {
    return (
      <div className={styles.page}>
        <CoachEmptyState
          quiet
          icon={<ClipboardList size={20} aria-hidden />}
          headline="Tryouts aren't turned on for you"
          description="Scoring candidates is part of running the tryout — check-in, the shared scorecard, and the live ranked board."
          blocker="Tryouts involve candidate contact details and selection decisions, so it stays with the head coach unless they grant it to you."
        />
      </div>
    );
  }

  return (
    <TryoutScorerSurface
      apiBase={`/api/coaches/${orgSlug}/teams/${teamId}/tryout-self-score`}
      selfMode
      backHref={`/${orgSlug}/coaches/teams/${teamId}/tryouts`}
    />
  );
}
