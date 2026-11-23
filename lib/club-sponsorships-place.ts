/**
 * WHO OPENS SPONSORSHIPS, AND WHO CHANGES ITS INVOICE DETAILS (Board Ready Stage 6, Part 1). PURE and client-safe: the
 * sidebar row, the bar, the place's server layout and every sponsorships route ask these same answers, so a hidden row
 * never decides anything a route would not.
 *
 * Rulings (owner 2026-11-22): ask 12 + its note — its own club place; a per-member access `module_sponsorships`, on by
 * default for the owner, admins and the treasurer, grantable to anyone, paired with the plan's entitlement (League Plus and
 * both Club bands) like every area; round 2 ask 4 — the club's invoice details (mailing address, GST/HST, how businesses
 * pay) are changed by the owner, admins and the treasurer ONLY; anyone else with Sponsorships reads them.
 *
 * A member limited to some rep team groups is never given the place: it holds every sponsor's contact details and the
 * club's deals, which are club-wide, as Families and Communications refuse them. A tournament-only organization has no
 * club side.
 */
import { canOpenModule, type MemberAccessInput } from './member-access';
import { isTournamentOnlyWorkspace, type EntitlementOrg } from './module-entitlements';
import type { OrgRole } from './types';

export type SponsorshipsMember = MemberAccessInput & { limited: boolean };

/** May this person open the Sponsorships place (all four tabs)? */
export function opensSponsorships(member: SponsorshipsMember, org: EntitlementOrg): boolean {
  return !member.limited && !isTournamentOnlyWorkspace(org) && canOpenModule(member, org, 'module_sponsorships');
}

/** The seats that change the club's invoice details (round 2 ask 4). */
export const INVOICE_DETAILS_EDITORS: readonly OrgRole[] = ['owner', 'admin', 'treasurer'];

/** May this person change Invoice details? They must open the place AND hold one of the three seats. */
export function changesInvoiceDetails(member: SponsorshipsMember, org: EntitlementOrg): boolean {
  return opensSponsorships(member, org) && INVOICE_DETAILS_EDITORS.includes(member.role);
}
