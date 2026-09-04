'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppNotification } from '@/lib/types';
import { notificationCategory, ACT_EVENT_TYPES } from '@/lib/notification-labels';
import { DAY_ORDER, dayBucket } from '@/lib/notification-view';

/**
 * useNotificationFeed — the "See all" page's state, in one place, so two shells can wear it.
 *
 * Split out of NotificationsPageContent on 2026-09-03 (coach-notifications review, R1): the admin
 * page and the coach page share the FEED (loading, paging, zones, bundling, mark-read) and own their
 * FRAMES (the admin title block; CoachPageHeader). The frame needs exactly two things from the feed
 * — whether "Mark all read" would do anything, and the handler — and the body needs the rest.
 *
 * ⚠ Row taps still navigate with a full document load after the mark-read round trip (R8, deferred
 * to a second pass by the owner). Do not "fix" that here without the URL-state half that goes with it.
 */

export const FEED_PAGE_SIZE = 40;

export type ZoneFilter = 'all' | 'needs' | 'activity';

function postAction(body: Record<string, unknown>) {
  return fetch('/api/notifications', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  }).catch(console.error);
}

export function useNotificationFeed(orgId: string | undefined) {
  const [items,       setItems]       = useState<AppNotification[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(false);
  // A failed read is a STATE, not an empty feed (review B6): a phone at a rink is the ordinary case.
  const [error,       setError]       = useState(false);
  const [unreadOnly,  setUnreadOnly]  = useState(false); // archive view defaults to All
  const [filter,      setFilter]      = useState<ZoneFilter>('all');

  // ── Load (initial, and the Try-again retry) ─────────────────────────────────
  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/notifications?orgId=${orgId}&limit=${FEED_PAGE_SIZE}`);
      if (!res.ok) throw new Error(`notifications ${res.status}`);
      const data = await res.json();
      setItems(data.notifications ?? []);
      setHasMore(Boolean(data.hasMore));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  // ── Load more (older rows via the created_at cursor) ─────────────────────────
  const loadMore = useCallback(async () => {
    if (!orgId || loadingMore || items.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = items[items.length - 1].createdAt;
      const res  = await fetch(
        `/api/notifications?orgId=${orgId}&limit=${FEED_PAGE_SIZE}&before=${encodeURIComponent(oldest)}`,
      );
      if (!res.ok) throw new Error(`notifications ${res.status}`);
      const data = await res.json();
      setItems(prev => [...prev, ...(data.notifications ?? [])]);
      setHasMore(Boolean(data.hasMore));
    } catch {
      /* the rows already on screen stay; the button stays too, so the coach can try again */
    } finally {
      setLoadingMore(false);
    }
  }, [orgId, loadingMore, items]);

  // ── Mark read (single) + navigate ────────────────────────────────────────────
  const markRead = useCallback(async (n: AppNotification) => {
    if (!n.readAt) {
      setItems(prev => prev.map(x => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      await postAction({ action: 'mark-read', id: n.id });
    }
    if (n.link) window.location.href = n.link;
  }, []);

  // ── Bundle: mark every member read at once, then open the type's list ─────────
  const bundleClick = useCallback(async (members: AppNotification[]) => {
    const unreadIds = members.filter(m => !m.readAt).map(m => m.id);
    if (unreadIds.length > 0) {
      const idSet = new Set(unreadIds);
      setItems(prev => prev.map(x => (idSet.has(x.id) ? { ...x, readAt: new Date().toISOString() } : x)));
      await Promise.all(unreadIds.map(id => postAction({ action: 'mark-read', id })));
    }
    const link = members.find(m => m.link)?.link;
    if (link) window.location.href = link;
  }, []);

  // ── Mark all read — ACTIVITY only (D3, 2026-09-03) ───────────────────────────
  // Needs-attention rows are a triage list and clear when opened; one tap must not make an
  // unhandled decision look handled. The server applies the same exclusion, from the same set.
  const markAllRead = useCallback(async () => {
    if (!orgId) return;
    const now = new Date().toISOString();
    setItems(prev => prev.map(x => (x.readAt || ACT_EVENT_TYPES.has(x.eventType) ? x : { ...x, readAt: now })));
    await postAction({ action: 'mark-all-read', orgId });
  }, [orgId]);

  // ── Derive the view — same zones as the dropdown, over the visible set ────────
  const view = useMemo(() => {
    const visible = unreadOnly ? items.filter(n => !n.readAt) : items;
    const needsAttention = visible.filter(n => !n.readAt && notificationCategory(n.eventType) === 'act');
    const naIds = new Set(needsAttention.map(n => n.id));
    const activity = visible.filter(n => !naIds.has(n.id));
    const activityGroups = DAY_ORDER
      .map(label => ({ label, items: activity.filter(n => dayBucket(n.createdAt) === label) }))
      .filter(g => g.items.length > 0);
    const showNeeds    = (filter === 'all' || filter === 'needs')    && needsAttention.length > 0;
    const showActivity = (filter === 'all' || filter === 'activity') && activityGroups.length > 0;
    // The chip's count is over EVERYTHING loaded, not the filtered view — it is a badge, not a tally.
    const needsCount = items.filter(n => !n.readAt && notificationCategory(n.eventType) === 'act').length;
    // "Mark all read" appears only when it would do something: an unread row outside Needs attention.
    const anyActivityUnread = items.some(n => !n.readAt && !ACT_EVENT_TYPES.has(n.eventType));
    return { needsAttention, activityGroups, showNeeds, showActivity, needsCount, anyActivityUnread };
  }, [items, unreadOnly, filter]);

  const isEmpty = !loading && !error && !view.showNeeds && !view.showActivity;

  return {
    items, loading, loadingMore, hasMore, error, isEmpty,
    unreadOnly, setUnreadOnly, filter, setFilter,
    reload: load, loadMore, markRead, bundleClick, markAllRead,
    ...view,
  };
}

export type NotificationFeed = ReturnType<typeof useNotificationFeed>;
