'use client';

import { useEffect, useRef } from 'react';
import { X, Lock, Unlock, VolumeX, Volume2, Copy, Mail, Users } from 'lucide-react';
import { teamColor, teamInitials } from '@/lib/team-color';
import styles from './ChatManagePanel.module.css';

/**
 * Organizer moderation drawer for Tournament Chat — the roster (Members + "Not yet joined") and the
 * room controls (mute / close), pulled OFF the main chat screen so the conversation can fill it like
 * a real messaging app. Renders as an accessible slide-over on mobile and docks beside the chat on
 * desktop (one `open` state drives both; CSS handles the difference). Always mounted (so the desktop
 * dock animates its width rather than snapping the chat column); `inert` + transforms hide it when
 * closed. Presentational — the page owns the data + handlers.
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
  isArchived: boolean;
  members: ChatMember[];
  pending: ChatPending[];
  busy: boolean;
  onToggleClose: (close: boolean) => void;
  onToggleMute: (member: ChatMember, mute: boolean) => void;
  onCopyInvite: (p: ChatPending) => void;
  copiedId: string | null;
};

export default function ChatManagePanel({
  open, onClose, isArchived, members, pending, busy, onToggleClose, onToggleMute, onCopyInvite, copiedId,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const mutedCount = members.filter(isMuted).length;

  // Dialog behaviour while open: focus in, Escape to close, focus trap, restore focus on close.
  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    panelRef.current?.focus();
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
      prevFocusRef.current?.focus();
    };
  }, [open, onClose]);

  function handleToggleClose() {
    if (!isArchived && typeof window !== 'undefined' &&
      !window.confirm('Close this conversation? Coaches will be able to read it but not post until you reopen it.')) {
      return;
    }
    onToggleClose(!isArchived);
  }

  return (
    <>
      <div
        className={`${styles.backdrop}${open ? ` ${styles.backdropOpen}` : ''}`}
        onClick={onClose}
        role="presentation"
      />
      <aside
        ref={panelRef}
        id="chat-manage-panel"
        className={`${styles.panel}${open ? ` ${styles.panelOpen}` : ''}`}
        aria-label="Chat management"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        inert={open ? undefined : true}
      >
        <div className={styles.head}>
          <span className={styles.headTitle}><Users size={15} aria-hidden /> Manage chat</span>
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
                      <button type="button" className="btn btn-ghost btn-data" onClick={() => onCopyInvite(p)}>
                        <Copy size={13} aria-hidden /> {copiedId === p.teamId ? 'Copied' : 'Link'}
                      </button>
                      {p.email && (
                        <a className="btn btn-ghost btn-data" href={inviteMailto(p.email)} aria-label={`Email ${p.coachName || p.teamName}`}>
                          <Mail size={13} aria-hidden /> Email
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Room control — danger zone, kept away from the open gesture at the top. */}
          <div className={styles.dangerZone}>
            <span className={styles.dangerLabel}>Room control</span>
            {isArchived && (
              <p className={styles.note}>This conversation is <strong>closed</strong> — coaches can read it but cannot post.</p>
            )}
            <button
              type="button"
              className={isArchived ? 'btn btn-ghost btn-data' : 'btn btn-danger btn-data'}
              onClick={handleToggleClose}
              disabled={busy}
            >
              {isArchived ? <><Unlock size={14} aria-hidden /> Reopen room</> : <><Lock size={14} aria-hidden /> Close room</>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
