import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getOrganizationBySlug, getRepTeamBySlug } from '@/lib/db';
import { getEnabledFamilyOrg } from '@/lib/family-access';
import { getSharedGameView } from '@/lib/family-view';
import { formatInOrgZone } from '@/lib/timezone';
import { teamInitials } from '@/lib/team-color';
import styles from '@/components/public/RepTeamPublicSchedule.module.css';

/**
 * /{org}/teams/{teamSlug}/games/{eventId} — the shared game page (Chunk D 1.8).
 *
 * The grandparent screen: teams, time, place, directions before; the final score after.
 * Nothing else. No roster, no lineup, no player name — the DTO it reads has no field for
 * one, which is why this page can be public and child-safe by construction rather than by
 * vigilance.
 *
 * Three things must ALL be true for it to exist: the team is entitled (premium-only), the
 * team's schedule visibility is not "Staff only", and the coach explicitly shared THIS
 * game. Decision #15 kept the URL plain rather than tokenized — it shows what the
 * scoreboard at the field shows — so what protects it is that it does not exist until a
 * coach decides it should, and stops existing when they close the team down again.
 *
 * ANONYMOUS-PUBLIC INVARIANT: no viewer identity is resolved here at all. The page renders
 * identically for everyone, so there is nothing personal to leak into SSR HTML or a cache.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: {
  params: Promise<{ orgSlug: string; teamSlug: string; eventId: string }>;
}): Promise<Metadata> {
  const { orgSlug, teamSlug } = await params;
  return {
    title: `${teamSlug} game`,
    // Deliberately noindex: a coach sharing one game with their families has not asked to
    // put their team's fixture list into a search engine (the retention ruling — nothing
    // in this chunk reaches strangers).
    robots: { index: false, follow: false },
    alternates: { canonical: `/${orgSlug}/teams/${teamSlug}` },
  };
}

export default async function SharedGamePage({ params }: {
  params: Promise<{ orgSlug: string; teamSlug: string; eventId: string }>;
}) {
  const { orgSlug, teamSlug, eventId } = await params;

  const org = await getOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const team = await getRepTeamBySlug(org.id, teamSlug);
  if (!team) notFound();

  if (!(await getEnabledFamilyOrg(org.id, team.id))) notFound();

  const game = await getSharedGameView({ repTeamId: team.id, eventId });
  if (!game) notFound();

  const opponentName = game.opponent ?? 'Opponent';
  const when = formatInOrgZone(game.startsAt, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  const place = [game.location, game.fieldNumber].filter(Boolean).join(', ');

  return (
    <div className={styles.gamePage}>
      <div className={styles.gameInner}>
        <div className={styles.eyebrow}>{game.orgName}</div>

        <div className={styles.card}>
          <div className={styles.centered}>
            <span className={`${styles.pill} ${game.isFinal ? styles.pillFinal : ''}`}>
              {game.status === 'cancelled' ? 'Cancelled' : game.isFinal ? 'Final' : 'Upcoming'}
            </span>
          </div>

          <div className={styles.scoreboard}>
            <div className={styles.side}>
              <div className={styles.mono} aria-hidden>{teamInitials(game.teamName)}</div>
              <div className={styles.sideName}>{game.teamName}</div>
            </div>
            {/* `hasScore`, not `isFinal`: a finished game can carry a result with no scores
                (a forfeit), and subtracting two nulls printed "null–null" on a page the
                coach had just shared with their families. */}
            <div className={styles.bigScore}>
              {game.hasScore ? `${game.teamScore}–${game.opponentScore}` : 'vs'}
            </div>
            <div className={styles.side}>
              <div className={styles.mono} aria-hidden>{teamInitials(opponentName)}</div>
              <div className={styles.sideName}>{opponentName}</div>
            </div>
          </div>

          <div className={styles.kickoff}>
            {when}{place ? ` · ${place}` : ''}
          </div>
        </div>

        {(place || game.locationAddress) && (
          <div className={styles.card}>
            <div className={styles.venueRow}>
              <span aria-hidden>📍</span>
              <div className={styles.venueMain}>
                <div className={styles.rowTitle}>{place || game.locationAddress}</div>
                {game.locationAddress && place && (
                  <div className={styles.rowSub}>{game.locationAddress}</div>
                )}
              </div>
              {game.locationAddress && (
                <a
                  className={styles.link}
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(game.locationAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Directions →
                </a>
              )}
            </div>
          </div>
        )}

        <div className={styles.centered}>
          <Link className={styles.cta} href={`/${game.orgSlug}/teams/${game.teamSlug}`}>
            More from {game.teamName}
          </Link>
        </div>

        <p className={styles.note}>
          Shared by the team — no sign-in needed. Shows team information only.
        </p>
      </div>
    </div>
  );
}
