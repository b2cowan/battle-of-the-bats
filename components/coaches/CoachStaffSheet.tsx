'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import SublinedChoice from '@/components/coaches/SublinedChoice';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import { formatStoredDate } from '@/lib/timezone';
import {
  STAFF_KINDS, STAFF_KIND_COPY, STAFF_PRESETS, LAST_HEAD_COACH_MESSAGE, staffKindCopyFor, applyOrgGrantPolicy,
  resolveCoachCapabilities, scheduleAccessOf, scheduleGrantsFor, hasRecordAccess, grantsOf,
  type CoachCapabilities, type AssistantCapabilityGrants, type StaffKind, type ScheduleAccess,
} from '@/lib/coach-capabilities';
import {
  isWidening, rank, delegateMaySet, delegateMayEditRow, clampForDelegate, type GrantKey,
} from '@/lib/coach-staff-delegation';
import { GRANT_LABELS } from '@/lib/coach-staff-labels';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { useOrg } from '@/lib/org-context';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import css from './CoachStaffPanel.module.css';

/**
 * ═══ ONE SHEET, THREE DOORS (pass 2 of the staff access plan, owner-approved 2026-09-10) ═══
 *
 * The same sheet opens on a staff member ("Edit access"), on a pending invite ("Change that
 * before they accept") and on nobody yet ("Invite someone"). Role at the top as the app's
 * sub-lined dropdown, every grant beneath it with one sentence, Sensitive as a visible group
 * rather than a fold, and the two actions a head coach occasionally needs in the footer.
 *
 * Saves are PER TAP on a member and on a pending invite, exactly as the old grid saved; a new
 * invite is ONE POST at send, with every sensitive grant confirmed once, together. The
 * confirm-before-grant copy and the Documents + Contacts compound rule are carried over
 * unchanged from the grid this replaces.
 *
 * ═══ THE DELEGATE'S SHEET (Manage staff, owner ruling 2026-09-13) ═══
 * The same sheet opens for a non-head holder of the Manage staff grant, with walls drawn from
 * `viewer` (who is looking, as the list route reports it): a head-coach row and their own row open
 * READ-ONLY with a sentence saying who can act; a Sensitive control they may not widen past their
 * own level renders disabled with the reason under it (never hidden — a switch that vanishes for
 * one person makes the sheet look broken); Manage staff itself is never theirs to hand out; a
 * preset they apply is CLAMPED to their level and says which controls it capped; and the role
 * buttons are absent. Every rule here has a twin on the server (`lib/coach-staff-delegation.ts`).
 */

/** Who is looking at the sheet — the list route's `viewer`. Null only before the list has loaded. */
export type StaffViewer = { userId: string; capabilities: CoachCapabilities };

type Caps = CoachCapabilities;

export interface StaffMember {
  /** The TEAM MEMBERSHIP id (M1, 2026-08-16) — one row per person per team, no season attached. */
  memberId: string;
  userId: string;
  coachRole: 'head_coach' | 'assistant_coach';
  displayName: string | null;
  email: string | null;
  /**
   * ⚠ A LABEL, never a gate — this person's address also holds a verified family connection to
   * this team. Computed server-side by comparing addresses; no family data is joined or sent here.
   * ⚠ **A `false` here means "not known to be", NOT "definitely isn't."** Every sentence that reads
   * this must stay true when it is wrongly false — see the removal dialog.
   */
  alsoFollowsTeam?: boolean;
  capabilities: Caps;
  /** The stored word (mig 288); null on a row written before it, which the display derives. */
  staffKind: StaffKind | null;
  joinedAt: string;
  isSelf: boolean;
}

export interface PendingInvite {
  inviteId: string;
  email: string;
  status: 'pending' | 'pending_approval';
  staffKind: StaffKind | null;
  capabilities: Caps;
  expiresAt: string;
  createdAt: string;
}

export type SheetTarget =
  | { mode: 'member'; member: StaffMember }
  | { mode: 'pending'; invite: PendingInvite }
  | { mode: 'invite' };

// ── The controls, with their sentences ──────────────────────────────────────────────────────

type SegKey = 'schedule' | 'documents' | 'money';
type SwitchKey = 'attendance' | 'lineups' | 'development' | 'staffChat' | 'scoutingBook' | 'rosterPii' | 'notes' | 'announcementsSend' | 'tryouts' | 'tournaments' | 'manageStaff';
/** A three-way option: its button label, and the one word the row chip uses ("Schedule · edit"). */
type SegOption = { value: string; label: string; chip: string };
export type StaffControl =
  | { kind: 'seg'; key: SegKey; label: string; sentence: string; options: ReadonlyArray<SegOption>; sensitive?: boolean }
  | { kind: 'switch'; key: SwitchKey; label: string; sentence: string; sensitive?: boolean };

/**
 * ONE TABLE OF CONTROLS — the sheet renders it, and the list's row chips are derived from it
 * (`accessChips` in the panel), so a grant's name, its group and its sensitive flag are written
 * once. Every sentence is written for the person DECIDING, not for a coach mid-edit (the old
 * grid's hints were three words each — "Record attendance", "Blank team forms").
 *
 * ⚠ The Schedule sentence names the R7 widening on the control itself: an assistant with "View +
 * edit" writes practice plans. That was the plan's condition for the widening.
 */
export const EVERYDAY: ReadonlyArray<StaffControl> = [
  { kind: 'seg', key: 'schedule', label: GRANT_LABELS.schedule,
    sentence: 'See the schedule and practice plans. Edit adds, changes and cancels events, and writes practice plans.',
    options: [{ value: 'off', label: 'Hidden', chip: '' }, { value: 'view', label: 'View', chip: 'view' }, { value: 'manage', label: 'View + edit', chip: 'edit' }] },
  { kind: 'switch', key: 'attendance', label: GRANT_LABELS.attendance, sentence: 'Mark who came, at practices and games.' },
  { kind: 'switch', key: 'lineups', label: GRANT_LABELS.lineups, sentence: 'Build and change game lineups.' },
  /**
   * THE DEVELOPMENT GRANT (owner ruling 2026-09-11) — one switch for every development write.
   * Everyday, not Sensitive: it hands over no new READ (goals still ride Internal notes, results
   * ride the record duties) — it delegates the recording. The sentence names the compound the
   * way Documents names Contacts: a goal is written only with Internal notes as well.
   */
  { kind: 'switch', key: 'development', label: GRANT_LABELS.development,
    sentence: 'Define tests, run sessions and record results. With Internal notes, write goals too.' },
  { kind: 'switch', key: 'staffChat', label: GRANT_LABELS.staffChat, sentence: 'A seat in the team’s private staff room.' },
  { kind: 'switch', key: 'scoutingBook', label: GRANT_LABELS.scoutingBook,
    sentence: 'Read everyone’s notes on opponents and the team’s book line. Off, they can still add their own.' },
  { kind: 'seg', key: 'documents', label: GRANT_LABELS.documents,
    sentence: 'Blank team forms. Signed player forms also need Contacts & birthdates.',
    options: [{ value: 'off', label: 'Hidden', chip: '' }, { value: 'view', label: 'View', chip: 'view' }, { value: 'manage', label: 'Manage', chip: 'manage' }] },
];

export const SENSITIVE: ReadonlyArray<StaffControl> = [
  { kind: 'seg', key: 'money', label: GRANT_LABELS.money, sentence: 'Budget, dues, expenses and every payment.', sensitive: true,
    options: [{ value: 'off', label: 'Hidden', chip: '' }, { value: 'read', label: 'View', chip: 'view' }, { value: 'write', label: 'View + edit', chip: 'edit' }] },
  { kind: 'switch', key: 'rosterPii', label: GRANT_LABELS.rosterPii, sensitive: true,
    sentence: 'Guardian names, emails and phones; players’ birthdates, medical and emergency details.' },
  { kind: 'switch', key: 'notes', label: GRANT_LABELS.notes, sensitive: true,
    sentence: 'Private staff notes about each player, never shown to families.' },
  { kind: 'switch', key: 'announcementsSend', label: GRANT_LABELS.announcementsSend, sensitive: true,
    sentence: 'Send announcements to every guardian. Off means they can draft, not send.' },
  { kind: 'switch', key: 'tryouts', label: GRANT_LABELS.tryouts, sensitive: true,
    sentence: 'Every candidate’s guardian details and your evaluation decisions.' },
  /**
   * RUN TOURNAMENTS (owner ruling 2026-09-13) — one switch, everything on the tournament page.
   * Sensitive because a tournament's registrations carry OTHER teams' coaches and their payments.
   * ⚠ Offered only in a standalone Premium workspace — `controlsFor` drops it in a club, where the
   * tournaments are the club's (D2). The sentence names where the door is: the Tournaments page.
   */
  { kind: 'switch', key: 'tournaments', label: GRANT_LABELS.tournaments, sensitive: true,
    sentence: 'Set up and run the team’s tournaments from the Tournaments page — registrations, schedule, scores, and what visiting teams see.' },
  /**
   * THE MASTER KEY (owner ruling 2026-09-13) — last in Sensitive because it reaches every other
   * switch one step removed. The sentence names the three walls the holder lives under.
   */
  { kind: 'switch', key: 'manageStaff', label: GRANT_LABELS.manageStaff, sensitive: true,
    sentence: 'Invite people and change what others can open — never more than they hold, never a head coach, never this switch.' },
];

/**
 * ⚠ A1 (2026-08-03) — what a head coach reads where the Roster Hidden/View control used to be. It
 * is NOT decoration: the switch it replaces was set deliberately by any coach who used it, and a
 * grid that simply lost a control tells them nothing.
 */
const STANDING_ACCESS_NOTE =
  'Players’ names, numbers and positions are visible to everyone on your staff. '
  + 'Their contact details and birthdates are in the group below.';

/** The one rule the old grid never stated, said on the control that trips it. */
const OPENS_ROSTER = 'Turning this on also opens the roster page for them.';
const RECORD_DUTIES: ReadonlySet<string> = new Set(['attendance', 'lineups', 'documents', 'development']);

/** `rank` / `isWidening` live in the pure module now, so the server and this sheet agree on "wider". */
const granted = (v: unknown) => v !== false && v !== 'off';

/**
 * EVERY grant the server understands must be in a PATCH from here — a PATCH replaces the whole
 * stored bundle, so an omitted key is not "left alone", it is dropped and re-resolved from the
 * defaults. `grantsOf` in the model is that enumeration (its `Required<>` return makes a new grant
 * a compile error until it is sent); this is the sheet's name for it.
 */
export const grantsFrom: (c: Caps) => Required<AssistantCapabilityGrants> = grantsOf;

/**
 * EVERY grant in the Sensitive group asks first. Revoking is never confirmed — a head coach taking
 * access back is always in a hurry. Carried over verbatim from the grid (2026-07-31).
 */
type ConfirmCopy = { title: string; message: string };
type ConfirmOnGrant = (who: string, current: Caps) => ConfirmCopy | null;
const CONFIRM_ON_GRANT: Partial<Record<keyof Caps, ConfirmOnGrant>> = {
  money: who => ({
    title: `Give ${who} access to team money?`,
    message: `${who} will be able to see the budget, dues, and every payment on this team. You can take this back any time.`,
  }),
  // The other half of the same compound: only claim the signed-forms consequence when Documents is
  // actually on, or this prompt overstates what it is about to grant.
  rosterPii: (who, current) => ({
    title: `Share family contact details with ${who}?`,
    message: current.documents !== 'off'
      ? `${who} will see guardian names, emails, phone numbers, and player birthdates for the whole roster — and, because they already have Documents access, will be able to open each player's signed forms including medical consents.`
      : `${who} will see guardian names, emails, phone numbers, and player birthdates for the whole roster.`,
  }),
  announcementsSend: who => ({
    title: `Let ${who} email your families?`,
    message: `${who} will be able to send announcements to every guardian on the roster, not just draft them.`,
  }),
  tryouts: who => ({
    title: `Give ${who} access to tryouts?`,
    message: `${who} will see every candidate's guardian contact details and your evaluation decisions — including players who never join the team.`,
  }),
  notes: who => ({
    title: `Share your internal notes with ${who}?`,
    message: `${who} will see private staff notes about each player, which are written for coaches and never shown to families.`,
  }),
  tournaments: who => ({
    title: `Let ${who} run your tournaments?`,
    message: `${who} will be able to set up and run this workspace’s tournaments — registrations, the schedule, scores, announcements and what visiting teams see, including their coaches’ contact details and payments. They won’t be able to change your staff, your settings or your billing. You can take this back any time.`,
  }),
  manageStaff: who => ({
    title: `Let ${who} manage your staff?`,
    message: `${who} will be able to invite people and change what others can open — sensitive access only up to what they hold themselves. They can’t change any head coach, change anyone’s role, or pass this switch on. You can take this back any time.`,
  }),
  /**
   * ⚠ Documents sits in EVERYDAY because on its own it grants blank team forms — but a player's
   * signed waiver / medical consent needs `documents` AND `rosterPii` together. When contacts are
   * ALREADY granted, switching Documents on is the second half of a compound grant and DOES hand
   * over medical files. Confirm exactly when the compound completes (/review 2026-07-31).
   */
  documents: (who, current) => current.rosterPii
    ? {
        title: `Give ${who} access to signed player forms?`,
        message: `${who} already has family contact details, so turning Documents on also lets them open every player's signed forms — including medical consents.`,
      }
    : null,
};

/** The sensitive grants a bundle holds, as the words the one-shot confirmations use. */
function sensitiveWords(c: Caps): string[] {
  const out: string[] = [];
  if (c.money !== 'off') out.push('team money');
  if (c.rosterPii) out.push('family contacts');
  if (c.notes) out.push('internal notes');
  if (c.announcementsSend) out.push('emailing families');
  if (c.tryouts) out.push('tryouts');
  if (c.tournaments) out.push('running tournaments');
  if (c.manageStaff) out.push('managing staff');
  return out;
}
function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}
/** What each sensitive grant hands over, for the one confirmation at send / role change. */
function sensitiveConsequences(c: Caps): string[] {
  const out: string[] = [];
  if (c.money !== 'off') out.push('the budget, dues and every payment');
  if (c.rosterPii) out.push('guardian names, emails, phones and player birthdates for the whole roster');
  if (c.notes) out.push('your private staff notes about each player');
  if (c.announcementsSend) out.push('the power to email every family');
  if (c.tryouts) out.push('every candidate’s guardian details and your decisions');
  if (c.tournaments) out.push('the workspace’s tournaments — registrations, schedule, scores and what visiting teams see');
  if (c.manageStaff) out.push('the Staff page — inviting people and setting what others can open, up to their own access');
  return out;
}

/** The Role dropdown's options, with the manager's sub-line naming tournaments only in a workspace. */
const roleOptionsFor = (org: { isTeamWorkspace: boolean }) =>
  STAFF_KINDS.map(k => ({ value: k, name: STAFF_KIND_COPY[k].name, sub: staffKindCopyFor(k, org).sentence }));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CoachStaffSheet({
  orgSlug, teamId, teamName, target, headCoachCount, viewer, onClose,
  onMemberChanged, onMemberRemoved, onInviteChanged, onInviteCreated, onResendInvite, onCancelInvite,
}: {
  orgSlug: string;
  teamId: string;
  teamName: string;
  target: SheetTarget;
  /** Active head coaches on the team, for the last-head refusal's client-side twin. */
  headCoachCount: number;
  /** Who is looking — the delegate's walls are drawn from this. The panel mounts the sheet only once it has it. */
  viewer: StaffViewer;
  onClose: () => void;
  onMemberChanged: (m: StaffMember) => void;
  onMemberRemoved: (memberId: string) => void;
  onInviteChanged: (i: PendingInvite) => void;
  onInviteCreated: (note: string) => void;
  /** The panel owns resend/cancel (the row has the same two buttons); true = done, close the sheet. */
  onResendInvite: (invite: PendingInvite) => Promise<boolean>;
  onCancelInvite: (invite: PendingInvite) => Promise<boolean>;
}) {
  useOverlayOpen(true);
  const confirm = useConfirm();
  const uid = useId();
  const { currentOrg } = useOrg();
  const isTeamWorkspace = isTeamWorkspaceOrg(currentOrg);
  const panelRef = useRef<HTMLDivElement>(null);
  const base = `/api/coaches/${orgSlug}/teams/${teamId}/staff`;

  const member = target.mode === 'member' ? target.member : null;
  const invite = target.mode === 'pending' ? target.invite : null;
  const isNew = target.mode === 'invite';
  const isHeadRow = member?.coachRole === 'head_coach';

  // ── the delegate's walls (D3–D8) ──
  const actor: Caps = viewer.capabilities;
  const actorIsHead = actor.isHeadCoach;
  // A head-coach row or the viewer's own row is read-only for a delegate (D4, D5). The head coach's
  // own row never reaches this sheet (the list shows "Hand over" there instead).
  const readOnly = !!member && !actorIsHead
    && !delegateMayEditRow({ userId: viewer.userId, isHeadCoach: false }, member);
  const isOwnRow = !!member && member.userId === viewer.userId;
  // Controls a preset just capped for a delegate, so each can say so for one save cycle (D8).
  const [clampedKeys, setClampedKeys] = useState<ReadonlySet<GrantKey>>(() => new Set());

  const [caps, setCaps] = useState<Caps>(() =>
    member?.capabilities ?? invite?.capabilities ?? resolveCoachCapabilities('assistant_coach', {}));
  const [kind, setKind] = useState<StaffKind | null>(() =>
    member ? (member.staffKind ?? (member.coachRole === 'assistant_coach' ? 'assistant' : null))
      : invite ? (invite.staffKind ?? 'assistant')
      : null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const who = member ? (member.displayName || member.email || 'this person') : ((invite?.email ?? email.trim()) || 'this person');

  // An unsent invite with anything typed asks before it is thrown away; everything else saves
  // as it goes and has nothing to lose.
  const requestClose = useDiscardGuard({
    dirty: isNew && (email.trim().length > 0 || kind !== null),
    close: onClose,
    noun: 'invite',
    detail: email.trim() ? `the invite to ${email.trim()} you haven’t sent` : undefined,
  });
  useDialogFloor(true, panelRef, { onClose: requestClose, busy });
  // ⚠ EVERY way out is busy-gated, not just Escape (/review, 2026-09-11): the X, the phone's back
  // arrow and the backdrop all go through here, so a confirmed money grant whose save then fails
  // cannot have its sheet torn down under it and its error land on nothing.
  const closeUnlessBusy = () => { if (!busy) void requestClose(); };
  // The "✓ Saved" fade — cleared on unmount so a sheet closed inside the window sets no state on
  // a gone component.
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  // ── writes ─────────────────────────────────────────────────────────────────

  async function patchAccess(next: Caps, nextKind: StaffKind | null): Promise<boolean> {
    setBusy(true); setSaved(false); setError('');
    try {
      const body: Record<string, unknown> = { capabilities: grantsFrom(next) };
      if (nextKind) body.kind = nextKind;
      const url = member ? `${base}/${member.memberId}` : `${base}/invites/${invite!.inviteId}`;
      const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'That change could not be saved.');
      if (member) {
        const updated: StaffMember = { ...member, capabilities: json.capabilities, staffKind: json.staffKind ?? member.staffKind };
        setCaps(updated.capabilities); setKind(updated.staffKind ?? kind);
        onMemberChanged(updated);
      } else if (invite && json.invite) {
        const updated: PendingInvite = { ...invite, ...json.invite };
        setCaps(updated.capabilities); setKind(updated.staffKind ?? kind);
        onInviteChanged(updated);
      }
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 1800);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That change could not be saved.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** One control changed. A widening in the Sensitive group asks first; everything else saves the instant it is tapped. */
  async function setGrant(patch: Partial<Caps>) {
    const [key, value] = Object.entries(patch)[0] as [keyof Caps, Caps[keyof Caps]];
    const prompt = CONFIRM_ON_GRANT[key];
    const copy = !isNew && prompt && isWidening(caps[key], value) ? prompt(who, caps) : null;
    if (copy) {
      const ok = await confirm({ ...copy, confirmText: 'Give access', cancelText: 'Cancel', tone: 'warning' });
      if (!ok) return;
    }
    const next = { ...caps, ...patch };
    setClampedKeys(new Set());
    if (isNew) { setCaps(next); return; }
    setCaps(next); // optimistic; a failed save re-reads below
    const ok = await patchAccess(next, null);
    if (!ok) setCaps(caps);
  }

  function setSchedule(level: ScheduleAccess) {
    void setGrant(scheduleGrantsFor(level) as Partial<Caps>);
  }

  /**
   * The role dropdown applies that role's STARTING bundle. A widening confirms once, listing
   * what widens; a narrowing does not (the same rule as a single grant). The word is stored with
   * the bundle in one save, so the row never shows a kind whose access never landed.
   */
  async function chooseKind(nextKind: StaffKind) {
    // The dropdown fires for the option already chosen too — re-picking the same role must not
    // throw away the switches the coach has just adjusted (/review, 2026-09-11).
    if (nextKind === kind) return;
    // A read-only row (D4/D5) refuses here as well as on the control — the dropdown's option list
    // has no disabled state of its own (/review 2026-09-13).
    if (readOnly) return;
    // D8 — a delegate's preset is clamped to what they hold (and never carries Manage staff); a
    // head coach's applies as written. The capped controls say so until the next change.
    // The org policy first (a club never holds Run tournaments), so the confirm below and the
    // bundle sent both say what the server will actually write (/review 2026-09-13).
    const raw = resolveCoachCapabilities('assistant_coach', applyOrgGrantPolicy({ ...STAFF_PRESETS[nextKind] }, { isTeamWorkspace }));
    const { grants, clamped } = clampForDelegate(actor, isNew ? null : grantsFrom(caps), grantsFrom(raw));
    const preset = resolveCoachCapabilities('assistant_coach', grants);
    if (isNew) { setClampedKeys(new Set(clamped)); setKind(nextKind); setCaps(preset); return; }
    const widened = sensitiveWords(preset).filter(w => !sensitiveWords(caps).includes(w));
    const copy = staffKindCopyFor(nextKind, { isTeamWorkspace });
    if (widened.length > 0) {
      const ok = await confirm({
        title: `Make ${who} ${copy.asA}?`,
        message: `This applies the ${copy.name.toLowerCase()} starting access and hands over ${joinWords(widened)}. You can take any of it back from their sheet.`,
        confirmText: `Make ${copy.name.toLowerCase()}`, cancelText: 'Cancel', tone: 'warning',
      });
      if (!ok) return;
    }
    const previousKind = kind;
    // Set only now — a cancelled confirm above must not leave “Stays at …” notes on an untouched
    // bundle (/review 2026-09-13).
    setClampedKeys(new Set(clamped));
    setKind(nextKind); setCaps(preset);
    const ok = await patchAccess(preset, nextKind);
    if (!ok) { setKind(previousKind); setCaps(caps); setClampedKeys(new Set()); }
  }

  async function changeRole(coachRole: 'head_coach' | 'assistant_coach') {
    if (!member) return;
    const promoting = coachRole === 'head_coach';
    if (!promoting && headCoachCount <= 1) { setError(LAST_HEAD_COACH_MESSAGE); return; }
    const ok = await confirm(promoting
      ? {
          title: `Make ${who} a head coach?`,
          message: `${who} will be able to do everything on this team — including manage staff, money and settings. You will both be head coaches until one of you steps down.`,
          confirmText: 'Make head coach', cancelText: 'Cancel', tone: 'warning',
        }
      : {
          title: `Make ${who} an assistant coach?`,
          message: `${who} goes back to an assistant coach with the access they had before, and stops managing staff.`,
          confirmText: 'Make assistant coach', cancelText: 'Cancel', tone: 'warning',
        });
    if (!ok) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`${base}/${member.memberId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ coachRole }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'That change could not be saved.');
      onMemberChanged({ ...member, coachRole: json.coachRole, staffKind: json.staffKind ?? null, capabilities: json.capabilities });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That change could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function removeMember() {
    if (!member) return;
    if (isHeadRow && headCoachCount <= 1) { setError(LAST_HEAD_COACH_MESSAGE); return; }
    const ok = await confirm({
      title: `Remove ${who} from the team?`,
      /**
       * ⚠ TWO SENTENCES WITH A HISTORY — both load-bearing. "Every screen, every season" is the
       * M1 promise (2026-08-16). "COACHING access" (ruling D, 2026-08-03): a staff removal does
       * not touch the family layer, and `alsoFollowsTeam` can be a false NEGATIVE, so the base
       * sentence stays scoped to coaching access; the flag only ADDS the family warning.
       */
      message: member.alsoFollowsTeam
        ? `${who} loses their coaching access to this team immediately — every screen, every season. Their name stays on the seasons they coached. ⚠ They're also connected to this team as a family member, and that's separate — they'll keep seeing your schedule, results and any game page you've shared. To end that too, remove them under Guardians on their player's page.`
        : `${who} loses their coaching access to this team immediately — every screen, every season. Their name stays on the seasons they coached, and adding them back later restores their access.`,
      confirmText: 'Remove', cancelText: 'Keep them', tone: 'danger',
    });
    if (!ok) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`${base}/${member.memberId}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'They could not be removed.');
      onMemberRemoved(member.memberId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'They could not be removed.');
    } finally {
      setBusy(false);
    }
  }

  async function cancelInvite() {
    if (!invite) return;
    setBusy(true);
    const done = await onCancelInvite(invite);
    setBusy(false);
    if (done) onClose();
  }

  async function resendInvite() {
    if (!invite) return;
    setBusy(true);
    const done = await onResendInvite(invite);
    setBusy(false);
    if (done) onClose();
  }

  async function sendInvite() {
    const address = email.trim().toLowerCase();
    if (!EMAIL_RE.test(address)) { setError('Enter a valid email address.'); return; }
    if (!kind) { setError('Choose who they are before sending the invite.'); return; }
    const words = sensitiveWords(caps);
    if (words.length > 0) {
      const ok = await confirm({
        title: `Give ${address} access to ${joinWords(words)}?`,
        message: `When they accept they’ll see ${joinWords(sensitiveConsequences(caps))}. You can take any of it back from their row.`,
        confirmText: 'Send with this access', cancelText: 'Back', tone: 'warning',
      });
      if (!ok) return;
    }
    setBusy(true); setError('');
    try {
      const res = await fetch(`${base}/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: address, kind, capabilities: grantsFrom(caps) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Could not send the invite.');
      onInviteCreated(json.pendingApproval
        ? `Invite to ${address} is waiting for your club admin to approve it.`
        : `Invite sent to ${address}.`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the invite.');
    } finally {
      setBusy(false);
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────

  const opensRoster = !hasRecordAccess(caps);
  // Run tournaments exists only in a Premium workspace (D2): in a club the control is not drawn and
  // its chip never shows (the server writes the key off there — `applyOrgGrantPolicy`).
  const sensitiveControls = isTeamWorkspace ? SENSITIVE : SENSITIVE.filter(c => c.key !== 'tournaments');
  const sensitiveCount = sensitiveControls.filter(c => granted(caps[c.key])).length;
  const kindCopy = kind ? staffKindCopyFor(kind, { isTeamWorkspace }) : null;
  const roleOptions = roleOptionsFor({ isTeamWorkspace });

  const title = isNew ? `Invite someone to ${teamName}` : member ? (member.displayName || member.email || 'Staff member') : invite!.email;
  const subtitle = isNew
    ? 'They get an email with a link that works for 7 days. Their access starts when they accept.'
    : member
      ? [member.displayName ? member.email : null, `joined ${formatStoredDate(member.joinedAt, { withYear: false })}`].filter(Boolean).join(' · ')
      : invite!.status === 'pending_approval'
        ? `Invited ${formatStoredDate(invite!.createdAt, { withYear: false })} · waiting for your club admin to approve`
        : `Invited ${formatStoredDate(invite!.createdAt, { withYear: false })} · ${daysLeftLabel(invite!.expiresAt)}`;

  /**
   * The one line under a control a delegate cannot fully use (D3, D6, D8). Null when nothing is
   * locked. The schedule key is never Sensitive, so it never has one.
   */
  const lockReason = (c: StaffControl): string | null => {
    if (readOnly || actorIsHead) return null;
    if (c.key === 'schedule') return null;
    if (c.key === 'manageStaff') return 'Only a head coach changes this.';
    if (clampedKeys.has(c.key)) {
      const level = c.kind === 'seg' ? (c.options.find(o => o.value === String(caps[c.key]))?.label ?? 'Hidden') : (caps[c.key] ? 'On' : 'Off');
      return `Stays at ${level} — you can only hand out what you hold.`;
    }
    if (c.kind === 'seg') {
      const blocked = c.options.some(o => !delegateMaySet(actor, c.key, caps[c.key], o.value));
      if (!blocked) return null;
      const mine = c.options.find(o => rank(o.value) === rank(actor[c.key]))?.label ?? 'Hidden';
      return `You hold ${mine} here, so that’s as far as you can hand it out.`;
    }
    return caps[c.key] || delegateMaySet(actor, c.key, caps[c.key], true) ? null : 'You don’t hold this, so you can’t hand it out.';
  };

  const renderControl = (c: StaffControl) => {
    const labelId = `${uid}-${c.key}`;
    const consequence = opensRoster && RECORD_DUTIES.has(c.key) && !granted(caps[c.key]) ? OPENS_ROSTER : null;
    const reason = lockReason(c);
    const control = c.kind === 'seg'
      ? (
        <span className={css.segControl} role="group" aria-labelledby={labelId}>
          {c.options.map(opt => {
            const current = c.key === 'schedule' ? scheduleAccessOf(caps) : String(caps[c.key]);
            const active = current === opt.value;
            // A seg keeps its lower options live for a delegate; only the ones past their level lock.
            const locked = readOnly || (c.key !== 'schedule' && !delegateMaySet(actor, c.key, caps[c.key], opt.value));
            return (
              <button key={opt.value} type="button" aria-pressed={active} disabled={busy || locked}
                className={active ? `${css.segBtn} ${css.segBtnOn}` : css.segBtn}
                onClick={() => {
                  if (c.key === 'schedule') setSchedule(opt.value as ScheduleAccess);
                  else void setGrant({ [c.key]: opt.value } as Partial<Caps>);
                }}>
                {opt.label}
              </button>
            );
          })}
        </span>
      )
      : (
        <input type="checkbox" className={css.switch} aria-labelledby={labelId}
          disabled={busy || readOnly || !delegateMaySet(actor, c.key, caps[c.key], !caps[c.key])}
          checked={Boolean(caps[c.key])}
          onChange={e => { void setGrant({ [c.key]: e.target.checked } as Partial<Caps>); }} />
      );
    return (
      <div key={c.key} className={reason ? `${css.item} ${css.itemLocked}` : css.item}>
        <span className={css.itemLabel} id={labelId}>
          {c.label}
        </span>
        <span className={css.itemControl}>{control}</span>
        <span className={css.itemHint}>
          {c.sentence}
          {consequence && <> <strong>{consequence}</strong></>}
        </span>
        {reason && <span className={css.itemLockReason}>{reason}</span>}
      </div>
    );
  };

  return (
    <div className={`${shared.modalOverlay} ${shared.sheetOnMobile}`} onPointerDown={e => { if (e.target === e.currentTarget) closeUnlessBusy(); }}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${shared.modal} ${shared.modalFlushFooter} ${shared.modalScrollBody} ${css.sheet}`}
        onClick={e => e.stopPropagation()}
      >
        <CoachModalHeader title={title} subtitle={subtitle} onClose={closeUnlessBusy} closeAriaLabel="Close">
          {/* Persistent live region — a wrapper that only appears WITH its text is often never
              announced, and this confirms a money / guardian-contact grant actually saved. */}
          <span role="status" aria-live="polite" className={css.saveState}>
            {busy && !isNew ? 'Saving…' : saved ? '✓ Saved' : ''}
          </span>
        </CoachModalHeader>

        <div className={`${shared.formBody} ${shared.scrollPane}`}>
          {isNew && (
            <div className={shared.field}>
              <label className={shared.label} htmlFor={`${uid}-email`}>Their email</label>
              <input id={`${uid}-email`} type="email" required autoComplete="off" className={shared.input}
                placeholder="name@email.com" value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }} />
            </div>
          )}

          {isHeadRow ? (
            <p className={css.headNote}>
              {actorIsHead
                ? 'A head coach can open everything on this team — including this page. There is nothing to switch.'
                : `${who} is a head coach. Only another head coach changes a head coach’s access or role.`}
            </p>
          ) : (
            <>
              {readOnly && (
                // D5 — the delegate's own row: everything below is drawn, nothing is switchable.
                <p className={css.headNote}>
                  {isOwnRow ? 'This is your own access. Ask a head coach to change it.' : `Only a head coach changes ${who}’s access.`}
                </p>
              )}
              <div className={css.group}>
                <div className={css.groupHead}>
                  {/* ⚠ SublinedChoice draws NO visible label — its `label` prop is the ARIA name only. */}
                  <label className={css.groupTitle} htmlFor={`${uid}-kind`}>{isNew ? 'Who are they?' : 'Role'}</label>
                  {!isNew && !readOnly && <span className={css.groupMeta}>Changing it applies that role’s starting access</span>}
                </div>
                <SublinedChoice
                  id={`${uid}-kind`}
                  label={isNew ? 'Who are they?' : 'Role'}
                  options={roleOptions}
                  value={kind}
                  onChange={v => { void chooseKind(v); }}
                  placeholder="Choose who they are"
                  disabled={busy || readOnly}
                />
                {kindCopy && <p className={css.kindHint}>{kindCopy.sentence}</p>}
              </div>

              <div className={css.group}>
                <div className={css.groupHead}>
                  <span className={css.groupTitle}>{isNew ? 'What they’ll be able to open' : 'Standard access'}</span>
                  {isNew && kindCopy && <span className={css.groupMeta}>Set from “{kindCopy.name}” — change anything</span>}
                </div>
                {isNew && !kind ? (
                  <p className={shared.convGhostNote}>Choose who they are, and their starting access appears here for you to adjust.</p>
                ) : (
                  <>
                    {EVERYDAY.map(renderControl)}
                    <p className={css.standingNote}>{STANDING_ACCESS_NOTE}</p>
                  </>
                )}
              </div>

              {(!isNew || kind) && (
                <div className={css.group}>
                  <div className={css.groupHead}>
                    <span className={css.groupTitle}>Sensitive — asks before granting</span>
                    <span className={css.groupMeta}>{sensitiveCount === 0 ? 'none granted' : `${sensitiveCount} granted`}</span>
                  </div>
                  {sensitiveControls.map(renderControl)}
                </div>
              )}
            </>
          )}

          {error && <p className={shared.errorText} role="alert">{error}</p>}
        </div>

        <div className={`${shared.modalFooter} ${css.sheetFoot}`}>
          {isNew && (
            <>
              <span className={css.footNote}>
                {sensitiveCount === 0 ? 'Nothing sensitive in this invite.' : `${sensitiveCount} sensitive grant${sensitiveCount === 1 ? '' : 's'} — you’ll confirm ${sensitiveCount === 1 ? 'it' : 'them'} next.`}
              </span>
              <span className={css.footSpacer} />
              <button type="button" className={shared.btnGhost} disabled={busy} onClick={closeUnlessBusy}>Cancel</button>
              <button type="button" className={shared.btnPrimary} disabled={busy} onClick={() => void sendInvite()}>
                {busy ? 'Sending…' : 'Send invite'}
              </button>
            </>
          )}
          {member && readOnly && (
            // D4/D5 — a delegate on a head coach's row or their own: no Remove, no role change.
            <span className={css.footNote}>{isHeadRow ? 'Only a head coach can change or remove a head coach.' : 'Ask a head coach to change your access.'}</span>
          )}
          {member && !readOnly && (
            <>
              <button type="button" className={shared.btnDanger} disabled={busy} onClick={() => void removeMember()}>
                <Trash2 size={14} aria-hidden /> Remove from team
              </button>
              <span className={css.footSpacer} />
              {/* Roles stay with the head coach (D4) — the button is absent for a delegate, and the
                  server refuses the request regardless of what a client sends. */}
              {actorIsHead && (
                <button type="button" className={shared.btnSecondary} disabled={busy}
                  onClick={() => void changeRole(isHeadRow ? 'assistant_coach' : 'head_coach')}>
                  {isHeadRow ? 'Make assistant coach' : 'Make head coach'}
                </button>
              )}
            </>
          )}
          {invite && (
            <>
              <button type="button" className={shared.btnDanger} disabled={busy} onClick={() => void cancelInvite()}>
                <Trash2 size={14} aria-hidden /> Cancel invite
              </button>
              <span className={css.footSpacer} />
              {invite.status === 'pending' && (
                <button type="button" className={shared.btnSecondary} disabled={busy} onClick={() => void resendInvite()}>Resend</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** "link works 5 more days" / "link works 1 more day" / "link has expired" — whole days, generous. */
export function daysLeftLabel(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now(); // utc-intentional: an expiry is an instant, not a calendar day
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 0) return 'link has expired';
  return `link works ${days} more day${days === 1 ? '' : 's'}`;
}
