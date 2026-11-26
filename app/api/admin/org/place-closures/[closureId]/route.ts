import { NextResponse } from 'next/server';
import { getAuthContextWithScope, unauthorized, forbidden } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import { resolveCoachUserIdentities } from '@/lib/db';
import { isUuid } from '@/lib/utils';
import { reopenPlaceClosure } from '@/lib/place-closures-server';
import { canClosePlace } from '@/lib/place-closure-window';
import { reopenCoachEmails, reopenTold, showingClosures } from '@/lib/place-closure-window-server';

/**
 * REOPEN A PLACE (Club Website Stage 2, K11 A; mig 539's `org_place_closure_reopen`).
 *   POST { action: 'reopen' } — the strip and the rep marks come down at once; each marked game's coach whose game still
 *   stands (not moved, not cancelled) gets one line. No game moves: the postponed house league games stay waiting, and the
 *   answer counts them for the result's "N games still need new dates".
 * ⚖ K1 and K14 as the press: owner, admin, house league admin, on the places gate (404 where it fails).
 */
export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ closureId: string }> }) => {
  const ctx = await getAuthContextWithScope({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasOrgVenueLibrary(ctx.org.planId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canClosePlace(ctx.role)) return forbidden();
  const { closureId } = await params;
  if (!isUuid(closureId)) return NextResponse.json({ error: 'Closure not found' }, { status: 404 });
  const body = await req.json().catch(() => null) as { action?: unknown } | null;
  if (body?.action !== 'reopen') return NextResponse.json({ error: 'The request was not understood' }, { status: 400 });

  // The games still waiting, read BEFORE the stamp (a reopened closure no longer shows): only postponed ones wait for a date.
  const showing = (await showingClosures(ctx.org.id)).find(c => c.id === closureId) ?? null;
  const stillWaiting = showing?.verb === 'postponed' ? showing.leagueCalledOff : 0;

  const r = await reopenPlaceClosure(ctx.org.id, closureId, ctx.user.id);
  if (r.refusal === 'not_found') return NextResponse.json({ error: 'Closure not found' }, { status: 404 });

  // Whom to tell, read AFTER the stamp (`reopenTold` says why): the marks the coach hasn't moved or cancelled and hasn't
  // been told about (by the game, so a retried Reopen still finds them) — less any game another closure still closes (D1:
  // it stays marked, and its coach is told when the last one reopens).
  const told = await reopenTold(ctx.org.id, closureId);
  const me = (await resolveCoachUserIdentities(ctx.org.id, [ctx.user.id])).get(ctx.user.id);
  const mail = await reopenCoachEmails({
    ...told, org: ctx.org, actor: { id: ctx.user.id, email: ctx.user.email ?? null, role: ctx.role, name: me?.displayName ?? null },
    closureId,
  });
  return NextResponse.json({
    reopenedAt: r.reopenedAt, already: r.already, coaches: mail.teams, stillWaiting, seasonIds: showing?.seasonIds ?? [],
  });
}, { route: '/api/admin/org/place-closures/[closureId]' });
