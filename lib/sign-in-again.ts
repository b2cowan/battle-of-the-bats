/**
 * SIGN IN AGAIN (Plans & pricing Stage 0, Part 10; drawn and ruled 2026-11-02, all 13 asks as recommended): the rule, the
 * clock and the words, framework-free so the server gate, the window and the tests read one copy.
 *
 * ⚖ THE RULE (Ask 1): a staff action asks for the password again when it changes MANY customers at once, or what EVERY
 * new customer pays. Today that is Bulk changes (all three actions, every run, Ask 2) and Approve & apply / Apply price on
 * a Production Stripe price request. Not Submit, not a Test request, not plan availability or trial days, and never a
 * one-customer action (Ask 10). A later door joins by the same rule (Campaigns "Send now" is drawn on its own, Ask 11).
 *
 * ⚖ THE CLOCK (Ask 3): 10 minutes from the last time THIS SESSION proved the password (a sign-in or this window), read
 * from the session's own sign-in record (the JWT's `amr` password entry), never the account's `last_sign_in_at`: that is
 * shared by every session on the account, so a copied session would pass the moment its owner signed in anywhere else.
 * A token refresh keeps the session's original entry, so an idle session goes stale on time.
 *
 * The honest limit (Ask 12): a browser that saves the password fills the window in. This defeats a copied session; the
 * owner's email is the alarm against someone at an unlocked computer. A second sign-in factor is its own project.
 * ⚠ It defeats a copied session only while that session cannot SET a new password itself: the sign-in service's
 * "Secure password change" (re-authentication before a password change) must be on in both projects, and nothing in
 * the repo records that it is (review 2026-11-02; an owner step in the build prompt's Part 10 notes).
 */

import { pluralize } from './utils';

/** How long a typed password counts, in minutes (Ask 3). */
export const SIGN_IN_AGAIN_MINUTES = 10;

/** The most accounts one Bulk changes run may reach; the screen says so before anyone types a password (Ask 13c). */
export const BULK_MAX_ACCOUNTS = 100;

/** The code a gated route answers with, so the screen knows to open the window rather than show an error. */
export const SIGN_IN_AGAIN_CODE = 'sign_in_again';

/** Why the window's password was not accepted: the route's `code`. */
export type SignInAgainRefusal = 'wrong_password' | 'too_many_tries' | 'not_checked';

/**
 * When this session last proved the password, in ms since the epoch, from the session's `amr` claim — or null when it
 * never did (a magic link, a recovery link, or a claim that is not there). Supabase writes the detailed form
 * (`[{ method: 'password', timestamp: <seconds> }]`); the bare RFC 8176 form (`['pwd']`) carries no time and so never counts.
 */
export function passwordEnteredAt(amr: unknown): number | null {
  if (!Array.isArray(amr)) return null;
  let latest: number | null = null;
  for (const entry of amr) {
    if (!entry || typeof entry !== 'object') continue;
    const { method, timestamp } = entry as { method?: unknown; timestamp?: unknown };
    if (method !== 'password' || typeof timestamp !== 'number' || !Number.isFinite(timestamp)) continue;
    const ms = timestamp * 1000;
    if (latest === null || ms > latest) latest = ms;
  }
  return latest;
}

/** Whether a password entered at `enteredAt` still counts at `now` (Ask 3). A time in the future does not count. */
export function isFreshPassword(enteredAt: number | null, now: number): boolean {
  if (enteredAt === null) return false;
  const age = now - enteredAt;
  return age >= 0 && age <= SIGN_IN_AGAIN_MINUTES * 60_000;
}

/** The words, as drawn (tabs 2–4). One home, so the window, both screens and the staff help never word it twice. */
export const SIGN_IN_AGAIN_WORDS = {
  bulkTitle: 'Sign in again to run this change',
  bulkConfirm: 'Sign in and run',
  bulkFoot: 'You get an email after it runs.',
  bulkLead: (accounts: number) =>
    `This changes ${pluralize(accounts, 'account')} at once, and your password was last entered more than ${SIGN_IN_AGAIN_MINUTES} minutes ago. The change runs as soon as it is accepted.`,
  priceTitle: 'Sign in again to switch this price',
  priceConfirm: 'Sign in and switch',
  priceFoot: 'You get an email after it is switched.',
  /** `who` "Club annual"; `amount` "$660.00 a year" when Stripe was read, else left out, never guessed (tab 4, note 4).
   *  No `priceId`: the request clears the slot. */
  priceLead: (who: string, priceId: string | null, amount: string | null) => (priceId
    ? `From now on, new ${who} customers are charged ${priceId}${amount ? ` (${amount})` : ''}.`
    : `From now on, new customers cannot buy ${who} until a price is set.`)
    + ' Customers on today’s price keep it. The switch is made as soon as your password is accepted.',
  checking: 'Checking…',
  password: 'Password',
  wrongPassword: 'That password doesn’t match. Nothing was changed.',
  tooManyTries: 'Too many tries. Wait a minute, then try again. Nothing was changed.',
  notChecked: 'Your password could not be checked just now. Nothing was changed. Try again in a moment.',
  /** What a gated route says if the screen ever shows it as an error (an old tab, a script). */
  refusal: 'Sign in again to continue. Nothing was changed.',
  /** The fixed sentences each screen shows beforehand, always (Ask 6). */
  bulkWarning: `Asks for your password if it was last entered more than ${SIGN_IN_AGAIN_MINUTES} minutes ago. The owner gets an email after it runs.`,
  priceWarning: `A Production price: asks for your password if it was last entered more than ${SIGN_IN_AGAIN_MINUTES} minutes ago, then emails the owner.`,
  /** The finish notice's last sentence (tabs 3 and 4; Ask 9). */
  ownerEmailed: 'The owner was emailed.',
  ownerNotEmailed: 'The email to the owner could not be sent. The change stands, and the audit log has it.',
} as const;

/** The audit log's rows for this step (tab 5; Asks 7 and 9). Labelled on the audit page. */
export const SIGN_IN_AGAIN_AUDIT = {
  signedIn: 'signed_in_again',
  wrongPassword: 'sign_in_again_wrong_password',
  ownerEmailNotSent: 'owner_email_not_sent',
} as const;
