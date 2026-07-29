'use client';
import { use } from 'react';
import Link from 'next/link';
import { ChevronRight, Users, ShieldCheck } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import HelpButton from '@/components/help/HelpButton';
import CoachStaffPanel from '@/components/coaches/CoachStaffPanel';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

export default function CoachStaffPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const { assignments, loading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const isHeadCoach = assignment?.capabilities.isHeadCoach ?? false;

  if (loading) return <p className={styles.muted}>Loading…</p>;

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
      <div className={styles.breadcrumb}>
        <Link href={`/${orgSlug}/coaches`}>Coaches Portal</Link>
        <span><ChevronRight size={12} /></span>
        <Link href={`/${orgSlug}/coaches/teams/${teamId}`}>{assignment.teamName}</Link>
        <span><ChevronRight size={12} /></span>
        <span>Staff</span>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Users size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Coaching staff</h1>
            <p className={styles.pageSub}>{assignment.teamName}</p>
          </div>
        </div>
        <HelpButton
          iconOnly
          label="Coaching staff"
          help={{ module: 'coaches', sectionIds: ['premium-staff'], fullGuideHref: `/${orgSlug}/coaches/help#premium-staff` }}
        />
      </div>

      {isHeadCoach ? (
        <CoachStaffPanel orgSlug={orgSlug} teamId={teamId} />
      ) : (
        <CoachEmptyState
          quiet
          icon={<ShieldCheck size={20} aria-hidden />}
          headline="Only the head coach manages staff"
          description="This is where a team's assistant coaches are invited and their access is set, one area at a time."
          payoff="It's what gives each assistant their own sign-in rather than a shared password — which is why your own access is set here too."
          blocker="Ask your head coach if you need more areas turned on for you."
        />
      )}
    </div>
  );
}
