import { NextResponse } from 'next/server';
import { getScore as getOfficialScore } from '@/app/api/official/[orgSlug]/score/route';
import { getAuthContextWithScope, unauthorized, scopeGuard, requireTournamentInOrg } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import {
  loadTournamentScoreGame,
  submitTournamentScore,
  TournamentScoringError,
} from '@/lib/tournament-scoring-service';
import { notify } from '@/lib/notify';
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
  if (!hasCapability(ctx.role, ctx.capabilities, 'submit_scores')) {
    return NextResponse.json({ error: 'You do not have scorekeeper access for this organization.' }, { status: 403 });
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

    // Notify org admins of submitted score (fire-and-forget)
    notify({
      orgId: ctx.org.id,
      tournamentId: gameRow.tournamentId,
      eventType: 'score_submitted',
      title: 'Score submitted',
      body: `Submitted by scorekeeper ${ctx.user.email ?? ''}`.trim(),
      link: `/${ctx.org.slug}/admin/tournaments/schedule?tournamentId=${gameRow.tournamentId}`,
      excludeUserIds: [ctx.user.id],
    }).catch(console.error);

    return NextResponse.json({ success: true, status: result.status });
  } catch (err) {
    if (err instanceof TournamentScoringError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}, { route: '/api/scorekeeper/[orgSlug]/score' });
