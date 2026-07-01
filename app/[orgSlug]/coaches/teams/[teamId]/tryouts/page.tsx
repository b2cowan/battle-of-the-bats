'use client';
import { use, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import FeedbackModal from '@/components/FeedbackModal';
import TryoutDayCard from '@/components/rep-teams/TryoutDayCard';
import styles from '../../../coaches.module.css';

export default function CoachTryoutsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const apiBase = `/api/coaches/${orgSlug}/teams/${teamId}/tryout-sessions`;

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><ClipboardList size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Tryouts</h1>
            <p className={styles.pageSub}>Set up your tryout day, then check players in.</p>
          </div>
        </div>
      </div>

      <TryoutDayCard
        apiBase={apiBase}
        canWrite
        checkInHref={`/${orgSlug}/coaches/teams/${teamId}/tryouts/check-in`}
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
