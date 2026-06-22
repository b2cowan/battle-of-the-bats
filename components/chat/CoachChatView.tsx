'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, ChevronLeft, Loader2 } from 'lucide-react';
import { teamColor, teamInitials } from '@/lib/team-color';
import ChatPanel from './ChatPanel';
import styles from './CoachChatView.module.css';

/**
 * Coach-facing chat surface, reused by BOTH coach portals (org-less Basic + org-based League/Club).
 * Self-sizing full-height host — fills the portal content area so the conversation reads like a real
 * messaging app. Portal-agnostic: lists every tournament chat room the signed-in coach belongs to
 * (per-user, not per-team) via /api/chat/rooms, then opens the shared ChatPanel for the selected
 * room. Master-detail: a single room auto-opens; with several, the header carries a "Rooms" switcher
 * back to the list (room-switcher-ready for future per-division rooms).
 */

type RoomListItem = {
  room: { id: string; name: string; isArchived: boolean };
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  isModerator: boolean;
  selfMutedUntil: string | null;
  readOnly: boolean;
};

export default function CoachChatView() {
  const [rooms, setRooms] = useState<RoomListItem[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/chat/rooms', { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) setError('Unable to load your chats right now.');
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const list: RoomListItem[] = data.rooms ?? [];
        setRooms(list);
        if (list.length === 1) setSelected(list[0].room.id);
      } catch {
        if (!cancelled) setError('Unable to load your chats right now.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  let content: ReactNode;

  if (error) {
    content = <div className={styles.empty}>{error}</div>;
  } else if (rooms === null) {
    content = (
      <div className={styles.empty}>
        <Loader2 size={18} className={styles.spin} aria-hidden /> Loading your chats…
      </div>
    );
  } else if (rooms.length === 0) {
    const tournamentsPath = pathname.replace(/\/chat$/, '/tournaments');
    content = (
      <div className={styles.empty}>
        <MessageSquare size={40} aria-hidden className={styles.emptyIcon} />
        <p className={styles.emptyTitle}>No tournament chats yet</p>
        <p className={styles.emptyBody}>
          When an organizer opens chat for a tournament your team is in, the conversation appears here.
        </p>
        <Link href={tournamentsPath} className={styles.emptyLink}>View your tournaments →</Link>
      </div>
    );
  } else {
    const selectedRoom = rooms.find((r) => r.room.id === selected) ?? null;
    const multi = rooms.length > 1;

    const roomList = (
      <div className={styles.sidebar} aria-label="Your chats">
        {rooms.map((r) => {
          const active = r.room.id === selected;
          return (
            <button
              key={r.room.id}
              type="button"
              className={`${styles.roomRow}${active ? ` ${styles.roomRowActive}` : ''}`}
              onClick={() => setSelected(r.room.id)}
              aria-current={active ? 'true' : undefined}
            >
              <div className={styles.roomIcon} style={{ background: teamColor(r.room.name) }} aria-hidden>
                {teamInitials(r.room.name)}
              </div>
              <div className={styles.roomMain}>
                <span className={styles.roomName}>
                  {r.room.name}
                  {r.readOnly && <span className={styles.roTag}>Closed</span>}
                </span>
                <span className={styles.roomPreview}>{r.lastMessagePreview ?? 'No messages yet'}</span>
              </div>
              {r.unreadCount > 0 && (
                <span className={styles.unread} aria-label={`${r.unreadCount > 9 ? '9+' : r.unreadCount} unread`}>
                  <span aria-hidden>{r.unreadCount > 9 ? '9+' : r.unreadCount}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    );

    const detail = (
      <div className={styles.detail}>
        {selectedRoom ? (
          <div className={styles.panelWrap}>
            <ChatPanel
              roomId={selectedRoom.room.id}
              roomName={selectedRoom.room.name}
              unreadCount={selectedRoom.unreadCount}
              iconBefore={<MessageSquare size={14} aria-hidden />}
              headerRight={
                multi ? (
                  <button type="button" className={styles.backBtn} onClick={() => setSelected(null)}>
                    <ChevronLeft size={18} aria-hidden /> <span className={styles.backBtnLabel}>Rooms</span>
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className={styles.pickPrompt}>
            <MessageSquare size={30} aria-hidden className={styles.pickIcon} />
            <p>Select a conversation</p>
          </div>
        )}
      </div>
    );

    // Single room → just the conversation. Multiple → master/detail: a full-swap on mobile,
    // a persistent room list beside the conversation on desktop (CSS drives the difference).
    content = multi ? (
      <div className={`${styles.split}${selectedRoom ? ` ${styles.hasSelection}` : ''}`}>
        {roomList}
        {detail}
      </div>
    ) : (
      detail
    );
  }

  return <div className={styles.host}>{content}</div>;
}
