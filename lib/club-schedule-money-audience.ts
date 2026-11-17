import { canViewMoney, canViewSchedule, type CoachCapabilities } from './coach-capabilities';
import { SCHEDULE_NOTICES, billEmail, changesEmail, teamEmail, withoutReviewReply, type ChangeGroup, type EmailWords, type ScheduleUnreachableWhy } from './club-schedule-words';
import type { Installment } from './club-schedule-bill';
import type { CreditMove } from './club-hand-back-words';
import type { SendKind } from './club-schedule-send';
import type { PartBill } from './club-schedule-family-send';
import type { NotificationEventType } from './types';
import type { NoticeFacts } from './notification-facts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * MONEY TERMS GO ONLY TO PEOPLE WHO CAN OPEN MONEY (owner ruling 2026-11-13 — `docs/agents/legal/CASL_LATE_BILL_EMAIL.md`
 * finding 4, owner question 1; plan `docs/projects/active/LATE_BILL_MONEY_AUDIENCE_PLAN.md`).
 *
 * A club schedule send tells each team's staff about the bill only if they can open Money (`canViewMoney` — money `read`
 * counts; the send engine reads it with `isTeamMoneyMember`, the predicate the club money notices already use):
 *   · the late bill — a person without Money is not emailed and gets no bell (the engine leaves them out of its people);
 *   · review / Finalize / Send the changes — they still get the slots email and the slots bell, with every money line off
 *     (the bill list, "The bill is on your Money › Club tab", the correction, the credit / owed-back line, "and a $ bill").
 *
 * The words already switch money off by argument, so a team has at most TWO emails: the money one, and the same builder
 * with the money arguments nulled — no new email wording. Every decision the send makes per team lives here, pure, so the
 * preset × send matrix is unit-tested on the engine's own choices (`tests/unit/club-schedule-money-audience.test.ts`).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** Who a send keeps of a team's staff: everyone who sees the schedule (ruled for the send, Ask 7) — and, for the late
 *  bill, only those who can also open Money. Worked out BEFORE the unreachable reasons, so a team whose only schedule
 *  people are an Assistant and a Helper reads as unreachable for a late bill, and the counts stay true. */
export function inSendAudience(kind: SendKind, c: CoachCapabilities): boolean {
  return canViewSchedule(c) && (kind !== 'bill' || canViewMoney(c));
}

/**
 * Why a team with nobody to email can't be reached, worked out on the people `inSendAudience` kept: the sender is the
 * only one eligible → a head-coach invitation is waiting → an ACTIVE head coach has no email address on file (it used to
 * fall through to "has no head coach", which was false) → no head coach.
 */
export function unreachableWhy(p: { senderEligible: boolean; invitationWaiting: boolean; activeHeadCoaches: number }): ScheduleUnreachableWhy {
  return p.senderEligible ? 'only_you'
    : p.invitationWaiting ? 'invitation_unanswered'
    : p.activeHeadCoaches > 0 ? 'head_coach_no_email' : 'no_head_coach';
}

type Bill = { cents: number; installments: Installment[] };
type Lost = { creditCents: number; payCents: number; moves: readonly CreditMove[] };

/** Does a team's send carry money words? The SAME truthiness the words use (`teamEmail` on `bill`, `changesEmail` on
 *  `billedCents` and a `lost` with an amount) — so "carries money" ⇔ the plain email actually differs. */
export function carriesMoney(t: { bill: unknown; billedCents: number | null; lost: { creditCents: number; payCents: number } | null; partBills?: readonly unknown[] }): boolean {
  return !!t.bill || !!t.billedCents || !!(t.lost && (t.lost.creditCents || t.lost.payCents)) || !!t.partBills?.length;
}

/**
 * A team's two emails. `sample` is the email its coaches get — the money one when any recipient holds Money, else the
 * plain one (the Send window never shows an email nobody receives). `plainSample` only for a MIXED team. Each variant
 * greets only the people it goes to.
 */
export function teamSamples(p: {
  people: readonly { name: string | null; money: boolean }[];
  carries: boolean;
  build: (withMoney: boolean, names: (string | null)[]) => EmailWords;
}): { sample: EmailWords; plainSample: EmailWords | null } {
  const names = (money: boolean) => p.people.filter(x => x.money === money).map(x => x.name);
  const anyMoney = p.people.some(x => x.money), anyPlain = p.people.some(x => !x.money);
  if (!p.carries || !anyPlain) return { sample: p.build(true, p.people.map(x => x.name)), plainSample: null };
  if (!anyMoney) return { sample: p.build(false, p.people.map(x => x.name)), plainSample: null };
  return { sample: p.build(true, names(true)), plainSample: p.build(false, names(false)) };
}

/**
 * Every email a team's send builds, from one set of facts: the money variant, the plain one (a mixed team), whether the
 * send carries money at all, and whether its bill reaches nobody (a final / changes team with money words and no
 * recipient who can open Money — `SendPreview.billNotTold`).
 */
export function teamEmails(p: {
  kind: SendKind;
  orgName: string; scheduleName: string; teamName: string;
  people: readonly { name: string | null; money: boolean }[];
  /** review / final: the slots as pattern lines; changes: the change lines. */
  lines: string[];
  /** changes: the same changes as groups — the email lists these (owner 2026-11-17, ask 7). */
  groups?: readonly ChangeGroup[];
  venueName: string; slotCount: number; firstDay: string; lastDay: string; replyBy: string | null;
  bill: Bill | null; billedCents: number | null; lost: Lost | null;
  /** Send the changes on a schedule with added parts: each part's bill of its own that the send makes (Phase 8). */
  partBills?: readonly PartBill[];
  /** The schedule's link (review / final / changes) and the Money › Club tab's (the late bill). */
  link: string; moneyLink: string;
}): { sample: EmailWords; plainSample: EmailWords | null; carries: boolean; billNotTold: boolean } {
  const carries = carriesMoney(p);
  const build = (withMoney: boolean, recipientNames: (string | null)[]): EmailWords => {
    const base = { orgName: p.orgName, scheduleName: p.scheduleName, teamName: p.teamName, recipientNames };
    if (p.kind === 'bill') {
      // The late bill is only a bill: the engine leaves people without Money out of its audience, so there is no plain one.
      if (!withMoney || !p.bill) throw new Error('A late bill is only ever built for people who can open Money.');
      return billEmail({ ...base, bill: p.bill, link: p.moneyLink });
    }
    if (p.kind === 'changes') {
      return changesEmail({ ...base, lines: p.lines, groups: p.groups, billedCents: withMoney ? p.billedCents : null, lost: withMoney ? p.lost : null, partBills: withMoney ? p.partBills ?? [] : [], link: p.link });
    }
    return teamEmail({
      ...base, kind: p.kind, venueName: p.venueName, slotCount: p.slotCount, firstDay: p.firstDay, lastDay: p.lastDay,
      patterns: p.lines, bill: withMoney ? p.bill : null, replyBy: p.replyBy, link: p.link,
    });
  };
  const { sample, plainSample } = teamSamples({ people: p.people, carries, build });
  const billNotTold = (p.kind === 'final' || p.kind === 'changes') && carries && p.people.length > 0 && !p.people.some(x => x.money);
  return { sample, plainSample, carries, billNotTold };
}

/** Does this person get the team's plain email? Only on a mixed team (it has a `plainSample`), and only without Money. The
 *  one rule: the send (`emailFor`) and the Send window's rows and doors all read it, so they cannot disagree. */
export function getsPlainEmail(team: { plainSample: unknown }, person: { money: boolean }): boolean {
  return team.plainSample != null && !person.money;
}

/** The email one person gets. */
export function emailFor(team: { sample: EmailWords; plainSample: EmailWords | null }, person: { money: boolean }): EmailWords {
  return getsPlainEmail(team, person) ? team.plainSample! : team.sample;
}

/**
 * The review email carries the head coach's way to answer (Looks good / Ask for a change) — and only the head coach can
 * (owner 2026-11-14, Q-E). Anyone else on the team reads it without the reply sentence and its link. Any other send is
 * unchanged. The one rule: the send and the Send window's doors both read it.
 */
export function emailForPerson(kind: SendKind, replyBy: string | null, team: { sample: EmailWords; plainSample: EmailWords | null }, person: { money: boolean; isHeadCoach: boolean }): EmailWords {
  const w = emailFor(team, person);
  return kind === 'review' && !person.isHeadCoach ? withoutReviewReply(w, replyBy) : w;
}

/**
 * Who gets which bell. `everyone` — the slots bell (final, changes). `money` — a bill bell (`club_bill_arrived`) and the
 * review bell WITH its "and a $ bill"; empty when the team has no bill. `plain` — the review bell without the bill: the
 * people without Money when there is a bill, else everyone (one bell, one `notify`).
 */
export function bellGroups(p: { staff: readonly { userId: string; money: boolean }[]; hasBill: boolean }): {
  everyone: string[]; money: string[]; plain: string[];
} {
  const everyone = p.staff.map(s => s.userId);
  if (!p.hasBill) return { everyone, money: [], plain: everyone };
  return { everyone, money: p.staff.filter(s => s.money).map(s => s.userId), plain: p.staff.filter(s => !s.money).map(s => s.userId) };
}

/** One bell to write: its audience, its words, and whether it opens the team's Money › Club tab (a bill) or its schedule. */
export interface TeamBell {
  eventType: NotificationEventType; userIds: string[]; title: string; body: string; toMoney: boolean;
  /** The rows the opened notice draws (Notifications read at a glance, Stage 2), stored as `metadata.facts`. */
  facts?: NoticeFacts;
}

/**
 * A team's bells for one send. Each is ONE `notify` call — its title and body fan out to push and the opt-in email copy
 * as written, so a bell that names a figure goes only to people who can open Money. Empty audiences are dropped.
 */
export function teamBells(p: {
  kind: SendKind;
  orgName: string; scheduleName: string; replyBy: string | null;
  team: { teamName: string; slots: number; lines: string[]; bill: Bill | null; billedCents: number | null; partBills?: readonly PartBill[] };
  staff: readonly { userId: string; money: boolean; isHeadCoach?: boolean }[];
}): TeamBell[] {
  const t = p.team;
  const billBell = (userIds: string[], cents: number, first: Installment | null, payments: number, scheduleName = p.scheduleName): TeamBell =>
    ({ eventType: 'club_bill_arrived', userIds, toMoney: true, ...SCHEDULE_NOTICES.bill({ orgName: p.orgName, teamName: t.teamName, cents, scheduleName, first, payments }) });
  const slotsBell = (eventType: NotificationEventType, userIds: string[], words: { title: string; body: string; facts?: NoticeFacts }): TeamBell =>
    ({ eventType, userIds, toMoney: false, ...words });
  const out: TeamBell[] = [];
  if (p.kind === 'review') {
    const g = bellGroups({ staff: p.staff, hasBill: !!t.bill?.cents });
    const review = (billCents: number | null, replyBy: string | null) => SCHEDULE_NOTICES.review({ orgName: p.orgName, scheduleName: p.scheduleName, teamName: t.teamName, slots: t.slots, billCents, replyBy });
    // Only the head coach answers the proposal (owner 2026-11-14, Q-E): everyone else's bell has no "Reply by".
    const heads = new Set(p.staff.filter(s => s.isHeadCoach).map(s => s.userId));
    for (const [ids, cents] of [[g.money, t.bill?.cents ?? null], [g.plain, null]] as const) {
      out.push(slotsBell('club_schedule_review', ids.filter(id => heads.has(id)), review(cents, p.replyBy)));
      out.push(slotsBell('club_schedule_review', ids.filter(id => !heads.has(id)), review(cents, null)));
    }
  } else if (p.kind === 'final' || p.kind === 'bill') {
    const g = bellGroups({ staff: p.staff, hasBill: !!t.bill });
    // The late bill is only a bill: the schedule and its practices were told at Finalize.
    if (p.kind === 'final') out.push(slotsBell('club_schedule_final', g.everyone, SCHEDULE_NOTICES.final({ scheduleName: p.scheduleName, teamName: t.teamName, slots: t.slots })));
    if (t.bill) out.push(billBell(g.money, t.bill.cents, t.bill.installments[0] ?? null, t.bill.installments.length));
  } else {
    const g = bellGroups({ staff: p.staff, hasBill: !!t.billedCents || !!t.partBills?.length });
    out.push(slotsBell('club_schedule_changes', g.everyone, SCHEDULE_NOTICES.changes({ scheduleName: p.scheduleName, teamName: t.teamName, changes: t.lines.length })));
    if (t.billedCents) out.push(billBell(g.money, t.billedCents, null, 1));
    // Phase 8: one notice per bill — an added part's bill of its own is named as the part is ("For Fall practices · Time
    // added Nov 16 · 1 payment, …"), as its charge is on the team's Money › Club tab.
    for (const b of t.partBills ?? []) {
      out.push(billBell(g.money, b.cents, b.installments[0] ?? null, b.installments.length, b.name));
    }
  }
  return out.filter(b => b.userIds.length > 0);
}
