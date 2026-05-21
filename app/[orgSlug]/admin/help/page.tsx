'use client';
import Link from 'next/link';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import styles from '@/components/help/help.module.css';

interface HubCard {
  title: string;
  desc: string;
  href: string;
}

export default function AdminHelpHubPage() {
  const { userRole, userCapabilities, loading } = useOrg();

  if (loading) {
    return <div className={styles.loadingState}>Loading help…</div>;
  }

  if (!userRole) return null;

  const canHouseLeague  = hasCapability(userRole, userCapabilities, 'module_house_league');
  const canRepTeams     = hasCapability(userRole, userCapabilities, 'module_rep_teams');
  const canAccounting   = hasCapability(userRole, userCapabilities, 'module_accounting');
  const canOrgAdmin     = userRole === 'owner' || userRole === 'admin';

  const cards: HubCard[] = [
    {
      title: 'Tournaments',
      desc:  'Create tournaments, manage the lifecycle, build schedules, enter scores, and seal final results.',
      href:  './help/tournaments',
    },
    ...(canHouseLeague ? [
      {
        title: 'House League',
        desc:  'Set up seasons, manage teams and the draft, run schedules and standings.',
        href:  './help/house-league',
      },
      {
        title: 'House League — Registrations',
        desc:  'Handle player registrations, review submissions, and manage payment status.',
        href:  './help/registrations',
      },
    ] : []),
    ...(canRepTeams ? [{
      title: 'Rep Teams',
      desc:  'Manage rep team programs, tryouts, rosters, cost allocation, and coaches.',
      href:  './help/rep-teams',
    }] : []),
    ...(canAccounting ? [{
      title: 'Accounting',
      desc:  'Track revenue, expenses, and ledger entries across tournaments and programs.',
      href:  './help/accounting',
    }] : []),
    ...(canOrgAdmin ? [{
      title: 'Org Admin & Setup',
      desc:  'Configure your organization settings, manage members, subscription, and diamonds.',
      href:  './help/org',
    }] : []),
    {
      title: 'Exports & Downloads',
      desc:  'Export registrations, schedules, rosters, and reports to Excel, CSV, iCal, or PDF. Covers all formats, plan requirements, calendar import, and privacy defaults.',
      href:  './help/exports',
    },
  ];

  return (
    <div className={styles.helpHub}>
      <div className={styles.helpHubHeader}>
        <h1 className={styles.helpHubTitle}>Help & Guides</h1>
        <p className={styles.helpHubSubtitle}>
          Step-by-step guides for each module — scoped to your role and active features.
        </p>
      </div>
      <div className={styles.helpHubGrid}>
        {cards.map(card => (
          <div key={card.href} className={styles.helpHubCard}>
            <p className={styles.helpHubCardTitle}>{card.title}</p>
            <p className={styles.helpHubCardDesc}>{card.desc}</p>
            <Link href={card.href} className={styles.helpHubCardLink}>
              Read guide →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
