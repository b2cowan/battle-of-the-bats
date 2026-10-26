import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { readEmailLog, type EmailLogFilter } from '@/lib/families-emails-log';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Families' Emails tab (Club Tier Stage 7c, Ask 7 A — lib/families-emails-log.ts): a page of every email the club sent
 * from Families, newest first, a house-league season's named with its season (9d1·7). `?before=<iso>` reads the next page;
 * `?season=all|club|<season id>` is the Season filter. Gated as every Families route.
 */
export const GET = withObservability(async (req: Request) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const params = new URL(req.url).searchParams;
  const before = params.get('before');
  const valid = before && !Number.isNaN(Date.parse(before)) ? before : null;
  const season = params.get('season');
  // A season id from the query narrows the club's own rows (`org_id` is always this org): a foreign id finds nothing.
  const filter: EmailLogFilter = season === 'club' ? 'club' : season && isUuid(season) ? { seasonId: season } : 'all';
  return NextResponse.json(await readEmailLog(gate.ctx.org.id, valid, filter));
}, { route: '/api/admin/families/emails' });
