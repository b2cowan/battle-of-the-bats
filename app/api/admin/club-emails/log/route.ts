import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { requireCommunications } from '@/lib/club-communications-auth';
import { readCommunications } from '@/lib/club-communications-log';
import { commsFilterOf } from '@/lib/club-communications-place';

/**
 * Communications' one list (Club Communications Stage 1, Session 2): the family emails and the coach and board emails this
 * reader may read, newest first. A row they may not read is ABSENT (legal §2c); a wider family row carries no names (its
 * record is read on its own, below `family/[sendId]`).
 *   GET ?orgSlug&before=<sentAt>&who=families,coaches,board&season=<id>,<id>
 * Both lists are the Filter's ticks; either absent or empty narrows nothing. An unknown word or a malformed id is dropped.
 */
export const dynamic = 'force-dynamic';

export const GET = withObservability(async (req: Request) => {
  const gate = await requireCommunications(req);
  if ('failure' in gate) return gate.failure;
  const params = new URL(req.url).searchParams;
  const before = params.get('before');
  // The cursor is a time this list handed out (a timestamptz as PostgREST writes it); anything else starts from the top.
  const at = before && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.test(before) ? before : null;
  return NextResponse.json(await readCommunications(gate, at, commsFilterOf(params)));
}, { route: '/api/admin/club-emails/log' });
