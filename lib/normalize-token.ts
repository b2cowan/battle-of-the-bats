/**
 * normalize-token.ts
 *
 * One string-normalization rule, at lib root so anything may depend on it.
 *
 * It lived in `lib/import/tabular.ts` because spreadsheet import was its first caller, but it is
 * not an import concern: it is now also the rule that decides whether a typed field name names one
 * of a tournament's venues (`lib/venue-name-match.ts`). Domain identity must not depend on the
 * file-import subsystem — with the dependency pointing that way, someone tuning `normalizeToken`
 * for a CSV quirk would silently move what counts as the same field name.
 */

/**
 * Trim, case-fold, and flatten every run of non-alphanumerics to a single space.
 *
 * The punctuation flattening is load-bearing, not cosmetic: it makes the legacy exported label
 * "Lions Park - Diamond 1" and the live label "Lions Park — Diamond 1" read as the same string, so
 * re-importing a file this product exported does not report every row as unmatched.
 */
export function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
