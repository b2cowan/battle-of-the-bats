'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Users, ChevronRight } from 'lucide-react';
import HelpTooltip from '@/components/help/HelpTooltip';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import FeedbackModal from '@/components/FeedbackModal';
import styles from '../../../../rep-teams.module.css';
import type { RepTeam, RepProgramYear, RepProgramYearStatus } from '@/lib/types';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', active: 'Active', completed: 'Completed', archived: 'Archived',
};
const STATUS_CSS: Record<string, string> = {
  draft: styles.badgeDraft, active: styles.badgeActive,
  completed: styles.badgeCompleted, archived: styles.badgeArchived,
};

const NEXT_STATUS: Record<RepProgramYearStatus, RepProgramYearStatus | null> = {
  draft: 'active', active: 'completed', completed: 'archived', archived: null,
};
const NEXT_LABEL: Record<RepProgramYearStatus, string> = {
  draft: 'Activate', active: 'Mark Completed', completed: 'Archive', archived: '',
};

interface Summary {
  rosterCount: number;
  pendingTryouts: number;
  coachCount: number;
  upcomingEvents: number;
}

export default function ProgramYearOverviewPage({
  params,
}: {
  params: { orgSlug: string; teamId: string; yearId: string };
}) {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  const canWrite = userRole === 'owner' || userRole === 'admin';

  const [team, setTeam] = useState<RepTeam | null>(null);
  const [programYear, setProgramYear] = useState<RepProgramYear | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [fetching, setFetching] = useState(true);
  const [transitioning, setTransitioning] = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'danger'>('success');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  function showFeedback(type: 'success' | 'danger', msg: string) {
    setFeedbackType(type); setFeedbackMsg(msg); setFeedbackOpen(true);
  }

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(
        `/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setTeam(data.team);
      setProgramYear(data.programYear);
      setSummary(data.summary);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to load program year.');
    } finally {
      setFetching(false);
    }
  }, [params.teamId, params.yearId]);

  useEffect(() => { if (currentOrg) load(); }, [currentOrg, load]);

  async function handleTransition(newStatus: RepProgramYearStatus) {
    setTransitioning(true);
    try {
      const res = await fetch(
        `/api/admin/rep-teams/teams/${params.teamId}/program-years/${params.yearId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to update status');
      setProgramYear(data.programYear);
      showFeedback('success', `Status updated to ${STATUS_LABEL[newStatus]}.`);
    } catch (e: any) {
      showFeedback('danger', e.message ?? 'Failed to update status.');
    } finally {
      setTransitioning(false);
    }
  }

  if (loading || fetching) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_rep_teams')) {
    return (
      <div className={styles.accessDenied}>
        <Users size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the Rep Teams module.</p>
      </div>
    );
  }

  if (!team || !programYear) {
    return <p className={styles.muted}>Program year not found.</p>;
  }

  const yearBase = `${base}/rep-teams/teams/${team.id}/program-years/${programYear.id}`;
  const nextStatus = NEXT_STATUS[programYear.status];

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href={`${base}/rep-teams`}>Rep Teams</Link>
        <span><ChevronRight size={12} /></span>
        <Link href={`${base}/rep-teams/teams/${team.id}`}>{team.name}</Link>
        <span><ChevronRight size={12} /></span>
        <span>{programYear.name}</span>
      </div>

      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h1 className={styles.pageTitle}>{programYear.name}</h1>
              <HelpTooltip
                title="What is a program year?"
                body="A program year represents one competitive season for a team. Roster, schedule, finances, and tryouts are all scoped to a program year. Create a new one at the start of each season."
              />
              <span className={`${styles.badge} ${STATUS_CSS[programYear.status] ?? styles.badgeDraft}`}>
                {STATUS_LABEL[programYear.status] ?? programYear.status}
              </span>
              {programYear.tryoutOpen && (
                <span className={`${styles.badge} ${styles.badgeActive}`}>Tryouts Open</span>
              )}
            </div>
            <p className={styles.pageSub}>{team.name}</p>
          </div>
        </div>
      </div>

      {/* Lifecycle transition */}
      {canWrite && nextStatus && (
        <div className={styles.lifecycleRow}>
          <span className={styles.lifecycleLabel}>Status</span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleTransition(nextStatus)}
            disabled={transitioning}
          >
            {transitioning ? 'Updating…' : NEXT_LABEL[programYear.status]}
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryCardLabel}>Roster</span>
          <span className={styles.summaryCardValue}>{summary?.rosterCount ?? 0}</span>
          <Link href={`${yearBase}/roster`} className={styles.summaryCardLink}>View roster →</Link>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryCardLabel}>Tryouts Pending</span>
          <span className={styles.summaryCardValue}>{summary?.pendingTryouts ?? 0}</span>
          <Link href={`${yearBase}/tryouts`} className={styles.summaryCardLink}>View tryouts →</Link>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryCardLabel}>Coaches</span>
          <span className={styles.summaryCardValue}>{summary?.coachCount ?? 0}</span>
          <Link href={`${yearBase}/coaches`} className={styles.summaryCardLink}>Manage coaches →</Link>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryCardLabel}>Upcoming Events</span>
          <span className={styles.summaryCardValue}>{summary?.upcomingEvents ?? 0}</span>
          <Link href={`${yearBase}/schedule`} className={styles.summaryCardLink}>View schedule →</Link>
        </div>
      </div>

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)}
        title={feedbackType === 'success' ? 'Done' : 'Error'} message={feedbackMsg} type={feedbackType} />
    </div>
  );
}
