'use client';
import { useEffect, useState, useCallback, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { CheckCheck, BellOff, Settings, ChevronRight, List } from 'lucide-react';
import type { AppNotification } from '@/lib/types';
import { notificationCategory, ACT_EVENT_TYPES } from '@/lib/notification-labels';
import { coachWarmAttr } from '@/lib/coach-warm-preview';
import {
  iconFor, notificationTime, DAY_ORDER, dayBucket, BUNDLE_NOUN, groupActivityItems,
} from '@/lib/notification-view';
import styles from './notifications.module.css';

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  onClose: () => void;
  onUnreadChange: (count: number) => void;
  /** When provided, a subtle "Notification settings" link is shown in the panel footer. */
  /**
   * Attached to the panel's root. The panel is portaled to `<body>`, so it is NOT inside the bell's
   * DOM subtree — the bell passes this alongside its own wrapper so `useDismissable` can treat the
   * two as one boundary. Optional so nothing else that renders this panel has to care.
   */
  panelRef?: RefObject<HTMLDivElement | null>;
  settingsHref?: string;
  /** When provided, a "See all" link to the full notifications page is shown in the footer. */
  seeAllHref?: string;
  /** Where the TRIGGER lives, which decides the fixed panel's anchor: default = the classic
   *  sidebar-left anchor; 'topStrip' = drop from the operator top strip's right corner
   *  (Stage C — the admin bell moved there 2026-07-31). */
  placement?: 'sidebar' | 'topStrip';
  /** Warm paper/ink skin under a warm account theme (see NotificationBell). */
  warm?: boolean;
}

export default function NotificationPanel({ orgId, onClose, onUnreadChange, panelRef, settingsHref, seeAllHref, placement = 'sidebar', warm = false }: Props) {
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

  // Clear — "I am finished with this one" (2026-09-06, mockup 9427bc24). The only thing that takes
  // a row out of "Needs attention"; opening one no longer does. The bell carries the same button as
  // the "See all" page on purpose — the two surfaces share a zone, so a row a coach can only
  // dispatch on one of them would be the same drift lib/notification-view exists to prevent.
  async function handleClear(notification: AppNotification) {
    if (notification.clearedAt) return;
    const now = new Date().toISOString();
    setNotifications(prev => prev.map(n =>
      n.id === notification.id ? { ...n, clearedAt: now, readAt: n.readAt ?? now } : n,
    ));
    if (!notification.readAt) {
      onUnreadChange(notifications.filter(n => !n.readAt && n.id !== notification.id).length);
    }
    const res = await fetch('/api/notifications', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'clear', id: notification.id }),
    }).catch(console.error);
    // ⚠ CLEAR IS THE ONE ACTION HERE THAT ROLLS BACK, and the asymmetry is deliberate (review,
    // 2026-09-06). Its siblings post fire-and-forget: a lost mark-read costs a bold row. A lost
    // CLEAR costs the decision — the row leaves the triage list while `cleared_at` was never
    // written, which is exactly "an unmade decision looks handled". A `.catch()` alone does not
    // cover it: an HTTP 401/500 RESOLVES, so the status has to be read. Mirrors useNotificationFeed.
    if (!res?.ok) {
      setNotifications(prev => prev.map(n =>
        n.id === notification.id ? { ...n, clearedAt: null, readAt: notification.readAt } : n,
      ));
      if (!notification.readAt) onUnreadChange(notifications.filter(n => !n.readAt).length);
    }
  }

  // "Mark all read" marks ACTIVITY only (D3, 2026-09-03): Needs-attention rows are left entirely
  // alone. The server applies the same rule (app/api/notifications), so this optimistic pass and
  // the badge count it pushes up agree with what a reload would show. ⚠ Since rows now leave the
  // zone on cleared_at, this exclusion is the only thing between one tap and an emptied list of
  // unmade decisions — it must never learn to write cleared_at.
  async function handleMarkAllRead() {
    if (markingAll) return;
    setMarkingAll(true);
    const now = new Date().toISOString();
    setNotifications(prev => prev.map(n =>
      n.readAt || ACT_EVENT_TYPES.has(n.eventType) ? n : { ...n, readAt: now },
    ));
    onUnreadChange(notifications.filter(n => !n.readAt && ACT_EVENT_TYPES.has(n.eventType)).length);

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

  // The button appears only when it would DO something: an unread row outside Needs attention.
  const anyActivityUnread = notifications.some(n => !n.readAt && !ACT_EVENT_TYPES.has(n.eventType));

  // ── P1 zones — "Needs attention" (UNCLEARED act items) pinned above a date-grouped Activity
  //    feed (everything else). Each row appears in exactly one zone.
  //
  // ⚠ THE ZONE IS COMPUTED OVER EVERYTHING, NOT OVER THE UNREAD FILTER (2026-09-06). A row now
  // stays until it is CLEARED, so it can be read and still owed a decision — and this panel
  // defaults to Unread, which would have hidden exactly the rows the zone exists to keep in front
  // of the coach. The toggle filters the ACTIVITY feed; the triage list is never filtered out from
  // under itself. Mirrors useNotificationFeed's view, which carries the same note.
  // ⚠ ONE CLOCK for the grouping AND the row labels below it (review, 2026-09-06). This panel
  // recomputes its groups on every render, so the two agree today by luck of ordering rather than
  // by construction — stamping the clock once makes it structural, and matches useNotificationFeed.
  const now = new Date();
  const needsAttention = notifications.filter(
    n => !n.clearedAt && notificationCategory(n.eventType) === 'act'
  );
  const naIds = new Set(needsAttention.map(n => n.id));

  // ── Visible set — the Unread toggle filters here (P2). Marking read then drops an
  //    item straight out of the default view; read is never destroyed, just filtered.
  const visible = unreadOnly ? notifications.filter(n => !n.readAt) : notifications;
  const activity = visible.filter(n => !naIds.has(n.id));
  const activityGroups = DAY_ORDER
    .map(label => ({ label, items: activity.filter(n => dayBucket(n.createdAt, now) === label) }))
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
          {isAct ? (
            /* Clear rides the meta line so it costs the title and body no width — the panel's rows
               already truncate to one line each and cannot give any up. Both handlers stop
               propagation: the row is a button that OPENS the notification, and being finished
               with something is a different gesture from opening it. */
            <div className={styles.notifMeta}>
              <span className={styles.notifTime}>{notificationTime(n.createdAt, now, { withDay: true })}</span>
              <button
                type="button"
                className={styles.clearBtn}
                aria-label={`Clear “${n.title}” from Needs attention`}
                onClick={e => { e.stopPropagation(); handleClear(n); }}
                onKeyDown={e => e.stopPropagation()}
              >
                Clear
              </button>
            </div>
          ) : (
            <p className={styles.notifTime}>{notificationTime(n.createdAt, now)}</p>
          )}
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
          <p className={styles.notifTime}>{notificationTime(newest.createdAt, now)}</p>
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
    <div
      ref={panelRef}
      className={`${styles.panel}${placement === 'topStrip' ? ` ${styles.panelTopStrip}` : ''}${warm ? ` ${styles.panelWarm}` : ''}`}
      role="dialog"
      aria-label="Notifications"
      data-notification-panel
      /* The warm skin is the coach shell's OWN marker, carried on this root (D4, 2026-09-03). The
         panel is portaled to <body>, outside the shell, so the `html[data-user-theme="warm"]
         [data-coach-warm-enabled]` token block never reached it — which is the only reason it was
         dark. With the marker here the whole warm set (--surface, --fl-text, the olive accent, the
         --white-N remaps) resolves inside the panel exactly as it does on the "See all" page, with
         no second copy of the palette. Inert under an explicit dark preference, by the same selector. */
      {...(warm ? coachWarmAttr : {})}
    >
      <div className={styles.panelHeader}>
        <p className={styles.panelTitle}>Notifications</p>
        {anyActivityUnread && (
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
        /* ⚠ The zone is counted here too. It sits OUTSIDE the unread filter now, so an empty
           `visible` no longer means an empty panel — a read-but-uncleared decision would have
           rendered "You're all caught up" over the top of itself. */
        ) : visible.length === 0 && needsAttention.length === 0 ? (
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
