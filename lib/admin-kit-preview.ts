/**
 * lib/admin-kit-preview.ts — THE SWITCH for the admin's move onto the coaches portal's kit
 * (Admin Design Continuity, Phase 1; plan `docs/projects/active/ADMIN_DESIGN_CONTINUITY_PLAN.md`
 * §3a, build prompt `ADMIN_DESIGN_CONTINUITY_PHASE1_BUILD_PROMPT.md` "THE SWITCH").
 *
 * ⚠ WHY A SWITCH. Phase 1 is built over several sessions on the one shared `dev` branch, and `dev`
 * is promoted whenever anyone ships. Nothing it changes may reach a customer before its single
 * release day, so every visible change hangs off ONE attribute that only this file can turn on.
 * The coaches portal's warm look was built exactly this way (`7e5c6bf0`; `lib/coach-warm-preview.ts`
 * records that history), and this file is modelled on it.
 *
 * ⚠ THE RULES, all build-enforced by `tests/unit/admin-kit-switch-guard.test.ts`:
 *   1. NEVER ON THE PRODUCTION BRANCH, and fail-closed. It may be turned on in two places only:
 *      the local dev server (not a production build) and the STAGING deploy — a production build
 *      that positively knows it was built from the `dev` branch (`APP_BUILD_BRANCH`, which
 *      `amplify.yml` copies from Amplify's own AWS_BRANCH, so a build can only ever name its own
 *      branch). The `master` build names `master`; a production build that names nothing (a local
 *      `next build`, a build outside Amplify) is treated as production. Owner, 2026-09-25: the
 *      first version keyed this to "any production build", which also locked out staging — a
 *      deploy with no customers and the natural place to test with real test accounts on a phone.
 *   2. OFF BY DEFAULT wherever it may be on. Other people walk admin screens on the same dev
 *      server and the same staging site, and must not meet a half-restyled admin. It turns on per
 *      BROWSER, through the door `/api/dev/admin-kit?on=1` (which sets the cookie below), and off
 *      with `?on=0`.
 *   3. THE SERVER DECIDES IT (the admin layout reads the cookie), so there is no flash: the first
 *      paint is already the right frame.
 *   4. ONE ATTRIBUTE PAIR, on the admin shell's outermost element: `data-coach-warm-enabled` (so the
 *      warm palette block in `app/globals.css` applies, exactly as it does for the coaches portal)
 *      and `data-admin-kit` (for the admin-only kit rules: R1's colours, F1's card style, the
 *      public-preview island). Nothing else decides it.
 *
 * ⚠ THE RELEASE SLICE DELETES THIS FILE: the marker becomes unconditional on the admin shell, the
 * cookie and the door go, and every legacy branch that renders when this is false goes with them.
 */

/** The cookie the dev-only door sets. A per-browser choice — it never leaves the dev server. */
export const ADMIN_KIT_COOKIE = 'flhq_admin_kit';

/** The one branch whose production build may carry the switch: staging. */
const STAGING_BRANCH = 'dev';

/**
 * Whether the kit may be on at all: the local dev server, or the staging build. False on the
 * production branch, and false on any production build that cannot say it is staging.
 */
export function isAdminKitAvailable(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.APP_BUILD_BRANCH === STAGING_BRANCH;
}

/** Is the kit on for this request? Pass the cookie's value (server: `(await cookies()).get(…)`). */
export function readAdminKit(cookieValue: string | undefined | null): boolean {
  if (!isAdminKitAvailable()) return false;
  return cookieValue === '1';
}

/** Spread onto the admin shell's outermost element when the kit is on — and ONLY then. */
export const adminKitAttr: Readonly<Record<string, string>> = {
  'data-coach-warm-enabled': '',
  'data-admin-kit': '',
};

/**
 * Spread onto the VOLUNTEER shells' outermost element (the scorekeeper, the gate) when the kit is on —
 * and ONLY then (slice 5, ruling R3). The same switch, the same door, a different pair:
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
