'use client';
/**
 * TOURNAMENT CHAT, THE ORGANIZER'S — Tournament admin redesign Stage 5 (E11, A57, A60; F14), built to hub v45, ruled
 * as drawn 2026-10-10.
 *
 *   title band   "Chat", Manage room (a boxed icon on a phone, an outlined button at a desk: it opens the room's
 *                panel) and the bare "?" — the page had no title (F14)
 *   the room     chosen by the olive pill on a phone ("All coaches ▾ · 22 coaches", opening today's Rooms sheet), a
 *                docked column at a desk (the chosen room on the olive wash, New room at its foot)
 *   the talk     the conversation and its composer, unchanged in what they do
 *   asking       close, rename, delete and a name already taken ask in the product's windows — the browser's own
 *                confirm and prompt boxes went
 *   free plan    the full-page Tournament Plus wall, as today (A60: the free tournament tier review decides it)
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PortalKitRoot } from '@/components/admin/AdminKitProvider';
import { ChevronDown, Plus, UserCog } from 'lucide-react';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { Callout, repKit } from '@/components/admin/kit/club/RepKit';
import { TextField } from '@/components/admin/kit/club/money/MoneyKit';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import UpgradeGate from '@/components/billing/UpgradeGate';
import ChatPanel from '@/components/chat/ChatPanel';
import ChatManagePanel, { type ChatMember, type ChatPending, type ChatReport } from '@/components/chat/ChatManagePanel';
import { roomDisplayName } from '@/lib/chat-display';
import ChatRoomsPanel from '@/components/chat/ChatRoomsPanel';
import NewRoomDialog, { type DivisionOption } from '@/components/chat/NewRoomDialog';
import { CHAT_WORDS as W } from '@/lib/tournament-chat-words';
import styles from './chat-admin.module.css';
import LoadingState from '@/components/shared/LoadingState';

/** Chat's "?" (A56): the tournament chat topic. */
const CHAT_HELP: HelpRequest = { module: 'tournaments', sectionIds: ['tournament-chat'] };

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

/** A question this page asks in its own window (never the browser's box). */
type Ask =
  | { kind: 'close' }
  | { kind: 'delete' }
  | { kind: 'rename'; name: string; warned: boolean }
  | { kind: 'taken'; name: string; divisionIds: string[] };

function ChatRoomsManager({ tournamentId, orgParam }: { tournamentId: string; orgParam: string }) {
  const [list, setList] = useState<RoomListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  // Rooms (the phone's sheet) and Manage room open one at a time. Close handlers are memoized so each panel's
  // focus-trap effect (deps include onClose) doesn't tear down and re-focus on every parent re-render.
  const openRooms = () => { setManageOpen(false); setRoomsOpen((o) => !o); };
  const openManage = () => { setRoomsOpen(false); setManageOpen((o) => !o); };
  const closeRooms = useCallback(() => setRoomsOpen(false), []);
  const closeManage = useCallback(() => setManageOpen(false), []);

  // Load the room list; keep the current selection if it still exists, else fall back to All coaches.
  const loadList = useCallback(async (): Promise<RoomListResponse | null> => {
    setListError(null);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/chat/rooms?${orgParam}`, { cache: 'no-store' });
      if (!res.ok) {
        setListError(res.status === 403 ? W.noAccess : W.loadFailed);
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
      setListError(W.loadFailed);
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

  // eslint-disable-next-line react-hooks/set-state-in-effect -- the page reads its rooms
  useEffect(() => { void loadList(); }, [loadList]);
  // The selected room's roster, guarded against out-of-order replies on a rapid room switch.
  useEffect(() => {
    if (!selectedRoomId) return;
    let cancelled = false;
    void fetchRoster(selectedRoomId).then((data) => { if (!cancelled && data) setRoster(data); });
    return () => { cancelled = true; };
  }, [selectedRoomId, fetchRoster]);

  const selected = useMemo(() => list?.rooms.find((r) => r.id === selectedRoomId) ?? null, [list, selectedRoomId]);
  const divisionNameById = useMemo(() => new Map((list?.divisions ?? []).map((d) => [d.id, d.name])), [list]);
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

  // One moderation runner: busy, the action, a re-read, a failure said in the page.
  async function runModeration(action: Record<string, unknown>, errorMsg: string): Promise<boolean> {
    setBusy(true);
    setActionError(null);
    try {
      await moderate(action);
      await refreshSelected();
      return true;
    } catch {
      setActionError(errorMsg);
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** An ask opened from Manage room: the panel steps aside first (it sits above every window). */
  const askFromPanel = (a: Ask) => { setManageOpen(false); setAsk(a); };

  function toggleClose(close: boolean) {
    if (close) { askFromPanel({ kind: 'close' }); return; }
    void runModeration({ action: 'reopen' }, W.updateFailed);
  }

  function toggleMute(member: ChatMember, mute: boolean) {
    void runModeration(
      mute ? { action: 'mute', targetUserId: member.userId, hours: 72 } : { action: 'unmute', targetUserId: member.userId },
      W.memberFailed,
    );
  }

  // Reported-message queue (R3-2): remove the message (soft-delete; the API also clears its reports) or dismiss.
  const handleRemoveReported = (messageId: string) => void runModeration({ action: 'delete', messageId }, W.removeFailed);
  const handleDismissReport = (reportId: string) => void runModeration({ action: 'dismiss_report', reportId }, W.reportFailed);

  function copyInvite(p: ChatPending) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(`${origin}/coaches/join`);
      setCopied(p.teamId);
      setTimeout(() => setCopied((c) => (c === p.teamId ? null : c)), 2000);
    }
  }

  /**
   * F5 (owner-ratified 2026-07-29) — WARN, never block, when a room name is already taken in this tournament: two
   * identically-named rooms are indistinguishable to a coach. Compares DISPLAY names (the All coaches room is stored as
   * "{Tournament} — Coaches"), case- and space-insensitive, excluding the room being renamed. Fails open before the
   * list has loaded.
   */
  function nameTaken(name: string, excludeRoomId?: string): boolean {
    const key = name.trim().toLowerCase();
    return (list?.rooms ?? []).some((r) => r.id !== excludeRoomId && roomDisplayName(r).trim().toLowerCase() === key);
  }

  async function doRename(name: string) {
    if (!selected) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/chat/rooms/${selected.id}?${orgParam}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      setAsk(null);
      await refreshSelected();
    } catch {
      setActionError(W.renameFailed);
    } finally {
      setBusy(false);
    }
  }

  async function doDeleteRoom() {
    if (!selected?.refSubId) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/chat/rooms/${selected.id}?${orgParam}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setAsk(null);
      await loadList(); // the selection falls back to All coaches (the deleted id is gone)
    } catch {
      setActionError(W.deleteFailed);
    } finally {
      setBusy(false);
    }
  }

  function createRoom(name: string, divisionIds: string[]) {
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
          setComposerError(json.error ?? W.createFailed);
          return;
        }
        setComposerOpen(false);
        await loadList();
        if (json.roomId) setSelectedRoomId(json.roomId);
      } catch {
        setComposerError(W.createFailed);
      } finally {
        setCreating(false);
      }
    })();
  }
  // A name already in use asks first; declining leaves the composer open with the typed name.
  function handleCreate(name: string, divisionIds: string[]) {
    if (nameTaken(name)) { setAsk({ kind: 'taken', name: name.trim(), divisionIds }); return; }
    createRoom(name, divisionIds);
  }

  const rosterFresh = roster?.room.id === selectedRoomId;
  const isArchived = rosterFresh ? roster!.room.isArchived : (selected?.isArchived ?? false);
  const openReports = rosterFresh ? (roster!.reports?.length ?? 0) : 0;
  const isDivisionRoom = Boolean(selected?.refSubId);
  // Delete protects history: only an empty division room can be removed; otherwise close it.
  const isEmptyRoom = (selected?.lastMessageAt ?? null) === null;
  const canDelete = isDivisionRoom && isEmptyRoom;
  const deleteNote = !selected
    ? undefined
    : !isDivisionRoom
      ? 'The All coaches room can be closed but not deleted.'
      : !isEmptyRoom
        ? 'Rooms with messages can be closed but not deleted.'
        : undefined;
  const roomLine = (r: RoomSummary) => (r.refSubId == null
    ? W.allCoachesLine
    : r.divisionIds.map((id) => divisionName(id)).filter(Boolean).join(', ') || W.divisionRoom);

  const manageButton = (
    <button
      type="button"
      className={`btn btn-outline btn-data ${screenParts.headerButton}`}
      onClick={openManage}
      disabled={!selectedRoomId}
      aria-expanded={manageOpen}
      aria-controls="chat-manage-panel"
      aria-label={openReports > 0 ? `${W.manage}, ${W.reported(openReports)}` : W.manage}
      title={W.manage}
    >
      <UserCog size={15} aria-hidden />
      <span className={screenParts.headerButtonLabel}>{W.manage}</span>
      {openReports > 0 && <span className={styles.manageReportsBadge} aria-hidden>{openReports > 9 ? '9+' : openReports}</span>}
    </button>
  );
  const header = (
    <div className={styles.head}>
      <AdminPageHeader
        title={W.title}
        inlineActions
        actions={<>{list && manageButton}<HelpButton help={CHAT_HELP} label={W.title} iconOnly /></>}
      />
    </div>
  );

  if (list === null && !listError) {
    return <>{header}<LoadingState label={W.loading} /></>;
  }
  if (!list) {
    return <>{header}<div className={styles.state} role="alert">{listError ?? W.loadFailed}</div></>;
  }

  return (
    <>
      {header}
      {(actionError || listError) && (
        <div className={styles.notice}><Callout tone="bad" role="alert" flush>{actionError ?? listError}</Callout></div>
      )}

      {/* A phone: the room is the olive pill, with its coaches beside it; it opens today's Rooms sheet. */}
      {selected && (
        <div className={styles.pillRow}>
          <button type="button" className={styles.pill} onClick={openRooms} aria-haspopup="dialog" aria-expanded={roomsOpen}
            aria-controls="chat-rooms-panel">
            <span className={styles.pillName}>{roomDisplayName(selected)}</span>
            <ChevronDown size={15} aria-hidden />
          </button>
          <span className={styles.pillCount}>{W.coaches(selected.memberCount)}</span>
        </div>
      )}

      <div className={styles.chatLayout}>
        {/* A desk: the rooms docked, the chosen one on the olive wash, New room at the foot. */}
        <nav className={styles.dock} aria-label={W.rooms}>
          <div className={styles.dockBand}>{W.rooms} <span className={styles.dockCount}>{list.rooms.length}</span></div>
          <ul className={styles.dockList}>
            {list.rooms.map((r) => (
              <li key={r.id}>
                <button type="button" className={styles.dockRow} aria-current={r.id === selectedRoomId ? 'true' : undefined}
                  onClick={() => setSelectedRoomId(r.id)}>
                  <span className={styles.dockName}>{roomDisplayName(r)}</span>
                  <span className={styles.dockSub}>
                    {[W.coaches(r.memberCount), r.pendingCount > 0 ? W.notJoined(r.pendingCount) : null].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className={styles.dockNew} onClick={() => { setComposerError(null); setComposerOpen(true); }}>
            <Plus size={15} aria-hidden /> {W.newRoom}
          </button>
        </nav>

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
              roomSubtitle={selected ? roomLine(selected) : undefined}
              onModerateDelete={handleDelete}
              onPin={handlePin}
            />
          ) : (
            <div className={styles.state}>{W.selectRoom}</div>
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
          onRename={isDivisionRoom && selected ? () => askFromPanel({ kind: 'rename', name: selected.name, warned: false }) : undefined}
          onDelete={canDelete ? () => askFromPanel({ kind: 'delete' }) : undefined}
          deleteNote={deleteNote}
        />
      </div>

      <TopLayer>
      {composerOpen && (
        <NewRoomDialog
          divisions={list.divisions}
          busy={creating}
          error={composerError}
          onCancel={() => setComposerOpen(false)}
          onCreate={handleCreate}
        />
      )}

      {ask?.kind === 'close' && selected && (
        <KitDialog kind="question" raised title={W.closeTitle(roomDisplayName(selected))} onClose={() => { if (!busy) setAsk(null); }} busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsk(null)} disabled={busy}>{W.keep}</button>
              <button type="button" className="btn btn-danger" disabled={busy}
                onClick={() => void runModeration({ action: 'close' }, W.updateFailed).then(ok => { if (ok) setAsk(null); })}>
                {W.closeAction}
              </button>
            </>
          )}>
          <p>{W.closeBody}</p>
        </KitDialog>
      )}

      {ask?.kind === 'delete' && selected && (
        <KitDialog kind="question" raised title={W.deleteTitle(selected.name)} onClose={() => { if (!busy) setAsk(null); }} busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsk(null)} disabled={busy}>{W.keep}</button>
              <button type="button" className="btn btn-danger" onClick={() => void doDeleteRoom()} disabled={busy}>{W.deleteAction}</button>
            </>
          )}>
          <p>{W.deleteBody}</p>
        </KitDialog>
      )}

      {ask?.kind === 'rename' && selected && (() => {
        const trimmed = ask.name.trim();
        const taken = trimmed !== '' && trimmed !== selected.name && nameTaken(trimmed, selected.id);
        const submit = () => {
          if (!trimmed || trimmed === selected.name) { setAsk(null); return; }
          if (taken && !ask.warned) { setAsk({ ...ask, warned: true }); return; }
          void doRename(trimmed);
        };
        return (
          <KitDialog kind="form" raised title={W.renameTitle} identity={roomDisplayName(selected)} onClose={() => { if (!busy) setAsk(null); }} busy={busy}
            footer={(
              <>
                <button type="button" className="btn btn-outline" onClick={() => setAsk(null)} disabled={busy}>{W.cancel}</button>
                <button type="button" className="btn btn-lime" onClick={submit} disabled={busy || !trimmed}>
                  {taken && ask.warned ? W.renameAnyway : W.rename}
                </button>
              </>
            )}>
            <TextField id="chat-room-name" label={W.roomName} value={ask.name} maxLength={80}
              onChange={v => setAsk({ kind: 'rename', name: v, warned: false })} />
            {taken && ask.warned && <p className={styles.taken} role="alert">{W.takenTitle(trimmed)}. {W.takenBody}</p>}
          </KitDialog>
        );
      })()}

      {ask?.kind === 'taken' && (
        <KitDialog kind="question" raised title={W.takenTitle(ask.name)} onClose={() => setAsk(null)}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsk(null)}>{W.cancel}</button>
              <button type="button" className="btn btn-lime" onClick={() => { const a = ask; setAsk(null); createRoom(a.name, a.divisionIds); }}>
                {W.createAnyway}
              </button>
            </>
          )}>
          <p>{W.takenBody}</p>
        </KitDialog>
      )}
      </TopLayer>
    </>
  );
}

/** The chat's windows, at the page's top layer (with the admin kit's marker): never under the Manage panel or, on a
 *  phone, under the bars the pinned chat sits between. */
function TopLayer({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(<PortalKitRoot>{children}</PortalKitRoot>, document.body);
}

export default function AdminTournamentChatPage() {
  const { currentTournament, loading: tournamentLoading } = useTournament();
  const { currentOrg } = useOrg();
  usePageTitle('Chat');
  const orgSlug = currentOrg?.slug;
  const orgParam = orgSlug ? `orgSlug=${encodeURIComponent(orgSlug)}` : '';
  const tournamentId = currentTournament?.id;

  // A phone pins the chat between the bars: it starts where the event header ENDS, measured (the header grew past
  // the old fixed 48px top and covered the chat's top, its title band included).
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = pageRef.current;
    const banner = document.querySelector<HTMLElement>('header[role="banner"]');
    if (!el || !banner) return;
    const apply = () => el.style.setProperty('--chat-top', `${Math.max(0, Math.round(banner.getBoundingClientRect().bottom))}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(banner);
    window.addEventListener('resize', apply);
    return () => { observer.disconnect(); window.removeEventListener('resize', apply); };
  }, [tournamentId]);

  if (!tournamentId) {
    // The tournament itself still loading is a wait, not "no tournament" (the room list's own words).
    return <div className={repKit.page}>{tournamentLoading ? <LoadingState label={W.loading} /> : <p className={styles.quiet}>{W.noTournament}</p>}</div>;
  }

  return (
    <div ref={pageRef} className={styles.chatPage} data-chat-fullbleed-mobile>
      <UpgradeGate feature="tournament_chat" label="Tournament Chat">
        <ChatRoomsManager tournamentId={tournamentId} orgParam={orgParam} />
      </UpgradeGate>
    </div>
  );
}
