'use client';
/**
 * THE YEAR PILL (Club Tier Stage 3b — C10's planning half; hub specimen 1, "Next year, one pick away").
 *
 * The scope pill that leads the toolbar on Budget, Budget vs. Actual and the Overview — the same pill on
 * all three, and the three REMEMBER ONE CHOICE PER VISIT (the hub's own words): pick 2025–26 on the Budget and
 * Budget vs. Actual opens on 2025–26 too, until the tab is closed. It lists every year with a plan, every
 * closed year, this year, and ALWAYS the next year, so a plan can be started before its year — never an empty
 * year two ahead. The server decides the list (`fiscalYearOptions`); this only draws it.
 *
 * ⚖ Stage 3c: a year is the club's FISCAL year (Ask 9 — "Fiscal year", the club side's word). Each option is
 * the year's NAME ("2025–26"); its value is the year's KEY, its first day — a key survives a rename and is never
 * the name. ⚠ Session 2 draws the closed year's lock and the current year's dot (two glyphs, never words).
 * ⚠ The remembered year lives in sessionStorage — a per-visit convenience, never state that must persist:
 * it can come back empty (a private window, cleared site data) and the tab then opens on the server's year. A
 * key remembered from before 3c (a bare year) still lands: the server reads a number as the year with that name.
 */
import { useCallback, useState } from 'react';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import { FISCAL_YEAR_WORD, type FiscalYearOption } from '@/lib/club-fiscal-year';

const storageKey = (slug: string) => `club-money-year:${slug}`;

function readRemembered(slug: string): string | null {
  if (typeof window === 'undefined' || !slug) return null;
  try {
    const v = window.sessionStorage.getItem(storageKey(slug)) ?? '';
    return /^\d{4}(-\d{2}-\d{2})?$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** The fiscal year (its key) Budget, Budget vs. Actual and the Overview read — null until someone picks one this
 *  visit (the server then reads the fiscal year today falls in). */
export function useClubYear(slug: string): [string | null, (yearKey: string) => void] {
  const [year, setYear] = useState<string | null>(() => readRemembered(slug));
  const pick = useCallback((next: string) => {
    setYear(next);
    try { window.sessionStorage.setItem(storageKey(slug), next); } catch { /* a per-visit nicety only */ }
  }, [slug]);
  return [year, pick];
}

export default function YearPill({ year, years, onChange }: {
  /** The KEY of the year on screen. */
  year: string;
  /** Any order: the pill lists them oldest first. */
  years: readonly Pick<FiscalYearOption, 'key' | 'name'>[];
  onChange: (yearKey: string) => void;
}) {
  return (
    <SingleSelectDropdown
      label={FISCAL_YEAR_WORD}
      lead
      value={year}
      options={[...years].sort((a, b) => a.key.localeCompare(b.key)).map(y => ({ id: y.key, label: y.name }))}
      onChange={next => onChange(next)}
    />
  );
}
