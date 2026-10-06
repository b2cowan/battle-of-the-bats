'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Settings } from 'lucide-react';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import { CoachListToolbar, kit } from '@/components/coaches/kit';
import { entryMembers, FEED_EMPTY_COPY, type ActivityEntry } from '@/lib/notification-view';
import NotificationFeedBody, { NotificationZoneChips } from '@/components/notifications/NotificationFeedBody';
import NotificationReader from '@/components/notifications/NotificationReader';
import { useNotificationFeed } from '@/components/notifications/useNotificationFeed';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import feedStyles from '@/components/notifications/notifications-page.module.css';

/**
 * The coach portal's Notifications page — the coach FRAME around the shared feed body
 * (coach-notifications review, owner-approved D1 2026-09-03; mockup artifact 56f7093f).
 *
 * Why a frame of its own: the coaches route used to render the admin page's component, whose
 * hand-rolled header had no responsive rules — at 361/390 the page scrolled sideways and "Mark all
 * read" sat past the edge with no scroller to reveal it. CoachPageHeader already owns the answer
 * and brings the icon tile and the "?" every other coach page has. The feed body (zones, bundling,
 * paging, the three quiet states) stays shared with the admin page.
 *
 * On a phone this page is the coach's ONLY notifications surface — the bell lives in the desktop
 * strip and the More sheet opens this page — so it is built phone-first.
 *
 * ⚖ ONE ROW ABOVE THE LIST (owner ruling 2026-09-25, mockup "One Row for Notifications", option A).
 * A phone used to stack three rows over the first notification: the title, a row holding only the
 * gear, and a row holding only Unread / All. Two half-empty rows, ~56px. Each control now sits
 * where the portal puts its kind, at every width:
 *   · the settings gear is a DOOR to another page → the header, in the title row beside the "?",
 *     and drawn like it: a bare glyph, no button fill (owner, same day — "the same format as the
 *     help button"). `actionsPhoneInTitleRow` is legal because it is ONE compact control.
 *   · "Mark all read" acts on the LIST → the portal's list toolbar, pinned right, beside the read
 *     switch. (Option B put the gear there too; on a desktop that row then needs ~770px of 688 and
 *     wraps whenever something is unread.)
 *   · the read switch wears the portal's own segmented control — Roster's List | Depth chart
 *     (D1b). The admin feed's toggle, in the warm portal, painted its track the page's own colour.
 * Desktop keeps the zone pills in the same row, ahead of the switch (the 2026-09-06 ruling).
 *
 * The settings door carries the way home: AccountReturnBar reads `?back=` and pins
 * "← Back to your Coaches Portal" over the universal settings page (D2 = Option B, 2026-09-03).
 *
 * ⚖ A TAP OPENS THE NOTIFICATION (owner ruling 2026-09-25, D3 option B): the reader holds the whole
 * message and one button on to its page; opening it marks it read, so a coach can read one and
 * close it without leaving here. The admin's Notifications page opens them the same way, in the same
 * reader (Notifications Open in Place step 3, 2026-10-06). On a computer the bell is a drawer holding
 * this same list, and nothing there links here any more
 * (Notifications Open in Place D6, 2026-10-05): this page is the phone's home for notifications,
 * and the place an old link or a help article still lands.
 *
 * ⚖ READ, DONE, DELETE (owner ruling 2026-10-05, "Notifications Open in Place" D3/D8/D9): opening
 * reads; Done (the old Clear) takes a row out of Needs attention; the reader's trash deletes the
 * coach's own copy, with "Notification deleted · Undo" centred at the foot for a few seconds.
 * Mark all read marks everything read, Needs attention included — it never marks anything Done.
 */
export default function CoachNotificationsPage({ orgSlug }: { orgSlug: string }) {
  const { currentOrg } = useOrg();
  usePageTitle('Notifications');
  const feed = useNotificationFeed(currentOrg?.id);
  const { unreadOnly, setUnreadOnly, markSeen } = feed;
  const [reading, setReading] = useState<ActivityEntry | null>(null);

  function openEntry(entry: ActivityEntry) {
    setReading(entry);
    void markSeen(entryMembers(entry));
  }

  const here = `/${orgSlug}/coaches/notifications`;
  const settingsHref = `/account/notifications?focus=coach-${orgSlug}&back=${encodeURIComponent(here)}`;

  return (
    <div className={feedStyles.page}>
      <CoachPageHeader
        icon={Bell}
        title="Notifications"
        actions={
          <Link
            href={settingsHref}
            className={feedStyles.settingsDoor}
            aria-label="Notification settings"
            title="Notification settings"
          >
            <Settings size={20} aria-hidden />
          </Link>
        }
        actionsPhoneInTitleRow
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
        onOpen={openEntry}
        toolbar={
          <CoachListToolbar
            actions={feed.anyUnread ? (
              <button type="button" className={styles.btnSecondary} onClick={feed.markAllRead} aria-label="Mark all read">
                <CheckCheck size={14} aria-hidden /> <span className={styles.headerBtnLabel}>Mark all read</span>
              </button>
            ) : null}
          >
            <NotificationZoneChips feed={feed} />
            <div className={`${styles.segChoice} ${kit.toolbarView}`} role="group" aria-label="Read filter">
              <button type="button" aria-pressed={unreadOnly}
                className={`${styles.segBtn}${unreadOnly ? ' ' + styles.segBtnActive : ''}`}
                onClick={() => setUnreadOnly(true)}>Unread</button>
              <button type="button" aria-pressed={!unreadOnly}
                className={`${styles.segBtn}${!unreadOnly ? ' ' + styles.segBtnActive : ''}`}
                onClick={() => setUnreadOnly(false)}>All</button>
            </div>
          </CoachListToolbar>
        }
        emptyCopy={FEED_EMPTY_COPY.coach}
      />
      {reading && (
        <NotificationReader entry={reading} portal="coach" feed={feed} onClose={() => setReading(null)} />
      )}
    </div>
  );
}
