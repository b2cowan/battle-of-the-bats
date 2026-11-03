import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { CHANGES_TO_SEND_WORDS as CW } from '@/lib/league-schedule-words';
import { clubKeepScore, staffName } from '@/lib/league-coach-scores-server';
import { isInstant } from '@/lib/league-coach-scores';

/**
 * KEEP A COACH'S SCORE (House League 9e-3, ruling 9e·9; owner answer 2026-11-03 Q4): the league admin looked at a score a
 * coach entered and keeps it as it is — "Keep 7–4" on a coach-entered or reported score, and the game window's ✓ with no
 * change. It leaves "Scores to check" and both coaches' doors close ("The league admin checked this score."). The score
 * itself does not change, so nothing is recorded for families and nobody is emailed.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string; gameId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err) return err;

  const { seasonId, gameId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;

  const body = await req.json().catch(() => null) as { seen?: unknown } | null;
  if (!body || !isInstant(body.seen)) return NextResponse.json({ error: 'The request was not understood' }, { status: 400 });

  // The game must be this season's: the function checks the org, the season is checked here.
  const result = await clubKeepScore({ orgId: ctx!.org.id, seasonId, gameId, seen: body.seen, userId: ctx!.user.id, name: staffName(ctx!) });
  if (result === 'notFound') return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  // A score that changed, or that is no longer a coach's to check, is a window that is out of date: read again.
  if (result) return NextResponse.json({ error: CW.gameChanged, code: 'changed' }, { status: 409 });
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/keep' });
