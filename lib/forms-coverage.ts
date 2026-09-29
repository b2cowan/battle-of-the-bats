/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHICH FORMS A PLAYER OWES, AND WHETHER ONE IS ON FILE — the one rule the Families book and the
 * club's Rep Teams board (Club Tier Stage 2, Ask 5 "Documents") both read.
 *
 * A template APPLIES to a team when it is org-wide (`team_id` null) or that team's own; only active
 * templates count (the caller passes active ones). A form is ON FILE when the player has a document
 * of the template's TYPE — the rule the Families book has used since it shipped, lifted out of
 * `lib/families-read.ts` so the board cannot count "signed" differently from the family page.
 *
 * ⚠ Matching is by type, not by template id: a player's uploaded document may not name the
 * template it answers. Two active templates of the same type are therefore covered by one document
 * of that type — a known coarseness of the shared rule, recorded rather than silently diverged from.
 *
 * ⚠ PURE (no database).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export function templatesForTeam<T extends { team_id: string | null }>(templates: readonly T[], teamId: string): T[] {
  return templates.filter(t => t.team_id === null || t.team_id === teamId);
}

export function formOnFile(docTypes: ReadonlySet<string>, template: { document_type: string }): boolean {
  return docTypes.has(template.document_type);
}

/** Every applicable form on file — the board's "signed every active template". */
export function hasEveryForm(docTypes: ReadonlySet<string>, templates: readonly { document_type: string }[]): boolean {
  return templates.every(t => formOnFile(docTypes, t));
}
