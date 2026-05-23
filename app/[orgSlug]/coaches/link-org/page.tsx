'use client';

import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Link2, RefreshCw } from 'lucide-react';
import HelpCallout from '@/components/help/HelpCallout';
import { useOrg } from '@/lib/org-context';
import styles from '../coaches.module.css';

type LinkSummary = {
  id: string;
  status: string;
  linkType: string;
  sharingLevel: string;
  createdAt: string;
  updatedAt: string;
  linkedOrg: { name: string; slug: string; contactEmail: string | null } | null;
  workspaceOrg: { name: string; slug: string } | null;
  repTeam: { name: string; ageGroup: string | null } | null;
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
      setMessage(action === 'accept' ? 'Team invitation accepted.' : 'Team invitation declined.');
      await loadLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not review the organization invitation.');
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
              <p className={styles.pageSub}>Available for standalone Team workspaces.</p>
            </div>
          </div>
        </div>
        <HelpCallout
          variant="info"
          title="Already inside an organization"
          body="Org-owned coach portals are already connected to their organization. Team-to-org linking is only needed for standalone Team workspaces."
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
            <p className={styles.pageSub}>Request a basic visibility link to a parent organization.</p>
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={loadLinks}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <HelpCallout
        variant="info"
        title="Basic visibility only"
        body="A linked organization can see that this Team workspace is associated with them. This does not transfer billing, ownership, roster access, documents, accounting details, or org-wide rep-team admin access."
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
            {links.map(link => (
              <article key={link.id} className={styles.linkCard}>
                <div className={styles.linkCardHeader}>
                  <div>
                    <h3 className={styles.linkCardTitle}>{link.linkedOrg?.name ?? 'Organization'}</h3>
                    <p className={styles.linkCardMeta}>
                      {link.status === 'invited'
                        ? 'This organization invited your Team workspace to connect.'
                        : link.linkedOrg?.slug ? `/${link.linkedOrg.slug}` : 'Organization slug unavailable'}
                    </p>
                  </div>
                  <span className={`${styles.badge} ${statusClass(link.status)}`}>
                    {STATUS_LABEL[link.status] ?? link.status}
                  </span>
                </div>
                <div className={styles.linkFacts}>
                  <span>Sharing: Basic visibility</span>
                  <span>Team: {link.repTeam?.name ?? 'Team workspace'}</span>
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
              </article>
            ))}
          </div>
        )}
      </section>

      <p className={styles.pageSub}>
        More detail about Basic visibility links is available in <Link href={`/${orgSlug}/coaches/help#recipe-link-parent-org`} target="_blank" rel="noopener noreferrer">Help</Link>.
      </p>
    </div>
  );
}
