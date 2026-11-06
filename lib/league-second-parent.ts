import { normalizeGuardianEmail, isSendableGuardianEmail } from './guardian-email';
import { nameList } from './league-signup';
import { possessive } from './utils';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A SECOND PARENT'S EMAIL ON THE HOUSE-LEAGUE SIGN-UP (Signed-in family accounts Stage 3; plan
 * SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md Stage 3, all six asks ruled A 2026-11-03; drawing SIGNED_IN_FAMILY_STAGE3_DRAWINGS.html).
 *
 *   One address per SIGN-UP, not per child (league_registrations.guardian_email_2, mig 430; every child of the
 *   signup_ref carries it). No name is asked, so the second parent's greeting is "Hi,".
 *   The same address as the first (capitals and spaces ignored) is refused; an empty box changes nothing anywhere.
 *   It gets every email about the sign-up (receipts and refunds follow whoever paid) — each its own message, never a Cc.
 *   ⚠ It is NEVER a household key and NEVER reaches a marketing or consent list (ask 3): the first parent's tick-box is
 *   one person's consent. tests/unit/league-second-parent.test.ts holds both.
 *
 * Every word the stage shows lives here, so the /marketing pass is one edit and the staff screens (Part 5) say the same.
 * Client-safe: the sign-up form reads the words too.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The button's words: said once, read by the confirm page, the footer on every copy and the "who added you" line. */
const STOP_BUTTON = 'Stop these emails';

export const SECOND_PARENT_WORDS = {
  label: 'Second parent’s email',
  hint: 'Add them and they’ll get the club’s emails about this sign-up, except payment receipts. No name needed.',
  /** The form's coach line (ask 5): the coach sees the second address too. */
  coachLine: 'Your child’s coach will see your name, email and phone, and the second parent’s email if you add one.',
  /** The first email's own words, so the two boxes never disagree. */
  invalid: 'Enter a valid email address.',
  sameAsYours: 'That’s the same email as yours. Leave this empty or enter the other parent’s.',
  /**
   * An address that asked to stop (Stage 3b, owner call O4): refused in words on the family form and on both of the club's
   * windows, never accepted silently. DRAFT words for the /marketing pass: change them here and only here.
   */
  stoppedAddress: 'That address has asked not to get these emails from this club. Enter a different one, or leave it empty.',
  /**
   * The confirm page behind the "Stop these emails" link (/second-parent-stop; Stage 3b). The reader may not know the club
   * well and is signed out. DRAFT words for the /marketing pass: change them here and only here.
   */
  stop: {
    button: STOP_BUTTON,
    title: 'Stop these emails?',
    body: (club: string, email: string) => `${club} has been sending sign-up emails to ${email}. Press the button and ${club} will stop sending them, for every season.`,
    note: 'The club’s sign-up record will show that these emails were stopped. Nobody is emailed about it.',
    doneTitle: 'These emails have stopped',
    doneBody: (club: string, email: string) => `${club} won’t send sign-up emails to ${email} again.`,
    invalidTitle: 'We can’t use that link',
    invalidBody: 'This link isn’t valid. To stop the emails, reply to any email you received from the club and ask to be taken off. Your address will come off within 10 business days.',
    dbTitle: 'That didn’t go through',
    dbBody: 'Something went wrong on our side, so the emails haven’t stopped yet. Open the link in your email again in a few minutes. If it still doesn’t work, reply to any email you received from the club and ask to be taken off. Your address will come off within 10 business days.',
  },
  /** The second parent's greeting: no name is asked. */
  greeting: 'Hi,',
  /**
   * The quiet line at the foot of every email a second parent gets (Stage 3b, Part 4): who put them there. The link's words
   * are `stop.button`. DRAFT words for the /marketing pass: change them here and only here.
   */
  footer: { lead: 'A parent added your email to this sign-up. Don’t want these?' },
  /**
   * The line at the top of the second parent's copy of the confirmation (ask 2): who added this address, and how a wrong
   * one comes off. `stop` is true when the copy carries the Stop button (it does not when no link can be signed here);
   * `contact` is the club's public contact email, when it has a usable one. With neither, the line names the club.
   * DRAFT words for the /marketing pass (build prompt Part 6): change them here and only here.
   */
  addedYou(
    firstParent: string, childFirstNames: readonly string[],
    club: { name: string; contact: string | null; stop: boolean },
  ): string {
    const kids = nameList(childFirstNames);
    const whose = childFirstNames.length === 1 ? possessive(kids) : 'their';
    const ways = [
      club.stop ? `use “${STOP_BUTTON}” at the bottom of this email` : null,
      club.contact ? `tell the club at ${club.contact}` : club.stop ? null : `contact ${club.name}`,
    ].filter(Boolean).join(', or ');
    return `${firstParent} added your email to ${possessive(kids)} sign-up so you get the same updates. If you aren’t ${whose} parent or guardian, or you’d rather not get these, ${ways}, and your address comes off the sign-up.`;
  },
  /**
   * The club's screens (Part 5, ask 6): the record window's row and its edit, and the "Add registration" window. Staff are
   * not the parent, so "the same as yours" becomes "the same as the first email".
   */
  staff: {
    row: 'Second parent',
    none: '—',
    add: 'Add',
    change: 'Change',
    save: 'Save',
    cancel: 'Cancel',
    sameAsFirst: 'That’s the same as the first email. Leave it empty or enter the other parent’s.',
    /** The first email changed to the second parent's: the database holds them apart, so it is said in words first. */
    firstIsSecond: 'That’s already the second parent’s email on this sign-up. Change or clear the second parent first.',
    /** The record window's line where a stopped address was (Stage 3b, O3): nobody is emailed, the registrar can see it. */
    stopped: (date: string) => `Stopped by the address owner, ${date}`,
    /** Under the edit box: a staff edit sends nothing (shipped behaviour, build prompt Part 5). */
    editHint: 'Applies to every child in this sign-up. Nothing is emailed when you change it.',
  },
} as const;

/** A refusal from `readSecondParentEmail` in the words of whoever is typing: the parent on the form, or the club's desk. */
export function secondParentRefusalWords(refusal: 'invalid' | 'same', who: 'parent' | 'club'): string {
  if (refusal === 'invalid') return SECOND_PARENT_WORDS.invalid;
  return who === 'parent' ? SECOND_PARENT_WORDS.sameAsYours : SECOND_PARENT_WORDS.staff.sameAsFirst;
}

/**
 * THE ONE RECIPIENT RULE (build prompt Part 4): a household's addresses for an email about the sign-up — the first parent's
 * first, then every distinct second address of the registrations given, capitals and spaces ignored, nothing twice. Every
 * sender and the coach's page call this; no call site writes its own expansion. Each address is its own message (never a
 * Cc). The household is still keyed on the FIRST address everywhere; a count of households is unchanged by this.
 */
export function householdRecipients(
  first: string | null | undefined,
  rows: readonly { guardianEmail2?: string | null }[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const e = normalizeGuardianEmail(raw);
    if (e && !seen.has(e)) { seen.add(e); out.push(e); }
  };
  add(first);
  for (const r of rows) add(r.guardianEmail2);
  return out;
}

/** Only the second parents' addresses of a household (the first's own address never repeats as one). */
export function secondParentsOf(first: string | null | undefined, rows: readonly { guardianEmail2?: string | null }[]): string[] {
  const firstNorm = normalizeGuardianEmail(first);
  return householdRecipients(first, rows).filter(e => e !== firstNorm);
}

/**
 * ⚠ SECURITY (review 2026-11-03): an outbox message is built for a whole HOUSEHOLD — everyone typed under one first
 * address in the season — but a second address belongs to ONE sign-up, and the first address is never verified. Someone
 * who signs up with a stranger's address as the first and their own as the second would otherwise receive the stranger's
 * real children's teams, times and pay link. So a second address gets a household message only when it is on EVERY
 * registration the message names; a household that mixes second parents (or has a registration with none) tells the
 * first parent only, and the second parents still hear everything that is theirs alone (the sign-up confirmation, the
 * "Your sign-up" link, the per-child status emails, the pay link — each of those is built from that one sign-up).
 */
export function onEveryRegistration(firstEmail: string | null | undefined, perRegistration: readonly (string | null)[]): string[] {
  return secondParentsOf(firstEmail, perRegistration.map(e => ({ guardianEmail2: e })))
    .filter(to => perRegistration.every(e => normalizeGuardianEmail(e) === to));
}

/**
 * The second parent's copy of a built email (lib/league-second-parent-mail.ts sends it): its greeting, whatever the
 * builder wrote ("Hi <strong>Priya</strong>," or "Hi Priya,"), becomes "Hi,". Only the first greeting paragraph; nothing
 * else in the email changes.
 */
export function secondParentCopy(html: string): string {
  return html.replace(
    /<p([^>]*)>\s*Hi(?:\s+(?:<strong>[^<]*<\/strong>|[^<]+?))?\s*,\s*<\/p>/,
    (_m, attrs: string) => `<p${attrs}>${SECOND_PARENT_WORDS.greeting}</p>`,
  );
}

type SecondParentRead ={ email: string | null } | { refusal: 'invalid' | 'same' };

/**
 * The second address as typed, read against the first: empty is none; a malformed one or the first parent's own
 * (capitals and spaces ignored) is refused. The value is normalised exactly as `guardian_email` is.
 */
export function readSecondParentEmail(raw: string | null | undefined, firstEmail: string | null | undefined): SecondParentRead {
  const email = normalizeGuardianEmail(raw);
  if (!email) return { email: null };
  // 200 is the column's CHECK: a longer one is refused in words here rather than 500 at the database (staff paths too).
  if (email.length > 200 || !isSendableGuardianEmail(email)) return { refusal: 'invalid' };
  if (email === normalizeGuardianEmail(firstEmail)) return { refusal: 'same' };
  return { email };
}
