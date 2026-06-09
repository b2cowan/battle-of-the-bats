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
 * team (source `coach_created`), NOT the Premium `team_workspaces` flip (deferred).
 *  - Signed OUT → create account (name + email + password) then the team.
 *  - Signed IN  → just name the team (no re-signup; existing emails can't error).
 * The door opens thin: the new team lands on its org-less home; roster/schedule/comms
 * are Phases 3-4.
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
