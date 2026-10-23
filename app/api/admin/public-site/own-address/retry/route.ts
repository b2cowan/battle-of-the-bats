import { NextResponse } from 'next/server';
import { publicSiteEditor } from '@/lib/public-site-access';
import { clubDomainDeps } from '@/lib/club-domain-deps';
import { retryClubDomain, toDomainView } from '@/lib/club-domain-service';
import { OWN_ADDRESS_ROUTE_WORDS as W } from '@/lib/own-address-words';
import { withObservability } from '@/lib/observability';

/**
 * POST /api/admin/public-site/own-address/retry: "Try again" after checking gave up (frame g1). Owner only. Starts the same
 * connection over with the same two records.
 */
export const POST = withObservability(async (req: Request) => {
  const r = await publicSiteEditor(req, { write: true });
  if (r.error) return r.error;
  if (r.ctx.role !== 'owner') return NextResponse.json({ error: W.ownerOnly }, { status: 403 });

  const result = await retryClubDomain(clubDomainDeps(), r.ctx.org.id);
  if (!result.ok) {
    if (result.reason === 'none') return NextResponse.json({ error: W.none }, { status: 404 });
    if (result.reason === 'not_retryable') return NextResponse.json({ error: W.notRetryable }, { status: 409 });
    return NextResponse.json({ error: W.retryFailed }, { status: 502 });
  }
  return NextResponse.json({ connection: toDomainView(result.row), canEdit: true });
}, { route: '/api/admin/public-site/own-address/retry' });
