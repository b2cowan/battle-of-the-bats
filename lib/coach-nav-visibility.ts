import type { CoachCapabilities } from './coach-capabilities';

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
    case 'Documents':     return caps.documents !== 'off';
    case 'Staff':         return caps.isHeadCoach;
    default:              return true;
  }
}
