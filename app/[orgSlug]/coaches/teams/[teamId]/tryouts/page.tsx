'use client';
import { use, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import FeedbackModal from '@/components/FeedbackModal';
import HelpButton from '@/components/help/HelpButton';
import TryoutDayCard from '@/components/rep-teams/TryoutDayCard';
import TryoutRubricCard from '@/components/rep-teams/TryoutRubricCard';
import TryoutEvaluatorsCard from '@/components/rep-teams/TryoutEvaluatorsCard';
import TryoutScoreboardCard from '@/components/rep-teams/TryoutScoreboardCard';
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
        <HelpButton
          iconOnly
          label="Tryouts"
          help={{ module: 'coaches', sectionIds: ['recipe-run-tryouts'], fullGuideHref: `/${orgSlug}/coaches/help#recipe-run-tryouts` }}
        />
      </div>

      <TryoutDayCard
        apiBase={apiBase}
        canWrite
        checkInHref={`/${orgSlug}/coaches/teams/${teamId}/tryouts/check-in`}
        onError={(m) => { setFeedbackMsg(m); setFeedbackOpen(true); }}
      />

      <TryoutRubricCard
        apiBase={`/api/coaches/${orgSlug}/teams/${teamId}/tryout-rubric`}
        onError={(m) => { setFeedbackMsg(m); setFeedbackOpen(true); }}
      />

      <TryoutEvaluatorsCard
        apiBase={`/api/coaches/${orgSlug}/teams/${teamId}/tryout-evaluators`}
        onError={(m) => { setFeedbackMsg(m); setFeedbackOpen(true); }}
      />

      <TryoutScoreboardCard
        apiBase={`/api/coaches/${orgSlug}/teams/${teamId}/tryout-scoreboard`}
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
