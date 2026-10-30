import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { CHANGES_TO_SEND_WORDS as W } from '@/lib/league-schedule-words';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';

/**
 * UNDO A HELD CHANGE (House League 9d-2b Part 3, frame f2's Undo; mig 409's `league_game_undo`). The game goes back to
 * what families last heard and its held rows go, so nothing is ever emailed about it; a game added since the last send is
 * removed (families never heard of it). A game played since keeps its result. Locked on the division with the send, so
 * an Undo and a Send pressed together cannot both win.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string; gameId: string }> },) => {
  const ctx = await getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;
  const { seasonId, gameId } = await params;
  if (!isUuid(gameId)) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;

  const { data, error } = await supabaseAdmin.rpc('league_game_undo', { p_org: ctx!.org.id, p_season: seasonId, p_game: gameId });
  if (error) throw new Error(`Undo didn't save: ${error.message}`);
  switch (data as string | null) {
    case 'not_found': return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    // Sent or undone by someone else since the window read it.
    case 'nothing': return NextResponse.json({ error: W.gameChanged, code: 'changed' }, { status: 409 });
    case 'played': return NextResponse.json({ error: W.undoPlayed, code: 'played' }, { status: 409 });
    // 9d-2b Part 5 (mig 411): the club's move is never undone onto time it gave away (9d2·3).
    case 'club': return NextResponse.json({ error: W.undoClub, code: 'club' }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/undo' });
