import { NextResponse } from 'next/server';
import { publicSiteEditor } from '@/lib/public-site-access';
import { clubDomainDeps } from '@/lib/club-domain-deps';
import { clubDomainStore } from '@/lib/club-domain-store';
import { connectClubDomain, stopClubDomain, toDomainView } from '@/lib/club-domain-service';
import { OWN_ADDRESS_REFUSALS, OWN_ADDRESS_REFUSAL_STATUS, OWN_ADDRESS_ROUTE_WORDS as W } from '@/lib/own-address-words';
import { withObservability } from '@/lib/observability';

/**
 * /api/admin/public-site/own-address: A CLUB'S OWN WEB ADDRESS (Club Tier Stage 4e, Part 2; owner rulings 2026-10-23).
 *
 * ⚖ The owner connects and removes; an admin READS every state (ruling 2). Both verbs need the Public site editor
 * (the public-site capability on a plan that carries the module). The words are `lib/own-address-words.ts`.
 */

/** GET: the connection as the screen shows it (or null), and whether this person may change it. */
export const GET = withObservability(async (req: Request) => {
  const r = await publicSiteEditor(req, { write: false });
  if (r.error) return r.error;
  const row = await clubDomainStore.getByOrg(r.ctx.org.id);
  return NextResponse.json({ connection: row ? toDomainView(row) : null, canEdit: r.ctx.role === 'owner' });
}, { route: '/api/admin/public-site/own-address' });

/** POST `{ address, mode? }`: the owner connects an address. Answers with the connection and its two records. */
export const POST = withObservability(async (req: Request) => {
  const r = await publicSiteEditor(req, { write: true });
  if (r.error) return r.error;
  if (r.ctx.role !== 'owner') return NextResponse.json({ error: W.ownerOnly }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { address?: unknown; mode?: unknown } | null;
  if (typeof body?.address !== 'string' || !body.address.trim()) {
    return NextResponse.json({ error: W.badRequest }, { status: 400 });
  }
  const mode = body.mode === 'other' ? 'other' : 'www';

  const result = await connectClubDomain(clubDomainDeps(), {
    orgId: r.ctx.org.id,
    userId: r.ctx.user.id,
    raw: body.address,
    mode,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: OWN_ADDRESS_REFUSALS[result.reason], reason: result.reason },
      { status: OWN_ADDRESS_REFUSAL_STATUS[result.reason] },
    );
  }
  return NextResponse.json({ connection: toDomainView(result.row), canEdit: true });
}, { route: '/api/admin/public-site/own-address' });

/** DELETE: the owner stops using the address, or cancels a connection still waiting. Everything reverts at once. */
export const DELETE = withObservability(async (req: Request) => {
  const r = await publicSiteEditor(req, { write: true });
  if (r.error) return r.error;
  if (r.ctx.role !== 'owner') return NextResponse.json({ error: W.ownerOnly }, { status: 403 });

  const result = await stopClubDomain(clubDomainDeps(), r.ctx.org.id);
  if (!result.ok) {
    return result.reason === 'none'
      ? NextResponse.json({ error: W.none }, { status: 404 })
      : NextResponse.json({ error: W.stopFailed }, { status: 502 });
  }
  return NextResponse.json({ connection: null, canEdit: true });
}, { route: '/api/admin/public-site/own-address' });
