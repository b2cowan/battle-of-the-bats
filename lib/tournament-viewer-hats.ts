import 'server-only';
import { createClient } from './supabase-server';
import { isPlatformAdminEmail } from './platform-auth';
import { getAuthContextWithScope } from './api-auth';
import { getBasicCoachTournamentTeamsForUser } from './basic-coach-teams';
import { getActivePremiumPortalSlug } from './coach-team-page';
import { coachTeamPath } from './coaches-portal-routes';
import { getUserDisplayName, getUserInitials } from './user-display';

/**
 * lib/tournament-viewer-hats.ts — Phase 3 "one-home connective tissue."
 *
 * Resolves, for the signed-in viewer of a tournament's PUBLIC space, the other
 * capacities ("hats") that account holds on THIS event: coached teams (claimed
 * Basic teams registered here — upgraded teams route to their live Premium
 * workspace), an org-admin door, and an official's scorekeeper door. Powers the
 * account chip + sheet in the tournament chrome. Read-only navigation sugar —
 * every destination it links to enforces its own auth on arrival, so nothing
 * here grants access; it only reveals doors the account already owns.
 *
 * ⚠ SERVED ONLY via /api/public/tournament-viewer (client-fetched), NEVER
 * server-rendered into tournament pages: the service worker offline-caches
 * public tournament HTML as anonymous content (public/sw.js PAGES_CACHE), so
 * per-user identity in that payload would replay to the next person on a
 * shared device. The /api/ lane is blanket never-cached. (/review 2026-07-14)
 *
 * Known limit (documented in the Phase 3 brief): coach detection rides the
 * claimed-team registration link — a coach who registered but never claimed
 * sees no coach row until they claim. Org rep coaches with no tournament
 * registration have nothing to link to and correctly get no row.
 */

export interface ViewerHat {
  kind: 'coach' | 'admin' | 'official';
  /** What the row names: the coached team, or the org for admin/official rows. */
  label: string;
  href: string;
}

export interface TournamentViewer {
  initials: string;
  /** Display name for the sheet header — name metadata when set, else the email. */
  displayName: string;
  hats: ViewerHat[];
}

export async function getTournamentViewer(params: {
  orgSlug: string;
  orgId: string;
  orgName: string;
  tournamentId: string;
}): Promise<TournamentViewer | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  // Platform staff are not fans/coaches — no chip (mirrors the coach surfaces).
  if (await isPlatformAdminEmail(user.email)) return null;

  const [coachTeams, staffCtx] = await Promise.all([
    getBasicCoachTournamentTeamsForUser({ userId: user.id, email: user.email }).catch(() => []),
    getAuthContextWithScope({ orgSlug: params.orgSlug }).catch(() => null),
  ]);

  // Coach hats — claimed Basic teams with a registration in THIS tournament.
  // Premium-slug lookups resolve concurrently (usually 0–1 teams match).
  const teamsHere = coachTeams.filter(team =>
    team.registrations.some(reg => reg.tournamentId === params.tournamentId),
  );
  const premiumSlugs = await Promise.all(
    teamsHere.map(team => getActivePremiumPortalSlug(team.teamWorkspaceId).catch(() => null)),
  );
  // Upgraded to a LIVE Premium portal → the coach's home is the Premium workspace
  // (the free shell redirects there anyway); otherwise the free team page.
  const hats: ViewerHat[] = teamsHere.map((team, i) => ({
    kind: 'coach',
    label: team.name,
    href: premiumSlugs[i] ? `/${premiumSlugs[i]}/coaches` : coachTeamPath(team.id),
  }));

  if (staffCtx && staffCtx.org.id === params.orgId) {
    // Tournament-scoped staff (officials included) only get their door on assigned
    // events (null = unrestricted — absence-means-unrestricted semantics, matching
    // scopeGuard downstream).
    const coversThisTournament =
      staffCtx.assignedTournamentIds === null ||
      staffCtx.assignedTournamentIds.includes(params.tournamentId);

    if (staffCtx.role === 'official') {
      if (coversThisTournament) {
        hats.push({
          kind: 'official',
          label: params.orgName,
          href: `/${params.orgSlug}/scorekeeper`,
        });
      }
    } else if (staffCtx.role !== 'coach' && coversThisTournament) {
      // Everyone-but-official gets the admin surface (the same inversion the admin
      // layout and invite flows use — a future role classifies correctly for free).
      // `coach` is the one other exception: user-contexts maps that role to the
      // coaches portal, not the admin area, so no admin door here either.
      hats.push({
        kind: 'admin',
        label: params.orgName,
        href: `/${params.orgSlug}/admin/tournaments/dashboard?tournamentId=${params.tournamentId}`,
      });
    }
  }

  return {
    initials: getUserInitials(user),
    displayName: getUserDisplayName(user),
    hats,
  };
}
