/**
 * THE BANK SCREENS' LOOK-FREE PARTS, shared by the club's Bank tab and the coach's Ledger → View: Bank (Bank balance check
 * BC7a; owner 2026-11-06, plan §0 "Coach sharing": only look-free pieces are shared, each portal draws its own screen).
 * Formatting and the band's three tiles from a figure the ENGINE already worked out (`figureCheck` / `figureOfSaved`,
 * lib/bank-check.ts): nothing here adds, subtracts or compares money (rule 6). No JSX, no kit, no route. Client-safe.
 * ⚠ D1: this file is reached from the club's screens, so it never imports `bank-coach-*`
 *   (tests/unit/bank-coach-routes-guard.test.ts §3 walks every import chain from the club's files).
 */
import type { MoneyTile } from '@/components/coaches/MoneySummaryBand';
import { fmt } from './coach-money-summary';
import { formatStoredDate } from './timezone';
import { BANK_WORDS as W } from './bank-tab-words';
import type { CheckFigure } from './bank-check';

/** "$1,284.50" from integer cents. Null → blank. */
export const cents = (c: number | null | undefined): string => (c == null ? '' : fmt(c / 100));
/** "75.00": integer cents as an amount FIELD holds it (the add window "Add the missing line" fills, BC3b). */
export const fieldAmount = (c: number): string => (c / 100).toFixed(2);
/** "+ $75.00" / "− $412.00": a signed amount (the engine's `savedTerms`, `waitingOnCheck`, `onItsWayOnCheck`), the way it moved the total. */
export const moved = (signedCents: number): string =>
  signedCents === 0 ? cents(0) : `${signedCents < 0 ? '−' : '+'} ${cents(Math.abs(signedCents))}`;
/** "Oct 31, 2026" — a statement's day always carries its year (a statement may straddle one). */
export const dayYear = (d: string | null | undefined): string => formatStoredDate(d);
/** "Oct 31" — a line's day in a list, no year. */
export const dayShort = (d: string | null | undefined): string => formatStoredDate(d, { withYear: false });
/** A line's name as every bank screen says it: its words, else "A line". */
export const nameOf = (l: { label?: string | null }): string => l.label?.trim() || W.lineUnnamed;

/** An account's latest check (ask 4), as both portals read it. */
export type ThroughMark = { date: string; result: 'matches' | 'off'; offByCents: number } | null;
/** Ask 4: "Checked through {date} · Matches" / "… · Off by $X" — an account's latest check, the sub-line under its name
 *  in the Account pill. */
export const throughWords = (t: ThroughMark): string =>
  t ? W.throughResult(dayYear(t.date), t.result === 'matches' ? W.matches : W.offBy(cents(t.offByCents))) : W.notCheckedLine;

/**
 * The joined band's three tiles (drawing tab 2; the shipped band, house rule): The bank says · Should be in the bank ·
 * Difference. `figure` is null until there is a day's books; `typed` false until a balance is typed. `saved`: a saved
 * check's own band, opened (tab 5): The bank said · Should have been · Result, past tense, the direction its only caption.
 * ⚖ "Matches" good-green, "Off by" AMBER, never red; a direction is said in words, never a minus sign.
 * `isPhone`: the middle tile takes the phone's shorter word (the shipped band is two-up ≤760), and the shipped band shows
 * `captionShort` in place of the caption (BC4b `/marketing`).
 * `coach`: the coach's card names the figure by its screen, "your Ledger" (Bank check novice UX S1, row 8); the club's
 * keeps "your books".
 * `shouldCaption`: the club's middle caption, built by its caller (S1b row 9 names the day checking started; a team has
 * no start, so the coach's is built here).
 */
export function bankBandTiles({ date, figure, typed, saved = false, isPhone, coach = false, shouldCaption }: {
  date: string; figure: CheckFigure | null; typed: boolean; saved?: boolean; isPhone: boolean; coach?: boolean; shouldCaption?: string;
}): { tiles: MoneyTile[]; ariaLabel: string } {
  const when = dayYear(date);
  const settled = figure !== null && typed;
  const more = coach ? W.coachBandBankMore : W.bandBankMore;
  const less = coach ? W.coachBandBankLess : W.bandBankLess;
  const direction = !settled || figure.direction === null ? null
    : figure.direction === 'bank_more' ? more(cents(figure.offByCents)) : less(cents(figure.offByCents));
  const diff: MoneyTile = {
    key: 'difference', label: saved ? W.savedResult : W.bandDifference,
    figure: !settled ? '—' : figure.result === 'matches' ? W.matches : W.offBy(cents(figure.offByCents)),
    tone: !settled ? 'plain' : figure.result === 'matches' ? 'good' : 'warn',
    caption: saved ? direction ?? undefined : !settled ? W.bandNoBalance : direction ?? (coach ? W.coachBandMatches : W.bandMatches)(when),
  };
  return {
    ariaLabel: saved ? W.savedTitle(when) : W.checkTitle,
    tiles: [
      { key: 'bank', label: saved ? W.savedBank : W.bandBank, figure: settled ? cents(figure.bankCents) : '—',
        caption: saved ? undefined : W.bandBankCaption(when), captionShort: saved ? undefined : W.bandBankCaptionPhone(dayShort(date)) },
      { key: 'should', label: saved ? W.savedShould : isPhone ? W.bandShouldPhone : W.bandShould, figure: figure ? cents(figure.shouldBeCents) : '—',
        caption: saved ? undefined : coach ? W.coachBandShouldCaption(when) : shouldCaption,
        captionShort: saved ? undefined : coach ? W.coachBandShouldCaptionPhone : W.bandShouldCaptionPhone },
      diff,
    ],
  };
}
