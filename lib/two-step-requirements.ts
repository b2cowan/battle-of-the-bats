import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase-admin';
import { isPlatformAdminEmail } from './platform-auth';
import { platformStaffTwoStepRequired, seatTwoStepRequirement, type OrgTwoStepFacts, type SeatRequirement } from './two-step-rule';

/**
 * EVERY SEAT THAT ASKS THIS PERSON FOR TWO-STEP (Board Ready · two-step sign-in). The one rule (lib/two-step-rule.ts)
 * applied across the person's accepted seats, for the screens that speak about the person rather than one club: the
 * set-up step ("Not now" is absent once something requires it, tab 2 / tab 8) and Part 2's Account › Sign-in & security
 * ("can't be turned off", and the reason).
 */

export type TwoStepReason =
  | { kind: 'staff' }
  | { kind: 'club'; orgName: string; orgSlug: string; role: string; requirement: Exclude<SeatRequirement, { kind: 'none' }> };

export type TwoStepRequirements = {
  /** Some seat requires it now (staff, or a club past its 14 days). */
  requiredNow: boolean;
  /** Every seat a switch (or the platform) covers, in its grace or past it. */
  reasons: TwoStepReason[];
};

type MemberRow = {
  role: string | null;
  organization_id: string;
  organizations: (OrgTwoStepFacts & { id: string; name: string; slug: string }) | null;
};

export async function twoStepRequirementsFor(user: Pick<User, 'id' | 'email'>, now: number = Date.now()): Promise<TwoStepRequirements> {
  const reasons: TwoStepReason[] = [];
  if (user.email && platformStaffTwoStepRequired() && (await isPlatformAdminEmail(user.email))) reasons.push({ kind: 'staff' });

  const [{ data: members }, { data: graces }] = await Promise.all([
    supabaseAdmin
      .from('organization_members')
      .select('role, organization_id, organizations(id, name, slug, two_step_board_required_since, two_step_coaches_required_since, is_test_organization, account_kind, plan_id)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .returns<MemberRow[]>(),
    supabaseAdmin.from('two_step_grace').select('organization_id, starts_at').eq('user_id', user.id),
  ]);
  const graceBy = new Map((graces ?? []).map(g => [g.organization_id as string, g.starts_at as string]));

  for (const m of members ?? []) {
    const org = m.organizations;
    if (!org) continue;
    const req = seatTwoStepRequirement(org, m.role, graceBy.get(org.id) ?? null, now);
    if (req.kind === 'none') continue;
    reasons.push({ kind: 'club', orgName: org.name, orgSlug: org.slug, role: m.role ?? '', requirement: req });
  }

  const requiredNow = reasons.some(r => r.kind === 'staff' || r.requirement.kind === 'required');
  return { requiredNow, reasons };
}
