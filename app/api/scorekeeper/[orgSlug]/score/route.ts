import { NextResponse } from 'next/server';
import { getScore as getOfficialScore } from '@/app/api/official/[orgSlug]/score/get-score';
import { getAuthContextWithScope, unauthorized, scopeGuard, requireTournamentInOrg } from '@/lib/api-auth';
import { canScore } from '@/lib/volunteer-jobs';
import { volunteerShut } from '@/lib/invite-only-event';
import { INVITE_REFUSALS } from '@/lib/invite-only-words';
import {
  loadTournamentScoreGame,
  submitTournamentScore,
  TournamentScoringError,
} from '@/lib/tournament-scoring-service';
import { readScoreNoticeGame, sendScoreNotice } from '@/lib/score-notice-server';
import { withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ orgSlug: string }> };

export const GET = withObservability(getOfficialScore, { route: '/api/scorekeeper/[orgSlug]/score' });

export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const { orgSlug } = await params;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();

  if (ctx.org.slug !== orgSlug) {
    return NextResponse.json({ error: 'This scorekeeper link belongs to another organization.' }, { status: 403 });
  }
  if (!canScore(ctx.role, ctx.capabilities)) {
    return NextResponse.json({ error: 'You do not have scorekeeper access for this organization.' }, { status: 403 });
  }
  // No volunteer job on a plan without volunteers (the free tournament tier, R7, B2): the host and staff keep Field scores.
  if (volunteerShut(ctx.org.planId, ctx.role)) {
    return NextResponse.json({ error: INVITE_REFUSALS.hidden }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as {
    id?: unknown;
    homeScore?: unknown;
    awayScore?: unknown;
  };

  if (typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Game id required.' }, { status: 400 });
  }

  try {
    const gameRow = await loadTournamentScoreGame(body.id);
    const denied = scopeGuard(ctx, gameRow.tournamentId);
    if (denied) return denied;

    const wrongOrg = await requireTournamentInOrg(ctx, gameRow.tournamentId);
    if (wrongOrg) return wrongOrg;

    const before = await readScoreNoticeGame(body.id);
    const result = await submitTournamentScore({
      gameId: body.id,
      game: gameRow,
      homeScore: body.homeScore,
      awayScore: body.awayScore,
      actor: {
        userId: ctx.user.id,
        email: ctx.user.email ?? null,
        role: ctx.role,
        orgRequireScoreFinalization: ctx.org.requireScoreFinalization,
      },
      source: 'scorekeeper',
      allowFinalizedEdit: false,
    });

    // Tell the people who can open Results (fire-and-forget; one wording, lib/score-notice.ts).
    sendScoreNotice({
      org: ctx.org, actor: ctx.user, gameId: body.id, tournamentId: gameRow.tournamentId, before,
      result: { kind: 'score', homeScore: body.homeScore as number, awayScore: body.awayScore as number },
      held: result.status === 'submitted',
    }).catch(console.error);

    return NextResponse.json({ success: true, status: result.status });
  } catch (err) {
    if (err instanceof TournamentScoringError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}, { route: '/api/scorekeeper/[orgSlug]/score' });
