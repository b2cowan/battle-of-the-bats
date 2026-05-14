import { forbidden, getAuthContextWithScope, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';

type GameStatusRow = {
  status: string | null;
};

export async function GET(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();

  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_tournaments')) return forbidden();

  const tournamentId = new URL(req.url).searchParams.get('tournamentId');
  if (!tournamentId) {
    return Response.json({ error: 'Missing tournamentId' }, { status: 400 });
  }

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const { data: tournament, error: tournamentError } = await supabaseAdmin
    .from('tournaments')
    .select('id')
    .eq('id', tournamentId)
    .eq('organization_id', ctx.org.id)
    .maybeSingle();

  if (tournamentError) {
    return Response.json({ error: tournamentError.message }, { status: 500 });
  }

  if (!tournament) {
    return Response.json({ error: 'Tournament not found' }, { status: 404 });
  }

  const [ageGroupsRes, teamsRes, gamesRes, announcementsRes] = await Promise.all([
    supabaseAdmin
      .from('age_groups')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('games')
      .select('status')
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('announcements')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId),
  ]);

  const queryError = ageGroupsRes.error ?? teamsRes.error ?? gamesRes.error ?? announcementsRes.error;
  if (queryError) {
    return Response.json({ error: queryError.message }, { status: 500 });
  }

  const games = (gamesRes.data ?? []) as GameStatusRow[];

  return Response.json({
    ageGroups: ageGroupsRes.count ?? 0,
    teams: teamsRes.count ?? 0,
    scheduled: games.filter(game => game.status === 'scheduled').length,
    completed: games.filter(game => game.status === 'completed').length,
    announcements: announcementsRes.count ?? 0,
  });
}
