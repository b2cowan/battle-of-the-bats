import type { OrgPlan } from './types';

/** Client-safe description of the existing moves. Stripe/database execution stays in plan-move.ts. */
export type MoveDirection = 'up' | 'down';

const MOVES: Partial<Record<OrgPlan, Partial<Record<OrgPlan, MoveDirection>>>> = {
  // Plan & billing Stage 4b: a paying Premium coach moves onto Club on the subscription they have, and their portal becomes the club.
  team: { club: 'up', club_large: 'up' },
  // On-sale pages S4 Part 2 (Ask 12, call 39): a paying Tournament Plus organization moves to League Plus on the same subscription,
  // by the shipped move-up rule. League Plus itself moves nowhere at launch (League Plus → Club is after launch, walk §550 C1).
  tournament_plus: { league: 'up', club: 'up', club_large: 'up' },
  club: { club_large: 'up' },
  club_large: { club: 'down' },
};

export function moveDirection(from: OrgPlan, to: OrgPlan): MoveDirection | null {
  return MOVES[from]?.[to] ?? null;
}

export function moveTargetsFor(from: OrgPlan): OrgPlan[] {
  return Object.keys(MOVES[from] ?? {}) as OrgPlan[];
}
