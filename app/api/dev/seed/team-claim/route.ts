import { NextResponse } from 'next/server';
import { requireDevToolPlatformAdmin } from '@/lib/platform-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  buildTeamWorkspaceClaimUrl,
  createTournamentTeamWorkspaceClaim,
} from '@/lib/team-workspace-claims';

const DEV_TOURNAMENT_SLUG = 'dev-tournament-2026';

type TournamentTeamSeedRow = {
  id: string;
  tournament_id: string;
  name: string;
  email: string | null;
  tournaments?: { slug?: string | null; name?: string | null } | { slug?: string | null; name?: string | null }[] | null;
};

function getTournament(row: TournamentTeamSeedRow) {
  return Array.isArray(row.tournaments) ? row.tournaments[0] : row.tournaments;
}

export async function POST() {
  const auth = await requireDevToolPlatformAdmin();
  if (auth.response) return auth.response;

  const { data: team, error } = await supabaseAdmin
    .from('teams')
    .select('id, tournament_id, name, email, tournaments!inner(slug, name)')
    .eq('tournaments.slug', DEV_TOURNAMENT_SLUG)
    .neq('status', 'rejected')
    .not('email', 'is', null)
    .order('registered_at', { ascending: false })
    .limit(1)
    .maybeSingle<TournamentTeamSeedRow>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!team?.email) {
    return NextResponse.json({ error: 'Seed the dev tournament first so there is a team contact to claim.' }, { status: 400 });
  }

  const claim = await createTournamentTeamWorkspaceClaim({
    tournamentId: team.tournament_id,
    tournamentTeamId: team.id,
    contactEmail: team.email,
    replaceAvailable: true,
  });

  const tournament = getTournament(team);
  const claimUrl = buildTeamWorkspaceClaimUrl(claim.token, process.env.NEXT_PUBLIC_APP_URL);

  return NextResponse.json({
    ok: true,
    log: [
      `Created claim for ${team.name}`,
      `Tournament: ${tournament?.name ?? DEV_TOURNAMENT_SLUG}`,
      `Contact: ${team.email}`,
      `Claim URL: ${claimUrl}`,
    ],
    claimUrl,
  });
}
