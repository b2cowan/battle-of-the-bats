'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { use, useEffect } from 'react';
import { Users } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useCoaches } from '@/lib/coaches-context';
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
  const router = useRouter();
  const isTeamWorkspace = currentOrg?.accountKind === 'team_workspace' || currentOrg?.planId === 'team';
  // Post-checkout arrival (`?success=1`) — carried through to the team landing so its welcome
  // (the "your team came with you" summary) reads correctly.
  const checkoutSucceeded = searchParams.get('success') === '1';

  // One team → skip this hub and land straight in the portal, the way a single tournament
  // skips the org chooser. The hub only earns its place with 2+ teams (a real switcher).
  // A standalone Premium workspace is always exactly one team, so it always lands inside.
  useEffect(() => {
    if (loading || assignments.length !== 1) return;
    const qs = checkoutSucceeded ? '?success=1' : '';
    router.replace(`/${orgSlug}/coaches/teams/${assignments[0].teamId}${qs}`);
  }, [loading, assignments, orgSlug, checkoutSucceeded, router]);

  if (loading) return <div className={styles.loadingState}>Loading teams…</div>;
  if (assignments.length === 1) return <div className={styles.loadingState}>Opening your portal…</div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div>
            <h1 className={styles.pageTitle}>My Teams</h1>
            <p className={styles.pageSub}>
              {currentOrg?.name} · Coaches Portal
            </p>
          </div>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className={styles.emptyState}>
          <Users size={32} style={{ opacity: 0.25, marginBottom: '0.75rem' }} />
          <p className={styles.emptyStateTitle}>No team assignments yet</p>
          <p className={styles.emptyStateSub}>
            {isTeamWorkspace
              ? 'Your Coaches Portal exists, but your coach assignment is not active yet.'
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
                <div style={{ fontSize: '0.82rem', color: 'var(--home-dim, rgba(255,255,255,0.4))' }}>
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

      {/* Secondary tip — demoted below the team grid so the coach's actual teams are the
          first thing they see. (This hub is only reached with 2+ teams; single-team and
          standalone Premium coaches land straight in their portal.) */}
      {assignments.length > 1 && (
        <div className={styles.tips}>
          <CoachTournamentAwarenessBanner orgSlug={orgSlug} isTeamWorkspace={isTeamWorkspace} />
        </div>
      )}
    </div>
  );
}
