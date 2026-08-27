import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * ⚰⚰ THE FALLBACK, NOT THE RULE — and the count is THREE, enumerated below.
 *
 *     ← Roster        ← Insights        ← All lineups
 *
 * This WAS "the one way out of a coach-portal drill-in" (page-header ruling 2026-08-11), sitting
 * ABOVE the shared `CoachPageHeader` on the grounds that "the header carries the page's name and
 * its actions, and a way back is neither."
 *
 * ⚖ THAT CLAUSE WAS AMENDED ON 2026-08-26 (owner, after walking the pilot on the commitment
 * screen). The way up is now an ARROW IN THE PAGE HEADER'S LEADING CORNER — `CoachPageHeader`'s
 * `backTo` prop, whose docblock carries the full argument — mirroring the help "?" at the trailing
 * corner. Twelve drill-ins moved; each got back a whole row (~40px desktop / ~52px phone).
 *
 * ⚠⚠ THIS COMPONENT SURVIVES FOR EXACTLY THREE SURFACES, BECAUSE AN ARROW NEEDS A HEADER TO SIT
 * IN AND THESE HAVE NONE. Enumerated so a fourth caller reads as drift — and the page-actions
 * guard now asserts this list rather than trusting the comment:
 *   1. `development/board`, FAILED-LOAD branch      — an error line and a way out, no title row.
 *   2. `history/opponents/[opponentKey]`, FAILED-LOAD branch — the same shape.
 *   3. `history/awards/certificate`                 — a PRINT surface. Its back link lives in the
 *      print toolbar beside "Print certificate"; it has never rendered a page header at all.
 * Giving a failed-load branch its own page header is a separate decision about what a broken
 * screen looks like. It was raised and deliberately not taken (spread ruling §7, "no unrelated
 * header tidying") — so if that decision is ever made, this component goes to zero and is deleted
 * along with `.lineupBackLink`, each with a headstone naming the 2026-08-26 amendment.
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
