import { supabaseAdmin } from '@/lib/supabase-admin';
import { Building2, Users, Trophy, UsersRound } from 'lucide-react';
import styles from './overview.module.css';

async function getStats() {
  const [orgsRes, tournamentsRes, teamsRes, usersRes] = await Promise.all([
    supabaseAdmin.from('organizations').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tournaments').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('teams').select('*', { count: 'exact', head: true }),
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  return {
    orgs:        orgsRes.count ?? 0,
    tournaments: tournamentsRes.count ?? 0,
    teams:       teamsRes.count ?? 0,
    users:       usersRes.data?.users?.length ?? 0,
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
    </div>
  );
}
