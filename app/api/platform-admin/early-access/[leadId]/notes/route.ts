import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { addNote } from '@/lib/lead-writes';

/** Add a dated, signed note to a lead (Support console Stage 7 Part 4). It cannot be edited afterwards. */
export const POST = withObservability(async (req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) => {
  const auth = await requirePlatformPower('growth');
  if (auth.response) return auth.response;
  const { leadId } = await params;
  const body = await req.json().catch(() => null) as { body?: unknown } | null;
  if (!isUuid(leadId) || !body || typeof body.body !== 'string') return NextResponse.json({ error: 'Write the note first.' }, { status: 400 });
  const r = await addNote(auth.user.email!, leadId, body.body);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}, { route: '/api/platform-admin/early-access/[leadId]/notes' });
