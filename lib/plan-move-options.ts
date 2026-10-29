import type { OrgPlan } from './types';

/** Client-safe description of the existing moves. Stripe/database execution stays in plan-move.ts. */
export type MoveDirection = 'up' | 'down';

const MOVES: Partial<Record<OrgPlan, Partial<Record<OrgPlan, MoveDirection>>>> = {
  tournament_plus: { club: 'up', club_large: 'up' },
  club: { club_large: 'up' },
  club_large: { club: 'down' },
};

export function moveDirection(from: OrgPlan, to: OrgPlan): MoveDirection | null {
  return MOVES[from]?.[to] ?? null;
}

export function moveTargetsFor(from: OrgPlan): OrgPlan[] {
  return Object.keys(MOVES[from] ?? {}) as OrgPlan[];
}
