/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * RECORD A PAYMENT — THE PLAN, AND WHERE AN AMOUNT IS PLACED (Club Tier Stage 5c, P2; owner Asks 26–28, 2026-10-19).
 * Pure: the window places with it as the amount is typed, and the server validates a press against the same lines.
 *
 * One line per child who OWES, in the record's order (the Children table's): a house-league line is a whole-fee tick
 * (a registration records paid or not, never a part); a rep line is an amount handed to the team's head coach. A line
 * that cannot go carries its `reason` and takes nothing (no live season, no head coach, no fee permission).
 * The amount received is placed down the lines in order, each up to what it owes — a rep line up to its balance less
 * what is already with the coach, a fee only whole. Recording needs every cent placed (Left to place $0.00).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import type { FamilyNoteView } from './families-notes';
import type { FamilyPagePayload } from './families-read';

export interface LeaguePaymentLine {
  kind: 'league';
  key: string;
  childName: string;
  /** "Summer 2026 · U11" — the record's own where. */
  where: string;
  feeCents: number;
  regId: string;
  seasonId: string;
  reason: string | null;
}

export interface RepPaymentLine {
  kind: 'rep';
  key: string;
  childName: string;
  teamName: string;
  year: number | null;
  balanceCents: number;
  /** Already with the coach (hand-offs still `sent`) — the window pre-places only the rest. */
  pendingCents: number;
  rosterRowId: string;
  teamId: string;
  programYearId: string;
  /** The head coaches it would go to, by name. */
  coaches: string[];
  reason: string | null;
}

export type PaymentLine = LeaguePaymentLine | RepPaymentLine;

export interface PaymentPlan {
  lines: PaymentLine[];
}

/** The record's top line shows Record a payment only when something is owed AND the member can do one of its lines. */
export const planOpens = (plan: PaymentPlan | null | undefined): boolean => !!plan && plan.lines.some(l => !l.reason);

/** What a line can take when pre-placing: a fee whole, a rep line its balance less what the coach already holds. */
const roomOf = (l: PaymentLine): number =>
  l.kind === 'league' ? l.feeCents : Math.max(0, l.balanceCents - l.pendingCents);

/** Place an amount down the lines that can go, in order. A fee is ticked only when the whole fee fits. */
export function prePlace(lines: readonly PaymentLine[], amountCents: number): Record<string, number> {
  const out: Record<string, number> = {};
  let left = Math.max(0, Math.round(amountCents));
  for (const l of lines) {
    if (l.reason) continue;
    const room = roomOf(l);
    const take = l.kind === 'league' ? (left >= room ? room : 0) : Math.min(left, room);
    out[l.key] = take;
    left -= take;
  }
  return out;
}

/** The two figures of the band: Placed and Left to place (negative when more is placed than was received). */
export function placement(amountCents: number, placed: Record<string, number>) {
  const placedCents = Object.values(placed).reduce((s, c) => s + (c > 0 ? c : 0), 0);
  return { placedCents, leftCents: Math.round(amountCents) - placedCents, children: Object.values(placed).filter(c => c > 0).length };
}

/** A press, as the server reads it: the amount received, and each line given money. */
export interface PaymentRequest {
  amountCents: number;
  receivedDate: string;
  method: string;
  note: string | null;
  lines: { key: string; cents: number }[];
}

/** The longest note a hand-off carries — mig 338's CHECK on family_payment_handoffs.note. */
export const HANDOFF_NOTE_MAX = 500;

/** The largest single amount the coach's dues route takes ($999,999.99), in cents. */
export const PAYMENT_MAX_CENTS = 99_999_999;

/** What the family record's read carries beyond the page (Stage 5c): the window's lines, the chips, the notes. */
export interface FamilyRecordExtras {
  payment: PaymentPlan;
  /** Child line key → the newest hand-off's state, when it still shows: amber Sent to coach, red Not received. */
  handoffChips: Record<string, 'sent' | 'not_received'>;
  notes: FamilyNoteView[];
}
export type FamilyRecordPayload = FamilyPagePayload & FamilyRecordExtras;
