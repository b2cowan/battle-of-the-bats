'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { UserCog, Loader2, ChevronRight, PanelLeft } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import UpgradeGate from '@/components/billing/UpgradeGate';
import ChatPanel from '@/components/chat/ChatPanel';
import ChatManagePanel, { type ChatMember, type ChatPending, type ChatReport } from '@/components/chat/ChatManagePanel';
import { roomDisplayName } from '@/lib/chat-display';
import ChatRoomsPanel from '@/components/chat/ChatRoomsPanel';
import NewRoomDialog, { type DivisionOption } from '@/components/chat/NewRoomDialog';
import s from '../../admin-common.module.css';
import styles from './chat-admin.module.css';

type RoomSummary = {
  id: string;
  name: string;
  isArchived: boolean;
  refSubId: string | null;
  divisionIds: string[];
  memberCount: number;
  pendingCount: number;
  lastMessageAt: string | null;
};

type RoomListResponse = { rooms: RoomSummary[]; divisions: DivisionOption[] };

type RosterResponse = {
  room: { id: string; name: string; isArchived: boolean; refSubId: string | null; divisionIds: string[] };
  members: ChatMember[];
  pending: ChatPending[];
  activeCount: number;
  reports: ChatReport[];
};

/**
 * Organizer chat with DIVISION ROOMS ("channels"). The conversation fills the screen like a messaging
 * app. Two collapsible side panels frame it, each toggled from the chat header: "Rooms" on the LEFT
 * (switch rooms + create/rename/close/delete) and "Members" on the RIGHT (roster + moderation). On
 * desktop they dock as side columns; on mobile each is a slide-over (Rooms is full-screen, WhatsApp-style).
 */
function ChatRoomsManager({ tournamentId, orgParam }: { tournamentId: string; orgParam: string }) {
  const [list, setList] = useState<RoomListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  // The conversation is the default view; Rooms (switch) and Manage room (admin) open on demand as
  // overlays — and only one at a time (opening one closes the other). Close handlers are memoized so
  // each panel's focus-trap effect (deps include onClose) doesn't tear down + re-focus on every parent
  // re-render while it's open (e.g. a mute toggling `busy`).
  const openRooms = () => { setManageOpen(false); setRoomsOpen((o) => !o); };
  const openManage = () => { setRoomsOpen(false); setManageOpen((o) => !o); };
  const closeRooms = useCallback(() => setRoomsOpen(false), []);
  const closeManage = useCallback(() => setManageOpen(false), []);

  // Load the room list; preserve the current selection if it still exists, else fall back to All-coaches.
  const loadList = useCallback(async (): Promise<RoomListResponse | null> => {
    setListError(null);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/chat/rooms?${orgParam}`, { cache: 'no-store' });
      if (!res.ok) {
        setListError(res.status === 403 ? 'You do not have access to chat moderation.' : 'Unable to load chat.');
        return null;
      }
      const data = (await res.json()) as RoomListResponse;
      setList(data);
      setSelectedRoomId((prev) =>
        prev && data.rooms.some((r) => r.id === prev)
          ? prev
          : (data.rooms.find((r) => r.refSubId == null)?.id ?? data.rooms[0]?.id ?? null),
      );
      return data;
    } catch {
      setListError('Unable to load chat.');
      return null;
    }
  }, [tournamentId, orgParam]);

  const fetchRoster = useCallback(async (roomId: string): Promise<RosterResponse | null> => {
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/chat/rooms/${roomId}?${orgParam}`, { cache: 'no-store' });
      if (!res.ok) return null;
      return (await res.json()) as RosterResponse;
    } catch {
      return null; // non-fatal — the chat itself still renders from the summary
    }
  }, [tournamentId, orgParam]);

  useEffect(() => { void loadList(); }, [loadList]);
  // Load the selected room's roster, guarded against out-of-order responses: on a rapid room switch the
  // previous fetch is cancelled so a late reply can't overwrite the current room's roster with a stale one.
  useEffect(() => {
    if (!selectedRoomId) return;
    let cancelled = false;
    void fetchRoster(selectedRoomId).then((data) => { if (!cancelled && data) setRoster(data); });
    return () => { cancelled = true; };
  }, [selectedRoomId, fetchRoster]);

  const selected = useMemo(
    () => list?.rooms.find((r) => r.id === selectedRoomId) ?? null,
    [list, selectedRoomId],
  );
  const divisionNameById = useMemo(
    () => new Map((list?.divisions ?? []).map((d) => [d.id, d.name])),
    [list],
  );
  const divisionName = useCallback((id: string) => divisionNameById.get(id), [divisionNameById]);

  const moderate = useCallback(
    async (body: Record<string, unknown>) => {
      if (!selectedRoomId) return;
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/chat/moderate?${orgParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, roomId: selectedRoomId }),
      });
      if (!res.ok) throw new Error('moderation failed');
    },
    [tournamentId, orgParam, selectedRoomId],
  );

  const handleDelete = useCallback((messageId: string) => moderate({ action: 'delete', messageId }), [moderate]);
  const handlePin = useCallback(
    (messageId: string, pinned: boolean) => moderate({ action: pinned ? 'pin' : 'unpin', messageId }),
    [moderate],
  );

  async function refreshSelected() {
    const rid = selectedRoomId;
    const [, fresh] = await Promise.all([loadList(), rid ? fetchRoster(rid) : Promise.resolve(null)]);
    if (fresh) setRoster(fresh);
  }

  // Shared moderation runner: busy toggle + moderate() + refresh + error surface. Each handler supplies
  // only the action payload and its error message.
  async function runModeration(action: Record<string, unknown>, errorMsg: string) {
    setBusy(true);
    try {
      await moderate(action);
      await refreshSelected();
    } catch {
      setListError(errorMsg);
    } finally {
      setBusy(false);
    }
  }

  function toggleClose(close: boolean) {
    if (close && typeof window !== 'undefined' &&
      !window.confirm('Close this room? Coaches can read it but cannot post until you reopen it.')) {
      return;
    }
    void runModeration({ action: close ? 'close' : 'reopen' }, 'Could not update the room.');
  }

  function toggleMute(member: ChatMember, mute: boolean) {
    void runModeration(
      mute ? { action: 'mute', targetUserId: member.userId, hours: 72 } : { action: 'unmute', targetUserId: member.userId },
      'Could not update the member.',
    );
  }

  // Reported-message queue (R3-2): remove the message (soft-delete; the API also clears its reports) or
  // dismiss the report without touching the message.
  const handleRemoveReported = (messageId: string) =>
    void runModeration({ action: 'delete', messageId }, 'Could not remove the message.');
  const handleDismissReport = (reportId: string) =>
    void runModeration({ action: 'dismiss_report', reportId }, 'Could not update the report.');

  function copyInvite(p: ChatPending) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(`${origin}/coaches/join`);
      setCopied(p.teamId);
      setTimeout(() => setCopied((c) => (c === p.teamId ? null : c)), 2000);
    }
  }

  function handleRename() {
    if (!selected || typeof window === 'undefined') return;
    const next = window.prompt('Rename room', selected.name);
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === selected.name) return;
    void (async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/admin/tournaments/${tournamentId}/chat/rooms/${selected.id}?${orgParam}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!res.ok) throw new Error();
        await refreshSelected();
      } catch {
        setListError('Could not rename the room.');
      } finally {
        setBusy(false);
      }
    })();
  }

  function handleDeleteRoom() {
    if (!selected?.refSubId || typeof window === 'undefined') return;
    if (!window.confirm(`Delete the empty room "${selected.name}"? This can't be undone. The All coaches room is unaffected.`)) return;
    void (async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/admin/tournaments/${tournamentId}/chat/rooms/${selected.id}?${orgParam}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        await loadList(); // selection auto-falls-back to All-coaches (the deleted id is gone)
      } catch {
        setListError('Could not delete the room.');
      } finally {
        setBusy(false);
      }
    })();
  }

  function handleCreate(name: string, divisionIds: string[]) {
    setCreating(true);
    setComposerError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/admin/tournaments/${tournamentId}/chat/rooms?${orgParam}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, divisionIds }),
        });
        const json = (await res.json().catch(() => ({}))) as { roomId?: string; error?: string };
        if (!res.ok) {
          setComposerError(json.error ?? 'Could not create the room.');
          return;
        }
        setComposerOpen(false);
        await loadList();
        if (json.roomId) setSelectedRoomId(json.roomId);
      } catch {
        setComposerError('Could not create the room.');
      } finally {
        setCreating(false);
      }
    })();
  }

  if (list === null && !listError) {
    return <div className={styles.state}><Loader2 size={16} className={styles.spin} aria-hidden /> Loading chat…</div>;
  }
  if (listError || !list) {
    return <div className={styles.state} style={{ color: 'var(--danger)' }}>{listError ?? 'Unable to load chat.'}</div>;
  }

  // Is the loaded roster for the currently-selected room? (Guards against a stale roster from a rapid
  // room switch.) Hoisted once — used by isArchived / openReports and the ChatManagePanel props below.
  const rosterFresh = roster?.room.id === selectedRoomId;
  const isArchived = rosterFresh ? roster!.room.isArchived : (selected?.isArchived ?? false);
  const openReports = rosterFresh ? (roster!.reports?.length ?? 0) : 0;
  const isDivisionRoom = Boolean(selected?.refSubId);
  // Delete protects history: only an empty division room (no messages) can be removed; otherwise close it.
  const isEmptyRoom = (selected?.lastMessageAt ?? null) === null;
  const canDelete = isDivisionRoom && isEmptyRoom;
  const deleteNote = !selected
    ? undefined
    : !isDivisionRoom
      ? 'The All coaches room can be closed but not deleted.'
      : !isEmptyRoom
        ? 'Rooms with messages can be closed but not deleted.'
        : undefined;

  return (
    <>
      <div className={styles.chatLayout}>
        <ChatRoomsPanel
          open={roomsOpen}
          onClose={closeRooms}
          rooms={list.rooms}
          selectedRoomId={selectedRoomId}
          divisionName={divisionName}
          onSelect={setSelectedRoomId}
          onNewRoom={() => { setComposerError(null); setComposerOpen(true); }}
        />
        <div className={styles.chatCol}>
          {selectedRoomId ? (
            <ChatPanel
              key={selectedRoomId}
              roomId={selectedRoomId}
              roomName={selected ? roomDisplayName(selected) : undefined}
              iconBefore={
                <button
                  type="button"
                  className={`btn btn-ghost btn-data ${styles.roomsBtn}`}
                  onClick={openRooms}
                  aria-expanded={roomsOpen}
                  aria-controls="chat-rooms-panel"
                  aria-label="Rooms"
                  title="Rooms"
                >
                  <PanelLeft size={14} aria-hidden />
                  <span className={styles.roomsBtnLabel}>Rooms</span>
                </button>
              }
              onModerateDelete={handleDelete}
              onPin={handlePin}
              headerRight={
                <button
                  type="button"
                  className={`btn btn-ghost btn-data ${styles.manageBtn}`}
                  onClick={openManage}
                  aria-expanded={manageOpen}
                  aria-controls="chat-manage-panel"
                  aria-label="Manage room"
                  title="Manage room"
                >
                  <UserCog size={14} aria-hidden />
                  <span className={styles.manageBtnLabel}>Manage room</span>
                  {openReports > 0 && (
                    <span className={styles.manageReportsBadge} aria-label={`${openReports} reported message${openReports === 1 ? '' : 's'}`}>
                      {openReports > 9 ? '9+' : openReports}
                    </span>
                  )}
                  <ChevronRight size={13} aria-hidden className={styles.manageBtnChevron} />
                </button>
              }
            />
          ) : (
            <div className={styles.state}>Select a room.</div>
          )}
        </div>
        <ChatManagePanel
          open={manageOpen}
          onClose={closeManage}
          members={rosterFresh ? roster!.members : []}
          pending={rosterFresh ? roster!.pending : []}
          reports={rosterFresh ? (roster!.reports ?? []) : []}
          busy={busy}
          onToggleMute={toggleMute}
          onCopyInvite={copyInvite}
          copiedId={copied}
          onRemoveReported={handleRemoveReported}
          onDismissReport={handleDismissReport}
          isArchived={isArchived}
          onToggleClose={toggleClose}
          onRename={isDivisionRoom ? handleRename : undefined}
          onDelete={canDelete ? handleDeleteRoom : undefined}
          deleteNote={deleteNote}
        />
      </div>

      {composerOpen && (
        <NewRoomDialog
          divisions={list.divisions}
          busy={creating}
          error={composerError}
          onCancel={() => setComposerOpen(false)}
          onCreate={handleCreate}
        />
      )}
    </>
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
    <div className={styles.chatPage} data-chat-fullbleed-mobile>
      <UpgradeGate feature="tournament_chat" label="Tournament Chat">
        <ChatRoomsManager tournamentId={tournamentId} orgParam={orgParam} />
      </UpgradeGate>
    </div>
  );
}
