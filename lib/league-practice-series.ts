/**
 * league-practice-series.ts — the dates a house-league practice series books, ONE generator for the practice POST
 * and the window's live clash check (Club Tier Stage 6a): the line under the field names exactly the dates the
 * save will write. Moved out of the practices route unchanged (2026-10-08).
 */
import { zonedWallClockToUtc } from './timezone';
import { resolveEndInstant } from './league-schedule-conflict';

export function generateOccurrences(
  startDate: string,
  endDate: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
): { date: string; scheduledAt: string; endsAt: string }[] {
  const result: { date: string; scheduledAt: string; endsAt: string }[] = [];
  const end = new Date(endDate + 'T23:59:59');
  const current = new Date(startDate + 'T00:00:00');
  const daysUntil = (dayOfWeek - current.getDay() + 7) % 7;
  current.setDate(current.getDate() + daysUntil);

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    // J3-047: convert each occurrence's wall-clock (org zone, America/Toronto V1) to a
    // correct UTC instant before it lands in timestamptz — naive strings were previously
    // interpreted in the DB session zone (UTC on prod), shifting every practice 4–5h.
    const scheduledAt = zonedWallClockToUtc(dateStr, startTime) ?? `${dateStr}T${startTime}:00`;
    result.push({
      date: dateStr,
      scheduledAt,
      // Overnight-aware: an end at/before the start rolls to the next day (see resolveEndInstant).
      endsAt: resolveEndInstant(scheduledAt, dateStr, endTime) ?? `${dateStr}T${endTime}:00`,
    });
    current.setDate(current.getDate() + 7);
  }
  return result;
}
