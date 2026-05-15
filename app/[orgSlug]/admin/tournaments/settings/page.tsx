'use client';

import Link from 'next/link';
import { ArrowRight, CreditCard, Palette, ShieldCheck, SlidersHorizontal, Users2 } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import styles from './settings-access.module.css';

export default function TournamentSettingsAccessPage() {
  const { currentOrg, userRole, userCapabilities } = useOrg();
  const base = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments`;
  const isOwner = userRole === 'owner';
  const canManageMembers = userRole
    ? userRole === 'owner' || hasCapability(userRole, userCapabilities, 'module_members')
    : false;
  const cards = [
    {
      href: `${base}/settings/members`,
      icon: Users2,
      title: 'Staff & access',
      description: 'Invite admins, staff, and officials, then assign people to the tournaments they should manage.',
      meta: canManageMembers ? 'Manage access' : 'Owner/admin only',
      enabled: canManageMembers,
      comingSoon: false,
    },
    {
      href: `${base}/settings/subscription`,
      icon: CreditCard,
      title: 'Plan & subscription',
      description: 'Review the Tournament plan, upgrade to Tournament Plus, and confirm tournament-slot usage.',
      meta: isOwner ? 'Open billing' : 'Owner only',
      enabled: isOwner,
      comingSoon: false,
    },
    {
      href: `${base}/settings/branding`,
      icon: Palette,
      title: 'Public site & branding',
      description: 'Set a logo, color theme, hero banner, and font for this tournament\'s public page — each tournament can have its own look.',
      meta: isOwner ? 'Manage branding' : 'Owner only',
      enabled: isOwner,
      comingSoon: false,
    },
    {
      href: `${base}/settings/scoring`,
      icon: SlidersHorizontal,
      title: 'Score settings',
      description: 'Control whether submitted scores require admin finalization before they become official for this tournament.',
      meta: isOwner ? 'Manage scoring' : 'Owner only',
      enabled: isOwner,
      comingSoon: false,
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><ShieldCheck size={21} /></div>
          <div>
            <h1 className={styles.pageTitle}>Settings & Access</h1>
            <p className={styles.pageSub}>
              Manage the account-level tools a tournament organizer needs without leaving tournament admin.
            </p>
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        {cards.map(card => {
          const Icon = card.icon;
          const content = (
            <>
              <span className={styles.cardIcon}><Icon size={19} /></span>
              <span className={styles.cardBody}>
                <h2>{card.title}</h2>
                <p>{card.description}</p>
                <span className={styles.cardMeta}>
                  {card.meta}
                  {card.enabled && <ArrowRight size={13} />}
                </span>
              </span>
            </>
          );

          return card.enabled ? (
            <Link key={card.title} href={card.href} className={styles.card}>
              {content}
            </Link>
          ) : (
            <div key={card.title} className={`${styles.card} ${card.comingSoon ? styles.comingSoonCard : styles.lockedCard}`} aria-disabled="true">
              {content}
            </div>
          );
        })}
      </div>

      <div className={styles.note}>
        Tournament operations (registrations, schedule, results) live in the main sidebar. This section covers account setup, staff permissions, subscription, public-site appearance, and score policy.
      </div>
    </div>
  );
}
