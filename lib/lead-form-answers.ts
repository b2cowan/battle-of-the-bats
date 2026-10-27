/**
 * What a visitor can tell us on the public forms, and the tag on a link we hand out (Support console Stage 7 Part 8;
 * drawing J, owner ruling 2026-10-27 "as drawn"). Pure and shared: the forms offer the choices, the server checks
 * them, the lead page reads them back. No database, no environment.
 *
 * ⚠ The words in HEARD_FROM_CHOICES are customer copy written by /marketing (plan "§6-6 words"). A change to a label
 * is a copy change and a release item; a change to a CODE is a migration-free but data-visible change (the code is
 * what the database keeps), so add codes, never rename them.
 */

/** "How did you hear about us?" — the visitor's own choice, kept as given (`early_access_leads.heard_from`). */
export const HEARD_FROM_CHOICES = [
  { code: 'another_club', label: 'Another club or team told me', source: 'referral_club' },
  { code: 'someone_else', label: 'Someone else told me', source: 'other' },
  { code: 'tournament', label: 'I came across it at a tournament', source: 'tournament' },
  { code: 'searched', label: 'I searched online', source: 'search' },
  { code: 'social', label: 'Social media', source: 'social' },
  { code: 'event', label: 'An event or conference', source: 'event' },
  { code: 'presentation', label: 'Someone sent me a presentation', source: 'pitch_deck' },
  { code: 'something_else', label: 'Something else', source: 'other' },
] as const;

export type HeardFromCode = (typeof HEARD_FROM_CHOICES)[number]['code'];
/** The staff source each choice fills until a staff member sets their own (the list in `lib/early-access-admin.ts`). */
export type HeardFromSource = (typeof HEARD_FROM_CHOICES)[number]['source'];

const HEARD_BY_CODE = new Map<string, (typeof HEARD_FROM_CHOICES)[number]>(HEARD_FROM_CHOICES.map(c => [c.code, c]));

/** A value from the public form, or null: anything not on the list is dropped, never stored, never shown. */
export function cleanHeardFrom(value: unknown): HeardFromCode | null {
  return typeof value === 'string' && HEARD_BY_CODE.has(value) ? (value as HeardFromCode) : null;
}

/** The visitor's words for a stored code ("From the form: …"), or null for no answer or a code we no longer know. */
export function heardFromLabel(code: string | null | undefined): string | null {
  return code ? HEARD_BY_CODE.get(code)?.label ?? null : null;
}

/** The staff source a stored answer maps to, or null for no answer. */
export function sourceFromHeard(code: string | null | undefined): HeardFromSource | null {
  return code ? HEARD_BY_CODE.get(code)?.source ?? null : null;
}

/**
 * The tags on links we hand out (`?ref=…`), each with the label staff read. A tag is added by a small commit that adds
 * one line with its label — never by a screen, so a tag can never be a stranger's words. The database holds the shape
 * (lowercase letters, digits and "-", 1 to 32 characters); this list holds which ones are real.
 */
export const LINK_TAGS: Record<string, string> = {
  'spring-mailout': 'Spring mailout',
  'conference-booth': 'Conference booth',
  'club-newsletter': 'Club newsletter',
  'deck-follow-up': 'Deck follow-up',
};

/** The longest tag the database accepts; anything longer is cut before the list is asked. */
export const LINK_TAG_MAX = 32;

/** A tag from an address or a form: cut, tidied, and kept only if it is on the list. Everything else is null. */
export function cleanLinkTag(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const tidy = value.trim().toLowerCase().slice(0, LINK_TAG_MAX);
  return Object.prototype.hasOwnProperty.call(LINK_TAGS, tidy) ? tidy : null;
}

/** A stored tag in words. A tag since taken off the list shows as a quiet "an old link", never its raw text. */
export function linkTagLabel(tag: string | null | undefined): string | null {
  if (!tag) return null;
  return Object.prototype.hasOwnProperty.call(LINK_TAGS, tag) ? LINK_TAGS[tag] : 'An old link';
}
