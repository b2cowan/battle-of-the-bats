'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ClipboardList, CreditCard, Lock, RefreshCw, Settings2, ShieldCheck, Users2, type LucideIcon } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature, requiresTournamentPlusCopy, type PlanFeature } from '@/lib/plan-features';
import styles from './settings-access.module.css';

type SettingsCard = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  meta: string;
  enabled: boolean;
  comingSoon: boolean;
  feature?: PlanFeature;
};

type SettingsTab = 'setup' | 'people' | 'account';

export default function TournamentSettingsAccessPage() {
  const { currentOrg, userRole, userCapabilities } = useOrg();
  const [activeTab, setActiveTab] = useState<SettingsTab>('setup');
  const base = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments`;
  const isOwner = userRole === 'owner';
  const canManageMembers = userRole
    ? userRole === 'owner' || hasCapability(userRole, userCapabilities, 'module_members')
    : false;
  const canUseRegistrationQuestions = Boolean(currentOrg && hasPlanFeature(currentOrg.planId, 'custom_registration_fields'));
  const setupCards: SettingsCard[] = [
    {
      href: `${base}/settings/registration-fields`,
      icon: ClipboardList,
      title: 'Registration questions',
      description: 'Collect tournament-specific coach details, confirmations, dropdown answers, and file uploads during team registration.',
      meta: 'Tournament Plus',
      enabled: canUseRegistrationQuestions,
      comingSoon: false,
      feature: 'custom_registration_fields',
    },
    {
      href: `${base}/manage`,
      icon: RefreshCw,
      title: 'Tournaments & seasons',
      description: 'Create new tournament seasons, rename or re-slug existing ones, manage lifecycle status, and archive completed events.',
      meta: 'Manage tournaments',
      enabled: true,
      comingSoon: false,
    },
  ];
  const peopleCards: SettingsCard[] = [
    {
      href: `${base}/settings/members`,
      icon: Users2,
      title: 'Staff & access',
      description: 'Invite admins, staff, and scorekeepers, then assign people to the tournaments they should manage.',
      meta: canManageMembers ? 'Manage access' : 'Owner/admin only',
      enabled: canManageMembers,
      comingSoon: false,
    },
  ];
  const accountCards: SettingsCard[] = [
    {
      href: `${base}/settings/subscription`,
      icon: CreditCard,
      title: 'Plan & subscription',
      description: 'Review the Tournament plan, upgrade to Tournament Plus, and confirm tournament-slot usage.',
      meta: isOwner ? 'Open billing' : 'Owner only',
      enabled: isOwner,
      comingSoon: false,
    },
  ];
  const tabs: Array<{ id: SettingsTab; label: string; description: string }> = [
    {
      id: 'setup',
      label: 'Tournament Setup',
      description: 'Configure event dates, registration questions, and manage tournament seasons.',
    },
    {
      id: 'people',
      label: 'People & Access',
      description: 'Invite the event crew and scope people to the tournaments they support.',
    },
    {
      id: 'account',
      label: 'Account',
      description: 'Review plan access, billing, and tournament-slot usage.',
    },
  ];
  const activeTabDetails = tabs.find(tab => tab.id === activeTab) ?? tabs[0];

  function renderCard(card: SettingsCard) {
    const Icon = card.icon;
    const lockedByPlan = Boolean(card.feature && !card.enabled);
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

    return card.enabled ? (
      <Link key={card.title} href={card.href} className={styles.card}>
        {content}
      </Link>
    ) : (
      <div
        key={card.title}
        className={`${styles.card} ${card.comingSoon ? styles.comingSoonCard : styles.lockedCard}`}
        aria-disabled="true"
        title={lockedByPlan ? requiresTournamentPlusCopy(card.feature!) : undefined}
      >
        {content}
      </div>
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
              Manage the account-level tools a tournament organizer needs without leaving tournament admin.
            </p>
          </div>
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Settings categories">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`settings-panel-${tab.id}`}
            id={`settings-tab-${tab.id}`}
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section
        className={styles.section}
        role="tabpanel"
        id={`settings-panel-${activeTab}`}
        aria-labelledby={`settings-tab-${activeTab}`}
      >
        <div className={styles.sectionHeader}>
          <h2>{activeTabDetails.label}</h2>
          <p>{activeTabDetails.description}</p>
        </div>
        <div className={styles.grid}>
          {activeTab === 'setup' && setupCards.map(renderCard)}
          {activeTab === 'people' && peopleCards.map(renderCard)}
          {activeTab === 'account' && accountCards.map(renderCard)}
        </div>
      </section>
    </div>
  );
}
