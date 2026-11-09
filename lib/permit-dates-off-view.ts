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
import { PERMIT_WORDS as W, dayWithWeekday, takenChip } from './permit-words.ts';
import type { ClubBooking } from './venue-clash.ts';
import type { CalendarBooking } from './club-calendar-view.ts';

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
export interface TakenDoorView { label: string; href: string }
export interface DatesOffNotice {
  /** The dates off that took something, in order. */
  days: string[];
  count: number;
  groups: TakenGroupView[];
  /** Each only for a reader who can open it — absent, never greyed. */
  doors: TakenDoorView[];
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
    ...[...schedules.entries()].map(([id, s]) => ({ label: W.doorFix(s.n, s.name), href: `/${gates.slug}/admin/schedules/${id}` })),
    ...[...seasons.values()].map(s => ({ label: W.doorSeason(s.name), href: s.href })),
    ...(firstShown ? [{ label: W.doorCalendar(firstShown), href: `/${gates.slug}/admin/calendar?day=${firstShown}` }] : []),
  ];
  return { days: days.map(d => d.day), count: days.reduce((n, d) => n + d.bookings.length, 0), groups, doors };
}
