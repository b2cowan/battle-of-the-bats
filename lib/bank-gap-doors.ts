/**
 * THE BANK CHECK'S FEE AND INTEREST DOORS, AND ITS REPEAT LINE — both portals (Bank check novice UX S3; plan
 * BANK_CHECK_NOVICE_UX_PLAN.md §2 S3, A5 and A7; drawing BANK_CHECK_NOVICE_UX_S3_DRAWINGS.html tabs 1, 2, 4, 5).
 * Pure rules, client-safe; nothing here reads or writes money.
 *
 * ⚖ A FEE OR INTEREST DOOR SHOWS ONLY WHEN NOTHING EXPLAINS THE GAP (ruling 5: the `off && !current` case — a callout
 *   that names a line, half a line, a combination or a line at the start keeps exactly its own buttons) AND THE GAP IS
 *   $100.00 OR LESS (ruling 4, both directions). The bank holding less is a fee; holding more is interest. There is no
 *   deposit door (ruling 3): a deposit the books lack belongs on a real income word, so the person picks it.
 * ⚖ THE WORD IS THE PLATFORM'S, found by its category and item NAMES among the platform rows only (`orgId` and `teamId`
 *   both null): the ids differ between databases, and "Interest" / "Other income" exist in more than one place. A team
 *   or club that can't see the word (removed, hidden, another sport) gets the description and no word — never one
 *   invented here.
 * ⚖ THE REPEAT LINE (A7) compares SIGNED gaps: a $4.50 fee and a $4.50 deposit never match. Against the newest saved
 *   check dated BEFORE the form's date (one on the same date is replaced by saving), never the starting statement.
 */
import type { CheckFigure } from './bank-check';
import { BANK_WORDS as W } from './bank-tab-words';

/** Ruling 4: a door for a gap of $100.00 or less. */
export const GAP_DOOR_MAX_CENTS = 10_000;

export type GapDoor = 'fee' | 'interest';

/** Which door, if any, beside the gap door: only off, only with nothing to name, only at $100.00 or less. */
export function gapDoorFor(i: { off: boolean; named: boolean; band: Pick<CheckFigure, 'offByCents' | 'direction'> }): GapDoor | null {
  if (!i.off || i.named || i.band.offByCents > GAP_DOOR_MAX_CENTS || i.band.direction === null) return null;
  return i.band.direction === 'bank_less' ? 'fee' : 'interest';
}

/** A platform word by its names (ruling 1 for the coach, ruling 2 and mig 457 for the club). */
export interface PlatformWordRef { category: string; item: string; direction: 'in' | 'out' }

/** Coach: `League & Fees › Bank & payment fees` (out) and `Other Income › Interest` (in), the platform library's. Club:
 *  `Admin › Bank & payment fees` (mig 457) and the same `Other Income › Interest` (offered to clubs by mig 457). */
export const GAP_DOOR_WORDS: Record<'coach' | 'club', Record<GapDoor, PlatformWordRef>> = {
  coach: {
    fee: { category: 'League & Fees', item: 'Bank & payment fees', direction: 'out' },
    interest: { category: 'Other Income', item: 'Interest', direction: 'in' },
  },
  club: {
    fee: { category: 'Admin', item: 'Bank & payment fees', direction: 'out' },
    interest: { category: 'Other Income', item: 'Interest', direction: 'in' },
  },
};

/** What a door's window opens filled with beside the gap and the date: the description and the word to find. The same
 *  for both portals; only the word differs. */
export const doorFill = (portal: 'coach' | 'club', door: GapDoor) => ({
  description: door === 'fee' ? W.feeDescription : W.interestDescription,
  word: GAP_DOOR_WORDS[portal][door],
});

/** The banking-app line in the door's window, its pinned footer above Save (D3). */
export const doorFootLine = (door: GapDoor) => (door === 'fee' ? W.bankAppCheckFee : W.bankAppCheckInterest);

type WordCategory<I> = { id: string; name: string; orgId: string | null; teamId?: string | null; items: readonly I[] };
type WordItem = { id: string; name: string; orgId: string | null; teamId?: string | null; direction: 'in' | 'out' };

/** The platform word in a list the person can see, or null (then the window opens with the description only). */
export function findPlatformWord<I extends WordItem, C extends WordCategory<I>>(categories: readonly C[], ref: PlatformWordRef):
  { category: C; item: I } | null {
  for (const category of categories) {
    if (category.orgId !== null || (category.teamId ?? null) !== null || category.name !== ref.category) continue;
    const item = category.items.find(i => i.orgId === null && (i.teamId ?? null) === null && i.name === ref.item
      && i.direction === ref.direction);
    if (item) return { category, item };
  }
  return null;
}

/** A7: the date of the newest saved check before `date` whose signed gap is today's, or null. */
export function sameGapAs(checks: readonly { kind: 'start' | 'check'; date: string; figure: { differenceCents: number } }[],
  date: string, differenceCents: number): string | null {
  if (differenceCents === 0) return null;
  let last: (typeof checks)[number] | null = null;
  for (const c of checks) if (c.kind === 'check' && c.date < date && (!last || c.date > last.date)) last = c;
  return last && last.figure.differenceCents === differenceCents ? last.date : null;
}
