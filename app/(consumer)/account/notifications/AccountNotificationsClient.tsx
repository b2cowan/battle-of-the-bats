'use client';

/**
 * app/(consumer)/account/notifications/AccountNotificationsClient.tsx
 *
 * The universal notification-settings page (Notification Settings Phase 1, locked D1):
 * one card per workspace the signed-in person belongs to, each rendering the shared
 * PreferencesTable scoped to that context, plus a single user-global device panel.
 *
 * Every bell in the product deep-links here with ?focus=<key> so the reader lands on
 * the card they came from (admin bell → org card; coaches bell → coach card).
 */

import { useEffect, useMemo, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import PushDeviceTester from '@/components/notifications/PushDeviceTester';
import PreferencesTable, { type PreferenceSection } from '@/components/notifications/PreferencesTable';
import { useOrgPreferences } from '@/components/notifications/useOrgPreferences';
import { NOTIFICATION_SECTIONS, COACH_SETTINGS_SECTIONS } from '@/lib/notification-labels';
import styles from './AccountNotifications.module.css';

export type NotificationCard = {
  kind: 'organization' | 'coaches_premium';
  /** Stable deep-link target — 'org-<slug>' or 'coach-<slug>'. Bells pass this as ?focus=. */
  focusKey: string;
  orgSlug: string;
  orgName: string;
  role: string;
  badgeLabel: string;
  subtitle: string;
  /** Reserved module capabilities the org holds (org card only) — gates optional sections. */
  modules: string[];
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function CardHeader({ card }: { card: NotificationCard }) {
  const badgeClass = card.kind === 'coaches_premium' ? styles.badgeCoach : styles.badgeOrg;
  return (
    <div className={styles.cardHeader}>
      <div className={`${styles.badge} ${badgeClass}`}>{initials(card.orgName)}</div>
      <div className={styles.cardHeaderText}>
        <div className={styles.cardName}>{card.orgName}</div>
        <div className={styles.cardKind}>{card.subtitle}</div>
      </div>
      {card.badgeLabel && <span className={styles.roleTag}>{card.badgeLabel}</span>}
    </div>
  );
}

function OrgCard({ card }: { card: NotificationCard }) {
  const sections: PreferenceSection[] = useMemo(
    () =>
      NOTIFICATION_SECTIONS
        .filter(s => s.module === null || card.modules.includes(s.module))
        .map(s => ({ label: s.label, eventTypes: s.eventTypes })),
    [card.modules],
  );
  const eventTypes = useMemo(() => sections.flatMap(s => s.eventTypes), [sections]);

  const p = useOrgPreferences({ orgSlug: card.orgSlug, role: card.role, eventTypes });

  return (
    <>
      <CardHeader card={card} />
      <div className={styles.cardBody}>
        {p.error && (
          <div className={styles.errorBanner}><AlertCircle size={14} />{p.error}</div>
        )}
        <PreferencesTable
          sections={sections}
          prefs={p.prefs}
          systemDefaultFor={p.systemDefaultFor}
          onToggle={p.handleToggle}
          loading={p.loading}
          saving={p.saving}
          pushSupported={p.pushSupported}
          enablingPush={p.enablingPush}
        />
        <p className={styles.footNote}>
          Bell is on for every event. Push is on for the time-sensitive alerts and off for the rest —
          it only reaches devices you&apos;ve turned on above. Email is off except{' '}
          <strong>Payment failed</strong> (owners and admins).
        </p>
      </div>
    </>
  );
}

function CoachCard({ card }: { card: NotificationCard }) {
  const sections: PreferenceSection[] = useMemo(
    () =>
      COACH_SETTINGS_SECTIONS.map(s => ({
        label: s.label,
        eventTypes: s.eventTypes,
        lead: s.label === 'Weekly summary', // rule R1 — digest control never buried
      })),
    [],
  );
  const eventTypes = useMemo(() => sections.flatMap(s => s.eventTypes), [sections]);

  const p = useOrgPreferences({ orgSlug: card.orgSlug, role: card.role, eventTypes });

  return (
    <>
      <CardHeader card={card} />
      <div className={styles.cardBody}>
        {p.error && (
          <div className={styles.errorBanner}><AlertCircle size={14} />{p.error}</div>
        )}
        <PreferencesTable
          sections={sections}
          prefs={p.prefs}
          systemDefaultFor={p.systemDefaultFor}
          onToggle={p.handleToggle}
          loading={p.loading}
          saving={p.saving}
          pushSupported={p.pushSupported}
          enablingPush={p.enablingPush}
        />
        <p className={styles.chatPointer}>
          Chat notifications are managed in the <strong>Chat</strong> tab — and @mentions always reach you.
        </p>
      </div>
    </>
  );
}

export default function AccountNotificationsClient({
  cards,
  userEmail,
  focus,
}: {
  cards: NotificationCard[];
  userEmail: string;
  focus: string | null;
}) {
  const scrolled = useRef(false);

  // Deep-link: land on the card the bell came from. Scroll once on mount.
  useEffect(() => {
    if (!focus || scrolled.current) return;
    const el = document.getElementById(focus);
    if (el) {
      scrolled.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focus]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Notification settings</h1>
        <p className={styles.subtitle}>
          Signed in as {userEmail}
          {cards.length > 0 && ' — one card per workspace you belong to.'}
        </p>
      </div>

      {cards.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>Nothing to manage here yet</p>
          <p className={styles.emptyText}>
            Notification settings appear once you join an organization or coach a team. Following a
            team for live scores is set on the follow itself — no account settings needed.
          </p>
        </div>
      ) : (
        <>
          <PushDeviceTester />
          <div className={styles.cardsWrap}>
            {cards.map(card => (
              <section
                key={card.focusKey}
                id={card.focusKey}
                className={`${styles.card} ${card.focusKey === focus ? styles.cardFocused : ''}`}
              >
                {card.kind === 'organization'
                  ? <OrgCard card={card} />
                  : <CoachCard card={card} />}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
