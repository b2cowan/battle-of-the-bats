'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ChevronDown, Copy, KeyRound, Search, Trash2 } from 'lucide-react';
import ExportMenu from '@/components/admin/ExportMenu';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import styles from './customer-users.module.css';

// ── Export ────────────────────────────────────────────────────────────────────

const CUSTOMER_USERS_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Email',        key: 'email',       format: 'text' },
  { label: 'Display Name', key: 'displayName', format: 'text' },
  { label: 'User ID',      key: 'userId',      format: 'text' },
  { label: 'Auth Status',  key: 'authStatus',  format: 'text' },
  { label: 'Last Sign In', key: 'lastSignIn',  format: 'text' },
  { label: 'Organizations', key: 'orgs',       format: 'text' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export type CustomerUserRow = {
  userId: string;
  email: string;
  displayName: string;
  authStatus: string;
  lastSignIn: string | null;
  memberships: {
    orgId: string;
    orgName: string;
    orgSlug: string;
    planId: string;
    subscriptionStatus: string;
    role: string;
    status: string;
  }[];
};

type Props = {
  initialRows: CustomerUserRow[];
  query: string;
  searched: boolean;
};

type ResetState = { link?: string; error?: string; copied?: boolean };

type BusyState = {
  userId: string;
  action: 'reset' | 'ban' | 'unban' | 'confirm-email' | 'revoke-sessions' | 'update' | 'delete';
} | null;

type ConfirmAction = 'ban' | 'unban' | 'revoke-sessions';

// Simple confirm modal — ban, unban, revoke-sessions
type ConfirmModal = {
  userId: string;
  email: string;
  action: ConfirmAction;
} | null;

// Edit info modal
type EditModal = {
  userId: string;
  currentEmail: string;
  currentDisplayName: string;
} | null;

// Hard-delete modal — requires typing the email to confirm
type DeleteModal = { userId: string; email: string } | null;

// Notes modal
type NotesModal = { userId: string; email: string } | null;

type NoteRow = {
  id: string;
  body: string;
  created_by_email: string;
  created_at: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function fmtRelative(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 2)   return 'just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 30)  return `${days}d ago`;
  return fmtDate(value);
}

function statusClass(value: string, s: Record<string, string>) {
  if (value === 'active') return s.badgeActive;
  if (value === 'banned' || value === 'canceled') return s.badgeDanger;
  if (value === 'unconfirmed' || value === 'trialing' || value === 'past_due') return s.badgeWarn;
  return s.badgeMuted;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CustomerUsersClient({ initialRows, query, searched }: Props) {
  const router = useRouter();

  // ── Core busy / error state ───────────────────────────────────────────────
  const [busy, setBusy]           = useState<BusyState>(null);
  const [resetState, setResetState] = useState<Record<string, ResetState>>({});
  const [rowErrors, setRowErrors]   = useState<Record<string, string>>({});

  // ── Dropdown ──────────────────────────────────────────────────────────────
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenuId) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenuId]);

  // ── Modals ────────────────────────────────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState<ConfirmModal>(null);
  const [editModal, setEditModal]       = useState<EditModal>(null);
  const [editEmail, setEditEmail]       = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editError, setEditError]       = useState<string | null>(null);
  const [editBusy, setEditBusy]         = useState(false);

  const [deleteModal, setDeleteModal]   = useState<DeleteModal>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [notesModal, setNotesModal]   = useState<NotesModal>(null);
  const [notes, setNotes]             = useState<NoteRow[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesBusy, setNotesBusy]     = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [notesError, setNotesError]   = useState<string | null>(null);

  // ── Reset password ────────────────────────────────────────────────────────

  async function generateReset(row: CustomerUserRow) {
    if (!row.email || row.email === '(unknown)') return;
    setBusy({ userId: row.userId, action: 'reset' });
    setResetState(s => ({ ...s, [row.userId]: {} }));
    setOpenMenuId(null);
    try {
      const res  = await fetch(`/api/platform-admin/users/${encodeURIComponent(row.userId)}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: row.email }),
      });
      const data = await res.json() as { link?: string; error?: string };
      if (!res.ok || !data.link) {
        setResetState(s => ({ ...s, [row.userId]: { error: data.error ?? 'Failed to generate reset link' } }));
        return;
      }
      setResetState(s => ({ ...s, [row.userId]: { link: data.link } }));
    } catch {
      setResetState(s => ({ ...s, [row.userId]: { error: 'Network error' } }));
    } finally {
      setBusy(null);
    }
  }

  async function copyLink(userId: string, link: string) {
    await navigator.clipboard.writeText(link);
    setResetState(s => ({ ...s, [userId]: { ...s[userId], copied: true } }));
    window.setTimeout(() => {
      setResetState(s => ({ ...s, [userId]: { ...s[userId], copied: false } }));
    }, 1800);
  }

  // ── Confirm modal actions (ban / unban / revoke-sessions) ─────────────────

  async function executeConfirmedAction(userId: string, email: string, action: ConfirmAction) {
    setConfirmModal(null);
    setBusy({ userId, action });
    setRowErrors(e => ({ ...e, [userId]: '' }));

    let url: string;
    let body: object;

    if (action === 'revoke-sessions') {
      url  = `/api/platform-admin/users/${encodeURIComponent(userId)}/revoke-sessions`;
      body = { email };
    } else {
      url  = `/api/platform-admin/users/${encodeURIComponent(userId)}/ban`;
      body = { action, email };
    }

    try {
      const res  = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setRowErrors(e => ({ ...e, [userId]: data.error ?? `Action failed` }));
        return;
      }
      router.refresh();
    } catch {
      setRowErrors(e => ({ ...e, [userId]: 'Network error' }));
    } finally {
      setBusy(null);
    }
  }

  // ── Confirm email ─────────────────────────────────────────────────────────

  async function handleConfirmEmail(userId: string, email: string) {
    setOpenMenuId(null);
    setBusy({ userId, action: 'confirm-email' });
    setRowErrors(e => ({ ...e, [userId]: '' }));
    try {
      const res  = await fetch(`/api/platform-admin/users/${encodeURIComponent(userId)}/confirm-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setRowErrors(e => ({ ...e, [userId]: data.error ?? 'Failed to confirm email' }));
        return;
      }
      router.refresh();
    } catch {
      setRowErrors(e => ({ ...e, [userId]: 'Network error' }));
    } finally {
      setBusy(null);
    }
  }

  // ── Edit info ─────────────────────────────────────────────────────────────

  function openEditModal(row: CustomerUserRow) {
    setOpenMenuId(null);
    setEditEmail(row.email === '(unknown)' ? '' : row.email);
    setEditDisplayName(row.displayName);
    setEditError(null);
    setEditModal({ userId: row.userId, currentEmail: row.email, currentDisplayName: row.displayName });
  }

  async function handleUpdateUser() {
    if (!editModal) return;
    const trimEmail = editEmail.trim();
    const trimName  = editDisplayName.trim();
    if (!trimEmail) { setEditError('Email is required.'); return; }

    setEditBusy(true);
    setEditError(null);
    try {
      const res  = await fetch(`/api/platform-admin/users/${encodeURIComponent(editModal.userId)}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:        trimEmail !== editModal.currentEmail ? trimEmail : undefined,
          displayName:  trimName  !== editModal.currentDisplayName ? trimName : undefined,
          currentEmail: editModal.currentEmail,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setEditError(data.error ?? 'Failed to update user.'); return; }
      setEditModal(null);
      router.refresh();
    } catch {
      setEditError('Network error.');
    } finally {
      setEditBusy(false);
    }
  }

  // ── Delete user ───────────────────────────────────────────────────────────

  async function handleDeleteUser() {
    if (!deleteModal) return;
    setBusy({ userId: deleteModal.userId, action: 'delete' });
    try {
      const res  = await fetch(
        `/api/platform-admin/users/${encodeURIComponent(deleteModal.userId)}/delete?email=${encodeURIComponent(deleteModal.email)}`,
        { method: 'DELETE' },
      );
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setRowErrors(e => ({ ...e, [deleteModal.userId]: data.error ?? 'Failed to delete user' }));
        setDeleteModal(null);
        return;
      }
      setDeleteModal(null);
      router.refresh();
    } catch {
      setRowErrors(e => ({ ...e, [deleteModal!.userId]: 'Network error' }));
    } finally {
      setBusy(null);
      setDeleteConfirmText('');
    }
  }

  // ── Notes ─────────────────────────────────────────────────────────────────

  async function openNotesModal(row: CustomerUserRow) {
    setOpenMenuId(null);
    setNotes([]);
    setNewNoteText('');
    setNotesError(null);
    setNotesModal({ userId: row.userId, email: row.email });
    setNotesLoading(true);
    try {
      const res  = await fetch(`/api/platform-admin/users/${encodeURIComponent(row.userId)}/notes`);
      const data = await res.json() as { notes?: NoteRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Load failed');
      setNotes(data.notes ?? []);
    } catch (e) {
      setNotesError(e instanceof Error ? e.message : 'Failed to load notes.');
    } finally {
      setNotesLoading(false);
    }
  }

  async function handleAddNote() {
    if (!notesModal || !newNoteText.trim()) return;
    setNotesBusy(true);
    setNotesError(null);
    try {
      const res  = await fetch(`/api/platform-admin/users/${encodeURIComponent(notesModal.userId)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newNoteText.trim() }),
      });
      const data = await res.json() as { note?: NoteRow; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setNotes(prev => [data.note!, ...prev]);
      setNewNoteText('');
    } catch (e) {
      setNotesError(e instanceof Error ? e.message : 'Failed to save note.');
    } finally {
      setNotesBusy(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!notesModal) return;
    setNotesBusy(true);
    try {
      await fetch(
        `/api/platform-admin/users/${encodeURIComponent(notesModal.userId)}/notes/${encodeURIComponent(noteId)}`,
        { method: 'DELETE' },
      );
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch {
      setNotesError('Failed to delete note.');
    } finally {
      setNotesBusy(false);
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────

  function buildUserExportRows() {
    return initialRows.map(row => ({
      email:       row.email,
      displayName: row.displayName || '',
      userId:      row.userId,
      authStatus:  row.authStatus,
      lastSignIn:  fmtDate(row.lastSignIn),
      orgs:        row.memberships.map(m => `${m.orgName} (${m.role})`).join('; '),
    }));
  }

  function handleExportXLSX() {
    const rows    = buildUserExportRows();
    const headers = serializeHeaders(CUSTOMER_USERS_EXPORT_COLS);
    const data    = serializeRows(rows, CUSTOMER_USERS_EXPORT_COLS);
    downloadXLSX(buildFilename({ dataset: 'customer-users' }, 'xlsx'), headers, data, 'Customer Users');
  }

  function handleExportCSV() {
    const rows    = buildUserExportRows();
    const headers = serializeHeaders(CUSTOMER_USERS_EXPORT_COLS);
    const data    = serializeRows(rows, CUSTOMER_USERS_EXPORT_COLS);
    downloadCSVBlob(buildFilename({ dataset: 'customer-users' }, 'csv'), generateCSV(headers, data));
  }

  // ─────────────────────────────────────────────────────────────────────────

  const isBusy = (userId: string) => busy?.userId === userId;

  return (
    <div className={styles.page}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div>
          <div className={styles.headerLabel}>Customer Support</div>
          <h1 className={styles.title}>Customer Users</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ExportMenu
            formats={['xlsx', 'csv']}
            onExportXLSX={handleExportXLSX}
            onExportCSV={handleExportCSV}
            disabled={!searched || initialRows.length === 0}
          />
          <div className={styles.count}>
            {searched ? `${initialRows.length} result${initialRows.length === 1 ? '' : 's'}` : 'Search required'}
          </div>
        </div>
      </header>

      {/* ── Search bar ─────────────────────────────────────────────────────── */}
      <form method="GET" action="/platform-admin/customer-users" className={styles.searchBar}>
        <label className={styles.searchBox}>
          <Search size={14} />
          <input
            name="q"
            defaultValue={query}
            placeholder="Search email, name, user id, org, or slug..."
            minLength={2}
          />
        </label>
        <button className={styles.searchBtn} type="submit">Search</button>
        {query && <Link href="/platform-admin/customer-users" className={styles.clearLink}>Clear</Link>}
      </form>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>User</th>
              <th>Auth</th>
              <th>Last Sign In</th>
              <th>Organizations</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {!searched && (
              <tr><td colSpan={5} className={styles.emptyCell}>Search at least two characters to look up customer users.</td></tr>
            )}
            {searched && initialRows.length === 0 && (
              <tr><td colSpan={5} className={styles.emptyCell}>No customer users match this search.</td></tr>
            )}
            {initialRows.map(row => {
              const reset    = resetState[row.userId] ?? {};
              const rowError = rowErrors[row.userId];
              const menuOpen = openMenuId === row.userId;
              const rowBusy  = isBusy(row.userId);
              const hasEmail = row.email && row.email !== '(unknown)';

              return (
                <tr key={row.userId}>
                  <td>
                    <div className={styles.primaryText}>{row.displayName || '-'}</div>
                    <div className={styles.emailText}>{row.email}</div>
                    <div className={styles.userId}>{row.userId}</div>
                    {reset.link && (
                      <div className={styles.linkBox}>
                        <span className={styles.linkLabel}>Reset link</span>
                        <code className={styles.link}>{reset.link}</code>
                        <button className={styles.copyBtn} type="button" onClick={() => copyLink(row.userId, reset.link!)}>
                          {reset.copied ? <Check size={12} /> : <Copy size={12} />}
                          {reset.copied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}
                    {(reset.error || rowError) && (
                      <div className={styles.rowError}>{reset.error || rowError}</div>
                    )}
                  </td>

                  <td>
                    <span className={`${styles.badge} ${statusClass(row.authStatus, styles)}`}>
                      {row.authStatus}
                    </span>
                  </td>

                  <td className={styles.dateCell}>{fmtDate(row.lastSignIn)}</td>

                  <td>
                    <div className={styles.membershipList}>
                      {row.memberships.length === 0 && <span className={styles.dimText}>No org memberships found</span>}
                      {row.memberships.map(m => (
                        <div key={`${row.userId}-${m.orgId}`} className={styles.membership}>
                          <Link href={`/platform-admin/orgs/${m.orgId}`} className={styles.orgLink}>{m.orgName}</Link>
                          <span className={styles.slug}>/{m.orgSlug}</span>
                          <span className={`${styles.badge} ${styles.badgeMuted}`}>{m.role}</span>
                          <span className={`${styles.badge} ${statusClass(m.status, styles)}`}>{m.status}</span>
                          <span className={styles.dimText}>{m.planId} / {m.subscriptionStatus}</span>
                        </div>
                      ))}
                    </div>
                  </td>

                  <td className={styles.actionsCell}>
                    <div className={styles.actionsMenu} ref={menuOpen ? menuRef : undefined}>
                      <button
                        className={styles.actionBtn}
                        type="button"
                        disabled={rowBusy || !hasEmail}
                        onClick={() => setOpenMenuId(menuOpen ? null : row.userId)}
                        aria-expanded={menuOpen}
                      >
                        {rowBusy ? (
                          <>
                            {busy?.action === 'reset'           && 'Generating...'}
                            {busy?.action === 'ban'             && 'Banning...'}
                            {busy?.action === 'unban'           && 'Unbanning...'}
                            {busy?.action === 'confirm-email'   && 'Confirming...'}
                            {busy?.action === 'revoke-sessions' && 'Revoking...'}
                            {busy?.action === 'update'          && 'Saving...'}
                            {busy?.action === 'delete'          && 'Deleting...'}
                          </>
                        ) : (
                          <><KeyRound size={13} />Actions<ChevronDown size={11} /></>
                        )}
                      </button>

                      {menuOpen && (
                        <div className={styles.menuList}>
                          <button className={styles.menuItem} type="button" onClick={() => openNotesModal(row)}>
                            Notes
                          </button>
                          <div className={styles.menuDivider} />
                          <button className={styles.menuItem} type="button" onClick={() => openEditModal(row)}>
                            Edit Info
                          </button>
                          <button className={styles.menuItem} type="button" onClick={() => generateReset(row)}>
                            Reset Password
                          </button>
                          {row.authStatus === 'unconfirmed' && (
                            <button className={styles.menuItem} type="button" onClick={() => handleConfirmEmail(row.userId, row.email)}>
                              Confirm Email
                            </button>
                          )}
                          <button
                            className={styles.menuItem}
                            type="button"
                            onClick={() => { setOpenMenuId(null); setConfirmModal({ userId: row.userId, email: row.email, action: 'revoke-sessions' }); }}
                          >
                            Revoke Sessions
                          </button>
                          <div className={styles.menuDivider} />
                          {row.authStatus !== 'banned' ? (
                            <button
                              className={`${styles.menuItem} ${styles.menuItemDanger}`}
                              type="button"
                              onClick={() => { setOpenMenuId(null); setConfirmModal({ userId: row.userId, email: row.email, action: 'ban' }); }}
                            >
                              Ban User
                            </button>
                          ) : (
                            <button
                              className={styles.menuItem}
                              type="button"
                              onClick={() => { setOpenMenuId(null); setConfirmModal({ userId: row.userId, email: row.email, action: 'unban' }); }}
                            >
                              Unban User
                            </button>
                          )}
                          <button
                            className={`${styles.menuItem} ${styles.menuItemDanger}`}
                            type="button"
                            onClick={() => { setOpenMenuId(null); setDeleteConfirmText(''); setDeleteModal({ userId: row.userId, email: row.email }); }}
                          >
                            Delete User
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Ban / Unban / Revoke-sessions confirmation modal ─────────────────── */}
      {confirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h2 className={styles.modalTitle}>
              {confirmModal.action === 'ban'             && 'Ban User'}
              {confirmModal.action === 'unban'           && 'Unban User'}
              {confirmModal.action === 'revoke-sessions' && 'Revoke All Sessions'}
            </h2>
            <p className={styles.modalBody}>
              {confirmModal.action === 'ban' && (
                <>Are you sure you want to ban <strong>{confirmModal.email}</strong>? They will not be able to sign in.</>
              )}
              {confirmModal.action === 'unban' && (
                <>Restore sign-in access for <strong>{confirmModal.email}</strong>?</>
              )}
              {confirmModal.action === 'revoke-sessions' && (
                <>Sign out <strong>{confirmModal.email}</strong> from all devices and invalidate all active sessions?</>
              )}
            </p>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} type="button" onClick={() => setConfirmModal(null)}>
                Cancel
              </button>
              <button
                className={confirmModal.action === 'ban' ? styles.modalConfirmDanger : styles.modalConfirm}
                type="button"
                onClick={() => executeConfirmedAction(confirmModal.userId, confirmModal.email, confirmModal.action)}
              >
                {confirmModal.action === 'ban'             && 'Ban User'}
                {confirmModal.action === 'unban'           && 'Unban User'}
                {confirmModal.action === 'revoke-sessions' && 'Revoke Sessions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit info modal ─────────────────────────────────────────────────── */}
      {editModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h2 className={styles.modalTitle}>Edit User Info</h2>
            <div className={styles.formGroup}>
              <label className={styles.fieldLabel}>Email</label>
              <input
                className={styles.fieldInput}
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                disabled={editBusy}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.fieldLabel}>Display Name</label>
              <input
                className={styles.fieldInput}
                type="text"
                value={editDisplayName}
                onChange={e => setEditDisplayName(e.target.value)}
                disabled={editBusy}
              />
            </div>
            {editError && <p className={styles.modalError}>{editError}</p>}
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} type="button" onClick={() => setEditModal(null)} disabled={editBusy}>
                Cancel
              </button>
              <button className={styles.modalConfirm} type="button" onClick={handleUpdateUser} disabled={editBusy}>
                {editBusy ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete user modal ────────────────────────────────────────────────── */}
      {deleteModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h2 className={styles.modalTitle}>Delete User</h2>
            <p className={styles.modalBody}>
              This permanently deletes <strong>{deleteModal.email}</strong> and all their data.
              This cannot be undone. Type the user&apos;s email to confirm.
            </p>
            <div className={styles.formGroup}>
              <input
                className={styles.fieldInput}
                type="text"
                placeholder={deleteModal.email}
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                autoFocus
              />
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.modalCancel}
                type="button"
                onClick={() => { setDeleteModal(null); setDeleteConfirmText(''); }}
              >
                Cancel
              </button>
              <button
                className={styles.modalConfirmDanger}
                type="button"
                disabled={deleteConfirmText.trim().toLowerCase() !== deleteModal.email.toLowerCase()}
                onClick={handleDeleteUser}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Notes modal ──────────────────────────────────────────────────────── */}
      {notesModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalBox} ${styles.modalBoxWide}`}>
            <h2 className={styles.modalTitle}>Support Notes</h2>
            <p className={styles.modalBodySmall}>{notesModal.email}</p>

            {/* Add note */}
            <div className={styles.noteAddRow}>
              <textarea
                className={styles.noteTextarea}
                placeholder="Add a note..."
                value={newNoteText}
                onChange={e => setNewNoteText(e.target.value)}
                rows={3}
                maxLength={4000}
                disabled={notesBusy}
              />
              <button
                className={styles.modalConfirm}
                type="button"
                disabled={notesBusy || !newNoteText.trim()}
                onClick={handleAddNote}
              >
                {notesBusy ? 'Saving...' : 'Add Note'}
              </button>
            </div>

            {notesError && <p className={styles.modalError}>{notesError}</p>}

            {/* Notes list */}
            <div className={styles.notesList}>
              {notesLoading && (
                <p className={styles.notesEmpty}>Loading...</p>
              )}
              {!notesLoading && notes.length === 0 && (
                <p className={styles.notesEmpty}>No notes yet.</p>
              )}
              {notes.map(note => (
                <div key={note.id} className={styles.noteRow}>
                  <div className={styles.noteBody}>{note.body}</div>
                  <div className={styles.noteMeta}>
                    <span>{note.created_by_email}</span>
                    <span>·</span>
                    <span>{fmtRelative(note.created_at)}</span>
                    <button
                      className={styles.noteDeleteBtn}
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      disabled={notesBusy}
                      title="Delete note"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.modalActions}>
              <button className={styles.modalCancel} type="button" onClick={() => setNotesModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
