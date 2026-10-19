import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getAuthUserCached } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { startStepViewer } from '@/lib/start-door-server';
import StartTeamForm from './StartTeamForm';

export const metadata: Metadata = {
  title: 'Coach a team — FieldLogicHQ',
};

/**
 * /start/team — the standalone coach on-ramp. Creates a FREE, org-less Basic coach
 * team (source `coach_created`), NOT the Premium `team_workspaces` purchase path.
 *  - Signed OUT → step 1, the account alone (Account-First Sign-up, owner 2026-10-18). The account remembers this
 *    door, so the email link lands back here signed in.
 *  - Signed IN  → step 2, just name the team (no re-signup; existing emails can't error).
 * The team lands on its org-less home with roster, schedule, fees, announcements,
 * chat, and tournament history all live (verified 2026-07-20 — an earlier note here
 * calling these "Phases 3-4" was stale). The /start picker card flips to this route
 * at the FOUNDING_SEASON_COACHES_FREE_PLAN.md Phase 3 launch.
 */
export default async function StartTeamPage({ searchParams }: { searchParams: Promise<{ team?: string | string[]; confirmed?: string | string[] }> }) {
  // Back from the verification link: the flag, and — on a link sent before account-first (2026-10-18), for one
  // release — the team name typed before it.
  const sp = await searchParams;
  const initialName = (Array.isArray(sp.team) ? sp.team[0] : sp.team ?? '').slice(0, 120);
  const confirmed = (Array.isArray(sp.confirmed) ? sp.confirmed[0] : sp.confirmed) === '1';
  const user = await getAuthUserCached();

  // Staff are not coaches — never let a platform-admin session create a coach team.
  if (user?.email && (await isPlatformAdminEmail(user.email))) {
    redirect('/platform-admin');
  }

  return <StartTeamForm viewer={await startStepViewer(user)} initialName={initialName} confirmed={confirmed} />;
}
