/**
 * A SCHEDULE'S BILL BEFORE IT IS SENT, AS ACCOUNTING READS IT (Club Tier Stage 13d-3, Ask 15 A; drawing tab 4).
 *
 * A draft or in-review schedule can carry a bill (Schedules › Bill the teams) that names a budget line. It reserves
 * nothing on that line (`billIsPending`, lib/club-schedule-bill.ts) — so a treasurer reading the line, or billing it
 * from New allocation, would otherwise not know a schedule is about to bill the same teams for the same time. These
 * are the shape the reader returns and every sentence Accounting prints about it. It WARNS; it never blocks and is never
 * counted in Allocated or Not allocated. Once sent it is an ordinary allocation that says "from the schedule …".
 *
 * Client-safe: no server imports. The reader is `readDraftBills` (lib/club-draft-bill-server.ts); the screens are
 * components/admin/kit/club/money/DraftBills.tsx.
 */
import { fmt } from './coach-money-summary';
import { joinWithAnd, pluralize } from './utils';
import { moneyCents as cents } from './club-schedule-words';
import { teamsPhrase } from './club-money-words';
import type { PaymentPlan } from './club-schedule-bill';

export interface DraftBillTeam {
  /** Null on the folded row for teams outside the reader's groups (B11: counted, never named). */
  teamId: string | null;
  name: string;
  /** Priced hours (a slot's minutes × its field's share ÷ the teams on it) — what Fair shares counts. */
  hours: number;
  /** The team's share in cents; null when the bill has no amount yet. */
  cents: number | null;
  /** The folded row only: how many teams outside the reader's groups it stands for. */
  others?: number;
}

export interface DraftBill {
  scheduleId: string;
  name: string;
  state: 'draft' | 'in_review';
  lineId: string;
  lineName: string;
  /** What it would bill, in cents; null when there's no amount yet (no permit price and nothing typed). */
  cents: number | null;
  /** The teams it would bill, in the club's order. */
  teams: DraftBillTeam[];
  /** How many teams it would bill (named or not). */
  teamCount: number;
  hours: number;
  /** The rate, in cents per hour of a full field; null without an amount. */
  hourCents: number | null;
  plan: PaymentPlan;
  payments: number;
}

/** Hours to a tenth, as the schedule's Fair shares tile rounds them ("37.5"). */
export const hoursNumber = (h: number) => (Math.round(h * 10) / 10).toLocaleString('en-CA');
const hoursWord = (h: number) => `${hoursNumber(h)} ${Math.round(h * 10) === 10 ? 'hour' : 'hours'}`;
/** What the priced bills add up to, in cents; null when none has an amount yet. */
const pricedCents = (bills: readonly DraftBill[]): number | null => {
  const priced = bills.filter(b => b.cents != null);
  return priced.length ? priced.reduce((n, b) => n + b.cents!, 0) : null;
};

const PLAN_WORD: Record<PaymentPlan, string> = { one: 'One payment', monthly: 'monthly', two_months: 'every two months', dates: 'on dates the club chose' };

/** Every sentence Accounting prints about a schedule's bill before it is sent. */
export const DRAFT_BILL_WORDS = {
  heading: 'Being billed (draft)',
  kind: (b: Pick<DraftBill, 'state'>) => (b.state === 'in_review' ? 'A schedule in review' : 'A draft schedule'),
  /** The line window's row, under the schedule's name. */
  row: (b: DraftBill) => (b.cents == null
    ? `${b.state === 'in_review' ? 'In review' : 'Draft'} · no amount yet`
    : `${DRAFT_BILL_WORDS.kind(b)} · ${cents(b.cents)} to ${pluralize(b.teamCount, 'team')} when it’s sent · not billed yet`),
  sharesDoor: 'Fair shares',
  sharesLabel: (name: string) => `Open the fair shares of ${name}`,
  /** The budget table's caption under the line's name. */
  caption: (bills: readonly DraftBill[]) => {
    const sum = pricedCents(bills);
    return sum == null ? 'Being billed (draft) · no amount yet' : `${cents(sum)} being billed (draft)`;
  },
  /** The line's "not allocated" row, while a draft bills it: it is no longer true that the club pays it itself. */
  notAllocated: (bills: readonly DraftBill[], notAllocatedCents: number) => {
    const many = bills.length > 1;
    const who = many ? 'Draft schedules are' : `${DRAFT_BILL_WORDS.kind(bills[0])} is`;
    const sum = pricedCents(bills);
    if (sum == null) return `${who} billing this line. Allocating it here too could bill the same teams twice.`;
    const part = sum + 1 >= notAllocatedCents ? 'all of it' : `${cents(sum)} of it`;
    return `${who} billing ${part}. Allocating it here too bills the same teams twice.`;
  },
  /** New allocation, under the choice (and from the line's Allocate). Names the schedule and the amount, never teams. */
  warnTitle: (bills: readonly DraftBill[]) => (bills.length > 1 ? 'Schedules not sent yet are billing this line.' : `${DRAFT_BILL_WORDS.kind(bills[0])} is billing this line.`),
  warnOne: (b: DraftBill) => (b.cents == null
    ? `“${b.name}” bills this line when it’s sent; it has no amount yet.`
    : `“${b.name}” bills ${cents(b.cents)} to ${pluralize(b.teamCount, 'team')} when it’s sent.`),
  warnEnd: 'Billing them here as well would charge the same time twice.',
  /** One door per schedule: named when there are several. */
  warnDoor: (name?: string) => (name ? `See the fair shares of ${name}` : 'See its fair shares'),
  // ── The read-only Fair shares window ──
  eyebrow: (b: Pick<DraftBill, 'state'>) => `Schedule · ${b.state === 'in_review' ? 'in review' : 'draft'} · read only`,
  title: (name: string) => `${name} · fair shares`,
  lead: 'Each team pays for the hours it holds. An owner or an admin changes this in Schedules; nothing here is billed until they send it.',
  leadShort: 'An owner or an admin changes this in Schedules. Nothing is billed until they send it.',
  factBill: 'The bill',
  bill: (b: DraftBill) => `${b.cents == null ? 'No amount yet' : cents(b.cents)} · ${b.lineName}`,
  factHours: 'Hours',
  hours: (b: DraftBill) => `${hoursWord(b.hours)}${b.hourCents != null ? ` · ${cents(b.hourCents)} an hour` : ''}`,
  hoursOnly: hoursWord,
  factPlan: 'Payment plan',
  plan: (b: Pick<DraftBill, 'plan' | 'payments'>) => (b.plan === 'one' ? PLAN_WORD.one : `${pluralize(b.payments, 'payment')}, ${PLAN_WORD[b.plan]}`),
  colTeam: 'Team',
  colHours: 'Hours',
  colShare: 'Fair share',
  noShare: 'No amount yet',
  total: (n: number) => pluralize(n, 'team'),
  moreTeams: (n: number) => pluralize(n, 'more team'),
  otherTeams: (n: number) => `${pluralize(n, 'team')} outside your groups`,
  openSchedule: 'Open the schedule',
  noneLeft: 'This schedule no longer bills this line.',
} as const;

// ══ THE OTHER SIDE: a schedule's Bill window sees Accounting's allocations (Stage 13d-4, Ask 4 A; tab 4 notes 6-7) ══

/** One budget line as the Bill window warns about it — `/api/admin/accounting/line-billed`. */
export interface LineBilled {
  line: { id: string; description: string; yearName: string; left: number; closed: boolean; thisYear: boolean };
  /** What Accounting already bills on it: each allocation, its teams (the reader's groups named, the rest counted). */
  allocations: { name: string; amount: number; teamNames: string[]; otherTeams: number }[];
}

/** Every sentence the Bill window prints about the line it bills from. It WARNS; Off-plan stays possible, and is named. */
export const BILL_LINE_WORDS = {
  billedTitle: 'Accounting already bills this line.',
  billed: (allocs: LineBilled['allocations']) => {
    const said = joinWithAnd(allocs.map(a => `“${a.name}” charged ${teamsPhrase(a)} ${fmt(a.amount)}`));
    return `${said}. If ${allocs.length > 1 ? 'those were' : 'that was'} for this time, billing it here charges those teams twice.`;
  },
  seeLine: 'See the line',
  overTitle: (bill: number, left: number) => `This bill is ${fmt(bill)}; the line has ${fmt(left)} left.`,
  offPlanWay: 'Pick another line, or bill it off-plan: the teams are billed and no line’s budget is used.',
  /** The permit's own line, when the window can't offer it (it used to switch to no line without a word). */
  fellAwayTitle: (l: LineBilled['line']) => (l.closed
    ? `The permit’s line, “${l.description}”, is in ${l.yearName}, which is closed.`
    : !l.thisYear
      ? `The permit’s line, “${l.description}”, is in ${l.yearName}; a bill draws from this year’s lines.`
      : `The permit’s line, “${l.description}”, has nothing left to bill.`),
} as const;

/** Each line's bills, keyed by line id — what the budget table's captions and the line window read. */
export function draftBillsByLine(bills: readonly DraftBill[]): Map<string, DraftBill[]> {
  const out = new Map<string, DraftBill[]>();
  for (const b of bills) out.set(b.lineId, [...(out.get(b.lineId) ?? []), b]);
  return out;
}
