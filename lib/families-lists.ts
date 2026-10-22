/**
 * lib/families-lists.ts — THE FAMILIES LISTS, ONE DEFINITION (Club Tier Stage 7c, owner 2026-10-22: Email families can go
 * to one of the lists). Pure: no database.
 *
 * ⚠⚠ The Families tab's pill ("Owes money 5") and Email families' "Families from a list" are the SAME question, so both
 * read these predicates, so the list a send reaches is the list the pill counts. ⚠ The pill counts PEOPLE; a send counts
 * HOUSEHOLDS (two parents who both owe money are "Owes money 2" and one family), and the other parent in a household is
 * emailed too — the window states the household count, never the pill's.
 * "No family on file" is not here: it lists CHILDREN with no guardian, so there is nobody to email. "All families" is the
 * send window's own "Every family".
 */
import type { WorklistFamily } from './families-read';

export type FamilyListKey = 'owes' | 'forms' | 'consent' | 'notback';
export const FAMILY_LIST_KEYS: readonly FamilyListKey[] = ['owes', 'forms', 'consent', 'notback'];
export const isFamilyListKey = (s: unknown): s is FamilyListKey => typeof s === 'string' && (FAMILY_LIST_KEYS as readonly string[]).includes(s);

/** What a family owes: rep dues and unpaid house-league fees — the record's band reads the same sum (owner 2026-10-18). */
export const owedCents = (f: WorklistFamily) => f.repOwedCents + f.leagueOwedCents;

export const FAMILY_LIST_PREDICATES: Record<FamilyListKey, (f: WorklistFamily) => boolean> = {
  // The Balance cell's own sum (/review 2026-10-18): a family on Owes money never reads a dash.
  owes: f => owedCents(f) > 0,
  forms: f => f.missingFormsCount > 0,
  consent: f => !f.hasConsent && f.children.some(c => c.current),
  notback: f => f.notBack,
};

/** The lists each person (by id) stands on — what the send's audience reads. */
export function listsByPerson(families: readonly WorklistFamily[]): Map<string, FamilyListKey[]> {
  const out = new Map<string, FamilyListKey[]>();
  for (const f of families) out.set(f.personId, FAMILY_LIST_KEYS.filter(k => FAMILY_LIST_PREDICATES[k](f)));
  return out;
}
