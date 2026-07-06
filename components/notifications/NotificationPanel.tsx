'use client';
import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { CheckCheck, BellOff, Settings, ChevronRight, List } from 'lucide-react';
import type { AppNotification } from '@/lib/types';
import { notificationCategory } from '@/lib/notification-labels';
import {
  iconFor, relativeTime, DAY_ORDER, dayBucket, BUNDLE_NOUN, groupActivityItems,
} from '@/lib/notification-view';
import styles from './notifications.module.css';

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  onClose: () => void;
  onUnreadChange: (count: number) => void;
  /** When provided, a subtle "Notification settings" link is shown in the panel footer. */
  settingsHref?: string;
  /** When provided, a "See all" link to the full notifications page is shown in the footer. */
  seeAllHref?: string;
}

export default function NotificationPanel({ orgId, onClose, onUnreadChange, settingsHref, seeAllHref }: Props) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [markingAll,    setMarkingAll]    = useState(false);
  // Unread toggle (P2) — ON by default: the bell reads as an inbox you empty. OFF shows
  // everything (read dimmed). Pure client filter over the fetched window → instant, no refetch.
  const [unreadOnly,    setUnreadOnly]    = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch a wider window (read + unread) once; the toggle + bundling work over it.
      const res  = await fetch(`/api/notifications?orgId=${orgId}&limit=40`);
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      onUnreadChange(data.unreadCount ?? 0);
    } catch {
      // silent — bell count is still valid from the parent
    } finally {
      setLoading(false);
    }
  }, [orgId, onUnreadChange]);

  useEffect(() => { load(); }, [load]);

  async function handleMarkRead(notification: AppNotification) {
    // Mark read only if it isn't already (don't let this block navigation)
    if (!notification.readAt) {
      // Optimistic update
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)
      );
      onUnreadChange(notifications.filter(n => !n.readAt && n.id !== notification.id).length);

      await fetch('/api/notifications', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'mark-read', id: notification.id }),
      }).catch(console.error);
    }

    // Navigate if there's a link — regardless of read state
    if (notification.link) {
      onClose();
      window.location.href = notification.link;
    }
  }

  async function handleMarkAllRead() {
    if (markingAll) return;
    setMarkingAll(true);
    const now = new Date().toISOString();
    setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? now })));
    onUnreadChange(0);

    await fetch('/api/notifications', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'mark-all-read', orgId }),
    }).catch(console.error);

    setMarkingAll(false);
  }

  // One-tap bundle clear (P2): mark every member read at once, then open the type's list.
  async function handleBundleClick(members: AppNotification[]) {
    const unreadIds = members.filter(m => !m.readAt).map(m => m.id);
    if (unreadIds.length > 0) {
      const idSet = new Set(unreadIds);
      setNotifications(prev =>
        prev.map(n => idSet.has(n.id) ? { ...n, readAt: new Date().toISOString() } : n)
      );
      onUnreadChange(notifications.filter(n => !n.readAt && !idSet.has(n.id)).length);
      await Promise.all(unreadIds.map(id =>
        fetch('/api/notifications', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ action: 'mark-read', id }),
        }).catch(console.error)
      ));
    }
    // All members share the same list target — navigate to the first one that has a link.
    const link = members.find(m => m.link)?.link;
    if (link) { onClose(); window.location.href = link; }
  }

  const unreadCount = notifications.filter(n => !n.readAt).length;

  // ── Visible set — the Unread toggle filters here (P2). Marking read then drops an
  //    item straight out of the default view; read is never destroyed, just filtered.
  const visible = unreadOnly ? notifications.filter(n => !n.readAt) : notifications;

  // ── P1 zones over the visible set — "Needs attention" (unread Act items) pinned above
  //    a date-grouped Activity feed (everything else). Each row appears in exactly one zone.
  const needsAttention = visible.filter(
    n => !n.readAt && notificationCategory(n.eventType) === 'act'
  );
  const naIds = new Set(needsAttention.map(n => n.id));
  const activity = visible.filter(n => !naIds.has(n.id));
  const activityGroups = DAY_ORDER
    .map(label => ({ label, items: activity.filter(n => dayBucket(n.createdAt) === label) }))
    .filter(g => g.items.length > 0);

  function renderItem(n: AppNotification, isAct: boolean) {
    const isUnread = !n.readAt;
    const icon     = iconFor(n.eventType);
    return (
      <div
        key={n.id}
        className={`${styles.notifItem} ${isUnread ? styles.unread : styles.notifRead}${isAct ? ` ${styles.actItem}` : ''}`}
        onClick={() => handleMarkRead(n)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && handleMarkRead(n)}
      >
        <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{icon}</span>
        <div className={styles.notifContent}>
          <p className={styles.notifTitle}>{n.title}</p>
          {n.body && <p className={styles.notifBody}>{n.body}</p>}
          <p className={styles.notifTime}>{relativeTime(n.createdAt)}</p>
        </div>
        {isUnread && <span className={styles.notifDot} aria-label="Unread" />}
      </div>
    );
  }

  // A same-type bundle row — one tap clears all members + opens the type's list (P2).
  function renderBundle(eventType: string, members: AppNotification[]) {
    const icon      = iconFor(eventType);
    const noun      = BUNDLE_NOUN[eventType] ?? 'notifications';
    const anyUnread = members.some(m => !m.readAt);
    const newest    = members[0]; // members preserve newest-first order
    return (
      <div
        key={`bundle-${eventType}-${newest.id}`}
        className={`${styles.notifItem} ${anyUnread ? styles.unread : styles.notifRead}`}
        onClick={() => handleBundleClick(members)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && handleBundleClick(members)}
      >
        <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{icon}</span>
        <div className={styles.notifContent}>
          <p className={styles.notifTitle}>{members.length} {noun}</p>
          <p className={styles.notifTime}>{relativeTime(newest.createdAt)}</p>
        </div>
        <ChevronRight size={14} className={styles.bundleChevron} aria-hidden />
        {anyUnread && <span className={styles.notifDot} aria-label="Unread" />}
      </div>
    );
  }

  // Render a day-group's items, rolling up bundleable same-type runs into one row (P2).
  // Grouping logic is shared with the "See all" page (lib/notification-view) so they match.
  function renderActivityItems(items: AppNotification[]): ReactNode[] {
    return groupActivityItems(items).map(entry =>
      entry.kind === 'bundle'
        ? renderBundle(entry.eventType, entry.members)
        : renderItem(entry.notification, false),
    );
  }

  const panel = (
    <div className={styles.panel} role="dialog" aria-label="Notifications" data-notification-panel>
      <div className={styles.panelHeader}>
        <p className={styles.panelTitle}>Notifications</p>
        {unreadCount > 0 && (
          <button
            className={styles.markAllBtn}
            onClick={handleMarkAllRead}
            disabled={markingAll}
            title="Mark all as read"
          >
            <CheckCheck size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Mark all read
          </button>
        )}
      </div>

      <div className={styles.filterBar}>
        <div className={styles.segToggle} role="group" aria-label="Filter notifications">
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

      <div className={styles.notifList}>
        {loading ? (
          <p className={styles.loadingRow}>Loading…</p>
        ) : visible.length === 0 ? (
          <div className={styles.emptyState}>
            <BellOff size={28} className={styles.emptyIcon} />
            <span>
              {unreadOnly && notifications.length > 0
                ? 'You’re all caught up'
                : 'No notifications yet'}
            </span>
          </div>
        ) : (
          <>
            {needsAttention.length > 0 && (
              <>
                <div className={`${styles.sectionHeader} ${styles.sectionHeaderAct}`}>
                  <span>Needs attention</span>
                  <span className={styles.sectionCount}>{needsAttention.length}</span>
                </div>
                {needsAttention.map(n => renderItem(n, true))}
              </>
            )}
            {activityGroups.map(g => (
              <div key={g.label}>
                <div className={styles.dateHeader}>{g.label}</div>
                {renderActivityItems(g.items)}
              </div>
            ))}
          </>
        )}
      </div>

      {(seeAllHref || settingsHref) && (
        <div className={styles.panelFooter}>
          {seeAllHref && (
            <Link href={seeAllHref} className={styles.settingsLink} onClick={onClose}>
              <List size={12} aria-hidden />
              See all
            </Link>
          )}
          {settingsHref && (
            <Link href={settingsHref} className={styles.settingsLink} onClick={onClose}>
              <Settings size={12} aria-hidden />
              Notification settings
            </Link>
          )}
        </div>
      )}
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(panel, document.body);
}
