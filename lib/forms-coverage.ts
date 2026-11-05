/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHICH FORMS A PLAYER OWES, AND WHETHER ONE IS ON FILE — the one rule the Families book, the
 * club's Rep Teams board and (Club Tier Stage 14 S4) the coach's Family & paperwork tab all read.
 *
 * A template APPLIES to a team when it is org-wide (`team_id` null) or that team's own; only active
 * templates count (the caller passes active ones). A form is ON FILE when the player has a document
 * of the template's TYPE — the rule the Families book has used since it shipped, lifted out of
 * `lib/families-read.ts` so the board cannot count "signed" differently from the family page.
 *
 * ⚖ Stage 14 S4 (Ask 10 A, owner 2026-11-04): a form is SIGNED EACH SEASON or GOOD UNTIL REPLACED
 * (`rep_document_templates.validity`; with no template, the type's default: waiver + code of
 * conduct each season, medical consent + other until replaced). A signed-each-season form is on
 * file only with a copy on THIS season's entry; a good-until-replaced one with a copy on any of the
 * child's entries on the SAME team (a coach reads their own team's seasons only — Ask 9; the board
 * and the Families book use the same scope so the three never disagree).
 *
 * ⚠ Matching is by type, not by template id: a player's uploaded document may not name the
 * template it answers. Two active templates of the same type are therefore covered by one document
 * of that type — a known coarseness of the shared rule, recorded rather than silently diverged from.
 *
 * ⚠ PURE (no database).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

import type { RepDocumentType } from './types';

export type DocumentValidity ='signed_each_season' | 'good_until_replaced';
export const DOCUMENT_VALIDITIES: readonly DocumentValidity[] = ['signed_each_season', 'good_until_replaced'];

export function isDocumentValidity(v: unknown): v is DocumentValidity {
  return v === 'signed_each_season' || v === 'good_until_replaced';
}

/** The type's default — the backfill's and the database default's rule (mig 441). */
export function defaultValidity(documentType: string): DocumentValidity {
  return documentType === 'waiver' || documentType === 'code_of_conduct' ? 'signed_each_season' : 'good_until_replaced';
}

export function validityOf(t: { document_type: string; validity?: string | null }): DocumentValidity {
  return isDocumentValidity(t.validity) ? t.validity : defaultValidity(t.document_type);
}

/**
 * What one document TYPE asks of a team: its templates' setting, the type's default when it has none. Two templates of
 * one type set differently: the stricter (each season) wins — one copy answers both, the shared rule's coarseness.
 */
export function validityForType(
  templates: readonly { document_type: string; validity?: string | null }[],
  documentType: string,
): DocumentValidity {
  const ofType = templates.filter(t => t.document_type === documentType);
  if (ofType.length === 0) return defaultValidity(documentType);
  return ofType.some(t => validityOf(t) === 'signed_each_season') ? 'signed_each_season' : 'good_until_replaced';
}

/** The order document types are listed in everywhere (the drawing's: waiver, code of conduct, medical consent). */
export const DOCUMENT_TYPE_ORDER: readonly RepDocumentType[] = ['waiver', 'code_of_conduct', 'medical_consent', 'other'];

/** The document types a child holds: on this season's entry, and on their other entries on the same team. */
export interface FormsHeld {
  thisSeason: ReadonlySet<string>;
  earlier: ReadonlySet<string>;
}
export const NOTHING_HELD: FormsHeld = { thisSeason: new Set(), earlier: new Set() };

export function templatesForTeam<T extends { team_id: string | null }>(templates: readonly T[], teamId: string): T[] {
  return templates.filter(t => t.team_id === null || t.team_id === teamId);
}

export function formOnFile(held: FormsHeld, template: { document_type: string; validity?: string | null }): boolean {
  if (held.thisSeason.has(template.document_type)) return true;
  return validityOf(template) === 'good_until_replaced' && held.earlier.has(template.document_type);
}

/** Every applicable form on file — the board's "signed every active template". */
export function hasEveryForm(
  held: FormsHeld,
  templates: readonly { document_type: string; validity?: string | null }[],
): boolean {
  return templates.every(t => formOnFile(held, t));
}
