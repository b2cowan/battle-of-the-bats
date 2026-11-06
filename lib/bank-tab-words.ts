/**
 * THE BANK TAB'S WORDS (Bank balance check BC1 — the club's Accounting › Bank; drawings
 * `BANK_BALANCE_CHECK_DRAWINGS.html` tabs 5 and 6, R0 tab 8). The screens' own words: the refusals a route answers live
 * in `lib/bank-check-words.ts` and are read from there, never restated here. Client-safe. Every string is a DRAFT for the
 * stage's `/marketing` pass (plan §5 records each). BC1 keeps the words of what BC1 still draws; BC2 adds the check's.
 * Spelling follows the product (`check:spelling`): cheque, chequing; a clock only through `formatTime`.
 */
import { pluralize as plural } from './utils';

export const BANK_WORDS = {
  loading: 'Loading the bank…',
  loadingAccount: 'Loading the account…',
  setupReader: 'The club’s bank account isn’t set up yet. Someone who can move the club’s money starts it here.',
  loadFailed: 'The bank couldn’t be loaded.',
  connection: 'Check your connection and try again.',

  // ── the first check: a starting statement (ask 7, tab 6) ─────────────────────────────────
  setupTitle: 'Start checking the club’s bank account',
  setupTitleFor: (account: string) => `Start checking ${account}`,
  setupLead: 'Pick a bank statement you already have and type its date and ending balance. Checks start from there.',
  accountName: 'Account name',
  accountNamePlaceholder: 'For example: Club chequing',
  accountNameHint: 'A name only. Never the account number.',
  booksLabel: 'Books in this account',
  booksHintFirst: 'All of the club’s books, to start. You can add a second account later and move a book to it. Teams keep their own accounts.',
  statementDate: 'Statement date',
  statementBalance: 'Bank balance on that date',
  startHere: 'Start here',
  saving: 'Saving…',
  setupFailed: 'The starting statement couldn’t be saved.',
  setupMissing: 'Enter the account name, the statement date and the bank balance on that date.',

  // ── the account line and the saved checks (asks 4 and 6, tab 5) ───────────────────────────
  accountPill: 'Account',
  throughResult: (date: string, result: string) => `checked through ${date} · ${result}`,
  notChecked: 'not checked yet',
  matches: 'Matches',
  matchesWaiting: (n: number) => `Matches · ${plural(n, 'line')} not in the bank yet`,
  offBy: (amount: string) => `Off by ${amount}`,
  booksNowSay: (amount: string) => `Books now say ${amount}`,
  listTitle: 'Checked statements',
  listCol: { date: 'Statement date', bankSaid: 'The bank said', shouldHave: 'Should have been', result: 'Result', checkedBy: 'Checked by' },
  startingPoint: 'Starting point',
  checkedCell: (who: string | null, when: string) => (who ? `${who} · ${when}` : when),
  cardTitle: (date: string, balance: string) => `${date} · ${balance}`,
  noChecksYet: 'No statements checked since the starting point yet.',

  // ── a second account (R0 tab 8; Q3) ──────────────────────────────────────────────────────
  addAccount: 'Add an account',
  editAccount: 'Name and books',
  eyebrow: (account: string) => `Bank · ${account}`,
  eyebrowBank: 'Bank',
  addAccountTitle: 'Add an account',
  editAccountTitle: 'Name and books',
  bookIn: (account: string) => `in ${account}`,
  bookMoves: (account: string) => `moves from ${account}`,
  bookNowhere: 'in no account yet',
  movesKeepEarlier: 'Saved checks keep the books they counted. The next check of each account counts this book where it is now.',
  booksHere: 'A book listed here keeps its money in this account. To move one out, open the account it should be in.',
  addAndStart: 'Add and start it',
  addAccountFailed: 'The account couldn’t be added.',
  editAccountFailed: 'The account couldn’t be saved.',
  nameMissing: 'Enter the account name.',
  cancel: 'Cancel',
  save: 'Save',
  added: (name: string) => `${name} is added. Start it from a statement.`,
  saved: 'Saved.',
} as const;
