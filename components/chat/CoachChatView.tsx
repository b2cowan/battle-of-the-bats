'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare, ChevronLeft, Loader2, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { teamColor, teamInitials } from '@/lib/team-color';
import { divisionScopeLabel } from '@/lib/chat-display';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { useHelpDrawer } from '@/components/help/help-drawer-context';
import ChatPanel from './ChatPanel';
import styles from './CoachChatView.module.css';

/**
 * Coach-facing chat surface for the PREMIUM (org-based) coach portal. The free portal's Chat section
 * was retired in A2 — that route now redirects to the global consumer Chat tab — so this component
 * has a single consumer, and its empty state is written to the premium onboarding family.
 * Self-sizing full-height host — fills the portal content area so the conversation reads like a real
 * messaging app. Portal-agnostic: lists every chat room the signed-in coach belongs to (per-user,
 * not per-team) via /api/chat/rooms, then opens the shared ChatPanel for the selected room.
 * Master-detail: a single room auto-opens; with several, the header carries a "Rooms" switcher back
 * to the list.
 *
 * Project 2A (approved spec, artifact 50a9d5aa v2): the list now also carries the coach's team STAFF
 * room(s) — pinned first with a STAFF tag — so the heading reads "Your chats", not "Your tournament
 * chats". The head coach (room moderator) gets pin + remove-message wired to the member-authorized
 * routes; a staff of one sees an invite nudge instead of an empty room.
 */

type RoomListItem = {
  room: { id: string; name: string; isArchived: boolean };
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  isModerator: boolean;
  selfMutedUntil: string | null;
  readOnly: boolean;
  /** the tournament this room belongs to — shown when the room name doesn't already carry it (e.g. a
   *  division room like "Championship"), so several rooms in one event stay easy to tell apart. */
  contextLabel: string | null;
  /** F2: divisions this room covers. null = the All-coaches room (nothing to disambiguate);
   *  [] = division-scoped but those divisions were since deleted. */
  divisionNames?: string[] | null;
  // ── Staff rooms (Project 2A) ──────────────────────────────────────────────
  isStaffRoom?: boolean;
  staffTeamId?: string | null;
  staffOrgSlug?: string | null;
  staffMemberCount?: number | null;
};

/**
 * F2: the small line under a room's name.
 *
 * This switcher is a FLAT list spanning every tournament the coach is in — unlike the consumer
 * inbox, which groups under an event heading. So the divisions are ADDED to the tournament name
 * here, never substituted for it: two concurrent events can each have a "Championship" room
 * covering a "U11", and dropping the event name would make them indistinguishable (their avatars
 * derive from the room name too, so there'd be no other tell).
 *
 * Staff rooms carry the fixed "Your coaching staff" line instead (approved mockup 1).
 */
function roomSubLabel(r: RoomListItem): string | null {
  if (r.isStaffRoom) return 'Your coaching staff';
  const divisions = divisionScopeLabel(r.divisionNames);
  const event = r.contextLabel && !r.room.name.startsWith(r.contextLabel) ? r.contextLabel : null;
  return [divisions, event].filter(Boolean).join(' · ') || null;
}

/** Retract the caller's own message (server enforces ownership). Throws on failure so ChatPanel's
 *  optimistic delete rolls the bubble back. (Named distinctly from the server-only chat-service
 *  helper of similar purpose to avoid confusion across the client/server boundary.) */
async function requestDeleteOwnMessage(roomId: string, messageId: string): Promise<void> {
  const res = await fetch(`/api/chat/rooms/${roomId}/messages/${messageId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
}

/** Pin/unpin as the staff room's own moderator (head coach) — the member-authorized pinned route. */
async function requestPin(roomId: string, messageId: string, pinned: boolean): Promise<void> {
  const res = await fetch(`/api/chat/rooms/${roomId}/pinned`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId, pinned }),
  });
  if (!res.ok) throw new Error('Pin failed');
}

export default function CoachChatView() {
  const [rooms, setRooms] = useState<RoomListItem[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // On desktop (≥1024px) the room list is a PERSISTENT sidebar, so the "Rooms" back control is
  // redundant there — only render it on mobile (full-swap list↔conversation). Default false (mobile)
  // for SSR; corrected on mount so it's never shown on a desktop pane.
  const [isDesktop, setIsDesktop] = useState(false);
  const pathname = usePathname();
  const { openHelp } = useHelpDrawer();

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/chat/rooms', { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) setError('Unable to load your chats right now.');
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const list: RoomListItem[] = data.rooms ?? [];
        setRooms(list);
        if (list.length === 1) setSelected(list[0].room.id);
      } catch {
        if (!cancelled) setError('Unable to load your chats right now.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  let content: ReactNode;

  if (error) {
    content = <div className={styles.empty}>{error}</div>;
  } else if (rooms === null) {
    content = (
      <div className={styles.empty}>
        <Loader2 size={18} className={styles.spin} aria-hidden /> Loading your chats…
      </div>
    );
  } else if (rooms.length === 0) {
    // With staff rooms auto-created for every entitled premium team, a premium coach should no
    // longer land here (the list is never empty) — this remains only for the edge where the team's
    // entitlement is not live. Copy unchanged: the honest action is still the tournament path.
    const tournamentsPath = pathname.replace(/\/chat$/, '/tournaments');
    content = (
      <div className={styles.empty}>
        {/* Phase B teaching contract: what it is · what it unlocks · what's blocking it. A coach
            cannot open a room themselves — only the organizer can — so the one action offered is
            the honest one (find the tournament), never a "start a chat" that would 403. */}
        <CoachEmptyState
          icon={<MessageSquare size={22} aria-hidden />}
          eyebrow="Chat"
          headline="No tournament chats yet"
          description="Tournament chat is your direct line to the organizer while an event is on — schedule changes, field moves, and weather calls, without a phone tree."
          payoff="Every coach in the event shares the room, so one organizer message reaches all of you at once, and replies and mentions follow your notification settings to your phone."
          blocker="Only the organizer can open a chat, and only for a tournament your team is entered in — so there's nothing here until then."
          primaryAction={{ label: 'View your tournaments', href: tournamentsPath }}
          secondaryAction={{
            label: 'How tournament chat works',
            onClick: () => openHelp({ module: 'coaches', sectionIds: ['recipe-tournament-chat'], label: 'Tournament chat' }),
          }}
        />
      </div>
    );
  } else {
    const selectedRoom = rooms.find((r) => r.room.id === selected) ?? null;
    const multi = rooms.length > 1;

    const roomList = (
      <div className={styles.sidebar} aria-label="Your chats">
        <p className={styles.sidebarHead}>Your chats</p>
        {rooms.map((r) => {
          const active = r.room.id === selected;
          return (
            <button
              key={r.room.id}
              type="button"
              className={`${styles.roomRow}${active ? ` ${styles.roomRowActive}` : ''}${r.isStaffRoom ? ` ${styles.roomRowStaff}` : ''}`}
              onClick={() => setSelected(r.room.id)}
              aria-current={active ? 'true' : undefined}
            >
              <div className={styles.roomIcon} style={{ background: teamColor(r.room.name) }} aria-hidden>
                {teamInitials(r.room.name)}
              </div>
              <div className={styles.roomMain}>
                <span className={styles.roomName}>
                  {r.room.name}
                  {r.isStaffRoom && <span className={styles.staffTag}>Staff</span>}
                  {r.readOnly && <span className={styles.roTag}>Closed</span>}
                </span>
                {roomSubLabel(r) && (
                  <span className={`${styles.roomContext}${r.isStaffRoom ? ` ${styles.roomContextStaff}` : ''}`}>
                    {roomSubLabel(r)}
                  </span>
                )}
                <span className={styles.roomPreview}>{r.lastMessagePreview ?? 'No messages yet'}</span>
              </div>
              {r.unreadCount > 0 && (
                <span className={styles.unread} aria-label={`${r.unreadCount > 9 ? '9+' : r.unreadCount} unread`}>
                  <span aria-hidden>{r.unreadCount > 9 ? '9+' : r.unreadCount}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    );

    // Project 2A: a staff of one gets a reason to come back, not an empty box. The invite lives on
    // the Staff page (the existing assistant-invite flow) — chat only points at it. HEAD COACH only
    // (review fix): a solo assistant (departed head, nobody promoted) would hit "Only the head
    // coach manages staff" — never offer a CTA that dead-ends. Link parts are null-guarded:
    // without both slugs the nudge still renders, minus the CTA.
    const soloStaff =
      selectedRoom?.isStaffRoom && selectedRoom.isModerator &&
      selectedRoom.staffMemberCount === 1 && !selectedRoom.readOnly;
    const staffHref =
      selectedRoom?.staffOrgSlug && selectedRoom.staffTeamId
        ? `/${selectedRoom.staffOrgSlug}/coaches/teams/${selectedRoom.staffTeamId}/staff`
        : null;
    const nudge = soloStaff ? (
      <div className={styles.staffNudge}>
        <Users size={16} aria-hidden className={styles.staffNudgeIcon} />
        <div className={styles.staffNudgeMain}>
          <strong>It’s just you in here so far</strong>
          <p>
            Staff chat comes alive when your assistants join. Invites live on your Staff page — each
            assistant you add gets a seat here automatically.
          </p>
          {staffHref && (
            <Link href={staffHref} className={styles.staffNudgeBtn}>
              <UserPlus size={14} aria-hidden /> Invite an assistant
            </Link>
          )}
        </div>
      </div>
    ) : null;

    const detail = (
      <div className={styles.detail}>
        {selectedRoom ? (
          <div className={styles.panelWrap}>
            <ChatPanel
              roomId={selectedRoom.room.id}
              roomName={selectedRoom.room.name}
              roomSubtitle={roomSubLabel(selectedRoom)}
              unreadCount={selectedRoom.unreadCount}
              onDeleteOwn={(messageId) => requestDeleteOwnMessage(selectedRoom.room.id, messageId)}
              // Head coach = the staff room's moderator: pin + remove-any-message ride the
              // member-authorized routes (staff rooms have no admin surface). Tournament rooms
              // never wire these here — organizer moderation stays on the admin surface.
              onModerateDelete={
                selectedRoom.isStaffRoom && selectedRoom.isModerator
                  ? (messageId) => requestDeleteOwnMessage(selectedRoom.room.id, messageId)
                  : undefined
              }
              onPin={
                selectedRoom.isStaffRoom && selectedRoom.isModerator
                  ? (messageId, pinned) => requestPin(selectedRoom.room.id, messageId, pinned)
                  : undefined
              }
              topBanner={nudge}
              iconBefore={<MessageSquare size={14} aria-hidden />}
              headerRight={
                multi && !isDesktop ? (
                  <button
                    type="button"
                    className={styles.backBtn}
                    onClick={() => setSelected(null)}
                    aria-label="Back to your chats"
                  >
                    <ChevronLeft size={18} aria-hidden /> <span className={styles.backBtnLabel}>Rooms</span>
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className={styles.pickPrompt}>
            <MessageSquare size={30} aria-hidden className={styles.pickIcon} />
            <p>Select a conversation</p>
          </div>
        )}
      </div>
    );

    // Single room → just the conversation. Multiple → master/detail: a full-swap on mobile,
    // a persistent room list beside the conversation on desktop (CSS drives the difference).
    content = multi ? (
      <div className={`${styles.split}${selectedRoom ? ` ${styles.hasSelection}` : ''}`}>
        {roomList}
        {detail}
      </div>
    ) : (
      detail
    );
  }

  return <div className={styles.host}>{content}</div>;
}
