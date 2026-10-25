import { NextResponse } from 'next/server';
import { requirePlatformAreaApi } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { buildClubStory, filterStory, STORY_KIND_LABELS, type StoryKind } from '@/lib/platform-story';

const STORY_PAGE = 50;

/**
 * A club's Story, a page at a time, newest first (Support console Stage 2, A4) — `POST`, so the Story's search words ride
 * in the body, never the address. Every role that opens the club record reads it; the record decides who sees Put it back
 * (the entry carries it, the page shows it only to a role holding that power).
 */
export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformAreaApi('organizations', 'view');
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { kind?: unknown; q?: unknown; offset?: unknown };
  const kind = typeof body.kind === 'string' && body.kind in STORY_KIND_LABELS ? (body.kind as StoryKind) : null;
  const words = typeof body.q === 'string' ? body.q.slice(0, 120) : '';
  const offset = typeof body.offset === 'number' && body.offset >= 0 ? Math.floor(body.offset) : 0;
  const all = filterStory(await buildClubStory(id), { kind, words });
  return NextResponse.json(
    { entries: all.slice(offset, offset + STORY_PAGE), total: all.length },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}, { route: '/api/platform-admin/orgs/[id]/story' });
