/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB MONEY — EVERY SENTENCE THE SERVER SAYS ABOUT A MONEY MOVE (Club Tier Stage 3a, session 1).
 *
 * ⚠ DRAFTS FOR /marketing. The ratified drawings fixed what each sentence must CARRY (the team, the
 * thing, the amount, the reason); the words themselves are placement until /marketing rules on them,
 * in one pass with the coach's side so both sides use one set of words. Every string a person can
 * read lives here so that pass touches one file.
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
      error: `${teamName}’s coach has just said they sent this payment. Confirm it from their note instead.`,
      fixedBy: 'club' as const,
    },
    unpaid: {
      error: `${teamName}’s coach took back their note that this was sent, so there is nothing to confirm.`,
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
  'This payment was recorded before payments could be undone together with their ledger lines, so it can’t be undone here. Correct it with an entry on the ledger.';
export const UNLINKED_APPROVAL =
  'This request was approved before approvals could be reversed together with their ledger lines, so it can’t be reversed here. Correct it with an entry on the ledger.';

export const TRANSFER_VOID_REFUSAL: Record<string, string> = {
  not_a_transfer: 'This line isn’t a transfer.',
  already_void: 'This transfer has already been voided.',
  team_book: 'A team’s book is kept by its coaches. A transfer into or out of it can’t be voided here.',
  from_a_source: 'This line was written by an allocation, a payment request or a fee. Change it where it came from.',
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
    outro: `To arrange payment, reply to this email and it will reach ${p.senderName}. Once you’ve sent it, tell the club from your team’s Money page, under Club.`,
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
