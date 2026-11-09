/**
 * The owner-note markers that must never reach a customer page (GST/HST Stage 6 step 6.2, Chunk 1e). Shared by the draft-filter
 * test (run on both real drafts) and the frozen-version test (run on every published file). "owner" is NOT on the list — the
 * Terms say "account owner". This file is `_legal-markers.ts` so the runner's test-file glob does not run it.
 */
export const OWNER_NOTE_MARKERS = ['> NOTE', 'NOTE —', '[V', '[H', '`/legal`', 'Stage 6', 'RULED', 'O1′', 'DRAFT'] as const;

/** Which markers a text carries (empty is clean). */
export const filterMarkers = (text: string): string[] => OWNER_NOTE_MARKERS.filter(m => text.includes(m));
