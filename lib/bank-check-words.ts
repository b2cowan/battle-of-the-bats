/**
 * THE BANK CHECK'S REFUSALS, IN WORDS (Bank reconciliation R2b). Every bank route answers a refusal as a CODE the
 * screens switch on (never prose-parsed) plus one sentence from here. One home so R2c's screens and R3's `/marketing`
 * pass read and settle the same words (plan §5). Client-safe.
 *
 * Drafts, not ruled: §5 words are settled in R3. Spelling follows the product (`check:spelling`).
 */

export const BANK_REFUSAL = {
  account_not_found: 'That bank account isn’t one of this club’s.',
  org_not_found: 'That club wasn’t found.',
  check_not_found: 'That statement isn’t on this account.',
  book_not_found: 'That book isn’t one of this club’s.',
  team_book: 'A team’s book is kept by its coaches, so it can’t be in the club’s bank account.',
  book_not_in_account: 'That book’s money isn’t in this account. Choose one of this account’s books.',
  bad_name: 'Name the account in 80 characters or fewer. A name only, never the account number.',
  name_taken: 'The club already has an account with that name.',
  bad_start: 'Enter the starting date and the bank balance on that date.',
  bad_item: 'Each line still outstanding needs a date, an amount and what it was.',
  item_not_in_books: 'A line picked as still outstanding must be from this account’s books, dated on or before the starting date.',
  statements_exist: 'A statement already starts from this starting point, so it can’t change. Undo the checks first.',
  not_set_up: 'Set the account’s starting point first.',
  one_is_open: 'Finish the statement you’re checking first.',
  ends_too_early: 'A statement must end after the last one.',
  ends_in_future: 'A statement can’t end after today. Enter the end date printed on it.',
  starts_in_future: 'The starting date can’t be after today. Use the end date of a statement you already have.',
  ends_out_of_order: 'That end date would put this statement before the one ahead of it or after the next one.',
  checked_figures_fixed: 'A checked statement’s figures don’t change. Undo the check, then enter them again.',
  later_checked: 'A later statement is checked and starts from this one. Undo that check first.',
  bad_figures: 'Enter the statement’s end date and its ending balance.',
  not_open: 'This statement is checked. Undo the check to change what’s ticked on it.',
  not_outstanding: 'That line isn’t waiting to be ticked on this statement.',
  not_a_line: 'A Stripe payout goes through the bank, so it can’t be kept out.',
  earlier_open: 'An earlier statement is open. Check the statements oldest first.',
  not_zero: 'The difference must be $0.00 first.',
  not_checked: 'This statement isn’t checked.',
  nothing_changed: 'Nothing has changed since this statement was checked.',
  not_latest: 'Only the latest checked statement can be undone.',
  reason_required: 'Say why, in 500 characters or fewer. It’s kept with your name and the time.',
  changed: 'Something on this statement changed while you were looking. Here it is again.',
  ticked_elsewhere: 'One of these lines is ticked on another statement.',
  bad_kind: 'Choose a bank fee or interest.',
  bad_amount: 'Enter an amount above $0.00.',
  bad_date: 'Enter the date as it reads on the statement.',
  no_processing_gap: 'This payout has no Stripe fee the books are missing.',
  gap_not_a_fee: 'This payout’s difference isn’t a fee: it’s money Stripe is holding or activity that isn’t from FieldLogicHQ.',
  payouts_unavailable: 'Stripe didn’t answer, so payouts can’t be read right now. Try again in a minute.',
} as const;

export type BankRefusalCode = keyof typeof BANK_REFUSAL;

/** The line a bank-fee helper writes, in the book (what the treasurer reads later in the Ledger). */
export const BANK_LINE_WORDS = {
  bank_fee: 'Bank fee',
  interest: 'Interest',
  payment_processing: 'Payment processing',
  /** A payout gap's line: "Payment processing · Stripe payout, Mar 14, 2026". */
  processingFor: (payoutLabel: string) => `Payment processing · ${payoutLabel}`,
} as const;
