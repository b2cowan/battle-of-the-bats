import { canOpenModule, type MemberAccessInput } from './member-access';
import type { EntitlementOrg } from './module-entitlements';

/**
 * WHO CAN OPEN FAMILIES — the module gate every program asks (`canOpenModule`: the member holds `module_families`, off by
 * default for every role; the plan carries it, and a cancelled org's does not), plus Families' own third question: the
 * member is NOT limited to a group of teams — a family's record spans every team its children play on (Club Tier Stage 5a,
 * Ask 12). Asked by every Families route (`requireFamiliesAccess`), the Families page's layout and the club brief's
 * Duplicates count, so a door, its count and its data never disagree. Pure: no auth read here (the page layer must not
 * pull the API gate's auth call into its render — tests/unit/org-billing-access-guard.test.ts).
 */
export function canOpenFamilies(member: MemberAccessInput & { repGroupIds: readonly string[] | null }, org: EntitlementOrg): boolean {
  return canOpenModule(member, org, 'module_families') && !member.repGroupIds;
}
