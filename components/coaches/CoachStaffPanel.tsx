'use client';
import { useCallback, useEffect, useId, useState } from 'react';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import Link from 'next/link';
import { Lock, UserPlus } from 'lucide-react';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import CoachLoading from '@/components/coaches/CoachLoading';
import CoachStaffSheet, {
  EVERYDAY, SENSITIVE, daysLeftLabel, type PendingInvite, type SheetTarget, type StaffMember,
} from '@/components/coaches/CoachStaffSheet';
import {
  STAFF_KIND_COPY, staffKindLabel, staffKindWord, scheduleAccessOf, canViewScoutingBook,
  type CoachCapabilities, type StaffKind,
} from '@/lib/coach-capabilities';
import { formatStoredDate } from '@/lib/timezone';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import css from './CoachStaffPanel.module.css';

/**
 * ═══ THE STAFF PAGE IS A LIST OF PEOPLE (pass 2 of the staff access plan, owner-approved
 * 2026-09-10 on the round-2 mockup) ═══
 *
 * One row each — the head coach included, pending invites included — with a role chip, a
 * one-line summary of what they can open (sensitive grants in amber), and a door into the sheet
 * that holds every control. The whole staff fits above the fold on a laptop and on a phone.
 * Inviting is one button in the page header (the page owns the header; this panel owns the sheet).
 *
 * Retired with the rebuild: the invite card, the access-explainer card, the Helper/Assistant radio
 * pair, the per-person control grid, the helper card and the reference rail — three copies of one
 * explanation and ~560px per person. The explanation now lives in ONE place, the sheet, beside the
 * control it explains.
 *
 * M1 (owner ruling 2026-08-16): staff is THE TEAM'S — one list, no season attached. Removing
 * someone revokes their access to every screen and every season at once.
 */

type Caps = CoachCapabilities;

/** The role chip's word and colour class, from the stored kind (or the derived fallback). */
const ROLE_CLASS: Record<StaffKind, string> = {
  assistant: '', manager: css.role_manager, treasurer: css.role_treasurer, helper: css.role_helper,
};
function roleChip(member: StaffMember): { label: string; cls: string } {
  const kind = staffKindLabel(member.capabilities, member.staffKind);
  return { label: staffKindWord(member.capabilities, member.staffKind), cls: kind === 'head' ? css.roleHead : ROLE_CLASS[kind] };
}

/** The row's short word for a three-way control, from the same table the sheet renders. */
const CHIP_WORD: Record<string, string> = { 'Team money': 'Money' };

/**
 * The access chips — derived from the SHEET'S control table, so a grant's name, order and
 * sensitive flag are written once; and from the grants, never from the kind: the chips say what
 * the person CAN OPEN, which is the one thing the kind does not decide. Each chip carries its
 * phone form too ("Schedule (edit)"), built here rather than parsed back out of the label.
 */
function accessChips(c: Caps): Array<{ label: string; phone: string; sensitive: boolean }> {
  const out: Array<{ label: string; phone: string; sensitive: boolean }> = [];
  for (const control of [...EVERYDAY, ...SENSITIVE]) {
    const name = CHIP_WORD[control.label] ?? control.label;
    if (control.kind === 'seg') {
      const value = control.key === 'schedule' ? scheduleAccessOf(c) : c[control.key];
      const opt = control.options.find(o => o.value === value);
      if (!opt?.chip) continue;
      out.push({ label: `${name} · ${opt.chip}`, phone: `${name} (${opt.chip})`, sensitive: !!control.sensitive });
    } else {
      // The pooled book is readable only with the schedule — the same predicate its route uses.
      const on = control.key === 'scoutingBook' ? canViewScoutingBook(c) : c[control.key];
      if (on) out.push({ label: name, phone: name, sensitive: !!control.sensitive });
    }
  }
  return out;
}

/**
 * The one quiet sentence after the chips, for the two kinds whose absence is the point. Derived
 * from the grants as well: the helper's line holds only while they are genuinely out of the chat,
 * the treasurer's only while contacts are genuinely off.
 */
function rowNote(kind: 'head' | StaffKind, c: Caps): string | null {
  if (kind === 'helper' && !c.staffChat) return 'Nothing else, not the staff chat.';
  if (kind === 'treasurer' && !c.rosterPii) return 'Names beside the dues; no family contacts unless you add them.';
  return null;
}

export default function CoachStaffPanel({ orgSlug, teamId, teamName, inviteOpen, onInviteOpenChange }: {
  orgSlug: string;
  teamId: string;
  teamName: string;
  /** The page header's "Invite someone" owns this flag; the panel owns the sheet it opens. */
  inviteOpen: boolean;
  onInviteOpenChange: (open: boolean) => void;
}) {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [handOverOpen, setHandOverOpen] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const confirm = useConfirm();
  const uid = useId();
  const base = `/api/coaches/${orgSlug}/teams/${teamId}/staff`;

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await fetch(base);
      if (!res.ok) throw new Error('Could not load the coaching staff.');
      const json = await res.json();
      setStaff(json.staff ?? []);
      setPending(json.pending ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load the coaching staff.');
    }
  }, [base]);

  useEffect(() => { void load(); }, [load]);

  const headCoachCount = (staff ?? []).filter(s => s.coachRole === 'head_coach').length;
  const target: SheetTarget | null = inviteOpen ? { mode: 'invite' } : sheet;

  function closeSheet() {
    if (inviteOpen) onInviteOpenChange(false);
    setSheet(null);
  }

  // The sheet reports every change so the list never has to re-fetch to stay honest; an ordering
  // change (a promotion) re-sorts the way the server does — head coaches first, then by joining.
  function replaceMember(m: StaffMember) {
    setStaff(prev => {
      if (!prev) return prev;
      const next = prev.map(s => (s.memberId === m.memberId ? m : s));
      return next.sort((a, b) => {
        if (a.coachRole !== b.coachRole) return a.coachRole === 'head_coach' ? -1 : 1;
        return a.joinedAt.localeCompare(b.joinedAt);
      });
    });
    setSheet(prev => (prev?.mode === 'member' && prev.member.memberId === m.memberId ? { mode: 'member', member: m } : prev));
  }
  function replaceInvite(i: PendingInvite) {
    setPending(prev => (prev.some(p => p.inviteId === i.inviteId) ? prev.map(p => (p.inviteId === i.inviteId ? i : p)) : [i, ...prev]));
    setSheet(prev => (prev?.mode === 'pending' && prev.invite.inviteId === i.inviteId ? { mode: 'pending', invite: i } : prev));
  }

  /**
   * Resend and Cancel live on the pending ROW (mockup §02) and again in the sheet's footer, so the
   * panel owns them once and both doors call the same pair. Resend mints a fresh invite that
   * supersedes the old one, so the row is swapped for the new one rather than edited in place.
   */
  async function resendInvite(invite: PendingInvite): Promise<boolean> {
    setBusyInviteId(invite.inviteId); setNotice('');
    try {
      const res = await fetch(`${base}/invites/${invite.inviteId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resend' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'The invite could not be resent.');
      setPending(prev => prev.filter(p => p.inviteId !== invite.inviteId));
      if (json.invite) replaceInvite({ ...invite, ...json.invite });
      setNotice(json.pendingApproval
        ? `Your club now approves staff invites — the one to ${invite.email} is waiting for your club admin.`
        : `Invite sent again to ${invite.email}.`);
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'The invite could not be resent.');
      return false;
    } finally {
      setBusyInviteId(null);
    }
  }
  async function cancelInvite(invite: PendingInvite): Promise<boolean> {
    const ok = await confirm({
      title: `Cancel the invite to ${invite.email}?`,
      message: 'Their link stops working. You can invite them again any time.',
      confirmText: 'Cancel invite', cancelText: 'Keep it', tone: 'danger',
    });
    if (!ok) return false;
    setBusyInviteId(invite.inviteId); setNotice('');
    try {
      const res = await fetch(`${base}/invites/${invite.inviteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('The invite could not be cancelled.');
      setPending(prev => prev.filter(p => p.inviteId !== invite.inviteId));
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'The invite could not be cancelled.');
      return false;
    } finally {
      setBusyInviteId(null);
    }
  }

  const people = staff ?? [];
  const empty = staff !== null && people.every(s => s.isSelf) && pending.length === 0;

  return (
    <section className={css.wrap} aria-labelledby={`${uid}-title`}>
      {/* The page h1 names this screen; the heading exists for the document outline only. */}
      <h2 id={`${uid}-title`} className={css.srOnly}>Coaching staff</h2>

      {loadError && <p className={styles.errorText}>{loadError}</p>}
      {notice && <p className={css.notice} role="status">{notice}</p>}

      {!staff && !loadError && <CoachLoading label="Loading staff…" inline />}

      {staff && (
        <div className={css.list}>
          {people.map(member => {
            const chip = roleChip(member);
            const kind = staffKindLabel(member.capabilities, member.staffKind);
            const chips = kind === 'head' ? [] : accessChips(member.capabilities);
            const note = kind === 'head' ? 'Everything — including this page.' : rowNote(kind, member.capabilities);
            const name = member.displayName || member.email || chip.label;
            return (
              <div key={member.memberId} className={css.row}>
                <div className={css.who}>
                  <span className={css.name}>
                    {name}
                    {member.isSelf && <span className={css.you}> (you)</span>}
                  </span>
                  {member.email && member.displayName && <span className={css.email}>{member.email}</span>}
                  {member.alsoFollowsTeam && <span className={css.fam}>Also follows the team as a family member</span>}
                </div>
                <div className={css.role}><span className={`${css.roleChip} ${chip.cls}`}>{chip.label}</span></div>
                <div className={css.caps}>
                  {chips.map(c => (
                    <span key={c.label} className={c.sensitive ? `${css.chip} ${css.chipSens}` : css.chip}>
                      {c.sensitive && <Lock size={10} aria-hidden />}
                      {c.label}
                    </span>
                  ))}
                  {note && <span className={css.capNote}>{note}</span>}
                </div>
                {/* The phone reads one line of words instead of a wrap of chips (mockup §06). */}
                <p className={css.capsLine} aria-hidden>
                  {chips.map((c, i) => (
                    <span key={c.label} className={c.sensitive ? css.capsLineSens : undefined}>
                      {i > 0 && ' · '}{c.phone}
                    </span>
                  ))}
                  {chips.length === 0 && note}
                </p>
                <div className={css.act}>
                  {member.isSelf ? (
                    <button type="button" className={css.quietLink} aria-expanded={handOverOpen}
                      onClick={() => setHandOverOpen(o => !o)}>
                      Hand over to someone else <span aria-hidden>›</span>
                    </button>
                  ) : (
                    <button type="button" className={css.rowLink} onClick={() => setSheet({ mode: 'member', member })}
                      aria-label={`Edit access for ${name}`}>
                      <span className={css.rowLinkLabel}>Edit access</span> <span aria-hidden>›</span>
                    </button>
                  )}
                </div>
                {member.isSelf && handOverOpen && (
                  <p className={css.handOver}>
                    Open the other person’s access and choose <strong>Make head coach</strong>. Once they’re a head coach they
                    can make you an assistant coach, or remove you — the team always keeps at least one head coach.
                  </p>
                )}
              </div>
            );
          })}

          {pending.map(invite => {
            const kindCopy = STAFF_KIND_COPY[invite.staffKind ?? 'assistant'];
            const sensitive = accessChips(invite.capabilities).filter(c => c.sensitive).length;
            return (
              <div key={invite.inviteId} className={`${css.row} ${css.pending}`}>
                <div className={css.who}>
                  <span className={css.name}>{invite.email}</span>
                  <span className={css.email}>
                    {invite.status === 'pending_approval'
                      ? `Invited ${formatStoredDate(invite.createdAt, { withYear: false })} · waiting for your club admin to approve`
                      : `Invited ${formatStoredDate(invite.createdAt, { withYear: false })} · ${daysLeftLabel(invite.expiresAt)}`}
                  </span>
                </div>
                <div className={css.role}><span className={`${css.roleChip} ${css.roleInvited}`}>Invited</span></div>
                <div className={`${css.caps} ${css.capsPending}`}>
                  <span className={css.capNote}>
                    Will start as <strong>{kindCopy.asA}</strong>
                    {sensitive > 0 ? ` with ${sensitive} sensitive grant${sensitive === 1 ? '' : 's'}.` : ' with the everyday tools.'}
                  </span>
                  <button type="button" className={css.rowLink} onClick={() => setSheet({ mode: 'pending', invite })}>
                    Change that before they accept <span aria-hidden>›</span>
                  </button>
                </div>
                <p className={css.capsLine} aria-hidden>Will start as {kindCopy.asA}</p>
                <div className={css.act}>
                  {invite.status === 'pending' && (
                    <button type="button" className={`${styles.btnSecondary} ${css.rowBtn}`} disabled={busyInviteId === invite.inviteId}
                      onClick={() => void resendInvite(invite)}>Resend</button>
                  )}
                  <button type="button" className={`${styles.btnGhost} ${css.rowBtn}`} disabled={busyInviteId === invite.inviteId}
                    onClick={() => void cancelInvite(invite)}>Cancel</button>
                  <button type="button" className={`${css.rowLink} ${css.rowLinkPhone}`} onClick={() => setSheet({ mode: 'pending', invite })}
                    aria-label={`Open the invite to ${invite.email}`}>
                    <span aria-hidden>›</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {empty && (
        // Quiet, at the weight of the list it sits under: the invite button is in the header above.
        <CoachEmptyState
          quiet
          icon={<UserPlus size={18} aria-hidden />}
          headline="Just you so far"
          description="Invite an assistant coach, a team manager, a treasurer or a helper — each gets their own sign-in, and you choose what they can open before the email goes out."
          payoff="They can add games while you run practice, keep the books, or take attendance on game day, and it all lands in the same team."
          primaryAction={{ label: 'Invite someone', icon: <UserPlus size={15} aria-hidden />, onClick: () => onInviteOpenChange(true) }}
        />
      )}

      {staff && (
        <p className={css.foot}>
          <span>Everyone signs in as themselves. Removing someone ends their access to every screen and every season at once.</span>
          <Link href={`/${orgSlug}/coaches/help#premium-staff`}>How staff access works</Link>
        </p>
      )}

      {target && (
        <CoachStaffSheet
          orgSlug={orgSlug}
          teamId={teamId}
          teamName={teamName}
          target={target}
          headCoachCount={headCoachCount}
          onClose={closeSheet}
          onMemberChanged={replaceMember}
          onMemberRemoved={id => setStaff(prev => prev?.filter(s => s.memberId !== id) ?? prev)}
          onInviteChanged={replaceInvite}
          onInviteCreated={note => { setNotice(note); void load(); }}
          onResendInvite={resendInvite}
          onCancelInvite={cancelInvite}
        />
      )}
    </section>
  );
}
