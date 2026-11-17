/**
 * SEND THE CHANGES SENDS THE FAMILY (Phase 8, Session 3 — plan docs/projects/active/CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md §8;
 * drawing tab 5; owner rulings 4 and 5, 2026-11-16). The pure half.
 *
 * A schedule and its added parts are sent together: the schedule's own changes (if any), each unsent part's FIRST send (its
 * practices, and its bill when one rides with it — Finalize's step, on the part), and a sent part's own changes. Each member
 * runs its own database step (its own claim, its own send log row, its own allocation); what a team is TOLD is one email
 * listing all of it, and a notice per bill. This module says, per team, what that one email holds:
 *   - every member's change lines, a part's suffixed with its label ("Gains Thu, Dec 10, 6:00 p.m. · … · Time added Nov 16"
 *     — the coach row names the part, never "a correction of $135.00": the money is said once, on the bill line);
 *   - the corrections billed and the time credited (the schedule's own, and a sent part's own), added up;
 *   - each part's bill of its own (a first send's), by the part's name ("Fall practices · Time added Nov 16").
 * `landed` narrows it to the members whose step went: a later member's refused step never tells a coach of practices that
 * did not land.
 */
import type { Installment } from './club-schedule-bill';
import type { CreditMove } from './club-hand-back-words';
import { labelGroup, type ChangeGroup } from './club-schedule-words';

/** What one member of the family brings to one team's email. `label` null: the schedule itself (its lines unsuffixed). */
export interface MemberShare {
  memberId: string;
  label: string | null;
  lines: readonly string[];
  /** The same changes as groups (owner 2026-11-17): a part's label is said once per group, never after every date. */
  groups: readonly ChangeGroup[];
  /** A correction this member bills the team for time it gained (cents) — the schedule's own, or a sent part's own. */
  billedCents: number | null;
  /** Time this member credits the team for (Stage 11d, Ask 8). */
  lost: LostShare | null;
  /** A first send's bill of its own: the part's name (the coach's charge name) and the team's share. */
  bill: { name: string; cents: number; installments: Installment[] } | null;
}

export interface LostShare { cents: number; creditCents: number; payCents: number; moves: CreditMove[] }

/** A part's bill on one team's email and bells: "Fall practices · Time added Nov 16", its total and payments. */
export interface PartBill { name: string; cents: number; installments: Installment[] }

/** One team's email, told as one: its lines in member order (its groups soonest first), its money added up, each part's
 *  bill. */
export function familyTeamFacts(shares: readonly MemberShare[], landed?: ReadonlySet<string>): {
  lines: string[]; groups: ChangeGroup[]; billedCents: number | null; lost: LostShare | null; partBills: PartBill[];
} {
  const mine = landed ? shares.filter(s => landed.has(s.memberId)) : shares;
  const lines = mine.flatMap(s => (s.label ? s.lines.map(l => `${l} · ${s.label}`) : [...s.lines]));
  const groups = mine.flatMap(s => (s.label ? s.groups.map(g => labelGroup(g, s.label!)) : [...s.groups]))
    .sort((a, b) => a.firstDay.localeCompare(b.firstDay));
  const billed = mine.reduce((n, s) => n + (s.billedCents ?? 0), 0);
  return {
    lines,
    groups,
    billedCents: billed > 0 ? billed : null,
    lost: mine.reduce<LostShare | null>((a, s) => mergeLost(a, s.lost), null),
    partBills: mine.flatMap(s => (s.bill && s.bill.cents > 0 ? [s.bill] : [])),
  };
}

/** Two members' credits to one team, said as one: the amounts add, and each payment it moves is listed. */
export function mergeLost(a: LostShare | null, b: LostShare | null): LostShare | null {
  if (!a) return b;
  if (!b) return a;
  return { cents: a.cents + b.cents, creditCents: a.creditCents + b.creditCents, payCents: a.payCents + b.payCents, moves: [...a.moves, ...b.moves] };
}

/** A part's first send, as the Send window's bill line reads it: what its time is ("1.5 hours of Halton Hills evenings for
 *  14U AA") and its bill as it would be made (null: none rides with it — "Not billed"). */
export interface PartBillLine {
  minutes: number;
  permitNames: string[];
  teamNames: string[];
  bill: { cents: number; teamNames: string[]; payments: number; firstDue: string | null } | null;
}

/** A part's bill, summed from its splits (each team's share and payments): the total, the teams, the most payments any
 *  team has, the first due date. */
export function partBillOf(splits: readonly { teamName: string; cents: number; installments: readonly Pick<Installment, 'dueDate'>[] }[]): PartBillLine['bill'] {
  const billed = splits.filter(s => s.cents > 0);
  if (!billed.length) return null;
  const dues = billed.flatMap(s => s.installments.map(i => i.dueDate)).sort();
  return {
    cents: billed.reduce((n, s) => n + s.cents, 0),
    teamNames: billed.map(s => s.teamName),
    payments: Math.max(...billed.map(s => s.installments.length)),
    firstDue: dues[0] ?? null,
  };
}

/** A sent part is TAKEN OFF once its last send left it no practices (11-17 ruling): it leaves the page and the Part filter;
 *  its row, bill and send record are kept. A part still waiting to send that change stays on the page until it goes. */
export function partIsGone(p: { state: string; changedSinceSent: boolean; liveSlots: number }): boolean {
  return p.state === 'final' && !p.changedSinceSent && p.liveSlots === 0;
}

/** Did the window see exactly these parts, at these versions? A part added, changed or sent since the preview is read again,
 *  never sent unseen. */
export function samePartsSeen(raw: unknown, parts: readonly { id: string; version: number }[]): boolean {
  const saw = new Map((Array.isArray(raw) ? raw : []).flatMap(p => {
    const x = p as { id?: unknown; version?: unknown } | null;
    return x && typeof x.id === 'string' ? [[x.id, Number(x.version)] as const] : [];
  }));
  return saw.size === parts.length && parts.every(p => saw.get(p.id) === p.version);
}
