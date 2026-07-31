'use client';
import { use, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import FeedbackModal from '@/components/FeedbackModal';
import TryoutCheckIn from '@/components/rep-teams/TryoutCheckIn';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { useTryoutAccess } from '@/components/coaches/useTryoutAccess';
import styles from '../../../../coaches.module.css';

export default function CoachTryoutCheckInPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}/tryout-candidates`;
  const backHref = `/${orgSlug}/coaches/teams/${teamId}/tryouts`;
  // Same shared gate as the hub (WI-11) — this was the ONLY tryout surface with no client
  // check at all. The server always refused an ungranted coach's writes; the screen just
  // shouldn't pretend.
  const { ctxLoading, canTryouts } = useTryoutAccess(teamId);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;

  if (!canTryouts) {
    return (
      <div className={styles.page}>
        <CoachEmptyState
          quiet
          icon={<ClipboardList size={20} aria-hidden />}
          headline="Tryouts aren't turned on for you"
          description="Check-in is part of running the tryout — who's arrived, bib numbers, and day-of walk-ups."
          blocker="Tryouts involve candidate contact details and selection decisions, so it stays with the head coach unless they grant it to you."
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <TryoutCheckIn
        apiBase={apiBase}
        backHref={backHref}
        onError={(m) => { setFeedbackMsg(m); setFeedbackOpen(true); }}
      />
      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        type="danger"
        title="Something went wrong"
        message={feedbackMsg}
      />
    </div>
  );
}
