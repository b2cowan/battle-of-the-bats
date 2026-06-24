'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, VolumeX, Volume2, Copy, Check, Mail, UserCog, Pencil, Lock, Unlock, Trash2 } from 'lucide-react';
import { teamColor, teamInitials } from '@/lib/team-color';
import styles from './ChatManagePanel.module.css';

/**
 * "Manage room" drawer for organizer Tournament Chat — everything about the OPEN room in one place:
 * the roster (Members + "Not yet joined"), per-member moderation (mute), and the room settings
 * (rename / close / delete). The left "Rooms" panel only switches/creates rooms; this panel manages
 * the one that's open. A viewport slide-over PORTALED to <body> (the in-app help-drawer pattern): it
 * floats over the whole screen with a dimming backdrop + body scroll-lock, so it never touches the
 * chat layout. ~420px from the right, full-width on narrow screens. Presentational — the page owns the
 * data + handlers.
 */

export type ChatMember = {
  userId: string;
  name: string;
  email: string | null;
  role: 'member' | 'moderator';
  status: string;
  mutedUntil: string | null;
  lastReadAt: string | null;
};

export type ChatPending = {
  teamId: string;
  teamName: string;
  coachName: string | null;
  email: string | null;
};

function lastSeenLabel(iso: string | null): string {
  if (!iso) return 'Not yet';
  const d = new Date(iso);
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
}
function mutedUntilLabel(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}
function isMuted(m: ChatMember): boolean {
  return Boolean(m.mutedUntil && new Date(m.mutedUntil) > new Date());
}
function inviteMailto(email: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const body = `Sign in to the coaches portal to join our tournament chat: ${origin}/coaches/join`;
  return `mailto:${email}?subject=${encodeURIComponent('Join the tournament chat')}&body=${encodeURIComponent(body)}`;
}

type Props = {
  open: boolean;
  onClose: () => void;
  members: ChatMember[];
  pending: ChatPending[];
  busy: boolean;
  onToggleMute: (member: ChatMember, mute: boolean) => void;
  onCopyInvite: (p: ChatPending) => void;
  copiedId: string | null;
  // ── Room settings (the open room) ──
  isArchived: boolean;
  onToggleClose: (close: boolean) => void;
  /** Rename — only provided for division rooms (the All-coaches room is fixed). */
  onRename?: () => void;
  /** Delete — only provided when allowed (an empty division room). */
  onDelete?: () => void;
  /** Why delete is unavailable, shown when onDelete is absent (e.g. All-coaches room / has messages). */
  deleteNote?: string;
};

export default function ChatManagePanel({
  open, onClose, members, pending, busy, onToggleMute, onCopyInvite, copiedId,
  isArchived, onToggleClose, onRename, onDelete, deleteNote,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const mutedCount = members.filter(isMuted).length;

  // Dialog behaviour while open: focus in (without scrolling the page), Escape to close, focus trap,
  // restore focus on close. (No body scroll-lock — the backdrop covers the chat, and on the mobile
  // admin layout the scroll container is the content area, not <body>, so locking the body does
  // nothing useful here and can shift the mobile viewport.)
  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    panelRef.current?.focus({ preventScroll: true });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      prevFocusRef.current?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} role="presentation" />
      <aside
        ref={panelRef}
        id="chat-manage-panel"
        className={styles.panel}
        aria-label="Manage room"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <div className={styles.head}>
          <span className={styles.headTitle}><UserCog size={15} aria-hidden /> Manage room</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close manage panel">
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className={styles.body}>
          {/* Members */}
          <div className={styles.block}>
            <div className={styles.blockHead}>
              Members <span className={styles.count}>{members.length}{mutedCount > 0 ? ` · ${mutedCount} muted` : ''}</span>
            </div>
            {members.length === 0 ? (
              <p className={styles.empty}>No coaches have joined yet.</p>
            ) : (
              members.map((m) => {
                const muted = isMuted(m);
                return (
                  <div key={m.userId} className={styles.row}>
                    <span className={styles.avatar} style={{ background: teamColor(m.userId) }} aria-hidden>
                      {teamInitials(m.name)}
                    </span>
                    <div className={styles.rowMain}>
                      <div className={styles.rowName}>
                        {m.name}
                        {m.role === 'moderator' && <span className={styles.tagOrg}>Organizer</span>}
                        {muted && <span className={styles.tagMuted}>Muted · until {mutedUntilLabel(m.mutedUntil)}</span>}
                      </div>
                      <div className={styles.rowSub}>{m.email ?? '—'}</div>
                      <div className={styles.rowLastSeen}>Last seen {lastSeenLabel(m.lastReadAt)}</div>
                    </div>
                    {m.role !== 'moderator' && (
                      muted ? (
                        <button type="button" className="btn btn-ghost btn-data" onClick={() => onToggleMute(m, false)} disabled={busy}>
                          <Volume2 size={13} aria-hidden /> Unmute
                        </button>
                      ) : (
                        <button type="button" className="btn btn-ghost btn-data" onClick={() => onToggleMute(m, true)} disabled={busy}>
                          <VolumeX size={13} aria-hidden /> Mute (72 h)
                        </button>
                      )
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Not yet joined */}
          <div className={styles.block}>
            <div className={styles.blockHead}>
              Not yet joined <span className={styles.count}>{pending.length}</span>
            </div>
            {pending.length === 0 ? (
              <p className={styles.empty}>Every team&apos;s coach has a login — nobody is missing.</p>
            ) : (
              <>
                <p className={styles.note}>
                  These coaches haven&apos;t signed in yet. They join automatically once they sign in with their team&apos;s email — share the coach sign-up link to bring them in.
                </p>
                {pending.map((p) => (
                  <div key={p.teamId} className={styles.row}>
                    <span className={`${styles.avatar} ${styles.avatarPending}`} style={{ background: teamColor(p.teamId) }} aria-hidden>
                      {teamInitials(p.coachName || p.teamName)}
                    </span>
                    <div className={styles.rowMain}>
                      <div className={styles.rowName}>{p.coachName || p.teamName}</div>
                      <div className={styles.rowSub}>{p.teamName}{p.email ? ` · ${p.email}` : ''}</div>
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={`btn btn-ghost btn-data ${styles.iconAction}${copiedId === p.teamId ? ` ${styles.iconActionDone}` : ''}`}
                        onClick={() => onCopyInvite(p)}
                        aria-label={copiedId === p.teamId ? 'Sign-up link copied' : 'Copy sign-up link'}
                        title={copiedId === p.teamId ? 'Copied' : 'Copy sign-up link'}
                      >
                        {copiedId === p.teamId ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
                      </button>
                      {p.email && (
                        <a
                          className={`btn btn-ghost btn-data ${styles.iconAction}`}
                          href={inviteMailto(p.email)}
                          aria-label={`Email ${p.coachName || p.teamName}`}
                          title="Email this coach"
                        >
                          <Mail size={15} aria-hidden />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Room settings — for the open room; pushed to the bottom, away from the open gesture. */}
          <div className={styles.roomSettings}>
            <span className={styles.settingsLabel}>Room settings</span>
            {isArchived && (
              <p className={styles.note}>This room is <strong>closed</strong> — coaches can read it but cannot post.</p>
            )}
            {onRename && (
              <button type="button" className="btn btn-ghost btn-data" onClick={onRename} disabled={busy}>
                <Pencil size={14} aria-hidden /> Rename room
              </button>
            )}
            <button
              type="button"
              className={isArchived ? 'btn btn-ghost btn-data' : 'btn btn-danger btn-data'}
              onClick={() => onToggleClose(!isArchived)}
              disabled={busy}
            >
              {isArchived ? <><Unlock size={14} aria-hidden /> Reopen room</> : <><Lock size={14} aria-hidden /> Close room</>}
            </button>
            {onDelete ? (
              <button type="button" className="btn btn-danger btn-data" onClick={onDelete} disabled={busy}>
                <Trash2 size={14} aria-hidden /> Delete room
              </button>
            ) : (
              deleteNote && <p className={styles.note}>{deleteNote}</p>
            )}
          </div>
        </div>
      </aside>
    </>,
    document.body,
  );
}
