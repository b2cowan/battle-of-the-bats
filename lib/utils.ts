import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { CloneCopiedCounts } from '@/lib/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatPoolName(name: string): string {
  const bare = name
    .replace(/^Pool\s+/i, '')
    .replace(/\s+Pool$/i, '')
    .trim();
  return `${bare} Pool`;
}

/** Split a trailing parenthetical qualifier off a team name —
 *  "Halton Hawks U11 Jr (Johnstone)" → { base: "Halton Hawks U11 Jr", qualifier: "Johnstone" }.
 *  Organizers commonly bake a coach/color disambiguator into the name itself; fan surfaces
 *  render it as a quiet second line instead of letting it wrap at full name weight (D3).
 *  Only a qualifier at the very END splits, and only when a non-empty base remains — a name
 *  that IS a parenthetical, or has one mid-name, passes through unchanged. */
export function splitTeamQualifier(name: string): { base: string; qualifier: string | null } {
  const m = name.match(/^(.*\S)\s*\(([^()]+)\)\s*$/);
  return m ? { base: m[1], qualifier: m[2].trim() || null } : { base: name, qualifier: null };
}

export function copiedSummary(copied?: CloneCopiedCounts | null): string[] {
  if (!copied) return ['Setup copied with safe defaults.'];
  const rows = [
    copied.divisions ? `${copied.divisions} division${copied.divisions === 1 ? '' : 's'}` : '',
    copied.pools ? `${copied.pools} pool${copied.pools === 1 ? '' : 's'}` : '',
    copied.slots ? `${copied.slots} empty schedule slot${copied.slots === 1 ? '' : 's'}` : '',
    copied.venues ? `${copied.venues} venue${copied.venues === 1 ? '' : 's'}` : '',
    copied.registrationFields ? `${copied.registrationFields} registration question${copied.registrationFields === 1 ? '' : 's'}` : '',
    copied.rules ? `${copied.rules} rule section${copied.rules === 1 ? '' : 's'}` : '',
    copied.resources ? `${copied.resources} resource${copied.resources === 1 ? '' : 's'}` : '',
    copied.welcome ? 'Welcome content' : '',
  ].filter(Boolean) as string[];
  return rows.length ? rows : ['Draft created with safe tournament defaults.'];
}

/**
 * THE CLOCK, SPELLED ONE WAY — "6:00 p.m.", lowercase, with periods.
 *
 * ⚠⚠ THIS IS THE ONLY PLACE THE PRODUCT BUILDS A CLOCK LABEL BY HAND, and it has to stay that
 * way. There were SEVEN copies of this arithmetic — here, the schedule importer, the tournament
 * dashboard, the archive page, the timeline, the coach team hub and the coach schedule — and
 * because each built its own string, the product ended up telling the time two different ways:
 * these said "8:00 PM" while every screen that went through the platform's own formatter said
 * "8:00 p.m." A family could read both spellings in one sitting.
 *
 * The spelling is settled (owner + /marketing, 2026-08-26): lowercase with periods, everywhere a
 * customer reads a time, no exception for dense tables. It is the same house-language decision
 * that keeps `colour` and `cheque` — and it is what `en-CA` returns natively, so every screen
 * that formats through the platform was already correct and needed no change at all.
 *
 * `npm run check:spelling` now fails on an uppercase token after a time, so this cannot drift
 * back. If you need a clock label, call this — do not write the ternary again.
 */
const PERIOD = (hour24: number): string => (hour24 >= 12 ? 'p.m.' : 'a.m.');
const TO_12 = (hour24: number): number => hour24 % 12 || 12;

/**
 * End a sentence without doubling the full stop.
 *
 * ⚠ A FORMATTED TIME ENDS IN A PERIOD, so any copy that appends punctuation straight after one
 * reads "6:00 p.m.." — invisible in every other string and only visible where a time lands last.
 * It is NOT only a consequence of the 2026-08-26 spelling ruling: the platform's own formatter
 * has always returned "p.m.", so a family whose game had no location recorded had been reading
 * "…is now Sat, Aug 29, 6:00 p.m.." in their notifications for as long as that message existed.
 *
 * Lives here, beside the clock, because this is where times acquire their period.
 */
export const endSentence = (s: string): string => (/[.!?]$/.test(s.trimEnd()) ? s.trimEnd() : `${s.trimEnd()}.`);

/** "6 p.m." — an hour on its own, for axis ticks and hour rulers. */
export function formatHour(hour24: number): string {
  return `${TO_12(hour24)} ${PERIOD(hour24)}`;
}

/** "6:00 p.m." from "18:00", "18:00:00", or an already-formatted label. */
export function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  /* An already-formatted label is NORMALISED, not passed through: a value stored as "6:00 PM"
   * would otherwise carry the retired spelling straight back onto the page. */
  const already = /^(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]\.?$/.exec(timeStr.trim());
  if (already) {
    const pm = already[3].toLowerCase() === 'p';
    return `${Number(already[1]) % 12 || 12}:${already[2]} ${pm ? 'p.m.' : 'a.m.'}`;
  }

  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  if (Number.isNaN(h)) return timeStr;
  const m = parts[1] || '00';
  return `${TO_12(h)}:${m} ${PERIOD(h)}`;
}

/** "Today" / "Tomorrow" / short date (e.g. "Jul 16"), relative to a given
 *  YYYY-MM-DD reference date — the "next game" day label used across the
 *  fan-facing followed-team surfaces. */
export function relativeDayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  const tomorrow = new Date(`${today}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date === tomorrow.toISOString().slice(0, 10)) return 'Tomorrow';
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}
