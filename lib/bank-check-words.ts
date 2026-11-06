/**
 * THE BANK CHECK'S REFUSALS, IN WORDS (Bank balance check BC1). Every bank route answers a refusal as a CODE the screens
 * switch on (never prose-parsed) plus one sentence from here. One home so the screens and the stage's `/marketing` pass
 * read and settle the same words (plan §5). Client-safe.
 *
 * The codes are mig 447's step codes (`bank_check_save`, `bank_check_delete`, `bank_book_move`, `bank_account_add`) plus
 * the routes' own request checks. Drafts, not ruled: §5 words are settled once per stage before its walk. Spelling follows
 * the product (`check:spelling`).
 */

export const BANK_REFUSAL = {
  account_not_found: 'That bank account isn’t one of this club’s.',
  org_not_found: 'That club wasn’t found.',
  check_not_found: 'That check isn’t on this account.',
  book_not_found: 'That book isn’t one of this club’s.',
  team_book: 'A team’s book is kept by its coaches, so it can’t be in the club’s bank account.',
  bad_name: 'Name the account in 80 characters or fewer. A name only, never the account number.',
  name_taken: 'The club already has an account with that name.',
  bad_figures: 'Enter the statement date and the bank balance on that date.',
  bad_kind: 'That kind of check can’t be saved here.',
  bad_amount: 'Enter the cash not deposited yet as an amount above $0.00, or leave it empty.',
  bad_date: 'Enter the date as it reads on the statement.',
  bad_item: 'A line marked Not in the bank yet must be a line in this account’s books, dated on or before the statement.',
  ends_in_future: 'A statement can’t be dated after today. Enter the date printed on it.',
  changed: 'Something in this account changed while you were looking. Here it is again.',
  start_exists: 'This account already starts from a statement on another date.',
  start_after_checks: 'A later statement is already checked, so the start can’t move after it.',
  no_start: 'Start checking this account from a statement first.',
  before_start: 'This statement is on or before the one you started from. Check a later statement.',
  start_has_checks: 'Later checks start from this statement, so it can’t be deleted. Delete them first.',
  // Stripe failed between the screen's read and the save's own (warn, never block, decided by the server, BC2 review):
  // the screen shows the figure without online payments, and saving it is the treasurer's choice.
  not_counted_down: 'Stripe didn’t answer just now, so online payments on their way can’t be counted. Look over the figures again, then save.',
  not_counted_unlisted: 'One of Stripe’s payouts doesn’t list what’s in it, so online payments on their way can’t be counted. Look over the figures again, then save.',
} as const;

export type BankRefusalCode = keyof typeof BANK_REFUSAL;
