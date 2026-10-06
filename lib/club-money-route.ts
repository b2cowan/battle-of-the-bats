import 'server-only';
import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden, type AuthContextWithRole } from './api-auth';
import { canMoveClubMoney, canOpenModule, canOpenRepMoney } from './member-access';
import { clubYearOf } from './club-money-figures';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE GATE FOR A CLUB MONEY ROUTE (Club Tier Stage 3a, Asks 1 and 2).
 *
 *   scope 'loop'  — the allocation / request loop between the club and its teams: reached by
 *                   `canOpenRepMoney` (Rep Teams OR Accounting, on an org that runs rep teams).
 *   scope 'books' — the club's own ledgers and payees: the Accounting program (`canOpenModule`).
 *   write: true   — moving money: `canMoveClubMoney` (owner, treasurer, admin with Accounting).
 *
 * Every one of these answers to the plan as well as the role (C17): `canOpenModule` pairs the
 * member's capability with the org's entitlement, so an owner on a plan without Accounting is
 * refused here rather than shown a page that 403s. One team inside the member's groups is
 * `clubTeamFor` (lib/club-team-route.ts), shared with the Rep Teams gate.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export async function resolveClubMoney(
  req: Request,
  opts: { scope: 'loop' | 'books'; write: boolean },
): Promise<{ error: Response } | { ctx: AuthContextWithRole }> {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  const reach = opts.scope === 'loop'
    ? canOpenRepMoney(ctx, ctx.org)
    : canOpenModule(ctx, ctx.org, 'module_accounting');
  if (!reach) return { error: forbidden() };
  if (opts.write && !canMoveClubMoney(ctx, ctx.org)) return { error: forbidden() };
  return { ctx };
}

/** A club money step that was refused: the HTTP status and the coded body the screens render. */
export interface Refused { ok: false; status: number; body: object }
/** What every club money step returns: its result, or one refusal shape. */
export type Moved<T> = ({ ok: true } & T) | Refused;

export const refused = (status: number, body: object): Refused => ({ ok: false, status, body });

/** The `?year=` a club money read is for (Club Tier Stage 3b): 2020–2099, else the club year today falls in. */
export function readYearParam(req: Request, today: string): number {
  const year = parseInt(new URL(req.url).searchParams.get('year') ?? '', 10);
  return year >= 2020 && year <= 2099 ? year : clubYearOf(today);
}

/** A refusal, as the response. */
export function moveRefused(r: Refused): Response {
  return NextResponse.json(r.body, { status: r.status });
}
