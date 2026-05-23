'use client';

import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import { Clock, Link2, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import HelpCallout from '@/components/help/HelpCallout';
import { useOrg } from '@/lib/org-context';

type LinkSummary = {
  id: string;
  status: string;
  linkType: string;
  sharingLevel: string;
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function badgeClass(status: string) {
  if (status === 'linked' || status === 'org_owned') return 'border-green-500/35 text-green-300 bg-green-500/10';
  if (status === 'declined' || status === 'revoked') return 'border-white/10 text-white/35 bg-white/5';
  return 'border-yellow-400/35 text-yellow-300 bg-yellow-400/10';
}

export default function OrgTeamLinksPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = use(params);
  const { userRole, loading: orgLoading } = useOrg();
  const [links, setLinks] = useState<LinkSummary[]>([]);
  const [inviteTarget, setInviteTarget] = useState('');
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canReview = userRole === 'owner' || userRole === 'admin';

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/org/team-links?orgSlug=${encodeURIComponent(orgSlug)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not load Team link requests.');
      setLinks(Array.isArray(data.links) ? data.links : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Team link requests.');
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
      if (!res.ok) throw new Error(data.error ?? 'Could not review Team link request.');
      setMessage(action === 'approve' ? 'Team link approved.' : 'Team link declined.');
      await loadLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not review Team link request.');
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
      if (!res.ok) throw new Error(data.error ?? 'Could not send the Team link invitation.');
      setInviteTarget('');
      setMessage(data.reusedExisting ? 'That Team link is already pending or active.' : 'Team link invitation sent.');
      await loadLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the Team link invitation.');
    } finally {
      setInviting(false);
    }
  }

  const pendingLinks = links.filter(link => REVIEWABLE_STATUSES.has(link.status));
  const invitedLinks = links.filter(link => link.status === 'invited');
  const historyLinks = links.filter(link => !REVIEWABLE_STATUSES.has(link.status) && link.status !== 'invited');

  if (orgLoading || loading) {
    return <div className="p-8 text-data-gray">Loading Team links...</div>;
  }

  if (!canReview) {
    return (
      <div className="p-8 max-w-4xl">
        <HelpCallout
          variant="warning"
          title="Owner or admin required"
          body="Team link requests can be reviewed by organization owners and admins."
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <header className="border-b border-blueprint-blue/60 pb-4 mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="hud-label mb-1">Organization Admin</div>
          <h1 className="font-sans font-extrabold text-2xl uppercase tracking-tighter text-fl-text">
            Team Links
          </h1>
          <p className="text-data-gray text-sm mt-2 max-w-2xl">
            Invite standalone Team workspaces to connect, or review requests from Team coaches.
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={loadLinks}>
          <RefreshCw size={14} /> Refresh
        </button>
      </header>

      <HelpCallout
        variant="info"
        title="Approval creates a basic link"
        body="Inviting or approving a Team workspace records the association only after both sides agree. It does not add billing, transfer ownership, or unlock player, document, accounting, or org-wide rep-team access."
        cta={{ label: 'Read the guide', href: `/${orgSlug}/admin/help/org#recipe-review-team-link-request` }}
      />

      {error && <div className="card p-4 mb-4 text-red-300 border-red-500/40">{error}</div>}
      {message && <div className="card p-4 mb-4 text-green-300 border-green-500/40">{message}</div>}

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Send size={18} className="text-blueprint-blue" />
          <h2 className="font-sans font-bold text-fl-text uppercase tracking-wide">Invite a Team workspace</h2>
        </div>
        <div className="card p-5">
          <form className="flex items-end gap-3 flex-wrap" onSubmit={sendInvite}>
            <label className="grid gap-2 flex-1 min-w-64">
              <span className="hud-label">Team workspace slug or primary coach email</span>
              <input
                className="form-input"
                value={inviteTarget}
                onChange={event => setInviteTarget(event.target.value)}
                placeholder="team-workspace-slug or coach@example.com"
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
          <h2 className="font-sans font-bold text-fl-text uppercase tracking-wide">Needs review</h2>
          <span className="hud-label">{pendingLinks.length}</span>
        </div>
        {pendingLinks.length === 0 ? (
          <div className="card p-6 text-data-gray">No Team link requests need review.</div>
        ) : (
          <div className="grid gap-3">
            {pendingLinks.map(link => (
              <article key={link.id} className="card p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-sans font-bold text-fl-text text-lg">
                      {link.repTeam?.name ?? link.workspaceOrg?.name ?? 'Team workspace'}
                    </div>
                    <div className="text-data-gray text-sm mt-1">
                      {link.workspaceOrg?.name ?? 'Workspace'} wants a Basic visibility link.
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
                    <div className="hud-label">Workspace</div>
                    <div className="text-fl-text">/{link.workspaceOrg?.slug ?? 'team'}</div>
                  </div>
                  <div>
                    <div className="hud-label">Billing</div>
                    <div className="text-fl-text">{link.workspace?.billingMode === 'team_direct' ? 'Team direct' : link.workspace?.billingMode ?? 'Unchanged'}</div>
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
          <h2 className="font-sans font-bold text-fl-text uppercase tracking-wide">Awaiting team response</h2>
          <span className="hud-label">{invitedLinks.length}</span>
        </div>
        {invitedLinks.length === 0 ? (
          <div className="card p-6 text-data-gray">No Team invitations are waiting on a coach.</div>
        ) : (
          <div className="grid gap-3">
            {invitedLinks.map(link => (
              <article key={link.id} className="card p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-sans font-bold text-fl-text">
                      {link.repTeam?.name ?? link.workspaceOrg?.name ?? 'Team workspace'}
                    </div>
                    <div className="text-data-gray text-sm">
                      Waiting for the Team coach to accept or decline the Basic visibility invitation.
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
                    <div className="hud-label">Workspace</div>
                    <div className="text-fl-text">/{link.workspaceOrg?.slug ?? 'team'}</div>
                  </div>
                  <div>
                    <div className="hud-label">Billing</div>
                    <div className="text-fl-text">{link.workspace?.billingMode === 'team_direct' ? 'Team direct' : link.workspace?.billingMode ?? 'Unchanged'}</div>
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

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Link2 size={18} className="text-blueprint-blue" />
          <h2 className="font-sans font-bold text-fl-text uppercase tracking-wide">Link history</h2>
          <span className="hud-label">{historyLinks.length}</span>
        </div>
        {historyLinks.length === 0 ? (
          <div className="card p-6 text-data-gray">No reviewed Team links yet.</div>
        ) : (
          <div className="grid gap-3">
            {historyLinks.map(link => (
              <article key={link.id} className="card p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-sans font-bold text-fl-text">
                      {link.repTeam?.name ?? link.workspaceOrg?.name ?? 'Team workspace'}
                    </div>
                    <div className="text-data-gray text-sm">
                      {link.workspaceOrg?.slug ? `/${link.workspaceOrg.slug}` : 'Workspace slug unavailable'}
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
