import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import RepTeamPublicSchedule from '@/components/public/RepTeamPublicSchedule';
import { getPublicTeamSchedule, publicTeamFeedPath } from '@/lib/public-team-schedule';
import { teamCalendarName } from '@/lib/export/team-feed-words';
import kit from '@/components/public/ClubKit.module.css';
import { liveSeasonOf, publicTryoutSeasonOf } from '@/lib/season-live';
import { publicTryoutHref } from '@/lib/public-tryout';
import { requirePublicClubPage } from '@/lib/public-club-page';
import { publicClubRefusal } from '@/lib/public-club-access';
import { clubPageMetadata, getClubSiteContent, getClubTeam, getClubTeamSeasons } from '@/lib/club-page-meta';
import { teamMetaLine, teamPageParts } from '@/lib/club-team-page';
import styles from './TeamPage.module.css';
import { forwardToRunningTournament } from '@/lib/club-shortcut';
import { isUuid } from '@/lib/utils';
import { readTeamTryout } from '@/lib/club-tryouts';
import { tryoutDaysLine } from '@/lib/tryout-season';
import { tournamentToday } from '@/lib/timezone';
import { firstSentence } from '@/lib/club-site';
import { sportLabel } from '@/lib/sports';
import { shareCardPath, sportsTeamJsonLd, teamCard, TEAM_DESCRIPTION_FALLBACK } from '@/lib/club-share';
import { getPublicTeamCoaches } from '@/lib/club-team-coaches';

/** Where the club's pages live, for the team's description to search engines (the sitemap's own base). */
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';

export const dynamic = 'force-dynamic';

/** The tab names the team ("15U AAA · Lakeshore Lynx"); a team that cannot be found leaves the club's name alone
 *  (Club Tier Stage 4b-1). A shared link shows the team's own words (its about text, cut to a sentence; none, "The team's
 *  schedule and tryouts.") and its card (Stage 4b-2b, End state 8). */
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; teamSlug: string }> }): Promise<Metadata> {
  const { orgSlug, teamSlug } = await params;
  return clubPageMetadata(orgSlug, async club => {
    // A club whose plan does not carry the team pages describes nothing behind them (the page itself is "not found").
    if (publicClubRefusal(club, 'teams')) return null;
    const team = await getClubTeam(club.id, teamSlug);
    if (!team) return null;
    return {
      name: team.name,
      description: firstSentence(team.description) ?? TEAM_DESCRIPTION_FALLBACK,
      card: { path: shareCardPath.team(orgSlug, team.slug), alt: teamCard({ clubName: club.name, teamName: team.name, seasonYear: null }).alt },
    };
  });
}

export default async function TeamPublicPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamSlug: string }>;
}) {
  const { orgSlug, teamSlug } = await params;

  // An old tournament-team link (`/{org}/teams/{team id}`, printed before tournament teams moved under the event) still
  // forwards while a tournament runs, like the shortcut addresses (Ask 9) — BEFORE the club rule, because tournament
  // pages stay up when the club's site is off (2026-07-22) and a tournament-only org carries no rep teams.
  if (isUuid(teamSlug)) await forwardToRunningTournament(orgSlug, `teams/${teamSlug}`);

  // The one rule (Club Tier Stage 4a, lib/public-club-access.ts).
  const org = await requirePublicClubPage(orgSlug, 'teams');

  // An unknown team is the club's "not found" with a way home; it used to go silently to the club home (S4-07).
  const team = await getClubTeam(org.id, teamSlug);
  if (!team) notFound();

  const programYears = await getClubTeamSeasons(team.id);
  // THE ONE PUBLIC TRYOUT RULE (Club Tier B07): the team's LIVE season with tryouts open, never
  // an archived team. This page used to accept only an ACTIVE season while the sign-up form
  // accepted any — so the two could disagree about which season a family was applying to.
  const openYear = publicTryoutSeasonOf(team, programYears);

  // The standing public schedule (Chunk D 1.9) — and, since Club Tier 6d, its Subscribe button and the team's public
  // calendar feed — all ask ONE question (`getPublicTeamSchedule`): Public link, the club not cancelled, the family
  // layer, not archived, a live season. This page never decides; it renders what it is given. ⚠ It used to skip the
  // cancelled-club check the feed made, so a cancelled club's Public link schedule kept showing here (D07, S6D-09).
  // The visibility check still runs first, off the already-loaded team row, so a team that never turned Public link on
  // pays no extra query on a page that gets public traffic.
  const [publicSchedule, siteContent, tryout, coaches] = await Promise.all([
    getPublicTeamSchedule({ org, team }),
    // The club's public contact (the Public Site editor's), for the quiet tryout sentence — never the org row (F09).
    getClubSiteContent(org.id),
    // The door's days line (Stage 4b-2b): the tryout days still ahead — read only when the door shows.
    openYear ? readTeamTryout(team, programYears, tournamentToday()) : Promise.resolve(null),
    // Coaches (Club Tier 4c-2 Part B): only coaches who switched their own name on, name and role only. Never an email,
    // a phone or a player — and never the head coach's tryout address, which belongs to the tryout page alone.
    // An optional section: a failed read leaves it out rather than taking the page down. Only while the team has a live
    // season (owner ruling 2026-10-22): between seasons a team opens only to its closed-season page, where a coach could
    // not switch their name off, so no name stands on a page nobody is tending.
    !team.isArchived && liveSeasonOf(programYears) ? getPublicTeamCoaches(org.id, team.id).catch(() => []) : Promise.resolve([]),
  ]);
  const daysLine = tryoutDaysLine(tryout?.standing.upcoming ?? []);
  // The season under the name is the team's live one; an archived team has none.
  const liveYear = team.isArchived ? null : liveSeasonOf(programYears);
  const meta = teamMetaLine(team.division, liveYear?.year);
  const about = team.description?.trim() || null;
  const email = siteContent?.contactEmail?.trim() || null;
  // End state 3: a part with nothing to show is absent. No Past seasons (DC-07: a door to an old season would be a new
  // look-back surface). Coaches only when a coach switched their name on (4c-2 Part B).
  const parts = teamPageParts({
    archived: team.isArchived, tryoutOpen: !!openYear, schedule: !!publicSchedule, about: !!about, coaches: coaches.length > 0,
  });

  // The parts in the phone's order, which is also the reading order; at a desk the schedule takes the left column and
  // the rest stand beside it (TeamPage.module.css grid areas) — the layout moves them, never the order a reader hears.
  const body = parts.map(part => {
    if (part === 'concluded') return (
      <div key={part} className={kit.list}>
        <p className={kit.cardText}>This program has concluded.</p>
      </div>
    );
    if (part === 'tryoutDoor' && openYear) return (
      // The drawings' door: a white card with the club's edge, the one green chip, the first tryout day ("Three days from
      // Sun, Nov 2 · Lakeshore Dome"), one button. The button opens the tryout's own page — the details first, then its
      // sign-up.
      <div key={part} className={`${kit.door} ${styles.tryouts}`}>
        <span className={`${kit.chip} ${kit.chipOk}`}>Tryouts open</span>
        <h2 className={kit.doorTitle}>
          {openYear.year ? `Tryouts for the ${openYear.year} season` : `Tryouts for the ${openYear.name}`}
        </h2>
        {daysLine && <p className={kit.sub}>{daysLine}</p>}
        <Link href={publicTryoutHref(orgSlug, team.slug)} className={`${kit.btn} ${kit.btnPrimary} ${kit.btnFull}`}>
          Tryout details and sign-up
        </Link>
      </div>
    );
    if (part === 'tryoutQuiet') return (
      // A heading above its card, like About and every other club section (/design 2026-10-20): the one card that carried
      // its heading inside made the stacked pair read as two different idioms. The address takes its own line so it never
      // splits at a hyphen.
      <section key={part} className={`${kit.section} ${styles.tryouts}`} aria-labelledby="tryouts-quiet">
        <h2 id="tryouts-quiet" className={kit.sectionTitle}>Tryouts</h2>
        <div className={kit.list}>
          <p className={kit.cardText}>
            {team.name} isn’t taking tryout sign-ups right now.
            {email && <> Questions? Email the club at<b className={styles.address}>{email}</b></>}
          </p>
        </div>
      </section>
    );
    if (part === 'schedule') return (
      <div key={part} className={styles.schedule}>
        {publicSchedule && (
          <RepTeamPublicSchedule
            view={publicSchedule}
            // Club Tier 6d (B3, Ask 3): the feed is this page's own address with /calendar on the end — no secret.
            subscribe={{ feedPath: publicTeamFeedPath(orgSlug, team.slug), calendarName: teamCalendarName(team.name, org.name) }}
          />
        )}
      </div>
    );
    if (part === 'about') return (
      <section key={part} className={`${kit.section} ${styles.about}`} aria-labelledby="about-team">
        <h2 id="about-team" className={kit.sectionTitle}>About the team</h2>
        <div className={kit.list}><p className={kit.cardText}>{about}</p></div>
      </section>
    );
    if (part === 'coaches') return (
      <section key={part} className={`${kit.section} ${styles.coaches}`} aria-labelledby="team-coaches">
        <h2 id="team-coaches" className={kit.sectionTitle}>Coaches</h2>
        <ul className={`${kit.list} ${styles.coachList}`} role="list">
          {coaches.map((c, i) => (
            <li key={`${i}-${c.name}`} className={styles.coachRow}>
              <span className={styles.coachName}>{c.name}</span>
              <span className={styles.coachRole}>{c.role}</span>
            </li>
          ))}
          {/* G3: the club's address, never a coach's. Absent when the club has none. */}
          {email && <li className={styles.coachesAsk}>Questions about the team? Email the club at <b>{email}</b>.</li>}
        </ul>
      </section>
    );
    return null;
  });

  // The team described to search engines (Stage 4b-2b, Ask 7A): a sports team of the club — never its players.
  const jsonLd = sportsTeamJsonLd({
    teamName: team.name,
    sport: team.sport ? sportLabel(team.sport) : null,
    url: `${SITE_URL}/${orgSlug}/teams/${team.slug}`,
    clubName: org.name,
    clubUrl: `${SITE_URL}/${orgSlug}`,
  });

  return (
    <div className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      {/* No "← Teams" (design log 2026-10-20, amended): the Teams tab exists exactly when the Teams page does, and it is
          pinned on a phone — a back link to the same place only scrolls away above the name. */}
      <div className={styles.head}>
        <h1 className={`${kit.title} ${styles.name}`}>
          {/* The team's own colour is a dot beside its name, never a tint or a strip: the club's colour carries the page
              (DC-02). A colour is a club's choice and may be any hue, so it never colours text. */}
          {team.color && <span className={styles.teamDot} style={{ background: team.color }} aria-hidden="true" />}
          {team.name}
        </h1>
        {meta && <p className={kit.sub}>{meta}</p>}
      </div>

      <div className={`${styles.body} ${parts.includes('schedule') ? styles.withSchedule : ''}`}>{body}</div>
    </div>
  );
}
