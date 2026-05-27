'use client';
import { useEffect, useState, useCallback } from 'react';
import { CheckCheck, BellOff } from 'lucide-react';
import type { AppNotification } from '@/lib/types';
import styles from './notifications.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

const EVENT_ICONS: Record<string, string> = {
  registration_new:                  '📋',
  registration_status_changed:       '🔄',
  payment_received:                  '💳',
  payment_failed:                    '⚠️',
  roster_change_requested:           '👥',
  score_submitted:                   '🏆',
  score_disputed:                    '🚩',
  registration_deadline_approaching: '⏰',
  waitlist_opened:                   '🎉',
  coach_access_requested:            '🔑',
  house_league_registration_new:     '📋',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)   return 'just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  onClose: () => void;
  onUnreadChange: (count: number) => void;
}

export default function NotificationPanel({ orgId, onClose, onUnreadChange }: Props) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [markingAll,    setMarkingAll]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/notifications?orgId=${orgId}&limit=30`);
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      onUnreadChange(data.unreadCount ?? 0);
    } catch {
      // silent — bell count is still valid from the parent
    } finally {
      setLoading(false);
    }
  }, [orgId, onUnreadChange]);

  useEffect(() => { load(); }, [load]);

  async function handleMarkRead(notification: AppNotification) {
    if (notification.readAt) return; // already read

    // Optimistic update
    setNotifications(prev =>
      prev.map(n => n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)
    );
    onUnreadChange(notifications.filter(n => !n.readAt && n.id !== notification.id).length);

    await fetch('/api/notifications', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'mark-read', id: notification.id }),
    }).catch(console.error);

    // Navigate if there's a link
    if (notification.link) {
      onClose();
      window.location.href = notification.link;
    }
  }

  async function handleMarkAllRead() {
    if (markingAll) return;
    setMarkingAll(true);
    const now = new Date().toISOString();
    setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? now })));
    onUnreadChange(0);

    await fetch('/api/notifications', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'mark-all-read', orgId }),
    }).catch(console.error);

    setMarkingAll(false);
  }

  const unreadCount = notifications.filter(n => !n.readAt).length;

  return (
    <div className={styles.panel} role="dialog" aria-label="Notifications">
      <div className={styles.panelHeader}>
        <p className={styles.panelTitle}>Notifications</p>
        {unreadCount > 0 && (
          <button
            className={styles.markAllBtn}
            onClick={handleMarkAllRead}
            disabled={markingAll}
            title="Mark all as read"
          >
            <CheckCheck size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Mark all read
          </button>
        )}
      </div>

      <div className={styles.notifList}>
        {loading ? (
          <p className={styles.loadingRow}>Loading…</p>
        ) : notifications.length === 0 ? (
          <div className={styles.emptyState}>
            <BellOff size={28} className={styles.emptyIcon} />
            <span>You&apos;re all caught up</span>
          </div>
        ) : (
          notifications.map(n => {
            const isUnread = !n.readAt;
            const icon     = EVENT_ICONS[n.eventType] ?? '🔔';
            return (
              <div
                key={n.id}
                className={`${styles.notifItem} ${isUnread ? styles.unread : styles.notifRead}`}
                onClick={() => handleMarkRead(n)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && handleMarkRead(n)}
              >
                <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{icon}</span>
                <div className={styles.notifContent}>
                  <p className={styles.notifTitle}>{n.title}</p>
                  {n.body && <p className={styles.notifBody}>{n.body}</p>}
                  <p className={styles.notifTime}>{relativeTime(n.createdAt)}</p>
                </div>
                {isUnread && <span className={styles.notifDot} aria-label="Unread" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
