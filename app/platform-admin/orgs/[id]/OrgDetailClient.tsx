'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './orgDetail.module.css';
import HelpTooltip from '@/components/help/HelpTooltip';

interface Override {
  id: string;
  type: string;
  value: string | null;
  expiresAt: string | null;
  reason: string;
  createdBy: string;
  createdAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
}

interface Member {
  userId: string;
  role: string;
  status: string;
  email: string;
  displayName: string;
  lastSignIn: string | null;
}

interface Tournament {
  id: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

interface AuditEvent {
  id: string;
  actorEmail: string;
  action: string;
  field: string | null;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
}

interface InternalNote {
  id: string;
  body: string;
  createdByEmail: string;
  updatedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PendingOwnershipTransfer {
  linkId: string;
  teamWorkspaceId: string;
  repTeamId: string;
  teamName: string;
  teamSlug: string | null;
  workspaceOrgName: string;
  workspaceOrgSlug: string | null;
  billingMode: string | null;
  updatedAt: string;
  readyForCompletion: boolean;
}

interface PlanOption {
  id: string;
  label: string;
  defaultTournamentLimit: number;
}

interface Props {
  orgId: string;
  orgName: string;
  orgSlug: string;
  currentPlanId: string;
  currentTournamentLimit: number;
  planOptions: PlanOption[];
  canManageSupport: boolean;
  canManageBilling: boolean;
  canManageProduct: boolean;
  planModules: string[];
  enabledAddons: string[];
  internalNotes: InternalNote[];
  overrides: Override[];
  members: Member[];
  tournaments: Tournament[];
  auditEvents: AuditEvent[];
  auditHref: string;
  pendingOwnershipTransfers: PendingOwnershipTransfer[];
}

type TabId = 'support' | 'billing' | 'entitlements' | 'people' | 'activity';

const STATUS_VALUES = ['active', 'trialing', 'past_due', 'canceled'] as const;

const ADDON_MODULE_LABELS: Record<string, string> = {
  module_public_site:  'Public Site',
  module_house_league: 'House League',
  module_accounting:   'Accounting',
  module_rep_teams:    'Rep Teams',
};

type ApiErrorBody = { error?: string };
type ApiInternalNote = {
  id: string;
  body: string;
  created_by_email: string;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function mapApiNote(note: ApiInternalNote | InternalNote | undefined): InternalNote | null {
  if (!note) return null;
  if ('createdByEmail' in note) return note;
  return {
    id: note.id,
    body: note.body,
    createdByEmail: note.created_by_email,
    updatedByEmail: note.updated_by_email,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
  };
}

function fmtAuditValue(value: unknown) {
  if (value === null || value === undefined) return '-';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
}

function fmtLimit(limit: number) {
  return limit >= 9999 ? 'Unlimited' : String(limit);
}

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function tournamentStatusClass(status: string, styles: Record<string, string>) {
  if (status === 'active') return styles.badgeActive;
  if (status === 'completed') return styles.badgeMuted;
  if (status === 'draft') return styles.badgeDraft;
  return styles.badgeMuted;
}

export default function OrgDetailClient({
  orgId,
  orgName,
  orgSlug,
  currentPlanId,
  currentTournamentLimit,
  planOptions,
  canManageSupport,
  canManageBilling,
  canManageProduct,
  planModules,
  enabledAddons: initialAddons,
  internalNotes,
  overrides: initialOverrides,
  members,
  tournaments,
  auditEvents,
  auditHref,
  pendingOwnershipTransfers: initialPendingOwnershipTransfers,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('support');
  const [identityName, setIdentityName] = useState(orgName);
  const [identitySlug, setIdentitySlug] = useState(orgSlug);
  const [identityReason, setIdentityReason] = useState('');
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identitySaved, setIdentitySaved] = useState(false);
  const [identityError, setIdentityError] = useState('');
  const initialPlan = planOptions.find(plan => plan.id === currentPlanId);
  const [planId, setPlanId] = useState(currentPlanId);
  const [tournamentLimit, setTournamentLimit] = useState(String(currentTournamentLimit));
  const [planReason, setPlanReason] = useState('');
  const [planConfirmOpen, setPlanConfirmOpen] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);
  const [planError, setPlanError] = useState('');
  const [pendingOwnershipTransfers, setPendingOwnershipTransfers] = useState(initialPendingOwnershipTransfers);
  const [ownershipReasons, setOwnershipReasons] = useState<Record<string, string>>({});
  const [ownershipSaving, setOwnershipSaving] = useState<Record<string, boolean>>({});
  const [ownershipError, setOwnershipError] = useState<Record<string, string>>({});
  const [ownershipSaved, setOwnershipSaved] = useState<Record<string, boolean>>({});

  async function handleIdentitySave(e: React.FormEvent) {
    e.preventDefault();
    setIdentitySaving(true);
    setIdentitySaved(false);
    setIdentityError('');
    try {
      const res = await fetch(`/api/platform-admin/orgs/${orgId}/identity`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: identityName,
          slug: identitySlug,
          reason: identityReason,
        }),
      });
      const data = await res.json().catch((): ApiErrorBody => ({}));
      if (!res.ok) {
        setIdentityError(data.error ?? 'Save failed');
        return;
      }
      setIdentitySaved(true);
      setIdentityReason('');
      router.refresh();
    } catch {
      setIdentityError('Network error');
    } finally {
      setIdentitySaving(false);
    }
  }

  function handlePlanSelect(nextPlanId: string) {
    const nextPlan = planOptions.find(plan => plan.id === nextPlanId);
    setPlanId(nextPlanId);
    setTournamentLimit(String(nextPlan?.defaultTournamentLimit ?? currentTournamentLimit));
    setPlanSaved(false);
    setPlanError('');
  }

  function handlePlanSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedLimit = Number(tournamentLimit);
    if (!Number.isFinite(parsedLimit) || parsedLimit < 0) {
      setPlanError('Tournament limit must be zero or higher');
      return;
    }
    if (!planReason.trim()) {
      setPlanError('Reason is required');
      return;
    }
    setPlanError('');
    setPlanConfirmOpen(true);
  }

  async function handlePlanSave() {
    const parsedLimit = Number(tournamentLimit);
    setPlanSaving(true);
    setPlanSaved(false);
    setPlanError('');
    try {
      const res = await fetch(`/api/platform-admin/orgs/${orgId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          tournamentLimit: parsedLimit,
          reason: planReason,
        }),
      });
      const data = await res.json().catch((): ApiErrorBody => ({}));
      if (!res.ok) {
        setPlanError(data.error ?? 'Plan update failed');
        return;
      }
      setPlanSaved(true);
      setPlanReason('');
      setPlanConfirmOpen(false);
      router.refresh();
    } catch {
      setPlanError('Network error');
    } finally {
      setPlanSaving(false);
    }
  }

  async function handleOwnershipTransferComplete(linkId: string) {
    const reason = ownershipReasons[linkId]?.trim() ?? '';
    if (reason.length < 5) {
      setOwnershipError(prev => ({ ...prev, [linkId]: 'Reason is required' }));
      return;
    }

    setOwnershipSaving(prev => ({ ...prev, [linkId]: true }));
    setOwnershipError(prev => ({ ...prev, [linkId]: '' }));
    setOwnershipSaved(prev => ({ ...prev, [linkId]: false }));
    try {
      const res = await fetch(`/api/platform-admin/team-ownership-transfers/${linkId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch((): ApiErrorBody => ({}));
      if (!res.ok) {
        setOwnershipError(prev => ({ ...prev, [linkId]: data.error ?? 'Ownership transfer failed' }));
        return;
      }
      setPendingOwnershipTransfers(prev => prev.filter(transfer => transfer.linkId !== linkId));
      setOwnershipReasons(prev => {
        const next = { ...prev };
        delete next[linkId];
        return next;
      });
      setOwnershipSaved(prev => ({ ...prev, [linkId]: true }));
      router.refresh();
    } catch {
      setOwnershipError(prev => ({ ...prev, [linkId]: 'Network error' }));
    } finally {
      setOwnershipSaving(prev => ({ ...prev, [linkId]: false }));
    }
  }

  const [notes, setNotes] = useState<InternalNote[]>(internalNotes);
  const [newNote, setNewNote] = useState('');
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [notePendingDelete, setNotePendingDelete] = useState<InternalNote | null>(null);
  const [noteDeleting, setNoteDeleting] = useState<Record<string, boolean>>({});
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesError, setNotesError] = useState('');

  async function handleNoteCreate() {
    if (!newNote.trim()) {
      setNotesError('Enter a note before saving');
      return;
    }
    setNotesSaving(true);
    setNotesSaved(false);
    setNotesError('');
    try {
      const res = await fetch(`/api/platform-admin/orgs/${orgId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newNote }),
      });
      const data = await res.json().catch((): ApiErrorBody & { note?: ApiInternalNote } => ({}));
      if (!res.ok) {
        setNotesError(data.error ?? 'Save failed');
      } else {
        setNotes(prev => [mapApiNote(data.note), ...prev].filter((note): note is InternalNote => Boolean(note)));
        setNewNote('');
        setNotesSaved(true);
      }
    } catch {
      setNotesError('Network error');
    } finally {
      setNotesSaving(false);
    }
  }

  async function handleNoteUpdate(noteId: string) {
    const body = editingNotes[noteId] ?? '';
    if (!body.trim()) {
      setNotesError('Note cannot be empty');
      return;
    }
    setNotesSaving(true);
    setNotesSaved(false);
    setNotesError('');
    try {
      const res = await fetch(`/api/platform-admin/orgs/${orgId}/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch((): ApiErrorBody & { note?: ApiInternalNote } => ({}));
      if (!res.ok) {
        setNotesError(data.error ?? 'Update failed');
      } else {
        const updated = mapApiNote(data.note);
        if (updated) setNotes(prev => prev.map(note => note.id === noteId ? updated : note));
        setEditingNotes(prev => {
          const next = { ...prev };
          delete next[noteId];
          return next;
        });
        setNotesSaved(true);
      }
    } catch {
      setNotesError('Network error');
    } finally {
      setNotesSaving(false);
    }
  }

  async function handleNoteDelete(noteId: string) {
    setNoteDeleting(prev => ({ ...prev, [noteId]: true }));
    setNotesError('');
    try {
      const res = await fetch(`/api/platform-admin/orgs/${orgId}/notes/${noteId}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch((): ApiErrorBody => ({}));
      if (!res.ok) {
        setNotesError(data.error ?? 'Delete failed');
      } else {
        setNotes(prev => prev.filter(note => note.id !== noteId));
        setNotePendingDelete(null);
      }
    } catch {
      setNotesError('Network error');
    } finally {
      setNoteDeleting(prev => ({ ...prev, [noteId]: false }));
    }
  }

  const overrideableModules = Object.keys(ADDON_MODULE_LABELS).filter(
    m => !planModules.includes(m)
  );
  const [addonEdits, setAddonEdits] = useState<string[]>(initialAddons);
  const [addonSaving, setAddonSaving] = useState(false);
  const [addonSaved, setAddonSaved] = useState(false);
  const [addonError, setAddonError] = useState('');

  function handleAddonToggle(module: string) {
    setAddonEdits(prev =>
      prev.includes(module) ? prev.filter(m => m !== module) : [...prev, module]
    );
    setAddonSaved(false);
  }

  async function handleAddonSave() {
    setAddonSaving(true);
    setAddonError('');
    setAddonSaved(false);
    try {
      const res = await fetch(`/api/platform-admin/orgs/${orgId}/addons`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledAddons: addonEdits }),
      });
      if (!res.ok) {
        const d = await res.json().catch((): ApiErrorBody => ({}));
        setAddonError(d.error ?? 'Save failed');
      } else {
        setAddonSaved(true);
      }
    } catch {
      setAddonError('Network error');
    } finally {
      setAddonSaving(false);
    }
  }

  const [overrides, setOverrides] = useState<Override[]>(initialOverrides);
  const [showHistory, setShowHistory] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState<Record<string, boolean>>({});
  const [revoking, setRevoking] = useState<Record<string, boolean>>({});

  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'subscription_status' | 'comp_period'>('subscription_status');
  const [formValue, setFormValue] = useState('active');
  const [formExpires, setFormExpires] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const activeOverrides = overrides.filter(o => !o.revokedAt);
  const historicalOverrides = overrides.filter(o => o.revokedAt);
  const selectedPlan = planOptions.find(plan => plan.id === planId) ?? initialPlan;
  const parsedTournamentLimit = Number(tournamentLimit);
  const wouldBeOverLimit = Number.isFinite(parsedTournamentLimit) &&
    parsedTournamentLimit < 9999 &&
    tournaments.length > parsedTournamentLimit;
  const planChanged = planId !== currentPlanId || parsedTournamentLimit !== currentTournamentLimit;
  const tabItems: Array<{ id: TabId; label: string; count?: number }> = [
    { id: 'support', label: 'Support', count: notes.length + pendingOwnershipTransfers.length },
    { id: 'billing', label: 'Billing & Access', count: activeOverrides.length },
    { id: 'entitlements', label: 'Entitlements', count: addonEdits.length },
    { id: 'people', label: 'People & Tournaments', count: members.length + tournaments.length },
    { id: 'activity', label: 'Activity', count: auditEvents.length },
  ];

  async function handleRevoke(oid: string) {
    setRevoking(r => ({ ...r, [oid]: true }));
    try {
      const res = await fetch(`/api/platform-admin/orgs/${orgId}/overrides/${oid}`, {
        method: 'DELETE',
      });
      if (!res.ok) return;
      setOverrides(prev => prev.map(o =>
        o.id === oid ? { ...o, revokedAt: new Date().toISOString(), revokedBy: 'superuser' } : o
      ));
      setRevokeConfirm(r => ({ ...r, [oid]: false }));
    } finally {
      setRevoking(r => ({ ...r, [oid]: false }));
    }
  }

  async function handleAddOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!formReason.trim()) {
      setFormError('Reason is required');
      return;
    }
    setFormSaving(true);
    setFormError('');
    try {
      const body: Record<string, string> = {
        type: formType,
        reason: formReason,
      };
      if (formType === 'subscription_status') body.value = formValue;
      if (formExpires) body.expires_at = new Date(formExpires).toISOString();

      const res = await fetch(`/api/platform-admin/orgs/${orgId}/overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? 'Failed');
        return;
      }

      const created = data.override;
      setOverrides(prev => [{
        id: created.id,
        type: created.type,
        value: created.value ?? null,
        expiresAt: created.expires_at ?? null,
        reason: created.reason,
        createdBy: created.created_by,
        createdAt: created.created_at,
        revokedAt: null,
        revokedBy: null,
      }, ...prev]);

      setShowForm(false);
      setFormReason('');
      setFormExpires('');
      setFormValue('active');
      setFormType('subscription_status');
    } catch {
      setFormError('Network error');
    } finally {
      setFormSaving(false);
    }
  }

  return (
    <div className={styles.workflowShell} id="org-workflows">
      <div className={styles.workflowHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Account Workflows</h2>
          <p className={styles.emptyNote}>Grouped by what platform staff usually need to do next.</p>
        </div>
      </div>

      <div className={styles.workflowTabs} role="tablist" aria-label="Organization workflows">
        {tabItems.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.workflowTab} ${activeTab === tab.id ? styles.workflowTabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && <span className={styles.tabCount}>{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className={styles.workflowPanel}>
        {activeTab === 'support' && (
          <div className={styles.workflowGrid}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Internal Notes</h3>
                {notesSaved && <span className={styles.savedIndicator}>Saved</span>}
              </div>
              {canManageSupport && (
                <>
                  <textarea
                    className={styles.notesTextarea}
                    value={newNote}
                    onChange={e => { setNewNote(e.target.value); setNotesSaved(false); }}
                    rows={4}
                    placeholder="Add support context, billing notes, account flags..."
                  />
                  <div className={styles.notesActions}>
                    <button
                      className={styles.saveBtn}
                      onClick={handleNoteCreate}
                      disabled={notesSaving}
                    >
                      {notesSaving ? 'Saving...' : 'Add Note'}
                    </button>
                    {notesError && <span className={styles.rowError}>{notesError}</span>}
                  </div>
                </>
              )}

              <div className={styles.noteTimeline}>
                {notes.length === 0 ? (
                  <p className={styles.emptyNote}>No internal notes yet.</p>
                ) : (
                  notes.map(note => {
                    const editValue = editingNotes[note.id];
                    const isEditing = editValue !== undefined;
                    const wasEdited = note.updatedAt && note.updatedAt !== note.createdAt;

                    return (
                      <article key={note.id} className={styles.noteItem}>
                        <div className={styles.noteMeta}>
                          <span>{note.createdByEmail}</span>
                          <span>{fmtDateTime(note.createdAt)}</span>
                          {wasEdited && <span>edited {fmtDateTime(note.updatedAt)}</span>}
                        </div>
                        {isEditing ? (
                          <>
                            <textarea
                              className={styles.notesTextarea}
                              value={editValue}
                              onChange={e => setEditingNotes(prev => ({ ...prev, [note.id]: e.target.value }))}
                              rows={4}
                            />
                            <div className={styles.notesActions}>
                              <button
                                className={styles.saveBtn}
                                onClick={() => handleNoteUpdate(note.id)}
                                disabled={notesSaving}
                              >
                                {notesSaving ? 'Saving...' : 'Save Edit'}
                              </button>
                              <button
                                className={styles.cancelBtn}
                                onClick={() => setEditingNotes(prev => {
                                  const next = { ...prev };
                                  delete next[note.id];
                                  return next;
                                })}
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className={styles.noteBody}>{note.body}</p>
                            {canManageSupport && (
                              <div className={styles.noteActions}>
                                <button
                                  className={styles.historyToggle}
                                  onClick={() => setEditingNotes(prev => ({ ...prev, [note.id]: note.body }))}
                                >
                                  Edit
                                </button>
                                <button
                                  className={styles.historyToggle}
                                  onClick={() => setNotePendingDelete(note)}
                                  disabled={noteDeleting[note.id]}
                                >
                                  {noteDeleting[note.id] ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            </section>

            {canManageSupport && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Organization Identity</h3>
                <form className={styles.overrideForm} onSubmit={handleIdentitySave}>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Name</label>
                  <input
                    className={styles.formInput}
                    value={identityName}
                    onChange={e => { setIdentityName(e.target.value); setIdentitySaved(false); }}
                    required
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Slug</label>
                  <input
                    className={styles.formInput}
                    value={identitySlug}
                    onChange={e => { setIdentitySlug(e.target.value.trim().toLowerCase()); setIdentitySaved(false); }}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    required
                  />
                  <p className={styles.warningNote}>
                    Changing the slug updates public and admin URLs immediately. Existing links may break.
                  </p>
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Reason</label>
                  <textarea
                    className={styles.formTextarea}
                    value={identityReason}
                    onChange={e => setIdentityReason(e.target.value)}
                    rows={2}
                    placeholder="Support reason for this identity change"
                    required
                  />
                </div>
                {identityError && <div className={styles.rowError}>{identityError}</div>}
                <div className={styles.notesActions}>
                  <button type="submit" className={styles.saveBtn} disabled={identitySaving}>
                    {identitySaving ? 'Saving...' : identitySaved ? 'Saved' : 'Save Identity'}
                  </button>
                </div>
                </form>
              </section>
            )}

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Team Ownership Transfers</h3>
                {pendingOwnershipTransfers.length > 0 && <span className={styles.savedIndicator}>{pendingOwnershipTransfers.length} pending</span>}
              </div>
              {pendingOwnershipTransfers.length === 0 ? (
                <p className={styles.emptyNote}>No Team ownership transfers are waiting for platform completion.</p>
              ) : (
                <div className={styles.noteTimeline}>
                  {pendingOwnershipTransfers.map(transfer => (
                    <article key={transfer.linkId} className={styles.noteItem}>
                      <div className={styles.noteMeta}>
                        <span>{transfer.teamName}</span>
                        <span>{transfer.workspaceOrgSlug ? `/${transfer.workspaceOrgSlug}` : transfer.workspaceOrgName}</span>
                        <span>{fmtDateTime(transfer.updatedAt)}</span>
                      </div>
                      <p className={styles.noteBody}>
                        Ready to move roster, schedule, documents, budget, and team ledger into this organization.
                        Current Team billing: {transfer.billingMode ?? 'unknown'}.
                      </p>
                      {canManageSupport || canManageBilling ? (
                        <>
                          <textarea
                            className={styles.notesTextarea}
                            value={ownershipReasons[transfer.linkId] ?? ''}
                            onChange={event => setOwnershipReasons(prev => ({ ...prev, [transfer.linkId]: event.target.value }))}
                            rows={3}
                            placeholder="Reason for completing this ownership transfer"
                          />
                          <div className={styles.notesActions}>
                            <button
                              type="button"
                              className={styles.saveBtn}
                              onClick={() => handleOwnershipTransferComplete(transfer.linkId)}
                              disabled={!transfer.readyForCompletion || ownershipSaving[transfer.linkId]}
                            >
                              {ownershipSaving[transfer.linkId] ? 'Completing...' : 'Complete Transfer'}
                            </button>
                            {!transfer.readyForCompletion && <span className={styles.warningNote}>Both coach and org approval are required.</span>}
                            {ownershipError[transfer.linkId] && <span className={styles.rowError}>{ownershipError[transfer.linkId]}</span>}
                            {ownershipSaved[transfer.linkId] && <span className={styles.savedIndicator}>Completed</span>}
                          </div>
                        </>
                      ) : (
                        <p className={styles.emptyNote}>Support or billing permission is required to complete this transfer.</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'billing' && (
          <div className={styles.workflowGrid}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  Plan And Tournament Limit
                  <HelpTooltip
                    title="Plan And Tournament Limit"
                    body="Plan changes can affect billing, tournament access, and Stripe subscription state. Free Tournament changes clear Stripe subscription fields and leave the account active."
                  />
                </h3>
                {planSaved && <span className={styles.savedIndicator}>Saved</span>}
              </div>
              <form className={styles.overrideForm} onSubmit={handlePlanSubmit}>
                <div className={styles.planSafetyGrid}>
                  <div className={styles.planMetric}>
                    <span className={styles.fieldLabel}>Current Plan</span>
                    <strong>{initialPlan?.label ?? currentPlanId}</strong>
                  </div>
                  <div className={styles.planMetric}>
                    <span className={styles.fieldLabel}>Current Limit</span>
                    <strong>{fmtLimit(currentTournamentLimit)}</strong>
                  </div>
                  <div className={styles.planMetric}>
                    <span className={styles.fieldLabel}>Non-Archived Tournaments</span>
                    <strong>{tournaments.length}</strong>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Plan</label>
                  <select
                    className={styles.formSelect}
                    value={planId}
                    onChange={e => handlePlanSelect(e.target.value)}
                    disabled={!canManageBilling}
                  >
                    {planOptions.map(plan => (
                      <option key={plan.id} value={plan.id}>{plan.label}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Tournament Limit</label>
                  <input
                    className={styles.formInput}
                    type="number"
                    min={0}
                    value={tournamentLimit}
                    onChange={e => { setTournamentLimit(e.target.value); setPlanSaved(false); }}
                    disabled={!canManageBilling}
                  />
                  <p className={styles.warningNote}>
                    {selectedPlan
                      ? `${selectedPlan.label} defaults to ${fmtLimit(selectedPlan.defaultTournamentLimit)}. Use 9999 for unlimited.`
                      : 'Use 9999 for unlimited.'}
                  </p>
                  {wouldBeOverLimit && (
                    <p className={styles.warningNote}>
                      This would put the org over limit: {tournaments.length} non-archived tournaments against {parsedTournamentLimit}.
                    </p>
                  )}
                </div>

                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Reason *</label>
                  <textarea
                    className={styles.formTextarea}
                    value={planReason}
                    onChange={e => setPlanReason(e.target.value)}
                    rows={2}
                    placeholder="Why is this plan or limit changing?"
                    required
                    disabled={!canManageBilling}
                  />
                </div>

                {planError && <div className={styles.rowError}>{planError}</div>}

                {canManageBilling && (
                  <button type="submit" className={styles.saveBtn} disabled={planSaving || !planChanged}>
                  {planSaving ? 'Saving...' : 'Review Change'}
                  </button>
                )}
              </form>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  Active Overrides
                  <HelpTooltip
                    title="Active Overrides"
                    body="Overrides let you manually grant subscription access states or comp periods without rewriting the account's base billing fields. All changes are audit-logged with a required reason."
                  />
                </h3>
                {canManageBilling && (
                  <button className={styles.addBtn} onClick={() => setShowForm(f => !f)}>
                    {showForm ? 'Cancel' : '+ Add Override'}
                  </button>
                )}
              </div>

            {showForm && canManageBilling && (
              <form className={styles.overrideForm} onSubmit={handleAddOverride}>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Type</label>
                  <select
                    className={styles.formSelect}
                    value={formType}
                    onChange={e => setFormType(e.target.value as typeof formType)}
                  >
                    <option value="subscription_status">Subscription Status</option>
                    <option value="comp_period">Comp Period</option>
                  </select>
                </div>

                {formType === 'subscription_status' && (
                  <div className={styles.formRow}>
                    <label className={styles.formLabel}>Status Value</label>
                    <select
                      className={styles.formSelect}
                      value={formValue}
                      onChange={e => setFormValue(e.target.value)}
                    >
                      {STATUS_VALUES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Expires (optional)</label>
                  <input
                    type="datetime-local"
                    className={styles.formInput}
                    value={formExpires}
                    onChange={e => setFormExpires(e.target.value)}
                  />
                </div>

                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Reason *</label>
                  <textarea
                    className={styles.formTextarea}
                    value={formReason}
                    onChange={e => setFormReason(e.target.value)}
                    rows={2}
                    placeholder="Why is this override being applied?"
                    required
                  />
                </div>

                {formError && <div className={styles.rowError}>{formError}</div>}

                <button type="submit" className={styles.saveBtn} disabled={formSaving}>
                  {formSaving ? 'Saving...' : 'Apply Override'}
                </button>
              </form>
            )}

            {activeOverrides.length === 0 ? (
              <p className={styles.emptyNote}>None</p>
            ) : (
              <div className={styles.overrideList}>
                {activeOverrides.map(o => (
                  <div key={o.id} className={styles.overrideRow}>
                    <div className={styles.overrideMeta}>
                      <span className={styles.overrideType}>{o.type.replace('_', ' ')}</span>
                      {o.value && <span className={styles.overrideValue}>{o.value}</span>}
                      {o.expiresAt && (
                        <span className={styles.overrideExpiry}>
                          expires {fmtDate(o.expiresAt)}
                        </span>
                      )}
                      <span className={styles.overrideReason}>{o.reason}</span>
                      <span className={styles.overrideBy}>by {o.createdBy} - {fmtDateTime(o.createdAt)}</span>
                    </div>

                    {isExpired(o.expiresAt) && (
                      <div className={styles.expiredWarning}>
                        Expired on {fmtDate(o.expiresAt!)} - revoke or extend
                      </div>
                    )}

                    {canManageBilling && (
                      <div className={styles.revokeCell}>
                      {revokeConfirm[o.id] ? (
                        <>
                          <span className={styles.confirmLabel}>Confirm revoke?</span>
                          <button
                            className={styles.confirmBtn}
                            onClick={() => handleRevoke(o.id)}
                            disabled={revoking[o.id]}
                          >
                            {revoking[o.id] ? 'Revoking...' : 'Yes, revoke'}
                          </button>
                          <button
                            className={styles.cancelBtn}
                            onClick={() => setRevokeConfirm(r => ({ ...r, [o.id]: false }))}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className={styles.revokeBtn}
                          onClick={() => setRevokeConfirm(r => ({ ...r, [o.id]: true }))}
                        >
                          Revoke
                        </button>
                      )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {historicalOverrides.length > 0 && (
              <div className={styles.historySection}>
                <button
                  className={styles.historyToggle}
                  onClick={() => setShowHistory(h => !h)}
                >
                  {showHistory ? 'Hide' : 'Show'} {historicalOverrides.length} revoked override{historicalOverrides.length !== 1 ? 's' : ''}
                </button>
                {showHistory && (
                  <div className={styles.overrideList}>
                    {historicalOverrides.map(o => (
                      <div key={o.id} className={`${styles.overrideRow} ${styles.overrideRowRevoked}`}>
                        <div className={styles.overrideMeta}>
                          <span className={styles.overrideType}>{o.type.replace('_', ' ')}</span>
                          {o.value && <span className={styles.overrideValue}>{o.value}</span>}
                          <span className={styles.overrideReason}>{o.reason}</span>
                          <span className={styles.overrideBy}>by {o.createdBy} - {fmtDateTime(o.createdAt)}</span>
                          <span className={styles.overrideBy}>revoked by {o.revokedBy} - {fmtDateTime(o.revokedAt!)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            </section>
          </div>
        )}

        {activeTab === 'entitlements' && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Module Overrides</h3>
            {overrideableModules.length === 0 ? (
              <p className={styles.emptyNote}>All add-on modules are included in this org&apos;s plan.</p>
            ) : (
              <>
                <div className={styles.addonGrid}>
                  {overrideableModules.map(m => {
                    const enabled = addonEdits.includes(m);
                    return (
                      <div key={m} className={styles.addonRow}>
                        <span className={styles.addonLabel}>{ADDON_MODULE_LABELS[m] ?? m}</span>
                        <button
                          className={`${styles.addonToggle} ${enabled ? styles.addonToggleOn : styles.addonToggleOff}`}
                          onClick={() => handleAddonToggle(m)}
                          disabled={!canManageProduct}
                        >
                          {enabled ? 'Enabled' : 'Off'}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className={styles.notesActions}>
                  <button
                    className={styles.saveBtn}
                    onClick={handleAddonSave}
                    disabled={addonSaving || !canManageProduct}
                  >
                    {addonSaving ? 'Saving...' : addonSaved ? 'Saved' : 'Save Overrides'}
                  </button>
                  {addonError && <span className={styles.rowError}>{addonError}</span>}
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === 'people' && (
          <div className={styles.workflowGrid}>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Members</h3>
              {members.length === 0 ? (
                <p className={styles.emptyNote}>No members found.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Display Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Last Sign In</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map(m => (
                        <tr key={m.userId}>
                          <td>{m.displayName || <span className={styles.dimText}>-</span>}</td>
                          <td className={styles.mono}>{m.email}</td>
                          <td className={styles.capText}>{m.role}</td>
                          <td className={styles.capText}>{m.status}</td>
                          <td className={styles.dimText}>
                            {m.lastSignIn ? fmtDate(m.lastSignIn) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Non-Archived Tournaments</h3>
              {tournaments.length === 0 ? (
                <p className={styles.emptyNote}>No non-archived tournaments.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Start</th>
                        <th>End</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tournaments.map(t => (
                        <tr key={t.id}>
                          <td>{t.name}</td>
                          <td>
                            <span className={`${styles.badge} ${tournamentStatusClass(t.status, styles)}`}>
                              {t.status}
                            </span>
                          </td>
                          <td className={styles.dimText}>{t.startDate ? fmtDate(t.startDate) : '-'}</td>
                          <td className={styles.dimText}>{t.endDate ? fmtDate(t.endDate) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'activity' && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Recent Platform Activity</h3>
              <a href={auditHref} className={styles.adminLink}>
                Audit Log
              </a>
            </div>
            {auditEvents.length === 0 ? (
              <p className={styles.emptyNote}>No platform audit entries for this org yet.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>Field</th>
                      <th>New Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEvents.map(event => (
                      <tr key={event.id}>
                        <td className={styles.dimText}>{fmtDateTime(event.createdAt)}</td>
                        <td className={styles.mono}>{event.actorEmail}</td>
                        <td>{event.action}</td>
                        <td className={styles.dimText}>{event.field ?? '-'}</td>
                        <td className={styles.mono}>{fmtAuditValue(event.newValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {notePendingDelete && (
        <div className={styles.modalBackdrop} role="presentation">
          <section
            className={styles.confirmModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-note-title"
          >
            <div>
              <div className={styles.sectionTitle} id="delete-note-title">Delete Internal Note</div>
              <p className={styles.modalCopy}>
                This removes the note from the support timeline. The audit log will keep a record of the delete action.
              </p>
              <p className={styles.modalPreview}>{notePendingDelete.body}</p>
            </div>
            {notesError && <span className={styles.rowError}>{notesError}</span>}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setNotePendingDelete(null)}
                disabled={noteDeleting[notePendingDelete.id]}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={() => handleNoteDelete(notePendingDelete.id)}
                disabled={noteDeleting[notePendingDelete.id]}
              >
                {noteDeleting[notePendingDelete.id] ? 'Deleting...' : 'Delete Note'}
              </button>
            </div>
          </section>
        </div>
      )}

      {planConfirmOpen && (
        <div className={styles.modalBackdrop} role="presentation">
          <section
            className={styles.confirmModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-change-title"
          >
            <div>
              <div className={styles.sectionTitle} id="plan-change-title">Confirm Plan Change</div>
              <p className={styles.modalCopy}>
                Apply this account billing change? The update will be audit-logged with your reason.
              </p>
              <div className={styles.modalPreview}>
                <div>Plan: {initialPlan?.label ?? currentPlanId} to {selectedPlan?.label ?? planId}</div>
                <div>Limit: {fmtLimit(currentTournamentLimit)} to {fmtLimit(parsedTournamentLimit)}</div>
                <div>Reason: {planReason}</div>
              </div>
              {planId === 'tournament' && (
                <p className={styles.warningNote}>
                  Tournament is the free plan. Saving will clear Stripe subscription fields and set status to active.
                </p>
              )}
              {wouldBeOverLimit && (
                <p className={styles.warningNote}>
                  This account will be over its tournament limit after the change.
                </p>
              )}
            </div>
            {planError && <span className={styles.rowError}>{planError}</span>}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setPlanConfirmOpen(false)}
                disabled={planSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={handlePlanSave}
                disabled={planSaving}
              >
                {planSaving ? 'Saving...' : 'Apply Change'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
