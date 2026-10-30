import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { readCoachTeamPage } from '@/lib/house-league-coach';
import { coachTeamPath } from '@/lib/house-league-coach-invites';
import { formatStoredDate } from '@/lib/timezone';
import { coachesLine } from '@/lib/house-league-teams-words';
import CopyEmails from './CopyEmails';
import CoachSchedule from './CoachSchedule';
import { SCHEDULE_PUBLIC_WORDS } from '@/lib/league-schedule-words';
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

      <section className={styles.section} aria-labelledby="coach-schedule">
        <h2 id="coach-schedule" className={styles.sectionTitle}>Schedule</h2>
        {/* g3 (9d2·7): the team's published games and its practices, from today on — a live season only. */}
        {view === 'open' && (
          <CoachSchedule practices={page.practices} games={page.games} gamesPublished={page.gamesPublished} divisionName={team.divisionName} />
        )}
        <p className={`${kit.sub} ${styles.seeAll}`}><Link href={scheduleHref} className={styles.link}>{SCHEDULE_PUBLIC_WORDS.coachSeeSeason}</Link></p>
      </section>

      <section className={styles.section} aria-labelledby="coach-scores">
        <h2 id="coach-scores" className={styles.sectionTitle}>Scores</h2>
        <p className={kit.sub}>The club enters scores for now.</p>
      </section>

      <section className={styles.section} aria-labelledby="coach-players">
        <div className={styles.sectionHead}>
          <h2 id="coach-players" className={styles.sectionTitle}>Players <span className={styles.count}>{page.players.length}</span></h2>
          {page.players.length > 0 && <CopyEmails emails={[...new Set(page.players.map(p => p.guardianEmail.trim().toLowerCase()).filter(Boolean))]} />}
        </div>
        {page.players.length === 0 ? (
          <p className={kit.sub}>No players on this team right now.</p>
        ) : (
          <div className={styles.roster}>
            <div className={styles.rosterHead} aria-hidden>
              <span>Player</span><span>Parent or guardian</span><span>Email</span><span>Phone</span>
            </div>
            <ul className={styles.players}>
              {page.players.map(p => (
                <li key={p.id} className={styles.player}>
                  <span className={styles.playerName}>{p.firstName} {p.lastName}</span>
                  <span className={styles.parent}>{p.guardianName}</span>
                  <a href={`mailto:${p.guardianEmail}`} aria-label={`Email ${p.guardianName}`} className={`${styles.contact} ${styles.mail}`}>
                    <Mail size={22} strokeWidth={1.8} className={styles.contactIcon} aria-hidden />
                    <span className={styles.contactText}>{p.guardianEmail}</span>
                  </a>
                  {p.guardianPhone && (
                    <a href={`tel:${p.guardianPhone.replace(/[^\d+]/g, '')}`} aria-label={`Call ${p.guardianName}`} className={`${styles.contact} ${styles.tel}`}>
                      <Phone size={22} strokeWidth={1.8} className={styles.contactIcon} aria-hidden />
                      <span className={styles.contactText}>{p.guardianPhone}</span>
                    </a>
                  )}
                </li>
              ))}
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
