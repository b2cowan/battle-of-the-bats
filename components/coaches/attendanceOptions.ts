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
