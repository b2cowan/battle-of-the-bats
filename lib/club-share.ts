/**
 * lib/club-share.ts — HOW A CLUB'S PAGES PRESENT THEMSELVES OUTSIDE THE SITE (Club Tier Stage 4b-2b; End state 8, Ask 7A,
 * S4-02, F02; words through /marketing 2026-10-20).
 *
 *   · the generated card a chat app shows when a link is pasted — the club, a team or a tryout, in the club's colours;
 *   · the sitemap's club entries — the Teams page, each listed team, each open tryout, the Tryouts page in season;
 *   · the structured description of a team for search engines — a sports team of the club.
 *
 * ⚠ NEVER A PLAYER. Each builder takes the names it prints and nothing else, so no roster can reach a card or a search
 * engine through here (pinned by tests/unit/club-stage4b2b.test.ts and club-stage4b2b-guard). Pure.
 */
import { formatShortWeekdayDate, orgDayKey } from './timezone';
import { TRYOUT_STATE_WORD, tryoutSeasonMeta, type TryoutSeasonName, type TryoutStanding, type TryoutState } from './tryout-season';

/** What a card says: an optional badge (a tryout's state), its title, an optional second line, and its alt text. */
export interface ShareCardText {
  badge: string | null;
  /** The badge's look: the one green chip for Tryouts open, plain for every other state. */
  badgeTone?: 'ok' | 'plain';
  title: string;
  sub: string | null;
  alt: string;
}

/** The club's home: its name over its tagline; no tagline, the name alone (never an invented line). */
export function homeCard(p: { clubName: string; tagline: string | null }): ShareCardText {
  const sub = p.tagline?.trim() || null;
  return { badge: null, title: p.clubName, sub, alt: sub ? `${p.clubName}, ${sub}` : p.clubName };
}

/** A team: "15U AAA" over "Lakeshore Lynx · 2026 season". */
export function teamCard(p: { clubName: string; teamName: string; seasonYear: number | null }): ShareCardText {
  return {
    badge: null,
    title: p.teamName,
    sub: p.seasonYear != null ? `${p.clubName} · ${p.seasonYear} season` : p.clubName,
    alt: `${p.teamName}, ${p.clubName}`,
  };
}

/** A tryout: its state as the badge, "15U AAA tryouts", then the season and its first day (or the day it finished). */
export function tryoutCard(p: {
  clubName: string;
  teamName: string;
  state: TryoutState;
  season: TryoutSeasonName;
  firstUpcoming: string | null;
  lastDay: string | null;
}): ShareCardText {
  const badge = TRYOUT_STATE_WORD[p.state];
  const meta = tryoutSeasonMeta(p.season);
  const when = (p.state === 'open' || p.state === 'notOpenYet') && p.firstUpcoming ? ` · from ${formatShortWeekdayDate(p.firstUpcoming)}`
    : p.state === 'finished' && p.lastDay ? ` · finished ${formatShortWeekdayDate(p.lastDay)}`
    : '';
  const title = `${p.teamName} tryouts`;
  return { badge, badgeTone: p.state === 'open' ? 'ok' : 'plain', title, sub: `${meta}${when}`, alt: `${title}, ${p.clubName}: ${badge}` };
}

/** A team's tryout card from the one rule's answer: its season's name, its first remaining day, its last day. */
export function tryoutCardFor(p: {
  clubName: string;
  teamName: string;
  season: { year: number | null; name: string } | null;
  standing: Pick<TryoutStanding, 'state' | 'upcoming' | 'lastDay'>;
}): ShareCardText {
  return tryoutCard({
    clubName: p.clubName,
    teamName: p.teamName,
    state: p.standing.state,
    season: { year: p.season?.year ?? null, name: p.season?.name ?? '' },
    firstUpcoming: p.standing.upcoming[0] ? orgDayKey(p.standing.upcoming[0].startsAt) : null,
    lastDay: p.standing.lastDay,
  });
}

/** Where each generated card is served (the `opengraph-image` routes under the club). A tryout's carries what the card
 *  says — its state, its season and its first (or last) day: a chat app keeps a card it fetched, so a changed card must
 *  name a different address. The route ignores the query; it only makes the address new. */
export const shareCardPath = {
  home: (orgSlug: string) => `/${orgSlug}/opengraph-image`,
  team: (orgSlug: string, teamSlug: string) => `/${orgSlug}/teams/${teamSlug}/opengraph-image`,
  tryout: (orgSlug: string, teamSlug: string, state: TryoutState, version: string) =>
    `/${orgSlug}/teams/${teamSlug}/tryouts/opengraph-image?s=${state}&v=${encodeURIComponent(version)}`,
};

/** The team page's description when the team has written no about text (End state 8 drawn). */
export const TEAM_DESCRIPTION_FALLBACK = 'The team’s schedule and tryouts.';

/**
 * A club's own pages beyond its home, for the sitemap: the Teams page and each listed team (when it lists any), each open
 * tryout, and the club Tryouts page while it has a tryout to show (out of season it says only when the last ones were).
 */
export function clubSitemapPaths(p: {
  orgSlug: string;
  teamSlugs: readonly string[];
  openTryoutSlugs: readonly string[];
  tryoutsPage: boolean;
}): string[] {
  const base = `/${p.orgSlug}`;
  const out: string[] = [];
  if (p.teamSlugs.length > 0) {
    out.push(`${base}/teams`, ...p.teamSlugs.map(s => `${base}/teams/${s}`));
  }
  out.push(...p.openTryoutSlugs.map(s => `${base}/teams/${s}/tryouts`));
  if (p.tryoutsPage) out.push(`${base}/tryouts`);
  return out;
}

/** A team described to search engines (schema.org SportsTeam): its name, sport and page, as a team of the club. No
 *  athlete, coach or member, ever. */
export function sportsTeamJsonLd(p: { teamName: string; sport: string | null; url: string; clubName: string; clubUrl: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: p.teamName,
    ...(p.sport ? { sport: p.sport } : {}),
    url: p.url,
    parentOrganization: { '@type': 'SportsOrganization', name: p.clubName, url: p.clubUrl },
  } as const;
}
