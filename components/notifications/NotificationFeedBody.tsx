'use client';
import { BellOff, CheckCheck, ChevronRight } from 'lucide-react';
import type { AppNotification } from '@/lib/types';
import { iconFor, notificationTime, BUNDLE_NOUN, groupActivityItems } from '@/lib/notification-view';
import type { NotificationFeed, ZoneFilter } from './useNotificationFeed';
import styles from './notifications-page.module.css';

/**
 * NotificationFeedBody — the "See all" page below its header: zone chips + Unread/All, the list
 * (Needs attention pinned over a date-grouped, bundled Activity feed), Load more, and the three
 * states the fixture used to hide (loading · failed · empty).
 *
 * Shared by the admin page (NotificationsPageContent) and the coach page (CoachNotificationsPage);
 * the FRAME above it is each shell's own — coach-notifications review R1, 2026-09-03. The zones,
 * day grouping and bundling come from lib/notification-view, the same functions the bell uses, so
 * the three surfaces cannot drift.
 */

export interface FeedEmptyCopy {
  /** The headline when the account has NO notifications yet. */
  headline: string;
  /** What arrives here — the sentence that makes the emptiness make sense. */
  description?: string;
  /** A quieter footnote (e.g. where chat lives instead). */
  note?: string;
}

const DEFAULT_EMPTY: FeedEmptyCopy = { headline: 'No notifications yet' };

const CHIPS: { key: ZoneFilter; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'needs',    label: 'Needs attention' },
  { key: 'activity', label: 'Activity' },
];

export default function NotificationFeedBody({
  feed,
  emptyCopy = DEFAULT_EMPTY,
}: {
  feed: NotificationFeed;
  emptyCopy?: FeedEmptyCopy;
}) {
  const {
    items, loading, loadingMore, hasMore, error, isEmpty,
    unreadOnly, setUnreadOnly, filter, setFilter,
    reload, loadMore, markRead, bundleClick, clearRow,
    needsAttention, activityGroups, showNeeds, showActivity, needsCount, groupedAt,
  } = feed;

  // ── Row renderers ─────────────────────────────────────────────────────────────
  function row(n: AppNotification, isAct: boolean) {
    const isUnread = !n.readAt;
    return (
      <div
        key={n.id}
        className={`${styles.item} ${isUnread ? styles.unread : styles.read}${isAct ? ` ${styles.actItem}` : ''}`}
        onClick={() => markRead(n)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && markRead(n)}
      >
        <span className={styles.icon}>{iconFor(n.eventType)}</span>
        <div className={styles.content}>
          <p className={styles.itemTitle}>{n.title}</p>
          {n.body && <p className={styles.itemBody}>{n.body}</p>}
          {isAct ? (
            /* Clear rides the meta line rather than the row's right edge: it costs no width, so a
               two-line body never squeezes to make room for it (mockup 9427bc24, plate 04-C). Both
               handlers stop propagation — the row itself is a button that opens the notification,
               and finishing with something is not the same gesture as opening it. */
            <div className={styles.meta}>
              <span className={styles.itemTime}>{notificationTime(n.createdAt, groupedAt, { withDay: true })}</span>
              <button
                type="button"
                className={styles.clearBtn}
                aria-label={`Clear “${n.title}” from Needs attention`}
                onClick={e => { e.stopPropagation(); clearRow(n); }}
                onKeyDown={e => e.stopPropagation()}
              >
                Clear
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
        onClick={() => bundleClick(members)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && bundleClick(members)}
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
            <p className={styles.emptyHeadline}>You’re all caught up</p>
            <p className={styles.emptyDesc}>Everything unread is handled. Switch to <strong>All</strong> to read back through the season.</p>
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
      <div className={styles.toolbar}>
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
      </div>

      <div className={styles.list}>
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
                  <span className={styles.sectionHint}>stays until you clear it</span>
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
    </>
  );
}
