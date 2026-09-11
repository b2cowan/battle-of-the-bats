/**
 * A player's readings for ONE test, made honest before anything draws them (development lifecycle
 * Phase 0, F01).
 *
 * ⚠ Every reading carries its OWN unit — the type's unit is snapshotted onto the row at log time,
 * so a later unit edit on the test never rewrites history. The trend line used to ignore that and
 * plot the numbers alone: change "Throw speed" from mph to km/h and 50 → 80 became one rising
 * line. No conversion is performed anywhere (none would be honest — the method may have changed
 * with the unit), so the only truthful drawing is a series that BREAKS wherever the unit changes.
 *
 * Pure module: the profile row, the Insights chart (Phase 3) and the handout all read through it.
 */

export interface SeriesReading {
  value: number;
  unit: string;
  /** YYYY-MM-DD, the coach's stated date. */
  recordedOn: string;
  /** Tie-break for same-day readings — the order they were typed. */
  createdAt: string;
}

export interface UnitSegment<R extends SeriesReading = SeriesReading> {
  /** The unit as the coach wrote it on the first reading of the segment. */
  unit: string;
  /** Oldest → newest. */
  readings: R[];
}

/** "seconds", "Seconds " and "SECONDS" are one unit; "s" and "seconds" are not — no guessing. */
export const sameUnit = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Oldest → newest, split at EVERY change of unit — not grouped by unit. A test that went mph →
 * km/h → mph has three segments: joining the two mph runs across the km/h gap would draw a line
 * through readings that were never comparable with what sits between them.
 */
export function splitSeriesByUnit<R extends SeriesReading>(readings: R[]): UnitSegment<R>[] {
  const chrono = [...readings].sort((a, b) =>
    a.recordedOn.localeCompare(b.recordedOn) || a.createdAt.localeCompare(b.createdAt));
  const segments: UnitSegment<R>[] = [];
  for (const r of chrono) {
    const last = segments[segments.length - 1];
    if (last && sameUnit(last.unit, r.unit)) last.readings.push(r);
    else segments.push({ unit: r.unit, readings: [r] });
  }
  return segments;
}

/** The segment a line may be drawn from: the CURRENT one, which the latest reading belongs to. */
export function drawableSegment<R extends SeriesReading>(segments: UnitSegment<R>[]): UnitSegment<R> | null {
  return segments.length > 0 ? segments[segments.length - 1] : null;
}

/**
 * The sentence beneath a row whose earlier readings are not drawn. Null when there is nothing to
 * say. Names the count and the unit(s) so the coach knows what the list holds that the line does
 * not — "listed, not drawn" is the whole promise.
 */
export function unitSplitNote(segments: UnitSegment[]): string | null {
  if (segments.length < 2) return null;
  const earlier = segments.slice(0, -1);
  const count = earlier.reduce((n, s) => n + s.readings.length, 0);
  const units = [...new Set(earlier.map(s => s.unit.trim()))];
  const inUnits = units.length === 1 ? `in ${units[0]}` : `in ${units.join(' and ')}`;
  return `Units changed — ${count} earlier reading${count === 1 ? '' : 's'} ${inUnits} ${count === 1 ? 'is' : 'are'} listed but not drawn on this line.`;
}
