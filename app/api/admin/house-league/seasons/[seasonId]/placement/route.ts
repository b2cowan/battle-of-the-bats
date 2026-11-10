import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { registrationsInSeason, teamsInSeason } from '@/lib/league-season-scope';
import { placePlayer, setLock } from '@/lib/house-league-teams';
import { lockWords, placeRefusal } from '@/lib/house-league-teams-words';
import { withObservability } from '@/lib/observability';

/**
 * One player on Teams & draft (Club Tier 9c, copy §5-6). Replaces Randomize, assign, bulk assign and clear (9c·5; clear is
 * now the draft route's "Take all players off teams").
 *   · `place` — onto a team, or off it (teamId null). Immediate and silent, before and after publishing (TC·1, which
 *     supersedes 9c·12): no window, no email. After publishing the family is told later from the Teams screen's banner
 *     (the team-changes route).
 *   · `lock` — Lock to this team / Unlock (9c·3), before publishing.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const ctx = await getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;

  const body = await req.json().catch(() => ({}));
  const { action, registrationId } = body;
  if (!(await registrationsInSeason(seasonId, [registrationId]))) {
    return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
  }

  if (action === 'place') {
    const teamId = body.teamId ?? null;
    if (teamId !== null && !(await teamsInSeason(seasonId, [teamId]))) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    const placed = await placePlayer(ctx!.org.id, seasonId, registrationId, teamId, ctx!.user.id);
    if ('refusal' in placed) {
      const { data: reg } = await supabaseAdmin.from('league_registrations')
        .select('player_first_name, player_last_name, league_divisions(name)').eq('id', registrationId).maybeSingle();
      const division = (reg?.league_divisions as { name?: string } | null)?.name ?? 'This division';
      const name = reg ? `${reg.player_first_name} ${reg.player_last_name}` : 'This player';
      const status = placed.refusal === 'finished' ? 423 : 409;
      return NextResponse.json({ error: placeRefusal(placed.refusal, name, division), code: placed.refusal }, { status });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'lock') {
    const refused = await setLock(seasonId, registrationId, body.locked === true);
    if (refused) {
      const { data: reg } = await supabaseAdmin.from('league_registrations')
        .select('player_first_name, league_divisions(name)').eq('id', registrationId).maybeSingle();
      const first = reg?.player_first_name ?? 'This player';
      const division = (reg?.league_divisions as { name?: string } | null)?.name ?? 'This division';
      const error = refused === 'published'
        ? `${division} is published, so there is no draft left to lock ${first} against.`
        : lockWords.noTeam(first);
      return NextResponse.json({ error, code: refused }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/placement' });
