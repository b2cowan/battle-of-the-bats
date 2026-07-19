'use client';

import { useEffect, useRef, useState } from 'react';
import { Flag, Bell, BellOff, Loader2, Check } from 'lucide-react';
import styles from './chat-inbox.module.css';

export type SheetTarget = { id: string; senderName: string; sentAt: string; mine: boolean; deleted: boolean } | null;

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })
  );
}

/**
 * The long-press safety sheet (Unified Home R3-2): "Message · {sender} · {time}" kicker, then Report to
 * organizers (danger row; hidden for your own / already-removed messages) + Mute this room + Cancel.
 * Rendered INLINE inside the warm consumer conversation (so the --home-* tokens resolve) as a fixed
 * overlay. The report lands in the organizers' existing chat Manage-room queue; mute is per-room self-mute.
 */
export default function ChatSafetySheet({
  open,
  target,
  roomId,
  muted,
  onClose,
  onMuteChange,
}: {
  open: boolean;
  target: SheetTarget;
  roomId: string;
  muted: boolean;
  onClose: () => void;
  onMuteChange: (muted: boolean) => void;
}) {
  const [busy, setBusy] = useState<null | 'report' | 'mute'>(null);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  // Transient state (reported/busy/error) resets naturally: the parent keys this component by the target
  // id, and the sheet unmounts (key 'none') whenever it's closed — so every open is a fresh mount.

  // Clear the post-report auto-close timer on unmount, so a stale timer can't yank a LATER sheet closed
  // (the member could dismiss this one and long-press another within the 1.1s window).
  useEffect(() => () => { if (closeTimerRef.current != null) clearTimeout(closeTimerRef.current); }, []);

  // Escape to close + body scroll-lock while open; move focus into the sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || target == null) return null;

  const canReport = !target.mine && !target.deleted;

  async function doReport() {
    if (!target) return;
    setBusy('report');
    setError(null);
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: target.id }),
      });
      if (res.ok) {
        setReported(true);
        closeTimerRef.current = window.setTimeout(onClose, 1100);
      } else {
        setError('Couldn’t send your report. Please try again.');
      }
    } catch {
      setError('Couldn’t send your report. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function doMute() {
    const next = !muted;
    setBusy('mute');
    setError(null);
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/self-mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted: next }),
      });
      if (res.ok) {
        onMuteChange(next);
        onClose();
      } else {
        setError('Couldn’t update this room. Please try again.');
      }
    } catch {
      setError('Couldn’t update this room. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.sheetBackdrop} onClick={onClose} role="presentation">
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Message actions"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.sheetHandle} aria-hidden />
        <div className={styles.sheetKicker}>
          Message · {target.mine ? 'You' : target.senderName} · {timeLabel(target.sentAt)}
        </div>
        {reported ? (
          <div className={styles.sheetDone}>
            <Check size={16} aria-hidden /> Reported to organizers
          </div>
        ) : (
          <>
            {error && <div className={styles.sheetError} role="alert">{error}</div>}
            {canReport && (
              <button
                type="button"
                className={`${styles.sheetRow} ${styles.sheetDanger}`}
                onClick={doReport}
                disabled={busy != null}
              >
                {busy === 'report' ? <Loader2 size={16} className={styles.spin} aria-hidden /> : <Flag size={16} aria-hidden />}
                Report to organizers
              </button>
            )}
            <button type="button" className={styles.sheetRow} onClick={doMute} disabled={busy != null}>
              {busy === 'mute' ? (
                <Loader2 size={16} className={styles.spin} aria-hidden />
              ) : muted ? (
                <Bell size={16} aria-hidden />
              ) : (
                <BellOff size={16} aria-hidden />
              )}
              {muted ? 'Unmute this room' : 'Mute this room'}
            </button>
            <button
              type="button"
              className={`${styles.sheetRow} ${styles.sheetCancel}`}
              onClick={onClose}
              disabled={busy != null}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
