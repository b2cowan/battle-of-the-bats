import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { readCoachTeamPage } from '@/lib/house-league-coach';
import { coachTeamPath } from '@/lib/house-league-coach-invites';
import { formatStoredDate } from '@/lib/timezone';
import { coachesLine, REP_PORTAL_DOOR } from '@/lib/house-league-teams-words';
import { getRepPortalDoorForReader } from '@/lib/coach-portal-request';
import { householdRecipients } from '@/lib/league-second-parent';
import CopyEmails from './CopyEmails';
import CoachSchedule from './CoachSchedule';
import CoachSubscribe from './CoachSubscribe';
import CoachScores from './CoachScores';
import { SCHEDULE_PUBLIC_WORDS } from '@/lib/league-schedule-words';
import { STANDINGS_WORDS } from '@/lib/league-standings';
import column from '../../../league-column.module.css';
import kit from '@/components/public/ClubKit.module.css';
import styles from './CoachTeam.module.css';

export const dynamic = 'force-dynamic';

/** A coach's team page is private: never indexed, never cached. The tab names the team. */
export const metadata: Metadata = { title: 'Your team', robots: { index: false, follow: false } };

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A HOUSE-LEAGUE COACH'S TEAM PAGE (Club Tier Stage 9c, Part 5; rulings 9c·1, 9c·9; copy §10).
 *
 * A coach's whole product: their team's players and each family's name, email and phone, the season's schedule one tap
 * away, and who enters scores. It lives beside the season's public pages but is signed in and answered by the coach
 * column of the one gate (lib/house-league-coach.ts) — a person who never coached this team gets a 404, not even its
 * name. No admin, no Coaches Portal, no rating, no fee.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export default async function CoachTeamPage({ params }: { params: Promise<{ orgSlug: string; seasonSlug: string; teamId: string }> }) {
  const { orgSlug, seasonSlug, teamId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(coachTeamPath(orgSlug, seasonSlug, teamId))}`);
  // F-XR-4's door check never throws and depends only on who is reading, so it runs beside the team read, not after it.
  const repDoorRead = getRepPortalDoorForReader(orgSlug);
  const page = await readCoachTeamPage(user.id, orgSlug, teamId);
  if (!page || page.team.seasonSlug !== seasonSlug) notFound();
  const { team, view } = page;
  const contact = page.contactEmail
    ? <>Contact {team.orgName} at <a href={`mailto:${page.contactEmail}`}>{page.contactEmail}</a>.</>
    : null;

  if (view === 'gone') {
    return (
      <div className={`container ${column.column} ${styles.page}`}>
        <h1 className={kit.title}>{team.teamName}</h1>
        <p className={kit.sub}>You’re no longer a coach of {team.teamName}.{contact ? <> Questions? {contact}</> : null}</p>
      </div>
    );
  }
  if (view === 'ended') {
    return (
      <div className={`container ${column.column} ${styles.page}`}>
        <h1 className={kit.title}>{team.teamName}</h1>
        <p className={kit.sub}>{team.seasonName} has finished.</p>
      </div>
    );
  }

  const others = page.myTeams.filter(t => t.teamId !== team.teamId);
  // F-XR-4: someone who also coaches a rep team here is told, once and quietly, where it lives. Null unless the Coaches
  // Portal would really admit them — a door that opened a wall would be worse than no line.
  const repDoor = await repDoorRead;
  const scheduleHref = `/${orgSlug}/league/${seasonSlug}/schedule`;
  return (
    <div className={`container ${column.column} ${styles.page}`}>
      {others.length > 0 && (
        <nav className={styles.switcher} aria-label="Your teams">
          <span className={styles.switcherLabel}>Your teams</span>
          {page.myTeams.map(t => (
            t.teamId === team.teamId
              ? <span key={t.teamId} className={`${kit.chip} ${kit.chipOk}`} aria-current="page">{t.teamName}</span>
              : <Link key={t.teamId} href={coachTeamPath(t.orgSlug, t.seasonSlug, t.teamId)} className={`${kit.chip} ${kit.chipNeutral}`}>{t.teamName}</Link>
          ))}
        </nav>
      )}

      <p className={styles.eyebrow}>{team.divisionName} · {team.seasonName}</p>
      <h1 className={kit.title}>{team.teamName}</h1>
      {page.coaches.length > 0 && <p className={kit.sub}>{coachesLine(page.coaches)}</p>}
      {view === 'finished' && page.openUntil && (
        <p className={styles.notice}>{team.seasonName} has finished. This page stays until {formatStoredDate(page.openUntil, { withYear: false })}.</p>
      )}
      {repDoor && (
        <p className={kit.sub} id="coach-rep-portal-door">{REP_PORTAL_DOOR.line} <Link href={repDoor} className={styles.link}>{REP_PORTAL_DOOR.door}</Link></p>
      )}

      {/* A finished season's page has no Schedule section, link included (9f·6): nothing is ahead, and the schedule stays
          on the public site. The live page is unchanged. */}
      {view !== 'finished' && (
      <section className={styles.section} aria-labelledby="coach-schedule">
        <div className={styles.sectionHead}>
          <h2 id="coach-schedule" className={styles.sectionTitle}>Schedule</h2>
          {/* 9d3·5: the coach's own calendar link, a live season only — on the heading's line, never a toolbar. */}
          {view === 'open' && (
            <CoachSubscribe orgSlug={orgSlug} seasonSlug={seasonSlug} teamId={team.teamId} teamName={team.teamName} divisionName={team.divisionName} />
          )}
        </div>
        {/* g3 (9d2·7): the team's published games and its practices, from today on — a live season only. */}
        {view === 'open' && (
          <CoachSchedule practices={page.practices} games={page.games} gamesPublished={page.gamesPublished} divisionName={team.divisionName} toldLine={page.practiceTold} />
        )}
        <p className={`${kit.sub} ${styles.seeAll}`}><Link href={scheduleHref} className={styles.link}>{SCHEDULE_PUBLIC_WORDS.coachSeeSeason}</Link></p>
      </section>
      )}

      <section className={styles.section} aria-labelledby="coach-scores">
        {/* 9e·6: the team's standing, one quiet line — only while families see the table (published and on). On a
            finished season it is the final place (9f·6), and the link names the "Final standings" page it opens. */}
        <h2 id="coach-scores" className={styles.sectionTitle}>{STANDINGS_WORDS.coach.heading(!!page.standing)}</h2>
        {page.standing && (
          <>
            <p className={kit.sub}>{page.standing.text}</p>
            <p className={`${kit.sub} ${styles.seeAll}`}>
              <Link href={`/${orgSlug}/league/${seasonSlug}/standings?d=${page.standing.divisionId}`} className={styles.link}>{view === 'finished' ? STANDINGS_WORDS.coach.finalLink : STANDINGS_WORDS.coach.link}</Link>
            </p>
          </>
        )}
        {/* 9e-3: the team's started games — the home coach enters the score, the away coach can report it. */}
        {(page.gamesPublished || page.scores.length > 0) && (
          <CoachScores rows={page.scores} standings={page.scoresStandings} live={view === 'open'}
            orgSlug={orgSlug} seasonSlug={seasonSlug} teamId={team.teamId} />
        )}
      </section>

      <section className={styles.section} aria-labelledby="coach-players">
        <div className={styles.sectionHead}>
          <h2 id="coach-players" className={styles.sectionTitle}>Players <span className={styles.count}>{page.players.length}</span></h2>
          {/* Signed-in family accounts Stage 3 (ask 5): both parents of each player, nothing twice. */}
          {page.players.length > 0 && <CopyEmails emails={[...new Set(page.players.flatMap(p => householdRecipients(p.guardianEmail, [p])))]} />}
        </div>
        {page.players.length === 0 ? (
          <p className={kit.sub}>No players on this team right now.</p>
        ) : (
          <div className={styles.roster}>
            <div className={styles.rosterHead} aria-hidden>
              <span>Player</span><span>Parent or guardian</span><span>Email</span><span>Phone</span>
            </div>
            <ul className={styles.players}>
              {page.players.map(p => {
                const both = householdRecipients(p.guardianEmail, [p]);
                return (
                <li key={p.id} className={styles.player}>
                  <span className={styles.playerName}>{p.firstName} {p.lastName}</span>
                  <span className={styles.parent}>{p.guardianName}</span>
                  {/* One mail door to both parents (ask 5); the second address reads under the first on a desk. */}
                  <a href={`mailto:${both.join(',')}`} aria-label={both.length > 1 ? `Email ${p.guardianName} and the second parent` : `Email ${p.guardianName}`} className={`${styles.contact} ${styles.mail}`}>
                    <Mail size={22} strokeWidth={1.8} className={styles.contactIcon} aria-hidden />
                    <span className={styles.contactText}>{both.length > 0 ? both.map((e, i) => <span key={e} className={i > 0 ? styles.contactSecond : undefined}>{e}</span>) : p.guardianEmail}</span>
                  </a>
                  {p.guardianPhone && (
                    <a href={`tel:${p.guardianPhone.replace(/[^\d+]/g, '')}`} aria-label={`Call ${p.guardianName}`} className={`${styles.contact} ${styles.tel}`}>
                      <Phone size={22} strokeWidth={1.8} className={styles.contactIcon} aria-hidden />
                      <span className={styles.contactText}>{p.guardianPhone}</span>
                    </a>
                  )}
                </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <p className={styles.foot}>
        Fees, ratings and other teams aren’t shown here.{contact ? <> Questions about the team? {contact}</> : null}
      </p>
    </div>
  );
}
