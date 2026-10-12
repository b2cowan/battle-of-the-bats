'use client';
/**
 * SETTINGS & ACCESS — the tournament's settings hub: its door cards (Staff & access · Plan & billing · Notification
 * preferences · Web address). The fourth door came with the Stage 5 addendum (A75, owner 2026-10-12): the workspace's
 * web address left one event's settings for here, on Tournament and Tournament Plus, where the owner opens it in a
 * window and anyone else sees it dimmed with "Owner only" (as Plan & billing). League and Club keep the address in
 * the organization's Settings, so the door is absent there.
 */
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bell, CreditCard, Globe, Lock, Users2, type LucideIcon } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { hasCapability } from '@/lib/roles';
import { isTournamentTier } from '@/lib/billing-urls';
import { WEB_ADDRESS_WORDS as WA } from '@/lib/web-address-words';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import WebAddressWindow from './WebAddressWindow';
import styles from './settings-access.module.css';

/** The settings hub's "?" (Tournament admin redesign Stage 5, E6: otherwise unchanged). */
const SETTINGS_HELP: HelpRequest = { module: 'tournaments', sectionIds: ['settings-and-access'] };

type SettingsCard = {
  /** A door to another page … */
  href?: string;
  /** … or a window over this one (the web address). */
  onOpen?: () => void;
  icon: LucideIcon;
  title: string;
  description: string;
  meta: string;
  enabled: boolean;
};

export default function TournamentSettingsAccessPage() {
  const { currentOrg, userRole, userCapabilities } = useOrg();
  const { currentTournament } = useTournament();
  usePageTitle('Settings');
  const [addressOpen, setAddressOpen] = useState(false);
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
        ? 'Assign org members to roles on this tournament — admins, staff, and volunteers.'
        : 'Invite admins, staff, and volunteers, then assign people to the tournaments they manage.',
      meta: canManageMembers ? 'Manage access' : 'Owner/admin only',
      enabled: canManageMembers,
    },
    // Plan & Subscription — Tournament/Tournament Plus only
    ...(!isLeagueOrClub ? [{
      href: subscriptionHref,
      icon: CreditCard,
      title: 'Plan & billing',
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
    // Web address — Tournament / Tournament Plus only (League and Club keep it in the organization's Settings)
    ...(isTournamentTier(currentOrg?.planId) ? [{
      onOpen: () => setAddressOpen(true),
      icon: Globe,
      title: WA.name,
      description: WA.doorLine(currentOrg?.slug ?? ''),
      meta: isOwner ? WA.doorAction : WA.ownerOnly,
      enabled: isOwner,
    }] : []),
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

    if (card.onOpen) {
      // A window over this page: a button, absent of its window for anyone but the owner.
      return (
        <button
          key={card.title}
          type="button"
          className={`${styles.card} ${styles.cardButton} ${!card.enabled ? styles.lockedCard : ''}`}
          aria-label={card.title}
          aria-haspopup={card.enabled ? 'dialog' : undefined}
          aria-disabled={!card.enabled || undefined}
          onClick={card.enabled ? card.onOpen : undefined}
        >
          {content}
        </button>
      );
    }

    return (
      <Link
        key={card.title}
        href={card.href ?? ''}
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
      <AdminPageHeader
        inlineActions
        title="Settings & access"
        actions={<HelpButton help={SETTINGS_HELP} label="Settings & access" iconOnly />}
      />

      <div className={styles.grid}>
        {cards.map(renderCard)}
      </div>

      {addressOpen && isOwner && currentOrg && (
        <WebAddressWindow
          orgName={currentOrg.name}
          current={currentOrg.slug}
          eventSlug={currentTournament?.slug}
          onClose={() => setAddressOpen(false)}
        />
      )}
    </div>
  );
}
