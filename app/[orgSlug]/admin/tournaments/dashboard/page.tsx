'use client';
import { useState, useEffect } from 'react';
import { Users, Calendar, Trophy, Megaphone, Tag } from 'lucide-react';
import Link from 'next/link';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { LiveEventLog } from '@/components/admin/LiveEventLog';
import styles from './dashboard.module.css';

type DashboardStats = {
  ageGroups: number;
  teams: number;
  scheduled: number;
  completed: number;
  announcements: number;
};

const EMPTY_STATS: DashboardStats = {
  ageGroups: 0,
  teams: 0,
  scheduled: 0,
  completed: 0,
  announcements: 0,
};

export default function AdminDashboard() {
  const { currentTournament } = useTournament();
  const { currentOrg } = useOrg();
  const base = `/${currentOrg?.slug ?? 'milton-bats'}/admin/tournaments`;
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    const tournamentId = currentTournament?.id;
    if (!tournamentId) return;

    const controller = new AbortController();

    async function fetchStats(selectedTournamentId: string) {
      try {
        const res = await fetch(
          `/api/admin/tournament-dashboard?tournamentId=${encodeURIComponent(selectedTournamentId)}`,
          { signal: controller.signal },
        );
        const data = await res.json().catch(() => null) as Partial<DashboardStats> & { error?: string } | null;
        if (!res.ok) {
          throw new Error(data?.error ?? 'Unable to load dashboard stats.');
        }
        setStats({
          ageGroups: data?.ageGroups ?? 0,
          teams: data?.teams ?? 0,
          scheduled: data?.scheduled ?? 0,
          completed: data?.completed ?? 0,
          announcements: data?.announcements ?? 0,
        });
        setStatsError('');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setStats(EMPTY_STATS);
        setStatsError(err instanceof Error ? err.message : 'Unable to load dashboard stats.');
      }
    }

    void fetchStats(tournamentId);

    return () => controller.abort();
  }, [currentTournament?.id]);

  const statusLabel = (currentTournament?.status ?? 'draft').toUpperCase();
  const isLive = currentTournament?.status === 'active';
  const visibleStats = currentTournament?.id ? stats : EMPTY_STATS;

  const cards = [
    { label: 'Age Groups', value: visibleStats.ageGroups,     icon: Tag,       key: 'age-groups'    },
    { label: 'Teams',      value: visibleStats.teams,         icon: Users,     key: 'teams'         },
    { label: 'Scheduled',  value: visibleStats.scheduled,     icon: Calendar,  key: 'schedule'      },
    { label: 'Completed',  value: visibleStats.completed,     icon: Trophy,    key: 'results'       },
    { label: 'News Posts', value: visibleStats.announcements, icon: Megaphone, key: 'announcements' },
  ];

  return (
    <div className={styles.page}>
      <header className="flex items-center justify-between border-b border-blueprint-blue/60 pb-4 mb-8">
        <div>
          <div className="hud-label mb-1">Admin</div>
          <h1 className="font-sans font-extrabold text-2xl uppercase tracking-tighter text-fl-text">
            {currentOrg?.name ?? 'Admin'}
          </h1>
        </div>
        <div className="hidden md:flex items-center gap-6 font-mono text-xs text-data-gray">
          <span className={isLive ? 'live-dot text-logic-lime font-bold' : 'text-data-gray font-bold'}>
            {statusLabel}
          </span>
          <span>{currentTournament?.name ?? currentOrg?.slug}</span>
        </div>
      </header>

      <div className={styles.statsGrid}>
        {cards.map(card => (
          <Link key={card.label} href={`${base}/${card.key}`} className={`card ${styles.statCard}`} id={`dashboard-${card.label.toLowerCase().replace(/\s/g, '-')}`}>
            <div className={styles.statIcon}><card.icon size={22} /></div>
            <div>
              <div className={styles.statNum}>{card.value}</div>
              <div className={styles.statLabel}>{card.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {currentTournament?.id && statsError && (
        <div className="mt-3 text-xs text-data-gray">
          Dashboard counts are unavailable right now.
        </div>
      )}

      <div className={styles.quickLinks}>
        <h2 className={styles.sectionTitle}>Quick Actions</h2>
        <div className={styles.actionsGrid}>
          {[
            { key: 'age-groups',    label: 'Manage Age Groups', desc: 'Add, edit, or remove age divisions', icon: Tag       },
            { key: 'teams',         label: 'Manage Teams',      desc: 'Add teams and edit player rosters',  icon: Users     },
            { key: 'schedule',      label: 'Schedule Games',    desc: 'Create and manage game schedule',    icon: Calendar  },
            { key: 'results',       label: 'Post Results',      desc: 'Enter scores for completed games',   icon: Trophy    },
            { key: 'announcements', label: 'Post Announcement', desc: 'Share news with participants',       icon: Megaphone },
          ].map(a => (
            <Link key={a.key} href={`${base}/${a.key}`} className={`card ${styles.actionCard}`}>
              <div className={styles.actionIcon}><a.icon size={18} /></div>
              <div>
                <div className={styles.actionLabel}>{a.label}</div>
                <div className={styles.actionDesc}>{a.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className={styles.recentEvents}>
        <h2 className={styles.sectionTitle}>Recent Events</h2>
        {currentTournament?.id ? (
          <LiveEventLog tournamentId={currentTournament.id} />
        ) : (
          <div className="font-mono text-xs text-data-gray/50">{'// Awaiting tournament selection...'}</div>
        )}
      </div>
    </div>
  );
}
