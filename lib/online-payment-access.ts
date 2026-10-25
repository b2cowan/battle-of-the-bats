/**
 * Who may do what with online payments (Club Tier Stage 12a, rulings A1, A13). Pure: every route asks these, never its
 * own role list.
 *
 *  - Connect, disconnect, change who pays the fee or the refund policy: the OWNER only (A1). Settings stay owner-only
 *    (`org_settings` in OWNER_ONLY_CAPABILITIES); this is the same line.
 *  - See the Payouts state and get "needs attention": the owner and the treasurer (A1). The treasurer is the `treasurer`
 *    role, or anyone who holds the club's Accounting (`canMoveClubMoney`'s people).
 *  - Refund a card payment, email a pay link: whoever runs tournaments, plus the treasurer (A13).
 */
import { hasCapability } from './roles';
import { canOpenModule, type MemberAccessInput } from './member-access';
import type { EntitlementOrg } from './module-entitlements';

export function canConnectPayouts(member: Pick<MemberAccessInput, 'role'>): boolean {
  return member.role === 'owner';
}

export function isPayoutsTreasurer(member: MemberAccessInput, org: EntitlementOrg): boolean {
  return member.role === 'treasurer' || canOpenModule(member, org, 'module_accounting');
}

export function canSeePayouts(member: MemberAccessInput, org: EntitlementOrg): boolean {
  return canConnectPayouts(member) || isPayoutsTreasurer(member, org);
}

export function canRefundOnline(member: MemberAccessInput, org: EntitlementOrg): boolean {
  return hasCapability(member.role, member.capabilities, 'create_tournaments') || isPayoutsTreasurer(member, org);
}
