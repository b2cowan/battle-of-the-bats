'use client';
import { useState, useEffect } from 'react';
import { Users, Calendar, Trophy, Megaphone, Tag } from 'lucide-react';
import Link from 'next/link';
import { getTeams, getGames, getAnnouncements, getAgeGroups } from '@/lib/db';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { LiveEventLog } from '@/components/admin/LiveEventLog';
import styles from './dashboard.module.css';

export default function AdminDashboard() {
  const { currentTournament } = useTournament();
  const { currentOrg } = useOrg();
  const base = `/${currentOrg?.slug ?? 'milton-bats'}/admin`;
  const [stats, setStats] = useState({
    ageGroups: 0, teams: 0, scheduled: 0, completed: 0, announcements: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      const tid = currentTournament?.id;
      const games = await getGames(tid);
      const ageGroups = await getAgeGroups(tid);
      const teams = await getTeams(tid);
      const announcements = await getAnnouncements(tid);
      setStats({
        ageGroups: ageGroups.length,
        teams: teams.length,
        scheduled: games.filter(g => g.status === 'scheduled').length,
        completed: games.filter(g => g.status === 'completed').length,
        announcements: announcements.length,
      });
    }
    fetchStats();
  }, [currentTournament?.id]);

  const cards = [
    { label: 'Age Groups', value: stats.ageGroups,      icon: Tag,       key: 'age-groups'    },
    { label: 'Teams',      value: stats.teams,          icon: Users,     key: 'teams'         },
    { label: 'Scheduled',  value: stats.scheduled,      icon: Calendar,  key: 'schedule'      },
    { label: 'Completed',  value: stats.completed,      icon: Trophy,    key: 'results'       },
    { label: 'News Posts', value: stats.announcements,  icon: Megaphone, key: 'announcements' },
  ];

  return (
    <div className={styles.page}>
      <header className="flex items-center justify-between border-b border-blueprint-blue/60 pb-4 mb-8">
        <div>
          <div className="hud-label mb-1">System Node</div>
          <h1 className="font-sans font-extrabold text-2xl uppercase tracking-tighter text-fl-text">
            {currentOrg?.name ?? 'Admin'}
          </h1>
        </div>
        <div className="hidden md:flex items-center gap-6 font-mono text-xs text-data-gray">
          <span className="live-dot text-logic-lime font-bold">SYNC: ACTIVE</span>
          <span>NODE: {currentOrg?.slug}</span>
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

      <div className={styles.quickLinks}>
        <h2 className={styles.sectionTitle}>Quick Actions</h2>
        <div className={styles.actionsGrid}>
          {[
            { key: 'age-groups',    label: 'Manage Age Groups',    desc: 'Add, edit, or remove age divisions', icon: Tag       },
            { key: 'teams',         label: 'Manage Teams',         desc: 'Add teams and edit player rosters',  icon: Users     },
            { key: 'schedule',      label: 'Schedule Games',       desc: 'Create and manage game schedule',    icon: Calendar  },
            { key: 'results',       label: 'Post Results',         desc: 'Enter scores for completed games',   icon: Trophy    },
            { key: 'announcements', label: 'Post Announcement',    desc: 'Share news with participants',       icon: Megaphone },
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
        <LiveEventLog tournamentId={currentTournament?.id ?? ''} />
      </div>
    </div>
  );
}
