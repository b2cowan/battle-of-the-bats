import 'server-only';
import { NextResponse } from 'next/server';
import { getAuthContextWithScope, unauthorized, forbidden } from '@/lib/api-auth';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import { resolveCoachUserIdentities } from '@/lib/db';
import { canClosePlace } from '@/lib/place-closure-window';

/**
 * CLOSE A PLACE'S ONE DOOR CHECK, shared by its routes (the press and its reads; Reopen): K1 and K14, on the server.
 * ⚖ K14: the places gate (League Plus, Club, Club · Association). Where it fails the routes answer 404, never an upgrade
 *   sentence: the doors are absent there.
 * ⚖ K1: owner, admin, house league admin (`canClosePlace`). Anyone else is refused.
 */
export async function placeClosureGate(req: Request) {
  const ctx = await getAuthContextWithScope({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  if (!ctx) return { refused: unauthorized() } as const;
  if (!hasOrgVenueLibrary(ctx.org.planId)) return { refused: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;
  if (!canClosePlace(ctx.role)) return { refused: forbidden() } as const;
  return { ctx } as const;
}

type Ctx = NonNullable<Awaited<ReturnType<typeof getAuthContextWithScope>>>;

/** The person pressing, as the coach emails name them (the sender line and the reply-to). */
export async function closureActor(ctx: Ctx) {
  const me = (await resolveCoachUserIdentities(ctx.org.id, [ctx.user.id])).get(ctx.user.id);
  return { id: ctx.user.id, email: ctx.user.email ?? null, role: ctx.role, name: me?.displayName ?? null };
}
