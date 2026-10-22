import { NextResponse } from 'next/server';
import { requireFamiliesAccess } from '@/lib/families-auth';
import { readClubEmail } from '@/lib/families-emails-log';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** One Email families send, as sent: its words and its counts — never a list of families (owner 2026-10-22). */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ sendId: string }> },) => {
  const gate = await requireFamiliesAccess(req);
  if ('failure' in gate) return gate.failure;
  const { sendId } = await params;
  if (!isUuid(sendId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const row = await readClubEmail(gate.ctx.org.id, sendId);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}, { route: '/api/admin/families/emails/[sendId]' });
