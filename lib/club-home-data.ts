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
import { clubHomeTournaments, clubTeamBands, orderOpenNow, runningLeagueSeason, tournamentHomeStatus } from '@/lib/club-site-home';
import { isSectionShown } from '@/lib/club-site-sections';
import { siteSectionCarries } from '@/lib/public-site-editor-facts';
import { clubAboutPageShows } from '@/lib/club-about';
import { readClubTeams } from '@/lib/club-public-teams';
import { readClubTryouts } from '@/lib/club-tryouts';
import { homeTryoutsRowSub, isListedTryout, openNowTryouts, sharedSeasonYear, tryoutDaysLine, tryoutSeasonMeta, tryoutsPageTitle } from '@/lib/tryout-season';
import { formatEventDateRange, formatStoredDate, tournamentToday } from '@/lib/timezone';
import { getRegistrationState } from '@/lib/registration-state';
import { getClubSiteContent } from '@/lib/club-page-meta';
import type { ClubSiteHomeProps } from '@/components/public/ClubSiteHome';
import type { Organization } from '@/lib/types';

export async function loadClubHome(org: Organization, orgSlug: string): Promise<ClubSiteHomeProps> {
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
  const thisYear = today.slice(0, 4);
  const day = (value: string) => formatStoredDate(value, { withYear: !value.startsWith(thisYear) });

  // House league: a draft season is not public; the section's door is the league page.
  const publicLeagueSeasons = leagueSeasons.filter(s => s.status !== 'draft');
  const runningSeason = runningLeagueSeason(publicLeagueSeasons);
  const league = publicLeagueSeasons.length === 0 ? null : {
    href: `/${orgSlug}/league`,
    title: runningSeason?.name ?? 'House league',
    // Words through /marketing 2026-10-20: "open" is said once, by Open now, so this line says what the door gives.
    sub: !runningSeason ? 'Past seasons and results'
      : runningSeason.status === 'active' ? 'Schedule and standings'
      : runningSeason.seasonStartDate ? `Schedule and standings from ${day(runningSeason.seasonStartDate)}`
      : 'Schedule and standings when the season starts',
  };

  // Open now's tryouts (Stage 4b-2b, Ask 14 round 2): more than one team open or not open yet → ONE row, the door to the
  // Tryouts page; exactly one team open → its own row with its days line; otherwise none (the one rule decides).
  const tryoutPick = openNowTryouts(clubTryouts.teams);
  const tryoutRows = tryoutPick.kind === 'team' ? [{
    key: `tryout-${tryoutPick.team.season.id}`,
    href: `/${orgSlug}/teams/${tryoutPick.team.slug}/tryouts`,
    title: `${tryoutPick.team.name} tryouts`,
    sub: tryoutDaysLine(tryoutPick.team.standing.upcoming) ?? tryoutSeasonMeta(tryoutPick.team.season),
    deadline: null,
  }] : tryoutPick.kind === 'season' ? [{
    key: 'tryouts',
    href: `/${orgSlug}/tryouts`,
    // The year the Tryouts page's title names — from the same listed teams, so the row and the page it opens agree.
    title: tryoutsPageTitle(sharedSeasonYear(clubTryouts.teams.filter(t => isListedTryout(t.standing, today)).map(t => ({ seasonYear: t.season.year })))),
    sub: homeTryoutsRowSub(tryoutPick.teams.length, clubTeamBands(tryoutPick.teams, clubTryouts.groups).map(b => ({
      name: b.name,
      days: b.teams.flatMap(t => t.standing.heldDays),
    }))),
    deadline: null,
  }] : [];

  // Open now: every open house-league registration, then the tryouts (above), nearest deadline first.
  const openNow = orderOpenNow([
    ...publicLeagueSeasons.filter(s => s.status === 'registration_open').map(s => {
      // The admin's form stores the close time as typed, with a Z on the end (house-league page), so its date part is
      // the day the club typed. A day already behind today is not said: "Sign up by" a past date is not a deadline.
      const closes = s.registrationCloseAt?.slice(0, 10) ?? null;
      const deadline = closes && closes >= today ? closes : null;
      return {
        key: `league-${s.id}`,
        href: `/${orgSlug}/league/${s.slug}`,
        title: s.name,
        sub: [
          deadline ? `Sign up by ${day(deadline)}` : null,
          // The fee as the season's own page writes it.
          s.registrationFee != null ? `$${s.registrationFee.toFixed(2)}` : null,
        ].filter(Boolean).join(' · ') || null,
        deadline,
      };
    }),
    ...tryoutRows,
  ]);

  // The club's order and show/hide from its editor (Stage 4c-1, mig 343); a section the plan does not carry never shows.
  const sectionPrefs = { order: siteContent?.homeSectionOrder, hidden: siteContent?.homeSectionsHidden };
  const carries = siteSectionCarries(org);

  // Tournaments, with a status true to their dates (S4-03), chosen and ordered by `clubHomeTournaments` (running and
  // coming first; one that just finished after). A club that hid the section is not asked for them at all.
  // Registration is asked only of an event that has not started and whose register page is not hidden.
  const shownTournaments = isSectionShown('tournaments', sectionPrefs, carries) ? clubHomeTournaments(allTournaments, today) : [];
  const tournaments = await Promise.all(shownTournaments.map(async t => {
    const asksRegistration = t.status === 'active' && !!t.startDate && today < t.startDate && !t.publicHiddenPages?.includes('register');
    const registrationOpen = asksRegistration
      ? await Promise.all([getDivisions(t.id, { admin: true }), getTeams(t.id, { admin: true })])
          .then(([divisions, teams]) => getRegistrationState(t, divisions, teams.filter(x => x.status !== 'rejected')).state === 'open')
      : false;
    const status = tournamentHomeStatus(t, today, registrationOpen);
    return {
      id: t.id,
      href: `/${orgSlug}/${t.slug}`,
      name: t.name,
      dates: t.startDate ? formatEventDateRange(t.startDate, t.endDate, !t.startDate.startsWith(thisYear)) : null,
      status,
    };
  }));

  return {
    orgSlug,
    orgName: org.name,
    bannerUrl: org.heroBannerUrl ?? null,
    openNow,
    teamBands: clubTeams.bands,
    league,
    tournaments,
    about: siteContent?.description?.trim() || null,
    aboutPageHref: clubAboutPageShows(siteContent) ? `/${orgSlug}/about` : null,
    showFollow,
    sectionPrefs,
    carries,
  };
}
