import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { withObservability } from '@/lib/observability';
import { recordAcceptance } from '@/lib/legal-acceptance';
import { ACCEPTANCE_WORDS, ACCEPT_ROUTE_DOORS, termsDoorFrom } from '@/lib/legal-acceptance-rules';
import { currentVersion } from '@/lib/legal-documents';

/**
 * The sign-in screen's tick (GST/HST Stage 6 step 6.3, Chunk B, ruling R3) and the purchase window's (Chunk C, door
 * `purchase_window`). Body `{ termsVersion, door? }`: the version shown, and which of the two asked (anything else is the screen).
 *
 * Signed-in only. `requireAcceptance` is deliberately NOT asked: this is the door that satisfies it. Answers:
 *   200 `{ ok }`                     — recorded (row first, then the mirror); the screen re-reads and the shell takes over.
 *   409 `{ code: 'terms_changed' }`  — the version moved while the screen was open (§20 (2)); carries the version now current.
 *   500 `{ code: 'save_failed' }`    — the screen shows (5a) and keeps the box ticked.
 *   401 — nobody is signed in. 404 — the legal pages are off (production until 6.7): nothing is recorded.
 */
export const POST = withObservability(async (req: Request) => {
  if (currentVersion('terms') === null) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { termsVersion?: unknown; door?: unknown };
  const door = termsDoorFrom(body.door, ACCEPT_ROUTE_DOORS, 'sign_in_screen');
  const result = await recordAcceptance({ user, door, shownTermsVersion: body.termsVersion });
  if (result.ok) return NextResponse.json({ ok: true });
  if (result.code === 'terms_changed') {
    return NextResponse.json(
      { error: ACCEPTANCE_WORDS.refuseChangedWindow, code: 'terms_changed', termsVersion: currentVersion('terms') },
      { status: 409 },
    );
  }
  return NextResponse.json({ error: 'save_failed', code: 'save_failed' }, { status: 500 });
}, { route: '/api/legal/accept' });
