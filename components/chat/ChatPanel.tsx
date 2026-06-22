'use client';

import {
  useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { Send, Trash2, Loader2, ChevronUp, ChevronDown, MessageSquare, X } from 'lucide-react';
import { createClient } from '@/lib/supabase-browser';
import { teamColor, teamInitials } from '@/lib/team-color';
import styles from './ChatPanel.module.css';

/**
 * Shared chat surface — reused by every Coach Chat surface (Tournament Chat ships it first).
 *
 * LOAD-THEN-STREAM (the hard-won engine lesson): the channel reports SUBSCRIBED a beat BEFORE
 * postgres_changes actually streams, so a message sent in that gap is silently missed. We therefore
 * fetch the existing history via the API, then treat realtime INSERTs as post-connection updates and
 * dedupe by id. UPDATEs propagate soft-deletes live. The browser client carries the user's JWT via
 * cookie, so RLS resolves auth.uid() on the socket (no setAuth needed).
 *
 * Presentation only (UX pass 2026-06-22): WhatsApp/iMessage-style consecutive-sender grouping, date
 * dividers, a "new messages" divider, coloured initials, an autosizing composer, a jump-to-latest
 * pill, and scroll-position anchoring. The engine logic above is unchanged.
 */

type Message = {
  id: string;
  senderUserId: string | null;
  senderName?: string;
  body: string;
  deletedAt: string | null;
  sentAt: string;
};

type Self = { userId: string; isModerator: boolean; mutedUntil: string | null };

type Props = {
  roomId: string;
  roomName?: string;
  /** Present only on the organizer surface — enables per-message soft-delete. */
  onModerateDelete?: (messageId: string) => Promise<void>;
  /** Optional right-aligned header action — e.g. a "Manage" button on the organizer surface, or a
   *  back/switch control. Renders only when a roomName or this slot is provided. */
  headerRight?: ReactNode;
  /** Optional leading header glyph (e.g. a channel icon). */
  iconBefore?: ReactNode;
  /** Unread count at open — drives a one-time "New messages" divider + scroll-to-first-unread. */
  unreadCount?: number;
  className?: string;
};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** Time-only label — the calendar date now lives in date dividers, not on every bubble. */
function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

function dateDividerLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

const RUN_GAP_MS = 5 * 60 * 1000;
function gap(a: Message, b: Message): number {
  return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
}

type RenderItem =
  | { type: 'date'; key: string; label: string }
  | { type: 'unread'; key: string }
  | {
      type: 'msg'; key: string; m: Message; mine: boolean;
      pos: 'solo' | 'first' | 'mid' | 'last'; showName: boolean; showAvatar: boolean; showTime: boolean;
    };

export default function ChatPanel({
  roomId, roomName, onModerateDelete, headerRight, iconBefore, unreadCount, className,
}: Props) {
  const instanceId = useId();
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Record<string, string>>({});
  const [self, setSelf] = useState<Self | null>(null);
  const [isArchived, setIsArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [banner, setBanner] = useState<{ text: string; tone: 'warn' | 'danger' } | null>(null);
  const [showJump, setShowJump] = useState(false);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const unreadDividerRef = useRef<HTMLDivElement>(null);
  const selfRef = useRef<Self | null>(self);
  const lastReadMarkRef = useRef(0);
  const channelNonceRef = useRef(0);
  const isNearBottomRef = useRef(true);
  const prevScrollHeightRef = useRef(0);
  const loadEarlierPendingRef = useRef(false);
  const suppressAutoScrollRef = useRef(false);
  const prevLenRef = useRef(0);
  const unreadCountRef = useRef(unreadCount);
  // Keep the latest `self` reachable from the realtime callback (set up once) without re-subscribing.
  useEffect(() => {
    selfRef.current = self;
  }, [self]);
  // `unreadCount` is a mount-time snapshot (drives a one-time divider) — mirror it into a ref so the
  // history-load effect can read it WITHOUT taking it as a dependency (a live unread count must never
  // re-trigger the load, which would wipe realtime messages that arrived during the subscribe gap).
  useEffect(() => {
    unreadCountRef.current = unreadCount;
  }, [unreadCount]);

  const nameFor = useCallback(
    (m: Message) =>
      (m.senderUserId && participants[m.senderUserId]) || m.senderName || (m.senderUserId ? '…' : 'Coach'),
    [participants],
  );

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
  }, []);

  const markRead = useCallback(async () => {
    lastReadMarkRef.current = Date.now();
    try {
      await fetch(`/api/chat/rooms/${roomId}/read`, { method: 'PATCH' });
    } catch {
      /* best-effort */
    }
  }, [roomId]);

  // ── 1. Load history (then mark read + scroll). Re-runs on room change / retry. ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      setMessages([]);
      setBanner(null);
      setFirstUnreadId(null);
      setShowJump(false);
      try {
        const res = await fetch(`/api/chat/rooms/${roomId}/messages?limit=50`, { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) setLoadError(true);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        // Functional merge: a realtime INSERT can land between this fetch and the subscribe arming;
        // preserve any such message (dedupe by id) rather than overwriting it with the history snapshot.
        const history: Message[] = data.messages ?? [];
        setMessages((prev) => {
          const histIds = new Set(history.map((m) => m.id));
          const realtimeOnly = prev.filter((m) => !histIds.has(m.id));
          return [...history, ...realtimeOnly].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
        });
        setParticipants(data.participants ?? {});
        setSelf(data.self ?? null);
        setIsArchived(Boolean(data.room?.isArchived));
        setHasMore(Boolean(data.hasMore));
        // One-time "New messages" divider: only when the unread cohort sits inside the loaded window.
        const unread = unreadCountRef.current;
        if (typeof unread === 'number' && unread > 0) {
          const idx = history.length - unread;
          if (idx > 0 && idx < history.length) setFirstUnreadId(history[idx].id);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, retryKey]);

  // Scroll into place (first-unread if present, else newest) + mark read once history has rendered.
  // useLayoutEffect so the position is set before paint (no top→bottom flash).
  useLayoutEffect(() => {
    if (loading || loadError) return;
    if (unreadDividerRef.current) {
      unreadDividerRef.current.scrollIntoView({ block: 'start' });
      isNearBottomRef.current = false;
    } else {
      scrollToBottom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadError]);

  useEffect(() => {
    if (!loading && !loadError) void markRead();
  }, [loading, loadError, markRead]);

  // ── 2. Realtime — subscribe AFTER mount; the history fetch covers the pre-subscribe gap. ──
  useEffect(() => {
    const supabase = createClient();
    // Per-mount nonce so a StrictMode unmount→remount (same useId) doesn't reuse a just-removed
    // channel name (which can leave realtime silently dead in dev).
    const nonce = ++channelNonceRef.current;
    const channel = supabase
      .channel(`chat:${roomId}:${instanceId}:${nonce}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
          const id = row?.id as string | undefined;
          if (!id) return;

          if (payload.eventType === 'INSERT') {
            const incoming: Message = {
              id,
              senderUserId: (row?.sender_user_id as string | null) ?? null,
              senderName: undefined,
              body: (row?.body as string) ?? '',
              deletedAt: (row?.deleted_at as string | null) ?? null,
              sentAt: (row?.sent_at as string) ?? new Date().toISOString(),
            };
            setMessages((prev) => (prev.some((m) => m.id === id) ? prev : [...prev, incoming]));

            // Mark read for an incoming message from someone else, throttled, when visible.
            const mine = incoming.senderUserId === selfRef.current?.userId;
            if (!mine && document.visibilityState === 'visible' && Date.now() - lastReadMarkRef.current > 2500) {
              void markRead();
            }
          } else if (payload.eventType === 'UPDATE') {
            const deletedAt = (row?.deleted_at as string | null) ?? null;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === id ? { ...m, deletedAt, body: deletedAt ? '' : ((row?.body as string) ?? m.body) } : m,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, instanceId, markRead]);

  // Track whether the viewport is docked at the bottom; dismiss the jump pill when the user gets there.
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = dist < 48;
    if (isNearBottomRef.current) setShowJump(false);
  }, []);

  // React only to a post-load GROWTH of the list (a new arrival): pin to bottom if docked there
  // (threshold 48px — tighter "effectively at the bottom" so reading older messages isn't hijacked),
  // else surface the jump pill. Comparing against the previous length naturally skips the initial
  // fill, the room-switch clear, and a load-earlier prepend (the last is also flagged so the pill is
  // never shown when older history is fetched).
  useEffect(() => {
    const prevLen = prevLenRef.current;
    prevLenRef.current = messages.length;
    if (suppressAutoScrollRef.current) { suppressAutoScrollRef.current = false; return; }
    if (prevLen === 0 || messages.length <= prevLen) return; // initial fill / clear / no growth
    if (isNearBottomRef.current) scrollToBottom(true);
    else setShowJump(true);
  }, [messages, scrollToBottom]);

  // Preserve scroll position when older messages prepend (no viewport jump).
  useLayoutEffect(() => {
    if (!loadEarlierPendingRef.current) return;
    const el = listRef.current;
    if (el) el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
    loadEarlierPendingRef.current = false;
  }, [messages]);

  // Autosize the composer up to a clamp (the textarea is otherwise locked at one row).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft]);

  // Transient banners (rate-limit / send-failure) auto-dismiss after a few seconds.
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 6000);
    return () => clearTimeout(t);
  }, [banner]);

  const loadEarlier = useCallback(async () => {
    if (loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    prevScrollHeightRef.current = listRef.current?.scrollHeight ?? 0;
    loadEarlierPendingRef.current = true;
    suppressAutoScrollRef.current = true; // prepend grows the list — don't treat it as a new arrival
    try {
      const oldest = messages[0].sentAt;
      const res = await fetch(
        `/api/chat/rooms/${roomId}/messages?limit=50&before=${encodeURIComponent(oldest)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        loadEarlierPendingRef.current = false;
        suppressAutoScrollRef.current = false;
        return;
      }
      const data = await res.json();
      const older: Message[] = data.messages ?? [];
      setParticipants((prev) => ({ ...(data.participants ?? {}), ...prev }));
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !seen.has(m.id)), ...prev];
      });
      setHasMore(Boolean(data.hasMore));
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, messages, roomId]);

  const muted = Boolean(self?.mutedUntil && new Date(self.mutedUntil) > new Date());
  const readOnly = isArchived;
  const canModerate = Boolean(onModerateDelete && self?.isModerator);

  // Build the render list: messages + date dividers + a one-time unread divider, with consecutive
  // same-sender grouping (within 5 min, same day, not across the unread divider).
  const renderItems = useMemo<RenderItem[]>(() => {
    const items: RenderItem[] = [];
    let prevDate: string | null = null;
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const date = dayKey(m.sentAt);
      const newDay = date !== prevDate;
      if (newDay) items.push({ type: 'date', key: `date-${date}`, label: dateDividerLabel(m.sentAt) });
      const isUnreadStart = firstUnreadId != null && m.id === firstUnreadId;
      if (isUnreadStart) items.push({ type: 'unread', key: 'unread-divider' });
      prevDate = date;

      const prev = messages[i - 1];
      const next = messages[i + 1];
      const samePrev = Boolean(
        prev && prev.senderUserId === m.senderUserId && !newDay && !isUnreadStart && gap(prev, m) <= RUN_GAP_MS,
      );
      const sameNext = Boolean(
        next && next.senderUserId === m.senderUserId && dayKey(next.sentAt) === date &&
        !(firstUnreadId != null && next.id === firstUnreadId) && gap(m, next) <= RUN_GAP_MS,
      );
      const isFirstInRun = !samePrev;
      const isLastInRun = !sameNext;
      const mine = m.senderUserId === self?.userId;
      const pos = isFirstInRun && isLastInRun ? 'solo' : isFirstInRun ? 'first' : isLastInRun ? 'last' : 'mid';
      items.push({
        type: 'msg', key: m.id, m, mine, pos,
        showName: !mine && isFirstInRun,
        showAvatar: !mine,
        showTime: isLastInRun,
      });
    }
    return items;
  }, [messages, firstUnreadId, self]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      if (res.status === 429) {
        setBanner({ text: 'Slow down a moment — you’re sending messages very quickly.', tone: 'warn' });
        return;
      }
      if (res.status === 403) {
        const d = await res.json().catch(() => ({}));
        if (d.code === 'muted') {
          // The persistent muted footer is the canonical signal — reflect the mute, no extra banner.
          setSelf((prev) => (prev ? { ...prev, mutedUntil: new Date(Date.now() + 72 * 3_600_000).toISOString() } : prev));
        } else if (d.code === 'room_closed') {
          setIsArchived(true);
        } else setBanner({ text: d.error ?? 'You cannot post in this conversation.', tone: 'danger' });
        return;
      }
      if (!res.ok) {
        setBanner({ text: 'Message failed to send. Try again.', tone: 'danger' });
        return;
      }
      const data = await res.json();
      setDraft('');
      if (data.message) {
        setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      }
      isNearBottomRef.current = true;
      setShowJump(false);
      scrollToBottom(true);
    } catch {
      setBanner({ text: 'Message failed to send. Try again.', tone: 'danger' });
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    if (!onModerateDelete) return;
    if (typeof window !== 'undefined' && !window.confirm('Remove this message? This cannot be undone.')) return;
    const prevBody = messages.find((m) => m.id === id)?.body ?? '';
    setMessages((cur) =>
      cur.map((m) => (m.id === id ? { ...m, deletedAt: new Date().toISOString(), body: '' } : m)),
    );
    try {
      await onModerateDelete(id);
    } catch {
      // Restore only the targeted message (functional) so messages that arrived during the await survive.
      setMessages((cur) => cur.map((m) => (m.id === id ? { ...m, deletedAt: null, body: prevBody } : m)));
      setBanner({ text: 'Could not remove the message.', tone: 'danger' });
    }
  }

  const charsLeft = 4000 - draft.length;

  return (
    <div className={`${styles.panel}${className ? ` ${className}` : ''}`}>
      {(roomName || headerRight || iconBefore) && (
        <div className={styles.header}>
          {iconBefore && <span className={styles.headerIcon}>{iconBefore}</span>}
          <span className={styles.headerTitle}>{roomName ?? 'Chat'}</span>
          {headerRight && <span className={styles.headerRight}>{headerRight}</span>}
        </div>
      )}
      <div
        className={styles.messages}
        ref={listRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Chat messages"
        aria-atomic="false"
      >
        {loading ? (
          <div className={styles.loadingState}>
            <Loader2 size={22} className={styles.spin} aria-hidden /> Loading conversation…
          </div>
        ) : loadError ? (
          <div className={styles.errorState}>
            <p>Couldn’t load this conversation.</p>
            <button type="button" className={styles.retryBtn} onClick={() => setRetryKey((k) => k + 1)}>
              Try again
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}><MessageSquare size={24} aria-hidden /></span>
            <p className={styles.emptyTitle}>No messages yet</p>
            <p className={styles.emptyBody}>Be the first to say something.</p>
          </div>
        ) : (
          <>
            {hasMore && (
              <button type="button" className={styles.loadMore} onClick={loadEarlier} disabled={loadingMore}>
                {loadingMore ? <Loader2 size={13} className={styles.spin} aria-hidden /> : <ChevronUp size={13} aria-hidden />}
                Load earlier messages
              </button>
            )}
            {renderItems.map((item) => {
              if (item.type === 'date') {
                return <div key={item.key} className={styles.dateDivider}><span>{item.label}</span></div>;
              }
              if (item.type === 'unread') {
                return (
                  <div key={item.key} ref={unreadDividerRef} className={styles.unreadDivider}>
                    <span>New messages</span>
                  </div>
                );
              }
              const { m, mine, pos, showName, showAvatar, showTime } = item;
              const deleted = Boolean(m.deletedAt);
              const idKey = m.senderUserId || nameFor(m);
              return (
                <div key={item.key} className={`${styles.row}${mine ? ` ${styles.rowMine}` : ''}${styles[`row_${pos}`] ? ` ${styles[`row_${pos}`]}` : ''}`}>
                  {showAvatar && (
                    <div className={styles.avatarCol} aria-hidden>
                      {showName ? (
                        <span className={styles.avatar} style={{ background: teamColor(idKey) }}>
                          {teamInitials(nameFor(m))}
                        </span>
                      ) : (
                        <span className={styles.avatarSpacer} />
                      )}
                    </div>
                  )}
                  <div className={styles.bubbleWrap}>
                    {showName && (
                      <span className={styles.sender} style={{ color: teamColor(idKey, 70, 72) }}>{nameFor(m)}</span>
                    )}
                    <div
                      className={`${styles.bubble}${styles[`bubble_${pos}`] ? ` ${styles[`bubble_${pos}`]}` : ''}${mine ? ` ${styles.bubbleMine}` : ''}${deleted ? ` ${styles.bubbleDeleted}` : ''}${canModerate && revealedId === m.id ? ` ${styles.bubbleRevealed}` : ''}`}
                      onClick={canModerate && !deleted ? () => setRevealedId((cur) => (cur === m.id ? null : m.id)) : undefined}
                    >
                      {deleted ? <em>Message removed</em> : m.body}
                      {canModerate && !deleted && (
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          title="Remove message"
                          aria-label="Remove message"
                          onClick={(e) => { e.stopPropagation(); void handleDelete(m.id); }}
                        >
                          <Trash2 size={12} aria-hidden />
                        </button>
                      )}
                    </div>
                    {showTime && <span className={styles.time}>{timeLabel(m.sentAt)}</span>}
                  </div>
                </div>
              );
            })}
          </>
        )}
        <div ref={bottomRef} />
        {showJump && (
          <button type="button" className={styles.jumpPill} onClick={() => { isNearBottomRef.current = true; setShowJump(false); scrollToBottom(true); }}>
            <ChevronDown size={14} aria-hidden /> New messages
          </button>
        )}
      </div>

      {banner && (
        <div className={`${banner.tone === 'warn' ? styles.bannerWarn : styles.banner}`} role={banner.tone === 'danger' ? 'alert' : 'status'}>
          <span>{banner.text}</span>
          <button type="button" className={styles.bannerDismiss} aria-label="Dismiss" onClick={() => setBanner(null)}>
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      {readOnly ? (
        <div className={styles.closed}>This conversation is closed. You can still read it.</div>
      ) : muted ? (
        <div className={styles.muted}>You are muted in this conversation and cannot post right now.</div>
      ) : (
        <div className={styles.composer}>
          <textarea
            ref={inputRef}
            className={styles.input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Write a message…"
            rows={1}
            maxLength={4000}
            aria-label="Message"
          />
          {charsLeft < 500 && (
            <span className={`${styles.charCount}${charsLeft < 100 ? ` ${styles.charCountUrgent}` : ''}`} aria-live="polite">
              {charsLeft}
            </span>
          )}
          <button
            type="button"
            className={`btn btn-lime ${styles.sendBtn}`}
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            aria-label="Send"
          >
            {sending ? <Loader2 size={16} className={styles.spin} aria-hidden /> : <Send size={16} aria-hidden />}
          </button>
        </div>
      )}
    </div>
  );
}
