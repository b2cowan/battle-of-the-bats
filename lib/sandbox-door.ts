/**
 * lib/sandbox-door.ts — where the "See it live" door goes, and whether it is open yet.
 *
 * Two doors in Phase 1 (mockups section 6): beside the free-signup CTA on
 * `/for-tournament-organizers`, and as a second link on the homepage's Tournament persona card.
 * Both sit BESIDE the signup CTA, never in front of it — the sandbox is the proof, signup is still
 * the ask.
 *
 * ── Why this is a flag and not just a link ──────────────────────────────────────────────────
 *
 * **Turning these two buttons on in production is a separate decision the owner makes**, together
 * with creating the demo org on the production database, and it gets its own entry in the Business
 * Decisions Log because it changes how the funnel works. Phase 1 builds and verifies everything on
 * dev; it does not ship the doors.
 *
 * So the default is: **visible in local development, hidden in a production build**, overridable
 * either way by `NEXT_PUBLIC_SEE_IT_LIVE_DOORS`. That default is the honest one for this repo —
 * Amplify builds every branch with `NODE_ENV=production`, so a deployed dev branch also hides the
 * doors until somebody sets the variable on purpose. Which is exactly the release step described
 * above, expressed as one deliberate action rather than a hope that nobody merges the wrong thing.
 *
 * The DOOR ITSELF (`/see-it-live`) is always live wherever the sandbox is seeded — this flag only
 * governs whether the marketing site advertises it. A shared link keeps working either way, which
 * is what lets the owner walk the demo before anyone else can find it.
 */

/** The one door path. Reserved in `lib/reserved-slugs.ts` so no org can ever shadow it. */
export const SEE_IT_LIVE_PATH = '/see-it-live';

/**
 * The coach sandbox's door — a sibling under the same reserved path
 * (`COACH_SANDBOX_SEASON_PHASES_PLAN.md`). Same rules, same posture, different world: it signs in
 * the ONE demo coach and lands on the mid-season team. Each sandbox keeps its own door, confirm
 * screen and switch endpoint rather than sharing parameterized ones — "which account" must stay a
 * compile-time constant on every path that can establish a session.
 */
export const SEE_IT_LIVE_COACHES_PATH = '/see-it-live/coaches';
export const COACH_CONFIRM_PATH = '/see-it-live/coaches/switch';
export const COACH_SWITCH_ENDPOINT = '/api/sandbox/switch-coach';

/**
 * The confirm screen, shown to the ONE kind of visitor the door has to ask something of: somebody
 * already signed in as themselves, whose session would be replaced by the demo's.
 *
 * A prospect never sees it. Nothing is collected on it. It exists because signing a paying customer
 * out of their own account without warning is not something a marketing button gets to do.
 */
export const SANDBOX_CONFIRM_PATH = '/see-it-live/switch';

/**
 * The confirm screen's one button posts here. Named once so the screen and the handler cannot drift
 * apart — a renamed endpoint with a hardcoded form action fails silently, as a button that does
 * nothing.
 */
export const SANDBOX_SWITCH_ENDPOINT = '/api/sandbox/switch';

/** Should the marketing site show its "See it live" doors? */
export function sandboxDoorsVisible(): boolean {
  const explicit = process.env.NEXT_PUBLIC_SEE_IT_LIVE_DOORS;
  if (explicit !== undefined && explicit !== '') return explicit === 'true';
  return process.env.NODE_ENV !== 'production';
}
