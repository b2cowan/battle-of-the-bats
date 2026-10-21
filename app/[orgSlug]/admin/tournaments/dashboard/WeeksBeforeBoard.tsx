'use client';
/**
 * THE WEEKS BEFORE GAME DAY — Tournament admin redesign Stage 5 (E2; F81, F55), built to hub v45
 * (https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM, Stage 5 tab), ruled 2026-10-10. An Active event before its
 * game day (and after its dates, before it is marked complete — the page puts the right note above it).
 *
 *   [Your event is 21 days away. Tell your teams what to expect.  Message teams ›]   ← the page's note (Stage 1's)
 *   Registration   11 of 16 spots · 2 this week      a row per division, the whole row a door to Teams for it
 *   Payments       $3,300 of $6,600                  the TRUE sentence (F81): fees set but nobody due yet, or not
 *                                                    set up — "payments aren't tracked here", never "free" (F92)
 *   Coaches        0 of 15 signed up                 the sign-up reminder beside its row (one tap, then it rests)
 *   Messages                                         Communications' door
 *   Schedule                                         the schedule's door — the demo tour's schedule-health anchor
 *   Customize this board                             drag to reorder, hide or bring back a card (unchanged)
 *
 * Each panel became a kit section card: its title inside at 16px sentence case, its one figure on the head row, then ONE
 * row per thing that needs you. The figures strip went (each figure is on its own card; the days are the note's), and
 * so did the gauges, the mono capitals and the two 17px links a panel carried.
 */
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { ChevronRight, GripVertical, Plus, X } from 'lucide-react';
import { ClubRow, ClubRowList, ClubSection, RowAction } from '@/components/admin/kit/club/RepKit';
import kit from '@/components/admin/kit/AdminKitFrame.module.css';
import { WEEKS_BEFORE_WORDS as W, feeLine, feeState, type BoardFees } from '@/lib/tournament-board-words';
import { formatStoredDate } from '@/lib/timezone';
import { CHAT_PAUSED } from '@/lib/chat-pause';
import { BoardNote } from './GameDayBoard';
import { INVITE_BOARD_WORDS, teamsAndPools } from '@/lib/invite-only-words';
import { GAME_DAY_WORDS } from '@/lib/game-day-words';
import { REGISTRATION_HEALTH_WORDS } from '@/lib/registration-words';
import type { RegistrationHealthView } from '@/lib/registration-health';
import dash from './dashboard.module.css';
import styles from './WeeksBeforeBoard.module.css';

export type PanelId = 'registration' | 'payment' | 'communications' | 'tournamentChat' | 'scheduleHealth';
export type PanelConfig = { id: PanelId; label: string; visible: boolean; order: number };

type DivisionStat = { id: string; name: string; capacity: number | null; accepted: number; pending: number; waitlist: number; pools?: number };

/** The cards an invite-only event never shows (screen 4): no payments are tracked, and Tournament Chat is hidden (R5). */
const NOT_ON_INVITE_ONLY: ReadonlySet<PanelId> = new Set<PanelId>(['payment', 'tournamentChat']);
type FollowUp = { key: string; count: number; label: string; plusOnly?: boolean };
type ChatAdoption = {
  eligible: boolean;
  roomOpen: boolean;
  teamsTotal: number;
  teamsWithEmail: number;
  coachesSignedUp: number;
  notJoined: number;
  notJoinedRemindable: number;
  upsellCopy: string | null;
  reminderLastSentAt: string | null;
  reminderRetired: boolean;
};

/**
 * The chat reminder stands down for 24h per tournament (S1-A, owner 2026-07-29). Must match REMINDER_COOLDOWN_MS in
 * the send route — the server is authoritative; this only decides whether the button is offered.
 */
const CHAT_REMIND_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/* The minute clock for the reminder's countdown — an external store at module scope (stable identities), quantized to
   the minute so React's snapshot compares equal; 0 on the server reads as "still cooling down", the safe default. */
function subscribeToMinuteTick(onChange: () => void): () => void {
  const id = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(id);
}
const getMinuteNow = () => Math.floor(Date.now() / 60_000) * 60_000;
const getMinuteNowServer = () => 0;

/** A card in Customize: its grip and its remove, over the card (the card itself is inert while customizing). */
function SortableCard({ id, label, onRemove, children }: { id: PanelId; label: string; onRemove: () => void; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 100 : 1, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className={`${dash.panelSortable} ${isDragging ? dash.cardDragging : ''}`}>
      <div className={dash.panelEditControls}>
        <button type="button" className={dash.panelGrip} {...attributes} {...listeners} aria-label="Drag to reorder"><GripVertical size={14} /></button>
        <button type="button" className={dash.panelRemove} onClick={onRemove} aria-label={`Remove ${label} card`}><X size={14} /></button>
      </div>
      {children}
    </div>
  );
}

/** Customize's "Add card" tile, with the hidden cards to bring back. */
function AddCard({ items, open, onToggle, onAdd }: {
  items: Array<{ id: PanelId; label: string }>;
  open: boolean;
  onToggle: () => void;
  onAdd: (id: PanelId) => void;
}) {
  return (
    <div className={`${dash.addTile} ${dash.addTilePanel}`}>
      <button type="button" className={dash.addTileBtn} onClick={onToggle} aria-expanded={open}>
        <Plus size={20} />
        <span className={dash.addTileLabel}>Add card</span>
      </button>
      {open && (
        <div className={dash.addMenu}>
          {items.map(it => (
            <button key={it.id} type="button" className={dash.addMenuRow} onClick={() => onAdd(it.id)}>
              <span className={dash.addMenuRowTop}>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WeeksBeforeBoard({
  base, daysUntil, tournamentId, orgQuery, subscriptionHref, paymentTools, inviteOnly,
  reg, followUps, pay, fees, chat, chatSettled, onRetryChat, canRemind, comms, health, onOpenHealth, regHealth, onOpenRegHealth,
  teams, divisions, panels, customizing, onReorder, onHide, onShow,
}: {
  /** An invite-only event (the free tournament tier, screen 4): the Registration card is the Teams card, and the Payments
   *  and Coaches cards are absent. */
  inviteOnly: boolean;
  /** `/{org}/admin/tournaments` */
  base: string;
  /** Days until it starts, while it is still ahead (the note); null after its dates. */
  daysUntil: number | null;
  tournamentId: string;
  orgQuery: string;
  subscriptionHref: string;
  /** The plan includes the payment tools (a locked follow-up opens the plan instead). */
  paymentTools: boolean;
  reg: { totalCapacity: number; totalAccepted: number; byDivision: DivisionStat[]; velocity: number };
  followUps: FollowUp[];
  pay: { hasFeeSchedule: boolean; totalExpected: number; totalCollected: number; counts: { paid: number; depositPaid: number; pending: number; pastDue: number } };
  fees: BoardFees;
  chat: ChatAdoption | null;
  /** This event's read has landed (a Try again re-read is not in flight). */
  chatSettled: boolean;
  onRetryChat: () => void;
  /** This member may send the sign-up reminder (the send route's own guard). */
  canRemind: boolean;
  comms: { total: number; emailsSent: number; latestTitle: string | null; latestDate: string | null };
  health: { tone: 'good' | 'warning' | 'danger'; issueCount: number; topIssue: string | null; totalGames: number; timedGames: number };
  /** Opens Schedule health's window — the one the Schedule's header button opens (owner 2026-10-19, A5). */
  onOpenHealth: () => void;
  /** Registration health, scored by the route with the Teams page's own call; null until a read lands. */
  regHealth: RegistrationHealthView | null;
  /** Opens Registration health's window — the one the Teams header button opens (owner 2026-10-21). */
  onOpenRegHealth: () => void;
  teams: number;
  divisions: number;
  /** Every card, in the organizer's order, with whether it is shown. */
  panels: PanelConfig[];
  customizing: boolean;
  onReorder: (activeId: PanelId, overId: PanelId) => void;
  onHide: (id: PanelId) => void;
  onShow: (id: PanelId) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [adding, setAdding] = useState(false);
  // The reminder: in flight, and what the last send said (this board is keyed to its event, so both are this event's).
  const [sending, setSending] = useState(false);
  const [remind, setRemind] = useState<{ message: string; failed: boolean; sentAt: string | null } | null>(null);
  const nowMs = useSyncExternalStore(subscribeToMinuteTick, getMinuteNow, getMinuteNowServer);

  async function sendReminders() {
    if (sending) return;
    setSending(true);
    setRemind(null);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/chat/remind-signups${orgQuery}`, { method: 'POST' });
      const data = await res.json().catch(() => null) as
        { sent?: number; failed?: number; userMessage?: string; cooldown?: boolean; reminderLastSentAt?: string | null } | null;
      if (!res.ok) {
        // Only the server's "safe to show a person" channel; a raw driver error or a bare "Forbidden" gets the generic line.
        const safe = typeof data?.userMessage === 'string' ? data.userMessage.trim() : '';
        setRemind({ message: safe || 'Couldn’t send reminders. Please try again.', failed: true, sentAt: data?.cooldown ? data.reminderLastSentAt ?? null : null });
        return;
      }
      const sent = data?.sent ?? 0;
      const failed = data?.failed ?? 0;
      setRemind({
        message: sent === 0 && failed === 0
          ? 'No teams to remind right now.'
          : `Reminder sent to ${sent} team${sent !== 1 ? 's' : ''}${failed ? ` · ${failed} couldn’t be sent` : ''}.`,
        failed: failed > 0,
        sentAt: data?.reminderLastSentAt ?? null,
      });
    } catch {
      setRemind({ message: 'Couldn’t send reminders. Please try again.', failed: true, sentAt: null });
    } finally {
      setSending(false);
    }
  }

  // ── The five cards ──────────────────────────────────────────────────────────────────────────────────────────
  /** An invite-only event's Teams card (screen 4): who is in each division, and its pools. No count beside the title —
   *  the rows already say it — and no registration follow-ups: nobody registers. */
  function teamsCard() {
    return (
      <ClubSection list title={INVITE_BOARD_WORDS.teamsCard}>
        <ClubRowList inset label={INVITE_BOARD_WORDS.teamsCard}>
          {reg.byDivision.length === 0 ? (
            <ClubRow as="link" href={`${base}/divisions`} title={W.noDivisions} caption={W.noDivisionsLine} chevron />
          ) : reg.byDivision.map(d => (
            <ClubRow
              key={d.id}
              as="link"
              href={`${base}/registrations?division=${encodeURIComponent(d.id)}`}
              title={d.name}
              caption={teamsAndPools(d.accepted, d.pools ?? 0)}
              // A team still waiting (R2, M10) keeps the amber pill.
              trail={d.pending > 0 ? <span className={kit.count} aria-hidden>{d.pending}</span> : undefined}
              chevron
            />
          ))}
        </ClubRowList>
      </ClubSection>
    );
  }

  function registrationCard() {
    const capacity = reg.totalCapacity > 0
      ? reg.totalCapacity
      : reg.byDivision.reduce((n, d) => n + (d.capacity != null && d.capacity > 0 ? d.capacity : 0), 0);
    return (
      <ClubSection list title={W.registration} meta={W.regFigure(reg.totalAccepted, capacity, reg.velocity)}>
        <ClubRowList inset label={W.registration}>
          {/* Registration health — the card's first row, across every division; it opens the Teams button's own window
              (owner 2026-10-21). The score is the title's lead, with its scale ("78" alone can read as 78 teams). */}
          {regHealth?.metrics.hasTeams && regHealth.metrics.tone !== 'neutral' && (
            <ClubRow
              as="button"
              onClick={onOpenRegHealth}
              aria-haspopup="dialog"
              aria-label={REGISTRATION_HEALTH_WORDS.buttonLabel(regHealth.metrics.score, regHealth.metrics.issues.length)}
              title={<><span className={styles.regHealthScore} data-tone={regHealth.metrics.tone}>{regHealth.metrics.score}<small>/100</small></span>{REGISTRATION_HEALTH_WORDS.title}</>}
              caption={GAME_DAY_WORDS.healthCaption(regHealth.metrics.tone, regHealth.metrics.issues.length)}
              chevron
            />
          )}
          {reg.byDivision.length === 0 ? (
            <ClubRow as="link" href={`${base}/divisions`} title={W.noDivisions} caption={W.noDivisionsLine} chevron />
          ) : reg.byDivision.map(d => {
            const caption = W.divisionLine(d);
            return (
              <ClubRow
                key={d.id}
                as="link"
                href={`${base}/registrations?division=${encodeURIComponent(d.id)}`}
                title={d.name}
                caption={caption}
                // A waiting count is the rail's amber pill (owner 2026-10-01), never words appended to a name.
                trail={d.pending > 0 ? <span className={kit.count} aria-hidden>{d.pending}</span> : undefined}
                aria-label={[d.name, caption, d.pending > 0 ? W.waiting(d.pending) : ''].filter(Boolean).join(', ')}
                chevron
              />
            );
          })}
          {followUps.map(b => {
            const locked = Boolean(b.plusOnly && !paymentTools);
            return (
              <ClubRow
                key={b.key}
                as="link"
                // A locked follow-up asks for Tournament Plus's panel, so it opens over the board (PlanPanelHost).
                href={locked ? `${subscriptionHref}?plan=tournament_plus` : `${base}/registrations?attention=${b.key}`}
                // The bucket's full name in a sentence ("13 past due", "10 missing intake") — its chip word ("Missing") is a tag's.
                title={`${b.count} ${b.label.toLowerCase()}`}
                chevron
              />
            );
          })}
        </ClubRowList>
      </ClubSection>
    );
  }

  function paymentsCard() {
    const state = feeState(fees);
    const feesHref = `${base}/settings/event?section=fees`;
    let row: ReactNode;
    if (state === 'notSet' || state === 'notTracked') {
      // F81 / F55: no fees set up is said as it is, and the row opens Event settings' Fees & Payments.
      row = <ClubRow as="link" href={feesHref} title={feeLine(fees)} chevron />;
    } else if (!pay.hasFeeSchedule) {
      row = <ClubRow as="link" href={feesHref} title={W.nothingDue(feeLine(fees))} chevron />;
    } else {
      const c = pay.counts;
      const filter = c.pastDue > 0 ? 'past-due' : c.pending > 0 ? 'pending' : 'paid';
      row = (
        <ClubRow
          as="link"
          href={`${base}/registrations?payment=${filter}`}
          title={W.paidLine(c.paid, c.depositPaid)}
          caption={W.owingLine(c.pending, c.pastDue)}
          chevron
        />
      );
    }
    return (
      <ClubSection list title={W.payments} meta={pay.hasFeeSchedule ? W.payFigure(pay.totalCollected, pay.totalExpected) : undefined}>
        <ClubRowList inset label={W.payments}>{row}</ClubRowList>
      </ClubSection>
    );
  }

  function coachesCard() {
    // ⚖ While chat is paused (2026-10-18, ruling P5) the card tracks coach sign-ups: its rows open Teams, it speaks of
    // signing up, and Remind no longer waits for a chat room (the count was always portal sign-ups, never room members).
    const chatHref = CHAT_PAUSED ? `${base}/registrations` : `${base}/chat`;
    let meta: ReactNode;
    let rows: ReactNode;
    if (!chatSettled) {
      rows = <ClubRow title={<span className={styles.quiet}>{W.coachesLoading}</span>} />;
    } else if (!chat) {
      rows = (
        <ClubRow
          title={W.coachesFailed}
          caption={CHAT_PAUSED ? W.coachesFailedPausedLine : W.coachesFailedLine}
          beside={<RowAction onClick={onRetryChat}>{W.tryAgain}</RowAction>}
        />
      );
    } else if (!chat.eligible) {
      rows = <ClubRow as="link" href={chatHref} title={W.chatLocked} caption={chat.upsellCopy ?? undefined} chevron />;
    } else if (chat.teamsTotal === 0) {
      rows = <ClubRow as="link" href={chatHref} title={W.noTeams} caption={CHAT_PAUSED ? W.noTeamsSignUpLine : W.noTeamsLine} chevron />;
    } else {
      meta = W.coachesFigure(chat.coachesSignedUp, chat.teamsTotal);
      const noEmail = Math.max(0, chat.teamsTotal - chat.teamsWithEmail);
      // The stamp this session just produced wins over the polled one, so the button rests at once.
      const lastSentIso = remind?.sentAt ?? chat.reminderLastSentAt;
      const lastSentMs = lastSentIso ? Date.parse(lastSentIso) : NaN;
      const cooledUntil = Number.isFinite(lastSentMs) ? lastSentMs + CHAT_REMIND_COOLDOWN_MS : 0;
      const resting = cooledUntil > nowMs;
      let caption: string = CHAT_PAUSED ? W.signUpLine : W.joinLine;
      let beside: ReactNode;
      if (!chat.roomOpen && !CHAT_PAUSED) caption = W.openRoom;
      else if (chat.reminderRetired) caption = W.finishedRemind;
      else if (!canRemind) caption = W.noRemindAccess;
      else if (chat.notJoinedRemindable === 0) caption = W.noRemindEmail;
      else if (resting) beside = <RowAction onClick={() => {}} disabled>{W.remindedAgo(Math.floor(Math.max(0, nowMs - (cooledUntil - CHAT_REMIND_COOLDOWN_MS)) / 60_000))}</RowAction>;
      else beside = <RowAction onClick={() => void sendReminders()} disabled={sending}>{sending ? W.sending : W.remind(chat.notJoinedRemindable)}</RowAction>;
      rows = (
        <>
          {chat.notJoined > 0
            ? <ClubRow as="link" href={chatHref} title={CHAT_PAUSED ? W.notSignedUp(chat.notJoined) : W.notJoined(chat.notJoined)} caption={caption} beside={beside} chevron />
            : <ClubRow as="link" href={chatHref} title={W.allJoined} chevron />}
          {noEmail > 0 && (
            <ClubRow as="link" href={`${base}/registrations?attention=missing_email`} title={W.noEmail(noEmail)} caption={W.noEmailLine} chevron />
          )}
        </>
      );
    }
    return (
      <ClubSection list title={W.coaches} meta={meta}>
        <ClubRowList inset label={W.coaches}>{rows}</ClubRowList>
        {remind && <p className={remind.failed ? styles.resultBad : styles.result} role="status">{remind.message}</p>}
      </ClubSection>
    );
  }

  function messagesCard() {
    const href = `${base}/communication`;
    const latest = comms.latestTitle
      ? [comms.latestTitle, comms.latestDate ? formatStoredDate(comms.latestDate, { withYear: false }) : ''].filter(Boolean).join(' · ')
      : undefined;
    return (
      <ClubSection list title={W.messages}>
        <ClubRowList inset label={W.messages}>
          {comms.total === 0
            ? <ClubRow as="link" href={href} title={W.nothingSent} caption={W.messagesLine} chevron />
            : <ClubRow as="link" href={href} title={W.sent(comms.total, comms.emailsSent)} caption={latest} chevron />}
        </ClubRowList>
      </ClubSection>
    );
  }

  function scheduleCard() {
    const href = `${base}/schedule`;
    return (
      <ClubSection list title={W.schedule}>
        {/* The demo tour's "Break the schedule" anchor (it also lives on the schedule page and the game-day board). */}
        <ClubRowList inset label={W.schedule} data-sandbox-tour="schedule-health">
          {health.timedGames === 0
            ? <ClubRow as="link" href={href} title={W.noTimes} caption={W.teamsIn(teams, divisions)} chevron />
            : <ClubRow as="button" onClick={onOpenHealth} aria-haspopup="dialog" title={W.timed(health.timedGames, health.totalGames)} caption={health.topIssue ?? W.healthLine(health.tone, health.issueCount)} chevron />}
        </ClubRowList>
      </ClubSection>
    );
  }

  const card = (id: PanelId) => {
    switch (id) {
      case 'registration': return inviteOnly ? teamsCard() : registrationCard();
      case 'payment': return paymentsCard();
      case 'tournamentChat': return coachesCard();
      case 'communications': return messagesCard();
      case 'scheduleHealth': return scheduleCard();
    }
  };

  const onBoard = panels
    .filter(p => !(inviteOnly && NOT_ON_INVITE_ONLY.has(p.id)))
    .map(p => (inviteOnly && p.id === 'registration' ? { ...p, label: INVITE_BOARD_WORDS.teamsCard } : p));
  const shown = onBoard.filter(p => p.visible).sort((a, b) => a.order - b.order);
  const hidden = onBoard.filter(p => !p.visible).sort((a, b) => a.order - b.order).map(p => ({ id: p.id, label: p.label }));

  // The guidance as Stage 1's one-line note: the days, one sentence, and its action a DOOR (olive words, a chevron) —
  // before game day nothing on this board is THE one thing to do, so it is not a lime.
  const note = daysUntil !== null && daysUntil > 0 ? (
    <BoardNote>
      {W.note(daysUntil)} {W.noteLine}{' '}
      <Link href={`${base}/communication`} className={styles.noteDoor}>
        {W.noteDoor}<ChevronRight size={15} aria-hidden />
      </Link>
    </BoardNote>
  ) : null;

  if (!customizing) {
    return (
      <>
        {note}
        <div className={styles.cards}>
          {shown.map(p => <div key={p.id} className={styles.cell}>{card(p.id)}</div>)}
          {shown.length === 0 && <p className={styles.quiet}>{W.allHidden}</p>}
        </div>
      </>
    );
  }

  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) onReorder(e.active.id as PanelId, e.over.id as PanelId);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={shown.map(p => p.id)} strategy={rectSortingStrategy}>
        <div className={styles.cards}>
          {shown.map(p => (
            <SortableCard key={p.id} id={p.id} label={p.label} onRemove={() => onHide(p.id)}>{card(p.id)}</SortableCard>
          ))}
          {hidden.length > 0 && (
            <AddCard items={hidden} open={adding} onToggle={() => setAdding(o => !o)} onAdd={id => { onShow(id); setAdding(false); }} />
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}
