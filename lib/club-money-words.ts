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
  year_has_lines: (year: number) => `${year} already has a plan. Add to it line by line.`,
  nothing_to_copy: (year: number) => `${year} has no lines to start from.`,
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
export const netForYearWord = (year: number) => `Net for ${year}`;

/** By period, under the grid: how From the teams spreads. */
export const FROM_THE_TEAMS_SPREAD_NOTE = 'From the teams is placed by its installments’ due dates; every other line by its own dates.';
/** By period, money dated outside the year (it sits under No date yet, in the Total and in no month). */
export const outsideTheYearNote = (year: number) =>
  `Some of this plan is dated outside ${year}. It sits under No date yet: in the year’s Total, in no month. Change its dates to place it.`;

/** An empty year (C10): the compact empty state — one sentence, the fact, the one lime action. */
export const emptyYearWords = (year: number, from: number | null) => ({
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
  againstHeading: (year: number) => `${year} against the budget`,
  /** Headroom said once, with its arithmetic (its one definition). */
  headroom: (headroom: number, revenueUnder: number, owed: number) => {
    const head = headroom >= -0.005
      ? `Headroom: ${fmt(headroom)} of the year’s planned spending is left.`
      : `Headroom: spending is ${fmt(Math.abs(headroom))} over the year’s plan.`;
    if (revenueUnder <= 0.005) return head;
    return `${head} Revenue is ${fmt(revenueUnder)} under plan so far${owed > 0.005 ? `, and ${fmt(Math.min(owed, revenueUnder))} of that is what the teams still owe` : ''}.`;
  },
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
  doorCaption: (teams: number, total: number, year: number) =>
    teams === 0 ? `Nothing recorded in ${year}` : `${teams} ${teams === 1 ? 'team' : 'teams'} · ${fmt(total)} in ${year}`,
  callout: (payee: string, year: number, sharedOn: string | null) =>
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

/** The Ledger's "Filed under" hint (Ask 4a): is the word on this year's plan? */
export const filedUnderHint = (onPlan: { planned: number } | null, year: number) =>
  (onPlan ? `On the ${year} plan · ${fmt(onPlan.planned)} planned.` : `Not on the ${year} plan, so it counts as off-plan.`);
export const FILED_BY_ITS_SOURCE = 'Filed by where it came from';
export const wasCategoryWord = (legacy: string) => `was: ${legacy}`;
