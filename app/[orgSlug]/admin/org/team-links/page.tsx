'use client';

import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import { Clock, CreditCard, Link2, RefreshCw, Send, ShieldCheck, UsersRound } from 'lucide-react';
import HelpCallout from '@/components/help/HelpCallout';
import { useOrg } from '@/lib/org-context';

type LinkSummary = {
  id: string;
  teamWorkspaceId: string;
  status: string;
  linkType: string;
  sharingLevel: string;
  requestedByUserId: string | null;
  approvedByTeamUserId: string | null;
  approvedByOrgUserId: string | null;
  billingModeAfterApproval: string | null;
  createdAt: string;
  updatedAt: string;
  workspaceOrg: { name: string; slug: string } | null;
  linkedOrg: { name: string; slug: string } | null;
  repTeam: { name: string; ageGroup: string | null } | null;
  workspace: {
    workspaceState: string | null;
    billingMode: string | null;
    subscriptionStatus: string | null;
    source: string | null;
  } | null;
};

type BillingSummary = {
  activeOrgPaidTeamCount: number;
  clubValueThreshold: number;
  showClubValueNudge: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  requested: 'Needs review',
  invited: 'Invited',
  linked: 'Linked',
  ownership_pending: 'Ownership pending',
  org_owned: 'Org owned',
  declined: 'Declined',
  revoked: 'Revoked',
};

const REVIEWABLE_STATUSES = new Set(['requested']);
const CLUB_VALUE_TEAM_COUNT = 3;

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function badgeClass(status: string) {
  if (status === 'linked' || status === 'org_owned') return 'border-green-500/35 text-green-300 bg-green-500/10';
  if (status === 'declined' || status === 'revoked') return 'border-white/10 text-white/35 bg-white/5';
  return 'border-yellow-400/35 text-yellow-300 bg-yellow-400/10';
}

function billingModeLabel(mode: string | null | undefined) {
  if (mode === 'team_direct') return 'Coach pays direct';
  if (mode === 'org_team_addon') return 'Org-billed Premium';
  if (mode === 'platform_override') return 'Platform override';
  return mode ?? 'Unknown';
}

export default function OrgTeamLinksPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = use(params);
  const { userRole, loading: orgLoading } = useOrg();
  const [links, setLinks] = useState<LinkSummary[]>([]);
  const [inviteTarget, setInviteTarget] = useState('');
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canReview = userRole === 'owner' || userRole === 'admin';

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/org/team-links?orgSlug=${encodeURIComponent(orgSlug)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not load Coaches Portal link requests.');
      setLinks(Array.isArray(data.links) ? data.links : []);
      setBillingSummary(
        data.billingSummary && typeof data.billingSummary.activeOrgPaidTeamCount === 'number'
          ? data.billingSummary
          : null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Coaches Portal link requests.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!orgLoading && canReview) void loadLinks();
      if (!orgLoading && !canReview) setLoading(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [orgLoading, canReview, loadLinks]);

  async function review(linkId: string, action: 'approve' | 'decline') {
    setWorkingId(linkId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/org/team-links?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not review Coaches Portal link request.');
      setMessage(action === 'approve' ? 'Coaches Portal link approved.' : 'Coaches Portal link declined.');
      await loadLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not review Coaches Portal link request.');
    } finally {
      setWorkingId(null);
    }
  }

  async function sendInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteTarget.trim()) return;

    setInviting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/org/team-links?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: inviteTarget }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not send the Coaches Portal link invitation.');
      setInviteTarget('');
      setMessage(data.reusedExisting ? 'That Coaches Portal link is already pending or active.' : 'Coaches Portal link invitation sent.');
      await loadLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the Coaches Portal link invitation.');
    } finally {
      setInviting(false);
    }
  }

  async function billingAction(linkId: string, action: 'invite_billing' | 'decline_billing' | 'approve_billing', billingCycle?: 'annual' | 'monthly') {
    setWorkingId(linkId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/org/team-links?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId, action, billingCycle }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not update Coaches Portal billing.');
      if (typeof data.url === 'string' && data.url) {
        window.location.assign(data.url);
        return;
      }
      if (action === 'invite_billing') setMessage('Org billing invitation sent to the coach.');
      if (action === 'decline_billing') setMessage('Org billing request declined. The Basic link remains active.');
      if (action === 'approve_billing') setMessage(data.applied ? 'Org billing is now active for this Coaches Portal.' : 'Org billing checkout started.');
      await loadLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update Coaches Portal billing.');
    } finally {
      setWorkingId(null);
    }
  }

  async function ownershipAction(linkId: string, action: 'invite_ownership' | 'decline_ownership') {
    setWorkingId(linkId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/org/team-links?orgSlug=${encodeURIComponent(orgSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not update Coaches Portal ownership transfer.');
      if (action === 'invite_ownership') setMessage('Ownership transfer updated. When both sides approve, platform-assisted transfer can be completed.');
      if (action === 'decline_ownership') setMessage('Ownership transfer request declined. The existing link remains active.');
      await loadLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update Coaches Portal ownership transfer.');
    } finally {
      setWorkingId(null);
    }
  }

  function billingStatusText(link: LinkSummary) {
    const pendingBilling = link.linkType === 'billing' && link.billingModeAfterApproval === 'org_team_addon';
    const orgBillingActive = pendingBilling && link.workspace?.billingMode === 'org_team_addon';
    if (orgBillingActive) return 'Org-billed Premium active';
    if (pendingBilling && link.approvedByTeamUserId && !link.approvedByOrgUserId) return 'Coach requested org billing';
    if (pendingBilling && link.approvedByOrgUserId && !link.approvedByTeamUserId) return 'Waiting for coach approval';
    if (pendingBilling && link.approvedByOrgUserId && link.approvedByTeamUserId) return 'Ready for checkout';
    return billingModeLabel(link.workspace?.billingMode);
  }

  const pendingLinks = links.filter(link => REVIEWABLE_STATUSES.has(link.status));
  const invitedLinks = links.filter(link => link.status === 'invited');
  const linkedLinks = links.filter(link => link.status === 'linked');
  const ownershipLinks = links.filter(link => link.linkType === 'ownership' && (link.status === 'ownership_pending' || link.status === 'org_owned'));
  const historyLinks = links.filter(link => !REVIEWABLE_STATUSES.has(link.status) && link.status !== 'invited' && link.status !== 'ownership_pending');
  const fallbackActiveOrgPaidTeamCount = new Set(
    links
      .filter(link => (
        link.status === 'linked' &&
        link.linkType === 'billing' &&
        link.billingModeAfterApproval === 'org_team_addon' &&
        link.workspace?.billingMode === 'org_team_addon' &&
        link.workspace.subscriptionStatus !== 'canceled'
      ))
      .map(link => link.teamWorkspaceId),
  ).size;
  const activeOrgPaidTeamCount = billingSummary?.activeOrgPaidTeamCount ?? fallbackActiveOrgPaidTeamCount;
  const showClubValueNudge = billingSummary?.showClubValueNudge ?? activeOrgPaidTeamCount >= CLUB_VALUE_TEAM_COUNT;

  if (orgLoading || loading) {
    return <div className="p-8 text-data-gray">Loading Coaches Portal links...</div>;
  }

  if (!canReview) {
    return (
      <div className="p-8 max-w-4xl">
        <HelpCallout
          variant="warning"
          title="Owner or admin required"
          body="Coaches Portal link requests can be reviewed by organization owners and admins."
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <header className="border-b border-blueprint-blue/60 pb-4 mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="hud-label mb-1">Organization Admin</div>
          <h1 className="font-extrabold text-2xl uppercase tracking-tighter">
            Coaches Portal Links
          </h1>
          <p className="text-data-gray text-sm mt-2 max-w-2xl">
            Invite paid Coaches Portals to connect, review coach requests, and manage org-billed Premium access.
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={loadLinks}>
          <RefreshCw size={14} /> Refresh
        </button>
      </header>

      <HelpCallout
        variant="info"
        title="Approval creates a basic link"
        body="Inviting or approving a Coaches Portal records the Basic association only after both sides agree. Org billing transfer is separate and still does not transfer ownership or unlock player, document, accounting, or org-wide rep-team access."
        cta={{ label: 'Read the guide', href: `/${orgSlug}/admin/help/org#recipe-review-team-link-request` }}
      />

      {showClubValueNudge && (
        <div className="card p-5 mb-6 border-blueprint-blue/40 bg-blueprint-blue/10">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 border border-logic-lime/30 bg-logic-lime/10 text-logic-lime flex items-center justify-center shrink-0">
              <UsersRound size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold uppercase tracking-wide text-fl-text text-sm">Club may be a better value now</h2>
              <p className="text-data-gray text-sm mt-2 leading-relaxed">
                This organization is paying for {activeOrgPaidTeamCount} linked Premium portals. Org-billed portals can stay active, but Club is the cleaner multi-team operating layer for oversight, accounting, rep-team administration, and lower extra-team pricing.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && <div className="card p-4 mb-4 text-red-300 border-red-500/40">{error}</div>}
      {message && <div className="card p-4 mb-4 text-green-300 border-green-500/40">{message}</div>}

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Send size={18} className="text-blueprint-blue" />
          <h2 className="font-bold uppercase tracking-wide">Invite a Coaches Portal</h2>
        </div>
        <div className="card p-5">
          <form className="flex items-end gap-3 flex-wrap" onSubmit={sendInvite}>
            <label className="grid gap-2 flex-1 min-w-64">
              <span className="hud-label">Coaches Portal slug or primary coach email</span>
              <input
                className="form-input"
                value={inviteTarget}
                onChange={event => setInviteTarget(event.target.value)}
                placeholder="coach-portal-slug or coach@example.com"
                disabled={inviting}
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={inviting || !inviteTarget.trim()}>
              {inviting ? 'Sending...' : 'Send Invite'}
            </button>
          </form>
          <p className="text-data-gray text-sm mt-3">
            The coach reviews the invitation from their Coaches Portal. Accepting creates Basic visibility only.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={18} className="text-logic-lime" />
          <h2 className="font-bold uppercase tracking-wide">Needs review</h2>
          <span className="hud-label">{pendingLinks.length}</span>
        </div>
        {pendingLinks.length === 0 ? (
          <div className="card p-6 text-data-gray">No Coaches Portal link requests need review.</div>
        ) : (
          <div className="grid gap-3">
            {pendingLinks.map(link => (
              <article key={link.id} className="card p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-bold text-fl-text text-lg">
                      {link.repTeam?.name ?? link.workspaceOrg?.name ?? 'Coaches Portal'}
                    </div>
                    <div className="text-data-gray text-sm mt-1">
                      {link.workspaceOrg?.name ?? 'Coaches Portal'} wants a Basic visibility link.
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs uppercase font-bold border ${badgeClass(link.status)}`}>
                    {STATUS_LABEL[link.status] ?? link.status}
                  </span>
                </div>
                <div className="grid sm:grid-cols-4 gap-3 mt-4 text-sm">
                  <div>
                    <div className="hud-label">Sharing</div>
                    <div className="text-fl-text">Basic visibility</div>
                  </div>
                  <div>
                    <div className="hud-label">Portal</div>
                    <div className="text-fl-text">/{link.workspaceOrg?.slug ?? 'portal'}</div>
                  </div>
                  <div>
                    <div className="hud-label">Billing</div>
                    <div className="text-fl-text">{billingModeLabel(link.workspace?.billingMode)}</div>
                  </div>
                  <div>
                    <div className="hud-label">Requested</div>
                    <div className="text-fl-text">{formatDate(link.createdAt)}</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-5 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => review(link.id, 'approve')}
                    disabled={workingId === link.id}
                  >
                    Approve Link
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => review(link.id, 'decline')}
                    disabled={workingId === link.id}
                  >
                    Decline
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={18} className="text-yellow-300" />
          <h2 className="font-bold uppercase tracking-wide">Awaiting coach response</h2>
          <span className="hud-label">{invitedLinks.length}</span>
        </div>
        {invitedLinks.length === 0 ? (
          <div className="card p-6 text-data-gray">No Coaches Portal invitations are waiting on a coach.</div>
        ) : (
          <div className="grid gap-3">
            {invitedLinks.map(link => (
              <article key={link.id} className="card p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-bold text-fl-text">
                      {link.repTeam?.name ?? link.workspaceOrg?.name ?? 'Coaches Portal'}
                    </div>
                    <div className="text-data-gray text-sm">
                      Waiting for the coach to accept or decline the Basic visibility invitation.
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs uppercase font-bold border ${badgeClass(link.status)}`}>
                    {STATUS_LABEL[link.status] ?? link.status}
                  </span>
                </div>
                <div className="grid sm:grid-cols-4 gap-3 mt-4 text-sm">
                  <div>
                    <div className="hud-label">Sharing</div>
                    <div className="text-fl-text">Basic visibility</div>
                  </div>
                  <div>
                    <div className="hud-label">Portal</div>
                    <div className="text-fl-text">/{link.workspaceOrg?.slug ?? 'portal'}</div>
                  </div>
                  <div>
                    <div className="hud-label">Billing</div>
                    <div className="text-fl-text">{billingModeLabel(link.workspace?.billingMode)}</div>
                  </div>
                  <div>
                    <div className="hud-label">Invited</div>
                    <div className="text-fl-text">{formatDate(link.createdAt)}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard size={18} className="text-logic-lime" />
          <h2 className="font-bold uppercase tracking-wide">Org billing</h2>
          <span className="hud-label">{linkedLinks.length}</span>
        </div>
        {linkedLinks.length === 0 ? (
          <div className="card p-6 text-data-gray">No linked Coaches Portals are ready for billing transfer.</div>
        ) : (
          <div className="grid gap-3">
            {linkedLinks.map(link => {
              const pendingBilling = link.linkType === 'billing' && link.billingModeAfterApproval === 'org_team_addon';
              const orgBillingActive = pendingBilling && link.workspace?.billingMode === 'org_team_addon';
              const canInviteBilling = !pendingBilling && !orgBillingActive && (link.workspace?.billingMode === 'team_direct' || link.workspace?.billingMode === 'platform_override');
              const coachRequestedBilling = pendingBilling && link.approvedByTeamUserId && !link.approvedByOrgUserId;
              const readyForCheckout = pendingBilling && link.approvedByTeamUserId && link.approvedByOrgUserId && !orgBillingActive;

              return (
                <article key={link.id} className="card p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="font-bold text-fl-text">
                        {link.repTeam?.name ?? link.workspaceOrg?.name ?? 'Coaches Portal'}
                      </div>
                      <div className="text-data-gray text-sm mt-1">
                        {billingStatusText(link)}
                      </div>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs uppercase font-bold border ${orgBillingActive ? 'border-green-500/35 text-green-300 bg-green-500/10' : 'border-yellow-400/35 text-yellow-300 bg-yellow-400/10'}`}>
                      {orgBillingActive ? 'Active' : pendingBilling ? 'Pending' : 'Basic link'}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-4 gap-3 mt-4 text-sm">
                    <div>
                      <div className="hud-label">Portal</div>
                      <div className="text-fl-text">/{link.workspaceOrg?.slug ?? 'portal'}</div>
                    </div>
                    <div>
                      <div className="hud-label">Current billing</div>
                      <div className="text-fl-text">{billingModeLabel(link.workspace?.billingMode)}</div>
                    </div>
                    <div>
                      <div className="hud-label">Coach approval</div>
                      <div className="text-fl-text">{link.approvedByTeamUserId ? 'Approved' : 'Waiting'}</div>
                    </div>
                    <div>
                      <div className="hud-label">Org approval</div>
                      <div className="text-fl-text">{link.approvedByOrgUserId ? 'Approved' : 'Waiting'}</div>
                    </div>
                  </div>
                  <p className="text-data-gray text-sm mt-4">
                    Org billing keeps Basic sharing only. It does not transfer ownership, roster, documents, accounting, or org-wide rep-team admin access.
                  </p>
                  <div className="flex gap-2 mt-5 flex-wrap">
                    {canInviteBilling && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => billingAction(link.id, 'invite_billing')}
                        disabled={workingId === link.id}
                      >
                        Invite Billing Transfer
                      </button>
                    )}
                    {(coachRequestedBilling || readyForCheckout) && (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => billingAction(link.id, 'approve_billing', 'annual')}
                          disabled={workingId === link.id}
                        >
                          {readyForCheckout ? 'Complete Annual Checkout' : 'Approve Annual'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => billingAction(link.id, 'approve_billing', 'monthly')}
                          disabled={workingId === link.id}
                        >
                          {readyForCheckout ? 'Complete Monthly Checkout' : 'Approve Monthly'}
                        </button>
                      </>
                    )}
                    {coachRequestedBilling && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => billingAction(link.id, 'decline_billing')}
                        disabled={workingId === link.id}
                      >
                        Decline Billing
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={18} className="text-logic-lime" />
          <h2 className="font-bold uppercase tracking-wide">Ownership transfer</h2>
          <span className="hud-label">{linkedLinks.length + ownershipLinks.length}</span>
        </div>
        {linkedLinks.length === 0 && ownershipLinks.length === 0 ? (
          <div className="card p-6 text-data-gray">No linked Coaches Portals are ready for ownership transfer.</div>
        ) : (
          <div className="grid gap-3">
            {[...ownershipLinks, ...linkedLinks.filter(link => link.linkType !== 'ownership')].map(link => {
              const pendingOwnership = link.linkType === 'ownership' && link.status === 'ownership_pending';
              const coachRequestedOwnership = pendingOwnership && link.approvedByTeamUserId && !link.approvedByOrgUserId;
              const waitingForCoach = pendingOwnership && link.approvedByOrgUserId && !link.approvedByTeamUserId;
              const readyForPlatformTransfer = pendingOwnership && link.approvedByTeamUserId && link.approvedByOrgUserId;
              const pendingBilling = link.linkType === 'billing' && link.billingModeAfterApproval === 'org_team_addon';
              const orgBillingActive = pendingBilling && link.workspace?.billingMode === 'org_team_addon';
              const canInviteOwnership = link.status === 'linked' && !pendingOwnership && (!pendingBilling || orgBillingActive);

              return (
                <article key={`ownership-${link.id}`} className="card p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="font-bold text-fl-text">
                        {link.repTeam?.name ?? link.workspaceOrg?.name ?? 'Coaches Portal'}
                      </div>
                      <div className="text-data-gray text-sm mt-1">
                        {readyForPlatformTransfer
                          ? 'Both sides approved. Platform-assisted data transfer can be completed next.'
                          : waitingForCoach
                            ? 'Waiting for the coach to accept ownership transfer.'
                            : coachRequestedOwnership
                              ? 'Coach requested full ownership transfer.'
                              : 'Basic link is active. Ownership transfer is a separate, irreversible data move.'}
                      </div>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs uppercase font-bold border ${readyForPlatformTransfer ? 'border-green-500/35 text-green-300 bg-green-500/10' : 'border-yellow-400/35 text-yellow-300 bg-yellow-400/10'}`}>
                      {readyForPlatformTransfer ? 'Ready' : pendingOwnership ? 'Pending' : 'Available'}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-4 gap-3 mt-4 text-sm">
                    <div>
                      <div className="hud-label">Portal</div>
                      <div className="text-fl-text">/{link.workspaceOrg?.slug ?? 'portal'}</div>
                    </div>
                    <div>
                      <div className="hud-label">Current billing</div>
                      <div className="text-fl-text">{billingModeLabel(link.workspace?.billingMode)}</div>
                    </div>
                    <div>
                      <div className="hud-label">Coach approval</div>
                      <div className="text-fl-text">{link.approvedByTeamUserId ? 'Approved' : 'Waiting'}</div>
                    </div>
                    <div>
                      <div className="hud-label">Org approval</div>
                      <div className="text-fl-text">{link.approvedByOrgUserId ? 'Approved' : 'Waiting'}</div>
                    </div>
                  </div>
                  <p className="text-data-gray text-sm mt-4">
                    Ownership transfer will move the team into this organization for roster, schedule, documents, and accounting access. Phase 5A records mutual approval; final data reassignment is platform-assisted.
                  </p>
                  <div className="flex gap-2 mt-5 flex-wrap">
                    {canInviteOwnership && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => ownershipAction(link.id, 'invite_ownership')}
                        disabled={workingId === link.id}
                      >
                        Invite Ownership Transfer
                      </button>
                    )}
                    {coachRequestedOwnership && (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => ownershipAction(link.id, 'invite_ownership')}
                          disabled={workingId === link.id}
                        >
                          Approve Ownership
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => ownershipAction(link.id, 'decline_ownership')}
                          disabled={workingId === link.id}
                        >
                          Decline Ownership
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Link2 size={18} className="text-blueprint-blue" />
          <h2 className="font-bold uppercase tracking-wide">Link history</h2>
          <span className="hud-label">{historyLinks.length}</span>
        </div>
        {historyLinks.length === 0 ? (
          <div className="card p-6 text-data-gray">No reviewed Coaches Portal links yet.</div>
        ) : (
          <div className="grid gap-3">
            {historyLinks.map(link => (
              <article key={link.id} className="card p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-bold text-fl-text">
                      {link.repTeam?.name ?? link.workspaceOrg?.name ?? 'Coaches Portal'}
                    </div>
                    <div className="text-data-gray text-sm">
                      {link.workspaceOrg?.slug ? `/${link.workspaceOrg.slug}` : 'Portal slug unavailable'}
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs uppercase font-bold border ${badgeClass(link.status)}`}>
                    {STATUS_LABEL[link.status] ?? link.status}
                  </span>
                </div>
                <div className="text-data-gray text-sm mt-3">
                  Basic visibility - updated {formatDate(link.updatedAt)}.
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
