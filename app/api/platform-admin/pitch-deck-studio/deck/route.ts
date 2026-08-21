/**
 * THE DECK SAVE PATH — the only writer of pitch_decks (Pitch Deck Studio stages C + D).
 *
 * ⚠⚠ THIS ROUTE SAVES COMPOSITION AND NOTHING ELSE — a running order of slide NUMBERS plus the
 * deck's own NAME and PURPOSE (internal text; the public prospect rendering prints neither).
 * No slide sentence, caption or picture ever passes through here (owner ruling 1 — decks are
 * data, slides are code). `deckProblems` (lib/walkthrough-content.ts) is the single rulebook,
 * shared with the guard test; a refusal returns its sentences so the studio shows the owner
 * exactly why.
 *
 * Three writers, one file:
 *   PUT  {persona, slideIds}            — save a STANDING deck's running order (code fallback
 *                                         remains behind it; DELETE ?persona= forgets the row).
 *   POST {name, purpose, slideIds}      — create an owner deck (club, prospect). Mints the
 *                                         unlisted share slug at birth (stage D) — every owner
 *                                         deck is shareable, none is guessable.
 *   PUT  {id, name, purpose, slideIds}  — update an owner deck.
 *   DELETE ?id=                         — delete an owner deck. ⚠ This kills its unlisted link
 *                                         — that is the revoke, not a side effect to soften.
 *
 * Two admins editing at once stays last-write-wins (matches every platform-admin tool); the
 * audit log keeps before/after.
 */
import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAreaApi } from '@/lib/platform-auth';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import {
  AUDIENCE_LABEL,
  asWalkthroughPersona as asPersona,
  deckProblems,
} from '@/lib/walkthrough-content';

function asSlideIds(value: unknown): string[] | null {
  return Array.isArray(value) && value.every(id => typeof id === 'string')
    ? (value as string[])
    : null;
}

/** Internal text, bounded so a paste accident cannot become a kilobyte of row. */
function asText(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length <= max ? value.trim() : null;
}

/**
 * ⚠ THE ONE ADDRESSING RULE, in one place: an OWNER deck is addressed by id, a STANDING deck by
 * persona, never across. Both id-shaped writers (PUT and DELETE) load through this, so the
 * guard that keeps an id from reaching a persona row cannot drift into two versions.
 */
async function loadOwnerDeckRow(id: string): Promise<
  | { row: { name: string; purpose: string; slide_ids: unknown; share_slug: string | null }; response: null }
  | { row: null; response: NextResponse }
> {
  const { data, error } = await supabaseAdmin
    .from('pitch_decks')
    .select('name, purpose, slide_ids, persona, share_slug')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[platform-admin] pitch deck read error:', error);
    return { row: null, response: NextResponse.json({ error: 'Unable to read the deck' }, { status: 500 }) };
  }
  if (!data || data.persona !== null) {
    // A standing deck is addressed by persona, never by id — refusing here keeps the two write
    // shapes from blurring into one another.
    return { row: null, response: NextResponse.json({ error: 'No owner-created deck has that id' }, { status: 404 }) };
  }
  return { row: data, response: null };
}

export const PUT = withObservability(async (req: NextRequest) => {
  const auth = await requirePlatformAreaApi('pitch_deck_studio', 'write');
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null) as
    | { persona?: unknown; id?: unknown; name?: unknown; purpose?: unknown; slideIds?: unknown }
    | null;
  const slideIds = asSlideIds(body?.slideIds);
  if (!slideIds) {
    return NextResponse.json({ error: 'slideIds must be a list of library numbers' }, { status: 400 });
  }

  const persona = asPersona(body?.persona);
  if (persona) {
    // A standing deck: the row stores the running order; its name is the code's label, written
    // from AUDIENCE_LABEL rather than typed, so the two can never disagree.
    const name = AUDIENCE_LABEL[persona];
    const problems = deckProblems(slideIds, { name, purpose: '' });
    if (problems.length > 0) {
      return NextResponse.json({ error: 'This deck cannot be published', problems }, { status: 422 });
    }
    const { data: before, error: beforeError } = await supabaseAdmin
      .from('pitch_decks')
      .select('slide_ids')
      .eq('persona', persona)
      .maybeSingle();
    if (beforeError) {
      console.error('[platform-admin] pitch deck read error:', beforeError);
      return NextResponse.json({ error: 'Unable to read the saved deck' }, { status: 500 });
    }
    const { error } = await supabaseAdmin
      .from('pitch_decks')
      .upsert(
        {
          persona,
          name,
          purpose: '',
          slide_ids: slideIds,
          updated_at: new Date().toISOString(),
          updated_by: auth.user.email ?? null,
        },
        { onConflict: 'persona' },
      );
    if (error) {
      console.error('[platform-admin] pitch deck save error:', error);
      return NextResponse.json({ error: 'Unable to save the deck' }, { status: 500 });
    }
    await writePlatformAuditLog(
      auth.user.email!,
      null,
      'save_pitch_deck',
      persona,
      { slide_ids: before?.slide_ids ?? null },
      { slide_ids: slideIds },
    );
    return NextResponse.json({ ok: true });
  }

  // An owner-created deck, by id.
  const id = typeof body?.id === 'string' ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: 'Name a persona or a deck id' }, { status: 400 });
  }
  const name = asText(body?.name, 120);
  const purpose = asText(body?.purpose, 500) ?? '';
  if (!name) {
    return NextResponse.json({ error: 'The deck needs a name (120 characters at most)' }, { status: 400 });
  }
  const problems = deckProblems(slideIds, { name, purpose });
  if (problems.length > 0) {
    return NextResponse.json({ error: 'This deck cannot be saved', problems }, { status: 422 });
  }
  const loaded = await loadOwnerDeckRow(id);
  if (loaded.response) return loaded.response;
  const before = loaded.row;
  // `.select('id')` re-asserts the row still exists at write time — without it, a deck deleted
  // between the read above and this update matches zero rows, Supabase reports no error, and
  // the composer would show "Saved" for a write that persisted nothing (check-then-act; the
  // same discipline the money writers carry).
  const { data: updated, error } = await supabaseAdmin
    .from('pitch_decks')
    .update({
      name,
      purpose,
      slide_ids: slideIds,
      updated_at: new Date().toISOString(),
      updated_by: auth.user.email ?? null,
    })
    .eq('id', id)
    .select('id');
  if (error) {
    console.error('[platform-admin] pitch deck save error:', error);
    return NextResponse.json({ error: 'Unable to save the deck' }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: 'This deck was deleted while you were editing — nothing was saved' },
      { status: 404 },
    );
  }
  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'update_pitch_deck',
    id,
    { name: before.name, purpose: before.purpose, slide_ids: before.slide_ids },
    { name, purpose, slide_ids: slideIds },
  );
  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/pitch-deck-studio/deck' });

export const POST = withObservability(async (req: NextRequest) => {
  const auth = await requirePlatformAreaApi('pitch_deck_studio', 'write');
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => null) as
    | { name?: unknown; purpose?: unknown; slideIds?: unknown }
    | null;
  const slideIds = asSlideIds(body?.slideIds);
  const name = asText(body?.name, 120);
  const purpose = asText(body?.purpose, 500) ?? '';
  if (!slideIds) {
    return NextResponse.json({ error: 'slideIds must be a list of library numbers' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: 'The deck needs a name (120 characters at most)' }, { status: 400 });
  }
  const problems = deckProblems(slideIds, { name, purpose });
  if (problems.length > 0) {
    return NextResponse.json({ error: 'This deck cannot be created', problems }, { status: 422 });
  }

  // The unlisted link, minted at birth (stage D). 18 random bytes → 24 base64url characters:
  // unguessable, and the slug is the whole gate, so it never comes from user input.
  const shareSlug = randomBytes(18).toString('base64url');
  const { data, error } = await supabaseAdmin
    .from('pitch_decks')
    .insert({
      persona: null,
      name,
      purpose,
      slide_ids: slideIds,
      share_slug: shareSlug,
      updated_by: auth.user.email ?? null,
    })
    .select('id')
    .single();
  if (error || !data) {
    console.error('[platform-admin] pitch deck create error:', error);
    return NextResponse.json({ error: 'Unable to create the deck' }, { status: 500 });
  }
  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'create_pitch_deck',
    data.id,
    null,
    // The minted slug is recorded too — stage D's whole point is the unlisted link, and the
    // audit trail must be able to say which link a deck was born with.
    { name, purpose, slide_ids: slideIds, share_slug: shareSlug },
  );
  return NextResponse.json({ ok: true, id: data.id, shareSlug });
}, { route: '/api/platform-admin/pitch-deck-studio/deck' });

export const DELETE = withObservability(async (req: NextRequest) => {
  const auth = await requirePlatformAreaApi('pitch_deck_studio', 'write');
  if (auth.response) return auth.response;

  const url = new URL(req.url);
  const persona = asPersona(url.searchParams.get('persona'));
  if (persona) {
    // "Return to the code default" for a standing deck — forgets the row entirely, so future
    // code changes to PITCH_DECKS reach the page again (the pull DELETE's exact contract).
    const { data: before, error: beforeError } = await supabaseAdmin
      .from('pitch_decks')
      .select('slide_ids')
      .eq('persona', persona)
      .maybeSingle();
    if (beforeError) {
      console.error('[platform-admin] pitch deck read error:', beforeError);
      return NextResponse.json({ error: 'Unable to read the saved deck' }, { status: 500 });
    }
    if (!before) {
      return NextResponse.json({ ok: true, alreadyDefault: true });
    }
    const { error } = await supabaseAdmin.from('pitch_decks').delete().eq('persona', persona);
    if (error) {
      console.error('[platform-admin] pitch deck delete error:', error);
      return NextResponse.json({ error: 'Unable to remove the saved deck' }, { status: 500 });
    }
    await writePlatformAuditLog(
      auth.user.email!,
      null,
      'clear_pitch_deck',
      persona,
      { slide_ids: before.slide_ids },
      { slide_ids: null },
    );
    return NextResponse.json({ ok: true });
  }

  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Name a persona or a deck id' }, { status: 400 });
  }
  const loaded = await loadOwnerDeckRow(id);
  if (loaded.response) return loaded.response;
  const before = loaded.row;
  const { error } = await supabaseAdmin.from('pitch_decks').delete().eq('id', id);
  if (error) {
    console.error('[platform-admin] pitch deck delete error:', error);
    return NextResponse.json({ error: 'Unable to delete the deck' }, { status: 500 });
  }
  await writePlatformAuditLog(
    auth.user.email!,
    null,
    'delete_pitch_deck',
    id,
    { name: before.name, purpose: before.purpose, slide_ids: before.slide_ids, share_slug: before.share_slug },
    null,
  );
  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/pitch-deck-studio/deck' });
