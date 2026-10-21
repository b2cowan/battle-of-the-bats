import 'server-only';
import { tournamentToday } from './timezone';
import type { Refused } from './club-money-route';
import { closedYearFromError, isClosedYearError, loadFiscalSetting, refuseIfClosed } from './club-fiscal-year-server';
import { canOpenModule } from './member-access';
import { supabaseAdmin } from './supabase-admin';
import type { AuthContextWithRole } from './api-auth';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A HOUSE-LEAGUE FEE, MARKED PAID OR NOT — THE ONE WRITE (Club Tier Stage 5c, Part A; owner Ask 26, 2026-10-19).
 *
 * Two doors, one mechanism (CLUB_FAMILIES_BOOK_PLAN §1.3): House league › Registrations' Fee Paid tick and the family
 * record's Record a payment both land here — never a second copy. `tests/unit/club-stage5c-families-guard.test.ts`
 * fails the build if either door writes the fee itself.
 *
 * Who: the owner, a league admin or a league registrar, holding the house league (the member's capability AND the plan).
 * What, in order:
 *   1. The club's fiscal year is checked before writing. The database lock also protects the atomic write.
 *   2. `club_league_fee_set` holds the registration row, voids any old line on undo or correction,
 *      posts one new line only when paid, and updates `registration_fee_paid` and `fee_entry_id` together.
 *   3. An approval or waitlist promotion creates no receivable; a second paid press creates no second line.
 * Returns null when done, or the refusal (the fiscal year's words) as data — a route sends it with `moveRefused`.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export const LEAGUE_FEE_ROLES = ['owner', 'league_admin', 'league_registrar'] as const;

/** May this member mark a house-league fee paid? The role, and the house league itself (capability + plan). */
export function canMarkLeagueFeePaid(ctx: Pick<AuthContextWithRole, 'role' | 'capabilities' | 'org'>): boolean {
  return (LEAGUE_FEE_ROLES as readonly string[]).includes(ctx.role)
    && canOpenModule(ctx, ctx.org, 'module_house_league');
}

export interface LeagueFeeTarget {
  season: { id: string; name: string; registrationFee: number | null };
  reg: { id: string; feeEntryId: string | null; playerFirstName: string; playerLastName: string };
}

export async function setLeagueFeePaid(
  ctx: Pick<AuthContextWithRole, 'org' | 'user'>,
  { season, reg }: LeagueFeeTarget,
  paid: boolean,
): Promise<Refused | null> {
  const orgId = ctx.org.id;
  const day = tournamentToday();
  const setting = await loadFiscalSetting(orgId);
  const newLineRefusal = paid && season.registrationFee ? refuseIfClosed(setting, [day], { canMove: true, kind: 'recorded' }) : null;
  if (newLineRefusal) return newLineRefusal;
  let oldDay: string | null = null;
  if (reg.feeEntryId) {
    const { data: line, error: lineError } = await supabaseAdmin.from('accounting_entries')
      .select('entry_date, status').eq('id', reg.feeEntryId).maybeSingle();
    if (lineError) throw lineError;
    if (line && line.status !== 'void') {
      oldDay = line.entry_date as string;
      const closed = refuseIfClosed(setting, [line.entry_date], { canMove: true, kind: 'recorded' });
      if (closed) return closed;
    }
  }
  try {
    const { error } = await supabaseAdmin.rpc('club_league_fee_set', {
      p_org: orgId, p_season: season.id, p_registration: reg.id,
      p_paid: paid, p_actor: ctx.user.id, p_day: day,
    });
    if (error) throw error;
  } catch (e) {
    if (isClosedYearError(e)) return closedYearFromError(orgId, [oldDay, day]);
    throw e;
  }
  return null;
}

/** Ending a registration voids its fee and status in one database transaction. */
export async function voidLeagueRegistrationFee(
  ctx: Pick<AuthContextWithRole, 'org' | 'user'>,
  seasonId: string,
  regId: string,
  status: 'declined' | 'withdrawn',
  notes: string | null,
): Promise<Refused | null> {
  const { error } = await supabaseAdmin.rpc('club_league_fee_end', {
    p_org: ctx.org.id, p_season: seasonId, p_registration: regId,
    p_status: status, p_notes: notes ?? null, p_actor: ctx.user.id,
  });
  if (error && isClosedYearError(error)) return closedYearFromError(ctx.org.id, []);
  if (error) throw error;
  return null;
}
