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
    // The coach reader marks a row read WITHOUT awaiting it, and its onward link is a full-document
    // load — a coach who opens a notification and taps "Open …" at once would otherwise unload the
    // page with the mark-read still in flight and the browser free to cancel it (/review 2026-09-25).
    // `keepalive` lets the request outlive the page; the bodies here are a few bytes.
    keepalive: true,
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

  // ── Mark read WITHOUT leaving (the coach reader, owner ruling 2026-09-25) ────────
  // Opening a notification in the reader reads it; going on to its page is a second, separate
  // choice. One call for a single row and a bundle alike — a bundle is read when it is opened.
  const markSeen = useCallback(async (members: AppNotification[]) => {
    const unreadIds = members.filter(m => !m.readAt).map(m => m.id);
    if (unreadIds.length === 0) return;
    const idSet = new Set(unreadIds);
    const now = new Date().toISOString();
    setItems(prev => prev.map(x => (idSet.has(x.id) ? { ...x, readAt: now } : x)));
    await Promise.all(unreadIds.map(id => postAction({ action: 'mark-read', id })));
  }, []);

  // ── Mark read (single) + navigate — the ADMIN feed's tap (the coach feed opens the reader) ──
  const markRead = useCallback(async (n: AppNotification) => {
    await markSeen([n]);
    if (n.link) window.location.href = n.link;
  }, [markSeen]);

  // ── Bundle: mark every member read at once, then open the type's list (admin tap) ──
  const bundleClick = useCallback(async (members: AppNotification[]) => {
    await markSeen(members);
    const link = members.find(m => m.link)?.link;
    if (link) window.location.href = link;
  }, [markSeen]);

  // ── Clear — "I am finished with this one" (2026-09-06, mockup 9427bc24) ──────
  // The ONLY thing that takes a row out of "Needs attention". Opening one no longer does, which
  // is the whole change: the zone used to answer "have you looked at it?" while its heading
  // promised "have you dealt with it?". Also stamps read, because a row you are finished with
  // should not sit unread — the server does the same, guarded, so a reload agrees.
  const clearRow = useCallback(async (n: AppNotification) => {
    if (n.clearedAt) return;
    const now = new Date().toISOString();
    setItems(prev => prev.map(x =>
      x.id === n.id ? { ...x, clearedAt: now, readAt: x.readAt ?? now } : x,
    ));
    const res = await postAction({ action: 'clear', id: n.id });
    // ⚠ CLEAR IS THE ONE ACTION HERE THAT ROLLS BACK, and the asymmetry is deliberate (review,
    // 2026-09-06). Its siblings post fire-and-forget: a lost mark-read costs a coach a bold row.
    // A lost CLEAR costs them the decision itself — the row vanishes from the triage list while
    // `cleared_at` was never written, which is precisely "an unmade decision looks handled", the
    // failure this whole zone exists to prevent. A `.catch()` alone does not cover it either,
    // since an HTTP 401/500 RESOLVES; the status has to be read. So the row goes back.
    if (!res?.ok) {
      setItems(prev => prev.map(x =>
        x.id === n.id ? { ...x, clearedAt: null, readAt: n.readAt } : x,
      ));
    }
  }, []);

  // ── Mark all read — ACTIVITY only (D3, 2026-09-03) ───────────────────────────
  // Needs-attention rows are a triage list; one tap must not make an unhandled decision look
  // handled. The server applies the same exclusion, from the same set. ⚠ Since rows now leave the
  // zone on cleared_at, this exclusion is the only thing standing between "Mark all read" and
  // silently emptying a list of unmade decisions — it must never learn to write cleared_at.
  const markAllRead = useCallback(async () => {
    if (!orgId) return;
    const now = new Date().toISOString();
    setItems(prev => prev.map(x => (x.readAt || ACT_EVENT_TYPES.has(x.eventType) ? x : { ...x, readAt: now })));
    await postAction({ action: 'mark-all-read', orgId });
  }, [orgId]);

  // ── Derive the view — same zones as the dropdown ─────────────────────────────
  const view = useMemo(() => {
    // ⚠ ONE CLOCK PER GROUPING PASS, AND THE ROWS MUST READ THE SAME ONE (review, 2026-09-06).
    // This memo only re-runs when items/unreadOnly/filter change, but a row's label is computed
    // fresh on every render. Left to their own `new Date()` calls the two drift apart the moment a
    // day boundary passes without the items changing — tap "Load more" just after midnight and the
    // memo still says "Today" while the labels below it have already moved on. That is the very
    // contradiction this whole change exists to remove, coming back through the side door. So the
    // clock is stamped ONCE here and handed to the body as `groupedAt`; a label may go a few
    // minutes stale, which nobody can see, but it can never disagree with the heading above it.
    const now = new Date();
    // ⚠ "Needs attention" IS COMPUTED OVER EVERYTHING, NOT OVER THE UNREAD FILTER, and that is
    // deliberate. A row now stays until it is CLEARED, so it can be read and still owed a decision
    // — and under "Unread" the filter would hide exactly the rows the zone exists to keep in front
    // of the coach. The Unread/All toggle therefore filters the ACTIVITY feed; the triage list is
    // not a slice of time or of read state, and is never filtered out from under itself.
    const needsAttention = items.filter(n => !n.clearedAt && notificationCategory(n.eventType) === 'act');
    const naIds = new Set(needsAttention.map(n => n.id));
    const visible = unreadOnly ? items.filter(n => !n.readAt) : items;
    const activity = visible.filter(n => !naIds.has(n.id));
    const activityGroups = DAY_ORDER
      .map(label => ({ label, items: activity.filter(n => dayBucket(n.createdAt, now) === label) }))
      .filter(g => g.items.length > 0);
    const showNeeds    = (filter === 'all' || filter === 'needs')    && needsAttention.length > 0;
    const showActivity = (filter === 'all' || filter === 'activity') && activityGroups.length > 0;
    // The chip's count is the zone's own length now that the zone ignores the read filter.
    const needsCount = needsAttention.length;
    // "Mark all read" appears only when it would do something: an unread row outside Needs attention.
    const anyActivityUnread = items.some(n => !n.readAt && !ACT_EVENT_TYPES.has(n.eventType));
    return { needsAttention, activityGroups, showNeeds, showActivity, needsCount, anyActivityUnread, groupedAt: now };
  }, [items, unreadOnly, filter]);

  const isEmpty = !loading && !error && !view.showNeeds && !view.showActivity;

  return {
    items, loading, loadingMore, hasMore, error, isEmpty,
    unreadOnly, setUnreadOnly, filter, setFilter,
    reload: load, loadMore, markRead, markSeen, bundleClick, markAllRead, clearRow,
    ...view,
  };
}

export type NotificationFeed = ReturnType<typeof useNotificationFeed>;
