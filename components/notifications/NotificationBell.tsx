'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Bell, BellDot } from 'lucide-react';
import { createClient } from '@/lib/supabase-browser';
import NotificationPanel from './NotificationPanel';
import styles from './notifications.module.css';

interface Props {
  orgId: string;
}

export default function NotificationBell({ orgId }: Props) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [open,        setOpen]        = useState(false);
  const [userId,      setUserId]      = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // ── Initial unread count ───────────────────────────────────────────────────

  const fetchUnread = useCallback(async () => {
    if (!orgId) return;
    try {
      const res  = await fetch(`/api/notifications?orgId=${orgId}&unreadOnly=true&limit=1`);
      const data = await res.json();
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // silent — don't crash the sidebar
    }
  }, [orgId]);

  // ── Get user ID for Realtime filter ───────────────────────────────────────

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (orgId) fetchUnread();
  }, [orgId, fetchUnread]);

  // ── Supabase Realtime — live badge update on new notification ─────────────

  useEffect(() => {
    if (!userId || !orgId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`notifications:${userId}:${orgId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Only count if it's for this org
          if ((payload.new as any)?.org_id === orgId) {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, orgId]);

  // ── Click outside to close ────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
        />
      )}
    </div>
  );
}
