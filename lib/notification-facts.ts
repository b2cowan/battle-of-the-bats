/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A NOTICE THAT READS AT A GLANCE — the one stored-facts shape every opened notification can wear
 * (Notifications read at a glance, Stage 2; plan docs/projects/active/NOTIFICATION_MESSAGE_ROWS_PLAN.md,
 * drawing https://claude.ai/artifact/4oPRNGetZWQ2ei483Gs2i5 tab 1; owner rulings Q1–Q3, 2026-11-14).
 *
 * A notice that has its facts stores them on the notification (`metadata.facts`), and the opened message — the
 * reader and the bell's drawer, which share one block — draws them as labelled rows: label → value (the value may be
 * a bold lead plus a quieter detail), an optional list under one row, an optional next-step line. The stored BODY is
 * the one-line summary the list rows, the push and the email read (ruling 2). A notice sent before its kind stored
 * facts has none and keeps its paragraph (ruling 4) — which is why every read here is defensive.
 *
 * ⚖ ONE WORD PER IDEA (Q1, /design): a label comes from `FACT_LABELS`, sentence case, at most 11 characters (a test
 *   holds every one), so the 5.5rem column never wraps and the same idea reads the same on every kind.
 * ⚖ A DEADLINE IS A ROW ("Answer by"); the instruction is the one `next` line under the rows (Q2). Once a
 *   Needs-attention notice is settled, the settled line REPLACES `next` — the reader drops it.
 * ⚖ A LIST SHOWS 6 LINES, then "Show N more <noun>" opens the rest in place (Q3, B). At most 30 are stored; past 30
 *   the last line reads "and N more …" in the sender's own words (`capFactList`).
 *
 * Pure and client-safe.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** The shared vocabulary (Q1): one word per idea across every kind. Sentence case; at most 11 characters each. */
export const FACT_LABELS = {
  // What and how much
  amount: 'Amount',
  bill: 'Bill',
  billed: 'Billed',
  moneyBack: 'Money back',
  extra: 'Extra',
  firstDue: 'First due',
  payments: 'Payments',
  // Whose, and who
  for: 'For',
  team: 'Team',
  family: 'Family',
  paidBy: 'Paid by',
  whoAnswers: 'Who answers',
  // Where it is
  account: 'Account',
  sentTo: 'Sent to',
  money: 'Money',
  book: 'Book',
  // When
  paid: 'Paid',
  sent: 'Sent',
  received: 'Received',
  returned: 'Returned',
  refunded: 'Refunded',
  from: 'From',
  stops: 'Stops',
  answerBy: 'Answer by',
  replyBy: 'Reply by',
  // Why, and what it means
  reason: 'Reason',
  how: 'How',
  held: 'Held',
  owesAgain: 'Owes again',
  stillOwe: 'Still owe',
  spot: 'Spot',
  spots: 'Spots',
  place: 'Place',
  ifNotPaid: 'If not paid',
  payNow: 'Pay now',
  payouts: 'Payouts',
  // Time and schedules
  season: 'Season',
  schedule: 'Schedule',
  slots: 'Slots',
  practices: 'Practices',
  gives: 'Gives',
  takesBack: 'Takes back',
  // Stage 3, the list notices (drawing tabs 4 and 5; owner rulings 2026-11-15 for the undrawn kinds)
  divisions: 'Divisions',
  games: 'Games',
  answers: 'Answers',
  answer: 'Answer',
  now: 'Now',
  events: 'Events',
  thisWeek: 'This week',
  champions: 'Champions',
  cameOff: 'Came off',
  clubOwes: 'Club owes',
  paidFor: 'Paid for',
  payment: 'Payment',
  // Stage 4, the few-facts coach and league notices (owner rulings 2026-11-15, Q3–Q7) [marketing]
  players: 'Players',
  note: 'Note',
  invitedBy: 'Invited by',
  invited: 'Invited',
  role: 'Role',
  youreOn: 'You’re on',
  arriveBy: 'Arrive by',
  starts: 'Starts',
  cameWith: 'Came with',
  tryouts: 'Tryouts',
  lastSeason: 'Last season',
} as const;

export const FACT_LABEL_MAX = 11;
/** Lines a list shows before it folds (Q3). */
export const FACT_LIST_FOLD = 6;
/** Lines a list stores at most (Q3); past it the last line is the sender's "and N more …". */
export const FACT_LIST_MAX = 30;

/** A list line with a bold part: "Maya · **In** · was Out", "U12 · **Ridge 12U**" (drawing tab 5). */
export interface FactLine {
  text: string;
  /** The line's bold part, after the text. */
  lead?: string;
  /** A quieter part after the lead. */
  detail?: string;
}

/** A list line with a bold part, leaving out any empty part (a stored line never holds an empty one). */
export function factLine(text: string, lead?: string | null, detail?: string | null): FactLine {
  // A line with no text of its own (a blank division) leads with its bold part: a stored line always has text, or the whole
  // notice's rows would be refused on the way back (the read is all-or-nothing).
  if (!text.trim() && lead?.trim()) return factLine(lead, null, detail);
  return { text: text.trim(), ...(lead?.trim() ? { lead: lead.trim() } : {}), ...(detail?.trim() ? { detail: detail.trim() } : {}) };
}

/** A list line as plain words: "Maya · In · was Out" (keys, tests, anything that reads it as text). */
export const factLineText = (l: string | FactLine): string =>
  typeof l === 'string' ? l : [l.text, l.lead, l.detail].filter(Boolean).join(' · ');

/** A list under one row: one item per line; folds past 6 ("Show 3 more games"). */
export interface FactList {
  lines: (string | FactLine)[];
  /** The fold's noun, singular and plural: "Show 1 more game" / "Show 3 more games". */
  noun: { one: string; many: string };
  /** Past 30: the closing line, in the sender's words ("and 12 more on the schedule"). Never folded away. */
  overflow?: string;
}

/** One labelled row. */
export interface FactRow {
  label: string;
  /** The answer. '' only on a row that IS its list (family answers: the children are the answer, Stage 3). */
  value: string;
  /** The answer is the row's bold lead (an amount, a count, a deadline). */
  lead?: boolean;
  /** A quieter detail after the value: "receipt 1042", "Mar 13 – Apr 3", "nothing was taken". */
  detail?: string;
  /** A list under this row, running the full width on a phone. */
  list?: FactList;
}

/** What an opened notice lays out, stored as `metadata.facts`. */
export interface NoticeFacts {
  rows: FactRow[];
  /** One plain line under the rows, starting with a verb. Dropped once the notice is settled (Q2). */
  next?: string;
}

/** A row, or nothing when there is no value to show (a row with no answer is left out, never drawn empty). */
export function factRow(label: string, value: string | null | undefined, more: Omit<FactRow, 'label' | 'value' | 'detail'> & { detail?: string | null } = {}): FactRow[] {
  const v = value?.trim();
  if (!v) return listRow(label, more.list);
  const row: FactRow = { label, value: v };
  if (more.lead) row.lead = true;
  if (more.detail?.trim()) row.detail = more.detail.trim();
  if (more.list && more.list.lines.length) row.list = more.list;
  return [row];
}

/** A row that IS its list (no answer line of its own; the list starts on the label's line), or nothing for an empty list.
 *  Reached as `factRow(label, null, { list })`, the one way senders write it. */
function listRow(label: string, list: FactList | null | undefined): FactRow[] {
  return list && list.lines.length ? [{ label, value: '', list }] : [];
}

/** Assemble a notice's facts from rows (or row-or-nothing pieces) and a next step. */
export function noticeFacts(rows: (FactRow | FactRow[])[], next?: string | null): NoticeFacts {
  const flat = rows.flat();
  return next?.trim() ? { rows: flat, next: next.trim() } : { rows: flat };
}

/** A list kept to 30 lines; past 30 the sender's closing line names how many more there are. A blank line is left out
 *  (it would draw as an empty bullet, and a blank line object would void the notice's rows on the read). */
export function capFactList(all: readonly (string | FactLine)[], noun: FactList['noun'], overflow: (more: number) => string): FactList {
  const lines = all.filter(l => (typeof l === 'string' ? l : l.text).trim());
  if (lines.length <= FACT_LIST_MAX) return { lines, noun };
  return { lines: lines.slice(0, FACT_LIST_MAX), noun, overflow: overflow(lines.length - FACT_LIST_MAX) };
}

const str = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isLine = (x: unknown): x is string | FactLine => {
  if (typeof x === 'string') return true;
  const l = x as Partial<FactLine> | null;
  return !!l && str(l.text) && (l.lead === undefined || str(l.lead)) && (l.detail === undefined || str(l.detail));
};
const readLine = (x: string | FactLine): string | FactLine =>
  typeof x === 'string' ? x : { text: x.text, ...(x.lead ? { lead: x.lead } : {}), ...(x.detail ? { detail: x.detail } : {}) };

function readList(v: unknown): FactList | null | undefined {
  if (v === undefined) return undefined;
  const l = v as Partial<FactList> | null;
  if (!l || !Array.isArray(l.lines) || !l.lines.every(isLine) || !l.noun || !str(l.noun.one) || !str(l.noun.many)) return null;
  if (l.overflow !== undefined && !str(l.overflow)) return null;
  return { lines: l.lines.map(readLine), noun: { one: l.noun.one, many: l.noun.many }, ...(l.overflow ? { overflow: l.overflow } : {}) };
}

/** Read a notification's stored facts back, or null — a notice sent before its kind stored facts, or anything that
 *  does not read as the whole shape, keeps its paragraph (ruling 4). All or nothing: a half-drawn notice would hide
 *  a fact behind a row that isn't there. */
export function readNoticeFacts(meta: unknown): NoticeFacts | null {
  const f = (meta as { facts?: unknown } | null | undefined)?.facts as Partial<NoticeFacts> | undefined;
  if (!f || !Array.isArray(f.rows) || !f.rows.length) return null;
  if (f.next !== undefined && !str(f.next)) return null;
  const rows: FactRow[] = [];
  for (const r of f.rows as Partial<FactRow>[]) {
    if (!r || !str(r.label) || typeof r.value !== 'string') return null;
    if (r.lead !== undefined && typeof r.lead !== 'boolean') return null;
    if (r.detail !== undefined && !str(r.detail)) return null;
    const list = readList(r.list);
    if (list === null) return null;
    // A row with no answer of its own must be its list (a row is never drawn empty).
    if (!str(r.value) && (r.value !== '' || !list || !list.lines.length)) return null;
    rows.push({
      label: r.label, value: r.value,
      ...(r.lead ? { lead: true } : {}),
      ...(r.detail ? { detail: r.detail } : {}),
      ...(list ? { list } : {}),
    });
  }
  return f.next ? { rows, next: f.next } : { rows };
}

/** The fold's words (Q3): "Show 3 more games" / "Show fewer games". [marketing] */
export const FACT_FOLD_WORDS = {
  more: (n: number, noun: FactList['noun']) => `Show ${n} more ${n === 1 ? noun.one : noun.many}`,
  fewer: (noun: FactList['noun']) => `Show fewer ${noun.many}`,
} as const;
