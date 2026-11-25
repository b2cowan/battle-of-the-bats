import { NextResponse } from 'next/server';
import { resolvePublicClub } from '@/lib/public-club-page';
import { readClubGames } from '@/lib/club-games-read';
import { withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * THE GAMES-ONLY CHECK (Club Website Stage 1, Pass 1; drawing tab 7): `GET /api/public/club-games/{club}`. What the club
 * home's games part and the house league schedule, standings and season pages fetch every 30 seconds inside a game window
 * (G6): the one games read, and nothing else — a whole-page refresh would repeat every one of the page's 15 to 21 reads.
 *
 *   · It asks the club's site and plan (the home's door, then each program's inside the read), like the page it serves.
 *   · The club is in the PATH and the address takes no query string (one is refused, never held): an edge that keys on the
 *     path alone can then never serve one club's games for another's, and a varied query cannot force a fresh read.
 *     The rows carry page paths; the page adds the club's own address, so one answer serves either web address.
 *   · No cookie is read or set (the proxy passes `/api/` untouched), so the edge may hold one answer for every visitor:
 *     `s-maxage=20` — held at most 20 seconds — and NO `stale-while-revalidate`: serving stale would stretch how long an
 *     organizer's unpublish or a coach's "Families only" stays visible. No tag cache: nothing shows the host shares one.
 *   · The answer carries `asOf`; a page whose newer render already shows "Final" ignores an older held answer
 *     (`isNewerGamesRead`, lib/club-game-live.ts).
 *   · A refusal or a failure is never held at the edge, and the page keeps what it shows (G11: a failed check says nothing).
 */
const HELD_AT_THE_EDGE = 'public, max-age=0, s-maxage=20';
const NEVER_HELD = 'no-store';

export const GET = withObservability(async (req: Request, { params }: { params: Promise<{ orgSlug: string }> }) => {
  const { orgSlug } = await params;
  if (new URL(req.url).search) {
    return NextResponse.json({ error: 'This address takes no query.' }, { status: 400, headers: { 'Cache-Control': NEVER_HELD } });
  }
  const org = await resolvePublicClub(orgSlug, 'home');
  if (!org) return NextResponse.json({ error: 'Not found.' }, { status: 404, headers: { 'Cache-Control': NEVER_HELD } });
  try {
    return NextResponse.json(await readClubGames(org), { headers: { 'Cache-Control': HELD_AT_THE_EDGE } });
  } catch (error) {
    console.error('[club-games] read failed', { orgSlug, error });
    return NextResponse.json({ error: 'Games could not be read.' }, { status: 503, headers: { 'Cache-Control': NEVER_HELD } });
  }
}, { route: '/api/public/club-games/[orgSlug]' });
