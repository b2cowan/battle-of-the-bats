'use client';

import Link from 'next/link';
import { ArrowRight, Bell, CreditCard, Lock, ShieldCheck, Users2, type LucideIcon } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { hasCapability } from '@/lib/roles';
import styles from './settings-access.module.css';

type SettingsCard = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  meta: string;
  enabled: boolean;
};

export default function TournamentSettingsAccessPage() {
  const { currentOrg, userRole, userCapabilities } = useOrg();
  usePageTitle('Settings');
  const base = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments`;
  const subscriptionHref = `${base}/settings/subscription`;
  const isOwner = userRole === 'owner';
  const isLeagueOrClub = !!currentOrg && ['league', 'club', 'club_large'].includes(currentOrg.planId);
  const canManageMembers = userRole
    ? userRole === 'owner' || hasCapability(userRole, userCapabilities, 'module_members')
    : false;

  const cards: SettingsCard[] = [
    {
      href: `${base}/settings/members`,
      icon: Users2,
      title: 'Staff & access',
      description: isLeagueOrClub
        ? 'Assign org members to roles on this tournament — admins, staff, and scorekeepers.'
        : 'Invite admins, staff, and scorekeepers, then assign people to the tournaments they manage.',
      meta: canManageMembers ? 'Manage access' : 'Owner/admin only',
      enabled: canManageMembers,
    },
    // Plan & Subscription — Tournament/Tournament Plus only
    ...(!isLeagueOrClub ? [{
      href: subscriptionHref,
      icon: CreditCard,
      title: 'Plan & subscription',
      description: 'Review the Tournament plan, upgrade to Tournament Plus, and confirm tournament-slot usage.',
      meta: isOwner ? 'Open billing' : 'Owner only',
      enabled: isOwner,
    }] : []),
    {
      href: `${base}/settings/notifications`,
      icon: Bell,
      title: 'Notification preferences',
      description: 'Mute all notifications for this tournament, or opt out of individual event types. Settings are personal — only affect your account.',
      meta: 'Manage preferences',
      enabled: true,
    },
  ];

  function renderCard(card: SettingsCard) {
    const Icon = card.icon;
    const content = (
      <>
        <span className={styles.cardIcon}><Icon size={19} /></span>
        <span className={styles.cardBody}>
          <h2>{card.title}</h2>
          <p>{card.description}</p>
          <span className={styles.cardMeta}>
            {card.meta}
            {card.enabled ? <ArrowRight size={13} /> : <Lock size={12} />}
          </span>
        </span>
      </>
    );

    return (
      <Link
        key={card.title}
        href={card.href}
        className={`${styles.card} ${!card.enabled ? styles.lockedCard : ''}`}
        aria-label={card.title}
        onClick={!card.enabled ? e => e.preventDefault() : undefined}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><ShieldCheck size={21} /></div>
          <div>
            <h1 className={styles.pageTitle}>Settings & Access</h1>
            <p className={styles.pageSub}>
              {isLeagueOrClub
                ? 'Manage tournament staff, roles, and notification preferences.'
                : 'Manage the account-level tools a tournament organizer needs without leaving tournament admin.'}
            </p>
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        {cards.map(renderCard)}
      </div>
    </div>
  );
}
