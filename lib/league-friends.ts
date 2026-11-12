import { hasOrgVenueLibrary } from './plan-features';
import type { OrgPlan } from './types';
import { possessive } from './utils';
import { cleanFriendCode, isFriendCode } from './league-friend-code';

/**
 * FRIEND REQUESTS, THE FAMILY'S SIDE (Board Ready Stage 1 Part 1; drawings BOARD_READY_FRIEND_REQUESTS_DRAWINGS.html
 * tabs 1–3, every ask ruled as recommended, owner 2026-11-10; plan BOARD_READY_PLAN.md §5 Stage 1).
 *
 * Pure: the form, the register route, "Your sign-up" and its change route all read the same rules and words.
 *   · The gate is the existing three-plan check (League Plus and both Club bands; Business Decisions 2026-11-10): no new
 *     key. A season at None (0) asks nothing.
 *   · A friend is named by a first and/or last name (the parent's name only helps the registrar), or by a code. A code
 *     is checked by its check letter only — never looked up — so nothing the form says tells a visitor whether a child is
 *     registered (A2).
 *   · /legal: the two lines under the question are verbatim from the drawing. The `/marketing` pass may tune the words;
 *     it may not widen the promise.
 */

/** Is the question asked for this club's season? */
export function friendRequestsOn(planId: string | null | undefined, max: number | null | undefined): boolean {
  return hasOrgVenueLibrary((planId ?? null) as OrgPlan | null) && (max ?? 0) > 0;
}

/** The maximum the form offers (0 when the plan has no friend requests). */
export function friendMaxFor(planId: string | null | undefined, max: number | null | undefined): number {
  return friendRequestsOn(planId, max) ? Math.min(2, Math.max(0, max ?? 0)) : 0;
}

export type FriendIn =
  | { by: 'name'; first: string | null; last: string | null; parent: string | null }
  | { by: 'code'; code: string };

/** The longest a typed name may be (the table's checks). */
export const FRIEND_NAME_MAX = 80;
export const FRIEND_PARENT_MAX = 120;

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
};

/**
 * One child's friends as sent ([{ by, first, last, parent } | { by: 'code', code }]), checked against the maximum.
 * Empty blocks drop out silently. Errors are keyed `friends.{n}.{field}` (n from 0 in the order sent).
 */
export function readFriends(raw: unknown, max: number, own?: { code: string | null; child: string }): { friends: FriendIn[]; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const friends: FriendIn[] = [];
  if (!Array.isArray(raw) || max <= 0) return { friends, errors };
  raw.slice(0, 4).forEach((f, n) => {
    if (!f || typeof f !== 'object') return;
    const o = f as Record<string, unknown>;
    if (o.by === 'code') {
      const typed = typeof o.code === 'string' ? o.code : '';
      if (!cleanFriendCode(typed)) return;
      if (!isFriendCode(typed)) { errors[`friends.${n}.code`] = FRIEND_WORDS.codeTypo; return; }
      // The child's own code (only "Your sign-up" knows it), keyed to the block the family typed it in.
      if (own?.code && cleanFriendCode(typed) === own.code) { errors[`friends.${n}.code`] = FRIEND_WORDS.errOwnCode(own.child); return; }
      friends.push({ by: 'code', code: cleanFriendCode(typed) });
      return;
    }
    const first = clean(o.first, FRIEND_NAME_MAX), last = clean(o.last, FRIEND_NAME_MAX), parent = clean(o.parent, FRIEND_PARENT_MAX);
    if (!first && !last && !parent) return;
    if (!first && !last) { errors[`friends.${n}.first`] = FRIEND_WORDS.nameMissing; return; }
    friends.push({ by: 'name', first, last, parent });
  });
  if (friends.length > max) errors.friends = FRIEND_WORDS.tooMany(max);
  // The same friend twice is one request.
  const seen = new Set<string>();
  const unique = friends.filter(f => {
    const k = f.by === 'code' ? `c:${f.code}` : `n:${(f.first ?? '').toLowerCase()} ${(f.last ?? '').toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { friends: unique.slice(0, max), errors };
}

/** What a family asked, as "Plays with" shows it: the name typed, or the code typed. Never the name behind a code. */
export type FriendAsked =
  | { name: string; first: string | null; last: string | null; parent: string | null }
  | { code: string };

/** The Overview › Registration row (drawing tab 3, rulings A1 + A8). The cap is stated, not set. */
export const FRIEND_SETTING_WORDS = {
  label: 'Friend requests',
  value: (max: number) => (max <= 0 ? 'None: the sign-up form doesn’t ask.' : `Up to ${max} per child`),
  sub: 'Groups in the draft hold at most 3 children, brothers and sisters included.',
  editLabel: 'Friends a family can name per child',
  options: [{ value: '0', label: 'None: don’t ask' }, { value: '1', label: '1' }, { value: '2', label: '2' }],
  hint: 'None hides the question on the sign-up form. Groups in the draft hold at most 3 children, brothers and sisters included, so a third friend could never be kept together.',
} as const;

export const FRIEND_WORDS = {
  question: (child: string) => `Who would you like ${child} to play with?`,
  hint: (max: number, division: string | null) =>
    `Optional. Up to ${max === 1 ? '1 friend' : `${max} friends`} who ${max === 1 ? 'is' : 'are'} signing up${division ? ` for ${division}` : ''}. The club tries to keep friends together but can’t promise every request.`,
  friendN: (n: number) => `Friend ${n}`,
  remove: 'Remove',
  removeLabel: (n: number) => `Remove friend ${n}`,
  first: 'First name',
  last: 'Last name',
  parent: 'Their parent’s name',
  parentPlaceholder: 'Helps the club find them',
  useCode: 'Have a friend code? Enter it instead',
  useName: 'Enter a name instead',
  code: 'Friend code',
  codeHint: 'The 6-letter code from the other family’s sign-up page.',
  codeTypo: 'That code has a typo. Check it with the other family.',
  nameMissing: 'Add the friend’s first or last name.',
  add: '+ Add a friend',
  atMax: (child: string, max: number) => `${child} can name up to ${max === 1 ? '1 friend' : `${max} friends`}.`,
  tooMany: (max: number) => `You can name up to ${max === 1 ? '1 friend' : `${max} friends`}.`,
  /** /legal (2026-11-10), verbatim from the drawing. */
  care: 'Only name a child whose family is happy for you to.',
  // /legal re-check 2026-11-11 (Part 2): the seats that read these are the ones that work sign-ups AND teams (A11), so
  // the line says both; it never names fewer people than can see the names.
  privacy: 'Only the club staff who work on sign-ups and teams see these names, and only to put friends on the same team. They are deleted after the season.',
  parentLine: (parent: string) => `parent ${parent}`,
  codeWord: 'friend code',
  // "Your sign-up" and the confirmation (tab 2)
  codeLabel: 'Friend code',
  codeShare: (child: string) => `If another family wants ${child} on their child’s team, they can enter this code on their sign-up.`,
  copy: 'Copy',
  copied: 'Copied',
  copyLabel: (child: string) => `Copy ${possessive(child)} friend code`,
  playsWith: 'Plays with',
  codeLine: (code: string) => `Code ${code}`,
  noOne: 'No one named.',
  addOne: 'Add a friend',
  change: 'Change',
  closed: 'Friend requests closed when the teams were made.',
  save: 'Save',
  saving: 'Saving…',
  cancel: 'Cancel',
  saved: 'Saved.',
  errGeneric: 'Something went wrong. Please try again.',
  errClosed: 'Friend requests are closed.',
  errOwnCode: (child: string) => `That’s ${possessive(child)} own code. Enter a friend’s code instead.`,
  /** The confirmation email's line (A10): text, never a link, in the same neutral sentence. */
  emailLead: (child: string) => `${possessive(child)} friend code:`,
} as const;
