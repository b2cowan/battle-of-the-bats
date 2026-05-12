import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { Building2, Users, Trophy, UsersRound, AlertCircle, Sparkles } from 'lucide-react';
import styles from './overview.module.css';

async function getStats() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [orgsRes, tournamentsRes, teamsRes, usersRes, pastDueRes, newOrgsRes] = await Promise.all([
    supabaseAdmin.from('organizations').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tournaments').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('teams').select('*', { count: 'exact', head: true }),
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabaseAdmin.from('organizations').select('*', { count: 'exact', head: true }).eq('subscription_status', 'past_due'),
    supabaseAdmin.from('organizations').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
  ]);

  return {
    orgs:        orgsRes.count ?? 0,
    tournaments: tournamentsRes.count ?? 0,
    teams:       teamsRes.count ?? 0,
    users:       usersRes.data?.users?.length ?? 0,
    pastDue:     pastDueRes.count ?? 0,
    newOrgs:     newOrgsRes.count ?? 0,
  };
}

export default async function PlatformOverviewPage() {
  const stats = await getStats();

  const cards = [
    { label: 'Organizations', value: stats.orgs,        Icon: Building2  },
    { label: 'Users',         value: stats.users,       Icon: Users      },
    { label: 'Tournaments',   value: stats.tournaments, Icon: Trophy     },
    { label: 'Teams',         value: stats.teams,       Icon: UsersRound },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLabel}>FieldLogicHQ</div>
        <h1 className={styles.title}>Overview</h1>
      </header>
      <div className={styles.grid}>
        {cards.map(({ label, value, Icon }) => (
          <div key={label} className={styles.card}>
            <div className={styles.iconWrap}>
              <Icon size={20} />
            </div>
            <div>
              <div className={styles.num}>{value.toLocaleString()}</div>
              <div className={styles.label}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.healthRow}>
        <div className={styles.healthLabel}>Health</div>
        <div className={styles.healthGrid}>
          <Link
            href="/platform-admin/orgs?status=past_due"
            className={`${styles.healthCard} ${stats.pastDue > 0 ? styles.healthCardWarn : styles.healthCardOk}`}
          >
            <div className={styles.healthIconWrap}>
              <AlertCircle size={18} />
            </div>
            <div>
              <div className={styles.healthNum}>{stats.pastDue}</div>
              <div className={styles.healthCardLabel}>Past Due</div>
            </div>
          </Link>
          <div className={`${styles.healthCard} ${styles.healthCardOk}`}>
            <div className={styles.healthIconWrap}>
              <Sparkles size={18} />
            </div>
            <div>
              <div className={styles.healthNum}>{stats.newOrgs}</div>
              <div className={styles.healthCardLabel}>New (7 days)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
