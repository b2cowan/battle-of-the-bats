import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getRepProgramYears } from '@/lib/db';
import RepTeamPublicSchedule from '@/components/public/RepTeamPublicSchedule';
import { getPublicTeamSchedule, publicTeamFeedPath } from '@/lib/public-team-schedule';
import { teamCalendarName } from '@/lib/export/team-feed-words';
import kit from '@/components/public/ClubKit.module.css';
import { liveSeasonOf, publicTryoutSeasonOf } from '@/lib/season-live';
import { publicTryoutHref } from '@/lib/public-tryout';
import { requirePublicClubPage } from '@/lib/public-club-page';
import { clubPageMetadata, getClubSiteContent, getClubTeam } from '@/lib/club-page-meta';
import { clubTeamsAddress } from '@/lib/public-club-access';
import { anyListedTeam } from '@/lib/org-section-availability';
import { teamMetaLine, teamPageParts } from '@/lib/club-team-page';
import styles from './TeamPage.module.css';
import { forwardToRunningTournament } from '@/lib/club-shortcut';
import { isUuid } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** The tab names the team ("15U AAA · Lakeshore Lynx"); a team that cannot be found leaves the club's name alone
 *  (Club Tier Stage 4b-1). */
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; teamSlug: string }> }): Promise<Metadata> {
  const { orgSlug, teamSlug } = await params;
  return clubPageMetadata(orgSlug, async club => (await getClubTeam(club.id, teamSlug))?.name ?? null);
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

  const programYears = await getRepProgramYears(team.id);

  // The standing public schedule (Chunk D 1.9) — and, since Club Tier 6d, its Subscribe button and the team's public
  // calendar feed — all ask ONE question (`getPublicTeamSchedule`): Public link, the club not cancelled, the family
  // layer, not archived, a live season. This page never decides; it renders what it is given. ⚠ It used to skip the
  // cancelled-club check the feed made, so a cancelled club's Public link schedule kept showing here (D07, S6D-09).
  // The visibility check still runs first, off the already-loaded team row, so a team that never turned Public link on
  // pays no extra query on a page that gets public traffic.
  const [publicSchedule, siteContent] = await Promise.all([
    getPublicTeamSchedule({ org, team }),
    // The club's public contact (the Public Site editor's), for the quiet tryout sentence — never the org row (F09).
    getClubSiteContent(org.id),
  ]);

  // THE ONE PUBLIC TRYOUT RULE (Club Tier B07): the team's LIVE season with tryouts open, never
  // an archived team. This page used to accept only an ACTIVE season while the sign-up form
  // accepted any — so the two could disagree about which season a family was applying to.
  const openYear = publicTryoutSeasonOf(team, programYears);
  // The season under the name is the team's live one; an archived team has none.
  const liveYear = team.isArchived ? null : liveSeasonOf(programYears);
  const meta = teamMetaLine(team.division, liveYear?.year);
  const about = team.description?.trim() || null;
  const email = siteContent?.contactEmail?.trim() || null;
  // The Teams page exists exactly when the Teams tab does: the plan carries it and the club lists a team. This team, if
  // not archived, is one; an archived team's page asks (a club whose teams are all archived has no list to go up to).
  const teamsPage = clubTeamsAddress(org) === 'teams-page' && (!team.isArchived || await anyListedTeam(org.id));

  // End state 3: a part with nothing to show is absent. No Past seasons (DC-07: a door to an old season would be a new
  // look-back surface); no Coaches (4c, with the coach's own switch).
  const parts = teamPageParts({ archived: team.isArchived, tryoutOpen: !!openYear, schedule: !!publicSchedule, about: !!about });

  // The parts in the phone's order, which is also the reading order; at a desk the schedule takes the left column and
  // the rest stand beside it (TeamPage.module.css grid areas) — the layout moves them, never the order a reader hears.
  const body = parts.map(part => {
    if (part === 'concluded') return (
      <div key={part} className={kit.list}>
        <p className={kit.cardText}>This program has concluded.</p>
      </div>
    );
    if (part === 'tryoutDoor' && openYear) return (
      // The drawings' door: a white card with the club's edge, the one green chip, one button (the tryout's days line
      // is Stage 4b-2b). The button opens the tryout's own page — the details first, then its sign-up.
      <div key={part} className={`${kit.door} ${styles.tryouts}`}>
        <span className={`${kit.chip} ${kit.chipOk}`}>Tryouts open</span>
        <h2 className={kit.doorTitle}>
          {openYear.year ? `Tryouts for the ${openYear.year} season` : `Tryouts for the ${openYear.name}`}
        </h2>
        <Link href={publicTryoutHref(orgSlug, team.slug)} className={`${kit.btn} ${kit.btnPrimary} ${kit.btnFull}`}>
          Tryout details and sign-up
        </Link>
      </div>
    );
    if (part === 'tryoutQuiet') return (
      <div key={part} className={`${kit.list} ${styles.tryouts}`}>
        <h2 className={kit.cardHead}>Tryouts</h2>
        <p className={kit.cardText}>
          {team.name} isn’t taking tryout sign-ups right now.
          {email && <> Questions? Email the club at <b>{email}</b>.</>}
        </p>
      </div>
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
    return null;
  });

  return (
    <div className={styles.page}>
      {/* One level up (design log 2026-10-20) — to the club's Teams page, where the club has one. */}
      {teamsPage && (
        <Link href={`/${orgSlug}/teams`} className={kit.back}>← Teams</Link>
      )}

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
