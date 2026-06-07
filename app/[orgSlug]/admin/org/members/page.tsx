'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users2, UserPlus, ShieldCheck, BookOpen, ChevronDown, Settings2, Mail, Trash2, ScrollText } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { getBillingHref, isTournamentTier } from '@/lib/billing-urls';
import FeedbackModal from '@/components/FeedbackModal';
import HelpTooltip from '@/components/help/HelpTooltip';
import { ROLE_DEFAULTS, hasCapability } from '@/lib/roles';
import type { OrgRole } from '@/lib/types';
import type { Capability } from '@/lib/roles';
import ExportMenu from '@/components/admin/ExportMenu';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import styles from './members.module.css';

const ROLE_INVITE_DESCRIPTIONS: Record<'admin' | 'staff' | 'official', string> = {
  admin: 'Tournament architect — can create tournaments, define divisions, manage registrations, build schedules, manage contacts and venues, post rules, send communications, and manage members. Cannot access org settings or subscription.',
  staff: 'Tournament operator — updates game times and venue assignments during events, submits scores, and posts announcements. Cannot create or delete tournaments, manage registrations, or send communications.',
  official: 'Score entry only. Scorekeepers receive a direct link to the scorekeeper app and can submit results from their assigned fields. They do not access the main admin area.',
};

const ROLE_MATRIX: { label: string; owner: boolean; admin: boolean; staff: boolean; official: boolean }[] = [
  { label: 'Create / delete tournaments',       owner: true,  admin: true,  staff: false, official: false },
  { label: 'Manage registrations',              owner: true,  admin: true,  staff: false, official: false },
  { label: 'Manage schedule & brackets',        owner: true,  admin: true,  staff: false, official: false },
  { label: 'Update game times & venues',         owner: true,  admin: true,  staff: true,  official: false },
  { label: 'Submit scores',                     owner: true,  admin: true,  staff: true,  official: true  },
  { label: 'Check teams in at the gate',        owner: true,  admin: true,  staff: true,  official: true  },
  { label: 'Manage contacts & venues',           owner: true,  admin: true,  staff: false, official: false },
  { label: 'Post announcements',                owner: true,  admin: true,  staff: true,  official: false },
  { label: 'Post / edit rules documents',       owner: true,  admin: true,  staff: false, official: false },
  { label: 'Send email communications',         owner: true,  admin: true,  staff: false, official: false },
  { label: 'Seal tournament (archive)',         owner: true,  admin: true,  staff: false, official: false },
  { label: 'Manage members',                    owner: true,  admin: true,  staff: false, official: false },
  { label: 'Org settings & branding',           owner: true,  admin: false, staff: false, official: false },
  { label: 'Subscription management',           owner: true,  admin: false, staff: false, official: false },
];

interface Member {
  id: string;
  userId: string;
  email: string;
  displayName: string | null;
  title: string | null;
  role: OrgRole;
  status: 'invited' | 'active' | 'suspended';
  capabilities: Record<string, boolean> | null;
  invitedAt: string;
  acceptedAt: string | null;
  lastSignIn: string | null;
  assignedTournamentIds: string[];
  repGroupIds: string[];
}

interface TournamentOption {
  id: string;
  name: string;
  year: number;
}

interface RepGroupOption {
  id: string;
  name: string;
}

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  staff: 'Staff',
  official: 'Scorekeeper',
  league_admin: 'League Admin',
  league_registrar: 'League Registrar',
  treasurer: 'Treasurer',
  coach: 'Coach',
};

const ROLE_TOOLTIP: Record<OrgRole, string> = {
  owner:            'Full access. Owns the org, manages the subscription, and can do everything admins can.',
  admin:            'Manages tournaments, house league, rep teams, and org settings. Cannot manage the subscription.',
  staff:            'Day-of operator. Updates game times and venue assignments, submits scores, and posts announcements. Cannot create tournaments or manage members.',
  treasurer:        'Access to accounting and ledgers only.',
  league_admin:     'Manages house league seasons, registrations, teams, and schedules.',
  league_registrar: 'Reviews and processes house league registrations only.',
  coach:            'Accesses the Coaches Portal for their assigned rep team. Cannot access the admin panel.',
  official:         'Submits scores for assigned games only through the scorekeeper app.',
};

const ROLE_BADGE: Record<OrgRole, string> = {
  owner: 'badge-primary',
  admin: 'badge-success',
  staff: 'badge-neutral',
  official: 'badge-warning',
  league_admin: 'badge-info',
  league_registrar: 'badge-info',
  treasurer: 'badge-neutral',
  coach: 'badge-info',
};

// ── Export ────────────────────────────────────────────────────────────────────

const MEMBERS_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Display Name', key: 'displayName', format: 'text' },
  { label: 'Email',        key: 'email',        format: 'text' },
  { label: 'Role',         key: 'roleLabel',    format: 'text' },
  { label: 'Status',       key: 'statusLabel',  format: 'text' },
  { label: 'Last Sign In', key: 'lastSignIn',   format: 'text' },
  { label: 'Invited',      key: 'invitedAt',    format: 'text' },
];

// ─────────────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<'invited' | 'active' | 'suspended', string> = {
  invited:   'Pending',
  active:    'Active',
  suspended: 'Suspended',
};

const STATUS_BADGE: Record<'invited' | 'active' | 'suspended', string> = {
  invited:   'badge-neutral',
  active:    'badge-success',
  suspended: 'badge-warning',
};

const CAPABILITY_LABELS: Record<Capability, string> = {
  // --- Module access ---
  module_tournaments:    'Tournament management access',
  module_communications: 'Communications access',
  module_members:        'Member management access',
  module_public_site:    'Public website access',
  module_accounting:     'Accounting access',
  module_house_league:   'House league management access',
  module_rep_teams:      'Rep team management access',
  // --- Action capabilities ---
  create_tournaments:        'Create / delete tournaments',
  manage_registrations:      'Manage registrations',
  manage_schedule_structure: 'Manage schedule & brackets',
  update_schedule:           'Update game times & venues',
  submit_scores:             'Submit scores',
  check_in_teams:            'Check teams in at the gate',
  manage_contacts:           'Manage contacts & venues',
  post_announcements:        'Post announcements',
  post_rules:                'Post / edit rules documents',
  send_communications:       'Send email communications',
  seal_tournaments:          'Seal tournament (archive)',
  manage_members:            'Manage members',
  org_settings:              'Org settings & branding',
  billing:                   'Subscription management',
};

const MODULE_CAP_KEYS: Capability[] = [
  'module_tournaments', 'module_communications', 'module_members',
  'module_public_site', 'module_accounting', 'module_house_league', 'module_rep_teams',
];
const ACTION_CAP_KEYS: Capability[] = [
  'create_tournaments', 'manage_registrations', 'manage_schedule_structure',
  'update_schedule', 'submit_scores', 'check_in_teams', 'manage_contacts', 'post_announcements',
  'post_rules', 'send_communications', 'seal_tournaments', 'manage_members',
  'org_settings', 'billing',
];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function MembersPage() {
  const { currentOrg, userRole, userCapabilities, user, loading } = useOrg();
  usePageTitle('Members');

  const [members, setMembers] = useState<Member[]>([]);
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [repGroups, setRepGroups] = useState<RepGroupOption[]>([]);
  const [fetching, setFetching] = useState(true);

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'staff' | 'official'>('staff');
  const [inviting, setInviting] = useState(false);

  // Manage modal — replaces the separate assignment, cap-override, remove, and reinvite modals
  const [manageTarget, setManageTarget] = useState<Member | null>(null);
  const [manageDraftRole, setManageDraftRole] = useState<OrgRole>('staff');
  const [manageDraftDisplayName, setManageDraftDisplayName] = useState('');
  const [manageDraftTitle, setManageDraftTitle] = useState('');
  const [manageDraftAssignments, setManageDraftAssignments] = useState<string[]>([]);
  const [manageSaving, setManageSaving] = useState(false);
  const [manageSuspending, setManageSuspending] = useState(false);
  const [reinvitingId, setReinvitingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeImpact, setRemoveImpact] = useState<{ tournamentCount: number; divisionCount: number } | null>(null);
  const [capDraft, setCapDraft] = useState<Record<string, boolean>>({});
  const [capSaving, setCapSaving] = useState(false);
  const [manageDraftRepGroupIds, setManageDraftRepGroupIds] = useState<string[]>([]);

  // Feedback
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!currentOrg) return;
    loadMembers();
    loadTournaments();
    loadRepGroups();
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
      // non-fatal — assignment UI will just show empty
    }
  }

  async function loadRepGroups() {
    try {
      const res = await fetch('/api/admin/rep-teams/groups');
      if (res.ok) {
        const data = await res.json();
        setRepGroups((data.groups ?? []).map((g: any) => ({ id: g.id, name: g.name })));
      }
    } catch {
      // non-fatal — rep group section will just be hidden
    }
  }

  function showError(msg: string) { setErrorMsg(msg); setErrorOpen(true); }
  function showSuccess(msg: string) { setSuccessMsg(msg); setSuccessOpen(true); }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
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

  function openManage(member: Member) {
    setManageTarget(member);
    setManageDraftRole(member.role);
    setManageDraftDisplayName(member.displayName ?? '');
    setManageDraftTitle(member.title ?? '');
    setManageDraftAssignments([...member.assignedTournamentIds]);
    setManageDraftRepGroupIds([...member.repGroupIds]);
    setCapDraft(member.capabilities ? { ...member.capabilities } : {});
  }

  function closeManage() {
    setManageTarget(null);
  }

  function toggleAssignment(tid: string) {
    setManageDraftAssignments(prev =>
      prev.includes(tid) ? prev.filter(id => id !== tid) : [...prev, tid]
    );
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

  async function handleManageSave() {
    if (!manageTarget) return;
    setManageSaving(true);
    const errors: string[] = [];

    const roleChanged = manageDraftRole !== manageTarget.role;
    const displayNameChanged = manageDraftDisplayName.trim() !== (manageTarget.displayName ?? '');
    const titleChanged = manageDraftTitle.trim() !== (manageTarget.title ?? '');
    const assignmentsChanged =
      JSON.stringify([...manageDraftAssignments].sort()) !==
      JSON.stringify([...manageTarget.assignedTournamentIds].sort());
    const repGroupsChanged =
      JSON.stringify([...manageDraftRepGroupIds].sort()) !==
      JSON.stringify([...manageTarget.repGroupIds].sort());

    if (roleChanged || displayNameChanged || titleChanged) {
      const patchBody: Record<string, unknown> = {};
      if (roleChanged) patchBody.role = manageDraftRole;
      if (displayNameChanged) patchBody.displayName = manageDraftDisplayName.trim() || null;
      if (titleChanged) patchBody.title = manageDraftTitle.trim() || null;
      const res = await fetch(`/api/admin/members/${manageTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      });
      if (!res.ok) {
        const d = await res.json();
        errors.push(d.error ?? 'Role update failed');
      } else {
        const newDisplayName = displayNameChanged ? (manageDraftDisplayName.trim() || null) : manageTarget.displayName;
        const newTitle = titleChanged ? (manageDraftTitle.trim() || null) : manageTarget.title;
        setMembers(prev => prev.map(m =>
          m.id === manageTarget.id ? { ...m, role: manageDraftRole, displayName: newDisplayName, title: newTitle } : m
        ));
      }
    }

    if (assignmentsChanged) {
      const res = await fetch(`/api/admin/members/${manageTarget.id}/assignments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentIds: manageDraftAssignments }),
      });
      if (!res.ok) {
        const d = await res.json();
        errors.push(d.error ?? 'Assignment update failed');
      } else {
        setMembers(prev => prev.map(m =>
          m.id === manageTarget.id ? { ...m, assignedTournamentIds: manageDraftAssignments } : m
        ));
      }
    }

    if (repGroupsChanged) {
      const res = await fetch(`/api/admin/members/${manageTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repGroupIds: manageDraftRepGroupIds }),
      });
      if (!res.ok) {
        const d = await res.json();
        errors.push(d.error ?? 'Rep group scope update failed');
      } else {
        setMembers(prev => prev.map(m =>
          m.id === manageTarget.id ? { ...m, repGroupIds: manageDraftRepGroupIds } : m
        ));
      }
    }

    setManageSaving(false);
    if (errors.length > 0) {
      showError(errors.join('\n'));
    } else {
      closeManage();
      if (roleChanged || displayNameChanged || titleChanged || assignmentsChanged || repGroupsChanged) showSuccess('Member updated.');
    }
  }

  async function handleSaveCapabilities() {
    if (!manageTarget) return;
    setCapSaving(true);
    const res = await fetch(`/api/admin/members/${manageTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capabilities: capDraft }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error ?? 'Failed to save capabilities');
    } else {
      const saved = Object.keys(capDraft).length > 0 ? capDraft : null;
      setMembers(prev => prev.map(m =>
        m.id === manageTarget.id ? { ...m, capabilities: saved } : m
      ));
      showSuccess('Capability overrides saved.');
    }
    setCapSaving(false);
  }

  async function handleSuspend() {
    if (!manageTarget) return;
    setManageSuspending(true);
    const newStatus = manageTarget.status === 'suspended' ? 'active' : 'suspended';
    const res = await fetch(`/api/admin/members/${manageTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error ?? 'Status update failed');
    } else {
      setMembers(prev => prev.map(m =>
        m.id === manageTarget.id ? { ...m, status: newStatus } : m
      ));
      setManageTarget(prev => prev ? { ...prev, status: newStatus } : null);
      showSuccess(newStatus === 'suspended'
        ? `${manageTarget.email} has been suspended.`
        : `${manageTarget.email} has been reinstated.`
      );
    }
    setManageSuspending(false);
  }

  async function handleRemove(member: Member) {
    setRemovingId(member.id);
    const res = await fetch(`/api/admin/members/${member.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error ?? 'Remove failed');
    } else {
      setConfirmRemoveId(null);
      setRemoveImpact(null);
      showSuccess(`${member.email} has been removed.`);
      loadMembers();
    }
    setRemovingId(null);
  }

  async function handleReinvite(member: Member) {
    setReinvitingId(member.id);
    const res = await fetch(`/api/admin/members/${member.id}/reinvite`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error ?? 'Resend failed');
    } else {
      showSuccess(`Invite resent to ${member.email}.`);
    }
    setReinvitingId(null);
  }

  if (loading) {
    return <div className={styles.page}><p className={styles.muted}>Loading…</p></div>;
  }

  if (!loading && !hasCapability(userRole ?? 'official', userCapabilities, 'module_members')) {
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

  const planCfg = currentOrg ? PLAN_CONFIG[currentOrg.planId] : PLAN_CONFIG.tournament;
  const isTournamentPlan = isTournamentTier(currentOrg?.planId);
  const billingHref = currentOrg ? getBillingHref(currentOrg.slug, currentOrg.planId) : '#';
  const auditHref = isTournamentPlan
    ? `/${currentOrg?.slug}/admin/tournaments/settings/members/audit`
    : `/${currentOrg?.slug}/admin/org/members/audit`;
  const seatLimit = planCfg.seatLimit;
  const billableMembers = planCfg.officialsFreeSeats
    ? members.filter(m => m.role !== 'official')
    : members;
  const seatCount = billableMembers.length;
  const officialCount = members.length - billableMembers.length;
  const atLimit = seatCount >= seatLimit;
  const nearLimit = !atLimit && seatLimit < 9999 && seatCount > 0 && seatCount / seatLimit >= 0.8;

  // ── Export ──────────────────────────────────────────────────────────────────

  function buildMemberExportRows(rows: Member[]) {
    return rows.map(m => ({
      displayName: m.displayName ?? '',
      email:       m.email,
      roleLabel:   ROLE_LABELS[m.role],
      statusLabel: STATUS_LABEL[m.status],
      lastSignIn:  m.lastSignIn ? formatDate(m.lastSignIn) : '—',
      invitedAt:   formatDate(m.invitedAt),
    }));
  }

  function handleExportXLSX() {
    const rows     = buildMemberExportRows(members);
    const headers  = serializeHeaders(MEMBERS_EXPORT_COLS);
    const data     = serializeRows(rows, MEMBERS_EXPORT_COLS);
    const filename = buildFilename({ org: currentOrg?.slug, dataset: 'members' }, 'xlsx');
    downloadXLSX(filename, headers, data, 'Members');
  }

  function handleExportCSV() {
    const rows     = buildMemberExportRows(members);
    const headers  = serializeHeaders(MEMBERS_EXPORT_COLS);
    const data     = serializeRows(rows, MEMBERS_EXPORT_COLS);
    const filename = buildFilename({ org: currentOrg?.slug, dataset: 'members' }, 'csv');
    downloadCSVBlob(filename, generateCSV(headers, data));
  }

  // ────────────────────────────────────────────────────────────────────────────

  function renderMemberTable(rows: Member[]) {
    return (
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last Sign In</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(m => {
            const isSelf = m.userId === user?.id;
            return (
              <tr key={m.id} className={m.status === 'suspended' ? styles.suspendedRow : undefined}>
                <td className={styles.emailCell}>
                  <div className={styles.emailCellInner}>
                    <div>
                      {m.displayName && (
                        <div className={styles.displayName}>{m.displayName}</div>
                      )}
                      <div className={m.displayName ? styles.emailSecondary : undefined}>
                        {m.email}
                      </div>
                    </div>
                    {isSelf && <span className={styles.youBadge}>you</span>}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <span className={`badge ${ROLE_BADGE[m.role]}`}>{ROLE_LABELS[m.role]}</span>
                    <HelpTooltip title={ROLE_LABELS[m.role]} body={ROLE_TOOLTIP[m.role]} size="sm" />
                  </div>
                  {m.title && (
                    <div className={styles.memberTitle}>{m.title}</div>
                  )}
                </td>
                <td>
                  <span className={`badge ${STATUS_BADGE[m.status]}`}>{STATUS_LABEL[m.status]}</span>
                </td>
                <td className={styles.dimCell}>{formatDate(m.lastSignIn)}</td>
                <td>
                  {isSelf && m.role === 'owner' && (
                    <div className={styles.actionGroup}>
                      <button
                        className={`btn btn-outline btn-data ${styles.manageBtn}`}
                        onClick={() => openManage(m)}
                      >
                        Manage
                      </button>
                    </div>
                  )}
                  {!isSelf && m.role !== 'owner' && (
                    <div className={styles.actionGroup}>
                      {m.status === 'invited' && (
                        <button
                          className={styles.iconBtn}
                          title="Resend invite"
                          onClick={() => handleReinvite(m)}
                          disabled={reinvitingId === m.id}
                        >
                          <Mail size={15} />
                        </button>
                      )}
                      {confirmRemoveId === m.id ? (
                        <div className={styles.inlineConfirm}>
                          <p className={styles.inlineConfirmText}>
                            This will <strong>permanently delete</strong> their account.
                            They must be re-invited to regain access.
                          </p>
                          {removeImpact && (removeImpact.tournamentCount > 0 || removeImpact.divisionCount > 0) && (
                            <p className={styles.inlineConfirmText} style={{ color: 'var(--logic-amber, #F59E0B)', marginTop: '0.35rem' }}>
                              ⚠ This member is the contact for{removeImpact.tournamentCount > 0 ? ` ${removeImpact.tournamentCount} tournament${removeImpact.tournamentCount !== 1 ? 's' : ''}` : ''}{removeImpact.tournamentCount > 0 && removeImpact.divisionCount > 0 ? ' and' : ''}{removeImpact.divisionCount > 0 ? ` ${removeImpact.divisionCount} division${removeImpact.divisionCount !== 1 ? 's' : ''}` : ''}. Those will reset to the tournament default on removal.
                            </p>
                          )}
                          <span className={styles.inlineConfirmRow} style={{ marginTop: '0.5rem' }}>
                            <button
                              className="btn btn-danger btn-data"
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                              onClick={() => handleRemove(m)}
                              disabled={removingId === m.id}
                            >
                              {removingId === m.id ? '…' : 'Remove'}
                            </button>
                            <button
                              className="btn btn-outline btn-data"
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                              onClick={() => { setConfirmRemoveId(null); setRemoveImpact(null); }}
                            >
                              Cancel
                            </button>
                          </span>
                        </div>
                      ) : (
                        <button
                          className={styles.iconBtnDanger}
                          title="Remove member"
                          onClick={async () => {
                            setConfirmRemoveId(m.id);
                            setRemoveImpact(null);
                            const impactRes = await fetch(`/api/admin/members/${m.id}`);
                            if (impactRes.ok) {
                              const impactData = await impactRes.json() as { tournamentCount: number; divisionCount: number };
                              setRemoveImpact(impactData);
                            }
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                      <button
                        className={`btn btn-outline btn-data ${styles.manageBtn}`}
                        onClick={() => openManage(m)}
                      >
                        Manage
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
            <p className={styles.pageSub}>{isTournamentPlan ? 'Manage who has access to your tournaments' : 'Manage who has access to your organization'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {userRole === 'owner' && (
            <Link
              href={auditHref}
              className="btn btn-outline btn-data"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <ScrollText size={14} />
              Audit Log
            </Link>
          )}
          <ExportMenu
            formats={['xlsx', 'csv']}
            onExportXLSX={handleExportXLSX}
            onExportCSV={handleExportCSV}
            disabled={members.length === 0}
            planId={currentOrg?.planId}
          />
          <button
            className="btn btn-lime btn-data"
            onClick={() => setInviteOpen(true)}
            id="members-invite-btn"
          >
            <UserPlus size={15} />
            Invite Member
          </button>
        </div>
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
                <th>Scorekeeper</th>
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
            {' '}<strong>Admin</strong> is the co-organizer role (full tournament management, member management, no subscription/settings).
            {' '}<strong>Staff</strong> are day-of operators (schedule updates, scores, announcements only).
            {' '}<strong>Scorekeepers</strong> receive a separate scorekeeper link and are not expected to use the admin area.
          </p>
          <p className={styles.roleRefNote} style={{ marginTop: '0.5rem' }}>
            <strong>Tournament assignments:</strong> Staff and scorekeepers can be restricted to specific tournaments.
            Click <strong>Manage</strong> on any member row to edit tournament access. A member with no assignments sees all tournaments.
          </p>
          <p className={styles.roleRefNote} style={{ marginTop: '0.5rem' }}>
            <strong>Staffing tip:</strong> Start with Staff for day-of operators — they can update scores, manage schedules,
            and post announcements. Use Admin only for people who also need to manage members or change settings.
          </p>
          {currentOrg?.planId === 'tournament' && (
            <p className={styles.roleRefNote} style={{ marginTop: '0.5rem' }}>
              <strong>Seats:</strong> Your Tournament plan includes 3 staff seats (owner + 2 others). Scorekeepers count toward this limit.{' '}
              <Link href={billingHref} style={{ color: 'var(--logic-lime)' }}>Upgrade to Tournament Plus</Link>{' '}
              for unlimited seats and free scorekeepers.
            </p>
          )}
          {currentOrg?.planId === 'tournament_plus' && (
            <p className={styles.roleRefNote} style={{ marginTop: '0.5rem' }}>
              <strong>Seats:</strong> Your Tournament Plus plan includes unlimited staff seats. Scorekeepers are always free and don&apos;t use a seat.
            </p>
          )}
        </div>
      </details>

      {/* Seat usage banner */}
      <div className={styles.seatBanner}>
        <span className={styles.seatCount}>
          <strong>{seatCount}</strong> of <strong>{seatLimit >= 9999 ? 'Unlimited' : seatLimit}</strong> staff seats used
          {planCfg.officialsFreeSeats && officialCount > 0 && (
            <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontWeight: 400 }}>
              · {officialCount} scorekeeper{officialCount === 1 ? '' : 's'} (free on this plan)
            </span>
          )}
          {currentOrg?.planId === 'tournament' && (
            <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--white-30)', fontWeight: 400, marginTop: '0.15rem' }}>
              Tournament plan · upgrade to Tournament Plus for unlimited seats and free scorekeepers
            </span>
          )}
          {currentOrg?.planId === 'tournament_plus' && (
            <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--white-30)', fontWeight: 400, marginTop: '0.15rem' }}>
              Tournament Plus · scorekeepers are always free
            </span>
          )}
        </span>
        {atLimit && (
          <Link href={billingHref} className={styles.upgradeLink}>
            Upgrade to add more members →
          </Link>
        )}
      </div>

      {/* 80% seat nudge */}
      {nearLimit && (
        <div className={styles.nudgeBanner}>
          You're using {seatCount} of {seatLimit} seats.{' '}
          <Link href={billingHref} className={styles.nudgeLink}>
            Upgrade to add more →
          </Link>
        </div>
      )}

      {/* Members table */}
      <div className={styles.tableWrap}>
        {fetching ? (
          <p className={styles.muted} style={{ padding: '1.5rem' }}>Loading members…</p>
        ) : nonOfficials.length <= 1 && officials.length === 0 ? (
          <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--white-70)', marginBottom: '0.4rem' }}>
              Invite your first team member
            </p>
            <p className={styles.muted} style={{ fontSize: '0.85rem', maxWidth: 400, margin: '0 auto 1rem' }}>
              Add a Staff member to manage game-day operations, or a Scorekeeper to submit results from the field.
            </p>
            <button className="btn btn-lime btn-data" onClick={() => setInviteOpen(true)}>
              <UserPlus size={15} />
              Invite Member
            </button>
          </div>
        ) : (
          <>
            {renderMemberTable(nonOfficials)}
            {officials.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <h2 className={styles.pageTitle} style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Scorekeepers</h2>
                {renderMemberTable(officials)}
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
                  <option value="official">Scorekeeper</option>
                </select>
                <p className={styles.roleHint}>{ROLE_INVITE_DESCRIPTIONS[inviteRole]}</p>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className="btn btn-outline" onClick={() => setInviteOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-lime btn-data" disabled={inviting} id="invite-submit-btn">
                  {inviting ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Member modal */}
      {manageTarget && (
        <div className={styles.modalOverlay} onClick={closeManage}>
          <div className={`${styles.modal} ${styles.modalWide}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <Settings2 size={18} />
              <h3>Manage Member</h3>
            </div>

            {/* Identity line */}
            <p style={{ fontSize: '0.85rem', color: 'var(--white-40)', marginBottom: '1rem' }}>
              <strong style={{ color: 'var(--white-90, #f0f0f0)' }}>{manageTarget.email}</strong>
              {' '}
              <span className={`badge ${STATUS_BADGE[manageTarget.status]}`} style={{ fontSize: '0.68rem', verticalAlign: 'middle' }}>
                {STATUS_LABEL[manageTarget.status]}
              </span>
            </p>

            <div className={styles.modalBody}>

              {/* Role */}
              <div className={styles.modalSection}>
                <div className={styles.modalSectionTitle}>
                  {manageTarget.role === 'owner' ? 'Profile' : 'Role'}
                </div>
                {manageTarget.role !== 'owner' && (
                  <>
                    <select
                      className={styles.input}
                      value={manageDraftRole}
                      onChange={e => setManageDraftRole(e.target.value as OrgRole)}
                      aria-label="Change role"
                    >
                      <option value="admin">Admin</option>
                      <option value="staff">Staff</option>
                      <option value="official">Scorekeeper</option>
                    </select>
                    {planCfg.officialsFreeSeats && manageDraftRole === 'official' && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--white-30)', marginTop: '0.35rem' }}>
                        Scorekeepers are free seats on your plan.
                      </p>
                    )}
                  </>
                )}
                {manageTarget.role === 'owner' && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--white-30)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                    Ownership cannot be transferred from this page — contact support if you need to change the org owner.
                  </p>
                )}
                <div className={styles.field} style={{ marginTop: manageTarget.role === 'owner' ? 0 : '0.75rem', marginBottom: 0 }}>
                  <label className={styles.label}>
                    Display Name
                    <span className={styles.optional}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={manageDraftDisplayName}
                    onChange={e => setManageDraftDisplayName(e.target.value)}
                    maxLength={60}
                    placeholder="Shown in place of email in the member list"
                  />
                </div>
                <div className={styles.field} style={{ marginTop: '0.6rem', marginBottom: 0 }}>
                  <label className={styles.label}>
                    Title
                    <span className={styles.optional}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={manageDraftTitle}
                    onChange={e => setManageDraftTitle(e.target.value)}
                    maxLength={80}
                    placeholder="e.g. Tournament Director, U13 Convenor"
                  />
                </div>
              </div>

              {/* Tournament Access — hidden for owner (always has full access) */}
              {manageTarget.role !== 'owner' && <div className={styles.modalSection}>
                <div className={styles.modalSectionTitle}>Tournament Access</div>
                <p style={{ fontSize: '0.78rem', color: 'var(--white-30)', marginBottom: '0.5rem' }}>
                  Leave all unchecked to grant access to all tournaments.
                </p>
                {tournaments.length === 0 ? (
                  <p className={styles.muted} style={{ fontSize: '0.82rem' }}>No tournaments found.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '150px', overflowY: 'auto' }}>
                    {tournaments.map(t => (
                      <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                        <input
                          type="checkbox"
                          checked={manageDraftAssignments.includes(t.id)}
                          onChange={() => toggleAssignment(t.id)}
                        />
                        {t.name} {t.year}
                      </label>
                    ))}
                  </div>
                )}
                <p style={{ fontSize: '0.75rem', color: 'var(--white-30)', marginTop: '0.4rem' }}>
                  {manageDraftAssignments.length === 0
                    ? 'No restrictions — sees all tournaments.'
                    : `Restricted to ${manageDraftAssignments.length} tournament${manageDraftAssignments.length === 1 ? '' : 's'}.`}
                </p>
              </div>}

              {/* Rep Team Group Access — shown when the org has groups, member has rep teams access, and is not owner */}
              {manageTarget.role !== 'owner' && repGroups.length > 0 && hasCapability(manageDraftRole, Object.keys(capDraft).length > 0 ? capDraft : null, 'module_rep_teams') && (
                <div className={styles.modalSection}>
                  <div className={styles.modalSectionTitle}>Rep Team Group Access</div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--white-30)', marginBottom: '0.5rem' }}>
                    Select groups to restrict this member's rep team access. Leave all unchecked to allow access to all groups.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '150px', overflowY: 'auto' }}>
                    {repGroups.map(g => (
                      <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                        <input
                          type="checkbox"
                          checked={manageDraftRepGroupIds.includes(g.id)}
                          onChange={() => setManageDraftRepGroupIds(prev =>
                            prev.includes(g.id) ? prev.filter(id => id !== g.id) : [...prev, g.id]
                          )}
                        />
                        {g.name}
                      </label>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--white-30)', marginTop: '0.4rem' }}>
                    {manageDraftRepGroupIds.length === 0
                      ? 'No restrictions — sees all rep team groups.'
                      : `Restricted to ${manageDraftRepGroupIds.length} group${manageDraftRepGroupIds.length === 1 ? '' : 's'}.`}
                  </p>
                </div>
              )}

              {/* Capability Overrides — visible when the current user is owner and the target is not owner */}
              {userRole === 'owner' && manageTarget.role !== 'owner' && (
                <div className={styles.modalSection}>
                  <div className={styles.modalSectionTitle}>Capability Overrides</div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--white-30)', marginBottom: '0.5rem', lineHeight: 1.45 }}>
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
                        {/* Section: Module Access */}
                        <tr>
                          <td colSpan={3} style={{ padding: '0.35rem 0.75rem', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--white-20)', background: 'var(--bg-3, var(--white-03))', borderTop: '1px solid var(--border)' }}>
                            Module Access
                          </td>
                        </tr>
                        {MODULE_CAP_KEYS.map(cap => {
                          const roleDefault = ROLE_DEFAULTS[manageDraftRole as OrgRole]?.has(cap);
                          const currentValue = getCapValue(cap);
                          return (
                            <tr key={cap}>
                              <td>
                                {CAPABILITY_LABELS[cap]}
                                {cap === 'module_tournaments' && currentValue === 'revoke' && (
                                  <div style={{ fontSize: '0.7rem', color: 'var(--warning)', marginTop: '0.2rem' }}>
                                    Removes access to all tournament pages for this member.
                                  </div>
                                )}
                              </td>
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

                        {/* Section: Action Capabilities */}
                        <tr>
                          <td colSpan={3} style={{ padding: '0.35rem 0.75rem', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--white-20)', background: 'var(--bg-3, var(--white-03))', borderTop: '1px solid var(--border)' }}>
                            Action Capabilities
                          </td>
                        </tr>
                        {ACTION_CAP_KEYS.map(cap => {
                          const roleDefault = ROLE_DEFAULTS[manageDraftRole as OrgRole]?.has(cap);
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
                  <p style={{ fontSize: '0.72rem', color: 'var(--white-30)', marginTop: '0.5rem' }}>
                    {Object.keys(capDraft).length === 0
                      ? 'No overrides — all capabilities follow role defaults.'
                      : `${Object.keys(capDraft).length} override${Object.keys(capDraft).length === 1 ? '' : 's'} set.`}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-data"
                      onClick={handleSaveCapabilities}
                      disabled={capSaving}
                    >
                      {capSaving ? 'Saving…' : 'Save Overrides'}
                    </button>
                  </div>
                </div>
              )}

              {/* Suspend / Reinstate — owner only, active non-owner members only */}
              {userRole === 'owner' && manageTarget.role !== 'owner' && manageTarget.status !== 'invited' && (
                <div className={styles.modalSection}>
                  <div className={styles.modalSectionTitle}>Actions</div>
                  {manageTarget.status === 'suspended' ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-data"
                      onClick={handleSuspend}
                      disabled={manageSuspending}
                    >
                      {manageSuspending ? 'Reinstating…' : 'Reinstate Member'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`btn btn-data ${styles.suspendBtn}`}
                      onClick={handleSuspend}
                      disabled={manageSuspending}
                    >
                      {manageSuspending ? 'Suspending…' : 'Suspend Member'}
                    </button>
                  )}
                </div>
              )}

            </div>{/* end modalBody */}

            <div className={styles.modalFooter}>
              <button type="button" className="btn btn-outline" onClick={closeManage}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-lime btn-data"
                onClick={handleManageSave}
                disabled={manageSaving}
              >
                {manageSaving ? 'Saving…' : 'Save Changes'}
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
