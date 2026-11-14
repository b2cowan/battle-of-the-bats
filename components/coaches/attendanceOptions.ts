import type React from 'react';
import { CheckCircle2, CircleDashed, CircleHelp, CircleSlash, Clock3 } from 'lucide-react';
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
 * and that surface adds it (`attendanceChoices`). A row whose status IS Maybe still has to render on every surface that reads this
 * list: look it up through `attendanceOption`, never by indexing a map built from this array.
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

/** Maybe's row: its own word and a dashed circle (undecided — it counts as Not marked in every stat, ruling 2, but it is an answer,
 *  and a coach must be able to tell it from a player nobody has answered for). Every surface styles `data-status="maybe"`. */
export const MAYBE_OPTION = { value: 'maybe' as RepAttendanceStatus, label: ATTENDANCE_WORD.maybe, icon: CircleDashed };

/** The choices a coach is offered for one player: the four, plus Maybe where families can answer before the start (call C3), or
 *  when Maybe is the player's answer now (shown, so the current answer is ticked; `maybeDisabled` says it can't be picked again). */
export function attendanceChoices(status: RepAttendanceStatus, maybeOffered: boolean): { options: (typeof ATTENDANCE_OPTIONS)[number][]; maybeDisabled: boolean } {
  if (!maybeOffered && status !== 'maybe') return { options: ATTENDANCE_OPTIONS, maybeDisabled: false };
  const [attending, late, absent, unknown] = ATTENDANCE_OPTIONS;
  return { options: [attending, late, MAYBE_OPTION, absent, unknown], maybeDisabled: !maybeOffered };
}

/** Every status's word and icon, Maybe included, for rendering a row's current answer. */
export function attendanceOption(status: RepAttendanceStatus): (typeof ATTENDANCE_OPTIONS)[number] {
  return status === 'maybe' ? MAYBE_OPTION : (ATTENDANCE_OPTIONS.find(o => o.value === status) ?? ATTENDANCE_OPTIONS[3]);
}
