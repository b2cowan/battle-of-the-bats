/**
 * THE BANK TAB'S WORDS (Bank balance check BC1 — the club's Accounting › Bank; drawings
 * `BANK_BALANCE_CHECK_DRAWINGS.html` tabs 5 and 6, R0 tab 8). The screens' own words: the refusals a route answers live
 * in `lib/bank-check-words.ts` and are read from there, never restated here. Client-safe. BC2a's and BC2b's strings passed
 * `/marketing` 2026-11-06 (plan §5 records each). BC2a adds the check form's words (the band, the sums, Save, Start's
 * Stripe notice); BC2b adds the opened check's, Delete's and "Check this statement again". BC4b's phone words (the
 * `…Phone` keys: the balance label, the band's middle label and captions, Find's group head) passed `/marketing` 2026-11-06.
 * Spelling follows the product (`check:spelling`): chequing (an account's name); a statement's entry is a "line"; a clock
 * only through `formatTime`.
 */
import { pluralize as plural } from './utils';

/** The season windows' verb (BC8a; S1 rows 16 + A15). Both windows close this season, so the reason is one sentence. */
const seasonVerb = {
  start: 'start the new season',
  close: 'close the season',
} as const;
const seasonPrint = 'Print any check you want to keep first, from a computer: a closed season has no balance check.';

export const BANK_WORDS = {
  loading: 'Loading the bank…',
  loadingAccount: 'Loading the account…',
  setupReader: 'The club’s bank account isn’t set up yet. Someone who can move the club’s money starts it here.',
  loadFailed: 'The bank couldn’t be loaded.',
  connection: 'Check your connection and try again.',

  // ── the first check: a starting balance (ask 7, tab 6) ─────────────────────────────────
  // ⚖ Owner 2026-11-08: the card asks for the FIRST statement to check, its first day and opening balance (both printed at
  // the top of a statement), and then checks that same statement. So the start is named a starting BALANCE everywhere a
  // treasurer reads it, dated the day checking starts: "since your starting statement" read as "after it" and skipped it.
  setupTitle: 'Start checking the club’s bank account',
  setupTitleFor: (account: string) => `Start checking ${account}`,
  // Row 17 (A17; /marketing S1b): which statement, where its two figures are, and the boundary. It suggests no particular
  // statement (owner: the year's first or the most recent, "fine either way"); help says the year's first checks the year.
  setupLead: 'Pick the first bank statement you want to check. Type the day it starts and its opening balance, both printed at the top. Nothing dated before that day is compared with the bank.',
  statementStart: 'Statement starts on',
  // After the start: the check form opens on that same statement, the date empty (owner ask B: no guessed month-end), and
  // this line where the restore line sits; the banking-app hint waits while it shows (ask C). Gone at the first save.
  afterStart: (date: string) => `Checking starts ${date}. Now check that same statement: type its end date and ending balance.`,
  accountName: 'Account name',
  accountNamePlaceholder: 'For example: Club chequing',
  accountNameHint: 'A name only. Never the account number.',
  booksLabel: 'Books in this account',
  booksHintFirst: 'All of the club’s books, to start. You can add a second account later and move a book to it. Teams keep their own accounts.',
  openingBalance: 'Opening balance',
  startHere: 'Start here',
  saving: 'Saving…',
  setupFailed: 'The starting balance couldn’t be saved.',
  setupMissing: 'Enter the account name, the day the statement starts and its opening balance.',
  startAfterToday: 'A statement can’t start after today.',

  // The first check, when Stripe didn't answer: warn, never block (owner 2026-11-06, BC1 review M1). The saved start keeps
  // "not counted" so the checks after it can say why they may read off.
  startNoticeDown: 'Stripe didn’t answer, so online payments on their way aren’t counted yet.',
  startNoticeUnlisted: 'One of Stripe’s payouts doesn’t list what’s in it, so online payments on their way aren’t counted yet.',
  startNoticeWhy: 'Checks after this one may be off by those payments. You can try again in a few minutes, or start anyway.',
  tryAgain: 'Try again',
  startAnyway: 'Start anyway',

  // ── the check form (ask 10, tab 2): one card on the Bank tab, above the saved checks ──────
  // Bank check novice UX S1 (plan BANK_CHECK_NOVICE_UX_PLAN.md, `/marketing` 2026-11-08): a volunteer checks a banking app,
  // not a paper statement, so the card asks for a day's balance (A1a; bends BC2a's "Check a statement", owner-ruled).
  checkTitle: 'Check your bank balance',
  // A4: what the card is for, always, under the heading. It promises no more than a balance check can do (two mistakes
  // can cancel), so it says the Ledger / the books are taken as they are.
  checkPurpose: 'Type the balance your bank shows. If it matches your books, you’re in step with the bank. If not, we’ll help you look for the difference. It takes what’s in your books as correct.',
  checkDate: 'Date',
  checkBalance: 'Bank balance on that date',
  // On a phone the two fields sit side by side (drawn, owner 2026-11-06 BC4b): the short word.
  checkBalancePhone: 'Bank balance',
  // Row 6: which of the app's balances, until one is typed. "Pending" is the bank's here; row 19 bridges the Ledger's.
  balanceHint: 'Use the posted balance your banking app shows, with pending transactions left out.',
  saveCheck: 'Save this check',
  // Row 10: no amount (the Difference tile above shows it); the draft's resting sentence follows it unchanged (S7's).
  saveOffNote: 'You can save this check while it’s off and check again later. Saving changes nothing in your books.',
  // Row 21: one neutral line, right after a save too (the notice already says "Checked {date}…").
  replacesNote: (date: string) => `${date} is checked already. Saving again replaces that check.`,
  figuring: 'Figuring this day…',
  figureFailed: 'The figures for that day couldn’t be loaded.',
  savedMatches: (date: string) => `Checked ${date}. The bank and your books agree.`,
  savedOff: (date: string, amount: string) => `Checked ${date}. It saved as off by ${amount}.`,
  saveFailed: 'The check couldn’t be saved.',
  balanceMissing: 'Enter the bank balance on that date.',
  // the band, and the sums under it (always open)
  bandBank: 'The bank says',
  bandShould: 'Should be in the bank',
  // The phone band's middle tile, two-up beside "The bank says" (plan §5, BC4b).
  bandShouldPhone: 'Should be there',
  // The phone band's two-up captions (BC4b `/marketing`): the statement date is in the field above, so no year. The middle
  // tile names no figure: marked lines and an uncounted Stripe make a single "on its way" amount untrue; the sums say it.
  bandBankCaptionPhone: (date: string) => `On ${date}`,
  bandShouldCaptionPhone: 'Your books, adjusted for what’s pending',
  bandDifference: 'Difference',
  // The typed field's own words (drawing D1, S1): no statement implied.
  bandBankCaption: (date: string) => `Bank balance on ${date}`,
  // Row 9 (S1b /marketing): names where the figure starts, which is why it isn't the Overview's Cash on hand; "adjusted",
  // since an uncashed cheque is added back. The day being checked is in the first tile's caption already.
  bandShouldCaption: (started: string) => `Starting balance plus every change in your books since ${started}, adjusted for what hasn’t reached the bank yet`,
  bandNoBalance: 'Type the balance to see it',
  bandMatches: (date: string) => `The bank and your books agree on ${date}.`,
  bandBankMore: (amount: string) => `The bank shows ${amount} more than your books.`,
  bandBankLess: (amount: string) => `The bank shows ${amount} less than your books.`,
  sumsTitle: 'How “Should be in the bank” is worked out',
  sumBooks: (date: string) => `Your books on ${date}`,
  sumOnItsWay: (n: number) => `Online payments on their way to your bank · ${n}`,
  // Row 22: the name stays (eight strings, two rails); only the date line loses "Stripe pays them out" (S1 `/marketing`:
  // a payout date is an estimate, and "due" is the dues word).
  sumPaysOut: (date: string) => `expected ${date}`,
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
  childFootPays: (date: string) => `These are expected on ${date}`,
  childFootNotYet: 'Stripe hasn’t put all of these in a payout yet',
  payoutsTab: 'Payouts tab',
  linesSinceMatch: (date: string, n: number) => `Lines since your last match (${date}): ${n}`,
  linesSinceStart: (date: string, n: number) => `Lines since checking started (${date}): ${n}`,

  // ── Find (BC3a, drawing tab 3; the half, combination, bank-less and Still waiting sentences are NOT drawn): settled,
  // BC3b /marketing 2026-11-06. Amber, never red; a direction in words, never a minus sign.
  findTitle: (amount: string) => `Find the ${amount}`,
  showThem: 'Show them',
  hideThem: 'Hide them',
  // The callout: the line in bold, its date in brackets, then one of these.
  hintDate: (date: string) => `(${date})`,
  lineUnnamed: 'A line',
  hintExactOut: (amount: string) => `is exactly ${amount}. If the bank hasn’t cashed it yet, that’s the gap.`,
  hintExactIn: (amount: string) => `is exactly ${amount}. If the bank hasn’t received it yet, that’s the gap.`,
  // Under a possibility it opens with "Or"; with nothing to name it stands alone (`alone`).
  hintOrMore: (amount: string, alone = false) => `${alone ? 'The' : 'Or the'} bank received ${amount} your books don’t have: a deposit or interest you haven’t entered.`,
  hintOrLess: (amount: string, alone = false) => `${alone ? 'The' : 'Or the'} bank took out ${amount} your books don’t have: a fee or a payment you haven’t entered.`,
  hintHalf: (lineAmount: string, amount: string) => `is ${lineAmount}, half of the ${amount} gap. Was it entered the wrong way round?`,
  // The coach card's own verb (owner 2026-11-07, Bank check WD3): the coach reads these beside "+ Record" and Money's
  // "Record money", so "recorded"; the club keeps its Ledger's "entered" in the three above.
  // S1 row 8: the coach card's one noun, "your Ledger".
  coachHintOrMore: (amount: string, alone = false) => `${alone ? 'The' : 'Or the'} bank received ${amount} your Ledger doesn’t have: a deposit or interest you haven’t recorded.`,
  coachHintOrLess: (amount: string, alone = false) => `${alone ? 'The' : 'Or the'} bank took out ${amount} your Ledger doesn’t have: a fee or a payment you haven’t recorded.`,
  coachHintHalf: (lineAmount: string, amount: string) => `is ${lineAmount}, half of the ${amount} gap. Was it recorded the wrong way round?`,
  hintCombo: (n: number, amount: string) => `These ${n} add up to ${amount}:`,
  hintComboOut: 'If the bank hasn’t cashed them yet, that’s the gap.',
  hintComboIn: 'If the bank hasn’t received them yet, that’s the gap.',
  and: 'and',
  hintNext: 'Next possibility',
  hintCount: (at: number, n: number) => `${at} of ${n}`,
  noLinesSince: 'No lines in your books since then.',
  noLinesMatch: 'No line matches that search.',
  // The lines (the suspects)
  findSinceMatch: (date: string) => `Lines since your last match · ${date}`,
  findSinceStart: (date: string) => `Lines since checking started · ${date}`,
  // The phone's group head over the cards (an uppercase band, BC4b `/marketing`): no "Lines", no year.
  findSinceMatchPhone: (date: string) => `Since your last match · ${date}`,
  findSinceStartPhone: (date: string) => `Since checking started · ${date}`,
  findSearch: 'Find an amount or a name',
  findCol: { date: 'Date', what: 'What', book: 'Book', out: 'Money out', in: 'Money in', act: 'Action' },
  chipExact: (amount: string) => `Exactly ${amount}`,
  chipHalf: (amount: string) => `Half of ${amount}`,
  chipCombo: (amount: string) => `Part of ${amount}`,
  // A chip is a door: it brings its possibility into the callout (every highlight is clickable).
  chipOpen: (chip: string) => `${chip}. Show this possibility`,
  notInBankYet: 'Not in the bank yet',
  markLine: (what: string) => `Not in the bank yet: ${what}`,
  onTheirWayRow: (n: number) => `Online payments · ${n}`,
  onTheirWayDetail: 'on their way, counted above',
  booksCount: (n: number) => `${n} books`,
  markedDetail: 'not in the bank yet, counted above',
  undo: 'Undo',
  undoLine: (what: string) => `Undo marking ${what} as not in the bank yet`,
  showMore: (n: number) => `Show ${n} more`,
  // Ask 2: the next check asks once about each of the previous check's items.
  stillWaiting: (what: string) => `Still waiting on ${what}?`,
  yes: 'Yes',
  no: 'No',
  stillYes: (what: string) => `Yes, still waiting on ${what}`,
  stillNo: (what: string) => `No, ${what} is in the bank now`,

  // ── work it down to zero (WD1; plan BANK_CHECK_WORKING_DRAFT_PLAN.md §4b, settled with /marketing 2026-11-07). A button
  // is named after the window it opens, in each portal's own words: the club's Ledger "Add an entry", the coach's Money
  // "Record money" ("entry" in the coaches portal is a tournament entry, so it is never used there). The coach's two keys
  // (WD2) come first, then the club's two; the restore line, Start over, "Started off by", the resting sentence and the
  // dropped-mark callout are both portals'. ──
  // The coach card's heading-row button, and its gap door (renamed from "Add the missing line": the Record money window,
  // filled with the gap, the statement's day and the direction).
  record: 'Record',
  recordMissingAmount: 'Record the missing amount',
  addEntry: 'Add entry',
  addMissingEntry: 'Add the missing entry',
  // S1 row 19: under Status in the Ledger's Add an entry window, when the Bank tab opened it (only posted lines reach the
  // check's figure; a bank fee left Pending would keep the check off).
  addEntryStatusHint: 'Choose Posted for a fee the bank has already taken. Pending entries aren’t counted in a balance check.',
  draftPickedUp: 'Picked up where you left off',
  // Only when the draft is from an earlier day; the date through the shipped date helper.
  draftPickedUpOn: (date: string) => `Picked up where you left off · last worked on ${date}`,
  startOver: 'Start over',
  startedOffBy: (amount: string) => `Started off by ${amount}`,
  draftKept: 'Kept in this browser only, until you save this check or sign out.',
  // A restored mark the books no longer offer: dropped, never silently kept.
  draftDropped: (n: number) => (n === 1
    ? 'One line you marked isn’t in your books any more, so we took it off.'
    : `${n} lines you marked aren’t in your books any more, so we took them off.`),
  // Q2-A "Waiting at the start": a line of the 60 days before checking started, on an off check within six months of it.
  atStart: 'Waiting at the start',
  atStartLine: (what: string) => `Waiting at the start: ${what}`,
  // A condition, not a claim about every row under it (/design); either direction (a deposit can wait at the start too).
  atStartWhy: 'If one of these was dated before checking started but reached the bank after it, mark it Waiting at the start.',
  beforeStartTitle: (date: string) => `Before checking started · ${date}`,
  hintAtStart: (amount: string) => `is exactly ${amount} and dated before checking started. If it reached the bank after that, that’s the gap.`,
  atStartDone: (what: string) => `${what} is waiting at the start. Checks from now on start from the corrected balance.`,
  atStartFailed: 'The starting balance couldn’t be corrected.',
  // The start's window: its items, who put each one there, and the way back.
  savedAtStart: (what: string) => `Waiting at the start · ${what}`,
  // Under the line's own row, so it doesn't repeat the line (/design); "Marked": they marked it, they didn't enter it.
  atStartAdded: (who: string | null, date: string) => (who ? `Marked by ${who} on ${date}.` : `Marked on ${date}.`),
  takeOff: 'Take it off',
  takeOffLine: (what: string) => `Take ${what} off the starting balance`,
  takenOff: (what: string) => `${what} is off the starting balance.`,
  booksNowSayStartWhy: 'The starting balance was corrected after this check was saved. This check’s figures stay as they were.',

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
  // The Accounting Overview's line, right of "Where the club stands" (BC5a, ask 4, R0 tab 7): "Bank: {account} checked
  // through {date} ›" · "Bank: {account} · not checked yet ›" · "Bank: not checked yet ›" (no account). BC5b's /marketing.
  overviewLead: 'Bank:',
  overviewThrough: 'checked through',
  overviewNotChecked: '· not checked yet',
  overviewNoAccount: 'not checked yet',
  // Bank check novice UX S2 (A3, words row 2): until the first check the Overview line INVITES, in both portals (one spelling
  // for one state, BC8b), and the quiet line under it says what the check is for. After the first check, the line above.
  // Only for someone who can check: a reader keeps "Bank: not checked yet ›". Several accounts, some never checked, keep
  // their count ("1 of 3 not checked yet"): an invitation would hide it.
  inviteLead: 'Check your bank balance',
  inviteNote: 'Type what the bank shows to see if you’re in step.',
  // Row 20 (S2): a quiet link at the end of the Bank view's head line, both portals, opening the bank help article.
  helpLink: 'How the bank check works',
  booksNowSay: (amount: string) => `Books now say ${amount}`,
  // Row 13 (A1b): the list drops "statement"; "Balance checks", not a bare "Checks" (it would read as cheques: A2's reason).
  listTitle: 'Balance checks',
  listCol: { date: 'Date', bankSaid: 'The bank said', shouldHave: 'Should have been', result: 'Result', checkedBy: 'Checked by', open: 'Open' },
  // Row 14 (S1b): the start's row, dated the day checking starts.
  startingPoint: 'Starting balance',
  checkedCell: (who: string | null, when: string) => (who ? `${who} · ${when}` : when),
  cardTitle: (date: string, balance: string) => `${date} · ${balance}`,
  noChecksYet: 'No balance checks yet.',
  // A start saved while Stripe didn't answer (BC2a's "Start anyway"): its row says so, so a later "Off by" has a reason.
  startNotCounted: 'online payments on their way weren’t counted',
  openCheck: (date: string) => `Open the check for ${date}`,
  openStart: (date: string) => `Open the starting balance for ${date}`,
  // The top line's chip is a door: its name keeps what it says (a label replaces a button's own text).
  openOffCheck: (amount: string, date: string) => `Off by ${amount}. Open the check for ${date}`,

  // ── a saved check, opened (ask 5, tab 5): a form window, 640 (the band) ──────────────────────────────
  savedEyebrow: (account: string) => `${account} · saved check`,
  savedTitle: (date: string) => `The check for ${date}`,
  startEyebrow: (account: string) => `${account} · starting balance`,
  startTitle: (date: string) => `Starting balance · ${date}`,
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
  checkAgain: 'Check this date again',
  deleteCheck: 'Delete this check',
  deleteStart: 'Delete the starting balance',
  deleteTitle: 'Delete this check?',
  deleteStartTitle: 'Delete the starting balance?',
  deleteAsk: (date: string) => `Delete the check for ${date}? Its figures go; who deleted it and when is kept.`,
  deleteStartAsk: (date: string) => `Delete the starting balance for ${date}? Checking this account starts again from a statement you pick. Who deleted it and when is kept.`,
  deleteKeep: 'Keep it',
  deleteYes: 'Delete',
  deleting: 'Deleting…',
  deleteFailed: 'The check couldn’t be deleted.',
  deleted: (date: string) => `The check for ${date} is deleted.`,
  deletedStart: (date: string) => `The starting balance for ${date} is deleted. Start again from a statement.`,

  // ── the printed report (BC5b, ask 9, R0 tab 9; owner "Report door / order / extras"): one US Letter page from a saved
  // check, BANK FIRST as an association's monthly form runs. Opened from the check's window; a desk's door only. ────────
  printCheck: 'Print this check',
  // One name for the saved thing (S1 `/marketing`): "Balance check", as the coach's View option says it.
  reportEyebrow: (club: string) => `${club} · Balance check`,
  reportTitle: (account: string, date: string) => `${account} · statement ending ${date}`,
  reportBooks: (names: readonly string[]) => `Books in this account: ${names.join(' · ')}`,
  reportBank: 'Bank balance on the statement',
  reportWaitingHead: 'Not in the bank yet',
  reportWaitingCol: { date: 'Date', what: 'What', amount: 'Amount' },
  reportOnItsWay: 'Online payments on their way',
  reportShould: 'What your books should say',
  reportBooksOn: (date: string) => `Your books on ${date}`,
  // `since` is signed ("+ $3,722.00" / "− $410.00"): the change can run either way (BC5b /marketing: "change in the books",
  // not "book movement").
  // S1b /marketing: the BOOKS' figure at the start (it differs from the bank's opening balance when a line waits at the
  // start), so not "starting balance" here.
  reportStartingPoint: (date: string, balance: string, since: string) => `Your books when checking started ${date}: ${balance} · change in the books since: ${since}`,
  reportResult: 'Result',
  // No full stop of our own: the clock ends in one ("8:14 p.m.").
  reportCheckedBy: (who: string | null, role: string | null, date: string, time: string) =>
    (who ? `Checked by ${who}${role ? ` (${role})` : ''}, ${date} at ${time}` : `Checked on ${date} at ${time}`),
  reportPrepared: 'Prepared by',
  reportReviewed: 'Reviewed by',
  reportDate: 'Date',
  reportFoot: (date: string, club: string) => `Printed ${date} from FieldLogicHQ · ${club} · Accounting → Bank`,

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
  added: (name: string) => `${name} is added. Start it from its first statement.`,
  saved: 'Saved.',

  // ── the COACH's Bank view, Money → Ledger → View: Bank (BC7a; drawing tab 2, the coach phone frame). Drafts for BC8's
  // `/marketing` (plan §5). A team has one account and no starting statement: its season's opening balance is the start. ──
  coachAccount: 'Team bank account',
  // ── Bank check novice UX S1 (`/marketing` 2026-11-08): the coach card names the figure by its screen, "your Ledger"
  // (row 8: the card used three names for it, and a coach doesn't keep "books"); the coach "records" (WD3). ──
  coachCheckPurpose: 'Type the balance your bank shows. If it matches your Ledger, you’re in step with the bank. If not, we’ll help you look for the difference. It takes what’s in your Ledger as correct.',
  // A11, now: neutral, until the team's first check (the position on a coach's own account is the owner's call).
  coachTeamOnly: 'This check is for a bank account that holds only the team’s money.',
  coachBandShouldCaption: (date: string) => `Your Ledger on ${date}, adjusted for what hasn’t reached the bank yet`,
  coachBandShouldCaptionPhone: 'Your Ledger, adjusted for what’s pending',
  coachBandBankMore: (amount: string) => `The bank shows ${amount} more than your Ledger.`,
  coachBandBankLess: (amount: string) => `The bank shows ${amount} less than your Ledger.`,
  coachBandMatches: (date: string) => `The bank and your Ledger agree on ${date}.`,
  coachSavedMatches: (date: string) => `Checked ${date}. The bank and your Ledger agree.`,
  coachSumBooks: (date: string) => `Your Ledger on ${date}`,
  // A desk's quiet sub-line on that row (D1, question 10): the same figure the Money Overview calls Cash on hand.
  coachSumBooksSub: 'the Overview’s Cash on hand that day',
  coachNoLinesSince: 'No lines in your Ledger since then.',
  coachSaveOffNote: 'You can save this check while it’s off and check again later. Saving changes nothing in your Ledger.',
  // Under the date until a balance is typed (row 7, drawn): the working season only (O5), both ends said.
  coachSince: (date: string) => `Any day this season, from ${date} to today.`,
  // A8: the cash field waits behind this link (bends the 2026-11-05 replan's placement, not its rule).
  coachCashOpen: 'Holding cash you haven’t deposited?',
  // The cash figure (ask 1, option C): one optional field, saved with this check only.
  coachCash: 'Cash not deposited yet',
  // Find's head when no check this season has matched: every line of the season counts.
  coachLinesSinceSeason: (date: string, n: number) => `Lines since the season started (${date}): ${n}`,
  coachFindSinceSeason: (date: string) => `Lines since the season started · ${date}`,
  // Q1-A: the divider above last season's lines (the season's own name, "2025 Season").
  coachLastSeason: (season: string) => `From the ${season}`,
  coachNoChecksYet: 'No balance checks this season yet.',
  // Row 25: money view-only sees no form, so the empty list also says who can ("record money" is money write's name).
  coachReaderCanCheck: 'Anyone who can record money can check the bank here.',
  coachLoadFailed: 'The bank checks couldn’t be loaded.',
  coachLoading: 'Loading the bank checks…',
  // ── the coach's phone (BC7b; drawing tab 2). Drafts for BC8's `/marketing` too. ──
  // The band's middle tile on a phone when the cash is the only thing taken off (drawn "your books, less $180.00 cash");
  // with lines marked Not in the bank yet as well, the club's short caption says it.
  coachShouldCashPhone: (amount: string) => `Your Ledger, less ${amount} not deposited`,
  // Find's group head over the cards when no check this season has matched (shorter, no year, as the club's phone).
  coachFindSinceSeasonPhone: (date: string) => `Since the season started · ${date}`,
  // The portal's record windows end on Close (the Ledger's own line window does).
  close: 'Close',
  // ── the coach's touchpoints (BC8a; R0 tab 7; settled, BC8b `/marketing` 2026-11-07). ──
  // The Money Overview line is the CLUB's settled no-account line, "Bank: checked through {date} ›" / "Bank: not checked
  // yet ›" (`overviewLead` + `overviewThrough` / `overviewNoAccount`: a team has one account, so no name; one spelling for
  // one state, BC8b `/marketing`), with the amber "Off by $X" chip beside it when off. No coach keys of its own.
  // Start next season / Close the season, only when the season has a check (owner BC8a: never nag a team that doesn't use
  // it). Drawn R0 tab 7 for Start next season; Close the season starts no season, so its reason is its own (/review BC8a:
  // the drawn clause promised it a new season's Bank view): a closed season is one page, with no Bank view (B9).
  // ⚖ Off or matching (owner "Season windows, off or matching", BC8b 2026-11-07): an OFF latest check says so, amber; a
  // MATCHING one is a plain line with no warning icon, outside Close the season's amber "Before you do" box. The off
  // sentence's subject is the coach's check, never "the bank" (BC8b `/marketing`: the books are what's off).
  // S1 (rows 16 + A15, `/marketing` 2026-11-08): no "statement", and the print sentence the help already said. Start next
  // season closes this season too, so one reason serves both windows, said once. "From a computer": printing is a desk's.
  coachSeasonOff: (amount: string, date: string, verb: 'start' | 'close') =>
    `Your balance check was off by ${amount} on ${date}. Before you ${seasonVerb[verb]}, check your bank balance for the season’s last day. ${seasonPrint}`,
  coachSeasonMatches: (date: string, verb: 'start' | 'close') =>
    `The bank matches through ${date}. If you have a later balance, check it before you ${seasonVerb[verb]}. ${seasonPrint}`,

  // ── the team's printed check (BC8b; K8, R0 tab 9, the club's BC5b report rulings carried; owner "Team report sign lines
  // / role / start line" 2026-11-07). The eyebrow, title, sum and sign-off words are the club's settled report words above.
  coachReportFoot: (date: string, team: string) => `Printed ${date} from FieldLogicHQ${team ? ` · ${team}` : ''} · Money → Ledger → Balance check`,
  coachReportEyebrowBare: 'Balance check',
} as const;
