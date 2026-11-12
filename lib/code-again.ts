/**
 * "TYPE YOUR CODE AGAIN" — the one window's codes and words (Board Ready · two-step sign-in, Part 2; owner rulings
 * 2026-11-11, plan BOARD_READY_PLAN.md §5 Stage 0a "Part 2"). Client-safe: the server's refusals, the shared window
 * (components/shared/CodeAgainWindow.tsx), the product-wide listener (components/shared/CodeAgainProvider.tsx) and the
 * tests read this one copy.
 *
 * ⚖ The rule (ask 4): six actions ask for a code when this session last proved one more than 15 minutes ago — payout or
 * bank details (every button that hands out a Stripe link where the bank account can change), adding an owner or admin
 * (and staff's two member-power doors), resetting someone's two-step (Part 3's door), turning your own off, new backup
 * codes, and setting up a new phone (tab 5's note). A person with two-step off is never asked: there is no code to type.
 * Recording a payment never asks.
 *
 * ⚖ One window for both asks (call 4): the 15-minute actions (`two_step_fresh_code`) and the 30-day re-ask on a page that
 * was already open (`two_step_code`, from the shared sign-in check). The press is sent again once, after the code.
 * A refusal to SET IT UP (`two_step_set_up`) cannot be answered in a window; the listener shows a notice with the link.
 */

/** A route's refusal when the session's last code is older than 15 minutes. */
export const TWO_STEP_FRESH_CODE = 'two_step_fresh_code';
/** The shared sign-in check's refusals (lib/two-step-gate.ts TWO_STEP_REFUSAL), repeated here client-safe. */
export const TWO_STEP_CODE_REFUSAL = 'two_step_code';
export const TWO_STEP_SET_UP_REFUSAL = 'two_step_set_up';

/** The refusals the window answers in place. */
export const CODE_AGAIN_REFUSALS: readonly string[] = [TWO_STEP_FRESH_CODE, TWO_STEP_CODE_REFUSAL];

/** Where the window checks a code (or a backup code) for everyone but staff's "sign in again". */
export const CODE_AGAIN_ROUTE = '/api/auth/two-step/code-again';

/** Why the window's code was not accepted (the check route's `code`). */
export type CodeAgainRefusal = 'wrong_code' | 'wrong_backup_code' | 'no_authenticator' | 'too_many_tries' | 'not_checked';

/** What the window takes: the app's six digits, a backup code, or (staff on dev with no authenticator only) the password. */
export type CodeAgainProof = { code: string } | { backupCode: string } | { password: string };

/** The words, drafts for Part 4's copy pass. One home. */
export const CODE_AGAIN_WORDS = {
  freshTitle: 'Type your code to continue',
  freshLead: 'For your security, this needs a fresh code from your authenticator app. You last typed one more than 15 minutes ago.',
  reaskTitle: 'Type your code to keep going',
  reaskLead: 'It’s been 30 days since you last typed a code on this device. Type the one your authenticator app shows now.',
  confirm: 'Continue',
  checking: 'Checking…',
  codeLabel: 'Code',
  codePlaceholder: '6-digit code',
  backupLabel: 'Backup code',
  backupPlaceholder: 'XXXX-XXXX',
  useBackup: 'Use a backup code',
  useApp: 'Use my authenticator app',
  backupLead: 'Type one of the codes you saved when you set up two-step sign-in. It works once.',
  wrongCode: 'That code didn’t work. The codes change every 30 seconds. Type the one showing now.',
  wrongBackup: 'That backup code didn’t work. Each code works once.',
  noAuthenticator: 'Your old phone was removed while you set up a new one. Use a backup code, then finish the set-up.',
  tooManyTries: 'Too many tries. Wait 15 minutes, then try again.',
  notChecked: 'We couldn’t check that just now. Try again in a moment.',
  backupLeft: (left: number) => `That backup code won’t work again. You have ${left} left.`,
  setUpNotice: 'Set up two-step sign-in to continue.',
  setUpLink: 'Set it up',
} as const;
