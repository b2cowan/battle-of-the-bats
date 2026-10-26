import { NextResponse } from 'next/server';
import { randomInt } from 'node:crypto';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById } from '@/lib/db';
import { divisionInSeason } from '@/lib/league-season-scope';
import { applyDraft, clearDivision, readDivisionBoard, type DivisionRefusal } from '@/lib/house-league-teams';
import { runDraft } from '@/lib/house-league-draft';
import { getRatings } from '@/lib/house-league-ratings';
import { draftRefusal } from '@/lib/house-league-teams-words';
import { withObservability } from '@/lib/observability';

/**
 * The balanced draft for one division (Club Tier 9c, Part 2; rulings Q8, 9c·3, 9c·5, 9c·7, 9c·8). Replaces the live
 * draft room (start / pick / undo / finalize) and Randomize, both retired (9c·5).
 *   · `run` — Run the draft / Draft again: deals every accepted, unlocked player of the division, in one write.
 *   · `clear` — Take all players off teams: before publishing only; locks and moves by hand go too.
 * Both carry the fingerprint the window saw, and are refused when the division changed under it (copy §4.3).
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
  const { action, divisionId, fingerprint } = body;
  if (!(await divisionInSeason(seasonId, divisionId))) {
    return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  }
  if (typeof fingerprint !== 'string' || !fingerprint) {
    return NextResponse.json({ error: 'Close this window and look again.' }, { status: 400 });
  }
  const board = await readDivisionBoard(season, divisionId);
  if (!board) return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  const words = { division: board.division.name, players: board.players.length, teams: board.teams.length };
  const refusal = (code: DivisionRefusal) => code === 'finished'
    ? NextResponse.json({ error: 'This season is finished. Reopen it to change it.', finished: true }, { status: 423 })
    : NextResponse.json({ error: draftRefusal(code, words), code }, { status: 409 });
  if (board.division.publishedAt) return refusal('published');
  if (board.fingerprint !== fingerprint) return refusal('changed');

  if (action === 'clear') {
    const cleared = await clearDivision(ctx!.org.id, seasonId, divisionId, fingerprint);
    if (cleared) return refusal(cleared);
    return NextResponse.json({ ok: true });
  }

  if (action === 'run') {
    // The draft reads ratings (9c·8): the runners only, the same answer as `run` today, asked by name so the ratings
    // guard can see it.
    const ratingsRefused = houseLeagueRefusal(ctx, 'seeRatings', season);
    if (ratingsRefused) return ratingsRefused;
    const ratings = await getRatings(seasonId, board.players.map(p => p.id));
    const result = runDraft(
      board.players.map(p => ({ id: p.id, rating: ratings.get(p.id) ?? null, lockedTeamId: p.locked ? p.teamId : null })),
      board.teams.map(t => t.id),
      randomInt(2 ** 31),
    );
    if (!result.ok) {
      return NextResponse.json({ error: draftRefusal(result.refusal, words), code: result.refusal }, { status: 422 });
    }
    const applied = await applyDraft(ctx!.org.id, seasonId, divisionId, fingerprint, result.deal);
    if (applied) return refusal(applied);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/draft' });
