'use client';
/**
 * SETTINGS & ACCESS — the tournament's settings hub: its door cards (Staff & access · Plan & billing · Notification
 * preferences · Web address). The fourth door came with the Stage 5 addendum (A75, owner 2026-10-12): the workspace's
 * web address left one event's settings for here, on Tournament and Tournament Plus, where the owner opens it in a
 * window and anyone else sees it dimmed with "Owner only" (as Plan & billing). League and Club keep the address in
 * the organization's Settings, so the door is absent there.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bell, CreditCard, Globe, Landmark, Lock, Users2, type LucideIcon } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { hasCapability, hasBillingAccess } from '@/lib/roles';
import { getBillingHref, isTournamentTier } from '@/lib/billing-urls';
import { WEB_ADDRESS_WORDS as WA } from '@/lib/web-address-words';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import WebAddressWindow from './WebAddressWindow';
import { loadPayouts, type PayoutsView } from '@/components/admin/kit/club/PayoutsCard';
import { LEAVING_WORDS, PAYOUTS_WORDS as PW } from '@/lib/online-payment-words';
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
  // Payouts (Club Tier Stage 12a, A8): Tournament Plus's home for the card. The read answers null while online payments
  // aren't offered (switch, plan) or the viewer is neither the owner nor the treasurer, and the tile then stays away.
  const [payouts, setPayouts] = useState<PayoutsView | null>(null);
  const tournamentTier = isTournamentTier(currentOrg?.planId);
  useEffect(() => {
    if (!tournamentTier || !currentOrg?.slug) return;
    let stale = false;
    void loadPayouts(currentOrg.slug).then(v => { if (!stale) setPayouts(v); });
    return () => { stale = true; };
  }, [tournamentTier, currentOrg?.slug]);
  const base = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments`;
  const subscriptionHref = getBillingHref(currentOrg ?? { slug: 'admin', planId: 'tournament' });
  const isOwner = userRole === 'owner';
  const canManageBilling = hasBillingAccess(userRole, userCapabilities);
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
      meta: canManageBilling ? 'Open billing' : 'Billing access required',
      enabled: canManageBilling,
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
    // Payouts — Tournament Plus only, at the end (A8). League and Club keep it in the organization's Settings.
    ...(tournamentTier && payouts ? [{
      href: `${base}/settings/payouts`,
      icon: Landmark,
      title: PW.tile.title,
      // 12d-2: a club moved to Tournament keeps its account connected — the tile reads "Online payments off", and its
      // owner's door is the card's own (Open Stripe), never "Set up payouts" (/review of Part 3).
      description: payouts.windDown && payouts.state !== 'disconnected' ? LEAVING_WORDS.windDown.pill : PW.tile.sub[payouts.state],
      meta: payouts.windDown
        ? (payouts.state === 'disconnected' ? PW.pill.disconnected : LEAVING_WORDS.windDown.pill)
        : payouts.isOwner ? PW.button[payouts.state] : PW.pill[payouts.state],
      enabled: true,
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
