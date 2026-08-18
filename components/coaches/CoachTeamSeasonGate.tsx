'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **A TEAM WITH NO LIVE SEASON HAS ONE PAGE — and this is the one place that is true**
 * (owner ruling 2026-08-18, COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN §3.5).
 *
 * ⚠⚠ **THIS COMPONENT IS THE DELETION.** Before it, a finished season was described screen by
 * screen: SEVENTEEN coach pages carried a read-only branch (past-tense empty states, hidden write
 * controls, suppressed filters) and TWELVE more rendered a "this screen comes back next season"
 * notice. Twenty-nine bespoke answers to one question — and every new feature had to write a
 * thirtieth. They are gone, and the question is answered once, here, before any of those pages
 * mount.
 *
 * ⚠ **IT RENDERS `children` OR IT DOES NOT — it never renders them "read-only".** That is the
 * whole point, and it is also why this cannot be done with CSS or a prop: a live page that mounts
 * against a finished season issues its fetches, opens its modals and offers its controls, and the
 * server refuses each one separately. Not mounting is the only version of this that is true.
 *
 * ⚠ **THE DECISION IS MADE ON THE SERVER** (`seasonFinished` arrives as a prop from the team
 * layout, which has already resolved both assignment lookups for the masthead). Nothing here waits
 * on a client fetch, so there is no frame in which a live tool paints against a closed season.
 *
 * ⚠ It is NOT an access gate. "You are not on this team" is a different sentence with a different
 * cause, and every page still owns it. This one says only: the season this team is on has finished,
 * and its story is one page.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export default function CoachTeamSeasonGate({
  seasonFinished,
  closedHref,
  teamBase,
  children,
}: {
  /** The team holds no live season, and does hold a closed one this coach may read. */
  seasonFinished: boolean;
  /** `/{org}/coaches/teams/{teamId}/season-end` — the team's one page. */
  closedHref: string;
  /** `/{org}/coaches/teams/{teamId}` — for the one record page that lives off the closed page. */
  teamBase: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  /**
   * ⚠⚠ **"ONE PAGE" MEANS ONE PAGE OF THE SEASON — NOT ONE ROUTE.** The first build of this gate
   * allowed exactly `/season-end`, and that broke the practices shelf: every row on it opens the
   * READ-ONLY past-plan page, which this gate then bounced straight back to the page the row was
   * on. A shelf whose every row loops is worse than no shelf, and it looked like a rendering bug
   * rather than a routing one.
   *
   * So the allowance is the closed season's RECORD surfaces, and there are exactly two of them:
   * the page itself, and the one read-only plan page it opens. Both are records; neither can be
   * written to; the plan page's only link goes back here.
   *
   * ⚠ **THE TEST FOR ADDING A THIRD IS NOT "IS IT USEFUL"** — it is "is this a record with no way
   * to act on it, reached FROM the closed-season page?". A live tool that happens to render
   * something read-only does not qualify; that is the twenty-nine branches coming back one route
   * at a time.
   */
  const RECORD_PATHS = [closedHref, `${teamBase}/history/development/practices/`];
  /**
   * ⚠ Compared to the PATHNAME alone, never the full URL. The closed-season page is also reached
   * with `?year=`, and a coach opening an older year of a team that is itself between seasons must
   * not be bounced back to the default one.
   */
  const onRecordSurface = RECORD_PATHS.some(p => (p.endsWith('/') ? pathname.startsWith(p) : pathname === p));
  const redirecting = seasonFinished && !onRecordSurface;

  useEffect(() => {
    if (redirecting) router.replace(closedHref);
  }, [redirecting, router, closedHref]);

  if (!redirecting) return <>{children}</>;

  /**
   * ⚠ Says WHY, rather than showing a bare spinner. A coach who followed a bookmark to last year's
   * schedule and landed somewhere else is owed the reason — otherwise the portal looks like it lost
   * their page. It is one line because it is on screen for one frame in the ordinary case.
   */
  return (
    <p className={styles.muted} style={{ padding: '2rem 0' }}>
      This team&apos;s season has finished — opening the season&apos;s page…
    </p>
  );
}
