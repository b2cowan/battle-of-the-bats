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
  bad_figures: 'Enter a date and a balance.',
  bad_kind: 'That kind of check can’t be saved here.',
  bad_amount: 'Enter the cash not deposited yet as an amount above $0.00, or leave it empty.',
  bad_date: 'Enter the date as a day, month and year.',
  // M3 (owner 2026-11-06): on or after the day checking started (strictly after the start row's day) — the start already proved an earlier line was in the bank.
  bad_item: 'A line marked Not in the bank yet has to be one of this account’s own lines, dated on or after the day checking started and no later than the day you’re checking.',
  // Waiting at the start (Q2-A): the other date rule, so its own sentence (BC3b /marketing).
  bad_start_item: 'To wait at the start, a line has to move money in or out of this account, be dated before checking started, and not be waiting there already. Online payments can’t wait at the start.',
  // S1 (A1a): the check form asks for a day, not a statement's date.
  ends_in_future: 'A check can’t be dated after today.',
  changed: 'Something in this account changed while you were looking. Here it is again.',
  start_exists: 'This account already has a starting balance on another date.',
  start_after_checks: 'A balance check is already saved before that day. Pick an earlier day.',
  no_start: 'Give this account a starting balance first.',
  // S1b: the check form asks for a day (S1, A1a); the start is named by the day checking starts.
  before_start: 'That day is before checking started. Pick a later day.',
  start_has_checks: 'Later checks start from this balance, so it can’t be deleted. Delete them first.',
  // Stripe failed between the screen's read and the save's own (warn, never block, decided by the server, BC2 review):
  // the screen shows the figure without online payments, and saving it is the treasurer's choice.
  // Settled, BC3b /marketing 2026-11-06. The screen reads the figure again without them, so the sentence says it does.
  not_counted_down: 'Stripe didn’t answer just now, so online payments on their way aren’t counted. The figures now leave them out. Look them over, then save, or try again in a few minutes.',
  not_counted_unlisted: 'One of Stripe’s payouts doesn’t list what’s in it, so online payments on their way aren’t counted. The figures now leave them out. Look them over, then save.',
  // ── a team's (BC6a, lib/bank-coach-rules.ts): drafts, settled by BC8's /marketing ──
  // O5: a coach's books start from the season's opening balance, so an earlier statement belongs to last season. ⚠ Not
  // "check it from last season": a closed season is one page and shows nothing of the bank (B9). The screen names the day
  // ("Any day this season, from {date} to today."; S1, A1a: a day, not a statement).
  before_season: 'That day is before the season started. Pick a day from this season.',
  bad_team_item: 'A line marked Not in the bank yet has to be one of the team’s own money lines, dated on or before the day you’re checking.',
} as const;

export type BankRefusalCode = keyof typeof BANK_REFUSAL;
