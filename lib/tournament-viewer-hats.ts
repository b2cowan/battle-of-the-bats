import 'server-only';
import { createClient } from './supabase-server';
import { supabaseAdmin } from './supabase-admin';
import { isPlatformAdminEmail } from './platform-auth';
import { getAuthContextWithScope } from './api-auth';
import { getBasicCoachTournamentTeamsForUser, normalizeEmail } from './basic-coach-teams';
import { getCoachingAssignmentsForUser, type CoachingAssignment } from './db';
import { getLinkedRepTeamsForTournament } from './rep-team-tournament-links';
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
 * Coach detection spans two models (kept SEPARATE by arch decision — this is
 * "bridge better," not "unify"):
 *  • Basic-claim coaches: the claimed-team registration link (below).
 *  • Rep-portal (paid) coaches: recognized via `resolveRepCoachHats` (WI-2C) —
 *    they coach in THIS org (assignment gate) AND their account email is on a
 *    registration here (Layer 1), or a stored registration↔rep-team link points
 *    at a team they coach (Layer 2). Residual (accepted, not a bug): a
 *    registration that neither email-matches nor is manually linked stays
 *    unrecognized until linked/backfilled.
 */

export interface ViewerHat {
  kind: 'coach' | 'admin' | 'official';
  /** What the row names: the coached team, or the org for admin/official rows. */
  label: string;
  href: string;
  /** Coach hats only: the tournament registration (`teams.id`) on THIS event —
   *  powers the sheet's one-tap own-team alerts row (N3b). Never derive this from
   *  `href` (an upgraded team's href points at a Premium slug, not the team id). */
  teamId?: string;
}

export interface TournamentViewer {
  initials: string;
  /** Display name for the sheet header — name metadata when set, else the email. */
  displayName: string;
  hats: ViewerHat[];
}

/**
 * Rep-portal (paid) coach hats for the viewer on THIS event (WI-2C). The account's
 * coaching assignments in this org are the trust gate — a coincidental cross-org
 * email match can't produce a hat because the account must actually coach here.
 *
 * Two layers, deduped by destination (Layer 2 wins — it carries the precise registration):
 *  • Layer 2 (stored link): a `rep_team_tournament_registrations` row for a registration
 *    here whose rep team the viewer coaches. Org-scoped on the link table's OWN `org_id`.
 *    Closes the "org registered under a generic email" gap and multi-team coaches.
 *  • Layer 1 (email-match, no link): a registration here whose contact email (`teams.email`
 *    or the `coach_email` override) equals the account email, exact `normalizeEmail`
 *    equality only (Migration 092 removed fuzzy email matching platform-wide — do NOT
 *    reintroduce it). With no link to map registration→rep-team, Layer 1 only names the
 *    team for a single-assignment coach; a multi-team coach relies on Layer 2 / backfill.
 *
 * Read via the service-role client (this file is a trusted server-only resolver);
 * every hat destination re-auths on arrival, so this only reveals a door, never grants it.
 */
async function resolveRepCoachHats(params: {
  orgSlug: string;
  orgId: string;
  tournamentId: string;
  userEmail: string;
  assignments: CoachingAssignment[];
}): Promise<ViewerHat[]> {
  if (params.assignments.length === 0) return [];

  const assignmentByTeamId = new Map(params.assignments.map(a => [a.teamId, a]));
  const email = normalizeEmail(params.userEmail);
  // Layer 1 can only name the team when the coach coaches ONE rep team here. Count DISTINCT
  // teams, not assignment rows — a season-rollover coach can hold two program-year rows for
  // the same team (getCoachingAssignmentsForUser returns one row per (team, program_year)).
  const distinctTeamIds = new Set(params.assignments.map(a => a.teamId));
  const wantLayer1 = !!email && distinctTeamIds.size === 1;

  // Both layers' queries are independent — run them concurrently.
  const [links, emailRes] = await Promise.all([
    getLinkedRepTeamsForTournament({ tournamentId: params.tournamentId, orgId: params.orgId }),
    wantLayer1
      ? supabaseAdmin
          .from('teams')
          .select('id, email, coach_email')
          .eq('tournament_id', params.tournamentId)
          // A rejected registration is dead — never surface a hat for it (mirrors the
          // basic-coach email-match discovery, which also drops rejected rows).
          .neq('status', 'rejected')
      : Promise.resolve(null),
  ]);

  const hatByHref = new Map<string, ViewerHat>();
  const hrefFor = (repTeamId: string) => `/${params.orgSlug}/coaches/teams/${repTeamId}`;

  // Layer 2 — precise: stored links ∩ the viewer's coaching assignments. A rep team CAN have
  // two linked registrations here (e.g. two divisions); rep_team_id isn't unique. One hat per
  // team, but the "own-team alerts" registration id is only kept while it's unambiguous.
  for (const link of links) {
    const assignment = assignmentByTeamId.get(link.repTeamId);
    if (!assignment) continue;
    const href = hrefFor(link.repTeamId);
    const existing = hatByHref.get(href);
    if (existing) {
      if (existing.teamId !== link.registrationId) existing.teamId = undefined;
    } else {
      hatByHref.set(href, { kind: 'coach', label: assignment.teamName, href, teamId: link.registrationId });
    }
  }

  // Layer 1 — email-match fallback. Never overrides a Layer 2 hat (the explicit link is
  // authoritative for the own-team target), only fills in a team Layer 2 didn't cover.
  if (wantLayer1 && emailRes) {
    if (emailRes.error) throw emailRes.error;
    const matched = ((emailRes.data ?? []) as Array<{ id: string; email: string | null; coach_email: string | null }>)
      .filter(row => normalizeEmail(row.email) === email || normalizeEmail(row.coach_email) === email);
    if (matched.length > 0) {
      const team = params.assignments[0]; // size===1, so every row shares this team
      const href = hrefFor(team.teamId);
      if (!hatByHref.has(href)) {
        // Own-team alerts row needs the registration id — only set when unambiguous.
        hatByHref.set(href, { kind: 'coach', label: team.teamName, href, teamId: matched.length === 1 ? matched[0].id : undefined });
      }
    }
  }

  return [...hatByHref.values()];
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

  const [coachTeams, staffCtx, repAssignments] = await Promise.all([
    getBasicCoachTournamentTeamsForUser({ userId: user.id, email: user.email }).catch(() => []),
    getAuthContextWithScope({ orgSlug: params.orgSlug }).catch(() => null),
    // Rep-portal coaching assignments in THIS org — the trust gate for WI-2C recognition.
    getCoachingAssignmentsForUser(params.orgId, user.id).catch(() => [] as CoachingAssignment[]),
  ]);

  // Coach hats — claimed Basic teams with a registration in THIS tournament.
  const teamsHere = coachTeams.filter(team =>
    team.registrations.some(reg => reg.tournamentId === params.tournamentId),
  );
  // Rep-portal (paid) coach recognition (WI-2C). Additive — a rep coach with no Basic claim
  // gets a chip too. Independent of the premium-slug lookups, so kick it off concurrently
  // with them. Deduped against Basic hats by the coaches route id (Basic → /coaches/team/*,
  // rep → /coaches/teams/*; distinct id namespaces).
  const repHatsPromise = resolveRepCoachHats({
    orgSlug: params.orgSlug,
    orgId: params.orgId,
    tournamentId: params.tournamentId,
    userEmail: user.email,
    assignments: repAssignments,
  }).catch(() => [] as ViewerHat[]);

  // Premium-slug lookups resolve concurrently (usually 0–1 teams match).
  const premiumSlugs = await Promise.all(
    teamsHere.map(team => getActivePremiumPortalSlug(team.teamWorkspaceId).catch(() => null)),
  );
  // Upgraded to a LIVE Premium portal → the coach's home is the Premium workspace
  // (the free shell redirects there anyway); otherwise the free team page.
  const hats: ViewerHat[] = teamsHere.map((team, i) => ({
    kind: 'coach',
    label: team.name,
    href: premiumSlugs[i] ? `/${premiumSlugs[i]}/coaches` : coachTeamPath(team.id),
    teamId: team.registrations.find(reg => reg.tournamentId === params.tournamentId)?.id,
  }));

  const repHats = await repHatsPromise;
  for (const repHat of repHats) {
    if (!hats.some(existing => existing.href === repHat.href)) hats.push(repHat);
  }

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
