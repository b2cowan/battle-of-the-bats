'use client';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useCoaches } from '@/lib/coaches-context';
import HelpCallout from '@/components/help/HelpCallout';
import CoachTournamentAwarenessBanner from '@/components/marketing/CoachTournamentAwarenessBanner';
import styles from './coaches.module.css';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', active: 'Active', completed: 'Completed', archived: 'Archived',
};
const STATUS_CSS: Record<string, string> = {
  draft: styles.badgeDraft, active: styles.badgeActive,
  completed: styles.badgeCompleted, archived: styles.badgeArchived,
};

export default function CoachesDashboard({
  params,
}: {
  params: { orgSlug: string };
}) {
  const { currentOrg } = useOrg();
  const { assignments, loading } = useCoaches();

  if (loading) return <div className={styles.loadingState}>Loading teams…</div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div>
            <h1 className={styles.pageTitle}>My Teams</h1>
            <p className={styles.pageSub}>{currentOrg?.name} — Coaches Portal</p>
          </div>
        </div>
      </div>

      {assignments.length > 0 && (
        <HelpCallout
          variant="info"
          title="Welcome to your coaching portal"
          body="You're the operator — your org handles tryouts and setup; you run day-to-day. Start by exploring your team below."
          dismissible
          localStorageKey={`flhq-help-dismissed-coaches-welcome-${params.orgSlug}`}
        />
      )}

      {assignments.length > 0 && (
        <CoachTournamentAwarenessBanner orgSlug={params.orgSlug} />
      )}

      {assignments.length === 0 ? (
        <div className={styles.emptyState}>
          <Users size={32} style={{ opacity: 0.25, marginBottom: '0.75rem' }} />
          <p className={styles.emptyStateTitle}>No team assignments yet</p>
          <p className={styles.emptyStateSub}>You&apos;ll appear here once your org admin assigns you to a team.</p>
        </div>
      ) : (
        <div className={styles.teamGrid}>
          {assignments.map(a => (
            <Link
              key={a.teamId}
              href={`/${params.orgSlug}/coaches/teams/${a.teamId}`}
              className={styles.teamCard}
            >
              <div className={styles.teamCardTop}>
                {a.teamColor && (
                  <span className={styles.colorSwatch} style={{ background: a.teamColor }} />
                )}
                <div>
                  <div className={styles.teamName}>{a.teamName}</div>
                  <div className={styles.teamMeta}>
                    <span className={`${styles.badge} ${STATUS_CSS[a.programYearStatus] ?? styles.badgeDraft}`}>
                      {STATUS_LABEL[a.programYearStatus] ?? a.programYearStatus}
                    </span>
                    <span className={styles.teamRole}>
                      {a.coachRole === 'head_coach' ? 'Head Coach' : 'Assistant Coach'}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>
                  {a.programYearName}
                </div>
                {(a.overdueInstallments > 0 || a.upcomingEventsCount > 0) && (
                  <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                    {a.overdueInstallments > 0 && (
                      <span className={`${styles.badge} ${styles.badgeOverdue}`}>
                        {a.overdueInstallments} overdue
                      </span>
                    )}
                    {a.upcomingEventsCount > 0 && (
                      <span className={`${styles.badge} ${styles.badgeUpcoming}`}>
                        {a.upcomingEventsCount} upcoming
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
