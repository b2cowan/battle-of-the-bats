'use client';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The "you can't open this here" wall for a coach page gated on a LIVE assignment.
 *
 * ⚠⚠ **THE "THIS SEASON HAS FINISHED" HALF IS DELETED** (owner ruling 2026-08-18,
 * COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN §3.5). This component used to answer TWO questions from
 * twelve call sites: a member whose only season had ended got "This season has finished — it comes
 * back when the next one starts", and everybody else got the honest not-assigned. That first
 * sentence was one of the twenty-nine places the portal described a state nobody chose, and it is
 * gone with the rest: a coach whose team has no live season never reaches these pages at all now,
 * because `CoachTeamSeasonGate` sends them to the team's closed-season page before any of them
 * mount.
 *
 * What is left is the one true sentence, said once. ⚠ Keep it that way: if a future state needs a
 * different answer here, it needs a different WALL, not a second branch inside this one — the
 * branch is exactly how the last one grew.
 *
 * ⚠ Deliberately NOT an access gate — it renders words, decides nothing, and must stay behind the
 * caller's own `!assignment` check.
 */
export default function CoachNotOnTeam() {
  return (
    <div className={styles.notAssigned}>
      <h2>Team not found</h2>
      <p>You are not assigned to this team.</p>
    </div>
  );
}
