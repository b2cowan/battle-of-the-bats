import type { CoachCapabilities } from './coach-capabilities';

/**
 * Whether a coach nav item (keyed by its display label) is visible for the given capabilities.
 *
 * SHARED by CoachesSidebar and CoachesBottomNav so the assistant-coach gate is a SINGLE source of
 * truth — it used to be duplicated in both components, which risked silent drift. Head coaches have
 * full capabilities so nothing hides. Fail-open when caps are absent (still loading) — every coach
 * route enforces the capability server-side regardless.
 *
 * Labels renamed in the Phase-3 nav rebuild keep their old routes: "Money" → /accounting,
 * "Season Review" → /history (so the gate for those matches the old Accounting/History gate).
 */
export function isCoachNavItemVisible(caps: CoachCapabilities | undefined, label: string): boolean {
  if (!caps) return true;
  switch (label) {
    case 'Roster':        return caps.roster !== 'off';
    case 'Lineups':       return caps.lineups;
    case 'Schedule':      return caps.schedule;
    case 'Tryouts':       return caps.tryouts;
    // Hidden unless the coach can send (no draft UI yet). When the draft flow ships, switch this to
    // always-visible or a dedicated `canDraftAnnouncements` cap so granted assistants can draft.
    case 'Announcements': return caps.announcementsSend;
    case 'Money':         return caps.money !== 'off';
    // Open to any assigned coach: the page shows record / roster size / tryout trend to everyone;
    // the dues & expenses rows inside are money-gated server-side (Phase 4 F2 split).
    case 'Season Review': return true;
    case 'Documents':     return caps.documents !== 'off';
    case 'Staff':         return caps.isHeadCoach;
    default:              return true;
  }
}
