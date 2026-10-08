/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB MONEY — EVERY SENTENCE THE SERVER SAYS ABOUT A MONEY MOVE (Club Tier Stage 3a, session 1).
 *
 * ✓ SETTLED BY /marketing 2026-10-07 — the 3a sentences (six changed, the rest kept), after the 3b pass the
 * same day. The ratified drawings fixed what each sentence must CARRY (the team, the thing, the amount, the
 * reason); /marketing chose the words, with the coach's side, so both sides use one set of words. Every
 * string a person can read lives here so a words pass touches one file.
 *
 * ⚖ ONE SPELLING (AGENCY_RULES, 2026-08-24): the methods are the product's one list
 * (`DUES_PAYMENT_METHOD_LABEL`: "E-Transfer", never "e-Transfer"); a request's decision is
 * Approved · Declined · Reversed on both sides (the stored `denied` is an identifier, not a word);
 * the directions are the coach's own "To club" / "From club"; the clock is never printed here.
 *
 * Pure and client-safe.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { DUES_PAYMENT_METHOD_LABEL, DUES_PAYMENT_METHODS, type DuesPaymentMethod } from './types';
import { formatStoredDate } from './timezone';
import { fmt } from './coach-money-summary';
import { sumMoney } from './club-money-figures';
import { MONTH_NAMES_LONG, formatMonthLong, type MonthKey } from './coach-budget-months';
import { pluralize } from './utils';

/** The product's one method list (the dues tokens) — the club's money moves take exactly these. */
export function isClubMoneyMethod(v: unknown): v is DuesPaymentMethod {
  return typeof v === 'string' && (DUES_PAYMENT_METHODS as readonly string[]).includes(v);
}

export function methodWord(m: string | null | undefined): string | null {
  if (!m) return null;
  return DUES_PAYMENT_METHOD_LABEL[m as DuesPaymentMethod] ?? m;
}

/** "E-Transfer 4471" · "Cheque 2210" · "Cash" — how it came, as one quiet detail. */
export function howItCame(method: string | null | undefined, reference: string | null | undefined): string | null {
  const word = methodWord(method);
  const ref = reference?.trim() || null;
  if (word && ref) return `${word} ${ref}`;
  return word ?? ref;
}

/** The coach's chip and export status for money sent and not yet confirmed (ruled 2026-09-30, question 1). */
export const CLUB_SENT_WAITING_WORD = 'Sent · waiting for the club';

/** The coach's installment once they've said sent (specimen 7): "Sent Sep 28 · waiting for the club". */
export const coachSentLine = (sentOn: string) =>
  `Sent ${formatStoredDate(sentOn, { withYear: false })} · waiting for the club`;

// ── Ledger words ──────────────────────────────────────────────────────────────────────────────

/**
 * The category KEYS a club-loop line is written with — stable identifiers, the same ones the loop has
 * always written, so every line old and new is one set of rows. They are READ in words
 * (`categoryWord`: "Team allocations", "Team support"), so a /marketing rename of the words never
 * splits the Category filter in two. (A draft word stored as data would.)
 */
export const CLUB_LOOP_CATEGORY = {
  allocation: 'rep_allocation',
  toClub: 'team_payment_to_org',
  fromClub: 'team_charge_to_org',
} as const;
export const LOOP_CATEGORY_KEYS: readonly string[] = Object.values(CLUB_LOOP_CATEGORY);

/** The loop's category key for a request, by its direction. */
export const requestCategory = (requestType: 'payment_to_org' | 'charge_to_org') =>
  requestType === 'payment_to_org' ? CLUB_LOOP_CATEGORY.toClub : CLUB_LOOP_CATEGORY.fromClub;

export const TEAM_ALLOCATIONS_WORD = 'Team allocations';
export const TEAM_SUPPORT_WORD = 'Team support';

const CATEGORY_WORD: Record<string, string> = {
  [CLUB_LOOP_CATEGORY.allocation]: TEAM_ALLOCATIONS_WORD,
  [CLUB_LOOP_CATEGORY.toClub]: TEAM_SUPPORT_WORD,
  [CLUB_LOOP_CATEGORY.fromClub]: TEAM_SUPPORT_WORD,
  registration_fee: 'Registration fees',
};

/** A line's category, in words. A club's own free-text category reads as typed. */
export function categoryWord(category: string | null | undefined): string | null {
  if (!category) return null;
  return CATEGORY_WORD[category] ?? category;
}

const clip = (s: string, n = 500) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const installmentOf = (n: number, of: number) => (of > 1 ? `, ${n} of ${of}` : '');

/** The two halves an installment received writes (specimen 1: "Allocation received · 11U AA · Diamond fees, 2 of 3"). */
export function installmentLineWords(p: {
  teamName: string; orgName: string; allocation: string; number: number; of: number;
}): { club: string; team: string } {
  const what = `${p.allocation}${installmentOf(p.number, p.of)}`;
  return {
    club: clip(`Allocation received · ${p.teamName} · ${what}`),
    team: clip(`Allocation paid to ${p.orgName} · ${what}`),
  };
}

/** The two halves an approved request writes ("Paid to 11U AA · …", "From 14U Girls · …"). */
export function requestLineWords(p: {
  teamName: string; orgName: string; description: string; requestType: 'payment_to_org' | 'charge_to_org';
}): { club: string; team: string } {
  if (p.requestType === 'charge_to_org') {
    return { club: clip(`Paid to ${p.teamName} · ${p.description}`), team: clip(`From ${p.orgName} · ${p.description}`) };
  }
  return { club: clip(`From ${p.teamName} · ${p.description}`), team: clip(`Paid to ${p.orgName} · ${p.description}`) };
}

// ── Requests ──────────────────────────────────────────────────────────────────────────────────

export const REQUEST_DIRECTION_WORD = { payment_to_org: 'To club', charge_to_org: 'From club' } as const;

export const REQUEST_STATUS_WORD: Record<string, string> = {
  pending: 'Waiting',
  approved: 'Approved',
  denied: 'Declined',
  reversed: 'Reversed',
};

export function requestStatusWord(status: string): string {
  return REQUEST_STATUS_WORD[status] ?? status;
}

// ── Refusals (one coded 409 each — the shape of Stage 2's `season_not_live`) ───────────────────

export const MONEY_STATE_CHANGED = 'money_state_changed' as const;

export type InstallmentStateWord = 'unpaid' | 'sent' | 'received';

export interface MoneyStateChangedRefusal {
  error: string;
  code: typeof MONEY_STATE_CHANGED;
  /** What it is now. */
  state: string;
  /** Who can fix it from here: the club, the team's coaches, or nobody (it is already done). */
  fixedBy: 'club' | 'coach' | null;
}

/** The coach acted on an installment that changed under them. */
export function coachInstallmentRefusal(state: InstallmentStateWord, orgName: string): MoneyStateChangedRefusal {
  const by = {
    received: {
      error: `${orgName} has recorded this payment, so it can’t be changed here. If it needs undoing, ask the club.`,
      fixedBy: 'club' as const,
    },
    sent: {
      error: 'Someone on your team has already told the club this was sent.',
      fixedBy: 'coach' as const,
    },
    unpaid: {
      error: 'This installment isn’t marked as sent any more, so there is nothing to take back.',
      fixedBy: null,
    },
  }[state];
  return { error: by.error, code: MONEY_STATE_CHANGED, state, fixedBy: by.fixedBy };
}

/** The club acted on an installment that changed under them. */
export function clubInstallmentRefusal(state: InstallmentStateWord, teamName: string): MoneyStateChangedRefusal {
  const by = {
    received: { error: 'This payment has already been recorded.', fixedBy: null },
    sent: {
      error: `${teamName}’s coach has just said they sent this payment. Reopen it and press Confirm received.`,
      fixedBy: 'club' as const,
    },
    unpaid: {
      error: `${teamName}’s coach has taken back that they sent this, so there is nothing to confirm yet.`,
      fixedBy: 'coach' as const,
    },
  }[state];
  return { error: by.error, code: MONEY_STATE_CHANGED, state, fixedBy: by.fixedBy };
}

/** The club tried to undo a payment that is no longer recorded. */
export function clubUndoRefusal(state: string): MoneyStateChangedRefusal {
  return { error: 'This payment isn’t recorded any more, so there is nothing to undo.', code: MONEY_STATE_CHANGED, state, fixedBy: null };
}

/** The club or the coach acted on a request that changed under them. */
export function requestRefusal(state: string, side: 'club' | 'coach'): MoneyStateChangedRefusal {
  const word = requestStatusWord(state).toLowerCase();
  const error = state === 'withdrawn'
    ? 'The coach withdrew this request.'
    : state === 'pending'
      ? 'This request is still waiting for the club’s answer.'
      : `This request has already been ${word}.`;
  return { error, code: MONEY_STATE_CHANGED, state, fixedBy: side === 'coach' && state === 'approved' ? 'club' : null };
}

export const UNLINKED_PAYMENT =
  'This payment was recorded before Undo also voided its ledger lines, so it can’t be undone here. Correct it with an entry on the ledger.';
export const UNLINKED_APPROVAL =
  'This request was approved before Reverse also voided its ledger lines, so it can’t be reversed here. Correct it with an entry on the ledger.';

export const TRANSFER_VOID_REFUSAL: Record<string, string> = {
  not_a_transfer: 'This line isn’t a transfer.',
  already_void: 'This transfer has already been voided.',
  team_book: 'A team’s book is kept by its coaches. A transfer into or out of it can’t be voided here.',
  from_a_source: 'This line was written by an allocation, a payment request or a house league fee. Change it where it came from.',
};

export const TEAM_BOOK_READ_ONLY =
  'A team’s book is kept by its coaches and is read-only here. Money moves between the club and a team through allocations and payment requests.';
export const SOURCED_LINE_READ_ONLY =
  'This line was written by an allocation, a payment request or a house league fee, so it can’t be edited or voided on the ledger. Change it where it came from.';

// ── Notifications (titles and lines; /marketing's words) ──────────────────────────────────────

const reasonLine = (reason: string | null | undefined) => (reason ? ` Reason: “${reason}”` : '');

export const CLUB_MONEY_NOTICE = {
  /** To the coach and the team's money staff ("Your club"). */
  received: (p: { orgName: string; teamName: string; amount: number; what: string }) => ({
    title: `${p.orgName} received ${fmt(p.amount)} from ${p.teamName}`,
    body: `${p.what} is paid.`,
  }),
  undone: (p: { orgName: string; teamName: string; amount: number; what: string; reason: string }) => ({
    title: `${p.orgName} undid a ${fmt(p.amount)} payment from ${p.teamName}`,
    body: `${p.what} is unpaid again.${reasonLine(p.reason)}`,
  }),
  approved: (p: { orgName: string; amount: number; what: string; toTeam: boolean }) => ({
    title: p.toTeam
      ? `${p.orgName} approved your ${fmt(p.amount)} request`
      : `${p.orgName} confirmed your ${fmt(p.amount)} payment`,
    body: p.what,
  }),
  declined: (p: { orgName: string; amount: number; what: string; reason: string }) => ({
    title: `${p.orgName} declined your ${fmt(p.amount)} request`,
    body: `${p.what}.${reasonLine(p.reason)}`,
  }),
  reversed: (p: { orgName: string; amount: number; what: string; reason: string }) => ({
    title: `${p.orgName} reversed a ${fmt(p.amount)} approval`,
    body: `${p.what}. You can file a new request.${reasonLine(p.reason)}`,
  }),
  /** To the club's accounting people (the Accounting rows). */
  sent: (p: { teamName: string; amount: number; what: string; sentOn: string; how: string | null }) => ({
    title: `${p.teamName} says they sent ${fmt(p.amount)}`,
    body: `${p.what} · sent ${formatStoredDate(p.sentOn, { withYear: false })}${p.how ? ` · ${p.how}` : ''}. Confirm it when it arrives.`,
  }),
  newRequest: (p: { teamName: string; amount: number; what: string; toClub: boolean }) => ({
    title: `${p.teamName} filed a ${fmt(p.amount)} request`,
    body: `${p.toClub ? REQUEST_DIRECTION_WORD.payment_to_org : REQUEST_DIRECTION_WORD.charge_to_org} · ${p.what}`,
  }),
  holdingPayout: (p: { teamName: string; count: number }) => ({
    title: `A request from ${p.teamName} is holding up their payout to families`,
    body: p.count === 1
      ? 'Their coach can’t pay families their end-of-season share until you answer it.'
      : `Their coach can’t pay families their end-of-season share until you answer ${p.count} requests.`,
  }),
};

// ── Reminders (Ask 4; question 3: no payment-instructions setting, the reply goes to the sender) ──

export interface ReminderEmailLine {
  allocation: string;
  number: number;
  of: number;
  amount: number;
  dueDate: string;
  daysLate: number;
}

export function reminderEmailSubject(p: { orgName: string; teamName: string }): string {
  return `${p.orgName}: what ${p.teamName} owes the club`;
}

/** Plain-text lines; the route wraps and escapes them. */
export function reminderEmailLines(p: {
  orgName: string; teamName: string; senderName: string; lines: ReminderEmailLine[];
}): { intro: string; items: string[]; total: string; outro: string } {
  const total = sumMoney(p.lines);
  return {
    intro: `Here is what ${p.teamName} owes ${p.orgName}:`,
    items: p.lines.map(l => {
      const due = formatStoredDate(l.dueDate);
      const late = l.daysLate > 0 ? ` · ${l.daysLate} ${l.daysLate === 1 ? 'day' : 'days'} late` : '';
      return `${l.allocation}${installmentOf(l.number, l.of)} · ${fmt(l.amount)} · due ${due}${late}`;
    }),
    total: `Total: ${fmt(total)}`,
    outro: `To arrange payment, reply to this email and it will reach ${p.senderName}. Once you’ve sent the money, open Money › Club in your team’s portal and tap We’ve sent it, so the club knows to look for it.`,
  };
}

/** Why a team can't be reached (the preview names each one). */
export const UNREACHABLE_WORD = {
  no_head_coach: 'has no head coach',
  invitation_unanswered: 'has a head coach invitation nobody has accepted yet',
  only_you: 'has no one with money access but you',
} as const;
export type UnreachableWhy = keyof typeof UNREACHABLE_WORD;

// ── Teams, the way a treasurer talks (specimen 2) ─────────────────────────────────────────────

interface WordTeam { id: string; name: string; groupId: string | null; groupName?: string | null }

/**
 * "All 9 teams" (every active team) · "Boys · 6 teams" (every team in one group, when more than
 * three) · the names when three or fewer · else "N teams". Today the column is a bare count.
 */
export function teamsWord(teams: readonly WordTeam[], activeTeams: readonly WordTeam[]): string {
  const n = teams.length;
  if (n === 0) return 'No teams';
  const ids = new Set(teams.map(t => t.id));
  if (n > 1 && activeTeams.length === n && activeTeams.every(t => ids.has(t.id))) return `All ${n} teams`;
  if (n <= 3) {
    const names = teams.map(t => t.name);
    return names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }
  const first = teams[0];
  if (first.groupId && first.groupName && teams.every(t => t.groupId === first.groupId)) {
    const inGroup = activeTeams.filter(t => t.groupId === first.groupId);
    if (inGroup.length === n && inGroup.every(t => ids.has(t.id))) return `${first.groupName} · ${n} teams`;
  }
  return `${n} teams`;
}

// ── Club Tier Stage 3b: the plan, Budget vs. Actual, the board summary ────────────────────────
/* ✓ SETTLED BY /marketing 2026-10-07 (the 3b words pass, after the §271 walks), with the screens' block below.
   The row names are the hub's drawn words (specimens 1–3); the refusals carry what the drawing fixed (the figure
   in the way). The 3a sentences above were settled the same day, in their own pass. */

/** The revenue row nobody types: what the club billed its teams from the year's cost lines. */
export const FROM_THE_TEAMS_WORD = 'From the teams';
/** Under From the teams: money a team paid the club on a To-club request (not against a bill). */
export const ON_REQUEST_WORD = 'On request';
/** The standard word a request paid to a team files under (mig 317), under TEAM_SUPPORT_WORD. */
export const TEAM_SUPPORT_ITEM_WORD = 'Paid to teams on request';
/** A club ledger line filed to no budget word — every line typed before 3b, until someone files it. */
export const NOT_FILED_WORD = 'Not filed';
/** Months: what a tournament's or the house league's book moved on its own (Ask 5). */
export const OTHER_BOOKS_WORD = 'The club’s other books';
/** A team's cash, read from the coaches' own books and never the club's (D1, Ask 4e). */
export const HELD_BY_THE_TEAM_WORD = 'Held by the team';
/** A team outside the reader's groups, where a club read would otherwise name it (B11: counted, never named). */
export const OUTSIDE_YOUR_GROUPS_WORD = 'A team outside your groups';
/** The teams' cash total, in its own band, worded as not the club's. */
export const TEAMS_CASH_TOTAL_WORD = 'Held by the teams · not the club’s money';

/** The Budget's refusals (C11, C10). Each says what is in the way, with the figure. */
export const CLUB_BUDGET_REFUSAL = {
  below_allocated: (allocated: number) =>
    `This line can’t be less than ${fmt(allocated)}, what is already allocated from it.`,
  over_line: (left: number) =>
    `That is more than is left on the line. Up to ${fmt(left)} can still be allocated from it.`,
  periods_dont_add_up: (periodsTotal: number, lineTotal: number) =>
    `The dates add up to ${fmt(periodsTotal)}, and the line is ${fmt(lineTotal)}. Make them match to save.`,
  bad_period_amount: 'Each date needs an amount above zero.',
  bad_period_label: 'Each date needs a name.',
  year_has_lines: (year: string) => `${year} already has a plan. Add to it line by line.`,
  nothing_to_copy: (year: string) => `${year} has no lines to start from.`,
  different_months: (from: string, to: string) =>
    `${from} and ${to} don’t run the same months, so ${to} can’t start from ${from}’s plan. Add its lines one by one.`,
  word_on_plan: (word: string) => `${word} is already on this year’s plan. Open that line to change it.`,
  line_changed: 'This line changed while you were editing it. Reopen it to see the latest.',
  not_a_cost_line: 'Only a cost line bills teams. This line plans money coming in.',
  line_not_found: 'That budget line isn’t on the club’s plan any more.',
  has_allocations: 'This line has allocations drawn from it, so it can’t be removed.',
  allocated_line_is_a_cost: 'Teams are billed from this line, so it stays a cost. Choose a money-out word.',
  bad_total: 'The line needs an amount above zero.',
  bad_description: 'A name is needed, 200 characters at most.',
  word_required: 'Choose what this line is filed under.',
  bad_source_entry: 'That isn’t one of the club’s ledger entries.',
} as const;

/** The entry's "Filed under" refusals (Ask 4a). */
export const FILED_UNDER_REFUSAL = {
  wrong_side_out: 'Money out is filed under a money-out word.',
  wrong_side_in: 'Money in is filed under a money-in word.',
} as const;

// ── Club Tier Stage 3b, the screens (session 2): every sentence the Budget, Budget vs. Actual, the board
//    summary, a team's money, the payee report and the coach's Club tab print. ✓ SETTLED BY /marketing
//    2026-10-07 (twelve changed, the rest kept; the Months notes in club-money-reports.ts with them). ──

/** A partly billed cost line, under its name: the part the club pays itself unless it allocates it. */
export const notAllocatedCaption = (amount: number) =>
  `${fmt(amount)} not allocated · the club pays it unless you allocate it`;

/** The Budget's band captions (Total revenue · Total expenses · Closing balance). */
export const BUDGET_BAND_WORDS = {
  revenue: (fromTheTeams: number, otherLines: number) => (fromTheTeams > 0.005
    ? `${fmt(fromTheTeams)} from the teams${otherLines > 0 ? ` · ${otherLines} other ${otherLines === 1 ? 'line' : 'lines'}` : ''}`
    : otherLines > 0 ? `${otherLines} ${otherLines === 1 ? 'line' : 'lines'}` : 'Nothing planned yet'),
  expenses: (allocated: number) => (allocated > 0.005 ? `${fmt(allocated)} of it allocated to teams` : 'None of it allocated to teams yet'),
  /** "$30.00 less than the year opened with" — the plan's close against its opening. */
  closing: (net: number) => (Math.abs(net) <= 0.005
    ? 'The same as the year opened with'
    : `${fmt(Math.abs(net))} ${net < 0 ? 'less' : 'more'} than the year opened with`),
} as const;

/** Where the plan's opening comes from (Ask 5): worked out from the books, never typed. */
export const budgetOpeningNote = (opening: number, firstDay: string) =>
  `The year opened with ${fmt(opening)}, what the club’s books held on ${formatStoredDate(firstDay, { withYear: false })}. Revenue and expenses are planned; money is assumed to arrive and leave in its planned months.`;

/** The plan's closing rows' words ("Opening balance · Jan 1", "Net for 2026"). */
export const openingBalanceRowWord = (firstDay: string) => `Opening balance · ${formatStoredDate(firstDay, { withYear: false })}`;
export const netForYearWord = (year: string) => `Net for ${year}`;

/** By period, under the grid: how From the teams spreads. */
export const FROM_THE_TEAMS_SPREAD_NOTE = 'From the teams is placed by its installments’ due dates; every other line by its own dates.';
/** By period, money dated outside the year (it sits under No date yet, in the Total and in no month). */
export const outsideTheYearNote = (year: string) =>
  `Some of this plan is dated outside ${year}. It sits under No date yet: in the year’s Total, in no month. Change its dates to place it.`;

/** An empty year (C10): the compact empty state — one sentence, the fact, the one lime action. */
export const emptyYearWords = (year: string, from: string | null) => ({
  title: `No plan for ${year} yet`,
  body: from != null
    ? `Start from ${from}’s lines, amounts and dates moved a year on, or add lines one by one. Nothing is billed to a team until you allocate.`
    : 'Add lines one by one. Nothing is billed to a team until you allocate.',
  start: from != null ? `Start from ${from}’s plan` : null,
});

/** The line window's allocations section. */
export const LINE_ALLOCATIONS_WORD = 'Allocated to teams';
export const allocationRowCaption = (teams: string, otherTeams: number, allocated: number, collected: number) =>
  `${[teams, otherTeams > 0 ? `${otherTeams} more ${otherTeams === 1 ? 'team' : 'teams'}` : ''].filter(Boolean).join(' · ')} · ${fmt(allocated)} allocated · ${fmt(collected)} collected`;
export const NOT_ALLOCATED_LEAD = 'The club pays this part itself unless you allocate it.';

/** The board summary (the Overview tab) — Ask 1. */
export const SUMMARY_WORDS = {
  standsHeading: (today: string) => `Where the club stands · today, ${formatStoredDate(today, { withYear: false })}`,
  cashCaption: (books: number, pendingOut: number, pendingCount: number) =>
    `the club’s ${books} ${books === 1 ? 'book' : 'books'}${pendingCount > 0
      ? ` · ${pendingCount === 1 ? `a ${fmt(pendingOut)} cheque` : `${fmt(pendingOut)} in ${pendingCount} lines`} not yet cleared`
      : ''}`,
  owedCaption: (overdue: number, sent: number) =>
    [overdue > 0.005 ? `${fmt(overdue)} overdue` : null, sent > 0.005 ? `${fmt(sent)} sent, waiting for you` : null]
      .filter(Boolean).join(' · ') || 'nothing overdue',
  waitingCaption: (count: number, holding: number) =>
    count === 0 ? 'nothing waiting'
      : `${count} ${count === 1 ? 'request' : 'requests'}${holding > 0 ? ` · ${holding} holding up a payout` : ''}`,
  againstHeading: (year: string) => `${year} against the budget`,
  /** Headroom said once, with its arithmetic (its one definition). `ended`: the year is over (3c), so it is said in
   *  the past — nothing is "left" of a year that has ended. */
  headroom: (headroom: number, revenueUnder: number, owed: number, ended = false) => {
    const head = headroom >= -0.005
      ? (ended ? `Headroom: ${fmt(headroom)} of the year’s planned spending went unspent.` : `Headroom: ${fmt(headroom)} of the year’s planned spending is left.`)
      : (ended ? `Headroom: spending ran ${fmt(Math.abs(headroom))} over the year’s plan.` : `Headroom: spending is ${fmt(Math.abs(headroom))} over the year’s plan.`);
    if (revenueUnder <= 0.005) return head;
    return ended
      ? `${head} Revenue came in ${fmt(revenueUnder)} under plan${owed > 0.005 ? `, and ${fmt(Math.min(owed, revenueUnder))} of that is what the teams still owe` : ''}.`
      : `${head} Revenue is ${fmt(revenueUnder)} under plan so far${owed > 0.005 ? `, and ${fmt(Math.min(owed, revenueUnder))} of that is what the teams still owe` : ''}.`;
  },
  /** The year column's heading: what has come in so far, or — once the year has ended — its actual. */
  actualHead: (ended: boolean) => (ended ? 'Actual' : 'So far'),
  teamsCashBand: (total: number, teams: number) =>
    `Held by the teams: ${fmt(total)} across ${teams} ${teams === 1 ? 'team' : 'teams'}. The coaches’ own books; never part of the club’s figures above.`,
  teamsCashBandShort: (total: number) =>
    `Held by the teams: ${fmt(total)} in all. The coaches’ own books, never in the club’s figures.`,
  phoneYear: (spent: number, plannedOut: number, collected: number, plannedIn: number, headroom: number) =>
    `Spent ${fmt(spent)} of ${fmt(plannedOut)} · collected ${fmt(collected)} of ${fmt(plannedIn)} · headroom ${fmt(headroom)}`,
} as const;

/** A team's cash, as the club reads it (D1, Ask 4e): whose figure, and from which season. */
export function teamCashCaption(season: { live: boolean; closedOn: string | null } | null): string {
  if (!season) return 'The coaches haven’t started a season yet';
  if (season.live) return `${HELD_BY_THE_TEAM_WORD} · the coaches’ figure today`;
  return `${HELD_BY_THE_TEAM_WORD} · at close, ${formatStoredDate(season.closedOn, { withYear: false })}`;
}
/** The same, shortest — under a figure in the teams table, only when the season is not live. */
export const teamCashClosedWord = (closedOn: string | null) => `at close, ${formatStoredDate(closedOn, { withYear: false })}`;

/** A team's account with the club: the callout, reworded for what 3b reads (specimen 4). */
export const teamAccountCallout = (teamName: string) =>
  `${teamName}’s money is kept by its coaches, in their portal. The club reads one figure of it, the team’s cash on hand, and never adds it to the club’s figures. The rest of this page is the club’s side of the team: what it billed, what it received, what it paid the team. Nothing here can be changed.`;

/** The Rep Teams team page's "What the club sees" — the two lines 3b and Ledger Parity add. */
export const WHAT_THE_CLUB_SEES_3B = {
  cash: 'The team’s cash on hand (one figure; never its families’ payments or its other spending)',
  sharedPayees: 'What it recorded paying the payees you share',
} as const;

/** The coach's Money › Club tab, one quiet line at its foot (Ask 4c): what the club reads, and never. */
export const coachWhatTheClubReads = (orgName: string) =>
  `${orgName} sees what you owe it, your requests, your cash on hand, and what you pay the payees it shares. Never your families’ payments or the rest of your books.`;

/** The shared-payee report (specimen 5): the door on the payee's window, the callout, the bands. */
export const PAYEE_REPORT_WORDS = {
  door: 'What the teams recorded paying it',
  doorCaption: (teams: number, total: number, year: string) =>
    teams === 0 ? `Nothing recorded in ${year}` : `${teams} ${teams === 1 ? 'team' : 'teams'} · ${fmt(total)} in ${year}`,
  callout: (payee: string, year: string, sharedOn: string | null) =>
    `What each team recorded paying ${payee} in ${year}${sharedOn ? `, since you shared it with your teams on ${formatStoredDate(sharedOn, { withYear: false })}` : ''}. These are the teams’ own records, not proof that a payment was made.`,
  calloutShort: (sharedOn: string | null) =>
    `What each team recorded paying it${sharedOn ? ` since you shared it on ${formatStoredDate(sharedOn, { withYear: false })}` : ''}. The teams’ own records, not proof of payment.`,
  foot: (sharedOn: string | null) => (sharedOn
    ? `A payment counts only when the team recorded it, and the bill it pays, on or after ${formatStoredDate(sharedOn, { withYear: false })}. A team’s other payees and other spending never show.`
    : 'A team’s other payees and other spending never show.'),
  recordedBand: (teams: number, total: number) => `${teams} ${teams === 1 ? 'team' : 'teams'} recorded · ${fmt(total)}`,
  nothingBand: (n: number) => `Nothing recorded · ${n}`,
  rowSpan: (count: number, first: string | null, last: string | null) =>
    `${count} ${count === 1 ? 'payment' : 'payments'}${first && last
      ? ` · ${first === last ? formatStoredDate(first, { withYear: false }) : `${formatStoredDate(first, { withYear: false })} to ${formatStoredDate(last, { withYear: false })}`}`
      : ''}`,
  outOfPocket: 'paid by a family',
} as const;

/** The Ledger's "Filed under" hint (Ask 4a): is the word on this year's plan? `year` is the fiscal year's NAME. */
export const filedUnderHint = (onPlan: { planned: number } | null, year: string) =>
  (onPlan ? `On the ${year} plan · ${fmt(onPlan.planned)} planned.` : `Not on the ${year} plan, so it counts as off-plan.`);
export const FILED_BY_ITS_SOURCE = 'Filed by where it came from';
export const wasCategoryWord = (legacy: string) => `was: ${legacy}`;

// ── Club Tier Stage 3c: the fiscal year (Ask 9 — "fiscal year", the club side only, never "financial
//    year"). ✓ SETTLED BY /marketing 2026-10-08 (the 3c words pass), with the screens' block below. ──

/** A write dated into a closed fiscal year (call 2; the hub's specimen 3 words). `day` the date it was given,
 *  `year` the closed year it falls in, `nextDay` the first day of the first OPEN year. */
export const yearClosedWords = (p: { day: string; year: string; nextDay: string; reopen: string | null }) =>
  `${formatStoredDate(p.day)} is in ${p.year}, which is closed. Date it ${formatStoredDate(p.nextDay)} or later${p.reopen ? `, or reopen ${p.reopen} first` : ''}.`;

/** A change to a line, a payment or a bill that sits in a closed fiscal year (Undo, Reverse, Void, an edit). */
export const recordedInClosedYearWords = (year: string, reopen: string | null) =>
  `Recorded in ${year}, which is closed.${reopen ? ` To change it, reopen ${reopen}.` : ''}`;

/** A plan line, its dates, or an allocation from it, on a closed fiscal year. */
export const planClosedWords = (year: string, reopen: string | null) =>
  `${year} is closed, so its plan can’t change.${reopen ? ` To change it, reopen ${reopen}.` : ''}`;

/** The fiscal year's window, Close and Reopen: refusals in words. */
export const FISCAL_YEAR_REFUSAL = {
  not_found: 'That fiscal year isn’t one of the club’s.',
  not_ended: (year: string, lastDay: string) => `${year} runs until ${formatStoredDate(lastDay)}. A year can be closed once it has ended.`,
  already_closed: (year: string) => `${year} is already closed.`,
  close_order: (year: string) => `Close ${year} first. Fiscal years close oldest first.`,
  not_closed: (year: string) => `${year} isn’t closed.`,
  not_latest: (latest: string) => `Only the latest closed year can be reopened. Reopen ${latest} first.`,
  reason_required: 'Say why you’re reopening it. The reason is kept with the year.',
  bad_reason: 'Keep the reason to 500 characters.',
  bad_name: 'A name is needed, 40 characters at most.',
  name_taken: (name: string) => `Another fiscal year is already called ${name}.`,
  year_closed: (year: string) => `${year} is closed, so its name can’t change.`,
  first_close_done: 'The first month can’t change once a fiscal year has been closed.',
  bad_month: 'Choose the month the fiscal year starts in.',
  split_below_allocated: (line: string, allocated: number, staying: number) =>
    `${line} has ${fmt(allocated)} billed to teams, and only ${fmt(staying)} of the line would stay in this year. Change its dates first.`,
} as const;

/** Only an open season is billed (S3C-09). */
export const SEASON_CLOSED_REFUSAL = (teamName: string) =>
  `${teamName} has no season running, so it can’t be billed. Bill it once its next season starts.`;
/** Why a team's row offers no season on New allocation. */
export const NO_SEASON_RUNNING_WORD = 'No season running';

/** The pasted ledger-entry id has left New allocation (C17). */
export const SOURCE_ENTRY_RETIRED =
  'An allocation is billed from a budget line, or as an off-plan bill. It no longer links to a ledger entry.';

/** Budget vs. Actual: last year's bills, paid this year (Ask 4) — under From the teams, Budgeted blank. */
export const lastYearsBillsWord = (yearBefore: string) => `${yearBefore}’s bills, paid this year`;
export const lastYearsBillsCaption = (yearBefore: string) => `planned and billed in ${yearBefore}`;

/** The Overview, once a fiscal year has ended and is still open (Ask 2's door). */
export const yearEndedWords = (year: string, lastDay: string) =>
  `${year} ended on ${formatStoredDate(lastDay, { withYear: false })} and is still open. Close it to lock its books before you print its year-end report.`;

/** The Overview's "From 2025–26, still open" (Ask 4). */
export const stillOpenFromWord = (year: string) => `From ${year}, still open`;

/** The coach's Club tab (Ask 8b): an unpaid bill from an earlier season, under a band naming it. */
export const stillOwedFromSeasonWord = (seasonName: string) => `Still owed from the ${seasonName}`;

/** Compare › Against last year: an earlier year's bills paid in either year, as one row (so the columns compare
 *  like with like). */
export const EARLIER_YEARS_BILLS_WORD = 'Earlier years’ bills, paid that year';

/** The year-end report: the one line instead of the teams' cash (specimen 5). */
export const YEAR_END_NO_TEAM_CASH = 'Each team’s own cash is its coaches’ money, not the club’s, and isn’t part of this report.';

// ── Club Tier Stage 3c, the screens (session 2): the fiscal year's window, the close and Reopen, a closed year's
//    line, the year that opens, New allocation in the line's window, a payee's window. ✓ SETTLED BY /marketing
//    2026-10-08 — the drawings (hub v46, Mockups → Stage 3c) fixed what each must CARRY; the pass settled the words. ──

const day3c = (d: string, withYear = false) => formatStoredDate(d, { withYear });
/** A month's name from its number (1–12) or from a day ("2026-09-01"). */
export const monthName = (m: number | string) => MONTH_NAMES_LONG[(typeof m === 'number' ? m : Number(m.slice(5, 7))) - 1] ?? '';
/** "Sep 1, 2025 to Aug 31, 2026" — a fiscal year's two days. */
export const fiscalYearSpanWords = (y: { firstDay: string; lastDay: string }) => `${day3c(y.firstDay, true)} to ${day3c(y.lastDay, true)}`;

/** Budget › Tools › Fiscal year (specimen 1; Ask 5). */
export const FISCAL_YEAR_WINDOW_WORDS = {
  eyebrow: 'Budget · Tools',
  toolsHint: 'When the year starts, and its name',
  startsIn: 'Starts in',
  thisYear: 'This year',
  nextYear: 'Next year',
  closedYears: 'Closed years',
  noneClosed: 'None yet',
  nextYearHint: 'plan ahead on the Fiscal year pill',
  januaryDefault: 'January, where every club starts until it sets its own',
  firstMonthHint: 'The month the club’s plan and books start each year. You can change it until the first fiscal year is closed.',
  firstMonthLocked: 'It can’t change once a fiscal year has been closed.',
  nameLabel: 'This year’s name',
  nameHint: 'Shown on every money tab and in every export. You can rename it while the year is open.',
  whatChanges: 'What changes',
  keepsWhy: 'it has begun, so it keeps its months',
  shortWhy: 'the year that changes',
  thenWhy: 'and every year after',
  /** The consequence of a first-month change, said before the save. */
  moves: (p: { shortName: string; moved: number; split: number; movedFrom: string | null; movedTo: string | null; toName: string }) => {
    const parts: string[] = [];
    if (p.moved > 0) {
      const from = p.movedFrom, to = p.movedTo;
      // "dated September to December 2027" — the months through the shared month formatter (never a year taken apart here).
      const when = from && to
        ? (from.slice(0, 7) === to.slice(0, 7)
          ? ` dated ${formatMonthLong(from.slice(0, 7) as MonthKey)}`
          : ` dated ${formatMonthLong(from.slice(0, 7) as MonthKey)} to ${formatMonthLong(to.slice(0, 7) as MonthKey)}`)
        : '';
      parts.push(`${p.shortName}’s plan has ${pluralize(p.moved, 'line', 'lines')}${when}. ${p.moved === 1 ? 'It moves' : 'They move'} to ${p.toName}’s plan with ${p.moved === 1 ? 'its' : 'their'} dates.`);
    }
    if (p.split > 0) {
      parts.push(`${pluralize(p.split, 'line crosses', 'lines cross')} the new end, so ${p.split === 1 ? 'it is' : 'each is'} split by its dates, one line in each year.`);
    }
    parts.push('No ledger line moves: each counts in the year its date falls in.');
    return parts.join(' ');
  },
  fresh: (month: string, name: string, span: string) => `Nothing is planned or recorded yet, so the fiscal year starts in ${month}: ${name}, ${span}.`,
  wholeNext: (current: string, next: string, month: string) => `${current} keeps its months, and ${next} already starts in ${month}. No plan line or ledger line moves.`,
  keep: (month: string) => `Keep ${month}`,
  change: (month: string) => `Start the year in ${month}`,
  changeShort: (month: string) => `Start in ${month}`,
  changing: 'Changing…',
  changed: (month: string) => `The fiscal year now starts in ${month}.`,
  /** Under a new club's empty first plan: one quiet line with an olive door. */
  newClub: 'The fiscal year runs January to December. If yours starts in another month, set it before you plan.',
  newClubDoor: 'Set the fiscal year',
} as const;

/** A closed (or reopened) year's one line under the toolbar (specimen 3; Asks 1, 3). */
export const YEAR_LINE_WORDS = {
  closed: (name: string, by: string | null, on: string) =>
    `${by ?? 'Someone'} closed it on ${day3c(on, true)}. Its books and its plan are locked.`,
  closedAgain: (at: string, by: string | null, reason: string) => ` It was reopened ${day3c(at)} by ${by ?? 'someone'} (“${reason}”) and closed again.`,
  reopenedLead: (name: string) => `${name} was reopened`,
  reopened: (at: string, by: string | null, reason: string) =>
    ` ${day3c(at)} by ${by ?? 'someone'}: “${reason}”. Its books and its plan are open until it is closed again.`,
  closedLead: (name: string) => `${name} is closed.`,
  onlyLatest: (latest: string) => `Only ${latest}, the latest closed year, can be reopened.`,
  /** A year before the club's first close: inside the closed stretch, with no close of its own. */
  lockedBeforeLead: (name: string) => `${name} is locked.`,
  lockedBefore: ' It comes before the club’s first closed fiscal year, so its books and its plan can’t change.',
  /** The Overview's line once a year has ended and until someone closes it (Ask 2's door). */
  endedLead: (name: string, lastDay: string) => `${name} ended on ${day3c(lastDay)} and is still open.`,
  endedRest: ' Close it to lock its books before you print its year-end report.',
  reopen: 'Reopen',
  /** A closed year's line can no longer be allocated: the unbilled part says what happened. */
  clubPaid: 'the club paid it',
  clubPaidLead: 'The club paid this part itself.',
} as const;

/** The close question (specimen 3; Asks 2, 4; redrawn as Ask 10, §283 walk 5, 2026-10-08 — the outcome first:
 *  the year's path, then one line for each kind of money still open, then the promises). */
export const CLOSE_YEAR_WORDS = {
  eyebrow: (name: string) => `Accounting · ${name}`,
  title: (name: string) => `Close ${name}?`,
  /** A re-close: who reopened it, when, and why — one line above the path. */
  reopenedBy: (at: string, by: string | null) => `Reopened ${day3c(at)} by ${by ?? 'someone'}`,
  reopenedWhy: (reason: string) => `“${reason}”`,
  // The year's path: what locks → what it closes at → the year that opens on it.
  pathLocks: 'Locks',
  pathLocksWhat: (books: number, lines: number) => `${pluralize(books, 'book', 'books')}, ${pluralize(lines, 'line', 'lines')}, and its plan`,
  pathClosing: 'Closing balance',
  /** The change since the close a Reopen undid. */
  pathChange: (change: number) => (Math.abs(change) < 0.005 ? 'Same as last close'
    : `${change > 0 ? '+' : '−'}${fmt(Math.abs(change))} since last close`),
  // "Carries into" (/marketing, 2026-10-08): the path's last stop is where the closing balance goes, Ask 4's word.
  pathOpens: 'Carries into',
  pathOpensWhat: 'As its opening balance, locked',
  pathNextPlan: (lines: number) => (lines > 0 ? `Its own plan · ${pluralize(lines, 'line', 'lines')}` : 'No plan yet · start it on the Budget'),
  // On a phone the path stacks: the figure, then what locks, then the year that opens on it.
  pathLocksPhone: (name: string) => `Locks ${name}`,
  pathLocksPhoneWhat: (span: string, books: number, lines: number) =>
    `${span} · ${pluralize(books, 'book', 'books')}, ${pluralize(lines, 'line', 'lines')}, and its plan`,
  pathOpensPhone: (next: string) => `${next} opens on it, locked`,
  stillOpen: 'Still open',
  stillOpenNote: 'None of these stop the close.',
  nothingOpen: (name: string) => `Nothing is still open in ${name}.`,
  // One line each: the count sits in its own column, so each noun follows it.
  installmentsNoun: (n: number) => (n === 1 ? 'installment owed' : 'installments owed'),
  requestsNoun: (n: number) => (n === 1 ? 'request waiting on you' : 'requests waiting on you'),
  requestsNounShort: (n: number) => (n === 1 ? 'request waiting' : 'requests waiting'),
  unfiledNoun: (n: number) => (n === 1 ? 'line not filed under a word' : 'lines not filed under a word'),
  unfiledNounShort: (n: number) => (n === 1 ? 'line not filed' : 'lines not filed'),
  pendingNoun: (n: number) => (n === 1 ? 'line not cleared' : 'lines not cleared'),
  /** An installment state, said once on its word (red when late). */
  installmentState: (state: 'overdue' | 'sent' | 'upcoming', on: string) =>
    (state === 'overdue' ? `overdue since ${day3c(on)}` : state === 'sent' ? `sent ${day3c(on)}, waiting for you` : `due ${day3c(on)}`),
  installmentStateShort: (state: 'overdue' | 'sent' | 'upcoming') =>
    (state === 'overdue' ? 'overdue' : state === 'sent' ? 'sent, waiting for you' : 'still to come'),
  /** A state's amount, when the row's one figure can't say it: several installments of one size ("$600.00 each"). */
  installmentEach: (amount: string) => `${amount} each`,
  /** Past three teams the names stop: "13U AAA, 14U AA, 15U AAA and 2 more". */
  moreTeams: (n: number) => `and ${n} more`,
  holdingPayout: (n: number) => (n === 1 ? 'holding up its payout' : `${n} holding up a payout`),
  unfiledWhy: (name: string) => `off-plan in ${name}`,
  unfiledWhyShort: 'off-plan',
  pendingWhy: (next: string) => `counts in ${next} when it clears`,
  pendingWhyShort: (next: string) => `clears in ${next}`,
  /** The three promises, in one line at the foot, read just before the button that relies on them. */
  promises: 'Nothing is deleted, and you can reopen it while it is the latest closed year. Closing the club’s year never touches a team’s own book.',
  promisesShort: 'Nothing is deleted, and you can reopen it. A team’s own book is never touched.',
  notYet: 'Not yet',
  close: (name: string) => `Close ${name}`,
  closingNow: 'Closing…',
  done: (name: string, next: string, closing: string) => `${name} is closed. ${next} opens on ${closing}, locked.`,
  failed: 'The year couldn’t be closed. Please try again.',
  offline: 'The year couldn’t be closed. Check your connection and try again.',
  loadFailed: 'What closing the year would do couldn’t be loaded. Please try again.',
} as const;

/** Reopen (specimen 3; Ask 3). The button is white: reopening is neither a money move nor destructive. */
export const REOPEN_YEAR_WORDS = {
  title: (name: string) => `Reopen ${name}?`,
  lead: (name: string, next: string) =>
    `Its books and plan unlock until you close it again. Meanwhile ${next ? `${next}’s` : 'the next year’s'} opening balance follows the books, and ${name}’s year-end report can change.`,
  label: 'Why',
  hint: 'Kept with the year: who reopened it, when, and why.',
  keep: 'Keep it closed',
  confirm: (name: string) => `Reopen ${name}`,
  busy: 'Reopening…',
  failText: 'The year couldn’t be reopened.',
  done: (name: string) => `${name} is open again. Close it from the Overview when it’s ready.`,
} as const;

/** A record dated in a closed year: its corrections are absent, one locked sentence in their place (S3C-07). */
export const lockedRecordWords = (verb: 'undo' | 'change' | 'reverse' | 'void', year: string, reopen: string | null) =>
  `Recorded in ${year}, which is closed.${reopen ? ` To ${verb} it, reopen ${reopen}.` : ''}`;

/** The Ledger's locked line (S3C-07): a closed year's pending line keeps one action — it clears into the open year. */
export const LEDGER_LOCK_WORDS = {
  clear: 'It cleared today',
  clearing: 'Clearing…',
  clearsNote: 'It can still clear: it is then posted and dated the day it clears, in the open year.',
  cleared: (what: string) => `${what} cleared today. It counts in the open year; the day it was written stays with it.`,
  clearFailed: 'It couldn’t be cleared. Please try again.',
  clearOffline: 'It couldn’t be cleared. Check your connection and try again.',
} as const;

/** The Budget's opening row once the year before is closed (Ask 4). */
export const carriedOpeningWords = (prior: string, closedOn: string) => `${prior}’s closing, locked when it closed on ${day3c(closedOn)}`;
export const carriedOpeningNote = (opening: string, prior: string) =>
  `The year opened with ${opening}, ${prior}’s closing balance, locked when ${prior} was closed. Revenue and expenses are planned; money is assumed to arrive and leave in its planned months.`;

/** Budget vs. Actual's band on a closed year: Cash on hand is the year's closing. */
export const cashAtCloseCaption = (lastDay: string) => `the club’s books · at the close, ${day3c(lastDay)}`;

/** The Overview's "From 2025–26, still open" (Ask 4): each row's state. */
export const STILL_OPEN_WORDS = {
  overdue: (due: string) => `Overdue since ${day3c(due)}`,
  sent: (on: string) => `Sent ${day3c(on)}, waiting for you`,
  upcoming: (due: string) => `Due ${day3c(due)}`,
  holding: 'holding up a payout',
  request: (what: string) => `Request · ${what}`,
} as const;

/** Compare › Against last year (Ask 8c): the pill's choice, and the heading that names the spans compared. */
export const AGAINST_LAST_YEAR_WORDS = {
  option: (lastYear: string) => `Against ${lastYear}`,
  change: 'Change',
  /** Under a year's heading: the span its figures cover (the server's spans — the same months, a year apart). */
  columnSpan: (from: string, to: string) => `${day3c(from)} to ${day3c(to)}`,
  bothClosed: 'Both years are closed, so neither column can move: each shows its books as they were closed.',
  frozen: 'Last year is closed, so its column can’t move: it shows the books as they were closed.',
  open: 'Both columns follow the books until each year is closed.',
  key: 'Change is this year less last year. More revenue and less spending are better (green); the reverse is worse (red).',
} as const;

/** The year-end report (specimen 5): its titles and sections. */
export const YEAR_END_WORDS = {
  title: 'Year-end report',
  /** The Export menu's one line on a closed year (owner, §283 W7 2026-10-08): the name, never its contents. */
  menuTitle: (year: string) => `Year-end report · ${year}`,
  closedBy: (by: string | null, on: string) => `Closed ${day3c(on, true)}${by ? ` by ${by}` : ''}`,
  prepared: (on: string) => `Prepared ${day3c(on, true)}`,
  atAGlance: 'The year at a glance',
  openingOn: (d: string) => `Opening balance · ${day3c(d, true)}`,
  closingOn: (d: string) => `Closing balance · ${day3c(d, true)}`,
  againstBoth: (lastYear: string | null) => (lastYear ? `The year against its budget and against ${lastYear}` : 'The year against its budget'),
  varianceKey: 'A + Variance is better than the budget, a − worse. Money counts in the year it came into or left the club’s books.',
  books: 'The club’s books at the close',
  booksTotal: 'The club’s cash',
  teams: 'The teams’ standing with the club',
  carried: (next: string) => `Still open at the close, carried into ${next}`,
  carriedInstallments: (n: number, teams: string) => `${pluralize(n, 'installment', 'installments')} still owed${teams ? ` (${teams})` : ''}`,
  carriedRequests: (n: number, teams: string) => `${pluralize(n, 'request', 'requests')} waiting for the club${teams ? ` (${teams})` : ''}`,
  carriedPending: (n: number, payees: string) => `${pluralize(n, 'line', 'lines')} not yet cleared${payees ? ` (${payees})` : ''}`,
  nothingCarried: 'Nothing was still open at the close.',
  foot: (name: string) => `Year-end report ${name} · the year is closed and its figures are locked`,
} as const;

/** New allocation, in the line's window (specimen 6; Ask 6). */
export const NEW_ALLOCATION_WORDS = {
  fromLineEyebrow: (line: string, year: string, left: string, allocated: string | null) =>
    `${line} · ${year} · ${left} left${allocated ? ` · ${allocated} already allocated` : ''}`,
  fromLineTitle: (line: string) => `Allocate from ${line}`,
  eyebrow: 'Allocations',
  title: 'New allocation',
  billFrom: 'Bill from',
  billFromPick: (year: string) => `Choose a line on the ${year} plan, or none`,
  billFromLines: (year: string) => `${year} plan · cost lines with something left`,
  billFromNone: 'Not on the plan',
  offPlan: 'An off-plan bill',
  offPlanDetail: 'no line',
  lineLeft: (left: string) => `${left} left`,
  noLinesLeft: (year: string) => `Nothing is left to allocate on the ${year} plan.`,
  name: 'Name',
  amount: 'Amount',
  amountUpTo: (left: string) => `Up to ${left}. What you don’t allocate stays on the line.`,
  split: 'Split',
  payBy: 'Pay by',
  splitEven: 'Evenly',
  splitFixed: 'By amount',
  splitPercent: 'By percentage',
  splitSessions: 'By sessions',
  payOne: 'One payment',
  payInstallments: (n: number) => `${n} installments`,
  dueOn: 'Due',
  team: 'Team',
  season: 'Season',
  share: 'Share',
  teamsLabel: 'Teams billed',
  tick: (team: string) => `Bill ${team}`,
  noSeason: (last: { name: string; closedOn: string | null } | null) =>
    (last ? `No season running: its ${last.name} closed${last.closedOn ? ` on ${day3c(last.closedOn)}` : ''}` : 'No season running yet'),
  ownPayments: (team: string) => `${team}’s own payments`,
  ownPaymentsHead: 'Own payments',
  paysIn: 'This team pays in',
  /** A team's own-payments choice that keeps the bill's schedule. */
  billsSchedule: (schedule: string) => `${schedule}, as the bill`,
  paymentsCount: (n: number) => `${n} payments`,
  paymentsAddUp: (sum: string, share: string) => `These add up to ${sum} of its ${share} share.`,
  teamsCount: (n: number) => pluralize(n, 'team', 'teams'),
  nothingLeft: 'nothing left over',
  short: (d: string) => `${d} short`,
  over: (d: string) => `${d} over`,
  percentShort: (d: string) => `${d}% short of 100%`,
  percentOver: (d: string) => `${d}% over 100%`,
  notes: 'Notes',
  notesHint: 'For the club’s own reference; teams don’t see it',
  cancel: 'Cancel',
  create: 'Create allocation',
  creating: 'Creating…',
  made: (amount: string, teams: number) => `Allocated ${amount} to ${pluralize(teams, 'team', 'teams')}`,
  pickTeams: 'Tick at least one team.',
  pickDue: 'Give each payment a due date.',
  pickLine: 'Choose what this bills from.',
  failed: 'The allocation couldn’t be made. Please try again.',
  offline: 'The allocation couldn’t be made. Check your connection and try again.',
} as const;

/** A payee's window (specimen 7; Ask 7): it reads first, its report inside. */
export const PAYEE_WINDOW_WORDS = {
  eyebrowShared: 'Payee · shared with teams',
  eyebrow: 'Payee',
  sharedLabel: 'Shared with teams',
  sharedSince: (on: string) => `Since ${day3c(on, true)}. Every team can pick it; the club sees what they record paying it.`,
  notShared: 'No: the club’s own',
  ownLabel: 'The club’s own entries',
  named: (uses: number, last: string | null) => (uses === 0 ? 'Named on none' : `Named on ${uses}${last ? ` · last ${day3c(last)}` : ''}`),
  phoneLine: (since: string | null, uses: number) =>
    `${since ? `Shared with teams since ${day3c(since, true)} · ` : ''}named on ${uses} of the club’s own entries.`,
  recorded: 'What the teams recorded',
  recordedFolded: (year: string) => `What the teams recorded · ${year}`,
  foldedCaption: (teams: number, total: string) => `${pluralize(teams, 'team', 'teams')} · ${total} · reads in full when you’re done editing`,
  note: (since: string | null) => `Each team’s own record of paying it${since ? ` since you shared it on ${day3c(since)}` : ''}. Not proof that a payment was made.`,
  noteShort: (since: string | null) => `The teams’ own records${since ? ` since ${day3c(since)}` : ''}. Not proof of payment.`,
  payments: 'Payments',
  firstLatest: 'First · latest',
  amountRecorded: 'Recorded',
  nothingInYear: (payee: string, year: string) => `No team recorded paying ${payee} in ${year}.`,
} as const;

/** The coach's Club tab: the earlier-season band and its tile's caption (Ask 8b). */
export const EARLIER_SEASON_WORDS = {
  caption: (count: number, seasonName: string | null) =>
    `${pluralize(count, 'installment', 'installments')}, from ${seasonName ? `the ${seasonName}` : 'an earlier season'}`,
  withThisSeason: (earlier: number, seasonName: string | null) =>
    `${pluralize(earlier, 'installment', 'installments')} from ${seasonName ? `the ${seasonName}` : 'an earlier season'} included`,
} as const;
