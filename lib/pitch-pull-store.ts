/**
 * THE SAVED PULL — how a walkthrough page (and the studio) reads pitch_page_pulls.
 *
 * Plan: docs/projects/active/PITCH_DECK_STUDIO_PLAN.md (stage B). The two public pulls are
 * owner-editable rows; the code's `fallbackPull` renders whenever no row is USABLE. That word is
 * doing the work: "usable" is decided by `resolvePullIds` (lib/walkthrough-content.ts), which is
 * lenient on purpose — a row that was valid when saved can rot (a slide retires), and a
 * marketing page must render through it rather than go blank.
 *
 * ⚠⚠ EVERY FAILURE HERE IS THE FALLBACK, NEVER AN ERROR PAGE. A missing row, a malformed row, an
 * unreachable store and a SLOW store all resolve to the code pull — the timeout below exists
 * because a marketing page hanging on a database is a worse failure than one rendering
 * yesterday's composition. Reads go through the service-role client because the table is
 * RLS-locked with no policies (service-role only, mig 257) and this render is server-side.
 */
import { cache } from 'react';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { WalkthroughPersona } from '@/lib/walkthrough-content';

export interface StoredPullRow {
  /** `unknown` on purpose: the reader trusts nothing a row says (resolvePullIds decides). */
  slideIds: unknown;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** What one read yields — the row, or which kind of nothing. The studio report takes this shape. */
export interface StoredPullRead {
  row: StoredPullRow | null;
  /** True when the store itself could not be read — not the same thing as "no row saved". */
  error: boolean;
}

/**
 * The saved row, or `null` for "no usable row" — which deliberately does not distinguish
 * no-row-saved from store-unreachable: both render the fallback. The studio, which DOES need to
 * tell an outage from an empty table, gets `error` back for exactly that sentence.
 */
export const readStoredPull = cache(
  async (persona: WalkthroughPersona): Promise<StoredPullRead> => {
    try {
      const { data, error } = await supabaseAdmin
        .from('pitch_page_pulls')
        .select('slide_ids, updated_at, updated_by')
        .eq('persona', persona)
        // A marketing render must not wait on a struggling store — past this, the code pull wins.
        .abortSignal(AbortSignal.timeout(1500))
        .maybeSingle();
      if (error) return { row: null, error: true };
      if (!data) return { row: null, error: false };
      return {
        row: { slideIds: data.slide_ids, updatedAt: data.updated_at, updatedBy: data.updated_by },
        error: false,
      };
    } catch {
      return { row: null, error: true };
    }
  },
);

// ⚠ `getWalkthroughPull` moved to lib/pitch-deck-store.ts as `getWalkthroughRender` (stage C):
// the pull normalises against the LIVE deck now, so resolving one without the other stopped
// being a meaningful operation. This module keeps the raw pull read only.
