'use client';

import {
  useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent, type CSSProperties,
} from 'react';
import {
  Send, Trash2, Loader2, ChevronUp, ChevronDown, MessageSquare, X, Smile, SmilePlus, Search, Check, CheckCheck, Reply, Pin, BarChart3, Plus, Lock,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-browser';
import { teamColor, teamInitials } from '@/lib/team-color';
import { REACTION_EMOJI, type MessageReactionsMap } from '@/lib/chat-reactions';
import {
  extractPoll, validatePollInput, MIN_POLL_OPTIONS, MAX_POLL_OPTIONS, MAX_POLL_OPTION_LEN, MAX_POLL_QUESTION_LEN,
  type PollDefinition, type PollTalliesMap,
} from '@/lib/chat-polls';
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

type ReplyRef = { id: string; name: string; snippet: string };
type MentionRef = { userId: string; name: string };

type Message = {
  id: string;
  senderUserId: string | null;
  senderName?: string;
  body: string;
  deletedAt: string | null;
  sentAt: string;
  replyTo?: ReplyRef | null;
  mentions?: MentionRef[];
  pinnedAt?: string | null;
  poll?: PollDefinition | null;
};

type Self = { userId: string; isModerator: boolean; mutedUntil: string | null };

type Props = {
  roomId: string;
  roomName?: string;
  /** Present only on the organizer surface — enables per-message moderator soft-delete (any message). */
  onModerateDelete?: (messageId: string) => Promise<void>;
  /** Present on the coach surfaces — lets a member retract THEIR OWN message (soft-delete). */
  onDeleteOwn?: (messageId: string) => Promise<void>;
  /** Present only on the organizer surface — pin/unpin a message (moderator). */
  onPin?: (messageId: string, pinned: boolean) => Promise<void>;
  /** Optional right-aligned header action — e.g. a "Manage" button on the organizer surface, or a
   *  back/switch control. Renders only when a roomName or this slot is provided. */
  headerRight?: ReactNode;
  /** Optional leading header glyph (e.g. a channel icon). */
  iconBefore?: ReactNode;
  /** Unread count at open — drives a one-time "New messages" divider + scroll-to-first-unread. */
  unreadCount?: number;
  className?: string;
  /** Presentation skin. 'warm' = the consumer-shell paper/olive skin (Unified Home R3-3); the default
   *  is the dark coaches/admin skin, byte-for-byte unchanged (they pass no variant). One engine. */
  variant?: 'default' | 'warm';
  /** Present only on the consumer surface — a long-press / right-click on a message opens the caller's
   *  safety sheet (Report to organizers + Mute this room; Unified Home R3-2). The host owns the sheet. */
  onLongPressMessage?: (msg: { id: string; senderName: string; sentAt: string; mine: boolean; deleted: boolean }) => void;
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

/** Curated emoji set for the composer quick-insert grid (no heavy emoji-library dependency). */
const COMPOSER_EMOJI: readonly string[] = [
  '👍', '👎', '❤️', '✅', '❌', '🎉', '🙏',
  '🔥', '😀', '😂', '🙂', '😉', '😍', '😎',
  '🤔', '😅', '😮', '😢', '😭', '😡', '🥳',
  '😴', '🤝', '👏', '🙌', '💪', '👌', '✌️',
  '⭐', '💯', '❗', '❓', '⏰', '📍', '📅',
  '☀️', '🌧️', '❄️', '⚾', '🥎', '⚽', '🏀',
  '🏈', '🏐', '🏆', '🥇', '🧡', '💙',
];

/** Wrap case-insensitive matches of `q` (already lower-cased) in <mark> for search-result highlights. */
function highlightMatches(text: string, q: string): ReactNode {
  if (!q) return text;
  const lower = text.toLowerCase();
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;
  let idx = lower.indexOf(q);
  while (idx !== -1) {
    if (idx > i) out.push(text.slice(i, idx));
    out.push(<mark key={k++} className={styles.searchHit}>{text.slice(idx, idx + q.length)}</mark>);
    i = idx + q.length;
    idx = lower.indexOf(q, i);
  }
  if (i < text.length) out.push(text.slice(i));
  return out;
}

/** Read a typed replyTo out of a realtime row's metadata jsonb (history rows already carry it typed). */
function rowReplyTo(row: Record<string, unknown> | null): ReplyRef | null {
  const meta = (row?.metadata ?? null) as Record<string, unknown> | null;
  const r = (meta?.replyTo ?? null) as { id?: unknown; name?: unknown; snippet?: unknown } | null;
  if (!r || typeof r.id !== 'string') return null;
  return {
    id: r.id,
    name: typeof r.name === 'string' ? r.name : 'Coach',
    snippet: typeof r.snippet === 'string' ? r.snippet : '',
  };
}

/** Read typed @mentions out of a realtime row's metadata jsonb. */
function rowMentions(row: Record<string, unknown> | null): MentionRef[] {
  const meta = (row?.metadata ?? null) as Record<string, unknown> | null;
  const arr = meta?.mentions;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((m) => (m && typeof m === 'object' ? (m as { userId?: unknown; name?: unknown }) : null))
    .filter((m): m is { userId: string; name?: unknown } => !!m && typeof m.userId === 'string')
    .map((m) => ({ userId: m.userId, name: typeof m.name === 'string' ? m.name : 'Coach' }));
}

/** Locate the @mention token the caret sits in (an "@" at a word boundary, no whitespace to the caret). */
function findMentionToken(text: string, caret: number): { start: number; query: string } | null {
  let i = caret - 1;
  while (i >= 0 && !/\s/.test(text[i])) {
    if (text[i] === '@') {
      if (i === 0 || /\s/.test(text[i - 1])) return { start: i, query: text.slice(i + 1, caret) };
      return null;
    }
    i--;
  }
  return null;
}

/** Render a message body with each "@Name" (from the server-resolved mention list) highlighted. */
function renderBodyWithMentions(text: string, names: string[]): ReactNode {
  if (!names.length) return text;
  const tokens = [...new Set(names.map((n) => `@${n}`))].sort((a, b) => b.length - a.length);
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < text.length) {
    if (text[i] === '@') {
      const t = tokens.find((tok) => text.startsWith(tok, i));
      if (t) { out.push(<mark key={k++} className={styles.mentionTag}>{t}</mark>); i += t.length; continue; }
    }
    let j = i + 1;
    while (j < text.length && text[j] !== '@') j++;
    out.push(text.slice(i, j));
    i = j;
  }
  return out;
}

type RenderItem =
  | { type: 'date'; key: string; label: string }
  | { type: 'unread'; key: string }
  | {
      type: 'msg'; key: string; m: Message; mine: boolean;
      pos: 'solo' | 'first' | 'mid' | 'last'; showName: boolean; showAvatar: boolean; showTime: boolean;
    };

export default function ChatPanel({
  roomId, roomName, onModerateDelete, onDeleteOwn, onPin, headerRight, iconBefore, unreadCount, className,
  variant = 'default', onLongPressMessage,
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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [readState, setReadState] = useState<{ messageId: string; readBy: number; memberCount: number } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; asModerator: boolean } | null>(null);
  const [replyTarget, setReplyTarget] = useState<ReplyRef | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [mentionState, setMentionState] = useState<{ start: number; end: number; query: string } | null>(null);
  const [mentionDir, setMentionDir] = useState<MentionRef[] | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentions, setMentions] = useState<MentionRef[]>([]);
  const mentionDirLoadingRef = useRef(false);
  const roomIdRef = useRef(roomId);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [pinnedRefreshKey, setPinnedRefreshKey] = useState(0);
  // Reactions: per-message emoji → { count, mine }. Painted from the history fetch; kept live by a
  // refresh-on-event signal (a reaction realtime event names the message, we re-pull its summary).
  const [reactions, setReactions] = useState<MessageReactionsMap>({});
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [reactorsPopover, setReactorsPopover] = useState<{ messageId: string; emoji: string; list: MentionRef[] | null } | null>(null);
  const reactionDirtyRef = useRef<Set<string>>(new Set());
  const reactionTimerRef = useRef<number | null>(null);
  // Polls: a poll IS a message (definition rides message.poll); the live tally is a separate store
  // (per message: optionId → { count, mine }), refreshed by a vote realtime event, same as reactions.
  const [pollTallies, setPollTallies] = useState<PollTalliesMap>({});
  const [pollVotersPopover, setPollVotersPopover] = useState<{ messageId: string; optionId: string; list: MentionRef[] | null } | null>(null);
  const [pollBuilderOpen, setPollBuilderOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionsDraft, setPollOptionsDraft] = useState<string[]>(['', '']);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [pollSubmitting, setPollSubmitting] = useState(false);
  const pollDirtyRef = useRef<Set<string>>(new Set());
  const pollTimerRef = useRef<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const emojiPopRef = useRef<HTMLDivElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const confirmDialogRef = useRef<HTMLDivElement>(null);
  const deleteInFlightRef = useRef(false);
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
  // Long-press (touch) / right-click (desktop) → the consumer safety sheet. A fired long-press sets a
  // flag so the click that follows on pointer-up doesn't also toggle the message's action reveal.
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  }, []);
  // Bind long-press handlers to a bubble (only when the host wired a safety sheet). Touch fires the
  // sheet after a 500ms still hold (a >10px drag cancels it — that's a scroll); desktop uses right-click.
  // Called inline per bubble (its result is spread straight into JSX), so a fresh object each render is
  // unavoidable anyway — a plain function, not useCallback (which would memoize a value nothing reuses).
  const longPressHandlers = (payload: { id: string; senderName: string; sentAt: string; mine: boolean; deleted: boolean }) =>
    onLongPressMessage
      ? {
          onPointerDown: (e: ReactPointerEvent) => {
            if (e.pointerType === 'mouse') return; // desktop uses onContextMenu
            longPressFiredRef.current = false;
            cancelLongPress();
            longPressStartRef.current = { x: e.clientX, y: e.clientY };
            longPressTimerRef.current = window.setTimeout(() => {
              longPressFiredRef.current = true;
              onLongPressMessage(payload);
            }, 500);
          },
          onPointerMove: (e: ReactPointerEvent) => {
            const start = longPressStartRef.current;
            if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancelLongPress();
          },
          onPointerUp: cancelLongPress,
          onPointerCancel: cancelLongPress,
          onContextMenu: (e: ReactMouseEvent) => { e.preventDefault(); onLongPressMessage(payload); },
        }
      : {};
  // Clear a pending long-press timer if the panel unmounts mid-press (e.g. a fast back-navigation while
  // the finger is still down) so the timeout can't fire on an unmounted tree.
  useEffect(() => () => cancelLongPress(), [cancelLongPress]);
  // Keep the latest `self` reachable from the realtime callback (set up once) without re-subscribing.
  useEffect(() => {
    selfRef.current = self;
  }, [self]);
  // Keep the current room reachable from async callbacks so a late member-directory fetch from a
  // previous room can be discarded instead of poisoning the new room's picker.
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);
  // `unreadCount` is a mount-time snapshot (drives a one-time divider) — mirror it into a ref so the
  // history-load effect can read it WITHOUT taking it as a dependency (a live unread count must never
  // re-trigger the load, which would wipe realtime messages that arrived during the subscribe gap).
  useEffect(() => {
    unreadCountRef.current = unreadCount;
  }, [unreadCount]);

  // In-conversation search derivation — declared up here because the auto-scroll growth effect below
  // reads `searching` (V1 filters the loaded "recent messages" window; whitespace-only = not searching).
  const trimmedQuery = query.trim().toLowerCase();
  const searching = searchOpen && trimmedQuery.length > 0;

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

  // Re-pull the authoritative reaction summary for a set of messages and merge it in. This is the
  // single source of truth for reaction counts: the realtime event only NAMES which message changed
  // (its live payload is never trusted to mutate counts — and un-react is a soft-delete UPDATE, so the
  // server count is what matters). Also used to reconcile after a failed optimistic toggle.
  const refreshReactions = useCallback(async (ids: string[]) => {
    const list = [...new Set(ids)].filter(Boolean);
    if (list.length === 0) return;
    try {
      const res = await fetch(
        `/api/chat/rooms/${roomId}/reactions?messageIds=${encodeURIComponent(list.join(','))}`,
        { cache: 'no-store' },
      );
      if (!res.ok || roomIdRef.current !== roomId) return;
      const data = await res.json();
      const fresh: MessageReactionsMap = data.reactions ?? {};
      setReactions((prev) => {
        const next = { ...prev };
        for (const id of list) {
          if (fresh[id]) next[id] = fresh[id];
          else delete next[id]; // requested but now has no active reactions
        }
        return next;
      });
    } catch {
      /* best-effort — counts will reconcile on the next event */
    }
  }, [roomId]);
  // Reachable from the realtime callback (set up once) without re-subscribing on every render.
  const refreshReactionsRef = useRef(refreshReactions);
  useEffect(() => { refreshReactionsRef.current = refreshReactions; }, [refreshReactions]);

  // Same refresh-on-event pattern for poll tallies: a vote realtime event NAMES the poll message; we
  // re-pull the authoritative tally for it (the live payload is never trusted to mutate counts).
  const refreshPollTallies = useCallback(async (ids: string[]) => {
    const list = [...new Set(ids)].filter(Boolean);
    if (list.length === 0) return;
    try {
      const res = await fetch(
        `/api/chat/rooms/${roomId}/polls?messageIds=${encodeURIComponent(list.join(','))}`,
        { cache: 'no-store' },
      );
      if (!res.ok || roomIdRef.current !== roomId) return;
      const data = await res.json();
      const fresh: PollTalliesMap = data.tallies ?? {};
      setPollTallies((prev) => {
        const next = { ...prev };
        for (const id of list) {
          if (fresh[id]) next[id] = fresh[id];
          else delete next[id];
        }
        return next;
      });
    } catch {
      /* best-effort — tallies reconcile on the next event */
    }
  }, [roomId]);
  const refreshPollTalliesRef = useRef(refreshPollTallies);
  useEffect(() => { refreshPollTalliesRef.current = refreshPollTallies; }, [refreshPollTallies]);


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
      setSearchOpen(false); // never carry a search across a room switch / reload
      setQuery('');
      setReplyTarget(null); // never carry a half-composed reply into another room
      setMentions([]);
      setMentionState(null);
      setMentionDir(null); // re-fetch the member directory per room
      mentionDirLoadingRef.current = false;
      setPinnedMessages([]);
      setPinnedOpen(false);
      setReactions({});
      setReactionPickerFor(null);
      setReactorsPopover(null);
      setPollTallies({});
      setPollVotersPopover(null);
      setPollBuilderOpen(false);
      setPollQuestion('');
      setPollOptionsDraft(['', '']);
      setPollMultiple(false);
      setPollSubmitting(false);
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
        setReactions(data.reactions ?? {});
        setPollTallies(data.pollTallies ?? {});
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
    // Capture the stable dirty-sets so the cleanup clears the SAME Sets this effect used (the ref
    // identity never changes, but the linter wants the value read inside the effect, not in cleanup).
    const reactionDirty = reactionDirtyRef.current;
    const pollDirty = pollDirtyRef.current;
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
              replyTo: rowReplyTo(row),
              mentions: rowMentions(row),
              pinnedAt: (row?.pinned_at as string | null) ?? null,
              poll: extractPoll(row?.metadata as Record<string, unknown> | null),
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
                m.id === id
                  ? {
                      ...m,
                      deletedAt,
                      body: deletedAt ? '' : ((row?.body as string) ?? m.body),
                      replyTo: deletedAt ? null : m.replyTo,
                      mentions: deletedAt ? [] : m.mentions,
                      pinnedAt: (row?.pinned_at as string | null) ?? null,
                      // A poll close/reopen rides a metadata UPDATE — re-derive the poll so the closed
                      // state flips live for everyone (null for non-poll messages keeps the prior value).
                      poll: deletedAt ? null : (extractPoll(row?.metadata as Record<string, unknown> | null) ?? m.poll),
                    }
                  : m,
              ),
            );
            // A pin/unpin (or delete) of any message changes the banner — refresh it (cheap query).
            setPinnedRefreshKey((k) => k + 1);
          }
        },
      )
      // Reactions (the SECOND realtime-published table). The payload only NAMES the changed message —
      // we coalesce a short burst and re-pull the authoritative summary for those messages (the live
      // count is never read from the payload; un-react is a soft-delete UPDATE, so the row stays
      // RLS-correct but the server count is the truth).
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_message_reactions', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
          const mid = row?.message_id as string | undefined;
          if (!mid) return;
          reactionDirty.add(mid);
          if (reactionTimerRef.current == null) {
            reactionTimerRef.current = window.setTimeout(() => {
              const ids = [...reactionDirty];
              reactionDirty.clear();
              reactionTimerRef.current = null;
              void refreshReactionsRef.current(ids);
            }, 350);
          }
        },
      )
      // Poll votes (the THIRD realtime-published table). Same refresh-on-event pattern as reactions:
      // coalesce the changed poll-message ids and re-pull their tallies.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_poll_votes', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
          const mid = row?.message_id as string | undefined;
          if (!mid) return;
          pollDirty.add(mid);
          if (pollTimerRef.current == null) {
            pollTimerRef.current = window.setTimeout(() => {
              const ids = [...pollDirty];
              pollDirty.clear();
              pollTimerRef.current = null;
              void refreshPollTalliesRef.current(ids);
            }, 350);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (reactionTimerRef.current != null) {
        clearTimeout(reactionTimerRef.current);
        reactionTimerRef.current = null;
      }
      if (pollTimerRef.current != null) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      reactionDirty.clear();
      pollDirty.clear();
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
    if (searching) return; // results view owns the scrollport while searching — don't pin/jump it
    if (prevLen === 0 || messages.length <= prevLen) return; // initial fill / clear / no growth
    if (isNearBottomRef.current) scrollToBottom(true);
    else setShowJump(true);
  }, [messages, scrollToBottom, searching]);

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
    const full = el.scrollHeight; // natural content height before clamping
    el.style.height = `${Math.min(full, 140)}px`;
    // Only show the scrollbar once the composer actually reaches its max height. With border-box the
    // height set above is ~2px short of the content, so a permanent `overflow:auto` would paint a
    // phantom scrollbar line down the right edge of an otherwise single-line box.
    el.style.overflowY = full > 140 ? 'auto' : 'hidden';
  }, [draft]);

  // Transient banners (rate-limit / send-failure) auto-dismiss after a few seconds.
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 6000);
    return () => clearTimeout(t);
  }, [banner]);

  // Emoji picker: close on outside-click or Escape (return focus to the trigger on Escape).
  useEffect(() => {
    if (!emojiOpen) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (emojiPopRef.current?.contains(t) || emojiBtnRef.current?.contains(t)) return;
      setEmojiOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.isComposing) return; // don't hijack Escape mid-IME-composition
      if (e.key === 'Escape') {
        setEmojiOpen(false);
        emojiBtnRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [emojiOpen]);

  // Reaction picker + "who reacted" popover: close on any outside mousedown or Escape. The picker /
  // popover / their triggers stop mousedown propagation, so a click inside them doesn't self-close.
  useEffect(() => {
    if (!reactionPickerFor && !reactorsPopover && !pollVotersPopover) return;
    function close() { setReactionPickerFor(null); setReactorsPopover(null); setPollVotersPopover(null); }
    function onDown() { close(); }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [reactionPickerFor, reactorsPopover, pollVotersPopover]);

  // Search: focus the field when opened. (Room-change reset is folded into the history-load effect
  // below, alongside the other per-room resets, to avoid a setState-only effect.)
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Delete-confirm dialog: focus the first button (Cancel) on open, trap Tab, Escape closes, restore
  // focus on close. setState lives only in the event handler, never the effect body.
  useEffect(() => {
    if (!pendingDelete) return;
    const prevFocus = (document.activeElement as HTMLElement) ?? null;
    confirmDialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setPendingDelete(null); return; }
      if (e.key !== 'Tab' || !confirmDialogRef.current) return;
      const f = confirmDialogRef.current.querySelectorAll<HTMLElement>('button');
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prevFocus?.focus(); };
  }, [pendingDelete]);

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
      setReactions((prev) => ({ ...(data.reactions ?? {}), ...prev })); // older summaries, keep newer
      setPollTallies((prev) => ({ ...(data.pollTallies ?? {}), ...prev }));
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
  const canReactRoom = !muted && !readOnly; // everyone in the room may react unless muted/closed
  // Poll creation is an ORGANIZER control, so it travels with the rest of the moderator cluster
  // (pin / close / moderate-delete) — i.e. the organizer chat surface, not the coach participant view
  // (canModerate already requires both the moderator role AND the moderation wiring). This keeps a
  // person who is BOTH a coach and a tournament admin from getting a half-set of organizer controls in
  // their coach portal — they run polls from the admin chat and participate (post/react/vote) anywhere.
  const canCreatePoll = canModerate && !readOnly && !muted;

  // Search results (V1: filters the loaded "recent messages" window). `trimmedQuery`/`searching` are
  // derived earlier (the auto-scroll effect needs `searching`); the result set is computed here.
  const searchResults = useMemo(
    () => (searching ? messages.filter((m) => !m.deletedAt && m.body.toLowerCase().includes(trimmedQuery)) : []),
    [searching, messages, trimmedQuery],
  );
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery('');
    searchBtnRef.current?.focus(); // return focus to the toggle (matches the emoji picker)
  }, []);

  // "Read by N of M" — track the caller's most recent own, non-deleted message; the receipt renders
  // under it. Reuses the per-member last_read_at watermark via a counts-only endpoint.
  const latestOwn = useMemo(() => {
    if (!self) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.senderUserId === self.userId && !m.deletedAt) return m;
    }
    return null;
  }, [messages, self]);
  const latestOwnId = latestOwn?.id ?? null;
  const latestOwnSentAt = latestOwn?.sentAt ?? null;

  // Fetch the "read by N of M" aggregate (counts only) on load + whenever the latest own message
  // changes (a new send), then poll lightly and on tab refocus while visible — chat_room_members
  // isn't realtime-published, so read state can't push live. State is tagged with the message id so a
  // stale value never renders on a newer message; the fetch lives in a local async fn (setState after
  // the await) to mirror the history-load pattern.
  useEffect(() => {
    if (loading || loadError) return;
    const msg = latestOwnId && latestOwnSentAt ? { id: latestOwnId, sentAt: latestOwnSentAt } : null;
    if (!msg) return;
    let cancelled = false;
    const run = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await fetch(
          `/api/chat/rooms/${roomId}/read-state?since=${encodeURIComponent(msg.sentAt)}`,
          { cache: 'no-store' },
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          setReadState({ messageId: msg.id, readBy: Number(data.readBy ?? 0), memberCount: Number(data.memberCount ?? 0) });
        }
      } catch {
        /* best-effort — read receipts are non-critical */
      }
    };
    void run(); // immediate
    const id = setInterval(() => void run(), 20000);
    const onVis = () => { if (document.visibilityState === 'visible') void run(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelled = true; clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [latestOwnId, latestOwnSentAt, loading, loadError, roomId]);

  // Pinned banner — fetch the room's pins on load and whenever a pin/unpin/delete bumps the key.
  useEffect(() => {
    if (loading || loadError) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat/rooms/${roomId}/pinned`, { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && roomIdRef.current === roomId) setPinnedMessages(data.pinned ?? []);
      } catch {
        /* best-effort — the banner just won't show */
      }
    })();
    return () => { cancelled = true; };
  }, [roomId, loading, loadError, pinnedRefreshKey]);

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
    // Only send mentions whose "@Name" still appears in the text (so deleting it un-mentions them);
    // the server re-validates each against active membership.
    const mentionUserIds = mentions.filter((m) => text.includes(`@${m.name}`)).map((m) => m.userId);
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, replyToId: replyTarget?.id ?? null, mentionUserIds }),
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
      setReplyTarget(null);
      setMentions([]);
      setMentionState(null);
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

  // Reply: set the target (client snippet is just for the composer preview — the server rebuilds the
  // authoritative quote from the real message on send), focus the composer, close any open action reveal.
  function startReply(m: Message) {
    setReplyTarget({ id: m.id, name: nameFor(m), snippet: (m.deletedAt ? '' : m.body).slice(0, 140) });
    setRevealedId(null);
    inputRef.current?.focus();
  }
  // Jump to a quoted message if it's in the loaded window, with a brief flash (else a graceful no-op).
  function jumpToMessage(id: string) {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-mid="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    setFlashId(id);
    window.setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1600);
  }

  // Pin / unpin (organizer only). Bumps the refresh key so the banner re-fetches; the realtime UPDATE
  // also bumps it for everyone else in the room.
  async function handlePin(id: string, pin: boolean) {
    if (!onPin) return;
    try {
      await onPin(id, pin);
      setPinnedRefreshKey((k) => k + 1);
    } catch {
      setBanner({ text: 'Could not update the pin.', tone: 'danger' });
    }
  }

  // Toggle MY reaction on a message: optimistic update (flip my chip + adjust the count), then POST and
  // replace with the server's authoritative summary. Tapping the same emoji again removes it; a coach
  // may use several different emojis. On any failure, re-pull the real summary so the UI self-corrects.
  async function toggleReaction(messageId: string, emoji: string) {
    setReactionPickerFor(null);
    setReactions((cur) => {
      const summary = { ...(cur[messageId] ?? {}) };
      const cell = summary[emoji];
      if (cell?.mine) {
        const count = cell.count - 1;
        if (count <= 0) delete summary[emoji];
        else summary[emoji] = { count, mine: false };
      } else {
        summary[emoji] = { count: (cell?.count ?? 0) + 1, mine: true };
      }
      const next = { ...cur };
      if (Object.keys(summary).length === 0) delete next[messageId];
      else next[messageId] = summary;
      return next;
    });
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      if (res.status === 403) {
        const d = await res.json().catch(() => ({}));
        if (d.code === 'muted') {
          setSelf((p) => (p ? { ...p, mutedUntil: new Date(Date.now() + 72 * 3_600_000).toISOString() } : p));
        } else if (d.code === 'room_closed') {
          setIsArchived(true);
        }
        void refreshReactions([messageId]);
        return;
      }
      if (!res.ok) { void refreshReactions([messageId]); return; }
      const data = await res.json();
      const summary = data.reactions ?? {};
      setReactions((cur) => {
        const next = { ...cur };
        if (Object.keys(summary).length === 0) delete next[messageId];
        else next[messageId] = summary;
        return next;
      });
    } catch {
      void refreshReactions([messageId]);
    }
  }

  // Open the "who reacted" popover for a chip and lazily load the names.
  function openReactors(messageId: string, emoji: string) {
    setReactionPickerFor(null);
    setReactorsPopover({ messageId, emoji, list: null });
    (async () => {
      try {
        const res = await fetch(
          `/api/chat/rooms/${roomId}/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`,
          { cache: 'no-store' },
        );
        const data = res.ok ? await res.json() : { reactors: [] };
        if (roomIdRef.current !== roomId) return;
        setReactorsPopover((cur) =>
          cur && cur.messageId === messageId && cur.emoji === emoji ? { ...cur, list: data.reactors ?? [] } : cur,
        );
      } catch {
        setReactorsPopover((cur) =>
          cur && cur.messageId === messageId && cur.emoji === emoji ? { ...cur, list: [] } : cur,
        );
      }
    })();
  }

  // ── Polls ────────────────────────────────────────────────────────────────────
  // Cast / change / retract my vote on a poll option (optimistic, then reconcile with the server's
  // authoritative tally). `multiple` drives the optimistic single-vs-multi behaviour locally.
  async function castVote(messageId: string, optionId: string, multiple: boolean) {
    setPollVotersPopover(null);
    setPollTallies((cur) => {
      const tally = { ...(cur[messageId] ?? {}) };
      const current = tally[optionId];
      if (current?.mine) {
        const count = current.count - 1; // toggle this option off
        if (count <= 0) delete tally[optionId];
        else tally[optionId] = { count, mine: false };
      } else {
        if (!multiple) {
          // single-choice: drop my vote from any other option first
          for (const oid of Object.keys(tally)) {
            if (tally[oid].mine) {
              const c = tally[oid].count - 1;
              if (c <= 0) delete tally[oid];
              else tally[oid] = { count: c, mine: false };
            }
          }
        }
        tally[optionId] = { count: (tally[optionId]?.count ?? 0) + 1, mine: true };
      }
      const next = { ...cur };
      if (Object.keys(tally).length === 0) delete next[messageId];
      else next[messageId] = tally;
      return next;
    });
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/polls/${messageId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId }),
      });
      if (res.status === 403) {
        const d = await res.json().catch(() => ({}));
        if (d.code === 'muted') {
          setSelf((p) => (p ? { ...p, mutedUntil: new Date(Date.now() + 72 * 3_600_000).toISOString() } : p));
        } else if (d.code === 'room_closed') {
          setBanner({ text: 'Voting is closed.', tone: 'warn' });
        }
        void refreshPollTallies([messageId]);
        return;
      }
      if (!res.ok) { void refreshPollTallies([messageId]); return; }
      const data = await res.json();
      const tally = data.tally ?? {};
      setPollTallies((cur) => {
        const next = { ...cur };
        if (Object.keys(tally).length === 0) delete next[messageId];
        else next[messageId] = tally;
        return next;
      });
    } catch {
      void refreshPollTallies([messageId]);
    }
  }

  // Open the "who voted" popover for a poll option and lazily load the names (polls are visible-voter).
  function openPollVoters(messageId: string, optionId: string) {
    setPollVotersPopover({ messageId, optionId, list: null });
    (async () => {
      try {
        const res = await fetch(
          `/api/chat/rooms/${roomId}/polls/${messageId}/voters?optionId=${encodeURIComponent(optionId)}`,
          { cache: 'no-store' },
        );
        const data = res.ok ? await res.json() : { voters: [] };
        if (roomIdRef.current !== roomId) return;
        setPollVotersPopover((cur) =>
          cur && cur.messageId === messageId && cur.optionId === optionId ? { ...cur, list: data.voters ?? [] } : cur,
        );
      } catch {
        setPollVotersPopover((cur) =>
          cur && cur.messageId === messageId && cur.optionId === optionId ? { ...cur, list: [] } : cur,
        );
      }
    })();
  }

  // Close / reopen a poll (organizer). No optimistic flip: the change rides the message realtime
  // UPDATE back to everyone (including us), so the closed state flips when that arrives — which also
  // avoids clobbering a concurrent moderator's change on a failed revert.
  async function closePoll(messageId: string, closed: boolean) {
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/polls/${messageId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closed }),
      });
      if (!res.ok) setBanner({ text: 'Could not update the poll.', tone: 'danger' });
    } catch {
      setBanner({ text: 'Could not update the poll.', tone: 'danger' });
    }
  }

  // Submit the poll builder (organizer). Validates locally, posts, appends the new poll message.
  async function submitPoll() {
    const valid = validatePollInput(pollQuestion, pollOptionsDraft);
    if (!valid.ok) { setBanner({ text: valid.error, tone: 'warn' }); return; }
    setPollSubmitting(true);
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: valid.question, options: valid.options, multiple: pollMultiple }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setBanner({ text: d.error ?? 'Could not create the poll.', tone: 'danger' });
        return;
      }
      const data = await res.json();
      if (data.message) {
        setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      }
      setPollBuilderOpen(false);
      setPollQuestion('');
      setPollOptionsDraft(['', '']);
      setPollMultiple(false);
      isNearBottomRef.current = true;
      setShowJump(false);
      scrollToBottom(true);
    } catch {
      setBanner({ text: 'Could not create the poll.', tone: 'danger' });
    } finally {
      setPollSubmitting(false);
    }
  }

  // ── @mentions ──────────────────────────────────────────────────────────────
  const loadMentionDir = useCallback(async () => {
    if (mentionDirLoadingRef.current) return;
    mentionDirLoadingRef.current = true;
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/members`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (roomIdRef.current === roomId) setMentionDir(data.members ?? []); // ignore a stale-room result
      }
    } catch {
      /* best-effort — the picker just won't open */
    } finally {
      mentionDirLoadingRef.current = false;
    }
  }, [roomId]);

  const mentionMatches = useMemo(() => {
    if (!mentionState || !mentionDir) return [];
    const q = mentionState.query.toLowerCase();
    return mentionDir.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 8);
  }, [mentionState, mentionDir]);

  function onComposerChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setDraft(value);
    const caret = e.target.selectionStart ?? value.length;
    const tok = findMentionToken(value, caret);
    if (tok) {
      setMentionState({ start: tok.start, end: caret, query: tok.query });
      setMentionIndex(0);
      if (!mentionDir) void loadMentionDir();
    } else if (mentionState) {
      setMentionState(null);
    }
  }

  function selectMention(member: MentionRef) {
    if (!mentionState) return;
    const before = draft.slice(0, mentionState.start);
    const after = draft.slice(mentionState.end);
    const insert = `@${member.name} `;
    setDraft(before + insert + after);
    setMentions((prev) => (prev.some((x) => x.userId === member.userId) ? prev : [...prev, member]));
    setMentionState(null);
    const pos = (before + insert).length;
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) { el.focus(); el.setSelectionRange(pos, pos); }
    });
  }

  function onComposerKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (mentionState && mentionMatches.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex((i) => Math.min(i + 1, mentionMatches.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); selectMention(mentionMatches[Math.min(mentionIndex, mentionMatches.length - 1)]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setMentionState(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  }

  // Insert an emoji at the caret (or replace the selection), then restore focus + caret. The picker
  // stays open so several can be added in a row; read the live textarea value (not the `draft` state,
  // which can lag a render behind across rapid clicks) so caret + slice stay consistent. The controlled
  // textarea won't enforce maxLength on a programmatic set, so guard the 4000-char cap here.
  function insertEmoji(emoji: string) {
    const el = inputRef.current;
    const current = el?.value ?? draft;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + emoji + current.slice(end);
    if (next.length > 4000) return;
    setDraft(next);
    setMentionState(null); // an emoji insert ends any in-progress @mention token
    requestAnimationFrame(() => {
      const node = inputRef.current;
      if (!node) return;
      node.focus();
      const pos = start + emoji.length;
      node.setSelectionRange(pos, pos);
    });
  }

  // Shared optimistic soft-delete: mark the message removed locally, run the server call, and on
  // failure restore ONLY that message (functional update so arrivals during the await survive).
  async function optimisticDelete(id: string, run: () => Promise<void>) {
    const prev = messages.find((m) => m.id === id);
    const prevBody = prev?.body ?? '';
    const prevReplyTo = prev?.replyTo ?? null;
    const prevMentions = prev?.mentions ?? [];
    setMessages((cur) =>
      cur.map((m) => (m.id === id ? { ...m, deletedAt: new Date().toISOString(), body: '', replyTo: null, mentions: [] } : m)),
    );
    try {
      await run();
    } catch {
      setMessages((cur) => cur.map((m) => (m.id === id ? { ...m, deletedAt: null, body: prevBody, replyTo: prevReplyTo, mentions: prevMentions } : m)));
      setBanner({ text: 'Could not remove the message.', tone: 'danger' });
    }
  }

  // Open the in-app confirm (replaces the native window.confirm). The dialog's Delete button commits.
  function requestDelete(id: string, asModerator: boolean) {
    setPendingDelete({ id, asModerator });
  }
  async function confirmPendingDelete() {
    if (!pendingDelete || deleteInFlightRef.current) return; // guard a rapid double-click
    deleteInFlightRef.current = true;
    const { id, asModerator } = pendingDelete;
    setPendingDelete(null);
    try {
      if (asModerator) {
        if (onModerateDelete) await optimisticDelete(id, () => onModerateDelete(id));
      } else if (onDeleteOwn) {
        await optimisticDelete(id, () => onDeleteOwn(id));
      }
    } finally {
      deleteInFlightRef.current = false;
    }
  }

  const charsLeft = 4000 - draft.length;

  return (
    <div className={`${styles.panel}${variant === 'warm' ? ` ${styles.panelWarm}` : ''}${className ? ` ${className}` : ''}`}>
      {(roomName || headerRight || iconBefore) && (
        <div className={styles.header}>
          {iconBefore && <span className={styles.headerIcon}>{iconBefore}</span>}
          <span className={styles.headerTitle}>{roomName ?? 'Chat'}</span>
          {!loading && !loadError && messages.length > 0 && (
            <button
              type="button"
              ref={searchBtnRef}
              className={`${styles.searchBtn}${searchOpen ? ` ${styles.searchBtnActive}` : ''}`}
              onClick={() => setSearchOpen((o) => !o)}
              aria-label="Search messages"
              aria-expanded={searchOpen}
              aria-controls={`${instanceId}-search`}
            >
              <Search size={16} aria-hidden />
            </button>
          )}
          {headerRight && <span className={styles.headerRight}>{headerRight}</span>}
        </div>
      )}
      {searchOpen && (
        <div className={styles.searchBar} role="search" id={`${instanceId}-search`}>
          <Search size={15} aria-hidden className={styles.searchBarIcon} />
          <input
            ref={searchInputRef}
            type="text"
            className={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') closeSearch(); }}
            placeholder="Search recent messages…"
            aria-label="Search recent messages"
          />
          {searching && (
            <span className={styles.searchMeta} aria-live="polite">
              {searchResults.length} {searchResults.length === 1 ? 'match' : 'matches'}
            </span>
          )}
          <button type="button" className={styles.searchClose} onClick={closeSearch} aria-label="Close search">
            <X size={16} aria-hidden />
          </button>
        </div>
      )}
      {pinnedMessages.length > 0 && (
        <div className={styles.pinBar}>
          <button
            type="button"
            className={styles.pinBarHead}
            onClick={() => setPinnedOpen((o) => !o)}
            aria-expanded={pinnedOpen}
            disabled={pinnedMessages.length <= 1}
          >
            <Pin size={12} aria-hidden />
            <span>{pinnedMessages.length === 1 ? '1 pinned message' : `${pinnedMessages.length} pinned messages`}</span>
            {pinnedMessages.length > 1 && (pinnedOpen ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />)}
          </button>
          {(pinnedOpen ? pinnedMessages : pinnedMessages.slice(0, 1)).map((p) => (
            <div key={p.id} className={styles.pinRow}>
              <button
                type="button"
                className={styles.pinRowMain}
                onClick={() => jumpToMessage(p.id)}
                title="Jump to message"
              >
                <span className={styles.pinRowName}>{p.senderName ?? 'Coach'}</span>
                <span className={styles.pinRowSnippet}>{p.body.slice(0, 140)}</span>
              </button>
              {onPin && (
                <button
                  type="button"
                  className={styles.pinUnpin}
                  onClick={() => void handlePin(p.id, false)}
                  aria-label="Unpin message"
                >
                  <X size={14} aria-hidden />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <div
        className={styles.messages}
        ref={listRef}
        onScroll={handleScroll}
        role={searching ? undefined : 'log'}
        aria-label={searching ? 'Search results' : 'Chat messages'}
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
        ) : searching ? (
          searchResults.length === 0 ? (
            <div className={styles.searchEmpty}>No matches in recent messages.</div>
          ) : (
            <div className={styles.searchResults}>
              <div className={styles.searchHint}>Searching recent messages</div>
              {searchResults.map((m) => {
                const idKey = m.senderUserId || nameFor(m);
                return (
                  <div key={m.id} className={styles.searchResult}>
                    <div className={styles.searchResultHead}>
                      <span className={styles.searchResultName} style={{ color: teamColor(idKey, 70, 72) }}>
                        {nameFor(m)}
                      </span>
                      <span className={styles.searchResultTime}>
                        {dateDividerLabel(m.sentAt)} · {timeLabel(m.sentAt)}
                      </span>
                    </div>
                    <div className={styles.searchResultBody}>{highlightMatches(m.body, trimmedQuery)}</div>
                  </div>
                );
              })}
            </div>
          )
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
              // One delete affordance per bubble: a moderator can remove any message; otherwise a member
              // can retract their OWN (but not while muted — that matches the disabled composer and the
              // server guard). Reveal-on-tap (revealedId) backs the hover button on touch devices.
              const isPoll = Boolean(m.poll);
              const canReply = !deleted && !muted && !readOnly && !isPoll; // not on polls
              const canRemove = !deleted && (canModerate || (Boolean(onDeleteOwn) && mine && !muted));
              const canPin = !deleted && canModerate && Boolean(onPin);
              const canReact = !deleted && canReactRoom && !isPoll; // not on polls
              const removeAsModerator = canModerate;
              const hasActions = canReply || canRemove || canPin || canReact;
              const reactionSummary = (deleted || isPoll) ? undefined : reactions[m.id];
              const reactionChips = reactionSummary ? REACTION_EMOJI.filter((e) => reactionSummary[e]?.count) : [];
              const poll = m.poll ?? null;
              const pollTally = poll ? (pollTallies[m.id] ?? {}) : {};
              const pollTotal = poll ? poll.options.reduce((s, o) => s + (pollTally[o.id]?.count ?? 0), 0) : 0;
              // Bar width is relative to the LEADING option (works for single- AND multiple-choice);
              // the % share label is only meaningful for single-choice (sums to 100), so it's shown there.
              const pollMax = poll ? poll.options.reduce((mx, o) => Math.max(mx, pollTally[o.id]?.count ?? 0), 0) : 0;
              const pollClosed = Boolean(poll?.closedAt);
              const canVote = Boolean(poll) && canReactRoom && !pollClosed;
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
                      <span
                        className={styles.sender}
                        // Per-team tint only on the dark skin; the warm skin sets its own mono ink color
                        // directly (an inline custom prop can't be overridden by a class rule).
                        style={variant === 'warm' ? undefined : ({ '--sender-tint': teamColor(idKey, 70, 72) } as CSSProperties)}
                      >{nameFor(m)}</span>
                    )}
                    <div
                      data-mid={m.id}
                      className={`${styles.bubble}${styles[`bubble_${pos}`] ? ` ${styles[`bubble_${pos}`]}` : ''}${mine ? ` ${styles.bubbleMine}` : ''}${deleted ? ` ${styles.bubbleDeleted}` : ''}${flashId === m.id ? ` ${styles.bubbleFlash}` : ''}${hasActions && revealedId === m.id ? ` ${styles.bubbleRevealed}` : ''}`}
                      onClick={hasActions ? () => {
                        // Swallow the click that trails a fired long-press so it doesn't also toggle the reveal.
                        if (longPressFiredRef.current) { longPressFiredRef.current = false; return; }
                        setRevealedId((cur) => (cur === m.id ? null : m.id));
                      } : undefined}
                      {...longPressHandlers({ id: m.id, senderName: nameFor(m), sentAt: m.sentAt, mine, deleted })}
                    >
                      {m.replyTo && (
                        <button
                          type="button"
                          className={styles.quote}
                          onClick={(e) => { e.stopPropagation(); jumpToMessage(m.replyTo!.id); }}
                          title={`Reply to ${m.replyTo.name}`}
                        >
                          <span className={styles.quoteName}>{m.replyTo.name}</span>
                          <span className={styles.quoteSnippet}>{m.replyTo.snippet || 'Message'}</span>
                        </button>
                      )}
                      {deleted ? (
                        <em>Message removed</em>
                      ) : poll ? (
                        <div className={styles.poll} onClick={(e) => e.stopPropagation()}>
                          <div className={styles.pollQ}>{m.body}</div>
                          <div className={styles.pollOpts}>
                            {poll.options.map((opt) => {
                              const c = pollTally[opt.id]?.count ?? 0;
                              const mineOpt = Boolean(pollTally[opt.id]?.mine);
                              const barW = pollMax > 0 ? Math.round((c / pollMax) * 100) : 0;
                              const sharePct = pollTotal > 0 ? Math.round((c / pollTotal) * 100) : 0;
                              return (
                                <div key={opt.id} className={styles.pollOptRow}>
                                  <button
                                    type="button"
                                    className={`${styles.pollOpt}${mineOpt ? ` ${styles.pollOptMine}` : ''}`}
                                    onClick={(e) => { e.stopPropagation(); if (canVote) void castVote(m.id, opt.id, poll.multiple); }}
                                    disabled={!canVote}
                                    aria-pressed={mineOpt}
                                  >
                                    <span className={styles.pollOptFill} style={{ width: `${barW}%` }} aria-hidden />
                                    <span className={styles.pollOptLabel}>
                                      {mineOpt && <Check size={13} aria-hidden className={styles.pollOptCheck} />}
                                      {opt.text}
                                    </span>
                                    {!poll.multiple && <span className={styles.pollOptPct}>{sharePct}%</span>}
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.pollOptCount}
                                    onClick={(e) => { e.stopPropagation(); openPollVoters(m.id, opt.id); }}
                                    disabled={c === 0}
                                    aria-label={`${c} vote${c === 1 ? '' : 's'} for ${opt.text}. See who voted.`}
                                    title="See who voted"
                                  >
                                    {c}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          <div className={styles.pollFoot}>
                            <span className={styles.pollMeta}>
                              {pollClosed ? (<><Lock size={11} aria-hidden /> Closed</>) : (poll.multiple ? 'Choose any' : 'Choose one')}
                              {pollTotal > 0 ? ` · ${pollTotal} vote${pollTotal === 1 ? '' : 's'}` : ''}
                            </span>
                            {canModerate && (
                              <button
                                type="button"
                                className={styles.pollCloseBtn}
                                onClick={(e) => { e.stopPropagation(); void closePoll(m.id, !pollClosed); }}
                              >
                                {pollClosed ? 'Reopen' : 'Close poll'}
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (m.mentions && m.mentions.length > 0
                            ? renderBodyWithMentions(m.body, m.mentions.map((x) => x.name))
                            : m.body)}
                      {hasActions && (
                        <div className={styles.msgActions}>
                          {canReact && (
                            <button
                              type="button"
                              className={styles.msgActionBtn}
                              title="Add reaction"
                              aria-label="Add a reaction"
                              aria-haspopup="true"
                              aria-expanded={reactionPickerFor === m.id}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); setReactorsPopover(null); setReactionPickerFor((cur) => (cur === m.id ? null : m.id)); }}
                            >
                              <span className={styles.msgActionDot}><SmilePlus size={14} aria-hidden /></span>
                            </button>
                          )}
                          {canReply && (
                            <button
                              type="button"
                              className={styles.msgActionBtn}
                              title="Reply"
                              aria-label="Reply to this message"
                              onClick={(e) => { e.stopPropagation(); startReply(m); }}
                            >
                              <span className={styles.msgActionDot}><Reply size={14} aria-hidden /></span>
                            </button>
                          )}
                          {canPin && (
                            <button
                              type="button"
                              className={styles.msgActionBtn}
                              title={m.pinnedAt ? 'Unpin' : 'Pin'}
                              aria-label={m.pinnedAt ? 'Unpin message' : 'Pin message'}
                              onClick={(e) => { e.stopPropagation(); void handlePin(m.id, !m.pinnedAt); }}
                            >
                              <span className={`${styles.msgActionDot}${m.pinnedAt ? ` ${styles.msgActionDotActive}` : ''}`}>
                                <Pin size={14} aria-hidden />
                              </span>
                            </button>
                          )}
                          {canRemove && (
                            <button
                              type="button"
                              className={`${styles.msgActionBtn} ${styles.msgActionDanger}`}
                              title={removeAsModerator ? 'Remove message' : 'Delete your message'}
                              aria-label={removeAsModerator ? 'Remove message' : 'Delete your message'}
                              onClick={(e) => { e.stopPropagation(); requestDelete(m.id, removeAsModerator); }}
                            >
                              <span className={styles.msgActionDot}><Trash2 size={14} aria-hidden /></span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {reactionSummary && reactionChips.length > 0 && (
                      <div className={`${styles.reactionRow}${mine ? ` ${styles.reactionRowMine}` : ''}`}>
                        {reactionChips.map((emoji) => {
                          const cell = reactionSummary[emoji];
                          if (!cell) return null;
                          return (
                            <button
                              key={emoji}
                              type="button"
                              className={`${styles.reactionChip}${cell.mine ? ` ${styles.reactionChipMine}` : ''}`}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); openReactors(m.id, emoji); }}
                              aria-label={`${cell.count} reacted ${emoji}. See who reacted.`}
                            >
                              <span className={styles.reactionChipEmoji} aria-hidden>{emoji}</span>
                              <span className={styles.reactionChipCount}>{cell.count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {reactionPickerFor === m.id && (
                      <div
                        className={`${styles.reactionPicker}${mine ? ` ${styles.reactionPickerMine}` : ''}`}
                        role="group"
                        aria-label="Pick a reaction"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {REACTION_EMOJI.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className={`${styles.reactionPick}${reactions[m.id]?.[emoji]?.mine ? ` ${styles.reactionPickActive}` : ''}`}
                            onClick={(e) => { e.stopPropagation(); void toggleReaction(m.id, emoji); }}
                            aria-label={`React ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    {reactorsPopover?.messageId === m.id && (
                      <div
                        className={`${styles.reactorsPop}${mine ? ` ${styles.reactorsPopMine}` : ''}`}
                        role="dialog"
                        aria-label={`Reacted with ${reactorsPopover.emoji}`}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className={styles.reactorsHead}>
                          <span className={styles.reactorsEmoji} aria-hidden>{reactorsPopover.emoji}</span>
                          <span className={styles.reactorsTitle}>Reacted</span>
                          <button
                            type="button"
                            className={styles.reactorsClose}
                            onClick={(e) => { e.stopPropagation(); setReactorsPopover(null); }}
                            aria-label="Close"
                          >
                            <X size={14} aria-hidden />
                          </button>
                        </div>
                        <div className={styles.reactorsList}>
                          {reactorsPopover.list == null ? (
                            <div className={styles.reactorsLoading}><Loader2 size={13} className={styles.spin} aria-hidden /> Loading…</div>
                          ) : reactorsPopover.list.length === 0 ? (
                            <div className={styles.reactorsEmpty}>No one yet.</div>
                          ) : (
                            reactorsPopover.list.map((r) => (
                              <div key={r.userId} className={styles.reactorItem}>
                                <span className={styles.avatar} style={{ background: teamColor(r.userId) }} aria-hidden>
                                  {teamInitials(r.name)}
                                </span>
                                <span className={styles.reactorName}>{r.name}</span>
                              </div>
                            ))
                          )}
                        </div>
                        {canReactRoom && (
                          <button
                            type="button"
                            className={styles.reactorsToggle}
                            onClick={(e) => { e.stopPropagation(); const rp = reactorsPopover; setReactorsPopover(null); void toggleReaction(rp.messageId, rp.emoji); }}
                          >
                            {reactions[m.id]?.[reactorsPopover.emoji]?.mine ? 'Remove my reaction' : `Add ${reactorsPopover.emoji}`}
                          </button>
                        )}
                      </div>
                    )}
                    {pollVotersPopover?.messageId === m.id && (
                      <div
                        className={`${styles.reactorsPop}${mine ? ` ${styles.reactorsPopMine}` : ''}`}
                        role="dialog"
                        aria-label="Who voted"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className={styles.reactorsHead}>
                          <span className={styles.reactorsTitle}>
                            {poll?.options.find((o) => o.id === pollVotersPopover.optionId)?.text ?? 'Voted'}
                          </span>
                          <button
                            type="button"
                            className={styles.reactorsClose}
                            onClick={(e) => { e.stopPropagation(); setPollVotersPopover(null); }}
                            aria-label="Close"
                          >
                            <X size={14} aria-hidden />
                          </button>
                        </div>
                        <div className={styles.reactorsList}>
                          {pollVotersPopover.list == null ? (
                            <div className={styles.reactorsLoading}><Loader2 size={13} className={styles.spin} aria-hidden /> Loading…</div>
                          ) : pollVotersPopover.list.length === 0 ? (
                            <div className={styles.reactorsEmpty}>No votes yet.</div>
                          ) : (
                            pollVotersPopover.list.map((r) => (
                              <div key={r.userId} className={styles.reactorItem}>
                                <span className={styles.avatar} style={{ background: teamColor(r.userId) }} aria-hidden>
                                  {teamInitials(r.name)}
                                </span>
                                <span className={styles.reactorName}>{r.name}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                    {showTime && <span className={styles.time}>{timeLabel(m.sentAt)}</span>}
                    {mine && !deleted && readState && readState.messageId === m.id && readState.memberCount > 0 && (
                      <span className={styles.readReceipt}>
                        {readState.readBy === 0 ? (
                          <><Check size={12} aria-hidden /> Sent</>
                        ) : readState.readBy >= readState.memberCount ? (
                          <><CheckCheck size={12} aria-hidden /> Read by everyone</>
                        ) : (
                          <><CheckCheck size={12} aria-hidden /> Read by {readState.readBy} of {readState.memberCount}</>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
        <div ref={bottomRef} />
        {showJump && !searching && (
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
        <div className={styles.composerArea}>
          {mentionState && mentionMatches.length > 0 && (
            <div className={styles.mentionPicker} role="listbox" aria-label="Mention a coach">
              {mentionMatches.map((m, idx) => (
                <button
                  key={m.userId}
                  type="button"
                  role="option"
                  aria-selected={idx === mentionIndex}
                  className={`${styles.mentionOption}${idx === mentionIndex ? ` ${styles.mentionOptionActive}` : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); selectMention(m); }}
                  onMouseEnter={() => setMentionIndex(idx)}
                >
                  <span className={styles.avatar} style={{ background: teamColor(m.userId) }} aria-hidden>
                    {teamInitials(m.name)}
                  </span>
                  <span className={styles.mentionName}>{m.name}</span>
                </button>
              ))}
            </div>
          )}
          {replyTarget && (
            <div className={styles.replyBar}>
              <div className={styles.replyBarBody}>
                <span className={styles.replyBarLabel}>Replying to {replyTarget.name}</span>
                <span className={styles.replyBarSnippet}>{replyTarget.snippet || 'Message'}</span>
              </div>
              <button
                type="button"
                className={styles.replyBarClose}
                onClick={() => setReplyTarget(null)}
                aria-label="Cancel reply"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          )}
          {pollBuilderOpen ? (
            <div className={styles.pollBuilder}>
              <div className={styles.pollBuilderHead}>
                <BarChart3 size={15} aria-hidden />
                <span className={styles.pollBuilderTitle}>New poll</span>
                <button type="button" className={styles.replyBarClose} onClick={() => setPollBuilderOpen(false)} aria-label="Cancel poll">
                  <X size={16} aria-hidden />
                </button>
              </div>
              <input
                className={styles.pollBuilderQuestion}
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Ask a question…"
                maxLength={MAX_POLL_QUESTION_LEN}
                aria-label="Poll question"
              />
              {pollOptionsDraft.map((opt, i) => (
                <div key={i} className={styles.pollBuilderOptRow}>
                  <input
                    className={styles.pollBuilderOpt}
                    value={opt}
                    onChange={(e) => setPollOptionsDraft((d) => d.map((o, j) => (j === i ? e.target.value : o)))}
                    placeholder={`Option ${i + 1}`}
                    maxLength={MAX_POLL_OPTION_LEN}
                    aria-label={`Option ${i + 1}`}
                  />
                  {pollOptionsDraft.length > MIN_POLL_OPTIONS && (
                    <button
                      type="button"
                      className={styles.pollBuilderOptDel}
                      onClick={() => setPollOptionsDraft((d) => d.filter((_, j) => j !== i))}
                      aria-label={`Remove option ${i + 1}`}
                    >
                      <X size={14} aria-hidden />
                    </button>
                  )}
                </div>
              ))}
              <div className={styles.pollBuilderControls}>
                {pollOptionsDraft.length < MAX_POLL_OPTIONS && (
                  <button type="button" className={styles.pollAddOpt} onClick={() => setPollOptionsDraft((d) => [...d, ''])}>
                    <Plus size={14} aria-hidden /> Add option
                  </button>
                )}
                <label className={styles.pollMultiLabel}>
                  <input type="checkbox" checked={pollMultiple} onChange={(e) => setPollMultiple(e.target.checked)} />{' '}
                  Allow multiple answers
                </label>
              </div>
              <div className={styles.pollBuilderActions}>
                <button type="button" className="btn btn-ghost" onClick={() => setPollBuilderOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-lime" onClick={() => void submitPoll()} disabled={pollSubmitting}>
                  {pollSubmitting ? <Loader2 size={15} className={styles.spin} aria-hidden /> : 'Create poll'}
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.composer}>
              <div className={styles.emojiWrap}>
                <button
                  type="button"
                  ref={emojiBtnRef}
                  className={styles.emojiBtn}
                  onClick={() => setEmojiOpen((o) => !o)}
                  aria-label="Insert emoji"
                  aria-expanded={emojiOpen}
                  aria-haspopup="true"
                >
                  <Smile size={18} aria-hidden />
                </button>
                {emojiOpen && (
                  <div className={styles.emojiPop} ref={emojiPopRef} role="group" aria-label="Emoji picker">
                    <div className={styles.emojiGrid}>
                      {COMPOSER_EMOJI.map((e) => (
                        <button
                          key={e}
                          type="button"
                          className={styles.emojiItem}
                          onClick={() => insertEmoji(e)}
                          aria-label={`Insert ${e} emoji`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {canCreatePoll && (
                <button
                  type="button"
                  className={styles.emojiBtn}
                  onClick={() => { setEmojiOpen(false); setPollBuilderOpen(true); }}
                  aria-label="Create a poll"
                  title="Create a poll"
                >
                  <BarChart3 size={18} aria-hidden />
                </button>
              )}
              <textarea
                ref={inputRef}
                className={styles.input}
                value={draft}
                onChange={onComposerChange}
                onKeyDown={onComposerKeyDown}
                onBlur={() => setMentionState(null)}
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
      )}

      {pendingDelete && (
        <div className={styles.confirmBackdrop} role="presentation" onClick={() => setPendingDelete(null)}>
          <div
            ref={confirmDialogRef}
            className={styles.confirmDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${instanceId}-confirm-title`}
            aria-describedby={`${instanceId}-confirm-body`}
            onClick={(e) => e.stopPropagation()}
          >
            <p id={`${instanceId}-confirm-title`} className={styles.confirmTitle}>
              {pendingDelete.asModerator ? 'Remove this message?' : 'Delete your message?'}
            </p>
            <p id={`${instanceId}-confirm-body`} className={styles.confirmBody}>This can’t be undone.</p>
            <div className={styles.confirmActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={() => void confirmPendingDelete()}>
                {pendingDelete.asModerator ? 'Remove' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
