/**
 * THE SAVE PATH — the only writer of pitch_page_pulls (Pitch Deck Studio stage B).
 *
 * ⚠⚠ THIS ROUTE SAVES COMPOSITION AND NOTHING ELSE. The body is a persona and a list of slide
 * NUMBERS; no sentence, caption or picture ever passes through here (owner ruling 1 — decks are
 * data, slides are code). Every invariant the build enforces on a pull runs HERE, before the
 * row exists: `pullProblems` (lib/walkthrough-content.ts) is the single rulebook shared with
 * the guard test, and a refusal returns the sentences it produced so the studio can show the
 * owner exactly why (finding F3 — the tool refuses and says why; it does not save and hope).
 *
 * DELETE is "return to the code default": it forgets the saved row entirely, which is a
 * different thing from saving a row that matches the fallback — a deleted row means future code
 * changes to `fallbackPull` show up on the page again.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAreaApi } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { asWalkthroughPersona as asPersona, pullProblems, resolveDeckIds } from '@/lib/walkthrough-content';
import { readStoredDeck } from '@/lib/pitch-deck-store';

export const PUT = withObservability(async (req: NextRequest) => {
  const auth = await requirePlatformAreaApi('pitch_deck_studio', 'write');
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null) as { persona?: unknown; slideIds?: unknown } | null;
  const persona = asPersona(body?.persona);
  if (!persona) {
    return NextResponse.json({ error: 'Unknown persona' }, { status: 400 });
  }
  const slideIds = Array.isArray(body?.slideIds) && body.slideIds.every(id => typeof id === 'string')
    ? (body.slideIds as string[])
    : null;
  if (!slideIds) {
    return NextResponse.json({ error: 'slideIds must be a list of library numbers' }, { status: 400 });
  }

  // The whole rulebook, before anything is written. 422 rather than 400: the request is
  // well-formed — the COMPOSITION is refused, and `problems` is the human-readable why.
  // ⚠ Validated against the LIVE deck (stage C): "its deck" is the owner's saved running order
  // where one exists, so a pull is judged by the same deck the page will render it against.
  const deckRead = await readStoredDeck(persona);
  const { ids: deckIds } = resolveDeckIds(persona, deckRead.row?.slideIds ?? null);
  const problems = pullProblems(persona, slideIds, deckIds);
  if (problems.length > 0) {
    return NextResponse.json({ error: 'This pull cannot be published', problems }, { status: 422 });
  }

  const { data: before, error: beforeError } = await supabaseAdmin
    .from('pitch_page_pulls')
    .select('slide_ids')
    .eq('persona', persona)
    .maybeSingle();
  if (beforeError) {
    console.error('[platform-admin] pitch pull read error:', beforeError);
    return NextResponse.json({ error: 'Unable to read the saved pull' }, { status: 500 });
  }

  const { error } = await supabaseAdmin
    .from('pitch_page_pulls')
    .upsert({
      persona,
      slide_ids: slideIds,
      updated_at: new Date().toISOString(),
      updated_by: auth.user.email ?? null,
    });
  if (error) {
    console.error('[platform-admin] pitch pull save error:', error);
    return NextResponse.json({ error: 'Unable to save the pull' }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'save_pitch_page_pull',
    persona,
    { slide_ids: before?.slide_ids ?? null },
    { slide_ids: slideIds },
  );

  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/pitch-deck-studio/pull' });

export const DELETE = withObservability(async (req: NextRequest) => {
  const auth = await requirePlatformAreaApi('pitch_deck_studio', 'write');
  if (auth.response) return auth.response;

  const persona = asPersona(new URL(req.url).searchParams.get('persona'));
  if (!persona) {
    return NextResponse.json({ error: 'Unknown persona' }, { status: 400 });
  }

  const { data: before, error: beforeError } = await supabaseAdmin
    .from('pitch_page_pulls')
    .select('slide_ids')
    .eq('persona', persona)
    .maybeSingle();
  if (beforeError) {
    console.error('[platform-admin] pitch pull read error:', beforeError);
    return NextResponse.json({ error: 'Unable to read the saved pull' }, { status: 500 });
  }
  if (!before) {
    // Nothing saved — the page is already on the code default. Not an error worth a red banner.
    return NextResponse.json({ ok: true, alreadyDefault: true });
  }

  const { error } = await supabaseAdmin
    .from('pitch_page_pulls')
    .delete()
    .eq('persona', persona);
  if (error) {
    console.error('[platform-admin] pitch pull delete error:', error);
    return NextResponse.json({ error: 'Unable to remove the saved pull' }, { status: 500 });
  }

  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'clear_pitch_page_pull',
    persona,
    { slide_ids: before.slide_ids },
    { slide_ids: null },
  );

  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/pitch-deck-studio/pull' });
