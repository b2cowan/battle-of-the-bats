import 'server-only';
import { tournamentToday } from './timezone';
import type { Refused } from './club-money-route';
import { closedYearFromError, isClosedYearError, loadFiscalSetting, refuseIfClosed } from './club-fiscal-year-server';
import { canOpenModule } from './member-access';
import { createLeagueRegistrationFeeEntry, updateEntry, getLeagueSeasonLedger } from './db';
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
 *   1. ⚖ THE CLUB'S FISCAL YEAR LOCKS THE HOUSE LEAGUE'S BOOK TOO (Club Tier Stage 3c, call 2) — checked BEFORE the
 *      registration changes, so the two never disagree. A fee line dated in a closed year: marking it paid CLEARS it into
 *      the open year, dated today (it counted nowhere while pending; the database keeps the day it was written); marking
 *      it unpaid would change a closed year, so it is refused in words (reopen the year). A line already in the state
 *      asked for is left as it is (nothing to write). The line moves FIRST, so a close that races this request refuses
 *      before the registration has changed.
 *   2. the registration's `registration_fee_paid` flips;
 *   3. a registration with no fee line yet, marked paid, gets one — posted, dated today (manual / retroactive).
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
  let clearOn: string | null = null;
  let lineMoves = !!reg.feeEntryId;
  let lineDate: string | null = null;
  if (reg.feeEntryId) {
    const { data: line, error: lineError } = await supabaseAdmin.from('accounting_entries')
      .select('entry_date, status').eq('id', reg.feeEntryId).maybeSingle();
    if (lineError) throw lineError;
    if (line) {
      lineMoves = line.status !== (paid ? 'posted' : 'pending');
      lineDate = line.entry_date as string;
      const setting = await loadFiscalSetting(orgId);
      const closed = lineMoves ? refuseIfClosed(setting, [line.entry_date], { canMove: true, kind: 'recorded' }) : null;
      if (closed) {
        if (!(paid && line.status === 'pending')) return closed;
        clearOn = tournamentToday();
      }
    }
  }

  // Sync the ledger entry if one is linked.
  if (reg.feeEntryId && lineMoves) {
    const ledger = await getLeagueSeasonLedger(orgId, season.id);
    if (ledger) {
      try {
        await updateEntry(reg.feeEntryId, ledger.id, { status: paid ? 'posted' : 'pending', ...(clearOn ? { entryDate: clearOn } : {}) });
      } catch (e) {
        if (isClosedYearError(e)) return closedYearFromError(orgId, [lineDate, clearOn]);
        throw e;
      }
    }
  }

  // ONE conditional flip: of two presses (two admins, or Registrations' tick racing the family's Record a payment), only
  // the first changes the registration, and only that one makes a new fee line (review 2026-10-19).
  const { data: flipped, error } = await supabaseAdmin
    .from('league_registrations')
    .update({ registration_fee_paid: paid, updated_at: new Date().toISOString() })
    .eq('id', reg.id).eq('registration_fee_paid', !paid).select('id');
  if (error) throw error;

  if (flipped?.length && !reg.feeEntryId && paid && season.registrationFee) {
    // No entry yet — create one as posted immediately (manual/retroactive).
    const playerName = `${reg.playerFirstName} ${reg.playerLastName}`;
    await createLeagueRegistrationFeeEntry(
      orgId, season.id, season.name, reg.id, playerName,
      season.registrationFee, 'posted', ctx.user.id,
    );
  }
  return null;
}
