'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './orgDetail.module.css';
import HelpTooltip from '@/components/help/HelpTooltip';

interface Override {
  id: string;
  type: string;
  value: string | null;
  target: { addons?: string[] } | null;
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

type CancelSubPreflight = {
  planLabel: string;
  activeTournamentCount: number;
  tournaments: Array<{ id: string; name: string; status: string }>;
  shutsDown: string[];
  retentionDays: number;
};

type DeleteOrgPreflight = {
  orgName: string;
  orgSlug: string;
  planLabel: string;
  subscriptionStatus: string | null;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  hasActiveSubscription: boolean;
  memberCount: number;
  tournamentCount: number;
  coachesLinkCount: number;
  retentionRecordCount: number;
};

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
  stripeSubscriptionId: string | null;
  subscriptionStatus: string;
  isSuperAdmin: boolean;
  isFreeFloor: boolean;
  scopeWallHitCount: number;
}

type TabId = 'support' | 'billing' | 'entitlements' | 'people' | 'activity';

const STATUS_VALUES = ['active', 'trialing', 'past_due', 'canceled'] as const;

const ADDON_MODULE_LABELS: Record<string, string> = {
  module_public_site:  'Public Site',
  module_house_league: 'House League',
  module_accounting:   'Accounting',
  module_rep_teams:    'Rep Teams',
};

const OVERRIDE_TYPE_LABELS: Record<string, string> = {
  subscription_status: 'Subscription Status',
  comp_period:         'Comp Period',
  module_addon:        'Module Add-on',
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

function daysLeftLabel(iso: string) {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return days > 0 ? ` (${days}d left)` : '';
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
  stripeSubscriptionId,
  subscriptionStatus,
  isSuperAdmin,
  isFreeFloor,
  scopeWallHitCount,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Tab is URL-addressable (?tab=billing) so Retention/cross-team deep-links land on the
  // right tab and the back button restores it. Falls back to the support tab.
  const TAB_IDS: TabId[] = ['support', 'billing', 'entitlements', 'people', 'activity'];
  const tabParam = searchParams.get('tab');
  const initialTab: TabId = TAB_IDS.includes(tabParam as TabId) ? (tabParam as TabId) : 'support';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  function selectTab(tab: TabId) {
    setActiveTab(tab);
    // Reflect the tab in the URL without a navigation/scroll jump.
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }
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
  const [formType, setFormType] = useState<'subscription_status' | 'comp_period' | 'module_addon'>('subscription_status');
  const [formValue, setFormValue] = useState('active');
  const [formAddons, setFormAddons] = useState<string[]>([]);
  const [formExpires, setFormExpires] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [cancelSubModalOpen, setCancelSubModalOpen] = useState(false);
  const [cancelSubPreflight, setCancelSubPreflight] = useState<CancelSubPreflight | null>(null);
  const [cancelSubPreflightLoading, setCancelSubPreflightLoading] = useState(false);
  const [cancelSubReason, setCancelSubReason] = useState('');
  const [cancelSubNotifyOwner, setCancelSubNotifyOwner] = useState(false);
  const [cancelSubSaving, setCancelSubSaving] = useState(false);
  const [cancelSubError, setCancelSubError] = useState('');
  const [cancelSubDone, setCancelSubDone] = useState(false);

  async function handleOpenCancelModal() {
    setCancelSubModalOpen(true);
    setCancelSubPreflight(null);
    setCancelSubPreflightLoading(true);
    setCancelSubError('');
    try {
      const res = await fetch(`/api/platform-admin/orgs/${orgId}/cancel-subscription`);
      const data = await res.json().catch((): ApiErrorBody => ({}));
      if (!res.ok) {
        setCancelSubError((data as ApiErrorBody).error ?? 'Failed to load account details');
      } else {
        setCancelSubPreflight(data as CancelSubPreflight);
      }
    } catch {
      setCancelSubError('Network error');
    } finally {
      setCancelSubPreflightLoading(false);
    }
  }

  async function handleCancelSubscription() {
    if (!cancelSubReason.trim()) {
      setCancelSubError('Reason is required');
      return;
    }
    setCancelSubSaving(true);
    setCancelSubError('');
    try {
      const res = await fetch(`/api/platform-admin/orgs/${orgId}/cancel-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelSubReason, notifyOwner: cancelSubNotifyOwner }),
      });
      const data = await res.json().catch((): ApiErrorBody => ({}));
      if (!res.ok) {
        setCancelSubError((data as ApiErrorBody).error ?? 'Cancellation failed');
      } else {
        setCancelSubModalOpen(false);
        setCancelSubDone(true);
        const d = data as { stripeWarning?: string };
        if (d.stripeWarning) {
          setCancelSubError(`Canceled in FieldLogicHQ — Stripe needs manual action: ${d.stripeWarning}`);
        }
        router.refresh();
      }
    } catch {
      setCancelSubError('Network error');
    } finally {
      setCancelSubSaving(false);
    }
  }

  function handleCloseCancelModal() {
    setCancelSubModalOpen(false);
    setCancelSubReason('');
    setCancelSubNotifyOwner(false);
    setCancelSubError('');
  }

  const [deleteOrgSlug, setDeleteOrgSlug] = useState('');
  const [deleteOrgReason, setDeleteOrgReason] = useState('');
  const [deleteOrgNotifyOwner, setDeleteOrgNotifyOwner] = useState(false);
  const [deleteOrgDeleteStripeCustomer, setDeleteOrgDeleteStripeCustomer] = useState(false);
  const [deleteOrgSaving, setDeleteOrgSaving] = useState(false);
  const [deleteOrgError, setDeleteOrgError] = useState('');
  const [deleteOrgPreflight, setDeleteOrgPreflight] = useState<DeleteOrgPreflight | null>(null);
  const [deleteOrgPreflightLoading, setDeleteOrgPreflightLoading] = useState(false);

  async function handleLoadDeletePreflight() {
    setDeleteOrgPreflightLoading(true);
    setDeleteOrgError('');
    try {
      const res = await fetch(`/api/platform-admin/orgs/${orgId}/delete`);
      const data = await res.json().catch((): ApiErrorBody => ({}));
      if (!res.ok) {
        setDeleteOrgError((data as ApiErrorBody).error ?? 'Failed to load preflight.');
      } else {
        setDeleteOrgPreflight(data as DeleteOrgPreflight);
      }
    } catch {
      setDeleteOrgError('Network error.');
    } finally {
      setDeleteOrgPreflightLoading(false);
    }
  }

  async function handleDeleteOrg() {
    setDeleteOrgSaving(true);
    setDeleteOrgError('');
    try {
      const res = await fetch(`/api/platform-admin/orgs/${orgId}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: deleteOrgReason,
          confirmSlug: deleteOrgSlug,
          notifyOwner: deleteOrgNotifyOwner,
          deleteStripeCustomer: deleteOrgDeleteStripeCustomer,
        }),
      });
      const data = await res.json().catch((): ApiErrorBody => ({}));
      if (!res.ok) {
        setDeleteOrgError((data as ApiErrorBody).error ?? 'Delete failed.');
      } else {
        router.push('/platform-admin/orgs');
      }
    } catch {
      setDeleteOrgError('Network error.');
    } finally {
      setDeleteOrgSaving(false);
    }
  }

  const [transferOwnerModal, setTransferOwnerModal] = useState<{
    userId: string;
    email: string;
    displayName: string;
  } | null>(null);
  const [transferOwnerReason, setTransferOwnerReason] = useState('');
  const [transferOwnerSaving, setTransferOwnerSaving] = useState(false);
  const [transferOwnerError, setTransferOwnerError] = useState('');
  const [transferOwnerDone, setTransferOwnerDone] = useState('');
  const [ownerPickId, setOwnerPickId] = useState('');

  async function handleTransferOwnership() {
    if (!transferOwnerModal || !transferOwnerReason.trim()) {
      setTransferOwnerError('Reason is required');
      return;
    }
    setTransferOwnerSaving(true);
    setTransferOwnerError('');
    try {
      const res = await fetch(`/api/platform-admin/orgs/${orgId}/transfer-ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newOwnerUserId: transferOwnerModal.userId,
          reason: transferOwnerReason,
        }),
      });
      const data = await res.json().catch((): ApiErrorBody => ({}));
      if (!res.ok) {
        setTransferOwnerError((data as ApiErrorBody).error ?? 'Transfer failed');
      } else {
        setTransferOwnerDone(transferOwnerModal.email);
        setTransferOwnerModal(null);
        setTransferOwnerReason('');
        setOwnerPickId('');
        router.refresh();
      }
    } catch {
      setTransferOwnerError('Network error');
    } finally {
      setTransferOwnerSaving(false);
    }
  }

  const activeOverrides = overrides.filter(o => !o.revokedAt);
  const historicalOverrides = overrides.filter(o => o.revokedAt);
  const currentOwners = members.filter(m => m.role === 'owner');
  const eligibleNewOwners = members.filter(m => m.role !== 'owner' && m.status === 'active');
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
    if (formType === 'module_addon' && formAddons.length === 0) {
      setFormError('Select at least one module to grant');
      return;
    }
    setFormSaving(true);
    setFormError('');
    try {
      const body: Record<string, unknown> = {
        type: formType,
        reason: formReason,
      };
      if (formType === 'subscription_status') body.value = formValue;
      if (formType === 'module_addon') body.target = { addons: formAddons };
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
        target: created.target ?? null,
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
      setFormAddons([]);
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
            onClick={() => selectTab(tab.id)}
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
              {!canManageSupport && (
                <p className={styles.emptyNote}>Requires support access to add or edit notes. The timeline below is read-only.</p>
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

            {canManageSupport && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Account Ownership</h3>
                <p className={styles.emptyNote}>
                  Current owner{currentOwners.length === 1 ? '' : 's'}:{' '}
                  {currentOwners.length > 0 ? currentOwners.map(o => o.email).join(', ') : 'none assigned'}.
                </p>
                {eligibleNewOwners.length === 0 ? (
                  <p className={styles.warningNote}>
                    No other active members to transfer to. Invite the new owner to this organization and
                    have them accept first, then return here. (You can also use Make Owner on the
                    People &amp; Tournaments tab.)
                  </p>
                ) : (
                  <div className={styles.formRow}>
                    <label className={styles.formLabel}>Transfer ownership to</label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <select
                        className={styles.formSelect}
                        value={ownerPickId}
                        onChange={e => setOwnerPickId(e.target.value)}
                      >
                        <option value="">Select a member…</option>
                        {eligibleNewOwners.map(m => (
                          <option key={m.userId} value={m.userId}>
                            {m.displayName ? `${m.displayName} (${m.email})` : m.email}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={styles.saveBtn}
                        disabled={!ownerPickId}
                        onClick={() => {
                          const m = members.find(x => x.userId === ownerPickId);
                          if (!m) return;
                          setTransferOwnerDone('');
                          setTransferOwnerError('');
                          setTransferOwnerReason('');
                          setTransferOwnerModal({ userId: m.userId, email: m.email, displayName: m.displayName });
                        }}
                      >
                        Transfer ownership…
                      </button>
                    </div>
                    <p className={styles.warningNote}>
                      The selected member becomes the owner and all current owners are demoted to admin.
                    </p>
                  </div>
                )}
                {transferOwnerDone && (
                  <p className={styles.savedIndicator}>Ownership transferred to {transferOwnerDone}</p>
                )}
              </section>
            )}

            {!canManageSupport && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Organization Identity &amp; Ownership</h3>
                <p className={styles.emptyNote}>
                  Requires support access to rename the organization, change its slug, or transfer ownership.
                </p>
              </section>
            )}

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Coaches Portal Ownership Transfers</h3>
                {pendingOwnershipTransfers.length > 0 && <span className={styles.savedIndicator}>{pendingOwnershipTransfers.length} pending</span>}
              </div>
              {pendingOwnershipTransfers.length === 0 ? (
                <p className={styles.emptyNote}>No Coaches Portal ownership transfers are waiting for platform completion.</p>
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

            <div className={styles.dangerDivider}>Danger Zone</div>

            {isSuperAdmin && (
              <section className={`${styles.section} ${styles.dangerSection}`}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>Delete Organization</h3>
                  <span className={styles.overrideType}>super admin only</span>
                </div>

                {!deleteOrgPreflight && !deleteOrgPreflightLoading && (
                  <>
                    <p className={styles.warningNote}>
                      Permanently removes this organization and all its data. Load a preflight
                      summary before proceeding.
                    </p>
                    {deleteOrgError && <p className={styles.rowError}>{deleteOrgError}</p>}
                    <div className={styles.notesActions}>
                      <button
                        type="button"
                        className={styles.revokeBtn}
                        onClick={handleLoadDeletePreflight}
                      >
                        Load Delete Preflight…
                      </button>
                    </div>
                  </>
                )}

                {deleteOrgPreflightLoading && (
                  <p className={styles.emptyNote}>Loading account summary…</p>
                )}

                {deleteOrgPreflight && (
                  <>
                    {deleteOrgPreflight.hasActiveSubscription ? (
                      <p className={styles.warningNote}>
                        This organization has an active Stripe subscription. Cancel it first using{' '}
                        <button
                          type="button"
                          className={styles.historyToggle}
                          onClick={() => setActiveTab('billing')}
                        >
                          Cancel Subscription in Billing &amp; Access
                        </button>
                        , then reload the preflight here.
                      </p>
                    ) : (
                      <>
                        <div className={styles.modalPreview}>
                          <strong>What will be permanently deleted:</strong>
                          <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
                            <li>{deleteOrgPreflight.memberCount} member{deleteOrgPreflight.memberCount !== 1 ? 's' : ''}</li>
                            <li>{deleteOrgPreflight.tournamentCount} non-archived tournament{deleteOrgPreflight.tournamentCount !== 1 ? 's' : ''}</li>
                            {deleteOrgPreflight.retentionRecordCount > 0 && (
                              <li>{deleteOrgPreflight.retentionRecordCount} billing retention record{deleteOrgPreflight.retentionRecordCount !== 1 ? 's' : ''}</li>
                            )}
                            {deleteOrgPreflight.coachesLinkCount > 0 && (
                              <li>{deleteOrgPreflight.coachesLinkCount} Coaches Portal link{deleteOrgPreflight.coachesLinkCount !== 1 ? 's' : ''} — verify these are safe to remove</li>
                            )}
                            {deleteOrgPreflight.stripeCustomerId && (
                              <li>Stripe customer <code>{deleteOrgPreflight.stripeCustomerId}</code> — invoice history remains in Stripe</li>
                            )}
                          </ul>
                        </div>
                        <p className={styles.warningNote}>
                          This cannot be undone. Ensure the customer has been offered a data
                          export and that any GDPR request details are documented in internal notes.
                        </p>
                        <div className={styles.formRow}>
                          <label className={styles.formLabel}>
                            Type <strong>{orgSlug}</strong> to confirm
                          </label>
                          <input
                            className={styles.formInput}
                            value={deleteOrgSlug}
                            onChange={e => { setDeleteOrgSlug(e.target.value); setDeleteOrgError(''); }}
                            placeholder={orgSlug}
                            autoComplete="off"
                          />
                        </div>
                        <div className={styles.formRow}>
                          <label className={styles.formLabel}>Reason *</label>
                          <textarea
                            className={styles.formTextarea}
                            value={deleteOrgReason}
                            onChange={e => { setDeleteOrgReason(e.target.value); setDeleteOrgError(''); }}
                            rows={2}
                            placeholder="Why is this organization being permanently deleted?"
                          />
                        </div>
                        <div className={styles.formRow}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={deleteOrgNotifyOwner}
                              onChange={e => setDeleteOrgNotifyOwner(e.target.checked)}
                            />
                            Send account closure notification to org owner
                          </label>
                        </div>
                        {deleteOrgPreflight.stripeCustomerId && (
                          <div className={styles.formRow}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={deleteOrgDeleteStripeCustomer}
                                onChange={e => setDeleteOrgDeleteStripeCustomer(e.target.checked)}
                              />
                              Delete Stripe customer record (GDPR erasure only — removes billing history from Stripe)
                            </label>
                          </div>
                        )}
                        {deleteOrgError && <p className={styles.rowError}>{deleteOrgError}</p>}
                        <div className={styles.notesActions}>
                          <button
                            type="button"
                            className={styles.historyToggle}
                            onClick={() => { setDeleteOrgPreflight(null); setDeleteOrgSlug(''); setDeleteOrgReason(''); setDeleteOrgError(''); }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className={styles.revokeBtn}
                            onClick={handleDeleteOrg}
                            disabled={
                              deleteOrgSaving ||
                              deleteOrgSlug !== orgSlug ||
                              !deleteOrgReason.trim()
                            }
                          >
                            {deleteOrgSaving ? 'Deleting…' : 'Delete Organization'}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </section>
            )}

            {!isSuperAdmin && (
              <section className={`${styles.section} ${styles.dangerSection}`}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>Delete Organization</h3>
                  <span className={styles.overrideType}>super admin only</span>
                </div>
                <p className={styles.emptyNote}>
                  Requires super admin access. Escalate to a super admin to permanently delete an organization.
                </p>
              </section>
            )}
          </div>
        )}

        {activeTab === 'billing' && (
          <div className={styles.workflowGrid}>
            {!canManageBilling && (
              <p className={styles.warningNote}>
                View-only — requires billing access to change the plan, apply overrides, or cancel the subscription.
              </p>
            )}
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

                {/* Editable controls only for billing roles; observers see the read-only
                    summary above instead of a form full of disabled fields (PAR-007). */}
                {canManageBilling && (
                <>
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

                <button type="submit" className={styles.saveBtn} disabled={planSaving || !planChanged}>
                  {planSaving ? 'Saving...' : 'Review Change'}
                </button>
                </>
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
                    <option value="module_addon">Module Trial (timed)</option>
                  </select>
                </div>

                {formType === 'module_addon' && (
                  <div className={styles.formRow}>
                    <label className={styles.formLabel}>Modules to grant</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                      {Object.keys(ADDON_MODULE_LABELS).map(m => (
                        <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={formAddons.includes(m)}
                            onChange={e => setFormAddons(prev => e.target.checked ? [...prev, m] : prev.filter(x => x !== m))}
                          />
                          {ADDON_MODULE_LABELS[m]}
                        </label>
                      ))}
                    </div>
                    <p className={styles.warningNote}>Access turns on now and auto-reverts at the expiry below. An expiry is strongly recommended — without one, access remains permanently until manually revoked.</p>
                  </div>
                )}

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
                      <span className={styles.overrideType}>{OVERRIDE_TYPE_LABELS[o.type] ?? o.type.replace(/_/g, ' ')}</span>
                      {o.value && <span className={styles.overrideValue}>{o.value}</span>}
                      {o.type === 'module_addon' && o.target?.addons && o.target.addons.length > 0 && (
                        <span className={styles.overrideValue}>
                          {o.target.addons.map(a => ADDON_MODULE_LABELS[a] ?? a).join(', ')}
                        </span>
                      )}
                      {o.expiresAt && (
                        <span className={styles.overrideExpiry}>
                          {isExpired(o.expiresAt)
                            ? `expired ${fmtDate(o.expiresAt)}`
                            : `reverts ${fmtDate(o.expiresAt)}${daysLeftLabel(o.expiresAt)}`}
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
                          <span className={styles.overrideType}>{OVERRIDE_TYPE_LABELS[o.type] ?? o.type.replace(/_/g, ' ')}</span>
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

            {canManageBilling && stripeSubscriptionId && subscriptionStatus !== 'canceled' && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>Cancel Subscription</h3>
                </div>
                <p className={styles.warningNote}>
                  Cancels the Stripe subscription, sets this account to canceled, and archives non-archived tournaments.
                  Account data is retained for 90 days. Add an internal note after canceling to document the customer-facing context.
                </p>
                {cancelSubDone ? (
                  <p className={styles.savedIndicator}>Subscription canceled — refresh to see updated account state.</p>
                ) : (
                  <button
                    type="button"
                    className={styles.revokeBtn}
                    onClick={handleOpenCancelModal}
                  >
                    Cancel Subscription…
                  </button>
                )}
                {cancelSubError && !cancelSubModalOpen && (
                  <p className={styles.rowError}>{cancelSubError}</p>
                )}
              </section>
            )}
          </div>
        )}

        {activeTab === 'entitlements' && (
          <section className={styles.section}>
            {isFreeFloor && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>
                  League Starter scope-wall hits
                  <HelpTooltip title="Scope-wall hits" body="How many times this free-floor org hit a paid-tier scope wall — a cap-wall upgrade signal, all-time." />
                </span>
                <span className={styles.fieldValue}>{scopeWallHitCount}</span>
              </div>
            )}
            <h3 className={styles.sectionTitle}>Module Overrides</h3>
            {!canManageProduct && (
              <p className={styles.emptyNote}>Requires product access to change module overrides.</p>
            )}
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
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Members</h3>
                {transferOwnerDone && (
                  <span className={styles.savedIndicator}>Ownership transferred to {transferOwnerDone}</span>
                )}
              </div>
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
                        <th></th>
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
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {m.email && m.email !== '(unknown)' && (
                                <a
                                  href={`/platform-admin/customer-users?q=${encodeURIComponent(m.email)}`}
                                  className={styles.adminLink}
                                  title="Open this person in Customer Users (password reset, ban, notes)"
                                >
                                  User record
                                </a>
                              )}
                              {canManageSupport && m.role !== 'owner' && m.status === 'active' && (
                                <button
                                  type="button"
                                  className={styles.historyToggle}
                                  onClick={() => {
                                    setTransferOwnerDone('');
                                    setTransferOwnerError('');
                                    setTransferOwnerReason('');
                                    setTransferOwnerModal({ userId: m.userId, email: m.email, displayName: m.displayName });
                                  }}
                                >
                                  Make Owner
                                </button>
                              )}
                            </div>
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

      {cancelSubModalOpen && (
        <div className={styles.modalBackdrop} role="presentation">
          <section
            className={styles.confirmModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-sub-title"
          >
            <div>
              <div className={styles.sectionTitle} id="cancel-sub-title">Cancel Subscription</div>
              {cancelSubPreflightLoading && (
                <p className={styles.emptyNote}>Loading account details…</p>
              )}
              {!cancelSubPreflightLoading && cancelSubPreflight && (
                <>
                  <p className={styles.modalCopy}>
                    Cancels the Stripe subscription and sets this account to canceled.
                    All non-archived tournaments will be archived and data retained for {cancelSubPreflight.retentionDays} days.
                    This cannot be undone without resubscribing.
                  </p>
                  {cancelSubPreflight.shutsDown.length > 0 && (
                    <div className={styles.modalPreview}>
                      <strong>Will shut down:</strong>
                      <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
                        {cancelSubPreflight.shutsDown.map(item => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {cancelSubPreflight.tournaments.length > 0 && (
                    <p className={styles.warningNote}>
                      {cancelSubPreflight.tournaments.length} tournament{cancelSubPreflight.tournaments.length !== 1 ? 's' : ''} will be archived.
                    </p>
                  )}
                </>
              )}
              <div className={styles.formRow} style={{ marginTop: '1rem' }}>
                <label className={styles.formLabel}>Reason *</label>
                <textarea
                  className={styles.formTextarea}
                  value={cancelSubReason}
                  onChange={e => setCancelSubReason(e.target.value)}
                  rows={3}
                  placeholder="Why is this subscription being canceled? (recorded in audit log)"
                />
              </div>
              <div className={styles.formRow}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cancelSubNotifyOwner}
                    onChange={e => setCancelSubNotifyOwner(e.target.checked)}
                  />
                  Send cancellation confirmation email to org owner
                </label>
              </div>
            </div>
            {cancelSubError && <span className={styles.rowError}>{cancelSubError}</span>}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={handleCloseCancelModal}
                disabled={cancelSubSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={handleCancelSubscription}
                disabled={cancelSubSaving || cancelSubPreflightLoading}
              >
                {cancelSubSaving ? 'Canceling…' : 'Confirm Cancel Subscription'}
              </button>
            </div>
          </section>
        </div>
      )}

      {transferOwnerModal && (
        <div className={styles.modalBackdrop} role="presentation">
          <section
            className={styles.confirmModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="transfer-owner-title"
          >
            <div>
              <div className={styles.sectionTitle} id="transfer-owner-title">Transfer Ownership</div>
              <p className={styles.modalCopy}>
                <strong>{transferOwnerModal.displayName || transferOwnerModal.email}</strong> will
                become the owner. All current owners will be demoted to admin.
                This is audit-logged and cannot be reversed from here.
              </p>
              <div className={styles.formRow} style={{ marginTop: '1rem' }}>
                <label className={styles.formLabel}>Reason *</label>
                <textarea
                  className={styles.formTextarea}
                  value={transferOwnerReason}
                  onChange={e => setTransferOwnerReason(e.target.value)}
                  rows={2}
                  placeholder="Why is ownership being transferred? (recorded in audit log)"
                />
              </div>
            </div>
            {transferOwnerError && <span className={styles.rowError}>{transferOwnerError}</span>}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => { setTransferOwnerModal(null); setTransferOwnerReason(''); setTransferOwnerError(''); }}
                disabled={transferOwnerSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={handleTransferOwnership}
                disabled={transferOwnerSaving || !transferOwnerReason.trim()}
              >
                {transferOwnerSaving ? 'Transferring…' : 'Confirm Transfer'}
              </button>
            </div>
          </section>
        </div>
      )}

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
