'use client';

import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, CreditCard, Link2, RefreshCw } from 'lucide-react';
import HelpCallout from '@/components/help/HelpCallout';
import { useOrg } from '@/lib/org-context';
import styles from '../coaches.module.css';

type LinkSummary = {
  id: string;
  status: string;
  linkType: string;
  sharingLevel: string;
  requestedByUserId: string | null;
  approvedByTeamUserId: string | null;
  approvedByOrgUserId: string | null;
  billingModeAfterApproval: string | null;
  createdAt: string;
  updatedAt: string;
  linkedOrg: { name: string; slug: string; contactEmail: string | null } | null;
  workspaceOrg: { name: string; slug: string } | null;
  repTeam: { name: string; division: string | null } | null;
  workspace: {
    workspaceState: string | null;
    billingMode: string | null;
    subscriptionStatus: string | null;
    source: string | null;
  } | null;
};

const STATUS_LABEL: Record<string, string> = {
  requested: 'Requested',
  invited: 'Invited',
  linked: 'Linked',
  ownership_pending: 'Ownership pending',
  org_owned: 'Org owned',
  declined: 'Declined',
  revoked: 'Revoked',
};

function statusClass(status: string) {
  if (status === 'linked' || status === 'org_owned') return styles.badgeActive;
  if (status === 'declined' || status === 'revoked') return styles.badgeArchived;
  return styles.badgeUpcoming;
}

function billingModeLabel(mode: string | null | undefined) {
  if (mode === 'team_direct') return 'Coach pays direct';
  if (mode === 'org_team_addon') return 'Org-billed Premium';
  if (mode === 'platform_override') return 'Platform override';
  return mode ?? 'Billing unchanged';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export default function CoachLinkOrgPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = use(params);
  const { currentOrg, loading: orgLoading } = useOrg();
  const [links, setLinks] = useState<LinkSummary[]>([]);
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isTeamWorkspace = currentOrg?.accountKind === 'team_workspace' || currentOrg?.planId === 'team';

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/team-links`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not load organization links.');
      setLinks(Array.isArray(data.links) ? data.links : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load organization links.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!orgLoading && isTeamWorkspace) void loadLinks();
      if (!orgLoading && !isTeamWorkspace) setLoading(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [orgLoading, isTeamWorkspace, loadLinks]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target.trim()) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/coaches/${orgSlug}/team-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not send the organization link request.');
      setTarget('');
      setMessage(data.reusedExisting ? 'That organization link is already pending or active.' : 'Organization link request sent for review.');
      await loadLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the organization link request.');
    } finally {
      setSubmitting(false);
    }
  }

  async function respondToInvite(linkId: string, action: 'accept' | 'decline') {
    setWorkingId(linkId);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/coaches/${orgSlug}/team-links`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not review the organization invitation.');
      setMessage(action === 'accept' ? 'Organization invitation accepted.' : 'Organization invitation declined.');
      await loadLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not review the organization invitation.');
    } finally {
      setWorkingId(null);
    }
  }

  async function billingAction(linkId: string, action: 'request_billing' | 'accept_billing' | 'decline_billing') {
    setWorkingId(linkId);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/coaches/${orgSlug}/team-links`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not update the org billing request.');
      if (action === 'request_billing') setMessage('Org billing request sent. The organization owner can review it from Coaches Portal Links.');
      if (action === 'accept_billing') setMessage('Org billing invitation accepted. The organization owner can now complete checkout.');
      if (action === 'decline_billing') setMessage('Org billing invitation declined. The Basic link remains active.');
      await loadLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the org billing request.');
    } finally {
      setWorkingId(null);
    }
  }

  function billingText(link: LinkSummary) {
    if (link.linkType === 'ownership' && link.status === 'ownership_pending') {
      if (link.approvedByOrgUserId && !link.approvedByTeamUserId) return 'Ownership transfer invited';
      if (link.approvedByTeamUserId && !link.approvedByOrgUserId) return 'Ownership transfer requested';
      if (link.approvedByTeamUserId && link.approvedByOrgUserId) return 'Ready for platform transfer';
    }
    const pendingBilling = link.linkType === 'billing' && link.billingModeAfterApproval === 'org_team_addon';
    const activeOrgBilling = pendingBilling && link.workspace?.billingMode === 'org_team_addon';
    if (activeOrgBilling) return 'Org billing active';
    if (pendingBilling && link.approvedByOrgUserId && !link.approvedByTeamUserId) return 'Organization invited you to move billing';
    if (pendingBilling && link.approvedByTeamUserId && !link.approvedByOrgUserId) return 'Waiting for organization billing approval';
    if (pendingBilling && link.approvedByTeamUserId && link.approvedByOrgUserId) return 'Organization checkout pending';
    return billingModeLabel(link.workspace?.billingMode);
  }

  async function ownershipAction(linkId: string, action: 'request_ownership' | 'accept_ownership' | 'decline_ownership') {
    setWorkingId(linkId);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/coaches/${orgSlug}/team-links`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not update the ownership transfer.');
      if (action === 'request_ownership') setMessage('Ownership transfer requested. The organization owner can review it from Coaches Portal Links.');
      if (action === 'accept_ownership') setMessage('Ownership transfer accepted. Platform-assisted transfer can now be completed.');
      if (action === 'decline_ownership') setMessage('Ownership transfer invitation declined. The existing link remains active.');
      await loadLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the ownership transfer.');
    } finally {
      setWorkingId(null);
    }
  }

  if (orgLoading || loading) {
    return <div className={styles.loadingState}>Loading organization links...</div>;
  }

  if (!isTeamWorkspace) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div className={styles.pageHeaderLeft}>
            <div className={styles.headerIcon}><Link2 size={22} /></div>
            <div>
              <h1 className={styles.pageTitle}>Link Organization</h1>
              <p className={styles.pageSub}>Available for paid Coaches Portal teams.</p>
            </div>
          </div>
        </div>
        <HelpCallout
          variant="info"
          title="Already inside an organization"
          body="Org-owned coach portals are already connected to their organization. Organization linking is only needed for paid Coaches Portal teams."
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Building2 size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>Link Organization</h1>
            <p className={styles.pageSub}>Request a Basic visibility link or move approved Premium billing to a parent organization.</p>
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={loadLinks}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <HelpCallout
        variant="info"
        title="Basic visibility first"
        body="A Basic link records the parent organization association. You can separately request org billing, but that still does not transfer ownership, roster access, documents, accounting details, or org-wide rep-team admin access."
      />

      <HelpCallout
        variant="tip"
        title="When the club should pay"
        body="After a Basic link is active, use Request Org Billing on the linked organization card. The organization can approve annual or monthly Coaches Portal billing while your portal stays coach-operated."
      />

      <section className={styles.detailSection}>
        <h2 className={styles.detailSectionTitle}>Request parent org review</h2>
        <form className={styles.linkForm} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>Organization slug or contact email</span>
            <input
              className={styles.input}
              value={target}
              onChange={event => setTarget(event.target.value)}
              placeholder="example-org or admin@example.com"
              disabled={submitting}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={submitting || !target.trim()}>
            {submitting ? 'Sending...' : 'Send Request'}
          </button>
        </form>
        {error && <p className={styles.errorText}>{error}</p>}
        {message && <p className={styles.successText}>{message}</p>}
      </section>

      <section className={styles.detailSection}>
        <h2 className={styles.detailSectionTitle}>Requests and invitations</h2>
        {links.length === 0 ? (
          <p className={styles.detailPlaceholder}>No organization link requests or invitations yet.</p>
        ) : (
          <div className={styles.linkList}>
            {links.map(link => {
              const pendingBilling = link.linkType === 'billing' && link.billingModeAfterApproval === 'org_team_addon';
              const activeOrgBilling = pendingBilling && link.workspace?.billingMode === 'org_team_addon';
              const pendingOwnership = link.linkType === 'ownership' && link.status === 'ownership_pending';
              const canRequestBilling = link.status === 'linked' && !pendingBilling && !activeOrgBilling && (link.workspace?.billingMode === 'team_direct' || link.workspace?.billingMode === 'platform_override');
              const canRespondToBillingInvite = link.status === 'linked' && pendingBilling && link.approvedByOrgUserId && !link.approvedByTeamUserId;
              const canRequestOwnership = link.status === 'linked' && !pendingOwnership && (!pendingBilling || activeOrgBilling);
              const canRespondToOwnershipInvite = pendingOwnership && link.approvedByOrgUserId && !link.approvedByTeamUserId;

              return (
                <article key={link.id} className={styles.linkCard}>
                  <div className={styles.linkCardHeader}>
                    <div>
                      <h3 className={styles.linkCardTitle}>{link.linkedOrg?.name ?? 'Organization'}</h3>
                      <p className={styles.linkCardMeta}>
                        {link.status === 'invited'
                          ? 'This organization invited your Coaches Portal to connect.'
                          : link.linkedOrg?.slug ? `/${link.linkedOrg.slug}` : 'Organization slug unavailable'}
                      </p>
                    </div>
                    <span className={`${styles.badge} ${statusClass(link.status)}`}>
                      {STATUS_LABEL[link.status] ?? link.status}
                    </span>
                  </div>
                  <div className={styles.linkFacts}>
                    <span>Sharing: Basic visibility</span>
                    <span>Team: {link.repTeam?.name ?? 'Coaches Portal'}</span>
                    <span>Billing: {billingText(link)}</span>
                    <span>Updated {formatDate(link.updatedAt)}</span>
                  </div>
                  {link.status === 'invited' && (
                    <div className="flex gap-2 mt-4 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => respondToInvite(link.id, 'accept')}
                        disabled={workingId === link.id}
                      >
                        Accept Invitation
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => respondToInvite(link.id, 'decline')}
                        disabled={workingId === link.id}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {canRequestBilling && (
                    <div className="flex gap-2 mt-4 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => billingAction(link.id, 'request_billing')}
                        disabled={workingId === link.id}
                      >
                        <CreditCard size={14} /> Request Org Billing
                      </button>
                    </div>
                  )}
                  {canRespondToBillingInvite && (
                    <div className="flex gap-2 mt-4 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => billingAction(link.id, 'accept_billing')}
                        disabled={workingId === link.id}
                      >
                        Accept Billing Invite
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => billingAction(link.id, 'decline_billing')}
                        disabled={workingId === link.id}
                      >
                        Decline Billing
                      </button>
                    </div>
                  )}
                  {canRequestOwnership && (
                    <div className="flex gap-2 mt-4 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => ownershipAction(link.id, 'request_ownership')}
                        disabled={workingId === link.id}
                      >
                        Request Ownership Transfer
                      </button>
                    </div>
                  )}
                  {canRespondToOwnershipInvite && (
                    <div className="flex gap-2 mt-4 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => ownershipAction(link.id, 'accept_ownership')}
                        disabled={workingId === link.id}
                      >
                        Accept Ownership Transfer
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => ownershipAction(link.id, 'decline_ownership')}
                        disabled={workingId === link.id}
                      >
                        Decline Ownership
                      </button>
                    </div>
                  )}
                  {pendingOwnership && link.approvedByTeamUserId && link.approvedByOrgUserId && (
                    <p className={styles.detailPlaceholder}>Both sides approved ownership transfer. A platform admin can complete the final data move.</p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <p className={styles.pageSub}>
        More detail about Basic visibility links is available in <Link href={`/${orgSlug}/coaches/help#recipe-link-parent-org`} target="_blank" rel="noopener noreferrer">Help</Link>.
      </p>
    </div>
  );
}
