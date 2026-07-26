'use client';

/**
 * "Team chat" doorway on the team Overview (A2.2 — approved mockups 2026-07-25, owner call:
 * top of the page). Team chat itself lives in the GLOBAL consumer Chat tab (the portal's
 * separate Chat section is retired); this card keeps it discoverable in team context —
 * a doorway, not a second inbox. Shows the most recent of THIS team's rooms (matched by
 * tournament) with its last-message preview + the team's combined unread count.
 * Renders nothing until the organizer has opened a room the coach belongs to.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, ChevronRight } from 'lucide-react';
import styles from './CoachTeamChatDoorway.module.css';

type RoomListItem = {
  room: { id: string; refId: string; refSubId: string | null; name: string; settings: Record<string, unknown> };
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  contextLabel: string | null;
  readOnly: boolean;
};

/** A division room (opaque refSubId) scopes via `settings.divisionIds`; the All-coaches room
 *  (refSubId null) belongs to every team in the tournament. A malformed/absent division list
 *  keeps the room (worst case it's tournament-wide — never hides a legitimate conversation). */
function roomBelongsToTeam(item: RoomListItem, tournamentIds: string[], divisionIds: string[]): boolean {
  if (!tournamentIds.includes(item.room.refId)) return false;
  if (item.room.refSubId == null) return true;
  const divs = (item.room.settings as { divisionIds?: unknown })?.divisionIds;
  if (!Array.isArray(divs) || divs.length === 0) return true;
  return divs.some(d => typeof d === 'string' && divisionIds.includes(d));
}

export default function CoachTeamChatDoorway({
  tournamentIds,
  divisionIds,
}: {
  tournamentIds: string[];
  /** THIS team's registration divisions — keeps a sibling team's division room (same coach,
   *  same tournament, different division) from surfacing on this team's page. */
  divisionIds: string[];
}) {
  const [rooms, setRooms] = useState<RoomListItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/chat/rooms', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { rooms?: RoomListItem[] };
        if (!cancelled) setRooms(data.rooms ?? []);
      } catch {
        /* quiet: the doorway just doesn't render */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const teamRooms = (rooms ?? []).filter(r => roomBelongsToTeam(r, tournamentIds, divisionIds));
  if (teamRooms.length === 0) return null;

  // Lead with the room that spoke last (falls back to list order).
  const lead = [...teamRooms].sort((a, b) =>
    (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''),
  )[0];
  const unread = teamRooms.reduce((total, r) => total + (r.unreadCount || 0), 0);
  const title = lead.contextLabel ? `${lead.contextLabel} · ${lead.room.name}` : lead.room.name;
  const preview = lead.lastMessagePreview
    ?? (lead.readOnly ? 'This conversation has closed.' : 'Open the conversation.');

  return (
    <Link href="/chat" className={styles.door} aria-label={`Team chat — ${title}`}>
      <span className={styles.icon} aria-hidden>
        <MessageCircle size={19} strokeWidth={1.8} />
      </span>
      <span className={styles.info}>
        <span className={styles.kind}>Team chat</span>
        <span className={styles.title}>{title}</span>
        <span className={styles.preview}>{preview}</span>
      </span>
      <span className={styles.end} aria-hidden>
        {unread > 0 && <span className={styles.unread}>{unread > 9 ? '9+' : unread}</span>}
        <ChevronRight size={16} />
      </span>
    </Link>
  );
}
