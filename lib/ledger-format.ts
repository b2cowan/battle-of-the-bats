/**
 * THE LEDGER'S DATES — ONE RULE, BOTH PORTALS (Ledger Parity D1 + D2, owner 2026-10-02).
 *
 * A ledger row prints the DAY ("Oct 1"); the year is said once, on the balance lines ("Starting
 * balance · Sep 1, 2026"), the way a bank statement states its period at the top and bottom. A
 * window that crosses New Year still reads in order: the rows run oldest first between two dated
 * lines. The coach's Ledger printed the year on every row and the club's printed none on its balance
 * lines — neither chosen against the other. Both registers format through THIS module
 * (`ledger-parity-screens-guard.test.ts` holds them to it).
 *
 * ⚠ `formatStoredDate`, never a hand-roll: the coach's column mixes bare dates with paid stamps held
 * at org noon, and both hand-rolls have printed the wrong day already. Pure and client-safe.
 */
import { formatStoredDate } from './timezone';

/** A ledger row's date: the day, no year — "Oct 1". */
export const ledgerRowDate = (d: string | null | undefined): string => formatStoredDate(d, { withYear: false });

/**
 * THE LEDGER'S KEYWORD SEARCH — ONE RULE, BOTH PORTALS (owner 2026-11-24). What the box finds is what the row prints:
 * its What line (name and grey detail), Category and Item. Every typed word must be found (case ignored), in any of
 * the fields. `ledgerSearchWords` splits what was typed; no words means no narrowing.
 */
export const ledgerSearchWords = (typed: string): string[] => typed.toLowerCase().split(/\s+/).filter(Boolean);

/** True when every word is found somewhere in the row's fields. An empty word list matches every row. */
export const ledgerRowMatches = (words: readonly string[], ...fields: (string | null | undefined)[]): boolean => {
  if (words.length === 0) return true;
  const hay = fields.filter(Boolean).join(' ').toLowerCase();
  return words.every(w => hay.includes(w));
};

/** A balance line, named with its full date — "Starting balance · Sep 1, 2026". No date → the word alone. */
export const ledgerBalanceLabel = (word: string, d: string | null | undefined): string =>
  d ? `${word} · ${formatStoredDate(d)}` : word;
