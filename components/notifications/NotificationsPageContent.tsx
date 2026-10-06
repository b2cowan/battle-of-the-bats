'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCheck, Settings } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { entryMembers, type ActivityEntry } from '@/lib/notification-view';
import { useNotificationFeed } from './useNotificationFeed';
import NotificationFeedBody from './NotificationFeedBody';
import NotificationReader from './NotificationReader';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import styles from './notifications-page.module.css';

/**
 * The ADMIN's Notifications page — the admin shell's frame around the shared feed (Notification
 * Center Rework P4).
 *
 * ⚠ AS OF 2026-09-03 THIS IS THE ADMIN FRAME ONLY. The coaches route used to render this same
 * component and inherited a header with no responsive rules (two controls that could not wrap
 * pushed "Mark all read" past a phone's edge) — coach-notifications review R1. The feed itself
 * (state in useNotificationFeed, markup in NotificationFeedBody) is what the two shells share; the
 * coach page wears CoachPageHeader in components/coaches/CoachNotificationsPage.tsx. Chat is
 * excluded server-side (P3), so it never appears here either.
 *
 * ⚖ A TAP OPENS THE NOTIFICATION (Notifications Open in Place D5, owner 2026-10-05; built in step 3,
 * 2026-10-06, as drawn on hub screen 10). Neither portal has a bell on a phone, so for an admin on a
 * phone this page — under More — is the only place to read one. A tap used to mark it read and load a
 * page it never named; it now opens the coach page's own reader (`NotificationReader`, one file for
 * both pages): a sheet on the bottom bar on a phone, a small dialog on a computer, with the whole
 * message and a button named for its page in the admin's words. Opening reads it; Done and the trash
 * (with "Notification deleted · Undo" at the column's foot) work as on the coach's page. On a computer
 * the bell's drawer holds this same list, and nothing links here any more (D6); an old link or a help
 * article still can.
 */
export default function NotificationsPageContent({ settingsHref }: { settingsHref?: string } = {}) {
  const { currentOrg } = useOrg();
  usePageTitle('Notifications');
  const feed = useNotificationFeed(currentOrg?.id);
  const [reading, setReading] = useState<ActivityEntry | null>(null);
  // The row that opened the reader — focus goes home to it.
  const readingFromRef = useRef<HTMLElement | null>(null);

  function openEntry(entry: ActivityEntry, from: HTMLElement) {
    readingFromRef.current = from;
    setReading(entry);
    void feed.markSeen(entryMembers(entry));
  }

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

      <NotificationFeedBody feed={feed} onOpen={openEntry} />
      {reading && (
        <NotificationReader entry={reading} portal="admin" feed={feed} onClose={() => setReading(null)} opener={readingFromRef} />
      )}
    </div>
  );
}
