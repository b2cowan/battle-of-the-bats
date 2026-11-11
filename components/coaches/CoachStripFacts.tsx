'use client';
import Link from 'next/link';
import { useCoaches } from '@/lib/coaches-context';
import { resolveLiveSeason, resolveClosedSeason } from '@/lib/coach-season-view';
import { coachStripFacts } from '@/lib/coach-strip-facts';
import type { CoachTeamFacts } from '@/lib/coach-team-masthead';
import coach from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './CoachTopStrip.module.css';

/**
 * ⚖ THE TEAM'S FACTS AT THE STRIP'S RIGHT END (navigation Phase 4, E7, C2, C5, C9; drawings tab 17). Rendered on the server
 * by the coaches layout's `@stripFacts` slot for a team's pages (`loadCoachTeamMasthead`, the phone bar's own feed), drawn by
 * `CoachTopStrip` before View site: in the quiet ink, behind ONE hairline on their right (the event's facts' recipe,
 * `AdminTopStrip.module.css .facts`), in the coach's own shipped looks — the olive "Game day" chip and the amber "Complete".
 *
 * ⚖ WHAT GIVES WAY (C2, C9): at 1100 and narrower the quiet words go (the club, the season, the record, "Next …", the
 * opponent and the time — the shipped `.facts` rule); the Game day chip and "Open the bench ›" STAY at every width, a door
 * rather than a fact. Above 1100 the club's name is the first words to give way when the strip is short (it shrinks, "…").
 * The page's name never truncates.
 */
export default function CoachStripFacts({ teamId, records, status, statusYearId, gameDayConsole, orgName, isTeamWorkspace }:
  { teamId: string } & CoachTeamFacts) {
  const { assignments, closedAssignments } = useCoaches();
  // The shared resolvers over the coach's team list — the rule the server's loader ran, so the two agree by construction.
  const live = resolveLiveSeason(assignments, teamId);
  const season = live ?? resolveClosedSeason(assignments, closedAssignments, teamId);
  if (!season) return null;
  const facts = coachStripFacts({
    teamName: season.teamName, orgName, isTeamWorkspace, season, seasonFinished: !live, records, status, statusYearId, gameDayConsole,
  });
  const quiet = [facts.club, facts.season, facts.state, facts.record].filter((w): w is string => !!w);
  const s = facts.status;
  if (!quiet.length && !s) return null;
  return (
    <span className={styles.teamFacts}>
      {quiet.length > 0 && (
        <span className={styles.factsQuiet}>
          {quiet.map((w, i) => (
            <span key={i} className={i === 0 && facts.club ? styles.factsClub : styles.factsWord}>{w}</span>
          ))}
        </span>
      )}
      {s?.kind === 'next' && (
        <span className={styles.factsQuiet}>
          <span className={styles.factsKey}>Next</span>
          <span className={styles.factsWord}>{s.when}</span>
        </span>
      )}
      {s?.kind === 'complete' && (
        <span className={styles.factsQuiet}>
          <span className={coach.seasonChip}>Complete</span>
          {s.finalRecord && <span className={styles.factsWord}>Final {s.finalRecord}</span>}
        </span>
      )}
      {s?.kind === 'game_day' && (
        // C2: the chip and the way to the bench are their own pair; the who and when between them are quiet words.
        <span className={styles.factsGameDay}>
          <span className={coach.teamHeaderToday}>Game day</span>
          <span className={styles.factsQuiet}>
            <span className={styles.factsWord}>{[s.who, s.time].filter(Boolean).join(' · ')}</span>
          </span>
          {s.benchHref && <Link href={s.benchHref} className={styles.factsBench}>Open the bench ›</Link>}
        </span>
      )}
    </span>
  );
}
