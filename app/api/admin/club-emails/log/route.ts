import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { requireCommunications } from '@/lib/club-communications-auth';
import { readCommunications, type CommsFilter } from '@/lib/club-communications-log';

/**
 * Communications' one list (Club Communications Stage 1, Session 2): the family emails and the coach and board emails this
 * reader may read, newest first. A row they may not read is ABSENT (legal §2c); a wider family row carries no names (its
 * record is read on its own, below `family/[sendId]`).
 *   GET ?orgSlug&before=<sentAt>&filter=all|families|coaches|board|season:<id>
 */
export const dynamic = 'force-dynamic';

function filterOf(v: string | null): CommsFilter {
  if (v === 'families' || v === 'coaches' || v === 'board') return v;
  if (v?.startsWith('season:') && isUuid(v.slice(7))) return { seasonId: v.slice(7) };
  return 'all';
}

export const GET = withObservability(async (req: Request) => {
  const gate = await requireCommunications(req);
  if ('failure' in gate) return gate.failure;
  const params = new URL(req.url).searchParams;
  const before = params.get('before');
  // The cursor is a time this list handed out (a timestamptz as PostgREST writes it); anything else starts from the top.
  const at = before && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(before) ? before : null;
  return NextResponse.json(await readCommunications(gate, at, filterOf(params.get('filter'))));
}, { route: '/api/admin/club-emails/log' });
