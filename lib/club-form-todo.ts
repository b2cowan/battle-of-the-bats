import { needsTick, tickState, type SignupDocument, type SignupQuestion, type VersionStep } from './club-form-signup';

/**
 * DOES THIS SIGN-UP HAVE SOMETHING TO DO ON THE FORM? (Board Ready Stage 4 Part 3, owner call C4: the club's own "Email
 * families" carries the family's existing "Your sign-up" button for a family whose sign-up still has something to do.)
 *
 * Pure, so a test reads it straight. It is the same question Your sign-up answers for a family (`familyFormState`,
 * lib/club-form-family.ts), asked for many sign-ups at once from rows the caller read in bulk:
 *
 *   · a DOCUMENT NEEDING A TICK: for any live child, the tick on the document's current version is "again" (a version asked
 *     for a new tick) or "none" (a document added since they signed up) — `tickState` / `needsTick`, the page's own rule;
 *   · a REQUIRED LIVE QUESTION this sign-up has not answered (owner 2026-11-20, Part 3 call 5: an optional question a family
 *     skipped never brings the button back on every send): a per-child question for any live child whose answers can still change,
 *     or a once-per-sign-up question while any live child can still change theirs (the page closes the sign-up's own
 *     questions the same way: `once.open`). An answer the family cleared, or the club removed, is not an answer.
 *
 * A finished season counts nothing. Declined and withdrawn children are not live. A child whose division's teams are made
 * can no longer change answers (`answersOpen`), so its unanswered questions do not count — but a document it still needs a
 * tick on does, as on the page.
 *
 * ⚖ It reads which questions have an answer, never what the answer says: nothing here holds an answer's words.
 */

export interface TodoChild {
  id: string;
  /** Not declined, not withdrawn (`liveRow`). */
  live: boolean;
  /** Its answers can still change (`answersOpen`). */
  open: boolean;
}

export interface TodoTick { documentId: string; versionId: string | null; moved: boolean; subjectId: string }

export interface TodoVersion extends VersionStep { documentId: string }

export interface SignupFormTodoInput {
  finished: boolean;
  /** The form's LIVE questions (archived ones are not asked). Only the required ones count. */
  questions: readonly Pick<SignupQuestion, 'id' | 'asked' | 'required'>[];
  /** The form's live documents. */
  documents: readonly Pick<SignupDocument, 'id'>[];
  /** Every version of those documents, any order. */
  versions: readonly TodoVersion[];
  /** The sign-up's children. */
  children: readonly TodoChild[];
  /** Question ids each child has an answer for (a child with no entry has none). */
  answered: ReadonlyMap<string, ReadonlySet<string>>;
  /** Question ids the sign-up's own (once-per-sign-up) answers cover. */
  onceAnswered: ReadonlySet<string>;
  /** This sign-up's ticks, any document. */
  ticks: readonly TodoTick[];
}

export function signupHasFormToDo(i: SignupFormTodoInput): boolean {
  if (i.finished) return false;
  const live = i.children.filter(c => c.live);
  if (live.length === 0) return false;

  for (const d of i.documents) {
    const steps = i.versions.filter(v => v.documentId === d.id).sort((a, b) => b.versionNo - a.versionNo);
    if (steps.length === 0) continue; // a document with no version cannot be ticked
    const mine = i.ticks.filter(t => t.documentId === d.id);
    if (live.some(c => needsTick(tickState(steps, mine.filter(t => t.subjectId === c.id))))) return true;
  }

  const required = i.questions.filter(q => q.required);
  const perChild = required.filter(q => q.asked === 'per_subject');
  const once = required.filter(q => q.asked === 'once');
  for (const c of live) {
    if (!c.open) continue;
    const have = i.answered.get(c.id);
    if (perChild.some(q => !have?.has(q.id))) return true;
  }
  if (live.some(c => c.open) && once.some(q => !i.onceAnswered.has(q.id))) return true;
  return false;
}
