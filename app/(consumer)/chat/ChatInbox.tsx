'use client';

import { useCallback, useRef, useState } from 'react';
import { BellOff } from 'lucide-react';
import { teamColor, teamInitials } from '@/lib/team-color';
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
  unreadCount: number;
  selfNotifMuted: boolean;
  readOnly: boolean;
  lastMessageAt: string | null;
  preview: string | null;
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
 * with a slash-bell). Tap a room → the warm conversation; back → the inbox (which refetches so unread /
 * previews stay fresh). Master/detail is a full swap — mobile-first, matching the Round 3 frames.
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
  // Monotonic version bumped by every refresh AND every optimistic mutation; a refresh only commits if
  // its version is still current when it resolves — so a slow refresh can't clobber a newer optimistic
  // mute (or a newer refresh) that landed while it was in flight.
  const stateVersionRef = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++stateVersionRef.current;
    try {
      const res = await fetch('/api/consumer/chat/inbox', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (version !== stateVersionRef.current) return; // superseded while we awaited
      setRooms(data.rooms ?? []);
    } catch {
      /* keep the last-known list */
    }
  }, []);

  const selected = rooms.find((r) => r.roomId === selectedId) ?? null;

  if (selected) {
    return (
      <ChatConversation
        room={selected}
        onBack={() => { setSelectedId(null); void refresh(); }}
        onMuteChange={(muted) => {
          stateVersionRef.current++; // invalidate any in-flight refresh that predates this optimistic update
          setRooms((rs) =>
            rs.map((r) =>
              r.roomId === selected.roomId ? { ...r, selfNotifMuted: muted, unreadCount: muted ? 0 : r.unreadCount } : r,
            ),
          );
        }}
      />
    );
  }

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

  return (
    <div className={styles.inbox}>
      <div className={styles.inboxHead}>
        <h1 className={styles.inboxTitle}>Chat</h1>
      </div>
      <div className={styles.inboxScroll}>
        {groups.map((g) => (
          <section key={g.eventId} className={styles.group}>
            <div className={styles.eventKicker}>{g.eventName ?? 'Conversations'}</div>
            {g.rooms.map((r) => {
              const muted = r.selfNotifMuted;
              const showUnread = !muted && r.unreadCount > 0;
              return (
                <button
                  key={r.roomId}
                  type="button"
                  className={`${styles.row}${muted ? ` ${styles.rowMuted}` : ''}`}
                  onClick={() => setSelectedId(r.roomId)}
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
        ))}
      </div>
    </div>
  );
}
