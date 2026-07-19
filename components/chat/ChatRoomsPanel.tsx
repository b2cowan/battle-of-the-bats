'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Lock, Hash, Megaphone } from 'lucide-react';
import { roomDisplayName } from '@/lib/chat-display';
import styles from './ChatRoomsPanel.module.css';

/**
 * Room SWITCHER for organizer Tournament Chat — the LEFT counterpart of ChatManagePanel. Toggled by a
 * "Rooms" button in the chat header. It only chooses + creates rooms (left = WHICH room); managing the
 * open room — members, rename, close, delete — lives in the right "Manage room" panel (right = THIS
 * room). A viewport slide-over PORTALED to <body> (the in-app help-drawer pattern): it floats over the
 * whole screen with a dimming backdrop + body scroll-lock, so it never touches the chat layout (no
 * shift/reflow). ~420px from the left, full-width on narrow screens; pick a room → switch + close.
 * Presentational — the page owns the data + selection.
 */

export type RoomSwitchItem = {
  id: string;
  name: string;
  isArchived: boolean;
  /** null = the default "All coaches" room; a uuid = an organizer-created division room. */
  refSubId: string | null;
  divisionIds: string[];
  memberCount: number;
  pendingCount: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  rooms: RoomSwitchItem[];
  selectedRoomId: string | null;
  /** id → division display name, for a division room's covered-divisions sublabel. */
  divisionName: (id: string) => string | undefined;
  onSelect: (roomId: string) => void;
  onNewRoom: () => void;
};

export default function ChatRoomsPanel({
  open, onClose, rooms, selectedRoomId, divisionName, onSelect, onNewRoom,
}: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // Modal overlay while open: focus in (without scrolling the page), Escape to close, focus trap,
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

  // Default room reads "All coaches" (the tournament is already named in the left nav); division rooms
  // show their organizer-chosen name. Shared rule (roomDisplayName) — same as the inbox + admin header.
  const displayName = (r: RoomSwitchItem) => roomDisplayName(r);
  const scopeLabel = (r: RoomSwitchItem): string | null => {
    if (r.refSubId == null) return null;
    const names = r.divisionIds.map((id) => divisionName(id)).filter(Boolean);
    return names.length > 0 ? names.join(', ') : 'Division room';
  };

  function handleSelect(roomId: string) {
    onSelect(roomId);
    onClose(); // picking a room returns to the conversation
  }

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} role="presentation" />
      <aside
        ref={panelRef}
        id="chat-rooms-panel"
        className={styles.panel}
        aria-label="Chat rooms"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <div className={styles.head}>
          <span className={styles.headTitle}>Rooms</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close rooms panel">
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className={styles.body}>
          <button type="button" className={`btn btn-ghost btn-data ${styles.newBtn}`} onClick={onNewRoom}>
            <Plus size={14} aria-hidden /> New room
          </button>

          <div className={styles.list} role="list">
            {rooms.map((r) => {
              const isActive = r.id === selectedRoomId;
              const isAll = r.refSubId == null;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="listitem"
                  className={`${styles.row}${isActive ? ` ${styles.rowActive}` : ''}`}
                  onClick={() => handleSelect(r.id)}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <span className={styles.rowIcon} aria-hidden>
                    {isAll ? <Megaphone size={14} /> : <Hash size={14} />}
                  </span>
                  <span className={styles.rowMain}>
                    <span className={styles.rowName}>
                      <span className={styles.rowNameText}>{displayName(r)}</span>
                      {r.isArchived && <Lock size={11} aria-hidden className={styles.rowLock} />}
                    </span>
                    <span className={styles.rowSub}>
                      {[
                        scopeLabel(r),
                        `${r.memberCount} ${r.memberCount === 1 ? 'member' : 'members'}`,
                        r.pendingCount > 0 ? `${r.pendingCount} not joined` : null,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </>,
    document.body,
  );
}
