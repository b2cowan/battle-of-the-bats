/**
 * lib/admin-kit-marker.ts — the admin's MARKERS on the coaches portal's kit (Admin Design Continuity,
 * released 2026-09-28, closed 2026-09-30; plan `docs/projects/archive/ADMIN_DESIGN_CONTINUITY_PLAN.md`).
 *
 * This file used to be THE SWITCH (`lib/admin-kit-preview.ts`): a dev-only cookie, its door and a
 * fail-closed staging-branch check kept the half-built kit off production while Phase 1 was built on the
 * shared `dev` branch. The release deleted all three: the admin layout and both volunteer shells wear the
 * marker in EVERY build, and every reader (`useAdminKit()`) answers true inside them. The program's
 * closing step renamed the file to what it is now.
 *
 * What it holds is the two attribute pairs, each spread in ONE place (`tests/unit/admin-kit-switch-guard.test.ts`):
 *   • `adminKitAttr` — the admin layout (and `PortalKitRoot` for a surface portaled out of it);
 *   • `guestKitAttr` — the volunteer shells, through `GuestKitRoot`.
 */

/**
 * Spread onto the admin shell's outermost element: `data-coach-warm-enabled` (so the warm palette block
 * in `app/globals.css` applies, exactly as it does for the coaches portal, and the account's Warm / Dark
 * setting chooses) and `data-admin-kit` (the admin-only kit rules: R1's colours, F1's card style, the
 * public-preview island).
 */
export const adminKitAttr: Readonly<Record<string, string>> = {
  'data-coach-warm-enabled': '',
  'data-admin-kit': '',
};

/**
 * Spread onto the VOLUNTEER shells' outermost element (the scorekeeper, the gate) — slice 5, ruling R3.
 *   • `data-admin-kit` — the kit's own rules (the gate's board is the admin's check-in board, already on
 *     the kit; the windows, fields and chips);
 *   • `data-guest-kit` — the WARM palette, FIXED: `app/globals.css` keys the warm block on it too, with no
 *     account attribute in the selector, so a phone set to Dark still shows these screens warm.
 * ⚠ Deliberately NOT `data-coach-warm-enabled`: that half of the admin's pair is what lets the device's
 * Warm/Dark setting choose — the dark gate keys on it and would answer a Dark phone with the dark palette.
 * Why fixed: the setting lives on the DEVICE, and a gate phone is shared, so the last person to hold it
 * would decide what the next volunteer sees; a light screen also reads better in the sun at a field.
 */
export const guestKitAttr: Readonly<Record<string, string>> = {
  'data-admin-kit': '',
  'data-guest-kit': '',
};
