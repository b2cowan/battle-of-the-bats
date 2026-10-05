'use client';
import Link from 'next/link';
import { CheckCheck, Settings } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useNotificationFeed } from './useNotificationFeed';
import NotificationFeedBody from './NotificationFeedBody';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
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

  const headerActions = (
    <>
      {settingsHref && (
        <Link href={settingsHref} className={styles.markAllBtn}>
          <Settings size={14} /> Notification settings
        </Link>
      )}
      {feed.anyUnread && (
        <button type="button" className={styles.markAllBtn} onClick={feed.markAllRead}>
          <CheckCheck size={15} /> Mark all read
        </button>
      )}
    </>
  );

  return (
    <div className={styles.page}>
      {/* The header (F3): the old line "Everything from this organization, newest first." was not
          re-homed — it described the list rather than stating a fact on it, and the eyebrow names the
          organization's scope. */}
      <AdminPageHeader
        eyebrow="Organization"
        title="Notifications"
        actions={headerActions}
      />

      <NotificationFeedBody feed={feed} />
    </div>
  );
}
