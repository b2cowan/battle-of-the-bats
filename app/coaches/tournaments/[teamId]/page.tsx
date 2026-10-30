import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  canUserAccessTournamentRegistration,
  findLinkedBasicTeamForRegistration,
} from '@/lib/basic-coach-teams';
import { findRepTeamAccessForRegistration, tournamentEntryTabTitle } from '@/lib/coach-registration-access';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-kind';
import { portalsInForce } from '@/lib/portal-in-force-server';
import type { Organization } from '@/lib/types';
import { COACHES_HELP_PATH, COACHES_TEAM_PATH, COACHES_TOURNAMENTS_PATH, portalTournamentRecordPath } from '@/lib/coaches-portal-routes';
import CoachTournamentRecord from '@/components/coaches/CoachTournamentRecord';

type RouteParams = {
  params: Promise<{ teamId: string }>;
  searchParams?: Promise<{ welcome?: string }>;
};

export async function generateMetadata({ params }: RouteParams) {
  const { teamId } = await params;
  // J5-035: mirror the page's access gate. A pending/rejected team name isn't public, so the
  // title must NOT expose it to a viewer who can't access the registration — fall back to a
  // generic title (the record body itself stays gated by canUserAccessTournamentRegistration).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { title: 'Tournament Record' };

  const access = await canUserAccessTournamentRegistration({
    userId: user.id,
    email: user.email.toLowerCase(),
    registrationId: teamId,
  });
  if (!access) return { title: 'Tournament Record' };

  // "Invitational 2026 · 15U AAA" — the tournament, then the team (Stage 7d, T1), as the paid portal reads.
  return { title: (await tournamentEntryTabTitle(teamId)) ?? 'Tournament Record' };
}

export default async function CoachTournamentRecordDetailPage({ params, searchParams }: RouteParams) {
  const { teamId } = await params;
  const { welcome } = (await searchParams) ?? {};

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect(`/auth/login?next=${COACHES_TOURNAMENTS_PATH}/${teamId}`);
  }

  // An entry filed under a Premium team opens on THAT portal's record, never here (B6, Register Your
  // Existing Team, 2026-10-13). One redirect at the record itself serves every way in — Submit, the
  // confirmation email's portal link, a bookmark, the join page — and it is the only way a staff member
  // who registered the team can open it at all: they are on the portal's staff, not members of the free
  // team underneath. It fires exactly when the portal's record WILL open for this person — the Premium
  // page's own gate (a configuring coaching assignment on the rep team the entry belongs to,
  // `findRepTeamAccessForRegistration`, Part D) — so nobody is sent to a page that bounces them (a head
  // coach between seasons, a helper, a lapsed portal; /review 2026-10-14). Standalone Premium portals only:
  // a club's teams are out of scope. A failed lookup never fails the page — it falls back to this record.
  let portalHref: string | null = null;
  try {
    const access = await findRepTeamAccessForRegistration(user.id, teamId);
    if (access) {
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('slug, account_kind, plan_id')
        .eq('id', access.orgId)
        .maybeSingle<{ slug: string | null; account_kind: string | null; plan_id: string | null }>();
      if (org?.slug && isTeamWorkspaceOrg({ accountKind: org.account_kind as Organization['accountKind'], planId: org.plan_id as Organization['planId'] })) {
        // Only while the portal is in force (the one question): after a portal's free time ends the free team is the
        // coach's again, and its record opens here instead of bouncing them to a "free time has ended" wall (Stage 4b review).
        const { data: ws } = await supabaseAdmin
          .from('team_workspaces').select('id').eq('workspace_org_id', access.orgId).maybeSingle<{ id: string }>();
        const live = ws ? await portalsInForce([{ workspaceId: ws.id, orgId: access.orgId, repTeamId: access.repTeamId }]) : null;
        if (ws && live?.has(ws.id)) portalHref = portalTournamentRecordPath(org.slug, access.repTeamId, teamId);
      }
    }
  } catch (err) {
    console.error('[coaches tournament record] portal lookup failed (non-fatal, free record shown):', err);
  }
  if (portalHref) redirect(portalHref);

  const linkedBasicTeamId = await findLinkedBasicTeamForRegistration(user.id, teamId);

  // A3.3 (◆G): back returns to the TEAM-SCOPED Tournaments list — the A2 tab's actual
  // destination, mirroring Premium's team-scoped back link. The account-wide hub stays
  // the fallback for a registration-only coach with no linked free team (for whom the
  // hub is the only list that exists).
  const backHref = linkedBasicTeamId
    ? `${COACHES_TEAM_PATH}/${linkedBasicTeamId}/tournaments`
    : COACHES_TOURNAMENTS_PATH;

  return (
    <CoachTournamentRecord
      registrationId={teamId}
      userId={user.id}
      email={user.email}
      welcome={welcome === '1'}
      backHref={backHref}
      /* A2: the shell's persistent header carries this page's identity + Flip. */
      hideHeader
      scheduleHref={linkedBasicTeamId ? `${COACHES_TEAM_PATH}/${linkedBasicTeamId}/schedule` : null}
      helpGuideHref={`${COACHES_HELP_PATH}#tournaments`}
    />
  );
}
