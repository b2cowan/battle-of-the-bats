'use client';

import { useCallback, useRef, useState } from 'react';
import { BellOff, MessageCircle } from 'lucide-react';
import { teamColor, teamInitials } from '@/lib/team-color';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import ChatConversation from './ChatConversation';
import styles from './chat-inbox.module.css';

/** One conversation row in the cross-context inbox (shape mirrors the /api/consumer/chat/inbox payload). */
export type InboxRoom = {
  roomId: string;
  roomName: string;
  eventId: string;
  eventName: string | null;
  /** WI-1: return-path links in the open-room header (event chip + Event-admin shortcut). */
  orgSlug: string | null;
  tournamentSlug: string | null;
  /** WI-1: false for a draft tournament (no public home) → the event chip is hidden. */
  tournamentIsPublic: boolean;
  isModerator: boolean;
  /** Project 2A: a team staff room — suppresses the Event-admin shortcut (its moderator is the
   *  head coach; no admin surface exists and eventId is not a tournament id). */
  isStaffRoom?: boolean;
  unreadCount: number;
  selfNotifMuted: boolean;
  readOnly: boolean;
  lastMessageAt: string | null;
  preview: string | null;
  /** F2: divisions this room covers ("9U, 10U"); null for the All-coaches room. */
  divisionLabel?: string | null;
};

/** Compact relative time for a row ("now" / "5m" / "3h" / "2d" / "Jul 14"). */
function relTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const hr = Math.floor(diffMin / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

/**
 * The signed-in member's cross-context Chat inbox (Unified Home R3-1): rooms grouped by EVENT (mono
 * kicker headers), newest activity first, per-room unread badge (olive; muted rooms excluded + dimmed
 * with a slash-bell). Below 1024px, master/detail is a full swap — tap a room → the warm conversation;
 * back → the inbox (which refetches so unread / previews stay fresh) — mobile-first, matching the
 * Round 3 frames. At ≥1024px (Desktop Phase 2) the same state drives a split pane instead: the list
 * stays mounted beside the open conversation, the in-conversation back button retires (the list IS the
 * way back), and until the reader picks a room the right pane holds a quiet prompt — no auto-open with
 * several rooms, because opening marks a room read and that should be the reader's choice.
 */
export default function ChatInbox({
  initialRooms,
  initialSelectedId,
}: {
  initialRooms: InboxRoom[];
  /** WI-2: a notification deep-link (`/chat?room=…`) preselects that room. WI-1: with no explicit
   *  target, a lone room auto-opens (no one-item list). Both resolve once, so Back returns to the
   *  inbox and never re-opens. A stale/foreign id falls through to the inbox (find no-ops). */
  initialSelectedId?: string | null;
}) {
  const [rooms, setRooms] = useState<InboxRoom[]>(initialRooms);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => initialSelectedId ?? (initialRooms.length === 1 ? initialRooms[0].roomId : null),
  );
  // Desktop split vs mobile full-swap — the shared platform hook (also CoachChatView's).
  const isDesktop = useIsDesktop();
  // Monotonic version bumped by every refresh AND every optimistic mutation; a refresh only commits if
  // its version is still current when it resolves — so a slow refresh can't clobber a newer optimistic
  // mute (or a newer refresh) that landed while it was in flight.
  const stateVersionRef = useRef(0);
  // The room the reader just left (switch or Back): its badge is zeroed locally and the zero is
  // pinned through the next refresh commit, because that refresh's GET can be serviced before the
  // departing panel's read-marking PATCH commits (stale-badge race, /review 2026-07-31).
  const justReadRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const version = ++stateVersionRef.current;
    try {
      const res = await fetch('/api/consumer/chat/inbox', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (version !== stateVersionRef.current) return; // superseded while we awaited
      // A room the reader just left stays zeroed through this commit — its read-marking
      // PATCH races this GET server-side, and a stale nonzero badge for a room the reader
      // literally just had open reads as a bug (/review 2026-07-31). Genuinely-new messages
      // arriving later still badge via the next refresh.
      const zeroId = justReadRef.current;
      justReadRef.current = null;
      const fetched: InboxRoom[] = data.rooms ?? [];
      setRooms(zeroId ? fetched.map((r) => (r.roomId === zeroId ? { ...r, unreadCount: 0 } : r)) : fetched);
    } catch {
      /* keep the last-known list */
    }
  }, []);

  const selected = rooms.find((r) => r.roomId === selectedId) ?? null;

  // Open a room (list click; the row carries its id as data — one stable handler, passed
  // directly, keeps every ref access out of render scope per react-hooks/refs). Desktop
  // room switch: the departing room was open and on-screen, so its badge zeroes NOW, and
  // the zero is pinned through the refresh — whose GET can beat the departing panel's
  // read-marking PATCH (stale-badge race).
  const onRowClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const roomId = e.currentTarget.dataset.roomId;
    if (!roomId || roomId === selectedId) return;
    if (selectedId) {
      const departing = selectedId;
      justReadRef.current = departing;
      stateVersionRef.current++;
      setRooms((rs) => rs.map((room) => (room.roomId === departing ? { ...room, unreadCount: 0 } : room)));
    }
    setSelectedId(roomId);
    // Desktop keeps the list on screen — refetch so siblings' previews/unread stay
    // honest while reading (mobile does this on Back instead).
    if (isDesktop) void refresh();
  }, [selectedId, isDesktop, refresh]);

  // Back (mobile): the reader had this room open — keep its badge at zero through the
  // refresh (same read-marking race as the desktop switch above).
  const closeRoom = useCallback(() => {
    if (selectedId) justReadRef.current = selectedId;
    setSelectedId(null);
    void refresh();
  }, [selectedId, refresh]);

  const conversation = selected ? (
    <ChatConversation
      // Remount per room so the panel's lifecycle (history fetch, realtime channel, read-marking)
      // matches the full-swap behaviour exactly — one panel, fresh per conversation.
      key={selected.roomId}
      room={selected}
      hideBack={isDesktop}
      onBack={closeRoom}
      onMuteChange={(muted) => {
        stateVersionRef.current++; // invalidate any in-flight refresh that predates this optimistic update
        setRooms((rs) =>
          rs.map((r) =>
            r.roomId === selected.roomId ? { ...r, selfNotifMuted: muted, unreadCount: muted ? 0 : r.unreadCount } : r,
          ),
        );
      }}
    />
  ) : null;

  // Group by event. A Map preserves insertion order, so first-seen (= newest-activity, since `rooms`
  // is already sorted) event order falls out for free — no parallel index bookkeeping.
  const groupMap = new Map<string, { eventId: string; eventName: string | null; rooms: InboxRoom[] }>();
  for (const r of rooms) {
    let g = groupMap.get(r.eventId);
    if (!g) {
      g = { eventId: r.eventId, eventName: r.eventName, rooms: [] };
      groupMap.set(r.eventId, g);
    }
    g.rooms.push(r);
  }
  const groups = [...groupMap.values()];

  const inboxHead = (
    <div className={styles.inboxHead}>
      <h1 className={styles.inboxTitle}>Chat</h1>
    </div>
  );

  const groupSections = groups.map((g) => (
    <section key={g.eventId} className={styles.group}>
      <div className={styles.eventKicker}>{g.eventName ?? 'Conversations'}</div>
      {g.rooms.map((r) => {
        const muted = r.selfNotifMuted;
        const isOpen = r.roomId === selectedId;
        // The open room's badge yields while its panel is on screen (the panel is marking
        // it read). Only visible on desktop — mobile hides the list while a room is open.
        const showUnread = !muted && r.unreadCount > 0 && !isOpen;
        return (
          <button
            key={r.roomId}
            type="button"
            className={`${styles.row}${muted ? ` ${styles.rowMuted}` : ''}${isOpen ? ` ${styles.rowActive}` : ''}`}
            aria-current={isOpen ? 'true' : undefined}
            data-room-id={r.roomId}
            onClick={onRowClick}
          >
            <span className={styles.mono} style={{ background: teamColor(r.roomName) }} aria-hidden>
              {teamInitials(r.roomName)}
            </span>
            <span className={styles.rowMain}>
              <span className={styles.rowTop}>
                <span className={styles.rowName}>
                  {r.roomName}
                  {muted && <BellOff size={12} className={styles.mutedBell} aria-label="Muted" />}
                </span>
                <span className={styles.rowTime}>{relTime(r.lastMessageAt)}</span>
              </span>
              {r.divisionLabel && (
                <span className={styles.rowDivisions}>{r.divisionLabel}</span>
              )}
              <span className={`${styles.rowPreview}${showUnread ? ` ${styles.rowPreviewUnread}` : ''}`}>
                {r.preview ?? 'No messages yet'}
              </span>
            </span>
            {showUnread && (
              <span className={styles.unread} aria-label={`${r.unreadCount > 9 ? '9+' : r.unreadCount} unread`}>
                {r.unreadCount > 9 ? '9+' : r.unreadCount}
              </span>
            )}
          </button>
        );
      })}
    </section>
  ));

  // ONE tree at every width — CSS does the mobile↔desktop swap, never a JSX-shape branch.
  // Branching the returned root on isDesktop (an earlier revision did) makes React unmount and
  // remount the whole ChatPanel subtree when the 1024px boundary is crossed — destroying an
  // unsent composer draft, refetching history, and resubscribing realtime — and paints a
  // mobile-shaped flash on every desktop deep-link load (isDesktop is false until the mount
  // effect runs). Constant shape is CoachChatView's proven recipe (/review 2026-07-31).
  return (
    <div className={`${styles.split}${selected ? ` ${styles.splitHasSel}` : ''}`}>
      <div className={`${styles.inbox} ${styles.splitList}`}>
        {inboxHead}
        <div className={styles.inboxScroll}>{groupSections}</div>
      </div>
      <div className={styles.splitConv}>
        {conversation ?? (
          <div className={styles.pickPane}>
            <span className={styles.pickMedallion}><MessageCircle size={24} aria-hidden /></span>
            <p className={styles.pickTitle}>Select a conversation</p>
            <p className={styles.pickSub}>Your messages stay unread until you open them.</p>
          </div>
        )}
      </div>
    </div>
  );
}
