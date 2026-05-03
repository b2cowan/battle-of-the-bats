'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users2, UserPlus, Trash2, ShieldCheck } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { PLAN_CONFIG } from '@/lib/plan-config';
import FeedbackModal from '@/components/FeedbackModal';
import type { OrgRole } from '@/lib/types';
import styles from './members.module.css';

interface Member {
  id: string;
  userId: string;
  email: string;
  role: OrgRole;
  invitedAt: string;
  acceptedAt: string | null;
  lastSignIn: string | null;
}

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  staff: 'Staff',
};

const ROLE_BADGE: Record<OrgRole, string> = {
  owner: 'badge-primary',
  admin: 'badge-success',
  staff: 'badge-neutral',
};

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
  const [fetching, setFetching] = useState(true);

  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'staff'>('staff');
  const [inviting, setInviting] = useState(false);

  // Remove confirmation
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);

  // Feedback modals
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!currentOrg) return;
    loadMembers();
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
      setInviteRole('staff');
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

  async function handleRoleChange(memberId: string, newRole: 'admin' | 'staff') {
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

  if (loading) {
    return <div className={styles.page}><p className={styles.muted}>Loading…</p></div>;
  }

  if (userRole !== 'owner') {
    return (
      <div className={styles.page}>
        <div className={styles.accessDenied}>
          <Users2 size={32} className={styles.accessDeniedIcon} />
          <h2>Access Denied</h2>
          <p>Only organization owners can manage members.</p>
        </div>
      </div>
    );
  }

  const seatLimit = currentOrg ? PLAN_CONFIG[currentOrg.planId].seatLimit : 1;
  const seatCount = members.length;
  const atLimit = seatCount >= seatLimit;

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
          className="btn btn-primary"
          onClick={() => setInviteOpen(true)}
          disabled={atLimit}
          id="members-invite-btn"
        >
          <UserPlus size={15} />
          Invite Member
        </button>
      </div>

      {/* Seat usage */}
      <div className={styles.seatBanner}>
        <span className={styles.seatCount}>
          <strong>{seatCount}</strong> of <strong>{seatLimit >= 9999 ? 'Unlimited' : seatLimit}</strong> seats used
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
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Sign In</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const isSelf = m.userId === user?.id;
                return (
                  <tr key={m.id}>
                    <td className={styles.emailCell}>
                      {m.email}
                      {isSelf && <span className={styles.youBadge}>you</span>}
                    </td>
                    <td>
                      <span className={`badge ${ROLE_BADGE[m.role]}`}>{ROLE_LABELS[m.role]}</span>
                    </td>
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
                            onChange={e => handleRoleChange(m.id, e.target.value as 'admin' | 'staff')}
                            aria-label={`Change role for ${m.email}`}
                          >
                            <option value="admin">Admin</option>
                            <option value="staff">Staff</option>
                          </select>
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
                  onChange={e => setInviteRole(e.target.value as 'admin' | 'staff')}
                >
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                </select>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setInviteOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={inviting}
                  id="invite-submit-btn"
                >
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
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setRemoveTarget(null)}
              >
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
