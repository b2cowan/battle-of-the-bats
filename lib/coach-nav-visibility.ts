import type { CoachCapabilities } from './coach-capabilities';

/**
 * The CLOSED-season nav set (Batch 3, P0 #1) — read-only doors only, shared by
 * CoachesSidebar and CoachesBottomNav for the same no-drift reason as the gate below.
 * Insights points straight at the results ARCHIVE: the hub's live-season tiles read as
 * errors for a team with no active year. Icons are resolved per component (lucide imports
 * stay component-side); a new door added here reaches both navs at once.
 */
export const CLOSED_TEAM_NAV_ITEMS: { label: string; href: string }[] = [
  { label: "Season's End", href: '/season-end' },
  { label: 'Insights', href: '/history/results' },
];

/**
 * Whether a coach nav item (keyed by its display label) is visible for the given capabilities.
 *
 * SHARED by CoachesSidebar and CoachesBottomNav so the assistant-coach gate is a SINGLE source of
 * truth — it used to be duplicated in both components, which risked silent drift. Head coaches have
 * full capabilities so nothing hides. Fail-open when caps are absent (still loading) — every coach
 * route enforces the capability server-side regardless.
 *
 * Labels renamed keep their old routes: "Money" → /accounting, "Insights" → /history (Phase-3
 * rebuild renamed History → "Season Review"; the 2026-07-08 Insights consolidation renamed it
 * again and moved it to the Season group — the gate stays the old History gate).
 */
export function isCoachNavItemVisible(caps: CoachCapabilities | undefined, label: string): boolean {
  if (!caps) return true;
  switch (label) {
    case 'Roster':        return caps.roster !== 'off';
    // Batch 4 (P1 f2-6 / f6-0 ×2 / f8-2): the season attendance report had no home in either nav —
    // its only door was a secondary button on Roster that disappears in the depth-chart view.
    // Needs BOTH: the report lists players by name (the route gates on roster visibility) and the
    // page leads with "take attendance for {next event}". Granting one without the other is a
    // legitimate assistant setup, and gating on only `attendance` would show a door that 403s.
    case 'Attendance':    return caps.attendance && caps.roster !== 'off';
    case 'Lineups':       return caps.lineups;
    case 'Schedule':      return caps.schedule;
    case 'Tryouts':       return caps.tryouts;
    // Hidden unless the coach can send (no draft UI yet). When the draft flow ships, switch this to
    // always-visible or a dedicated `canDraftAnnouncements` cap so granted assistants can draft.
    case 'Announcements': return caps.announcementsSend;
    case 'Money':         return caps.money !== 'off';
    // Open to any assigned coach: the hub shows record / roster size / tryout trend to everyone;
    // the money rows inside stay money-gated server-side (Phase 4 F2 split) and the lineup /
    // attendance sections gate per-section on their own capabilities.
    case 'Insights':      return true;
    // Player Development (3B): the hub is useful with EITHER goals (notes) or measurables
    // (roster view); all writes stay head-coach-only server-side (D1).
    case 'Development':   return caps.notes || caps.roster !== 'off';
    case 'Documents':     return caps.documents !== 'off';
    case 'Staff':         return caps.isHeadCoach;
    default:              return true;
  }
}
