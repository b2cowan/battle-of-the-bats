/**
 * lib/coach-warm-preview.ts
 * The warm coaches portal is PUBLICLY RELEASED (WARM_PORTAL_THEME_OPTION_PLAN, TH-5 §4): the two
 * coaches shells always emit the `data-coach-warm-enabled` marker on their outermost element, and
 * globals.css combines that marker with the shared `html[data-user-theme="warm"]` account
 * preference (warm is the platform default; dark only on an explicit choice) to flip the portal warm.
 *
 * Historically this was gated behind an internal `NEXT_PUBLIC_COACH_WARM_PREVIEW` dev flag so the
 * half-built warm portal never shipped mid-way; that gate is retired now that warm coverage is
 * complete (the single public release). The marker is unconditional — the theme preference alone
 * decides dark vs warm.
 */

/**
 * Spread onto a shell's outermost element: `{...coachWarmAttr}`. Emits the marker unconditionally so
 * the warm CSS applies whenever the active theme is warm (the default) and stays dark under an
 * explicit dark preference.
 */
export const coachWarmAttr: Record<string, string> = { 'data-coach-warm-enabled': '' };
