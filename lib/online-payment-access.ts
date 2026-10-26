/**
 * Who may do what with online payments (Club Tier Stage 12a, rulings A1, A13). Pure: every route asks these, never its
 * own role list.
 *
 *  - Connect, disconnect, change who pays the fee or the refund policy: the OWNER only (A1). Settings stay owner-only
 *    (`org_settings` in OWNER_ONLY_CAPABILITIES); this is the same line.
 *  - See the Payouts state and get "Stripe needs something": the owner and the treasurer (A1). The treasurer is the
 *    `treasurer` role, or anyone who holds the club's Accounting (`canMoveClubMoney`'s people).
 *  - Refund a card payment, email a pay link, and hear that a payment or a refund needs a hand: whoever may end the
 *    registration or record a payment IN THAT FLOW (A13, as amended by the owner 2026-10-26: the treasurer logs the
 *    accounting and does not refund, in either flow). Tournaments: whoever runs tournaments. House league (12b): the
 *    house-league gate's `takeFees` (owner, club admin, league admin, registrar) — its own variant, never a widening of
 *    the tournament one.
 */
import { hasCapability } from './roles';
import { canOpenModule, type MemberAccessInput } from './member-access';
import type { EntitlementOrg } from './module-entitlements';
import { canHouseLeague } from './house-league-access';

export function canConnectPayouts(member: Pick<MemberAccessInput, 'role'>): boolean {
  return member.role === 'owner';
}

export function isPayoutsTreasurer(member: MemberAccessInput, org: EntitlementOrg): boolean {
  return member.role === 'treasurer' || canOpenModule(member, org, 'module_accounting');
}

export function canSeePayouts(member: MemberAccessInput, org: EntitlementOrg): boolean {
  return canConnectPayouts(member) || isPayoutsTreasurer(member, org);
}

/** A13, tournaments: whoever runs tournaments. The treasurer does not refund (owner 2026-10-26). */
export function canRefundOnline(member: MemberAccessInput, org: EntitlementOrg): boolean {
  void org;
  return hasCapability(member.role, member.capabilities, 'create_tournaments');
}

/** A13, house league: the registration desk (`takeFees`). A registrar refunds here, never a tournament; the treasurer
 *  does not refund (owner 2026-10-26). */
export function canRefundLeagueOnline(member: MemberAccessInput, org: EntitlementOrg): boolean {
  return canHouseLeague(member, org, 'takeFees');
}
