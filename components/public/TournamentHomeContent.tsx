import { getAnnouncements, getTeams, getDivisions, getVenues } from '@/lib/db';
import { readPublicGames } from '@/lib/public-games';
import type { Organization, Tournament } from '@/lib/types';
import { isPublicPageEnabled } from '@/lib/public-pages';
import { getRegistrationState } from '@/lib/registration-state';
import { tournamentToday } from '@/lib/timezone';
import { heroFirstPitchISO } from '@/lib/tournament-hero-copy';
import { deriveTierChampions } from '@/lib/champions';
import { toPublicTeam } from '@/lib/public-tournament-data';
import { runsInviteOnlyEvents } from '@/lib/invite-only-event';
import { orgLinks } from '@/lib/org-links';
import { tournamentMoment } from '@/lib/tournament-moment';
import { preEventFacts, registerCardView, teamSpotsLine, totalSpots } from '@/lib/public-pre-event';
import { championCards, hostCardView } from '@/lib/public-host-card';
import { loadHostClubOpenNow } from '@/lib/club-home-data';
import { publicFrameHost } from '@/lib/public-frame';
import { resolveOrgHomeHref } from '@/lib/module-entitlements';
import { clubColourRoles } from '@/lib/club-colour-roles';
import { directionsHref } from '@/lib/family-schedule-format';
import TournamentOverview from '@/components/public/TournamentOverview';

/**
 * The Overview's one loader, shared by the public page and the organizer's admin preview (`isPreview`). All three
 * moments — before the event, game day, after it — are the new body (TournamentOverview), fed by what is loaded here and
 * worded by lib/public-pre-event.ts and lib/public-host-card.ts. Public tournament pages Stage 8 Part 3d deleted the old
 * Overview that rendered here with the preview switch off; the page no longer reads the switch.
 */
export default async function TournamentHomeContent({
  orgSlug,
  tournamentSlug,
  org,
  tournament,
  isPreview = false,
}: {
  orgSlug: string;
  tournamentSlug: string;
  org: Organization;
  tournament: Tournament;
  isPreview?: boolean;
}) {
  const readOptions = { admin: true };
  // The independent reads in one round trip; the games read needs the divisions.
  const [allAnnouncements, divisions, allTeams, venues, href] = await Promise.all([
    getAnnouncements(tournament.id, readOptions),
    getDivisions(tournament.id, readOptions),
    getTeams(tournament.id, readOptions),
    getVenues(tournament.id, { ...readOptions, includeFacilities: true }),
    // The public pages are spelled for the address the visitor is on (a club's own web address has no club name in it);
    // the admin preview is always on our host.
    orgLinks(orgSlug),
  ]);
  // Only published divisions' games — an unpublished schedule never reaches this page (D1).
  const { games: allGames, withheld: scheduleWithheld } = await readPublicGames(tournament.id, divisions);
  const now = tournamentToday();

  // Sanitized (J6-001 / toPublicTeam); allTeams stays raw for the server-only registration maths.
  const teams = allTeams.filter(team => team.status === 'accepted').map(team => toPublicTeam(team, tournament.coachNamesShowOnPublic === true));
  const activeRegistrations = allTeams.filter(team => team.status !== 'rejected');

  const registration = getRegistrationState(tournament, divisions, activeRegistrations);
  // An invite-only event (the free plan, a Premium coach's event) takes no registrations and has no spots (the free
  // tournament tier, R6): no registration words, no Register button, and Teams is a count. A hidden Registration page
  // on any plan hides the same blocks — the switch the nav and the other pages already honoured.
  const inviteOnly = runsInviteOnlyEvents(org.planId);
  const registerOn = !inviteOnly && isPublicPageEnabled(tournament, 'register');
  const publicBase = href(`/${tournamentSlug}`);
  const showNewsPage = isPublicPageEnabled(tournament, 'news');
  const showSchedulePage = isPublicPageEnabled(tournament, 'schedule');
  const showStandingsPage = isPublicPageEnabled(tournament, 'standings');
  const showTeamsPage = isPublicPageEnabled(tournament, 'teams');
  const showRulesPage = isPublicPageEnabled(tournament, 'rules');

  const moment = tournamentMoment({
    tournament, today: now, games: allGames, divisions, scheduleWithheld,
    registrationOpen: registerOn && !!registration.cta,
  });
  const base = isPreview ? `/${orgSlug}/admin/tournaments/preview/${tournamentSlug}` : publicBase;
  const scheduleHref = `${base}/schedule`;
  const sortedDivisions = [...divisions].sort((a, b) => a.order - b.order);
  const divisionNames = sortedDivisions.map(d => d.name);

  // Before the event: the Register card and the facts list.
  const startDay = tournament.startDate ?? null;
  const firstGame = allGames
    .filter(g => g.status === 'scheduled' && (!startDay || g.date >= startDay))
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''))[0];
  const register = moment.moment === 'before'
    ? registerCardView({
        startDate: startDay,
        firstPitchISO: heroFirstPitchISO(firstGame?.time ? firstGame.date : startDay, firstGame?.time),
        spotsLine: teamSpotsLine({
          inviteOnly, showTeamsPage, accepted: teams.length,
          capacity: totalSpots(divisions, inviteOnly), divisionNames,
        }),
        registration, registerOn, registerHref: `${base}/register`, isPreview,
      })
    : null;
  const facts = moment.moment === 'before'
    ? preEventFacts({
        divisionNames,
        venue: venues[0] ? { name: venues[0].name, href: directionsHref(venues[0].address ?? null), others: venues.length - 1 } : null,
        showSchedulePage, hasVisibleGames: allGames.length > 0, scheduleHref,
        showRulesPage, rulesHref: `${base}/rules`,
      })
    : [];

  // After the event: the champions of the games families can see, then the doors.
  const champions = moment.moment === 'after'
    ? championCards(deriveTierChampions(allGames, teams, sortedDivisions), divisions.length > 1)
    : [];
  const afterDoors = moment.moment === 'after'
    ? [
        ...(showStandingsPage ? [{ href: `${base}/standings`, label: 'Final standings' }] : []),
        // No champion to lead with (a round robin): the results are the way in, rather than a page that ends.
        ...(champions.length === 0 && showSchedulePage ? [{ href: scheduleHref, label: 'Game results' }] : []),
      ]
    : [];

  // The host card (Ask 4 / Ask B): the club's own Open now list, asked only when the club's public site is open and its
  // plan has one; the door is the layout's own answer (lib/public-frame.ts publicFrameHost), so the card, the band and the
  // footer cannot disagree. A failed read costs the card, never the page.
  const openNow = await loadHostClubOpenNow(org, href).catch(() => null);
  const host = openNow === null ? null : hostCardView({
    host: publicFrameHost(org.name, tournament.name, await resolveOrgHomeHref(org).catch(() => null)),
    openNow, logoUrl: org.logoUrl ?? null, isPreview, clubHref: href(),
  });
  const clubRoles = clubColourRoles(org.themePreset, org.themePrimary, org.themeAccent);

  return (
    <TournamentOverview
      orgSlug={orgSlug}
      tournamentSlug={tournamentSlug}
      tournament={tournament}
      isPreview={isPreview}
      moment={moment.moment}
      today={now}
      games={allGames}
      teamName={id => teams.find(t => t.id === id)?.name ?? 'TBD'}
      divisions={divisions}
      venues={venues}
      announcements={allAnnouncements.slice(0, 3)}
      scheduleWithheld={scheduleWithheld}
      showSchedulePage={showSchedulePage}
      showNewsPage={showNewsPage}
      playoffPictureHref={moment.bracketSet && showStandingsPage && !isPreview ? `${publicBase}/playoffs` : null}
      scheduleHref={scheduleHref}
      newsHref={`${base}/news`}
      gameHref={id => (isPreview ? scheduleHref : `${scheduleHref}/${id}`)}
      register={register}
      facts={facts}
      champions={champions}
      afterDoors={afterDoors}
      host={host}
      hostColours={{ fill: clubRoles.fill, onFill: clubRoles.onFill, edge: clubRoles.edge }}
    />
  );
}
