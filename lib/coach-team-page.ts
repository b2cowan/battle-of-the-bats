import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { getBasicCoachTeamForUser } from '@/lib/basic-coach-teams';
import { coachTeamPath } from '@/lib/coaches-portal-routes';
import type { BasicCoachTeam } from '@/lib/basic-coach-teams';

/**
 * Shared guard for every team-scoped Coaches Portal page (Overview + the section sub-routes
 * roster / schedule / fees / announcements / tournaments / explore). Centralises the auth +
 * platform-admin-exclusion + ownership checks so the sub-routes stay thin and can't drift on
 * who counts as an owner. Returns the authed coach user + the resolved team, or triggers
 * redirect/notFound (same semantics the original single page had).
 *
 * `subPath` (e.g. '/roster') is appended to the login `next` so an unauthenticated coach
 * lands back on the section they were trying to reach.
 */
export async function resolveCoachTeamPage(
  basicTeamId: string,
  subPath = '',
): Promise<{ userId: string; email: string; team: BasicCoachTeam }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect(`/auth/login?next=${coachTeamPath(basicTeamId)}${subPath}`);
  }

  // Staff/platform-admins are not coaches — exclude them from the team surfaces (these render
  // roster DOB / guardian contact), keeping pages consistent with the roster APIs.
  if (await isPlatformAdminEmail(user.email)) {
    notFound();
  }

  const team = await getBasicCoachTeamForUser({ userId: user.id, basicCoachTeamId: basicTeamId });
  if (!team) {
    notFound();
  }

  return { userId: user.id, email: user.email, team };
}
