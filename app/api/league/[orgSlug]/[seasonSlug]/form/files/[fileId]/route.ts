import { NextResponse } from 'next/server';
import { getLeagueSeasonBySlug } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { withObservability } from '@/lib/observability';
import { throttleSignupFiles } from '@/lib/public-form-throttle';
import { removeWaitingFile } from '@/lib/club-form-family';
import { previewWriteRefusal } from '@/lib/preview-write-refusal';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/league/[orgSlug]/[seasonSlug]/form/files/[fileId] — Remove (and Cancel after the file arrived) deletes a
 * family's WAITING file at once, stored file and row (ruling 9). Only a file still waiting for its sign-up: one attached
 * to a registration is changed through Your sign-up, never from here. Answers the same whether or not there was one, so
 * the door says nothing about anyone else's files.
 */
export const DELETE = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; seasonSlug: string; fileId: string }> },) => {
  const { orgSlug, seasonSlug, fileId } = await params;
  const throttled = throttleSignupFiles(req);
  if (throttled) return throttled;
  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const previewClosed = previewWriteRefusal(org); if (previewClosed) return previewClosed;
  const season = await getLeagueSeasonBySlug(org.id, seasonSlug);
  if (!season) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    await removeWaitingFile(season.id, fileId);
  } catch (e) {
    console.error('[club-form-files] removing a family file failed:', (e as { code?: string })?.code ?? 'no code');
    return NextResponse.json({ error: 'It didn’t remove. Try again.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}, { route: '/api/league/[orgSlug]/[seasonSlug]/form/files/[fileId]' });
