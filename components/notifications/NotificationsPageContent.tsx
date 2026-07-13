'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BellOff, CheckCheck, ChevronRight, Settings } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import type { AppNotification } from '@/lib/types';
import { notificationCategory } from '@/lib/notification-labels';
import {
  iconFor, relativeTime, DAY_ORDER, dayBucket, BUNDLE_NOUN, groupActivityItems,
} from '@/lib/notification-view';
import styles from './notifications-page.module.css';

const PAGE_SIZE = 40;

type ZoneFilter = 'all' | 'needs' | 'activity';

/**
 * The full "See all" notifications page (Notification Center Rework P4). Shared by the
 * admin and coaches shells — reached from the bell's "See all" footer link. Reuses the
 * same zones (Needs attention / Activity), date grouping, and bundling as the dropdown,
 * plus an Unread/All toggle, zone filter chips, and Load-more pagination.
 *
 * Chat is already excluded server-side (P3), so it never appears here either.
 */
export default function NotificationsPageContent({ settingsHref }: { settingsHref?: string } = {}) {
  const { currentOrg } = useOrg();
  usePageTitle('Notifications');
  const orgId = currentOrg?.id;

  const [items,       setItems]       = useState<AppNotification[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  const [unreadOnly,  setUnreadOnly]  = useState(false); // archive view defaults to All
  const [filter,      setFilter]      = useState<ZoneFilter>('all');

  // ── Load (initial) ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/notifications?orgId=${orgId}&limit=${PAGE_SIZE}`);
      const data = await res.json();
      setItems(data.notifications ?? []);
      setHasMore(Boolean(data.hasMore));
    } catch {
      /* silent — the page just shows an empty state */
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  // ── Load more (older rows via the created_at cursor) ─────────────────────────
  async function loadMore() {
    if (!orgId || loadingMore || items.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = items[items.length - 1].createdAt;
      const res  = await fetch(
        `/api/notifications?orgId=${orgId}&limit=${PAGE_SIZE}&before=${encodeURIComponent(oldest)}`,
      );
      const data = await res.json();
      setItems(prev => [...prev, ...(data.notifications ?? [])]);
      setHasMore(Boolean(data.hasMore));
    } catch {
      /* silent */
    } finally {
      setLoadingMore(false);
    }
  }

  // ── Mark read (single) + navigate ────────────────────────────────────────────
  async function markRead(n: AppNotification) {
    if (!n.readAt) {
      setItems(prev => prev.map(x => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      await fetch('/api/notifications', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'mark-read', id: n.id }),
      }).catch(console.error);
    }
    if (n.link) window.location.href = n.link;
  }

  // ── Bundle: mark every member read at once, then open the type's list ─────────
  async function bundleClick(members: AppNotification[]) {
    const unreadIds = members.filter(m => !m.readAt).map(m => m.id);
    if (unreadIds.length > 0) {
      const idSet = new Set(unreadIds);
      setItems(prev => prev.map(x => (idSet.has(x.id) ? { ...x, readAt: new Date().toISOString() } : x)));
      await Promise.all(unreadIds.map(id =>
        fetch('/api/notifications', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ action: 'mark-read', id }),
        }).catch(console.error),
      ));
    }
    const link = members.find(m => m.link)?.link;
    if (link) window.location.href = link;
  }

  // ── Mark all read ─────────────────────────────────────────────────────────────
  async function markAllRead() {
    if (!orgId) return;
    const now = new Date().toISOString();
    setItems(prev => prev.map(x => ({ ...x, readAt: x.readAt ?? now })));
    await fetch('/api/notifications', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'mark-all-read', orgId }),
    }).catch(console.error);
  }

  // ── Derive the view — same zones as the dropdown, over the visible set ────────
  const visible = unreadOnly ? items.filter(n => !n.readAt) : items;
  const needsAttention = visible.filter(n => !n.readAt && notificationCategory(n.eventType) === 'act');
  const naIds = new Set(needsAttention.map(n => n.id));
  const activity = visible.filter(n => !naIds.has(n.id));
  const activityGroups = DAY_ORDER
    .map(label => ({ label, items: activity.filter(n => dayBucket(n.createdAt) === label) }))
    .filter(g => g.items.length > 0);

  const showNeeds    = (filter === 'all' || filter === 'needs')    && needsAttention.length > 0;
  const showActivity = (filter === 'all' || filter === 'activity') && activityGroups.length > 0;
  const anyUnread    = items.some(n => !n.readAt);
  const isEmpty      = !loading && !showNeeds && !showActivity;

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
          <p className={styles.itemTime}>{relativeTime(n.createdAt)}</p>
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
          <p className={styles.itemTime}>{relativeTime(newest.createdAt)}</p>
        </div>
        <ChevronRight size={16} className={styles.bundleChevron} aria-hidden />
        {anyMemberUnread && <span className={styles.dot} aria-label="Unread" />}
      </div>
    );
  }

  const CHIPS: { key: ZoneFilter; label: string }[] = [
    { key: 'all',      label: 'All' },
    { key: 'needs',    label: 'Needs attention' },
    { key: 'activity', label: 'Activity' },
  ];

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
          {anyUnread && (
            <button type="button" className={styles.markAllBtn} onClick={markAllRead}>
              <CheckCheck size={15} /> Mark all read
            </button>
          )}
        </div>
      </div>

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
        ) : isEmpty ? (
          <div className={styles.empty}>
            <BellOff size={30} className={styles.emptyIcon} />
            <span>
              {items.length === 0
                ? 'No notifications yet'
                : unreadOnly
                  ? 'You’re all caught up'
                  : 'Nothing in this view'}
            </span>
          </div>
        ) : (
          <>
            {showNeeds && (
              <>
                <div className={`${styles.sectionHeader} ${styles.sectionHeaderAct}`}>
                  <span>Needs attention</span>
                  <span className={styles.sectionCount}>{needsAttention.length}</span>
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

      {!loading && hasMore && (
        <div className={styles.loadMoreWrap}>
          <button type="button" className={styles.loadMoreBtn} onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
