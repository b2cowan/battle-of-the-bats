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
import { friendRequestsOn } from '@/lib/league-friends';
import { keepFriendsApart, readDivisionFriendLinks } from '@/lib/league-friend-queue-server';
import { outcomesToStore } from '@/lib/league-friend-draft';
import { withObservability } from '@/lib/observability';

/** A uuid, exactly: anything else is refused here, never sent to the database. */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The balanced draft for one division (Club Tier 9c, Part 2; rulings Q8, 9c·3, 9c·5, 9c·7, 9c·8). Replaces the live
 * draft room (start / pick / undo / finalize) and Randomize, both retired (9c·5).
 *   · `run` — Run the draft / Draft again: deals every accepted, unlocked player of the division, in one write. `together`
 *     (A7, default on): a household's children (one guardian email) go to one team; `false` deals as before A7.
 *     `friends` (Board Ready Stage 1 Part 3, default on): confirmed friends of the division join those groups, at most 3
 *     children (A1, A6, A7); what the deal did with each request lands with the deal (mig 473). The links are read
 *     here and never returned to the window (A11: names reach only the board's read, behind the registrations read).
 *   · `clear` — Take all players off teams: before publishing only; locks and moves by hand go too.
 *   · `keepApart` / `keepTogether` — the board's "Keep apart from a friend…" and its undo (tab 5): no fingerprint, since
 *     they deal nobody; the next draft reads them. Behind the registrations read too, as the board's friend marks are.
 * Run and clear carry the fingerprint the window saw, and are refused when the division changed under it (copy §4.3).
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

  if (action === 'keepApart' || action === 'keepTogether') {
    const readRefused = houseLeagueRefusal(ctx, 'read', season);
    if (readRefused) return readRefused;
    if (!friendRequestsOn(ctx!.org.planId, season.friendRequestsMax)) return NextResponse.json({ error: 'Friend requests are off for this season.' }, { status: 409 });
    if (typeof body.a !== 'string' || typeof body.b !== 'string' || !ID.test(body.a) || !ID.test(body.b) || body.a === body.b) {
      return NextResponse.json({ error: 'Close this window and look again.' }, { status: 400 });
    }
    const kept = await keepFriendsApart({ orgId: ctx!.org.id, seasonId, divisionId, a: body.a, b: body.b, apart: action === 'keepApart', userId: ctx!.user.id });
    if ('refusal' in kept) return NextResponse.json({ error: 'That friend request has changed. Close this and look again.', code: 'changed' }, { status: 409 });
    return NextResponse.json({ ok: true });
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
    // Friends together (Part 3): the division's confirmed links, unless the window's switch was turned off (on by
    // default). Off the plan or at None there are none.
    const friendsAsked = body.friends !== false;
    const [ratings, friends] = await Promise.all([
      getRatings(seasonId, board.players.map(p => p.id)),
      friendRequestsOn(ctx!.org.planId, season.friendRequestsMax) ? readDivisionFriendLinks(ctx!.org.id, seasonId, divisionId) : null,
    ]);
    const links = friends?.links ?? [];
    // A7: families together unless the window's switch was turned off (on by default — a request without it keeps them).
    const together = body.together !== false;
    const result = runDraft(
      board.players.map(p => ({ id: p.id, rating: ratings.get(p.id) ?? null, lockedTeamId: p.locked ? p.teamId : null, household: p.guardianEmail })),
      board.teams.map(t => t.id),
      randomInt(2 ** 31),
      { together, friends: friendsAsked ? links : [] },
    );
    if (!result.ok) {
      return NextResponse.json({ error: draftRefusal(result.refusal, words), code: result.refusal }, { status: 422 });
    }
    const applied = await applyDraft(ctx!.org.id, seasonId, divisionId, fingerprint, result.deal,
      outcomesToStore(links, friendsAsked ? result.links : null));
    if (applied) return refusal(applied);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/draft' });
