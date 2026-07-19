'use client';

import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import ChatPanel from '@/components/chat/ChatPanel';
import ChatSafetySheet, { type SheetTarget } from './ChatSafetySheet';
import type { InboxRoom } from './ChatInbox';
import styles from './chat-inbox.module.css';

/** Retract the caller's own message (server enforces ownership). Throws so ChatPanel rolls the bubble back. */
async function requestDeleteOwn(roomId: string, messageId: string): Promise<void> {
  const res = await fetch(`/api/chat/rooms/${roomId}/messages/${messageId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
}

/**
 * A single conversation in the consumer shell — the shared ChatPanel rendered WARM (R3-3), plus the
 * long-press safety sheet (R3-2: Report to organizers + Mute this room). The engine (send/react/poll/
 * pin/history/realtime) is 100% the shared component; only the skin + the safety sheet are consumer-side.
 */
export default function ChatConversation({
  room,
  onBack,
  onMuteChange,
}: {
  room: InboxRoom;
  onBack: () => void;
  onMuteChange?: (muted: boolean) => void;
}) {
  const [sheet, setSheet] = useState<SheetTarget>(null);
  const [muted, setMuted] = useState(room.selfNotifMuted);

  return (
    <div className={styles.conversation}>
      <ChatPanel
        variant="warm"
        roomId={room.roomId}
        roomName={room.roomName}
        unreadCount={room.unreadCount}
        onDeleteOwn={(messageId) => requestDeleteOwn(room.roomId, messageId)}
        onLongPressMessage={(m) => setSheet(m)}
        iconBefore={
          <button type="button" className={styles.backBtn} onClick={onBack} aria-label="Back to your chats">
            <ChevronLeft size={20} aria-hidden />
          </button>
        }
      />
      <ChatSafetySheet
        key={sheet?.id ?? 'none'}
        open={sheet != null}
        target={sheet}
        roomId={room.roomId}
        muted={muted}
        onClose={() => setSheet(null)}
        onMuteChange={(m) => { setMuted(m); onMuteChange?.(m); }}
      />
    </div>
  );
}
