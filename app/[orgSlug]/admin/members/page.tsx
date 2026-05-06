'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users2, UserPlus, Trash2, ShieldCheck, BookOpen, ChevronDown, Tag, Settings2 } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { PLAN_CONFIG } from '@/lib/plan-config';
import FeedbackModal from '@/components/FeedbackModal';
import { ROLE_DEFAULTS } from '@/lib/roles';
import type { OrgRole } from '@/lib/types';
import type { Capability } from '@/lib/roles';
import styles from './members.module.css';

const ROLE_INVITE_DESCRIPTIONS: Record<'admin' | 'staff' | 'official', string> = {
  admin: 'Tournament architect — can create tournaments, define age groups, manage registrations, build schedules, manage contacts and diamonds, post rules, send communications, and manage members. Cannot access org settings or billing.',
  staff: 'Tournament operator — updates game times and diamond assignments during events, submits scores, and posts announcements. Cannot create or delete tournaments, manage registrations, or send communications.',
  official: 'Score entry only. Officials receive a direct link to the scorekeeper app and can submit results from their assigned diamonds. They do not access the main admin area.',
};

const ROLE_MATRIX: { label: string; owner: boolean; admin: boolean; staff: boolean; official: boolean }[] = [
  { label: 'Create / delete tournaments',       owner: true,  admin: true,  staff: false, official: false },
  { label: 'Manage registrations',              owner: true,  admin: true,  staff: false, official: false },
  { label: 'Manage schedule & brackets',        owner: true,  admin: true,  staff: false, official: false },
  { label: 'Update game times & diamonds',      owner: true,  admin: true,  staff: true,  official: false },
  { label: 'Submit & finalize scores',          owner: true,  admin: true,  staff: true,  official: true  },
  { label: 'Manage contacts & diamonds',        owner: true,  admin: true,  staff: false, official: false },
  { label: 'Post announcements',                owner: true,  admin: true,  staff: true,  official: false },
  { label: 'Post / edit rules documents',       owner: true,  admin: true,  staff: false, official: false },
  { label: 'Send email communications',         owner: true,  admin: true,  staff: false, official: false },
  { label: 'Seal tournament (archive)',         owner: true,  admin: true,  staff: false, official: false },
  { label: 'Manage members',                    owner: true,  admin: true,  staff: false, official: false },
  { label: 'Org settings & branding',           owner: true,  admin: false, staff: false, official: false },
  { label: 'Billing & subscription',            owner: true,  admin: false, staff: false, official: false },
];

interface Member {
  id: string;
  userId: string;
  email: string;
  role: OrgRole;
  capabilities: Record<string, boolean> | null;
  invitedAt: string;
  acceptedAt: string | null;
  lastSignIn: string | null;
  assignedTournamentIds: string[];
}

interface TournamentOption {
  id: string;
  name: string;
  year: number;
}

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  staff: 'Staff',
  official: 'Official',
};

const ROLE_BADGE: Record<OrgRole, string> = {
  owner: 'badge-primary',
  admin: 'badge-success',
  staff: 'badge-neutral',
  official: 'badge-warning',
};

const CAPABILITY_LABELS: Record<Capability, string> = {
  create_tournaments:        'Create / delete tournaments',
  manage_registrations:      'Manage registrations',
  manage_schedule_structure: 'Manage schedule & brackets',
  update_schedule:           'Update game times & diamonds',
  submit_scores:             'Submit & finalize scores',
  manage_contacts:           'Manage contacts & diamonds',
  post_announcements:        'Post announcements',
  post_rules:                'Post / edit rules documents',
  send_communications:       'Send email communications',
  seal_tournaments:          'Seal tournament (archive)',
  manage_members:            'Manage members',
  org_settings:              'Org settings & branding',
  billing:                   'Billing & subscription',
};

const CAPABILITY_KEYS = Object.keys(CAPABILITY_LABELS) as Capability[];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function MembersPage() {
  const { currentOrg, userRole, user, loading } = useOrg();

  const [members, setMembers] = useState<Member[]>([]);
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [fetching, setFetching] = useState(true);

  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'staff' | 'official'>('staff');
  const [inviting, setInviting] = useState(false);

  // Remove confirmation
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);

  // Resend invite state
  const [reinviting, setReinviting] = useState<string | null>(null);

  // Assignment modal state
  const [assignTarget, setAssignTarget] = useState<Member | null>(null);
  const [assignSelected, setAssignSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Capability override editor state (owner-only)
  const [capTarget, setCapTarget] = useState<Member | null>(null);
  const [capDraft, setCapDraft] = useState<Record<string, boolean>>({});
  const [capSaving, setCapSaving] = useState(false);

  // Feedback modals
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!currentOrg) return;
    loadMembers();
    loadTournaments();
  }, [currentOrg]);

  async function loadMembers() {
    setFetching(true);
    try {
      const res = await fetch('/api/admin/members');
      if (!res.ok) throw new Error('Failed to load members');
      setMembers(await res.json());
    } catch (err: any) {
      showError(err.message);
    } finally {
      setFetching(false);
    }
  }

  async function loadTournaments() {
    try {
      const res = await fetch('/api/admin/tournaments');
      if (res.ok) {
        const rows = await res.json();
        setTournaments(rows.map((r: any) => ({ id: r.id, name: r.name, year: r.year })));
      }
    } catch {
      // non-fatal — assignment UI just won't show tournament names
    }
  }

  function showError(msg: string) {
    setErrorMsg(msg);
    setErrorOpen(true);
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setSuccessOpen(true);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    // Client-side seat guard: block non-officials when at the billable seat limit.
    const isOfficial = inviteRole === 'official';
    if (atLimit && !(isOfficial && planCfg.officialsFreeSeats)) {
      showError(`Seat limit reached (${seatLimit} seat${seatLimit === 1 ? '' : 's'}). Upgrade to add more members.`);
      return;
    }
    setInviting(true);
    try {
      const res = await fetch('/api/admin/members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Invite failed');
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('staff' as 'admin' | 'staff' | 'official');
      showSuccess(data.added
        ? `${inviteEmail} has been added to the organization.`
        : `Invite sent to ${inviteEmail}.`
      );
      loadMembers();
    } catch (err: any) {
      showError(err.message ?? 'Something went wrong');
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: 'admin' | 'staff' | 'official') {
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Role update failed');
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    } catch (err: any) {
      showError(err.message);
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/admin/members/${removeTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Remove failed');
      setRemoveTarget(null);
      showSuccess(`${removeTarget.email} has been removed.`);
      loadMembers();
    } catch (err: any) {
      showError(err.message);
    } finally {
      setRemoving(false);
    }
  }

  async function handleReinvite(member: Member) {
    setReinviting(member.id);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/reinvite`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Resend failed');
      showSuccess(`Invite resent to ${member.email}.`);
    } catch (err: any) {
      showError(err.message);
    } finally {
      setReinviting(null);
    }
  }

  function openAssign(member: Member) {
    setAssignTarget(member);
    setAssignSelected([...member.assignedTournamentIds]);
  }

  function toggleAssignment(tid: string) {
    setAssignSelected(prev =>
      prev.includes(tid) ? prev.filter(id => id !== tid) : [...prev, tid]
    );
  }

  async function handleSaveAssignments() {
    if (!assignTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/members/${assignTarget.id}/assignments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentIds: assignSelected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save assignments');
      setMembers(prev => prev.map(m =>
        m.id === assignTarget.id ? { ...m, assignedTournamentIds: assignSelected } : m
      ));
      setAssignTarget(null);
      showSuccess('Tournament assignments updated.');
    } catch (err: any) {
      showError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openCapEditor(member: Member) {
    setCapTarget(member);
    setCapDraft(member.capabilities ? { ...member.capabilities } : {});
  }

  function getCapValue(cap: Capability): 'grant' | 'revoke' | 'default' {
    if (!(cap in capDraft)) return 'default';
    return capDraft[cap] ? 'grant' : 'revoke';
  }

  function setCapValue(cap: Capability, value: 'grant' | 'revoke' | 'default') {
    setCapDraft(prev => {
      const next = { ...prev };
      if (value === 'default') {
        delete next[cap];
      } else {
        next[cap] = value === 'grant';
      }
      return next;
    });
  }

  async function handleSaveCapabilities() {
    if (!capTarget) return;
    setCapSaving(true);
    try {
      const res = await fetch(`/api/admin/members/${capTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilities: capDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save capabilities');
      const saved = Object.keys(capDraft).length > 0 ? capDraft : null;
      setMembers(prev => prev.map(m =>
        m.id === capTarget.id ? { ...m, capabilities: saved } : m
      ));
      setCapTarget(null);
      showSuccess('Capability overrides saved.');
    } catch (err: any) {
      showError(err.message);
    } finally {
      setCapSaving(false);
    }
  }

  if (loading) {
    return <div className={styles.page}><p className={styles.muted}>Loading…</p></div>;
  }

  // Admin has manage_members capability; only owner and admin can reach this page
  if (userRole !== 'owner' && userRole !== 'admin') {
    return (
      <div className={styles.page}>
        <div className={styles.accessDenied}>
          <Users2 size={32} className={styles.accessDeniedIcon} />
          <h2>Access Denied</h2>
          <p>Only organization owners and admins can manage members.</p>
        </div>
      </div>
    );
  }

  const planCfg = currentOrg ? PLAN_CONFIG[currentOrg.planId] : PLAN_CONFIG.starter;
  const seatLimit = planCfg.seatLimit;
  const billableMembers = planCfg.officialsFreeSeats
    ? members.filter(m => m.role !== 'official')
    : members;
  const seatCount = billableMembers.length;
  const officialCount = members.length - billableMembers.length;
  const atLimit = seatCount >= seatLimit;

  function renderAssignmentBadge(member: Member) {
    if (member.role === 'owner') return null;
    if (member.assignedTournamentIds.length === 0) {
      return <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>All tournaments</span>;
    }
    return (
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
        {member.assignedTournamentIds.map(tid => {
          const t = tournaments.find(t => t.id === tid);
          return (
            <span key={tid} className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
              {t ? `${t.name} ${t.year}` : tid.slice(0, 8)}
            </span>
          );
        })}
      </span>
    );
  }

  function renderMemberTable(rows: Member[], showAssignments: boolean) {
    return (
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            {showAssignments && <th>Tournaments</th>}
            <th>Status</th>
            <th>Last Sign In</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(m => {
            const isSelf = m.userId === user?.id;
            return (
              <tr key={m.id}>
                <td className={styles.emailCell}>
                  <div className={styles.emailCellInner}>
                    {m.email}
                    {isSelf && <span className={styles.youBadge}>you</span>}
                  </div>
                </td>
                <td>
                  <span className={`badge ${ROLE_BADGE[m.role]}`}>{ROLE_LABELS[m.role]}</span>
                </td>
                {showAssignments && (
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {renderAssignmentBadge(m)}
                      {!isSelf && m.role !== 'owner' && (
                        <button
                          className={styles.removeBtn}
                          onClick={() => openAssign(m)}
                          title="Edit tournament assignments"
                          style={{ padding: '0.2rem 0.4rem' }}
                        >
                          <Tag size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
                <td>
                  <span className={m.acceptedAt ? styles.statusAccepted : styles.statusPending}>
                    {m.acceptedAt ? 'Accepted' : 'Pending'}
                  </span>
                </td>
                <td className={styles.dimCell}>{formatDate(m.lastSignIn)}</td>
                <td>
                  {!isSelf && m.role !== 'owner' && (
                    <div className={styles.actions}>
                      <select
                        className={styles.roleSelect}
                        value={m.role}
                        onChange={e => handleRoleChange(m.id, e.target.value as 'admin' | 'staff' | 'official')}
                        aria-label={`Change role for ${m.email}`}
                      >
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                        <option value="official">Official</option>
                      </select>
                      {userRole === 'owner' && (
                        <button
                          className={styles.editBtn}
                          onClick={() => openCapEditor(m)}
                          aria-label={`Edit capability overrides for ${m.email}`}
                          title="Capability overrides"
                        >
                          <Settings2 size={14} />
                        </button>
                      )}
                      {!m.acceptedAt && (
                        <button
                          className={styles.editBtn}
                          onClick={() => handleReinvite(m)}
                          disabled={reinviting === m.id}
                          aria-label={`Resend invite to ${m.email}`}
                          title="Resend invite"
                        >
                          {reinviting === m.id ? '…' : <UserPlus size={14} />}
                        </button>
                      )}
                      <button
                        className={styles.removeBtn}
                        onClick={() => setRemoveTarget(m)}
                        aria-label={`Remove ${m.email}`}
                        title="Remove member"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  const nonOfficials = members.filter(m => m.role !== 'official');
  const officials = members.filter(m => m.role === 'official');

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><Users2 size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Members</h1>
            <p className={styles.pageSub}>Manage who has access to your organization</p>
          </div>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setInviteOpen(true)}
          id="members-invite-btn"
        >
          <UserPlus size={15} />
          Invite Member
        </button>
      </div>

      {/* Role reference panel */}
      <details className={styles.roleRef}>
        <summary className={styles.roleRefSummary}>
          <span className={styles.roleRefSummaryLeft}>
            <BookOpen size={14} />
            <span>Role Guide</span>
          </span>
          <ChevronDown size={14} />
        </summary>
        <div className={styles.roleRefBody}>
          <table className={styles.roleMatrix}>
            <thead>
              <tr>
                <th>Capability</th>
                <th>Owner</th>
                <th>Admin</th>
                <th>Staff</th>
                <th>Official</th>
              </tr>
            </thead>
            <tbody>
              {ROLE_MATRIX.map(row => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td><span className={styles.matrixCheck}>✓</span></td>
                  <td>{row.admin    ? <span className={styles.matrixCheck}>✓</span> : <span className={styles.matrixDash}>—</span>}</td>
                  <td>{row.staff    ? <span className={styles.matrixCheck}>✓</span> : <span className={styles.matrixDash}>—</span>}</td>
                  <td>{row.official ? <span className={styles.matrixCheck}>✓</span> : <span className={styles.matrixDash}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.roleRefNote}>
            <strong>Owner</strong> is assigned at org creation and cannot be transferred here — contact support to transfer ownership.
            {' '}<strong>Admin</strong> is the co-organizer role (full tournament management, member management, no billing/settings).
            {' '}<strong>Staff</strong> are day-of operators (schedule updates, scores, announcements only).
            {' '}<strong>Officials</strong> receive a separate scorekeeper link and are not expected to use the admin area.
          </p>
          <p className={styles.roleRefNote} style={{ marginTop: '0.5rem' }}>
            <strong>Tournament assignments:</strong> Staff and officials can be restricted to specific tournaments. Use the <Tag size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> icon to assign. A member with no assignments sees all tournaments.
          </p>
        </div>
      </details>

      {/* Seat usage */}
      <div className={styles.seatBanner}>
        <span className={styles.seatCount}>
          <strong>{seatCount}</strong> of <strong>{seatLimit >= 9999 ? 'Unlimited' : seatLimit}</strong> staff seats used
          {planCfg.officialsFreeSeats && officialCount > 0 && (
            <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontWeight: 400 }}>
              · {officialCount} official{officialCount === 1 ? '' : 's'} (free on this plan)
            </span>
          )}
        </span>
        {atLimit && (
          <Link
            href={`/${currentOrg?.slug}/admin/billing`}
            className={styles.upgradeLink}
          >
            Upgrade to add more members →
          </Link>
        )}
      </div>

      {/* Members table */}
      <div className={styles.tableWrap}>
        {fetching ? (
          <p className={styles.muted} style={{ padding: '1.5rem' }}>Loading members…</p>
        ) : members.length === 0 ? (
          <p className={styles.muted} style={{ padding: '1.5rem' }}>No members yet.</p>
        ) : (
          <>
            {renderMemberTable(nonOfficials, true)}

            {officials.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <h2 className={styles.pageTitle} style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Field Officials</h2>
                {renderMemberTable(officials, true)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Invite modal */}
      {inviteOpen && (
        <div className={styles.modalOverlay} onClick={() => setInviteOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <ShieldCheck size={18} />
              <h3>Invite Member</h3>
            </div>
            <form onSubmit={handleInvite}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="invite-email">Email Address</label>
                <input
                  id="invite-email"
                  type="email"
                  className={styles.input}
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="name@example.com"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="invite-role">Role</label>
                <select
                  id="invite-role"
                  className={styles.input}
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as 'admin' | 'staff' | 'official')}
                >
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                  <option value="official">Field Official (scorekeeper)</option>
                </select>
                <p className={styles.roleHint}>{ROLE_INVITE_DESCRIPTIONS[inviteRole]}</p>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className="btn btn-outline" onClick={() => setInviteOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={inviting} id="invite-submit-btn">
                  {inviting ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove confirmation modal */}
      {removeTarget && (
        <div className={styles.modalOverlay} onClick={() => setRemoveTarget(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <Trash2 size={18} />
              <h3>Remove Member</h3>
            </div>
            <p className={styles.confirmText}>
              Are you sure you want to remove <strong>{removeTarget.email}</strong> from the organization?
              They will lose all access immediately.
            </p>
            <div className={styles.modalFooter}>
              <button type="button" className="btn btn-outline" onClick={() => setRemoveTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleRemove}
                disabled={removing}
                id="remove-confirm-btn"
              >
                {removing ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tournament assignment modal */}
      {assignTarget && (
        <div className={styles.modalOverlay} onClick={() => setAssignTarget(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <Tag size={18} />
              <h3>Tournament Assignments</h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              <strong>{assignTarget.email}</strong> — select which tournaments this member can access.
              Leave all unchecked to grant access to all tournaments.
            </p>
            {tournaments.length === 0 ? (
              <p className={styles.muted}>No tournaments found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '260px', overflowY: 'auto' }}>
                {tournaments.map(t => (
                  <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input
                      type="checkbox"
                      checked={assignSelected.includes(t.id)}
                      onChange={() => toggleAssignment(t.id)}
                    />
                    {t.name} {t.year}
                  </label>
                ))}
              </div>
            )}
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
              {assignSelected.length === 0
                ? 'No restrictions — member sees all tournaments.'
                : `Restricted to ${assignSelected.length} tournament${assignSelected.length === 1 ? '' : 's'}.`}
            </p>
            <div className={styles.modalFooter}>
              <button type="button" className="btn btn-outline" onClick={() => setAssignTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveAssignments}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Assignments'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Capability override modal — owner-only */}
      {capTarget && (
        <div className={styles.modalOverlay} onClick={() => setCapTarget(null)}>
          <div className={`${styles.modal} ${styles.modalWide}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <Settings2 size={18} />
              <h3>Capability Overrides</h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              <strong>{capTarget.email}</strong>
              {' '}— Role: <span className={`badge ${ROLE_BADGE[capTarget.role]}`} style={{ fontSize: '0.7rem' }}>{ROLE_LABELS[capTarget.role]}</span>
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--white-30, rgba(255,255,255,0.3))', marginBottom: '1rem', lineHeight: 1.45 }}>
              Override individual capabilities above or below this member's role defaults.
              Leave set to <em>Role default</em> to let the role determine access.
            </p>
            <div className={styles.capTableWrap}>
              <table className={styles.capTable}>
                <thead>
                  <tr>
                    <th>Capability</th>
                    <th style={{ textAlign: 'center' }}>Role default</th>
                    <th style={{ textAlign: 'right' }}>Override</th>
                  </tr>
                </thead>
                <tbody>
                  {CAPABILITY_KEYS.map(cap => {
                    const roleDefault = ROLE_DEFAULTS[capTarget.role]?.has(cap);
                    const currentValue = getCapValue(cap);
                    return (
                      <tr key={cap}>
                        <td>{CAPABILITY_LABELS[cap]}</td>
                        <td style={{ textAlign: 'center' }}>
                          {roleDefault
                            ? <span className={styles.matrixCheck}>✓</span>
                            : <span className={styles.matrixDash}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <select
                            className={styles.capSelect}
                            value={currentValue}
                            onChange={e => setCapValue(cap, e.target.value as 'grant' | 'revoke' | 'default')}
                            aria-label={`Override ${CAPABILITY_LABELS[cap]}`}
                          >
                            <option value="default">Role default</option>
                            <option value="grant">Grant</option>
                            <option value="revoke">Revoke</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--white-30, rgba(255,255,255,0.3))', marginTop: '0.75rem' }}>
              {Object.keys(capDraft).length === 0
                ? 'No overrides — all capabilities follow role defaults.'
                : `${Object.keys(capDraft).length} override${Object.keys(capDraft).length === 1 ? '' : 's'} set.`}
            </p>
            <div className={styles.modalFooter}>
              <button type="button" className="btn btn-outline" onClick={() => setCapTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveCapabilities}
                disabled={capSaving}
              >
                {capSaving ? 'Saving…' : 'Save Overrides'}
              </button>
            </div>
          </div>
        </div>
      )}

      <FeedbackModal
        isOpen={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Done"
        message={successMsg}
        type="success"
      />
      <FeedbackModal
        isOpen={errorOpen}
        onClose={() => setErrorOpen(false)}
        title="Error"
        message={errorMsg}
        type="danger"
      />
    </div>
  );
}
