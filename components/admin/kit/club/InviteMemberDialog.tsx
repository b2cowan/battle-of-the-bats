'use client';
/**
 * Invite someone — the kit's invite form (Club Tier Stage 1, specimen 5). ONE dropdown, grouped
 * (house rule: a field that picks one value is a dropdown), offering every board role this
 * organization can hand out — the SAME list the invite route accepts (`/api/admin/members/roles`,
 * lib/board-roles.ts), so it can never offer a role the server refuses. The sentence under the field
 * says what the chosen role opens (A13). League roles appear only when the club runs a house league
 * (Ask 2). The Coach row is Stage 2's, with its "Invite a coach" door (ruling D10) — not offered here.
 *
 * A scorekeeper keeps today's "Helping with" field (J1-077): it only chooses where the link lands.
 */
import { useState, type FormEvent } from 'react';
import type { OrgRole } from '@/lib/types';
import KitDialog from './KitDialog';
import PageNotice, { refusalNotice } from './PageNotice';
import type { AssignableRoleOption } from './members-types';
import ck from './ClubKit.module.css';

const PURPOSES = [
  { value: 'both', label: 'Both', hint: 'Opens the scorekeeper screen, with a one-tap link to the gate board.' },
  { value: 'scorekeeping', label: 'Scorekeeping', hint: 'Opens the scorekeeper screen to submit game scores.' },
  { value: 'gate', label: 'Gate / check-in', hint: 'Opens the gate board to check teams in.' },
] as const;
type Purpose = typeof PURPOSES[number]['value'];

export function roleGroupLabel(group: AssignableRoleOption['group'], noun: string): string {
  if (group === 'house_league') return 'House league';
  if (group === 'volunteers') return 'Volunteers';
  return `Runs the ${noun}`;
}

/** The grouped options, in the route's order; a group with nothing in it has no heading. */
export function RoleOptions({ roles, noun, extra }: { roles: AssignableRoleOption[]; noun: string; extra?: { role: OrgRole; label: string } }) {
  const groups = (['runs_the_club', 'house_league', 'volunteers'] as const)
    .map(g => ({ g, items: roles.filter(r => r.group === g) }))
    .filter(x => x.items.length > 0);
  return (
    <>
      {extra && <option value={extra.role}>{extra.label}</option>}
      {groups.map(({ g, items }) => (
        <optgroup key={g} label={roleGroupLabel(g, noun)}>
          {items.map(r => (
            <option key={r.role} value={r.role}>{r.hint ? `${r.label} — ${r.hint}` : r.label}</option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

export default function InviteMemberDialog({
  orgName,
  orgQuery,
  noun,
  roles,
  rolesFailed,
  onRetryRoles,
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
  /** Plan & billing, for the owner — offered beside a seat-limit refusal. */
  billingHref: string | null;
  onClose: () => void;
  onInvited: (notice: string) => void;
}) {
  const [email, setEmail] = useState('');
  // Staff was today's default; it stays the default where it is offered.
  const [role, setRole] = useState<OrgRole | ''>('');
  const [purpose, setPurpose] = useState<Purpose>('both');
  const [sending, setSending] = useState(false);
  const [refusal, setRefusal] = useState<{ text: string; seat: boolean } | null>(null);

  const chosen = role || (roles?.some(r => r.role === 'staff') ? 'staff' : roles?.[0]?.role) || '';
  const chosenRole = roles?.find(r => r.role === chosen) ?? null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!chosen) return;
    setSending(true);
    setRefusal(null);
    try {
      const res = await fetch(`/api/admin/members/invite${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: chosen, ...(chosen === 'official' ? { purpose } : {}) }),
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
              <select id="kit-invite-role" className={ck.select} value={chosen} onChange={e => setRole(e.target.value as OrgRole)} required>
                <RoleOptions roles={roles} noun={noun} />
              </select>
              {chosenRole?.opens && <p className={ck.hint}>{chosenRole.opens}</p>}
            </>
          ) : rolesFailed ? (
            <p className={ck.hint}>
              The roles didn’t load.{' '}
              <button type="button" className={ck.link} onClick={onRetryRoles}>Try again</button>
            </p>
          ) : (
            <p className={ck.hint}>Loading…</p>
          )}
        </div>
        {chosen === 'official' && (
          <div className={ck.field}>
            <label className={ck.label} htmlFor="kit-invite-purpose">Helping with</label>
            <select id="kit-invite-purpose" className={ck.select} value={purpose} onChange={e => setPurpose(e.target.value as Purpose)}>
              {PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <p className={ck.hint}>{PURPOSES.find(p => p.value === purpose)?.hint}</p>
          </div>
        )}
      </form>
    </KitDialog>
  );
}
