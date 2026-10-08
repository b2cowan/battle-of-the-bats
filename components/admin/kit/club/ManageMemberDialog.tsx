'use client';
/**
 * Manage member — the kit's form (Club Tier Stage 1, specimen 5, "one save, and a question before
 * suspending").
 *
 *   · ONE Save for role, title, display name and access together (J10-021) — one PATCH, plus the
 *     tournament-access list when it changed (its own route). The mid-dialog "Save Overrides" is gone.
 *   · "What Sam can open": one row per program the plan carries, from the one access computation
 *     (`whatTheyCanOpen`), with Role default / Turn on / Turn off and a consequence sentence the
 *     moment a change would open or close a program (J10-023). The fourteen tournament verbs fold
 *     under "Tournaments ›".
 *   · Plan & billing and organization settings are NOT offered (J10-022) — they stay with the owner.
 *   · Suspend asks first, in a question on top of the form (J10-018), and says what is kept.
 *
 * Only an OWNER changes access overrides or suspends (the member route's rule); a board member who
 * can manage members sees the access rows read-only — never a control the server would refuse.
 *
 * A VOLUNTEER is the exception (Tournament admin redesign Stage 6, P1 + P2, owner 2026-10-07): in
 * place of the program table — every row of which is "No" for a volunteer, whom the admin sends to
 * their job — Manage shows the invite's own "Helping with", and whoever may invite may change it.
 * It writes only a volunteer's two job keys (`withVolunteerJob`); a volunteer always keeps one job.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { whatTheyCanOpen, describeAccessChange, roleLabel, type ProgramAccess } from '@/lib/member-access';
import type { Capability } from '@/lib/roles';
import type { Organization, OrgRole } from '@/lib/types';
import { formatInOrgZone } from '@/lib/timezone';
import KitDialog from './KitDialog';
import PageNotice, { refusalNotice } from './PageNotice';
import { RoleOptions, HelpingWithField } from './InviteMemberDialog';
import { volunteerJobOf, withVolunteerJob, type VolunteerJob } from '@/lib/volunteer-jobs';
import { HELPING_WITH } from '@/lib/volunteer-words';
import { consequence } from './member-summary';
import {
  memberFirstName, memberName, type KitMember, type AssignableRoleOption, type TournamentOption, type RepGroupOption,
} from './members-types';
import ck from './ClubKit.module.css';
import styles from './Members.module.css';

/** The tournament fine-grained controls, folded under "Tournaments ›" (specimen 5). */
const TOURNAMENT_CONTROLS: { cap: Capability; label: string }[] = [
  { cap: 'create_tournaments', label: 'Create and delete tournaments' },
  { cap: 'manage_registrations', label: 'Manage registrations' },
  { cap: 'manage_schedule_structure', label: 'Manage the schedule and brackets' },
  { cap: 'update_schedule', label: 'Update game times and venues' },
  { cap: 'submit_scores', label: 'Submit scores' },
  { cap: 'check_in_teams', label: 'Check teams in at the gate' },
  { cap: 'manage_contacts', label: 'Manage contacts and venues' },
  { cap: 'post_announcements', label: 'Post announcements' },
  { cap: 'post_rules', label: 'Post and edit rules documents' },
  { cap: 'send_communications', label: 'Send email communications' },
  { cap: 'seal_tournaments', label: 'Seal (archive) tournaments' },
  { cap: 'manage_branding', label: 'Manage tournament branding' },
  { cap: 'module_communications', label: 'Communications' },
];

type Refusal = { text: string; seat?: boolean };
type Ask = 'suspend' | 'remove' | null;
type RemoveImpact = { tournamentCount: number; divisionCount: number; otherOrgCount: number; coachingAssignmentCount: number; basicCoachTeamCount: number };

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
const sameCaps = (a: Record<string, boolean> | null, b: Record<string, boolean>) => {
  const x = a ?? {};
  const keys = new Set([...Object.keys(x), ...Object.keys(b)]);
  for (const k of keys) if (x[k] !== b[k]) return false;
  return true;
};

export default function ManageMemberDialog({
  member,
  org,
  orgQuery,
  noun,
  viewerRole,
  isSelf,
  canManage,
  roles,
  tournaments,
  repGroups,
  billingHref,
  onClose,
  onChanged,
}: {
  member: KitMember;
  org: Organization;
  orgQuery: string;
  noun: string;
  viewerRole: OrgRole;
  isSelf: boolean;
  canManage: boolean;
  roles: AssignableRoleOption[] | null;
  tournaments: TournamentOption[];
  repGroups: RepGroupOption[];
  billingHref: string | null;
  onClose: () => void;
  /** Reload the list; `notice` for the page; `close` when the form's work is done. */
  onChanged: (notice: string | null, close: boolean) => Promise<void> | void;
}) {
  const viewerIsOwner = viewerRole === 'owner';
  const targetIsOwner = member.role === 'owner';
  const name = memberName(member);
  const first = memberFirstName(member);

  const [role, setRole] = useState<OrgRole>(member.role);
  const [title, setTitle] = useState(member.title ?? '');
  const [displayName, setDisplayName] = useState(member.displayName ?? '');
  const [caps, setCaps] = useState<Record<string, boolean>>(() => ({ ...(member.capabilities ?? {}) }));
  const [job, setJob] = useState<VolunteerJob | null>(() => volunteerJobOf(member.capabilities));
  const [assignments, setAssignments] = useState<string[]>(() => [...member.assignedTournamentIds]);
  const [groupIds, setGroupIds] = useState<string[]>(() => [...member.repGroupIds]);
  const [saving, setSaving] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask>(null);
  const [acting, setActing] = useState(false);
  const [impact, setImpact] = useState<RemoveImpact | null>(null);

  // The saved answer and the draft's answer, from the ONE computation the gates use.
  const saved = useMemo(() => new Map(member.access.map(a => [a.module, a.canOpen])), [member.access]);
  const draftAccess: ProgramAccess[] = useMemo(
    () => whatTheyCanOpen({ role, capabilities: Object.keys(caps).length ? caps : null }, org),
    [role, caps, org],
  );
  const draftOpens = (cap: Capability) => draftAccess.find(a => a.module === cap)?.canOpen ?? false;

  const canChangeRole = canManage && !targetIsOwner && !isSelf;
  const canChangeAccess = viewerIsOwner && !targetIsOwner;
  const canScopeGroups = (viewerRole === 'owner' || viewerRole === 'admin') && !targetIsOwner && repGroups.length > 0;
  const canScopeTournaments = canManage && !targetIsOwner && tournaments.length > 0;

  // A volunteer's access is their job (P1): "Helping with", for anyone who may invite.
  const isVolunteer = role === 'official' && !targetIsOwner;
  const canChangeJob = isVolunteer && canManage && !isSelf;

  const roleChanged = role !== member.role;
  const titleChanged = title.trim() !== (member.title ?? '');
  const nameChanged = displayName.trim() !== (member.displayName ?? '');
  const capsChanged = !isVolunteer && canChangeAccess && !sameCaps(member.capabilities, caps);
  const jobChanged = canChangeJob && job !== null && job !== volunteerJobOf(member.capabilities);
  // The access this save writes — the owner's program table, or a volunteer's job; undefined when neither moved.
  const nextCaps = capsChanged
    ? (Object.keys(caps).length ? caps : null)
    : jobChanged && job ? withVolunteerJob(member.capabilities, job) : undefined;
  const groupsChanged = canScopeGroups && !sameSet(groupIds, member.repGroupIds);
  const assignmentsChanged = canScopeTournaments && !sameSet(assignments, member.assignedTournamentIds);

  // The removal warning names what the person keeps and loses (J4-036), read when the question opens.
  useEffect(() => {
    if (ask !== 'remove') return;
    let stale = false;
    setImpact(null);
    fetch(`/api/admin/members/${member.id}${orgQuery}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!stale && d) setImpact(d as RemoveImpact); })
      .catch(() => {});
    return () => { stale = true; };
  }, [ask, member.id, orgQuery]);

  const override = (cap: Capability): 'default' | 'on' | 'off' =>
    cap in caps ? (caps[cap] ? 'on' : 'off') : 'default';
  const setOverride = (cap: Capability, value: 'default' | 'on' | 'off') => {
    setCaps(prev => {
      const next = { ...prev };
      if (value === 'default') delete next[cap];
      else next[cap] = value === 'on';
      return next;
    });
  };

  async function save() {
    setRefusal(null);
    setDone(null);
    const body: Record<string, unknown> = {};
    if (canChangeRole && roleChanged) body.role = role;
    if (titleChanged) body.title = title.trim() || null;
    if (nameChanged) body.displayName = displayName.trim() || null;
    if (nextCaps !== undefined) body.capabilities = nextCaps;
    if (groupsChanged) body.repGroupIds = groupIds;
    if (Object.keys(body).length === 0 && !assignmentsChanged) { onClose(); return; }

    setSaving(true);
    try {
      if (Object.keys(body).length > 0) {
        const res = await fetch(`/api/admin/members/${member.id}${orgQuery}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({})) as { error?: string; code?: string };
          setRefusal({ text: d.error ?? 'The changes didn’t save. Try again.', seat: d.code === 'seat_limit_reached' });
          return;
        }
      }
      if (assignmentsChanged) {
        const res = await fetch(`/api/admin/members/${member.id}/assignments${orgQuery}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tournamentIds: assignments }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({})) as { error?: string };
          await onChanged(null, false);
          setRefusal({ text: `Everything else is saved, but the tournament list didn’t: ${d.error ?? 'try again'}.` });
          return;
        }
      }
      // Promise the email only when the server sends one: it mails what changed about the PROGRAMS the
      // person can open (`describeAccessChange`), so a change to a tournament control alone sends nothing.
      const emailed = member.status === 'active' && describeAccessChange(
        { role: member.role, capabilities: member.capabilities },
        { role: canChangeRole ? role : member.role, capabilities: nextCaps !== undefined ? nextCaps : member.capabilities },
        org,
      ).length > 0;
      await onChanged(`${name}’s changes are saved.${emailed ? ` We’ve emailed ${first === 'They' ? 'them' : first} what changed.` : ''}`, true);
    } catch {
      setRefusal({ text: 'The changes didn’t save. Check your connection and try again.' });
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: 'active' | 'suspended') {
    setActing(true);
    setRefusal(null);
    try {
      const res = await fetch(`/api/admin/members/${member.id}${orgQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const d = await res.json().catch(() => ({})) as { error?: string };
      setAsk(null);
      if (!res.ok) { setRefusal({ text: d.error ?? 'That didn’t go through. Try again.' }); return; }
      await onChanged(
        status === 'suspended'
          ? `${name} is suspended. We’ve emailed ${first === 'They' ? 'them' : first} to say their access is paused.`
          : `${name} is reinstated.`,
        false,
      );
      setDone(status === 'suspended' ? `${name} is suspended.` : `${name} is reinstated.`);
    } finally {
      setActing(false);
    }
  }

  async function remove() {
    setActing(true);
    try {
      const res = await fetch(`/api/admin/members/${member.id}${orgQuery}`, { method: 'DELETE' });
      const d = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setAsk(null); setRefusal({ text: d.error ?? 'They weren’t removed. Try again.' }); return; }
      await onChanged(`${name} was removed from the ${noun}.`, true);
    } finally {
      setActing(false);
    }
  }

  async function resend() {
    setActing(true);
    setRefusal(null);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/reinvite${orgQuery}`, { method: 'POST' });
      const d = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setRefusal({ text: d.error ?? 'The invite didn’t go out. Try again.' }); return; }
      // The resend refreshes the invitation's date, which the list shows — read it again.
      await onChanged(null, false);
      setDone(`Invite resent to ${member.email}. The setup link expires in 24 hours, so ask them to accept it today.`);
    } finally {
      setActing(false);
    }
  }

  // ── The identity line: not a page header, so it keeps its second line (hub v8) ─────────────────
  const since = member.acceptedAt ? formatInOrgZone(member.acceptedAt, { month: 'long', year: 'numeric' }) : null;
  const identity = [
    member.displayName ? member.email : null,
    member.status === 'invited'
      ? `${roleLabel(member.role)} · invited, not yet joined`
      : since ? `${roleLabel(member.role)} since ${since}` : roleLabel(member.role),
    member.status === 'suspended' ? 'suspended' : null,
  ].filter(Boolean).join(' · ');

  const currentNotOffered = roles && !roles.some(r => r.role === member.role) && !targetIsOwner;

  const footerStart = (
    <>
      {viewerIsOwner && !targetIsOwner && member.status === 'active' && (
        <button type="button" className={`btn btn-outline ${styles.dangerText}`} onClick={() => setAsk('suspend')} disabled={saving || acting}>
          Suspend…
        </button>
      )}
      {viewerIsOwner && !targetIsOwner && member.status === 'suspended' && (
        <button type="button" className="btn btn-outline" onClick={() => void setStatus('active')} disabled={saving || acting}>
          {acting ? 'Reinstating…' : 'Reinstate'}
        </button>
      )}
      {canManage && member.status === 'invited' && (
        <button type="button" className="btn btn-outline" onClick={() => void resend()} disabled={saving || acting}>
          Resend invite
        </button>
      )}
      {canManage && !targetIsOwner && !isSelf && (
        <button type="button" className={`btn btn-outline ${styles.dangerText}`} onClick={() => setAsk('remove')} disabled={saving || acting}>
          Remove…
        </button>
      )}
    </>
  );

  return (
    <>
      <KitDialog
        kind="form"
        title={`Manage ${name}`}
        identity={identity}
        onClose={onClose}
        busy={saving}
        footerStart={footerStart}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="button" className="btn btn-lime" onClick={() => void save()} disabled={saving || acting}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        {refusal && <PageNotice notice={refusalNotice(refusal, billingHref)} />}
        {done && <PageNotice notice={{ tone: 'good', text: done }} />}

        {targetIsOwner ? (
          <p className={ck.hint}>Ownership can’t be changed here. Contact support if the organization’s owner needs to change.</p>
        ) : (
          <div className={ck.field}>
            <label className={ck.label} htmlFor="kit-manage-role">Role</label>
            {canChangeRole && roles ? (
              <select id="kit-manage-role" className={ck.select} value={role} onChange={e => setRole(e.target.value as OrgRole)}>
                <RoleOptions
                  roles={roles}
                  noun={noun}
                  extra={currentNotOffered ? { role: member.role, label: `${roleLabel(member.role)} (current)` } : undefined}
                />
              </select>
            ) : (
              <p className={styles.readValue}>{roleLabel(member.role)}</p>
            )}
            {canChangeRole && roles && roleChanged && (
              <p className={ck.hint}>{roles.find(r => r.role === role)?.opens}</p>
            )}
          </div>
        )}

        <div className={styles.twoFields}>
          <div className={ck.field}>
            <label className={ck.label} htmlFor="kit-manage-title">Title</label>
            <input id="kit-manage-title" className={ck.input} value={title} maxLength={80} onChange={e => setTitle(e.target.value)} placeholder="e.g. Vice-president" />
            <p className={ck.hint}>Shown under their name on this list.</p>
          </div>
          <div className={ck.field}>
            <label className={ck.label} htmlFor="kit-manage-name">Display name</label>
            <input id="kit-manage-name" className={ck.input} value={displayName} maxLength={60} onChange={e => setDisplayName(e.target.value)} />
            <p className={ck.hint}>Shown instead of their email.</p>
          </div>
        </div>

        {isVolunteer && (canChangeJob ? (
          <HelpingWithField id="kit-manage-purpose" value={job} onChange={setJob} />
        ) : (
          <div className={ck.field}>
            <span className={ck.label}>{HELPING_WITH.label}</span>
            <p className={styles.readValue}>{job ? HELPING_WITH.option[job] : '—'}</p>
          </div>
        ))}

        {!targetIsOwner && !isVolunteer && (
          <div className={styles.accessBlock}>
            <h3 className={styles.accessTitle}>What {first === 'They' ? 'they' : first} can open</h3>
            <table className={`${ck.table} ${styles.accessTable}`}>
              <thead>
                <tr>
                  <th scope="col">Program</th>
                  <th scope="col">As {/^[aeiou]/i.test(roleLabel(role)) ? 'an' : 'a'} {roleLabel(role)}</th>
                  <th scope="col">For {first === 'They' ? 'them' : first}</th>
                </tr>
              </thead>
              <tbody>
                {draftAccess.map(a => {
                  const sentence = consequence(a.module, saved.get(a.module) ?? false, a.canOpen, first, noun);
                  const fold = a.module === 'module_tournaments' && (canChangeAccess || canScopeTournaments) && a.canOpen ? 'tournaments'
                    : a.module === 'module_rep_teams' && canScopeGroups && a.canOpen ? 'rep-teams'
                    : a.module === 'module_members' && canChangeAccess ? 'members' : null;
                  return (
                    <AccessRow
                      key={a.module}
                      access={a}
                      value={override(a.module)}
                      editable={canChangeAccess}
                      onChange={v => setOverride(a.module, v)}
                      sentence={sentence}
                      fold={fold}
                    >
                      {fold === 'tournaments' && (
                        <>
                          {canChangeAccess && draftOpens('module_tournaments') && (
                            <div className={styles.foldList}>
                              {TOURNAMENT_CONTROLS.map(c => {
                                const v = override(c.cap);
                                return (
                                  <label key={c.cap} className={styles.foldRow}>
                                    <span>{c.label}</span>
                                    <select className={`${ck.select} ${styles.foldSelect}`} value={v} onChange={e => setOverride(c.cap, e.target.value as 'default' | 'on' | 'off')} aria-label={c.label}>
                                      <option value="default">Role default</option>
                                      <option value="on">Turn on</option>
                                      <option value="off">Turn off</option>
                                    </select>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                          {canScopeTournaments && draftOpens('module_tournaments') && (
                            <div className={styles.foldList}>
                              <p className={ck.hint}>
                                {assignments.length === 0
                                  ? 'Every tournament. Tick some to limit them to those.'
                                  : `Only ${assignments.length} tournament${assignments.length === 1 ? '' : 's'}.`}
                              </p>
                              {tournaments.map(t => (
                                <label key={t.id} className={styles.checkRow}>
                                  <input
                                    type="checkbox"
                                    checked={assignments.includes(t.id)}
                                    onChange={() => setAssignments(prev => (prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]))}
                                  />
                                  <span>{t.name}{t.year ? ` ${t.year}` : ''}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                      {fold === 'rep-teams' && (
                        <div className={styles.foldList}>
                          <p className={ck.hint}>
                            {groupIds.length === 0 ? 'Every team group. Tick some to limit them to those.' : `Only ${groupIds.length} group${groupIds.length === 1 ? '' : 's'}.`}
                          </p>
                          {repGroups.map(g => (
                            <label key={g.id} className={styles.checkRow}>
                              <input
                                type="checkbox"
                                checked={groupIds.includes(g.id)}
                                onChange={() => setGroupIds(prev => (prev.includes(g.id) ? prev.filter(id => id !== g.id) : [...prev, g.id]))}
                              />
                              <span>{g.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      {fold === 'members' && draftOpens('module_members') && (
                        <div className={styles.foldList}>
                          <label className={styles.foldRow}>
                            <span>Invite and manage members</span>
                            <select className={`${ck.select} ${styles.foldSelect}`} value={override('manage_members')} onChange={e => setOverride('manage_members', e.target.value as 'default' | 'on' | 'off')} aria-label="Invite and manage members">
                              <option value="default">Role default</option>
                              <option value="on">Turn on</option>
                              <option value="off">Turn off</option>
                            </select>
                          </label>
                        </div>
                      )}
                    </AccessRow>
                  );
                })}
              </tbody>
            </table>
            <p className={ck.hint}>Plan &amp; billing and organization settings stay with the owner; they can’t be handed out here.</p>
          </div>
        )}
      </KitDialog>

      {ask === 'suspend' && (
        <KitDialog
          kind="question"
          title={`Suspend ${name}?`}
          onClose={() => setAsk(null)}
          busy={acting}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsk(null)} disabled={acting}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={() => void setStatus('suspended')} disabled={acting} data-autofocus="">
                {acting ? 'Suspending…' : `Suspend ${first === 'They' ? 'them' : first}`}
              </button>
            </>
          }
        >
          <p>
            {first === 'They' ? 'They' : first} won’t be able to sign in to {org.name} until you reinstate them. Their role
            and access are kept. We’ll email {first === 'They' ? 'them' : first} to say their access is paused.
          </p>
        </KitDialog>
      )}

      {ask === 'remove' && (
        <KitDialog
          kind="question"
          title={`Remove ${name}?`}
          onClose={() => setAsk(null)}
          busy={acting}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsk(null)} disabled={acting}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={() => void remove()} disabled={acting || !impact} data-autofocus="">
                {acting ? 'Removing…' : 'Remove'}
              </button>
            </>
          }
        >
          {!impact ? (
            <p>Loading…</p>
          ) : (
            <>
              {/* J4-036: removal keeps the account whenever the person is anywhere else. */}
              {impact.otherOrgCount > 0 || impact.basicCoachTeamCount > 0 ? (
                <p>
                  This removes {first === 'They' ? 'them' : first} from {org.name}. Their account is kept
                  {impact.otherOrgCount > 0 ? `, along with their ${impact.otherOrgCount} other organization${impact.otherOrgCount === 1 ? '' : 's'}` : ''}.
                </p>
              ) : (
                <p>This permanently deletes their account. They would need a new invitation to come back.</p>
              )}
              {impact.coachingAssignmentCount > 0 && (
                <p>They hold {impact.coachingAssignmentCount} coaching assignment{impact.coachingAssignmentCount === 1 ? '' : 's'}, which {impact.coachingAssignmentCount === 1 ? 'is' : 'are'} lost.</p>
              )}
              {(impact.tournamentCount > 0 || impact.divisionCount > 0) && (
                <p>
                  They are the contact for
                  {impact.tournamentCount > 0 ? ` ${impact.tournamentCount} tournament${impact.tournamentCount === 1 ? '' : 's'}` : ''}
                  {impact.tournamentCount > 0 && impact.divisionCount > 0 ? ' and' : ''}
                  {impact.divisionCount > 0 ? ` ${impact.divisionCount} division${impact.divisionCount === 1 ? '' : 's'}` : ''}; those go back to the tournament’s default contact.
                </p>
              )}
            </>
          )}
        </KitDialog>
      )}
    </>
  );
}

/** One program row: its role default, the owner's choice, the consequence, and an optional fold. */
function AccessRow({
  access,
  value,
  editable,
  onChange,
  sentence,
  fold,
  children,
}: {
  access: ProgramAccess;
  value: 'default' | 'on' | 'off';
  editable: boolean;
  onChange: (v: 'default' | 'on' | 'off') => void;
  sentence: string | null;
  fold: string | null;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr>
        <td className={ck.cellTitle}>
          {fold ? (
            <button type="button" className={styles.foldToggle} aria-expanded={open} onClick={() => setOpen(o => !o)}>
              {access.label}
              <ChevronRight size={14} className={`${styles.foldChevron}${open ? ` ${styles.foldChevronOpen}` : ''}`} aria-hidden />
            </button>
          ) : access.label}
        </td>
        <td>{access.roleDefault ? 'Yes' : 'No'}</td>
        <td>
          {editable ? (
            // The meaningful choice only: a program the role already opens can be turned off, one it
            // does not can be turned on — never a "Turn on" that changes nothing.
            <select
              className={`${ck.select} ${styles.accessSelect}`}
              value={value === 'on' && access.roleDefault ? 'default' : value === 'off' && !access.roleDefault ? 'default' : value}
              onChange={e => onChange(e.target.value as 'default' | 'on' | 'off')}
              aria-label={`${access.label} for this member`}
            >
              <option value="default">Role default</option>
              {access.roleDefault ? <option value="off">Turn off</option> : <option value="on">Turn on</option>}
            </select>
          ) : (
            <span>{access.canOpen ? 'Yes' : 'No'}</span>
          )}
        </td>
      </tr>
      {sentence && (
        <tr className={styles.sentenceRow}>
          <td colSpan={3}>{sentence}</td>
        </tr>
      )}
      {fold && open && (
        <tr className={styles.foldRowWrap}>
          <td colSpan={3}>{children}</td>
        </tr>
      )}
    </>
  );
}
