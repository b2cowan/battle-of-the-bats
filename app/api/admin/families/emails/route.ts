import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { readEmailLog } from '@/lib/families-emails-log';
import { withObservability } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * Families' Emails tab (Club Tier Stage 7c, Ask 7 A — lib/families-emails-log.ts): a page of every email the club sent
 * from Families, newest first. `?before=<iso>` reads the next page. Gated as every Families route.
 */
export const GET = withObservability(async (req: Request) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const before = new URL(req.url).searchParams.get('before');
  const valid = before && !Number.isNaN(Date.parse(before)) ? before : null;
  return NextResponse.json(await readEmailLog(gate.ctx.org.id, valid));
}, { route: '/api/admin/families/emails' });
