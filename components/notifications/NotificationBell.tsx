'use client';
import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import { Bell, BellDot } from 'lucide-react';
import { useNotificationUnread } from '@/lib/use-notification-unread';
import styles from './notifications.module.css';

// The bell is on every admin and coach page; its drawer (the list, the message block, the window floor)
// renders only after a click, so it loads then — as the help drawer does.
const NotificationDrawer = dynamic(() => import('./NotificationDrawer'), { ssr: false });

interface Props {
  orgId: string;
  /** Which portal's strip this bell sits in — the drawer names pages in that portal's words. */
  portal: 'admin' | 'coach';
  /** Notification settings — the gear in the drawer's head. */
  settingsHref?: string;
  /** When an ancestor owns the count (the admin shell hoists it once for the strip's bell + the phone
   *  More badge), pass it in — the bell then skips its own fetch + Realtime channel. Omit elsewhere
   *  (the coach shell) to keep the count self-contained. */
  count?: number;
  onCountChange?: Dispatch<SetStateAction<number>>;
}

const IGNORE_COUNT = () => {};

/**
 * The top strip's bell (both portals; the strip exists only above 900px, so the bell does too). A
 * click opens the drawer (`NotificationDrawer`, Notifications Open in Place step 2, 2026-10-06), which
 * owns the rest: its boundary (the bell's wrapper and itself), Escape, focus and the count it hands
 * back up as it reads, finishes and deletes.
 */
export default function NotificationBell({ orgId, portal, settingsHref, count, onCountChange }: Props) {
  // Skip the internal fetch+Realtime when an ancestor provides the count (avoids a duplicate subscription).
  const internal = useNotificationUnread(count === undefined ? orgId : null);
  const unreadCount = count ?? internal.count;
  // When the count is externally owned, updates go to the ancestor's setter (never internal.setCount,
  // whose state nothing reads in that mode); a no-op if the ancestor didn't supply one.
  const setUnreadCount = count === undefined ? internal.setCount : (onCountChange ?? IGNORE_COUNT);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  const hasUnread = unreadCount > 0;
  const badgeText = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <div ref={wrapRef} className={styles.bellWrap}>
      <button
        type="button"
        className={`${styles.bellBtn} ${hasUnread ? styles.hasUnread : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={hasUnread ? `${unreadCount} unread notifications` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Notifications"
      >
        {hasUnread ? <BellDot size={16} /> : <Bell size={16} />}
        {hasUnread && (
          <span className={styles.badge} aria-hidden="true">
            {badgeText}
          </span>
        )}
      </button>

      {open && (
        <NotificationDrawer
          /* One organization per drawer: a new org is a new list, never the old one's rows or Undo. */
          key={orgId}
          orgId={orgId}
          portal={portal}
          settingsHref={settingsHref}
          bellRef={wrapRef}
          onClose={close}
          onUnreadChange={setUnreadCount}
        />
      )}
    </div>
  );
}
