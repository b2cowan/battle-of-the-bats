import type React from 'react';
import { CheckCircle2, CircleHelp, CircleSlash, Clock3 } from 'lucide-react';
import { ATTENDANCE_WORD } from '@/lib/coach-schedule-vocab';
import type { RepAttendanceStatus } from '@/lib/types';

/**
 * The attendance control's option set — value + word + icon + order — shared VERBATIM by every
 * surface that renders it (the schedule tab's RSVP rows, the Game-Day console's Who's here
 * sheet). The four words already live in `lib/coach-schedule-vocab.ts` (`ATTENDANCE_WORD`,
 * kept React-free for `node --test`); this file pairs them with their icons ONCE, because two
 * hand-kept copies of the same four rows is how one screen's checkmark quietly stops matching
 * the other's. The order is presentation order: the answers a coach actually taps first.
 *
 * ⚠ Maybe is NOT in this set (One attendance record, call C3): it is offered only where families can answer, before the start,
 * and that surface adds it. A row whose status IS Maybe (a family's) still has to render on every surface that reads this list:
 * look it up through `attendanceOption`, never by indexing a map built from this array.
 */
export const ATTENDANCE_OPTIONS: {
  value: RepAttendanceStatus;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: 'attending', label: ATTENDANCE_WORD.attending, icon: CheckCircle2 },
  { value: 'late', label: ATTENDANCE_WORD.late, icon: Clock3 },
  { value: 'absent', label: ATTENDANCE_WORD.absent, icon: CircleSlash },
  { value: 'unknown', label: ATTENDANCE_WORD.unknown, icon: CircleHelp },
];

/** Maybe's row: the word, and the Not marked icon (a Maybe counts as Not marked, ruling 2). */
export const MAYBE_OPTION = { value: 'maybe' as RepAttendanceStatus, label: ATTENDANCE_WORD.maybe, icon: CircleHelp };

/** Every status's word and icon, Maybe included, for rendering a row's current answer. */
export function attendanceOption(status: RepAttendanceStatus): (typeof ATTENDANCE_OPTIONS)[number] {
  return status === 'maybe' ? MAYBE_OPTION : (ATTENDANCE_OPTIONS.find(o => o.value === status) ?? ATTENDANCE_OPTIONS[3]);
}
