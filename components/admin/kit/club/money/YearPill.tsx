'use client';
/**
 * THE YEAR PILL (Club Tier Stage 3b — C10's planning half; hub specimen 1, "Next year, one pick away").
 *
 * The scope pill that leads the toolbar on Budget, Budget vs. Actual and the Overview — the same pill on
 * all three, and the three REMEMBER ONE CHOICE PER VISIT (the hub's own words): pick 2025 on the Budget and
 * Budget vs. Actual opens on 2025 too, until the tab is closed. It lists every year with a plan, this year
 * marked, and ALWAYS the next year ("plan ahead"), so a plan can be started before its year — never an
 * empty year two ahead. The server decides the list (`planYears`); this only draws it.
 *
 * ⚠ 3c gives the year its name ("2026–27") and its first month; the pill keeps its place and will show the
 * name. Until then a year is the calendar year.
 * ⚠ The remembered year lives in sessionStorage — a per-visit convenience, never state that must persist:
 * it can come back empty (a private window, cleared site data) and the tab then opens on the server's year.
 */
import { useCallback, useState } from 'react';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import { yearPillDetail } from '@/lib/club-money-words';

const storageKey = (slug: string) => `club-money-year:${slug}`;

function readRemembered(slug: string): number | null {
  if (typeof window === 'undefined' || !slug) return null;
  try {
    const v = Number(window.sessionStorage.getItem(storageKey(slug)));
    return Number.isInteger(v) && v >= 2020 && v <= 2099 ? v : null;
  } catch {
    return null;
  }
}

/** The year Budget, Budget vs. Actual and the Overview read — null until someone picks one this visit
 *  (the server then reads the club year today falls in). */
export function useClubYear(slug: string): [number | null, (year: number) => void] {
  const [year, setYear] = useState<number | null>(() => readRemembered(slug));
  const pick = useCallback((next: number) => {
    setYear(next);
    try { window.sessionStorage.setItem(storageKey(slug), String(next)); } catch { /* a per-visit nicety only */ }
  }, [slug]);
  return [year, pick];
}

export default function YearPill({ year, years, yearLines, thisYear, onChange }: {
  year: number;
  /** Any order: the pill lists them oldest first. */
  years: readonly number[];
  /** The plan's line count per year — Budget, Budget vs. Actual and the Overview. Absent, a year says only
   *  whether it is this year (the payee report: plan lines mean nothing there). */
  yearLines?: Readonly<Record<number, number>>;
  thisYear: number;
  onChange: (year: number) => void;
}) {
  return (
    <SingleSelectDropdown
      label="Year"
      lead
      value={String(year)}
      options={[...years].sort((a, b) => a - b).map(y => ({
        id: String(y),
        label: String(y),
        detail: yearLines ? yearPillDetail(y, thisYear, yearLines[y] ?? 0) : (y === thisYear ? 'this year' : undefined),
      }))}
      onChange={next => onChange(Number(next))}
    />
  );
}
