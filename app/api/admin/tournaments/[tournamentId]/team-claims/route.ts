import { NextRequest, NextResponse } from 'next/server';
import { teamWorkspaceClaimInviteHtml, sendEmail } from '@/lib/email';
import { getAuthContextWithScope, forbidden, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { writePlatformEvent } from '@/lib/platform-events';
import { buildTeamWorkspaceClaimUrl, createTournamentTeamWorkspaceClaim } from '@/lib/team-workspace-claims';
import { supabaseAdmin } from '@/lib/supabase-admin';

type RouteParams = { params: Promise<{ tournamentId: string }> };

type TeamRow = {
  id: string;
  tournament_id: string | null;
  age_group_id: string | null;
  name: string;
  coach: string | null;
  email: string | null;
  status: string | null;
};

type TournamentRow = {
  id: string;
  name: string;
  organization_id: string | null;
  contact_email: string | null;
};

type AgeGroupRow = {
  id: string;
  name: string;
};

type ClaimRow = {
  id: string;
  tournament_team_id: string | null;
  status: string | null;
};

const ELIGIBLE_STATUSES = new Set(['accepted', 'pending']);

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function cleanIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

function normalizeEmail(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

async function trackTeamClaimEvent(input: {
  orgId: string;
  userId: string;
  userEmail?: string | null;
  planId: string;
  tournamentId: string;
  selectedCount: number;
  status: 'attempted' | 'completed';
  linksCreated?: number;
  emailsSent?: number;
  skippedCount?: number;
}) {
  await writePlatformEvent({
    eventType: 'tournament_registration_operation_used',
    source: 'app',
    orgId: input.orgId,
    actorUserId: input.userId,
    actorEmail: input.userEmail,
    planId: input.planId,
    metadata: {
      feature: 'team_workspace_claims',
      action: 'send_team_claim_invites',
      tournamentId: input.tournamentId,
      selectedCount: input.selectedCount,
      status: input.status,
      linksCreated: input.linksCreated,
      emailsSent: input.emailsSent,
      skippedCount: input.skippedCount,
    },
  });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return forbidden();
  if (!hasCapability(ctx.role, ctx.capabilities, 'manage_registrations') && !hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) {
    return forbidden();
  }

  const { tournamentId } = await params;
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const body = await req.json().catch(() => ({})) as { ids?: unknown; sendEmail?: unknown };
  const ids = cleanIds(body.ids);
  const shouldSendEmail = body.sendEmail !== false;

  if (ids.length === 0) return json({ error: 'Select at least one registration.' }, 400);

  await trackTeamClaimEvent({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    planId: ctx.org.planId,
    tournamentId,
    selectedCount: ids.length,
    status: 'attempted',
  });

  const [
    { data: tournament, error: tournamentError },
    { data: teams, error: teamsError },
    { data: ageGroupRows, error: ageGroupError },
    { data: claimRows, error: claimsError },
  ] = await Promise.all([
    supabaseAdmin
      .from('tournaments')
      .select('id, name, organization_id, contact_email')
      .eq('id', tournamentId)
      .maybeSingle<TournamentRow>(),
    supabaseAdmin
      .from('teams')
      .select('id, tournament_id, age_group_id, name, coach, email, status')
      .in('id', ids),
    supabaseAdmin
      .from('age_groups')
      .select('id, name')
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('team_workspace_claims')
      .select('id, tournament_team_id, status')
      .eq('tournament_id', tournamentId)
      .in('tournament_team_id', ids),
  ]);

  if (tournamentError) return json({ error: tournamentError.message }, 500);
  if (teamsError) return json({ error: teamsError.message }, 500);
  if (ageGroupError) return json({ error: ageGroupError.message }, 500);
  if (claimsError) return json({ error: claimsError.message }, 500);
  if (!tournament || tournament.organization_id !== ctx.org.id) return forbidden();

  const selectedTeams = (teams ?? []) as TeamRow[];
  if (selectedTeams.length !== ids.length || selectedTeams.some(team => team.tournament_id !== tournamentId)) {
    return json({ error: 'One or more registrations are outside this tournament.' }, 400);
  }

  const ageGroups = new Map((ageGroupRows ?? []).map(group => [group.id, group as AgeGroupRow]));
  const claimsByTeamId = new Map<string, ClaimRow[]>();
  for (const claim of (claimRows ?? []) as ClaimRow[]) {
    if (!claim.tournament_team_id) continue;
    const existing = claimsByTeamId.get(claim.tournament_team_id) ?? [];
    existing.push(claim);
    claimsByTeamId.set(claim.tournament_team_id, existing);
  }

  const contactEmail = tournament.contact_email ?? ctx.org.contactEmail ?? ctx.user.email ?? undefined;
  const results: Array<{
    teamId: string;
    teamName: string;
    coachName: string | null;
    email: string;
    ageGroupName: string;
    claimUrl: string;
    emailed: boolean;
  }> = [];
  const skipped = {
    missingEmail: 0,
    ineligibleStatus: 0,
    alreadyClaimed: 0,
    sendFailed: 0,
  };

  for (const team of selectedTeams) {
    const email = normalizeEmail(team.email);
    if (!email) {
      skipped.missingEmail++;
      continue;
    }
    if (!ELIGIBLE_STATUSES.has(team.status ?? '')) {
      skipped.ineligibleStatus++;
      continue;
    }
    if ((claimsByTeamId.get(team.id) ?? []).some(claim => claim.status === 'claimed')) {
      skipped.alreadyClaimed++;
      continue;
    }

    const claim = await createTournamentTeamWorkspaceClaim({
      tournamentId,
      tournamentTeamId: team.id,
      contactEmail: email,
      replaceAvailable: true,
    });
    const claimUrl = buildTeamWorkspaceClaimUrl(
      claim.token,
      req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL,
    );
    const ageGroupName = team.age_group_id ? ageGroups.get(team.age_group_id)?.name ?? 'Division' : 'Division';
    let emailed = false;

    if (shouldSendEmail) {
      try {
        await sendEmail(
          email,
          `Claim your Team workspace - ${team.name}`,
          teamWorkspaceClaimInviteHtml({
            teamName: team.name,
            coachName: team.coach ?? '',
            ageGroupName,
            tournamentName: tournament.name,
            claimUrl,
            contactEmail,
          }),
        );
        emailed = true;
      } catch (error) {
        skipped.sendFailed++;
        console.error('[team-claims] invite email failed:', error);
      }
    }

    results.push({
      teamId: team.id,
      teamName: team.name,
      coachName: team.coach,
      email,
      ageGroupName,
      claimUrl,
      emailed,
    });
  }

  const skippedCount = skipped.missingEmail + skipped.ineligibleStatus + skipped.alreadyClaimed + skipped.sendFailed;

  await trackTeamClaimEvent({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    planId: ctx.org.planId,
    tournamentId,
    selectedCount: ids.length,
    status: 'completed',
    linksCreated: results.length,
    emailsSent: results.filter(result => result.emailed).length,
    skippedCount,
  });

  return json({
    success: true,
    linksCreated: results.length,
    emailsSent: results.filter(result => result.emailed).length,
    skipped,
    skippedCount,
    results,
  });
}
