import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getRepProgramYears } from '@/lib/db';
import RepTeamPublicSchedule from '@/components/public/RepTeamPublicSchedule';
import { getPublicTeamSchedule, publicTeamFeedPath } from '@/lib/public-team-schedule';
import { teamCalendarName } from '@/lib/export/team-feed-words';
import kit from '@/components/public/ClubKit.module.css';
import { publicTryoutSeasonOf } from '@/lib/season-live';
import { publicTryoutRegisterHref } from '@/lib/public-tryout';
import { requirePublicClubPage } from '@/lib/public-club-page';
import { clubPageMetadata, getClubTeam } from '@/lib/club-page-meta';
import { forwardToRunningTournament } from '@/lib/club-shortcut';
import { isUuid } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** The tab names the team ("15U AAA · Lakeshore Lynx"); a team that cannot be found leaves the club's name alone
 *  (Club Tier Stage 4b-1). */
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; teamSlug: string }> }): Promise<Metadata> {
  const { orgSlug, teamSlug } = await params;
  return clubPageMetadata(orgSlug, async club => (await getClubTeam(club.id, teamSlug))?.name ?? null);
}

const STATUS_LABEL: Record<string, string> = {
  draft:     'Draft',
  active:    'Active',
  completed: 'Completed',
  archived:  'Archived',
};

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
  const publicSchedule = await getPublicTeamSchedule({ org, team });

  // THE ONE PUBLIC TRYOUT RULE (Club Tier B07): the team's LIVE season with tryouts open, never
  // an archived team. This page used to accept only an ACTIVE season while the sign-up form
  // accepted any — so the two could disagree about which season a family was applying to.
  const openYear = publicTryoutSeasonOf(team, programYears);
  const pastYears = programYears.filter(y => y.status === 'completed' || y.status === 'archived');

  // The status chip (DC-04), neutral here: a division, "Alumni" and a past season's status are facts about the team, not a
  // call to act, so none of them takes the green. A team colour is a club's choice and may be any hue, so it appears
  // only as the strip above the page, never as text or a tint (DC-02).
  const chip = `${kit.chip} ${kit.chipNeutral}`;

  return (
    <div>
      {/* Color accent strip */}
      {team.color && (
        <div style={{ height: '4px', background: team.color }} />
      )}

      <div
        style={{
          maxWidth: '680px',
          margin: '0 auto',
          padding: '2rem 1.5rem 5rem',
        }}
      >
        {/* Team header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <h1 className={kit.title} style={{ margin: 0 }}>
              {team.name}
            </h1>
            {team.division && <span className={chip}>{team.division}</span>}
            {team.isArchived && <span className={chip}>Alumni</span>}
          </div>
          {team.description && (
            <p
              style={{
                font: '400 16px/1.6 var(--club-text-face)',
                color: 'var(--club-soft)',
                margin: '0.5rem 0 0',
                maxWidth: '520px',
              }}
            >
              {team.description}
            </p>
          )}
        </div>

        {/* Alumni notice */}
        {team.isArchived && (
          <div
            style={{
              padding: '1rem 1.25rem',
              border: '1px solid var(--club-line)',
              borderRadius: 8,
              background: 'var(--club-card)',
              marginBottom: '2rem',
              font: '400 14px/1.6 var(--club-text-face)',
              color: 'var(--club-soft)',
            }}
          >
            This program has concluded. The full season history is preserved below.
          </div>
        )}

        {/* Tryouts open banner — the drawings' "Open now" callout: a white card with the club's edge down its left side
            (Club Tier Stage 4b-1). Same block as before; the call to act is the club's own button. */}
        {openYear && (
          <div
            style={{
              padding: '1.25rem 1.5rem',
              border: '1px solid var(--club-line)',
              borderLeft: '3px solid var(--club-edge)',
              borderRadius: 8,
              background: 'var(--club-card)',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div className={`${kit.chip} ${kit.chipOk}`} style={{ marginBottom: '0.5rem' }}>
                Tryouts open
              </div>
              <div style={{ font: '600 16px var(--club-text-face)', color: 'var(--club-text)' }}>
                {openYear.name}
              </div>
            </div>
            <Link
              href={publicTryoutRegisterHref(orgSlug, team.slug)}
              className={`${kit.btn} ${kit.btnPrimary}`}
              style={{ whiteSpace: 'nowrap' }}
            >
              Register now
            </Link>
          </div>
        )}

        {/* Standing public schedule (Chunk D 1.9). This page's job is to answer "where is the
            game", and a family that only ever uses this page is a retention win, not a funnel
            failure. ⚠ Until 2026-09-12 a footnote here told families to "ask the coach for the
            team's family link"; that link was removed with the follower tier (owner), so the
            page now simply shows the schedule and asks for nothing. */}
        {publicSchedule && (
          <RepTeamPublicSchedule
            view={publicSchedule}
            // Club Tier 6d (B3, Ask 3): the feed is this page's own address with /calendar on the end — no secret.
            subscribe={{ feedPath: publicTeamFeedPath(orgSlug, team.slug), calendarName: teamCalendarName(team.name, org.name) }}
          />
        )}

        {/* Past seasons */}
        {pastYears.length > 0 && (
          <div>
            <div className={kit.band}>
              Past seasons
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {pastYears.map(py => (
                <div
                  key={py.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: 8,
                    border: '1px solid var(--club-line)',
                    background: 'var(--club-card)',
                  }}
                >
                  <span style={{ font: '400 14px var(--club-text-face)', color: 'var(--club-text)' }}>
                    {py.name}
                  </span>
                  <span className={chip}>
                    {STATUS_LABEL[py.status] ?? py.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
