/**
 * IS THE CLUB'S SPONSORSHIPS PLACE OPEN TO CUSTOMERS? — one switch, held (owner ruling 2026-11-22, option A).
 *
 * Board Ready Stage 6 Part 1 (commit ee17f50df) is built but unwalked and cannot yet offer a deal, and the Club and League Plus
 * plans go on sale right after the next production promote. So the place stays HIDDEN FROM EVERY CUSTOMER until its owner walk
 * (§560 in the Owner QA Ledger) passes. FLIP THIS TO `true` WHEN WALK §560 PASSES — that one edit opens everything below.
 *
 * What it closes, all through the one plan question (`planCarriesModule` in lib/module-entitlements.ts, which every entry point
 * already asks): the sidebar, phone bar and More-sheet rows, the bar's place name, the place's pages (its layout sends the
 * visitor to the admin home), every /api/admin/sponsorships route (`requireSponsorships`), the public site editor's Sponsors
 * door, Payouts' "Processing fee on sponsorships" row and its route, the Members "What they can open" row and the role guide
 * row, the help hub link and the guide's Sponsorships article (lib/help-content/held.ts), and the "what stops if you cancel"
 * line (lib/billing-cancellation-policy.ts). `tests/unit/sponsorships-switch-guard.test.ts` fails the build if one stops asking.
 *
 * To walk it with the switch off, flip it to `true` locally (there is no environment override: this repo has none for a held
 * feature — `CHAT_PAUSED` and `FULL_COPY_BY_HAND_CONFIRMED` are plain constants too) and do not commit that edit.
 *
 * No imports, so client components and the unit tests can load it. Callers ask `sponsorshipsOpen()`, never the constant.
 */
export const SPONSORSHIPS_OPEN: boolean = false;

/**
 * The question every entry point asks. TEST SEAM: a unit test that exercises the feature itself (who opens it, what its nav
 * lists) sets `globalThis.__SPONSORSHIPS_OPEN_FOR_TESTS__ = true` at the top of its file — a global, never an environment
 * variable, so no deployed server or customer browser can ever read it. Nothing outside a test file sets it
 * (`tests/unit/sponsorships-switch-guard.test.ts` fails the build if app code does).
 */
export function sponsorshipsOpen(): boolean {
  return SPONSORSHIPS_OPEN || (globalThis as { __SPONSORSHIPS_OPEN_FOR_TESTS__?: boolean }).__SPONSORSHIPS_OPEN_FOR_TESTS__ === true;
}
