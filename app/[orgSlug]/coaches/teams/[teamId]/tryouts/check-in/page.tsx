'use client';
import { use, useState } from 'react';
import FeedbackModal from '@/components/FeedbackModal';
import TryoutCheckIn from '@/components/rep-teams/TryoutCheckIn';
import styles from '../../../../coaches.module.css';

export default function CoachTryoutCheckInPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}/tryout-candidates`;
  const backHref = `/${orgSlug}/coaches/teams/${teamId}/tryouts`;

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

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
