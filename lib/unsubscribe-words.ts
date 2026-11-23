/**
 * The words of the unsubscribe confirm step (/unsubscribe), in one place for /marketing and /legal to edit.
 *
 * The footer link in an email opens a page that asks once; only its button unsubscribes (sweep 3, finding 7: mail scanners
 * pre-open links, and a plain visit must never opt anyone out). The "done", "link we cannot use" and "went wrong" states
 * are the existing /unsubscribe/confirmed page, unchanged.
 */
export const UNSUBSCRIBE_WORDS = {
  title: 'Unsubscribe from these emails?',
  button: 'Unsubscribe',
  /** Under the sentence: why the page asks, in a person's terms, and that closing it changes nothing. */
  note: 'Nothing changes until you press the button. If you opened this by mistake, just close the page.',
  // /legal 2026-11-11 (CASL_UNSUBSCRIBE_CONFIRM_STEP.md): say what stops, as "emails like the one you received", and never
  // promise more than the footer's opt-out suppresses.
  /** An organization's own address (the org-level footer). */
  org: (club: string) => `Press the button to stop emails like the one you received from FieldLogicHQ to ${club}.`,
  /** One person's account (a coach's campaign footer). */
  user: 'Press the button to stop emails like the one you received from FieldLogicHQ to your account.',
  /** One family address in one club ("Email families" footer). `email` arrives masked (maskEmail). */
  guardian: (club: string, email: string) => `Press the button to stop emails like the one you received from ${club} to ${email}.`,
  // Board Ready Stage 6 (mig 526): a club's sponsorship offers only. DRAFT for the /marketing pass.
  sponsor: (club: string, email: string) => `Press the button to stop sponsorship offers from ${club} to ${email}. Invoices and receipts for a sponsorship you have already agreed to still come.`,
} as const;
