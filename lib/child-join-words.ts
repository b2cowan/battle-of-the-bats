/**
 * THE WORDS OF JOINING AND SPLITTING CHILD RECORDS (Club Tier Stage 14 S6, Ask 11; drawings tab 6, owner "go with your
 * recommendations" 2026-11-05). The Children half of Families → Duplicates, the confirm, and the child page's Split records
 * window. Pure strings and small formatters, safe for the browser. The drawn strings are quoted from the v2 drawings; the
 * rest (empty state, notices, the split window) were not drawn and follow the parents' queue's voice — the build prompt
 * lists them under "Defaults taken".
 */
import { pluralize, possessive } from './utils';
import { formatStoredDate } from './timezone';
import type { ChildReasonKind } from './children-duplicates';

const bornOn = (iso: string) => formatStoredDate(iso);

export const CHILD_JOIN_WORDS = {
  /** The ViewSwitch (kit) — "Parents · 2 | Children · 5". */
  switchLabel: 'Which duplicates',
  parents: (n: number) => `Parents · ${n}`,
  children: (n: number) => `Children · ${n}`,
  lede: 'Records that may be one child. Nothing joins until you choose.',
  reason: (kind: ChildReasonKind): string => kind === 'same_parent' ? 'Same name, same birth date and the same parent'
    : kind === 'different_parent' ? 'Same name and birth date, different parent email'
    : 'Same name and parent, birth date missing on one side',
  keep: 'Keep this record',
  born: (iso: string | null) => (iso ? `Born ${bornOn(iso)}` : 'Birth date not on file'),
  parentLine: (line: string) => `Parent: ${line}`,
  /** One sentence: what joining keeps, that nothing in a season changes, that it can be split. */
  consequence: (keeper: string, keeperBirthDate: string | null, seasons: number, sameParent: boolean): string => {
    const all = seasons === 2 ? 'both seasons' : `all ${pluralize(seasons, 'season')}`;
    const lead = keeperBirthDate ? `Joining keeps ${keeper}, born ${bornOn(keeperBirthDate)}, as one child with ${all}.`
      : `Joining keeps ${keeper} as one child with ${all}.`;
    return sameParent
      ? `${lead} Every season keeps its own entry, and you can split them again from ${possessive(keeper.split(' ')[0])} page.`
      : `${lead} Both parents stay on the one child. If they are one parent, the Parents queue proposes that separately.`;
  },
  join: 'Join as one child',
  notSame: 'Not the same child',
  /** Shown in place of the consequence when two records sit on one team in one season. */
  blocked: (where: string) => `Both are on the ${where} roster. Remove the extra entry first, then join them.`,
  confirmTitle: (name: string) => `Join ${possessive(name)} records?`,
  confirmBody: (first: string, seasons: number) =>
    `${first} becomes one child with ${pluralize(seasons, 'season')}. Nothing in any season changes. You can split them again from ${possessive(first)} page.`,
  confirmYes: 'Join',
  cancel: 'Cancel',
  joining: 'Joining…',
  joined: (name: string) => `Joined. ${name} is one child now.`,
  keptApart: 'Kept apart. They won’t be proposed again.',
  emptyTitle: 'Nothing to review',
  emptyBody: 'Records appear here when two children have the same first and last name and the same birth date, or the same name '
    + 'and parent with a birth date missing on one. Pairs you mark not the same child don’t come back.',
  notProposed: 'These records aren’t proposed as one child any more. The list has been refreshed.',
  capReached: 'Joining would give the child more than two connected parents on one team. Remove one first, then join them.',
  failed: 'That didn’t go through. Please try again.',
  loadFailed: 'We couldn’t load the duplicates.',
  loading: 'Loading possible duplicates…',
} as const;

/** Split records — the child page's window (not drawn; the consequence line is the drawings'). */
export const CHILD_SPLIT_WORDS = {
  open: 'Split records',
  title: (name: string) => `Split ${possessive(name)} records?`,
  lede: 'Choose the seasons that belong to a different child. They move to a new record; nothing is deleted.',
  listLabel: 'Seasons that move',
  count: (n: number, of: number) => `${n} of ${of} moving`,
  /** Why Split is waiting — the foot reason while nothing, or everything, is ticked. */
  chooseSome: 'Choose some of the seasons, not none and not all.',
  consequence: (name: string) =>
    `Each season keeps its own entry, money and papers. ${name} stays one child with the seasons you leave, and the two won’t be proposed as one again.`,
  parentsStay: (names: string) => `${names} stays linked to the record you keep.`,
  yes: 'Split records',
  splitting: 'Splitting…',
  cancel: 'Cancel',
  done: (name: string) => `Split. ${name} is now a separate child.`,
  failed: 'That didn’t go through. Please try again.',
  gone: 'That child no longer exists. The page has been refreshed.',
  changed: 'Those seasons changed while this was open. Choose again.',
} as const;
