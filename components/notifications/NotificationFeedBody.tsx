'use client';
import { useRef, type ReactNode } from 'react';
import { BellOff, CheckCheck, ChevronRight } from 'lucide-react';
import type { AppNotification } from '@/lib/types';
import {
  iconFor, notificationTime, BUNDLE_NOUN, groupActivityItems, FEED_CAUGHT_UP, FEED_EMPTY_COPY,
  type ActivityEntry, type FeedEmptyCopy,
} from '@/lib/notification-view';
import type { NotificationFeed, ZoneFilter } from './useNotificationFeed';
import NotificationUndoNote from './NotificationUndoNote';
import styles from './notifications-page.module.css';

/**
 * NotificationFeedBody — a Notifications page below its header: zone chips + Unread/All, the list
 * (Needs attention pinned over a date-grouped, bundled Activity feed), Load more, and the three
 * states the fixture used to hide (loading · failed · empty).
 *
 * Shared by the admin page (NotificationsPageContent) and the coach page (CoachNotificationsPage);
 * the FRAME above it is each shell's own — coach-notifications review R1, 2026-09-03. The zones,
 * day grouping and bundling come from lib/notification-view, the same functions the bell's drawer
 * uses, and the empty list's words are `FEED_EMPTY_COPY`, which the drawer says too — so the
 * surfaces cannot drift.
 */

const DEFAULT_EMPTY: FeedEmptyCopy = FEED_EMPTY_COPY.admin;

/**
 * The notifications whose preview stops at two lines on a phone (coaching from a phone · stage 6 · R4,
 * owner 2026-09-24): ONLY those whose linked page says the rest. The week in review opens the Insights
 * Dashboard, whose "What stands out" states the same findings from the same engine. ⚠ Not every body
 * (/review, 2026-09-24): a tournament announcement is free text an admin typed and its public page does
 * not repeat it — clamping it would hide the message with nowhere to read it. Add a type here only when
 * its page repeats its body.
 * ⚠⚠ THAT PREMISE WAS HALF TRUE, AND THE READER IS WHAT MAKES THE CLAMP SAFE NOW (owner ruling
 * 2026-09-25, D3 option B). Insights describes the team TODAY, so it repeated only the NEWEST
 * review: an older one was cut mid pitching-cap warning with nowhere on a phone to read the rest.
 * On the coach feed a tap now opens the whole message in the reader, whatever its age. A type added
 * here still needs a surface that shows the rest — on the coach feed, the reader is that surface.
 */
const CLAMPED_ON_A_PHONE: ReadonlySet<AppNotification['eventType']> = new Set(['coach_insights_digest']);

const CHIPS: { key: ZoneFilter; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'needs',    label: 'Needs attention' },
  { key: 'activity', label: 'Activity' },
];

/**
 * The zone pills (All · Needs attention · Activity). Exported because a frame that draws its OWN
 * toolbar row (the coach page, below) still needs them — one copy of the pills, whichever row
 * they sit in. Hidden on phones by the stylesheet (owner, 2026-09-06), never by the caller.
 */
export function NotificationZoneChips({ feed }: { feed: NotificationFeed }) {
  const { filter, setFilter, needsCount } = feed;
  return (
    <div className={styles.chips} role="group" aria-label="Filter notifications">
      {CHIPS.map(c => (
        <button
          key={c.key}
          type="button"
          aria-pressed={filter === c.key}
          className={`${styles.chip} ${filter === c.key ? styles.chipActive : ''}`}
          onClick={() => setFilter(c.key)}
        >
          {c.label}
          {c.key === 'needs' && needsCount > 0 && (
            <span className={styles.chipCount} aria-label={`${needsCount} waiting`}>{needsCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export default function NotificationFeedBody({
  feed,
  emptyCopy = DEFAULT_EMPTY,
  toolbar,
  onOpen,
}: {
  feed: NotificationFeed;
  emptyCopy?: FeedEmptyCopy;
  /**
   * The row above the list, when the frame draws its own. The coach page does (one-row ruling,
   * owner 2026-09-25): it puts the read switch and "Mark all read" in the portal's list toolbar,
   * so a phone carries one row there instead of a gear row plus a switch row. Omitted → the admin
   * frame's default row (pills + the admin toggle), unchanged.
   */
  toolbar?: ReactNode;
  /**
   * A tap OPENS the notification rather than going to its page (the coach reader, owner ruling
   * 2026-09-25 — D3 option B: "open, read, close" without leaving the page; the admin's page too since
   * Notifications Open in Place step 3, 2026-10-06, D5). The frame owns the reader; the row only says
   * which entry was opened, and announces a dialog. Required: no row on either page leaves on a tap —
   * the old admin tap (mark read, then a full load of a page it never named) is gone with it.
   */
  onOpen: (entry: ActivityEntry) => void;
}) {
  const {
    items, loading, loadingMore, hasMore, error, isEmpty,
    unreadOnly, setUnreadOnly,
    reload, loadMore, clearRow,
    needsAttention, activityGroups, showNeeds, showActivity, groupedAt,
  } = feed;
  // Where focus lands when the Undo note leaves while holding it (a delete's row is gone).
  const listRef = useRef<HTMLDivElement>(null);

  // A tap opens the frame's reader — a single notification, or a bundle as its members.
  const openOne = (n: AppNotification) => onOpen({ kind: 'item', notification: n });
  const openBundle = (eventType: string, members: AppNotification[]) => onOpen({ kind: 'bundle', eventType, members });

  // ── Row renderers ─────────────────────────────────────────────────────────────
  function row(n: AppNotification, isAct: boolean) {
    const isUnread = !n.readAt;
    return (
      <div
        key={n.id}
        className={`${styles.item} ${isUnread ? styles.unread : styles.read}${isAct ? ` ${styles.actItem}` : ''}`}
        onClick={() => openOne(n)}
        role="button"
        aria-haspopup="dialog"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && openOne(n)}
      >
        <span className={styles.icon}>{iconFor(n.eventType)}</span>
        <div className={styles.content}>
          <p className={styles.itemTitle}>{n.title}</p>
          {n.body && <p className={`${styles.itemBody}${CLAMPED_ON_A_PHONE.has(n.eventType) ? ` ${styles.itemBodyClamp}` : ''}`}>{n.body}</p>}
          {isAct ? (
            /* Done (the customer's word for clear since 2026-10-05, D8) rides the meta line rather
               than the row's right edge: it costs no width, so a two-line body never squeezes to
               make room for it (mockup 9427bc24, plate 04-C). Both
               handlers stop propagation — the row itself is a button that opens the notification,
               and finishing with something is not the same gesture as opening it. */
            <div className={styles.meta}>
              <span className={styles.itemTime}>{notificationTime(n.createdAt, groupedAt, { withDay: true })}</span>
              <button
                type="button"
                className={styles.clearBtn}
                aria-label={`Mark “${n.title}” done`}
                onClick={e => { e.stopPropagation(); clearRow(n); }}
                onKeyDown={e => e.stopPropagation()}
              >
                Done
              </button>
            </div>
          ) : (
            <p className={styles.itemTime}>{notificationTime(n.createdAt, groupedAt)}</p>
          )}
        </div>
        {isUnread && <span className={styles.dot} aria-label="Unread" />}
      </div>
    );
  }

  function bundleRow(eventType: string, members: AppNotification[]) {
    const anyMemberUnread = members.some(m => !m.readAt);
    const newest = members[0];
    return (
      <div
        key={`bundle-${eventType}-${newest.id}`}
        className={`${styles.item} ${anyMemberUnread ? styles.unread : styles.read}`}
        onClick={() => openBundle(eventType, members)}
        role="button"
        aria-haspopup="dialog"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && openBundle(eventType, members)}
      >
        <span className={styles.icon}>{iconFor(eventType)}</span>
        <div className={styles.content}>
          <p className={styles.itemTitle}>{members.length} {BUNDLE_NOUN[eventType] ?? 'notifications'}</p>
          <p className={styles.itemTime}>{notificationTime(newest.createdAt, groupedAt)}</p>
        </div>
        <ChevronRight size={16} className={styles.bundleChevron} aria-hidden />
        {anyMemberUnread && <span className={styles.dot} aria-label="Unread" />}
      </div>
    );
  }

  // ── The three quiet states ────────────────────────────────────────────────────
  function emptyState() {
    // Nothing at all vs. nothing in THIS view — two different sentences.
    if (items.length === 0) {
      return (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}><BellOff size={20} aria-hidden /></span>
          <div className={styles.emptyText}>
            <p className={styles.emptyHeadline}>{emptyCopy.headline}</p>
            {emptyCopy.description && <p className={styles.emptyDesc}>{emptyCopy.description}</p>}
            {emptyCopy.note && <p className={styles.emptyNote}>{emptyCopy.note}</p>}
          </div>
        </div>
      );
    }
    if (unreadOnly) {
      return (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}><CheckCheck size={20} aria-hidden /></span>
          <div className={styles.emptyText}>
            <p className={styles.emptyHeadline}>{FEED_CAUGHT_UP.headline}</p>
            <p className={styles.emptyDesc}>{FEED_CAUGHT_UP.lead} <strong>{FEED_CAUGHT_UP.view}</strong> {FEED_CAUGHT_UP.tail}</p>
          </div>
        </div>
      );
    }
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}><BellOff size={20} aria-hidden /></span>
        <div className={styles.emptyText}>
          <p className={styles.emptyHeadline}>Nothing in this view</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {toolbar ?? <div className={styles.toolbar}>
        <NotificationZoneChips feed={feed} />
        <div className={styles.segToggle} role="group" aria-label="Read filter">
          <button
            type="button"
            aria-pressed={unreadOnly}
            className={`${styles.segBtn} ${unreadOnly ? styles.segBtnActive : ''}`}
            onClick={() => setUnreadOnly(true)}
          >
            Unread
          </button>
          <button
            type="button"
            aria-pressed={!unreadOnly}
            className={`${styles.segBtn} ${!unreadOnly ? styles.segBtnActive : ''}`}
            onClick={() => setUnreadOnly(false)}
          >
            All
          </button>
        </div>
      </div>}

      <div ref={listRef} tabIndex={-1} className={styles.list}>
        {loading ? (
          <p className={styles.loadingRow}>Loading…</p>
        ) : error ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}><BellOff size={20} aria-hidden /></span>
            <div className={styles.emptyText}>
              <p className={styles.errorRow} role="alert">
                Couldn’t load your notifications.{' '}
                <button type="button" className={styles.retryBtn} onClick={reload}>Try again</button>
              </p>
              <p className={styles.emptyNote}>Nothing was marked read.</p>
            </div>
          </div>
        ) : isEmpty ? (
          emptyState()
        ) : (
          <>
            {showNeeds && (
              <>
                <div className={`${styles.sectionHeader} ${styles.sectionHeaderAct}`}>
                  <span>Needs attention</span>
                  <span className={styles.sectionCount}>{needsAttention.length}</span>
                  {/* The zone's promise, in the zone. Visible on phones since 2026-09-06 — removing
                      the filter pills is what made room for it, which is why those two changes
                      shipped together rather than as separate tidy-ups. */}
                  <span className={styles.sectionHint}>stays until you mark it Done</span>
                </div>
                {needsAttention.map(n => row(n, true))}
              </>
            )}
            {showActivity && activityGroups.map(g => (
              <div key={g.label}>
                <div className={styles.dateHeader}>{g.label}</div>
                {groupActivityItems(g.items).map(entry =>
                  entry.kind === 'bundle'
                    ? bundleRow(entry.eventType, entry.members)
                    : row(entry.notification, false),
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {!loading && !error && hasMore && (
        <div className={styles.loadMoreWrap}>
          <button type="button" className={styles.loadMoreBtn} onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}

      {/* "Notification deleted · Undo" (D3) — centred under this column, at the window's foot. */}
      <NotificationUndoNote feed={feed} returnFocusTo={() => listRef.current?.focus()} />
    </>
  );
}
