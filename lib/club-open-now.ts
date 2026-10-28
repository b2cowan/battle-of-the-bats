/**
 * lib/club-open-now.ts — A CLUB'S "OPEN NOW" LIST, shaped once (pure, so tests/unit/club-open-now.test.ts pins it).
 *
 * Moved out of `loadClubHome` (lib/club-home-data.ts) unchanged for Public tournament pages Stage 2, whose host card
 * (Ask 4 / Ask B, plan §6) shows the same list — nothing typed for it — on a tournament's Overview. Two readers, one
 * list: the club home (which already holds the league seasons and tryouts it reads for its other sections) and the
 * host card (`loadHostClubOpenNow`, which reads only these two things and asks the access question first).
 */
import { clubTeamBands, orderOpenNow } from './club-site-home';
import { registrationDay } from './house-league-season';
import { takesSignups } from './league-registration-state';
import { homeTryoutsRowSub, isListedTryout, openNowTryouts, sharedSeasonYear, tryoutDaysLine, tryoutSeasonMeta, tryoutsPageTitle } from './tryout-season';
import { formatStoredDate } from './timezone';
import type { ClubTryoutTeam } from './club-tryouts';
import type { LeagueSeason, RepTeamGroup } from './types';

export interface ClubOpenNowRow {
  key: string;
  href: string;
  title: string;
  sub: string | null;
  /** Sort key only (nearest deadline first); the row prints `sub`. */
  deadline: string | null;
}

/**
 * Every open house-league registration, then the tryouts, nearest deadline first. `leagueSeasons` are the PUBLIC ones (a
 * draft season is never public); `tryouts` is `readClubTryouts`'s answer; `href` spells a club path for the address the
 * visitor is on.
 */
export function clubOpenNowRows(
  leagueSeasons: readonly LeagueSeason[],
  tryouts: { teams: ClubTryoutTeam[]; groups: RepTeamGroup[] },
  today: string,
  href: (path: string) => string,
): ClubOpenNowRow[] {
  const thisYear = today.slice(0, 4);
  const day = (value: string) => formatStoredDate(value, { withYear: !value.startsWith(thisYear) });

  // Open now's tryouts (Stage 4b-2b, Ask 14 round 2): more than one team open or not open yet → ONE row, the door to the
  // Tryouts page; exactly one team open → its own row with its days line; otherwise none (the one rule decides).
  const tryoutPick = openNowTryouts(tryouts.teams);
  const tryoutRows = tryoutPick.kind === 'team' ? [{
    key: `tryout-${tryoutPick.team.season.id}`,
    href: href(`/teams/${tryoutPick.team.slug}/tryouts`),
    title: `${tryoutPick.team.name} tryouts`,
    sub: tryoutDaysLine(tryoutPick.team.standing.upcoming) ?? tryoutSeasonMeta(tryoutPick.team.season),
    deadline: null,
  }] : tryoutPick.kind === 'season' ? [{
    key: 'tryouts',
    href: href('/tryouts'),
    // The year the Tryouts page's title names — from the same listed teams, so the row and the page it opens agree.
    title: tryoutsPageTitle(sharedSeasonYear(tryouts.teams.filter(t => isListedTryout(t.standing, today)).map(t => ({ seasonYear: t.season.year })))),
    sub: homeTryoutsRowSub(tryoutPick.teams.length, clubTeamBands(tryoutPick.teams, tryouts.groups).map(b => ({
      name: b.name,
      days: b.teams.flatMap(t => t.standing.heldDays),
    }))),
    deadline: null,
  }] : [];

  return orderOpenNow([
    ...leagueSeasons.filter(s => takesSignups(s)).map(s => {
      // The admin's form stores the close time as typed, with a Z on the end (house-league page), so its date part is
      // the day the club typed. A day already behind today is not said: "Sign up by" a past date is not a deadline.
      const closes = registrationDay(s.registrationCloseAt);
      const deadline = closes && closes >= today ? closes : null;
      return {
        key: `league-${s.id}`,
        href: href(`/league/${s.slug}`),
        title: s.name,
        // The deadline only — the fee is not a selling point, and it lives on the season's own page. No deadline: no line.
        sub: deadline ? `Sign up by ${day(deadline)}` : null,
        deadline,
      };
    }),
    ...tryoutRows,
  ]);
}
