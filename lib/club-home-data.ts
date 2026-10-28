/**
 * lib/club-home-data.ts — WHAT A CLUB'S HOME SHOWS, read and shaped once for its two readers (server only).
 *
 *   the home itself   app/[orgSlug]/page.tsx (Club Tier Stage 4b-2a / 4b-2b / 4c-1)
 *   the editor's preview   app/[orgSlug]/admin/public-site/preview (Public site builder, A1/A2, ruled 2026-10-21)
 *
 * One function so the preview can never drift from the page families see: it reads and shapes; ClubSiteHome draws. It
 * asks no access question — each reader asks its own first (the home the one public rule, the preview the editor's).
 */
import { getTournamentsByOrg, getLeagueSeasons, getDivisions, getTeams } from '@/lib/db';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { isFollowableOrg } from '@/lib/directory';
import { clubTeamsAddress } from '@/lib/public-club-access';
import { clubHomeTournaments, tournamentHomeStatus } from '@/lib/club-site-home';
import { liveLeagueSeasons } from '@/lib/house-league-season';
import { withEarlyBird } from '@/lib/league-early-bird';
import { clubOpenNowRows, type ClubOpenNowRow } from '@/lib/club-open-now';
import { isPublicClubSiteOpen } from '@/lib/public-club-access';
import { isSectionShown } from '@/lib/club-site-sections';
import { siteSectionCarries } from '@/lib/public-site-editor-facts';
import { clubAboutPageShows } from '@/lib/club-about';
import { sponsorsShowing } from '@/lib/club-sponsors';
import { readClubTeams } from '@/lib/club-public-teams';
import { readClubTryouts } from '@/lib/club-tryouts';
import { formatEventDateRange, tournamentToday } from '@/lib/timezone';
import { getRegistrationState } from '@/lib/registration-state';
import { getClubSiteContent } from '@/lib/club-page-meta';
import { orgHref } from '@/lib/club-base';
import type { ClubSiteHomeProps } from '@/components/public/ClubSiteHome';
import type { Organization, Tournament } from '@/lib/types';

/**
 * A tournament's row as the home prints it — and the Tournaments page's Current and upcoming part (Stage 4f), so the two
 * cannot drift: its dates (the year only when it is not this year's) and a status true to its dates (S4-03).
 * Registration is asked only of an event that has not started and whose register page is not hidden.
 */
export async function clubTournamentRows(
  ts: readonly Tournament[],
  today: string,
  href: (path: string) => string,
): Promise<ClubSiteHomeProps['tournaments']> {
  const thisYear = today.slice(0, 4);
  return Promise.all(ts.map(async t => {
    const asksRegistration = t.status === 'active' && !!t.startDate && today < t.startDate && !t.publicHiddenPages?.includes('register');
    const registrationOpen = asksRegistration
      ? await Promise.all([getDivisions(t.id, { admin: true }), getTeams(t.id, { admin: true })])
          .then(([divisions, teams]) => getRegistrationState(t, divisions, teams.filter(x => x.status !== 'rejected')).state === 'open')
      : false;
    return {
      id: t.id,
      href: href(`/${t.slug}`),
      name: t.name,
      dates: t.startDate ? formatEventDateRange(t.startDate, t.endDate, !t.startDate.startsWith(thisYear)) : null,
      status: tournamentHomeStatus(t, today, registrationOpen),
    };
  }));
}

/**
 * `base` (Stage 4e): `{ ownHost: true }` on a club's own web address, so every link below is spelled for the address the
 * visitor is on (`/league`, not `/lakeshore-lynx/league`). Left out = our host, the old spelling.
 */
export async function loadClubHome(org: Organization, orgSlug: string, base?: { ownHost: boolean }): Promise<ClubSiteHomeProps> {
  const href = (path: string) => orgHref({ slug: orgSlug, ownHost: !!base?.ownHost }, path);
  // F1/F3: the Follow button shows only when the org passes the SAME eligibility gate a follow write validates against.
  const showFollow = isFollowableOrg(org);
  const withTeams = clubTeamsAddress(org) === 'teams-page';
  const today = tournamentToday();
  const [allTournaments, siteContent, leagueSeasons, clubTeams, clubTryouts] = await Promise.all([
    getTournamentsByOrg(org.id),
    getClubSiteContent(org.id),
    hasModuleEntitlement(org, 'module_house_league') ? getLeagueSeasons(org.id) : Promise.resolve([]),
    // The club's listed teams and its open tryouts — the same read the Teams page makes.
    withTeams ? readClubTeams(org.id, org.birthdayCutoffs) : Promise.resolve({ bands: [], count: 0 }),
    // Every listed team's tryout and its days, for Open now's tryouts (Stage 4b-2b) — the Tryouts page's own read.
    // A failed tryout read costs the home its tryouts row, never the page.
    withTeams ? readClubTryouts(org.id, today).catch(() => ({ teams: [], groups: [] })) : Promise.resolve({ teams: [], groups: [] }),
  ]);
  // House league: a draft season is not public. EVERY live season is a row (Club Tier Stage 9a, Q14; before it the home
  // named only the newest, F04), labelled by what is happening; with none live, the one row is the door to the league page.
  const publicLeagueSeasons = leagueSeasons.filter(s => s.status !== 'draft');
  const league = publicLeagueSeasons.length === 0 ? null : {
    href: href('/league'),
    title: 'House league',
    sub: 'Past seasons and results',
    seasons: (await withEarlyBird(liveLeagueSeasons(publicLeagueSeasons), today)).map(s => ({
      id: s.id, name: s.name, status: s.status, seasonStartDate: s.seasonStartDate, seasonEndDate: s.seasonEndDate,
      registrationOpenAt: s.registrationOpenAt, registrationCloseAt: s.registrationCloseAt, registrationClosedAt: s.registrationClosedAt,
      earlyBird: s.earlyBird,
      href: href(`/league/${s.slug}`),
    })),
    today,
  };

  // Open now: every open house-league registration, then the tryouts, nearest deadline first — the one list the
  // tournament Overview's host card shows too (lib/club-open-now.ts).
  const openNow = clubOpenNowRows(publicLeagueSeasons, clubTryouts, today, href);

  // The club's order and show/hide from its editor (Stage 4c-1, mig 343); a section the plan does not carry never shows.
  const sectionPrefs = { order: siteContent?.homeSectionOrder, hidden: siteContent?.homeSectionsHidden };
  const carries = siteSectionCarries(org);

  // Tournaments, chosen and ordered by `clubHomeTournaments` (running and coming first; one that just finished after).
  // A club that hid the section is not asked for them at all.
  const shownTournaments = isSectionShown('tournaments', sectionPrefs, carries) ? clubHomeTournaments(allTournaments, today) : [];
  const tournaments = await clubTournamentRows(shownTournaments, today, href);

  return {
    orgSlug,
    orgName: org.name,
    bannerUrl: org.heroBannerUrl ?? null,
    openNow,
    teamBands: clubTeams.bands,
    league,
    tournaments,
    about: siteContent?.description?.trim() || null,
    aboutPageHref: clubAboutPageShows(siteContent) ? href('/about') : null,
    // Only the sponsors a family may see now: the filter is HERE (a page's loader), never in the shared read the editor uses.
    sponsors: sponsorsShowing(siteContent?.sponsors),
    showFollow,
    sectionPrefs,
    carries,
  };
}

/**
 * The tournament Overview's host card (Public tournament pages Stage 2, Ask 4 / Ask B, plan §6): the club's own Open now
 * list, and nothing else of the home. `null` — no card: the club's public site is closed or its plan carries no public
 * site (a tournament-only organizer gets the footer's line instead). `[]` — the card, saying the club runs teams and
 * programs all year. Unlike the home's loader this ASKS THE ACCESS QUESTION ITSELF, so the card cannot show for a
 * closed site whatever page calls it.
 *
 * Read per request, uncached, like the club home it mirrors (both are force-dynamic): one league-season read and the
 * tryouts read, only on the Overview. A deadline turns over at midnight and a tryout opens by date, so a cache would
 * need the club's day in its key to stay true. A failed read costs the card its list, never the page.
 */
export async function loadHostClubOpenNow(org: Organization, orgSlug: string, base?: { ownHost: boolean }): Promise<ClubOpenNowRow[] | null> {
  if (!isPublicClubSiteOpen(org) || !hasModuleEntitlement(org, 'module_public_site')) return null;
  const href = (path: string) => orgHref({ slug: orgSlug, ownHost: !!base?.ownHost }, path);
  const today = tournamentToday();
  const [leagueSeasons, tryouts] = await Promise.all([
    hasModuleEntitlement(org, 'module_house_league') ? getLeagueSeasons(org.id).catch(() => []) : Promise.resolve([]),
    clubTeamsAddress(org) === 'teams-page'
      ? readClubTryouts(org.id, today).catch(() => ({ teams: [], groups: [] }))
      : Promise.resolve({ teams: [], groups: [] }),
  ]);
  return clubOpenNowRows(leagueSeasons.filter(s => s.status !== 'draft'), tryouts, today, href);
}
