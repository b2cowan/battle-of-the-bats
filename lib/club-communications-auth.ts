import 'server-only';
import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, type AuthContextWithRole } from './api-auth';
import { familyDoor, familyReader, placeFacts, seasonDoorOpen, type FamilyReader, type PlaceFacts } from './club-communications-place';
import { seatFor } from './club-group-email';
import type { Seat } from './club-group-email-rules';
import { SAY } from './club-group-email-words';

/**
 * CLUB COMMUNICATIONS — THE GATES (Stage 1, Session 2). Every family send and every read of the place asks these, on the
 * server, per route (legal §2c): a hidden button proves nothing.
 *
 *   · `requireClubFamilyEmail` — the club's family window: the owner and admins, the switch on, the plan carries Families.
 *     The Families book is NOT asked (direction ruling 4); what it still guards ("Families from a list", the one-family
 *     rows, household records) is asked by the caller from `facts.holdsBook`.
 *   · `requireCommunications` — the place's list and records: a seat that may write to families, coaches or the board.
 *   · `seasonEmailSwitch` — the season door asks the switch too (ask 5: off = no group email from any screen).
 */

export function placeFactsFor(ctx: AuthContextWithRole): PlaceFacts {
  return placeFacts({ role: ctx.role, capabilities: ctx.capabilities, limited: !!ctx.repGroupIds }, ctx.org);
}

const refused = () => NextResponse.json({ error: SAY.noPlace, code: 'no_place' }, { status: 403 });

async function contextOf(req: Request): Promise<AuthContextWithRole | null> {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  return getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
}

export async function requireClubFamilyEmail(req: Request): Promise<{ ctx: AuthContextWithRole; facts: PlaceFacts } | { failure: Response }> {
  const ctx = await contextOf(req);
  if (!ctx) return { failure: unauthorized() };
  const facts = placeFactsFor(ctx);
  if (familyDoor(facts) !== 'club') return { failure: refused() };
  return { ctx, facts };
}

export interface CommunicationsGate { ctx: AuthContextWithRole; facts: PlaceFacts; seat: Seat; families: FamilyReader | null }

/** The list and the records: any seat with a group to write to (each row then filtered by its own read rule). */
export async function requireCommunications(req: Request): Promise<CommunicationsGate | { failure: Response }> {
  const ctx = await contextOf(req);
  if (!ctx) return { failure: unauthorized() };
  const facts = placeFactsFor(ctx);
  const seat = seatFor(ctx);
  const families = familyReader(facts);
  if (!families && !seat.any) return { failure: refused() };
  return { ctx, facts, seat, families };
}

/** The season door's switch (its own right is `houseLeagueRefusal(ctx, 'email')`, asked first by the route). */
export function seasonEmailSwitch(ctx: AuthContextWithRole): Response | null {
  return seasonDoorOpen(placeFactsFor(ctx)) ? null : refused();
}
