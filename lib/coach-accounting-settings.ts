import { normalizeCreditApplicationMode, type CreditApplicationMode } from './dues-credits';

/**
 * The ONE write path for a team's two season-wide dues settings.
 *
 * ⚠ This exists because the two settings are now edited from two screens — Team settings → Money
 * (the home) and Player Dues' setup block (the moment before any dues exist) — and the two hand-
 * rolled PATCH calls had already drifted the way duplicated logic always does: one carried a
 * revert guard earned in a review, the other surfaced save errors, and neither had both. A fix
 * applied to one had no way of reaching the other, because there was no shared code to carry it.
 *
 * Deliberately NOT in lib/dues-credits.ts: that module is pure arithmetic and touches no network.
 * Deliberately NOT a hook either — the two callers legitimately differ in what a save MEANS to
 * them (changing the credit mode re-figures every "to send" figure on the dues table, so that
 * screen reloads afterwards; the settings page has nothing on screen to reload). They share the
 * request, not the consequence.
 */
export type AccountingSettingPatch =
  | { autoRemindersEnabled: boolean }
  | { creditApplication: CreditApplicationMode }
  /** The team's standard share of what a player raises or brings in (mig 237). Unlike the two
   *  above it changes nothing that already exists — it only pre-fills the next form. */
  | { defaultPlayerCreditPercent: number }
  /**
   * What the team was already holding when this season started (mig 262).
   *
   * ⚠ THE ONLY ONE OF THE FOUR THAT MOVES A FIGURE ON ANOTHER SCREEN — Cash on hand, the register's
   * first line and every running balance on Budget vs. Actual all start from it. `null` CLEARS it,
   * which is not the same as setting zero: a season that carried nothing shows no opening line.
   */
  | { openingBalance: number | null };

/**
 * Ask the server what these two settings ACTUALLY are.
 *
 * ⚠ This is the recovery path for a failed save, and it exists because reverting to a captured
 * `previous` value is not sound under overlapping writes. Trace two rapid toggles that BOTH fail,
 * starting from a server value of ON: save A (going OFF) captures previous=ON; save B (going back
 * ON) captures previous=OFF from A's optimistic state. A's failure defers to B, correctly. Then
 * B's failure reverts to ITS previous — OFF — and the switch now reads "Disabled" while the
 * server still says enabled. For the setting that decides whether families get dunning emails,
 * the coach ends up believing no email will go out while the schedule keeps sending them.
 *
 * The same file already models the cure on the book-sharing switch: re-read the SERVER's answer
 * rather than assuming the pre-toggle value. Targeted rather than a whole-page reload, so a
 * failure in one group never discards a draft the coach is typing in another.
 */
export async function fetchAccountingSettings(
  orgSlug: string,
  teamId: string,
): Promise<{
  autoRemindersEnabled: boolean;
  creditApplication: CreditApplicationMode;
  defaultPlayerCreditPercent: number;
  openingBalance: number | null;
  openingBalanceFrom: string | null;
} | null> {
  try {
    const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/accounting-settings`);
    if (!res.ok) return null;
    const d = await res.json();
    return {
      autoRemindersEnabled: d.autoRemindersEnabled ?? true,
      creditApplication: normalizeCreditApplicationMode(d.creditApplication),
      defaultPlayerCreditPercent: Number(d.defaultPlayerCreditPercent ?? 0),
      /* ⚠ NO `?? 0`. Null means nothing was carried and the row says so in words; zero means the
         season opened at zero and the row shows a figure. Collapsing them here would make the
         resync path disagree with the load path about a team's first season. */
      openingBalance: d.openingBalance == null ? null : Number(d.openingBalance),
      openingBalanceFrom: (d.openingBalanceFrom as string | null) ?? null,
    };
  } catch {
    // Offline, or the resync itself failed. The caller keeps whatever is on screen and keeps
    // showing its error — guessing a value here would be the very thing this function fixes.
    return null;
  }
}

/** Throws with the SERVER's message when there is one — a coach reading "Could not save" when the
 *  route said "You do not have access to team finances" is being told the wrong thing. */
export async function patchAccountingSetting(
  orgSlug: string,
  teamId: string,
  body: AccountingSettingPatch,
): Promise<void> {
  const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/accounting-settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? 'Could not save that setting.');
  }
}
