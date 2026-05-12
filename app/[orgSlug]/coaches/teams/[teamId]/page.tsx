'use client';
import Link from 'next/link';
import { useCoaches } from '@/lib/coaches-context';
import { Users, Calendar, DollarSign, FileText, Archive } from 'lucide-react';
import styles from '../../coaches.module.css';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', active: 'Active', completed: 'Completed', archived: 'Archived',
};
const STATUS_CSS: Record<string, string> = {
  draft: styles.badgeDraft, active: styles.badgeActive,
  completed: styles.badgeCompleted, archived: styles.badgeArchived,
};

const QUICK_LINKS = [
  { label: 'Roster',       href: '/roster',     icon: Users,     desc: 'Manage players' },
  { label: 'Schedule',     href: '/schedule',   icon: Calendar,  desc: 'Events & games' },
  { label: 'Accounting',   href: '/accounting', icon: DollarSign,desc: 'Budget & dues' },
  { label: 'Documents',    href: '/documents',  icon: FileText,  desc: 'Waivers & forms' },
  { label: 'Past Seasons', href: '/history',    icon: Archive,   desc: 'Completed years' },
];

export default function TeamOverviewPage({
  params,
}: {
  params: { orgSlug: string; teamId: string };
}) {
  const { assignments, loading } = useCoaches();
  const base = `/${params.orgSlug}/coaches/teams/${params.teamId}`;

  if (loading) return <p className={styles.muted}>Loading…</p>;

  const assignment = assignments.find(a => a.teamId === params.teamId);

  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h1 className={styles.pageTitle}>{assignment.teamName}</h1>
              <span className={`${styles.badge} ${STATUS_CSS[assignment.programYearStatus] ?? styles.badgeDraft}`}>
                {STATUS_LABEL[assignment.programYearStatus] ?? assignment.programYearStatus}
              </span>
            </div>
            <p className={styles.pageSub}>
              {assignment.programYearName} —{' '}
              {assignment.coachRole === 'head_coach' ? 'Head Coach' : 'Assistant Coach'}
            </p>
          </div>
        </div>
      </div>

      <div className={styles.teamGrid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))' }}>
        {QUICK_LINKS.map(({ label, href, icon: Icon, desc }) => (
          <Link key={label} href={`${base}${href}`} className={styles.teamCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Icon size={18} style={{ color: 'var(--blueprint-blue, #4fa3e0)', flexShrink: 0 }} />
              <span className={styles.teamName} style={{ fontSize: '0.95rem' }}>{label}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)' }}>{desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
