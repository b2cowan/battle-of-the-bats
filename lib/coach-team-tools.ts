import { Users, CalendarClock, CircleDollarSign, Megaphone, type LucideIcon } from 'lucide-react';
// Type-only: erased at build, so importing the feature-key union here can never pull the
// server-side Supabase admin client into a client bundle.
import type { ActivatableFeature } from './basic-coach-teams';
import { coachTeamPath } from './coaches-portal-routes';

/**
 * Canonical order + nav name + icon for the free coach portal's four Tier-2 team tools — the
 * single source consumed by every surface that names them: the shell's tab row + left rail
 * (CoachPortalShell), the Explore catalog, and the Overview setup panel.
 *
 * These four are OFF by default per team (`activated_features`, mig 131) and appear in the nav
 * only once the coach turns them on. `label` is the NAV NAME — any button offering to turn a tool
 * on must say exactly this, or it promises a door whose sign reads differently (the defect the
 * Overview setup panel was built to fix).
 *
 * Kept icon-carrying but plain-data (the TOURNAMENT_PAGE_TABS pattern) so a consumer that renders
 * no icon can ignore `Icon` while the icon consumers share one list. Per-surface COPY deliberately
 * does NOT live here — Explore's catalog blurb and the setup panel's action line are different
 * voices for different jobs; only the facts that must agree are shared.
 */
export const COACH_TEAM_TOOLS: { key: ActivatableFeature; label: string; Icon: LucideIcon }[] = [
  { key: 'roster', label: 'Roster', Icon: Users },
  { key: 'schedule', label: 'Schedule', Icon: CalendarClock },
  { key: 'fees', label: 'Fees', Icon: CircleDollarSign },
  { key: 'announcements', label: 'Announcements', Icon: Megaphone },
];

/** Route suffix a tool's section lives at, under the team root. Derived — never hand-written. */
export function coachTeamToolSub(key: ActivatableFeature): string {
  return `/${key}`;
}

/** Full path to a tool's section for a team. */
export function coachTeamToolPath(basicTeamId: string, key: ActivatableFeature): string {
  return `${coachTeamPath(basicTeamId)}${coachTeamToolSub(key)}`;
}
