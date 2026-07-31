'use client';
import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Bell, BellDot } from 'lucide-react';
import { useNotificationUnread } from '@/lib/use-notification-unread';
import NotificationPanel from './NotificationPanel';
import { useDismissable } from '@/lib/overlay-hooks';
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
  /** Anchor for the (portaled, fixed) panel — must match where this bell is mounted:
   *  default 'sidebar' (the classic left-rail anchor); 'topStrip' when the bell lives in
   *  the Stage C operator top strip (drops from the top-right corner instead). */
  panelPlacement?: 'sidebar' | 'topStrip';
}

export default function NotificationBell({ orgId, settingsHref, seeAllHref, count, onCountChange, panelPlacement }: Props) {
  // Skip the internal fetch+Realtime when an ancestor provides the count (avoids a duplicate subscription).
  const internal = useNotificationUnread(count === undefined ? orgId : null);
  const unreadCount = count ?? internal.count;
  // When the count is externally owned, updates go to the ancestor's setter (never internal.setCount,
  // whose state nothing reads in that mode); a no-op if the ancestor didn't supply one.
  const setUnreadCount = count === undefined ? internal.setCount : (onCountChange ?? (() => {}));
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Click outside to close ────────────────────────────────────────────────

  // Two boundaries, not one: the panel is portaled to <body>, so it is NOT inside `wrapRef`.
  // The hand-rolled version expressed that with a `closest('[data-notification-panel]')` lookup;
  // a real ref on the panel says the same thing without a global selector query. Also gains
  // Escape-to-close, which the bell never had — and it renders on nearly every screen.
  useDismissable(open, [wrapRef, panelRef], () => setOpen(false));

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
          panelRef={panelRef}
          onClose={() => setOpen(false)}
          onUnreadChange={setUnreadCount}
          settingsHref={settingsHref}
          seeAllHref={seeAllHref}
          placement={panelPlacement}
        />
      )}
    </div>
  );
}
