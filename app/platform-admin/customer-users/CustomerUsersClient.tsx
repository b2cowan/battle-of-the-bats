'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, KeyRound, MailCheck, Trash2 } from 'lucide-react';
import ExportMenu from '@/components/admin/ExportMenu';
import HelpCallout from '@/components/help/HelpCallout';
import { fmtAbsoluteDate, fmtAbsoluteDateTime, fmtSince } from '@/lib/format-date';
import { PLAN_CONFIG } from '@/lib/plan-config';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import kit from '../console.module.css';
import { humanize } from '../chips';
import styles from './customer-users.module.css';
import { useDismissable } from '@/lib/overlay-hooks';

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
  /** Watch-only safeguard: # of LIVE Premium Coaches Portals this account owns (>1 = flagged). */
  livePortalCount: number;
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
  /** Active bulk auth-status filter ('' = all). Currently surfaced: 'unconfirmed'. */
  authStatusFilter: string;
  total: number;
  page: number;
  pageSize: number;
  /** manage_support — gates the whole Actions menu (super_admin / support / billing). */
  canManageUsers: boolean;
  /** super_admin only — gates the permanent Delete User verb (matches the F1 API guard). */
  canDelete: boolean;
};

type ResetState = { sent?: boolean; error?: string };

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

function statusChip(value: string) {
  if (value === 'active') return kit.chipOk;
  if (value === 'banned' || value === 'canceled') return kit.chipBad;
  if (value === 'unconfirmed' || value === 'trialing' || value === 'past_due') return kit.chipWarn;
  return kit.chipQuiet;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CustomerUsersClient({ initialRows, query, authStatusFilter, total, page, pageSize, canManageUsers, canDelete }: Props) {
  const router = useRouter();

  // ── Core busy / error state ───────────────────────────────────────────────
  const [busy, setBusy]           = useState<BusyState>(null);
  const [resetState, setResetState] = useState<Record<string, ResetState>>({});
  const [rowErrors, setRowErrors]   = useState<Record<string, string>>({});

  // ── Dropdown ──────────────────────────────────────────────────────────────
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // `openMenuId` is which row's menu is open, so the boolean is "any menu open". Gains Escape.
  useDismissable(openMenuId !== null, menuRef, () => setOpenMenuId(null));

  // ── Modals ────────────────────────────────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState<ConfirmModal>(null);
  const [editModal, setEditModal]       = useState<EditModal>(null);
  const [editEmail, setEditEmail]       = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editError, setEditError]       = useState<string | null>(null);
  const [editBusy, setEditBusy]         = useState(false);

  const [deleteModal, setDeleteModal]   = useState<DeleteModal>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  // Free-coach deletion impact, lazily fetched when the delete modal opens (null = not yet loaded).
  const [deleteImpact, setDeleteImpact] = useState<{ totalTeams: number; soleOwnedTeams: number } | null>(null);

  function openDeleteModal(userId: string, email: string) {
    setOpenMenuId(null);
    setDeleteConfirmText('');
    setDeleteImpact(null);
    setDeleteModal({ userId, email });
    void (async () => {
      try {
        const res = await fetch(`/api/platform-admin/users/${encodeURIComponent(userId)}/delete`);
        if (res.ok) setDeleteImpact(await res.json() as { totalTeams: number; soleOwnedTeams: number });
      } catch { /* non-fatal — modal still works without the impact hint */ }
    })();
  }

  const [notesModal, setNotesModal]   = useState<NotesModal>(null);
  const [notes, setNotes]             = useState<NoteRow[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesBusy, setNotesBusy]     = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [notesError, setNotesError]   = useState<string | null>(null);

  // ── Reset password ────────────────────────────────────────────────────────

  async function sendReset(row: CustomerUserRow) {
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
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setResetState(s => ({ ...s, [row.userId]: { error: data.error ?? 'Failed to send reset email' } }));
        return;
      }
      // The recovery link is emailed straight to the customer — the operator never sees it.
      setResetState(s => ({ ...s, [row.userId]: { sent: true } }));
    } catch {
      setResetState(s => ({ ...s, [row.userId]: { error: 'Network error' } }));
    } finally {
      setBusy(null);
    }
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
      lastSignIn:  fmtAbsoluteDate(row.lastSignIn, '-'),
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

  // The bulk auth-status filter keeps the search that is already applied (the same hrefs the old filter links carried).
  const buildFilterHref = (status: string) => {
    const params = new URLSearchParams();
    if (status) params.set('authStatus', status);
    if (query) params.set('q', query);
    const qs = params.toString();
    return `/platform-admin/customer-users${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className={kit.page}>

      <AdminPageHeader title="Customer users" />

      <HelpCallout
        variant="info"
        title="This is the customer directory only"
        body="Platform employees are excluded from this list. To manage platform staff (roles, access, and accounts), use Platform Users."
        dismissible
        {...(canDelete ? { cta: { label: 'Open Platform Users', href: '/platform-admin/users' } } : {})}
      />

      {!canManageUsers && (
        <div className={kit.notice}>
          View-only access — search and review user records. Contact the support team to take action on a user.
        </div>
      )}

      <section className={kit.section}>
        <div className={kit.card}>
          {/* ── Count · search · bulk filter · export ─────────────────────────── */}
          <div className={kit.toolbar}>
            <span className={kit.count}>
              {query.length >= 2
                ? `${total} result${total === 1 ? '' : 's'}`
                : `${total} user${total === 1 ? '' : 's'}`}
            </span>
            <form method="GET" action="/platform-admin/customer-users" className={styles.searchForm}>
              <input
                type="search"
                name="q"
                className={kit.search}
                defaultValue={query}
                placeholder="Search email, name, user id, org, or slug..."
                aria-label="Search customer users"
                minLength={2}
              />
              {/* Preserve the active auth-status filter when searching. */}
              {authStatusFilter && <input type="hidden" name="authStatus" value={authStatusFilter} />}
              <button className="btn btn-secondary btn-sm" type="submit">Search</button>
              {(query || authStatusFilter) && <Link href="/platform-admin/customer-users" className={kit.door}>Clear</Link>}
            </form>
            {/* Isolate every account that never confirmed its email — the residue the
                decoupled signup flow can leave (account created, never verified). */}
            <select
              className={kit.select}
              aria-label="Filter by auth status"
              value={authStatusFilter}
              onChange={e => router.push(buildFilterHref(e.target.value))}
            >
              <option value="">All</option>
              <option value="unconfirmed">Unconfirmed</option>
              {authStatusFilter && authStatusFilter !== 'unconfirmed' && (
                <option value={authStatusFilter}>{humanize(authStatusFilter)}</option>
              )}
            </select>
            <span className={kit.toolbarEnd}>
              <ExportMenu
                formats={['xlsx', 'csv']}
                onExportXLSX={handleExportXLSX}
                onExportCSV={handleExportCSV}
                disabled={initialRows.length === 0}
              />
            </span>
          </div>

          {/* ── Table ──────────────────────────────────────────────────────────── */}
          {/* No `kit.tableWrap` here on purpose: its overflow would clip the row Actions menu. `table-cards`
              (global) turns the list into cards at ≤640. */}
          <div className="table-cards">
            <table className={kit.comfortable}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Auth</th>
                  <th>Last sign in</th>
                  <th>Organizations</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {initialRows.length === 0 && (
                  <tr><td colSpan={5} className={kit.empty}>
                    {query.length >= 2 ? 'No customer users match this search.' : 'No users found.'}
                  </td></tr>
                )}
                {initialRows.map(row => {
                  const reset    = resetState[row.userId] ?? {};
                  const rowError = rowErrors[row.userId];
                  const menuOpen = openMenuId === row.userId;
                  const rowBusy  = isBusy(row.userId);
                  const hasEmail = row.email && row.email !== '(unknown)';

                  return (
                    <tr key={row.userId}>
                      <td className="table-cards-title">
                        <div className={styles.primaryText}>{row.displayName || '-'}</div>
                        <span className={kit.sub}>{row.email}</span>
                        <span className={`${kit.sub} ${kit.code}`}>{row.userId}</span>
                        {row.livePortalCount > 1 && (
                          <div className={styles.inCell}>
                            <span
                              className={`${kit.chip} ${kit.chipBad}`}
                              title="This account owns more than one live Premium Coaches Portal — review for the one-portal cleanup."
                            >
                              ⚠ {row.livePortalCount} live portals
                            </span>
                          </div>
                        )}
                        {reset.sent && (
                          <div className={`${kit.notice} ${kit.noticeGood} ${styles.inCellNotice}`}>
                            <MailCheck size={12} />
                            <span>Reset email sent to {row.email}</span>
                          </div>
                        )}
                        {(reset.error || rowError) && (
                          <div className={`${kit.fieldError} ${styles.inCell}`}>{reset.error || rowError}</div>
                        )}
                      </td>

                      <td data-label="Auth">
                        <span className={`${kit.chip} ${statusChip(row.authStatus)}`}>
                          {humanize(row.authStatus)}
                        </span>
                      </td>

                      <td className={kit.nowrap} data-label="Last sign in">
                        <span title={row.lastSignIn ? fmtAbsoluteDateTime(row.lastSignIn) : undefined}>
                          {fmtSince(row.lastSignIn, '-')}
                        </span>
                      </td>

                      <td data-label="Organizations">
                        <div className={styles.membershipList}>
                          {row.memberships.length === 0 && <span className={kit.muted}>No org memberships found</span>}
                          {row.memberships.map(m => (
                            <div key={`${row.userId}-${m.orgId}`} className={styles.membership}>
                              <Link href={`/platform-admin/orgs/${m.orgId}`} className={kit.nameLink}>{m.orgName}</Link>
                              <span className={kit.code}>/{m.orgSlug}</span>
                              <span className={`${kit.chip} ${kit.chipQuiet}`}>{humanize(m.role)}</span>
                              <span className={`${kit.chip} ${statusChip(m.status)}`}>{humanize(m.status)}</span>
                              <span className={kit.muted}>{PLAN_CONFIG[m.planId as keyof typeof PLAN_CONFIG]?.label ?? m.planId} / {humanize(m.subscriptionStatus)}</span>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className={styles.actionsCell}>
                        {!canManageUsers ? (
                          <span className={kit.muted}>View only</span>
                        ) : (
                        <div className={styles.actionsMenu} ref={menuOpen ? menuRef : undefined}>
                          <button
                            className="btn btn-secondary btn-sm"
                            type="button"
                            disabled={rowBusy || !hasEmail}
                            onClick={() => setOpenMenuId(menuOpen ? null : row.userId)}
                            aria-expanded={menuOpen}
                          >
                            {rowBusy ? (
                              <>
                                {busy?.action === 'reset'           && 'Sending...'}
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
                              {/* Triage order: everyday/safe → edits → destructive (last). */}
                              <button className={styles.menuItem} type="button" onClick={() => sendReset(row)}>
                                Reset password
                              </button>
                              {row.authStatus === 'unconfirmed' && (
                                <button className={styles.menuItem} type="button" onClick={() => handleConfirmEmail(row.userId, row.email)}>
                                  Confirm email
                                </button>
                              )}
                              <button
                                className={styles.menuItem}
                                type="button"
                                onClick={() => { setOpenMenuId(null); setConfirmModal({ userId: row.userId, email: row.email, action: 'revoke-sessions' }); }}
                              >
                                Revoke sessions
                              </button>
                              <div className={styles.menuDivider} />
                              <button className={styles.menuItem} type="button" onClick={() => openEditModal(row)}>
                                Edit info
                              </button>
                              <button className={styles.menuItem} type="button" onClick={() => openNotesModal(row)}>
                                Notes
                              </button>
                              <div className={styles.menuDivider} />
                              {row.authStatus !== 'banned' ? (
                                <button
                                  className={`${styles.menuItem} ${styles.menuItemDanger}`}
                                  type="button"
                                  onClick={() => { setOpenMenuId(null); setConfirmModal({ userId: row.userId, email: row.email, action: 'ban' }); }}
                                >
                                  Ban user
                                </button>
                              ) : (
                                <button
                                  className={styles.menuItem}
                                  type="button"
                                  onClick={() => { setOpenMenuId(null); setConfirmModal({ userId: row.userId, email: row.email, action: 'unban' }); }}
                                >
                                  Unban user
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  className={`${styles.menuItem} ${styles.menuItemDanger}`}
                                  type="button"
                                  onClick={() => openDeleteModal(row.userId, row.email)}
                                >
                                  Delete user
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ─────────────────────────────────────────────────────────── */}
          {total > pageSize && (() => {
            const totalPages = Math.ceil(total / pageSize);
            const buildHref = (p: number) => {
              const params = new URLSearchParams();
              if (query) params.set('q', query);
              if (authStatusFilter) params.set('authStatus', authStatusFilter);
              params.set('page', String(p));
              return `/platform-admin/customer-users?${params.toString()}`;
            };
            return (
              <div className={styles.pagination}>
                {page > 1
                  ? <Link href={buildHref(page - 1)} className="btn btn-secondary btn-sm">← Prev</Link>
                  : <button type="button" className="btn btn-secondary btn-sm" disabled>← Prev</button>}
                <span className={kit.countQuiet}>Page {page} of {totalPages}</span>
                {page < totalPages
                  ? <Link href={buildHref(page + 1)} className="btn btn-secondary btn-sm">Next →</Link>
                  : <button type="button" className="btn btn-secondary btn-sm" disabled>Next →</button>}
              </div>
            );
          })()}
        </div>
      </section>

      {/* ── Ban / Unban / Revoke-sessions confirmation modal ─────────────────── */}
      {confirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h2 className={styles.modalTitle}>
              {confirmModal.action === 'ban'             && 'Ban user'}
              {confirmModal.action === 'unban'           && 'Unban user'}
              {confirmModal.action === 'revoke-sessions' && 'Revoke all sessions'}
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
              <button className="btn btn-secondary" type="button" onClick={() => setConfirmModal(null)}>
                Cancel
              </button>
              <button
                className={confirmModal.action === 'ban' ? 'btn btn-danger' : 'btn btn-primary'}
                type="button"
                onClick={() => executeConfirmedAction(confirmModal.userId, confirmModal.email, confirmModal.action)}
              >
                {confirmModal.action === 'ban'             && 'Ban user'}
                {confirmModal.action === 'unban'           && 'Unban user'}
                {confirmModal.action === 'revoke-sessions' && 'Revoke sessions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit info modal ─────────────────────────────────────────────────── */}
      {editModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h2 className={styles.modalTitle}>Edit user info</h2>
            <div className={kit.fieldGroup}>
              <label className={kit.label} htmlFor="customer-user-edit-email">Email</label>
              <input
                id="customer-user-edit-email"
                className={`${kit.field} ${kit.wide}`}
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                disabled={editBusy}
              />
            </div>
            <div className={kit.fieldGroup}>
              <label className={kit.label} htmlFor="customer-user-edit-name">Display name</label>
              <input
                id="customer-user-edit-name"
                className={`${kit.field} ${kit.wide}`}
                type="text"
                value={editDisplayName}
                onChange={e => setEditDisplayName(e.target.value)}
                disabled={editBusy}
              />
            </div>
            {editError && <p className={kit.fieldError}>{editError}</p>}
            <div className={styles.modalActions}>
              <button className="btn btn-secondary" type="button" onClick={() => setEditModal(null)} disabled={editBusy}>
                Cancel
              </button>
              <button className="btn btn-primary" type="button" onClick={handleUpdateUser} disabled={editBusy}>
                {editBusy ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete user modal ────────────────────────────────────────────────── */}
      {deleteModal && (() => {
        const deleteRow = initialRows.find(r => r.userId === deleteModal.userId);
        const ownedOrgs = deleteRow?.memberships.filter(m => m.role === 'owner') ?? [];
        return (
          <div className={styles.modalOverlay}>
            <div className={styles.modalBox}>
              <h2 className={styles.modalTitle}>Delete user</h2>
              {ownedOrgs.length > 0 && (
                <div className={styles.modalWarning}>
                  <strong>Owner of {ownedOrgs.length} organization{ownedOrgs.length !== 1 ? 's' : ''}:</strong>
                  <ul className={styles.modalWarningList}>
                    {ownedOrgs.map(m => (
                      <li key={m.orgId}>
                        <a href={`/platform-admin/orgs/${m.orgId}`} target="_blank" rel="noreferrer">
                          {m.orgName}
                        </a>
                        {' '}— verify ownership is transferred or the org is deleted before proceeding.
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {deleteImpact && deleteImpact.totalTeams > 0 && (
                <div className={styles.modalWarning}>
                  <strong>
                    Runs {deleteImpact.totalTeams} free coaching team{deleteImpact.totalTeams !== 1 ? 's' : ''} (Coaches Portal)
                  </strong>
                  {deleteImpact.soleOwnedTeams > 0 ? (
                    <>
                      {' '}— {deleteImpact.soleOwnedTeams} of them {deleteImpact.soleOwnedTeams !== 1 ? 'are' : 'is'} sole-owned and will be
                      {' '}<strong>permanently deleted</strong>, including roster, players, fees, and history.
                    </>
                  ) : (
                    <>{' '}— all have other active members and will survive (only this user&apos;s membership is removed).</>
                  )}
                </div>
              )}
              <p className={styles.modalBody}>
                This permanently removes <strong>{deleteModal.email}</strong> from FieldLogicHQ.
                Organization data is not deleted automatically. Type the user&apos;s email to confirm.
              </p>
              <div className={kit.fieldGroup}>
                <input
                  className={`${kit.field} ${kit.wide}`}
                  type="text"
                  placeholder={deleteModal.email}
                  aria-label="Type the user's email to confirm"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.modalActions}>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => { setDeleteModal(null); setDeleteConfirmText(''); setDeleteImpact(null); }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  type="button"
                  disabled={deleteConfirmText.trim().toLowerCase() !== deleteModal.email.toLowerCase()}
                  onClick={handleDeleteUser}
                >
                  Delete permanently
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Notes modal ──────────────────────────────────────────────────────── */}
      {notesModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalBox} ${styles.modalBoxWide}`}>
            <h2 className={styles.modalTitle}>Support notes</h2>
            <p className={`${kit.code} ${styles.modalEmail}`}>{notesModal.email}</p>

            {/* Add note */}
            <div className={styles.noteAddRow}>
              <textarea
                className={kit.textarea}
                placeholder="Add a note..."
                aria-label="Add a note"
                value={newNoteText}
                onChange={e => setNewNoteText(e.target.value)}
                rows={3}
                maxLength={4000}
                disabled={notesBusy}
              />
              <button
                className="btn btn-primary"
                type="button"
                disabled={notesBusy || !newNoteText.trim()}
                onClick={handleAddNote}
              >
                {notesBusy ? 'Saving...' : 'Add note'}
              </button>
            </div>

            {notesError && <p className={kit.fieldError}>{notesError}</p>}

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
                    <span title={fmtAbsoluteDateTime(note.created_at)}>{fmtSince(note.created_at)}</span>
                    <button
                      className={styles.noteDeleteBtn}
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      disabled={notesBusy}
                      title="Delete note"
                      aria-label="Delete note"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.modalActions}>
              <button className="btn btn-secondary" type="button" onClick={() => setNotesModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
