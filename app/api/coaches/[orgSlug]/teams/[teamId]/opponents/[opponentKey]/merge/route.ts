import { NextResponse } from 'next/server';
import {
  getRepTeamOpponentByKey,
  ensureRepTeamOpponent,
  executeRepTeamOpponentMerge,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { denyUnless, canWriteScoutingSummary } from '@/lib/coach-capabilities';
import { normalizeOpponentName, normalizeOpponentKeyParam, planOpponentMerge } from '@/lib/coach-opponents';

/**
 * "Same team as…" (P2, mockup Stage 6): fold one book entry into THIS one — the winner is
 * the card in the URL, the way every other opponent sub-action hangs off `[opponentKey]`.
 * (A literal `/opponents/merge` sibling would shadow the dynamic segment and make a team
 * actually NAMED "Merge" unreachable — the same class of trap as an encoded-slug bypass.)
 *
 * The loser's normalized name becomes an alias of the winner, its observations re-point,
 * and its book line survives as a labelled appendix (plan §3) — merging identities never
 * discards a coach's words. Un-merge is the alias DELETE route beside this one.
 *
 * Caps `notes` (the curation grant, same as the book line): identity is a coach decision,
 * not an open contribution. Live-season route off the working-season read — INSTRUMENT ruling;
 * never add resolveCoachTeamRead here (asserted by coach-history-endpoint-guard.test.ts).
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; opponentKey: string }> },) => {
  const { orgSlug, teamId, opponentKey } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canWriteScoutingSummary(assignment.capabilities), 'Only coaches with notes access can merge opponents.');
  if (denied) return denied;

  const winnerKey = normalizeOpponentKeyParam(opponentKey);
  if (!winnerKey) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const loserKey = normalizeOpponentName(typeof body.loserKey === 'string' ? body.loserKey : '');
  if (!loserKey) {
    return NextResponse.json({ error: 'Pick the opponent to merge in' }, { status: 400 });
  }

  // Resolve both sides alias-aware BEFORE comparing — either key may already point at a
  // minted row under another spelling, and "these are the same team" must be judged
  // against the rows, not the strings.
  const [winnerExisting, loser] = await Promise.all([
    getRepTeamOpponentByKey(teamId, winnerKey),
    getRepTeamOpponentByKey(teamId, loserKey),
  ]);
  if (loser && winnerExisting && loser.id === winnerExisting.id) {
    return NextResponse.json({ error: 'Those are already the same opponent' }, { status: 400 });
  }

  // The winner must exist as a row for aliases/observations to hang off — mint lazily,
  // exactly like a first observation does. The client sends the display spelling it shows;
  // a mint requires it to actually be this entry's name.
  let winner = winnerExisting;
  if (!winner) {
    const winnerName = typeof body.winnerName === 'string' && body.winnerName.trim().length > 0
      ? body.winnerName.trim().slice(0, 120)
      : winnerKey;
    if (normalizeOpponentName(winnerName) !== winnerKey) {
      return NextResponse.json({ error: 'Winner name does not match this opponent' }, { status: 400 });
    }
    winner = await ensureRepTeamOpponent({ teamId, orgId: ctx.org.id, displayName: winnerName });
  }

  const plan = planOpponentMerge({ winner, loser, loserKey });
  if (!plan) {
    return NextResponse.json({ error: 'Those are already the same opponent' }, { status: 400 });
  }

  await executeRepTeamOpponentMerge({
    teamId, orgId: ctx.org.id, winnerId: winner.id, updatedBy: ctx.user.id, plan,
  });
  return NextResponse.json({ ok: true, winnerKey: winner.normalizedName });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/opponents/[opponentKey]/merge' });
