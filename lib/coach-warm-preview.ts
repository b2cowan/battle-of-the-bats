/**
 * lib/coach-warm-preview.ts
 * Internal dev-preview gate for the warm coaches portal (WARM_PORTAL_THEME_OPTION_PLAN,
 * TH-5 release rule). The two coaches shells emit a `data-coach-warm-enabled` marker on
 * their outermost element ONLY when this is on; globals.css then combines that marker with
 * the shared `html[data-user-theme="warm"]` account preference to flip the portal warm.
 *
 * Off in production (the env var is unset there) → the marker is never emitted → the portal
 * renders dark for everyone regardless of preference, satisfying the "no half-shipped warm
 * portal, one public release" rule. The single public release deletes this gate; until then
 * warm is dev-only. Reads a NEXT_PUBLIC var so it resolves identically on server and client
 * (no hydration mismatch).
 */
const COACH_WARM_PREVIEW = process.env.NEXT_PUBLIC_COACH_WARM_PREVIEW === '1';

/**
 * Spread onto a shell's outermost element: `{...coachWarmAttr}`. Adds the marker attribute
 * when the preview flag is on, nothing otherwise — so the warm CSS can never match in prod.
 */
export const coachWarmAttr: Record<string, string> = COACH_WARM_PREVIEW
  ? { 'data-coach-warm-enabled': '' }
  : {};
