import type { SettlementSheetRow } from './season-settlement';

/**
 * The two facts the "close / start next season" warning names, as COUNTS OF FAMILIES:
 * families who still owe dues, and families with money waiting to go back to them.
 *
 * ⚠ IT WARNS; IT NEVER DECIDES (owner ruling 2026-08-18, binding for the club too, Club Tier
 * Stage 2 Ask 1). Nothing here can refuse a close or a roll.
 *
 * ⚠ One family is one family: siblings share a `familyKey`, so a household with two players who
 * both owe is counted once — the same grouping the settlement sheet itself uses. The portal's
 * dialog and the club's window both count through here, so "3 families still owe dues" cannot
 * mean one thing on the coach's screen and another on the club's.
 *
 * The thresholds are the settlement sheet's own half-cent tolerance.
 */
export function unsettledFamilyCounts(
  rows: readonly Pick<SettlementSheetRow, 'leftToSend' | 'refund' | 'familyKey'>[],
): { familiesOwing: number; familiesWaitingToReturn: number } {
  const owing = new Set<string>();
  const waiting = new Set<string>();
  for (const r of rows) {
    if (r.leftToSend > 0.005) owing.add(r.familyKey);
    if (r.refund > 0.005) waiting.add(r.familyKey);
  }
  return { familiesOwing: owing.size, familiesWaitingToReturn: waiting.size };
}
