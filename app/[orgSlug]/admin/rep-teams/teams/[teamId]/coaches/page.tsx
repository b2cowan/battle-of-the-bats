'use client';
/**
 * Rep Teams › a team › Coaches — ONE DOOR TO NAME A COACH (Club Tier Stage 2, specimen 5; D10, Ask 4,
 * Ask 6). It replaced the season-level Coaches page, which could only assign someone already an
 * active club member, sent nothing, and refused everyone between seasons (B01, B09). Coaches belong to
 * the TEAM since the August membership change, so this list is the same in every season and a coach
 * can be named before the next season starts.
 *
 *   header   — back to the team; "Invite a coach" (the page's one lime).
 *   callout  — "{team} has no head coach", a white card with the live-red edge, only while true.
 *   list     — the portal's staff list, reused: a pending invitation keeps Resend and Cancel (Cancel
 *              asks); a person's row opens their window (role, what they can open, Remove — which
 *              asks). One chevron, no Remove on the row (delete is never a row action).
 *   footnote — staff the head coach adds from the portal's Staff page (Ask 6: today's split).
 *   phone    — white cards; an invitation's two actions are full-width 44px buttons; the invite
 *              window fills the screen and covers the bar (the drawer-layers ruling).
 * `?person=<membershipId>` opens that person's window on arrival — the team page's Coaches rows link so.
 */
import { use, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, UserPlus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import PageNotice, { useNotice } from '@/components/admin/kit/club/PageNotice';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import {
  Callout, ClubRow, ClubRowList, EmptyCard, LoadFailed, PageLoading, RepChip, repKit, useDeferredLoad,
  useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import type { ClubStaffRow } from '@/components/admin/kit/club/CoachDialogs';
import { usePublishRailTeam } from '@/components/admin/kit/useRailTeam';
import { formatStoredDate } from '@/lib/timezone';

const InviteCoachDialog = dynamic(() => import('@/components/admin/kit/club/CoachDialogs').then(m => m.InviteCoachDialog));
const CoachPersonDialog = dynamic(() => import('@/components/admin/kit/club/CoachDialogs').then(m => m.CoachPersonDialog));
const CancelInviteQuestion = dynamic(() => import('@/components/admin/kit/club/CoachDialogs').then(m => m.CancelInviteQuestion));

interface Invitation {
  id: string; email: string; coachRole: string; kindWord: string; status: 'pending' | 'pending_approval' | string;
  sentBy: 'portal' | 'club' | string; invitedByName: string | null; invitedAt: string; expiresAt: string; expired: boolean;
}
interface CoachesRead {
  team: { id: string; name: string; groupName: string | null };
  staff: ClubStaffRow[];
  invitations: Invitation[];
  hasHeadCoach: boolean;
  canWrite: boolean;
}

/** "the link works 7 more days" · "the link has run out" — the invitation row's clock. */
function linkClock(inv: Invitation): string {
  if (inv.status === 'pending_approval') return 'waiting for the club’s approval on Assistant coaches';
  if (inv.expired) return 'the link has run out — resend it';
  const days = Math.max(0, Math.ceil((new Date(inv.expiresAt).getTime() - Date.now()) / 86_400_000));
  return days <= 1 ? 'the link works until tomorrow' : `the link works ${days} more days`;
}

export default function TeamCoachesPage({ params }: { params: Promise<{ orgSlug: string; teamId: string }> }) {
  const { orgSlug, teamId } = use(params);
  const { loading: orgLoading } = useOrg();
  const search = useSearchParams();
  const q = `orgSlug=${encodeURIComponent(orgSlug)}`;
  const teamBase = `/${orgSlug}/admin/rep-teams/teams/${teamId}`;

  const [read, setRead] = useState<CoachesRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ notFound: boolean } | null>(null);
  const [notice, setNotice] = useNotice();
  const [inviting, setInviting] = useState(false);
  const [cancelling, setCancelling] = useState<Invitation | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // The deep link is read ONCE, on arrival (the team page's Coaches rows link here with it); after
  // that the window is plain state. Opening and closing never touch the address: the window's own
  // Back step owns the history entry it stands on (useDialogFloor → useBackStep).
  const [personId, setPersonId] = useState<string | null>(() => search.get('person'));

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/rep-teams/teams/${teamId}/coaches?${q}`, { cache: 'no-store' });
      if (!res.ok) { if (current()) setLoadError({ notFound: res.status === 404 || res.status === 403 }); return; }
      const data = await res.json() as CoachesRead;
      if (current()) setRead(data);
    } catch {
      if (current()) setLoadError({ notFound: false });
    } finally {
      if (current()) setLoading(false);
    }
  }, [teamId, q, beginRead]);

  useDeferredLoad(!orgLoading, load);

  const teamName = read?.team.name ?? null;
  usePageTitle(teamName ? `Coaches · ${teamName}` : 'Coaches');
  usePublishRailTeam(teamId, teamName);

  const openPerson = (membershipId: string | null) => setPersonId(membershipId);

  async function resend(inv: Invitation) {
    setBusyId(inv.id);
    try {
      const res = await fetch(`/api/admin/rep-teams/teams/${teamId}/coaches/invites/${inv.id}?${q}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'resend' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setNotice({ tone: 'bad', text: data.error ?? 'The invitation could not be sent again.' }); return; }
      setNotice({ tone: 'good', text: `Sent again to ${inv.email}. The new link works for 7 days; the old one has stopped.` });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(inv: Invitation) {
    setBusyId(inv.id);
    try {
      const res = await fetch(`/api/admin/rep-teams/teams/${teamId}/coaches/invites/${inv.id}?${q}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      setCancelling(null);
      if (!res.ok) { setNotice({ tone: 'bad', text: data.error ?? 'The invitation could not be cancelled.' }); return; }
      setNotice({ tone: 'good', text: `The invitation to ${inv.email} is cancelled.` });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const header = (
    <AdminPageHeader
      legacy={null}
      backTo={{ href: teamBase, label: teamName ?? 'Team' }}
      crumbs={[{ label: 'Rep Teams' }, read?.team.groupName ? { label: read.team.groupName } : null]}
      title="Coaches"
      actions={read?.canWrite ? (
        <button type="button" className={`btn btn-lime ${ck.iconOnlyPhone}`} onClick={() => setInviting(true)} aria-label="Invite a coach">
          <UserPlus size={15} aria-hidden /><span className={ck.btnWord}>Invite a coach</span>
        </button>
      ) : undefined}
    />
  );

  if (orgLoading || loading) return <PageLoading header={header} />;

  if (loadError || !read) {
    return (
      <div className={repKit.page}>
        {header}
        <LoadFailed
          title={loadError?.notFound ? 'This team isn’t one you can open.' : 'We couldn’t load this team’s coaches.'}
          onRetry={loadError?.notFound ? undefined : () => { setLoading(true); void load(); }}
        />
      </div>
    );
  }

  const openInvites = read.invitations;
  const heads = read.staff.filter(s => s.coachRole === 'head_coach');
  const person = personId ? read.staff.find(s => s.membershipId === personId) ?? null : null;

  return (
    <div className={repKit.page}>
      {header}
      {notice && <PageNotice notice={notice} />}

      {!read.hasHeadCoach && (
        <Callout tone="bad" role="status" icon={<AlertTriangle size={16} aria-hidden />}>
          <b>{read.team.name} has no head coach.</b> The team’s row on Rep Teams stays red until someone accepts.
        </Callout>
      )}

      {read.staff.length === 0 && openInvites.length === 0 ? (
        <EmptyCard
          title="No coaches yet"
          action={read.canWrite ? <button type="button" className="btn btn-lime" onClick={() => setInviting(true)}>Invite a coach</button> : undefined}
        >
          Invite {read.team.name}’s head coach. They get an email, set up their account, and land on the team.
        </EmptyCard>
      ) : (
        <ClubRowList label={`${read.team.name}’s coaches`}>
          {openInvites.map(inv => (
            <ClubRow
              key={inv.id}
              title={<>{inv.email} <RepChip tone="warn">Invited</RepChip></>}
              caption={`${inv.kindWord} · invited ${formatStoredDate(inv.invitedAt, { withYear: false })}${inv.sentBy === 'portal' && inv.invitedByName ? ` by ${inv.invitedByName}` : ''} · ${linkClock(inv)}`}
              actions={read.canWrite ? (
                <>
                  {inv.status !== 'pending_approval' && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => void resend(inv)} disabled={busyId === inv.id}>
                      {busyId === inv.id ? 'Sending…' : 'Resend'}
                    </button>
                  )}
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setCancelling(inv)} disabled={busyId === inv.id}>Cancel</button>
                </>
              ) : undefined}
            />
          ))}
          {read.staff.map(s => (
            <ClubRow
              key={s.membershipId}
              as="button"
              aria-haspopup="dialog"
              onClick={() => openPerson(s.membershipId)}
              title={s.name || s.email || 'A coach'}
              caption={`${s.kindWord} · since ${formatStoredDate(s.since, { withYear: false })}`}
              chevron
            />
          ))}
        </ClubRowList>
      )}

      <p className={repKit.notes}>
        Team managers, treasurers and helpers are added by the head coach from the team’s Staff page. Coaches belong to
        the team, so this list is the same in every season.
      </p>

      {inviting && (
        <InviteCoachDialog
          orgSlug={orgSlug}
          teamId={teamId}
          teamName={read.team.name}
          onClose={() => setInviting(false)}
          onSent={async email => {
            setInviting(false);
            setNotice({ tone: 'good', text: `Invitation sent to ${email}. Their access starts when they accept.` });
            await load();
          }}
        />
      )}
      {person && (
        <CoachPersonDialog
          orgSlug={orgSlug}
          teamId={teamId}
          teamName={read.team.name}
          person={person}
          isOnlyHeadCoach={person.coachRole === 'head_coach' && heads.length === 1}
          canWrite={read.canWrite}
          onClose={() => openPerson(null)}
          onRemoved={async (name, teamHasHeadCoach) => {
            openPerson(null);
            setNotice({
              tone: 'good',
              text: teamHasHeadCoach ? `${name} is off ${read.team.name}’s staff.` : `${name} is off ${read.team.name}’s staff. It has no head coach until you invite one.`,
            });
            await load();
          }}
        />
      )}
      {cancelling && (
        <CancelInviteQuestion
          email={cancelling.email}
          busy={busyId === cancelling.id}
          onKeep={() => setCancelling(null)}
          onCancel={() => void cancel(cancelling)}
        />
      )}
    </div>
  );
}
