'use client';
/**
 * Invite someone — the kit's invite form (Club Tier Stage 1, specimen 5). ONE dropdown, grouped
 * (house rule: a field that picks one value is a dropdown), offering every board role this
 * organization can hand out — the SAME list the invite route accepts (`/api/admin/members/roles`,
 * lib/board-roles.ts), so it can never offer a role the server refuses. The sentence under the field
 * says what the chosen role opens (A13). League roles appear only when the club runs a house league
 * (Ask 2). The Coach row is Stage 2's, with its "Invite a coach" door (ruling D10) — not offered here.
 *
 * A volunteer's "Helping with" is what they can do (Stage 6, A26, ruled 2026-10-07): the route writes
 * the job onto their row, every landing follows it, and Members' Manage changes it later. It used to
 * choose only where the email's link landed (J1-077), and was kept nowhere.
 */
import { useState, type FormEvent } from 'react';
import type { OrgRole } from '@/lib/types';
import { VOLUNTEER_JOBS, type VolunteerJob } from '@/lib/volunteer-jobs';
import { HELPING_WITH } from '@/lib/volunteer-words';
import KitDialog from './KitDialog';
import PageNotice, { refusalNotice } from './PageNotice';
import type { AssignableRoleOption } from './members-types';
import ck from './ClubKit.module.css';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import SublinedChoice, { type SublinedOption } from '@/components/coaches/SublinedChoice';
import LoadingState from '@/components/shared/LoadingState';

/**
 * The invite's empty role field (Stage 13b B1). The line under it once a role is chosen is the picker's own sentence, as
 * it always was, with no frame: /review found "Written to them: …" untrue for a volunteer (the email carries the JOB's
 * note, which follows "Helping with") and for an admin (the email drops "but not its billing or settings").
 */
const INVITE_ROLE_WORDS = { choose: 'Choose a role' } as const;

/** "Helping with" — the field the invite and Manage share (one control, one set of words). */
export function HelpingWithField({ id, value, onChange, hintTail }: {
  id: string;
  value: VolunteerJob | null;
  onChange: (job: VolunteerJob) => void;
  /** The invite adds "Change it any time in Members."; Manage, which is Members, does not. */
  hintTail?: string;
}) {
  return (
    <div className={ck.field}>
      <label className={ck.label} htmlFor={id}>{HELPING_WITH.label}<span className={ck.required} aria-hidden>*</span></label>
      <select id={id} className={ck.select} value={value ?? ''} onChange={e => onChange(e.target.value as VolunteerJob)} required>
        {!value && <option value="" disabled>{HELPING_WITH.none}</option>}
        {VOLUNTEER_JOBS.map(job => <option key={job} value={job}>{HELPING_WITH.option[job]}</option>)}
      </select>
      {value && <p className={ck.hint}>{HELPING_WITH.hint[value]}{hintTail ? ` ${hintTail}` : ''}</p>}
    </div>
  );
}

export function roleGroupLabel(group: AssignableRoleOption['group'], noun: string): string {
  if (group === 'house_league') return 'House league';
  if (group === 'volunteers') return 'Volunteers';
  return `Runs the ${noun}`;
}

/** The grouped options, in the route's order; a group with nothing in it has no heading. */
/** The role field, for Invite and Manage: the portal's sub-lined dropdown (owner, 2026-10-19 — "our portal convention
 *  is subtext below the main text", the coach's Record window). Each role's name, its hint on the line under it, in
 *  its group. It replaced a native `<select>` whose options read "League registrar — league sign-ups": a native list
 *  cannot carry a second line. The closed field wears the kit's own select look, so it sits like the fields around it. */
export function RolePicker({ id, roles, noun, value, onChange, extra, placeholder }: {
  id: string;
  roles: AssignableRoleOption[];
  noun: string;
  /** Null = nothing chosen yet (the invite, Stage 13b B1: no default role); the field shows `placeholder`. */
  value: OrgRole | null;
  onChange: (role: OrgRole) => void;
  extra?: { role: OrgRole; label: string };
  placeholder?: string;
}) {
  const options: SublinedOption<OrgRole>[] = [
    ...(extra ? [{ value: extra.role, name: extra.label, sub: '' }] : []),
    ...(['runs_the_club', 'house_league', 'volunteers'] as const).flatMap(g =>
      roles.filter(r => r.group === g).map(r => ({ value: r.role, name: r.label, sub: r.hint ?? '', group: roleGroupLabel(g, noun) })),
    ),
  ];
  return (
    <SublinedChoice
      id={id}
      label="Role"
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      variant="toolbar"
      triggerClassName={`${ck.select} ${shared.convChoiceToolbarField}`}
    />
  );
}

export default function InviteMemberDialog({
  orgName,
  orgQuery,
  noun,
  roles,
  rolesFailed,
  onRetryRoles,
  initialRole = null,
  billingHref,
  onClose,
  onInvited,
}: {
  orgName: string;
  orgQuery: string;
  noun: string;
  roles: AssignableRoleOption[] | null;
  rolesFailed: boolean;
  onRetryRoles: () => void;
  /** The role to open on — the Staff kit's "Invite a volunteer" door chooses the volunteer role. */
  initialRole?: OrgRole | null;
  /** Plan & billing, for the owner — offered beside a seat-limit refusal. */
  billingHref: string | null;
  onClose: () => void;
  onInvited: (notice: string) => void;
}) {
  const [email, setEmail] = useState('');
  // ⚖ No default role (Stage 13b B1, Ask 10 = A): the field starts on "Choose a role" and Send stays off until one is
  // chosen. It used to fall back to Staff without a word, so a treasurer could go out as Staff. The Staff kit's door
  // still opens on the volunteer role (`initialRole`).
  const [role, setRole] = useState<OrgRole | null>(initialRole);
  const [job, setJob] = useState<VolunteerJob>('both');
  const [sending, setSending] = useState(false);
  const [refusal, setRefusal] = useState<{ text: string; seat: boolean } | null>(null);

  // A role the list no longer offers (the plan changed under an open dialog) is not a choice.
  const chosenRole = roles?.find(r => r.role === role) ?? null;
  const chosen = chosenRole?.role ?? null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!chosen) return;
    setSending(true);
    setRefusal(null);
    try {
      const res = await fetch(`/api/admin/members/invite${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: chosen, ...(chosen === 'official' ? { purpose: job } : {}) }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; code?: string; added?: boolean };
      if (!res.ok) {
        setRefusal({ text: data.error ?? 'The invitation didn’t go out. Try again.', seat: data.code === 'seat_limit_reached' });
        return;
      }
      onInvited(data.added
        ? `${email} was added to ${orgName}. They’ll get an email to sign in — if it isn’t in their inbox, ask them to check their spam or junk folder.`
        : `Invite sent to ${email}. The setup link expires in 24 hours, so ask them to accept it today — and to check their spam or junk folder if it isn’t in their inbox.`);
    } catch {
      setRefusal({ text: 'The invitation didn’t go out. Check your connection and try again.', seat: false });
    } finally {
      setSending(false);
    }
  }

  return (
    <KitDialog
      kind="form"
      title={`Invite someone to ${orgName}`}
      onClose={onClose}
      busy={sending}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={sending}>Cancel</button>
          <button type="submit" form="kit-invite-form" className="btn btn-lime" disabled={sending || !chosen} id="invite-submit-btn">
            {sending ? 'Sending…' : 'Send invite'}
          </button>
        </>
      }
    >
      <form id="kit-invite-form" onSubmit={submit}>
        {refusal && <PageNotice notice={refusalNotice(refusal, billingHref)} />}
        <div className={ck.field}>
          <label className={ck.label} htmlFor="kit-invite-email">Email<span className={ck.required} aria-hidden>*</span></label>
          <input
            id="kit-invite-email"
            type="email"
            className={ck.input}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="off"
            placeholder="name@example.com"
          />
        </div>
        <div className={ck.field}>
          <label className={ck.label} htmlFor="kit-invite-role">Role<span className={ck.required} aria-hidden>*</span></label>
          {roles ? (
            <>
              <RolePicker id="kit-invite-role" roles={roles} noun={noun} value={chosen} onChange={setRole} placeholder={INVITE_ROLE_WORDS.choose} />
              {/* What they will open (F-A5-7's preview is this line, not a screen), shown once a role is chosen. */}
              {chosenRole?.opens && <p className={ck.hint}>{chosenRole.opens}</p>}
            </>
          ) : rolesFailed ? (
            <p className={ck.hint}>
              The roles didn’t load.{' '}
              <button type="button" className={ck.link} onClick={onRetryRoles}>Try again</button>
            </p>
          ) : (
            <LoadingState inline label="Loading the roles…" />
          )}
        </div>
        {chosen === 'official' && (
          <HelpingWithField id="kit-invite-purpose" value={job} onChange={setJob} hintTail={HELPING_WITH.changeLater} />
        )}
      </form>
    </KitDialog>
  );
}
