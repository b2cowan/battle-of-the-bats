import { MessageCircle } from 'lucide-react';
import styles from './chat.module.css';

/** One still-running tournament a coach's team is in (from /api/consumer/chat/inbox when the inbox is empty). */
export type CoachChatEvent = {
  tournamentId: string;
  tournamentName: string;
  hostName: string | null;
  /** The host's plan includes tournament chat, so a room can still come once the organizer opens it. */
  chatOffered: boolean;
};

/**
 * The Chat tab for a coach with no conversations yet (owner, 2026-10-13, on an accepted coach's empty tab).
 * The fan pitch told them "Chat opens up once you're on a team's staff" — false for a coach — and never
 * said what they were waiting for. A tournament's room exists only once its organizer opens their Chat
 * screen, so each event whose host offers chat is named with that sentence; an event whose host has no
 * chat is never promised one, and the fan pitch's sales doors stay out of a coach's way.
 */
export default function CoachChatWaiting({ events, bare = false }: {
  events: CoachChatEvent[];
  /** The card alone, for a host page that wears its own frame and title — the free Coaches Portal's Chat
   *  (Free coach header parity, /design 2026-10-14: inside the portal it takes the portal's section header,
   *  not the fan app's page title). */
  bare?: boolean;
}) {
  const offered = events.filter(e => e.chatOffered);
  const card = (
    <div className={styles.waitCard}>
      {offered.length > 0 ? offered.map(e => (
        <div key={e.tournamentId} className={styles.waitRow}>
          <MessageCircle size={18} strokeWidth={1.9} aria-hidden className={styles.waitIcon} />
          <div>
            <span className={styles.waitName}>{e.tournamentName}</span>
            <span className={styles.waitText}>
              {e.hostName ?? 'The organizer'} hasn&rsquo;t opened chat yet. It appears here when they do,
              with every team&rsquo;s coaches.
            </span>
          </div>
        </div>
      )) : (
        <p className={styles.waitNone}>None of your teams&rsquo; tournaments has a chat.</p>
      )}
    </div>
  );
  if (bare) return card;
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Chat</h1>
        <p className={styles.sub}>
          Team and tournament conversations — organizers and coaches, all in one place.
        </p>
      </div>
      {card}
    </div>
  );
}
