'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { use } from 'react';
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
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);
  const { currentOrg } = useOrg();
  const { assignments, loading } = useCoaches();
  const searchParams = useSearchParams();
  const isTeamWorkspace = currentOrg?.accountKind === 'team_workspace' || currentOrg?.planId === 'team';
  const checkoutSucceeded = searchParams.get('success') === '1';

  if (loading) return <div className={styles.loadingState}>Loading teams…</div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div>
            <h1 className={styles.pageTitle}>{isTeamWorkspace ? 'Team Dashboard' : 'My Teams'}</h1>
            <p className={styles.pageSub}>
              {currentOrg?.name} - {isTeamWorkspace ? 'Team Workspace' : 'Coaches Portal'}
            </p>
          </div>
        </div>
      </div>

      {checkoutSucceeded && isTeamWorkspace && assignments.length > 0 && (
        <HelpCallout
          variant="info"
          title="Team workspace ready"
          body="Checkout is complete and your team workspace is active."
          cta={{ label: `Open ${assignments[0].teamName}`, href: `/${orgSlug}/coaches/teams/${assignments[0].teamId}` }}
        />
      )}

      {assignments.length > 0 && (
        <HelpCallout
          variant="info"
          title={isTeamWorkspace ? 'Welcome to your Team workspace' : 'Welcome to your coaching portal'}
          body={
            isTeamWorkspace
              ? 'This workspace is scoped to your entitled team, with roster, schedule, dues, budget, and documents in one place.'
              : "You're the operator - your org handles tryouts and setup; you run day-to-day. Start by exploring your team below."
          }
          dismissible
          localStorageKey={`flhq-help-dismissed-coaches-welcome-${orgSlug}`}
        />
      )}

      {assignments.length > 0 && (
        <CoachTournamentAwarenessBanner orgSlug={orgSlug} isTeamWorkspace={isTeamWorkspace} />
      )}

      {assignments.length > 0 && isTeamWorkspace && (
        <HelpCallout
          variant="tip"
          title="Link a parent organization"
          body="If your team belongs to a club or association, you can request a Basic visibility link or review an invitation from the org. The connection does not take over billing or your team data."
          cta={{ label: 'Manage org links', href: `/${orgSlug}/coaches/link-org` }}
          dismissible
          localStorageKey={`flhq-help-dismissed-team-link-${orgSlug}`}
        />
      )}

      {assignments.length === 0 ? (
        <div className={styles.emptyState}>
          <Users size={32} style={{ opacity: 0.25, marginBottom: '0.75rem' }} />
          <p className={styles.emptyStateTitle}>No team assignments yet</p>
          <p className={styles.emptyStateSub}>
            {isTeamWorkspace
              ? 'Your Team workspace exists, but your coach assignment is not active yet.'
              : "You'll appear here once your org admin assigns you to a team."}
          </p>
        </div>
      ) : (
        <div className={styles.teamGrid}>
          {assignments.map(a => (
            <Link
              key={a.teamId}
              href={`/${orgSlug}/coaches/teams/${a.teamId}`}
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
