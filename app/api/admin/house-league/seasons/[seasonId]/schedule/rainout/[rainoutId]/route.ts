import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { hasPlanFeature } from '@/lib/plan-features';
import { isUuid } from '@/lib/utils';
import { RAIN_WORDS as W } from '@/lib/league-rainout';
import { rainoutOf } from '@/lib/league-rainout-server';
import { sendRainout } from '@/lib/league-rainout-send';

// "Send the changes" sends inside the request, one send per division.
export const maxDuration = 120;

/**
 * A HELD RAINOUT (House League 9e-2, 9e·13; mig 427). POST { action }:
 *   'back' — Put all back: every game returns as it was before the rainout, all or nothing, only while every change it
 *            made is still held and nothing has happened to its games since (`league_rainout_put_back`). After a send:
 *            `gone`. Nobody was told, so nobody is told now.
 *   'send' — the held sheet's "Send the changes": one send per division, as the window's tick would have done.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string; rainoutId: string }> },) => {
  const ctx = await getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;
  const { seasonId, rainoutId } = await params;
  if (!isUuid(rainoutId)) return NextResponse.json({ error: 'Rainout not found' }, { status: 404 });
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;
  if (!hasPlanFeature(ctx!.org.planId, 'bulk_reschedule')) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== 'back' && action !== 'send') return NextResponse.json({ error: 'The request was not understood' }, { status: 400 });

  const rainout = await rainoutOf(ctx!.org.id, seasonId, rainoutId);
  if (!rainout) return NextResponse.json({ error: 'Rainout not found' }, { status: 404 });

  if (action === 'back') {
    const { data, error } = await supabaseAdmin.rpc('league_rainout_put_back', {
      p_org: ctx!.org.id, p_season: seasonId, p_rainout: rainoutId, p_actor: ctx!.user.id,
    });
    if (error) throw new Error(`Put all back didn't save: ${error.message}`);
    switch (data as string | null) {
      case null: return NextResponse.json({ ok: true, games: rainout.game_ids.length });
      case 'not_found': return NextResponse.json({ error: 'Rainout not found' }, { status: 404 });
      case 'finished': return NextResponse.json({ error: W.errFinished(season.name), finished: true }, { status: 423 });
      case 'gone': return NextResponse.json({ error: W.backGone, code: 'gone' }, { status: 409 });
      default: return NextResponse.json({ error: W.backRefused, code: 'refused' }, { status: 409 });
    }
  }

  // Put back since: there is nothing of this rainout left to send.
  if (rainout.put_back_at) return NextResponse.json({ error: W.backDone(rainout.game_ids.length), code: 'back' }, { status: 409 });
  const divisions = await sendRainout({
    org: ctx!.org, season, actorId: ctx!.user.id, gameIds: rainout.game_ids, divisionIds: rainout.division_ids,
  });
  return NextResponse.json({ ok: true, divisions });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule/rainout/[rainoutId]' });
