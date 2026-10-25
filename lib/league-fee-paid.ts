import 'server-only';
import { isCalendarDate, tournamentToday } from './timezone';
import type { Refused } from './club-money-route';
import { closedYearFromError, isClosedYearError, loadFiscalSetting, refuseIfClosed } from './club-fiscal-year-server';
import { canHouseLeague } from './house-league-access';
import { supabaseAdmin } from './supabase-admin';
import { DUES_PAYMENT_METHODS } from './types';
import type { AuthContextWithRole } from './api-auth';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * HOUSE-LEAGUE MONEY — THE ONE WRITE (Club Tier Stage 5c Part A, owner Ask 26; rebuilt for Stage 9b-2, plan §2 and §0e).
 *
 * Every door that moves a house-league registration's money lands here, never a second copy: Registrations (Mark received,
 * Undo, Correct the price, the bulk bar), the ending window (Decline / Withdraw / Release the spot), the family record's
 * Record a payment, and — Stage 12b — a card payment. `tests/unit/club-stage5c-families-guard.test.ts` fails the build if a
 * door writes the money itself.
 *
 * Who: the one house-league gate's `takeFees` (lib/house-league-access.ts, Q17): the owner, a club admin, a league admin
 * or a league registrar, holding the house league. It stays open on a finished season (Q16): money arrives after the last
 * game. The CALLER checks it (the route, through `canMarkLeagueFeePaid`).
 *
 * What (mig 368):
 *   - `club_league_money` — receive (an AMOUNT, a DAY, a METHOD: the signature Stage 12b calls), refund (money out, its
 *     own line, never a void), undo (a payment marked by mistake), price (a correction with a reason; a paid registration's
 *     lower price refunds the difference, a higher one leaves it owing). One locked database step each.
 *   - `league_registration_close` — an ending that asks about money when there is some, in one transaction with the
 *     waitlist promotion.
 * The club's fiscal year is checked before writing, and the lock trigger (mig 318) refuses a closed-year write regardless.
 * Returns the line written, a refusal word (the screen words it — lib/house-league-money-words.ts), or the closed year's
 * refusal as data (a route sends it with `moveRefused`).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/** May this member move a house-league fee? The one house-league gate decides (role, capability and plan). */
export function canMarkLeagueFeePaid(ctx: Pick<AuthContextWithRole, 'role' | 'capabilities' | 'org'>): boolean {
  return canHouseLeague(ctx, ctx.org, 'takeFees');
}

/** The methods a person picks (the product's one list) plus the card method Stage 12b writes. */
export const LEAGUE_MONEY_METHODS: readonly string[] = [...DUES_PAYMENT_METHODS, 'online_card'];

export type LeagueMoneyMove =
  /** Money in. `amount` omitted = the whole balance owed (the screens never type one; 12b passes the card amount). */
  | { kind: 'receive'; day: string; method: string | null; amount?: number | null; note?: string | null }
  /** Money out, its own line. `amount` omitted = everything received. */
  | { kind: 'refund'; day: string; method: string | null; reason: string | null; amount?: number | null }
  /** The latest payment was marked by mistake. */
  | { kind: 'undo' }
  /** A correction. `day`/`method` date the refund when the new price is below what was received. */
  | { kind: 'price'; price: number; reason: string; day?: string | null; method?: string | null };

export type LeagueMoneyRefusal =
  | 'ended' | 'not_accepted' | 'already_received' | 'amount' | 'over' | 'nothing_received' | 'refunded'
  | 'same' | 'reason' | 'money' | 'date' | 'future' | 'method' | 'before_payment';

export type LeagueMoneyResult =
  | { entryId: string | null }
  | { refusal: LeagueMoneyRefusal }
  | { refused: Refused };

/** A day and a method as a person sends them: refused before any read when malformed. */
function moveInputRefusal(day: string | null | undefined, method: string | null | undefined, required: boolean): LeagueMoneyRefusal | null {
  if (day == null) return required ? 'date' : null;
  if (!isCalendarDate(day)) return 'date';
  if (day > tournamentToday()) return 'future';
  if (method != null && !LEAGUE_MONEY_METHODS.includes(method)) return 'method';
  return null;
}

/** The day of the payment Undo would void (to check its fiscal year first). */
async function latestPaymentDay(regId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from('accounting_entries').select('entry_date')
    .eq('source_module', 'league_registration').eq('source_entity_id', regId)
    .eq('status', 'posted').eq('entry_type', 'income')
    .order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return (data?.entry_date as string | undefined) ?? null;
}

export async function writeLeagueMoney(
  ctx: Pick<AuthContextWithRole, 'org' | 'user'>,
  target: { seasonId: string; regId: string },
  move: LeagueMoneyMove,
): Promise<LeagueMoneyResult> {
  const orgId = ctx.org.id;
  const day = move.kind === 'undo' ? null : move.day ?? null;
  const method = move.kind === 'undo' ? null : move.method ?? null;
  const bad = move.kind === 'undo' ? null : moveInputRefusal(day, method, move.kind !== 'price');
  if (bad) return { refusal: bad };

  const setting = await loadFiscalSetting(orgId);
  const recorded = move.kind === 'undo' || (move.kind !== 'receive' && day) ? await latestPaymentDay(target.regId) : null;
  // A refund returns money already received: never dated before that payment (copy err.date.beforePayment).
  if (move.kind !== 'undo' && move.kind !== 'receive' && day && recorded && day < recorded) return { refusal: 'before_payment' };
  const closed = move.kind === 'undo'
    ? refuseIfClosed(setting, [recorded], { canMove: true, kind: 'recorded' })
    : refuseIfClosed(setting, [day], { canMove: true, kind: 'date' });
  if (closed) return { refused: closed };

  try {
    const { data, error } = await supabaseAdmin.rpc('club_league_money', {
      p_org: orgId, p_season: target.seasonId, p_registration: target.regId, p_action: move.kind,
      p_amount: move.kind === 'price' ? move.price : move.kind === 'undo' ? null : move.amount ?? null,
      p_day: day, p_method: method,
      p_reason: move.kind === 'refund' || move.kind === 'price' ? move.reason : move.kind === 'receive' ? move.note ?? null : null,
      p_actor: ctx.user.id,
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { entry: string | null; refusal: string | null } | null;
    if (row?.refusal) return { refusal: row.refusal as LeagueMoneyRefusal };
    return { entryId: row?.entry ?? null };
  } catch (e) {
    if (isClosedYearError(e)) return { refused: await closedYearFromError(orgId, [recorded, day]) };
    throw e;
  }
}

/** What happened to the money on an ending (asked only when the registration has received some). */
export type EndMoney =
  | { answer: 'refunded'; day: string; method: string | null; reason?: string | null }
  | { answer: 'kept'; reason: string };

export type EndResult =
  | { priorStatus: string; promotedId: string | null; refundEntryId: string | null }
  | { refusal: LeagueMoneyRefusal }
  | { refused: Refused };

/** Decline, withdraw or release the spot: the money question, the ending, the waitlist gap and — with `promote` and a
 *  child who held a spot — the first child waiting, in ONE database transaction (mig 368 `league_registration_close`).
 *  Nothing is voided: a payment stays in the book with any refund beside it. */
export async function endLeagueRegistration(
  ctx: Pick<AuthContextWithRole, 'org' | 'user'>,
  target: { seasonId: string; regId: string },
  end: { status: 'declined' | 'withdrawn'; notes: string | null; promote: boolean; released?: boolean; money: EndMoney | null },
): Promise<EndResult> {
  const orgId = ctx.org.id;
  const refund = end.money?.answer === 'refunded' ? end.money : null;
  if (refund) {
    const bad = moveInputRefusal(refund.day, refund.method, true);
    if (bad) return { refusal: bad };
    const paidOn = await latestPaymentDay(target.regId);
    if (paidOn && refund.day < paidOn) return { refusal: 'before_payment' };
    const closed = refuseIfClosed(await loadFiscalSetting(orgId), [refund.day], { canMove: true, kind: 'date' });
    if (closed) return { refused: closed };
  }
  const { data, error } = await supabaseAdmin.rpc('league_registration_close', {
    p_org: orgId, p_season: target.seasonId, p_registration: target.regId, p_status: end.status,
    p_notes: end.notes ?? null, p_actor: ctx.user.id, p_promote: end.promote, p_released: end.released ?? false,
    p_money: end.money?.answer ?? null,
    p_money_reason: end.money ? (end.money.answer === 'kept' ? end.money.reason : end.money.reason ?? null) : null,
    p_day: refund?.day ?? null, p_method: refund?.method ?? null,
  });
  if (error && isClosedYearError(error)) return { refused: await closedYearFromError(orgId, [refund?.day]) };
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    { prior_status: string; promoted: string | null; refusal: string | null; refund_entry: string | null } | null;
  if (!row) throw new Error('league_registration_close returned nothing');
  if (row.refusal) return { refusal: row.refusal as LeagueMoneyRefusal };
  return { priorStatus: row.prior_status, promotedId: row.promoted, refundEntryId: row.refund_entry };
}
