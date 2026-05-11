'use client';
import Link from 'next/link';
import { useOrg } from '@/lib/org-context';
import { useCoaches } from '@/lib/coaches-context';
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

  if (loading) return <p className={styles.muted}>Loading…</p>;

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

      {assignments.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No active team assignments.</p>
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
              <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)' }}>
                {a.programYearName}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
