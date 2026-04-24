'use client';
import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Calendar, Trophy, Megaphone, Tag } from 'lucide-react';
import Link from 'next/link';
import { getTeams, getGames, getAnnouncements, getAgeGroups } from '@/lib/db';
import styles from './dashboard.module.css';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    ageGroups: 0, teams: 0, scheduled: 0, completed: 0, announcements: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      const games = await getGames();
      const ageGroups = await getAgeGroups();
      const teams = await getTeams();
      const announcements = await getAnnouncements();
      setStats({
        ageGroups: ageGroups.length,
        teams: teams.length,
        scheduled: games.filter(g => g.status === 'scheduled').length,
        completed: games.filter(g => g.status === 'completed').length,
        announcements: announcements.length,
      });
    }
    fetchStats();
  }, []);

  const cards = [
    { label: 'Age Groups', value: stats.ageGroups, icon: Tag,        href: '/admin/age-groups',    color: 'purple' },
    { label: 'Teams',      value: stats.teams,     icon: Users,       href: '/admin/teams',          color: 'blue'   },
    { label: 'Scheduled',  value: stats.scheduled, icon: Calendar,    href: '/admin/schedule',       color: 'amber'  },
    { label: 'Completed',  value: stats.completed, icon: Trophy,      href: '/admin/results',        color: 'green'  },
    { label: 'News Posts', value: stats.announcements, icon: Megaphone, href: '/admin/announcements', color: 'pink'  },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerIcon}><LayoutDashboard size={20} /></div>
        <div>
          <h1 className={styles.pageTitle}>Dashboard</h1>
          <p className={styles.pageSub}>Tournament overview and quick access</p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        {cards.map(card => (
          <Link key={card.label} href={card.href} className={`card ${styles.statCard} ${styles[card.color]}`} id={`dashboard-${card.label.toLowerCase().replace(/\s/g, '-')}`}>
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
            { href: '/admin/age-groups',    label: 'Manage Age Groups',    desc: 'Add, edit, or remove age divisions', icon: Tag       },
            { href: '/admin/teams',         label: 'Manage Teams',         desc: 'Add teams and edit player rosters',  icon: Users     },
            { href: '/admin/schedule',      label: 'Schedule Games',       desc: 'Create and manage game schedule',    icon: Calendar  },
            { href: '/admin/results',       label: 'Post Results',         desc: 'Enter scores for completed games',   icon: Trophy    },
            { href: '/admin/announcements', label: 'Post Announcement',    desc: 'Share news with participants',       icon: Megaphone },
          ].map(a => (
            <Link key={a.href} href={a.href} className={`card ${styles.actionCard}`}>
              <div className={styles.actionIcon}><a.icon size={18} /></div>
              <div>
                <div className={styles.actionLabel}>{a.label}</div>
                <div className={styles.actionDesc}>{a.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
