import { publicClubRefusal, type PublicClubAccessOrg } from './public-club-access';

/**
 * lib/team-two-pages.ts — A TEAM'S TWO PAGES LINK TO EACH OTHER (club round C6, ruled 2026-11-05; plan of record
 * docs/projects/archive/PUBLIC_PAGE_LAYOUT_STANDARD_PLAN.md §5b). When a club's own rep team plays in the club's own
 * tournament it has two public pages: its club page (`/teams/{slug}`) and its tournament team page
 * (`/{tournament}/teams/{registration}`). Each now links to the other — but only for the host club's OWN team, and only
 * to a page that will open. Pure, so tests/unit/team-two-pages.test.ts pins the decision; the reads are
 * lib/team-two-pages-server.ts.
 *
 *   · "Our team" is the one rule (lib/club-own-tournament-team.ts, mig 346's link guard): the link, the rep team and the
 *     tournament all belong to one club. A team from another club has no club page here — nothing changes for it.
 *   · The club page is linked only when it is public by the SAME check the club team page makes before it renders
 *     (`publicClubRefusal(org, 'teams')`: the site on, the club not cancelled, the plan carrying team pages) — never a
 *     weaker one, so the link never lands on "not found".
 *   · The tournament team page is linked only when it opens: the tournament running or finished (the public read's own
 *     rule, `getPublicTournamentBySlug`) and the team accepted (the profile route's).
 *
 * Nothing about a player crosses: a team's name and an address, both already public on the page linked to.
 */

/** The tournament team page's link row: "{name} at {clubName}", to `path` on the club's own address (`orgHref`). */
export interface ClubTeamLink {
  name: string;
  clubName: string;
  /** `/teams/{slug}` — the caller puts it on the club's address with `orgHref` / `useOrgHref`. */
  path: string;
}

export type ClubOrg = PublicClubAccessOrg & { id: string; name: string };

/** One registration's link to a rep team, as read: the link's club and the rep team's (with its address and name). */
export interface RegistrationLinkFacts {
  orgId: string;
  repTeam: { orgId: string; slug: string | null; name: string } | null;
}

/** Tournament → club: the link row for this registration, or null. */
export function clubTeamLink({ club, tournamentOrgId, link }: {
  club: ClubOrg | null;
  tournamentOrgId: string;
  link: RegistrationLinkFacts | null;
}): ClubTeamLink | null {
  if (!club || !link?.repTeam?.slug) return null;
  // Our team: the link, the rep team and the tournament all belong to this club.
  if (link.orgId !== club.id || link.repTeam.orgId !== club.id || tournamentOrgId !== club.id) return null;
  if (publicClubRefusal(club, 'teams') !== null) return null;
  return { name: link.repTeam.name, clubName: club.name, path: `/teams/${encodeURIComponent(link.repTeam.slug)}` };
}

const PUBLIC_TOURNAMENT_STATUSES = new Set(['active', 'completed']);

/** Club → tournament: which of the club team's schedule entries open its tournament team page, entry id → path. */
export function tournamentTeamPaths({ clubOrgId, events, games, tournaments, registrations }: {
  clubOrgId: string;
  /** The schedule's entries that mirror a tournament game (`rep_team_events.source_tournament_game_id`). */
  events: Array<{ id: string; sourceGameId: string }>;
  games: Array<{ id: string; tournamentId: string }>;
  tournaments: Array<{ id: string; slug: string; status: string; orgId: string }>;
  /** This rep team's registrations, with the link's club and the rep team's club. */
  registrations: Array<{ registrationId: string; tournamentId: string; status: string; linkOrgId: string; repTeamOrgId: string }>;
}): Map<string, string> {
  const tournamentOfGame = new Map(games.map(g => [g.id, g.tournamentId]));
  const tournamentById = new Map(tournaments.map(t => [t.id, t]));
  const ours = new Map<string, string>(); // tournament id → this team's accepted registration in it
  for (const r of registrations) {
    if (r.status !== 'accepted' || r.linkOrgId !== clubOrgId || r.repTeamOrgId !== clubOrgId) continue;
    ours.set(r.tournamentId, r.registrationId);
  }
  const paths = new Map<string, string>();
  for (const e of events) {
    const tournamentId = tournamentOfGame.get(e.sourceGameId);
    const t = tournamentId ? tournamentById.get(tournamentId) : undefined;
    if (!t || t.orgId !== clubOrgId || !PUBLIC_TOURNAMENT_STATUSES.has(t.status)) continue;
    const registrationId = ours.get(t.id);
    if (!registrationId) continue;
    paths.set(e.id, `/${encodeURIComponent(t.slug)}/teams/${registrationId}`);
  }
  return paths;
}
