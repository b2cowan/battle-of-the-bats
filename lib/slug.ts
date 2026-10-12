/**
 * A WEB ADDRESS PART, AS TYPED — the one copy of the rule every address field keeps: lowercase letters, numbers and
 * hyphens (the server's own check, `app/api/admin/org-settings` and the tournaments route, is the same pattern).
 * `cleanSlugInput` is what a field does to each keystroke; `isSlug` says whether a value can be saved.
 *
 * Pure, so a plain Node unit test reads it.
 */
export const SLUG_PATTERN = /^[a-z0-9-]+$/;

/** A keystroke's worth of typing, made into an address part (lowercased; anything else dropped). */
export function cleanSlugInput(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

/** Whether a value can be saved as an address part. */
export function isSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}
