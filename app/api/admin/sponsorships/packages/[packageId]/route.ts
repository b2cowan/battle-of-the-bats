import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { readPackage, setPackageArchived, updatePackage } from '@/lib/club-sponsorships-server';
import { parsePackageInput } from '@/lib/club-sponsorships';
import { SPONSORSHIPS_WORDS as W } from '@/lib/club-sponsorships-words';

/**
 * ONE PACKAGE (Board Ready Stage 6, Part 1; round 1 tab 2). PATCH saves the record window's change (the fields sent are
 * merged over the stored package and checked whole), or `{ action: 'archive' | 'unarchive' }`. There is no delete: a
 * package is archived, and deals keep the package as it was when they were offered (Part 2 snapshots it).
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ packageId: string }> };
const notFound = () => NextResponse.json({ error: W.say.notFound, code: 'not_found' }, { status: 404 });

export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { packageId } = await params;
  if (!isUuid(packageId)) return notFound();
  const orgId = gate.ctx.org.id;
  const current = await readPackage(orgId, packageId);
  if (!current) return notFound();
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return refused(W.say.failed);
  if (body.action === 'archive' || body.action === 'unarchive') {
    await setPackageArchived(orgId, packageId, body.action === 'archive');
    return NextResponse.json({ ok: true });
  }
  const parsed = parsePackageInput({
    name: current.name, price: current.price, placeKind: current.placeKind, howMany: current.howMany,
    showsUntil: current.showsUntil, logoOnSite: current.logoOnSite, items: current.items, ...body,
  });
  if (!parsed.ok) return refused(parsed.error);
  await updatePackage(orgId, packageId, parsed.value);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/sponsorships/packages/[packageId]' });
