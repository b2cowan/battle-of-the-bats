import { possessive } from './utils';

/**
 * lib/family-guardian-consent.ts — the words a parent reads before joining a child's team, in ONE place both sides read.
 *
 * ⚠ NOT `server-only`, deliberately. The accept page renders these words and the server STORES them as the consent record, and
 * the two must say the same thing — a stored consent whose text has drifted from what the parent actually saw is worse than no
 * record at all, because it looks like evidence and isn't.
 *
 * ⚖ The words are /legal draft 0.1 (a) (`docs/agents/legal/drafts/GUARDIAN_CONSENT_STAGE4.md`), adopted by the owner as the
 * words the build ships with, switched off (Stage 4 ruling 13, 2026-11-08). Its six build conditions hold here: NO AGE QUESTION
 * (ruling 12 — the band is worked out from the date of birth the club holds, never asked, never shown, never stored); both boxes
 * required, neither pre-ticked; the record stores the exact words, the wording version, the time, the IP, the club and the child.
 * When the draft changes, this file changes and `GUARDIAN_CONSENT_VERSION` moves with it.
 *
 * The several-children form (drawing tab 2, state B) is the draft's one-child sentence with the names joined — draft (a) only
 * wrote the one-child words; /legal and /marketing re-read it in the Stage 4a closeout.
 */

/** Stored with every consent record (/legal condition 4: the wording version). 0.1 = the words a house-league invitation shows. */
export const GUARDIAN_CONSENT_VERSION = 'GUARDIAN_CONSENT_STAGE4 v0.1';
/** Draft 0.3 "(a) 0.3" (One attendance record, owner 2026-11-14, walk §529 call 3): an invitation with a REP-team child shows the
 *  In / Out / Maybe lines (0.2) PLUS "your answer is also the child's attendance … a coach can change it, you'll see when". New joins
 *  only; a parent who joined earlier (0.2) reads the same facts in the answer sheet's hint, and their stored record keeps 0.2's words.
 *  The version travels with the words — never a 0.3 header over 0.2 words or the reverse. */
export const GUARDIAN_CONSENT_VERSION_REP = 'GUARDIAN_CONSENT_STAGE4 v0.3';

/** Shown above the boxes while the words are a draft. Nothing on a real page may claim a review is under way (the old notice,
 *  "being confirmed with our privacy advisor", was false from 2026-11-04). */
export const GUARDIAN_CONSENT_DRAFT_NOTICE = 'Draft wording — not final.';

/*
 * FieldLogicHQ's own privacy policy is linked as "How we use your information" (/legal condition 5) through the legal-pages switch
 * (GST/HST Stage 6 step 6.2): a client component reads `useLegalLinks()`, a server component `legalPageHref('privacy')`. The link
 * is absent while the pages are off. Publishing the policy (step 6.7) is still OWED before the guardian tier goes on anywhere real.
 */

/** "Leo", "Leo and Ava", "Leo, Ava and Maya". */
export function namesList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const poss = possessive;

export interface BeforeYouJoinWords {
  /** The wording version these words are (stored at the head of the record, so a record can never claim words it didn't show). */
  version: string;
  title: string;
  intro: string;
  whoTitle: string;
  /** The four "who sees what" lines; the last ends with the two privacy links (labels below). */
  who: { you: string; staff: string; others: string; us: string };
  policyLink: string;
  clubNoticeLink: string;
  /** /legal condition 5: when the club has no privacy notice, this replaces its link. */
  noClubNotice: (contact: string) => string;
  choice: string;
  guardianBox: string;
  consentBox: string;
  button: string;
  pageTitle: string;
}

/**
 * /legal draft (a), filled. `children` are first names, in the order the page lists them (one or more). `rep`: at least one child
 * on the invitation is on a rep team (draft 0.2's rule 1: only then do the In / Out / Maybe lines appear; a mixed invitation shows
 * them; a house-league-only invitation shows 0.1, because in 4b a house-league parent sees no In / Out / Maybe).
 */
export function beforeYouJoinWords(club: string, children: readonly string[], rep = false): BeforeYouJoinWords {
  const several = children.length > 1;
  const names = namesList(children);
  const theirs = poss(names);
  const team = several ? 'teams' : 'team';
  const answers = rep
    ? ` If ${several ? 'their coaches turn' : `${theirs} coach turns`} it on, you can also say here whether ${names} ${several ? 'are' : 'is'} coming to a game or practice. ${several ? 'Your answers are also each child’s attendance for it, and stay in the team’s record.' : `Your answer is also ${theirs} attendance for it, and stays in the team’s record.`}`
    : '';
  return {
    version: rep ? GUARDIAN_CONSENT_VERSION_REP : GUARDIAN_CONSENT_VERSION,
    pageTitle: several ? 'Join your children’s teams' : `Join ${theirs} team`,
    title: 'Before you join',
    intro: `${club} already has ${theirs} ${several ? 'sign-ups' : 'sign-up'}. Joining lets you see ${theirs} ${team}, practices and games here, and your sign-up.`,
    whoTitle: 'Who sees what',
    who: {
      you: `You see ${theirs} ${team}, coach, practice and game times and places, and your sign-up.${answers} Nothing about other children.`,
      staff: rep
        ? `${theirs} coaches and ${poss(club)} staff see the name, email and phone number on ${theirs} ${several ? 'sign-ups' : 'sign-up'}. Coaches also see your answers, any note you add, your first name and when you answered, and can change an answer. You’ll see when they do. ${club} can also see that you joined, sees if you leave, and can remove you.`
        : `${theirs} coaches and ${poss(club)} staff see the name, email and phone number on ${theirs} ${several ? 'sign-ups' : 'sign-up'}. ${club} can also see that you joined, and can remove you.`,
      others: rep
        ? `Other families can’t see you or ${names} here. ${theirs} other parent, if they’ve joined, sees your first name and your answer, but not your note.`
        : `Other families can’t see you or ${names} here.`,
      us: `FieldLogicHQ, the software ${club} uses, keeps your account (your email and password). It opens ${poss(club)} records only to support the club.`,
    },
    policyLink: 'How we use your information',
    clubNoticeLink: `${poss(club)} privacy notice`,
    noClubNotice: (contact: string) => `Ask ${club} for its privacy notice at ${contact}.`,
    choice: 'Joining is your choice. It doesn’t put you on any newsletter.',
    guardianBox: several ? `I’m the parent or legal guardian of ${names}.` : `I’m ${theirs} parent or legal guardian.`,
    consentBox: `I agree that FieldLogicHQ and ${club} may use my name, email and phone number to run my account and to email me about ${theirs} ${team}, as the privacy policy and ${poss(club)} privacy notice describe.`,
    button: several ? 'Join' : `Join ${theirs} team`,
  };
}

/**
 * The exact text stored with each consent record as evidence (/legal condition 4), built FROM the words the page renders.
 * The version leads; the age band is never part of it.
 */
export function guardianConsentText(words: BeforeYouJoinWords): string {
  return [
    words.version,
    words.title,
    words.intro,
    words.whoTitle,
    words.who.you,
    words.who.staff,
    words.who.others,
    words.who.us,
    words.choice,
    `[x] ${words.guardianBox}`,
    `[x] ${words.consentBox}`,
  ].join('\n');
}
