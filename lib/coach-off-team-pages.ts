/**
 * ⚖ THE PORTAL'S THREE OFF-TEAM PAGES NAME THEMSELVES IN THE STRIP (owner 2026-11-23, reversing navigation Phase 4's "the hub,
 * notifications, Plan & billing keep today's strip"). Notifications, Plan & billing and Join a club live at
 * `/{org}/coaches/{page}`, not under a team, yet the sidebar beside them still stands on the coach's last team — so a full-width
 * "Coaches Portal" strip over a team sidebar read as a half-converted screen. They now wear the team pages' split strip: "Coach"
 * over the sidebar, the PAGE's name over the page, and NO team facts (the page is the workspace's, not the team's).
 *
 * One list, one rule: the strip reads it to split and to name; the page header reads the same answer to drop its paper title above
 * 900. The words are the pages' own constants, so the strip and the page's header cannot disagree. Computer only — a phone has no
 * bar on these pages (the team bar is mounted by the team layout), so the phone keeps the page's own title.
 *
 * Pure (no React), so it is unit-testable and safe on the server's first paint. The team hub is NOT on this list: it names no
 * single page and keeps today's strip.
 */
import { PLAN_BILLING_TITLE } from './plan-billing-title.ts';
import { JOIN_A_CLUB_TITLE } from './join-a-club-title.ts';

export const COACH_NOTIFICATIONS_TITLE = 'Notifications';

const OFF_TEAM_PAGE = /\/coaches\/(billing|notifications|link-org)\/?$/;

const NAMES: Record<string, string> = {
  billing: PLAN_BILLING_TITLE,
  notifications: COACH_NOTIFICATIONS_TITLE,
  'link-org': JOIN_A_CLUB_TITLE,
};

/** The strip's name for an off-team page, from the address alone; null on every other address. */
export function coachOffTeamPageName(pathname: string): string | null {
  const m = OFF_TEAM_PAGE.exec(pathname);
  return m ? NAMES[m[1]] ?? null : null;
}
