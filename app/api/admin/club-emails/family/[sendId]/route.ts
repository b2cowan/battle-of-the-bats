import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { requireCommunications } from '@/lib/club-communications-auth';
import { readCommunicationsFamily } from '@/lib/club-communications-log';
import { SAY } from '@/lib/club-group-email-words';

/**
 * One family email's record, as Communications shows it (Club Communications Stage 1, Session 2). Shaped for this reader by
 * the reader itself: a league seat's record of a club-wide email has NO named lines at all (ask 4, T12); a row they may not
 * read is Not found. Finishing a stopped one goes back down its own door (`finish`): the club's window or the season's.
 *   GET ?orgSlug
 */
export const dynamic = 'force-dynamic';

const notFound = () => NextResponse.json({ error: SAY.notFound, code: 'not_found' }, { status: 404 });

export const GET = withObservability(async (req: Request, { params }: { params: Promise<{ sendId: string }> }) => {
  const gate = await requireCommunications(req);
  if ('failure' in gate) return gate.failure;
  const { sendId } = await params;
  if (!isUuid(sendId)) return notFound();
  const record = await readCommunicationsFamily(gate, sendId);
  return record ? NextResponse.json(record) : notFound();
}, { route: '/api/admin/club-emails/family/[sendId]' });
