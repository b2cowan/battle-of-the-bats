'use client';
import { useCallback, useEffect, useState } from 'react';
import { Users, Loader2, ChevronRight } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import UpgradeGate from '@/components/billing/UpgradeGate';
import ChatPanel from '@/components/chat/ChatPanel';
import ChatManagePanel, { type ChatMember, type ChatPending } from '@/components/chat/ChatManagePanel';
import s from '../../admin-common.module.css';
import styles from './chat-admin.module.css';

type RosterResponse = {
  room: { id: string; name: string; isArchived: boolean };
  members: ChatMember[];
  pending: ChatPending[];
  activeCount: number;
};

/**
 * Full-screen organizer chat: the conversation fills the screen like a messaging app; the roster
 * (Members + "Not yet joined") and room controls live behind the "Manage" button in the chat header
 * (a slide-over on mobile, a docked side panel on desktop).
 */
function ChatModeration({ tournamentId, orgParam }: { tournamentId: string; orgParam: string }) {
  const [data, setData] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/chat?${orgParam}`, { cache: 'no-store' });
      if (!res.ok) {
        setError(res.status === 403 ? 'You do not have access to chat moderation.' : 'Unable to load chat.');
        return;
      }
      setData(await res.json());
    } catch {
      setError('Unable to load chat.');
    } finally {
      setLoading(false);
    }
  }, [tournamentId, orgParam]);

  useEffect(() => { void load(); }, [load]);

  const moderate = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/chat/moderate?${orgParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('moderation failed');
    },
    [tournamentId, orgParam],
  );

  const handleDelete = useCallback((messageId: string) => moderate({ action: 'delete', messageId }), [moderate]);
  const handlePin = useCallback(
    (messageId: string, pinned: boolean) => moderate({ action: pinned ? 'pin' : 'unpin', messageId }),
    [moderate],
  );
  // Stable identity so the manage panel's focus-trap effect doesn't re-fire on every moderation
  // re-render (mute/close flip `busy` + refetch `data`), which would bounce focus repeatedly.
  const handleManageClose = useCallback(() => setManageOpen(false), []);

  async function toggleClose(close: boolean) {
    setBusy(true);
    try {
      await moderate({ action: close ? 'close' : 'reopen' });
      await load();
    } catch {
      setError('Could not update the room.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleMute(member: ChatMember, mute: boolean) {
    setBusy(true);
    try {
      await moderate(mute ? { action: 'mute', targetUserId: member.userId, hours: 72 } : { action: 'unmute', targetUserId: member.userId });
      await load();
    } catch {
      setError('Could not update the member.');
    } finally {
      setBusy(false);
    }
  }

  function copyInvite(p: ChatPending) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(`${origin}/coaches/join`);
      setCopied(p.teamId);
      setTimeout(() => setCopied((c) => (c === p.teamId ? null : c)), 2000);
    }
  }

  if (loading) {
    return <div className={styles.state}><Loader2 size={16} className={styles.spin} aria-hidden /> Loading chat…</div>;
  }
  if (error || !data) {
    return <div className={styles.state} style={{ color: 'var(--danger)' }}>{error ?? 'Unable to load chat.'}</div>;
  }

  return (
    <div className={`${styles.chatLayout}${manageOpen ? ` ${styles.chatLayoutOpen}` : ''}`}>
      <div className={styles.chatCol}>
        <ChatPanel
          roomId={data.room.id}
          roomName={data.room.name}
          onModerateDelete={handleDelete}
          onPin={handlePin}
          headerRight={
            <button
              type="button"
              className={`btn btn-ghost btn-data ${styles.manageBtn}`}
              onClick={() => setManageOpen((o) => !o)}
              aria-expanded={manageOpen}
              aria-controls="chat-manage-panel"
              aria-label={`Members${data.members.length ? `, ${data.members.length}` : ''}`}
              title="Members"
            >
              <Users size={14} aria-hidden />
              <span className={styles.manageBtnLabel}>
                Members{data.members.length ? ` (${data.members.length})` : ''}
              </span>
              {data.members.length ? <span className={styles.manageBtnCount}>{data.members.length}</span> : null}
              <ChevronRight size={13} aria-hidden className={styles.manageBtnChevron} />
            </button>
          }
        />
      </div>
      <ChatManagePanel
        open={manageOpen}
        onClose={handleManageClose}
        isArchived={data.room.isArchived}
        members={data.members}
        pending={data.pending}
        busy={busy}
        onToggleClose={toggleClose}
        onToggleMute={toggleMute}
        onCopyInvite={copyInvite}
        copiedId={copied}
      />
    </div>
  );
}

export default function AdminTournamentChatPage() {
  const { currentTournament } = useTournament();
  const { currentOrg } = useOrg();
  usePageTitle('Chat');
  const orgSlug = currentOrg?.slug;
  const orgParam = orgSlug ? `orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const tournamentId = currentTournament?.id;

  if (!tournamentId) {
    return (
      <div className={s.page ?? ''} style={{ padding: '2rem' }}>
        <p style={{ color: 'var(--white-40)' }}>Select a tournament to manage its chat.</p>
      </div>
    );
  }

  return (
    <div className={styles.chatPage}>
      <UpgradeGate feature="tournament_chat" label="Tournament Chat">
        <ChatModeration tournamentId={tournamentId} orgParam={orgParam} />
      </UpgradeGate>
    </div>
  );
}
