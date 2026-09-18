/**
 * "Send to staff" — the pure half (COACH_PRACTICE_WHO_RUNS_IT_PLAN.md §5.3, owner rulings A–K
 * 2026-09-17). Who a practice plan reaches, and what the message says. No I/O here: the route
 * reads the staff and writes the stamp; `tests/unit/practice-plan-send.test.ts` pins every audience
 * against a mixed staff fixture.
 *
 * ⚠ THE AUDIENCES ADDRESS BY THE STAFF KIND WORD — and that word is ruled "a label that gates
 * nothing" (mig 288's rule; `staffKindLabel`'s own doc says NEVER gate on it). Choosing who to
 * ADDRESS by it is not access control: a manager left off the list can still open the plan. It is,
 * though, the first place the word decides anything beyond what is printed on a row (F06) — said
 * here so it is a decision and not a drift.
 *
 * ⚠ TWO RULES EVERY AUDIENCE OBEYS: never the sender (nobody is told about their own act), and
 * never someone whose access excludes the schedule (the deep link would refuse them, and a
 * notification that dead-ends is the 404 bug in politer clothes).
 */
import type { PracticePlan, PracticePlanSendAudience } from './types';
import type { StaffKind } from './coach-capabilities';
import { collectPracticePlanTagIds, practicePlanLevels } from './rep-practice-plan';

export const PRACTICE_PLAN_AUDIENCES: ReadonlyArray<PracticePlanSendAudience> = ['named', 'coaches', 'staff'];

export function sanitizeAudience(input: unknown): PracticePlanSendAudience | null {
  return typeof input === 'string' && (PRACTICE_PLAN_AUDIENCES as readonly string[]).includes(input)
    ? (input as PracticePlanSendAudience)
    : null;
}

/** The three options as the sheet and the sent state print them — one spelling, one home. */
export const AUDIENCE_LABEL: Readonly<Record<PracticePlanSendAudience, string>> = {
  named: 'Named in this plan',
  coaches: 'Coaches and helpers',
  staff: 'Everyone on staff',
};

/** The sent state's parenthesis — lower-case, because it follows "Sent to 3". */
export const AUDIENCE_SENT_LABEL: Readonly<Record<PracticePlanSendAudience, string>> = {
  named: 'named in the plan',
  coaches: 'coaches and helpers',
  staff: 'everyone on staff',
};

/**
 * One person on the team's staff this season, as the send and the picker see them. Built
 * server-side by `lib/practice-plan-staff.ts`; the client receives the same shape minus `email`.
 */
export interface PracticeStaffPerson {
  userId: string;
  /** Their display name, else the local part of their email — never blank. */
  name: string;
  /** 'head', or the stored/derived staff kind. Decides "Coaches and helpers" (decision A: helpers in). */
  kind: 'head' | StaffKind;
  /** The word on the staff list — "Head coach", "Team manager" … — for the picker's people group. */
  kindWord: string;
  /** May they open the plan at all (`canViewSchedule`)? False excludes them from every audience. */
  canReadPlan: boolean;
  /** This team's staff tag linked to them (mig 303), if any — what "Named in this plan" matches on. */
  tagId: string | null;
  /** Server-side only — stripped before the wire. */
  email?: string | null;
}

/** A staff tag as the audience rule needs it: its id, its word, and who it is. */
export interface StaffTagIdentity { id: string; name: string; userId?: string | null }

/** The kinds "Coaches and helpers" reaches — the people who will be on the field (decision A). */
export const FIELD_KINDS: ReadonlySet<'head' | StaffKind> = new Set(['head', 'assistant', 'helper']);

export interface PracticePlanRecipients {
  recipients: PracticeStaffPerson[];
  /**
   * Words on the plan that are nobody — an unlinked tag ("Adam", the outside instructor) or a
   * legacy free-text name — so the sheet can say "Adam — a name only, not sent" instead of
   * letting an outside instructor look like a delivery. Only meaningful for 'named'; empty otherwise.
   */
  unlinkedNames: string[];
  /** Is the SENDER's own word on the plan? The sheet says "Only you are linked on this plan so far." */
  senderOnPlan: boolean;
}

/**
 * Who a send reaches. Pure; the same function feeds the sheet's preview counts (per audience) and
 * the route's actual dispatch, so the number the coach read is the number that goes.
 */
export function practicePlanRecipients(
  people: readonly PracticeStaffPerson[],
  audience: PracticePlanSendAudience,
  ctx: { senderUserId: string; plan: PracticePlan | null; staffTags: readonly StaffTagIdentity[] },
): PracticePlanRecipients {
  const eligible = people.filter(p => p.userId !== ctx.senderUserId && p.canReadPlan);
  const onPlan = ctx.plan ? collectPracticePlanTagIds(ctx.plan, 'staff') : new Set<string>();
  const senderTag = people.find(p => p.userId === ctx.senderUserId)?.tagId ?? null;
  const senderOnPlan = senderTag != null && onPlan.has(senderTag);

  if (audience === 'staff') return { recipients: eligible, unlinkedNames: [], senderOnPlan };
  if (audience === 'coaches') return { recipients: eligible.filter(p => FIELD_KINDS.has(p.kind)), unlinkedNames: [], senderOnPlan };

  // 'named' — every level's staff tag ids, matched to the people those tags ARE.
  const recipients = eligible.filter(p => p.tagId != null && onPlan.has(p.tagId));

  const tagById = new Map(ctx.staffTags.map(t => [t.id, t]));
  const unlinked = new Set<string>();
  for (const id of onPlan) {
    const tag = tagById.get(id);
    if (tag && !tag.userId) unlinked.add(tag.name);
  }
  // Legacy free-text names (pre-266) are words too — the walk above only sees ids.
  for (const block of ctx.plan?.blocks ?? []) {
    if (!block.staffTagIds?.length) for (const n of block.staff ?? []) if (n.trim()) unlinked.add(n.trim());
    for (const s of block.stations ?? []) {
      if (!s.staffTagIds?.length) for (const n of s.staff ?? []) if (n.trim()) unlinked.add(n.trim());
    }
  }
  return { recipients, unlinkedNames: [...unlinked].sort((a, b) => a.localeCompare(b)), senderOnPlan };
}

/** One person's staff tag ids as the walk wants them — one word per person per team, so at most one. */
export function mineTagIdsOf(person: Pick<PracticeStaffPerson, 'tagId'> | null | undefined): Set<string> {
  return new Set(person?.tagId ? [person.tagId] : []);
}

/**
 * The blocks and stations ONE recipient is on, as labels in practice order — "Close control",
 * "Footwork ladder", a whole block by its title. What the message and the email name.
 */
export function myLabelsOnPlan(plan: PracticePlan | null, mineTagIds: ReadonlySet<string>): string[] {
  return practicePlanLevels(plan, mineTagIds).flatMap(l => [
    ...(l.mine ? [l.title] : []),
    ...l.stations.filter(s => s.mine).map(s => s.label),
  ]);
}

/** "Close control", "Close control and Footwork ladder", "Close control, Footwork ladder and the game". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export interface PracticePlanMessageInput {
  /** "Tuesday" within the week; a short date beyond it — the caller decides from the org clock. */
  dayLabel: string;
  /** "6:00 p.m." — the practice's start, in the house clock. */
  startLabel: string;
  /** "5:45 p.m." when the schedule has an arrival time, else null. */
  arriveLabel: string | null;
  /** What THIS recipient is on — empty for a person not named on the plan. */
  myLabels: readonly string[];
}

/**
 * A sentence that ends on a clock: the house clock already ends in a period ("6:00 p.m."), so
 * the sentence adds none — "for 6:00 p.m.." was the first thing the unit test caught.
 */
export function endOnClock(sentence: string): string {
  return sentence.endsWith('.') ? sentence : `${sentence}.`;
}

/**
 * The bell/push message, personalized: the two facts an assistant needs — what's mine, when to
 * be there — and nothing else. The email (`lib/practice-plan-email.ts`) opens with the same line.
 */
export function practicePlanSentMessage(input: PracticePlanMessageInput): { title: string; body: string } {
  const title = `${input.dayLabel}’s practice plan is ready`;
  const when = endOnClock(input.arriveLabel
    ? `Arrive by ${input.arriveLabel} for ${input.startLabel}`
    : `Read it before ${input.startLabel}`);
  const body = input.myLabels.length > 0
    ? `You’re on ${joinNames(input.myLabels)}. ${when}`
    : when;
  return { title, body };
}

/**
 * "Tuesday" when the practice is within the coming six days (the word a coach uses at the field),
 * else the short date ("Sep 29"). Six is the line because the seventh day is today's own weekday
 * again — "Thursday's practice plan" on a Thursday must not mean next week's — and yesterday's
 * practice keeps its word (a send the morning after). Pinned at the boundary by the unit test.
 */
export function practiceDayLabel(startsAt: string, nowMs: number, fmt: {
  weekday: (iso: string) => string; shortDate: (iso: string) => string;
}): string {
  const start = new Date(startsAt).getTime();
  const days = (start - nowMs) / 86_400_000;
  return days >= -1 && days < 6 ? fmt.weekday(startsAt) : fmt.shortDate(startsAt);
}
