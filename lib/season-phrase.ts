/**
 * lib/season-phrase.ts — a season's name as a phrase in a sentence (Club Tier Stage 4c-2, words CLUB_TIER_STAGE4C2_COPY.md
 * Convention 3). One helper for "Birth years for the 2027 season" (A1), "Moved one year later when the 2028 season started…"
 * (A21) and the tryout page meta.
 *
 * A trailing word "Season" (any case) is removed from the name and the lower-case word "season" added where the sentence
 * needs it: "2027 Season" → "2027 season", "Spring" → "Spring season", "Spring Season" → "Spring season". A name that is
 * only the word reads "season".
 *
 * Not `seasonWords` in lib/tryout-season.ts: that one labels the season by its YEAR ("the 2027 season", the 4b-2b tryout pages)
 * and falls back to the name only when there is no year; this one labels it by its NAME, which is how Team details names a
 * season (the 4c-2 ruling). Two rules for two surfaces, kept apart on purpose.
 */
export function seasonPhrase(name: string | null | undefined): string {
  const base = (name ?? '').trim().replace(/\s*\bseason\s*$/i, '').trim();
  return base ? `${base} season` : 'season';
}
