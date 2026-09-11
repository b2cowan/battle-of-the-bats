/**
 * A report section knows whether it LOADED (development lifecycle Phase 0, F05).
 *
 * ⚠ The Development report used to swallow a failed practice or tag read into an empty list, and
 * the section simply disappeared; the practice read also stopped at 200 rows without saying so.
 * A coach could not tell "no data" from "could not load", and worse, the coverage column, the
 * count-only finding and the uncovered-tags list were all computed from whatever DID arrive — so a
 * failed read could name a child as "not in a plan yet" on the strength of a database error.
 *
 * Four states, one predicate. The rule the report enforces with it: a gap is never reported from
 * an input that is `failed` or `incomplete`. Pure module.
 */

export type SectionState = 'available' | 'empty' | 'incomplete' | 'failed';

export interface SectionRead {
  state: SectionState;
  /** True when the read stopped at its cap — the season holds more than was read. */
  truncated: boolean;
}

export function sectionState(input: { failed: boolean; truncated: boolean; count: number }): SectionState {
  if (input.failed) return 'failed';
  if (input.truncated) return 'incomplete';
  return input.count > 0 ? 'available' : 'empty';
}

/** A read the report may draw conclusions from. */
export const sectionUsable = (read: SectionRead) => read.state === 'available' || read.state === 'empty';
