/**
 * THE BANK TAB'S WORDS (Bank balance check BC1 — the club's Accounting › Bank; drawings
 * `BANK_BALANCE_CHECK_DRAWINGS.html` tabs 5 and 6, R0 tab 8). The screens' own words: the refusals a route answers live
 * in `lib/bank-check-words.ts` and are read from there, never restated here. Client-safe. BC2a's and BC2b's strings passed
 * `/marketing` 2026-11-06 (plan §5 records each). BC2a adds the check form's words (the band, the sums, Save, Start's
 * Stripe notice); BC2b adds the opened check's, Delete's and "Check this statement again".
 * Spelling follows the product (`check:spelling`): chequing (an account's name); a statement's entry is a "line"; a clock
 * only through `formatTime`.
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

  // The first check, when Stripe didn't answer: warn, never block (owner 2026-11-06, BC1 review M1). The saved start keeps
  // "not counted" so the checks after it can say why they may read off.
  startNoticeDown: 'Stripe didn’t answer, so online payments on their way aren’t counted yet.',
  startNoticeUnlisted: 'One of Stripe’s payouts doesn’t list what’s in it, so online payments on their way aren’t counted yet.',
  startNoticeWhy: 'Checks after this one may be off by those payments. You can try again in a few minutes, or start anyway.',
  tryAgain: 'Try again',
  startAnyway: 'Start anyway',

  // ── the check form (ask 10, tab 2): one card on the Bank tab, above the saved checks ──────
  checkTitle: 'Check a statement',
  checkBalance: 'Bank balance on that date',
  saveCheck: 'Save this check',
  saveOffNote: (amount: string) => `It saves as off by ${amount}. You can check this statement again later.`,
  replacesNote: 'This statement is checked already. Saving replaces that check.',
  figuring: 'Figuring this day…',
  figureFailed: 'The figures for that day couldn’t be loaded.',
  savedMatches: (date: string) => `Checked ${date}. The bank and your books agree.`,
  savedOff: (date: string, amount: string) => `Checked ${date}. It saved as off by ${amount}.`,
  saveFailed: 'The check couldn’t be saved.',
  balanceMissing: 'Enter the bank balance on the statement date.',
  // the band, and the sums under it (always open)
  bandBank: 'The bank says',
  bandShould: 'Should be in the bank',
  bandDifference: 'Difference',
  bandBankCaption: (date: string) => `Statement balance on ${date}`,
  bandShouldCaption: (date: string) => `Your books on ${date}, less what hasn’t reached the bank yet`,
  bandNoBalance: 'Type the balance to see it',
  bandMatches: (date: string) => `The bank and your books agree on ${date}.`,
  bandBankMore: (amount: string) => `The bank shows ${amount} more than your books.`,
  bandBankLess: (amount: string) => `The bank shows ${amount} less than your books.`,
  sumsTitle: 'How “Should be in the bank” is worked out',
  sumBooks: (date: string) => `Your books on ${date}`,
  sumOnItsWay: (n: number) => `Online payments on their way to your bank · ${n}`,
  sumPaysOut: (date: string) => `Stripe pays them out ${date}`,
  sumOnItsWayNone: 'Online payments on their way to your bank',
  railCard: 'card',
  railBank: 'bank',
  sumShould: 'Should be in the bank',
  show: 'Show',
  hide: 'Hide',
  notCounted: 'not counted',
  notCountedDown: 'Couldn’t reach Stripe, so online payments on their way aren’t counted. Try again in a few minutes.',
  notCountedUnlisted: 'One of Stripe’s payouts doesn’t list what’s in it, so online payments on their way aren’t counted.',
  childOut: (amount: string) => `${amount} out`,
  childFootPays: (date: string) => `Stripe pays these out on ${date}`,
  childFootNotYet: 'Stripe hasn’t put all of these in a payout yet',
  payoutsTab: 'Payouts tab',
  linesSinceMatch: (date: string, n: number) => `Lines since your last match (${date}): ${n}`,
  linesSinceStart: (date: string, n: number) => `Lines since your starting statement (${date}): ${n}`,

  // ── the account line and the saved checks (asks 4 and 6, tab 5) ───────────────────────────
  accountPill: 'Account',
  throughResult: (date: string, result: string) => `checked through ${date} · ${result}`,
  notChecked: 'not checked yet',
  // The top line (tab 2, ask 4): "Checked through {date}", and an amber "Off by $X" chip beside it when the latest is off.
  checkedThroughLead: 'Checked through',
  notCheckedLead: 'Not checked yet',
  matches: 'Matches',
  matchesWaiting: (n: number) => `Matches · ${plural(n, 'line')} not in the bank yet`,
  offBy: (amount: string) => `Off by ${amount}`,
  booksNowSay: (amount: string) => `Books now say ${amount}`,
  listTitle: 'Checked statements',
  listCol: { date: 'Statement date', bankSaid: 'The bank said', shouldHave: 'Should have been', result: 'Result', checkedBy: 'Checked by', open: 'Open' },
  startingPoint: 'Starting point',
  checkedCell: (who: string | null, when: string) => (who ? `${who} · ${when}` : when),
  cardTitle: (date: string, balance: string) => `${date} · ${balance}`,
  noChecksYet: 'No statements checked since the starting point yet.',
  // A start saved while Stripe didn't answer (BC2a's "Start anyway"): its row says so, so a later "Off by" has a reason.
  startNotCounted: 'online payments on their way weren’t counted',
  openCheck: (date: string) => `Open the check for ${date}`,
  openStart: (date: string) => `Open the starting statement for ${date}`,
  // The top line's chip is a door: its name keeps what it says (a label replaces a button's own text).
  openOffCheck: (amount: string, date: string) => `Off by ${amount}. Open the check for ${date}`,

  // ── a saved check, opened (ask 5, tab 5): a form window, 640 (the band) ──────────────────────────────
  savedEyebrow: (account: string) => `${account} · saved check`,
  savedTitle: (date: string) => `Statement ending ${date}`,
  startEyebrow: (account: string) => `${account} · starting point`,
  startTitle: (date: string) => `Starting statement · ${date}`,
  savedBank: 'The bank said',
  savedShould: 'Should have been',
  savedResult: 'Result',
  savedShouldTotal: 'Should have been in the bank',
  savedOnItsWay: 'Online payments on their way to your bank',
  savedNotCountedNote: 'Stripe didn’t answer when this was saved, so online payments on their way weren’t counted.',
  savedWaiting: (what: string) => `Not in the bank yet · ${what}`,
  savedCash: 'Cash not deposited yet',
  startBooks: 'Checks start from this balance',
  // No full stop of our own: the clock ends in one ("4:12 p.m.").
  checkedOn: (who: string | null, date: string, time: string) =>
    who ? `Checked by ${who} on ${date} at ${time}` : `Checked on ${date} at ${time}`,
  startedOn: (who: string | null, date: string, time: string) =>
    who ? `Started by ${who} on ${date} at ${time}` : `Started on ${date} at ${time}`,
  booksNowSayWhy: (date: string) => `A line dated on or before ${date} changed after this check was saved. This check’s figures stay as they were.`,
  checkAgain: 'Check this statement again',
  deleteCheck: 'Delete this check',
  deleteStart: 'Delete the starting statement',
  deleteTitle: 'Delete this check?',
  deleteStartTitle: 'Delete the starting statement?',
  deleteAsk: (date: string) => `Delete the check for ${date}? Its figures go; who deleted it and when is kept.`,
  deleteStartAsk: (date: string) => `Delete the starting statement for ${date}? Checking this account starts again from a statement you pick. Who deleted it and when is kept.`,
  deleteKeep: 'Keep it',
  deleteYes: 'Delete',
  deleting: 'Deleting…',
  deleteFailed: 'The check couldn’t be deleted.',
  deleted: (date: string) => `The check for ${date} is deleted.`,
  deletedStart: (date: string) => `The starting statement for ${date} is deleted. Start again from a statement.`,

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
