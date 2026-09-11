import {
  canManageAwards,
  canManageSchedule,
  canLogScoutingObservation,
  hasNonMoneyRecordAccess,
  type CoachCapabilities,
} from './coach-capabilities';

/**
 * WHICH DOORS THE SCHEDULE'S EVENT PANEL MAY SHOW — one answer, read by the fetch and the markup.
 *
 * ⚠ Why this exists (staff access review, 2026-09-10). The event panel used to show every tab,
 * every score control and every lineup door to anyone who could open the schedule, and let the
 * routes behind them refuse. A schedule-only helper therefore met an Attendance tab whose read was
 * refused (and whose refusal was swallowed, so the panel claimed the roster was empty), a Lineup tab
 * with "Build lineup →" onto a page that says lineups aren't turned on, "+ Add final score" and
 * "Give an award" that could only 403 — three ungated controls in a row leading to a wall. The
 * portal's rule is that a door a person can see but not use is a bug; the Game-Day console already
 * obeys it with a server-derived `can` object, and this is the schedule's equivalent.
 *
 * ⚠ FAILS CLOSED while capabilities are still loading (`caps` undefined ⇒ every door false), the
 * same posture the page's own `canAddEvents` has always taken: a write control that appears for a
 * moment and then vanishes is worse than one that arrives a moment late.
 *
 * ⚠ Each field mirrors the `denyUnless` gate on the route it opens — change one, change both:
 *   attendanceTab        ↔ `events/[eventId]/attendance` GET/PATCH   (`capabilities.attendance`)
 *   lineupTab            ↔ `events/[eventId]/lineup` GET/PUT         (`capabilities.lineups`)
 *   scoutingTab          ↔ `opponents/*`                             (`canLogScoutingObservation`)
 *   scoreForm, editEvent ↔ `events/[eventId]` PATCH                  (`canManageSchedule`)
 *   awards               ↔ `awards` POST                             (`canManageAwards`)
 *   seasonAttendanceLink ↔ the Insights portal's own page gate       (`hasNonMoneyRecordAccess`)
 *   emailFamilies        ↔ `announcements` GET/POST                  (`announcementsSend`)
 */
export interface ScheduleDrawerEvent {
  /** A league game, tournament game or scrimmage. */
  isGame: boolean;
  /** An event a lineup can be built for (the page's own `isLineupEvent`). */
  isLineupEvent: boolean;
  /** The game names a real opponent — a TBD bracket slot gets no Scouting tab, never a dead end. */
  hasOpponent: boolean;
  /** The scouting roll-up resolved for this team (absent in an archive, or before it loads). */
  scoutingAvailable: boolean;
}

export interface ScheduleDrawerDoors {
  attendanceTab: boolean;
  lineupTab: boolean;
  scoutingTab: boolean;
  scoreForm: boolean;
  awards: boolean;
  seasonAttendanceLink: boolean;
  editEvent: boolean;
  emailFamilies: boolean;
}

const CLOSED: Readonly<ScheduleDrawerDoors> = {
  attendanceTab: false,
  lineupTab: false,
  scoutingTab: false,
  scoreForm: false,
  awards: false,
  seasonAttendanceLink: false,
  editEvent: false,
  emailFamilies: false,
};

export function scheduleDrawerDoors(
  caps: CoachCapabilities | null | undefined,
  ev: ScheduleDrawerEvent,
): ScheduleDrawerDoors {
  if (!caps) return { ...CLOSED };
  return {
    attendanceTab: caps.attendance,
    lineupTab: ev.isLineupEvent && caps.lineups,
    // Opens on the WEAKER grant (`schedule` alone) — a person without the pooled-book read
    // still gets this tab, just a downgraded one (record + their own notes + the log form).
    // The panel/route decide the downgrade from `scoutingBookAccess` in the payload; this
    // door only decides whether the tab exists at all (owner ruling 2026-09-11).
    scoutingTab: ev.isGame && ev.hasOpponent && ev.scoutingAvailable && canLogScoutingObservation(caps),
    scoreForm: ev.isGame && canManageSchedule(caps),
    awards: ev.isGame && canManageAwards(caps),
    seasonAttendanceLink: hasNonMoneyRecordAccess(caps),
    editEvent: canManageSchedule(caps),
    emailFamilies: caps.announcementsSend,
  };
}
