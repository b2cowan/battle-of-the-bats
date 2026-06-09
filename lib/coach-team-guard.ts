import 'server-only';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { userOwnsBasicCoachTeam } from '@/lib/basic-coach-teams';

/**
 * The two-layer auth gate for org-less Basic-coach-team APIs (the master-roster routes and any
 * future per-team API). Mirrors the per-route `requireCoachUser` pattern + the object-level
 * ownership check, in one reusable call:
 *   1. signed-in session with an email      → else 401
 *   2. NOT a FieldLogicHQ staff/platform-admin email (staff are not coaches) → else 401
 *   3. an ACTIVE member of the target team in `basic_coach_team_users` (role-agnostic, membership-
 *      keyed on `user_id` — never email) → else 403
 *
 * Returns the resolved coach user on success. All DB access in the caller goes through the
 * service-role client AFTER this gate (the basic_coach_team* tables are RLS-enabled, no policies).
 */
export type CoachTeamGuardResult =
  | { ok: true; user: { id: string; email: string } }
  | { ok: false; status: 401 | 403 };

export async function requireBasicCoachTeamOwner(basicCoachTeamId: string): Promise<CoachTeamGuardResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return { ok: false, status: 401 };
  // FieldLogicHQ staff are NOT coaches — a platform-admin session is never a team owner.
  if (await isPlatformAdminEmail(user.email)) return { ok: false, status: 401 };
  if (!(await userOwnsBasicCoachTeam(user.id, basicCoachTeamId))) return { ok: false, status: 403 };
  return { ok: true, user: { id: user.id, email: user.email } };
}
