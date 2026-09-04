'use client';
import Link from 'next/link';
import { CheckCheck, Settings } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useNotificationFeed } from './useNotificationFeed';
import NotificationFeedBody from './NotificationFeedBody';
import styles from './notifications-page.module.css';

/**
 * The full "See all" notifications page — the ADMIN shell's frame (Notification Center Rework P4).
 *
 * ⚠ AS OF 2026-09-03 THIS IS THE ADMIN FRAME ONLY. The coaches route used to render this same
 * component and inherited a header with no responsive rules (two controls that could not wrap
 * pushed "Mark all read" past a phone's edge) — coach-notifications review R1. The feed itself
 * (state in useNotificationFeed, markup in NotificationFeedBody) is what the two shells share; the
 * coach page wears CoachPageHeader in components/coaches/CoachNotificationsPage.tsx. Chat is
 * excluded server-side (P3), so it never appears here either.
 */
export default function NotificationsPageContent({ settingsHref }: { settingsHref?: string } = {}) {
  const { currentOrg } = useOrg();
  usePageTitle('Notifications');
  const feed = useNotificationFeed(currentOrg?.id);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Notifications</h1>
          <p className={styles.sub}>Everything from this organization, newest first.</p>
        </div>
        <div className={styles.headerActions}>
          {settingsHref && (
            <Link href={settingsHref} className={styles.markAllBtn}>
              <Settings size={14} /> Notification settings
            </Link>
          )}
          {feed.anyActivityUnread && (
            <button type="button" className={styles.markAllBtn} onClick={feed.markAllRead}>
              <CheckCheck size={15} /> Mark all read
            </button>
          )}
        </div>
      </div>

      <NotificationFeedBody feed={feed} />
    </div>
  );
}
