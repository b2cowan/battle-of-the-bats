import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import StartTeamForm from './StartTeamForm';

export const metadata: Metadata = {
  title: 'Coach a team — FieldLogicHQ',
};

/**
 * /start/team — the standalone coach on-ramp. Creates a FREE, org-less Basic coach
 * team (source `coach_created`), NOT the Premium `team_workspaces` purchase path.
 *  - Signed OUT → create account (name + email + password) then the team.
 *  - Signed IN  → just name the team (no re-signup; existing emails can't error).
 * The team lands on its org-less home with roster, schedule, fees, announcements,
 * chat, and tournament history all live (verified 2026-07-20 — an earlier note here
 * calling these "Phases 3-4" was stale). The /start picker card flips to this route
 * at the FOUNDING_SEASON_COACHES_FREE_PLAN.md Phase 3 launch.
 */
export default async function StartTeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Staff are not coaches — never let a platform-admin session create a coach team.
  if (user?.email && (await isPlatformAdminEmail(user.email))) {
    redirect('/platform-admin');
  }

  return <StartTeamForm isLoggedIn={Boolean(user?.email)} email={user?.email ?? null} />;
}
