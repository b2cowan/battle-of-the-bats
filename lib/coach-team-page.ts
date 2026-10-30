import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { getBasicCoachTeamForUser } from '@/lib/basic-coach-teams';
import { coachTeamPath } from '@/lib/coaches-portal-routes';
import type { BasicCoachTeam } from '@/lib/basic-coach-teams';
import { portalsInForce, workspacesInForce } from '@/lib/portal-in-force-server';

/*
 * Is a Premium portal LIVE — the coach's home rather than history? The one question
 * (`lib/portal-in-force.ts`, Support console Stage 4b), so the three readers that must agree still do: the free
 * shell's redirect into the portal ({@link getActivePremiumPortal}), the free team list that hides an upgraded team
 * ({@link excludeActivePremiumUpgrades}), and the registration form's team cards (`getRegistrableTeamsForUser`) —
 * the portal the shell sends a coach to is the portal the form offers. A portal on free time is in force until its
 * last free day, then the free team is the coach's again, as it was on the upgrade day.
 */
/**
 * The LIVE Premium portal a free Basic team has been upgraded to — its org slug + the premium
 * (rep) team id inside that workspace — or null. Keeps an upgraded free team from becoming a
 * stale, editable parallel: once Premium is live the coach is sent to the Premium portal (which
 * already holds the migrated roster/schedule/fees). When the Premium subscription is CANCELED
 * this returns null and the free team is usable again. The rep team id lets callers deep-link
 * team-scoped premium pages (e.g. the tournament record — "The Flip" P3's record-aware landing).
 */
export async function getActivePremiumPortal(
  teamWorkspaceId: string | null,
): Promise<{ slug: string; repTeamId: string } | null> {
  if (!teamWorkspaceId) return null;
  const { data, error } = await supabaseAdmin
    .from('team_workspaces')
    .select('workspace_org_id, rep_team_id, organizations!workspace_org_id(slug)')
    .eq('id', teamWorkspaceId)
    .maybeSingle<{
      workspace_org_id: string;
      rep_team_id: string;
      organizations: { slug: string | null } | { slug: string | null }[] | null;
    }>();
  // A failed read is an error, never "no live Premium": the write guard reads this, and "no portal" would let a stale tab
  // change the free team under a live Premium copy (Stage 4b review).
  if (error) throw error;
  if (!data) return null;
  const inForce = await portalsInForce([{ workspaceId: teamWorkspaceId, orgId: data.workspace_org_id, repTeamId: data.rep_team_id }]);
  if (!inForce.has(teamWorkspaceId)) return null;
  const org = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations;
  return org?.slug ? { slug: org.slug, repTeamId: data.rep_team_id } : null;
}

/** Slug-only convenience over {@link getActivePremiumPortal} (the pre-P3 signature). */
export async function getActivePremiumPortalSlug(teamWorkspaceId: string | null): Promise<string | null> {
  return (await getActivePremiumPortal(teamWorkspaceId))?.slug ?? null;
}

/**
 * Drop any free Basic teams that have been upgraded to a LIVE Premium portal. To the coach those are
 * now their Premium team (reached via the Premium workspace), not a free team — so they must not
 * appear in the free "Your teams" list. Ended upgrades are kept (the free team is usable again).
 * Batched: one question for all of the listed teams' workspaces.
 */
export async function excludeActivePremiumUpgrades<T extends { teamWorkspaceId: string | null }>(
  teams: T[],
): Promise<T[]> {
  const workspaceIds = teams.map(t => t.teamWorkspaceId).filter((id): id is string => !!id);
  if (workspaceIds.length === 0) return teams;
  const liveWorkspaceIds = await workspacesInForce(workspaceIds);
  return teams.filter(t => !(t.teamWorkspaceId && liveWorkspaceIds.has(t.teamWorkspaceId)));
}

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

  // Upgraded to a LIVE Premium portal → the free shell is read-only history; send the coach to their
  // Premium portal (where the migrated data lives) so there's never a stale editable parallel.
  const premiumSlug = await getActivePremiumPortalSlug(team.teamWorkspaceId);
  if (premiumSlug) {
    redirect(`/${premiumSlug}/coaches`);
  }

  return { userId: user.id, email: user.email, team };
}
