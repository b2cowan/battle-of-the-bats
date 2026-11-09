import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { withObservability } from '@/lib/observability';
import { GUARDIAN_TIER_ENABLED } from '@/lib/family-guardian';
import { getFamilyReach } from '@/lib/family-access';
import { makeFamilyFeed, stopFamilyFeed } from '@/lib/family-calendar';
import { canonicalAppOrigin } from '@/lib/app-origin';

/**
 * The parent's ONE calendar address (Signed-in family accounts Stage 4a, Part 7; ruling 6): `{ action: 'make' }` (Make my link;
 * the live address, made if there is none) or `{ action: 'stop' }` (Stop this calendar; the page asked once). Signed in, with
 * a live connection; minted from the family page only. 404 while the guardian tier is off.
 */
export const POST = withObservability(async (req: Request) => {
  if (!GUARDIAN_TIER_ENABLED) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
  if (body?.action === 'stop') {
    await stopFamilyFeed(user.id);
    return NextResponse.json({ ok: true });
  }
  if (body?.action !== 'make') return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  // Only an account connected to a child has a calendar to make.
  if ((await getFamilyReach(user.id)).length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const made = await makeFamilyFeed(user.id, canonicalAppOrigin());
  if (!made.ok) return NextResponse.json({ error: made.reason }, { status: 503 });
  return NextResponse.json({ ok: true, url: made.url });
}, { route: '/api/family/calendar' });
