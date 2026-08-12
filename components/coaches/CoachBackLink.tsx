import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The ONE way out of a coach-portal drill-in (page-header ruling 2026-08-11).
 *
 *     ← Roster        ← Insights        ← All lineups
 *
 * Sits ABOVE the shared `CoachPageHeader`, never inside it: the header carries the page's name
 * and its actions, and a way back is neither.
 *
 * ⚠ This exists because the portal had FIVE back-link treatments — a grey `.backLink`, two
 * `.lineupBackLink` variants differing only in whether the glyph was a lucide icon or a literal
 * "←", a `.scoutBackLink` rendered as a subtitle, plus the game-day and record ones on bespoke
 * surfaces. Pass 2 collapsed them to one CLASS, which stops the styles drifting but not the
 * markup: the shape was still hand-copied into 27 files, and the tap-target padding, the icon
 * size and the `aria-hidden` were 27 chances to get it slightly wrong. `CoachPageHeader`'s own
 * docblock records what that costs when it is allowed to run for a year. Same lesson, one level
 * down.
 *
 * `.gdBack` (game bench console) and `.ppRunBackLink` (practice run mode) stay separate on
 * purpose — those are field surfaces with their own chrome, listed exempt in the ruling.
 */
export default function CoachBackLink({
  href,
  children,
}: {
  /** Where "up" is — one level, and carrying the viewed season when the page has one. */
  href: string;
  /** What is up there, named as the destination reads: "Roster", "All lineups", "Insights". */
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={styles.lineupBackLink}>
      <ArrowLeft size={14} aria-hidden /> {children}
    </Link>
  );
}
