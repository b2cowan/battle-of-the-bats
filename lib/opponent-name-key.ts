/**
 * THE OPPONENT GROUPING KEY — the one rule that decides whether two spellings are the same team.
 *
 * A leaf module with NO imports, and that is its whole job. The Opponent Scouting Book is an
 * overlay keyed on this value (`rep_team_opponents.normalized_name`), so a book row only ever
 * finds its own games if the seed, the app and the URL parser all agree on the answer — and the
 * demo seeders run under Node's type-stripping, which cannot resolve `lib/coach-opponents.ts`'s
 * extensionless transitive imports. Left there, the rule would have had to be re-typed inside
 * `lib/demo-coach.ts`, and a second copy of an IDENTITY rule is a book that silently stops
 * matching its own opponent the first time either copy is touched.
 *
 * `lib/coach-opponents.ts` re-exports this, so no caller had to move.
 * ⚠ The `.ts` extension on imports of this file is load-bearing (the `lib/demo-org.ts` convention).
 */

/**
 * Casefold, strip punctuation, collapse whitespace, drop a leading "the ". Deliberately
 * conservative — spelling drift beyond this is the alias table's job, a coach decision, not a
 * fuzzy matcher's guess.
 */
export function normalizeOpponentName(name: string | null | undefined): string {
  if (!name) return '';
  let collapsed = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Strip leading "the " to a FIXED POINT, not once: already-normalized keys round-trip through
  // this function (URL params, merge payloads), and a single strip made
  // f(f("the the sharks")) ≠ f("the the sharks") — a re-normalized key could silently address a
  // DIFFERENT opponent. Idempotence is load-bearing; a bare "the" survives.
  while (collapsed.startsWith('the ')) collapsed = collapsed.slice(4);
  return collapsed;
}
