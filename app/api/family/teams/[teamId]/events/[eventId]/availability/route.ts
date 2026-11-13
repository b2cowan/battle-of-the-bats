import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { withObservability } from '@/lib/observability';
import { GUARDIAN_TIER_ENABLED } from '@/lib/family-guardian';
import { isFamilyAnswer, writeFamilyAnswer } from '@/lib/family-availability';
import { getSignedInUser } from '@/lib/two-step-session';
import { isUuid } from '@/lib/utils';

/**
 * A parent's In / Out / Maybe for their child on one event (Signed-in family accounts Stage 4b, Part 2; drawing tab 7).
 * Body `{ childId, answer: 'in' | 'out' | 'maybe' | null, note? }` — `null` clears the answer and its note.
 *
 * Every gate is the module's (`writeFamilyAnswer`), re-derived from the signed-in account on every write; the ids in the path and
 * the body only select, never authorize. 404 while the guardian tier is off, and for anything this account may not answer (no
 * reach, another team, a practice on Games only, the switch off): the same answer a stranger gets. 409 `closed` once the event
 * has started or was cancelled. Never writes the coach's attendance book.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string; eventId: string }> },) => {
  if (!GUARDIAN_TIER_ENABLED) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const { teamId, eventId } = await params;
  const supabase = await createClient();
  const user = await getSignedInUser(supabase);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const childId = typeof body?.childId === 'string' ? body.childId : '';
  const answer = body?.answer === null ? null : isFamilyAnswer(body?.answer) ? body.answer : undefined;
  if (!isUuid(childId) || answer === undefined) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  if (!isUuid(teamId) || !isUuid(eventId)) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const result = await writeFamilyAnswer({ userId: user.id, teamId, eventId, childId, answer, note: body?.note });
  if (!result.ok) {
    const status = result.code === 'closed' ? 409 : result.code === 'bad_note' ? 400 : 404;
    return NextResponse.json({ error: result.code }, { status });
  }
  return NextResponse.json({ ok: true, row: result.row });
}, { route: '/api/family/teams/[teamId]/events/[eventId]/availability' });
