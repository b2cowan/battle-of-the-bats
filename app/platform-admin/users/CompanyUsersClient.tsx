'use client';
import { useState } from 'react';
import { UserPlus, Check, Copy } from 'lucide-react';
import type { PlatformUser } from '@/lib/types';
import { fmtAbsoluteDate } from '@/lib/format-date';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import kit from '../console.module.css';
import styles from './users.module.css';

interface Props {
  users: PlatformUser[];
  bootstrapEmails: string[];
  canManageUsers: boolean;
}

const fmtDate = (iso: string | null) => fmtAbsoluteDate(iso);

const PLATFORM_ROLES = [
  { value: 'support', label: 'Support' },
  { value: 'billing', label: 'Billing' },
  { value: 'product', label: 'Product' },
  { value: 'growth', label: 'Growth' },
  { value: 'read_only', label: 'Read only' },
  { value: 'super_admin', label: 'Super admin' },
];

function roleLabel(role: string) {
  return PLATFORM_ROLES.find(item => item.value === role)?.label ?? role;
}

export default function CompanyUsersClient({ users: initial, bootstrapEmails, canManageUsers }: Props) {
  const [users,      setUsers]      = useState<PlatformUser[]>(initial);
  const [showInvite, setShowInvite] = useState(false);
  const [invEmail,   setInvEmail]   = useState('');
  const [invName,    setInvName]    = useState('');
  const [invRole,    setInvRole]    = useState('support');
  const [inviting,   setInviting]   = useState(false);
  const [inviteErr,  setInviteErr]  = useState('');
  const [setupLink,  setSetupLink]  = useState('');
  const [copied,     setCopied]     = useState(false);
  const [busy,       setBusy]       = useState<Record<string, boolean>>({});
  const [rowErr,     setRowErr]     = useState<Record<string, string>>({});
  const [pendingRemove, setPendingRemove] = useState<PlatformUser | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteErr('');
    setSetupLink('');
    try {
      const res  = await fetch('/api/platform-admin/company-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: invEmail, displayName: invName, role: invRole }),
      });
      const data = await res.json();
      if (!res.ok) { setInviteErr(data.error ?? 'Failed'); return; }
      setUsers(u => [...u, data.user]);
      setSetupLink(data.setupLink ?? '');
      setInvEmail('');
      setInvName('');
      setInvRole('support');
    } catch {
      setInviteErr('Network error');
    } finally {
      setInviting(false);
    }
  }

  async function handleToggle(u: PlatformUser) {
    setBusy(b => ({ ...b, [u.id]: true }));
    setRowErr(r => ({ ...r, [u.id]: '' }));
    try {
      const res  = await fetch(`/api/platform-admin/company-users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      const data = await res.json();
      if (!res.ok) { setRowErr(r => ({ ...r, [u.id]: data.error ?? 'Failed' })); return; }
      setUsers(us => us.map(x => x.id === u.id ? data : x));
    } catch {
      setRowErr(r => ({ ...r, [u.id]: 'Network error' }));
    } finally {
      setBusy(b => ({ ...b, [u.id]: false }));
    }
  }

  async function handleRoleChange(u: PlatformUser, role: string) {
    setBusy(b => ({ ...b, [u.id]: true }));
    setRowErr(r => ({ ...r, [u.id]: '' }));
    try {
      const res = await fetch(`/api/platform-admin/company-users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) { setRowErr(r => ({ ...r, [u.id]: data.error ?? 'Failed' })); return; }
      setUsers(us => us.map(x => x.id === u.id ? data : x));
    } catch {
      setRowErr(r => ({ ...r, [u.id]: 'Network error' }));
    } finally {
      setBusy(b => ({ ...b, [u.id]: false }));
    }
  }

  async function handleRemove(u: PlatformUser) {
    setBusy(b => ({ ...b, [u.id]: true }));
    setRowErr(r => ({ ...r, [u.id]: '' }));
    try {
      const res  = await fetch(`/api/platform-admin/company-users/${u.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setRowErr(r => ({ ...r, [u.id]: data.error ?? 'Failed' })); return; }
      setUsers(us => us.filter(x => x.id !== u.id));
      setPendingRemove(null);
    } catch {
      setRowErr(r => ({ ...r, [u.id]: 'Network error' }));
    } finally {
      setBusy(b => ({ ...b, [u.id]: false }));
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(setupLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isBootstrap = (email: string) => bootstrapEmails.includes(email.toLowerCase());

  return (
    <div className={kit.page}>
      <AdminPageHeader
        title="Platform users"
        actions={canManageUsers ? (
          <button
            type="button"
            className={`btn ${showInvite ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => { setShowInvite(s => !s); setSetupLink(''); setInviteErr(''); }}
          >
            <UserPlus size={14} />
            Add user
          </button>
        ) : undefined}
      />

      {showInvite && canManageUsers && (
        <section className={kit.section}>
          <h2 className={kit.sectionTitle}>Add company user</h2>
          <div className={`${kit.card} ${kit.cardPad} ${styles.inviteCard}`}>
            <p className={kit.caption}>No email is sent. After creating, copy the one-time setup link shown below and share it securely with the new user.</p>
            <form onSubmit={handleInvite} className={styles.inviteForm}>
              <div className={kit.formGrid}>
                <div className={kit.fieldGroup}>
                  <label className={kit.label} htmlFor="platform-user-name">Display name</label>
                  <input
                    id="platform-user-name"
                    className={kit.field}
                    value={invName}
                    onChange={e => setInvName(e.target.value)}
                    placeholder="e.g. Jane Smith"
                  />
                </div>
                <div className={kit.fieldGroup}>
                  <label className={kit.label} htmlFor="platform-user-email">Email <span className={kit.req}>*</span></label>
                  <input
                    id="platform-user-email"
                    className={kit.field}
                    type="email"
                    value={invEmail}
                    onChange={e => setInvEmail(e.target.value)}
                    placeholder="jane@fieldlogichq.ca"
                    required
                  />
                </div>
                <div className={kit.fieldGroup}>
                  <label className={kit.label} htmlFor="platform-user-role">Role</label>
                  <select
                    id="platform-user-role"
                    className={kit.select}
                    value={invRole}
                    onChange={e => setInvRole(e.target.value)}
                  >
                    {PLATFORM_ROLES.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              {inviteErr && <p className={kit.fieldError}>{inviteErr}</p>}
              <div className={kit.formActions}>
                <button className="btn btn-primary" type="submit" disabled={inviting}>
                  {inviting ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
            {setupLink && (
              <div className={kit.callout}>
                <span>Password setup link — share with the new user:</span>
                <code className={`${kit.code} ${styles.link}`}>{setupLink}</code>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopy}>
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      <section className={kit.section}>
        <div className={kit.card}>
          <div className={kit.toolbar}>
            <span className={kit.count}>{users.length === 1 ? '1 user' : `${users.length} users`}</span>
          </div>
          {/* `table-cards` (global): the list becomes cards at ≤640 — table standard, register F-12. */}
          <div className={`${kit.tableWrap} table-cards`}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th>Invited by</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr><td colSpan={7} className={kit.empty}>No company users yet.</td></tr>
                )}
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="table-cards-title">{u.displayName || '—'}</td>
                    <td data-label="Email">
                      {u.email}
                      {isBootstrap(u.email) && <>{' '}<span className={`${kit.chip} ${kit.chipInfo}`}>bootstrap</span></>}
                    </td>
                    <td data-label="Role">
                      {isBootstrap(u.email) || !canManageUsers ? (
                        <span className={`${kit.chip} ${kit.chipOk}`}>{roleLabel(u.role)}</span>
                      ) : (
                        <select
                          className={kit.select}
                          aria-label={`Role for ${u.email}`}
                          value={u.role}
                          onChange={event => handleRoleChange(u, event.target.value)}
                          disabled={busy[u.id]}
                        >
                          {PLATFORM_ROLES.map(role => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td data-label="Status">
                      <span className={`${kit.chip} ${u.isActive ? kit.chipOk : kit.chipQuiet}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className={kit.nowrap} data-label="Added">{fmtDate(u.createdAt)}</td>
                    <td data-label="Invited by">
                      <span className={styles.invitedBy} title={u.invitedBy || undefined}>{u.invitedBy || '—'}</span>
                    </td>
                    <td>
                      <div className={styles.actionsCell}>
                        {rowErr[u.id] && <span className={kit.fieldError}>{rowErr[u.id]}</span>}
                        {!isBootstrap(u.email) && canManageUsers && (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleToggle(u)}
                              disabled={busy[u.id]}
                            >
                              {busy[u.id] ? '…' : u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => setPendingRemove(u)}
                              disabled={busy[u.id]}
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {pendingRemove && (
        <div className={styles.modalBackdrop} role="presentation">
          <section
            className={styles.confirmModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-platform-user-title"
          >
            <h2 className={kit.sectionTitle} id="remove-platform-user-title">
              Remove platform user
            </h2>
            <p className={styles.modalCopy}>
              Remove {pendingRemove.email} from platform admin access? This cannot be undone from this screen.
            </p>
            {rowErr[pendingRemove.id] && <span className={kit.fieldError}>{rowErr[pendingRemove.id]}</span>}
            <div className={styles.modalActions}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPendingRemove(null)}
                disabled={busy[pendingRemove.id]}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => handleRemove(pendingRemove)}
                disabled={busy[pendingRemove.id]}
              >
                {busy[pendingRemove.id] ? 'Removing...' : 'Remove user'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
