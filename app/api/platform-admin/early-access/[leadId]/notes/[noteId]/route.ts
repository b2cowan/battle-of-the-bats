import { NextRequest, NextResponse } from 'next/server';
import { hasPlatformPower, requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { removeNote } from '@/lib/lead-writes';

/**
 * Remove a lead's note — Super admin only, through the rulebook's `delete_records` power (Support console Stage 7 Part 4).
 * Who and when are kept; the text is gone, and the timeline reads "A note was removed". The growth power is asked
 * first, then the removal power.
 */
export const DELETE = withObservability(async (_req: NextRequest, { params }: { params: Promise<{ leadId: string; noteId: string }> }) => {
  const auth = await requirePlatformPower('growth');
  if (auth.response) return auth.response;
  if (!hasPlatformPower(auth.role, 'delete_records')) return NextResponse.json({ error: 'Only a Super admin can remove a note.' }, { status: 403 });
  const { leadId, noteId } = await params;
  if (!isUuid(leadId) || !isUuid(noteId)) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  const r = await removeNote(auth.user.email!, leadId, noteId);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}, { route: '/api/platform-admin/early-access/[leadId]/notes/[noteId]' });
