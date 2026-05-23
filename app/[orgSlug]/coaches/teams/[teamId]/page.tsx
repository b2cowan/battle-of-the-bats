'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useCoaches } from '@/lib/coaches-context';
import { useOrg } from '@/lib/org-context';
import { Archive, Calendar, CheckCircle2, Circle, DollarSign, FileText, Link2, Users } from 'lucide-react';
import styles from '../../coaches.module.css';
import type { RepRosterPlayer, RepTeamEvent } from '@/lib/types';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
};

const STATUS_CSS: Record<string, string> = {
  draft: styles.badgeDraft,
  active: styles.badgeActive,
  completed: styles.badgeCompleted,
  archived: styles.badgeArchived,
};

const QUICK_LINKS = [
  { label: 'Roster',       href: '/roster',     icon: Users,      desc: 'Manage players' },
  { label: 'Schedule',     href: '/schedule',   icon: Calendar,   desc: 'Events & games' },
  { label: 'Accounting',   href: '/accounting', icon: DollarSign, desc: 'Budget & dues' },
  { label: 'Documents',    href: '/documents',  icon: FileText,   desc: 'Waivers & forms' },
  { label: 'Past Seasons', href: '/history',    icon: Archive,    desc: 'Completed years' },
];

interface SetupStats {
  activeRosterCount: number;
  positionedRosterCount: number;
  eventCount: number;
  gameCount: number;
  budgetSet: boolean;
}

interface SetupItem {
  label: string;
  detail: string;
  href: string;
  complete: boolean;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function TeamOverviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const { assignments, loading } = useCoaches();
  const { currentOrg } = useOrg();
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const [setupStats, setSetupStats] = useState<SetupStats | null>(null);
  const [setupLoading, setSetupLoading] = useState(true);
  const [setupError, setSetupError] = useState('');

  const loadSetup = useCallback(async () => {
    setSetupLoading(true);
    setSetupError('');
    try {
      const [rosterRes, eventsRes, budgetRes] = await Promise.all([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget`),
      ]);

      if (!rosterRes.ok || !eventsRes.ok || !budgetRes.ok) {
        throw new Error('Setup status could not be loaded');
      }

      const rosterData: { players?: RepRosterPlayer[] } = await rosterRes.json();
      const eventsData: { events?: RepTeamEvent[] } = await eventsRes.json();
      const budgetData: { budgetAmount?: number | null } = await budgetRes.json();
      const activePlayers = (rosterData.players ?? []).filter(player => player.status === 'active');
      const events = eventsData.events ?? [];
      const games = events.filter(event => ['league_game', 'tournament_game', 'scrimmage'].includes(event.eventType));

      setSetupStats({
        activeRosterCount: activePlayers.length,
        positionedRosterCount: activePlayers.filter(player => (
          Boolean(player.playerNumber) && (Boolean(player.primaryPosition) || Boolean(player.secondaryPosition))
        )).length,
        eventCount: events.length,
        gameCount: games.length,
        budgetSet: budgetData.budgetAmount != null,
      });
    } catch (error: unknown) {
      setSetupError(errorMessage(error, 'Setup status could not be loaded'));
    } finally {
      setSetupLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => {
    if (!loading) void Promise.resolve().then(loadSetup);
  }, [loading, loadSetup]);

  if (loading) return <p className={styles.muted}>Loading...</p>;

  const assignment = assignments.find(a => a.teamId === teamId);

  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  const isTeamWorkspace = currentOrg?.accountKind === 'team_workspace' || currentOrg?.planId === 'team';
  const isLinkedOrOwned = currentOrg?.teamWorkspaceStatus === 'linked' || currentOrg?.teamWorkspaceStatus === 'org_owned';
  const setupItems: SetupItem[] = [
    {
      label: 'Confirm season',
      detail: `${assignment.programYearName} is active`,
      href: base,
      complete: true,
    },
    {
      label: 'Add active roster',
      detail: setupStats ? `${setupStats.activeRosterCount} active player${setupStats.activeRosterCount === 1 ? '' : 's'}` : 'Roster status',
      href: `${base}/roster`,
      complete: (setupStats?.activeRosterCount ?? 0) > 0,
    },
    {
      label: 'Add jersey and positions',
      detail: setupStats ? `${setupStats.positionedRosterCount} player${setupStats.positionedRosterCount === 1 ? '' : 's'} with setup details` : 'Roster details',
      href: `${base}/roster`,
      complete: Boolean(setupStats && setupStats.activeRosterCount > 0 && setupStats.positionedRosterCount === setupStats.activeRosterCount),
    },
    {
      label: 'Build calendar',
      detail: setupStats ? `${setupStats.eventCount} event${setupStats.eventCount === 1 ? '' : 's'} scheduled` : 'Schedule status',
      href: `${base}/schedule`,
      complete: (setupStats?.eventCount ?? 0) > 0,
    },
    {
      label: 'Prepare game lineups',
      detail: setupStats ? `${setupStats.gameCount} game${setupStats.gameCount === 1 ? '' : 's'} or scrimmage${setupStats.gameCount === 1 ? '' : 's'}` : 'Game status',
      href: `${base}/schedule`,
      complete: (setupStats?.gameCount ?? 0) > 0,
    },
    {
      label: 'Set budget',
      detail: setupStats?.budgetSet ? 'Budget is set' : 'No budget yet',
      href: `${base}/accounting`,
      complete: Boolean(setupStats?.budgetSet),
    },
    ...(isTeamWorkspace ? [{
      label: 'Link parent org',
      detail: isLinkedOrOwned ? 'Organization link active' : 'Optional',
      href: `/${orgSlug}/coaches/link-org`,
      complete: isLinkedOrOwned,
    }] : []),
  ];
  const completedCount = setupItems.filter(item => item.complete).length;

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
              {assignment.programYearName} -{' '}
              {assignment.coachRole === 'head_coach' ? 'Head Coach' : 'Assistant Coach'}
            </p>
          </div>
        </div>
      </div>

      <section className={styles.setupPanel} aria-labelledby="season-setup-title">
        <div className={styles.setupHeader}>
          <div>
            <p className={styles.setupKicker}>Season setup</p>
            <h2 id="season-setup-title" className={styles.setupTitle}>
              {completedCount} of {setupItems.length} complete
            </h2>
          </div>
          <span className={styles.setupProgress}>{Math.round((completedCount / setupItems.length) * 100)}%</span>
        </div>
        {setupError && <p className={styles.errorText}>{setupError}</p>}
        <div className={styles.setupList}>
          {setupItems.map(item => {
            const Icon = item.complete ? CheckCircle2 : Circle;
            return (
              <Link key={item.label} href={item.href} className={styles.setupItem}>
                <Icon size={16} className={item.complete ? styles.setupIconDone : styles.setupIconTodo} />
                <span className={styles.setupItemText}>
                  <span className={styles.setupItemLabel}>{item.label}</span>
                  <span className={styles.setupItemDetail}>
                    {setupLoading ? 'Checking...' : item.detail}
                  </span>
                </span>
                {item.label === 'Link parent org' && <Link2 size={14} className={styles.setupActionIcon} />}
              </Link>
            );
          })}
        </div>
      </section>

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
