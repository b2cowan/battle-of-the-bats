import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { createPackage } from '@/lib/club-sponsorships-server';
import { parsePackageInput } from '@/lib/club-sponsorships';

/**
 * ADD A PACKAGE (Board Ready Stage 6, Part 1; round 1 tab 2, asks 6 and 7). A create window, so it asks before it saves.
 * Anyone who opens Sponsorships (round 2 tab 3). Its PDF is added afterwards (`[packageId]/document`).
 */
export const dynamic = 'force-dynamic';

export const POST = withObservability(async (req: Request) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const parsed = parsePackageInput(body ?? {});
  if (!parsed.ok) return refused(parsed.error);
  const id = await createPackage(gate.ctx.org.id, gate.ctx.user.id, parsed.value);
  return NextResponse.json({ id }, { status: 201 });
}, { route: '/api/admin/sponsorships/packages' });
