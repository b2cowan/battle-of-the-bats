import { NextResponse } from 'next/server';
import { mergeRepTeamAwardTypes, previewMergeRepTeamAwardTypes } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canManageAwards } from '@/lib/coach-capabilities';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';

type TeamParams = { params: Promise<{ orgSlug: string; teamId: string }> };

/**
 * `/award-types/merge` — fold one award type into another (Awards Join the One Tag Idiom Part B).
 * Same shape as `coachTagMergeRoute` (lib/coach-tag-routes.ts), plus a GET preview the tag merge
 * has no need for: R5 means a loser award can collide with an existing winner award, so the
 * confirm dialog has to state the consequence BEFORE the tap, not just after ("4 awards become
 * MVP. 1 is dropped — Blake would hold MVP twice for the Apr 16 game").
 */
export const GET = withObservability(async (req: Request, { params }: TeamParams) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const denied = denyUnless(canManageAwards(resolved.assignment.capabilities), 'You do not have access to awards.');
  if (denied) return denied;

  const url = new URL(req.url);
  const winnerTypeId = url.searchParams.get('winner') ?? '';
  const loserTypeId = url.searchParams.get('loser') ?? '';
  if (!winnerTypeId || !loserTypeId) {
    return NextResponse.json({ error: 'winner and loser are required' }, { status: 400 });
  }
  if (winnerTypeId === loserTypeId) {
    return NextResponse.json({ error: 'Choose two different awards to merge' }, { status: 400 });
  }

  try {
    const preview = await previewMergeRepTeamAwardTypes(winnerTypeId, loserTypeId, teamId);
    return NextResponse.json(preview);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not preview merge' },
      { status: 400 },
    );
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/award-types/merge' });

export const POST = withObservability(async (req: Request, { params }: TeamParams) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const denied = denyUnless(canManageAwards(resolved.assignment.capabilities), 'You do not have access to awards.');
  if (denied) return denied;

  // Field names match every other tag library's merge body (`winnerTagId`/`loserTagId`) —
  // TagManagerList.doMerge posts the same shape to every basePath/merge route it's given,
  // awards included, since the behaviour must never fork between libraries.
  const body = await req.json().catch(() => ({}));
  const winnerTypeId = typeof body.winnerTagId === 'string' ? body.winnerTagId : '';
  const loserTypeId = typeof body.loserTagId === 'string' ? body.loserTagId : '';
  if (!winnerTypeId || !loserTypeId) {
    return NextResponse.json({ error: 'winnerTagId and loserTagId are required' }, { status: 400 });
  }
  if (winnerTypeId === loserTypeId) {
    return NextResponse.json({ error: 'Choose two different awards to merge' }, { status: 400 });
  }

  try {
    const { moved, dropped } = await mergeRepTeamAwardTypes(winnerTypeId, loserTypeId, teamId);
    return NextResponse.json({ ok: true, moved, dropped });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Merge failed' },
      { status: 400 },
    );
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/award-types/merge' });
