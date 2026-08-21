/**
 * THE SAVED DECK — how the walkthrough pages, the prospect route and the studio read
 * pitch_decks (Pitch Deck Studio stages C + D).
 *
 * `lib/pitch-pull-store.ts`'s sibling, same posture: every read is service-role (the table is
 * RLS-locked with no policies, mig 258), every failure resolves leniently, and A STANDING
 * DECK'S FAILURE IS THE CODE FALLBACK, NEVER AN ERROR PAGE — `PITCH_DECKS` renders whenever no
 * row is usable, so a missing, malformed, slow or rotten row can never blank or crash a
 * marketing page. Owner-created decks (persona NULL) have no fallback by design: broken means
 * "does not render" (the prospect route 404s), and only the studio says why.
 */
import { cache } from 'react';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  WALKTHROUGHS,
  resolveDeckIds,
  resolvePullIds,
  type SlideId,
  type Walkthrough,
  type WalkthroughPersona,
} from '@/lib/walkthrough-content';
import { readStoredPull } from '@/lib/pitch-pull-store';

export interface StoredDeckRow {
  id: string;
  persona: WalkthroughPersona | null;
  name: string;
  purpose: string;
  /** `unknown` on purpose: the reader trusts nothing a row says (resolveDeckIds decides). */
  slideIds: unknown;
  /** Stage D: set on prospect/owner decks that have an unlisted link minted. */
  shareSlug: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** What one standing-deck read yields — the row, or which kind of nothing (the studio's sentence). */
export interface StoredDeckRead {
  row: StoredDeckRow | null;
  /** True when the store itself could not be read — not the same thing as "no row saved". */
  error: boolean;
}

function asRow(data: Record<string, unknown>): StoredDeckRow {
  return {
    id: String(data.id),
    persona: (data.persona as WalkthroughPersona | null) ?? null,
    name: typeof data.name === 'string' ? data.name : '',
    purpose: typeof data.purpose === 'string' ? data.purpose : '',
    slideIds: data.slide_ids,
    shareSlug: (data.share_slug as string | null) ?? null,
    createdAt: (data.created_at as string | null) ?? null,
    updatedAt: (data.updated_at as string | null) ?? null,
    updatedBy: (data.updated_by as string | null) ?? null,
  };
}

const DECK_COLUMNS = 'id, persona, name, purpose, slide_ids, share_slug, created_at, updated_at, updated_by';

/** A standing deck's saved row, or which kind of nothing — the pull-store contract, verbatim. */
export const readStoredDeck = cache(
  async (persona: WalkthroughPersona): Promise<StoredDeckRead> => {
    try {
      const { data, error } = await supabaseAdmin
        .from('pitch_decks')
        .select(DECK_COLUMNS)
        .eq('persona', persona)
        // A marketing render must not wait on a struggling store — past this, the code deck wins.
        .abortSignal(AbortSignal.timeout(1500))
        .maybeSingle();
      if (error) return { row: null, error: true };
      if (!data) return { row: null, error: false };
      return { row: asRow(data), error: false };
    } catch {
      return { row: null, error: true };
    }
  },
);

/** Every owner-created deck (persona NULL), newest first — the studio's list. */
export const readCustomDecks = cache(async (): Promise<{ rows: StoredDeckRow[]; error: boolean }> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('pitch_decks')
      .select(DECK_COLUMNS)
      .is('persona', null)
      .order('created_at', { ascending: false })
      .abortSignal(AbortSignal.timeout(1500));
    if (error) return { rows: [], error: true };
    return { rows: (data ?? []).map(asRow), error: false };
  } catch {
    return { rows: [], error: true };
  }
});

/**
 * Stage D: the deck behind an unlisted /pitch/<slug> link. Strict where the standing reads are
 * lenient — no fallback exists for an owner-created deck, so any kind of nothing is `null` and
 * the route answers 404. The slug is the whole gate (unguessable, noindex, owner ruling 2), so
 * this is a single indexed equality read.
 */
export const readDeckBySlug = cache(async (slug: string): Promise<StoredDeckRow | null> => {
  if (!slug || slug.length > 80) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from('pitch_decks')
      .select(DECK_COLUMNS)
      .eq('share_slug', slug)
      .abortSignal(AbortSignal.timeout(3000))
      .maybeSingle();
    if (error || !data) return null;
    return asRow(data);
  } catch {
    return null;
  }
});

/**
 * Everything a walkthrough route needs, resolved once — React-cached so `generateMetadata` and
 * the page body share one read and can never describe two different compositions. The deck is
 * resolved FIRST because the pull normalises against it (plan decision 1: reordering a deck
 * re-orders the page by itself).
 */
export const getWalkthroughRender = cache(
  async (
    persona: WalkthroughPersona,
  ): Promise<{ walkthrough: Walkthrough; deckIds: string[]; pull: SlideId[] }> => {
    const walkthrough = WALKTHROUGHS.find(w => w.persona === persona)!;
    const [deckRead, pullRead] = await Promise.all([readStoredDeck(persona), readStoredPull(persona)]);
    const { ids: deckIds } = resolveDeckIds(persona, deckRead.row?.slideIds ?? null);
    const { ids: pull } = resolvePullIds(persona, pullRead.row?.slideIds ?? null, deckIds);
    return { walkthrough, deckIds, pull };
  },
);
