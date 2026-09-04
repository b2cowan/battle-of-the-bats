'use client';
import Link from 'next/link';
import { Bell, CheckCheck, Settings } from 'lucide-react';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import NotificationFeedBody from '@/components/notifications/NotificationFeedBody';
import { useNotificationFeed } from '@/components/notifications/useNotificationFeed';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import feedStyles from '@/components/notifications/notifications-page.module.css';

/**
 * The coach portal's "See all" notifications page — the coach FRAME around the shared feed body
 * (coach-notifications review, owner-approved D1 2026-09-03; mockup artifact 56f7093f).
 *
 * Why a frame of its own: the coaches route used to render the admin page's component, whose
 * hand-rolled header had no responsive rules — at 361/390 the page scrolled sideways and "Mark all
 * read" sat past the edge with no scroller to reveal it. CoachPageHeader already owns the answer
 * (the phone grid drops actions to a right-pinned 44px row; secondaries go icon-only via
 * .headerBtnLabel), and it brings the icon tile and the "?" every other coach page has. The feed
 * body (zones, bundling, paging, the three quiet states) stays shared with the admin page.
 *
 * On a phone this page is the coach's ONLY notifications surface — the bell lives in the desktop
 * strip and the More sheet opens this page — so it is built phone-first.
 *
 * The settings door carries the way home: AccountReturnBar reads `?back=` and pins
 * "← Back to your Coaches Portal" over the universal settings page (D2 = Option B).
 */
export default function CoachNotificationsPage({ orgSlug }: { orgSlug: string }) {
  const { currentOrg } = useOrg();
  usePageTitle('Notifications');
  const feed = useNotificationFeed(currentOrg?.id);

  const here = `/${orgSlug}/coaches/notifications`;
  const settingsHref = `/account/notifications?focus=coach-${orgSlug}&back=${encodeURIComponent(here)}`;

  return (
    <div className={feedStyles.page}>
      <CoachPageHeader
        icon={Bell}
        title="Notifications"
        actions={
          <>
            <Link href={settingsHref} className={styles.btnSecondary} aria-label="Notification settings">
              <Settings size={14} aria-hidden /> <span className={styles.headerBtnLabel}>Notification settings</span>
            </Link>
            {feed.anyActivityUnread && (
              <button type="button" className={styles.btnSecondary} onClick={feed.markAllRead} aria-label="Mark all read">
                <CheckCheck size={14} aria-hidden /> <span className={styles.headerBtnLabel}>Mark all read</span>
              </button>
            )}
          </>
        }
        helpLabel="Notifications"
        help={{
          module: 'coaches',
          sectionIds: ['premium-portal-tour'],
          subtopicId: 'premium-portal-tour-bell',
          fullGuideHref: `/${orgSlug}/coaches/help#premium-portal-tour-bell`,
        }}
      />
      <NotificationFeedBody
        feed={feed}
        emptyCopy={{
          headline: 'Nothing here yet',
          description: 'When something needs you — an assistant asking to join, a game that moved, your Sunday week in review — it lands here.',
          note: 'Chat has its own badge on the Chat tab.',
        }}
      />
    </div>
  );
}
