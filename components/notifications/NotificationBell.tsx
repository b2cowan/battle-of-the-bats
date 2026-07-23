'use client';
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Bell, BellDot } from 'lucide-react';
import { useNotificationUnread } from '@/lib/use-notification-unread';
import NotificationPanel from './NotificationPanel';
import styles from './notifications.module.css';

interface Props {
  orgId: string;
  /** When provided, the panel shows a subtle "Notification settings" link in its footer. */
  settingsHref?: string;
  /** When provided, the panel footer shows a "See all" link to the full notifications page. */
  seeAllHref?: string;
  /** When an ancestor owns the count (the admin shell hoists it once for the sidebar bell + the mobile
   *  badge), pass it in — the bell then skips its own fetch + Realtime channel. Omit elsewhere (coach
   *  shell, public) to keep the count self-contained. */
  count?: number;
  onCountChange?: Dispatch<SetStateAction<number>>;
}

export default function NotificationBell({ orgId, settingsHref, seeAllHref, count, onCountChange }: Props) {
  // Skip the internal fetch+Realtime when an ancestor provides the count (avoids a duplicate subscription).
  const internal = useNotificationUnread(count === undefined ? orgId : null);
  const unreadCount = count ?? internal.count;
  // When the count is externally owned, updates go to the ancestor's setter (never internal.setCount,
  // whose state nothing reads in that mode); a no-op if the ancestor didn't supply one.
  const setUnreadCount = count === undefined ? internal.setCount : (onCountChange ?? (() => {}));
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // ── Click outside to close ────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!target) return;
      // Bell button / wrapper
      if (wrapRef.current && wrapRef.current.contains(target)) return;
      // Panel is portaled to <body>, so it's outside wrapRef — check it explicitly
      if (target.closest('[data-notification-panel]')) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  // ── Render ────────────────────────────────────────────────────────────────

  const hasUnread = unreadCount > 0;
  const badgeText = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <div ref={wrapRef} className={styles.bellWrap}>
      <button
        className={`${styles.bellBtn} ${hasUnread ? styles.hasUnread : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={hasUnread ? `${unreadCount} unread notifications` : 'Notifications'}
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
        <NotificationPanel
          orgId={orgId}
          onClose={() => setOpen(false)}
          onUnreadChange={setUnreadCount}
          settingsHref={settingsHref}
          seeAllHref={seeAllHref}
        />
      )}
    </div>
  );
}
