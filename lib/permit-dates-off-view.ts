/**
 * permit-dates-off-view.ts — THE PERMIT WINDOW'S NOTICE, as one reader may see it (Club Tier Stage 13c, C2 = A — owner
 * 2026-11-08; drawing CLUB_TIER_STAGE13C_DRAWINGS.html, the permit window). Pure and client-safe: the server reader
 * (`lib/permit-dates-off.ts`) hands it what the dates off took and what the reader's Calendar shows of it, and this decides
 * the words and the doors — so the door matrix is tested role by role (`tests/unit/permit-dates-off.test.ts`).
 *
 * ⚖ A DOOR THE READER CANNOT OPEN IS ABSENT, NOT GREYED (the brief's rule, every card): "Fix the 6 practices in {schedule}"
 * for whoever builds schedules (`canOpenClubSchedules`); "Open {season}'s schedule" for whoever's Calendar shows house
 * league (the season's own door, the Calendar's); "See {day} on the Calendar" for whoever has a Calendar. The treasurer,
 * who opens none of those programs, reads the list alone, each booking by the pool's own words — the team or season and the
 * facility, which the permit's Use already names to every reader.
 */
import { PERMIT_WORDS as W, dayWithWeekday, takenChip, type TakenKind } from './permit-words.ts';
import type { ClubBooking } from './venue-clash.ts';
import type { CalendarBooking, CalendarRead } from './club-calendar-view.ts';

export interface TakenDay { day: string; bookings: ClubBooking[] }

export interface TakenRowView {
  key: string;
  startMs: number;
  /** "Hawks vs Owls · Diamond A", "14U AA · Diamond A". */
  title: string;
  /** "House league · U11 Pinto", "Saturdays at Kinsmen, December 2026" — absent when the title says it all. */
  line: string | null;
  chip: string;
  /** Opens the booking where it is kept — only into a program the reader can open. */
  door: { label: string; href: string } | null;
}
export interface TakenGroupView { day: string; heading: string; rows: TakenRowView[] }
/** `kind`: which of the three doors it is — a caller picking one (the schedule page's house-league door) reads it, never the address. */
export interface TakenDoorView { label: string; href: string; kind: 'schedule' | 'season' | 'calendar' }
export interface DatesOffNotice {
  /** The dates off that took something, in order. */
  days: string[];
  count: number;
  groups: TakenGroupView[];
  /** Each only for a reader who can open it — absent, never greyed. */
  doors: TakenDoorView[];
}

/**
 * EACH BOOKING ONCE, with the permits whose dates off took it. ⚖ Two permits holding the same hour, both with the day off,
 * each took it: each permit's own list is right to name it, a count across permits is not right to count it twice (Session
 * A review item e). Every view across permits reads this one walk — the club's count, the Calendar's marks, house league.
 */
export function takenOnce(taken: ReadonlyMap<string, readonly TakenDay[]>): Map<string, { booking: ClubBooking; day: string; permitIds: string[] }> {
  const out = new Map<string, { booking: ClubBooking; day: string; permitIds: string[] }>();
  for (const [permitId, days] of taken) {
    for (const d of days) for (const b of d.bookings) {
      const seen = out.get(b.key);
      if (!seen) out.set(b.key, { booking: b, day: d.day, permitIds: [permitId] });
      else if (!seen.permitIds.includes(permitId)) seen.permitIds.push(permitId);
    }
  }
  return out;
}

/** A schedule's Needs attention row (13c Session C, C2), as `readScheduleOutside` answers it — here, so the page reads
 *  the type without the server module. */
export interface ScheduleOutside {
  permitName: string;
  /** Each date off from today on that still holds slots of this schedule, in day order, with the permit's own note. */
  days: { day: string; note: string | null; slotKeys: string[] }[];
  /** What else this permit's dates off took on those days that is HOUSE LEAGUE's (the pool's own bookings — its games and
   *  practices; a postponed game holds no time, so it is never here), and the one door to it. */
  league: TakenKind[];
  leagueDays: string[];
  leagueHref: string | null;
}

/** "See the permit ›" and the Overview card's door: one permit → that permit with its notice; more → Permits. */
export const permitDoor = (permitsHref: string, permitIds: readonly string[]) =>
  (permitIds.length === 1 ? `${permitsHref}?permit=${permitIds[0]}` : permitsHref);

/**
 * THE CLUB'S COUNT — "Outside the permit · 8" on the Overview and the Permits row (13c Session B, C3 = A), each booking
 * once (`takenOnce`). Null when nothing is outside a permit: the card and the pill show only while it is true.
 */
export interface ClubTaken {
  count: number;
  /** The days those bookings sit on, in order. */
  days: string[];
  /** Their venues, by name, in first-seen order. */
  venues: string[];
  /** The permits that took them: one → the card opens that permit; more → Permits. */
  permitIds: string[];
}
export function clubTaken(taken: ReadonlyMap<string, readonly TakenDay[]>, venueName: ReadonlyMap<string, string>): ClubTaken | null {
  const once = [...takenOnce(taken).values()];
  if (!once.length) return null;
  return {
    count: once.length,
    days: [...new Set(once.map(x => x.day))].sort(),
    venues: [...new Set(once.map(({ booking: b }) => (b.venueId && venueName.get(b.venueId)) || b.venueName || '').filter(Boolean))],
    permitIds: [...new Set(once.flatMap(x => x.permitIds))],
  };
}

/**
 * THE CALENDAR'S DAY MARK (13c Session B, B2): of what the dates off took, the bookings THIS reader's Calendar shows, found
 * the way the Calendar's own permit line is (`calendarKeyOf`: a tournament game is its day's booking, or a club team's
 * mirrored copy), and a shared slot's teams through the slot (they are one Calendar booking under its first team's key);
 * then each of their days with the "See the permit ›" door, null for a reader who cannot open Permits. A called-off booking is never marked. Nothing the
 * reader's Calendar hides is named (Session A review item a: the Calendar shows less than the notice).
 */
export function calendarOutside(
  taken: ReadonlyMap<string, readonly TakenDay[]>,
  shown: readonly Pick<CalendarBooking, 'key' | 'day' | 'state' | 'clubSchedule'>[],
  calendarKeyOf: ReadonlyMap<string, string>,
  permitsHref: string | null,
): NonNullable<CalendarRead['outside']> | null {
  const byKey = new Map<string, string[]>();
  const bySlot = new Map<string, string[]>();
  const add = (m: Map<string, string[]>, k: string, ids: readonly string[]) => m.set(k, [...new Set([...(m.get(k) ?? []), ...ids])]);
  for (const { booking: b, permitIds } of takenOnce(taken).values()) {
    add(byKey, calendarKeyOf.get(b.key) ?? b.key, permitIds);
    if (b.clubSlotOf) add(bySlot, b.clubSlotOf, permitIds);
  }
  const keys: string[] = [];
  const permitsOfDay = new Map<string, string[]>();
  for (const b of shown) {
    if (b.state) continue; // a called-off booking holds no time: never marked (the one place this is said)
    const permits = byKey.get(b.key) ?? (b.clubSchedule ? bySlot.get(b.clubSchedule.slotId) : undefined);
    if (!permits) continue;
    keys.push(b.key);
    add(permitsOfDay, b.day, permits);
  }
  if (!keys.length) return null;
  const days: Record<string, string | null> = {};
  for (const [day, permits] of permitsOfDay) days[day] = permitsHref ? permitDoor(permitsHref, permits) : null;
  return { keys, days };
}

/** What the reader may open, asked once by the server: a Calendar at all, and the club's schedules. */
export interface NoticeGates {
  slug: string;
  seesCalendar: boolean;
  canSchedules: boolean;
}

/**
 * The notice: each booking named the Calendar's way where the reader's Calendar shows it (`shown`, by the pool's key), else
 * by the pool's own words, with no door; then the notice's doors, each only where the reader can go.
 */
export function buildDatesOffNotice(
  days: readonly TakenDay[],
  shown: ReadonlyMap<string, CalendarBooking>,
  gates: NoticeGates,
  venueName: ReadonlyMap<string, string>,
): DatesOffNotice | null {
  if (!days.length) return null;
  // A shared slot ("teams at once") is ONE Calendar booking under its first team's key: the other teams' practices find
  // their schedule through the slot.
  const slotSchedule = new Map<string, NonNullable<CalendarBooking['clubSchedule']>>();
  for (const b of shown.values()) if (b.clubSchedule) slotSchedule.set(b.clubSchedule.slotId, b.clubSchedule);

  const schedules = new Map<string, { name: string; n: number }>();
  const seasons = new Map<string, { name: string; href: string }>();
  const groups: TakenGroupView[] = [];
  for (const d of days) {
    const byVenue = new Map<string, ClubBooking[]>();
    for (const b of d.bookings) byVenue.set(b.venueId ?? '', [...(byVenue.get(b.venueId ?? '') ?? []), b]);
    for (const [venueId, list] of byVenue) {
      const venue = venueName.get(venueId) ?? list[0].venueName ?? '';
      groups.push({
        day: d.day,
        heading: [dayWithWeekday(d.day), venue].filter(Boolean).join(' · '),
        rows: list.map(b => {
          const c = shown.get(b.key);
          const cs = c?.clubSchedule ?? (c || b.program !== 'rep' || !b.clubSlotOf ? null : slotSchedule.get(b.clubSlotOf) ?? null);
          if (cs && gates.canSchedules && b.kind === 'practice') {
            const s = schedules.get(cs.scheduleId) ?? { name: cs.scheduleName, n: 0 };
            s.n += 1;
            schedules.set(cs.scheduleId, s);
          }
          if (c && b.program === 'league' && c.door) seasons.set(c.door.href, { name: b.ownerName, href: c.door.href });
          const what = c ? c.what.replace(/\s·\sPractice$/, '').replace(/^Practice$/, '') : '';
          const line = b.program === 'league'
            ? ['House league', what && what !== b.ownerName ? what : null].filter(Boolean).join(' · ')
            : cs?.scheduleName || (what && what !== takenChip(b.kind) ? what : null);
          return {
            key: b.key,
            startMs: b.startMs,
            title: [c?.who ?? b.ownerName, b.facilityName].filter(Boolean).join(' · '),
            line: line || null,
            chip: takenChip(b.kind),
            // A tournament day's door sets the admin's current tournament first: not a plain link, so none here.
            door: c?.door && !c.door.tournamentId ? { label: c.door.label, href: c.door.href } : null,
          };
        }),
      });
    }
  }

  // The Calendar door only where the reader's Calendar shows one of these bookings: a staff member's Calendar holds the
  // tournaments alone, and a door onto a day that shows none of them is the 404's politer face. The first such day.
  const firstShown = gates.seesCalendar ? days.find(d => d.bookings.some(b => shown.has(b.key)))?.day ?? null : null;
  const doors: TakenDoorView[] = [
    ...[...schedules.entries()].map(([id, s]) => ({ label: W.doorFix(s.n, s.name), href: `/${gates.slug}/admin/schedules/${id}`, kind: 'schedule' as const })),
    ...[...seasons.values()].map(s => ({ label: W.doorSeason(s.name), href: s.href, kind: 'season' as const })),
    ...(firstShown ? [{ label: W.doorCalendar(firstShown), href: `/${gates.slug}/admin/calendar?day=${firstShown}`, kind: 'calendar' as const }] : []),
  ];
  return { days: days.map(d => d.day), count: days.reduce((n, d) => n + d.bookings.length, 0), groups, doors };
}
