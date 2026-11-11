import { supabaseAdmin } from './supabase-admin';
import { TWO_STEP_BOARD_ROLES, TWO_STEP_COACH_ROLES, seatTwoStepRequirement, type OrgTwoStepFacts } from './two-step-rule';

/**
 * A PERSON'S OWN 14 DAYS (Board Ready · two-step sign-in, Part 3; ask 7). The grace period runs from the day a club
 * switches a requirement on, OR from the day a person begins holding a seat it covers in a club that already requires it
 * (a new treasurer, an invite accepted, a coach made an admin, a reinstated member, a team moved into the club). The rule
 * (lib/two-step-rule.ts) takes the later of the two.
 *
 * Called at every place a covered seat begins (`tests/unit/two-step-part3.test.ts` holds the list). It writes only when
 * the seat's switch is already on — before that, the switch's own time is the start — and never fails the change it rides
 * on (a missing row only means the person's deadline is the switch's: earlier, never later).
 */
export async function startTwoStepGrace(userId: string | null | undefined, orgId: string, role: string | null | undefined): Promise<void> {
  if (!userId || !role) return;
  try {
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('two_step_board_required_since, two_step_coaches_required_since, is_test_organization, account_kind, plan_id')
      .eq('id', orgId)
      .maybeSingle<OrgTwoStepFacts>();
    if (!org) return;
    if (seatTwoStepRequirement(org, role, null).kind === 'none') return;
    await supabaseAdmin
      .from('two_step_grace')
      .upsert({ user_id: userId, organization_id: orgId, starts_at: new Date().toISOString() }, { onConflict: 'user_id,organization_id' });
  } catch (err) {
    console.error('[two-step] grace start not written', err);
  }
}

/** Which switch covers a role: the board's, the coaches', or neither. */
export function switchOfRole(role: string | null | undefined): 'board' | 'coaches' | null {
  if (!role) return null;
  if ((TWO_STEP_BOARD_ROLES as readonly string[]).includes(role)) return 'board';
  if ((TWO_STEP_COACH_ROLES as readonly string[]).includes(role)) return 'coaches';
  return null;
}

/**
 * A role change starts the person's own 14 days only when it moves them under a DIFFERENT switch (a coach made treasurer,
 * a volunteer made admin). Admin → treasurer stays under the board's switch: the person's deadline does not move.
 */
export function roleChangeStartsGrace(before: string | null | undefined, after: string | null | undefined): boolean {
  const to = switchOfRole(after);
  return to !== null && to !== switchOfRole(before);
}
