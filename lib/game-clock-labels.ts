import { formatShortWeekdayDate } from './timezone';
import { formatTime } from './utils';

/**
 * A tournament game's day and time, read on THE BOOKING'S OWN CLOCK (Club Tier Stage 7d, Ask 11, T7).
 *
 * `games.game_date` / `games.game_time` are the wall-clock day and time the organizer typed for the
 * venue — they carry no zone. So the label is built from the strings themselves, never by handing
 * them to a device `Date` (which read them in the viewer's zone and spelled them in the viewer's
 * locale: the coach record's "client twins" did both). A 6:00 p.m. game reads "6:00 p.m." wherever
 * the phone is. Shared by the server record, the live schedule's poll and the free Overview's tile,
 * so the three cannot drift — and client-safe, which is why the twins existed at all.
 */

/** "Sat, Oct 17"; 'TBD' when unscheduled. */
export function formatGameDateLabel(gameDate: string | null | undefined): string {
  return gameDate ? formatShortWeekdayDate(gameDate) : 'TBD';
}

/** "6:00 p.m." (the house clock, `formatTime`); null when no time is set. */
export function formatGameTimeLabel(gameTime: string | null | undefined): string | null {
  return gameTime ? formatTime(gameTime) : null;
}

/** "vs" at home, "at" away — the one spelling for rows, the change notice and the calendar file (T9). */
export function homeAwayWord(isHome: boolean): 'vs' | 'at' {
  return isHome ? 'vs' : 'at';
}
