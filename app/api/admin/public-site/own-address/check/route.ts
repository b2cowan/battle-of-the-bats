import { NextResponse } from 'next/server';
import { publicSiteEditor } from '@/lib/public-site-access';
import { clubDomainDeps } from '@/lib/club-domain-deps';
import { checkClubDomainNow, toDomainView } from '@/lib/club-domain-service';
import { OWN_ADDRESS_ROUTE_WORDS as W } from '@/lib/own-address-words';
import { withObservability } from '@/lib/observability';

/**
 * POST /api/admin/public-site/own-address/check: "Check now". Our own lookup of the two records, written to the
 * connection and returned. ⚖ An admin may press it (ruling 2: admins read every state and can check). It never says the
 * site is live: only the host knows that, and the status job asks it.
 */
export const POST = withObservability(async (req: Request) => {
  const r = await publicSiteEditor(req, { write: false });
  if (r.error) return r.error;

  const result = await checkClubDomainNow(clubDomainDeps(), r.ctx.org.id);
  if (!result.ok) {
    return result.reason === 'none'
      ? NextResponse.json({ error: W.none }, { status: 404 })
      : NextResponse.json({ error: W.lookupFailed }, { status: 502 });
  }
  return NextResponse.json({
    connection: toDomainView(result.row),
    record1: result.record1,
    record2: result.record2,
    canEdit: r.ctx.role === 'owner',
  });
}, { route: '/api/admin/public-site/own-address/check' });
